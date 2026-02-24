// lib/fit/fitScore.ts
import type { Capability, WeightedNeed } from "@/lib/fit/needs";

export type UserProfileV1 = {
  lineOfBusiness: "ads_specialist";
  capabilities: Record<Capability, boolean>;
};

export type FitResult = {
  fitScore: number; // 0-100
  matchedNeeds: Capability[];
  missingNeeds: Capability[];
  reasons: string[];
};

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n));
}

/**
 * Deterministic weighted fit scoring:
 * - Fit is coverage of required needs by the user's capabilities.
 * - Weighted so "website(5)" matters more than "crm(2)" etc.
 * - If needs are empty, return neutral 50 (avoid false certainty).
 */
export function scoreFit(profile: UserProfileV1, needs: WeightedNeed[]): FitResult {
  if (!needs.length) {
    return {
      fitScore: 50,
      matchedNeeds: [],
      missingNeeds: [],
      reasons: ["No clear need signature detected yet → neutral fit."],
    };
  }

  let totalWeight = 0;
  let matchedWeight = 0;

  const matched: Capability[] = [];
  const missing: Capability[] = [];

  for (const n of needs) {
    totalWeight += n.weight;

    if (profile.capabilities[n.key]) {
      matchedWeight += n.weight;
      matched.push(n.key);
    } else {
      missing.push(n.key);
    }
  }

  const coverage = totalWeight > 0 ? matchedWeight / totalWeight : 0;
  const fitScore = clamp(Math.round(coverage * 100));

  const reasons: string[] = [];
  reasons.push(
    `Weighted coverage: ${matchedWeight}/${totalWeight} (matchedWeight/totalWeight).`,
  );

  if (matched.length) reasons.push(`Matches: ${matched.join(", ")}.`);
  if (missing.length) reasons.push(`Missing: ${missing.join(", ")}.`);

  return { fitScore, matchedNeeds: matched, missingNeeds: missing, reasons };
}

/**
 * v1 temporary profile: Ads specialist (Option C).
 * Keep it here so route.ts stays thin.
 */
export const TEMP_ADS_SPECIALIST_PROFILE: UserProfileV1 = {
  lineOfBusiness: "ads_specialist",
  capabilities: {
    ads: true,
    tracking: true,
    funnel: true,
    content: false,
    website: false,
    seo: false,
    crm: false,
  },
};