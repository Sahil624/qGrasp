package edu.ksu.quantumgrasp

import android.graphics.BitmapFactory
import android.net.Uri
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import org.opencv.android.OpenCVLoader
import org.opencv.core.CvType
import org.opencv.core.Mat
import org.opencv.core.MatOfPoint
import org.opencv.core.MatOfPoint2f
import org.opencv.core.Point
import org.opencv.core.Rect
import org.opencv.core.Scalar
import org.opencv.core.Size
import org.opencv.imgcodecs.Imgcodecs
import org.opencv.imgproc.Imgproc
import org.opencv.objdetect.ArucoDetector
import org.opencv.objdetect.DetectorParameters
import org.opencv.objdetect.Objdetect
import kotlin.math.max
import kotlin.math.min
import java.io.File

/**
 * GridDetectorModule
 *
 * High-level pipeline:
 * 1) Load camera image URI into OpenCV Mat
 * 2) Detect outer playmat boundary and perspective-rectify to canonical size
 * 3) Binarize for debug / ROI preview; decode gates from grayscale via ArUco
 * 4) OpenCV ArUco DICT_4X4_50: gate marker ids 0–7; playmat corners use ids 10–13.
 *    Grid snapping uses an A4 inset on the warped bitmap; if any gate center falls outside
 *    that inset (virtual mat / tight homography), ROI expands to the full warped frame.
 * 5) Return tag detections with normalized centers back to JS
 *
 * Grid size choice (4x6 vs 5x8):
 * Prefer the smaller grid when scores tie. With ArUco, false reads are rarer than with
 * the old 4x4 custom bitmask decoder.
 *
 * Debugging:
 * - Writes intermediate images under app external files:
 *   Android/data/<app-id>/files/grid_debug/<timestamp>/
 * - Logs under tag: GridDetector
 */
class GridDetectorModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {
    private val logTag = "GridDetector"

    /** Index in this list == ArUco marker id (must match scripts/generate_classroom_assets.py). */
    private val gateCodeByArucoId =
        listOf("H", "X", "Y", "Z", "CX_C", "CX_T", "SWAP_A", "SWAP_B")

    override fun getName(): String = "GridDetector"

    private data class DebugContext(
        val dir: File,
        val warnings: MutableList<String> = mutableListOf()
    )

    private data class ArucoDetection(val id: Int, val cx: Double, val cy: Double)

    /** Pixel ROI for snapping marker centers to grid cells (warped image coordinates). */
    private data class GridRect(val left: Int, val top: Int, val width: Int, val height: Int)

    @ReactMethod
    fun detectFromImage(imageUri: String, promise: Promise) {
        val debug = createDebugContext()
        try {
            Log.d(logTag, "detectFromImage() uri=$imageUri")
            if (!OpenCVLoader.initDebug()) {
                promise.reject("opencv_init_failed", "OpenCV initialization failed")
                return
            }
            Log.d(logTag, "OpenCV init success")
            val mat = loadImageMat(imageUri, debug)
            val warped = rectifyPlaymat(mat, debug)
            val decoded = decodeGridTags(warped, debug)
            Log.d(logTag, "Decoded tags=${decoded.tags.size()} profile=${decoded.rows}x${decoded.cols}")

            val root = Arguments.createMap()
            root.putArray("tags", decoded.tags)
            val profile = Arguments.createMap()
            profile.putInt("rows", decoded.rows)
            profile.putInt("cols", decoded.cols)
            root.putMap("profile", profile)
            val warnings = Arguments.createArray()
            debug.warnings.forEach { warnings.pushString(it) }
            warnings.pushString("debug_dir=${debug.dir.absolutePath}")
            root.putArray("warnings", warnings)
            promise.resolve(root)
        } catch (e: Exception) {
            Log.e(logTag, "detectFromImage failed: ${e.message}", e)
            debug.warnings.add("error=${e.message}")
            promise.reject("grid_detect_failed", e.message, e)
        }
    }

    private fun createDebugContext(): DebugContext {
        val base = reactContext.getExternalFilesDir(null) ?: reactContext.filesDir
        val dir = File(base, "grid_debug/${System.currentTimeMillis()}").apply { mkdirs() }
        return DebugContext(dir)
    }

    private fun saveMatDebug(debug: DebugContext, name: String, mat: Mat) {
        try {
            val out = File(debug.dir, "$name.png")
            Imgcodecs.imwrite(out.absolutePath, mat)
            Log.d(logTag, "Saved debug image ${out.absolutePath}")
        } catch (e: Exception) {
            Log.w(logTag, "Failed to save debug image $name: ${e.message}")
        }
    }

    private fun loadImageMat(imageUri: String, debug: DebugContext): Mat {
        val uri = Uri.parse(imageUri)
        val input = reactContext.contentResolver.openInputStream(uri)
            ?: throw IllegalStateException("Cannot open image URI")
        val bitmap = input.use { BitmapFactory.decodeStream(it) }
            ?: throw IllegalStateException("Cannot decode image bitmap")
        val rgba = Mat()
        org.opencv.android.Utils.bitmapToMat(bitmap, rgba)
        Log.d(logTag, "Loaded source image size=${rgba.cols()}x${rgba.rows()}")
        saveMatDebug(debug, "01_source_rgba", rgba)
        return rgba
    }

    private fun rectifyPlaymat(rgba: Mat, debug: DebugContext): Mat {
        val gray = Mat()
        Imgproc.cvtColor(rgba, gray, Imgproc.COLOR_RGBA2GRAY)
        Imgproc.GaussianBlur(gray, gray, Size(5.0, 5.0), 0.0)
        saveMatDebug(debug, "02_blurred_gray", gray)

        val edges = Mat()
        Imgproc.Canny(gray, edges, 80.0, 180.0)
        saveMatDebug(debug, "03_edges", edges)

        val contours = ArrayList<MatOfPoint>()
        Imgproc.findContours(edges, contours, Mat(), Imgproc.RETR_EXTERNAL, Imgproc.CHAIN_APPROX_SIMPLE)
        Log.d(logTag, "Contours found=${contours.size}")
        val largestQuad = contours
            .mapNotNull { contour ->
                val area = Imgproc.contourArea(contour)
                if (area < 20000) return@mapNotNull null
                val contour2f = MatOfPoint2f(*contour.toArray())
                val approx = MatOfPoint2f()
                Imgproc.approxPolyDP(contour2f, approx, 0.02 * Imgproc.arcLength(contour2f, true), true)
                if (approx.total() == 4L) Pair(area, approx) else null
            }
            .maxByOrNull { it.first }
            ?.second
            ?: throw IllegalStateException("Playmat boundary not detected")

        // Destination order must be TL, TR, BR, BL matching orderQuadPoints output.
        val ordered = orderQuadPoints(largestQuad.toArray())
        Log.d(
            logTag,
            "Ordered corners TL=${ordered[0]} TR=${ordered[1]} BR=${ordered[2]} BL=${ordered[3]}"
        )
        val dstSize = Size(1200.0, 850.0)
        val dst = MatOfPoint2f(
            Point(0.0, 0.0),
            Point(dstSize.width - 1, 0.0),
            Point(dstSize.width - 1, dstSize.height - 1),
            Point(0.0, dstSize.height - 1),
        )
        val transform = Imgproc.getPerspectiveTransform(MatOfPoint2f(*ordered), dst)
        val warped = Mat(dstSize, CvType.CV_8UC4, Scalar(255.0, 255.0, 255.0, 255.0))
        Imgproc.warpPerspective(rgba, warped, transform, dstSize)
        saveMatDebug(debug, "04_warped_rgba", warped)
        return warped
    }

    /** TL, TR, BR, BL for OpenCV getPerspectiveTransform. */
    private fun orderQuadPoints(points: Array<Point>): Array<Point> {
        val pts = points.toList()
        val sums = pts.map { it.x + it.y }
        val minIdx = sums.indices.minByOrNull { sums[it] }!!
        val maxIdx = sums.indices.maxByOrNull { sums[it] }!!
        val tl = pts[minIdx]
        val br = pts[maxIdx]
        val rest = (0 until 4).filter { it != minIdx && it != maxIdx }.map { pts[it] }
        require(rest.size == 2)
        val tr = if (rest[0].y <= rest[1].y) rest[0] else rest[1]
        val bl = if (rest[0].y <= rest[1].y) rest[1] else rest[0]
        return arrayOf(tl, tr, br, bl)
    }

    private data class DecodeOutcome(
        val rows: Int,
        val cols: Int,
        val tags: com.facebook.react.bridge.WritableArray
    )

    private fun decodeGridTags(warpedRgba: Mat, debug: DebugContext): DecodeOutcome {
        val graySrc = Mat()
        Imgproc.cvtColor(warpedRgba, graySrc, Imgproc.COLOR_RGBA2GRAY)
        saveMatDebug(debug, "05_warped_gray", graySrc)
        val binary = Mat()
        Imgproc.adaptiveThreshold(
            graySrc,
            binary,
            255.0,
            Imgproc.ADAPTIVE_THRESH_GAUSSIAN_C,
            Imgproc.THRESH_BINARY,
            41,
            7.0
        )
        saveMatDebug(debug, "06_warped_binary", binary)

        val dict = Objdetect.getPredefinedDictionary(Objdetect.DICT_4X4_50)
        val detParams = DetectorParameters()
        detParams.set_minMarkerPerimeterRate(0.03)
        val detector = ArucoDetector(dict, detParams)
        val arucoCorners = ArrayList<Mat>()
        val arucoIds = Mat()
        detector.detectMarkers(graySrc, arucoCorners, arucoIds)
        val arucoOverlay = Mat()
        Imgproc.cvtColor(graySrc, arucoOverlay, Imgproc.COLOR_GRAY2BGR)
        if (arucoCorners.isNotEmpty() && !arucoIds.empty()) {
            Objdetect.drawDetectedMarkers(arucoOverlay, arucoCorners, arucoIds)
        }
        saveMatDebug(debug, "05b_aruco_overlay", arucoOverlay)

        val arucoList = parseArucoDetections(arucoCorners, arucoIds)
        for (d in arucoList) {
            Log.d(logTag, "ArUco id=${d.id} center=(${"%.1f".format(d.cx)}, ${"%.1f".format(d.cy)})")
        }

        // Inset matches scripts/generate_classroom_assets.py (full A4 landscape sheet in warp).
        // If perspective warp effectively fills the bitmap with only the grid (tight quad / virtual
        // mat), markers in the top rows sit "above" this inset — use full frame as grid ROI.
        var gridRect = canonicalPlaymatGridRect(graySrc.cols(), graySrc.rows())
        val gateMarkers = arucoList.filter { it.id >= 0 && it.id < gateCodeByArucoId.size }
        val gatesOutsideInset =
            gateMarkers.count { !gridRectContains(gridRect, it.cx, it.cy) }
        if (gatesOutsideInset > 0) {
            Log.w(
                logTag,
                "Grid ROI: $gatesOutsideInset gate marker(s) outside canonical A4 inset — " +
                    "using full warped bitmap as grid (inset would miss those cells)."
            )
            gridRect =
                GridRect(0, 0, graySrc.cols(), graySrc.rows())
        }
        Log.d(
            logTag,
            "Grid ROI left=${gridRect.left} top=${gridRect.top} width=${gridRect.width} height=${gridRect.height} " +
                "image=${graySrc.cols()}x${graySrc.rows()}"
        )

        val candidates = listOf(Pair(4, 6)) // , Pair(5, 8) [was disabled due to poor performance, only supports 4x6 for now]
        var bestOutcome: DecodeOutcome? = null
        var bestScore = Double.NEGATIVE_INFINITY
        var bestRows = 0
        var bestCols = 0
        var bestHighQ = 0

        val roiPreview = Mat()
        Imgproc.cvtColor(binary, roiPreview, Imgproc.COLOR_GRAY2BGR)
        Imgproc.rectangle(
            roiPreview,
            Point(gridRect.left.toDouble(), gridRect.top.toDouble()),
            Point((gridRect.left + gridRect.width).toDouble(), (gridRect.top + gridRect.height).toDouble()),
            Scalar(0.0, 0.0, 255.0),
            2
        )
        saveMatDebug(debug, "07_grid_roi_preview", roiPreview)

        for ((rows, cols) in candidates) {
            val out = Arguments.createArray()
            val cellW = gridRect.width / cols.toDouble()
            val cellH = gridRect.height / rows.toDouble()
            Log.d(logTag, "Trying candidate rows=$rows cols=$cols cellW=$cellW cellH=$cellH")
            var candidateCellHits = 0
            var highQuality = 0
            var score = 0.0
            val candidatePreview = Mat()
            Imgproc.cvtColor(binary, candidatePreview, Imgproc.COLOR_GRAY2BGR)

            val gatesInCells = snapGateArucoToGrid(
                arucoList,
                gridRect.left,
                gridRect.top,
                gridRect.width,
                gridRect.height,
                rows,
                cols
            )

            for (row in 0 until rows) {
                for (col in 0 until cols) {
                    val cellX = (gridRect.left + col * cellW).toInt().coerceIn(0, binary.cols() - 1)
                    val cellY = (gridRect.top + row * cellH).toInt().coerceIn(0, binary.rows() - 1)
                    val rw = min(cellW.toInt(), binary.cols() - cellX).coerceAtLeast(1)
                    val rh = min(cellH.toInt(), binary.rows() - cellY).coerceAtLeast(1)

                    val hit = gatesInCells[row to col]
                    if (hit == null) {
                        Imgproc.rectangle(
                            candidatePreview,
                            Rect(cellX, cellY, rw, rh),
                            Scalar(160.0, 160.0, 160.0),
                            1
                        )
                        continue
                    }

                    highQuality++
                    val confidence = 1.0
                    score += 1000.0 + confidence * 100.0
                    val code = gateCodeByArucoId[hit.id]
                    val centerX = (col + 0.5) / cols.toDouble()
                    val centerY = (row + 0.5) / rows.toDouble()

                    val tag = Arguments.createMap()
                    tag.putString("code", code)
                    tag.putInt("row", row)
                    tag.putInt("col", col)
                    tag.putDouble("centerX", centerX)
                    tag.putDouble("centerY", centerY)
                    tag.putDouble("confidence", confidence)
                    out.pushMap(tag)
                    candidateCellHits++

                    val square = min(cellW, cellH).toInt().coerceAtLeast(16)
                    val tagRectX = (cellX + (cellW - square) / 2.0).toInt()
                    val tagRectY = (cellY + (cellH - square) / 2.0).toInt()
                    Imgproc.rectangle(
                        candidatePreview,
                        Rect(tagRectX, tagRectY, square, square),
                        Scalar(0.0, 255.0, 0.0),
                        2
                    )
                    Imgproc.putText(
                        candidatePreview,
                        code,
                        Point(tagRectX.toDouble(), (tagRectY - 4).toDouble()),
                        Imgproc.FONT_HERSHEY_SIMPLEX,
                        0.4,
                        Scalar(255.0, 0.0, 0.0),
                        1
                    )
                }
            }
            val cellCount = rows * cols
            // Prefer smaller grid when scores are close (stops 5x8 from winning on noise).
            val footprintPenalty = cellCount * 2.5
            val finalScore = score - footprintPenalty
            Log.d(
                logTag,
                "Candidate ${rows}x${cols}: exported=$candidateCellHits highQ=$highQuality score=$finalScore (raw=$score footprintPen=$footprintPenalty)"
            )
            saveMatDebug(debug, "08_candidate_${rows}x${cols}_hits_${candidateCellHits}_score_${finalScore.toInt()}", candidatePreview)
            val better = when {
                bestOutcome == null -> true
                finalScore > bestScore + 1e-3 -> true
                kotlin.math.abs(finalScore - bestScore) <= 1e-3 && cellCount < bestRows * bestCols -> true
                else -> false
            }
            if (better) {
                bestScore = finalScore
                bestOutcome = DecodeOutcome(rows, cols, out)
                bestRows = rows
                bestCols = cols
                bestHighQ = highQuality
            }
        }
        Log.d(logTag, "Best candidate rows=$bestRows cols=$bestCols score=$bestScore highQ=$bestHighQ")
        debug.warnings.add("debug_best_candidate=${bestRows}x${bestCols}_score=$bestScore highQ=$bestHighQ")

        return bestOutcome ?: DecodeOutcome(4, 6, Arguments.createArray())
    }

    /**
     * Grid area on the *full printed sheet* (margin + anchors + title above the gate grid).
     * Same ratios as [scripts/generate_classroom_assets.py] for default A4 landscape.
     */
    private fun canonicalPlaymatGridRect(warpW: Int, warpH: Int): GridRect =
        GridRect(
            (warpW * (42.0 / 297.0)).toInt(),
            (warpH * (42.0 / 210.0)).toInt(),
            (warpW * (192.0 / 297.0)).toInt(),
            (warpH * (128.0 / 210.0)).toInt(),
        )

    private fun gridRectContains(r: GridRect, x: Double, y: Double): Boolean =
        x >= r.left && x < r.left + r.width && y >= r.top && y < r.top + r.height

    private fun parseArucoDetections(corners: ArrayList<Mat>, ids: Mat): List<ArucoDetection> {
        if (ids.empty() || corners.isEmpty()) return emptyList()
        // ids can be N×1 or 1×N (Android OpenCV often uses 1×N); ids.rows() alone would miss markers.
        val idCount = min(ids.total().toInt(), corners.size)
        val out = ArrayList<ArucoDetection>(idCount)
        for (i in 0 until idCount) {
            val r = i / ids.cols()
            val c = i % ids.cols()
            val idRow = ids.get(r, c) ?: continue
            val id = idRow[0].toInt()
            val cm = corners[i]
            if (cm.empty()) continue
            // Corner Mat layout varies (e.g. 1x4 vs 4x1 CV_32FC2); Mat.get(j,0) can be null.
            val pts = MatOfPoint2f(cm).toArray()
            if (pts.isEmpty()) continue
            var sx = 0.0
            var sy = 0.0
            for (pt in pts) {
                sx += pt.x
                sy += pt.y
            }
            val count = pts.size
            out.add(ArucoDetection(id, sx / count, sy / count))
        }
        return out
    }

    /**
     * Map ArUco detections to grid cells. Only ids 0..7 are gates; playmat corners use 10..13.
     * If two markers land in the same cell, keep the one closer to that cell's center.
     */
    private fun snapGateArucoToGrid(
        detections: List<ArucoDetection>,
        gridLeft: Int,
        gridTop: Int,
        gridWidth: Int,
        gridHeight: Int,
        rows: Int,
        cols: Int
    ): Map<Pair<Int, Int>, ArucoDetection> {
        val byCell = HashMap<Pair<Int, Int>, ArucoDetection>()
        val bestDist2 = HashMap<Pair<Int, Int>, Double>()
        for (det in detections) {
            if (det.id < 0 || det.id >= gateCodeByArucoId.size) continue
            val nx = (det.cx - gridLeft) / gridWidth
            val ny = (det.cy - gridTop) / gridHeight
            if (nx < 0.0 || nx > 1.0 || ny < 0.0 || ny > 1.0) continue
            val col = (nx * cols).toInt().coerceIn(0, cols - 1)
            val row = (ny * rows).toInt().coerceIn(0, rows - 1)
            val cellCx = gridLeft + (col + 0.5) / cols * gridWidth
            val cellCy = gridTop + (row + 0.5) / rows * gridHeight
            val dx = det.cx - cellCx
            val dy = det.cy - cellCy
            val d2 = dx * dx + dy * dy
            val key = row to col
            val prev = bestDist2[key]
            if (prev == null || d2 < prev) {
                bestDist2[key] = d2
                byCell[key] = det
            }
        }
        return byCell
    }
}

