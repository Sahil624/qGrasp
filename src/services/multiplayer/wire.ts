import type { ClientToHostMessage, HostToClientMessage } from './types';

function utf8ToBase64(s: string): string {
    return btoa(unescape(encodeURIComponent(s)));
}

function base64ToUtf8(b64: string): string {
    return decodeURIComponent(escape(atob(b64)));
}

export function encodePayload(msg: ClientToHostMessage | HostToClientMessage): string {
    return utf8ToBase64(JSON.stringify(msg));
}

export function decodePayload(b64: string): ClientToHostMessage | HostToClientMessage | null {
    try {
        const s = base64ToUtf8(b64);
        return JSON.parse(s) as ClientToHostMessage | HostToClientMessage;
    } catch {
        return null;
    }
}
