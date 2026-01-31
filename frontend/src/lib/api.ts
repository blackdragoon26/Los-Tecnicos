import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Interceptor to add JWT token to requests
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Interceptor to handle token refresh or auth errors
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            const refreshToken = localStorage.getItem('refresh_token');
            if (refreshToken) {
                try {
                    const { data } = await axios.post(`${API_URL}/auth/refresh`, {
                        refresh_token: refreshToken,
                    });
                    localStorage.setItem('access_token', data.access_token);
                    originalRequest.headers.Authorization = `Bearer ${data.access_token}`;
                    return api(originalRequest);
                } catch (refreshError) {
                    localStorage.removeItem('access_token');
                    localStorage.removeItem('refresh_token');
                    window.location.href = '/';
                }
            }
        }
        return Promise.reject(error);
    }
);

export const authApi = {
    signup: (wallet_address: string, signature: string) =>
        api.post('/auth/signup', { wallet_address, signature }),
    login: (wallet_address: string, signature: string) =>
        api.post('/auth/login', { wallet_address, signature }),
};

export const marketApi = {
    getOrders: () => api.get('/market/orders'),
    createOrder: (order: { type: string; kwh_amount: number; token_price: number }) =>
        api.post('/market/order/create', order),
    cancelOrder: (order_id: string) => api.post('/market/order/cancel', { order_id }),
};

export const iotApi = {
    getDevices: () => api.get('/iot/devices'),
    registerDevice: (device: { device_type: string; location: string }) =>
        api.post('/iot/device/register', device),
};

export const analyticsApi = {
    getDashboard: () => api.get('/analytics/dashboard'),
};

export default api;
