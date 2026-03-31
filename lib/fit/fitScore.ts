// lib/fit/fitScore.ts
//
// Depth-weighted fit scoring.
// A user with ads:90 scores higher on an ads-heavy lead than ads:20.
// A user with ads:0 cannot cover an ads need at all — hard miss.
//
// Formula:
//   For each lead need (weight 1-5):
//     if capability depth > 0:  contribution = (depth/100) * weight
//     if capability depth === 0: contribution = 0, penalty applied
//   fitScore = (totalContribution / maxPossible) * 100
//   Then apply geo modifier and acquisition style modifier.

import type { WeightedNeed, Capability } from "@/lib/fit/needs";
import type { UserProfileV1, CapabilityProfile } from "@/lib/types";

export type FitResult = {
  fitScore: number;           // 0-100
  matchedNeeds: Capability[]; // needs the user can cover (depth > 0)
  missingNeeds: Capability[]; // needs the user cannot cover (depth === 0)
  partialNeeds: Capability[]; // needs covered but at low depth (< 40)
  reasons: string[];
  tooltip: string;            // plain English for hover display
  geoMatch?: "exact" | "partial" | "none" | "unset";
};

function normLoc(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
}

function scoreGeo(
  targetLocation: string | undefined,
  city: string | null | undefined,
  country: string | null | undefined,
): { modifier: number; match: "exact" | "partial" | "none" | "unset"; reason: string } {
  if (!targetLocation?.trim()) {
    return { modifier: 0, match: "unset", reason: "" };
  }
  const target = normLoc(targetLocation);
  const parts = target.split(/[\s,]+/).filter(Boolean);
  const haystack = normLoc(`${city ?? ""} ${country ?? ""}`);

  if (parts.every(p => haystack.includes(p))) {
    return { modifier: 12, match: "exact", reason: `Geography match — lead is in your target area (${targetLocation}).` };
  }
  if (parts.some(p => haystack.includes(p))) {
    return { modifier: 5, match: "partial", reason: `Geography partial match — lead overlaps with your target area (${targetLocation}).` };
  }
  return { modifier: -8, match: "none", reason: `Geography mismatch — lead is outside your target area (${targetLocation}).` };
}

export function scoreFit(
  userProfile: UserProfileV1,
  capabilityProfile: CapabilityProfile,
  needs: WeightedNeed[],
  leadLocation?: { city?: string | null; country?: string | null },
): FitResult {
  const geo = scoreGeo(userProfile.targetLocation, leadLocation?.city, leadLocation?.country);

  // No needs detected — neutral score, can't say much
  if (!needs.length) {
    const tooltip = "No specific needs detected for this business yet. Score is neutral until signals are clearer.";
    return {
      fitScore: 50,
      matchedNeeds: [],
      missingNeeds: [],
      partialNeeds: [],
      reasons: ["No clear need signature detected — neutral fit.", ...(geo.reason ? [geo.reason] : [])],
      tooltip,
      geoMatch: geo.match,
    };
  }

  const matched: Capability[] = [];
  const missing: Capability[] = [];
  const partial: Capability[] = [];
  const reasons: string[] = [];

  let totalWeight = 0;
  let totalContribution = 0;
  let missingWeight = 0;

  for (const need of needs) {
    const depth = capabilityProfile.capabilities[need.key] ?? 0;
    totalWeight += need.weight;

    if (depth === 0) {
      // Cannot cover this need at all
      missing.push(need.key);
      missingWeight += need.weight;
    } else {
      // Depth-weighted contribution: full weight only at depth 100
      const contribution = (depth / 100) * need.weight;
      totalContribution += contribution;

      if (depth < 40) {
        // Low depth — can technically do it but not well
        partial.push(need.key);
        reasons.push(`Weak on ${need.key} (depth ${depth}/100, weight ${need.weight})`);
      } else {
        matched.push(need.key);
      }
    }
  }

  // Base fit: contribution as % of max possible
  let baseFit = totalWeight > 0
    ? Math.round((totalContribution / totalWeight) * 100)
    : 50;

  // Hard penalty for missing high-weight needs
  // If the primary need (weight 5) is missing, this is a significant mismatch
  const criticalMissing = needs.filter(n =>
    n.weight >= 4 && (capabilityProfile.capabilities[n.key] ?? 0) === 0
  );
  if (criticalMissing.length > 0) {
    baseFit = Math.min(baseFit, 45);
    reasons.push(`Missing critical need: ${criticalMissing.map(n => n.key).join(", ")} (high weight)`);
  }

  // Acquisition style modifier
  let styleModifier = 0;
  if (userProfile.acquisitionStyle === "volume") styleModifier = 8;
  else if (userProfile.acquisitionStyle === "selective") styleModifier = -8;

  // Geo modifier
  const finalFit = Math.max(0, Math.min(100, baseFit + styleModifier + geo.modifier));

  // Build tooltip
  const matchedStr = matched.length > 0 ? `Covers: ${matched.join(", ")}.` : "";
  const partialStr = partial.length > 0 ? `Partial: ${partial.join(", ")} (low depth).` : "";
  const missingStr = missing.length > 0 ? `Can't cover: ${missing.join(", ")}.` : "";
  const geoStr = geo.reason || "";
  const tooltip = [
    `Fit ${finalFit} —`,
    matchedStr,
    partialStr,
    missingStr,
    geoStr,
  ].filter(Boolean).join(" ");

  if (matched.length) reasons.push(`Covers: ${matched.join(", ")}.`);
  if (geo.reason) reasons.push(geo.reason);

  return {
    fitScore: finalFit,
    matchedNeeds: matched,
    missingNeeds: missing,
    partialNeeds: partial,
    reasons,
    tooltip,
    geoMatch: geo.match,
  };
}