import { useWallet } from "@/contexts/WalletContext";
import { useDigitalTwin } from "@/hooks/useDigitalTwin";
import SimulationDisclosure from "@/components/SimulationDisclosure";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const factors = [
  ["Supply / demand", "f_sd", "Responds to the count of homes offering and requesting energy."],
  ["State of charge", "f_soc", "Raises scarcity cost when community batteries are depleted."],
  ["Distance", "f_dist", "Accounts for a representative local transmission route."],
  ["Time", "f_time", "Reflects morning, evening and overnight grid pressure."],
  ["Reliability", "f_reliability", "Uses backend hardware delivery reliability."],
] as const;

export default function FormulaPlayground() {
  const { demoSessionId } = useWallet();
  const { data } = useDigitalTwin(demoSessionId);
  const price = data?.price_breakdown;
  return <main className="min-h-screen px-4 pb-16 pt-24"><div className="container mx-auto max-w-5xl"><div className="mb-7 flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-bold">Authoritative pricing</h1><p className="mt-2 text-sm text-muted-foreground">Live factor attribution from backend telemetry. Trading remains LT-only.</p></div><SimulationDisclosure /></div><Card><CardContent className="pt-6"><p className="text-[10px] uppercase tracking-widest text-muted-foreground">Current market price</p><p className="mt-2 font-mono text-4xl font-bold">{price?.final_price.toFixed(4) || "--"}</p><p className="mt-1 text-sm text-primary">LT / kWh</p><p className="mt-6 overflow-x-auto rounded border border-border bg-secondary/40 p-4 font-mono text-xs">Price = Base x Supply/Demand x SoC x Distance x Time x Reliability</p></CardContent></Card><div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{factors.map(([label, key, body]) => <Card key={key}><CardHeader><CardTitle className="text-xs">{label}</CardTitle></CardHeader><CardContent><p className="font-mono text-xl font-semibold text-primary">{price?.[key]?.toFixed(4) || "--"}x</p><p className="mt-3 text-xs leading-relaxed text-muted-foreground">{body}</p></CardContent></Card>)}</div><Card className="mt-5"><CardContent className="pt-5"><div className="grid gap-4 sm:grid-cols-3"><Info label="Base" value={`${price?.base_price.toFixed(4) || "--"} LT/kWh`} /><Info label="Backend supply" value={`${data?.supply_count ?? "--"} homes`} /><Info label="Backend demand" value={`${data?.demand_count ?? "--"} homes`} /></div><p className="mt-4 text-xs leading-relaxed text-muted-foreground">Delhi NCR weather affects solar output, cooling demand and battery state of charge. It does not appear as an arbitrary weather factor in this formula.</p></CardContent></Card></div></main>;
}
function Info({ label, value }: { label: string; value: string }) { return <div className="rounded border border-border p-3"><p className="text-[9px] uppercase tracking-widest text-muted-foreground">{label}</p><p className="mt-1 font-mono text-sm">{value}</p></div>; }
