"use client";

import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sphere, MeshDistortMaterial, Float } from '@react-three/drei';
import * as THREE from 'three';
import { Globe, MapPin, Activity, Zap } from 'lucide-react';

function GlobeModel() {
    const mesh = useRef<THREE.Mesh>(null!);

    useFrame((state) => {
        if (mesh.current) {
            mesh.current.rotation.y += 0.002;
        }
    });

    return (
        <group>
            {/* Main Globe */}
            <Sphere ref={mesh} args={[3, 64, 64]}>
                <MeshDistortMaterial
                    color="#002244"
                    attach="material"
                    distort={0.1}
                    speed={2}
                    roughness={0.4}
                    metalness={0.1}
                    wireframe
                />
            </Sphere>

            {/* Core Glowing Core */}
            <Sphere args={[2.5, 32, 32]}>
                <meshBasicMaterial color="#00ff88" transparent opacity={0.05} />
            </Sphere>

            {/* Grid Points (Simulation) */}
            {Array.from({ length: 15 }).map((_, i) => {
                const phi = Math.random() * Math.PI * 2;
                const theta = Math.random() * Math.PI;
                const r = 3.1;
                const x = r * Math.sin(theta) * Math.cos(phi);
                const y = r * Math.sin(theta) * Math.sin(phi);
                const z = r * Math.cos(theta);

                return (
                    <mesh key={i} position={[x, y, z]}>
                        <sphereGeometry args={[0.05, 16, 16]} />
                        <meshBasicMaterial color="#00ff88" />
                        <pointLight distance={1} intensity={2} color="#00ff88" />
                    </mesh>
                );
            })}
        </group>
    );
}

export default function NetworkMap() {
    return (
        <div className="max-w-7xl mx-auto px-6 pb-20 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* 3D Visualization */}
            <div className="lg:col-span-12 h-[600px] glass-card relative overflow-hidden p-0 bg-transparent border-none">
                <div className="absolute top-8 left-8 z-10">
                    <h1 className="text-4xl font-black tracking-tighter mb-2">GRID NODES</h1>
                    <p className="text-white/40 text-sm uppercase tracking-widest">Global Community Mesh Explorer</p>
                </div>

                <div className="absolute bottom-8 left-8 flex gap-6 z-10">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-cyber-green animate-pulse" />
                        <span className="text-[10px] text-white/60 font-medium">2,401 ACTIVE</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-cyber-stellar" />
                        <span className="text-[10px] text-white/60 font-medium">15 OFFLINE</span>
                    </div>
                </div>

                <Canvas camera={{ position: [0, 0, 10] }}>
                    <ambientLight intensity={0.5} />
                    <pointLight position={[10, 10, 10]} intensity={1} color="#00ff88" />
                    <Float speed={1.5} rotationIntensity={0.5} floatIntensity={0.5}>
                        <GlobeModel />
                    </Float>
                </Canvas>

                {/* Overlay Info Card */}
                <div className="absolute top-8 right-8 z-10 w-64 space-y-4">
                    <div className="glass-card p-4 border-cyber-green/30">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 rounded-lg bg-cyber-green/10 text-cyber-green">
                                <Activity size={16} />
                            </div>
                            <span className="text-xs font-bold uppercase tracking-wider">Top Node</span>
                        </div>
                        <div className="text-sm font-bold mb-1">BERLIN-MESH-04</div>
                        <div className="text-[10px] text-white/40 mb-3">LAST SEEN: 2s AGO</div>
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-white/40">Relayed</span>
                            <span className="text-cyber-green font-bold">14.2 GB</span>
                        </div>
                    </div>

                    <div className="glass-card p-4">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 rounded-lg bg-cyber-stellar/10 text-cyber-stellar">
                                <Zap size={16} />
                            </div>
                            <span className="text-xs font-bold uppercase tracking-wider">Mesh Health</span>
                        </div>
                        <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-cyber-stellar w-[98%]" />
                        </div>
                        <div className="flex justify-between items-center text-[10px] mt-2">
                            <span className="text-white/40">SYSTEM STABILITY</span>
                            <span className="text-cyber-stellar font-bold">98.4%</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
