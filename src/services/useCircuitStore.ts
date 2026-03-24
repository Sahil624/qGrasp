import { create } from 'zustand';
import { Gate, GateType } from '../models/gate';
import {
    Circuit,
    createCircuit,
    addGate as circuitAddGate,
    removeGateAt as circuitRemoveGateAt,
    clearCircuit as circuitClear,
} from '../models/circuit';
import { DEFAULT_QUBIT_COUNT, MAX_QUBITS, markerIdToGate } from '../core/constants';
import { executeCircuit, getQubitProbabilities } from './quantumService';
import {
    buildCircuitFromGridDetections,
    buildCircuitFromGridTextPayload,
    GateTagDetection,
    GridScanProfile,
} from './gridScan';

interface CircuitStore {
    circuit: Circuit;
    probabilities: Record<string, number>;
    selectedQubitForGate: number;
    cxControlQubit: number | null;

    // Actions
    addGate: (gate: Gate) => void;
    removeGateAt: (index: number) => void;
    clearCirc: () => void;
    setQubitCount: (count: number) => void;
    setSelectedQubitForGate: (qubit: number) => void;
    setCxControlQubit: (qubit: number | null) => void;
    addGateFromMarker: (gateLabel: string) => void;
    replaceCircuitFromGridScan: (
        detections: GateTagDetection[],
        profile: GridScanProfile,
        qubitCount?: number
    ) => { warnings: string[]; added: number };
    replaceCircuitFromGridPayload: (
        payload: string
    ) => { warnings: string[]; added: number };
    getQubitProbs: (qubitIndex: number) => { p0: number; p1: number } | null;
}

export const useCircuitStore = create<CircuitStore>((set, get) => ({
    circuit: createCircuit(DEFAULT_QUBIT_COUNT),
    probabilities: {},
    selectedQubitForGate: 0,
    cxControlQubit: null,

    addGate: (gate: Gate) => {
        set((state) => {
            const newCircuit = circuitAddGate(
                { ...state.circuit, gridColumnCount: undefined },
                gate
            );
            return {
                circuit: newCircuit,
                probabilities: executeCircuit(newCircuit).probabilities,
            };
        });
    },

    removeGateAt: (index: number) => {
        set((state) => {
            const newCircuit = circuitRemoveGateAt(
                { ...state.circuit, gridColumnCount: undefined },
                index
            );
            return {
                circuit: newCircuit,
                probabilities: executeCircuit(newCircuit).probabilities,
            };
        });
    },

    clearCirc: () => {
        set((state) => {
            const newCircuit = circuitClear(state.circuit);
            return {
                circuit: newCircuit,
                probabilities: executeCircuit(newCircuit).probabilities,
                cxControlQubit: null,
            };
        });
    },

    setQubitCount: (count: number) => {
        if (count < 1 || count > MAX_QUBITS) return;
        set((state) => {
            const newCircuit: Circuit = {
                gates: state.circuit.gates,
                qubitCount: count,
                gridColumnCount: undefined,
            };
            return {
                circuit: newCircuit,
                probabilities: executeCircuit(newCircuit).probabilities,
            };
        });
    },

    setSelectedQubitForGate: (qubit: number) => {
        set({ selectedQubitForGate: qubit });
    },

    setCxControlQubit: (qubit: number | null) => {
        set({ cxControlQubit: qubit });
    },

    addGateFromMarker: (label: string) => {
        const { addGate: add, selectedQubitForGate: target, cxControlQubit, circuit } = get();
        const upper = label.toUpperCase();

        switch (upper) {
            case 'H':
                add({ type: GateType.H, target });
                break;
            case 'X':
                add({ type: GateType.X, target });
                break;
            case 'Y':
                add({ type: GateType.Y, target });
                break;
            case 'Z':
                add({ type: GateType.Z, target });
                break;
            case 'CX':
                if (cxControlQubit != null) {
                    add({ type: GateType.CX, target, control: cxControlQubit });
                } else {
                    add({
                        type: GateType.CX,
                        target: (target + 1) % circuit.qubitCount,
                        control: target,
                    });
                }
                break;
        }
    },

    replaceCircuitFromGridScan: (detections, profile, qubitCount) => {
        const result = buildCircuitFromGridDetections(detections, profile, qubitCount);
        const nextQubitCount = Math.max(1, Math.min(MAX_QUBITS, qubitCount ?? profile.rows));
        const nextCircuit: Circuit = {
            gates: result.gates,
            qubitCount: nextQubitCount,
            gridColumnCount: profile.cols,
        };
        set({
            circuit: nextCircuit,
            probabilities: executeCircuit(nextCircuit).probabilities,
            cxControlQubit: null,
            selectedQubitForGate: 0,
        });
        return { warnings: result.warnings, added: result.gates.length };
    },

    replaceCircuitFromGridPayload: (payload) => {
        const result = buildCircuitFromGridTextPayload(payload);
        const nextQubitCount = Math.max(1, Math.min(MAX_QUBITS, result.profile.rows));
        const nextCircuit: Circuit = {
            gates: result.gates,
            qubitCount: nextQubitCount,
            gridColumnCount: result.profile.cols,
        };
        set({
            circuit: nextCircuit,
            probabilities: executeCircuit(nextCircuit).probabilities,
            cxControlQubit: null,
            selectedQubitForGate: 0,
        });
        return { warnings: result.warnings, added: result.gates.length };
    },

    getQubitProbs: (qubitIndex: number) => {
        const { probabilities } = get();
        if (Object.keys(probabilities).length === 0) return null;
        return getQubitProbabilities(probabilities, qubitIndex);
    },
}));
