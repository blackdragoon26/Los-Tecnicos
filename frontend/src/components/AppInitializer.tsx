"use client";

import { useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { authApi } from '@/lib/api';

export default function AppInitializer({ children }: { children: React.ReactNode }) {
    const { setUser } = useStore();

    useEffect(() => {
        const checkUserSession = async () => {
            const token = localStorage.getItem('access_token');
            if (token) {
                try {
                    const { data } = await authApi.me();
                    setUser(data);
                } catch (error) {
                    console.error("Failed to fetch user profile:", error);
                    localStorage.removeItem('access_token');
                    localStorage.removeItem('refresh_token');
                }
            }
        };
        checkUserSession();
    }, [setUser]);

    return <>{children}</>;
}
