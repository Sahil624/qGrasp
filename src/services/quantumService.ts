import { Gate, GateType } from '../models/gate';
import { Circuit } from '../models/circuit';
import { isGateEnabled } from '../constants/quantumGates';
import { gateDisplayName } from '../models/gate';
import { QUANTUM_DEBUG_LOGS, QUANTUM_DEBUG_TOP_K } from '../constants/quantumDebug';
import { jsqubits } from 'jsqubits';


export interface QuantumResult {
    probabilities: Record<string, number>;
}

function debugLogCircuit(circuit: Circuit) {
    if (!QUANTUM_DEBUG_LOGS) return;
    const gateNames = circuit.gates.map((g) => gateDisplayName(g));
    console.log('[quantum] executeCircuit input', {
        qubits: circuit.qubitCount,
        gates: gateNames,
    });
}

function debugLogProbs(probabilities: Record<string, number>) {
    if (!QUANTUM_DEBUG_LOGS) return;

    const entries = Object.entries(probabilities);
    const sum = entries.reduce((s, [, p]) => s + p, 0);
    const top = entries
        .sort((a, b) => b[1] - a[1])
        .slice(0, QUANTUM_DEBUG_TOP_K)
        .map(([state, p]) => [state, Number(p.toFixed(10))]);

    console.log('[quantum] executeCircuit output', {
        sumProb: Number(sum.toFixed(10)),
        top,
    });
}

function assertGateAllowed(gate: Gate, qubitCount: number) {
    if (!isGateEnabled(gate.type)) {
        throw new Error(`Gate disabled: ${gate.type}`);
    }
    if (gate.target < 0 || gate.target >= qubitCount) {
        throw new RangeError(`Invalid target qubit: ${gate.target}`);
    }

    const needsControl =
        gate.type === GateType.CX ||
        gate.type === GateType.CZ ||
        gate.type === GateType.SWAP ||
        gate.type === GateType.CCX;
    if (needsControl) {
        if (gate.control == null) throw new RangeError(`Missing control qubit`);
        if (gate.control < 0 || gate.control >= qubitCount) {
            throw new RangeError(`Invalid control qubit: ${gate.control}`);
        }
    }
    if (gate.type === GateType.CCX) {
        if (gate.control2 == null) throw new RangeError(`Missing control2 qubit`);
        if (gate.control2 < 0 || gate.control2 >= qubitCount) {
            throw new RangeError(`Invalid control2 qubit: ${gate.control2}`);
        }
    }

    if (
        (gate.type === GateType.RX ||
            gate.type === GateType.RY ||
            gate.type === GateType.RZ) &&
        gate.params?.theta == null
    ) {
        throw new RangeError(`Missing theta for ${gate.type}`);
    }
}

export function executeCircuit(circuit: Circuit): QuantumResult {
    const n = circuit.qubitCount;
    let state = jsqubits('0'.repeat(n));

    debugLogCircuit(circuit);

    for (const gate of circuit.gates) {
        assertGateAllowed(gate, n);
        switch (gate.type) {
            case GateType.H:
                state = state.hadamard(n - 1 - gate.target);
                break;
            case GateType.X:
                state = state.x(n - 1 - gate.target);
                break;
            case GateType.Y:
                state = state.y(n - 1 - gate.target);
                break;
            case GateType.Z:
                state = state.z(n - 1 - gate.target);
                break;
            case GateType.S:
                state = state.s(n - 1 - gate.target);
                break;
            case GateType.SDG:
                // jsqubits doesn't expose SDG directly; S† = r(-π/2)
                state = state.r(n - 1 - gate.target, -Math.PI / 2);
                break;
            case GateType.T:
                state = state.t(n - 1 - gate.target);
                break;
            case GateType.TDG:
                // jsqubits doesn't expose TDG directly; T† = r(-π/4)
                state = state.r(n - 1 - gate.target, -Math.PI / 4);
                break;
            case GateType.RX:
                state = state.rotateX(n - 1 - gate.target, gate.params!.theta!);
                break;
            case GateType.RY:
                state = state.rotateY(n - 1 - gate.target, gate.params!.theta!);
                break;
            case GateType.RZ:
                state = state.rotateZ(n - 1 - gate.target, gate.params!.theta!);
                break;
            case GateType.CX:
                state = state.cnot(n - 1 - gate.control!, n - 1 - gate.target);
                break;
            case GateType.CZ:
                state = state.controlledZ(n - 1 - gate.control!, n - 1 - gate.target);
                break;
            case GateType.SWAP:
                state = state.swap(n - 1 - gate.control!, n - 1 - gate.target);
                break;
            case GateType.CCX:
                state = state.toffoli(
                    n - 1 - gate.control!,
                    n - 1 - gate.control2!,
                    n - 1 - gate.target
                );
                break;
        }
    }

    const probabilities: Record<string, number> = {};
    const dim = 1 << n;
    for (let i = 0; i < dim; i++) {
        const bitstring = i.toString(2).padStart(n, '0');
        const jsqBasis = bitstring;
        const amp = state.amplitude(jsqBasis);
        const p = amp.real * amp.real + amp.imaginary * amp.imaginary;
        probabilities[bitstring] = p;
    }

    debugLogProbs(probabilities);
    return { probabilities };
}

export function getQubitProbabilities(
    probabilities: Record<string, number>,
    qubitIndex: number
): { p0: number; p1: number } {
    let p0 = 0;
    let p1 = 0;
    for (const [state, prob] of Object.entries(probabilities)) {
        if (qubitIndex < state.length) {
            if (state[qubitIndex] === '0') p0 += prob;
            else p1 += prob;
        }
    }
    return { p0, p1 };
}
