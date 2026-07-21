import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, CartesianGrid, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useWallet } from "@/contexts/WalletContext";
import { simulationApi, type SimulationTimeSeriesPoint } from "@/lib/api";
import SimulationDisclosure from "@/components/SimulationDisclosure";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Analytics() {
  const { demoSessionId } = useWallet();
  const { data } = useQuery({ queryKey: ["analytics-series", demoSessionId], queryFn: () => simulationApi.timeSeries(demoSessionId || undefined), refetchInterval: 5000 });
  const points = (data?.points || []).map(normalizeSeriesPoint);
  const latest = points[points.length - 1];
  return <main className="min-h-screen px-4 pb-16 pt-24"><div className="container mx-auto max-w-6xl"><div className="mb-7 flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-bold">Simulation analytics</h1><p className="mt-2 text-sm text-muted-foreground">Backend time series for the active Delhi NCR clock.</p></div><SimulationDisclosure /></div><div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Metric label="Price" value={latest ? `${latest.price_lt_per_kwh.toFixed(4)} LT` : "--"} /><Metric label="Production" value={latest ? `${latest.production_kw.toFixed(1)} kW` : "--"} /><Metric label="Demand" value={latest ? `${latest.demand_kw.toFixed(1)} kW` : "--"} /><Metric label="Average SoC" value={latest ? `${latest.average_soc.toFixed(1)}%` : "--"} /></div><div className="mt-5 grid gap-5 lg:grid-cols-2"><Chart title="Production and demand"><AreaChart data={points}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="time" tick={{ fontSize: 9 }} /><YAxis tick={{ fontSize: 9 }} width={45} /><Tooltip contentStyle={tooltipStyle} /><Legend /><Area dataKey="production_kw" name="Production kW" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / .15)" /><Line dataKey="demand_kw" name="Demand kW" stroke="#7dd3fc" dot={false} /></AreaChart></Chart><Chart title="LT price"><AreaChart data={points}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="time" tick={{ fontSize: 9 }} /><YAxis domain={["auto", "auto"]} tick={{ fontSize: 9 }} width={50} /><Tooltip contentStyle={tooltipStyle} /><Area dataKey="price_lt_per_kwh" name="LT/kWh" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / .15)" /></AreaChart></Chart><Chart title="Community battery state"><AreaChart data={points}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="time" tick={{ fontSize: 9 }} /><YAxis domain={[0, 100]} tick={{ fontSize: 9 }} width={35} /><Tooltip contentStyle={tooltipStyle} /><Area dataKey="average_soc" name="Average SoC %" stroke="#fbbf24" fill="#fbbf2420" /></AreaChart></Chart><Chart title="Market participation"><AreaChart data={points}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="time" tick={{ fontSize: 9 }} /><YAxis tick={{ fontSize: 9 }} width={30} /><Tooltip contentStyle={tooltipStyle} /><Legend /><Line dataKey="supply_count" name="Supplying homes" stroke="hsl(var(--primary))" dot={false} /><Line dataKey="demand_count" name="Receiving homes" stroke="#7dd3fc" dot={false} /></AreaChart></Chart></div></div></main>;
}

export function normalizeSeriesPoint(point: Partial<SimulationTimeSeriesPoint>) {
  const number = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : 0;
  const timestamp = typeof point.timestamp === "string" ? point.timestamp : "";
  const parsed = new Date(timestamp);
  return {
    timestamp,
    time: Number.isNaN(parsed.getTime()) ? "--" : parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    price_lt_per_kwh: number(point.price_lt_per_kwh),
    production_kw: number(point.production_kw),
    demand_kw: number(point.demand_kw),
    average_soc: number(point.average_soc),
    supply_count: number(point.supply_count),
    demand_count: number(point.demand_count),
  };
}
const tooltipStyle = { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 11 };
function Chart({ title, children }: { title: string; children: React.ReactElement }) { return <Card><CardHeader><CardTitle className="text-sm">{title}</CardTitle></CardHeader><CardContent><div className="h-72"><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div></CardContent></Card>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="metric-panel"><p className="font-mono text-lg font-semibold">{value}</p><p className="mt-1 text-[9px] uppercase tracking-widest text-muted-foreground">{label}</p></div>; }
