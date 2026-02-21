import { Battery, Cpu, Wifi, Zap, Check } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

const specs = [
  "ESP32-S3 dual-core processor",
  "WiFi + BLE connectivity",
  "Smart BMS integration",
  "Soroban contract bridge",
  "Real-time voltage monitoring",
  "OTA firmware updates",
];

const features = [
  { icon: Wifi, title: "Always Connected", desc: "Seamless WiFi & MQTT for real-time trading." },
  { icon: Battery, title: "Smart BMS", desc: "Protects battery health while maximizing efficiency." },
  { icon: Zap, title: "Instant Settlement", desc: "Automated locking/unlocking based on payment." },
  { icon: Cpu, title: "Open Source", desc: "Fully hackable and customizable firmware." },
];

export default function Products() {
  return (
    <div className="min-h-screen pt-20 pb-12 px-4">
      <div className="container mx-auto max-w-4xl">
        <div className="text-center mb-16">
          <Badge variant="outline" className="text-[9px] font-mono tracking-widest mb-3 border-primary/30 text-primary">Hardware</Badge>
          <h1 className="text-2xl font-bold text-foreground tracking-tight mb-2">Stelltron Power Kit</h1>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            The essential hardware to join the decentralized energy network.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start mb-16">
          <Card>
            <CardContent className="pt-6">
              <div className="aspect-square w-full bg-secondary/50 rounded flex items-center justify-center">
                <Cpu className="w-16 h-16 text-muted-foreground/50" />
              </div>
              <p className="text-[10px] text-center text-muted-foreground mt-3 font-mono uppercase tracking-widest">ESP32 + Battery Pack</p>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-foreground tracking-tight mb-2">Smart Energy Controller</h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Our ESP32-based controller bridges your energy storage with the Stelltron network.
                It monitors battery levels, executes trade settlements via Soroban smart contracts,
                and controls energy flow automatically.
              </p>
            </div>

            <div className="space-y-1.5">
              {specs.map((spec) => (
                <div key={spec} className="flex items-center gap-2">
                  <Check className="w-3 h-3 text-primary shrink-0" />
                  <span className="text-[11px] text-muted-foreground">{spec}</span>
                </div>
              ))}
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-3">
              {features.map((f) => (
                <div key={f.title} className="flex gap-2">
                  <f.icon className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-[11px] font-semibold text-foreground">{f.title}</h3>
                    <p className="text-[10px] text-muted-foreground">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <Link to="/marketplace">
                <Button className="gap-2 text-xs">
                  <Zap className="w-3.5 h-3.5" /> Get the Kit — 50 XLM
                </Button>
              </Link>
              <span className="text-[10px] text-muted-foreground">Required for Donor Nodes</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
