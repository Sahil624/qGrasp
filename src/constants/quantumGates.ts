import { GateType } from '../models/gate';

export type GateArity = 1 | 2 | 3;

export type GateParamKey = 'theta' | 'phi' | 'lambda';

export type GateConfig = {
    type: GateType;
    label: string;
    arity: GateArity;
    params?: readonly GateParamKey[];
};

/**
 * Gates that the app *knows about* and can (in principle) execute.
 */
export const SUPPORTED_GATES: readonly GateConfig[] = [
    { type: GateType.H, label: 'H', arity: 1 },
    { type: GateType.X, label: 'X', arity: 1 },
    { type: GateType.Y, label: 'Y', arity: 1 },
    { type: GateType.Z, label: 'Z', arity: 1 },

    { type: GateType.S, label: 'S', arity: 1 },
    { type: GateType.SDG, label: 'S†', arity: 1 },
    { type: GateType.T, label: 'T', arity: 1 },
    { type: GateType.TDG, label: 'T†', arity: 1 },

    { type: GateType.RX, label: 'Rx', arity: 1, params: ['theta'] },
    { type: GateType.RY, label: 'Ry', arity: 1, params: ['theta'] },
    { type: GateType.RZ, label: 'Rz', arity: 1, params: ['theta'] },

    { type: GateType.CX, label: 'CX', arity: 2 },
    { type: GateType.CZ, label: 'CZ', arity: 2 },
    { type: GateType.SWAP, label: 'SWAP', arity: 2 },

    { type: GateType.CCX, label: 'CCX', arity: 3 },
] as const;

/**
 * Gates currently enabled in the UI/editor.
 * Flip to `false` to hide/disable a gate across the app.
 */
export const ENABLED_GATES: Readonly<Record<GateType, boolean>> = {
    [GateType.H]: true,
    [GateType.X]: true,
    [GateType.Y]: true,
    [GateType.Z]: true,

    [GateType.S]: true,
    [GateType.SDG]: true,
    [GateType.T]: true,
    [GateType.TDG]: true,

    [GateType.RX]: true,
    [GateType.RY]: true,
    [GateType.RZ]: true,

    [GateType.CX]: true,
    [GateType.CZ]: true,
    [GateType.SWAP]: true,

    [GateType.CCX]: true,
};

export function isGateEnabled(type: GateType): boolean {
    return Boolean(ENABLED_GATES[type]);
}

export const ENABLED_GATE_CONFIGS: readonly GateConfig[] = SUPPORTED_GATES.filter(
    (g) => isGateEnabled(g.type)
);

