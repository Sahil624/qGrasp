import { useEffect, useRef, useState, useCallback } from 'react';
import { Accelerometer } from 'expo-sensors';

export interface MeasurementAxis {
    x: number;
    y: number;
    z: number;
}

export function useMeasurement() {
    const [axis, setAxis] = useState<MeasurementAxis>({ x: 0, y: 0, z: 1 });
    const thetaRef = useRef(0);
    const phiRef = useRef(0);

    useEffect(() => {
        const alpha = 0.15;
        Accelerometer.setUpdateInterval(100);

        const subscription = Accelerometer.addListener(({ x, y, z }) => {
            const norm = Math.sqrt(x * x + y * y + z * z);
            if (norm < 0.1) return;

            const nx = x / norm;
            const ny = y / norm;
            const nz = z / norm;

            const theta = Math.acos(Math.max(-1, Math.min(1, nz)));
            const phi = Math.atan2(ny, nx);

            thetaRef.current = thetaRef.current * (1 - alpha) + alpha * theta;
            phiRef.current = phiRef.current * (1 - alpha) + alpha * phi;

            setAxis({
                x: Math.sin(thetaRef.current) * Math.cos(phiRef.current),
                y: Math.sin(thetaRef.current) * Math.sin(phiRef.current),
                z: Math.cos(thetaRef.current),
            });
        });

        return () => subscription.remove();
    }, []);

    return axis;
}
