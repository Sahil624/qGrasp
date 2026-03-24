import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useCircuitStore } from '../services/useCircuitStore';
import { gateLabel, gateDisplayName } from '../models/gate';

export default function CircuitList() {
    const { circuit, removeGateAt, clearCirc } = useCircuitStore();
    const { gates } = circuit;

    if (gates.length === 0) {
        return (
            <View style={styles.container}>
                <View style={styles.emptyCard}>
                    <Text style={styles.emptyText}>
                        No gates yet. Add gates using the picker above or scan QR codes.
                    </Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.card}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>
                        Circuit ({gates.length} gate{gates.length !== 1 ? 's' : ''})
                    </Text>
                    <TouchableOpacity onPress={clearCirc} style={styles.clearButton}>
                        <Text style={styles.clearText}>✕ Clear</Text>
                    </TouchableOpacity>
                </View>
                {gates.map((gate, i) => (
                    <View key={i} style={styles.gateRow}>
                        <View style={styles.avatar}>
                            <Text style={styles.avatarText}>{gateLabel(gate)}</Text>
                        </View>
                        <Text style={styles.gateName}>{gateDisplayName(gate)}</Text>
                        <TouchableOpacity
                            onPress={() => removeGateAt(i)}
                            style={styles.removeButton}
                        >
                            <Text style={styles.removeText}>−</Text>
                        </TouchableOpacity>
                    </View>
                ))}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 16,
    },
    emptyCard: {
        backgroundColor: '#1e1e2e',
        borderRadius: 12,
        padding: 24,
        alignItems: 'center',
    },
    emptyText: {
        color: '#a6adc8',
        fontSize: 15,
        textAlign: 'center',
    },
    card: {
        backgroundColor: '#1e1e2e',
        borderRadius: 12,
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 14,
    },
    headerTitle: {
        color: '#cdd6f4',
        fontSize: 16,
        fontWeight: '600',
    },
    clearButton: {
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    clearText: {
        color: '#f38ba8',
        fontSize: 13,
    },
    gateRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: '#313244',
    },
    avatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#6c63ff',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    avatarText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 13,
    },
    gateName: {
        flex: 1,
        color: '#cdd6f4',
        fontSize: 15,
    },
    removeButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    removeText: {
        color: '#f38ba8',
        fontSize: 22,
        fontWeight: '700',
    },
});
