import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useWallet } from "@/contexts/WalletContext";
import { Menu, X, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import stelltronLogo from "@/assets/stelltron-logo-new.png";

export default function Navbar() {
  const { isConnected, publicKey, externalPublicKey, appWalletId, disconnect, isDemo, demoProfile, demoBalance } = useWallet();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const publicLinks = [
    { to: "/", label: "Home" },
    { to: "/products", label: "Products" },
    { to: "/about", label: "About" },
  ];

  const protectedLinks = [
    { to: "/dashboard", label: "Dashboard" },
    { to: "/marketplace", label: "Market" },
    { to: "/network", label: "Network" },
    { to: "/analytics", label: "Analytics" },
  ];

  const links = isConnected ? [...publicLinks, ...protectedLinks] : publicLinks;

  const accountLabel = appWalletId || publicKey || "";
  const truncatedKey = accountLabel
    ? `${accountLabel.slice(0, 4)}…${accountLabel.slice(-4)}`
    : "";

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
      <div className="container mx-auto flex items-center justify-between h-14 px-4">
        <Link to="/" className="flex items-center gap-2">
          <img src={stelltronLogo} alt="Stelltron" className="w-9 h-9 flicker" />
          <span className="text-sm font-semibold text-foreground tracking-tight">Stelltron</span>
          <span className="hidden sm:inline text-[7px] font-mono tracking-[0.2em] uppercase text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">v0.1</span>
        </Link>

        <div className="hidden lg:flex items-center gap-0.5">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors nav-redact ${
                location.pathname === link.to
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="hidden lg:flex items-center gap-2">
          {isConnected ? (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-[11px] font-mono text-muted-foreground bg-secondary px-2.5 py-1 rounded cursor-default">
                    {truncatedKey}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="space-y-1">
                    <p className="text-xs font-mono">{accountLabel}</p>
                    {externalPublicKey && <p className="text-[10px] text-muted-foreground font-mono">funding: {externalPublicKey}</p>}
                  </div>
                </TooltipContent>
              </Tooltip>
              {isDemo && (
                <Badge variant="outline" className="h-7 border-primary/30 text-[10px] text-primary">
                  {demoProfile === "donor" ? "Donor" : "Receiver"} {demoBalance.toFixed(2)} LT
                </Badge>
              )}
              <Button variant="ghost" size="icon" onClick={disconnect} className="h-7 w-7">
                <LogOut className="w-3.5 h-3.5" />
              </Button>
            </>
          ) : (
            <Link to="/">
              <Button size="sm" className="h-8 text-xs">Connect</Button>
            </Link>
          )}
        </div>

        <button className="grid h-9 w-9 place-items-center rounded border border-border text-foreground lg:hidden" aria-label={mobileOpen ? "Close navigation" : "Open navigation"} aria-expanded={mobileOpen} onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="lg:hidden border-t border-border bg-background/95 backdrop-blur-md">
          <div className="flex flex-col p-3 gap-0.5">
            {links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileOpen(false)}
                className={`px-3 py-2 rounded text-sm ${
                  location.pathname === link.to ? "text-primary bg-primary/10" : "text-muted-foreground"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <Separator className="my-2" />
            {isConnected ? (
              <div className="flex items-center justify-between px-3">
                <span className="text-xs font-mono text-muted-foreground">
                  {isDemo ? `${demoProfile === "donor" ? "Donor" : "Receiver"} ${demoBalance.toFixed(2)} LT` : truncatedKey}
                </span>
                <Button variant="ghost" size="sm" onClick={disconnect} className="text-xs">
                  Disconnect
                </Button>
              </div>
            ) : (
              <Link to="/" onClick={() => setMobileOpen(false)}>
                <Button size="sm" className="w-full text-xs">Connect Wallet</Button>
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
