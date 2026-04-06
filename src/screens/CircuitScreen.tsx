import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import GatePicker from '../components/GatePicker';
import CircuitList from '../components/CircuitList';
import ProbabilityChart from '../components/ProbabilityChart';
import QuantumCircuitViz from '../components/QuantumCircuitViz';
import { RootStackParamList } from '../navigation/AppNavigator';
import HeaderButton from '../components/HeaderButton';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Circuit'>;

export default function CircuitScreen() {
    const navigation = useNavigation<Nav>();

    React.useLayoutEffect(() => {
        navigation.setOptions({
            headerRight: () => (
                <>
                    <HeaderButton
                        icon="📷"
                        onPress={() => navigation.navigate('Scanner')}
                    />
                    <HeaderButton
                        icon="🎯"
                        onPress={() => navigation.navigate('Measurement')}
                    />
                    <HeaderButton
                        icon="🔮"
                        onPress={() => navigation.navigate('ARView')}
                    />
                    <HeaderButton
                        icon="👥"
                        onPress={() => navigation.navigate('MultiplayerHome')}
                    />
                </>
            ),
        });
    }, [navigation]);

    return (
        <SafeAreaView style={styles.screen}>
            <GatePicker />
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <CircuitList />
                <QuantumCircuitViz />
                <ProbabilityChart />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: '#11111b',
    },
    scrollContent: {
        paddingVertical: 16,
        gap: 16,
    },
});
