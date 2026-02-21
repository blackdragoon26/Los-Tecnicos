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
  user: User | null;
  role: "donor" | "recipient" | "operator" | null;
  isAdmin: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  setRole: (role: "donor" | "recipient" | "operator") => void;
  enableAdmin: () => void;
  setUser: (user: User | null) => void;
}

const WalletContext = createContext<WalletState | null>(null);

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
        localStorage.setItem("stelltron_pk", pk);

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

  const disconnect = useCallback(() => {
    setPublicKey(null);
    setRoleState(null);
    setUser(null);
    setIsAdmin(false);
    localStorage.removeItem("stelltron_pk");
    localStorage.removeItem("stelltron_role");
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
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
        user,
        role,
        isAdmin,
        connect,
        disconnect,
        setRole,
        enableAdmin,
        setUser,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};
