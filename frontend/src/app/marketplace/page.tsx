"use client";

import React from 'react';
import { motion } from 'framer-motion';
import {
    ShoppingCart,
    ArrowUpRight,
    ArrowDownLeft,
    TrendingUp,
    BarChart2,
    Filter,
    Search,
    Zap,
    Tag
} from 'lucide-react';

export default function Marketplace() {
    const sellOrders = [
        { id: 1, amount: '45.0', price: '0.82', total: '36.9', time: '12s ago' },
        { id: 2, amount: '12.4', price: '0.84', total: '10.4', time: '1m ago' },
        { id: 3, amount: '105.0', price: '0.85', total: '89.2', time: '3m ago' },
    ];

    const buyOrders = [
        { id: 1, amount: '22.0', price: '0.79', total: '17.3', time: '5s ago' },
        { id: 2, amount: '84.4', price: '0.78', total: '65.8', time: '45s ago' },
        { id: 3, amount: '10.0', price: '0.75', total: '7.5', time: '2m ago' },
    ];

    return (
        <div className="max-w-7xl mx-auto px-6 pb-20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                <h1 className="text-4xl font-black tracking-tighter">MARKETPLACE</h1>
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={16} />
                        <input
                            type="text"
                            placeholder="Search orders..."
                            className="bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-cyber-green/50 transition-all w-64"
                        />
                    </div>
                    <button className="p-2 rounded-xl bg-white/5 border border-white/10 text-white/40 hover:text-white transition-all">
                        <Filter size={20} />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Trading Section */}
                <div className="lg:col-span-8 space-y-8">
                    {/* Chart Placeholder */}
                    <div className="glass-card h-[400px] flex flex-col justify-end p-8 relative overflow-hidden group">
                        <div className="absolute top-8 left-8">
                            <div className="text-xs uppercase tracking-widest text-white/40 mb-1">Energy Price (XLM/kWh)</div>
                            <div className="text-4xl font-black flex items-center gap-3">
                                0.82
                                <span className="text-sm text-cyber-green bg-cyber-green/10 px-2 py-0.5 rounded border border-cyber-green/20">+4.2%</span>
                            </div>
                        </div>

                        <div className="flex items-end justify-between h-40 gap-2">
                            {[40, 70, 45, 90, 65, 80, 50, 60, 85, 45, 55, 75].map((h, i) => (
                                <div
                                    key={i}
                                    className="flex-1 bg-gradient-to-t from-cyber-green/20 to-cyber-green/60 rounded-t-sm transition-all duration-500 group-hover:opacity-80"
                                    style={{ height: `${h}%` }}
                                />
                            ))}
                        </div>

                        <div className="absolute inset-0 bg-gradient-to-t from-cyber-dark via-transparent to-transparent pointer-events-none" />
                    </div>

                    {/* Order Creation */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="glass-card border border-cyber-green/20">
                            <h3 className="font-bold mb-6 flex items-center gap-2">
                                <ArrowDownLeft className="text-cyber-green" /> SELL ENERGY
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] uppercase tracking-widest text-white/40 block mb-2">Amount (kWh)</label>
                                    <input type="number" placeholder="0.00" className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-cyber-green" />
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase tracking-widest text-white/40 block mb-2">Price per kWh (XLM)</label>
                                    <input type="number" placeholder="0.00" className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-cyber-green" />
                                </div>
                                <button className="cyber-button w-full mt-4">PLACE SELL ORDER</button>
                            </div>
                        </div>

                        <div className="glass-card border border-cyber-stellar/20 opacity-50 cursor-not-allowed">
                            <h3 className="font-bold mb-6 flex items-center gap-2">
                                <ArrowUpRight className="text-cyber-stellar" /> BUY ENERGY
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] uppercase tracking-widest text-white/40 block mb-2">Amount (kWh)</label>
                                    <input disabled type="number" placeholder="0.00" className="w-full bg-white/5 border border-white/10 rounded-xl p-3" />
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase tracking-widest text-white/40 block mb-2">Max Price (XLM)</label>
                                    <input disabled type="number" placeholder="0.00" className="w-full bg-white/5 border border-white/10 rounded-xl p-3" />
                                </div>
                                <button disabled className="w-full mt-4 bg-white/5 text-white/20 py-3 rounded-full font-bold">LOCKED</button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Order Book Section */}
                <div className="lg:col-span-4 space-y-6">
                    <div className="glass-card">
                        <h3 className="font-bold text-xs uppercase tracking-widest text-white/40 mb-6 px-2">Order Book</h3>

                        <div className="space-y-6">
                            {/* Sell Side */}
                            <div>
                                <div className="grid grid-cols-3 text-[10px] uppercase text-white/20 mb-2 px-2">
                                    <span>Price</span>
                                    <span className="text-center">Amount</span>
                                    <span className="text-right">Total</span>
                                </div>
                                <div className="space-y-1">
                                    {sellOrders.map(order => (
                                        <div key={order.id} className="grid grid-cols-3 text-xs py-1 px-2 hover:bg-red-500/10 transition-colors rounded">
                                            <span className="text-red-400 font-bold">{order.price}</span>
                                            <span className="text-center text-white/70">{order.amount}</span>
                                            <span className="text-right text-white/40">{order.total}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="h-px bg-white/10 mx-2" />

                            {/* Buy Side */}
                            <div>
                                <div className="space-y-1">
                                    {buyOrders.map(order => (
                                        <div key={order.id} className="grid grid-cols-3 text-xs py-1 px-2 hover:bg-cyber-green/10 transition-colors rounded">
                                            <span className="text-cyber-green font-bold">{order.price}</span>
                                            <span className="text-center text-white/70">{order.amount}</span>
                                            <span className="text-right text-white/40">{order.total}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="glass-card">
                        <h3 className="font-bold text-xs uppercase tracking-widest text-white/40 mb-6 flex items-center gap-2">
                            <Zap size={14} className="text-cyber-green" /> Market Trades
                        </h3>
                        <div className="space-y-4">
                            {[1, 2, 4].map(i => (
                                <div key={i} className="flex items-center justify-between text-xs animate-pulse-slow">
                                    <span className="text-cyber-green">0.82 XLM</span>
                                    <span className="text-white/60">12.5 kWh</span>
                                    <span className="text-white/20">14:24:03</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
