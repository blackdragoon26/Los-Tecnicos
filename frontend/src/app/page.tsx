"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Zap, ShieldCheck, Cpu, Globe, BarChart3 } from 'lucide-react';
import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="bg-neutral-900 text-neutral-100">
      <main className="min-h-screen">
        {/* Hero Section */}
        <section className="relative text-center py-24 sm:py-32 lg:py-48">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <Link href="https://soroban.stellar.org" target="_blank" rel="noopener noreferrer" className="inline-block px-4 py-1.5 rounded-full bg-primary-DEFAULT/10 text-primary-DEFAULT text-sm font-bold border border-primary-DEFAULT/20 mb-6 uppercase tracking-widest hover:bg-primary-DEFAULT/20 transition-colors">
                Powered by Stellar Soroban
              </Link>
              <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight mb-6 leading-tight">
                Decentralized Energy<br />
                <span className="text-primary-DEFAULT">For a Brighter Future</span>
              </h1>
              <p className="max-w-2xl mx-auto text-lg sm:text-xl text-neutral-400 mb-12">
                Tokenize your excess solar power and trade it directly within your community. Our platform creates a resilient, peer-to-peer energy market powered by IoT and blockchain.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/dashboard" className="w-full sm:w-auto">
                  <button className="bg-primary-DEFAULT text-primary-foreground hover:bg-primary-DEFAULT/90 font-bold px-8 py-4 rounded-full transition-all duration-300 w-full flex items-center justify-center gap-2 group">
                    Get Started
                    <ArrowRight className="inline-block group-hover:translate-x-1 transition-transform" size={20} />
                  </button>
                </Link>
                <Link href="/marketplace" className="w-full sm:w-auto">
                  <button className="bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 font-bold px-8 py-4 rounded-full transition-colors duration-300 w-full">
                    View Marketplace
                  </button>
                </Link>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="py-24 bg-neutral-800/50">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
              {[
                { icon: Zap, label: 'Energy Traded', value: '1.2 MWh' },
                { icon: BarChart3, label: 'XLM Distributed', value: '45.2k' },
                { icon: Globe, label: 'Active Nodes', value: '2,401' },
              ].map((stat, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                  viewport={{ once: true }}
                >
                  <div className="flex justify-center items-center mb-4">
                    <stat.icon size={32} className="text-secondary-DEFAULT" />
                  </div>
                  <p className="text-sm text-neutral-400 uppercase tracking-wider mb-1">{stat.label}</p>
                  <p className="text-4xl font-bold text-neutral-100">{stat.value}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="py-24 sm:py-32">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16 sm:mb-20">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight">Our Core Technology</h2>
              <p className="mt-4 max-w-2xl mx-auto text-lg text-neutral-400">
                Bridging the gap between hardware and a decentralized future.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { icon: Cpu, title: 'ESP32 Integration', description: 'Real-time battery monitoring and energy verification at the source.' },
                { icon: Globe, title: 'Mesh Network', description: 'Raspberry Pi nodes creating a resilient P2P data mesh for the community.' },
                { icon: ShieldCheck, title: 'Soroban Smart Contracts', description: 'Trustless matching and settlement using secure, on-chain escrow.' },
              ].map((feature) => (
                <div key={feature.title} className="bg-neutral-800 p-8 rounded-2xl border border-neutral-700/50 transform transition-transform duration-300 hover:scale-105 hover:border-primary-DEFAULT/50">
                  <div className="flex items-center justify-center h-12 w-12 rounded-full bg-primary-DEFAULT/10 mb-6">
                    <feature.icon className="h-6 w-6 text-primary-DEFAULT" />
                  </div>
                  <h3 className="text-xl font-bold mb-4">{feature.title}</h3>
                  <p className="text-neutral-400">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

