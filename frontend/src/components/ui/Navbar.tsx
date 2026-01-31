"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, ShoppingCart, Globe, BarChart3, Info, User, Wallet, Menu, X, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useStore } from '@/store/useStore';
import { authApi } from '@/lib/api';
import { getPublicKey, signTransaction } from '@stellar/freighter-api';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Marketplace', path: '/marketplace', icon: ShoppingCart },
    { name: 'Network', path: '/network', icon: Globe },
    { name: 'Analytics', path: '/analytics', icon: BarChart3 },
    { name: 'About', path: '/about', icon: Info },
];

export default function Navbar() {
    const pathname = usePathname();
    const [scrolled, setScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const { user, setUser } = useStore();

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', handleScroll);
        handleScroll(); // Set initial state
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const toggleMobileMenu = () => setMobileMenuOpen(!mobileMenuOpen);

    const handleConnectWallet = async () => {
        try {
            const publicKey = await getPublicKey();
            const { signature } = await signTransaction(
                'sign this message to login',
                'TESTNET'
            );
            const { data } = await authApi.login(publicKey, signature);
            localStorage.setItem('access_token', data.access_token);
            localStorage.setItem('refresh_token', data.refresh_token);
            setUser(data.user);
        } catch (error) {
            console.error("Failed to connect wallet:", error);
        }
    };
    
    const handleLogout = () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        setUser(null);
    };

    return (
        <>
            <nav className={cn(
                "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
                scrolled || mobileMenuOpen ? "bg-neutral-900/80 backdrop-blur-md border-b border-neutral-700/50" : "bg-transparent"
            )}>
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-20">
                        <Link href="/" className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-primary-DEFAULT rounded-lg flex items-center justify-center">
                                <span className="text-primary-foreground font-black text-2xl">LT</span>
                            </div>
                            <span className="text-xl font-bold tracking-tight text-neutral-100 hidden sm:block">Los Tecnicos</span>
                        </Link>

                        <div className="hidden md:flex items-center space-x-2">
                            {navItems.map((item) => (
                                <Link
                                    key={item.path}
                                    href={item.path}
                                    className={cn(
                                        "flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
                                        pathname === item.path 
                                            ? "bg-primary-DEFAULT/10 text-primary-DEFAULT" 
                                            : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
                                    )}
                                >
                                    <item.icon size={18} />
                                    <span>{item.name}</span>
                                </Link>
                            ))}
                        </div>

                        <div className="flex items-center space-x-4">
                            <div className='hidden md:flex'>
                                {user ? (
                                    <div className="flex items-center space-x-4">
                                        <div className="bg-green-500/20 text-green-400 border border-green-500/50 px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2">
                                            <Wallet size={18} />
                                            <span>{`${user.wallet_address.slice(0, 4)}...${user.wallet_address.slice(-4)}`}</span>
                                        </div>
                                        <button onClick={handleLogout} className="text-neutral-400 hover:text-neutral-100">
                                            <LogOut size={20} />
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={handleConnectWallet}
                                        className="bg-primary-DEFAULT text-primary-foreground hover:bg-primary-DEFAULT/90 flex items-center space-x-2 px-4 py-2 rounded-full text-sm font-bold transition-colors duration-300"
                                    >
                                        <Wallet size={18} />
                                        <span>Connect Wallet</span>
                                    </button>
                                )}
                            </div>

                            <button className="md:hidden p-2 rounded-md text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800" onClick={toggleMobileMenu}>
                                {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                            </button>
                        </div>
                    </div>
                </div>
            </nav>
            
            {/* Mobile Menu */}
            <AnimatePresence>
                {mobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="fixed top-20 left-0 right-0 z-40 bg-neutral-900/95 backdrop-blur-md border-b border-neutral-700/50 md:hidden"
                    >
                        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-2">
                            {navItems.map((item) => (
                                <Link
                                    key={item.path}
                                    href={item.path}
                                    onClick={() => setMobileMenuOpen(false)}
                                    className={cn(
                                        "flex items-center space-x-3 px-4 py-3 rounded-md text-base font-medium transition-colors",
                                        pathname === item.path
                                            ? "bg-primary-DEFAULT/10 text-primary-DEFAULT"
                                            : "text-neutral-300 hover:bg-neutral-800 hover:text-neutral-100"
                                    )}
                                >
                                    <item.icon size={22} />
                                    <span>{item.name}</span>
                                </Link>
                            ))}
                            <div className="border-t border-neutral-700/50 pt-4">
                               {user ? (
                                    <div className="flex items-center justify-between">
                                        <div className="bg-green-500/20 text-green-400 border border-green-500/50 px-4 py-3 rounded-lg text-base font-bold flex items-center gap-2">
                                            <Wallet size={20} />
                                            <span>{`${user.wallet_address.slice(0, 4)}...${user.wallet_address.slice(-4)}`}</span>
                                        </div>
                                         <button onClick={() => { handleLogout(); setMobileMenuOpen(false); }} className="text-neutral-400 hover:text-neutral-100 p-3">
                                            <LogOut size={24} />
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => {
                                            handleConnectWallet();
                                            setMobileMenuOpen(false);
                                        }}
                                        className="w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-md text-base font-bold transition-colors duration-300 bg-primary-DEFAULT text-primary-foreground hover:bg-primary-DEFAULT/90"
                                    >
                                        <Wallet size={20} />
                                        <span>Connect Wallet</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}

