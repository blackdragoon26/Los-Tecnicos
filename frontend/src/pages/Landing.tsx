import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, BatteryCharging, Mail, Network, RadioTower, WalletCards, Zap } from "lucide-react";
import { toast } from "sonner";
import { useWallet } from "@/contexts/WalletContext";
import { useDigitalTwin } from "@/hooks/useDigitalTwin";
import RecognitionBadge from "@/components/RecognitionBadge";
import SimulationDisclosure from "@/components/SimulationDisclosure";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import logo from "@/assets/stelltron-logo-new.png";

export default function Landing() {
  const { isConnected, connectDemo, joinDemo } = useWallet();
  const { data: twin } = useDigitalTwin();
  const [joinCode, setJoinCode] = useState("");
  const [role, setRole] = useState<"receiver" | "donor">("receiver");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const start = async (selected: "receiver" | "donor") => {
    setBusy(true);
    try {
      await connectDemo(selected);
      navigate("/marketplace");
    } catch (error: any) {
      toast.error(error.message || "Could not start demo session");
    } finally { setBusy(false); }
  };

  const join = async () => {
    if (!joinCode.trim()) return;
    setBusy(true);
    try {
      await joinDemo(joinCode, role);
      navigate("/marketplace");
    } catch (error: any) {
      toast.error(error.message || "Could not join demo session");
    } finally { setBusy(false); }
  };

  return (
    <main className="min-h-screen pt-14">
      <section className="hero-shell border-b border-border/60 px-4">
        <div className="container mx-auto grid max-w-6xl gap-10 py-12 lg:grid-cols-[1fr_420px] lg:items-center">
          <div className="max-w-3xl">
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <img src={logo} alt="Stelltron" className="h-12 w-12" />
              <RecognitionBadge />
              <SimulationDisclosure />
            </div>
            <h1 className="max-w-3xl text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
              Stelltron household energy network
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground">
              Local Power Kits and mesh gateways let households donate or trade surplus stored energy, giving individuals a direct role in resilience instead of leaving the grid entirely to large utilities.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              {isConnected ? (
                <Button asChild size="lg"><Link to="/dashboard"><Zap className="mr-2 h-4 w-4" />Open dashboard</Link></Button>
              ) : (
                <Button size="lg" disabled={busy} onClick={() => start("receiver")}><Zap className="mr-2 h-4 w-4" />Start receiver demo</Button>
              )}
              <Button asChild variant="outline" size="lg"><a href="mailto:sankalp.jha9643@gmail.com?subject=Partner%20with%20Stelltron"><Mail className="mr-2 h-4 w-4" />Partner with Stelltron</a></Button>
            </div>
            <p className="mt-3 text-xs font-medium text-primary">Seeking angel and pre-seed partners</p>
          </div>

          <Card className="border-primary/25">
            <CardHeader>
              <CardTitle className="text-base">Two-browser trade demo</CardTitle>
              <p className="text-xs text-muted-foreground">Create a market as receiver, then enter its code in a separate browser as donor.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button className="w-full" disabled={busy} onClick={() => start("receiver")}><WalletCards className="mr-2 h-4 w-4" />Create receiver market</Button>
              <div className="relative py-1 text-center text-[10px] uppercase tracking-widest text-muted-foreground before:absolute before:left-0 before:right-0 before:top-1/2 before:border-t before:border-border">
                <span className="relative bg-card px-3">or join</span>
              </div>
              <Tabs value={role} onValueChange={(value) => setRole(value as "receiver" | "donor")}>
                <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="receiver">Receiver</TabsTrigger><TabsTrigger value="donor">Donor</TabsTrigger></TabsList>
              </Tabs>
              <div className="flex gap-2">
                <Input aria-label="Demo join code" placeholder="JOIN CODE" value={joinCode} onChange={(event) => setJoinCode(event.target.value.toUpperCase())} className="font-mono uppercase" />
                <Button variant="secondary" disabled={busy || !joinCode.trim()} onClick={join}>Join</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="border-b border-border/60 px-4 py-8">
        <div className="container mx-auto max-w-6xl">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Metric label="Projected homes" value={twin ? String(twin.households.length) : "--"} />
            <Metric label="Supplying now" value={twin ? String(twin.supply_count) : "--"} />
            <Metric label="Delhi NCR demand" value={twin ? `${twin.total_demand_kw.toFixed(1)} kW` : "--"} />
            <Metric label="Market price" value={twin ? `${twin.price_lt_per_kwh.toFixed(4)} LT` : "--"} />
          </div>
          <p className="mt-3 text-center text-[10px] text-muted-foreground">Digital twin metrics are projected simulation data. The photographed 5V/18650 system remains a separate prototype profile.</p>
        </div>
      </section>

      <section className="px-4 py-16">
        <div className="container mx-auto max-w-6xl">
          <div className="mb-8 max-w-2xl"><p className="text-xs uppercase tracking-widest text-primary">Local-first infrastructure</p><h2 className="mt-2 text-2xl font-semibold">Two hardware layers, one verified transfer</h2></div>
          <div className="grid gap-4 md:grid-cols-3">
            <Feature icon={BatteryCharging} title="Power Kit" body="An ESP32, 18650 cell, sensing, relays and 5V bus interface report stored energy and switch donor or receiver paths." />
            <Feature icon={RadioTower} title="Mesh gateway" body="A Raspberry Pi discovers nearby kits, forwards MAC-addressed telemetry and coordinates the local energy rail." />
            <Feature icon={Network} title="LT settlement" body="The receiver locks LT, telemetry proves delivery, and an append-only app-wallet ledger settles the donor. Stellar anchoring is optional." />
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild variant="outline"><Link to="/products">See the Power Kit <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
            <Button asChild variant="ghost"><a href="https://www.youtube.com/watch?v=nVcThM8WkUQ&t=7s" target="_blank" rel="noreferrer">Watch prototype video</a></Button>
          </div>
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="metric-panel"><p className="text-xl font-semibold font-mono sm:text-2xl">{value}</p><p className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p></div>;
}

function Feature({ icon: Icon, title, body }: { icon: any; title: string; body: string }) {
  return <Card><CardContent className="pt-5"><Icon className="mb-4 h-5 w-5 text-primary" /><h3 className="font-semibold">{title}</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p></CardContent></Card>;
}
