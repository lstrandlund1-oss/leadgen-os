import { describe, it, expect } from "vitest";
import { computeBestInsight, type ClosedLeadRecord } from "./insightEngine";

function lead(gapType: string | null, won: boolean): ClosedLeadRecord {
  return { gapType, gapMessage: gapType ? `Detected: ${gapType}` : null, won };
}

describe("computeBestInsight", () => {
  it("returns null with no closed leads at all", () => {
    expect(computeBestInsight([])).toBeNull();
  });

  it("returns null when there are zero wins — no positive pattern to surface", () => {
    const leads = Array.from({ length: 10 }, () => lead("gap_a", false));
    expect(computeBestInsight(leads)).toBeNull();
  });

  it("returns null when a gap type's sample size is below the minimum, even with a perfect win rate", () => {
    const leads = [
      lead("gap_a", true),
      lead("gap_a", true),
      lead("gap_a", true),
      lead("gap_b", false),
      lead("gap_b", false),
    ];
    const result = computeBestInsight(leads);
    expect(result).toBeNull();
  });

  it("returns null when no gap type shows a meaningful lift over baseline", () => {
    const leads = [
      ...Array.from({ length: 5 }, () => lead("gap_a", true)),
      ...Array.from({ length: 5 }, () => lead("gap_a", false)),
      ...Array.from({ length: 5 }, () => lead("gap_b", true)),
      ...Array.from({ length: 5 }, () => lead("gap_b", false)),
    ];
    const result = computeBestInsight(leads);
    expect(result).toBeNull();
  });

  it("surfaces a real, meaningful lift with sufficient sample size", () => {
    const leads = [
      ...Array.from({ length: 6 }, () => lead("gap_a", true)),
      ...Array.from({ length: 4 }, () => lead("gap_a", false)),
      ...Array.from({ length: 10 }, () => lead("gap_b", false)),
    ];
    const result = computeBestInsight(leads);
    expect(result).not.toBeNull();
    expect(result!.gapType).toBe("gap_a");
    expect(result!.liftMultiplier).toBeCloseTo(2, 1);
    expect(result!.sampleSize).toBe(10);
  });

  it("picks the strongest lift when multiple gap types qualify", () => {
    const leads = [
      ...Array.from({ length: 5 }, () => lead("gap_a", true)),
      ...Array.from({ length: 5 }, () => lead("gap_a", false)),
      ...Array.from({ length: 8 }, () => lead("gap_b", true)),
      ...Array.from({ length: 2 }, () => lead("gap_b", false)),
      ...Array.from({ length: 10 }, () => lead("gap_c", false)),
    ];
    const result = computeBestInsight(leads);
    expect(result!.gapType).toBe("gap_b");
  });

  it("ignores leads with no detected gap type", () => {
    const leads = [
      ...Array.from({ length: 6 }, () => lead(null, true)),
      ...Array.from({ length: 6 }, () => lead("gap_a", true)),
      ...Array.from({ length: 4 }, () => lead("gap_a", false)),
    ];
    const result = computeBestInsight(leads);
    expect(result?.gapType === "gap_a" || result === null).toBe(true);
  });
});
