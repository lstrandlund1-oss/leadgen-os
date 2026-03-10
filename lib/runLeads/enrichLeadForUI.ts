// lib/runLeads/enrichLeadForUI.ts
// v2: passes fitScore + base signals into the new composite scorer

import type { HydratedLeadSummary } from "./hydrateLead";
import { computeUniversalScore } from "@/lib/scoring/universalScore";
import { classifyBusinessCondition } from "@/lib/scoring/businessCondition";

export interface UIEnrichmentResult {
  scoreOverride: {
    value: number;
    opportunity: number;
    readiness: number;
    risk: number;
  };
  fitBlock: {
    fitScore: number;
    matchedNeeds: string[];
    missingNeeds: string[];
    geoMatch: "exact" | "partial" | "none" | "unset" | undefined;
    reasons: string[];
  };
  diagnosisSummary: string;
  categoryScores: {
    reputation: number;
    digitalPresence: number;
    businessStrength: number;
    opportunityGap: number;
    stabilityRisk: number;
    evidenceConfidence: number;
  };
}

export function enrichLeadForUI(
  hydrated: HydratedLeadSummary,
  rawRating?: number | null,
  rawReviews?: number | null,
  hasWebsite?: boolean,
  rawSocialPresence?: "low" | "medium" | "high" | null,
): UIEnrichmentResult {
  const { digital, business, fit } = hydrated;
  const cs = business.categoryScores;

  // Derive socialPresence from the signal value stored during extraction
  const socialSignal = digital.signals.find(s => s.key === "social_presence");
  const socialPresence: "low" | "medium" | "high" =
    rawSocialPresence ??
    (socialSignal?.value === "high" ? "high" : socialSignal?.value === "medium" ? "medium" : "low");

  const riskProfile = classifyBusinessCondition({
    scores: cs,
    isGoodFit: fit.fitScore >= 60,
    hasWebsite: hasWebsite ?? digital.hasWebsite,
    socialPresence,
    reviews: rawReviews ?? 0,
    rating: rawRating ?? 0,
  });

  const universal = computeUniversalScore({
    scores: cs,
    riskProfile,
    isGoodFit: fit.fitScore >= 60,
    classificationConfidence: null,
    fitScore: fit.fitScore,
    rating: rawRating ?? 0,
    reviews: rawReviews ?? 0,
    hasWebsite: hasWebsite ?? digital.hasWebsite,
  });

  return {
    scoreOverride: {
      value: universal.value,
      opportunity: universal.opportunity,
      readiness: universal.readiness,
      risk: universal.risk,
    },
    fitBlock: {
      fitScore: fit.fitScore,
      matchedNeeds: fit.matchedNeeds,
      missingNeeds: fit.missingNeeds,
      geoMatch: fit.geoMatch,
      reasons: fit.reasons,
    },
    diagnosisSummary: business.diagnosis.summaryLine,
    categoryScores: {
      reputation: cs.reputation,
      digitalPresence: cs.digitalPresence,
      businessStrength: cs.businessStrength,
      opportunityGap: cs.opportunityGap,
      stabilityRisk: cs.stabilityRisk,
      evidenceConfidence: cs.evidenceConfidence,
    },
  };
}