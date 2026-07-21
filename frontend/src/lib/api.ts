const RENDER_URL = "https://los-tecnicos-backend.onrender.com/api/v1";
const LOCAL_URL = "http://localhost:8080/api/v1";

const getBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  return RENDER_URL;
};

const getRootUrl = () => getBaseUrl().replace("/api/v1", "");

let BASE_URL = getBaseUrl();

// Helper: get stored JWT
const getToken = () => localStorage.getItem("access_token");
const getRefreshToken = () => localStorage.getItem("refresh_token");

async function request<T>(endpoint: string, options?: RequestInit, isRoot = false): Promise<T> {
  const base = isRoot ? getRootUrl() : BASE_URL;
  const url = `${base}${endpoint}`;
  const token = getToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, { ...options, headers });

  // Handle 401 — attempt token refresh
  if (res.status === 401) {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      try {
        const refreshRes = await fetch(`${BASE_URL}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
        if (refreshRes.ok) {
          const data = await refreshRes.json();
          localStorage.setItem("access_token", data.access_token);
          headers["Authorization"] = `Bearer ${data.access_token}`;
          const retryRes = await fetch(url, { ...options, headers });
          if (retryRes.ok) return retryRes.json();
        } else {
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
        }
      } catch {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
      }
    }
  }

  if (!res.ok) {
    let errorMsg = `API Error: ${res.status} ${res.statusText}`;
    try {
      const text = await res.text();
      try {
        const errorData = JSON.parse(text);
        errorMsg = errorData.error || errorData.message || errorMsg;
        if (errorData.details) errorMsg += `: ${errorData.details}`;
      } catch {
        // Not JSON, use raw text (truncate if too long)
        if (text && text.length > 0) {
          errorMsg = text.length > 150 ? text.substring(0, 150) + "..." : text;
        }
      }
    } catch { }
    throw new Error(errorMsg);
  }

  return res.json();
}

export type DemoRole = "donor" | "receiver";

export interface DemoPersona {
  role: DemoRole;
  access_token: string;
  user: { id: string; wallet_address: string; role: string; kyc_status: string };
  wallet: AppWallet;
  kit: HardwareKit;
}

export interface AppWallet {
  id: string;
  user_id: string;
  session_id: string;
  balance: number;
  escrow_balance: number;
  currency: "LT";
  is_demo: boolean;
}

export interface HardwareKit {
  id: string;
  mac_address: string;
  alias: string;
  location: string;
  latitude: number;
  longitude: number;
  hardware_profile: string;
  status: string;
}

export interface EnergyTrade {
  id: string;
  session_id: string;
  donor_mac: string;
  receiver_mac: string;
  input_wh: number;
  usable_wh: number;
  loss_wh: number;
  price_per_kwh: number;
  token_amount: number;
  state: "funds_locked" | "transferring" | "delivered" | "settled" | "cancelled" | "fault" | "timeout";
  progress_pct: number;
  bus_voltage: number;
  current_ma: number;
  efficiency_pct: number;
  true_eta_seconds: number;
  demo_eta_seconds: number;
  failure_reason?: string;
  started_at?: string;
}

export interface SimulationSnapshot {
  mode: "simulation";
  disclosure: string;
  region: string;
  session_id?: string;
  speed_mode: "realtime" | "10x" | "pitch";
  speed_multiplier: number;
  simulated_at: string;
  weather: { temperature_c: number; cloud_cover_pct: number; is_day: boolean; source: string; observed_at: string };
  households: Array<{ id: string; alias: string; mac_address: string; region: string; latitude: number; longitude: number; solar_capacity_kw: number; battery_capacity_kwh: number; demand_kw: number; production_kw: number; soc: number; efficiency_pct: number; reliability_pct: number; state: "SUPPLYING" | "RECEIVING" | "IDLE" }>;
  supply_count: number;
  demand_count: number;
  idle_count: number;
  average_soc: number;
  total_production_kw: number;
  total_demand_kw: number;
  active_transfers: number;
  price_lt_per_kwh: number;
  price_breakdown: { base_price: number; f_sd: number; f_soc: number; f_dist: number; f_time: number; f_reliability: number; final_price: number };
}

export interface SimulationTimeSeriesPoint {
  timestamp: string;
  price_lt_per_kwh: number;
  production_kw: number;
  demand_kw: number;
  average_soc: number;
  supply_count: number;
  demand_count: number;
}

export interface SimulationTimeSeries {
  mode: "simulation";
  unit: "LT/kWh";
  points: SimulationTimeSeriesPoint[];
}

// Auth
export const authApi = {
  signup: (wallet_address: string, signature: string) =>
    request<any>("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ wallet_address, signature }),
    }),
  login: (wallet_address: string, signature: string) =>
    request<any>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ wallet_address, signature }),
    }),
  me: () => request<any>("/auth/me"),
};

// Market
export const marketApi = {
  getOrders: () => request<any>("/market/orders"),
  createOrder: (order: { type: string; kwh_amount: number; token_price: number; signed_xdr?: string }) =>
    request<any>("/market/order/create", {
      method: "POST",
      body: JSON.stringify(order),
    }),
  cancelOrder: (order_id: string) =>
    request<any>("/market/order/cancel", {
      method: "POST",
      body: JSON.stringify({ order_id }),
    }),
  getMarketPrice: () => request<any>("/market/price"),
  getMarketHistory: () => request<any>("/market/history"),
};

// IoT
export const iotApi = {
  getDevices: () => request<any>("/iot/devices"),
  registerDevice: (device: { device_type: string; location: string }) =>
    request<any>("/iot/device/register", {
      method: "POST",
      body: JSON.stringify(device),
    }),
  linkDevice: (payload: { node_mac: string; public_key: string; signed_xdr: string }) =>
    request<any>("/iot/device/link", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getNodes: (deviceId: string) =>
    request<any>(`/iot/nodes/${deviceId}`, undefined, true),
  startTransfer: (deviceId: string, senderUid: string, receiverUid: string) =>
    request<any>("/iot/transfer", {
      method: "POST",
      body: JSON.stringify({ device_id: deviceId, sender_uid: senderUid, receiver_uid: receiverUid }),
    }, true),
  stopTransfer: (deviceId: string) =>
    request<any>("/iot/transfer/stop", {
      method: "POST",
      body: JSON.stringify({ device_id: deviceId }),
    }, true),
  ping: (payload: any) =>
    request<any>("/iot/ping", {
      method: "POST",
      body: JSON.stringify(payload),
    }, true),
  getEventsUrl: () => `${getRootUrl()}/iot/events`,
};

// Analytics
export const analyticsApi = {
  getDashboard: () => request<any>("/analytics/dashboard"),
  getTransactions: () => request<any>("/analytics/transactions"),
};

// Fiat On-Ramp
export const fiatApi = {
  createCheckout: (wallet_address: string, lt_amount: number) =>
    request<{ checkout_url: string; payment_id: string; amount_usd: number }>("/fiat/checkout", {
      method: "POST",
      body: JSON.stringify({ wallet_address, lt_amount }),
    }),
};

export const demoApi = {
  createSession: () => request<any>("/demo/sessions", { method: "POST", body: "{}" }),
  joinSession: (join_code: string, role: DemoRole) => request<any>("/demo/sessions/join", {
    method: "POST",
    body: JSON.stringify({ join_code, role }),
  }),
  setSpeed: (sessionId: string, mode: "realtime" | "10x" | "pitch") => request<any>(`/demo/sessions/${sessionId}/speed`, {
    method: "PATCH",
    body: JSON.stringify({ mode }),
  }),
};

export const simulationApi = {
  snapshot: (sessionId?: string) => request<SimulationSnapshot>(`/simulation/snapshot${sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : ""}`),
  timeSeries: (sessionId?: string) => request<SimulationTimeSeries>(`/simulation/timeseries${sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : ""}`),
};

export const appWalletApi = {
  get: () => request<{ wallet: AppWallet; ledger: any[] }>("/wallet"),
  topUp: (amount: number, idempotency_key: string) => request<{ wallet: AppWallet }>("/wallet/demo-topup", {
    method: "POST",
    body: JSON.stringify({ amount, idempotency_key }),
  }),
  kits: () => request<{ kits: HardwareKit[] }>("/kits"),
  registerKit: (mac_address: string, alias: string) => request<{ kit: HardwareKit }>("/kits/register", {
    method: "POST",
    body: JSON.stringify({ mac_address, alias }),
  }),
};

export const tradeApi = {
  active: (sessionId: string) => request<{ trade: EnergyTrade | null }>(`/trades/active?session_id=${encodeURIComponent(sessionId)}`),
  lock: (session_id: string, input_wh = 6) => request<{ trade: EnergyTrade }>("/trades/lock", {
    method: "POST",
    body: JSON.stringify({ session_id, input_wh, idempotency_key: `lock:${session_id}:${Date.now()}` }),
  }),
  get: (id: string) => request<{ trade: EnergyTrade }>(`/trades/${id}`),
  start: (id: string) => request<{ trade: EnergyTrade }>(`/trades/${id}/start`, { method: "POST", body: "{}" }),
  settle: (id: string) => request<{ trade: EnergyTrade }>(`/trades/${id}/settle`, { method: "POST", body: "{}" }),
  cancel: (id: string) => request<{ trade: EnergyTrade }>(`/trades/${id}/cancel`, { method: "POST", body: "{}" }),
  fault: (id: string) => request<{ trade: EnergyTrade }>(`/trades/${id}/fault`, { method: "POST", body: "{}" }),
  timeout: (id: string) => request<{ trade: EnergyTrade }>(`/trades/${id}/timeout`, { method: "POST", body: "{}" }),
};

export const ratesApi = {
  get: () => request<any>("/market/rates"),
};

// Convenience re-export
export const api = { authApi, marketApi, iotApi, analyticsApi, fiatApi, demoApi, simulationApi, appWalletApi, tradeApi, ratesApi };
