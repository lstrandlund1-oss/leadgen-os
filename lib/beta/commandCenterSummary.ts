// lib/beta/commandCenterSummary.ts
//
// Platform-wide summary metrics for the internal command center —
// aggregates the same per-tester data already computed by
// getAllTesterOverviews(), no new data-fetching logic needed. Revenue is
// shown as labeled "if X% convert to [plan]" scenarios using real base
// prices from lib/pricing.ts, never a single fabricated "projected
// revenue" number — nobody has converted yet, so there's no real
// conversion-rate data to base a genuine prediction on.

import type { TesterOverview } from "./adminOverview";
import { BASE_PRICES, type PlanKey } from "@/lib/pricing";

export type CommandCenterSummary = {
  totalTesters: number;
  activeTesters: number;
  expiredTesters: number;
  revokedTesters: number;
  convertedTesters: number;

  totalSearches: number;
  totalDeepSearches: number;
  totalLeadDetailViews: number;

  totalAiCostMicroUsd: number;
  aiCostByFeature: Record<string, { count: number; costMicroUsd: number }>;

  totalContacted: number;
  totalReplied: number;
  totalBookedCalls: number;
  totalClosed: number;

  testersEarnedDiscount: number;
  testersRedeemedDiscount: number;
  averageDiscountPercent: number | null;

  // Scenario, not a prediction: monthly revenue IF every tester who
  // earned a discount converts to this specific plan, discount applied
  // at their own actual granted percentage.
  revenueScenarios: Record<PlanKey, number>;
};

export function computeCommandCenterSummary(testers: TesterOverview[]): CommandCenterSummary {
  const totalTesters = testers.length;
  const activeTesters = testers.filter((t) => t.membershipStatus === "active").length;
  const expiredTesters = testers.filter((t) => t.membershipStatus === "expired").length;
  const revokedTesters = testers.filter((t) => t.membershipStatus === "revoked").length;
  const convertedTesters = testers.filter((t) => t.membershipStatus === "converted").length;

  const totalSearches = testers.reduce((sum, t) => sum + t.searchesCompleted, 0);
  const totalDeepSearches = testers.reduce((sum, t) => sum + t.deepSearchesCompleted, 0);
  const totalLeadDetailViews = testers.reduce((sum, t) => sum + t.leadDetailViews, 0);

  const aiCostByFeature: Record<string, { count: number; costMicroUsd: number }> = {};
  let totalAiCostMicroUsd = 0;
  for (const t of testers) {
    for (const [feature, usage] of Object.entries(t.aiUsage)) {
      const existing = aiCostByFeature[feature] ?? { count: 0, costMicroUsd: 0 };
      aiCostByFeature[feature] = {
        count: existing.count + usage.count,
        costMicroUsd: existing.costMicroUsd + usage.costMicroUsd,
      };
      totalAiCostMicroUsd += usage.costMicroUsd;
    }
  }

  const totalContacted = testers.reduce((sum, t) => sum + t.outcomes.contacted, 0);
  const totalReplied = testers.reduce((sum, t) => sum + t.outcomes.replied, 0);
  const totalBookedCalls = testers.reduce((sum, t) => sum + t.outcomes.bookedCall, 0);
  const totalClosed = testers.reduce((sum, t) => sum + t.outcomes.closed, 0);

  const withDiscount = testers.filter((t) => t.discountStatus === "earned" || t.discountStatus === "redeemed");
  const testersEarnedDiscount = testers.filter((t) => t.discountStatus === "earned").length;
  const testersRedeemedDiscount = testers.filter((t) => t.discountStatus === "redeemed").length;
  const discountPercents = withDiscount.map((t) => t.discountPercent).filter((p): p is number => p !== null);
  const averageDiscountPercent =
    discountPercents.length > 0
      ? Math.round(discountPercents.reduce((a, b) => a + b, 0) / discountPercents.length)
      : null;

  const revenueScenarios: Record<PlanKey, number> = { scout: 0, operator: 0, agency: 0 };
  for (const plan of Object.keys(BASE_PRICES) as PlanKey[]) {
    revenueScenarios[plan] = withDiscount.reduce((sum, t) => {
      const discount = (t.discountPercent ?? 0) / 100;
      return sum + BASE_PRICES[plan] * (1 - discount);
    }, 0);
  }

  return {
    totalTesters,
    activeTesters,
    expiredTesters,
    revokedTesters,
    convertedTesters,
    totalSearches,
    totalDeepSearches,
    totalLeadDetailViews,
    totalAiCostMicroUsd,
    aiCostByFeature,
    totalContacted,
    totalReplied,
    totalBookedCalls,
    totalClosed,
    testersEarnedDiscount,
    testersRedeemedDiscount,
    averageDiscountPercent,
    revenueScenarios,
  };
}
