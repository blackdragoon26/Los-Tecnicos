"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Globe, MapPin, Activity, Zap, Cpu } from 'lucide-react';

const networkStats = [
  { label: 'Active Nodes', value: '2,401', icon: Cpu },
  { label: 'Data Relayed', value: '1.2 PB', icon: Activity },
  { label: 'Mesh Health', value: '98.4%', icon: Zap },
];

const topNodes = [
  { name: 'BERLIN-MESH-04', location: 'Berlin, Germany', relayed: '14.2 GB', uptime: '99.9%' },
  { name: 'SF-GRID-01', location: 'San Francisco, USA', relayed: '12.8 GB', uptime: '99.8%' },
  { name: 'TOKYO-NODE-07', location: 'Tokyo, Japan', relayed: '11.5 GB', uptime: '99.7%' },
];

export default function NetworkMap() {
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
                         <WorldMap />
                    </motion.div>

                    {/* Top Nodes List */}
                    <motion.div 
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        className="lg:col-span-4 bg-neutral-800 p-6 rounded-2xl border border-neutral-700/50"
                    >
                        <h2 className="text-xl font-bold mb-6">Top Performing Nodes</h2>
                        <div className="space-y-4">
                            {topNodes.map((node) => (
                                <div key={node.name} className="bg-neutral-700/50 p-4 rounded-lg">
                                    <p className="font-bold text-primary-DEFAULT">{node.name}</p>
                                    <p className="text-xs text-neutral-400 flex items-center gap-1.5 mt-1"><MapPin size={12}/> {node.location}</p>
                                    <div className="flex justify-between text-sm mt-3 text-neutral-300">
                                        <span>Relayed: <span className="font-semibold">{node.relayed}</span></span>
                                        <span>Uptime: <span className="font-semibold">{node.uptime}</span></span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    );
}

const WorldMap = () => (
    <div className="w-full h-full relative">
        <svg viewBox="0 0 800 400" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
            <path 
                d="M400,0 C179.086,0 0,100.422 0,200 C0,299.578 179.086,400 400,400 C620.914,400 800,299.578 800,200 C800,100.422 620.914,0 400,0 Z" 
                fill="#1F2937"
            />
            {/* Some random points to simulate nodes */}
            <MapPoint cx="400" cy="200" />
            <MapPoint cx="150" cy="150" />
            <MapPoint cx="650" cy="250" />
            <MapPoint cx="300" cy="280" />
            <MapPoint cx="500" cy="120" />
            <MapPoint cx="250" cy="100" />
            <MapPoint cx="580" cy="300" />
        </svg>
    </div>
);

const MapPoint = ({ cx, cy }) => (
    <g transform={`translate(${cx}, ${cy})`}>
        <circle cx="0" cy="0" r="3" fill="#3B82F6" />
        <circle cx="0" cy="0" r="6" fill="#3B82F6" fillOpacity="0.3">
            <animate 
                attributeName="r" 
                from="3" 
                to="12" 
                dur="1.5s"
                begin={`${Math.random() * 1.5}s`}
                repeatCount="indefinite"
            />
            <animate 
                attributeName="opacity" 
                from="0.5" 
                to="0" 
                dur="1.5s" 
                begin={`${Math.random() * 1.5}s`}
                repeatCount="indefinite"
            />
        </circle>
    </g>
);

