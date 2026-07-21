import { describe, expect, it } from "vitest";
import { normalizeSeriesPoint } from "@/pages/Analytics";

describe("normalizeSeriesPoint", () => {
  it("maps the backend price contract without dropping zero values", () => {
    const point = normalizeSeriesPoint({
      timestamp: "2026-07-21T15:53:54Z",
      price_lt_per_kwh: 0.6231,
      production_kw: 0,
      demand_kw: 75.3,
      average_soc: 47.2,
      supply_count: 0,
      demand_count: 50,
    });

    expect(point.price_lt_per_kwh).toBe(0.6231);
    expect(point.production_kw).toBe(0);
    expect(point.demand_count).toBe(50);
  });

  it("normalizes a partial cold-start point instead of throwing", () => {
    expect(normalizeSeriesPoint({})).toMatchObject({
      time: "--",
      price_lt_per_kwh: 0,
      production_kw: 0,
      demand_kw: 0,
      average_soc: 0,
    });
  });
});
