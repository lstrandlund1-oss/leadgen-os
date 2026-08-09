import { describe, it, expect } from "vitest";
import { computeWeeklyActivity, bestReplyWeek, getWeekKey, getWeekLabel } from "./weeklyActivity";
import type { OutcomeForWeeklyActivity } from "./weeklyActivity";

function outcome(overrides: Partial<OutcomeForWeeklyActivity> = {}): OutcomeForWeeklyActivity {
  return {
    created_at: "2026-04-06T00:00:00Z", // a Monday, arbitrary anchor
    contacted: false,
    replied: false,
    booked_call: false,
    closed: false,
    ...overrides,
  };
}

describe("getWeekKey / getWeekLabel", () => {
  it("produces a stable, sortable key format", () => {
    const key = getWeekKey("2026-04-06T00:00:00Z");
    expect(key).toMatch(/^2026-W\d{2}$/);
  });

  it("getWeekLabel extracts just the week number", () => {
    expect(getWeekLabel("2026-W14")).toBe("W14");
  });

  it("dates in the same week produce the same key", () => {
    const a = getWeekKey("2026-04-06T00:00:00Z");
    const b = getWeekKey("2026-04-07T00:00:00Z");
    expect(a).toBe(b);
  });
});

describe("computeWeeklyActivity", () => {
  it("returns empty array with no outcomes", () => {
    expect(computeWeeklyActivity([])).toEqual([]);
  });

  it("aggregates counts correctly within one week", () => {
    const result = computeWeeklyActivity([
      outcome({ contacted: true, replied: true }),
      outcome({ contacted: true, replied: false }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].contacted).toBe(2);
    expect(result[0].replied).toBe(1);
    expect(result[0].replyRate).toBe(50);
  });

  it("separates outcomes into different weeks correctly", () => {
    const result = computeWeeklyActivity([
      outcome({ created_at: "2026-01-05T00:00:00Z", contacted: true }),
      outcome({ created_at: "2026-06-15T00:00:00Z", contacted: true }),
    ]);
    expect(result.length).toBeGreaterThan(1);
  });

  it("sorts weeks chronologically", () => {
    const result = computeWeeklyActivity([
      outcome({ created_at: "2026-06-15T00:00:00Z", contacted: true }),
      outcome({ created_at: "2026-01-05T00:00:00Z", contacted: true }),
    ]);
    expect(result[0].week.localeCompare(result[1].week)).toBeLessThan(0);
  });

  it("computes closeRate independently from replyRate", () => {
    const result = computeWeeklyActivity([
      outcome({ contacted: true, replied: true, closed: true }),
      outcome({ contacted: true, replied: true, closed: false }),
    ]);
    expect(result[0].replyRate).toBe(100);
    expect(result[0].closeRate).toBe(50);
  });
});

describe("bestReplyWeek", () => {
  it("returns null with no data", () => {
    expect(bestReplyWeek([])).toBeNull();
  });

  it("ignores weeks with zero contacts even if present", () => {
    const weeks = computeWeeklyActivity([
      outcome({ created_at: "2026-01-05T00:00:00Z", contacted: false }),
      outcome({ created_at: "2026-06-15T00:00:00Z", contacted: true, replied: true }),
    ]);
    const best = bestReplyWeek(weeks);
    expect(best?.contacted).toBeGreaterThan(0);
  });

  it("picks the week with the highest reply rate", () => {
    const weeks = computeWeeklyActivity([
      outcome({ created_at: "2026-01-05T00:00:00Z", contacted: true, replied: false }),
      outcome({ created_at: "2026-01-06T00:00:00Z", contacted: true, replied: false }),
      outcome({ created_at: "2026-06-15T00:00:00Z", contacted: true, replied: true }),
    ]);
    const best = bestReplyWeek(weeks);
    expect(best?.replyRate).toBe(100);
  });
});
