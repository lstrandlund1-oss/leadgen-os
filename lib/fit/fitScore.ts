// lib/fit/fitScore.ts
import type { Capability, WeightedNeed } from "@/lib/fit/needs";
import type { UserProfileV1, CapabilityProfile } from "@/lib/types.ts";

export type FitResult = {
  fitScore: number; // 0-100
  matchedNeeds: Capability[];
  missingNeeds: Capability[];
  reasons: string[];
  geoMatch?: "exact" | "partial" | "none" | "unset";
};

// Normalise a location string for fuzzy matching
function normLoc(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
}

function scoreGeo(
  targetLocation: string | undefined,
  city: string | null | undefined,
  country: string | null | undefined,
): { modifier: number; match: "exact" | "partial" | "none" | "unset"; reason: string } {
  if (!targetLocation || !targetLocation.trim()) {
    return { modifier: 0, match: "unset", reason: "" };
  }

  const target = normLoc(targetLocation);
  const parts = target.split(/[\s,]+/).filter(Boolean);
  const haystack = normLoc(`${city ?? ""} ${country ?? ""}`);

  // Exact: every token in target found in haystack
  const exactMatch = parts.every((p) => haystack.includes(p));
  if (exactMatch) {
    return {
      modifier: 12,
      match: "exact",
      reason: `Geography match: lead is in target area (${targetLocation}).`,
    };
  }

  // Partial: at least one token matches
  const partialMatch = parts.some((p) => haystack.includes(p));
  if (partialMatch) {
    return {
      modifier: 5,
      match: "partial",
      reason: `Geography partial match: lead overlaps with target area (${targetLocation}).`,
    };
  }

  // No match — penalise slightly so in-area leads surface first
  return {
    modifier: -8,
    match: "none",
    reason: `Geography mismatch: lead is outside target area (${targetLocation}).`,
  };
}

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
  leadLocation?: { city?: string | null; country?: string | null },
): FitResult {
  if (!needs.length) {
    const geo = scoreGeo(userProfile.targetLocation, leadLocation?.city, leadLocation?.country);
    return {
      fitScore: 50,
      matchedNeeds: [],
      missingNeeds: [],
      reasons: ["No clear need signature detected yet → neutral fit.", ...(geo.reason ? [geo.reason] : [])],
      geoMatch: geo.match,
    };
  }

  let totalWeight = 0;
  let matchedWeight = 0;
  let profileModifier = 0;

  const profileReasons: string[] = [];
  const matched: Capability[] = [];
  const missing: Capability[] = [];

  // Profile-based modifiers (deterministic layer)
  if (userProfile.acquisitionStyle === "volume") {
    profileModifier += 10;
    profileReasons.push(
      "Aggressive profile → higher tolerance for imperfect leads.",
    );
  } else if (userProfile.acquisitionStyle === "selective") {
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
  const geo = scoreGeo(userProfile.targetLocation, leadLocation?.city, leadLocation?.country);
  const finalFitScore = Math.max(
    0,
    Math.min(100, baseFitScore + profileModifier + geo.modifier),
  );

  const reasons: string[] = [];
  reasons.push(
    `Weighted coverage: ${matchedWeight}/${totalWeight} (matchedWeight/totalWeight).`,
  );

  if (matched.length) reasons.push(`Matches: ${matched.join(", ")}.`);
  if (missing.length) reasons.push(`Missing: ${missing.join(", ")}.`);
  if (geo.reason) reasons.push(geo.reason);

  return {
    fitScore: finalFitScore,
    matchedNeeds: matched,
    missingNeeds: missing,
    reasons: [...reasons, ...profileReasons],
    geoMatch: geo.match,
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