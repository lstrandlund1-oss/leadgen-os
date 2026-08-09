import { describe, it, expect } from "vitest";
import { computeCommandCenterSummary } from "./commandCenterSummary";
import type { TesterOverview } from "./adminOverview";

function tester(overrides: Partial<TesterOverview> = {}): TesterOverview {
  return {
    membershipId: "m1",
    userId: "u1",
    userEmail: "test@example.com",
    invitationStatus: null,
    invitationEmail: null,
    companyName: null,
    membershipStatus: "active",
    activatedAt: "2026-01-01T00:00:00Z",
    activeDaysUsed: 3,
    hardEndAt: "2026-02-01T00:00:00Z",
    extendedDays: 0,
    extensionGrantedBy: null,
    extensionGrantedAt: null,
    searchesCompleted: 0,
    deepSearchesCompleted: 0,
    leadDetailViews: 0,
    aiUsage: {},
    outcomes: { contacted: 0, replied: 0, bookedCall: 0, closed: 0 },
    featureRatings: [],
    finalInterviewCompleted: false,
    requiredFeedbackCompleted: false,
    testimonialStatus: null,
    discountStatus: null,
    discountPercent: null,
    internalNotes: null,
    monetaryCeilingMicroUsd: null,
    allowanceOverrides: [],
    ...overrides,
  };
}

describe("computeCommandCenterSummary", () => {
  it("returns all zeros with no testers", () => {
    const s = computeCommandCenterSummary([]);
    expect(s.totalTesters).toBe(0);
    expect(s.revenueScenarios.operator).toBe(0);
  });

  it("counts membership statuses correctly", () => {
    const s = computeCommandCenterSummary([
      tester({ membershipStatus: "active" }),
      tester({ membershipStatus: "active" }),
      tester({ membershipStatus: "expired" }),
      tester({ membershipStatus: "converted" }),
    ]);
    expect(s.totalTesters).toBe(4);
    expect(s.activeTesters).toBe(2);
    expect(s.expiredTesters).toBe(1);
    expect(s.convertedTesters).toBe(1);
  });

  it("sums search counts across testers", () => {
    const s = computeCommandCenterSummary([
      tester({ searchesCompleted: 5, deepSearchesCompleted: 1 }),
      tester({ searchesCompleted: 3, deepSearchesCompleted: 2 }),
    ]);
    expect(s.totalSearches).toBe(8);
    expect(s.totalDeepSearches).toBe(3);
  });

  it("aggregates AI cost across testers and features", () => {
    const s = computeCommandCenterSummary([
      tester({ aiUsage: { outreach: { count: 5, costMicroUsd: 1000 }, followup: { count: 2, costMicroUsd: 200 } } }),
      tester({ aiUsage: { outreach: { count: 3, costMicroUsd: 600 } } }),
    ]);
    expect(s.totalAiCostMicroUsd).toBe(1800);
    expect(s.aiCostByFeature.outreach.count).toBe(8);
    expect(s.aiCostByFeature.outreach.costMicroUsd).toBe(1600);
    expect(s.aiCostByFeature.followup.count).toBe(2);
  });

  it("sums outcomes across testers", () => {
    const s = computeCommandCenterSummary([
      tester({ outcomes: { contacted: 10, replied: 4, bookedCall: 1, closed: 0 } }),
      tester({ outcomes: { contacted: 5, replied: 2, bookedCall: 1, closed: 1 } }),
    ]);
    expect(s.totalContacted).toBe(15);
    expect(s.totalReplied).toBe(6);
    expect(s.totalClosed).toBe(1);
  });

  it("only counts testers with earned or redeemed discount status toward discount metrics", () => {
    const s = computeCommandCenterSummary([
      tester({ discountStatus: "earned", discountPercent: 30 }),
      tester({ discountStatus: "redeemed", discountPercent: 30 }),
      tester({ discountStatus: "pending", discountPercent: 30 }),
      tester({ discountStatus: null, discountPercent: null }),
    ]);
    expect(s.testersEarnedDiscount).toBe(1);
    expect(s.testersRedeemedDiscount).toBe(1);
    expect(s.averageDiscountPercent).toBe(30);
  });

  it("returns null averageDiscountPercent when nobody has a discount", () => {
    const s = computeCommandCenterSummary([tester()]);
    expect(s.averageDiscountPercent).toBeNull();
  });

  it("computes revenue scenarios applying each tester's own discount percentage", () => {
    const s = computeCommandCenterSummary([
      tester({ discountStatus: "earned", discountPercent: 50 }),
      tester({ discountStatus: "earned", discountPercent: 0 }),
    ]);
    // operator base is 89 — one at 50% off (44.5) + one at 0% off (89) = 133.5
    expect(s.revenueScenarios.operator).toBeCloseTo(133.5, 1);
  });

  it("excludes testers without an earned/redeemed discount from revenue scenarios", () => {
    const s = computeCommandCenterSummary([
      tester({ discountStatus: "earned", discountPercent: 0 }),
      tester({ discountStatus: "pending", discountPercent: 0 }),
    ]);
    expect(s.revenueScenarios.operator).toBe(89);
  });
});
