import { useEffect } from 'react';
import { getNearbyEmitter, isNearbyAvailable } from './nearbyTransport';
import { useMultiplayerSessionStore } from './multiplayerSessionStore';

/**
 * Subscribes to native Nearby events once. Mount at app root (e.g. inside AppNavigator).
 */
export function useNearbyListeners(): void {
    useEffect(() => {
        if (!isNearbyAvailable()) return;
        const emitter = getNearbyEmitter();
        if (!emitter) return;

        const subFound = emitter.addListener(
            'QuantumNearby_endpointFound',
            (e: { endpointId: string; endpointName: string }) => {
                useMultiplayerSessionStore.getState().appendDiscovered({
                    endpointId: e.endpointId,
                    endpointName: e.endpointName,
                });
            }
        );
        const subLost = emitter.addListener(
            'QuantumNearby_endpointLost',
            (e: { endpointId: string }) => {
                useMultiplayerSessionStore.getState().removeDiscovered(e.endpointId);
            }
        );
        const subResult = emitter.addListener(
            'QuantumNearby_connectionResult',
            (e: { endpointId: string; success?: boolean; status?: number }) => {
                if (e.success === false) return;
                const st = useMultiplayerSessionStore.getState();
                if (st.isHost) {
                    st.hostOnPeerConnected(e.endpointId);
                } else {
                    st.peerSetHostEndpoint(e.endpointId);
                    const { myMemberId, displayName } = useMultiplayerSessionStore.getState();
                    setTimeout(() => {
                        useMultiplayerSessionStore
                            .getState()
                            .peerSend({
                                type: 'hello',
                                memberId: myMemberId,
                                displayName,
                            })
                            .catch(() => {});
                    }, 150);
                }
            }
        );
        const subPayload = emitter.addListener(
            'QuantumNearby_payloadReceived',
            (e: { endpointId: string; base64: string }) => {
                const st = useMultiplayerSessionStore.getState();
                if (st.isHost) {
                    st.hostHandlePayload(e.endpointId, e.base64);
                } else {
                    st.peerHandlePayload(e.base64);
                }
            }
        );
        const subDisc = emitter.addListener(
            'QuantumNearby_disconnected',
            (e: { endpointId: string }) => {
                const st = useMultiplayerSessionStore.getState();
                if (st.isHost) {
                    st.hostOnPeerDisconnected(e.endpointId);
                } else {
                    st.resetSession();
                }
            }
        );

        return () => {
            subFound.remove();
            subLost.remove();
            subResult.remove();
            subPayload.remove();
            subDisc.remove();
        };
    }, []);
}
