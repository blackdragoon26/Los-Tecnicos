import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Battery,
  Cpu,
  ExternalLink,
  Radio,
  Router,
  Server,
  Zap,
} from "lucide-react";
import { iotApi } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

type NodeState = "IDLE" | "RECEIVING" | "SUPPLYING" | "FAULT";

type SimNode = {
  uid: string;
  ip: string;
  mac: string;
  state: NodeState;
  voltage: number;
  soc: number;
  tempC: number;
  relay25: boolean;
  relay26: boolean;
  currentMa: number;
  lastPingMs: number;
};

type SimulatorFrame = {
  tick: number;
  busVoltage: number;
  busCurrentMa: number;
  activeTransferWh: number;
  nodes: SimNode[];
};

type BackendPingState = {
  status: "booting" | "ok" | "error";
  message: string;
  lastAt: string;
  commands: Array<{ node_id: string; action: string }>;
};

const NODE_BASE: Array<Pick<SimNode, "uid" | "ip" | "mac" | "soc">> = [
  { uid: "NODE_A", ip: "10.42.0.204", mac: "78:21:84:bd:c9:64", soc: 84 },
  { uid: "NODE_B", ip: "10.42.0.76", mac: "sim:b4:21:10:42:76", soc: 42 },
  { uid: "NODE_C", ip: "10.42.0.79", mac: "sim:c3:21:10:42:79", soc: 67 },
];

const stateFor = (index: number, tick: number): NodeState => {
  const phase = tick % 36;
  if (phase > 29 && index === 2) return "RECEIVING";
  if (phase > 23 && index === 1) return "SUPPLYING";
  if (phase > 23 && index === 0) return "IDLE";
  if (phase > 15 && index === 0) return "RECEIVING";
  if (phase > 15 && index === 2) return "SUPPLYING";
  if (phase > 7 && index === 1) return "RECEIVING";
  if (phase > 7 && index === 2) return "IDLE";
  if (index === 0) return "SUPPLYING";
  if (index === 1) return "RECEIVING";
  return "IDLE";
};

const voltageFromSoc = (soc: number, state: NodeState, tick: number, index: number) => {
  const base = 3.2 + (Math.max(8, Math.min(96, soc)) / 100) * 0.95;
  const loadSag = state === "SUPPLYING" ? -0.05 : state === "RECEIVING" ? 0.03 : 0;
  const ripple = Math.sin((tick + index * 2) / 3) * 0.012;
  return Number(Math.max(3.25, Math.min(4.19, base + loadSag + ripple)).toFixed(2));
};

const buildFrame = (tick: number): SimulatorFrame => {
  const nodes = NODE_BASE.map((node, index) => {
    const state = stateFor(index, tick);
    const drift =
      state === "SUPPLYING"
        ? -((tick % 8) * 0.12 + index * 0.04)
        : state === "RECEIVING"
          ? (tick % 8) * 0.1 + index * 0.03
          : Math.sin(tick / 4 + index) * 0.08;
    const soc = Number(Math.max(18, Math.min(94, node.soc + drift + Math.sin(tick / 10 + index) * 1.6)).toFixed(1));
    const currentMa = state === "SUPPLYING" ? 540 + index * 45 + (tick % 4) * 18 : state === "RECEIVING" ? 360 + index * 35 + (tick % 3) * 14 : 0;

    return {
      ...node,
      state,
      soc,
      voltage: voltageFromSoc(soc, state, tick, index),
      tempC: Number((29.5 + index * 0.8 + Math.sin(tick / 5 + index) * 1.4 + (state === "SUPPLYING" ? 1.2 : 0)).toFixed(1)),
      relay25: state === "RECEIVING",
      relay26: state === "SUPPLYING",
      currentMa,
      lastPingMs: 70 + ((tick + index * 23) % 90),
    };
  });

  const suppliers = nodes.filter((node) => node.state === "SUPPLYING");
  const receivers = nodes.filter((node) => node.state === "RECEIVING");
  const busCurrentMa = suppliers.reduce((sum, node) => sum + node.currentMa, 0) - receivers.length * 35;

  return {
    tick,
    busVoltage: Number((suppliers.length ? 5.04 + Math.sin(tick / 3) * 0.04 : 0).toFixed(2)),
    busCurrentMa: Math.max(0, Math.round(busCurrentMa)),
    activeTransferWh: Number((Math.max(0, busCurrentMa) * 5.03 / 1000 / 1800).toFixed(3)),
    nodes,
  };
};

const stateClass: Record<NodeState, string> = {
  IDLE: "border-border/60 text-muted-foreground",
  RECEIVING: "border-sky-400/40 text-sky-300 bg-sky-400/10",
  SUPPLYING: "border-primary/50 text-primary bg-primary/10",
  FAULT: "border-destructive/50 text-destructive bg-destructive/10",
};

const relayText = (isOn: boolean) => (isOn ? "LOW / NO closed" : "HIGH / NO open");

const backendBadgeLabel = (status: BackendPingState["status"]) => {
  if (status === "ok") return "backend ok";
  if (status === "error") return "local sim active";
  return "backend connecting";
};

const backendCardLabel = (status: BackendPingState["status"]) => {
  if (status === "ok") return "online";
  if (status === "error") return "local sim";
  return "connecting";
};

const piStateFromNodes = (nodes: SimNode[]) => {
  if (nodes.some((node) => node.state === "FAULT")) return "FAULT";
  if (nodes.some((node) => node.state === "RECEIVING")) return "CHARGING";
  if (nodes.some((node) => node.state === "SUPPLYING")) return "DISCHARGING";
  return "IDLE";
};

const buildPiPingPayload = (frame: SimulatorFrame) => {
  const avgVoltage = frame.nodes.reduce((sum, node) => sum + node.voltage, 0) / frame.nodes.length;
  const avgSoc = frame.nodes.reduce((sum, node) => sum + node.soc, 0) / frame.nodes.length;

  return {
    device_id: "rpi-4b-prod-01",
    voltage: Number(avgVoltage.toFixed(3)),
    connected_nodes_count: frame.nodes.length,
    connected_nodes: frame.nodes.map((node) => ({
      uid: node.uid,
      voltage: node.voltage,
    })),
    battery_level: Number(avgSoc.toFixed(1)),
    state: piStateFromNodes(frame.nodes),
    timestamp: new Date().toISOString(),
    source: "rpi_energy_grid_demo",
    nodes_detail: frame.nodes.map((node) => ({
      uid: node.uid,
      ip: node.ip,
      state: node.state,
      voltage: node.voltage,
      soc: node.soc,
    })),
  };
};

export default function HardwarePingSimulator() {
  const [tick, setTick] = useState(0);
  const pingInFlight = useRef(false);
  const mounted = useRef(true);
  const [backendPing, setBackendPing] = useState<BackendPingState>({
    status: "booting",
    message: "Waiting for first backend ping",
    lastAt: "not sent",
    commands: [],
  });

  useEffect(() => {
    const interval = window.setInterval(() => setTick((value) => value + 1), 1800);
    return () => {
      mounted.current = false;
      window.clearInterval(interval);
    };
  }, []);

  const frame = useMemo(() => buildFrame(tick), [tick]);
  const piPingPayload = useMemo(() => buildPiPingPayload(frame), [frame]);
  const pingPayload = useMemo(
    () => ({
      ...piPingPayload,
      endpoint: "/iot/ping",
      device_id: "rpi-4b-prod-01",
      source: "rpi_energy_grid_demo",
      wlan0: "10.42.0.1/24",
      bus_voltage: frame.busVoltage,
      bus_current_ma: frame.busCurrentMa,
      relay_detail: frame.nodes.map((node) => ({
        uid: node.uid,
        relay_25_receive: relayText(node.relay25),
        relay_26_supply: relayText(node.relay26),
        current_ma: node.currentMa,
        temp_c: node.tempC,
        last_ping_ms: node.lastPingMs,
      })),
    }),
    [frame, piPingPayload],
  );

  useEffect(() => {
    const postPing = async () => {
      if (pingInFlight.current) return;
      pingInFlight.current = true;
      try {
        const withTimeout = <T,>(promise: Promise<T>, timeoutMs = 8000) =>
          Promise.race([
            promise,
            new Promise<T>((_, reject) => {
              window.setTimeout(() => reject(new Error("Backend ping timed out")), timeoutMs);
            }),
          ]);

        if (tick % 5 === 0) {
          await withTimeout(iotApi.ping({ device_id: piPingPayload.device_id, status: "heartbeat" }));
        }
        const response = await withTimeout(iotApi.ping(piPingPayload));
        if (mounted.current) {
          setBackendPing({
            status: "ok",
            message: response?.type === "node_data" ? "Backend accepted node_data" : "Backend accepted ping",
            lastAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
            commands: response?.commands || [],
          });
        }
      } catch (err: any) {
        if (mounted.current) {
          setBackendPing({
            status: "error",
            message: err?.message || "Backend ping failed",
            lastAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
            commands: [],
          });
        }
      } finally {
        pingInFlight.current = false;
      }
    };

    postPing();
  }, [piPingPayload, tick]);

  return (
    <section className="mt-6 space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold tracking-tight">Hardware Ping Simulator</h2>
            <Badge variant="outline" className="border-primary/40 bg-primary/10 text-[10px] text-primary">
              demo mode
            </Badge>
            <Badge
              variant="outline"
              className={`text-[10px] ${
                backendPing.status === "ok"
                  ? "border-primary/40 text-primary"
                  : backendPing.status === "error"
                    ? "border-destructive/50 text-destructive"
                    : "border-border text-muted-foreground"
              }`}
            >
              {backendBadgeLabel(backendPing.status)}
            </Badge>
          </div>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
            Client-side ESP32 and Raspberry Pi telemetry that posts real Pi-shaped pings into the backend.
          </p>
        </div>
        <a href="https://www.youtube.com/watch?v=nVcThM8WkUQ&t=7s" target="_blank" rel="noreferrer">
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
            <ExternalLink className="h-3.5 w-3.5" />
            Hardware reference
          </Button>
        </a>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <CardContent className="pb-3 pt-4">
            <p className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">Pi Hotspot</p>
            <p className="font-mono text-lg font-bold">10.42.0.1</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pb-3 pt-4">
            <p className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">5V Bus</p>
            <p className="font-mono text-lg font-bold">{frame.busVoltage.toFixed(2)}V</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pb-3 pt-4">
            <p className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">Bus Load</p>
            <p className="font-mono text-lg font-bold">{frame.busCurrentMa}mA</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pb-3 pt-4">
            <p className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">Backend Ping</p>
            <p className="font-mono text-lg font-bold">{backendCardLabel(backendPing.status)}</p>
            <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{backendPing.lastAt}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xs">
              <Zap className="h-3.5 w-3.5 text-primary" />
              Simulated 5V Rail Topology
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative min-h-[360px] overflow-hidden rounded-md border border-border/50 bg-slate-deep/70 p-4">
              <div className="absolute left-6 right-6 top-1/2 h-2 -translate-y-1/2 rounded-full bg-primary/20">
                <div className="h-full rounded-full bg-primary/70 shadow-[0_0_18px_hsl(var(--primary)/0.35)]" style={{ width: `${Math.min(100, frame.busCurrentMa / 8)}%` }} />
              </div>
              <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded border border-primary/40 bg-background px-3 py-2 text-xs">
                <Router className="h-4 w-4 text-primary" />
                <span className="font-mono">{frame.busVoltage.toFixed(2)}V bus</span>
              </div>

              <div className="relative grid h-full min-h-[320px] grid-cols-1 gap-3 md:grid-cols-3 md:items-center">
                {frame.nodes.map((node, index) => (
                  <div key={node.uid} className={`relative rounded-md border bg-card/95 p-3 shadow-sm ${stateClass[node.state]}`}>
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <Cpu className="h-4 w-4" />
                          <p className="font-mono text-sm font-semibold">{node.uid}</p>
                        </div>
                        <p className="mt-1 font-mono text-[10px] text-muted-foreground">{node.ip}</p>
                      </div>
                      <Badge variant="outline" className={`text-[9px] ${stateClass[node.state]}`}>
                        {node.state}
                      </Badge>
                    </div>

                    <div className="space-y-3 text-xs">
                      <div>
                        <div className="mb-1 flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <Battery className="h-3.5 w-3.5" />
                            18650 cell
                          </span>
                          <span className="font-mono">{node.soc.toFixed(1)}%</span>
                        </div>
                        <Progress value={node.soc} className="h-1.5" />
                      </div>
                      <div className="grid grid-cols-2 gap-2 font-mono text-[10px]">
                        <div className="rounded bg-muted/40 p-2">
                          <p className="text-muted-foreground">ADC GPIO34</p>
                          <p className="text-foreground">{node.voltage.toFixed(2)}V</p>
                        </div>
                        <div className="rounded bg-muted/40 p-2">
                          <p className="text-muted-foreground">temp</p>
                          <p className="text-foreground">{node.tempC.toFixed(1)}C</p>
                        </div>
                        <div className="rounded bg-muted/40 p-2">
                          <p className="text-muted-foreground">relay 25</p>
                          <p className={node.relay25 ? "text-sky-300" : "text-muted-foreground"}>{node.relay25 ? "RECEIVE" : "OPEN"}</p>
                        </div>
                        <div className="rounded bg-muted/40 p-2">
                          <p className="text-muted-foreground">relay 26</p>
                          <p className={node.relay26 ? "text-primary" : "text-muted-foreground"}>{node.relay26 ? "SUPPLY" : "OPEN"}</p>
                        </div>
                      </div>
                    </div>

                    <div
                      className={`absolute hidden h-0.5 md:block ${
                        node.state === "SUPPLYING" ? "bg-primary" : node.state === "RECEIVING" ? "bg-sky-300" : "bg-border"
                      }`}
                      style={{
                        top: "50%",
                        left: index === 0 ? "100%" : index === 1 ? "50%" : "auto",
                        right: index === 2 ? "100%" : "auto",
                        width: index === 1 ? "0" : "44px",
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xs">
              <Server className="h-3.5 w-3.5 text-primary" />
              Latest /iot/ping Payload
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-2 rounded-md border border-border/50 bg-muted/30 px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Backend response</span>
                <span className={`font-mono text-[10px] ${backendPing.status === "ok" ? "text-primary" : backendPing.status === "error" ? "text-destructive" : "text-muted-foreground"}`}>
                  {backendPing.message}
                </span>
              </div>
              {backendPing.commands.length > 0 && (
                <p className="mt-1 font-mono text-[10px] text-primary">
                  commands: {backendPing.commands.map((cmd) => `${cmd.node_id}:${cmd.action}`).join(", ")}
                </p>
              )}
            </div>
            <pre className="max-h-[360px] overflow-auto rounded-md border border-border/50 bg-background/80 p-3 text-[10px] leading-relaxed text-muted-foreground">
              {JSON.stringify(pingPayload, null, 2)}
            </pre>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {frame.nodes.map((node) => (
          <Card key={node.uid}>
            <CardContent className="flex items-center justify-between gap-3 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className={`h-2.5 w-2.5 rounded-full ${node.state === "SUPPLYING" ? "bg-primary" : node.state === "RECEIVING" ? "bg-sky-300" : "bg-muted-foreground"}`} />
                <div className="min-w-0">
                  <p className="font-mono text-xs font-semibold">{node.uid}</p>
                  <p className="truncate font-mono text-[10px] text-muted-foreground">{node.mac}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-right font-mono text-[10px] text-muted-foreground">
                <Activity className="h-3.5 w-3.5 text-primary" />
                {node.lastPingMs}ms
                <Radio className="h-3.5 w-3.5 text-primary" />
                TCP 8080
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
