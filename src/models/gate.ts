export enum GateType {
    H = 'H',   // Hadamard
    X = 'X',   // Pauli-X
    Y = 'Y',   // Pauli-Y
    Z = 'Z',   // Pauli-Z
    S = 'S',   // Phase (π/2)
    SDG = 'SDG', // S-dagger
    T = 'T',   // Phase (π/4)
    TDG = 'TDG', // T-dagger
    RX = 'RX', // Rotation around X
    RY = 'RY', // Rotation around Y
    RZ = 'RZ', // Rotation around Z
    CX = 'CX', // CNOT (controlled-NOT)
    CZ = 'CZ', // Controlled-Z
    SWAP = 'SWAP', // SWAP
    CCX = 'CCX', // Toffoli (CCNOT)
}

/** A gate instance with optional control qubit for 2-qubit gates. */
export interface Gate {
    type: GateType;
    target: number;
    control?: number;
    control2?: number;
    params?: Partial<Record<'theta' | 'phi' | 'lambda', number>>;
    /** Grid playmat column (time step T0..T{n-1}); set by grid scan for diagram layout. */
    timeColumn?: number;
}

export function gateLabel(gate: Gate): string {
    return gate.type;
}

export function gateDisplayName(gate: Gate): string {
    if (gate.type === GateType.CCX && gate.control != null && gate.control2 != null) {
        return `CCX(${gate.control},${gate.control2},${gate.target})`;
    }
    if (
        (gate.type === GateType.CX || gate.type === GateType.CZ) &&
        gate.control != null
    ) {
        return `${gate.type}(${gate.control},${gate.target})`;
    }
    if (gate.type === GateType.SWAP && gate.control != null) {
        return `SWAP(${gate.control},${gate.target})`;
    }
    if ((gate.type === GateType.RX || gate.type === GateType.RY || gate.type === GateType.RZ) && gate.params?.theta != null) {
        const theta = gate.params.theta;
        return `${gate.type}(${gate.target},${Number.isFinite(theta) ? theta.toFixed(3) : theta})`;
    }
    return `${gate.type}(${gate.target})`;
}
