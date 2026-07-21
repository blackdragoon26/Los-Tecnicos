import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { appWalletApi, authApi, demoApi, type AppWallet, type DemoRole, type HardwareKit } from "@/lib/api";

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
  demoProfile: DemoRole | null;
  demoBalance: number;
  demoSessionId: string | null;
  demoJoinCode: string | null;
  demoKit: HardwareKit | null;
  wallet: AppWallet | null;
  user: User | null;
  role: "donor" | "recipient" | "operator" | null;
  isAdmin: boolean;
  connect: () => Promise<void>;
  connectDemo: (profile?: DemoRole) => Promise<void>;
  joinDemo: (joinCode: string, profile: DemoRole) => Promise<void>;
  switchDemoProfile: (profile: DemoRole) => Promise<void>;
  refreshWallet: () => Promise<void>;
  disconnect: () => void;
  topUpDemoBalance: (amount: number) => Promise<void>;
  debitDemoBalance: (amount: number) => boolean;
  setRole: (role: "donor" | "recipient" | "operator") => void;
  enableAdmin: () => void;
  setUser: (user: User | null) => void;
}

const WalletContext = createContext<WalletState | null>(null);
const read = (key: string) => localStorage.getItem(key);

export const useWallet = () => {
  const value = useContext(WalletContext);
  if (!value) throw new Error("useWallet must be used within WalletProvider");
  return value;
};

export const WalletProvider = ({ children }: { children: React.ReactNode }) => {
  const [externalPublicKey, setExternalPublicKey] = useState<string | null>(() => read("stelltron_external_pk"));
  const [appWalletId, setAppWalletId] = useState<string | null>(() => read("stelltron_app_wallet_id"));
  const [isDemo, setIsDemo] = useState(() => read("stelltron_wallet_mode") === "demo");
  const [demoProfile, setDemoProfile] = useState<DemoRole | null>(() => read("stelltron_demo_profile") as DemoRole | null);
  const [demoSessionId, setDemoSessionId] = useState<string | null>(() => read("stelltron_demo_session_id"));
  const [demoJoinCode, setDemoJoinCode] = useState<string | null>(() => read("stelltron_demo_join_code"));
  const [wallet, setWallet] = useState<AppWallet | null>(null);
  const [demoKit, setDemoKit] = useState<HardwareKit | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRoleState] = useState<"donor" | "recipient" | "operator" | null>(() => read("stelltron_role") as any);
  const [isAdmin, setIsAdmin] = useState(false);

  const refreshWallet = useCallback(async () => {
    if (!read("access_token")) return;
    const [walletResult, kitResult] = await Promise.all([appWalletApi.get(), appWalletApi.kits()]);
    setWallet(walletResult.wallet);
    setAppWalletId(walletResult.wallet.id);
    setDemoKit(kitResult.kits[0] || null);
  }, []);

  const applyDemoPersona = useCallback(async (session: any, persona: any) => {
    const nextRole: "donor" | "recipient" = persona.role === "donor" ? "donor" : "recipient";
    localStorage.setItem("access_token", persona.access_token);
    localStorage.removeItem("refresh_token");
    localStorage.setItem("stelltron_wallet_mode", "demo");
    localStorage.setItem("stelltron_demo_profile", persona.role);
    localStorage.setItem("stelltron_demo_session_id", session.id);
    localStorage.setItem("stelltron_demo_join_code", session.join_code);
    localStorage.setItem("stelltron_app_wallet_id", persona.wallet.id);
    localStorage.setItem("stelltron_role", nextRole);
    localStorage.removeItem("stelltron_external_pk");
    setExternalPublicKey(null);
    setIsDemo(true);
    setDemoProfile(persona.role);
    setDemoSessionId(session.id);
    setDemoJoinCode(session.join_code);
    setAppWalletId(persona.wallet.id);
    setWallet(persona.wallet);
    setDemoKit(persona.kit);
    setUser(persona.user);
    setRoleState(nextRole);
  }, []);

  const connectDemo = useCallback(async (profile: DemoRole = "receiver") => {
    const result = await demoApi.createSession();
    await applyDemoPersona(result.session, result.personas[profile]);
  }, [applyDemoPersona]);

  const joinDemo = useCallback(async (joinCode: string, profile: DemoRole) => {
    const result = await demoApi.joinSession(joinCode.trim().toUpperCase(), profile);
    await applyDemoPersona(result.session, result.persona);
  }, [applyDemoPersona]);

  const switchDemoProfile = useCallback(async (profile: DemoRole) => {
    if (!demoJoinCode) throw new Error("No active demo session");
    await joinDemo(demoJoinCode, profile);
  }, [demoJoinCode, joinDemo]);

  const connect = useCallback(async () => {
    const freighterApi = await import("@stellar/freighter-api");
    if (!(await freighterApi.isConnected())) throw new Error("Please install Freighter from freighter.app");
    if (!(await freighterApi.isAllowed())) await freighterApi.setAllowed();
    const pk = await freighterApi.getPublicKey();
    if (!pk) throw new Error("Freighter did not return an account");
    let result: any;
    try { result = await authApi.login(pk, "freighter_session"); }
    catch { result = await authApi.signup(pk, "freighter_session"); }
    if (result.access_token) localStorage.setItem("access_token", result.access_token);
    if (result.refresh_token) localStorage.setItem("refresh_token", result.refresh_token);
    localStorage.setItem("stelltron_external_pk", pk);
    localStorage.setItem("stelltron_wallet_mode", "web3");
    setExternalPublicKey(pk);
    setIsDemo(false);
    setDemoProfile(null);
    setUser(result.user || null);
    try { await refreshWallet(); } catch { /* A funding rail may connect before an app wallet exists. */ }
  }, [refreshWallet]);

  const topUpDemoBalance = useCallback(async (amount: number) => {
    if (!isDemo || amount <= 0) return;
    const result = await appWalletApi.topUp(amount, `topup:${demoSessionId}:${demoProfile}:${crypto.randomUUID()}`);
    setWallet(result.wallet);
  }, [demoProfile, demoSessionId, isDemo]);

  const disconnect = useCallback(() => {
    ["stelltron_external_pk", "stelltron_app_wallet_id", "stelltron_role", "stelltron_wallet_mode", "stelltron_demo_profile", "stelltron_demo_session_id", "stelltron_demo_join_code", "access_token", "refresh_token"].forEach((key) => localStorage.removeItem(key));
    setExternalPublicKey(null); setAppWalletId(null); setIsDemo(false); setDemoProfile(null); setDemoSessionId(null); setDemoJoinCode(null); setWallet(null); setDemoKit(null); setUser(null); setRoleState(null); setIsAdmin(false);
  }, []);

  const setRole = useCallback((next: "donor" | "recipient" | "operator") => {
    setRoleState(next); localStorage.setItem("stelltron_role", next);
  }, []);

  useEffect(() => {
    if (!read("access_token")) return;
    refreshWallet().catch(() => disconnect());
    authApi.me().then(setUser).catch(() => undefined);
  }, [disconnect, refreshWallet]);

  const value = useMemo<WalletState>(() => ({
    publicKey: isDemo ? appWalletId : externalPublicKey,
    externalPublicKey, appWalletId, isConnected: Boolean(isDemo ? appWalletId : externalPublicKey), isDemo, demoProfile,
    demoBalance: wallet?.balance || 0, demoSessionId, demoJoinCode, demoKit, wallet, user, role, isAdmin,
    connect, connectDemo, joinDemo, switchDemoProfile, refreshWallet, disconnect, topUpDemoBalance,
    debitDemoBalance: () => false, setRole, enableAdmin: () => setIsAdmin(true), setUser,
  }), [appWalletId, connect, connectDemo, demoJoinCode, demoKit, demoProfile, demoSessionId, disconnect, externalPublicKey, isAdmin, isDemo, joinDemo, refreshWallet, role, setRole, switchDemoProfile, topUpDemoBalance, user, wallet]);

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
};
