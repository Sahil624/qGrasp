import {
    NativeEventEmitter,
    NativeModules,
    Platform,
    type NativeModule,
} from 'react-native';
import { describeCustomNativeBlocker } from '../nativeRuntime';
import { ensureNearbyAndroidPermissions } from './nearbyAndroidPermissions';

type QuantumNearbyNative = {
    addListener: (eventName: string) => void;
    removeListeners: (count: number) => void;
    startAdvertising: (endpointName: string) => Promise<void>;
    stopAdvertising: () => Promise<void>;
    startDiscovery: () => Promise<void>;
    stopDiscovery: () => Promise<void>;
    ensureSessionWithName: (name: string) => Promise<void>;
    requestConnection: (endpointName: string, endpointId: string) => Promise<void>;
    disconnect: (endpointId: string) => Promise<void>;
    disconnectAll: () => Promise<void>;
    sendPayload: (endpointId: string, base64: string) => Promise<void>;
    getServiceId: () => Promise<string>;
};

const Native: QuantumNearbyNative | undefined = NativeModules.QuantumNearby;

export const isNearbyAvailable = (): boolean =>
    Platform.OS !== 'web' && Native != null;

export function getNearbyEmitter(): NativeEventEmitter | null {
    if (!Native) return null;
    return new NativeEventEmitter(Native as unknown as NativeModule);
}

export const nearbyApi = {
    startAdvertising: async (name: string) => {
        await ensureNearbyAndroidPermissions('host');
        return Native!.startAdvertising(name);
    },
    stopAdvertising: () => Native!.stopAdvertising(),
    startDiscovery: async () => {
        await ensureNearbyAndroidPermissions('peer');
        return Native!.startDiscovery();
    },
    stopDiscovery: () => Native!.stopDiscovery(),
    ensureSessionWithName: (name: string) => Native!.ensureSessionWithName(name),
    requestConnection: (localName: string, remoteEndpointId: string) =>
        Native!.requestConnection(localName, remoteEndpointId),
    disconnect: (endpointId: string) => Native!.disconnect(endpointId),
    disconnectAll: () => Native!.disconnectAll(),
    sendPayload: (endpointId: string, base64: string) => Native!.sendPayload(endpointId, base64),
    getServiceId: () => Native!.getServiceId(),
};

export function nearbyUnavailableMessage(): string {
    const blocker = describeCustomNativeBlocker();
    if (blocker) return blocker;
    return 'QuantumNearby native module is missing. Reinstall the dev client from this repo: npx expo run:android (or ios).';
}

export function assertNearby(): void {
    if (!isNearbyAvailable()) {
        throw new Error(nearbyUnavailableMessage());
    }
}
