import { describe, it, expect } from "vitest";
import { computeRealCostMicroUsd } from "./cost";

describe("computeRealCostMicroUsd", () => {
  it("computes cost using Haiku 4.5 pricing ($1/M input, $5/M output)", () => {
    // 1000 input tokens = 1000 micro-USD, 1000 output tokens = 5000 micro-USD
    const cost = computeRealCostMicroUsd({ inputTokens: 1000, outputTokens: 1000 });
    expect(cost).toBe(1000 * 1 + 1000 * 5);
  });

  it("sums cost across multiple pipeline stages (e.g. outreach = draft + humanize)", () => {
    const cost = computeRealCostMicroUsd(
      { inputTokens: 500, outputTokens: 200 },
      { inputTokens: 300, outputTokens: 150 },
    );
    const expected = 500 * 1 + 200 * 5 + (300 * 1 + 150 * 5);
    expect(cost).toBe(expected);
  });

  it("returns null (not zero) when no stage returned usage data, so callers fall back to an estimate", () => {
    expect(computeRealCostMicroUsd(undefined)).toBeNull();
    expect(computeRealCostMicroUsd(undefined, undefined)).toBeNull();
  });

  it("sums only the stages that have usage data, ignoring stages that don't", () => {
    const cost = computeRealCostMicroUsd({ inputTokens: 100, outputTokens: 100 }, undefined);
    expect(cost).toBe(100 * 1 + 100 * 5);
  });
});
