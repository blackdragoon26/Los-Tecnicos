'use client';

import { useState, useEffect, useCallback } from 'react';

const API_BASE = 'https://los-tecnicos-backend.onrender.com/api/v1';
const ROOT_URL = API_BASE.replace('/api/v1', '');
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

type ConnectionStatus = 'connecting' | 'connected' | 'error';

export default function DebugTransferPage() {
    const [nodes, setNodes] = useState<NodeInfo[]>([]);
    const [sender, setSender] = useState('');
    const [receiver, setReceiver] = useState('');
    const [status, setStatus] = useState('');
    const [loading, setLoading] = useState(false);
    const [events, setEvents] = useState<string[]>([]);
    const [apiStatus, setApiStatus] = useState<ConnectionStatus>('connecting');
    const [sseStatus, setSseStatus] = useState<ConnectionStatus>('connecting');
    const [lastFetch, setLastFetch] = useState<string>('—');

    // Fetch nodes
    const fetchNodes = useCallback(async () => {
        try {
            const res = await fetch(`${ROOT_URL}/iot/nodes/${DEVICE_ID}`);
            const data = await res.json();
            setNodes(data.nodes || []);
            setApiStatus('connected');
            setLastFetch(new Date().toLocaleTimeString());
        } catch {
            setApiStatus('error');
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
        const es = new EventSource(`${ROOT_URL}/iot/events`);
        es.onopen = () => setSseStatus('connected');
        es.onerror = () => setSseStatus('error');
        es.onmessage = (e) => {
            setSseStatus('connected');
            try {
                const data = JSON.parse(e.data);
                const ts = new Date().toLocaleTimeString();
                if (data.type === 'transfer') {
                    const p = data.payload;
                    if (p.status === 'started') {
                        setEvents(prev => [`[${ts}] ⚡ Transfer: ${p.sender_uid} → ${p.receiver_uid}`, ...prev.slice(0, 29)]);
                    } else if (p.status === 'stopped') {
                        setEvents(prev => [`[${ts}] 🛑 All transfers stopped`, ...prev.slice(0, 29)]);
                    }
                } else if (data.type === 'schedule') {
                    setEvents(prev => [`[${ts}] 🎯 Schedule update for ${data.payload?.device_id}`, ...prev.slice(0, 29)]);
                } else if (data.type === 'heartbeat') {
                    setEvents(prev => [`[${ts}] 💓 Heartbeat from ${data.payload?.device_id}`, ...prev.slice(0, 29)]);
                } else if (data.type === 'node_data') {
                    setEvents(prev => [`[${ts}] 📡 Node data from ${data.payload?.device_id} (${data.payload?.connected_nodes_count} nodes)`, ...prev.slice(0, 29)]);
                }
            } catch { /* ignore */ }
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
            const res = await fetch(`${ROOT_URL}/iot/transfer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ device_id: DEVICE_ID, sender_uid: sender, receiver_uid: receiver }),
            });
            const data = await res.json();
            setStatus(res.ok ? `✅ ${data.message}` : `❌ ${data.error}`);
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
            const res = await fetch(`${ROOT_URL}/iot/transfer/stop`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ device_id: DEVICE_ID }),
            });
            const data = await res.json();
            setStatus(res.ok ? `🛑 ${data.message}` : `❌ ${data.error}`);
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

    const statusDot = (s: ConnectionStatus) => {
        const colors = { connecting: 'bg-yellow-500', connected: 'bg-green-500', error: 'bg-red-500' };
        return <span className={`inline-block w-2 h-2 rounded-full ${colors[s]}`} />;
    };

    return (
        <div className="min-h-screen p-6 pt-24 max-w-5xl mx-auto">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-white mb-2">⚡ Energy Transfer Debug</h1>
                <p className="text-gray-400 text-sm">
                    Control energy transfers between nodes on <code className="text-cyan-400">{DEVICE_ID}</code>
                </p>
            </div>

            {/* Connection Status Bar */}
            <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4 mb-6 backdrop-blur-sm">
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                    <div className="flex items-center gap-2">
                        {statusDot(apiStatus)}
                        <span className="text-gray-400">Backend API:</span>
                        <span className="text-gray-200 font-mono text-xs">{API_BASE}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        {statusDot(sseStatus)}
                        <span className="text-gray-400">SSE Stream:</span>
                        <span className={sseStatus === 'connected' ? 'text-green-400' : 'text-gray-500'}>{sseStatus}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-gray-400">Last refresh:</span>
                        <span className="text-gray-300 font-mono text-xs">{lastFetch}</span>
                    </div>
                </div>
            </div>

            {/* Nodes Grid */}
            <div className="mb-6">
                <h2 className="text-lg font-semibold text-gray-300 mb-3">
                    Live Nodes
                    <span className="text-sm font-normal text-gray-500 ml-2">(auto-refresh 3s)</span>
                </h2>

                {nodes.length === 0 ? (
                    /* ── EMPTY STATE ── */
                    <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-8 backdrop-blur-sm">
                        <div className="text-center mb-6">
                            <div className="text-5xl mb-4">📡</div>
                            <h3 className="text-xl font-semibold text-white mb-2">No Nodes Detected Yet</h3>
                            <p className="text-gray-400 max-w-md mx-auto">
                                The Raspberry Pi hasn&apos;t sent any node data to the backend yet.
                                Once the Pi sends its first <code className="text-cyan-400">/iot/ping</code> with node data, the nodes will appear here automatically.
                            </p>
                        </div>

                        <div className="border-t border-gray-700 pt-6 mt-6">
                            <h4 className="text-sm font-semibold text-gray-300 mb-3">System Status</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                                <div className="bg-gray-900/50 rounded p-3 border border-gray-700">
                                    <div className="flex items-center gap-2 mb-1">
                                        {statusDot(apiStatus)}
                                        <span className="text-gray-300 font-medium">Backend API</span>
                                    </div>
                                    <p className="text-gray-500 text-xs font-mono">{API_BASE}</p>
                                    <p className="text-gray-500 text-xs mt-1">
                                        {apiStatus === 'connected' ? '✅ Connected — ready to receive Pi data' : apiStatus === 'error' ? '❌ Cannot reach backend' : '⏳ Connecting...'}
                                    </p>
                                </div>
                                <div className="bg-gray-900/50 rounded p-3 border border-gray-700">
                                    <div className="flex items-center gap-2 mb-1">
                                        {statusDot(sseStatus)}
                                        <span className="text-gray-300 font-medium">SSE Event Stream</span>
                                    </div>
                                    <p className="text-gray-500 text-xs font-mono">{ROOT_URL}/iot/events</p>
                                    <p className="text-gray-500 text-xs mt-1">
                                        {sseStatus === 'connected' ? '✅ Listening for events' : sseStatus === 'error' ? '❌ Disconnected — will retry' : '⏳ Connecting...'}
                                    </p>
                                </div>
                                <div className="bg-gray-900/50 rounded p-3 border border-gray-700">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="inline-block w-2 h-2 rounded-full bg-gray-500" />
                                        <span className="text-gray-300 font-medium">Device ID</span>
                                    </div>
                                    <p className="text-cyan-400 text-xs font-mono">{DEVICE_ID}</p>
                                    <p className="text-gray-500 text-xs mt-1">Waiting for first ping...</p>
                                </div>
                                <div className="bg-gray-900/50 rounded p-3 border border-gray-700">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="inline-block w-2 h-2 rounded-full bg-gray-500" />
                                        <span className="text-gray-300 font-medium">Scheduling</span>
                                    </div>
                                    <p className="text-gray-500 text-xs">Pi polls <code className="text-cyan-400">/iot/cmd</code> every 5s</p>
                                    <p className="text-gray-500 text-xs mt-1">No schedule commands issued yet</p>
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-gray-700 pt-6 mt-6">
                            <h4 className="text-sm font-semibold text-gray-300 mb-3">How It Works</h4>
                            <div className="space-y-3 text-sm text-gray-400">
                                <div className="flex gap-3">
                                    <span className="text-lg">1️⃣</span>
                                    <div>
                                        <strong className="text-gray-300">Pi sends node data</strong>
                                        <p className="text-xs mt-0.5">POST <code className="text-cyan-400">/iot/ping</code> with voltage, SoC, and node info every few seconds</p>
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <span className="text-lg">2️⃣</span>
                                    <div>
                                        <strong className="text-gray-300">Nodes appear here</strong>
                                        <p className="text-xs mt-0.5">Each node shows its SoC, voltage, IP, and current action (idle/charge/discharge)</p>
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <span className="text-lg">3️⃣</span>
                                    <div>
                                        <strong className="text-gray-300">You trigger a transfer</strong>
                                        <p className="text-xs mt-0.5">Select a sender (→ discharge) and receiver (→ charge), hit &quot;Start Transfer&quot;</p>
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <span className="text-lg">4️⃣</span>
                                    <div>
                                        <strong className="text-gray-300">Pi picks up the command</strong>
                                        <p className="text-xs mt-0.5">On its next <code className="text-cyan-400">/iot/cmd</code> poll, the Pi receives discharge/charge commands and executes</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-gray-700 pt-6 mt-6">
                            <h4 className="text-sm font-semibold text-gray-300 mb-3">Quick Test (curl)</h4>
                            <div className="bg-gray-900 rounded p-3 overflow-x-auto">
                                <code className="text-xs text-green-400 whitespace-pre">{`curl -X POST ${ROOT_URL}/iot/ping \\
  -H "Content-Type: application/json" \\
  -d '{"device_id":"${DEVICE_ID}","voltage":4.019,"connected_nodes_count":2,"connected_nodes":[{"uid":"NODE_A","voltage":4.019},{"uid":"NODE_B","voltage":3.739}],"battery_level":81.9,"state":"IDLE","timestamp":"2026-02-21T10:00:00.000Z","source":"rpi_energy_grid","nodes_detail":[{"uid":"NODE_A","ip":"10.42.0.76","voltage":4.019,"soc":81.9,"state":"IDLE"},{"uid":"NODE_B","ip":"10.42.0.204","voltage":3.739,"soc":40.9,"state":"IDLE"}]}'`}</code>
                            </div>
                            <p className="text-gray-500 text-xs mt-2">Run this command to simulate a Pi ping and populate node data</p>
                        </div>
                    </div>
                ) : (
                    /* ── NODES GRID ── */
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

            {/* Transfer Controls — always visible */}
            <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-5 mb-6 backdrop-blur-sm">
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
                <h2 className="text-lg font-semibold text-gray-300 mb-3">
                    Live Events (SSE)
                    <span className="ml-2">{statusDot(sseStatus)}</span>
                </h2>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                    {events.length === 0 ? (
                        <p className="text-gray-600 text-sm">Waiting for events from the Pi or transfer actions...</p>
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
