import { Battery, Check, Cpu, RadioTower, ShoppingCart } from "lucide-react";
import { Link } from "react-router-dom";
import { useWallet } from "@/contexts/WalletContext";
import SimulationDisclosure from "@/components/SimulationDisclosure";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import powerKit from "@/assets/stelltron-power-kit.png";

export default function Products() {
  const { isDemo, demoKit } = useWallet();
  return (
    <main className="min-h-screen px-4 pb-16 pt-24">
      <div className="container mx-auto max-w-6xl">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div><p className="text-xs uppercase tracking-widest text-primary">Hardware</p><h1 className="mt-2 text-3xl font-bold">Stelltron Power Kit</h1><p className="mt-2 max-w-xl text-sm text-muted-foreground">The physical donor-receiver controller that measures a household battery and switches verified power onto a local 5V prototype rail.</p></div>
          <Badge variant="outline" className="border-primary/40 text-primary">50 LT</Badge>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <figure className="overflow-hidden rounded-md border border-border bg-card">
            <img src={powerKit} alt="Stelltron prototype Power Kit with ESP32, relays, voltage sensor, converters, and 18650 cell" className="aspect-[4/3] h-full w-full object-cover" />
            <figcaption className="border-t border-border px-4 py-3 text-xs text-muted-foreground">Photographed 5V/18650 prototype. Current transfers are Wh-scale laboratory demonstrations.</figcaption>
          </figure>
          <Card><CardContent className="space-y-5 pt-6">
            <div className="grid grid-cols-2 gap-3"><Spec icon={Cpu} label="Controller" value="ESP32 DevKit" /><Spec icon={Battery} label="Storage" value="1 x 18650" /><Spec icon={RadioTower} label="Gateway" value="Raspberry Pi" /><Spec icon={ShoppingCart} label="Kit price" value="50 LT" /></div>
            <div className="space-y-2 text-sm text-muted-foreground">
              {["MAC-addressed registration", "Active-low receive and supply relays", "Voltage and state-of-charge telemetry", "Backend-verified transfer lifecycle"].map((item) => <p key={item} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{item}</p>)}
            </div>
            {isDemo && demoKit ? (
              <div className="rounded border border-primary/30 bg-primary/10 p-3"><p className="text-xs font-semibold text-primary">Sample kit included with demo</p><p className="mt-1 font-mono text-xs">{demoKit.mac_address}</p><p className="text-[10px] text-muted-foreground">{demoKit.alias} - {demoKit.status}</p></div>
            ) : <SimulationDisclosure text="Demo personas receive one isolated sample kit automatically" />}
            <Button asChild className="w-full"><Link to={isDemo ? "/device/register" : "/"}>{isDemo ? "Register sample kit" : "Get the Kit - 50 LT"}</Link></Button>
          </CardContent></Card>
        </div>

        <section className="mt-14 border-t border-border pt-10"><h2 className="text-xl font-semibold">The second layer: mesh gateway</h2><p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">A Raspberry Pi gateway creates the local network, discovers Power Kits, accepts telemetry over TCP, and relays backend commands. Nearby gateways are intended to form a community mesh as the deployment grows. That mesh is a roadmap capability; the current verified prototype uses one Pi and three ESP32 nodes.</p></section>
      </div>
    </main>
  );
}

function Spec({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return <div className="rounded border border-border bg-secondary/40 p-3"><Icon className="h-4 w-4 text-primary" /><p className="mt-3 text-[9px] uppercase tracking-widest text-muted-foreground">{label}</p><p className="mt-1 text-xs font-semibold">{value}</p></div>;
}
