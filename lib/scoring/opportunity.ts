// lib/scoring/opportunity.ts
//
// Opportunity score = "how likely is this lead to become a client?"
// Range: 0-100. Designed to SPREAD across the full range, not cluster at 80-100.
//
// Formula (additive, no sigmoid):
//   gap strength    0-40  (what problem can you solve?)
//   fit             0-30  (does your service match?)
//   proof/trust     0-20  (reviews + rating = can they pay + are they real?)
//   approachability 0-10  (is the timing right?)
//   risk penalty    0-40  (deducted — high risk kills opportunity)

import type { RiskProfile } from "@/lib/types";

export type OpportunityInput = {
  gap: "VISIBILITY" | "CONVERSION" | "INFRASTRUCTURE" | "OPTIMIZATION";
  fitScore: number;           // 0-100
  rating: number | null;
  reviewCount: number | null;
  hasWebsite: boolean;
  socialPresence: "low" | "medium" | "high" | null;
  risk: number;               // 0-100
  riskProfile: RiskProfile;
  classificationConfidence: number | null; // 0-100
};

export type OpportunityResult = {
  opportunity: number;   // 0-100
  confidence: number;    // 0-1
  reasons: string[];
};

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

export function scoreOpportunity(input: OpportunityInput): OpportunityResult {
  const reasons: string[] = [];

  // ── 1. Gap strength (0-40) ────────────────────────────────────────────────
  // How specific and monetisable is the problem you can solve?
  // INFRASTRUCTURE = no website = clearest gap, easiest conversation starter
  // CONVERSION     = has site but no CTA/tracking = strong gap
  // VISIBILITY     = weak social/SEO = medium gap
  // OPTIMIZATION   = already has everything = weakest gap, hardest sell
  let gapScore = 0;
  switch (input.gap) {
    case "INFRASTRUCTURE": gapScore = 38; break;
    case "CONVERSION":     gapScore = 30; break;
    case "VISIBILITY":     gapScore = 20; break;
    case "OPTIMIZATION":   gapScore = 8;  break;
  }
  reasons.push(`Gap: ${input.gap} (+${gapScore})`);

  // ── 2. Fit (0-30) ─────────────────────────────────────────────────────────
  // Does your service type match what this business needs?
  const fitScore = clamp(input.fitScore);
  const fitPoints = Math.round((fitScore / 100) * 30);
  reasons.push(`Fit: ${fitScore}/100 (+${fitPoints})`);

  // ── 3. Proof / trust (0-20) ───────────────────────────────────────────────
  // Reviews = they have real customers and revenue. Rating = they're stable.
  // High reviews = can afford services. Low reviews = uncertain budget.
  const reviews = input.reviewCount ?? 0;
  const rating  = input.rating ?? 0;

  let proofScore = 0;
  if (reviews >= 200) proofScore = 14;
  else if (reviews >= 50)  proofScore = 10;
  else if (reviews >= 20)  proofScore = 7;
  else if (reviews >= 8)   proofScore = 4;
  else                     proofScore = 1;

  // Rating bonus/penalty on top of proof
  if (rating >= 4.5) proofScore = Math.min(20, proofScore + 4);
  else if (rating >= 4.0) proofScore = Math.min(20, proofScore + 2);
  else if (rating > 0 && rating < 3.5) proofScore = Math.max(0, proofScore - 3);

  reasons.push(`Proof: ${reviews} reviews, ${rating.toFixed(1)}★ (+${proofScore})`);

  // ── 4. Approachability (0-10) ─────────────────────────────────────────────
  // Is the timing and profile right to pitch?
  let approachScore = 0;
  switch (input.riskProfile) {
    case "solo_run":             approachScore = 9;  break;
    case "growing_business":     approachScore = 8;  break;
    case "independent_business": approachScore = 7;  break;
    case "local_authority":      approachScore = 6;  break;
    case "well_established":     approachScore = 4;  break;
    case "early_stage":          approachScore = 3;  break;
    case "limited_data":         approachScore = 2;  break;
    case "unknown":              approachScore = 5;  break;
    default:                     approachScore = 5;  break;
  }
  reasons.push(`Approachability: ${input.riskProfile} (+${approachScore})`);

  // ── 5. Raw total before penalty ───────────────────────────────────────────
  const rawTotal = gapScore + fitPoints + proofScore + approachScore; // max=100

  // ── 6. Risk penalty (0-40 deducted) ───────────────────────────────────────
  // risk 0-100 maps to penalty 0-40
  // A lead with risk=50 loses 20 points. risk=80 loses 32 points.
  const riskPenalty = Math.round((clamp(input.risk) / 100) * 40);
  reasons.push(`Risk penalty: -${riskPenalty}`);

  // ── 7. Hard caps for hopeless situations ─────────────────────────────────
  let opportunity = clamp(rawTotal - riskPenalty);

  if (input.riskProfile === "early_stage" || input.riskProfile === "limited_data") {
    opportunity = Math.min(opportunity, 25);
  }
  if ((input.riskProfile === "well_established" || input.riskProfile === "local_authority") && input.gap === "OPTIMIZATION") {
    opportunity = Math.min(opportunity, 30);
  }

  // ── Confidence ───────────────────────────────────────────────────────────
  // How much data do we actually have?
  let dataPoints = 0;
  if (input.rating !== null)   dataPoints++;
  if (input.reviewCount !== null) dataPoints++;
  if (input.socialPresence !== null) dataPoints++;
  if (input.classificationConfidence !== null) dataPoints++;
  const confidence = clamp((dataPoints + 3) / 7); // always at least 3/7

  return { opportunity, confidence, reasons };
}