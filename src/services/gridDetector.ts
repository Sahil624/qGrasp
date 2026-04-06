import { NativeModules } from 'react-native';
import { describeCustomNativeBlocker } from './nativeRuntime';
import {
    GateTagDetection,
    GRID_SCAN_PROFILES,
    GridScanProfile,
    inferProfileFromDetections,
    preprocessFrameDetections,
} from './gridScan';

type NativeGridDetectorResponse = {
    tags: Array<{
        code: string;
        row?: number;
        col?: number;
        centerX: number;
        centerY: number;
        confidence?: number;
    }>;
    profile?: {
        rows?: number;
        cols?: number;
    };
    warnings?: string[];
};

type GridDetectorModule = {
    detectFromImage: (imageUri: string) => Promise<NativeGridDetectorResponse>;
};

const GridDetector = (NativeModules.GridDetector as GridDetectorModule | undefined) ?? undefined;

function buildProfileFromNativeHint(
    hint?: { rows?: number; cols?: number },
    fallbackTags: GateTagDetection[] = []
): GridScanProfile {
    if (hint?.rows && hint?.cols) {
        return {
            ...GRID_SCAN_PROFILES.a4_4x6,
            id: 'custom',
            name: `Detected ${hint.rows}x${hint.cols}`,
            rows: hint.rows,
            cols: hint.cols,
        };
    }
    return inferProfileFromDetections(fallbackTags);
}

export async function detectGridTagsFromImageUri(imageUri: string): Promise<{
    detections: GateTagDetection[];
    profile: GridScanProfile;
    warnings: string[];
}> {
    if (!GridDetector?.detectFromImage) {
        const blocker = describeCustomNativeBlocker();
        throw new Error(
            blocker ??
                'Native grid detector is not linked. Rebuild the dev client: npx expo run:android (or ios).'
        );
    }

    const nativeResult = await GridDetector.detectFromImage(imageUri);
    const frame = preprocessFrameDetections({
        tags: nativeResult.tags ?? [],
    });
    const profile = buildProfileFromNativeHint(nativeResult.profile, frame.tags);
    return {
        detections: frame.tags,
        profile,
        warnings: nativeResult.warnings ?? [],
    };
}

