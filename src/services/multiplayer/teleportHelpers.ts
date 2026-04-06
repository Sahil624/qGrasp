/** Standard teleport correction (bits b0,b1 from Alice's measurement) for teaching UI. */
export function expectedTeleportCorrection(bits: [number, number]): string {
    const k = `${bits[0]}${bits[1]}`;
    if (k === '00') return 'I';
    if (k === '01') return 'X';
    if (k === '10') return 'Z';
    return 'Y';
}
