import { AlertTriangle, BatteryCharging, CheckCircle2, Gauge, Radio, Timer, X } from "lucide-react";
import type { DemoRole, EnergyTrade } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";

interface Props {
  trade: EnergyTrade | null;
  role: DemoRole;
  busy?: boolean;
  onStart: () => void;
  onSettle: () => void;
  onCancel: () => void;
  onFault: () => void;
  onTimeout: () => void;
  onClose: () => void;
}

const terminal = new Set(["settled", "cancelled", "fault", "timeout"]);

export default function EnergyTransferModal({ trade, role, busy, onStart, onSettle, onCancel, onFault, onTimeout, onClose }: Props) {
  if (!trade) return null;
  const watts = trade.bus_voltage * (trade.current_ma / 1000);
  const remaining = Math.max(0, Math.ceil(trade.demo_eta_seconds * (1 - trade.progress_pct / 100)));
  return (
    <Dialog open onOpenChange={(open) => !open && terminal.has(trade.state) && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><div className="flex flex-wrap items-center gap-2"><DialogTitle>Verified energy transfer</DialogTitle><Badge variant="outline" className="font-mono text-[10px] uppercase">{trade.state.replace("_", " ")}</Badge></div><DialogDescription>Backend-controlled prototype delivery. Both personas read this same trade record.</DialogDescription></DialogHeader>

        <div className="rounded border border-border bg-secondary/30 p-4">
          <div className="flex items-center justify-between text-xs"><span className="font-mono text-primary">{trade.donor_mac}</span><Radio className={trade.state === "transferring" ? "h-4 w-4 animate-pulse text-primary" : "h-4 w-4 text-muted-foreground"} /><span className="font-mono text-sky-300">{trade.receiver_mac}</span></div>
          <Progress value={trade.progress_pct} className="mt-4 h-2" />
          <div className="mt-2 flex justify-between text-[10px] text-muted-foreground"><span>{trade.progress_pct.toFixed(1)}% delivered</span><span>{trade.state === "transferring" ? `${remaining}s demo ETA` : trade.state}</span></div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat icon={Gauge} label="Bus" value={`${trade.bus_voltage.toFixed(2)} V`} />
          <Stat icon={Radio} label="Current" value={`${trade.current_ma.toFixed(0)} mA`} />
          <Stat icon={BatteryCharging} label="Power" value={`${watts.toFixed(2)} W`} />
          <Stat icon={Timer} label="Physical ETA" value={formatDuration(trade.true_eta_seconds)} />
          <Stat label="Input" value={`${trade.input_wh.toFixed(2)} Wh`} />
          <Stat label="Usable" value={`${trade.usable_wh.toFixed(2)} Wh`} />
          <Stat label="Est. loss" value={`${trade.loss_wh.toFixed(2)} Wh`} />
          <Stat label="Efficiency" value={`${trade.efficiency_pct.toFixed(1)}%`} />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-primary/25 bg-primary/10 p-3"><div><p className="text-[10px] uppercase tracking-widest text-muted-foreground">Escrowed settlement</p><p className="font-mono text-lg font-semibold">{trade.token_amount.toFixed(6)} LT</p><p className="text-[10px] text-muted-foreground">{trade.price_per_kwh.toFixed(4)} LT/kWh</p></div>{trade.state === "settled" && <CheckCircle2 className="h-7 w-7 text-primary" />}{trade.state === "fault" && <AlertTriangle className="h-7 w-7 text-destructive" />}</div>
        {trade.failure_reason && <p className="rounded border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">{trade.failure_reason}</p>}

        <div className="flex flex-wrap justify-end gap-2">
          {!terminal.has(trade.state) && <Button variant="outline" disabled={busy} onClick={onCancel}><X className="mr-2 h-4 w-4" />Cancel and refund</Button>}
          {trade.state === "transferring" && <Button variant="outline" disabled={busy} onClick={onTimeout}><Timer className="mr-2 h-4 w-4" />Simulate timeout</Button>}
          {trade.state === "transferring" && <Button variant="destructive" disabled={busy} onClick={onFault}><AlertTriangle className="mr-2 h-4 w-4" />Simulate fault</Button>}
          {trade.state === "funds_locked" && role === "donor" && <Button disabled={busy} onClick={onStart}><BatteryCharging className="mr-2 h-4 w-4" />Start supply</Button>}
          {trade.state === "delivered" && role === "receiver" && <Button disabled={busy} onClick={onSettle}><CheckCircle2 className="mr-2 h-4 w-4" />Settle delivery</Button>}
          {terminal.has(trade.state) && <Button onClick={onClose}>Close</Button>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ icon: Icon, label, value }: { icon?: any; label: string; value: string }) {
  return <div className="rounded border border-border bg-secondary/40 p-3">{Icon && <Icon className="h-3.5 w-3.5 text-primary" />}<p className="mt-2 text-[9px] uppercase tracking-widest text-muted-foreground">{label}</p><p className="mt-1 font-mono text-xs font-semibold">{value}</p></div>;
}

function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}
