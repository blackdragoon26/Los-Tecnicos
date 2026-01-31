"use client";

import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Points, PointMaterial } from '@react-three/drei';
import * as THREE from 'three';

function EnergyGrid() {
    const ref = useRef<THREE.Points>(null!);

    const particleCount = 2000;
    const positions = useMemo(() => {
        const pos = new Float32Array(particleCount * 3);
        for (let i = 0; i < particleCount; i++) {
            pos[i * 3] = (Math.random() - 0.5) * 50;
            pos[i * 3 + 1] = (Math.random() - 0.5) * 50;
            pos[i * 3 + 2] = (Math.random() - 0.5) * 50;
        }
        return pos;
    }, []);

    useFrame((state, delta) => {
        if (ref.current) {
            ref.current.rotation.x += delta * 0.05;
            ref.current.rotation.y += delta * 0.05;
        }
    });

    return (
        <group rotation={[0, 0, Math.PI / 4]}>
            <Points ref={ref} positions={positions} stride={3} frustumCulled={false}>
                <PointMaterial
                    transparent
                    color="#00ff88"
                    size={0.1}
                    sizeAttenuation={true}
                    depthWrite={false}
                    blending={THREE.AdditiveBlending}
                />
            </Points>
        </group>
    );
}

export default function EnergyBackground() {
    return (
        <div className="fixed inset-0 -z-10 bg-[#050714]">
            <Canvas camera={{ position: [0, 0, 15] }}>
                <color attach="background" args={['#050714']} />
                <ambientLight intensity={0.5} />
                <EnergyGrid />
            </Canvas>
        </div>
    );
}
