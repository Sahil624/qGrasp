import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';

interface Props {
    icon: string;
    onPress: () => void;
}

export default function HeaderButton({ icon, onPress }: Props) {
    return (
        <TouchableOpacity onPress={onPress} style={styles.button}>
            <Text style={styles.icon}>{icon}</Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    button: {
        marginLeft: 12,
        padding: 4,
    },
    icon: {
        fontSize: 20,
    },
});
