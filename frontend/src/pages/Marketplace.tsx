import { useEffect, useState, useCallback } from "react";
import { ArrowUpRight, ArrowDownLeft, Search, Calculator } from "lucide-react";
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

export default function Marketplace() {
  const { user, isConnected, publicKey } = useWallet();
  const [orders, setOrders] = useState<any[]>([]);
  const [sellAmount, setSellAmount] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [buyAmount, setBuyAmount] = useState("");
  const [buyPrice, setBuyPrice] = useState("");
  const [marketData, setMarketData] = useState<any>(null);
  const [marketHistory, setMarketHistory] = useState<any[]>([]);
  const [activeTransfer, setActiveTransfer] = useState<any>(null);
  const [seenTxIds, setSeenTxIds] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(sessionStorage.getItem("seenTxIds") || "[]"));
    } catch {
      return new Set();
    }
  });

  const isAuthenticated = isConnected;

  const fetchMarketData = useCallback(async () => {
    try {
      const priceRes = await marketApi.getMarketPrice();
      const newData = priceRes.data ?? priceRes;
      setMarketData(newData);
      // Seed price inputs from market price on first load only
      setBuyPrice((prev) => prev || String(parseFloat(newData.price).toFixed(4)));
      setSellPrice((prev) => prev || String(parseFloat(newData.price).toFixed(4)));
      setMarketHistory((prev) => {
        const newPoint = {
          price: newData.price,
          timestamp: new Date(newData.timestamp || Date.now()).toLocaleTimeString([], {
            hour: "2-digit", minute: "2-digit", second: "2-digit",
          }),
        };
        const updated = [...prev, newPoint];
        return updated.length > 50 ? updated.slice(-50) : updated;
      });
    } catch (err) {
      console.error("Failed to fetch market data:", err);
    }
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await marketApi.getOrders();
      setOrders((res as any).data ?? res ?? []);
    } catch { }
  }, []);

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
  }, [isAuthenticated, fetchMarketData, fetchOrders, pollTransactions]);

  const handleCreateOrder = async (type: "buy" | "sell") => {
    const amount = type === "sell" ? sellAmount : buyAmount;
    const price = type === "sell" ? sellPrice : buyPrice;
    if (!amount || !price || !publicKey) return;

    try {
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

      toast.info(`Creating ${type} order on Los Tecnicos network...`);

      await marketApi.createOrder({
        type,
        kwh_amount: parseFloat(amount),
        token_price: parseFloat(price),
      });

      toast.success(`${type.toUpperCase()} order placed @ ${parseFloat(price).toFixed(4)} XLM/kWh`);
      await fetchOrders();
      await fetchMarketData();
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
  const sellOrders = orders.filter((o) => o.type === "sell").slice(0, 10);
  const buyOrders = orders.filter((o) => o.type === "buy").slice(0, 10);

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
                          {(parseFloat(buyAmount) * parseFloat(buyPrice)).toFixed(4)} XLM
                        </span>
                      </p>
                    )}
                    <Button
                      onClick={() => handleCreateOrder("buy")}
                      className="w-full text-xs h-9"
                      disabled={!buyAmount || !buyPrice}
                    >
                      Place Buy Order
                    </Button>
                  </TabsContent>

                  {/* ── SELL TAB ── */}
                  <TabsContent value="sell" className="mt-4 space-y-3">
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
                          {(parseFloat(sellAmount) * parseFloat(sellPrice)).toFixed(4)} XLM
                        </span>
                      </p>
                    )}
                    <Button
                      onClick={() => handleCreateOrder("sell")}
                      className="w-full text-xs h-9"
                      disabled={!sellAmount || !sellPrice}
                    >
                      Place Sell Order
                    </Button>
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
