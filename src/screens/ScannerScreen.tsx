import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useCircuitStore } from '../services/useCircuitStore';
import { markerIdToGate } from '../core/constants';
import { detectGridTagsFromImageUri } from '../services/gridDetector';

const DEBOUNCE_MS = 1500;

function parseGateFromCode(code: string): string | null {
    const upper = code.trim().toUpperCase();
    if (['H', 'X', 'Y', 'Z'].includes(upper)) return upper;
    if (upper.startsWith('CX')) return 'CX';
    const asInt = parseInt(upper, 10);
    if (!isNaN(asInt) && markerIdToGate[asInt]) return markerIdToGate[asInt];
    return null;
}

export default function ScannerScreen() {
    const [permission, requestPermission] = useCameraPermissions();
    const addGateFromMarker = useCircuitStore((s) => s.addGateFromMarker);
    const replaceCircuitFromGridPayload = useCircuitStore((s) => s.replaceCircuitFromGridPayload);
    const replaceCircuitFromGridScan = useCircuitStore((s) => s.replaceCircuitFromGridScan);
    const [mode, setMode] = useState<'single' | 'grid'>('grid');
    const [isProcessingGrid, setIsProcessingGrid] = useState(false);
    const cameraRef = useRef<CameraView | null>(null);

    const lastScanned = useRef<string | null>(null);
    const lastScanTime = useRef<number>(0);
    const [lastGateAdded, setLastGateAdded] = useState<string | null>(null);

    useEffect(() => {
        if (permission && !permission.granted) {
            requestPermission();
        }
    }, [permission]);

    const handleBarcode = (result: BarcodeScanningResult) => {
        const code = result.data;
        if (!code) return;

        const now = Date.now();
        if (
            lastScanned.current === code &&
            now - lastScanTime.current < DEBOUNCE_MS
        ) {
            return;
        }

        lastScanned.current = code;
        lastScanTime.current = now;

        if (mode === 'grid') {
            if (code.trim().toUpperCase().startsWith('GRID:')) {
                const output = replaceCircuitFromGridPayload(code);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setLastGateAdded(`Grid import (${output.added} gates)`);
                if (output.warnings.length > 0) {
                    Alert.alert('Grid Imported with Warnings', output.warnings.join('\n'));
                }
                setTimeout(() => setLastGateAdded(null), 2500);
            }
            return;
        }

        const gateLabel = parseGateFromCode(code);
        if (gateLabel) {
            addGateFromMarker(gateLabel);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setLastGateAdded(gateLabel);
            setTimeout(() => setLastGateAdded(null), 1500);
        }
    };

    const gridHintText = useMemo(
        () => 'Grid mode scans the full camera frame. Capture snapshot to parse anchors + gate tags.',
        []
    );

    const runGridSnapshot = async () => {
        if (!cameraRef.current) return;
        setIsProcessingGrid(true);
        try {
            const photo = await cameraRef.current.takePictureAsync({
                quality: 0.8,
                skipProcessing: false,
            });
            if (!photo?.uri) {
                throw new Error('Could not capture camera image.');
            }

            const detected = await detectGridTagsFromImageUri(photo.uri);
            const output = replaceCircuitFromGridScan(detected.detections, detected.profile, detected.profile.rows);
            const warnings = [...detected.warnings, ...output.warnings];
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setLastGateAdded(`Snapshot parsed (${output.added} gates)`);
            if (warnings.length > 0) {
                Alert.alert('Grid Snapshot Warnings', warnings.join('\n'));
            }
            setTimeout(() => setLastGateAdded(null), 2500);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Could not process snapshot. Please try again.';
            Alert.alert('Grid scan failed', message);
        } finally {
            setIsProcessingGrid(false);
        }
    };

    if (!permission?.granted) {
        return (
            <View style={styles.center}>
                <Text style={styles.text}>Camera permission is required to scan QR codes.</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <CameraView
                ref={cameraRef}
                style={StyleSheet.absoluteFillObject}
                barcodeScannerSettings={{
                    barcodeTypes: ['qr'],
                }}
                onBarcodeScanned={handleBarcode}
            />
            {mode === 'single' && (
                <View style={styles.overlay}>
                    <View style={styles.scanBox} />
                </View>
            )}
            <View style={styles.controls}>
                <View style={styles.modeRow}>
                    <TouchableOpacity
                        style={[styles.modeButton, mode === 'grid' && styles.modeButtonActive]}
                        onPress={() => setMode('grid')}
                    >
                        <Text style={styles.modeText}>Grid Scan</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.modeButton, mode === 'single' && styles.modeButtonActive]}
                        onPress={() => setMode('single')}
                    >
                        <Text style={styles.modeText}>Single Gate</Text>
                    </TouchableOpacity>
                </View>
                {mode === 'grid' && (
                    <>
                        <Text style={styles.hintText}>{gridHintText}</Text>
                        <TouchableOpacity
                            style={[styles.snapshotButton, isProcessingGrid && styles.snapshotButtonDisabled]}
                            onPress={runGridSnapshot}
                            disabled={isProcessingGrid}
                        >
                            <Text style={styles.snapshotButtonText}>
                                {isProcessingGrid ? 'Processing...' : 'Scan Grid Snapshot'}
                            </Text>
                        </TouchableOpacity>
                    </>
                )}
            </View>
            {/* Toast */}
            {lastGateAdded && (
                <View style={styles.toast}>
                    <Text style={styles.toastText}>
                        {mode === 'single' ? `Added ${lastGateAdded} gate` : lastGateAdded}
                    </Text>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#11111b',
        padding: 24,
    },
    text: {
        color: '#cdd6f4',
        fontSize: 16,
        textAlign: 'center',
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
    },
    controls: {
        position: 'absolute',
        top: 40,
        left: 16,
        right: 16,
        backgroundColor: 'rgba(17,17,27,0.75)',
        borderRadius: 12,
        padding: 12,
        gap: 8,
    },
    modeRow: {
        flexDirection: 'row',
        gap: 8,
    },
    modeButton: {
        flex: 1,
        borderRadius: 8,
        paddingVertical: 8,
        alignItems: 'center',
        backgroundColor: '#313244',
    },
    modeButtonActive: {
        backgroundColor: '#6c63ff',
    },
    modeText: {
        color: '#cdd6f4',
        fontWeight: '600',
    },
    hintText: {
        color: '#bac2de',
        fontSize: 12,
    },
    snapshotButton: {
        backgroundColor: '#89b4fa',
        borderRadius: 8,
        paddingVertical: 10,
        alignItems: 'center',
    },
    snapshotButtonDisabled: {
        opacity: 0.6,
    },
    snapshotButtonText: {
        color: '#11111b',
        fontWeight: '700',
    },
    scanBox: {
        width: 280,
        height: 280,
        borderWidth: 4,
        borderColor: '#6c63ff',
        backgroundColor: 'transparent',
    },
    toast: {
        position: 'absolute',
        bottom: 60,
        alignSelf: 'center',
        backgroundColor: '#1e1e2e',
        borderRadius: 8,
        paddingHorizontal: 20,
        paddingVertical: 10,
    },
    toastText: {
        color: '#a6e3a1',
        fontSize: 14,
        fontWeight: '600',
    },
});
