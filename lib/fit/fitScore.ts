// lib/fit/fitScore.ts
//
// v3 weighted fit scoring.
//
// Key changes from v2:
//   - capabilities are now 0-100 depth values, not booleans
//   - matchedWeight uses depth as a multiplier: need.weight * (depth/100)
//   - specialisation bonus: if user has 1-2 capabilities at 80+, those leads
//     score higher — a laser-focused specialist beats a generalist on their niche
//   - opportunity separation: fit score reflects "can you serve this lead",
//     NOT "is there a gap" — opportunity is scored separately in universalScore

import type { Capability, WeightedNeed } from "@/lib/fit/needs";
import type { UserProfileV1, CapabilityProfile } from "@/lib/types.ts";

export type FitResult = {
  fitScore: number; // 0-100
  matchedNeeds: Capability[];
  missingNeeds: Capability[];        // capabilities with depth=0
  partialNeeds: Capability[];        // capabilities with depth 1-49
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

  const exactMatch = parts.every((p) => haystack.includes(p));
  if (exactMatch) {
    return {
      modifier: 12,
      match: "exact",
      reason: `Geography match: lead is in target area (${targetLocation}).`,
    };
  }

  const partialMatch = parts.some((p) => haystack.includes(p));
  if (partialMatch) {
    return {
      modifier: 5,
      match: "partial",
      reason: `Geography partial match: lead overlaps with target area (${targetLocation}).`,
    };
  }

  return {
    modifier: -8,
    match: "none",
    reason: `Geography mismatch: lead is outside target area (${targetLocation}).`,
  };
}

/**
 * Reads capability depth from the profile.
 * Handles both legacy boolean profiles (true=100, false=0) and new numeric profiles.
 */
function getDepth(cap: CapabilityProfile, key: Capability): number {
  const raw = cap.capabilities[key];
  if (typeof raw === "boolean") return raw ? 100 : 0; // backward compat
  if (typeof raw === "number") return Math.max(0, Math.min(100, raw));
  return 0;
}

/**
 * Specialisation bonus: reward profiles that are deeply focused.
 * If the user has 1-2 capabilities at depth 80+, they get a bonus on leads
 * where those exact capabilities are the primary need (weight >= 4).
 *
 * Logic: a specialist beats a generalist on their home turf.
 * An agency with seo=60 loses to a specialist with seo=95, even if the agency
 * technically "has" SEO in their offering.
 *
 * Returns a bonus between 0-15.
 */
function computeSpecialisationBonus(
  cap: CapabilityProfile,
  needs: WeightedNeed[],
): number {
  const allDepths = Object.entries(cap.capabilities).map(([, v]) =>
    typeof v === "boolean" ? (v ? 100 : 0) : Number(v)
  );

  // Count how many capabilities are at "specialist" level (80+)
  const specialistCaps = allDepths.filter((d) => d >= 80).length;

  // Only applies when the user is genuinely specialised (1-2 deep caps)
  if (specialistCaps === 0 || specialistCaps > 3) return 0;

  // Check how many of the lead's primary needs (weight >= 4) match a specialist cap
  let primaryMatchBonus = 0;
  for (const need of needs) {
    if (need.weight < 4) continue;
    const depth = getDepth(cap, need.key);
    if (depth >= 80) {
      // Specialist-level match on a primary need
      primaryMatchBonus += 5;
    }
  }

  // Bonus is higher when the specialist has fewer total offerings
  // (a pure SEO shop gets more credit than an agency that also does SEO)
  const breadthPenalty = Math.max(0, specialistCaps - 1) * 2;
  return Math.min(15, primaryMatchBonus - breadthPenalty);
}

/**
 * v3 deterministic weighted fit scoring.
 *
 * fit = Σ(need.weight × depth/100) / Σ(need.weight) × 100
 *
 * This means:
 * - A specialist with seo=95 on an SEO need scores near-perfect
 * - An agency with seo=60 on the same need scores 60% of that weight
 * - A specialist with seo=95 + ads=0 on an ads need scores 0 for that need
 * - Missing a need entirely (depth=0) contributes 0 — same as before
 */
export function scoreFit(
  userProfile: UserProfileV1,
  capabilityProfile: CapabilityProfile,
  needs: WeightedNeed[],
  leadLocation?: { city?: string | null; country?: string | null },
): FitResult {
  const geo = scoreGeo(userProfile.targetLocation, leadLocation?.city, leadLocation?.country);

  if (!needs.length) {
    return {
      fitScore: 50,
      matchedNeeds: [],
      missingNeeds: [],
      partialNeeds: [],
      reasons: ["No clear need signature detected yet → neutral fit.", ...(geo.reason ? [geo.reason] : [])],
      geoMatch: geo.match,
    };
  }

  let totalWeight = 0;
  let matchedWeight = 0;
  let profileModifier = 0;

  const profileReasons: string[] = [];
  const matched: Capability[] = [];   // depth >= 50
  const partial: Capability[] = [];   // depth 1-49
  const missing: Capability[] = [];   // depth 0

  // Profile-based modifiers
  if (userProfile.acquisitionStyle === "volume") {
    profileModifier += 8;
    profileReasons.push("Volume-focused profile → higher tolerance for imperfect leads.");
  } else if (userProfile.acquisitionStyle === "selective") {
    profileModifier -= 8;
    profileReasons.push("Selective profile → stricter qualification standard.");
  }

  for (const n of needs) {
    totalWeight += n.weight;
    const depth = getDepth(capabilityProfile, n.key);

    // Weighted contribution: full weight only at depth=100, scales linearly
    const contribution = n.weight * (depth / 100);
    matchedWeight += contribution;

    if (depth >= 50) {
      matched.push(n.key);
    } else if (depth > 0) {
      partial.push(n.key);
    } else {
      missing.push(n.key);
    }
  }

  // Experience modifier on missing coverage
  if (userProfile.experienceLevel === "beginner" && missing.length >= 3) {
    profileModifier -= 15;
    profileReasons.push("Beginner profile → too many gaps to convert confidently.");
  } else if (userProfile.experienceLevel === "advanced" && missing.length >= 3) {
    profileModifier += 5;
    profileReasons.push("Advanced profile → capable of handling imperfect leads.");
  }

  const baseFitScore =
    totalWeight > 0 ? Math.round((matchedWeight / totalWeight) * 100) : 50;

  const specialisationBonus = computeSpecialisationBonus(capabilityProfile, needs);

  const finalFitScore = Math.max(
    0,
    Math.min(100, baseFitScore + profileModifier + geo.modifier + specialisationBonus),
  );

  const reasons: string[] = [];
  reasons.push(
    `Weighted depth coverage: ${Math.round(matchedWeight * 10) / 10}/${totalWeight} pts.`,
  );
  if (matched.length) reasons.push(`Strong match: ${matched.join(", ")}.`);
  if (partial.length) reasons.push(`Partial capability: ${partial.join(", ")}.`);
  if (missing.length) reasons.push(`Not offered: ${missing.join(", ")}.`);
  if (specialisationBonus > 0) reasons.push(`Specialist bonus: +${specialisationBonus} (deep focus on primary need).`);
  if (geo.reason) reasons.push(geo.reason);

  return {
    fitScore: finalFitScore,
    matchedNeeds: matched,
    missingNeeds: missing,
    partialNeeds: partial,
    reasons: [...reasons, ...profileReasons],
    geoMatch: geo.match,
  };
}