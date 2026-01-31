"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Zap,
    BatteryCharging,
    ArrowUpRight,
    ArrowDownLeft,
    Cpu,
    Activity,
    History,
    TrendingUp,
    Users,
    ShoppingCart,
    Globe
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import { analyticsApi, iotApi } from '@/lib/api';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

const ROLES = ['Donor', 'Recipient', 'Operator'];

export default function Dashboard() {
    const [activeRole, setActiveRole] = useState('Donor');
    const { user, setDevices } = useStore();
    const [stats, setStats] = useState<any>(null);

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                const [statsRes, devicesRes] = await Promise.all([
                    analyticsApi.getDashboard(),
                    iotApi.getDevices()
                ]);
                setStats(statsRes.data);
                setDevices(devicesRes.data);
            } catch (error) {
                console.error("Failed to fetch dashboard data:", error);
            }
        };
        fetchDashboardData();
    }, [setDevices]);

    return (
        <div className="min-h-screen text-neutral-100 pt-24 sm:pt-28">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                    <div>
                        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-neutral-100 uppercase">{activeRole} Dashboard</h1>
                        <p className="mt-2 text-sm text-neutral-400">
                            {user?.wallet_address ? `Wallet: ${user.wallet_address.slice(0, 6)}...${user.wallet_address.slice(-4)}` : 'Guest Mode'}
                        </p>
                    </div>

                    <div className="flex bg-neutral-800 p-1.5 rounded-full border border-neutral-700/50">
                        {ROLES.map((role) => (
                            <button
                                key={role}
                                onClick={() => setActiveRole(role)}
                                className={cn(
                                    "px-4 sm:px-6 py-2 rounded-full text-sm font-bold transition-colors duration-300 relative",
                                    activeRole !== role && "hover:text-neutral-100 text-neutral-400"
                                )}
                            >
                                {activeRole === role && (
                                    <motion.div
                                        layoutId="active-role-indicator"
                                        className="absolute inset-0 bg-primary-DEFAULT rounded-full"
                                    />
                                )}
                                <span className="relative z-10">{role}</span>
                            </button>
                        ))}
                    </div>
                </header>

                <AnimatePresence mode="wait">
                    {activeRole === 'Donor' && <DonorView key="donor" stats={stats} />}
                    {activeRole === 'Recipient' && <RecipientView key="recipient" stats={stats} />}
                    {activeRole === 'Operator' && <OperatorView key="operator" stats={stats} />}
                </AnimatePresence>
            </div>
        </div>
    );
}

function MetricCard({ label, value, icon: Icon, colorClass }: any) {
    return (
        <div className="bg-neutral-800 p-6 rounded-2xl border border-neutral-700/50">
            <div className="flex items-center gap-4">
                <div className={`p-3 rounded-lg ${colorClass}`}>
                    <Icon size={24} />
                </div>
                <div>
                    <p className="text-sm text-neutral-400">{label}</p>
                    <p className="text-2xl font-bold">{value}</p>
                </div>
            </div>
        </div>
    );
}

function DonorView({ stats }: any) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-8"
        >
            <div className="lg:col-span-8 space-y-8">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
                    <MetricCard icon={BatteryCharging} label="Grid Capacity" value={stats?.total_energy_traded ? `${stats.total_energy_traded} kWh` : '0.0 kWh'} colorClass="bg-green-500/10 text-green-400" />
                    <MetricCard icon={Users} label="Network Users" value={stats?.total_users || '0'} colorClass="bg-blue-500/10 text-blue-400" />
                    <MetricCard icon={Activity} label="Active Orders" value={stats?.active_orders || '0'} colorClass="bg-orange-500/10 text-orange-400" />
                </div>

                <div className="bg-neutral-800 p-8 rounded-2xl border border-neutral-700/50 flex flex-col md:flex-row items-center gap-8">
                    <div className="text-center md:text-left flex-1">
                        <h2 className="text-2xl font-bold mb-2">Sell Excess Energy</h2>
                        <p className="text-neutral-400 mb-6">Distribute your stored battery power to the grid and earn XLM rewards instantly.</p>
                        <div className="flex gap-4 justify-center md:justify-start">
                             <button className="bg-primary-DEFAULT text-primary-foreground hover:bg-primary-DEFAULT/90 font-bold px-6 py-3 rounded-full transition-colors">Mint Tokens</button>
                            <button className="bg-neutral-700 hover:bg-neutral-600 font-bold px-6 py-3 rounded-full transition-colors">Create Order</button>
                        </div>
                    </div>
                     <div className="relative w-32 h-32 flex items-center justify-center">
                        <Zap size={48} className="text-primary-DEFAULT" />
                        <motion.div
                            className="absolute inset-0 border-4 border-primary-DEFAULT/20 rounded-full"
                            animate={{ rotate: 360 }}
                            transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                        />
                        <motion.div
                            className="absolute inset-4 border-t-4 border-primary-DEFAULT rounded-full"
                            animate={{ rotate: -360 }}
                            transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
                        />
                    </div>
                </div>
            </div>

            <div className="lg:col-span-4 bg-neutral-800 p-6 rounded-2xl border border-neutral-700/50">
                <h3 className="font-bold mb-6 flex items-center gap-2"><History size={18} /> Recent Transactions</h3>
                <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center text-green-400">
                                    <ArrowUpRight size={20} />
                                </div>
                                <div>
                                    <p className="font-bold">Sold 12.5 kWh</p>
                                    <p className="text-xs text-neutral-400">To: GDC...8K2</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="font-bold text-green-400">+8.4 XLM</p>
                                <p className="text-xs text-neutral-500">2h ago</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </motion.div>
    );
}

const EmptyState = ({ icon: Icon, title, subtitle }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="col-span-12 bg-neutral-800 border-2 border-dashed border-neutral-700 rounded-2xl h-80 flex flex-col items-center justify-center text-center"
    >
        <Icon size={48} className="text-neutral-600 mb-4" />
        <h2 className="text-xl font-bold text-neutral-300">{title}</h2>
        <p className="text-neutral-500 mt-1">{subtitle}</p>
    </motion.div>
);

function RecipientView({ stats }: any) {
    return (
        <EmptyState 
            icon={ShoppingCart}
            title="Recipient Module Active"
            subtitle={`${stats?.total_iot_devices || '0'} Devices Monitored`}
        />
    );
}

function OperatorView({ stats }: any) {
    return (
        <EmptyState
            icon={Globe}
            title="Node Operator Interface"
            subtitle={`${stats?.total_network_nodes || '0'} Nodes In Network`}
        />
    );
}
