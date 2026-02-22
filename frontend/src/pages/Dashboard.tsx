import { useWallet } from "@/contexts/WalletContext";
import { useEffect, useState } from "react";
import {
  ArrowUpRight, ArrowDownLeft, TrendingUp, Users, ShoppingCart,
  Globe, History, ChevronRight, Battery, ArrowRight,
} from "lucide-react";
import { analyticsApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { toast } from "sonner";

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">{label}</p>
        <p className="text-xl font-bold text-foreground font-mono tracking-tight">{value}</p>
        {sub && <p className="text-[10px] text-primary mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function DonorView({ stats, transactions }: { stats: any; transactions: any[] }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Capacity" value={stats?.total_energy_traded ? `${stats.total_energy_traded} kWh` : "0 kWh"} />
        <StatCard label="Users" value={stats?.total_users || "0"} />
        <StatCard label="Orders" value={stats?.active_orders || "0"} />
        <StatCard label="Yield" value="4.2 XLM" sub="+5.2% APY" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Sell Excess Energy</CardTitle>
              <CardDescription className="text-xs">
                Distribute stored battery power to the grid and earn XLM rewards.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 flex-wrap">
                <Link to="/marketplace"><Button size="sm" className="text-xs h-8">Mint Tokens</Button></Link>
                <Link to="/marketplace"><Button size="sm" variant="outline" className="text-xs h-8">Create Order</Button></Link>
                <Link to="/register-node"><Button size="sm" variant="secondary" className="text-xs h-8">Link Hardware</Button></Link>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Globe className="w-3.5 h-3.5" /> Governance
                </CardTitle>
              </div>
              <Badge variant="outline" className="text-[9px] border-primary/30 text-primary">DAO Live</Badge>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between text-xs mb-1">
                <HoverCard>
                  <HoverCardTrigger asChild>
                    <span className="font-medium text-foreground cursor-help hover:text-primary transition-colors">
                      Proposal #42: Lower Distance Penalty
                    </span>
                  </HoverCardTrigger>
                  <HoverCardContent className="w-64">
                    <p className="text-xs text-muted-foreground">
                      Reduce the network transmission fee for long-distance trades by 15%.
                      Voting ends in 2d 4h.
                    </p>
                  </HoverCardContent>
                </HoverCard>
                <span className="text-[10px] text-muted-foreground font-mono">2d 4h</span>
              </div>
              <div className="flex items-center gap-3 mt-2">
                <Progress value={65} className="flex-1 h-1.5" />
                <span className="text-[10px] text-muted-foreground font-mono">65%</span>
                <Button size="sm" variant="outline" className="h-6 text-[10px] px-2">Vote</Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs flex items-center gap-1.5">
                <History className="w-3.5 h-3.5" /> Transactions
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {transactions && transactions.length > 0 ? (
                <Table>
                  <TableBody>
                    {transactions.slice(0, 6).map((tx: any) => (
                      <TableRow key={tx.id}>
                        <TableCell className="py-1.5">
                          <div className="flex items-center gap-1.5">
                            {tx.type === "buy" ? (
                              <ArrowDownLeft className="w-3 h-3 text-primary" />
                            ) : (
                              <ArrowUpRight className="w-3 h-3 text-accent" />
                            )}
                            <span className="text-[11px]">{tx.kwh_amount} kWh</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-1.5 text-right text-[11px] font-mono text-muted-foreground">
                          {tx.type === "buy" ? "-" : "+"}{tx.token_amount?.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-6">No transactions yet.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" /> DeFi Yield
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Earned</p>
                  <p className="text-lg font-bold font-mono">4.20</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">APY</p>
                  <p className="text-lg font-bold font-mono text-primary">5.2%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function RecipientView({ stats }: { stats: any }) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-16">
        <ShoppingCart className="w-8 h-8 text-muted-foreground mb-3" />
        <h2 className="text-sm font-semibold">Recipient Module</h2>
        <p className="text-xs text-muted-foreground">{stats?.total_iot_devices || "0"} Devices Monitored</p>
      </CardContent>
    </Card>
  );
}

function OperatorView({ stats }: { stats: any }) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-16">
        <Globe className="w-8 h-8 text-muted-foreground mb-3" />
        <h2 className="text-sm font-semibold">Node Operator</h2>
        <p className="text-xs text-muted-foreground">{stats?.total_network_nodes || "0"} Nodes</p>
      </CardContent>
    </Card>
  );
}

function RolePickerInline({ onSelect }: { onSelect: (role: "donor" | "recipient" | "operator") => void }) {
  const roles = [
    { id: "donor" as const, icon: Battery, title: "Energy Donor", tag: "Producer", description: "Tokenize and sell surplus energy from your solar panels or batteries." },
    { id: "recipient" as const, icon: ShoppingCart, title: "Energy Recipient", tag: "Consumer", description: "Browse and purchase clean energy tokens from local producers." },
    { id: "operator" as const, icon: Globe, title: "Node Operator", tag: "Infra", description: "Run grid infrastructure and earn rewards for network reliability." },
  ];

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center">
      <Badge variant="outline" className="text-[9px] font-mono tracking-widest mb-3 border-primary/30 text-primary">
        Step 2
      </Badge>
      <h2 className="text-xl font-bold text-foreground tracking-tight mb-1">Choose your role</h2>
      <p className="text-xs text-muted-foreground mb-8 max-w-sm text-center">
        This determines your dashboard view. You can switch anytime.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl w-full">
        {roles.map((r) => (
          <Card
            key={r.id}
            className="cursor-pointer group hover:border-primary/40 transition-all"
            onClick={() => onSelect(r.id)}
          >
            <CardContent className="pt-6 pb-5 flex flex-col items-center text-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <r.icon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">{r.title}</h3>
                <Badge variant="secondary" className="text-[8px] mt-1">{r.tag}</Badge>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{r.description}</p>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { publicKey, user, role, setRole, isAdmin, enableAdmin } = useWallet();
  const [activeRole, setActiveRole] = useState<"donor" | "recipient" | "operator">(role || "donor");
  const [stats, setStats] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [hasPickedRole, setHasPickedRole] = useState(!!role);

  useEffect(() => {
    if (role) {
      setActiveRole(role);
      setHasPickedRole(true);
    }
  }, [role]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, txRes] = await Promise.all([
          analyticsApi.getDashboard().catch(() => ({})),
          analyticsApi.getTransactions().catch(() => []),
        ]);
        setStats(statsRes.data ?? statsRes);
        setTransactions((txRes as any).data ?? txRes ?? []);
      } catch { }
    };
    fetchData();
  }, [user]);

  if (!publicKey) {
    return (
      <div className="min-h-screen pt-14 flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-4">Connect your wallet to continue.</p>
          <Link to="/"><Button size="sm">Connect</Button></Link>
        </div>
      </div>
    );
  }

  if (!hasPickedRole) {
    return (
      <div className="min-h-screen pt-20 pb-12 px-4">
        <div className="container mx-auto max-w-5xl">
          <RolePickerInline onSelect={(r) => {
            setRole(r);
            setHasPickedRole(true);
            toast.success(`Role set to ${r}`);
          }} />
        </div>
      </div>
    );
  }

  const walletDisplay = user?.wallet_address
    ? `${user.wallet_address.slice(0, 6)}…${user.wallet_address.slice(-4)}`
    : `${publicKey.slice(0, 6)}…${publicKey.slice(-4)}`;

  return (
    <div className="min-h-screen pt-20 pb-12 px-4">
      <div className="container mx-auto max-w-5xl">
        <div className="flex items-end justify-between mb-6">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-foreground tracking-tight">Dashboard</h1>
              <Badge variant="outline" className="text-[8px] font-mono tracking-wider border-primary/30 text-primary">
                Clearance: Granted
              </Badge>
            </div>
            <p className="text-[10px] text-muted-foreground font-mono mt-0.5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" />
              {walletDisplay}
            </p>
          </div>
          {!isAdmin && (
            <Button variant="ghost" size="icon" className="h-6 w-6 opacity-10 hover:opacity-100" onClick={enableAdmin}>
              <span className="text-[10px]">🔧</span>
            </Button>
          )}
        </div>

        <Tabs value={activeRole} onValueChange={(v) => { setActiveRole(v as "donor" | "recipient" | "operator"); setRole(v as "donor" | "recipient" | "operator"); }}>
          <TabsList className="h-8">
            <TabsTrigger value="donor" className="text-xs h-6 px-3">Donor</TabsTrigger>
            <TabsTrigger value="recipient" className="text-xs h-6 px-3">Recipient</TabsTrigger>
            <TabsTrigger value="operator" className="text-xs h-6 px-3">Operator</TabsTrigger>
          </TabsList>

          <div className="mt-5">
            <TabsContent value="donor"><DonorView stats={stats} transactions={transactions} /></TabsContent>
            <TabsContent value="recipient"><RecipientView stats={stats} /></TabsContent>
            <TabsContent value="operator"><OperatorView stats={stats} /></TabsContent>
          </div>
        </Tabs>

        {isAdmin && <AdminPanel />}
      </div>
    </div>
  );
}

function AdminPanel() {
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    analyticsApi.getDashboard().then((d) => setData(d)).catch(() => { });
  }, []);

  return (
    <div className="mt-8">
      <Separator className="mb-5" />
      <p className="text-[10px] uppercase tracking-widest text-destructive font-mono mb-2">Admin Debug</p>
      <Card className="border-destructive/20">
        <CardContent className="pt-3 pb-3">
          <pre className="text-[10px] text-muted-foreground overflow-auto max-h-40 font-mono">
            {JSON.stringify(data, null, 2) ?? "Loading..."}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
