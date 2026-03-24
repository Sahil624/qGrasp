import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { useCircuitStore } from '../services/useCircuitStore';
import { quantumVizHtml } from '../services/quantumViz';

export default function QuantumCircuitViz() {
    const { circuit } = useCircuitStore();
    const gatesCount = circuit.gates.length;

    if (gatesCount === 0) {
        return (
            <View style={styles.card}>
                <Text style={styles.emptyText}>
                    Circuit diagram will appear here after adding gates.
                </Text>
            </View>
        );
    }

    // Use a stable key so the WebView rerenders when the circuit changes.
    const key = JSON.stringify({
        q: circuit.qubitCount,
        g: circuit.gates,
    });

    return (
        <View style={styles.card}>
            <Text style={styles.title}>Circuit Diagram</Text>
            <WebView
                key={key}
                originWhitelist={['*']}
                source={{ html: quantumVizHtml(circuit) }}
                style={styles.webview}
                javaScriptEnabled
                domStorageEnabled
            />
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#1e1e2e',
        borderRadius: 12,
        padding: 16,
        marginHorizontal: 16,
        overflow: 'hidden',
    },
    title: {
        color: '#cdd6f4',
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 10,
    },
    emptyText: {
        color: '#a6adc8',
        fontSize: 14,
        textAlign: 'center',
        paddingVertical: 12,
    },
    webview: {
        width: '100%',
        height: 340,
        backgroundColor: 'transparent',
    },
});

