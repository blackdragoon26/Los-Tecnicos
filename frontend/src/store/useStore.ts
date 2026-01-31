import { create } from 'zustand';

interface User {
    id: string;
    wallet_address: string;
    role: string;
    kyc_status: string;
}

interface Order {
    id: string;
    type: 'buy' | 'sell';
    kwh_amount: number;
    token_price: number;
    status: string;
    created_at: string;
}

interface Device {
    id: string;
    device_type: 'esp32' | 'raspi';
    location: string;
    status: string;
}

interface AppState {
    user: User | null;
    orders: Order[];
    devices: Device[];
    isLoading: boolean;
    setUser: (user: User | null) => void;
    setOrders: (orders: Order[]) => void;
    setDevices: (devices: Device[]) => void;
    setLoading: (loading: boolean) => void;
}

export const useStore = create<AppState>((set) => ({
    user: null,
    orders: [],
    devices: [],
    isLoading: false,
    setUser: (user) => set({ user }),
    setOrders: (orders) => set({ orders }),
    setDevices: (devices) => set({ devices }),
    setLoading: (isLoading) => set({ isLoading }),
}));
