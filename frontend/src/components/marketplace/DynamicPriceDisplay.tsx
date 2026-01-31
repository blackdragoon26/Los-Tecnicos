"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Info } from 'lucide-react';

interface DynamicPriceDisplayProps {
    breakdown: {
        base_price: number;
        final_price: number;
        f_sd: number;
        f_soc: number;
        f_dist: number;
        f_time: number;
        f_quality: number;
    } | null;
    timestamp?: string; // Add timestamp prop
}

export default function DynamicPriceDisplay({ breakdown, timestamp }: DynamicPriceDisplayProps) {
    if (!breakdown) return null;

    const factors = [
        { key: 'f_sd', label: 'Market Demand', value: breakdown.f_sd, desc: "Higher demand increases price." },
        { key: 'f_soc', label: 'Grid Scarcity', value: breakdown.f_soc, desc: "Low total battery levels increase price." },
        { key: 'f_dist', label: 'Distance', value: breakdown.f_dist, desc: "Transmission simulation fee." },
        { key: 'f_time', label: 'Time of Day', value: breakdown.f_time, desc: "Peak hours (6-10 PM) have multipliers." },
        { key: 'f_quality', label: 'Donor Quality', value: breakdown.f_quality, desc: "Premium for reliable donors." },
    ];

    const percentageChange = ((breakdown.final_price - breakdown.base_price) / breakdown.base_price) * 100;

    return (
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 shadow-2xl">
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h3 className="text-neutral-400 text-sm font-medium uppercase tracking-wider">Real-Time Price Breakdown</h3>
                    <div className="flex items-baseline gap-3 mt-1">
                        <span className="text-3xl font-black text-white">{breakdown.final_price?.toFixed(4)} <span className="text-sm text-neutral-500 font-normal">XLM/kWh</span></span>
                        <span className={`text-sm font-bold px-2 py-0.5 rounded ${percentageChange >= 0 ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                            {percentageChange > 0 ? '+' : ''}{percentageChange.toFixed(1)}% vs Base
                        </span>
                    </div>
                </div>
                {timestamp && (
                    <div className="text-right">
                        <p className="text-xs text-neutral-500">Last Updated</p>
                        <p className="text-sm font-mono text-neutral-400">{new Date(timestamp).toLocaleTimeString()}</p>
                    </div>
                )}
            </div>

            <div className="space-y-4">
                <div className="flex justify-between text-sm text-neutral-500 mb-2">
                    <span>Base Price</span>
                    <span className="font-mono text-neutral-300">{breakdown.base_price?.toFixed(4)} XLM</span>
                </div>

                {factors.map((factor) => {
                    // Normalize for visual bar: 1.0 is neutral. 
                    // < 1.0 is discount (Green), > 1.0 is premium (Red/Orange)
                    const isPremium = factor.value > 1.0;
                    const deviation = Math.abs(factor.value - 1.0) * 100; // Percentage deviation
                    const barWidth = Math.min(deviation * 2, 100); // Scale up for visibility, max 100%

                    return (
                        <div key={factor.key} className="group relative">
                            <div className="flex justify-between items-center text-sm mb-1">
                                <span className="flex items-center gap-1.5 text-neutral-300 cursor-help">
                                    {factor.label}
                                    <Info size={12} className="text-neutral-600 group-hover:text-primary-DEFAULT transition-colors" />
                                </span>
                                <span className={`font-mono text-xs ${isPremium ? 'text-orange-400' : 'text-green-400'}`}>
                                    {factor.value.toFixed(2)}x
                                </span>
                            </div>

                            {/* Bar Background */}
                            <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden flex items-center relative">
                                {/* Center Marker */}
                                <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-neutral-700 z-10" />

                                {/* Value Bar */}
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${barWidth}%` }}
                                    className={`h-full rounded-full ${isPremium ? 'bg-orange-500 ml-auto mr-1/2 origin-right' : 'bg-green-500 mr-auto ml-1/2 origin-left'}`}
                                    style={{
                                        width: `${barWidth / 2}%`, // Visual hack: we split from center? 
                                        // Actually easier: lets just fill from left but color code?
                                        // Creating a "Deviation from 1.0" visualization is tricky with simple bars.
                                        // Let's stick to "Impact" bar.
                                    }}
                                />
                                {/* Simpler Bar: Fill from 0 to 2.0 scale? */}
                                <div className="absolute inset-0 w-full h-full bg-neutral-800">
                                    <motion.div
                                        initial={{ width: "50%" }}
                                        animate={{ width: `${(factor.value / 2.5) * 100}%` }} // Scale roughly 0 to 2.5x
                                        className={`h-full ${isPremium ? 'bg-gradient-to-r from-neutral-700 to-orange-500' : 'bg-gradient-to-r from-neutral-700 to-green-500'}`}
                                    />
                                </div>
                            </div>

                            {/* Tooltip */}
                            <div className="absolute left-0 -top-8 bg-neutral-800 text-xs text-neutral-200 px-2 py-1 rounded border border-neutral-700 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 whitespace-nowrap">
                                {factor.desc}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
