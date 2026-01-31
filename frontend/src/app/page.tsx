"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Power, ArrowRight, Shield, Zap, TrendingUp, Globe } from 'lucide-react';
import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="flex flex-col items-center justify-center px-6">
      {/* Hero Section */}
      <section className="max-w-7xl mx-auto py-20 lg:py-40 text-center relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="relative z-10"
        >
          <span className="inline-block px-4 py-1.5 rounded-full bg-cyber-green/10 text-cyber-green text-sm font-bold border border-cyber-green/20 mb-6 uppercase tracking-widest">
            Powered by Stellar Soroban
          </span>
          <h1 className="text-5xl lg:text-8xl font-black tracking-tighter mb-8 bg-gradient-to-b from-white to-white/40 bg-clip-text text-transparent leading-none">
            THE FUTURE OF <br />
            <span className="neon-text text-cyber-green">P2P ENERGY</span> IS HERE
          </h1>
          <p className="text-lg lg:text-xl text-white/60 max-w-2xl mx-auto mb-12 leading-relaxed">
            Tokenize your excess solar power and trade directly with your community.
            A decentralized grid powered by IoT mesh networks and transparency.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/dashboard" className="cyber-button group w-full sm:w-auto">
              <span>GET STARTED</span>
              <ArrowRight className="inline-block ml-2 group-hover:translate-x-1 transition-transform" size={20} />
            </Link>
            <button className="px-8 py-3 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 transition-all font-bold w-full sm:w-auto">
              VIEW MARKET
            </button>
          </div>
        </motion.div>

        {/* Floating Accents */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full -z-10 blur-[120px] opacity-20 bg-cyber-green/20 rounded-full" />
      </section>

      {/* Stats Section */}
      <section className="w-full max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 pb-32">
        {[
          { icon: Power, label: 'Energy Traded', value: '1.2 MWh', color: 'text-cyber-green' },
          { icon: TrendingUp, label: 'XLM Distributed', value: '45.2k', color: 'text-cyber-stellar' },
          { icon: Zap, label: 'Active Nodes', value: '2,401', color: 'text-cyber-green' },
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            viewport={{ once: true }}
            className="glass-card flex flex-col items-center text-center group"
          >
            <div className={`p-4 rounded-2xl bg-white/5 mb-4 group-hover:scale-110 transition-transform ${stat.color}`}>
              <stat.icon size={32} />
            </div>
            <span className="text-white/40 text-sm font-medium uppercase tracking-widest mb-1">{stat.label}</span>
            <span className="text-4xl font-black">{stat.value}</span>
          </motion.div>
        ))}
      </section>

      {/* Features Grid */}
      <section className="w-full max-w-7xl mx-auto pb-40">
        <div className="text-center mb-20">
          <h2 className="text-3xl lg:text-5xl font-bold mb-4">Core Technology</h2>
          <p className="text-white/50">Bridging the gap between hardware and blockchain.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-card border border-cyber-green/20">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Zap className="text-cyber-green" /> ESP32 Integration
            </h3>
            <p className="text-white/60">Real-time battery monitoring and energy verification at the source.</p>
          </div>
          <div className="glass-card border border-cyber-stellar/20">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Globe className="text-cyber-stellar" /> Mesh Network
            </h3>
            <p className="text-white/60">Raspberry Pi nodes creating a resilient P2P data mesh for the community.</p>
          </div>
          <div className="glass-card border border-white/20">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Shield className="text-white" /> Soroban Escrow
            </h3>
            <p className="text-white/60">Trustless matching and settlement using secure smart contracts.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
