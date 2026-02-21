import { useWallet } from "@/contexts/WalletContext";
import { useNavigate } from "react-router-dom";
import { Battery, ShoppingCart, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function RoleSelect() {
  const { publicKey, setRole } = useWallet();
  const navigate = useNavigate();

  const handleSelect = async (role: "donor" | "recipient") => {
    setRole(role);
    toast.success(`Registered as ${role}`);
    navigate("/dashboard");
  };

  const roles = [
    {
      id: "donor" as const,
      icon: Battery,
      title: "Energy Donor",
      tag: "Producer",
      description: "You produce renewable energy and want to share or sell your surplus to the network.",
    },
    {
      id: "recipient" as const,
      icon: ShoppingCart,
      title: "Energy Recipient",
      tag: "Consumer",
      description: "You want to purchase clean energy from community producers at fair prices.",
    },
  ];

  return (
    <div className="min-h-screen pt-14 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-10">
          <p className="text-[10px] uppercase tracking-[0.2em] text-primary font-mono mb-2">Step 2</p>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Choose Your Role</h1>
          <p className="text-xs text-muted-foreground mt-1.5">How do you want to participate?</p>
        </div>

        <div className="grid gap-3">
          {roles.map((r) => (
            <Card
              key={r.id}
              className="cursor-pointer group hover:border-primary/40 transition-all duration-200"
              onClick={() => handleSelect(r.id)}
            >
              <CardContent className="py-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                  <r.icon className="w-4.5 h-4.5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-foreground">{r.title}</h3>
                    <Badge variant="outline" className="text-[9px] py-0 px-1.5 border-primary/20 text-primary">{r.tag}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{r.description}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
