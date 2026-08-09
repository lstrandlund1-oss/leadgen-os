import { describe, it, expect } from "vitest";
import { computeTonalityPerformance, bestTonality, computeAnglePerformance } from "./outreachPerformance";
import type { OutcomeForPerformance } from "./outreachPerformance";

function outcome(overrides: Partial<OutcomeForPerformance> = {}): OutcomeForPerformance {
  return {
    contacted: false,
    replied: false,
    closed: false,
    tonality: null,
    angle_type: null,
    ...overrides,
  };
}

describe("computeTonalityPerformance", () => {
  it("returns all four tonalities even with no data", () => {
    const result = computeTonalityPerformance([]);
    expect(result).toHaveLength(4);
    expect(result.every((t) => t.contacted === 0)).toBe(true);
  });

  it("computes reply and close rates correctly for a single tonality", () => {
    const result = computeTonalityPerformance([
      outcome({ tonality: "direct", contacted: true, replied: true }),
      outcome({ tonality: "direct", contacted: true, replied: false }),
    ]);
    const direct = result.find((t) => t.key === "direct")!;
    expect(direct.contacted).toBe(2);
    expect(direct.replied).toBe(1);
    expect(direct.replyRate).toBe(50);
  });

  it("ignores outcomes with no tonality set", () => {
    const result = computeTonalityPerformance([outcome({ tonality: null, contacted: true, replied: true })]);
    expect(result.every((t) => t.contacted === 0)).toBe(true);
  });
});

describe("bestTonality", () => {
  it("returns null when fewer than two tonalities have data", () => {
    const stats = computeTonalityPerformance([outcome({ tonality: "soft", contacted: true, replied: true })]);
    expect(bestTonality(stats)).toBeNull();
  });

  it("returns the tonality with the highest reply rate when multiple have data", () => {
    const stats = computeTonalityPerformance([
      outcome({ tonality: "soft", contacted: true, replied: true }),
      outcome({ tonality: "direct", contacted: true, replied: false }),
      outcome({ tonality: "direct", contacted: true, replied: false }),
    ]);
    const best = bestTonality(stats);
    expect(best?.key).toBe("soft");
  });

  it("excludes tonalities that were never contacted, so 0% doesn't misleadingly win or lose", () => {
    const stats = computeTonalityPerformance([
      outcome({ tonality: "soft", contacted: true, replied: true }),
      outcome({ tonality: "direct", contacted: true, replied: true }),
    ]);
    const best = bestTonality(stats);
    expect(["soft", "direct"]).toContain(best?.key);
  });
});

describe("computeAnglePerformance", () => {
  it("returns empty array with no data", () => {
    expect(computeAnglePerformance([])).toEqual([]);
  });

  it("groups by angle_type and computes reply rate", () => {
    const result = computeAnglePerformance([
      outcome({ angle_type: "Visibility gap", contacted: true, replied: true }),
      outcome({ angle_type: "Visibility gap", contacted: true, replied: false }),
      outcome({ angle_type: "Conversion gap", contacted: true, replied: true }),
    ]);
    const visibility = result.find((a) => a.name === "Visibility gap")!;
    expect(visibility.contacted).toBe(2);
    expect(visibility.replyRate).toBe(50);
  });

  it("groups missing angle_type under 'Unknown' rather than dropping it", () => {
    const result = computeAnglePerformance([outcome({ angle_type: null, contacted: true })]);
    expect(result.find((a) => a.name === "Unknown")).toBeDefined();
  });

  it("sorts by reply rate descending", () => {
    const result = computeAnglePerformance([
      outcome({ angle_type: "Low", contacted: true, replied: false }),
      outcome({ angle_type: "High", contacted: true, replied: true }),
    ]);
    expect(result[0].name).toBe("High");
  });
});
