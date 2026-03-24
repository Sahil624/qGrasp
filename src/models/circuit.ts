import { Gate, GateType } from './gate';
import { isGateEnabled } from '../constants/quantumGates';

/** Represents a quantum circuit as an ordered list of gates. */
export interface Circuit {
    gates: Gate[];
    qubitCount: number;
    /** When set (grid import), quantum-viz uses column-aligned time steps (playmat T columns). */
    gridColumnCount?: number;
}

export function createCircuit(qubitCount: number = 3): Circuit {
    return { gates: [], qubitCount };
}

export function addGate(circuit: Circuit, gate: Gate): Circuit {
    if (gate.target >= circuit.qubitCount) return circuit;
    if (!isGateEnabled(gate.type)) return circuit;
    if (
        gate.type === GateType.CX &&
        (gate.control == null || gate.control >= circuit.qubitCount)
    ) {
        return circuit;
    }
    if (
        gate.type === GateType.CZ &&
        (gate.control == null || gate.control >= circuit.qubitCount)
    ) {
        return circuit;
    }
    if (
        gate.type === GateType.SWAP &&
        (gate.control == null || gate.control >= circuit.qubitCount)
    ) {
        return circuit;
    }
    if (
        gate.type === GateType.CCX &&
        (gate.control == null ||
            gate.control2 == null ||
            gate.control >= circuit.qubitCount ||
            gate.control2 >= circuit.qubitCount)
    ) {
        return circuit;
    }
    if (
        (gate.type === GateType.RX ||
            gate.type === GateType.RY ||
            gate.type === GateType.RZ) &&
        gate.params?.theta == null
    ) {
        return circuit;
    }
    return { ...circuit, gates: [...circuit.gates, gate] };
}

export function removeGateAt(circuit: Circuit, index: number): Circuit {
    if (index < 0 || index >= circuit.gates.length) return circuit;
    const newGates = [...circuit.gates];
    newGates.splice(index, 1);
    return { ...circuit, gates: newGates };
}

export function clearCircuit(circuit: Circuit): Circuit {
    return { ...circuit, gates: [], gridColumnCount: undefined };
}
