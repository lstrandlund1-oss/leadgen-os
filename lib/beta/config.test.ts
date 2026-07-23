import { describe, it, expect } from "vitest";
import {
  BETA_ACTIVE_DAYS_LIMIT,
  BETA_CALENDAR_DAYS_LIMIT,
  BETA_EXTENSION_DAYS,
  BETA_COMPLETION_MIN_ACTIVE_DAYS,
  BETA_DISCOUNT_PERCENT,
  BETA_DISCOUNT_MONTHS,
  BETA_DEFAULT_ALLOWANCES,
} from "./config";

describe("beta config defaults match the spec exactly", () => {
  it("duration limits", () => {
    expect(BETA_ACTIVE_DAYS_LIMIT).toBe(7);
    expect(BETA_CALENDAR_DAYS_LIMIT).toBe(14);
    expect(BETA_EXTENSION_DAYS).toBe(7);
  });

  it("completion criteria", () => {
    expect(BETA_COMPLETION_MIN_ACTIVE_DAYS).toBe(3);
  });

  it("discount terms", () => {
    expect(BETA_DISCOUNT_PERCENT).toBe(30);
    expect(BETA_DISCOUNT_MONTHS).toBe(12);
  });

  it("AI allowances", () => {
    expect(BETA_DEFAULT_ALLOWANCES.outreach).toEqual({ daily: 10, total: 40 });
    expect(BETA_DEFAULT_ALLOWANCES.followup).toEqual({ daily: 5, total: 20 });
    expect(BETA_DEFAULT_ALLOWANCES.ai_deep_search).toEqual({ daily: 2, total: 5 });
  });
});
