import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import CircuitScreen from '../screens/CircuitScreen';
import ScannerScreen from '../screens/ScannerScreen';
import MeasurementScreen from '../screens/MeasurementScreen';
import ARViewScreen from '../screens/ARViewScreen';

export type RootStackParamList = {
    Circuit: undefined;
    Scanner: undefined;
    Measurement: undefined;
    ARView: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const DarkTheme = {
    ...DefaultTheme,
    dark: true,
    colors: {
        ...DefaultTheme.colors,
        primary: '#6c63ff',
        background: '#11111b',
        card: '#181825',
        text: '#cdd6f4',
        border: '#313244',
        notification: '#f38ba8',
    },
};

const screenOptions = {
    headerStyle: { backgroundColor: '#181825' },
    headerTintColor: '#cdd6f4',
    headerTitleStyle: { fontWeight: '700' as const },
    contentStyle: { backgroundColor: '#11111b' },
};

export default function AppNavigator() {
    return (
        <NavigationContainer theme={DarkTheme}>
            <Stack.Navigator screenOptions={screenOptions}>
                <Stack.Screen
                    name="Circuit"
                    component={CircuitScreen}
                    options={{ title: 'QuantumGrasp' }}
                />
                <Stack.Screen
                    name="Scanner"
                    component={ScannerScreen}
                    options={{ title: 'Scan QR Code' }}
                />
                <Stack.Screen
                    name="Measurement"
                    component={MeasurementScreen}
                    options={{ title: 'Spatial Measurement' }}
                />
                <Stack.Screen
                    name="ARView"
                    component={ARViewScreen}
                    options={{ title: 'AR Bloch Sphere' }}
                />
            </Stack.Navigator>
        </NavigationContainer>
    );
}
