import { useEffect, useState, useCallback } from "react";
import { ArrowUpRight, ArrowDownLeft, Search, Calculator, Plus, Wallet, Lock, CheckCircle2, Zap } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { analyticsApi, marketApi } from "@/lib/api";
import { Link } from "react-router-dom";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import EnergyTransferModal from "@/components/EnergyTransferModal";

const DEMO_SEED_ORDERS = [
  {
    id: "demo-ask-node-a",
    user_id: "NODE_A",
    type: "sell",
    kwh_amount: 2.4,
    token_price: 0.548,
    status: "Created",
    created_at: new Date().toISOString(),
  },
  {
    id: "demo-bid-community",
    user_id: "demo-community-buyer",
    type: "buy",
    kwh_amount: 1.8,
    token_price: 0.532,
    status: "Created",
    created_at: new Date().toISOString(),
  },
];

const readStoredDemoOrders = () => {
  try {
    const stored = JSON.parse(sessionStorage.getItem("stelltron_demo_orders") || "[]");
    return stored.length > 0 ? stored : DEMO_SEED_ORDERS;
  } catch {
    return DEMO_SEED_ORDERS;
  }
};

const withDemoTimeout = <T,>(promise: Promise<T>, timeoutMs = 3500) =>
  Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error("Backend demo request timed out")), timeoutMs);
    }),
  ]);

export default function Marketplace() {
  const {
    user,
    isConnected,
    publicKey,
    appWalletId,
    isDemo,
    demoProfile,
    demoBalance,
    topUpDemoBalance,
    debitDemoBalance,
    switchDemoProfile,
  } = useWallet();
  const [orders, setOrders] = useState<any[]>([]);
  const [sellAmount, setSellAmount] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [buyAmount, setBuyAmount] = useState("");
  const [buyPrice, setBuyPrice] = useState("");
  const [topUpAmount, setTopUpAmount] = useState("100");
  const [marketData, setMarketData] = useState<any>(null);
  const [marketHistory, setMarketHistory] = useState<any[]>([]);
  const [demoOrders, setDemoOrders] = useState<any[]>(readStoredDemoOrders);
  const [demoMarketMode, setDemoMarketMode] = useState<"backend" | "local">("backend");
  const [demoTradeStep, setDemoTradeStep] = useState<"open" | "locked" | "transferring" | "settled">("open");
  const [activeTransfer, setActiveTransfer] = useState<any>(null);
  const [seenTxIds, setSeenTxIds] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(sessionStorage.getItem("seenTxIds") || "[]"));
    } catch {
      return new Set();
    }
  });

  const isAuthenticated = isConnected;
  const pushMarketHistoryPoint = useCallback((price: number, timestamp = Date.now()) => {
    setMarketHistory((prev) => {
      const newPoint = {
        price,
        timestamp: new Date(timestamp).toLocaleTimeString([], {
          hour: "2-digit", minute: "2-digit", second: "2-digit",
        }),
      };
      const updated = [...prev, newPoint];
      return updated.length > 50 ? updated.slice(-50) : updated;
    });
  }, []);

  const synthesizeDemoMarket = useCallback(() => {
    const base = demoOrders.find((order) => order.type === "sell")?.token_price || 0.5;
    const supply = demoOrders.filter((order) => order.type === "sell").length;
    const demand = demoOrders.filter((order) => order.type === "buy").length;
    const price = Number((base + demand * 0.012 - supply * 0.006 + Math.sin(Date.now() / 12000) * 0.008).toFixed(4));
    const nextData = {
      price,
      supply,
      demand,
      timestamp: new Date().toISOString(),
      breakdown: { f_demo_liquidity: demand + supply, f_demo_variance: 0.008 },
    };
    setMarketData(nextData);
    setBuyPrice((prev) => prev || price.toFixed(4));
    setSellPrice((prev) => prev || price.toFixed(4));
    pushMarketHistoryPoint(price);
  }, [demoOrders, pushMarketHistoryPoint]);

  const fetchMarketData = useCallback(async () => {
    try {
      const priceRes = await withDemoTimeout(marketApi.getMarketPrice());
      const newData = priceRes.data ?? priceRes;
      setMarketData(newData);
      setDemoMarketMode("backend");
      // Seed price inputs from market price on first load only
      setBuyPrice((prev) => prev || String(parseFloat(newData.price).toFixed(4)));
      setSellPrice((prev) => prev || String(parseFloat(newData.price).toFixed(4)));
      pushMarketHistoryPoint(newData.price, newData.timestamp ? new Date(newData.timestamp).getTime() : Date.now());
    } catch (err) {
      console.error("Failed to fetch market data:", err);
      if (isDemo) {
        setDemoMarketMode("local");
        synthesizeDemoMarket();
      }
    }
  }, [isDemo, pushMarketHistoryPoint, synthesizeDemoMarket]);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await withDemoTimeout(marketApi.getOrders());
      setOrders((res as any).data ?? res ?? []);
      setDemoMarketMode("backend");
    } catch {
      if (isDemo) setDemoMarketMode("local");
    }
  }, [isDemo]);

  // Poll for matched transactions to trigger energy transfer modal
  const pollTransactions = useCallback(async () => {
    if (!publicKey) return;
    try {
      const res = await analyticsApi.getTransactions();
      const txns: any[] = (res as any).data ?? res ?? [];
      const now = new Date().getTime();
      const pending = txns.find(
        (t) => {
          const isUser = t.donor_id === user?.id || t.recipient_id === user?.id;
          const isPending = t.status === "Pending";
          const isUnseen = !seenTxIds.has(t.id);

          let isRecent = false;
          if (t.timestamp) {
            const txTime = new Date(t.timestamp).getTime();
            // Allow server to be up to 5 minutes ahead (clock skew), and transaction to be up to 60 seconds old
            const diff = now - txTime;
            isRecent = diff > -300000 && diff < 60000;
          }

          return isUser && isPending && isUnseen && isRecent;
        }
      );
      if (pending && !activeTransfer) {
        setSeenTxIds((prev) => {
          const next = new Set([...prev, pending.id]);
          sessionStorage.setItem("seenTxIds", JSON.stringify(Array.from(next)));
          return next;
        });
        setActiveTransfer(pending);
      }
    } catch { }
  }, [publicKey, user, seenTxIds, activeTransfer]);

  useEffect(() => {
    if (isAuthenticated) {
      if (isDemo) {
        setDemoMarketMode("local");
        synthesizeDemoMarket();
      }
      fetchOrders();
      fetchMarketData();
      const marketInterval = setInterval(() => {
        fetchMarketData();
        fetchOrders();
      }, 10000);
      const txInterval = setInterval(pollTransactions, 5000);
      return () => {
        clearInterval(marketInterval);
        clearInterval(txInterval);
      };
    }
  }, [isAuthenticated, isDemo, fetchMarketData, fetchOrders, pollTransactions, synthesizeDemoMarket]);

  const handleCreateOrder = async (type: "buy" | "sell") => {
    const amount = type === "sell" ? sellAmount : buyAmount;
    const price = type === "sell" ? sellPrice : buyPrice;
    const actorKey = appWalletId || publicKey || (isDemo ? `demo-${demoProfile || "wallet"}` : "");
    if (!amount || !price || !actorKey) {
      toast.error("Wallet session is not ready yet.");
      return;
    }
    const total = parseFloat(amount) * parseFloat(price);
    if (!Number.isFinite(total) || total <= 0) return;

    try {
      if (!isDemo) {
        const freighterApi = await import("@stellar/freighter-api");
        if (!(await freighterApi.isConnected())) {
          toast.error("Freighter wallet not connected.");
          return;
        }

        const contractId = import.meta.env.VITE_MARKETPLACE_CONTRACT_ID || "CCRWH4Q2OYXZDZFOG7EDPDKHLB7ZMIQ3SNAJY25C5SPAGHPHEWYXVCTP";
        if (!contractId || contractId.includes("XXXX")) {
          toast.error("Missing VITE_MARKETPLACE_CONTRACT_ID.");
          return;
        }
      } else if (type === "buy" && demoBalance < total) {
        toast.error("Demo wallet balance is too low. Add LT before placing this bid.");
        return;
      }

      toast.info(isDemo ? `Creating demo ${type} order...` : `Creating ${type} order on Los Tecnicos network...`);

      let backendOrder: any = null;
      try {
        backendOrder = await marketApi.createOrder({
          type,
          kwh_amount: parseFloat(amount),
          token_price: parseFloat(price),
        });
        setDemoMarketMode("backend");
      } catch (err) {
        if (!isDemo) throw err;
        setDemoMarketMode("local");
      }

      if (isDemo) {
        const order = backendOrder?.id
          ? backendOrder
          : {
              id: `demo-${Date.now()}`,
              user_id: actorKey,
              type,
              kwh_amount: parseFloat(amount),
              token_price: parseFloat(price),
              status: "Created",
              created_at: new Date().toISOString(),
            };
        setDemoOrders((current) => {
          const next = [order, ...current].slice(0, 20);
          try {
            sessionStorage.setItem("stelltron_demo_orders", JSON.stringify(next));
          } catch {}
          return next;
        });
        setMarketData((current: any) => ({
          ...(current || {}),
          price: parseFloat(price),
          timestamp: new Date().toISOString(),
          supply: type === "sell" ? (current?.supply || 0) + 1 : current?.supply || 0,
          demand: type === "buy" ? (current?.demand || 0) + 1 : current?.demand || 0,
        }));
        pushMarketHistoryPoint(parseFloat(price));
      }

      if (isDemo && type === "buy") {
        debitDemoBalance(total);
      }

      toast.success(`${type.toUpperCase()} order placed @ ${parseFloat(price).toFixed(4)} XLM/kWh`);
      if (isDemo) {
        void fetchOrders();
        void fetchMarketData();
      } else {
        await fetchOrders();
        await fetchMarketData();
      }
      if (type === "sell") {
        setSellAmount("");
      } else {
        setBuyAmount("");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to create order");
    }
  };

  const currentPrice = marketData?.price || 0;
  const storedDemoOrders = isDemo ? readStoredDemoOrders() : [];
  const mergedDemoOrders = [...demoOrders, ...storedDemoOrders].filter(
    (order, index, all) => all.findIndex((candidate) => candidate.id === order.id) === index,
  );
  const displayOrders = isDemo ? [...mergedDemoOrders, ...orders] : orders;
  const sellOrders = displayOrders.filter((o) => o.type === "sell").slice(0, 10);
  const buyOrders = displayOrders.filter((o) => o.type === "buy").slice(0, 10);
  const buyTotal = buyAmount && buyPrice ? parseFloat(buyAmount) * parseFloat(buyPrice) : 0;
  const demoTransferPrice = 1.8 * 0.532;

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen pt-14 flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-4">Connect wallet for marketplace access.</p>
          <Link to="/"><Button size="sm">Connect</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20 pb-12 px-4">
      {/* Energy Transfer Modal */}
      <EnergyTransferModal
        transfer={activeTransfer}
        currentUserId={user?.id ?? ""}
        onClose={() => setActiveTransfer(null)}
      />

      <div className="container mx-auto max-w-5xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">Market</h1>
            {marketData && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-lg font-mono font-bold">{parseFloat(marketData.price).toFixed(4)}</span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">XLM/kWh</span>
                <Badge variant="outline" className="text-[9px] gap-1 border-primary/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block animate-pulse" />
                  Live
                </Badge>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isDemo && (
              <Badge variant="outline" className="h-8 border-primary/30 bg-primary/10 px-3 text-[10px] text-primary">
                App wallet · {demoMarketMode === "backend" ? "backend" : "local demo"}
              </Badge>
            )}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground w-3 h-3" />
              <Input placeholder="Search…" className="pl-7 w-48 h-8 text-xs" />
            </div>
            <Link to="/formula">
              <Button variant="outline" size="sm" className="text-[10px] gap-1 h-8">
                <Calculator className="w-3 h-3" /> Formula
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            {isDemo && (
              <Card>
                <CardContent className="space-y-4 pt-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded bg-primary/10">
                        <Wallet className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs font-medium">Stelltron App Wallet</p>
                        <p className="font-mono text-lg font-bold">{demoBalance.toFixed(2)} LT</p>
                        <p className="font-mono text-[10px] text-muted-foreground">{demoProfile === "donor" ? "Demo donor account" : "Demo receiver account"}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant={demoProfile === "receiver" ? "default" : "outline"}
                        className="h-8 text-xs"
                        onClick={() => switchDemoProfile("receiver")}
                      >
                        Receiver
                      </Button>
                      <Button
                        size="sm"
                        variant={demoProfile === "donor" ? "default" : "outline"}
                        className="h-8 text-xs"
                        onClick={() => switchDemoProfile("donor")}
                      >
                        Donor
                      </Button>
                      <Input
                        type="number"
                        min="1"
                        value={topUpAmount}
                        onChange={(e) => setTopUpAmount(e.target.value)}
                        className="h-8 w-24 font-mono text-xs"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1.5 text-xs"
                        onClick={() => {
                          const value = Number(topUpAmount);
                          if (!Number.isFinite(value) || value <= 0) {
                            toast.error("Enter a valid top-up amount.");
                            return;
                          }
                          topUpDemoBalance(value);
                          toast.success(`Added ${value.toFixed(2)} LT to ${demoProfile === "donor" ? "donor" : "receiver"} app wallet`);
                        }}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add LT
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-md border border-border/50 bg-background/40 p-3">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-medium">Two-user demo trade</p>
                        <p className="text-[11px] text-muted-foreground">Receiver locks LT, donor hardware supplies 1.8 kWh, then funds settle.</p>
                      </div>
                      <Badge variant="outline" className="text-[9px] border-primary/30 text-primary">{demoTradeStep}</Badge>
                    </div>
                    <div className="mb-3 grid grid-cols-3 gap-2 text-[10px]">
                      <div className="rounded bg-muted/30 p-2">
                        <p className="uppercase tracking-widest text-muted-foreground">Donor</p>
                        <p className="font-mono text-foreground">NODE_A</p>
                      </div>
                      <div className="rounded bg-muted/30 p-2">
                        <p className="uppercase tracking-widest text-muted-foreground">Receiver</p>
                        <p className="font-mono text-foreground">Community Buyer</p>
                      </div>
                      <div className="rounded bg-muted/30 p-2">
                        <p className="uppercase tracking-widest text-muted-foreground">Escrow</p>
                        <p className="font-mono text-foreground">{demoTransferPrice.toFixed(4)} LT</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        className="h-8 gap-1.5 text-xs"
                        disabled={demoTradeStep !== "open"}
                        onClick={() => {
                          if (demoProfile !== "receiver") {
                            toast.error("Switch to Receiver account to lock buyer funds.");
                            return;
                          }
                          if (!debitDemoBalance(demoTransferPrice)) {
                            toast.error("Receiver wallet needs more LT.");
                            return;
                          }
                          setDemoTradeStep("locked");
                          toast.success("Receiver funds locked in app escrow.");
                        }}
                      >
                        <Lock className="h-3.5 w-3.5" />
                        Lock receiver funds
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1.5 text-xs"
                        disabled={demoTradeStep !== "locked"}
                        onClick={() => {
                          setDemoTradeStep("transferring");
                          toast.info("Donor hardware supplying energy through local mesh server.");
                          window.setTimeout(() => setDemoTradeStep("settled"), 1200);
                        }}
                      >
                        <Zap className="h-3.5 w-3.5" />
                        Transfer energy
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1.5 text-xs"
                        disabled={demoTradeStep !== "settled"}
                        onClick={() => {
                          toast.success("Trade settled: energy delivered and donor credited.");
                          setDemoTradeStep("open");
                        }}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Settle
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Chart */}
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-xs">Price History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[200px]">
                  {marketHistory.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={marketHistory}>
                        <defs>
                          <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(75,38%,42%)" stopOpacity={0.15} />
                            <stop offset="95%" stopColor="hsl(75,38%,42%)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,8%,28%)" vertical={false} />
                        <XAxis dataKey="timestamp" tick={{ fill: "hsl(220,6%,55%)", fontSize: 9 }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fill: "hsl(220,6%,55%)", fontSize: 9 }} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
                        <Tooltip contentStyle={{ background: "hsl(220,10%,22%)", border: "1px solid hsl(220,8%,28%)", borderRadius: 4, color: "hsl(60,6%,90%)", fontSize: 11 }} />
                        <Area type="monotone" dataKey="price" stroke="hsl(75,38%,42%)" strokeWidth={1.5} fillOpacity={1} fill="url(#colorPrice)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center">
                      <p className="text-xs text-muted-foreground">Starting live tracking…</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Order Forms */}
            <Card>
              <CardContent className="pt-5">
                <Tabs defaultValue="buy">
                  <TabsList className="w-full h-8">
                    <TabsTrigger value="buy" className="flex-1 gap-1 text-xs h-6"><ArrowDownLeft className="w-3 h-3" /> Buy</TabsTrigger>
                    <TabsTrigger value="sell" className="flex-1 gap-1 text-xs h-6"><ArrowUpRight className="w-3 h-3" /> Sell</TabsTrigger>
                  </TabsList>

                  {/* ── BUY TAB ── */}
                  <TabsContent value="buy" className="mt-4 space-y-3">
                    <form
                      className="space-y-3"
                      onSubmit={(event) => {
                        event.preventDefault();
                        handleCreateOrder("buy");
                      }}
                    >
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase tracking-wider">Amount (kWh)</Label>
                        <Input
                          type="number"
                          placeholder="0.00"
                          value={buyAmount}
                          onChange={(e) => setBuyAmount(e.target.value)}
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase tracking-wider">
                          Limit Price (XLM/kWh)
                          <span className="ml-1 text-muted-foreground normal-case tracking-normal font-normal">
                            — editable
                          </span>
                        </Label>
                        <Input
                          type="number"
                          step="0.0001"
                          placeholder={currentPrice > 0 ? currentPrice.toFixed(4) : "0.0000"}
                          value={buyPrice}
                          onChange={(e) => setBuyPrice(e.target.value)}
                          className="h-9 font-mono"
                        />
                      </div>
                      {buyAmount && buyPrice && parseFloat(buyPrice) > 0 && (
                        <p className="text-[11px] text-muted-foreground">
                          Total: <span className="font-medium text-foreground font-mono">
                            {buyTotal.toFixed(4)} {isDemo ? "LT" : "XLM"}
                          </span>
                          {isDemo && buyTotal > demoBalance && (
                            <span className="ml-2 text-destructive">insufficient demo balance</span>
                          )}
                        </p>
                      )}
                      <Button
                        type="submit"
                        className="w-full text-xs h-9"
                        disabled={!buyAmount || !buyPrice || (isDemo && buyTotal > demoBalance)}
                      >
                        {isDemo ? "Place Demo Buy Order" : "Place Buy Order"}
                      </Button>
                    </form>
                  </TabsContent>

                  {/* ── SELL TAB ── */}
                  <TabsContent value="sell" className="mt-4 space-y-3">
                    <form
                      className="space-y-3"
                      onSubmit={(event) => {
                        event.preventDefault();
                        handleCreateOrder("sell");
                      }}
                    >
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase tracking-wider">Amount (kWh)</Label>
                        <Input
                          type="number"
                          placeholder="0.00"
                          value={sellAmount}
                          onChange={(e) => setSellAmount(e.target.value)}
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase tracking-wider">
                          Ask Price (XLM/kWh)
                          <span className="ml-1 text-muted-foreground normal-case tracking-normal font-normal">
                            — editable
                          </span>
                        </Label>
                        <Input
                          type="number"
                          step="0.0001"
                          placeholder={currentPrice > 0 ? currentPrice.toFixed(4) : "0.0000"}
                          value={sellPrice}
                          onChange={(e) => setSellPrice(e.target.value)}
                          className="h-9 font-mono"
                        />
                      </div>
                      {sellAmount && sellPrice && parseFloat(sellPrice) > 0 && (
                        <p className="text-[11px] text-muted-foreground">
                          Total: <span className="font-medium text-foreground font-mono">
                            {(parseFloat(sellAmount) * parseFloat(sellPrice)).toFixed(4)} {isDemo ? "LT" : "XLM"}
                          </span>
                        </p>
                      )}
                      <Button
                        type="submit"
                        className="w-full text-xs h-9"
                        disabled={!sellAmount || !sellPrice}
                      >
                        {isDemo ? "Place Demo Sell Order" : "Place Sell Order"}
                      </Button>
                    </form>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          {/* Order Book */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs">Order Book</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="px-4 pb-2">
                <p className="text-[10px] font-mono uppercase tracking-widest text-destructive mb-1.5">Asks</p>
                {sellOrders.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground text-center py-3">—</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[10px] h-6">kWh</TableHead>
                        <TableHead className="text-[10px] h-6 text-right">Price</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sellOrders.map((order, i) => (
                        <TableRow key={order.id || i}>
                          <TableCell className="py-1 text-[11px] font-mono">{order.kwh_amount}</TableCell>
                          <TableCell className="py-1 text-[11px] font-mono text-right">{parseFloat(order.token_price).toFixed(4)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
              <Separator />
              <div className="px-4 pt-2 pb-3">
                <p className="text-[10px] font-mono uppercase tracking-widest text-primary mb-1.5">Bids</p>
                {buyOrders.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground text-center py-3">—</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[10px] h-6">kWh</TableHead>
                        <TableHead className="text-[10px] h-6 text-right">Price</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {buyOrders.map((order, i) => (
                        <TableRow key={order.id || i}>
                          <TableCell className="py-1 text-[11px] font-mono">{order.kwh_amount}</TableCell>
                          <TableCell className="py-1 text-[11px] font-mono text-right">{parseFloat(order.token_price).toFixed(4)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
