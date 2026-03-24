import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMeasurement } from '../services/useMeasurement';
import { useCircuitStore } from '../services/useCircuitStore';

export default function MeasurementScreen() {
    const axis = useMeasurement();
    const { probabilities, getQubitProbs } = useCircuitStore();
    const [result, setResult] = useState<{
        value: number;
        prob: number;
    } | null>(null);

    const handleMeasure = () => {
        const qubitProbs = getQubitProbs(0);
        if (!qubitProbs) return;

        const { p0, p1 } = qubitProbs;
        const r = Math.random();
        const measured = r < p0 ? 0 : 1;
        const prob = measured === 0 ? p0 : p1;

        setResult({ value: measured, prob });
    };

    const hasProbs = Object.keys(probabilities).length > 0;

    return (
        <SafeAreaView style={styles.screen}>
            <View style={styles.content}>
                {/* Measurement axis card */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Measurement Axis</Text>
                    <Text style={styles.cardSubtitle}>
                        Tilt your phone to change the measurement basis.{'\n'}
                        The axis (x, y, z) represents where you are "viewing" the qubit from.
                    </Text>
                    <View style={styles.axisRow}>
                        <AxisLabel label="X" value={axis.x} />
                        <AxisLabel label="Y" value={axis.y} />
                        <AxisLabel label="Z" value={axis.z} />
                    </View>
                </View>

                {/* Measure button */}
                <TouchableOpacity
                    style={[styles.measureButton, !hasProbs && styles.measureButtonDisabled]}
                    onPress={handleMeasure}
                    disabled={!hasProbs}
                    activeOpacity={0.7}
                >
                    <Text style={styles.measureButtonText}>🎯  Measure</Text>
                </TouchableOpacity>

                {/* Result */}
                {result && (
                    <View style={styles.resultCard}>
                        <Text style={styles.resultTitle}>Result: |{result.value}⟩</Text>
                        <Text style={styles.resultProb}>
                            Probability: {(result.prob * 100).toFixed(1)}%
                        </Text>
                    </View>
                )}

                {!hasProbs && (
                    <Text style={styles.hint}>
                        Add gates to your circuit first, then measure.
                    </Text>
                )}
            </View>
        </SafeAreaView>
    );
}

function AxisLabel({ label, value }: { label: string; value: number }) {
    return (
        <View style={styles.axisItem}>
            <Text style={styles.axisLabel}>{label}</Text>
            <Text style={styles.axisValue}>{value.toFixed(2)}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: '#11111b',
    },
    content: {
        padding: 24,
        gap: 20,
    },
    card: {
        backgroundColor: '#1e1e2e',
        borderRadius: 12,
        padding: 20,
        alignItems: 'center',
    },
    cardTitle: {
        color: '#cdd6f4',
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 8,
    },
    cardSubtitle: {
        color: '#a6adc8',
        fontSize: 13,
        textAlign: 'center',
        lineHeight: 18,
        marginBottom: 16,
    },
    axisRow: {
        flexDirection: 'row',
        justifyContent: 'space-evenly',
        width: '100%',
    },
    axisItem: {
        alignItems: 'center',
    },
    axisLabel: {
        color: '#a6adc8',
        fontSize: 14,
        fontWeight: '600',
    },
    axisValue: {
        color: '#cdd6f4',
        fontSize: 22,
        fontWeight: '700',
        marginTop: 4,
    },
    measureButton: {
        backgroundColor: '#6c63ff',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
    },
    measureButtonDisabled: {
        backgroundColor: '#313244',
    },
    measureButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    resultCard: {
        backgroundColor: '#3b3776',
        borderRadius: 12,
        padding: 20,
        alignItems: 'center',
    },
    resultTitle: {
        color: '#fff',
        fontSize: 24,
        fontWeight: '700',
    },
    resultProb: {
        color: '#cdd6f4',
        fontSize: 16,
        marginTop: 4,
    },
    hint: {
        color: '#a6adc8',
        fontSize: 14,
        textAlign: 'center',
    },
});
