// lib/fit/fitScore.ts
import type { Capability, WeightedNeed } from "@/lib/fit/needs";
import type { UserProfileV1, CapabilityProfile } from "@/lib/types.ts";

export type FitResult = {
  fitScore: number; // 0-100
  matchedNeeds: Capability[];
  missingNeeds: Capability[];
  reasons: string[];
};

/**
 * Deterministic weighted fit scoring:
 * - Fit is coverage of required needs by the user's capabilities.
 * - Weighted so "website(5)" matters more than "crm(2)" etc.
 * - If needs are empty, return neutral 50 (avoid false certainty).
 */
export function scoreFit(
  userProfile: UserProfileV1,
  capabilityProfile: CapabilityProfile,
  needs: WeightedNeed[],
): FitResult {
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
  let profileModifier = 0;

  const profileReasons: string[] = [];
  const matched: Capability[] = [];
  const missing: Capability[] = [];

  // Profile-based modifiers (deterministic layer)
  if (userProfile.acquisitionStyle === "aggressive") {
    profileModifier += 10;
    profileReasons.push(
      "Aggressive profile → higher tolerance for imperfect leads.",
    );
  } else if (userProfile.acquisitionStyle === "premium") {
    profileModifier -= 10;
    profileReasons.push("Premium profile → stricter qualification standard.");
  }

  // Use missing capabilities as a proxy for conversion difficulty
  if (userProfile.experienceLevel === "beginner" && missing.length >= 3) {
    profileModifier -= 15;
    profileReasons.push(
      "Beginner profile → too many gaps to convert confidently.",
    );
  } else if (userProfile.experienceLevel === "advanced" && missing.length >= 3) {
    profileModifier += 5;
    profileReasons.push(
      "Advanced profile → capable of handling imperfect leads.",
    );
  }

  for (const n of needs) {
    totalWeight += n.weight;

    if (capabilityProfile.capabilities[n.key]) {
      matchedWeight += n.weight;
      matched.push(n.key);
    } else {
      missing.push(n.key);
    }
  }

  const baseFitScore =
    totalWeight > 0 ? Math.round((matchedWeight / totalWeight) * 100) : 50;
  const finalFitScore = Math.max(
    0,
    Math.min(100, baseFitScore + profileModifier),
  );

  const reasons: string[] = [];
  reasons.push(
    `Weighted coverage: ${matchedWeight}/${totalWeight} (matchedWeight/totalWeight).`,
  );

  if (matched.length) reasons.push(`Matches: ${matched.join(", ")}.`);
  if (missing.length) reasons.push(`Missing: ${missing.join(", ")}.`);

  return {
    fitScore: finalFitScore,
    matchedNeeds: matched,
    missingNeeds: missing,
    reasons: [...reasons, ...profileReasons],
  };
}

/**
 * v1 temporary profile: Ads specialist (Option C).
 * Keep it here so route.ts stays thin.
 */
export const TEMP_ADS_SPECIALIST_CAPS: CapabilityProfile = {
  id: "temp_ads_specialist_caps",
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
