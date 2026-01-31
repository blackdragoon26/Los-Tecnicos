"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, ShoppingCart, Globe, BarChart3, User, Wallet } from 'lucide-react';
import { motion } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Marketplace', path: '/marketplace', icon: ShoppingCart },
    { name: 'Network', path: '/network', icon: Globe },
    { name: 'Analytics', path: '/analytics', icon: BarChart3 },
];

export default function Navbar() {
    const pathname = usePathname();
    const [scrolled, setScrolled] = useState(false);
    const [walletConnected, setWalletConnected] = useState(false);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <nav className={cn(
            "fixed top-0 left-0 right-0 z-50 transition-all duration-300 px-6 py-4",
            scrolled ? "bg-cyber-dark/80 backdrop-blur-md border-b border-white/10" : "bg-transparent"
        )}>
            <div className="max-w-7xl mx-auto flex items-center justify-between">
                <Link href="/" className="flex items-center space-x-2">
                    <div className="w-10 h-10 bg-gradient-to-br from-cyber-green to-cyber-stellar rounded-lg flex items-center justify-center shadow-neon">
                        <span className="text-cyber-dark font-black text-xl">E</span>
                    </div>
                    <span className="text-xl font-bold tracking-tighter neon-text hidden sm:block">ENERGYGRID</span>
                </Link>

                <div className="hidden md:flex items-center space-x-8">
                    {navItems.map((item) => (
                        <Link
                            key={item.path}
                            href={item.path}
                            className={cn(
                                "flex items-center space-x-2 text-sm font-medium transition-colors hover:text-cyber-green",
                                pathname === item.path ? "text-cyber-green" : "text-white/70"
                            )}
                        >
                            <item.icon size={18} />
                            <span>{item.name}</span>
                        </Link>
                    ))}
                </div>

                <div className="flex items-center space-x-4">
                    <button
                        onClick={() => setWalletConnected(!walletConnected)}
                        className={cn(
                            "flex items-center space-x-2 px-4 py-2 rounded-full text-sm font-bold transition-all duration-300",
                            walletConnected
                                ? "bg-cyber-green/20 text-cyber-green border border-cyber-green/50"
                                : "bg-white/10 text-white hover:bg-white/20 border border-white/20"
                        )}
                    >
                        <Wallet size={18} />
                        <span>{walletConnected ? 'GBC...4X2' : 'Connect Wallet'}</span>
                    </button>

                    <Link href="/profile" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all">
                        <User size={20} className="text-white" />
                    </Link>
                </div>
            </div>
        </nav>
    );
}
