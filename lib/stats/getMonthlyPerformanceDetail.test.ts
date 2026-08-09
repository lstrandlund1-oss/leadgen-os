import { describe, it, expect } from "vitest";
import { computeMonthlyPerformanceDetail } from "./getMonthlyPerformanceDetail";
import type { OutcomeForMonthlyDetail } from "./getMonthlyPerformanceDetail";

const MONTH_START = "2026-08-01T00:00:00.000Z";

function outcome(overrides: Partial<OutcomeForMonthlyDetail> = {}): OutcomeForMonthlyDetail {
  return {
    contacted_at: null,
    replied_at: null,
    booked_call_at: null,
    closed_at: null,
    closed: false,
    lost_reason: null,
    revenue: null,
    ...overrides,
  };
}

describe("computeMonthlyPerformanceDetail", () => {
  it("returns empty array with no outcomes", () => {
    expect(computeMonthlyPerformanceDetail([], MONTH_START)).toEqual([]);
  });

  it("groups contacted events by day", () => {
    const result = computeMonthlyPerformanceDetail(
      [outcome({ contacted_at: "2026-08-05T10:00:00Z" }), outcome({ contacted_at: "2026-08-05T14:00:00Z" })],
      MONTH_START,
    );
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe("2026-08-05");
    expect(result[0].contacted).toBe(2);
  });

  it("excludes events before the month start", () => {
    const result = computeMonthlyPerformanceDetail([outcome({ contacted_at: "2026-07-30T10:00:00Z" })], MONTH_START);
    expect(result).toEqual([]);
  });

  it("only counts closed as won when closed=true and no lost_reason", () => {
    const result = computeMonthlyPerformanceDetail(
      [
        outcome({ closed_at: "2026-08-05T10:00:00Z", closed: true, lost_reason: null, revenue: 5000 }),
        outcome({ closed_at: "2026-08-06T10:00:00Z", closed: true, lost_reason: "price_too_high", revenue: 5000 }),
        outcome({ closed_at: "2026-08-07T10:00:00Z", closed: false, revenue: 5000 }),
      ],
      MONTH_START,
    );
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe("2026-08-05");
    expect(result[0].won).toBe(1);
    expect(result[0].revenueWon).toBe(5000);
  });

  it("sums revenue across multiple wins on the same day", () => {
    const result = computeMonthlyPerformanceDetail(
      [
        outcome({ closed_at: "2026-08-05T10:00:00Z", closed: true, revenue: 3000 }),
        outcome({ closed_at: "2026-08-05T15:00:00Z", closed: true, revenue: 2000 }),
      ],
      MONTH_START,
    );
    expect(result[0].revenueWon).toBe(5000);
  });

  it("handles null revenue as zero rather than crashing", () => {
    const result = computeMonthlyPerformanceDetail(
      [outcome({ closed_at: "2026-08-05T10:00:00Z", closed: true, revenue: null })],
      MONTH_START,
    );
    expect(result[0].revenueWon).toBe(0);
  });

  it("sorts days chronologically", () => {
    const result = computeMonthlyPerformanceDetail(
      [outcome({ contacted_at: "2026-08-20T10:00:00Z" }), outcome({ contacted_at: "2026-08-03T10:00:00Z" })],
      MONTH_START,
    );
    expect(result[0].date).toBe("2026-08-03");
    expect(result[1].date).toBe("2026-08-20");
  });

  it("attributes different event types on the same day to the correct fields independently", () => {
    const result = computeMonthlyPerformanceDetail(
      [
        outcome({ contacted_at: "2026-08-05T09:00:00Z" }),
        outcome({ replied_at: "2026-08-05T11:00:00Z" }),
        outcome({ booked_call_at: "2026-08-05T13:00:00Z" }),
      ],
      MONTH_START,
    );
    expect(result).toHaveLength(1);
    expect(result[0].contacted).toBe(1);
    expect(result[0].replied).toBe(1);
    expect(result[0].meetings).toBe(1);
  });
});
