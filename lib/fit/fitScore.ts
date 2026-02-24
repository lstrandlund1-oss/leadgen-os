// lib/fit/fitScore.ts
import type { Capability } from "@/lib/fit/needs";

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
 * Deterministic fit scoring:
 * - Fit is coverage of required needs by the user's capabilities.
 * - If needs are empty, return neutral 50 (avoid false certainty).
 */
export function scoreFit(profile: UserProfileV1, needs: Capability[]): FitResult {
  if (!needs.length) {
    return {
      fitScore: 50,
      matchedNeeds: [],
      missingNeeds: [],
      reasons: ["No clear need signature detected yet → neutral fit."],
    };
  }

  const matched: Capability[] = [];
  const missing: Capability[] = [];

  for (const n of needs) {
    if (profile.capabilities[n]) matched.push(n);
    else missing.push(n);
  }

  const coverage = matched.length / needs.length;
  const fitScore = clamp(Math.round(coverage * 100));

  const reasons: string[] = [];
  reasons.push(`Coverage: ${matched.length}/${needs.length} needs matched.`);
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