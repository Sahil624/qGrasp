import React from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
} from 'react-native';
import { useCircuitStore } from '../services/useCircuitStore';
import { GateType } from '../models/gate';
import { ENABLED_GATE_CONFIGS } from '../constants/quantumGates';

const GATE_BUTTONS: { label: string; type: GateType }[] = ENABLED_GATE_CONFIGS.map(
    (g) => ({ label: g.label, type: g.type })
);

export default function GatePicker() {
    const {
        addGate,
        selectedQubitForGate,
        setSelectedQubitForGate,
        circuit,
    } = useCircuitStore();

    const handleGatePress = (type: GateType) => {
        if (type === GateType.CX || type === GateType.CZ) {
            addGate({
                type,
                target: (selectedQubitForGate + 1) % circuit.qubitCount,
                control: selectedQubitForGate,
            });
        } else if (type === GateType.SWAP) {
            addGate({
                type,
                target: (selectedQubitForGate + 1) % circuit.qubitCount,
                control: selectedQubitForGate,
            });
        } else if (type === GateType.CCX) {
            addGate({
                type,
                target: (selectedQubitForGate + 2) % circuit.qubitCount,
                control: selectedQubitForGate,
                control2: (selectedQubitForGate + 1) % circuit.qubitCount,
            });
        } else if (
            type === GateType.RX ||
            type === GateType.RY ||
            type === GateType.RZ
        ) {
            addGate({ type, target: selectedQubitForGate, params: { theta: Math.PI / 2 } });
        } else {
            addGate({ type, target: selectedQubitForGate });
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Add Gate</Text>
            <View style={styles.buttonsRow}>
                {GATE_BUTTONS.map((g) => (
                    <TouchableOpacity
                        key={g.label}
                        style={styles.gateButton}
                        onPress={() => handleGatePress(g.type)}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.gateButtonText}>{g.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>
            <View style={styles.qubitRow}>
                <Text style={styles.qubitLabel}>Qubit: </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {Array.from({ length: circuit.qubitCount }, (_, i) => (
                        <TouchableOpacity
                            key={i}
                            style={[
                                styles.qubitChip,
                                selectedQubitForGate === i && styles.qubitChipSelected,
                            ]}
                            onPress={() => setSelectedQubitForGate(i)}
                        >
                            <Text
                                style={[
                                    styles.qubitChipText,
                                    selectedQubitForGate === i && styles.qubitChipTextSelected,
                                ]}
                            >
                                {i}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#1e1e2e',
        borderRadius: 12,
        padding: 14,
        margin: 16,
        marginBottom: 0,
    },
    title: {
        color: '#cdd6f4',
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 10,
    },
    buttonsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    gateButton: {
        backgroundColor: '#6c63ff',
        borderRadius: 8,
        paddingHorizontal: 18,
        paddingVertical: 10,
    },
    gateButtonText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 15,
    },
    qubitRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 10,
    },
    qubitLabel: {
        color: '#a6adc8',
        fontSize: 13,
    },
    qubitChip: {
        backgroundColor: '#313244',
        borderRadius: 16,
        paddingHorizontal: 14,
        paddingVertical: 6,
        marginRight: 6,
    },
    qubitChipSelected: {
        backgroundColor: '#6c63ff',
    },
    qubitChipText: {
        color: '#cdd6f4',
        fontSize: 13,
    },
    qubitChipTextSelected: {
        color: '#fff',
        fontWeight: '700',
    },
});
