"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Network, ShieldCheck, Coins, Users } from 'lucide-react';
import Link from 'next/link';

export default function Onboarding() {
    return (
        <div className="min-h-screen bg-neutral-900 text-neutral-100 pt-24 sm:pt-28 pb-12">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="max-w-4xl mx-auto">
                    <header className="text-center mb-16">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="inline-block mb-4 px-4 py-1.5 rounded-full bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/30 text-purple-300 font-mono text-sm"
                        >
                            JOIN THE REVOLUTION
                        </motion.div>
                        <motion.h1
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="text-4xl sm:text-6xl font-black tracking-tighter mb-6"
                        >
                            Become an <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-blue-500">OG Node</span>
                        </motion.h1>
                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="text-xl text-neutral-400 max-w-2xl mx-auto"
                        >
                            Join the Los Tecnicos early adopter program. Build the network, earn governance rights, and shape the future of decentralized energy.
                        </motion.p>
                    </header>

                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16"
                    >
                        <BenefitCard
                            icon={Network}
                            title="Expand the Grid"
                            desc="Deploy local network nodes to extend coverage in underserved areas. Be the backbone of the community."
                        />
                        <BenefitCard
                            icon={Coins}
                            title="Earn Rewards"
                            desc="Get incentivized for every packet routed and every kilowatt traded through your infrastructure."
                        />
                        <BenefitCard
                            icon={ShieldCheck}
                            title="Governance Rights"
                            desc="OGs get 3x voting power in the DAO. Have a real say in protocol upgrades and treasury allocation."
                        />
                        <BenefitCard
                            icon={Users}
                            title="Community Access"
                            desc="Exclusive access to the core developer discord channels and early beta hardware."
                        />
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.4 }}
                        className="bg-gradient-to-b from-neutral-800 to-neutral-900 border border-neutral-700/50 rounded-3xl p-8 sm:p-12 text-center"
                    >
                        <h2 className="text-2xl font-bold mb-4">Ready to start?</h2>
                        <p className="text-neutral-400 mb-8 max-w-lg mx-auto">
                            The program is currently invite-only for the beta phase. Connect your wallet to check eligibility or apply for the waitlist.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <Link href="/dashboard">
                                <button className="bg-white text-black hover:bg-neutral-200 font-bold px-8 py-3 rounded-full transition-colors w-full sm:w-auto">
                                    Check Eligibility
                                </button>
                            </Link>
                            <a href="#" className="border border-neutral-700 hover:bg-neutral-800 text-neutral-300 font-bold px-8 py-3 rounded-full transition-all w-full sm:w-auto">
                                Read Whitepaper
                            </a>
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    );
}

const BenefitCard = ({ icon: Icon, title, desc }: { icon: any, title: string, desc: string }) => (
    <div className="bg-neutral-800/50 p-6 rounded-2xl border border-neutral-700/50 hover:bg-neutral-800 transition-colors">
        <Icon size={32} className="text-purple-400 mb-4" />
        <h3 className="text-lg font-bold text-neutral-100 mb-2">{title}</h3>
        <p className="text-neutral-400 text-sm leading-relaxed">{desc}</p>
    </div>
);
