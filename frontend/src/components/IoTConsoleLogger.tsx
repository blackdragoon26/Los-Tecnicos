'use client';

import { useEffect } from 'react';

const IoTConsoleLogger = () => {
    useEffect(() => {
        const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';
        const eventSource = new EventSource(`${apiBase}/iot/events`);

        eventSource.onopen = () => {
            console.log('%c[IoT] Connected to Event Stream', 'color: #10b981; font-weight: bold');
        };

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'heartbeat') {
                    console.log('%c[IoT] 💓 Heartbeat', 'color: #6366f1', data.payload);
                } else if (data.type === 'node_data') {
                    console.log('%c[IoT] 📡 Node Data', 'color: #f59e0b; font-weight: bold', data.payload);
                    if (data.payload.nodes_detail) {
                        console.table(data.payload.nodes_detail);
                    }
                } else {
                    console.log('[IoT] Event:', data);
                }
            } catch (error) {
                console.error('[IoT] Error parsing event:', error);
            }
        };

        eventSource.onerror = (error) => {
            console.warn('[IoT] Event Stream connection lost, will retry...', error);
            // Don't close - EventSource auto-reconnects by default
        };

        return () => {
            eventSource.close();
            console.log('%c[IoT] Disconnected from Event Stream', 'color: #ef4444');
        };
    }, []);

    return null; // This component doesn't render anything visible
};

export default IoTConsoleLogger;
