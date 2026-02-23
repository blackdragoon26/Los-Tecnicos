import { useEffect, useRef, useState } from "react";
import { Zap, Lock, CheckCircle2, ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ActiveTransfer {
    id: string;
    donor_id: string;
    recipient_id: string;
    kwh_amount: number;
    token_amount: number;
    timestamp: string;
}

interface Props {
    transfer: ActiveTransfer | null;
    currentUserId: string;
    onClose: () => void;
}

export default function EnergyTransferModal({ transfer, currentUserId, onClose }: Props) {
    const totalSeconds = transfer ? Math.round(transfer.kwh_amount * 30) : 0;
    const [elapsed, setElapsed] = useState(0);
    const [done, setDone] = useState(false);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        if (!transfer) return;
        setElapsed(0);
        setDone(false);

        intervalRef.current = setInterval(() => {
            setElapsed((prev) => {
                if (prev >= totalSeconds) {
                    clearInterval(intervalRef.current!);
                    setDone(true);
                    return totalSeconds;
                }
                return prev + 1;
            });
        }, 1000);

        return () => clearInterval(intervalRef.current!);
    }, [transfer, totalSeconds]);

    if (!transfer) return null;

    const progress = Math.min((elapsed / totalSeconds) * 100, 100);
    const kwhTransferred = ((elapsed / totalSeconds) * transfer.kwh_amount).toFixed(3);
    const remaining = totalSeconds - elapsed;
    const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
    const ss = String(remaining % 60).padStart(2, "0");

    const isBuyer = currentUserId !== transfer.donor_id;
    const lockedXlm = transfer.token_amount.toFixed(4);

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }}
        >
            <div
                className="relative w-full max-w-md mx-4 rounded-xl border overflow-hidden"
                style={{
                    background: "hsl(220,10%,14%)",
                    borderColor: "hsl(220,8%,24%)",
                    boxShadow: "0 0 60px rgba(0,0,0,0.6)",
                }}
            >
                {/* Header */}
                <div
                    className="flex items-center justify-between px-5 py-4 border-b"
                    style={{ borderColor: "hsl(220,8%,22%)" }}
                >
                    <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4" style={{ color: "hsl(75,38%,48%)" }} />
                        <span className="text-sm font-semibold tracking-tight" style={{ color: "hsl(60,6%,90%)" }}>
                            Energy Transfer
                        </span>
                    </div>
                    {done && (
                        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>

                <div className="px-5 py-5 space-y-5">
                    {/* Node → Node Animation */}
                    <div className="flex items-center gap-3">
                        {/* Donor Node */}
                        <div
                            className="flex-1 rounded-lg p-3 text-center border"
                            style={{
                                background: "hsl(220,10%,18%)",
                                borderColor: done ? "hsl(75,38%,40%)" : "hsl(220,8%,26%)",
                            }}
                        >
                            <p className="text-[9px] uppercase tracking-widest mb-1" style={{ color: "hsl(220,6%,55%)" }}>
                                Donor
                            </p>
                            <p className="text-[11px] font-mono" style={{ color: "hsl(60,6%,85%)" }}>
                                {transfer.donor_id.slice(0, 6)}…{transfer.donor_id.slice(-4)}
                            </p>
                        </div>

                        {/* Animated connector */}
                        <div className="flex flex-col items-center gap-1 flex-shrink-0">
                            <div className="flex items-center gap-0.5">
                                {[0, 1, 2].map((i) => (
                                    <div
                                        key={i}
                                        className="rounded-full"
                                        style={{
                                            width: 6,
                                            height: 6,
                                            background: done ? "hsl(75,38%,48%)" : "hsl(75,38%,42%)",
                                            opacity: done ? 1 : 0.3,
                                            animation: !done ? `pulse 1.2s ease-in-out ${i * 0.3}s infinite` : "none",
                                        }}
                                    />
                                ))}
                            </div>
                            <ArrowRight
                                className="w-4 h-4"
                                style={{ color: done ? "hsl(75,38%,48%)" : "hsl(220,6%,45%)" }}
                            />
                            <p className="text-[9px] font-mono" style={{ color: "hsl(75,38%,48%)" }}>
                                {kwhTransferred} kWh
                            </p>
                        </div>

                        {/* Recipient Node */}
                        <div
                            className="flex-1 rounded-lg p-3 text-center border"
                            style={{
                                background: "hsl(220,10%,18%)",
                                borderColor: done ? "hsl(75,38%,40%)" : "hsl(220,8%,26%)",
                            }}
                        >
                            <p className="text-[9px] uppercase tracking-widest mb-1" style={{ color: "hsl(220,6%,55%)" }}>
                                Recipient
                            </p>
                            <p className="text-[11px] font-mono" style={{ color: "hsl(60,6%,85%)" }}>
                                {transfer.recipient_id.slice(0, 6)}…{transfer.recipient_id.slice(-4)}
                            </p>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div>
                        <div className="flex justify-between items-center mb-1.5">
                            <span className="text-[10px]" style={{ color: "hsl(220,6%,55%)" }}>
                                Transfer progress
                            </span>
                            <span className="text-[10px] font-mono" style={{ color: done ? "hsl(75,38%,55%)" : "hsl(60,6%,80%)" }}>
                                {done ? "Complete" : `${mm}:${ss} remaining`}
                            </span>
                        </div>
                        <div
                            className="w-full rounded-full overflow-hidden"
                            style={{ height: 6, background: "hsl(220,8%,22%)" }}
                        >
                            <div
                                className="h-full rounded-full transition-all duration-1000"
                                style={{
                                    width: `${progress}%`,
                                    background: done
                                        ? "hsl(75,38%,48%)"
                                        : "linear-gradient(90deg, hsl(75,38%,36%), hsl(75,38%,52%))",
                                }}
                            />
                        </div>
                        <div className="flex justify-between mt-1">
                            <span className="text-[9px] font-mono" style={{ color: "hsl(220,6%,45%)" }}>
                                {kwhTransferred} / {transfer.kwh_amount} kWh
                            </span>
                            <span className="text-[9px] font-mono" style={{ color: "hsl(220,6%,45%)" }}>
                                1 kWh / 30s
                            </span>
                        </div>
                    </div>

                    {/* Escrow Status */}
                    <div
                        className="rounded-lg p-3 border flex items-start gap-2.5"
                        style={{
                            background: done ? "hsl(100,20%,10%)" : "hsl(220,12%,16%)",
                            borderColor: done ? "hsl(75,38%,28%)" : "hsl(220,8%,24%)",
                        }}
                    >
                        {done ? (
                            <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "hsl(75,38%,48%)" }} />
                        ) : (
                            <Lock className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "hsl(40,80%,55%)" }} />
                        )}
                        <div>
                            {done ? (
                                <>
                                    <p className="text-[11px] font-semibold" style={{ color: "hsl(75,38%,55%)" }}>
                                        Transfer complete
                                    </p>
                                    <p className="text-[10px] mt-0.5" style={{ color: "hsl(220,6%,60%)" }}>
                                        <span className="font-mono" style={{ color: "hsl(60,6%,85%)" }}>{lockedXlm} XLM</span>{" "}
                                        released to seller's wallet
                                    </p>
                                </>
                            ) : (
                                <>
                                    <p className="text-[11px] font-semibold" style={{ color: "hsl(40,80%,60%)" }}>
                                        {isBuyer ? "Funds locked from your wallet" : "Awaiting payment lock"}
                                    </p>
                                    <p className="text-[10px] mt-0.5" style={{ color: "hsl(220,6%,60%)" }}>
                                        <span className="font-mono" style={{ color: "hsl(60,6%,85%)" }}>{lockedXlm} XLM</span>{" "}
                                        held in escrow — released to seller after delivery
                                    </p>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Rate info */}
                    <div
                        className="rounded-lg px-3 py-2 flex justify-between"
                        style={{ background: "hsl(220,10%,17%)", borderRadius: 8 }}
                    >
                        <div className="text-center">
                            <p className="text-[9px] uppercase tracking-widest mb-0.5" style={{ color: "hsl(220,6%,50%)" }}>
                                Total kWh
                            </p>
                            <p className="text-xs font-mono font-semibold" style={{ color: "hsl(60,6%,88%)" }}>
                                {transfer.kwh_amount}
                            </p>
                        </div>
                        <div className="text-center">
                            <p className="text-[9px] uppercase tracking-widest mb-0.5" style={{ color: "hsl(220,6%,50%)" }}>
                                Settlement
                            </p>
                            <p className="text-xs font-mono font-semibold" style={{ color: "hsl(60,6%,88%)" }}>
                                {lockedXlm} XLM
                            </p>
                        </div>
                        <div className="text-center">
                            <p className="text-[9px] uppercase tracking-widest mb-0.5" style={{ color: "hsl(220,6%,50%)" }}>
                                Duration
                            </p>
                            <p className="text-xs font-mono font-semibold" style={{ color: "hsl(60,6%,88%)" }}>
                                {totalSeconds}s
                            </p>
                        </div>
                    </div>

                    {done && (
                        <Button
                            onClick={onClose}
                            className="w-full text-xs h-9"
                            style={{ background: "hsl(75,38%,36%)", color: "hsl(60,6%,95%)" }}
                        >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Close
                        </Button>
                    )}
                </div>

                {/* Pulse keyframes */}
                <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 0.15; transform: scale(0.8); }
            50%       { opacity: 1;    transform: scale(1);   }
          }
        `}</style>
            </div>
        </div>
    );
}
