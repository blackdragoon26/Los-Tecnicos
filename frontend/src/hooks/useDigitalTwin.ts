import { useQuery } from "@tanstack/react-query";
import { simulationApi } from "@/lib/api";

export function useDigitalTwin(sessionId?: string | null) {
  return useQuery({
    queryKey: ["digital-twin", sessionId || "public"],
    queryFn: () => simulationApi.snapshot(sessionId || undefined),
    refetchInterval: 2500,
    staleTime: 1500,
  });
}
