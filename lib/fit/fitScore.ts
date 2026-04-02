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
  fitScore: number; // 0-100
  matchedNeeds: Capability[]; // needs the user can cover (depth > 0)
  missingNeeds: Capability[]; // needs the user cannot cover (depth === 0)
  partialNeeds: Capability[]; // needs covered but at low depth (< 40)
  reasons: string[];
  tooltip: string; // plain English for hover display
  geoMatch?: "exact" | "partial" | "none" | "unset";
};

function normLoc(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
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

  if (parts.every((p) => haystack.includes(p))) {
    return {
      modifier: 12,
      match: "exact",
      reason: `Geography match — lead is in your target area (${targetLocation}).`,
    };
  }
  if (parts.some((p) => haystack.includes(p))) {
    return {
      modifier: 5,
      match: "partial",
      reason: `Geography partial match — lead overlaps with your target area (${targetLocation}).`,
    };
  }
  return {
    modifier: -8,
    match: "none",
    reason: `Geography mismatch — lead is outside your target area (${targetLocation}).`,
  };
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
  let baseFit = totalWeight > 0 ? Math.round((totalContribution / totalWeight) * 100) : 50;

  // Hard penalty for missing high-weight needs
  // If the primary need (weight 5) is missing, this is a significant mismatch
  const criticalMissing = needs.filter((n) => n.weight >= 4 && (capabilityProfile.capabilities[n.key] ?? 0) === 0);
  if (criticalMissing.length > 0) {
    baseFit = Math.min(baseFit, 45);
    reasons.push(`Missing critical need: ${criticalMissing.map((n) => n.key).join(", ")} (high weight)`);
  }

  // Acquisition style modifier
  let styleModifier = 0;
  if (userProfile.acquisitionStyle === "volume") styleModifier = 8;
  else if (userProfile.acquisitionStyle === "selective") styleModifier = -8;

  // Geo modifier
  const finalFit = Math.max(0, Math.min(100, baseFit + styleModifier + geo.modifier));

  // Build plain-English fit tooltip
  const capabilityLabels: Record<string, string> = {
    ads: "paid advertising",
    tracking: "analytics & tracking",
    funnel: "conversion funnels",
    content: "content & social media",
    website: "website development",
    seo: "SEO",
    crm: "CRM & follow-up",
  };

  const toLabel = (key: string) => capabilityLabels[key] ?? key;

  const fitLines: string[] = [];

  if (matched.length > 0 && missing.length === 0 && partial.length === 0) {
    fitLines.push(
      `Your capabilities are a strong match for what this business needs. You cover ${matched.map(toLabel).join(", ")}.`,
    );
  } else if (matched.length > 0 || partial.length > 0) {
    const strongCovers = matched.map(toLabel);
    const weakCovers = partial.map(toLabel);
    if (strongCovers.length > 0) {
      fitLines.push(`You directly cover ${strongCovers.join(", ")} — the needs this business has in those areas.`);
    }
    if (weakCovers.length > 0) {
      fitLines.push(
        `You have some capability in ${weakCovers.join(", ")} but it's not your primary strength — you can help but won't be the strongest option.`,
      );
    }
  }

  if (missing.length > 0) {
    const missingLabels = missing.map(toLabel);
    if (missing.length === 1) {
      fitLines.push(
        `This business also needs ${missingLabels[0]}, which is outside your current offering — that's the main gap limiting your fit.`,
      );
    } else {
      fitLines.push(
        `This business also needs ${missingLabels.slice(0, -1).join(", ")} and ${missingLabels[missingLabels.length - 1]}, which you don't currently offer. This limits how well you can serve their full needs.`,
      );
    }
  }

  if (geo.reason) fitLines.push(geo.reason);

  if (fitLines.length === 0) {
    fitLines.push("No clear needs detected for this business yet — fit will update as more signals become available.");
  }

  const tooltip = fitLines.join(" ");

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
