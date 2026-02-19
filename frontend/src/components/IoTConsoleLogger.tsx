'use client';

import { useEffect } from 'react';

const IoTConsoleLogger = () => {
    useEffect(() => {
        // In a real app, this URL should come from an environment variable
        const eventSource = new EventSource('http://localhost:8080/iot/events');

        eventSource.onopen = () => {
            console.log('Connected to IoT Event Stream');
        };

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('RPI DATA:', data);
            } catch (error) {
                console.error('Error parsing IoT event:', error);
            }
        };

        eventSource.onerror = (error) => {
            console.error('IoT Event Stream Error:', error);
            eventSource.close();
        };

        return () => {
            eventSource.close();
            console.log('Disconnected from IoT Event Stream');
        };
    }, []);

    return null; // This component doesn't render anything visible
};

export default IoTConsoleLogger;
