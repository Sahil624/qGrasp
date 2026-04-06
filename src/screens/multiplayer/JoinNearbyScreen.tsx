import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert } from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { useMultiplayerSessionStore } from '../../services/multiplayer/multiplayerSessionStore';
import { isNearbyAvailable, nearbyUnavailableMessage } from '../../services/multiplayer/nearbyTransport';
import { parseJoinQrPayload } from './qrPayload';

type Nav = NativeStackNavigationProp<RootStackParamList, 'JoinNearby'>;

export default function JoinNearbyScreen() {
    const navigation = useNavigation<Nav>();
    const [name, setName] = useState('Student');
    const [scan, setScan] = useState(false);
    const [permission, requestPermission] = useCameraPermissions();

    const discovered = useMultiplayerSessionStore((s) => s.discovered);
    const roomState = useMultiplayerSessionStore((s) => s.roomState);
    const hostEndpointId = useMultiplayerSessionStore((s) => s.hostEndpointId);
    const connectionStatus = useMultiplayerSessionStore((s) => s.connectionStatus);

    const peerEnsureName = useMultiplayerSessionStore((s) => s.peerEnsureName);
    const peerStartDiscovery = useMultiplayerSessionStore((s) => s.peerStartDiscovery);
    const peerConnect = useMultiplayerSessionStore((s) => s.peerConnect);
    const peerDisconnect = useMultiplayerSessionStore((s) => s.peerDisconnect);

    const didNav = useRef(false);
    useEffect(() => {
        if (didNav.current) return;
        if (!roomState.scenario || roomState.paused || roomState.phase !== 'active') {
            return;
        }
        didNav.current = true;
        navigation.replace('MultiplayerScenario');
    }, [roomState.scenario, roomState.paused, roomState.phase, navigation]);

    const startLooking = async () => {
        if (!isNearbyAvailable()) {
            Alert.alert('Multiplayer unavailable here', nearbyUnavailableMessage());
            return;
        }
        try {
            await peerEnsureName(name.trim() || 'Student');
            await peerStartDiscovery();
        } catch (e: unknown) {
            Alert.alert('Discovery failed', String(e));
        }
    };

    const connectTo = async (endpointId: string) => {
        const local = name.trim() || 'Student';
        try {
            await peerEnsureName(local);
            await peerConnect(local, endpointId);
        } catch (e: unknown) {
            Alert.alert('Connect failed', String(e));
        }
    };

    const onBarcode = (res: BarcodeScanningResult) => {
        const parsed = parseJoinQrPayload(res.data ?? '');
        if (parsed) {
            setName(parsed.hostName);
            Alert.alert('QR loaded', `Looking for host name: ${parsed.hostName}`);
        }
    };

    useEffect(() => {
        if (scan && permission && !permission.granted) {
            requestPermission();
        }
    }, [scan, permission]);

    return (
        <View style={styles.wrap}>
            <Text style={styles.title}>Join nearby</Text>
            <Text style={styles.sub}>
                Enter your name, then find your teacher in the list. Optional: scan the teacher’s QR
                to pre-fill their display name.
            </Text>

            <Text style={styles.label}>Your name</Text>
            <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Your first name"
                placeholderTextColor="#6c7086"
            />

            <TouchableOpacity style={styles.primary} onPress={startLooking}>
                <Text style={styles.primaryText}>Start looking</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondary} onPress={() => setScan((s) => !s)}>
                <Text style={styles.secondaryText}>{scan ? 'Hide QR scanner' : 'Scan teacher QR'}</Text>
            </TouchableOpacity>

            {scan && permission?.granted ? (
                <View style={styles.cam}>
                    <CameraView
                        style={StyleSheet.absoluteFill}
                        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                        onBarcodeScanned={onBarcode}
                    />
                </View>
            ) : null}

            <Text style={styles.label}>Nearby sessions</Text>
            <View style={{ gap: 8 }}>
                {discovered.length === 0 ? (
                    <Text style={styles.empty}>No sessions yet — ask the teacher to host.</Text>
                ) : (
                    discovered.map((item) => (
                        <TouchableOpacity
                            key={item.endpointId}
                            style={styles.item}
                            onPress={() => connectTo(item.endpointId)}
                        >
                            <Text style={styles.itemTitle}>{item.endpointName}</Text>
                            <Text style={styles.itemSub}>{item.endpointId.slice(0, 12)}…</Text>
                        </TouchableOpacity>
                    ))
                )}
            </View>

            <Text style={styles.status}>
                Status: {connectionStatus}
                {hostEndpointId ? ' · linked' : ''}
            </Text>

            {roomState.roomHint ? (
                <View style={styles.hintBox}>
                    <Text style={styles.hintLabel}>Teacher hint</Text>
                    <Text style={styles.hint}>{roomState.roomHint}</Text>
                </View>
            ) : null}

            {hostEndpointId && roomState.paused ? (
                <Text style={styles.wait}>Waiting for teacher to start…</Text>
            ) : null}

            <TouchableOpacity onPress={() => peerDisconnect().then(() => navigation.goBack())}>
                <Text style={styles.danger}>Leave</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { flex: 1, backgroundColor: '#11111b', padding: 20, gap: 8 },
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
    },
    primaryText: { color: '#fff', fontWeight: '700' },
    secondary: {
        borderWidth: 1,
        borderColor: '#313244',
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
    },
    secondaryText: { color: '#cdd6f4', fontWeight: '600' },
    cam: { height: 200, borderRadius: 12, overflow: 'hidden', marginVertical: 8 },
    item: {
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#313244',
        marginBottom: 8,
        backgroundColor: '#181825',
    },
    itemTitle: { color: '#cdd6f4', fontWeight: '700' },
    itemSub: { color: '#6c7086', fontSize: 12, marginTop: 4 },
    empty: { color: '#6c7086', fontStyle: 'italic' },
    status: { color: '#a6e3a1' },
    hintBox: {
        padding: 12,
        borderRadius: 12,
        backgroundColor: '#1e1e2e',
        borderWidth: 1,
        borderColor: '#313244',
    },
    hintLabel: { color: '#6c7086', fontSize: 12 },
    hint: { color: '#cdd6f4', marginTop: 4 },
    wait: { color: '#f9e2af', fontWeight: '600' },
    danger: { color: '#f38ba8', textAlign: 'center', marginTop: 12 },
});
