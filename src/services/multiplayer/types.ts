/** Wire protocol + shared room state for classroom multiplayer (host-authoritative). */

export type ScenarioId = 'A' | 'B' | 'C';

export type MemberRole = 'alice' | 'bob' | 'eve';

export interface RoomMember {
    id: string;
    displayName: string;
    endpointId: string;
    role?: MemberRole;
}

export interface RoomState {
    scenario: ScenarioId | null;
    phase: string;
    paused: boolean;
    roomHint: string;
    members: RoomMember[];
    hostMemberId: string;
    /** Scenario A */
    bellPrepared: boolean;
    aliceMeasured: boolean;
    aliceBit: number | null;
    bobBit: number | null;
    /** Scenario B */
    teleportPhase: 'idle' | 'entangled' | 'alice_sent' | 'bob_decoded' | 'done';
    classicalBits: [number, number] | null;
    bobCorrectionId: string | null;
    teleportVerified: boolean | null;
    /** Scenario C */
    bb84Round: number;
    eveWindowActive: boolean;
    eveWindowEndsAt: number | null;
    siftErrorRate: number | null;
    unsafeConnection: boolean;
    bb84AliceBasis: string | null;
    bb84BobBasis: string | null;
}

export type ClientToHostMessage =
    | { type: 'hello'; memberId: string; displayName: string }
    | {
          type: 'scenario_a_measure';
          memberId: string;
          bit: number;
      }
    | {
          type: 'scenario_b_submit_bits';
          memberId: string;
          b0: number;
          b1: number;
      }
    | {
          type: 'scenario_b_bob_done';
          memberId: string;
          correctionId: string;
      }
    | { type: 'scenario_c_eve_intercept'; memberId: string; bit: number }
    | { type: 'ping'; memberId: string };

export type HostToClientMessage =
    | { type: 'room_state'; state: RoomState }
    | { type: 'toast'; message: string };

export const initialRoomState = (hostMemberId: string): RoomState => ({
    scenario: null,
    phase: 'lobby',
    paused: true,
    roomHint: '',
    members: [],
    hostMemberId,
    bellPrepared: false,
    aliceMeasured: false,
    aliceBit: null,
    bobBit: null,
    teleportPhase: 'idle',
    classicalBits: null,
    bobCorrectionId: null,
    teleportVerified: null,
    bb84Round: 0,
    eveWindowActive: false,
    eveWindowEndsAt: null,
    siftErrorRate: null,
    unsafeConnection: false,
    bb84AliceBasis: null,
    bb84BobBasis: null,
});
