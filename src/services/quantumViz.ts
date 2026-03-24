import type { Circuit as QvizCircuit, Operation } from '@microsoft/quantum-viz.js/lib/circuit';
import type { Register } from '@microsoft/quantum-viz.js/lib/register';
import type { StyleConfig } from '@microsoft/quantum-viz.js/lib/styles';
import { Circuit } from '../models/circuit';
import { Gate, GateType } from '../models/gate';

const QVIZ_READABLE_STYLE: StyleConfig = {
    lineStroke: '#1e293b',
    lineWidth: 1.5,
    textColour: '#0f172a',
    unitary: '#7dd3fc',
    oplus: '#f8fafc',
    measure: '#fbbf24',
    classicalUnknown: '#cbd5e1',
    classicalZero: '#b91c1c',
    classicalOne: '#1d4ed8',
    classicalZeroText: '#ffffff',
    classicalOneText: '#ffffff',
};

function qreg(qId: number): Register {
    return { qId };
}

function baseOp(gate: string, targets: Register[], extra?: Partial<Operation>): Operation {
    return {
        gate,
        isMeasurement: false,
        isConditional: false,
        isControlled: false,
        isAdjoint: false,
        targets,
        ...extra,
    };
}

/** Padding only: quantum-viz needs an op per wire per column; `idle` is for CSS to hide the box. */
function identityOp(qId: number, idx: number): Operation {
    return baseOp('I', [qreg(qId)], {
        dataAttributes: { idx: String(idx), idle: '1' },
    });
}

function isSingleQubitGate(g: Gate): boolean {
    switch (g.type) {
        case GateType.H:
        case GateType.X:
        case GateType.Y:
        case GateType.Z:
        case GateType.S:
        case GateType.SDG:
        case GateType.T:
        case GateType.TDG:
        case GateType.RX:
        case GateType.RY:
        case GateType.RZ:
            return true;
        default:
            return false;
    }
}

function gateToOperation(g: Gate, idx: number): Operation {
    const dataAttributes = { idx: String(idx) };
    switch (g.type) {
        case GateType.H:
        case GateType.X:
        case GateType.Y:
        case GateType.Z:
        case GateType.S:
        case GateType.T:
            return baseOp(g.type, [qreg(g.target)], { dataAttributes });
        case GateType.SDG:
            return baseOp('S', [qreg(g.target)], { isAdjoint: true, dataAttributes });
        case GateType.TDG:
            return baseOp('T', [qreg(g.target)], { isAdjoint: true, dataAttributes });
        case GateType.RX:
        case GateType.RY:
        case GateType.RZ:
            return baseOp(g.type, [qreg(g.target)], {
                displayArgs: g.params?.theta != null ? g.params.theta.toFixed(3) : undefined,
                dataAttributes,
            });
        case GateType.CX:
            return baseOp('X', [qreg(g.target)], {
                isControlled: true,
                controls: [qreg(g.control!)],
                dataAttributes,
            });
        case GateType.CZ:
            return baseOp('Z', [qreg(g.target)], {
                isControlled: true,
                controls: [qreg(g.control!)],
                dataAttributes,
            });
        case GateType.SWAP:
            return baseOp('SWAP', [qreg(g.control!), qreg(g.target)], { dataAttributes });
        case GateType.CCX:
            return baseOp('X', [qreg(g.target)], {
                isControlled: true,
                controls: [qreg(g.control!), qreg(g.control2!)],
                dataAttributes,
            });
        default: {
            const _exhaustive: never = g.type;
            throw new Error(`Unsupported gate for viz: ${_exhaustive}`);
        }
    }
}

/**
 * quantum-viz groups operations per wire; sequential single-qubit gates on different qubits
 * would otherwise collapse into one column. Pad each grid time step with explicit identity ops
 * on idle wires so columns align; those padding ops carry `data-idle` and are hidden in CSS.
 * Column count is the last used time step + 1 (no trailing empty playmat columns).
 */
function toQuantumVizCircuitGridAligned(circuit: Circuit): QvizCircuit {
    const qubits = Array.from({ length: circuit.qubitCount }, (_, id) => ({ id }));
    const n = circuit.qubitCount;
    const gates = circuit.gates;
    const maxUsedCol = Math.max(0, ...gates.map((g) => g.timeColumn ?? 0));
    const numCols = maxUsedCol + 1;
    const operations: Operation[] = [];
    let idx = 0;

    for (let col = 0; col < numCols; col++) {
        const inCol = gates.filter((g) => g.timeColumn === col);
        const cx = inCol.find((g) => g.type === GateType.CX);
        const swap = inCol.find((g) => g.type === GateType.SWAP);
        const singles = inCol.filter(isSingleQubitGate);

        if (cx) {
            operations.push(gateToOperation(cx, idx++));
        }
        if (swap) {
            operations.push(gateToOperation(swap, idx++));
        }

        for (let q = 0; q < n; q++) {
            if (cx && (cx.control === q || cx.target === q)) continue;
            if (swap && (swap.control === q || swap.target === q)) continue;
            const g = singles.find((s) => s.target === q);
            if (g) {
                operations.push(gateToOperation(g, idx++));
            } else {
                operations.push(identityOp(q, idx++));
            }
        }
    }

    return { qubits, operations };
}

/** Legacy mapping: flat gate list (manual editing, no grid time columns). */
function toQuantumVizCircuitFlat(circuit: Circuit): QvizCircuit {
    const qubits = Array.from({ length: circuit.qubitCount }, (_, id) => ({ id }));

    const operations: Operation[] = circuit.gates.map((g, i) => gateToOperation(g, i));

    return { qubits, operations };
}

/**
 * Convert app `Circuit` into quantum-viz.js Circuit schema.
 *
 * When `circuit.gridColumnCount` is set and every gate has `timeColumn`, emit one diagram
 * column per used time step (identity padding on idle wires for layout; hidden in `quantumVizHtml`).
 */
export function toQuantumVizCircuit(circuit: Circuit): QvizCircuit {
    const gates = circuit.gates;
    const useGridLayout =
        circuit.gridColumnCount != null &&
        gates.length > 0 &&
        gates.every((g) => g.timeColumn != null);

    if (useGridLayout) {
        return toQuantumVizCircuitGridAligned(circuit);
    }
    return toQuantumVizCircuitFlat(circuit);
}

/**
 * Create a self-contained HTML string that renders the circuit using quantum-viz.js
 * loaded from CDN. Intended for WebView or web preview.
 */
export function quantumVizHtml(circuit: Circuit): string {
    const qvizCircuit = toQuantumVizCircuit(circuit);
    const json = JSON.stringify(qvizCircuit).replace(/</g, '\\u003c');
    const styleJson = JSON.stringify(QVIZ_READABLE_STYLE);

    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        background: #f1f5f9;
        color: #0f172a;
      }
      #root { padding: 12px; }
      /* Grid padding uses identity ops for layout; hide so idle timesteps look like bare wire (readme style). */
      svg .gate[data-idle="1"] { opacity: 0; pointer-events: none; }
      svg.qviz text {
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-weight: 600;
      }
    </style>
    <script src="https://unpkg.com/@microsoft/quantum-viz.js"></script>
  </head>
  <body>
    <div id="root"></div>
    <script>
      (function () {
        var circuit = ${json};
        var root = document.getElementById('root');
        var overrides = ${styleJson};
        var vizStyle = Object.assign({}, qviz.STYLES.Default, overrides);
        qviz.draw(circuit, root, vizStyle);
      })();
    </script>
  </body>
</html>`;
}
