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
  externalPublicKey: string | null;
  appWalletId: string | null;
  isConnected: boolean;
  isDemo: boolean;
  demoProfile: "donor" | "receiver" | null;
  demoBalance: number;
  user: User | null;
  role: "donor" | "recipient" | "operator" | null;
  isAdmin: boolean;
  connect: () => Promise<void>;
  connectDemo: (profile?: "donor" | "receiver") => Promise<void>;
  switchDemoProfile: (profile: "donor" | "receiver") => Promise<void>;
  disconnect: () => void;
  topUpDemoBalance: (amount: number) => void;
  debitDemoBalance: (amount: number) => boolean;
  setRole: (role: "donor" | "recipient" | "operator") => void;
  enableAdmin: () => void;
  setUser: (user: User | null) => void;
}

const WalletContext = createContext<WalletState | null>(null);
const DEMO_PROFILES = {
  donor: {
    publicKey: "GA2HJIFIZFA5H2LT7CNGIYRYV5GPOUCAEYJEIVG7RQ7ABSX7SVYRFQEA",
    walletId: "stelltron-demo-donor",
    label: "Demo Donor",
    role: "donor" as const,
    initialBalance: 80,
  },
  receiver: {
    publicKey: "GCDCKMQO5RZE2VX6HTLF6AWCWKS7L7G3ZH4F57URUMDJJDQTE2IR2R6Z",
    walletId: "stelltron-demo-receiver",
    label: "Demo Receiver",
    role: "recipient" as const,
    initialBalance: 350,
  },
};

const demoBalanceKey = (profile: "donor" | "receiver") => `stelltron_demo_balance_${profile}`;

export const useWallet = () => {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
};

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [externalPublicKey, setExternalPublicKey] = useState<string | null>(() =>
    localStorage.getItem("stelltron_external_pk")
  );
  const [appWalletId, setAppWalletId] = useState<string | null>(() =>
    localStorage.getItem("stelltron_app_wallet_id")
  );
  const [user, setUser] = useState<User | null>(null);
  const [isDemo, setIsDemo] = useState(() => localStorage.getItem("stelltron_wallet_mode") === "demo");
  const [demoProfile, setDemoProfile] = useState<"donor" | "receiver" | null>(() =>
    (localStorage.getItem("stelltron_demo_profile") as "donor" | "receiver" | null) || null
  );
  const [demoBalance, setDemoBalance] = useState(() => {
    const profile = (localStorage.getItem("stelltron_demo_profile") as "donor" | "receiver" | null) || "receiver";
    return Number(localStorage.getItem(demoBalanceKey(profile)) || DEMO_PROFILES[profile].initialBalance);
  });
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
        setExternalPublicKey(pk);
        setAppWalletId(`stelltron-wallet-${pk.slice(0, 8)}`);
        setIsDemo(false);
        setDemoProfile(null);
        localStorage.removeItem("stelltron_demo_profile");
        localStorage.setItem("stelltron_external_pk", pk);
        localStorage.setItem("stelltron_app_wallet_id", `stelltron-wallet-${pk.slice(0, 8)}`);
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

  const connectDemo = useCallback(async (profile: "donor" | "receiver" = "receiver") => {
    const demo = DEMO_PROFILES[profile];
    const pk = demo.publicKey;
    const storedBalance = localStorage.getItem(demoBalanceKey(profile));
    const nextBalance = storedBalance ? Number(storedBalance) : demo.initialBalance;

    setExternalPublicKey(null);
    setAppWalletId(demo.walletId);
    setIsDemo(true);
    setDemoProfile(profile);
    setDemoBalance(nextBalance);
    localStorage.setItem(demoBalanceKey(profile), String(nextBalance));
    localStorage.removeItem("stelltron_external_pk");
    localStorage.setItem("stelltron_app_wallet_id", demo.walletId);
    localStorage.setItem("stelltron_wallet_mode", "demo");
    localStorage.setItem("stelltron_demo_profile", profile);
    localStorage.setItem("stelltron_role", demo.role);
    setRoleState(demo.role);

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
      setAppWalletId(null);
      setIsDemo(false);
      setDemoProfile(null);
      localStorage.removeItem("stelltron_app_wallet_id");
      localStorage.removeItem("stelltron_wallet_mode");
      localStorage.removeItem("stelltron_demo_profile");
      throw err;
    }
  }, []);

  const switchDemoProfile = useCallback(async (profile: "donor" | "receiver") => {
    await connectDemo(profile);
  }, [connectDemo]);

  const disconnect = useCallback(() => {
    setExternalPublicKey(null);
    setAppWalletId(null);
    setRoleState(null);
    setUser(null);
    setIsAdmin(false);
    setIsDemo(false);
    setDemoProfile(null);
    localStorage.removeItem("stelltron_external_pk");
    localStorage.removeItem("stelltron_app_wallet_id");
    localStorage.removeItem("stelltron_role");
    localStorage.removeItem("stelltron_wallet_mode");
    localStorage.removeItem("stelltron_demo_profile");
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
  }, []);

  const topUpDemoBalance = useCallback((amount: number) => {
    if (!Number.isFinite(amount) || amount <= 0) return;
    setDemoBalance((current) => {
      const next = Number((current + amount).toFixed(2));
      if (demoProfile) localStorage.setItem(demoBalanceKey(demoProfile), String(next));
      return next;
    });
  }, [demoProfile]);

  const debitDemoBalance = useCallback((amount: number) => {
    if (!Number.isFinite(amount) || amount <= 0) return false;
    let approved = false;
    setDemoBalance((current) => {
      if (current < amount) return current;
      const next = Number((current - amount).toFixed(2));
      if (demoProfile) localStorage.setItem(demoBalanceKey(demoProfile), String(next));
      approved = true;
      return next;
    });
    return approved;
  }, [demoProfile]);

  const setRole = useCallback((r: "donor" | "recipient" | "operator") => {
    setRoleState(r);
    localStorage.setItem("stelltron_role", r);
  }, []);

  const enableAdmin = useCallback(() => setIsAdmin(true), []);

  // Re-hydrate user on mount if we have a token
  useEffect(() => {
    if (appWalletId && localStorage.getItem("access_token")) {
      authApi.me().then(setUser).catch(() => {});
    }
  }, []);

  const publicKey = isDemo ? appWalletId : externalPublicKey;

  return (
    <WalletContext.Provider
      value={{
        publicKey,
        externalPublicKey,
        appWalletId,
        isConnected: !!publicKey,
        isDemo,
        demoProfile,
        demoBalance,
        user,
        role,
        isAdmin,
        connect,
        connectDemo,
        switchDemoProfile,
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
