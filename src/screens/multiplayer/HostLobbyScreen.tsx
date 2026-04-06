import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { useMultiplayerSessionStore } from '../../services/multiplayer/multiplayerSessionStore';
import { isNearbyAvailable, nearbyUnavailableMessage } from '../../services/multiplayer/nearbyTransport';
import type { ScenarioId } from '../../services/multiplayer/types';
import { buildJoinQrPayload } from './qrPayload';

type Nav = NativeStackNavigationProp<RootStackParamList, 'HostLobby'>;

export default function HostLobbyScreen() {
    const navigation = useNavigation<Nav>();
    const [name, setName] = useState('Teacher');
    const [hint, setHint] = useState('');

    const roomState = useMultiplayerSessionStore((s) => s.roomState);
    const peerEndpoints = useMultiplayerSessionStore((s) => s.peerEndpoints);
    const members = useMultiplayerSessionStore((s) => s.roomState.members);
    const displayName = useMultiplayerSessionStore((s) => s.displayName);

    const hostStartAdvertising = useMultiplayerSessionStore((s) => s.hostStartAdvertising);
    const hostDisconnectAll = useMultiplayerSessionStore((s) => s.hostDisconnectAll);
    const hostSetScenario = useMultiplayerSessionStore((s) => s.hostSetScenario);
    const hostSetHint = useMultiplayerSessionStore((s) => s.hostSetHint);
    const hostStartExercise = useMultiplayerSessionStore((s) => s.hostStartExercise);
    const hostPause = useMultiplayerSessionStore((s) => s.hostPause);
    const hostResetScenario = useMultiplayerSessionStore((s) => s.hostResetScenario);

    const goLive = async () => {
        if (!isNearbyAvailable()) {
            Alert.alert('Multiplayer unavailable here', nearbyUnavailableMessage());
            return;
        }
        try {
            await hostStartAdvertising(name.trim() || 'Teacher');
        } catch (e: unknown) {
            Alert.alert('Could not advertise', String(e));
        }
    };

    const pickScenario = (s: ScenarioId) => {
        hostSetScenario(s);
    };

    const applyHint = () => {
        hostSetHint(hint.trim());
    };

    const startExercise = () => {
        if (!roomState.scenario) {
            Alert.alert('Pick a scenario', 'Choose A, B, or C first.');
            return;
        }
        const need = roomState.scenario === 'C' ? 3 : 2;
        if (members.length < need) {
            Alert.alert(
                'Waiting for students',
                `Need at least ${need} connected students (have ${members.length}).`
            );
            return;
        }
        hostStartExercise();
        navigation.navigate('MultiplayerScenario');
    };

    const endSession = async () => {
        await hostDisconnectAll();
        navigation.popToTop();
    };

    return (
        <ScrollView contentContainerStyle={styles.wrap}>
            <Text style={styles.title}>Host session</Text>
            <Text style={styles.sub}>
                Students open Join nearby. Project the QR so late joiners can match your display name.
            </Text>

            <Text style={styles.label}>Your display name</Text>
            <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="e.g. KSU — Period 3"
                placeholderTextColor="#6c7086"
            />
            <TouchableOpacity style={styles.primary} onPress={goLive}>
                <Text style={styles.primaryText}>Start advertising</Text>
            </TouchableOpacity>

            {displayName ? (
                <View style={styles.qrBox}>
                    <QRCode value={buildJoinQrPayload(displayName)} size={160} color="#cdd6f4" backgroundColor="#181825" />
                    <Text style={styles.qrHint}>Join code: {displayName}</Text>
                </View>
            ) : null}

            <Text style={styles.status}>
                Connected students: {members.length} · Endpoints: {peerEndpoints.length}
            </Text>

            <Text style={styles.label}>Scenario</Text>
            <View style={styles.row}>
                {(['A', 'B', 'C'] as ScenarioId[]).map((id) => (
                    <TouchableOpacity
                        key={id}
                        style={[
                            styles.chip,
                            roomState.scenario === id && styles.chipOn,
                        ]}
                        onPress={() => pickScenario(id)}
                    >
                        <Text
                            style={[
                                styles.chipText,
                                roomState.scenario === id && styles.chipTextOn,
                            ]}
                        >
                            {id === 'A' ? 'Spooky (Bell)' : id === 'B' ? 'Teleport' : 'BB84'}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            <Text style={styles.label}>Optional hint for class</Text>
            <TextInput
                style={styles.input}
                value={hint}
                onChangeText={setHint}
                onEndEditing={applyHint}
                placeholder="Short hint shown on student devices"
                placeholderTextColor="#6c7086"
            />
            <TouchableOpacity style={styles.secondary} onPress={applyHint}>
                <Text style={styles.secondaryText}>Update hint</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.primary} onPress={startExercise}>
                <Text style={styles.primaryText}>Start exercise</Text>
            </TouchableOpacity>
            <View style={styles.row}>
                <TouchableOpacity style={styles.secondary} onPress={hostPause}>
                    <Text style={styles.secondaryText}>Pause</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondary} onPress={hostResetScenario}>
                    <Text style={styles.secondaryText}>Reset scenario</Text>
                </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={endSession}>
                <Text style={styles.danger}>End session & disconnect all</Text>
            </TouchableOpacity>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    wrap: {
        padding: 20,
        backgroundColor: '#11111b',
        gap: 10,
        paddingBottom: 48,
    },
    title: { fontSize: 22, fontWeight: '800', color: '#cdd6f4' },
    sub: { color: '#a6adc8', fontSize: 14, lineHeight: 20 },
    label: { color: '#bac2de', fontWeight: '600', marginTop: 8 },
    input: {
        borderWidth: 1,
        borderColor: '#313244',
        borderRadius: 10,
        padding: 12,
        color: '#cdd6f4',
        backgroundColor: '#181825',
    },
    primary: {
        backgroundColor: '#6c63ff',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 4,
    },
    primaryText: { color: '#fff', fontWeight: '700' },
    secondary: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#313244',
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
    },
    secondaryText: { color: '#cdd6f4', fontWeight: '600' },
    row: { flexDirection: 'row', gap: 10 },
    chip: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#313244',
        alignItems: 'center',
    },
    chipOn: { borderColor: '#6c63ff', backgroundColor: '#1e1e2e' },
    chipText: { color: '#a6adc8', fontWeight: '600' },
    chipTextOn: { color: '#cdd6f4' },
    status: { color: '#a6e3a1', marginTop: 4 },
    qrBox: { alignItems: 'center', gap: 8, marginVertical: 8 },
    qrHint: { color: '#6c7086', fontSize: 12 },
    danger: { color: '#f38ba8', textAlign: 'center', marginTop: 12 },
});
