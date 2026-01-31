"use client";

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
    ArrowUpRight,
    ArrowDownLeft,
    Search,
    Wallet
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import { marketApi } from '@/lib/api';
import Link from 'next/link';

export default function Marketplace() {
    const { user, orders, setOrders, isLoading, setLoading } = useStore();
    const [amount, setAmount] = useState('');
    const [price, setPrice] = useState('');
    const isAuthenticated = !!user;

    useEffect(() => {
        if (isAuthenticated) {
            const fetchOrders = async () => {
                setLoading(true);
                try {
                    const { data } = await marketApi.getOrders();
                    setOrders(data);
                } catch (error) {
                    console.error("Failed to fetch orders:", error);
                } finally {
                    setLoading(false);
                }
            };
            fetchOrders();
        }
    }, [isAuthenticated, setOrders, setLoading]);

    const handleCreateOrder = async (type: 'buy' | 'sell') => {
        try {
            await marketApi.createOrder({
                type,
                kwh_amount: parseFloat(amount),
                token_price: parseFloat(price)
            });
            // Refresh orders
            const { data } = await marketApi.getOrders();
            setOrders(data);
            setAmount('');
            setPrice('');
        } catch (error) {
            console.error("Failed to create order:", error);
        }
    };

    const sellOrders = orders.filter(o => o.type === 'sell').slice(0, 10);
    const buyOrders = orders.filter(o => o.type === 'buy').slice(0, 10);

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-neutral-900 text-neutral-100 pt-24 sm:pt-28 flex items-center justify-center">
                <div className="text-center">
                    <h2 className="text-2xl font-bold mb-4">Please connect your wallet</h2>
                    <p className="text-neutral-400 mb-8">You need to be authenticated to access the marketplace.</p>
                    <Link href="/dashboard">
                        <button className="bg-primary-DEFAULT text-primary-foreground hover:bg-primary-DEFAULT/90 font-bold px-8 py-4 rounded-full transition-all duration-300 w-full flex items-center justify-center gap-2 group">
                            <Wallet size={20} />
                            Connect Wallet
                        </button>
                    </Link>
                </div>
            </div>
        );
    }
    
    return (
        <div className="min-h-screen text-neutral-100 pt-24 sm:pt-28">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                    <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-neutral-100">Marketplace</h1>
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" size={20} />
                        <input
                            type="text"
                            placeholder="Search orders..."
                            className="bg-neutral-800 border border-neutral-700 rounded-full py-3 pl-12 pr-6 text-sm w-full md:w-80 focus:outline-none focus:border-primary-DEFAULT focus:ring-1 focus:ring-primary-DEFAULT transition-all"
                        />
                    </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Trading Section */}
                    <div className="lg:col-span-8 space-y-8">
                        {/* Chart Placeholder */}
                        <div className="bg-neutral-800 border border-neutral-700/50 rounded-2xl p-6 h-[400px] flex flex-col justify-between">
                            <div>
                                <p className="text-sm text-neutral-400">Energy Price (XLM/kWh)</p>
                                <div className="flex items-baseline gap-3">
                                    <p className="text-4xl font-bold">{orders.length > 0 ? orders[0].token_price : '0.82'}</p>
                                    <p className="text-green-400 font-semibold">+4.2%</p>
                                </div>
                            </div>
                            <div className="h-48 w-full bg-neutral-700/50 rounded-lg flex items-center justify-center">
                                <p className="text-neutral-500">Chart coming soon...</p>
                            </div>
                        </div>

                        {/* Order Creation */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <OrderForm type="sell" amount={amount} setAmount={setAmount} price={price} setPrice={setPrice} handleCreateOrder={handleCreateOrder} />
                            <OrderForm type="buy" amount={amount} setAmount={setAmount} price={price} setPrice={setPrice} handleCreateOrder={handleCreateOrder} />
                        </div>
                    </div>

                    {/* Order Book Section */}
                    <div className="lg:col-span-4">
                        <div className="bg-neutral-800 border border-neutral-700/50 rounded-2xl p-6">
                            <h2 className="text-xl font-bold mb-6">Order Book</h2>
                            <OrderBook title="Sell Orders" orders={sellOrders} color="text-red-400" />
                            <div className="my-6 border-t border-neutral-700" />
                            <OrderBook title="Buy Orders" orders={buyOrders} color="text-green-400" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

const OrderForm = ({ type, amount, setAmount, price, setPrice, handleCreateOrder }) => {
    const isSell = type === 'sell';
    return (
        <div className="bg-neutral-800 border border-neutral-700/50 rounded-2xl p-6">
            <h3 className={`font-bold mb-6 flex items-center gap-2 text-lg ${isSell ? 'text-red-400' : 'text-green-400'}`}>
                {isSell ? <ArrowUpRight size={20} /> : <ArrowDownLeft size={20} />}
                {isSell ? 'Sell Energy' : 'Buy Energy'}
            </h3>
            <div className="space-y-4">
                <FormInput id={`amount-${type}`} label="Amount (kWh)" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
                <FormInput id={`price-${type}`} label={isSell ? "Price per kWh (XLM)" : "Max Price (XLM)"} value={price} onChange={e => setPrice(e.target.value)} placeholder="0.00" />
                <button
                    onClick={() => handleCreateOrder(type)}
                    className={`w-full mt-4 font-bold py-3 px-4 rounded-lg transition-colors ${isSell ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`}
                >
                    Place {isSell ? 'Sell' : 'Buy'} Order
                </button>
            </div>
        </div>
    );
};

const FormInput = ({ id, label, ...props }) => (
    <div>
        <label htmlFor={id} className="text-sm text-neutral-400 block mb-2">{label}</label>
        <input
            id={id}
            type="number"
            {...props}
            className="w-full bg-neutral-700/50 border border-neutral-600 rounded-lg p-3 focus:outline-none focus:border-primary-DEFAULT focus:ring-1 focus:ring-primary-DEFAULT transition-colors"
        />
    </div>
);

const OrderBook = ({ title, orders, color }) => (
    <div>
        <h3 className="text-md font-semibold text-neutral-300 mb-3">{title}</h3>
        <div className="grid grid-cols-3 text-xs text-neutral-500 mb-2 px-2">
            <span>Price (XLM)</span>
            <span className="text-center">Amount (kWh)</span>
            <span className="text-right">Total (XLM)</span>
        </div>
        <div className="space-y-1">
            {orders.map(order => (
                <div key={order.id} className="grid grid-cols-3 text-sm py-1 px-2 hover:bg-neutral-700/50 transition-colors rounded">
                    <span className={`${color} font-mono`}>{order.token_price.toFixed(4)}</span>
                    <span className="text-center text-neutral-300 font-mono">{order.kwh_amount.toFixed(2)}</span>
                    <span className="text-right text-neutral-400 font-mono">{(order.kwh_amount * order.token_price).toFixed(2)}</span>
                </div>
            ))}
        </div>
    </div>
);

