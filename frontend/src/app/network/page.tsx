"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Globe, MapPin, Activity, Zap, Cpu } from 'lucide-react';
import { analyticsApi } from '@/lib/api';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://los-tecnicos-backend.onrender.com/api/v1';

export default function NetworkMap() {
    const [stats, setStats] = useState<any>(null);
    const [nodes, setNodes] = useState<any[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const ROOT_URL = API_BASE.replace('/api/v1', '');
                const [dashboardRes, nodesRes] = await Promise.all([
                    analyticsApi.getDashboard().catch(() => ({ data: {} })),
                    fetch(`${ROOT_URL}/iot/nodes/rpi-4b-prod-01`)
                        .then(r => r.ok ? r.json() : null)
                        .catch(() => null)
                ]);
                setStats(dashboardRes.data);

                if (nodesRes && nodesRes.nodes) {
                    setNodes(nodesRes.nodes);
                }
            } catch (error) {
                console.error("Failed to fetch network data", error);
            }
        };
        fetchData();
        const interval = setInterval(fetchData, 5000);
        return () => clearInterval(interval);
    }, []);

    const networkStats = [
        { label: 'Active Devices', value: stats?.total_iot_devices || '0', icon: Cpu },
        { label: 'Network Nodes', value: stats?.total_network_nodes || '0', icon: Activity },
        { label: 'Energy Traded', value: stats?.total_energy_traded ? `${stats.total_energy_traded.toFixed(2)} kWh` : '0 kWh', icon: Zap },
    ];

    const topNodes = nodes.slice(0, 5).map((n: any) => ({
        name: n.uid,
        location: n.ip || 'Local Network',
        relayed: `${n.voltage.toFixed(2)} V`,
        uptime: `${n.soc.toFixed(1)}%`
    }));

    return (
        <div className="min-h-screen text-neutral-100 pt-24 sm:pt-28">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <header className="mb-12">
                    <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-neutral-100">Network Status</h1>
                    <p className="mt-2 text-lg text-neutral-400">An overview of our global community mesh.</p>
                </header>

                {/* Stats Section */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
                    {networkStats.map((stat, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1 }}
                            className="bg-neutral-800 p-6 rounded-2xl border border-neutral-700/50"
                        >
                            <div className="flex items-center gap-4">
                                <div className="p-3 rounded-lg bg-primary-DEFAULT/10 text-primary-DEFAULT">
                                    <stat.icon size={24} />
                                </div>
                                <div>
                                    <p className="text-sm text-neutral-400">{stat.label}</p>
                                    <p className="text-2xl font-bold">{stat.value}</p>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Map and Top Nodes */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Map */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5 }}
                        className="lg:col-span-8 bg-neutral-800 p-6 rounded-2xl border border-neutral-700/50 h-96 lg:h-auto flex items-center justify-center"
                    >
                        <WorldMap nodes={nodes} />
                    </motion.div>

                    {/* Top Nodes List */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        className="lg:col-span-4 bg-neutral-800 p-6 rounded-2xl border border-neutral-700/50"
                    >
                        <h2 className="text-xl font-bold mb-6">Live Node States</h2>
                        <div className="space-y-4">
                            {topNodes.map((node) => (
                                <div key={node.name} className="bg-neutral-700/50 p-4 rounded-lg">
                                    <p className="font-bold text-primary-DEFAULT">{node.name}</p>
                                    <p className="text-xs text-neutral-400 flex items-center gap-1.5 mt-1"><MapPin size={12} /> {node.location}</p>
                                    <div className="flex justify-between text-sm mt-3 text-neutral-300">
                                        <span>Voltage: <span className="font-semibold">{node.relayed}</span></span>
                                        <span>SoC: <span className="font-semibold">{node.uptime}</span></span>
                                    </div>
                                </div>
                            ))}
                            {topNodes.length === 0 && (
                                <div className="text-center py-4">
                                    <p className="text-neutral-500 text-sm">No live nodes found.</p>
                                    <p className="text-neutral-600 text-xs mt-1">Nodes appear when the Pi sends data via /iot/ping</p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    );
}

const WorldMap = ({ nodes }: { nodes: any[] }) => (
    <div className="w-full h-full relative flex items-center justify-center">
        {nodes.length === 0 ? (
            <div className="text-center">
                <Globe size={48} className="text-neutral-600 mx-auto mb-3" />
                <p className="text-neutral-500 text-sm">No nodes connected yet</p>
                <p className="text-neutral-600 text-xs mt-1">Waiting for Raspberry Pi data...</p>
            </div>
        ) : (
            <svg viewBox="0 0 800 400" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
                <path
                    d="M400,0 C179.086,0 0,100.422 0,200 C0,299.578 179.086,400 400,400 C620.914,400 800,299.578 800,200 C800,100.422 620.914,0 400,0 Z"
                    fill="#1F2937"
                />
                {nodes.map((node, i) => (
                    <MapPoint
                        key={node.uid}
                        cx={200 + i * 200}
                        cy={150 + (i % 2) * 100}
                        delay={i * 0.3}
                    />
                ))}
            </svg>
        )}
    </div>
);

const MapPoint = ({ cx, cy, delay }: { cx: number; cy: number; delay: number }) => (
    <g transform={`translate(${cx}, ${cy})`}>
        <circle cx="0" cy="0" r="3" fill="#3B82F6" />
        <circle cx="0" cy="0" r="6" fill="#3B82F6" fillOpacity="0.3">
            <animate
                attributeName="r"
                from="3"
                to="12"
                dur="1.5s"
                begin={`${delay}s`}
                repeatCount="indefinite"
            />
            <animate
                attributeName="opacity"
                from="0.5"
                to="0"
                dur="1.5s"
                begin={`${delay + 0.3}s`}
                repeatCount="indefinite"
            />
        </circle>
    </g>
);
