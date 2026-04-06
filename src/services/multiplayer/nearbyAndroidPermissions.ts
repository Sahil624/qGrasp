import { PermissionsAndroid, Platform, type Permission } from 'react-native';

function apiLevel(): number {
    const v = Platform.Version;
    return typeof v === 'number' ? v : parseInt(String(v), 10);
}

/**
 * Google Nearby Connections needs runtime Bluetooth permissions on Android 12+.
 * Older versions use location for classic Bluetooth scan.
 */
export async function ensureNearbyAndroidPermissions(role: 'host' | 'peer'): Promise<void> {
    if (Platform.OS !== 'android') return;

    const v = apiLevel();
    const P = PermissionsAndroid.PERMISSIONS;

    if (v >= 31) {
        const required: Permission[] = [P.BLUETOOTH_SCAN, P.BLUETOOTH_CONNECT];
        if (role === 'host') {
            required.push(P.BLUETOOTH_ADVERTISE);
        }
        if (v >= 33) {
            required.push(P.NEARBY_WIFI_DEVICES);
        }
        const result = await PermissionsAndroid.requestMultiple(required);
        for (const perm of required) {
            if (result[perm] !== PermissionsAndroid.RESULTS.GRANTED) {
                const short = perm.replace('android.permission.', '');
                throw new Error(
                    `Bluetooth permission denied (${short}). Enable Nearby / Bluetooth permissions for this app in system Settings.`
                );
            }
        }
        return;
    }

    if (v >= 23) {
        const loc =
            v >= 29 ? P.ACCESS_FINE_LOCATION : P.ACCESS_COARSE_LOCATION;
        const r = await PermissionsAndroid.request(loc);
        if (r !== PermissionsAndroid.RESULTS.GRANTED) {
            throw new Error(
                'Location permission is required for Bluetooth on Android 11 and below. Allow it when prompted, or enable it in Settings.'
            );
        }
    }
}
