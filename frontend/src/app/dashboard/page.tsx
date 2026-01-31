"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Zap,
    Battery,
    ArrowUpRight,
    ArrowDownLeft,
    Cpu,
    Activity,
    History,
    TrendingUp,
    CreditCard,
    Plus,
    Globe,
    ShoppingCart
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

const ROLES = ['Donor', 'Recipient', 'Operator'];

export default function Dashboard() {
    const [activeRole, setActiveRole] = useState('Donor');

    return (
        <div className="max-w-7xl mx-auto px-6 pb-20">
            {/* Header & Role Switcher */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                <h1 className="text-4xl font-black tracking-tighter">DASHBOARD</h1>

                <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10">
                    {ROLES.map((role) => (
                        <button
                            key={role}
                            onClick={() => setActiveRole(role)}
                            className={cn(
                                "px-6 py-2 rounded-xl text-sm font-bold transition-all duration-300",
                                activeRole === role ? "bg-cyber-green text-cyber-dark shadow-neon" : "text-white/40 hover:text-white"
                            )}
                        >
                            {role.toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Content Area */}
            <AnimatePresence mode="wait">
                {activeRole === 'Donor' && <DonorView key="donor" />}
                {activeRole === 'Recipient' && <RecipientView key="recipient" />}
                {activeRole === 'Operator' && <OperatorView key="operator" />}
            </AnimatePresence>
        </div>
    );
}

function MetricCard({ label, value, subtext, icon: Icon, colorClass }: any) {
    return (
        <div className="glass-card relative overflow-hidden group">
            <div className="flex justify-between items-start mb-4">
                <div className={cn("p-2 rounded-lg bg-white/5", colorClass)}>
                    <Icon size={20} />
                </div>
                <TrendingUp className="text-cyber-green opacity-0 group-hover:opacity-100 transition-opacity" size={16} />
            </div>
            <div className="text-2xl font-black mb-1">{value}</div>
            <div className="text-xs uppercase tracking-widest text-white/40 mb-1">{label}</div>
            <div className="text-[10px] text-cyber-green/60 font-medium">{subtext}</div>

            {/* Glow Effect */}
            <div className={cn("absolute -bottom-4 -right-4 w-12 h-12 blur-2xl opacity-20", colorClass)} />
        </div>
    );
}

function DonorView() {
    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-6"
        >
            {/* Metrics Row */}
            <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-4 h-fit">
                <MetricCard icon={Battery} label="Current Storage" value="84%" subtext="+1.2% from production" colorClass="text-cyber-green" />
                <MetricCard icon={TrendingUp} label="Total Earnings" value="1,240 XLM" subtext="≈ $145.20 USD" colorClass="text-cyber-stellar" />
                <MetricCard icon={Activity} label="Device Status" value="Online" subtext="ESP32-04X2 Active" colorClass="text-cyber-green" />

                {/* Large Control Card */}
                <div className="sm:col-span-3 glass-card flex flex-col md:flex-row items-center gap-8 py-10">
                    <div className="relative w-32 h-32 flex items-center justify-center">
                        {/* Circular visualization */}
                        <div className="absolute inset-0 border-4 border-white/5 rounded-full" />
                        <div className="absolute inset-0 border-4 border-t-cyber-green border-r-cyber-green border-b-white/5 border-l-white/5 rounded-full animate-spin-slow" />
                        <Zap size={40} className="text-cyber-green animate-pulse" />
                    </div>
                    <div className="flex-1 text-center md:text-left">
                        <h3 className="text-2xl font-bold mb-2">Sell Excess Energy</h3>
                        <p className="text-white/50 text-sm mb-6 max-w-md">Distribute your stored battery power to the grid and earn XLM rewards instantly.</p>
                        <div className="flex flex-wrap gap-4 justify-center md:justify-start">
                            <button className="cyber-button py-2">MINT TOKENS</button>
                            <button className="px-6 py-2 rounded-full border border-white/10 hover:bg-white/5 font-bold">CREATE ORDER</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Side Column */}
            <div className="lg:col-span-4 flex flex-col gap-6">
                <div className="glass-card flex-1">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold tracking-widest text-xs uppercase text-white/40">Recent Transactions</h3>
                        <History size={16} className="text-white/20" />
                    </div>
                    <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="flex items-center justify-between text-sm py-2 border-b border-white/5 last:border-0">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-cyber-green/10 flex items-center justify-center text-cyber-green">
                                        <ArrowUpRight size={16} />
                                    </div>
                                    <div>
                                        <div className="font-bold">Sold 12.5 kWh</div>
                                        <div className="text-[10px] text-white/40 uppercase">To: GDC...8K2</div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="font-bold text-cyber-green">+8.4 XLM</div>
                                    <div className="text-[10px] text-white/40">2 HOURS AGO</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

function RecipientView() {
    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-6"
        >
            <div className="lg:col-span-12 glass-card h-64 flex items-center justify-center border-dashed text-white/20 border-white/10">
                <div className="text-center">
                    <ShoppingCart size={48} className="mx-auto mb-4 opacity-10" />
                    <p className="uppercase tracking-[0.3em] font-black">Recipient Module Active</p>
                </div>
            </div>
        </motion.div>
    );
}

function OperatorView() {
    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-6"
        >
            <div className="lg:col-span-12 glass-card h-64 flex items-center justify-center border-dashed text-white/20 border-white/10">
                <div className="text-center">
                    <Globe size={48} className="mx-auto mb-4 opacity-10" />
                    <p className="uppercase tracking-[0.3em] font-black">Node Operator Interface</p>
                </div>
            </div>
        </motion.div>
    );
}
