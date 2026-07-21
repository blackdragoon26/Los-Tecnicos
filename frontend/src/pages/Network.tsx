import { CloudSun, Gauge, MapPin, RadioTower } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { useDigitalTwin } from "@/hooks/useDigitalTwin";
import { demoApi } from "@/lib/api";
import SimulationDisclosure from "@/components/SimulationDisclosure";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";

const bounds = { minLat: 28.34, maxLat: 28.79, minLon: 76.86, maxLon: 77.55 };

export default function NetworkPage() {
  const { demoSessionId } = useWallet();
  const { data, isLoading } = useDigitalTwin(demoSessionId);
  const queryClient = useQueryClient();
  const setClockMode = async (mode: "realtime" | "10x" | "pitch") => {
    if (!demoSessionId) return;
    await demoApi.setSpeed(demoSessionId, mode);
    await queryClient.invalidateQueries({ queryKey: ["digital-twin", demoSessionId] });
  };
  return (
    <main className="min-h-screen px-4 pb-16 pt-24"><div className="container mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-bold">Delhi NCR digital twin</h1><p className="mt-2 text-sm text-muted-foreground">Backend-calculated household production, demand, storage and market state.</p></div><SimulationDisclosure /></div>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4"><Metric label="Simulated time" value={data ? new Date(data.simulated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--"} /><Metric label="Weather" value={data ? `${data.weather.temperature_c.toFixed(1)} C` : "--"} /><Metric label="Production" value={data ? `${data.total_production_kw.toFixed(1)} kW` : "--"} /><Metric label="Demand" value={data ? `${data.total_demand_kw.toFixed(1)} kW` : "--"} /></div>
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <Card><CardHeader><CardTitle className="flex items-center gap-2 text-sm"><MapPin className="h-4 w-4 text-primary" />Households and gateways</CardTitle></CardHeader><CardContent><div className="topology-map" aria-label="Delhi NCR household topology">{data?.households.map((home, index) => { const left = ((home.longitude - bounds.minLon) / (bounds.maxLon - bounds.minLon)) * 100; const top = 100 - ((home.latitude - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * 100; return <button key={home.mac_address} className={`topology-node topology-${home.state.toLowerCase()}`} style={{ left: `${Math.max(2, Math.min(98, left))}%`, top: `${Math.max(3, Math.min(97, top))}%` }} title={`${home.alias}\n${home.mac_address}\n${home.state}\n${home.soc}% SoC`} aria-label={`${home.alias}, ${home.state}, ${home.soc}% state of charge`}><span>{index + 1}</span></button>; })}{["Delhi", "Noida", "Gurugram", "Ghaziabad", "Faridabad"].map((city, index) => <div key={city} className="topology-label" style={{ left: `${[46, 73, 28, 72, 55][index]}%`, top: `${[38, 55, 62, 25, 82][index]}%` }}>{city}</div>)}</div><div className="mt-3 flex flex-wrap gap-3 text-[10px] text-muted-foreground"><Legend color="bg-primary" label="Supplying" /><Legend color="bg-sky-400" label="Receiving" /><Legend color="bg-zinc-500" label="Idle" /></div></CardContent></Card>
        <div className="space-y-5"><Card><CardHeader><CardTitle className="flex items-center gap-2 text-sm"><CloudSun className="h-4 w-4 text-primary" />Weather feed</CardTitle></CardHeader><CardContent className="space-y-3"><Info label="Source" value={data?.weather.source || "Loading"} /><Info label="Cloud cover" value={`${data?.weather.cloud_cover_pct.toFixed(0) || "--"}%`} /><Info label="Observed" value={data ? new Date(data.weather.observed_at).toLocaleTimeString() : "--"} /><p className="text-[10px] leading-relaxed text-muted-foreground">Weather changes production and household demand. It is not applied as a direct price multiplier.</p></CardContent></Card><Card><CardHeader><CardTitle className="flex items-center gap-2 text-sm"><RadioTower className="h-4 w-4 text-primary" />Fleet state</CardTitle></CardHeader><CardContent className="space-y-4"><Fleet label="Supplying" value={data?.supply_count || 0} /><Fleet label="Receiving" value={data?.demand_count || 0} /><Fleet label="Idle" value={data?.idle_count || 0} /><div className="border-t border-border pt-3"><p className="text-[10px] uppercase tracking-widest text-muted-foreground">Clock mode</p><div className="mt-2 grid grid-cols-3 gap-1">{(["realtime", "10x", "pitch"] as const).map((mode) => <Button key={mode} size="sm" variant={data?.speed_mode === mode ? "default" : "outline"} disabled={!demoSessionId} onClick={() => setClockMode(mode)}>{mode === "pitch" ? "Pitch" : mode}</Button>)}</div><p className="mt-2 font-mono text-[10px] text-muted-foreground">{data?.speed_multiplier || 1}x simulation clock</p></div></CardContent></Card></div>
      </div>
      <Card className="mt-5"><CardHeader><CardTitle className="flex items-center gap-2 text-sm"><Gauge className="h-4 w-4 text-primary" />Household telemetry</CardTitle></CardHeader><CardContent><div className="responsive-table"><table className="w-full min-w-[720px] text-left text-xs"><thead className="text-[9px] uppercase tracking-widest text-muted-foreground"><tr><th>Power Kit MAC</th><th>Location</th><th>State</th><th>SoC</th><th>Solar</th><th>Load</th><th>Reliability</th></tr></thead><tbody>{data?.households.map((home) => <tr key={home.mac_address} className="border-t border-border/60"><td className="py-3 font-mono">{home.mac_address}</td><td>{home.region}</td><td><Badge variant="outline" className="text-[9px]">{home.state}</Badge></td><td className="w-32"><div className="flex items-center gap-2"><Progress value={home.soc} className="h-1.5" /><span>{home.soc.toFixed(0)}%</span></div></td><td>{home.production_kw.toFixed(2)} kW</td><td>{home.demand_kw.toFixed(2)} kW</td><td>{home.reliability_pct.toFixed(1)}%</td></tr>)}</tbody></table></div></CardContent></Card>
    </div></main>
  );
}
function Metric({ label, value }: { label: string; value: string }) { return <div className="metric-panel"><p className="font-mono text-lg font-semibold">{value}</p><p className="mt-1 text-[9px] uppercase tracking-widest text-muted-foreground">{label}</p></div>; }
function Info({ label, value }: { label: string; value: string }) { return <div><p className="text-[9px] uppercase tracking-widest text-muted-foreground">{label}</p><p className="mt-1 text-xs font-medium">{value}</p></div>; }
function Fleet({ label, value }: { label: string; value: number }) { return <div><div className="mb-1 flex justify-between text-xs"><span>{label}</span><span className="font-mono">{value}</span></div><Progress value={value * 2} className="h-1.5" /></div>; }
function Legend({ color, label }: { color: string; label: string }) { return <span className="flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${color}`} />{label}</span>; }
