import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Points, PointMaterial } from '@react-three/drei';
import * as random from 'maath/random/dist/maath-random.esm';
import * as THREE from 'three';
import { FallingLeavesGPGPU } from './FallingLeavesGPGPU';
import { WindStreaks } from './WindStreaks';

const Particles = (props: Record<string, unknown>) => {
    const ref = useRef<THREE.Points>(null);

    // Subtle background particles (keep light so it doesn't distract)
    const sphere = useMemo(() => random.inSphere(new Float32Array(1100 * 3), { radius: 1.5 }), []);

    useFrame((state, delta) => {
        if (ref.current) {
            ref.current.rotation.x -= delta / 10;
            ref.current.rotation.y -= delta / 15;
        }
    });

    return (
        <group rotation={[0, 0, Math.PI / 4]}>
            <Points ref={ref} positions={sphere} stride={3} frustumCulled={false} {...props}>
                <PointMaterial
                    transparent
                    color="#16a34a"  // Green-600 to match brand
                    size={0.003}
                    sizeAttenuation={true}
                    depthWrite={false}
                    opacity={0.12}
                />
            </Points>
        </group>
    );
};

const Connections = () => {
    // A secondary slower moving layer for depth
    const ref = useRef<THREE.Points>(null);
    const sphere = useMemo(() => random.inSphere(new Float32Array(250 * 3), { radius: 2 }), []);

    useFrame((state, delta) => {
        if (ref.current) {
            ref.current.rotation.x += delta / 20;
            ref.current.rotation.y += delta / 25;
        }
    });

    return (
        <group rotation={[0, 0, Math.PI / 4]}>
            <Points ref={ref} positions={sphere} stride={3} frustumCulled={false}>
                <PointMaterial
                    transparent
                    color="#86efac"  // Green-300
                    size={0.005}
                    sizeAttenuation={true}
                    depthWrite={false}
                    opacity={0.10}
                />
            </Points>
        </group>
    );
}

export const BioNetworkScene: React.FC = () => {
    return (
        <div className="fixed inset-0 w-full h-full -z-10 bg-gradient-to-br from-green-50/30 via-white/85 to-white/95 pointer-events-none">
            <Canvas
                className="opacity-85"
                camera={{ position: [0, 0, 5], fov: 60 }}
                gl={{
                    powerPreference: "default",
                    antialias: true,
                    preserveDrawingBuffer: false,
                    failIfMajorPerformanceCaveat: false
                }}
                onCreated={({ gl }) => {
                    gl.domElement.addEventListener('webglcontextlost', (event) => {
                        event.preventDefault();
                        console.warn('WebGL Context Lost - attempting restore');
                    }, false);
                    gl.domElement.addEventListener('webglcontextrestored', () => {
                        console.log('WebGL Context Restored');
                    }, false);
                }}
            >
                {/* Existing Particles */}
                <Particles />
                <Connections />

                {/* Visible sideways airflow */}
                <WindStreaks />

                {/* High-Fidelity GPGPU Leaves */}
                <FallingLeavesGPGPU />
            </Canvas>
        </div>
    );
};
