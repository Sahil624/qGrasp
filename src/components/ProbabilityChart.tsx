import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { useCircuitStore } from '../services/useCircuitStore';

export default function ProbabilityChart() {
    const probabilities = useCircuitStore((s) => s.probabilities);

    const entries = Object.entries(probabilities).sort(([a], [b]) =>
        a.localeCompare(b)
    );

    if (entries.length === 0) {
        return (
            <View style={styles.card}>
                <Text style={styles.emptyText}>
                    Probabilities will appear here after adding gates.
                </Text>
            </View>
        );
    }

    const barData = entries.map(([label, value]) => ({
        value,
        label: `|${label}⟩`,
        frontColor: '#6c63ff',
        topLabelComponent: () => (
            <Text style={styles.barLabel}>
                {(value * 100).toFixed(0)}%
            </Text>
        ),
    }));

    return (
        <View style={styles.card}>
            <Text style={styles.title}>State Probabilities</Text>
            <View style={styles.chartWrapper}>
                <BarChart
                    data={barData}
                    barWidth={22}
                    spacing={entries.length > 4 ? 12 : 20}
                    roundedTop
                    roundedBottom={false}
                    hideRules={false}
                    rulesColor="#313244"
                    xAxisColor="#45475a"
                    yAxisColor="#45475a"
                    yAxisTextStyle={{ color: '#a6adc8', fontSize: 10 }}
                    xAxisLabelTextStyle={{ color: '#a6adc8', fontSize: 9 }}
                    noOfSections={4}
                    maxValue={1}
                    height={160}
                    backgroundColor="transparent"
                    isAnimated
                />
            </View>
            <View style={styles.chipsRow}>
                {entries.map(([label, value]) => {
                    const pct = (value * 100).toFixed(1);
                    return (
                        <View key={label} style={styles.chip}>
                            <Text style={styles.chipText}>
                                |{label}⟩: {pct}%
                            </Text>
                        </View>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#1e1e2e',
        borderRadius: 12,
        padding: 16,
        marginHorizontal: 16,
    },
    title: {
        color: '#cdd6f4',
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 12,
    },
    emptyText: {
        color: '#a6adc8',
        fontSize: 14,
        textAlign: 'center',
        paddingVertical: 12,
    },
    chartWrapper: {
        alignItems: 'center',
        paddingLeft: 8,
    },
    barLabel: {
        color: '#a6adc8',
        fontSize: 9,
        marginBottom: 4,
    },
    chipsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 12,
    },
    chip: {
        backgroundColor: '#313244',
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    chipText: {
        color: '#cdd6f4',
        fontSize: 12,
    },
});
