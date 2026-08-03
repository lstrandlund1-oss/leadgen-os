import { describe, it, expect } from "vitest";
import { computeEconomicImpact } from "./economicImpact";
import { getMonthlyEquivalent } from "@/lib/pricing";

describe("computeEconomicImpact", () => {
  it("returns null when no deal value is set", () => {
    expect(computeEconomicImpact(0)).toBeNull();
  });

  it("returns null for a negative or invalid deal value", () => {
    expect(computeEconomicImpact(-100)).toBeNull();
  });

  it("uses the real Operator plan monthly price, not a made-up number", () => {
    const impact = computeEconomicImpact(42_000)!;
    expect(impact.vantioMonthlyCostSek).toBe(getMonthlyEquivalent("operator", "monthly", "sek"));
  });

  it("computes months covered as a real division, not a hardcoded value", () => {
    const impact = computeEconomicImpact(42_000)!;
    expect(impact.monthsOfSubscriptionCovered).toBeCloseTo(42_000 / impact.vantioMonthlyCostSek);
  });

  it("a larger deal value covers proportionally more months", () => {
    const small = computeEconomicImpact(10_000)!;
    const large = computeEconomicImpact(100_000)!;
    expect(large.monthsOfSubscriptionCovered).toBeGreaterThan(small.monthsOfSubscriptionCovered);
  });
});
