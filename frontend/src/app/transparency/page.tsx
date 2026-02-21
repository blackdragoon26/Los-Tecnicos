"use client";

import { useState, useEffect } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";

interface OverviewData {
    marketplace: { total_transactions: number; total_energy_traded: number; open_orders: number };
    tokens: { total_minted: number; total_burned: number; circulating_supply: number; ratio: string };
    defi: { total_value_locked: number; total_yield_paid: number; flash_loans_issued: number };
    carbon: { total_co2_saved_kg: number; equivalent_trees: number };
    depin: { registered_nodes: number };
    generated_at: string;
}

interface MintEvent {
    id: number; device_id: string; sender_uid: string; receiver_uid: string;
    kwh_transferred: number; tokens_minted: number; quality_factor: number;
    tx_hash: string; status: string; timestamp: string;
}

interface BurnEvent {
    id: number; order_id: string; tokens_burned: number; burn_reason: string;
    tx_hash: string; timestamp: string;
}

interface CarbonCredit {
    id: number; device_id: string; kwh_offset: number; co2_saved_kg: number;
    credit_value: number; timestamp: string;
}

export default function TransparencyPage() {
    const [overview, setOverview] = useState<OverviewData | null>(null);
    const [mints, setMints] = useState<MintEvent[]>([]);
    const [burns, setBurns] = useState<BurnEvent[]>([]);
    const [carbon, setCarbon] = useState<{ credits: CarbonCredit[]; total_co2_saved_kg: number; equivalent_trees: number }>({ credits: [], total_co2_saved_kg: 0, equivalent_trees: 0 });
    const [defiStats, setDefiStats] = useState<any>(null);
    const [depinStats, setDepinStats] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<"overview" | "mints" | "burns" | "carbon" | "defi" | "depin">("overview");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAll();
        const interval = setInterval(fetchAll, 10000);
        return () => clearInterval(interval);
    }, []);

    async function fetchAll() {
        try {
            const [ov, mi, bu, ca, df, dp] = await Promise.all([
                fetch(`${API}/api/v1/ledger/overview`).then(r => r.json()).catch(() => null),
                fetch(`${API}/api/v1/ledger/mints`).then(r => r.json()).catch(() => ({ mints: [] })),
                fetch(`${API}/api/v1/ledger/burns`).then(r => r.json()).catch(() => ({ burns: [] })),
                fetch(`${API}/api/v1/ledger/carbon`).then(r => r.json()).catch(() => ({ credits: [], total_co2_saved_kg: 0, equivalent_trees: 0 })),
                fetch(`${API}/api/v1/defi/pool/stats`).then(r => r.json()).catch(() => null),
                fetch(`${API}/api/v1/depin/stats`).then(r => r.json()).catch(() => null),
            ]);
            if (ov) setOverview(ov);
            setMints(mi.mints || []);
            setBurns(bu.burns || []);
            setCarbon(ca);
            setDefiStats(df);
            setDepinStats(dp);
        } catch (e) {
            console.error("Fetch error:", e);
        }
        setLoading(false);
    }

    const tabs = [
        { id: "overview", label: "📊 Overview", icon: "📊" },
        { id: "mints", label: "⚡ Mints", icon: "⚡" },
        { id: "burns", label: "🔥 Burns", icon: "🔥" },
        { id: "carbon", label: "🌱 Carbon", icon: "🌱" },
        { id: "defi", label: "🏦 DeFi", icon: "🏦" },
        { id: "depin", label: "🖥️ DePIN", icon: "🖥️" },
    ] as const;

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-xl text-gray-400 animate-pulse">Loading transparency data...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen p-6 max-w-7xl mx-auto">
            <h1 className="text-3xl font-bold mb-1">🔗 Transparency Ledger</h1>
            <p className="text-gray-400 mb-6">All energy trades, token events, and DeFi activity — fully auditable</p>

            {/* Tabs */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                {tabs.map(t => (
                    <button
                        key={t.id}
                        onClick={() => setActiveTab(t.id)}
                        className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all ${activeTab === t.id
                                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/30"
                                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                            }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {/* OVERVIEW TAB */}
            {activeTab === "overview" && overview && (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <StatCard label="Total Transactions" value={overview.marketplace.total_transactions} icon="🔄" />
                        <StatCard label="Energy Traded (kWh)" value={overview.marketplace.total_energy_traded.toFixed(4)} icon="⚡" />
                        <StatCard label="Open Orders" value={overview.marketplace.open_orders} icon="📋" />
                        <StatCard label="DePIN Nodes" value={overview.depin.registered_nodes} icon="🖥️" />
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <StatCard label="Tokens Minted" value={overview.tokens.total_minted.toFixed(0)} icon="⚡" color="green" />
                        <StatCard label="Tokens Burned" value={overview.tokens.total_burned.toFixed(0)} icon="🔥" color="red" />
                        <StatCard label="Circulating Supply" value={overview.tokens.circulating_supply.toFixed(0)} icon="💰" color="blue" />
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <StatCard label="TVL (Liquidity Pool)" value={`${overview.defi.total_value_locked.toFixed(0)} LT`} icon="🏦" color="purple" />
                        <StatCard label="Yield Distributed" value={`${overview.defi.total_yield_paid.toFixed(4)} XLM`} icon="📈" color="green" />
                        <StatCard label="Flash Loans Issued" value={overview.defi.flash_loans_issued} icon="⚡" color="yellow" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <StatCard label="CO₂ Saved" value={`${overview.carbon.total_co2_saved_kg.toFixed(3)} kg`} icon="🌱" color="green" />
                        <StatCard label="Equivalent Trees" value={overview.carbon.equivalent_trees.toFixed(1)} icon="🌳" color="green" />
                    </div>

                    <div className="text-xs text-gray-500 text-right">
                        Last updated: {new Date(overview.generated_at).toLocaleTimeString()} · Auto-refreshes every 10s
                    </div>
                </div>
            )}

            {/* MINTS TAB */}
            {activeTab === "mints" && (
                <div className="space-y-4">
                    <h2 className="text-xl font-semibold">⚡ Token Minting Events</h2>
                    <p className="text-sm text-gray-400">Each entry = real energy donated by a node → LT tokens minted on Stellar</p>
                    {mints.length === 0 ? (
                        <EmptyState message="No minting events yet. Deploy the Pi and transfer energy to generate mints." />
                    ) : (
                        <div className="space-y-3">
                            {mints.map(m => (
                                <div key={m.id} className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <span className="text-emerald-400 font-mono font-bold">{m.sender_uid}</span>
                                            <span className="text-gray-500 mx-2">→</span>
                                            <span className="text-blue-400 font-mono font-bold">{m.receiver_uid}</span>
                                        </div>
                                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${m.status === "minted" ? "bg-emerald-900/50 text-emerald-400" :
                                                m.status === "listed" ? "bg-blue-900/50 text-blue-400" :
                                                    m.status === "burned" ? "bg-red-900/50 text-red-400" :
                                                        "bg-gray-700 text-gray-300"
                                            }`}>{m.status.toUpperCase()}</span>
                                    </div>
                                    <div className="mt-2 grid grid-cols-3 gap-4 text-sm">
                                        <div><span className="text-gray-500">Energy:</span> <span className="text-white font-medium">{m.kwh_transferred.toFixed(4)} kWh</span></div>
                                        <div><span className="text-gray-500">Tokens:</span> <span className="text-emerald-400 font-medium">{m.tokens_minted.toFixed(2)} LT</span></div>
                                        <div><span className="text-gray-500">Quality:</span> <span className="text-yellow-400">{m.quality_factor.toFixed(2)}x</span></div>
                                    </div>
                                    <div className="mt-1 text-xs text-gray-500">
                                        TX: <span className="font-mono">{m.tx_hash}</span> · {new Date(m.timestamp).toLocaleString()}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* BURNS TAB */}
            {activeTab === "burns" && (
                <div className="space-y-4">
                    <h2 className="text-xl font-semibold">🔥 Token Burn Events</h2>
                    <p className="text-sm text-gray-400">Tokens burned after energy is consumed — permanently removed from circulation</p>
                    {burns.length === 0 ? (
                        <EmptyState message="No burn events yet. Complete a marketplace trade to trigger a burn." />
                    ) : (
                        <div className="space-y-3">
                            {burns.map(b => (
                                <div key={b.id} className="bg-gray-800/50 rounded-xl p-4 border border-red-900/30">
                                    <div className="flex justify-between">
                                        <span className="text-red-400 font-bold">🔥 {b.tokens_burned.toFixed(0)} LT burned</span>
                                        <span className="text-xs text-gray-500">{b.burn_reason}</span>
                                    </div>
                                    <div className="mt-1 text-xs text-gray-500">
                                        Order: <span className="font-mono">{b.order_id}</span> · TX: <span className="font-mono">{b.tx_hash}</span> · {new Date(b.timestamp).toLocaleString()}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* CARBON TAB */}
            {activeTab === "carbon" && (
                <div className="space-y-4">
                    <h2 className="text-xl font-semibold">🌱 Carbon Credit Ledger</h2>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <StatCard label="Total CO₂ Saved" value={`${carbon.total_co2_saved_kg?.toFixed(3) || 0} kg`} icon="🌍" color="green" />
                        <StatCard label="Equivalent Trees/Year" value={carbon.equivalent_trees?.toFixed(1) || 0} icon="🌳" color="green" />
                    </div>
                    {(carbon.credits || []).length === 0 ? (
                        <EmptyState message="No carbon credits yet. Transfer energy to start earning carbon credits." />
                    ) : (
                        <div className="space-y-3">
                            {(carbon.credits || []).map((cr: CarbonCredit) => (
                                <div key={cr.id} className="bg-gray-800/50 rounded-xl p-4 border border-emerald-900/30">
                                    <div className="flex justify-between">
                                        <span className="text-emerald-400 font-bold">🌱 {cr.co2_saved_kg.toFixed(3)} kg CO₂</span>
                                        <span className="text-emerald-300 text-sm">{cr.credit_value.toFixed(4)} XLM credit</span>
                                    </div>
                                    <div className="text-sm text-gray-400 mt-1">{cr.kwh_offset.toFixed(4)} kWh offset · Device: {cr.device_id}</div>
                                    <div className="text-xs text-gray-500 mt-1">{new Date(cr.timestamp).toLocaleString()}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* DEFI TAB */}
            {activeTab === "defi" && (
                <div className="space-y-4">
                    <h2 className="text-xl font-semibold">🏦 DeFi Dashboard</h2>
                    {defiStats ? (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                <StatCard label="TVL" value={`${defiStats.total_value_locked?.toFixed(0) || 0} LT`} icon="🔒" color="purple" />
                                <StatCard label="Yield Paid" value={`${defiStats.total_yield_paid?.toFixed(4) || 0} XLM`} icon="📈" color="green" />
                                <StatCard label="Current APY" value={`${defiStats.current_apy?.toFixed(1) || 8.5}%`} icon="💹" color="green" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <StatCard label="Active Stakers" value={defiStats.active_stakers || 0} icon="👥" />
                                <StatCard label="Flash Loan Fee" value={defiStats.flash_loan_fee || "0.3%"} icon="⚡" color="yellow" />
                            </div>
                            <div className="bg-gray-800/50 rounded-xl p-4 border border-purple-900/30">
                                <h3 className="font-bold text-purple-400 mb-2">DeFi Protocol Features</h3>
                                <ul className="text-sm text-gray-300 space-y-1">
                                    <li>• <strong>Liquidity Pool:</strong> Stake LT tokens → earn 8.5% dynamic APY</li>
                                    <li>• <strong>Flash Lending:</strong> Borrow energy tokens instantly, 0.3% fee, 5-min repayment</li>
                                    <li>• <strong>Yield Vaults:</strong> Auto-compound earnings from staking + trade commissions</li>
                                    <li>• <strong>Trade Commission:</strong> 2.5% of each trade → distributed to LP stakers</li>
                                    <li>• <strong>Collateralization:</strong> 150% required for flash loans (auto-liquidation)</li>
                                </ul>
                            </div>
                        </div>
                    ) : (
                        <EmptyState message="DeFi stats loading..." />
                    )}
                </div>
            )}

            {/* DEPIN TAB */}
            {activeTab === "depin" && (
                <div className="space-y-4">
                    <h2 className="text-xl font-semibold">🖥️ DePIN Network</h2>
                    {depinStats ? (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <StatCard label="Registered Nodes" value={depinStats.total_nodes || 0} icon="🖥️" />
                                <StatCard label="kWh Routed" value={(depinStats.total_kwh_routed || 0).toFixed(4)} icon="⚡" color="green" />
                                <StatCard label="Rewards Paid" value={`${(depinStats.total_rewards_paid || 0).toFixed(0)} LT`} icon="💰" color="yellow" />
                                <StatCard label="CO₂ Offset" value={`${(depinStats.co2_offset_kg || 0).toFixed(3)} kg`} icon="🌱" color="green" />
                            </div>
                            <div className="bg-gray-800/50 rounded-xl p-4 border border-blue-900/30">
                                <h3 className="font-bold text-blue-400 mb-2">DePIN Reward Rates</h3>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div className="text-gray-400">Registration Bonus:</div><div className="text-emerald-400 font-bold">{depinStats.reward_rates?.registration_bonus || 100} LT</div>
                                    <div className="text-gray-400">Uptime Reward:</div><div className="text-emerald-400 font-bold">{depinStats.reward_rates?.uptime_per_day || 10} LT/day</div>
                                    <div className="text-gray-400">Per kWh Routed:</div><div className="text-emerald-400 font-bold">{depinStats.reward_rates?.per_kwh_routed || 1} LT</div>
                                    <div className="text-gray-400">Reliability Bonus:</div><div className="text-emerald-400 font-bold">{depinStats.reward_rates?.reliability_bonus || 50} LT/month</div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <EmptyState message="DePIN stats loading..." />
                    )}
                </div>
            )}
        </div>
    );
}

function StatCard({ label, value, icon, color }: { label: string; value: any; icon: string; color?: string }) {
    const colors: Record<string, string> = {
        green: "border-emerald-900/40 bg-emerald-950/20",
        red: "border-red-900/40 bg-red-950/20",
        blue: "border-blue-900/40 bg-blue-950/20",
        purple: "border-purple-900/40 bg-purple-950/20",
        yellow: "border-yellow-900/40 bg-yellow-950/20",
    };

    return (
        <div className={`rounded-xl p-4 border ${colors[color || ""] || "border-gray-700/50 bg-gray-800/30"}`}>
            <div className="text-2xl mb-1">{icon}</div>
            <div className="text-xl font-bold text-white">{value}</div>
            <div className="text-xs text-gray-400 mt-1">{label}</div>
        </div>
    );
}

function EmptyState({ message }: { message: string }) {
    return (
        <div className="bg-gray-800/30 rounded-xl p-8 text-center border border-gray-700/50">
            <p className="text-gray-400">{message}</p>
        </div>
    );
}
