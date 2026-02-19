'use client';

import { useState, useEffect, useCallback } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';
const DEVICE_ID = 'rpi-4b-prod-01';

interface NodeInfo {
    uid: string;
    ip: string;
    voltage: number;
    soc: number;
    state: string;
    action: string;
    updated_at: string;
}

export default function DebugTransferPage() {
    const [nodes, setNodes] = useState<NodeInfo[]>([]);
    const [sender, setSender] = useState('');
    const [receiver, setReceiver] = useState('');
    const [status, setStatus] = useState('');
    const [loading, setLoading] = useState(false);
    const [events, setEvents] = useState<string[]>([]);

    // Fetch nodes
    const fetchNodes = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/iot/nodes/${DEVICE_ID}`);
            const data = await res.json();
            setNodes(data.nodes || []);
        } catch (err) {
            console.error('Failed to fetch nodes:', err);
        }
    }, []);

    // Poll nodes every 3s
    useEffect(() => {
        fetchNodes();
        const interval = setInterval(fetchNodes, 3000);
        return () => clearInterval(interval);
    }, [fetchNodes]);

    // SSE for live events
    useEffect(() => {
        const es = new EventSource(`${API_BASE}/iot/events`);
        es.onmessage = (e) => {
            try {
                const data = JSON.parse(e.data);
                const ts = new Date().toLocaleTimeString();
                if (data.type === 'transfer') {
                    const p = data.payload;
                    if (p.status === 'started') {
                        setEvents(prev => [`[${ts}] ⚡ Transfer: ${p.sender_uid} → ${p.receiver_uid}`, ...prev.slice(0, 19)]);
                    } else if (p.status === 'stopped') {
                        setEvents(prev => [`[${ts}] 🛑 All transfers stopped`, ...prev.slice(0, 19)]);
                    }
                } else if (data.type === 'schedule') {
                    setEvents(prev => [`[${ts}] 🎯 Schedule update for ${data.payload?.device_id}`, ...prev.slice(0, 19)]);
                }
            } catch { /* ignore parse errors */ }
        };
        return () => es.close();
    }, []);

    // Start transfer
    const startTransfer = async () => {
        if (!sender || !receiver) {
            setStatus('⚠️ Select both sender and receiver');
            return;
        }
        if (sender === receiver) {
            setStatus('⚠️ Sender and receiver must be different');
            return;
        }
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/iot/transfer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ device_id: DEVICE_ID, sender_uid: sender, receiver_uid: receiver }),
            });
            const data = await res.json();
            if (res.ok) {
                setStatus(`✅ ${data.message}`);
            } else {
                setStatus(`❌ ${data.error}`);
            }
        } catch (err) {
            setStatus(`❌ Network error: ${err}`);
        }
        setLoading(false);
        fetchNodes();
    };

    // Stop all transfers
    const stopTransfer = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/iot/transfer/stop`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ device_id: DEVICE_ID }),
            });
            const data = await res.json();
            if (res.ok) {
                setStatus(`🛑 ${data.message}`);
            } else {
                setStatus(`❌ ${data.error}`);
            }
        } catch (err) {
            setStatus(`❌ Network error: ${err}`);
        }
        setLoading(false);
        fetchNodes();
    };

    const getActionColor = (action: string) => {
        switch (action) {
            case 'discharge': return 'text-orange-400 bg-orange-400/10 border-orange-400/30';
            case 'charge': return 'text-green-400 bg-green-400/10 border-green-400/30';
            default: return 'text-gray-400 bg-gray-400/10 border-gray-400/30';
        }
    };

    const getSoCColor = (soc: number) => {
        if (soc < 20) return 'bg-red-500';
        if (soc < 40) return 'bg-orange-500';
        if (soc < 70) return 'bg-yellow-500';
        return 'bg-green-500';
    };

    return (
        <div className="min-h-screen p-6 pt-24 max-w-5xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">
                    ⚡ Energy Transfer Debug
                </h1>
                <p className="text-gray-400">
                    Device: <code className="text-cyan-400">{DEVICE_ID}</code> · Nodes refresh every 3s · Pi picks up commands on next <code className="text-cyan-400">/iot/cmd</code> poll
                </p>
            </div>

            {/* Nodes Grid */}
            <div className="mb-8">
                <h2 className="text-lg font-semibold text-gray-300 mb-3">Live Nodes</h2>
                {nodes.length === 0 ? (
                    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 text-center text-gray-500">
                        No nodes reported yet. Waiting for Pi to send data via <code>/iot/ping</code>...
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {nodes.map((node) => (
                            <div
                                key={node.uid}
                                className={`bg-gray-800/60 border rounded-lg p-4 backdrop-blur-sm transition-all ${sender === node.uid ? 'border-orange-500 ring-1 ring-orange-500/50' :
                                        receiver === node.uid ? 'border-green-500 ring-1 ring-green-500/50' :
                                            'border-gray-700'
                                    }`}
                            >
                                <div className="flex items-center justify-between mb-3">
                                    <span className="font-mono font-bold text-white">{node.uid}</span>
                                    <span className={`text-xs px-2 py-1 rounded border font-medium ${getActionColor(node.action)}`}>
                                        {node.action.toUpperCase()}
                                    </span>
                                </div>

                                {/* SoC Bar */}
                                <div className="mb-3">
                                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                                        <span>SoC</span>
                                        <span className="font-mono">{node.soc.toFixed(1)}%</span>
                                    </div>
                                    <div className="w-full bg-gray-700 rounded-full h-2.5">
                                        <div
                                            className={`h-2.5 rounded-full transition-all ${getSoCColor(node.soc)}`}
                                            style={{ width: `${Math.min(node.soc, 100)}%` }}
                                        />
                                    </div>
                                </div>

                                <div className="text-xs text-gray-500 space-y-1">
                                    <div className="flex justify-between">
                                        <span>Voltage</span>
                                        <span className="font-mono text-gray-300">{node.voltage.toFixed(3)}V</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>IP</span>
                                        <span className="font-mono text-gray-300">{node.ip || '—'}</span>
                                    </div>
                                </div>

                                {/* Select buttons */}
                                <div className="flex gap-2 mt-3">
                                    <button
                                        onClick={() => setSender(node.uid)}
                                        className={`flex-1 text-xs py-1.5 rounded font-medium transition-all ${sender === node.uid
                                                ? 'bg-orange-500 text-white'
                                                : 'bg-gray-700 text-gray-300 hover:bg-orange-500/20 hover:text-orange-300'
                                            }`}
                                    >
                                        {sender === node.uid ? '✓ Sender' : 'Set Sender'}
                                    </button>
                                    <button
                                        onClick={() => setReceiver(node.uid)}
                                        className={`flex-1 text-xs py-1.5 rounded font-medium transition-all ${receiver === node.uid
                                                ? 'bg-green-500 text-white'
                                                : 'bg-gray-700 text-gray-300 hover:bg-green-500/20 hover:text-green-300'
                                            }`}
                                    >
                                        {receiver === node.uid ? '✓ Receiver' : 'Set Receiver'}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Transfer Controls */}
            <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-5 mb-8 backdrop-blur-sm">
                <h2 className="text-lg font-semibold text-gray-300 mb-4">Transfer Control</h2>
                <div className="flex flex-wrap items-center gap-3 mb-4">
                    <div className="flex items-center gap-2 text-sm">
                        <span className="text-gray-400">Sender:</span>
                        <span className={`font-mono font-bold ${sender ? 'text-orange-400' : 'text-gray-600'}`}>
                            {sender || '(none)'}
                        </span>
                    </div>
                    <span className="text-gray-600">→</span>
                    <div className="flex items-center gap-2 text-sm">
                        <span className="text-gray-400">Receiver:</span>
                        <span className={`font-mono font-bold ${receiver ? 'text-green-400' : 'text-gray-600'}`}>
                            {receiver || '(none)'}
                        </span>
                    </div>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={startTransfer}
                        disabled={loading || !sender || !receiver}
                        className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium rounded-lg transition-all text-sm"
                    >
                        {loading ? '...' : '⚡ Start Transfer'}
                    </button>
                    <button
                        onClick={stopTransfer}
                        disabled={loading}
                        className="px-5 py-2.5 bg-red-600/80 hover:bg-red-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium rounded-lg transition-all text-sm"
                    >
                        {loading ? '...' : '🛑 Stop All'}
                    </button>
                    <button
                        onClick={() => { setSender(''); setReceiver(''); setStatus(''); }}
                        className="px-5 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 font-medium rounded-lg transition-all text-sm"
                    >
                        Clear
                    </button>
                </div>

                {status && (
                    <div className="mt-3 text-sm p-3 bg-gray-900/50 rounded border border-gray-700 font-mono">
                        {status}
                    </div>
                )}
            </div>

            {/* Live Event Log */}
            <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-5 backdrop-blur-sm">
                <h2 className="text-lg font-semibold text-gray-300 mb-3">Live Events (SSE)</h2>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                    {events.length === 0 ? (
                        <p className="text-gray-600 text-sm">Waiting for events...</p>
                    ) : (
                        events.map((evt, i) => (
                            <div key={i} className="text-xs font-mono text-gray-400">{evt}</div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
