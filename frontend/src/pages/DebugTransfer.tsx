import { useState, useEffect, useCallback } from "react";
import { iotApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const DEVICE_ID = "rpi-4b-prod-01";
const ROOT_URL = (import.meta.env.VITE_API_URL || "https://los-tecnicos-backend.onrender.com/api/v1").replace("/api/v1", "");
const API_BASE = import.meta.env.VITE_API_URL || "https://los-tecnicos-backend.onrender.com/api/v1";

interface NodeInfo {
  uid: string;
  ip: string;
  voltage: number;
  soc: number;
  state: string;
  action: string;
  updated_at: string;
}

type ConnectionStatus = "connecting" | "connected" | "error";

export default function DebugTransfer() {
  const [nodes, setNodes] = useState<NodeInfo[]>([]);
  const [sender, setSender] = useState("");
  const [receiver, setReceiver] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<string[]>([]);
  const [apiStatus, setApiStatus] = useState<ConnectionStatus>("connecting");
  const [sseStatus, setSseStatus] = useState<ConnectionStatus>("connecting");
  const [lastFetch, setLastFetch] = useState("—");

  const fetchNodes = useCallback(async () => {
    try {
      const data = await iotApi.getNodes(DEVICE_ID);
      setNodes(data.nodes || []);
      setApiStatus("connected");
      setLastFetch(new Date().toLocaleTimeString());
    } catch {
      setApiStatus("error");
    }
  }, []);

  useEffect(() => {
    fetchNodes();
    const interval = setInterval(fetchNodes, 3000);
    return () => clearInterval(interval);
  }, [fetchNodes]);

  // SSE for live events
  useEffect(() => {
    const es = new EventSource(iotApi.getEventsUrl());
    es.onopen = () => setSseStatus("connected");
    es.onerror = () => setSseStatus("error");
    es.onmessage = (e) => {
      setSseStatus("connected");
      try {
        const data = JSON.parse(e.data);
        const ts = new Date().toLocaleTimeString();
        if (data.type === "transfer") {
          const p = data.payload;
          if (p.status === "started") {
            setEvents((prev) => [`[${ts}] ⚡ Transfer: ${p.sender_uid} → ${p.receiver_uid}`, ...prev.slice(0, 29)]);
          } else if (p.status === "stopped") {
            setEvents((prev) => [`[${ts}] 🛑 All transfers stopped`, ...prev.slice(0, 29)]);
          }
        } else if (data.type === "schedule") {
          setEvents((prev) => [`[${ts}] 🎯 Schedule update for ${data.payload?.device_id}`, ...prev.slice(0, 29)]);
        } else if (data.type === "heartbeat") {
          setEvents((prev) => [`[${ts}] 💓 Heartbeat from ${data.payload?.device_id}`, ...prev.slice(0, 29)]);
        } else if (data.type === "node_data") {
          setEvents((prev) => [`[${ts}] 📡 Node data from ${data.payload?.device_id} (${data.payload?.connected_nodes_count} nodes)`, ...prev.slice(0, 29)]);
        }
      } catch { /* ignore */ }
    };
    return () => es.close();
  }, []);

  const startTransfer = async () => {
    if (!sender || !receiver) { setStatus("⚠️ Select both sender and receiver"); return; }
    if (sender === receiver) { setStatus("⚠️ Sender and receiver must be different"); return; }
    setLoading(true);
    try {
      const res = await fetch(`${ROOT_URL}/iot/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device_id: DEVICE_ID, sender_uid: sender, receiver_uid: receiver }),
      });
      const data = await res.json();
      setStatus(res.ok ? `✅ ${data.message}` : `❌ ${data.error}`);
    } catch (err: any) {
      setStatus(`❌ Network error: ${err.message}`);
    }
    setLoading(false);
    fetchNodes();
  };

  const stopTransfer = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${ROOT_URL}/iot/transfer/stop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device_id: DEVICE_ID }),
      });
      const data = await res.json();
      setStatus(res.ok ? `🛑 ${data.message}` : `❌ ${data.error}`);
    } catch (err: any) {
      setStatus(`❌ Network error: ${err.message}`);
    }
    setLoading(false);
    fetchNodes();
  };

  const getSoCColor = (soc: number) => {
    if (soc < 20) return "bg-destructive";
    if (soc < 40) return "bg-orange-500";
    if (soc < 70) return "bg-yellow-500";
    return "bg-primary";
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case "discharge": return "text-orange-400 bg-orange-400/10 border-orange-400/30";
      case "charge": return "text-primary bg-primary/10 border-primary/30";
      default: return "text-muted-foreground bg-muted border-border";
    }
  };

  const statusDot = (s: ConnectionStatus) => {
    const colors = { connecting: "bg-yellow-500", connected: "bg-primary", error: "bg-destructive" };
    return <span className={`inline-block w-2 h-2 rounded-full ${colors[s]}`} />;
  };

  return (
    <div className="min-h-screen pt-24 pb-12 px-4">
      <div className="container mx-auto max-w-5xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">⚡ Energy Transfer Debug</h1>
          <p className="text-muted-foreground text-sm">
            Control energy transfers between nodes on <code className="text-primary">{DEVICE_ID}</code>
          </p>
        </div>

        {/* Connection Status */}
        <div className="glass rounded-lg p-4 mb-6">
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <div className="flex items-center gap-2">
              {statusDot(apiStatus)}
              <span className="text-muted-foreground">Backend API:</span>
              <span className="text-foreground font-mono text-xs">{API_BASE}</span>
            </div>
            <div className="flex items-center gap-2">
              {statusDot(sseStatus)}
              <span className="text-muted-foreground">SSE Stream:</span>
              <span className={sseStatus === "connected" ? "text-primary" : "text-muted-foreground"}>{sseStatus}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Last refresh:</span>
              <span className="text-foreground font-mono text-xs">{lastFetch}</span>
            </div>
          </div>
        </div>

        {/* Nodes Grid */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-3">
            Live Nodes <span className="text-sm font-normal text-muted-foreground ml-2">(auto-refresh 3s)</span>
          </h2>
          {nodes.length === 0 ? (
            <div className="glass rounded-lg p-8">
              <div className="text-center mb-6">
                <div className="text-5xl mb-4">📡</div>
                <h3 className="text-xl font-semibold text-foreground mb-2">No Nodes Detected Yet</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  The Raspberry Pi hasn't sent any node data to the backend yet.
                  Once the Pi sends its first <code className="text-primary">/iot/ping</code> with node data, the nodes will appear here automatically.
                </p>
              </div>

              <div className="border-t border-border pt-6 mt-6">
                <h4 className="text-sm font-semibold text-foreground mb-3">System Status</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="bg-muted/50 rounded p-3 border border-border">
                    <div className="flex items-center gap-2 mb-1">
                      {statusDot(apiStatus)}
                      <span className="text-foreground font-medium">Backend API</span>
                    </div>
                    <p className="text-muted-foreground text-xs font-mono">{API_BASE}</p>
                    <p className="text-muted-foreground text-xs mt-1">
                      {apiStatus === "connected" ? "✅ Connected — ready to receive Pi data" : apiStatus === "error" ? "❌ Cannot reach backend" : "⏳ Connecting..."}
                    </p>
                  </div>
                  <div className="bg-muted/50 rounded p-3 border border-border">
                    <div className="flex items-center gap-2 mb-1">
                      {statusDot(sseStatus)}
                      <span className="text-foreground font-medium">SSE Event Stream</span>
                    </div>
                    <p className="text-muted-foreground text-xs font-mono">{ROOT_URL}/iot/events</p>
                    <p className="text-muted-foreground text-xs mt-1">
                      {sseStatus === "connected" ? "✅ Listening for events" : sseStatus === "error" ? "❌ Disconnected — will retry" : "⏳ Connecting..."}
                    </p>
                  </div>
                  <div className="bg-muted/50 rounded p-3 border border-border">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="inline-block w-2 h-2 rounded-full bg-muted-foreground" />
                      <span className="text-foreground font-medium">Device ID</span>
                    </div>
                    <p className="text-primary text-xs font-mono">{DEVICE_ID}</p>
                    <p className="text-muted-foreground text-xs mt-1">Waiting for first ping...</p>
                  </div>
                  <div className="bg-muted/50 rounded p-3 border border-border">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="inline-block w-2 h-2 rounded-full bg-muted-foreground" />
                      <span className="text-foreground font-medium">Scheduling</span>
                    </div>
                    <p className="text-muted-foreground text-xs">Pi polls <code className="text-primary">/iot/cmd</code> every 5s</p>
                    <p className="text-muted-foreground text-xs mt-1">No schedule commands issued yet</p>
                  </div>
                </div>
              </div>

              <div className="border-t border-border pt-6 mt-6">
                <h4 className="text-sm font-semibold text-foreground mb-3">How It Works</h4>
                <div className="space-y-3 text-sm text-muted-foreground">
                  <div className="flex gap-3">
                    <span className="text-lg">1️⃣</span>
                    <div>
                      <strong className="text-foreground">Pi sends node data</strong>
                      <p className="text-xs mt-0.5">POST <code className="text-primary">/iot/ping</code> with voltage, SoC, and node info every few seconds</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-lg">2️⃣</span>
                    <div>
                      <strong className="text-foreground">Nodes appear here</strong>
                      <p className="text-xs mt-0.5">Each node shows its SoC, voltage, IP, and current action (idle/charge/discharge)</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-lg">3️⃣</span>
                    <div>
                      <strong className="text-foreground">You trigger a transfer</strong>
                      <p className="text-xs mt-0.5">Select a sender (→ discharge) and receiver (→ charge), hit "Start Transfer"</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-lg">4️⃣</span>
                    <div>
                      <strong className="text-foreground">Pi picks up the command</strong>
                      <p className="text-xs mt-0.5">On its next <code className="text-primary">/iot/cmd</code> poll, the Pi receives discharge/charge commands and executes</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-border pt-6 mt-6">
                <h4 className="text-sm font-semibold text-foreground mb-3">Quick Test (curl)</h4>
                <div className="bg-muted rounded p-3 overflow-x-auto">
                  <code className="text-xs text-primary whitespace-pre">{`curl -X POST ${ROOT_URL}/iot/ping \\
  -H "Content-Type: application/json" \\
  -d '{"device_id":"${DEVICE_ID}","voltage":4.019,"connected_nodes_count":2,"connected_nodes":[{"uid":"NODE_A","voltage":4.019},{"uid":"NODE_B","voltage":3.739}],"battery_level":81.9,"state":"IDLE","timestamp":"2026-02-21T10:00:00.000Z","source":"rpi_energy_grid","nodes_detail":[{"uid":"NODE_A","ip":"10.42.0.76","voltage":4.019,"soc":81.9,"state":"IDLE"},{"uid":"NODE_B","ip":"10.42.0.204","voltage":3.739,"soc":40.9,"state":"IDLE"}]}'`}</code>
                </div>
                <p className="text-muted-foreground text-xs mt-2">Run this command to simulate a Pi ping and populate node data</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {nodes.map((node) => (
                <div
                  key={node.uid}
                  className={`glass rounded-lg p-4 transition-all ${
                    sender === node.uid ? "border-orange-500 ring-1 ring-orange-500/50" :
                    receiver === node.uid ? "border-primary ring-1 ring-primary/50" : ""
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono font-bold text-foreground">{node.uid}</span>
                    <span className={`text-xs px-2 py-1 rounded border font-medium ${getActionColor(node.action)}`}>
                      {node.action.toUpperCase()}
                    </span>
                  </div>
                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>SoC</span>
                      <span className="font-mono">{node.soc.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2.5">
                      <div className={`h-2.5 rounded-full transition-all ${getSoCColor(node.soc)}`} style={{ width: `${Math.min(node.soc, 100)}%` }} />
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div className="flex justify-between"><span>Voltage</span><span className="font-mono text-foreground">{node.voltage.toFixed(3)}V</span></div>
                    <div className="flex justify-between"><span>IP</span><span className="font-mono text-foreground">{node.ip || "—"}</span></div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button
                      size="sm"
                      variant={sender === node.uid ? "default" : "outline"}
                      onClick={() => setSender(node.uid)}
                      className="flex-1 text-xs"
                    >
                      {sender === node.uid ? "✓ Sender" : "Set Sender"}
                    </Button>
                    <Button
                      size="sm"
                      variant={receiver === node.uid ? "default" : "outline"}
                      onClick={() => setReceiver(node.uid)}
                      className="flex-1 text-xs"
                    >
                      {receiver === node.uid ? "✓ Receiver" : "Set Receiver"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Transfer Controls — always visible */}
        <div className="glass rounded-lg p-5 mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Transfer Control</h2>

          {/* Manual text inputs for sender/receiver */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Sender UID (manual)</label>
              <Input
                placeholder="e.g. NODE_A"
                value={sender}
                onChange={(e) => setSender(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Receiver UID (manual)</label>
              <Input
                placeholder="e.g. NODE_B"
                value={receiver}
                onChange={(e) => setReceiver(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Sender:</span>
              <span className={`font-mono font-bold ${sender ? "text-orange-400" : "text-muted-foreground"}`}>
                {sender || "(none)"}
              </span>
            </div>
            <span className="text-muted-foreground">→</span>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Receiver:</span>
              <span className={`font-mono font-bold ${receiver ? "text-primary" : "text-muted-foreground"}`}>
                {receiver || "(none)"}
              </span>
            </div>
          </div>

          <div className="flex gap-3">
            <Button onClick={startTransfer} disabled={loading || !sender || !receiver}>
              {loading ? "Processing..." : "⚡ Start Transfer"}
            </Button>
            <Button variant="destructive" onClick={stopTransfer} disabled={loading}>
              {loading ? "..." : "🛑 Stop All"}
            </Button>
            <Button variant="outline" onClick={() => { setSender(""); setReceiver(""); setStatus(""); }}>
              Clear
            </Button>
          </div>
          {status && (
            <div className="mt-3 text-sm p-3 bg-muted/50 rounded border border-border font-mono">
              {status}
            </div>
          )}
        </div>

        {/* Live Events */}
        <div className="glass rounded-lg p-5">
          <h2 className="text-lg font-semibold text-foreground mb-3">
            Live Events (SSE)
            <span className="ml-2">{statusDot(sseStatus)}</span>
          </h2>
          <div className="bg-muted rounded-lg p-3 max-h-48 overflow-y-auto font-mono text-xs space-y-1">
            {events.length === 0 ? (
              <p className="text-muted-foreground">Waiting for events from the Pi or transfer actions...</p>
            ) : (
              events.map((e, i) => <div key={i} className="text-foreground">{e}</div>)
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
