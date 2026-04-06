import { create } from 'zustand';
import type {
    ClientToHostMessage,
    HostToClientMessage,
    MemberRole,
    RoomMember,
    RoomState,
    ScenarioId,
} from './types';
import { initialRoomState } from './types';
import { decodePayload, encodePayload } from './wire';
import { assertNearby, nearbyApi } from './nearbyTransport';
import { expectedTeleportCorrection } from './teleportHelpers';

function randomId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

function assignRoles(members: RoomMember[], scenario: ScenarioId | null): RoomMember[] {
    if (!scenario) return members.map((m) => ({ ...m, role: undefined }));
    const copy = members.map((m) => ({ ...m }));
    if (scenario === 'A' || scenario === 'B') {
        if (copy[0]) copy[0] = { ...copy[0], role: 'alice' as MemberRole };
        if (copy[1]) copy[1] = { ...copy[1], role: 'bob' as MemberRole };
    }
    if (scenario === 'C') {
        if (copy[0]) copy[0] = { ...copy[0], role: 'alice' as MemberRole };
        if (copy[1]) copy[1] = { ...copy[1], role: 'bob' as MemberRole };
        if (copy[2]) copy[2] = { ...copy[2], role: 'eve' as MemberRole };
    }
    return copy;
}

interface MultiplayerSessionState {
    myMemberId: string;
    isHost: boolean;
    displayName: string;
    roomState: RoomState;
    /** Host: endpoints of connected students */
    peerEndpoints: string[];
    /** Peer: host's endpoint id */
    hostEndpointId: string | null;
    discovered: { endpointId: string; endpointName: string }[];
    connectionStatus: 'idle' | 'advertising' | 'discovering' | 'connected' | 'error';
    lastError: string | null;
    eveTimer: ReturnType<typeof setInterval> | null;

    resetSession: () => void;
    setDisplayName: (n: string) => void;

    /** Host */
    hostStartAdvertising: (displayName: string) => Promise<void>;
    hostStopAdvertising: () => Promise<void>;
    hostBroadcast: (state: RoomState) => void;
    hostSetScenario: (s: ScenarioId | null) => void;
    hostSetHint: (hint: string) => void;
    hostStartExercise: () => void;
    hostPause: () => void;
    hostResetScenario: () => void;
    hostHandlePayload: (endpointId: string, base64: string) => void;
    hostOnPeerConnected: (endpointId: string) => void;
    hostOnPeerDisconnected: (endpointId: string) => void;
    hostDisconnectAll: () => Promise<void>;
    hostStartEveWindow: () => void;
    appendDiscovered: (d: { endpointId: string; endpointName: string }) => void;
    removeDiscovered: (endpointId: string) => void;

    /** Peer */
    peerEnsureName: (name: string) => Promise<void>;
    peerStartDiscovery: () => Promise<void>;
    peerStopDiscovery: () => Promise<void>;
    peerConnect: (localName: string, remoteEndpointId: string) => Promise<void>;
    peerHandlePayload: (base64: string) => void;
    peerSetHostEndpoint: (endpointId: string) => void;
    peerSend: (msg: ClientToHostMessage) => Promise<void>;
    peerDisconnect: () => Promise<void>;

    applyRoomState: (state: RoomState) => void;
}

export const useMultiplayerSessionStore = create<MultiplayerSessionState>((set, get) => ({
    myMemberId: randomId(),
    isHost: false,
    displayName: '',
    roomState: initialRoomState(''),
    peerEndpoints: [],
    hostEndpointId: null,
    discovered: [],
    connectionStatus: 'idle',
    lastError: null,
    eveTimer: null,

    resetSession: () => {
        const t = get().eveTimer;
        if (t) clearInterval(t);
        set({
            myMemberId: randomId(),
            isHost: false,
            roomState: initialRoomState(''),
            peerEndpoints: [],
            hostEndpointId: null,
            discovered: [],
            connectionStatus: 'idle',
            lastError: null,
            eveTimer: null,
        });
    },

    setDisplayName: (n) => set({ displayName: n }),

    hostStartAdvertising: async (displayName) => {
        assertNearby();
        const hostId = get().myMemberId;
        set({
            isHost: true,
            displayName,
            connectionStatus: 'advertising',
            roomState: { ...initialRoomState(hostId), phase: 'lobby', members: [] },
        });
        await nearbyApi.startAdvertising(displayName);
    },

    hostStopAdvertising: async () => {
        await nearbyApi.stopAdvertising();
        set({ connectionStatus: 'idle' });
    },

    hostBroadcast: (state) => {
        const endpoints = get().peerEndpoints;
        const msg: HostToClientMessage = { type: 'room_state', state };
        const payload = encodePayload(msg);
        for (const eid of endpoints) {
            nearbyApi.sendPayload(eid, payload).catch(() => {});
        }
    },

    hostSetScenario: (scenario) => {
        const rs = get().roomState;
        let members = assignRoles(rs.members, scenario);
        const next: RoomState = {
            ...rs,
            scenario,
            members,
            phase: scenario ? 'intro' : 'lobby',
            paused: true,
        };
        set({ roomState: next });
        get().hostBroadcast(next);
    },

    hostSetHint: (hint) => {
        const next = { ...get().roomState, roomHint: hint };
        set({ roomState: next });
        get().hostBroadcast(next);
    },

    hostStartExercise: () => {
        const rs = get().roomState;
        let next: RoomState = { ...rs, paused: false, phase: 'active' };
        if (next.scenario === 'A') {
            next = { ...next, bellPrepared: true };
        }
        if (next.scenario === 'B') {
            next = { ...next, teleportPhase: 'entangled' };
        }
        if (next.scenario === 'C') {
            next = {
                ...next,
                bb84Round: next.bb84Round + 1,
                unsafeConnection: false,
                siftErrorRate: null,
            };
        }
        set({ roomState: next });
        get().hostBroadcast(next);
        if (next.scenario === 'C') {
            get().hostStartEveWindow();
        }
    },

    hostPause: () => {
        const next = { ...get().roomState, paused: true };
        set({ roomState: next });
        get().hostBroadcast(next);
    },

    hostResetScenario: () => {
        const t = get().eveTimer;
        if (t) clearInterval(t);
        const hostId = get().myMemberId;
        const scenario = get().roomState.scenario;
        const members = get().roomState.members;
        const hint = get().roomState.roomHint;
        const base = initialRoomState(hostId);
        let next: RoomState = {
            ...base,
            scenario,
            members,
            hostMemberId: hostId,
            phase: scenario ? 'intro' : 'lobby',
            paused: true,
            roomHint: hint,
        };
        if (scenario) {
            next.members = assignRoles(members, scenario);
        }
        set({ roomState: next, eveTimer: null });
        get().hostBroadcast(next);
    },

    hostOnPeerConnected: (endpointId) => {
        const eps = get().peerEndpoints;
        if (eps.includes(endpointId)) return;
        set({ peerEndpoints: [...eps, endpointId], connectionStatus: 'connected' });
    },

    hostOnPeerDisconnected: (endpointId) => {
        const eps = get().peerEndpoints.filter((e) => e !== endpointId);
        const members = get().roomState.members.filter((m) => m.endpointId !== endpointId);
        const rs = { ...get().roomState, members };
        set({ peerEndpoints: eps, roomState: rs });
        get().hostBroadcast(rs);
    },

    hostHandlePayload: (endpointId, base64) => {
        const msg = decodePayload(base64);
        if (!msg) return;
        if (msg.type === 'room_state' || msg.type === 'toast') return;
        let rs = get().roomState;

        if (msg.type === 'hello') {
            const existing = rs.members.find((m) => m.id === msg.memberId);
            let members: RoomMember[];
            if (existing) {
                members = rs.members.map((m) =>
                    m.id === msg.memberId ? { ...m, endpointId, displayName: msg.displayName } : m
                );
            } else {
                members = [
                    ...rs.members,
                    { id: msg.memberId, displayName: msg.displayName, endpointId },
                ];
            }
            if (rs.scenario) {
                members = assignRoles(members, rs.scenario);
            }
            rs = { ...rs, members };
            set({ roomState: rs });
            get().hostBroadcast(rs);
            return;
        }

        if (msg.type === 'scenario_a_measure') {
            const role = rs.members.find((m) => m.id === msg.memberId)?.role;
            if (role !== 'alice') return;
            const bobBit = msg.bit;
            rs = {
                ...rs,
                aliceMeasured: true,
                aliceBit: msg.bit,
                bobBit,
            };
            set({ roomState: rs });
            get().hostBroadcast(rs);
            return;
        }

        if (msg.type === 'scenario_b_submit_bits') {
            rs = {
                ...rs,
                teleportPhase: 'alice_sent',
                classicalBits: [msg.b0, msg.b1],
            };
            set({ roomState: rs });
            get().hostBroadcast(rs);
            return;
        }

        if (msg.type === 'scenario_b_bob_done') {
            const bobRole = rs.members.find((m) => m.id === msg.memberId)?.role;
            if (bobRole !== 'bob') return;
            const bits = rs.classicalBits;
            const expected =
                bits != null ? expectedTeleportCorrection(bits) : 'I';
            const ok = msg.correctionId === expected;
            rs = {
                ...rs,
                teleportPhase: 'done',
                bobCorrectionId: msg.correctionId,
                teleportVerified: ok,
            };
            set({ roomState: rs });
            get().hostBroadcast(rs);
            return;
        }

        if (msg.type === 'scenario_c_eve_intercept') {
            rs = {
                ...rs,
                unsafeConnection: true,
            };
            set({ roomState: rs });
            get().hostBroadcast(rs);
        }
    },

    hostDisconnectAll: async () => {
        const t = get().eveTimer;
        if (t) clearInterval(t);
        await nearbyApi.disconnectAll();
        get().resetSession();
    },

    hostStartEveWindow: () => {
        const t = get().eveTimer;
        if (t) clearInterval(t);
        const ends = Date.now() + 10000;
        const rs0 = get().roomState;
        let rs = {
            ...rs0,
            eveWindowActive: true,
            eveWindowEndsAt: ends,
            unsafeConnection: false,
            siftErrorRate: null,
        };
        set({ roomState: rs, eveTimer: null });
        get().hostBroadcast(rs);
        const id = setInterval(() => {
            if (Date.now() >= ends) {
                clearInterval(id);
                const cur = get().roomState;
                const intercepted = cur.unsafeConnection === true;
                const next: RoomState = {
                    ...cur,
                    eveWindowActive: false,
                    eveWindowEndsAt: null,
                    siftErrorRate: intercepted ? 0.52 : 0.06,
                };
                set({ roomState: next, eveTimer: null });
                get().hostBroadcast(next);
            }
        }, 500);
        set({ eveTimer: id });
    },

    appendDiscovered: (d) =>
        set((s) => ({
            discovered: s.discovered.some((x) => x.endpointId === d.endpointId)
                ? s.discovered
                : [...s.discovered, d],
        })),

    removeDiscovered: (endpointId) =>
        set((s) => ({
            discovered: s.discovered.filter((x) => x.endpointId !== endpointId),
        })),

    peerEnsureName: async (name) => {
        assertNearby();
        set({ displayName: name, isHost: false });
        await nearbyApi.ensureSessionWithName(name);
    },

    peerStartDiscovery: async () => {
        assertNearby();
        set({ connectionStatus: 'discovering', discovered: [] });
        await nearbyApi.startDiscovery();
    },

    peerStopDiscovery: async () => {
        await nearbyApi.stopDiscovery();
    },

    peerConnect: async (localName, remoteEndpointId) => {
        await nearbyApi.requestConnection(localName, remoteEndpointId);
    },

    peerSetHostEndpoint: (endpointId) => {
        set({ hostEndpointId: endpointId, connectionStatus: 'connected' });
    },

    peerHandlePayload: (base64) => {
        const msg = decodePayload(base64);
        if (!msg) return;
        if (msg.type === 'room_state') {
            set({ roomState: msg.state });
        }
    },

    peerSend: async (msg) => {
        const hid = get().hostEndpointId;
        if (!hid) return;
        await nearbyApi.sendPayload(hid, encodePayload(msg));
    },

    peerDisconnect: async () => {
        const hid = get().hostEndpointId;
        if (hid) await nearbyApi.disconnect(hid);
        get().resetSession();
    },

    applyRoomState: (state) => set({ roomState: state }),
}));
