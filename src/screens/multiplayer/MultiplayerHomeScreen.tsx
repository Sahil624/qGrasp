import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { RootStackParamList } from '../../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList, 'MultiplayerHome'>;

export default function MultiplayerHomeScreen() {
    const navigation = useNavigation<Nav>();

    return (
        <View style={styles.wrap}>
            <Text style={styles.title}>Multiplayer</Text>
            <Text style={styles.sub}>
                Link phones with Bluetooth & Wi‑Fi (no accounts). The teacher hosts a session;
                students join nearby.
            </Text>
            <TouchableOpacity
                style={styles.primary}
                onPress={() => navigation.navigate('HostLobby')}
            >
                <Text style={styles.primaryText}>Host session (teacher)</Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={styles.secondary}
                onPress={() => navigation.navigate('JoinNearby')}
            >
                <Text style={styles.secondaryText}>Join nearby session</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        flex: 1,
        backgroundColor: '#11111b',
        padding: 24,
        gap: 16,
        justifyContent: 'center',
    },
    title: {
        fontSize: 26,
        fontWeight: '800',
        color: '#cdd6f4',
    },
    sub: {
        fontSize: 15,
        color: '#a6adc8',
        lineHeight: 22,
        marginBottom: 8,
    },
    primary: {
        backgroundColor: '#6c63ff',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    primaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
    secondary: {
        borderWidth: 1,
        borderColor: '#313244',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    secondaryText: { color: '#cdd6f4', fontWeight: '600', fontSize: 16 },
});
