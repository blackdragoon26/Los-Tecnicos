"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    Sun,
    Cloud,
    CloudRain,
    Zap,
    Battery,
    Clock,
    MapPin,
    Activity,
    Calculator
} from 'lucide-react';
import Link from 'next/link';

export default function FormulaPlayground() {
    // Interactive State
    const [sunlight, setSunlight] = useState(50); // 0-100
    const [weather, setWeather] = useState('sunny'); // sunny, cloudy, rainy
    const [gridLoad, setGridLoad] = useState(50); // 0-100 (Demand)
    const [batteryLevel, setBatteryLevel] = useState(50); // 0-100 (SoC)
    const [distance, setDistance] = useState(1); // 1-10 km
    const [timeOfDay, setTimeOfDay] = useState(12); // 0-23 hours
    const [reliability, setReliability] = useState(100); // 0-100 Quality

    // Calculation Logic (Client-Side Mirror of Backend)
    const [calculatedPrice, setCalculatedPrice] = useState(0);
    const [breakdown, setBreakdown] = useState<any>({});

    const BASE_PRICE = 5.0;

    useEffect(() => {
        calculatePrice();
    }, [sunlight, weather, gridLoad, batteryLevel, distance, timeOfDay, reliability]);

    const calculatePrice = () => {
        // 1. Supply/Demand Factor
        // Sunlight affects supply. Weather affects supply. GridLoad is demand.
        // Mock logic: Supply = Sunlight * WeatherModifier
        let weatherMod = 1.0;
        if (weather === 'cloudy') weatherMod = 0.6;
        if (weather === 'rainy') weatherMod = 0.3;

        const supply = (sunlight * weatherMod) || 1; // Avoid 0
        const demand = gridLoad || 1;

        // F_sd = 1 + 0.2 * ln(Demand/Supply)
        const ratio = demand / supply;
        const f_sd = 1.0 + 0.2 * Math.log(ratio);

        // 2. SoC Factor (Scarcity)
        // F_soc = 1 + 0.5 * (1 - SoC)^2
        const socDec = batteryLevel / 100;
        const deficit = 1.0 - socDec;
        const f_soc = 1.0 + 0.5 * (deficit * deficit);

        // 3. Distance Factor
        // F_dist = 1 + 0.2 * dist
        const f_dist = 1.0 + 0.1 * distance; // Reduced coeff for demo

        // 4. Time Factor
        let f_time = 1.0;
        if (timeOfDay >= 18 && timeOfDay < 22) f_time = 1.3; // Evening Peak
        if (timeOfDay >= 6 && timeOfDay < 9) f_time = 1.15; // Morning Peak
        if (timeOfDay >= 2 && timeOfDay < 6) f_time = 0.85; // Night Trough

        // 5. Quality Factor
        // F_quality = 1 + 0.1 * Q_score (Reliability 0-1)
        const f_quality = 1.0 + 0.1 * (reliability / 100);

        // Total
        let totalMult = f_sd * f_soc * f_dist * f_time * f_quality;
        if (totalMult < 0.5) totalMult = 0.5;
        if (totalMult > 5.0) totalMult = 5.0;

        setCalculatedPrice(BASE_PRICE * totalMult);
        setBreakdown({ f_sd, f_soc, f_dist, f_time, f_quality, totalMult });
    };

    return (
        <div className="min-h-screen bg-neutral-900 text-neutral-100 pt-24 pb-12">
            <div className="container mx-auto px-4">
                <header className="mb-12 text-center">
                    <h1 className="text-4xl font-extrabold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600">
                        Pricing Formula Playground
                    </h1>
                    <p className="text-neutral-400 max-w-2xl mx-auto">
                        Experiment with the variables that control the Los Tecnicos Dynamic Pricing Engine.
                        See how weather, demand, and grid health impact the final energy token price.
                    </p>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Controls Panel */}
                    <div className="lg:col-span-4 space-y-6">
                        <ControlCard title="Environment" icon={<Sun className="text-yellow-400" />}>
                            <div className="space-y-4">
                                <LabelSlider
                                    label="Sunlight Intensity"
                                    value={sunlight}
                                    setValue={setSunlight}
                                    unit="%"
                                />
                                <div>
                                    <label className="text-xs text-neutral-400 block mb-2">Weather Condition</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        <WeatherBaseBtn active={weather === 'sunny'} onClick={() => setWeather('sunny')} icon={<Sun size={16} />} label="Sunny" />
                                        <WeatherBaseBtn active={weather === 'cloudy'} onClick={() => setWeather('cloudy')} icon={<Cloud size={16} />} label="Cloudy" />
                                        <WeatherBaseBtn active={weather === 'rainy'} onClick={() => setWeather('rainy')} icon={<CloudRain size={16} />} label="Rainy" />
                                    </div>
                                </div>
                            </div>
                        </ControlCard>

                        <ControlCard title="Grid State" icon={<Zap className="text-blue-400" />}>
                            <div className="space-y-4">
                                <LabelSlider label="Grid Demand (Load)" value={gridLoad} setValue={setGridLoad} unit="%" color="accent" />
                                <LabelSlider label="Avg Battery Level (SoC)" value={batteryLevel} setValue={setBatteryLevel} unit="%" color="green" />
                            </div>
                        </ControlCard>

                        <ControlCard title="Transaction Details" icon={<Activity className="text-purple-400" />}>
                            <div className="space-y-4">
                                <LabelSlider label="Distance (km)" value={distance} setValue={setDistance} min={0} max={20} unit="km" />
                                <LabelSlider label="Time of Day (24h)" value={timeOfDay} setValue={setTimeOfDay} min={0} max={23} unit="h" />
                                <LabelSlider label="Donor Reliability" value={reliability} setValue={setReliability} unit="%" />
                            </div>
                        </ControlCard>
                    </div>

                    {/* Visualization Panel */}
                    <div className="lg:col-span-8 space-y-6">
                        {/* Result Card */}
                        <div className="bg-neutral-800 border border-neutral-700 rounded-3xl p-8 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-32 bg-primary-DEFAULT/10 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

                            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                                <div>
                                    <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                                        <Calculator className="text-primary-DEFAULT" />
                                        Calculated Token Price
                                    </h2>
                                    <p className="text-neutral-400 text-sm">Base Price: {BASE_PRICE.toFixed(2)} XLM</p>
                                </div>
                                <div className="text-right">
                                    <motion.div
                                        key={calculatedPrice}
                                        initial={{ scale: 0.8, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        className="text-6xl font-black text-white tracking-tighter"
                                    >
                                        {calculatedPrice.toFixed(4)}
                                    </motion.div>
                                    <p className="text-primary-DEFAULT font-bold text-xl">XLM / kWh</p>
                                </div>
                            </div>

                            {/* Factor Breakdown Bars */}
                            <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                                <FactorStat label="Supply/Demand" value={breakdown.f_sd} />
                                <FactorStat label="Scarcity (SoC)" value={breakdown.f_soc} />
                                <FactorStat label="Distance" value={breakdown.f_dist} />
                                <FactorStat label="Time of Day" value={breakdown.f_time} />
                                <FactorStat label="Quality" value={breakdown.f_quality} />
                            </div>
                        </div>

                        {/* Explanation */}
                        <div className="bg-neutral-800/50 border border-neutral-700/50 rounded-2xl p-6">
                            <h3 className="text-lg font-bold mb-4">How it works</h3>
                            <ul className="space-y-3 text-sm text-neutral-400">
                                <li className="flex gap-2">
                                    <span className="font-mono text-primary-DEFAULT font-bold">P_final = Base * (F_sd * F_soc * F_dist * F_time * F_quality)</span>
                                </li>
                                <li>• <strong>Supply/Demand:</strong> As sunlight drops or demand rises, price increases logarithmically.</li>
                                <li>• <strong>Scarcity:</strong> Quadratic penalty when batteries are near empty.</li>
                                <li>• <strong>Time:</strong> Peak hours (Morning/Evening) have multipliers up to 1.3x.</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

const ControlCard = ({ title, icon, children }: any) => (
    <div className="bg-neutral-800 border border-neutral-700 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4 text-neutral-200 font-bold">
            {icon}
            {title}
        </div>
        {children}
    </div>
);

const LabelSlider = ({ label, value, setValue, min = 0, max = 100, unit, color = "blue" }: any) => (
    <div>
        <div className="flex justify-between mb-2">
            <span className="text-xs text-neutral-400">{label}</span>
            <span className="text-xs font-mono text-neutral-200">{value}{unit}</span>
        </div>
        <input
            type="range"
            min={min}
            max={max}
            value={value}
            onChange={(e) => setValue(parseInt(e.target.value))}
            className="w-full h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-primary-DEFAULT"
        />
    </div>
);

const WeatherBaseBtn = ({ active, onClick, icon, label }: any) => (
    <button
        onClick={onClick}
        className={`flex flex-col items-center justify-center p-3 rounded-xl transition-all ${active ? 'bg-primary-DEFAULT text-white shadow-lg shadow-primary-DEFAULT/20' : 'bg-neutral-700/50 text-neutral-400 hover:bg-neutral-700'}`}
    >
        {icon}
        <span className="text-[10px] mt-1 font-bold">{label}</span>
    </button>
);

const FactorStat = ({ label, value }: any) => {
    // Determine color based on value ( > 1 is expensive/red, < 1 is cheap/green)
    const isHigh = value > 1.05;
    const isLow = value < 0.95;

    let colorClass = "text-neutral-300";
    if (isHigh) colorClass = "text-red-400";
    if (isLow) colorClass = "text-green-400";

    return (
        <div className="bg-neutral-900/50 rounded-xl p-3 text-center border border-neutral-700/50">
            <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">{label}</p>
            <p className={`text-xl font-mono font-bold ${colorClass}`}>
                {value?.toFixed(2)}x
            </p>
        </div>
    );
}
