// lib/scoring/universalScore.ts
//
// v2 composite score engine.
//
// score = needSignal*0.38 + fitAlignment*0.30 + abilityToPay*0.18 + approachability*0.14
//
// readiness  = how operationally capable the business is (unchanged, used in detail panel)
// risk       = stability risk (unchanged, used in detail panel)
// opportunity = needSignal remapped 0-100 (replaces old opportunity which was confusingly named)

import type { ScoreCategoryBreakdown, RiskProfile } from "@/lib/types";
import { getAbilityToPayScore, getApproachabilityScore } from "./categoryScores";

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n));
}

function round(n: number): number {
  return Math.round(n);
}

export function computeUniversalScore(input: {
  scores: ScoreCategoryBreakdown;
  riskProfile: RiskProfile;
  isGoodFit: boolean;
  classificationConfidence: number | null;
  // v2 inputs (with fallbacks for backward compat)
  fitScore?: number;
  rating?: number;
  reviews?: number;
  hasWebsite?: boolean;
}): {
  value: number;
  opportunity: number;
  readiness: number;
  risk: number;
} {
  const s = input.scores;

  // readiness: how operationally prepared are they (shown in detail panel)
  const readiness = clamp(round(
    s.businessStrength * 0.6 + s.digitalPresence * 0.2 + s.evidenceConfidence * 0.2
  ));

  // risk: stability risk (shown in detail panel)
  const risk = clamp(round(
    s.stabilityRisk * 0.75 +
    (100 - s.evidenceConfidence) * 0.15 +
    (input.riskProfile === "mature_competitor" ? 10 : 0)
  ));

  // opportunity = needSignal (opportunityGap in v2 IS the need signal)
  const opportunity = clamp(s.opportunityGap);

  // abilityToPay: use stored scores or recompute from inputs
  const abilityToPay = getAbilityToPayScore({
    rating: input.rating ?? 0,
    reviews: input.reviews ?? 0,
    hasWebsite: input.hasWebsite ?? false,
  });

  // approachability: profile-based
  const approachability = getApproachabilityScore(input.riskProfile);

  // fitAlignment: from fit score (0-100), default 50 if not provided
  // Cap: when opportunityGap is very low (<20), a perfect fit is still a bad lead —
  // there's nothing to sell. Scale fitAlignment contribution down proportionally
  // so "everything matches" doesn't save a lead with no detectable gap.
  const rawFitAlignment = clamp(input.fitScore ?? (input.isGoodFit ? 70 : 45));
  const opportunityScale = clamp(s.opportunityGap / 100) * 0.7 + 0.3; // 0.3–1.0 multiplier
  const fitAlignment = clamp(round(rawFitAlignment * opportunityScale));

  // Composite
  let value = clamp(round(
    opportunity    * 0.38 +
    fitAlignment   * 0.30 +
    abilityToPay   * 0.18 +
    approachability * 0.14
  ));

  // Hard caps for unwinnable situations
  if (input.riskProfile === "unstable_business") {
    value = Math.min(value, 22);
  }
  if (input.riskProfile === "mature_competitor" && opportunity <= 15) {
    value = Math.min(value, 32);
  }

  return { value, opportunity, readiness, risk };
}