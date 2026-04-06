import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { useMultiplayerSessionStore } from '../../services/multiplayer/multiplayerSessionStore';
import { useCircuitStore } from '../../services/useCircuitStore';
import { expectedTeleportCorrection } from '../../services/multiplayer/teleportHelpers';

export default function MultiplayerScenarioScreen() {
    const navigation = useNavigation();
    const myMemberId = useMultiplayerSessionStore((s) => s.myMemberId);
    const isHost = useMultiplayerSessionStore((s) => s.isHost);
    const roomState = useMultiplayerSessionStore((s) => s.roomState);
    const peerSend = useMultiplayerSessionStore((s) => s.peerSend);
    const hostPause = useMultiplayerSessionStore((s) => s.hostPause);
    const hostResetScenario = useMultiplayerSessionStore((s) => s.hostResetScenario);

    const getQubitProbs = useCircuitStore((s) => s.getQubitProbs);

    const member = roomState.members.find((m) => m.id === myMemberId);
    const role = member?.role;

    const [b0, setB0] = useState(0);
    const [b1, setB1] = useState(0);
    const [bobFlash, setBobFlash] = useState(false);
    const prevBob = useRef<number | null>(null);

    useEffect(() => {
        if (role !== 'bob') return;
        if (roomState.bobBit == null) return;
        if (prevBob.current === roomState.bobBit) return;
        prevBob.current = roomState.bobBit;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setBobFlash(true);
        const t = setTimeout(() => setBobFlash(false), 350);
        return () => clearTimeout(t);
    }, [role, roomState.bobBit]);

    const scenario = roomState.scenario;

    const measureAlice = async () => {
        const p = getQubitProbs(0);
        const p0 = p?.p0 ?? 0.5;
        const bit = Math.random() < p0 ? 0 : 1;
        await peerSend({ type: 'scenario_a_measure', memberId: myMemberId, bit });
    };

    const submitBits = async () => {
        await peerSend({
            type: 'scenario_b_submit_bits',
            memberId: myMemberId,
            b0,
            b1,
        });
    };

    const submitBob = async (correctionId: string) => {
        await peerSend({
            type: 'scenario_b_bob_done',
            memberId: myMemberId,
            correctionId,
        });
    };

    const eveIntercept = async () => {
        await peerSend({ type: 'scenario_c_eve_intercept', memberId: myMemberId, bit: 0 });
    };

    const bits = roomState.classicalBits;
    const expected =
        bits != null ? expectedTeleportCorrection(bits) : 'I';

    return (
        <ScrollView contentContainerStyle={styles.wrap}>
            {bobFlash ? <View pointerEvents="none" style={styles.flash} /> : null}

            <Text style={styles.title}>Scenario {scenario}</Text>
            {roomState.roomHint ? (
                <View style={styles.hintBox}>
                    <Text style={styles.hint}>{roomState.roomHint}</Text>
                </View>
            ) : null}

            {isHost ? (
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Teacher view</Text>
                    <Text style={styles.mono}>
                        {JSON.stringify(
                            {
                                members: roomState.members.map((m) => ({
                                    name: m.displayName,
                                    role: m.role,
                                })),
                                aliceBit: roomState.aliceBit,
                                bobBit: roomState.bobBit,
                                classicalBits: roomState.classicalBits,
                                teleportVerified: roomState.teleportVerified,
                                sift: roomState.siftErrorRate,
                                unsafe: roomState.unsafeConnection,
                            },
                            null,
                            2
                        )}
                    </Text>
                    <View style={styles.row}>
                        <TouchableOpacity style={styles.secondary} onPress={hostPause}>
                            <Text style={styles.secondaryText}>Pause</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.secondary} onPress={hostResetScenario}>
                            <Text style={styles.secondaryText}>Reset</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            ) : null}

            {scenario === 'A' && !isHost ? (
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>
                        {role === 'alice' ? 'You are Alice' : role === 'bob' ? 'You are Bob' : 'Role pending'}
                    </Text>
                    {roomState.bellPrepared ? (
                        <Text style={styles.ok}>Bell pair ready (lesson)</Text>
                    ) : (
                        <Text style={styles.muted}>Waiting for teacher to start…</Text>
                    )}
                    {role === 'alice' && roomState.bellPrepared ? (
                        <TouchableOpacity style={styles.primary} onPress={measureAlice}>
                            <Text style={styles.primaryText}>Measure my qubit</Text>
                        </TouchableOpacity>
                    ) : null}
                    {role === 'bob' ? (
                        <View style={{ gap: 8 }}>
                            <Text style={styles.body}>
                                Your outcome (from entanglement):{' '}
                                <Text style={styles.big}>
                                    {roomState.bobBit == null ? '—' : String(roomState.bobBit)}
                                </Text>
                            </Text>
                            <Text style={styles.muted}>
                                When Alice measures, your phone should agree — spooky action!
                            </Text>
                        </View>
                    ) : null}
                </View>
            ) : null}

            {scenario === 'B' && !isHost ? (
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Teleportation challenge</Text>
                    <Text style={styles.body}>
                        Shared entanglement is assumed. Alice: run the teleport circuit, read your two
                        classical bits, send them. Bob: use the cheat sheet, pick the matching gate.
                    </Text>
                    {role === 'alice' ? (
                        <View style={{ gap: 10 }}>
                            <Text style={styles.muted}>Classical bits (tap)</Text>
                            <View style={styles.row}>
                                <TouchableOpacity
                                    style={styles.secondary}
                                    onPress={() => setB0((v) => (v === 0 ? 1 : 0))}
                                >
                                    <Text style={styles.secondaryText}>Bit 0: {b0}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.secondary}
                                    onPress={() => setB1((v) => (v === 0 ? 1 : 0))}
                                >
                                    <Text style={styles.secondaryText}>Bit 1: {b1}</Text>
                                </TouchableOpacity>
                            </View>
                            <TouchableOpacity style={styles.primary} onPress={submitBits}>
                                <Text style={styles.primaryText}>Send classical bits</Text>
                            </TouchableOpacity>
                        </View>
                    ) : null}
                    {role === 'bob' ? (
                        <View style={{ gap: 8 }}>
                            <Text style={styles.body}>
                                Cheat sheet: 00→I, 01→X, 10→Z, 11→Y (teaching labels).
                            </Text>
                            <Text style={styles.body}>
                                Your bits from Alice:{' '}
                                {bits ? `${bits[0]}${bits[1]}` : '—'} · Expected gate: {expected}
                            </Text>
                            <View style={styles.row}>
                                {(['I', 'X', 'Z', 'Y'] as const).map((g) => (
                                    <TouchableOpacity
                                        key={g}
                                        style={styles.secondary}
                                        onPress={() => submitBob(g)}
                                    >
                                        <Text style={styles.secondaryText}>{g}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                            {roomState.teleportVerified != null ? (
                                <Text style={roomState.teleportVerified ? styles.ok : styles.bad}>
                                    {roomState.teleportVerified ? 'State reconstructed!' : 'Try again'}
                                </Text>
                            ) : null}
                        </View>
                    ) : null}
                </View>
            ) : null}

            {scenario === 'C' && !isHost ? (
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>BB84 spy game</Text>
                    <Text style={styles.body}>
                        Alice sends, Bob receives. Eve can intercept during the window. High error after
                        sifting means “eavesdropper detected.”
                    </Text>
                    {role === 'eve' ? (
                        <View style={{ gap: 8 }}>
                            <Text style={styles.body}>
                                Window:{' '}
                                {roomState.eveWindowActive
                                    ? 'Active — tap intercept'
                                    : 'Closed'}
                            </Text>
                            <TouchableOpacity
                                style={[
                                    styles.primary,
                                    !roomState.eveWindowActive && { opacity: 0.4 },
                                ]}
                                disabled={!roomState.eveWindowActive}
                                onPress={eveIntercept}
                            >
                                <Text style={styles.primaryText}>Intercept (measure)</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <Text style={styles.muted}>Watch the teacher screen for sift results.</Text>
                    )}
                    {roomState.siftErrorRate != null ? (
                        <Text style={styles.body}>
                            Sift error estimate: {(roomState.siftErrorRate * 100).toFixed(0)}%
                        </Text>
                    ) : null}
                    {roomState.unsafeConnection ? (
                        <Text style={styles.bad}>Connection unsafe — eavesdropper detected!</Text>
                    ) : (
                        <Text style={styles.ok}>No strong eavesdropper signature (demo).</Text>
                    )}
                </View>
            ) : null}

            <TouchableOpacity onPress={() => navigation.goBack()}>
                <Text style={styles.link}>Back to lobby</Text>
            </TouchableOpacity>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    wrap: { padding: 16, paddingBottom: 40, backgroundColor: '#11111b', gap: 12 },
    flash: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        height: 120,
        backgroundColor: '#f5c2e7',
        opacity: 0.7,
        zIndex: 10,
        borderRadius: 12,
    },
    title: { fontSize: 22, fontWeight: '800', color: '#cdd6f4' },
    hintBox: {
        padding: 12,
        borderRadius: 12,
        backgroundColor: '#1e1e2e',
        borderWidth: 1,
        borderColor: '#313244',
    },
    hint: { color: '#cdd6f4' },
    card: {
        padding: 14,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#313244',
        backgroundColor: '#181825',
        gap: 8,
    },
    cardTitle: { color: '#bac2de', fontWeight: '700' },
    body: { color: '#a6adc8', lineHeight: 20 },
    muted: { color: '#6c7086' },
    mono: { color: '#cdd6f4', fontFamily: 'monospace', fontSize: 11 },
    ok: { color: '#a6e3a1', fontWeight: '600' },
    bad: { color: '#f38ba8', fontWeight: '600' },
    big: { fontSize: 22, fontWeight: '800', color: '#f5c2e7' },
    row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    primary: {
        backgroundColor: '#6c63ff',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    primaryText: { color: '#fff', fontWeight: '700' },
    secondary: {
        borderWidth: 1,
        borderColor: '#313244',
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderRadius: 12,
        alignItems: 'center',
    },
    secondaryText: { color: '#cdd6f4', fontWeight: '600' },
    link: { color: '#89b4fa', textAlign: 'center', marginTop: 12 },
});
