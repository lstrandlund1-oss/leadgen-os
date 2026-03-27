// lib/scoring/universalScore.ts
//
// v3 composite score engine.
//
// score = opportunitySignal*0.40 + fitAlignment*0.28 + abilityToPay*0.18 + approachability*0.14
//
// Key principle: fit and opportunity are INDEPENDENT axes.
//   - fitAlignment  = "are you the right person to solve this?" (from fitScore)
//   - opportunityGap = "does this lead actually have a problem worth solving?" (from signals)
//
// A lead with great SEO + you're an SEO specialist = high fit, LOW opportunity
//   → fitAlignment high, but opportunityGap low → composite stays moderate
//
// A lead with no website + you build websites = high fit, HIGH opportunity
//   → both high → composite is high
//
// fitAlignment is scaled by opportunityGap so a perfect fit on a solved problem
// never inflates the overall score.

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

  // readiness: operational viability — shown in detail panel
  const readiness = clamp(round(
    s.businessStrength * 0.6 + s.digitalPresence * 0.2 + s.evidenceConfidence * 0.2
  ));

  // risk: stability risk — shown in detail panel
  const risk = clamp(round(
    s.stabilityRisk * 0.75 +
    (100 - s.evidenceConfidence) * 0.15 +
    (input.riskProfile === "mature_competitor" ? 10 : 0)
  ));

  // opportunity = the raw need/gap signal (0-100)
  // This is what the lead LACKS — not how good a fit you are for it.
  const opportunity = clamp(s.opportunityGap);

  // abilityToPay: review count + rating proxies revenue and budget
  const abilityToPay = getAbilityToPayScore({
    rating: input.rating ?? 0,
    reviews: input.reviews ?? 0,
    hasWebsite: input.hasWebsite ?? false,
  });

  // approachability: how easy is this type of business to pitch?
  const approachability = getApproachabilityScore(input.riskProfile);

  // fitAlignment: depth-weighted fit score from scoreFit (0-100)
  // Default 50 (neutral) if not yet computed.
  const rawFitAlignment = clamp(input.fitScore ?? (input.isGoodFit ? 65 : 40));

  // ── Opportunity gate on fit ───────────────────────────────────────────────
  // A perfect fit means nothing if the lead doesn't have a gap.
  // Example: lead has great SEO, you're an SEO expert → fit=95, opportunity=8
  // Without this gate, fit would prop up the score even though there's nothing to sell.
  //
  // Scale: opportunityGap=0 → fitAlignment contributes 30% of its value
  //        opportunityGap=100 → fitAlignment contributes 100% of its value
  // This preserves fit differentiation at high opportunity, kills it when there's no gap.
  const opportunityScale = clamp(s.opportunityGap / 100) * 0.70 + 0.30;
  const fitAlignment = clamp(round(rawFitAlignment * opportunityScale));

  // ── Composite ─────────────────────────────────────────────────────────────
  // Opportunity carries the most weight — if there's nothing to sell, no amount
  // of fit, ability to pay, or approachability rescues the lead.
  let value = clamp(round(
    opportunity     * 0.40 +
    fitAlignment    * 0.28 +
    abilityToPay    * 0.18 +
    approachability * 0.14
  ));

  // Hard caps for genuinely unwinnable situations
  if (input.riskProfile === "unstable_business") {
    value = Math.min(value, 22);
  }
  if (input.riskProfile === "mature_competitor" && opportunity <= 15) {
    value = Math.min(value, 32);
  }

  return { value, opportunity, readiness, risk };
}