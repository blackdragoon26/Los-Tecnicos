"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { BarChart, LineChart, PieChart, TrendingUp, Zap, Users } from 'lucide-react';

const kpiData = [
    { label: "Total Energy Traded", value: "1.2 MWh", icon: Zap },
    { label: "Market Volume (XLM)", value: "45.2k", icon: TrendingUp },
    { label: "Active Users", value: "853", icon: Users },
]

const AnalyticsPage = () => {
    return (
        <div className="min-h-screen text-neutral-100 pt-24 sm:pt-28">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <header className="mb-12">
                    <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-neutral-100">Analytics Dashboard</h1>
                    <p className="mt-2 text-lg text-neutral-400">"The only analytics we love is good money." - and good data.</p>
                </header>

                {/* KPI Section */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
                    {kpiData.map((kpi, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1 }}
                            className="bg-neutral-800 p-6 rounded-2xl border border-neutral-700/50"
                        >
                            <div className="flex items-center gap-4">
                                <div className="p-3 rounded-lg bg-primary-DEFAULT/10 text-primary-DEFAULT">
                                    <kpi.icon size={24} />
                                </div>
                                <div>
                                    <p className="text-sm text-neutral-400">{kpi.label}</p>
                                    <p className="text-2xl font-bold">{kpi.value}</p>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Main Chart */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5 }}
                        className="bg-neutral-800 p-6 rounded-2xl border border-neutral-700/50 lg:col-span-2"
                    >
                        <h2 className="text-xl font-bold mb-4">Energy Traded Over Time</h2>
                        <div className="h-96 w-full bg-neutral-700/50 rounded-lg flex items-center justify-center">
                            <LineChart className="w-16 h-16 text-neutral-600" />
                            <p className="text-neutral-500 ml-4">Line chart coming soon</p>
                        </div>
                    </motion.div>

                    {/* Smaller Charts */}
                    <motion.div
                         initial={{ opacity: 0, x: -20 }}
                         animate={{ opacity: 1, x: 0 }}
                         transition={{ duration: 0.5, delay: 0.2 }}
                         className="bg-neutral-800 p-6 rounded-2xl border border-neutral-700/50"
                    >
                        <h2 className="text-xl font-bold mb-4">Buy vs. Sell Orders</h2>
                        <div className="h-64 w-full bg-neutral-700/50 rounded-lg flex items-center justify-center">
                            <PieChart className="w-16 h-16 text-neutral-600" />
                             <p className="text-neutral-500 ml-4">Pie chart coming soon</p>
                        </div>
                    </motion.div>
                    <motion.div
                         initial={{ opacity: 0, x: 20 }}
                         animate={{ opacity: 1, x: 0 }}
                         transition={{ duration: 0.5, delay: 0.2 }}
                        className="bg-neutral-800 p-6 rounded-2xl border border-neutral-700/50"
                    >
                        <h2 className="text-xl font-bold mb-4">Peak Trading Hours</h2>
                        <div className="h-64 w-full bg-neutral-700/50 rounded-lg flex items-center justify-center">
                            <BarChart className="w-16 h-16 text-neutral-600" />
                             <p className="text-neutral-500 ml-4">Bar chart coming soon</p>
                        </div>
                    </motion.div>
                </div>

            </div>
        </div>
    );
};

export default AnalyticsPage;

