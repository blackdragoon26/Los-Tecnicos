import { useState } from "react";
import { Link } from "react-router-dom";
import { useWallet } from "@/contexts/WalletContext";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Cpu, CheckCircle2, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";
import { Networks, TransactionBuilder, Account, Memo } from "@stellar/stellar-sdk";

export default function RegisterDevice() {
    const { isConnected, publicKey } = useWallet();
    const [nodeMac, setNodeMac] = useState("");
    const [isLinking, setIsLinking] = useState(false);
    const [isLinked, setIsLinked] = useState(false);

    const simulateFreighterSignature = async () => {
        if (!publicKey) return;
        setIsLinking(true);

        try {
            const freighterApi = await import("@stellar/freighter-api");

            // We construct a dummy transaction just to trigger the Freighter Signature popup for the pitch video.
            const account = new Account(publicKey, "1");
            const tx = new TransactionBuilder(account, {
                fee: "100",
                networkPassphrase: Networks.TESTNET,
            })
                .setTimeout(30)
                .addMemo(Memo.text(`LINK:${nodeMac.substring(0, 23)}`))
                .build();

            const xdr = tx.toXDR();

            // This triggers the real Freighter popup!
            const signedXdr = await freighterApi.signTransaction(xdr, {
                network: "TESTNET"
            });

            if (signedXdr) {
                // Send the cryptographically signed challenge to the backend for verification
                await api.iotApi.linkDevice({
                    node_mac: nodeMac,
                    public_key: publicKey,
                    signed_xdr: signedXdr,
                });

                toast.success("Successfully cryptographically linked node to wallet!");
                setIsLinked(true);
            }
        } catch (err: any) {
            console.error(err);
            toast.error(err.message || "Failed to link node.");
        } finally {
            setIsLinking(false);
        }
    };

    if (!isConnected) {
        return (
            <div className="min-h-screen pt-20 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-4">Connect wallet to register hardware.</p>
                    <Link to="/"><Button size="sm">Connect</Button></Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen pt-20 pb-12 px-4 flex items-center justify-center">
            <Card className="max-w-md w-full border-primary/20 bg-background/50 backdrop-blur-sm">
                <CardHeader className="text-center pb-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                        <Cpu className="w-6 h-6 text-primary" />
                    </div>
                    <CardTitle className="text-xl">Register Hardware Node</CardTitle>
                    <CardDescription className="text-xs">
                        Cryptographically link a Stelltron ESP32 grid node to your Stellar public key.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {!isLinked ? (
                        <>
                            <div className="space-y-1.5">
                                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Node MAC Address (QR Code)</Label>
                                <Input
                                    placeholder="e.g. 00:1B:44:11:3A:B7"
                                    value={nodeMac}
                                    onChange={(e) => setNodeMac(e.target.value)}
                                    className="font-mono text-sm"
                                />
                            </div>

                            <div className="bg-secondary/50 rounded-lg p-3 border border-border/50">
                                <p className="text-[10px] text-muted-foreground font-mono leading-relaxed mb-2">
                                    <span className="text-primary font-bold">Owner Public Key:</span><br />
                                    {publicKey}
                                </p>
                                <p className="text-[10px] text-muted-foreground leading-relaxed">
                                    Signing this transaction stores a permanent mapping on the Soroban smart contract. All future energy sales from this node will mint LT tokens directly to this wallet.
                                </p>
                            </div>

                            <Button
                                onClick={simulateFreighterSignature}
                                className="w-full gap-2"
                                disabled={!nodeMac || isLinking}
                            >
                                <LinkIcon className="w-4 h-4" />
                                {isLinking ? "Awaiting Signature..." : "Sign & Link Device"}
                            </Button>
                        </>
                    ) : (
                        <div className="text-center space-y-4 py-4">
                            <CheckCircle2 className="w-16 h-16 text-primary mx-auto" />
                            <div>
                                <h3 className="text-lg font-bold text-foreground">Node Successfully Linked!</h3>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Device <span className="font-mono text-primary">{nodeMac}</span> is now permanently paired with your wallet.
                                </p>
                            </div>
                            <Link to="/dashboard">
                                <Button className="mt-4 w-full">Return to Dashboard</Button>
                            </Link>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
