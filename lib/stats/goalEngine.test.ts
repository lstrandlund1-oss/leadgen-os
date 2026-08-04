import { describe, it, expect } from "vitest";
import { computeSuggestedGoal } from "./goalEngine";

describe("computeSuggestedGoal", () => {
  it("returns null with no history at all", () => {
    expect(computeSuggestedGoal([])).toBeNull();
  });

  it("returns null when history exists but every month had zero wins", () => {
    const history = [
      { month: "2026-06", wins: 0 },
      { month: "2026-07", wins: 0 },
    ];
    expect(computeSuggestedGoal(history)).toBeNull();
  });

  it("computes a real stretch goal above the historical average, not equal to it", () => {
    const history = [
      { month: "2026-06", wins: 2 },
      { month: "2026-07", wins: 2 },
    ];
    const goal = computeSuggestedGoal(history);
    expect(goal).not.toBeNull();
    expect(goal!.targetWins).toBeGreaterThan(2);
    expect(goal!.basedOnMonths).toBe(2);
  });

  it("never suggests a goal of 0, even with a very low average", () => {
    const history = [
      { month: "2026-06", wins: 1 },
      { month: "2026-07", wins: 0 },
      { month: "2026-08", wins: 0 },
    ];
    const goal = computeSuggestedGoal(history);
    expect(goal!.targetWins).toBeGreaterThanOrEqual(1);
  });

  it("scales with a genuinely higher historical average", () => {
    const lowHistory = [{ month: "2026-07", wins: 2 }];
    const highHistory = [{ month: "2026-07", wins: 10 }];
    const lowGoal = computeSuggestedGoal(lowHistory)!;
    const highGoal = computeSuggestedGoal(highHistory)!;
    expect(highGoal.targetWins).toBeGreaterThan(lowGoal.targetWins);
  });
});
