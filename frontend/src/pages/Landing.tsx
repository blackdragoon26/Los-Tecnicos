import { useWallet } from "@/contexts/WalletContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Battery, Repeat, Users, Zap, Globe, Shield, BarChart3, Lock, Radio, Eye } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Progress } from "@/components/ui/progress";
import stelltronLogo from "@/assets/stelltron-logo-new.png";

const features = [
  {
    icon: Battery,
    title: "Donate",
    code: "STL-001",
    description: "Donor homes publish surplus battery energy through the controller hardware and make it available to nearby receivers.",
  },
  {
    icon: Repeat,
    title: "Trade",
    code: "STL-002",
    description: "Receivers lock app-wallet funds, donor hardware supplies verified kWh, and the marketplace settles the transfer.",
  },
  {
    icon: Users,
    title: "Power",
    code: "STL-003",
    description: "Local mesh servers coordinate nearby donor and receiver kits so energy can move where it is needed.",
  },
];

const stats = [
  { label: "Nodes", value: "1,240", suffix: "+", detail: "Active grid nodes across 12 regions" },
  { label: "Traded", value: "58", suffix: " MWh", detail: "Total energy volume this quarter" },
  { label: "Donors", value: "320", suffix: "", detail: "Verified energy producers with controller kits" },
  { label: "Txns", value: "12.8k", suffix: "+", detail: "App-wallet energy settlements processed" },
];

const faqs = [
  {
    q: "How does energy trading work?",
    a: "Donor hardware reports stored energy to a local mesh server. Receivers lock app-wallet funds, the controller supplies verified kWh, and the software settles the transfer.",
  },
  {
    q: "What hardware do I need?",
    a: "Users buy a donor-receiver controller kit for their room or home. A local mesh server coordinates nearby kits and relays pings between mesh areas.",
  },
  {
    q: "Is it really decentralized?",
    a: "The energy layer is local-first: nearby mesh servers discover kits, coordinate supply and receive paths, and keep the market running even when live hardware is unavailable in demo mode.",
  },
];

const protocols = [
  { icon: Lock, label: "End-to-end encrypted", status: "ACTIVE" },
  { icon: Radio, label: "Mesh relay protocol", status: "ACTIVE" },
  { icon: Eye, label: "App-wallet settlement log", status: "MONITORING" },
];

export default function Landing() {
  const { isConnected, connect, connectDemo } = useWallet();
  const navigate = useNavigate();

  const handleConnect = async () => {
    if (isConnected) {
      navigate("/dashboard");
      return;
    }
    try {
      await connect();
      toast.success("Wallet connected!");
      navigate("/dashboard");
    } catch (err: any) {
      toast.error(err.message || "Failed to connect wallet");
    }
  };

  const handleDemoConnect = async (profile: "donor" | "receiver") => {
    try {
      await connectDemo(profile);
      toast.success(`${profile === "donor" ? "Donor" : "Receiver"} demo wallet ready.`);
      navigate("/dashboard");
    } catch (err: any) {
      toast.error(err.message || "Failed to start demo wallet");
    }
  };

  return (
    <div className="min-h-screen pt-14">
      {/* Hero — classified dossier style */}
      <section className="relative flex flex-col items-center justify-center min-h-[85vh] px-4 scanlines overflow-hidden">

        <div className="flex flex-col items-center gap-5 max-w-2xl text-center relative z-10">
          <img
            src={stelltronLogo}
            alt="Stelltron"
            className="w-20 h-20 mb-2 flicker"
          />

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[9px] font-mono tracking-[0.25em] uppercase border-primary/30 text-primary">
              Project: Stelltron
            </Badge>
            <Badge variant="secondary" className="text-[9px] font-mono tracking-wider uppercase">
              Clearance: Public
            </Badge>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter text-foreground leading-[0.9]">
            Green Energy
            <br />
            <span className="text-primary">Marketplace</span>
          </h1>

          <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
            Donate or trade surplus stored energy through local donor-receiver hardware and mesh servers.
            <br />
            <span className="font-mono text-[10px]">App wallet funds. Hardware pings. Verified kWh delivery.</span>
          </p>

          {/* Redacted intel line */}
          <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
            <span>Soldering circuits on</span>
            <HoverCard>
              <HoverCardTrigger asChild>
                <span className="redacted px-6 cursor-help">██████████</span>
              </HoverCardTrigger>
              <HoverCardContent className="w-48">
                <p className="text-xs font-mono"><a href="https://www.youtube.com/watch?v=nVcThM8WkUQ&t=7s" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Hardware demo video</a></p>
                <p className="text-[10px] text-muted-foreground mt-1">ESP32 node and local Pi controller reference</p>
              </HoverCardContent>
            </HoverCard>
          </div>

          <div className="flex gap-3 mt-3">
            <Button onClick={handleConnect} size="lg" className="gap-2 text-sm">
              <Zap className="w-4 h-4" />
              {isConnected ? "Dashboard" : "Connect Wallet"}
            </Button>
            {!isConnected && (
              <>
                <Button onClick={() => handleDemoConnect("receiver")} variant="secondary" size="lg" className="gap-2 text-sm">
                  Receiver Demo
                </Button>
                <Button onClick={() => handleDemoConnect("donor")} variant="outline" size="lg" className="gap-2 text-sm">
                  Donor Demo
                </Button>
              </>
            )}
            <Button
              variant="outline"
              size="lg"
              className="text-sm"
              onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
            >
              Learn More <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Stats bar — dossier data row */}
      <div className="border-y border-border/50">
        <div className="container mx-auto max-w-4xl py-8 px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.map((s) => (
              <HoverCard key={s.label}>
                <HoverCardTrigger asChild>
                  <Card className="cursor-default hover:border-primary/30 transition-colors">
                    <CardContent className="pt-4 pb-3 text-center">
                      <div className="text-2xl md:text-3xl font-bold text-foreground tracking-tight font-mono">
                        {s.value}<span className="text-primary text-lg">{s.suffix}</span>
                      </div>
                      <div className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground mt-1 font-mono">{s.label}</div>
                    </CardContent>
                  </Card>
                </HoverCardTrigger>
                <HoverCardContent className="w-52">
                  <p className="text-xs text-muted-foreground">{s.detail}</p>
                </HoverCardContent>
              </HoverCard>
            ))}
          </div>
        </div>
      </div>

      {/* Features — file cards */}
      <section id="features" className="py-24 px-4">
        <div className="container mx-auto max-w-3xl">
          <div className="flex items-center gap-3 justify-center mb-3">
            <Separator className="w-8" />
            <p className="text-[9px] uppercase tracking-[0.3em] text-primary font-mono">Operations Manual</p>
            <Separator className="w-8" />
          </div>
          <h2 className="text-2xl font-bold text-center mb-16 text-foreground tracking-tight">
            Three steps to clean energy
          </h2>

          <div className="grid md:grid-cols-3 gap-5">
            {features.map((f) => (
              <Card key={f.title} className="group hover:border-primary/30 transition-all relative overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                      <f.icon className="w-4 h-4 text-primary" />
                    </div>
                    <Badge variant="outline" className="text-[8px] font-mono tracking-wider border-border text-muted-foreground">
                      {f.code}
                    </Badge>
                  </div>
                  <CardTitle className="text-sm mt-3">{f.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground leading-relaxed">{f.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Protocol status — trust signals reimagined */}
      <div className="border-y border-border/50 py-8 px-4">
        <div className="container mx-auto max-w-3xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {protocols.map((p) => (
              <div key={p.label} className="flex items-center gap-3 px-3 py-2.5 rounded-md bg-secondary/50">
                <p.icon className="w-4 h-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{p.label}</p>
                </div>
                <Badge variant="outline" className="text-[8px] font-mono tracking-wider border-primary/30 text-primary shrink-0">
                  {p.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Network progress — live ops */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-xl">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Radio className="w-3.5 h-3.5 text-primary" />
                  Network Status
                </CardTitle>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  <span className="text-[9px] font-mono text-primary uppercase tracking-wider">Live</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px] font-mono">
                  <span className="text-muted-foreground">Grid capacity</span>
                  <span className="text-foreground">78%</span>
                </div>
                <Progress value={78} className="h-1.5" />
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px] font-mono">
                  <span className="text-muted-foreground">Node uptime</span>
                  <span className="text-foreground">99.2%</span>
                </div>
                <Progress value={99} className="h-1.5" />
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px] font-mono">
                  <span className="text-muted-foreground">Tx throughput</span>
                  <span className="text-foreground">42%</span>
                </div>
                <Progress value={42} className="h-1.5" />
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-xl">
          <div className="flex items-center gap-3 justify-center mb-3">
            <Separator className="w-8" />
            <p className="text-[9px] uppercase tracking-[0.3em] text-primary font-mono">Intel Briefing</p>
            <Separator className="w-8" />
          </div>
          <h2 className="text-xl font-bold text-center mb-8 text-foreground tracking-tight">
            Common questions
          </h2>
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, i) => (
              <AccordionItem key={i} value={`item-${i}`}>
                <AccordionTrigger className="text-sm text-left hover:no-underline">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-xs text-muted-foreground leading-relaxed">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-xl text-center">
          <Card className="border-primary/20 bg-primary/5 relative overflow-hidden">
            {/* Diagonal classified watermark */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] rotate-[-15deg]">
              <span className="text-[80px] font-mono font-bold uppercase tracking-[0.3em] text-foreground whitespace-nowrap">
                Stelltron
              </span>
            </div>
            <CardContent className="pt-8 pb-8 relative z-10">
              <img src={stelltronLogo} alt="Stelltron" className="w-10 h-10 mx-auto mb-4 opacity-60" />
              <h2 className="text-lg font-bold text-foreground tracking-tight mb-2">Ready to trade clean energy?</h2>
              <p className="text-xs text-muted-foreground mb-6 max-w-xs mx-auto">
                Join 320+ donors already powering communities with renewable energy.
              </p>
              <div className="flex gap-3 justify-center">
                <Button onClick={handleConnect} className="gap-2 text-xs">
                  <Zap className="w-3.5 h-3.5" />
                  {isConnected ? "Go to Dashboard" : "Get Started"}
                </Button>
                <Link to="/products">
                  <Button variant="outline" className="text-xs">View Hardware</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8 px-4">
        <div className="container mx-auto max-w-4xl flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src={stelltronLogo} alt="Stelltron" className="w-4 h-4 opacity-50" />
            <span className="text-xs font-medium text-foreground tracking-tight">Stelltron</span>
            <Badge variant="outline" className="text-[7px] font-mono tracking-wider border-border text-muted-foreground ml-1">
              v0.1.0
            </Badge>
          </div>
          <p className="text-[10px] text-muted-foreground font-mono">
            © 2026 Stelltron — Decentralized energy for a sustainable future.
          </p>
          <div className="flex gap-5 text-[11px] text-muted-foreground">
            <a href="https://stelltron-docs.vercel.app/" className="hover:text-foreground transition-colors">Docs</a>
            <a href="https://github.com/blackdragoon26/Los-Tecnicos" className="hover:text-foreground transition-colors">GitHub</a>
            <a href="https://x.com/stelltron" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">𝕏</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
