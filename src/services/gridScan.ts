import { Gate, GateType } from '../models/gate';
import { MAX_QUBITS } from '../core/constants';

export type GridProfileId = 'a4_4x6' | 'a3_5x8' | 'custom';

export interface GridScanProfile {
    id: GridProfileId;
    name: string;
    rows: number;
    cols: number;
    snapThresholdCells: number;
    blankColumnMinGap: number;
}

export interface GateTagDetection {
    code: string;
    centerX: number; // normalized 0..1: cell center in grid (or legacy continuous coords)
    centerY: number;
    /** 0-based row when native already snapped to grid (preferred over re-snapping centers). */
    row?: number;
    /** 0-based column. */
    col?: number;
    confidence?: number;
}

export interface SnappedPlacement {
    code: string;
    row: number;
    col: number;
    confidence: number;
}

export interface GridScanResult {
    profile: GridScanProfile;
    placements: SnappedPlacement[];
    gates: Gate[];
    warnings: string[];
    blankColumns: number[];
}

export interface RawFrameDetection {
    tags: GateTagDetection[];
    inferredProfile?: GridScanProfile;
}

export const GRID_SCAN_PROFILES: Record<Exclude<GridProfileId, 'custom'>, GridScanProfile> = {
    a4_4x6: {
        id: 'a4_4x6',
        name: 'A4 4x6',
        rows: 4,
        cols: 6,
        snapThresholdCells: 0.45,
        blankColumnMinGap: 1,
    },
    a3_5x8: {
        id: 'a3_5x8',
        name: 'A3 5x8',
        rows: 5,
        cols: 8,
        snapThresholdCells: 0.45,
        blankColumnMinGap: 1,
    },
};

const SINGLE_GATE_CODE_TO_TYPE: Record<string, GateType> = {
    H: GateType.H,
    X: GateType.X,
    Y: GateType.Y,
    Z: GateType.Z,
    S: GateType.S,
    SDG: GateType.SDG,
    T: GateType.T,
    TDG: GateType.TDG,
};

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function normalizeCode(code: string): string {
    return code.trim().toUpperCase();
}

function codeToSingleGate(code: string): GateType | null {
    const normalized = normalizeCode(code);
    return SINGLE_GATE_CODE_TO_TYPE[normalized] ?? null;
}

export function inferProfileFromDetections(detections: GateTagDetection[]): GridScanProfile {
    if (detections.length === 0) return GRID_SCAN_PROFILES.a4_4x6;
    const xs = detections.map((d) => d.centerX).sort((a, b) => a - b);
    const ys = detections.map((d) => d.centerY).sort((a, b) => a - b);
    const spreadX = xs[xs.length - 1] - xs[0];
    const spreadY = ys[ys.length - 1] - ys[0];
    if (spreadX > 0.75 && spreadY > 0.7 && detections.length >= 10) {
        return GRID_SCAN_PROFILES.a3_5x8;
    }
    return GRID_SCAN_PROFILES.a4_4x6;
}

export function preprocessFrameDetections(raw: RawFrameDetection): RawFrameDetection {
    const cleanedTags = raw.tags.filter(
        (tag) =>
            (tag.row != null && tag.col != null && Number.isFinite(tag.row) && Number.isFinite(tag.col)) ||
            (Number.isFinite(tag.centerX) && Number.isFinite(tag.centerY))
    );
    return {
        tags: cleanedTags.map((tag) => ({
            ...tag,
            centerX: Number.isFinite(tag.centerX) ? clamp(tag.centerX, 0, 1) : 0,
            centerY: Number.isFinite(tag.centerY) ? clamp(tag.centerY, 0, 1) : 0,
            row: tag.row != null && Number.isFinite(tag.row) ? Math.round(tag.row) : undefined,
            col: tag.col != null && Number.isFinite(tag.col) ? Math.round(tag.col) : undefined,
            code: normalizeCode(tag.code),
        })),
        inferredProfile: raw.inferredProfile,
    };
}

export function runGridPipelineFromFrame(
    raw: RawFrameDetection,
    forcedProfile?: GridScanProfile
): GridScanResult {
    const preprocessed = preprocessFrameDetections(raw);
    const profile = forcedProfile ?? preprocessed.inferredProfile ?? inferProfileFromDetections(preprocessed.tags);
    return buildCircuitFromGridDetections(preprocessed.tags, profile, profile.rows);
}

export function snapDetectionsToGrid(
    detections: GateTagDetection[],
    profile: GridScanProfile
): { placements: SnappedPlacement[]; warnings: string[] } {
    const warnings: string[] = [];
    const placements: SnappedPlacement[] = [];

    detections.forEach((detection) => {
        let colFloat: number;
        let rowFloat: number;
        let col: number;
        let row: number;
        if (detection.row != null && detection.col != null) {
            row = clamp(detection.row, 0, profile.rows - 1);
            col = clamp(detection.col, 0, profile.cols - 1);
            rowFloat = row;
            colFloat = col;
        } else {
            colFloat = detection.centerX * (profile.cols - 1);
            rowFloat = detection.centerY * (profile.rows - 1);
            col = clamp(Math.round(colFloat), 0, profile.cols - 1);
            row = clamp(Math.round(rowFloat), 0, profile.rows - 1);
        }
        const colDelta = Math.abs(colFloat - col);
        const rowDelta = Math.abs(rowFloat - row);
        const distance = Math.max(colDelta, rowDelta);
        if (distance > profile.snapThresholdCells) {
            warnings.push(`Low snap confidence for ${detection.code} near (${rowFloat.toFixed(2)}, ${colFloat.toFixed(2)}).`);
        }

        placements.push({
            code: normalizeCode(detection.code),
            row,
            col,
            confidence: detection.confidence ?? 1 - Math.min(distance, 1),
        });
    });

    return { placements, warnings };
}

function resolveMultiQubit(
    columnPlacements: SnappedPlacement[],
    qubitCount: number,
    warnings: string[]
): Gate[] {
    const gates: Gate[] = [];
    const singles: SnappedPlacement[] = [];
    const cxControls: SnappedPlacement[] = [];
    const cxTargets: SnappedPlacement[] = [];
    const swapA: SnappedPlacement[] = [];
    const swapB: SnappedPlacement[] = [];

    for (const placement of columnPlacements) {
        if (placement.code === 'CX_C') cxControls.push(placement);
        else if (placement.code === 'CX_T') cxTargets.push(placement);
        else if (placement.code === 'SWAP_A') swapA.push(placement);
        else if (placement.code === 'SWAP_B') swapB.push(placement);
        else singles.push(placement);
    }

    singles.forEach((placement) => {
        const type = codeToSingleGate(placement.code);
        if (!type) {
            warnings.push(`Unknown gate code: ${placement.code}`);
            return;
        }
        if (placement.row >= qubitCount) {
            warnings.push(`Placement outside qubit count: ${placement.code} at row ${placement.row}`);
            return;
        }
        gates.push({ type, target: placement.row, timeColumn: placement.col });
    });

    cxControls.forEach((control) => {
        const bestTarget = cxTargets
            .filter((target) => target.row !== control.row)
            .sort((a, b) => Math.abs(a.row - control.row) - Math.abs(b.row - control.row))[0];
        if (!bestTarget) {
            warnings.push(`CX control at row ${control.row} has no target in same column.`);
            return;
        }
        const col = control.col;
        gates.push({
            type: GateType.CX,
            control: control.row,
            target: bestTarget.row,
            timeColumn: col,
        });
    });

    swapA.forEach((left) => {
        const right = swapB
            .filter((candidate) => candidate.row !== left.row)
            .sort((a, b) => Math.abs(a.row - left.row) - Math.abs(b.row - left.row))[0];
        if (!right) {
            warnings.push(`SWAP marker at row ${left.row} has no pair in same column.`);
            return;
        }
        gates.push({
            type: GateType.SWAP,
            control: left.row,
            target: right.row,
            timeColumn: left.col,
        });
    });

    return gates.filter((gate) => gate.target < qubitCount && (gate.control ?? 0) < qubitCount);
}

function inferBlankColumns(placements: SnappedPlacement[], cols: number): number[] {
    const occupied = new Set(placements.map((p) => p.col));
    const blank: number[] = [];
    for (let col = 0; col < cols; col += 1) {
        if (!occupied.has(col)) blank.push(col);
    }
    return blank;
}

export function buildCircuitFromGridDetections(
    detections: GateTagDetection[],
    profile: GridScanProfile,
    requestedQubitCount?: number
): GridScanResult {
    const { placements, warnings } = snapDetectionsToGrid(detections, profile);
    const qubitCount = clamp(requestedQubitCount ?? profile.rows, 1, MAX_QUBITS);
    const byColumn = new Map<number, SnappedPlacement[]>();

    placements.forEach((placement) => {
        if (!byColumn.has(placement.col)) byColumn.set(placement.col, []);
        byColumn.get(placement.col)!.push(placement);
    });

    const sortedCols = Array.from(byColumn.keys()).sort((a, b) => a - b);
    const gates: Gate[] = [];
    sortedCols.forEach((col) => {
        const resolved = resolveMultiQubit(byColumn.get(col) ?? [], qubitCount, warnings);
        gates.push(...resolved);
    });

    const blankColumns = inferBlankColumns(placements, profile.cols);
    if (blankColumns.length > 0) {
        warnings.push(`Detected intentional blank time steps at columns: ${blankColumns.join(', ')}.`);
    }

    return {
        profile,
        placements,
        gates,
        warnings,
        blankColumns,
    };
}

export function buildCircuitFromGridTextPayload(
    payload: string,
    fallbackProfile: GridScanProfile = GRID_SCAN_PROFILES.a4_4x6
): GridScanResult {
    const parts = payload.trim().split(';').map((p) => p.trim()).filter(Boolean);
    const header = parts[0] ?? '';
    let profile = fallbackProfile;
    const headerMatch = /^GRID:(\d+),(\d+)$/i.exec(header);
    let startIndex = 0;
    if (headerMatch) {
        profile = {
            ...fallbackProfile,
            id: 'custom',
            name: `Custom ${headerMatch[1]}x${headerMatch[2]}`,
            rows: parseInt(headerMatch[1], 10),
            cols: parseInt(headerMatch[2], 10),
        };
        startIndex = 1;
    }

    const detections: GateTagDetection[] = [];
    for (let i = startIndex; i < parts.length; i += 1) {
        const match = /^([A-Z0-9_]+)@(\d+),(\d+)$/i.exec(parts[i]);
        if (!match) continue;
        const code = normalizeCode(match[1]);
        const row = parseInt(match[2], 10);
        const col = parseInt(match[3], 10);
        const centerX = profile.cols <= 1 ? 0 : col / (profile.cols - 1);
        const centerY = profile.rows <= 1 ? 0 : row / (profile.rows - 1);
        detections.push({ code, centerX, centerY, confidence: 1 });
    }
    return buildCircuitFromGridDetections(detections, profile, profile.rows);
}

