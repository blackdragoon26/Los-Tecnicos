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
    throw new Error(`API Error: ${res.status} ${res.statusText}`);
  }

  return res.json();
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

// Convenience re-export
export const api = { authApi, marketApi, iotApi, analyticsApi, fiatApi };
