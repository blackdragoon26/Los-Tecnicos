import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { authApi } from "@/lib/api";

interface User {
  id: string;
  wallet_address: string;
  role: string;
  kyc_status: string;
}

interface WalletState {
  publicKey: string | null;
  isConnected: boolean;
  isDemo: boolean;
  demoBalance: number;
  user: User | null;
  role: "donor" | "recipient" | "operator" | null;
  isAdmin: boolean;
  connect: () => Promise<void>;
  connectDemo: () => Promise<void>;
  disconnect: () => void;
  topUpDemoBalance: (amount: number) => void;
  debitDemoBalance: (amount: number) => boolean;
  setRole: (role: "donor" | "recipient" | "operator") => void;
  enableAdmin: () => void;
  setUser: (user: User | null) => void;
}

const WalletContext = createContext<WalletState | null>(null);
const DEMO_WALLET_ADDRESS = "GB4BPU2E3PUMWUBI2CX4XY7DBPLC65FHBU3BOZTZRDYUWE56HPFXYPOG";

export const useWallet = () => {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
};

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [publicKey, setPublicKey] = useState<string | null>(() =>
    localStorage.getItem("stelltron_pk")
  );
  const [user, setUser] = useState<User | null>(null);
  const [isDemo, setIsDemo] = useState(() => localStorage.getItem("stelltron_wallet_mode") === "demo");
  const [demoBalance, setDemoBalance] = useState(() => Number(localStorage.getItem("stelltron_demo_balance") || "250"));
  const [role, setRoleState] = useState<"donor" | "recipient" | "operator" | null>(() =>
    localStorage.getItem("stelltron_role") as any
  );
  const [isAdmin, setIsAdmin] = useState(false);

  const connect = useCallback(async () => {
    try {
      const freighterApi = await import("@stellar/freighter-api");

      const connected = await freighterApi.isConnected();
      if (!connected) {
        throw new Error("FREIGHTER_NOT_INSTALLED");
      }

      const isAllowed = await freighterApi.isAllowed();
      if (!isAllowed) {
        await freighterApi.setAllowed();
      }

      const pk = await freighterApi.getPublicKey();
      if (pk) {
        setPublicKey(pk);
        setIsDemo(false);
        localStorage.setItem("stelltron_pk", pk);
        localStorage.setItem("stelltron_wallet_mode", "web3");

        // Attempt auth login/signup with backend
        try {
          const loginRes = await authApi.login(pk, "freighter_session");
          if (loginRes.access_token) {
            localStorage.setItem("access_token", loginRes.access_token);
            if (loginRes.refresh_token) {
              localStorage.setItem("refresh_token", loginRes.refresh_token);
            }
          }
          // Fetch user profile
          try {
            const meRes = await authApi.me();
            if (meRes) setUser(meRes);
          } catch {}
        } catch {
          // Signup if login fails
          try {
            const signupRes = await authApi.signup(pk, "freighter_session");
            if (signupRes.access_token) {
              localStorage.setItem("access_token", signupRes.access_token);
            }
          } catch {}
        }
      } else {
        throw new Error("No public key returned from Freighter");
      }
    } catch (err: any) {
      console.error("Freighter connection failed:", err);
      if (err?.message === "FREIGHTER_NOT_INSTALLED") {
        throw new Error("Please install the Freighter wallet extension from freighter.app");
      }
      throw err;
    }
  }, []);

  const connectDemo = useCallback(async () => {
    const pk = DEMO_WALLET_ADDRESS;
    setPublicKey(pk);
    setIsDemo(true);
    setDemoBalance((current) => {
      const next = current > 0 ? current : 250;
      localStorage.setItem("stelltron_demo_balance", String(next));
      return next;
    });
    localStorage.setItem("stelltron_pk", pk);
    localStorage.setItem("stelltron_wallet_mode", "demo");
    localStorage.setItem("stelltron_role", localStorage.getItem("stelltron_role") || "recipient");
    setRoleState((current) => current || "recipient");

    try {
      let authRes: any;
      try {
        authRes = await authApi.login(pk, "freighter_session");
      } catch {
        authRes = await authApi.signup(pk, "freighter_session");
      }

      if (authRes.access_token) {
        localStorage.setItem("access_token", authRes.access_token);
      }
      if (authRes.refresh_token) {
        localStorage.setItem("refresh_token", authRes.refresh_token);
      }

      try {
        const meRes = await authApi.me();
        if (meRes) setUser(meRes);
      } catch {
        if (authRes.user) setUser(authRes.user);
      }
    } catch (err) {
      setPublicKey(null);
      setIsDemo(false);
      localStorage.removeItem("stelltron_pk");
      localStorage.removeItem("stelltron_wallet_mode");
      throw err;
    }
  }, []);

  const disconnect = useCallback(() => {
    setPublicKey(null);
    setRoleState(null);
    setUser(null);
    setIsAdmin(false);
    setIsDemo(false);
    localStorage.removeItem("stelltron_pk");
    localStorage.removeItem("stelltron_role");
    localStorage.removeItem("stelltron_wallet_mode");
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
  }, []);

  const topUpDemoBalance = useCallback((amount: number) => {
    if (!Number.isFinite(amount) || amount <= 0) return;
    setDemoBalance((current) => {
      const next = Number((current + amount).toFixed(2));
      localStorage.setItem("stelltron_demo_balance", String(next));
      return next;
    });
  }, []);

  const debitDemoBalance = useCallback((amount: number) => {
    if (!Number.isFinite(amount) || amount <= 0) return false;
    let approved = false;
    setDemoBalance((current) => {
      if (current < amount) return current;
      const next = Number((current - amount).toFixed(2));
      localStorage.setItem("stelltron_demo_balance", String(next));
      approved = true;
      return next;
    });
    return approved;
  }, []);

  const setRole = useCallback((r: "donor" | "recipient" | "operator") => {
    setRoleState(r);
    localStorage.setItem("stelltron_role", r);
  }, []);

  const enableAdmin = useCallback(() => setIsAdmin(true), []);

  // Re-hydrate user on mount if we have a token
  useEffect(() => {
    if (publicKey && localStorage.getItem("access_token")) {
      authApi.me().then(setUser).catch(() => {});
    }
  }, []);

  return (
    <WalletContext.Provider
      value={{
        publicKey,
        isConnected: !!publicKey,
        isDemo,
        demoBalance,
        user,
        role,
        isAdmin,
        connect,
        connectDemo,
        disconnect,
        topUpDemoBalance,
        debitDemoBalance,
        setRole,
        enableAdmin,
        setUser,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};
