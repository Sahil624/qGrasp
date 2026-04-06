import Constants from 'expo-constants';
import { NativeModules, Platform } from 'react-native';

/**
 * True when the JS bundle is running inside the Expo Go client.
 * Expo Go does not ship this repo's custom native code (GridDetector, QuantumNearby, Viro, etc.).
 */
export function isRunningInExpoGo(): boolean {
    return Constants.appOwnership === 'expo';
}

/**
 * Human-readable reason custom native modules are missing, or null if no known blocker.
 */
export function describeCustomNativeBlocker(): string | null {
    if (Platform.OS === 'web') {
        return 'This screen needs a native app build. Web does not load GridDetector, Nearby, or AR native code. From the project root run:\n\n  npx expo run:android\nor\n  npx expo run:ios\n\nThen open the installed dev client (not Expo Go, not the browser).';
    }
    if (isRunningInExpoGo()) {
        return 'You opened the project in Expo Go. Expo Go only includes Expo’s built-in native APIs — not this app’s custom modules (OpenCV grid, Nearby multiplayer, Viro).\n\nBuild and install the dev client, then use that app with Metro:\n\n  npx expo run:android\nor\n  npx expo run:ios';
    }
    return null;
}

/**
 * Whether a named legacy native module is linked (TurboModules may not appear on NativeModules).
 */
export function hasLegacyNativeModule(name: string): boolean {
    return NativeModules[name] != null;
}

/**
 * User-facing note when NativeModules logs “empty”: many modules are not enumerable there.
 */
export const NATIVE_MODULES_DEBUG_HINT =
    'Tip: console.log(NativeModules) often prints {} on modern RN; use NativeModules.GridDetector or NativeModules.QuantumNearby instead.';
