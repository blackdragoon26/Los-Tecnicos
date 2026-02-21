import { useEffect } from "react";
import { iotApi } from "@/lib/api";

export default function IoTConsoleLogger() {
  useEffect(() => {
    const eventSource = new EventSource(iotApi.getEventsUrl());

    eventSource.onopen = () => {
      console.log("%c[IoT] Connected to Event Stream", "color: #6fcf97; font-weight: bold");
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "heartbeat") {
          console.log("%c[IoT] 💓 Heartbeat", "color: #6366f1", data.payload);
        } else if (data.type === "node_data") {
          console.log("%c[IoT] 📡 Node Data", "color: #f59e0b; font-weight: bold", data.payload);
          if (data.payload.nodes_detail) {
            console.table(data.payload.nodes_detail);
          }
        } else {
          console.log("[IoT] Event:", data);
        }
      } catch (error) {
        console.error("[IoT] Error parsing event:", error);
      }
    };

    eventSource.onerror = () => {
      console.warn("[IoT] Event Stream connection lost, will retry...");
    };

    return () => {
      eventSource.close();
      console.log("%c[IoT] Disconnected from Event Stream", "color: #ef4444");
    };
  }, []);

  return null;
}
