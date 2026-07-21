import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Copy, Lock, Plus, RefreshCw, Users, WalletCards, Zap } from "lucide-react";
import { toast } from "sonner";
import { useWallet } from "@/contexts/WalletContext";
import { useDigitalTwin } from "@/hooks/useDigitalTwin";
import { simulationApi, tradeApi, type EnergyTrade } from "@/lib/api";
import { CurrencyValue, type DisplayCurrency } from "@/components/CurrencyValue";
import EnergyTransferModal from "@/components/EnergyTransferModal";
import SimulationDisclosure from "@/components/SimulationDisclosure";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Marketplace() {
  const { demoProfile, demoBalance, demoSessionId, demoJoinCode, demoKit, wallet, refreshWallet, topUpDemoBalance } = useWallet();
  const { data: twin } = useDigitalTwin(demoSessionId);
  const { data: series } = useQuery({ queryKey: ["market-series", demoSessionId], queryFn: () => simulationApi.timeSeries(demoSessionId || undefined), refetchInterval: 5000 });
  const [trade, setTrade] = useState<EnergyTrade | null>(null);
  const [dismissedTradeId, setDismissedTradeId] = useState<string | null>(null);
  const [inputWh, setInputWh] = useState("6");
  const [topUp, setTopUp] = useState("100");
  const [currency, setCurrency] = useState<DisplayCurrency>("LT");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!demoSessionId) return;
    let active = true;
    const poll = async () => {
      try {
        const result = await tradeApi.active(demoSessionId);
        if (active) setTrade(result.trade);
        if (result.trade?.state === "settled" || result.trade?.state === "cancelled" || result.trade?.state === "fault" || result.trade?.state === "timeout") refreshWallet().catch(() => undefined);
      } catch { /* next poll retries */ }
    };
    poll();
    const timer = window.setInterval(poll, 800);
    return () => { active = false; window.clearInterval(timer); };
  }, [demoSessionId, refreshWallet]);

  const act = async (action: () => Promise<{ trade: EnergyTrade }>) => {
    setBusy(true);
    try { const result = await action(); setTrade(result.trade); await refreshWallet(); }
    catch (error: any) { toast.error(error.message || "Trade action failed"); }
    finally { setBusy(false); }
  };

  const fundWallet = async () => {
    setBusy(true);
    try {
      await topUpDemoBalance(Number(topUp));
      toast.success("Demo LT added to this app wallet");
    } catch (error: any) {
      toast.error(error.message || "Top-up failed");
    } finally { setBusy(false); }
  };

  const chartData = useMemo(() => (series?.points || []).map((point: any) => ({ ...point, time: new Date(point.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) })), [series]);
  const activeAmount = twin ? (Number(inputWh) / 1000) * twin.price_lt_per_kwh * 0.82 : 0;

  return (
    <main className="min-h-screen px-4 pb-16 pt-24">
      <div className="container mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-bold">Local energy market</h1><Badge variant="outline" className="text-primary">LT settlement</Badge></div><p className="mt-2 text-sm text-muted-foreground">Receiver locks funds. Donor hardware supplies. Backend telemetry settles.</p></div><SimulationDisclosure /></div>

        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <div className="space-y-5">
            <Card><CardContent className="pt-5"><div className="grid gap-4 sm:grid-cols-[1fr_auto]"><div className="flex items-center gap-3"><WalletCards className="h-5 w-5 text-primary" /><div><p className="text-xs text-muted-foreground">{demoProfile === "donor" ? "Donor" : "Receiver"} app wallet</p><p className="font-mono text-xl font-semibold">{demoBalance.toFixed(4)} LT</p><p className="text-[10px] text-muted-foreground">Escrow {wallet?.escrow_balance.toFixed(6) || "0.000000"} LT</p></div></div><div className="flex flex-wrap gap-2"><Input className="w-24" type="number" min="1" value={topUp} onChange={(event) => setTopUp(event.target.value)} /><Button variant="outline" disabled={busy || Number(topUp) <= 0} onClick={fundWallet}><Plus className="mr-1 h-4 w-4" />Add LT</Button></div></div></CardContent></Card>

            <Card><CardHeader><CardTitle className="flex items-center gap-2 text-sm"><Users className="h-4 w-4 text-primary" />Two-user prototype trade</CardTitle></CardHeader><CardContent className="space-y-4"><div className="grid gap-3 sm:grid-cols-3"><Info label="Persona" value={demoProfile || "--"} /><Info label="Kit MAC" value={demoKit?.mac_address || "--"} mono /><Info label="Current state" value={trade?.state.replace("_", " ") || "open"} /></div>{demoProfile === "receiver" && (!trade || ["settled", "cancelled", "fault", "timeout"].includes(trade.state)) && <div className="flex flex-col gap-3 rounded border border-border p-4 sm:flex-row sm:items-end"><label className="flex-1 text-xs text-muted-foreground">Prototype input energy (Wh)<Input className="mt-1" type="number" min="1" max="50" value={inputWh} onChange={(event) => setInputWh(event.target.value)} /></label><div className="min-w-36"><p className="text-[10px] text-muted-foreground">Estimated escrow</p><p className="font-mono text-sm">{activeAmount.toFixed(6)} LT</p></div><Button disabled={busy || Number(inputWh) <= 0 || Number(inputWh) > 50} onClick={() => act(() => tradeApi.lock(demoSessionId!, Number(inputWh)))}><Lock className="mr-2 h-4 w-4" />Lock receiver funds</Button></div>}{trade && <Button variant="secondary" onClick={() => setDismissedTradeId(null)}><Zap className="mr-2 h-4 w-4" />Open transfer monitor</Button>}</CardContent></Card>

            <Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><CardTitle className="text-sm">Backend market history</CardTitle><Select value={currency} onValueChange={(value) => setCurrency(value as DisplayCurrency)}><SelectTrigger className="w-28"><SelectValue /></SelectTrigger><SelectContent>{["LT", "INR", "USD", "EUR"].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div></CardHeader><CardContent><div className="h-64"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="time" tick={{ fontSize: 9 }} /><YAxis domain={["auto", "auto"]} tick={{ fontSize: 9 }} width={45} /><Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 11 }} /><Area dataKey="price" type="monotone" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.18)" /></AreaChart></ResponsiveContainer></div></CardContent></Card>
          </div>

          <aside className="space-y-5"><Card><CardHeader><CardTitle className="text-sm">Shared market session</CardTitle></CardHeader><CardContent><p className="text-[10px] uppercase tracking-widest text-muted-foreground">Join code</p><button className="mt-2 flex w-full items-center justify-between rounded border border-primary/30 bg-primary/10 px-3 py-3 font-mono text-lg text-primary" onClick={() => { navigator.clipboard.writeText(demoJoinCode || ""); toast.success("Join code copied"); }}>{demoJoinCode || "--------"}<Copy className="h-4 w-4" /></button><p className="mt-3 text-xs leading-relaxed text-muted-foreground">Open a different browser or private context, choose Donor, enter this code, and both sides will follow the same trade.</p></CardContent></Card>
            <Card><CardHeader><CardTitle className="text-sm">Live quote</CardTitle></CardHeader><CardContent className="space-y-3"><div><p className="font-mono text-2xl font-semibold">{twin?.price_lt_per_kwh.toFixed(4) || "--"}</p><p className="text-xs text-primary">LT/kWh</p><p className="mt-1 text-xs text-muted-foreground"><CurrencyValue lt={twin?.price_lt_per_kwh || 0} currency={currency} digits={currency === "INR" ? 2 : 4} /> / kWh display</p></div><div className="grid grid-cols-2 gap-2"><Info label="Supply" value={String(twin?.supply_count ?? "--")} /><Info label="Demand" value={String(twin?.demand_count ?? "--")} /></div><Button asChild variant="outline" className="w-full"><a href="/formula"><RefreshCw className="mr-2 h-4 w-4" />Factor attribution</a></Button></CardContent></Card>
          </aside>
        </div>
      </div>

      <EnergyTransferModal trade={trade?.id === dismissedTradeId ? null : trade} role={demoProfile || "receiver"} busy={busy} onStart={() => act(() => tradeApi.start(trade!.id))} onSettle={() => act(() => tradeApi.settle(trade!.id))} onCancel={() => act(() => tradeApi.cancel(trade!.id))} onFault={() => act(() => tradeApi.fault(trade!.id))} onTimeout={() => act(() => tradeApi.timeout(trade!.id))} onClose={() => setDismissedTradeId(trade?.id || null)} />
    </main>
  );
}

function Info({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) { return <div className="rounded border border-border bg-secondary/40 p-3"><p className="text-[9px] uppercase tracking-widest text-muted-foreground">{label}</p><p className={`mt-1 truncate text-xs font-semibold capitalize ${mono ? "font-mono" : ""}`} title={value}>{value}</p></div>; }
