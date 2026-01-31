"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Battery, Cpu, Wifi, Zap } from 'lucide-react';
import Link from 'next/link';

export default function Products() {
    return (
        <div className="min-h-screen bg-neutral-900 text-neutral-100 pt-24 sm:pt-28 pb-12">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <header className="text-center max-w-3xl mx-auto mb-16">
                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-6 bg-gradient-to-r from-primary-DEFAULT to-blue-500 bg-clip-text text-transparent"
                    >
                        Los Tecnicos Power Kit
                    </motion.h1>
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="text-xl text-neutral-400"
                    >
                        The essential hardware to join the decentralized energy network.
                        Monetize your excess energy with our smart controller.
                    </motion.p>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center mb-24">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 }}
                        className="bg-neutral-800 rounded-3xl p-8 border border-neutral-700/50 relative overflow-hidden group"
                    >
                        <div className="absolute inset-0 bg-primary-DEFAULT/5 group-hover:bg-primary-DEFAULT/10 transition-colors duration-500" />
                        {/* Placeholder for Product Image */}
                        <div className="aspect-square w-full bg-neutral-700/50 rounded-2xl flex items-center justify-center relative z-10">
                            <Cpu size={120} className="text-primary-DEFAULT opacity-50 transition-transform duration-500 group-hover:scale-110" />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-neutral-500 font-mono text-sm">Image: ESP32 + Battery Pack</span>
                            </div>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 }}
                        className="space-y-8"
                    >
                        <h2 className="text-3xl font-bold">Smart Energy Controller</h2>
                        <p className="text-neutral-400 text-lg leading-relaxed">
                            Our custom-built ESP32-based controller bridges your energy storage with the Los Tecnicos network.
                            It monitors battery levels in real-time, executes secure trade settlements via Soroban smart contracts,
                            and controls energy flow automatically.
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <Feature icon={Wifi} title="Always Connected" desc="Seamless WiFi & MQTT integration for real-time trading." />
                            <Feature icon={Battery} title="Smart BMS" desc="Protects your battery health while maximizing trade efficiency." />
                            <Feature icon={Zap} title="Instant Settlement" desc="Automated hardware locking/unlocking based on payment." />
                            <Feature icon={Cpu} title="Open Source" desc="Fully hackable and customizable firmware." />
                        </div>

                        <div className="pt-6">
                            <Link href="/marketplace">
                                <button className="bg-primary-DEFAULT text-primary-foreground hover:bg-primary-DEFAULT/90 font-bold px-8 py-4 rounded-full transition-all duration-300 w-full sm:w-auto flex items-center justify-center gap-2 group shadow-lg shadow-primary-DEFAULT/25 hover:shadow-primary-DEFAULT/40">
                                    <Zap size={20} className="group-hover:fill-current" />
                                    Get the Kit - 50 XLM
                                </button>
                            </Link>
                            <p className="mt-4 text-sm text-neutral-500 text-center sm:text-left">
                                *Required to participate as a Donor Node
                            </p>
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    );
}

const Feature = ({ icon: Icon, title, desc }: { icon: any, title: string, desc: string }) => (
    <div className="flex gap-4">
        <div className="bg-neutral-800 p-3 rounded-xl h-fit border border-neutral-700">
            <Icon size={24} className="text-primary-DEFAULT" />
        </div>
        <div>
            <h3 className="font-bold text-neutral-200 mb-1">{title}</h3>
            <p className="text-sm text-neutral-400">{desc}</p>
        </div>
    </div>
);
