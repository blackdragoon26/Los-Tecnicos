import { Network, ShieldCheck, Coins, Users, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const benefits = [
  { icon: Network, title: "Expand the Grid", desc: "Deploy local nodes to extend coverage in underserved areas." },
  { icon: Coins, title: "Earn Rewards", desc: "Get incentivized for every kilowatt traded through your infra." },
  { icon: ShieldCheck, title: "Governance", desc: "OGs get 3x voting power in the DAO." },
  { icon: Users, title: "Community", desc: "Exclusive access to core dev channels and early beta hardware." },
];

export default function Onboarding() {
  return (
    <div className="min-h-screen pt-20 pb-12 px-4">
      <div className="container mx-auto max-w-3xl">
        <div className="text-center mb-12">
          <Badge variant="outline" className="text-[9px] font-mono tracking-widest mb-3 border-primary/30 text-primary">
            Early Adopter Program
          </Badge>
          <h1 className="text-2xl font-bold text-foreground tracking-tight mb-2">Become an OG Node</h1>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Build the network, earn governance rights, and shape decentralized energy.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-12">
          {benefits.map((b, i) => (
            <Card key={b.title} className="group hover:border-primary/30 transition-colors">
              <CardContent className="py-4 flex items-start gap-3">
                <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                  <b.icon className="w-3.5 h-3.5 text-primary" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-foreground mb-0.5">{b.title}</h3>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{b.desc}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Separator className="mb-12" />

        <div className="text-center">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-mono mb-2">Ready?</p>
          <h2 className="text-lg font-bold text-foreground tracking-tight mb-2">Join the beta</h2>
          <p className="text-xs text-muted-foreground mb-6 max-w-xs mx-auto">
            Currently invite-only. Connect your wallet to check eligibility.
          </p>
          <div className="flex gap-3 justify-center">
            <Link to="/dashboard">
              <Button size="sm" className="gap-1.5 text-xs">
                Check Eligibility <ArrowRight className="w-3 h-3" />
              </Button>
            </Link>
            <Button variant="outline" size="sm" className="text-xs">Whitepaper</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
