import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
} from 'react-native';
import { useCircuitStore } from '../services/useCircuitStore';

let ViroReactAvailable = false;
let ViroARScene: any;
let ViroARSceneNavigator: any;
let ViroNode: any;
let ViroSphere: any;
let ViroMaterials: any;
let ViroText: any;
let ViroARPlaneSelector: any;
let ViroAmbientLight: any;
let ViroPolyline: any;


function loadViroReact() {
    try {
        const viro = require('@reactvision/react-viro');
        ViroARScene = viro.ViroARScene;
        ViroARSceneNavigator = viro.ViroARSceneNavigator;
        ViroNode = viro.ViroNode;
        ViroSphere = viro.ViroSphere;
        ViroMaterials = viro.ViroMaterials;
        ViroText = viro.ViroText;
        ViroARPlaneSelector = viro.ViroARPlaneSelector;
        ViroAmbientLight = viro.ViroAmbientLight;
        ViroPolyline = viro.ViroPolyline;

        // Register materials (only if native module is present)
        ViroMaterials.createMaterials({
            glassSphere: {
                diffuseColor: '#6c63ff22',
                lightingModel: 'Blinn',
                shininess: 0.9,
            },
            wireLine: {
                diffuseColor: '#ffffff44',
                lightingModel: 'Constant',
            },
            xAxis: { diffuseColor: '#f38ba8AA', lightingModel: 'Constant' },
            yAxis: { diffuseColor: '#a6e3a1AA', lightingModel: 'Constant' },
            zAxis: { diffuseColor: '#89b4faAA', lightingModel: 'Constant' },
            stateVector: { diffuseColor: '#f9e2af', lightingModel: 'Constant' },
            stateVectorTip: { diffuseColor: '#f9e2af', lightingModel: 'Blinn', shininess: 0.8 },
            blochSphereZero: {
                diffuseColor: '#89b4faCC',
                lightingModel: 'Blinn',
                shininess: 0.8,
            },
            blochSphereOne: {
                diffuseColor: '#f38ba8CC',
                lightingModel: 'Blinn',
                shininess: 0.8,
            },
        });

        ViroReactAvailable = true;
    } catch (e) {
        // ViroReact native module not available — will show fallback UI
        console.warn('ViroReact not available:', e);
    }
}

// ────── AR Scene Component ──────

// Helper: generating circle points for wireframe
function circlePoints(radius: number, segments: number, axis: 'xy' | 'xz' | 'yz') {
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= segments; i++) {
        const a = (i / segments) * Math.PI * 2;
        if (axis === 'xz') pts.push([Math.cos(a) * radius, 0, Math.sin(a) * radius]);
        if (axis === 'xy') pts.push([Math.cos(a) * radius, Math.sin(a) * radius, 0]);
        if (axis === 'yz') pts.push([0, Math.cos(a) * radius, Math.sin(a) * radius]);
    }
    return pts;
}

function computeBlochVector(probs: Record<string, number>, radius: number): [number, number, number] {
    let p0 = 0;
    for (const [state, prob] of Object.entries(probs)) {
        if (state[0] === '0') p0 += prob;
    }
    p0 = Math.max(0, Math.min(1, p0)); // Clamp 0-1

    const theta = 2 * Math.acos(Math.sqrt(p0));
    const phase = 0; // Phase unknown from just probabilities, assuming 0 (real positive)

    const x = radius * Math.sin(theta) * Math.cos(phase);
    const y = radius * Math.sin(theta) * Math.sin(phase);
    const z = radius * Math.cos(theta);

    // Map Bloch (Z up) to Viro (Y up, -Z forward)
    return [x, z, -y];
}

function BlochSphereScene(props: { probabilities: Record<string, number> }) {
    const selectorRef = useRef<typeof ViroARPlaneSelector>(null);
    const probs = props.probabilities || {};
    const entries = Object.entries(probs).slice(0, 4);
    const probText = entries
        .map(([label, value]) => `|${label}⟩ ${(value * 100).toFixed(0)}%`)
        .join('  ');

    const [placed, setPlaced] = useState(false);

    const handlePlaneSelected = useCallback(() => {
        setPlaced(true);
    }, []);

    const radius = 0.12;
    const sv = computeBlochVector(probs, radius);

    // Precompute circle points
    const circleXZ = circlePoints(radius, 64, 'xz');
    const circleXY = circlePoints(radius, 64, 'xy');
    // const circleYZ = circlePoints(radius, 64, 'yz'); // Optional 3rd meridian

    return (
        <ViroARScene
            anchorDetectionTypes={["PlanesHorizontal", "PlanesVertical"]}
            onAnchorFound={(a: any) => selectorRef.current?.handleAnchorFound(a)}
            onAnchorUpdated={(a: any) => selectorRef.current?.handleAnchorUpdated(a)}
            onAnchorRemoved={(a: any) => a && selectorRef.current?.handleAnchorRemoved(a)}
        >
            <ViroAmbientLight color="#ffffff" intensity={200} />

            <ViroARPlaneSelector
                ref={selectorRef}
                alignment="Both"
                hideOverlayOnSelection={true}
                onPlaneSelected={handlePlaneSelected}
            >
                {/* Children are placed at the selected plane location */}
                <ViroNode position={[0, radius, 0]}>

                    {/* Semi-transparent glass sphere */}
                    <ViroSphere
                        radius={radius}
                        widthSegmentCount={32}
                        heightSegmentCount={32}
                        materials={['glassSphere']}
                    />

                    {/* Wireframe rings */}
                    <ViroPolyline points={circleXZ} thickness={0.001} materials={['wireLine']} />
                    <ViroPolyline points={circleXY} thickness={0.001} materials={['wireLine']} />

                    {/* Axes */}
                    <ViroPolyline points={[[0, -radius * 1.2, 0], [0, radius * 1.2, 0]]} thickness={0.001} materials={['zAxis']} />
                    <ViroPolyline points={[[-radius * 1.2, 0, 0], [radius * 1.2, 0, 0]]} thickness={0.001} materials={['xAxis']} />
                    <ViroPolyline points={[[0, 0, -radius * 1.2], [0, 0, radius * 1.2]]} thickness={0.001} materials={['yAxis']} />

                    {/* Pole markers */}
                    <ViroSphere radius={0.01} materials={['blochSphereZero']} position={[0, radius, 0]} />
                    <ViroSphere radius={0.01} materials={['blochSphereOne']} position={[0, -radius, 0]} />

                    {/* Labels */}
                    <ViroText text="|0⟩" position={[0, radius * 1.3, 0]} style={{ fontSize: 10, color: '#89b4fa', fontWeight: 'bold' }} width={0.2} height={0.05} />
                    <ViroText text="|1⟩" position={[0, -radius * 1.3, 0]} style={{ fontSize: 10, color: '#f38ba8', fontWeight: 'bold' }} width={0.2} height={0.05} />
                    <ViroText text="|+⟩" position={[radius * 1.3, 0, 0]} style={{ fontSize: 10, color: '#f38ba8' }} width={0.2} height={0.05} />
                    <ViroText text="|+i⟩" position={[0, 0, -radius * 1.3]} style={{ fontSize: 10, color: '#a6e3a1' }} width={0.2} height={0.05} />

                    {/* State Vector */}
                    <ViroPolyline points={[[0, 0, 0], sv]} thickness={0.003} materials={['stateVector']} />
                    <ViroSphere radius={0.01} position={sv} materials={['stateVectorTip']} />

                    {/* State probability text */}
                    {probText.length > 0 && (
                        <ViroText
                            text={probText}
                            position={[0, radius * 1.6, 0]}
                            style={{ fontSize: 10, color: '#cdd6f4' }}
                            width={0.6}
                            height={0.05}
                        />
                    )}
                </ViroNode>
            </ViroARPlaneSelector>
        </ViroARScene>
    );
}


function ARFallback({ entries }: { entries: [string, number][] }) {
    return (
        <View style={styles.content}>
            <View style={styles.arPlaceholder}>
                <Text style={styles.arIcon}>🔮</Text>
                <Text style={styles.arTitle}>AR Bloch Sphere</Text>
                <Text style={styles.arSubtitle}>
                    ViroReact native module not found.{'\n'}
                    Rebuild the app with native code to enable AR.
                </Text>
                <View style={styles.divider} />
                <Text style={styles.instructionTitle}>To enable AR:</Text>
                <Text style={styles.instructionText}>
                    1. npx expo prebuild{'\n'}
                    2. npx expo run:android{'\n'}
                    3. Point at a flat surface to place Bloch sphere
                </Text>
            </View>

            {entries.length > 0 && (
                <View style={styles.stateCard}>
                    <Text style={styles.stateTitle}>Current State</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {entries.slice(0, 6).map(([label, value]) => (
                            <View key={label} style={styles.stateChip}>
                                <Text style={styles.stateChipText}>
                                    |{label}⟩ {(value * 100).toFixed(0)}%
                                </Text>
                            </View>
                        ))}
                    </ScrollView>
                </View>
            )}
        </View>
    );
}

export default function ARViewScreen() {
    const probabilities = useCircuitStore((s) => s.probabilities) ?? {};
    const entries = Object.entries(probabilities);

    if (!ViroReactAvailable) {
        // load viro react
        loadViroReact();

        if (!ViroReactAvailable) {
            return (
                <View style={styles.screen}>
                    <ARFallback entries={entries} />
                </View>
            );
        }
    }

    return (
        <View style={styles.screen}>
            <ViroARSceneNavigator
                initialScene={{
                    scene: () => <BlochSphereScene probabilities={probabilities} />,
                }}
                style={styles.arView}
            />

            {/* Instruction overlay */}
            <View style={styles.instructionOverlay}>
                <Text style={styles.overlayText}>
                    Tap on a detected plane to place a Bloch sphere
                </Text>
            </View>

            {/* State overlay */}
            {entries.length > 0 && (
                <View style={styles.stateCardOverlay}>
                    <Text style={styles.stateTitle}>State</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {entries.slice(0, 6).map(([label, value]) => (
                            <View key={label} style={styles.stateChip}>
                                <Text style={styles.stateChipText}>
                                    |{label}⟩ {(value * 100).toFixed(0)}%
                                </Text>
                            </View>
                        ))}
                    </ScrollView>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: '#11111b',
    },
    arView: {
        flex: 1,
    },
    content: {
        flex: 1,
        padding: 16,
        gap: 16,
    },
    arPlaceholder: {
        flex: 1,
        backgroundColor: '#1e1e2e',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
        minHeight: 300,
    },
    arIcon: {
        fontSize: 64,
        marginBottom: 16,
    },
    arTitle: {
        color: '#cdd6f4',
        fontSize: 24,
        fontWeight: '700',
        marginBottom: 12,
    },
    arSubtitle: {
        color: '#a6adc8',
        fontSize: 13,
        textAlign: 'center',
        lineHeight: 18,
    },
    divider: {
        height: 1,
        backgroundColor: '#313244',
        width: '100%',
        marginVertical: 16,
    },
    instructionTitle: {
        color: '#f9e2af',
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
    },
    instructionText: {
        color: '#a6adc8',
        fontSize: 13,
        lineHeight: 22,
        textAlign: 'center',
    },
    instructionOverlay: {
        position: 'absolute',
        bottom: 24,
        alignSelf: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderRadius: 8,
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    overlayText: {
        color: '#cdd6f4',
        fontSize: 14,
    },
    stateCard: {
        backgroundColor: '#1e1e2e',
        borderRadius: 12,
        padding: 14,
    },
    stateCardOverlay: {
        position: 'absolute',
        bottom: 80,
        left: 24,
        right: 24,
        backgroundColor: '#1e1e2eEE',
        borderRadius: 12,
        padding: 14,
    },
    stateTitle: {
        color: '#cdd6f4',
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
    },
    stateChip: {
        backgroundColor: '#313244',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 6,
        marginRight: 8,
    },
    stateChipText: {
        color: '#cdd6f4',
        fontSize: 13,
    },
});
