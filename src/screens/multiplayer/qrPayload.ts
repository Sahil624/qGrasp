const PREFIX = 'QGRASP_MP:';

export function buildJoinQrPayload(hostDisplayName: string): string {
    return `${PREFIX}${JSON.stringify({ h: hostDisplayName })}`;
}

export function parseJoinQrPayload(raw: string): { hostName: string } | null {
    const t = raw.trim();
    if (!t.startsWith(PREFIX)) return null;
    try {
        const j = JSON.parse(t.slice(PREFIX.length)) as { h?: string };
        if (j.h && typeof j.h === 'string') return { hostName: j.h };
    } catch {
        return null;
    }
    return null;
}
