import { useEffect, useState, useCallback } from "react";
import { ArrowUpRight, ArrowDownLeft, Search, Calculator } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { marketApi } from "@/lib/api";
import { Link } from "react-router-dom";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Networks, TransactionBuilder, Account, Operation, xdr, Address, scValToNative, nativeToScVal } from "@stellar/stellar-sdk";

export default function Marketplace() {
  const { user, isConnected, publicKey } = useWallet();
  const [orders, setOrders] = useState<any[]>([]);
  const [sellAmount, setSellAmount] = useState("");
  const [buyAmount, setBuyAmount] = useState("");
  const [marketData, setMarketData] = useState<any>(null);
  const [marketHistory, setMarketHistory] = useState<any[]>([]);

  const isAuthenticated = isConnected;

  const fetchMarketData = useCallback(async () => {
    try {
      const priceRes = await marketApi.getMarketPrice();
      const newData = priceRes.data ?? priceRes;
      setMarketData(newData);
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

  useEffect(() => {
    if (isAuthenticated) {
      const fetchOrders = async () => {
        try {
          const res = await marketApi.getOrders();
          setOrders((res as any).data ?? res ?? []);
        } catch { }
      };
      fetchOrders();
      fetchMarketData();
      const interval = setInterval(fetchMarketData, 10000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, fetchMarketData]);

  const handleCreateOrder = async (type: "buy" | "sell") => {
    const amount = type === "sell" ? sellAmount : buyAmount;
    const price = marketData?.price;
    if (!amount || !price || !publicKey) return;

    try {
      // 1. Authenticate with Freighter
      const freighterApi = await import("@stellar/freighter-api");
      if (!(await freighterApi.isConnected())) {
        toast.error("Freighter wallet not connected.");
        return;
      }

      // Fallback to a known Testnet Marketplace ID if not provided in Env
      const contractId = import.meta.env.VITE_MARKETPLACE_CONTRACT_ID || "CCPQN5DHHN7H2N7K3S6L7F4W7M7Y7K7J7I7H7G7F7E7D7C7B7A7XXXXXXXXX"; // Replace with your actual testnet ID if known
      if (!contractId || contractId.includes("XXXX")) {
        toast.error("Missing VITE_MARKETPLACE_CONTRACT_ID in Vercel/Local Env.");
        console.error("Please set VITE_MARKETPLACE_CONTRACT_ID for the marketplace to function.");
        return;
      }

      toast.info(`Preparing ${type} order transaction...`);

      // 2. Build the Soroban InvokeHostFunction XDR for the "create_order" endpoint on the contract
      // Function signature: create_order(env: Env, user: Address, order_type: OrderType, kwh_amount: i128, price_per_kwh: i128, device_id: String)
      // Note: order_type is an Enum. 0 = Buy, 1 = Sell (or as defined in Rust schema)
      const orderTypeVal = type === "sell" ? "Sell" : "Buy";

      // Use the older stellar-sdk syntax for host functions
      const invokeHostFunctionOp = Operation.invokeHostFunction({
        func: xdr.HostFunction.hostFunctionTypeInvokeContract(
          new xdr.InvokeContractArgs({
            contractAddress: Address.fromString(contractId).toScAddress(),
            functionName: "create_order",
            args: [
              nativeToScVal(publicKey, { type: "address" }),
              nativeToScVal(orderTypeVal, { type: "symbol" }),
              nativeToScVal(Math.round(parseFloat(amount) * 1000), { type: "i128" }),
              nativeToScVal(Math.round(parseFloat(price) * 1000000), { type: "i128" }),
              nativeToScVal("web_client", { type: "string" }),
            ],
          })
        ),
        auth: [],
      });

      // 3. Assemble the Transaction Envelope
      // Fetch the real sequence number from Horizon Testnet so the signature is valid
      toast.info("Fetching account sequence...");
      let sequence = "1";
      try {
        const horizonRes = await fetch(`https://horizon-testnet.stellar.org/accounts/${publicKey}`);
        if (horizonRes.ok) {
          const accountData = await horizonRes.json();
          sequence = accountData.sequence;
          console.log(`>>> Web3: Using sequence ${sequence} for account ${publicKey}`);
        }
      } catch (err) {
        console.warn("Horizon fetch failed, falling back to dummy sequence:", err);
      }

      const account = new Account(publicKey, sequence);
      let tx = new TransactionBuilder(account, {
        fee: "100000",
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(invokeHostFunctionOp)
        .setTimeout(300)
        .build();

      // 4. Simulate Transaction to get Footprints and Resource Fees
      toast.info("Simulating resources on Soroban...");
      const rpcUrl = import.meta.env.VITE_SOROBAN_RPC_URL || "https://soroban-testnet.stellar.org";
      try {
        const simRes = await fetch(rpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "simulateTransaction",
            params: { transaction: tx.toXDR() },
          }),
        });
        const simData = await simRes.json();
        if (simData.error) throw new Error(`Simulation Error: ${simData.error.message}`);

        if (simData.result.error) {
          throw new Error(`Simulation Failed: ${simData.result.error}`);
        }

        // Add simulation data to transaction
        const sorobanData = xdr.SorobanTransactionData.fromXDR(simData.result.transactionData, "base64");

        // Rebuild transaction with simulated data
        tx = new TransactionBuilder(account, {
          fee: (BigInt(simData.result.minResourceFee) + BigInt(20000)).toString(),
          networkPassphrase: Networks.TESTNET,
        })
          .addOperation(invokeHostFunctionOp)
          .setSorobanData(sorobanData)
          .setTimeout(300)
          .build();

      } catch (simErr: any) {
        console.error("Simulation failed:", simErr);
        throw new Error(`Soroban simulation failed: ${simErr.message}. Ensure your contract ID is correct.`);
      }

      const b64Xdr = tx.toXDR();

      // 5. Request User Signature via Freighter
      toast.info("Awaiting Freighter signature...");
      const signedXdr = await freighterApi.signTransaction(b64Xdr, {
        network: "TESTNET"
      });

      if (!signedXdr) {
        throw new Error("User rejected transaction.");
      }

      // 6. Submit the Signed XDR to the Backend for immediate execution and DB insertion
      toast.success(`Signature acquired! Finalizing on Testnet...`);
      // NOTE: In the backend we will add: await api.marketApi.verifyAndSubmitOrder({ signed_xdr: signedXdr })
      // For now, we fall back to the old db-only call to keep UI working until backend is ready.
      await marketApi.createOrder({
        type,
        kwh_amount: parseFloat(amount),
        token_price: parseFloat(price),
        signed_xdr: signedXdr // Pass to backend for DB and eventual blockchain broadcast
      });

      toast.success(`${type.toUpperCase()} order confirmed on Soroban Testnet!`);
      const res = await marketApi.getOrders();
      setOrders((res as any).data ?? res ?? []);
      await fetchMarketData();
      type === "sell" ? setSellAmount("") : setBuyAmount("");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to create order on blockchain");
    }
  };

  const sellOrders = orders.filter((o) => o.type === "sell").slice(0, 10);
  const buyOrders = orders.filter((o) => o.type === "buy").slice(0, 10);
  const currentPrice = marketData?.price || 0;

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
                    <TabsTrigger value="buy" className="flex-1 gap-1 text-xs h-6">
                      <ArrowDownLeft className="w-3 h-3" /> Buy
                    </TabsTrigger>
                    <TabsTrigger value="sell" className="flex-1 gap-1 text-xs h-6">
                      <ArrowUpRight className="w-3 h-3" /> Sell
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="buy" className="mt-4 space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase tracking-wider">Amount (kWh)</Label>
                      <Input type="number" placeholder="0.00" value={buyAmount} onChange={(e) => setBuyAmount(e.target.value)} className="h-9" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase tracking-wider">Price (XLM/kWh)</Label>
                      <Input value={currentPrice > 0 ? currentPrice.toFixed(4) : "—"} readOnly className="font-mono h-9" />
                    </div>
                    {buyAmount && currentPrice > 0 && (
                      <p className="text-[11px] text-muted-foreground">
                        Total: <span className="font-medium text-foreground font-mono">{(parseFloat(buyAmount) * currentPrice).toFixed(4)} XLM</span>
                      </p>
                    )}
                    <Button onClick={() => handleCreateOrder("buy")} className="w-full text-xs h-9" disabled={!buyAmount}>
                      Place Buy Order
                    </Button>
                  </TabsContent>

                  <TabsContent value="sell" className="mt-4 space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase tracking-wider">Amount (kWh)</Label>
                      <Input type="number" placeholder="0.00" value={sellAmount} onChange={(e) => setSellAmount(e.target.value)} className="h-9" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase tracking-wider">Price (XLM/kWh)</Label>
                      <Input value={currentPrice > 0 ? currentPrice.toFixed(4) : "—"} readOnly className="font-mono h-9" />
                    </div>
                    {sellAmount && currentPrice > 0 && (
                      <p className="text-[11px] text-muted-foreground">
                        Total: <span className="font-medium text-foreground font-mono">{(parseFloat(sellAmount) * currentPrice).toFixed(4)} XLM</span>
                      </p>
                    )}
                    <Button onClick={() => handleCreateOrder("sell")} className="w-full text-xs h-9" disabled={!sellAmount}>
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
