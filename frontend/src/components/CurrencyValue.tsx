import { useQuery } from "@tanstack/react-query";
import { ratesApi } from "@/lib/api";

export type DisplayCurrency = "LT" | "INR" | "USD" | "EUR";

export function CurrencyValue({ lt, currency = "LT", digits = 2 }: { lt: number; currency?: DisplayCurrency; digits?: number }) {
  const { data } = useQuery({ queryKey: ["fiat-rates"], queryFn: ratesApi.get, staleTime: 30 * 60 * 1000 });
  const rate = Number(data?.rates?.[currency] || (currency === "LT" ? 1 : 0));
  const value = lt * rate;
  const symbols: Record<DisplayCurrency, string> = { LT: "LT ", INR: "₹", USD: "$", EUR: "€" };
  return <>{symbols[currency]}{value.toFixed(digits)}</>;
}
