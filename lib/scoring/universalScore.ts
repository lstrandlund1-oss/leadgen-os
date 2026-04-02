// lib/scoring/universalScore.ts
//
// Single-pass composite score engine. Called once per lead per data state.
// No overwrites, no second passes — one function, one clean output.
//
// Lead Score = Opportunity×0.35 + Fit×0.30 + Readiness×0.20 + (100-Risk)×0.15
//
// All five scores + tooltips returned in one object.
// Called three times as data improves:
//   1. Search time (review count, rating, website)
//   2. After light enrichment (adds website signals, social)
//   3. After deep scan (adds page speed, competitor density, brand)

import type { RiskProfile, ScoreResult } from "@/lib/types";

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n));
}
function round(n: number): number {
  return Math.round(n);
}

export type UniversalScoreInput = {
  // Core signals — always available
  reviews: number;
  rating: number; // 0 if none
  hasWebsite: boolean;
  socialPresence: "low" | "medium" | "high";
  riskProfile: RiskProfile;
  fitScore: number; // 0-100 from fitScore.ts
  fitTooltip?: string;

  // Gap type from outreach logic
  gapType: "INFRASTRUCTURE" | "CONVERSION" | "VISIBILITY" | "OPTIMIZATION";

  // Classification confidence 0-100
  classificationConfidence: number | null;

  // Light enrichment signals (optional — undefined if not yet run)
  hasBookingCta?: boolean | null;
  hasClearOffer?: boolean | null;
  isMobileFriendly?: boolean | null;
  websiteReachable?: boolean;
  socialPlatformCount?: number;
  ownerResponds?: boolean;

  // Deep scan signals (optional — undefined if not yet run)
  competitorDensity?: number; // 0-100, from deep scan market signals
  pageSpeedScore?: number; // 0-100
  seoScore?: number; // 0-100
  brandConsistency?: number; // 0-100
};

export type UniversalScoreOutput = ScoreResult;

export function computeUniversalScore(
  input: UniversalScoreInput,
): UniversalScoreOutput {
  const {
    reviews,
    rating,
    hasWebsite,
    socialPresence,
    riskProfile,
    fitScore,
    gapType,
    classificationConfidence,
  } = input;

  // ── OPPORTUNITY (0-100) ──────────────────────────────────────────────────
  // How big and specific is the gap you could sell into?

  // Gap strength — what problem can be solved?
  let gapPoints = 0;
  switch (gapType) {
    case "INFRASTRUCTURE":
      gapPoints = 38;
      break; // No website — clearest gap
    case "CONVERSION":
      gapPoints = 30;
      break; // Has site, no booking system
    case "VISIBILITY":
      gapPoints = 20;
      break; // Weak social/SEO
    case "OPTIMIZATION":
      gapPoints = 8;
      break; // Has everything — hardest sell
  }

  // Proof/trust — reviews + rating = real demand and budget
  let proofPoints = 0;
  if (reviews >= 200) proofPoints = 18;
  else if (reviews >= 100) proofPoints = 14;
  else if (reviews >= 50) proofPoints = 10;
  else if (reviews >= 20) proofPoints = 7;
  else if (reviews >= 8) proofPoints = 4;
  else proofPoints = 1;

  if (rating >= 4.5) proofPoints = Math.min(20, proofPoints + 4);
  else if (rating >= 4.0) proofPoints = Math.min(20, proofPoints + 2);
  else if (rating > 0 && rating < 3.5)
    proofPoints = Math.max(0, proofPoints - 3);

  // Approachability from profile
  let approachPoints = 0;
  switch (riskProfile) {
    case "solo_run":
      approachPoints = 9;
      break;
    case "growing_business":
      approachPoints = 8;
      break;
    case "independent_business":
      approachPoints = 7;
      break;
    case "local_authority":
      approachPoints = 6;
      break;
    case "well_established":
      approachPoints = 4;
      break;
    case "limited_data":
      approachPoints = 5;
      break;
    case "early_stage":
      approachPoints = 3;
      break;
    case "unknown":
      approachPoints = 5;
      break;
    default:
      approachPoints = 5;
      break;
  }

  // Enrichment bonus — if we have real signal data confirming the gap
  let enrichmentBonus = 0;
  if (input.hasBookingCta === false && input.websiteReachable)
    enrichmentBonus += 6;
  if (input.hasClearOffer === false && input.websiteReachable)
    enrichmentBonus += 3;
  if (input.socialPlatformCount === 0 && gapType === "VISIBILITY")
    enrichmentBonus += 4;

  const opportunityRaw =
    gapPoints + proofPoints + approachPoints + enrichmentBonus;

  // Risk penalty — high risk kills opportunity
  let riskPenalty = 0;
  if (riskProfile === "well_established") riskPenalty = 12;
  else if (riskProfile === "local_authority") riskPenalty = 8;
  else if (riskProfile === "early_stage") riskPenalty = 15;
  else if (riskProfile === "limited_data") riskPenalty = 20;

  // Competitor density penalty (deep scan)
  if (input.competitorDensity !== undefined && input.competitorDensity > 70) {
    riskPenalty += Math.round((input.competitorDensity - 70) / 10) * 3;
  }

  let opportunity = clamp(opportunityRaw - riskPenalty);

  // Hard caps
  if (riskProfile === "early_stage") opportunity = Math.min(opportunity, 30);
  if (riskProfile === "well_established" && gapType === "OPTIMIZATION")
    opportunity = Math.min(opportunity, 28);

  const opportunityTooltip = [
    `Opportunity ${opportunity} —`,
    `${gapType} gap (${gapPoints} pts).`,
    `${reviews} reviews, ${rating > 0 ? rating.toFixed(1) + "★" : "no rating"} (${proofPoints} pts).`,
    riskPenalty > 0 ? `Risk penalty: -${riskPenalty}.` : "",
    enrichmentBonus > 0 ? `Signal confirmation: +${enrichmentBonus}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  // ── RISK (0-100) ──────────────────────────────────────────────────────────
  // How hard will this be to close?

  let riskBase = 0;

  // Profile-based base risk
  switch (riskProfile) {
    case "limited_data":
      riskBase = 65;
      break;
    case "early_stage":
      riskBase = 58;
      break;
    case "well_established":
      riskBase = 52;
      break;
    case "local_authority":
      riskBase = 45;
      break;
    case "growing_business":
      riskBase = 30;
      break;
    case "solo_run":
      riskBase = 22;
      break;
    case "independent_business":
      riskBase = 32;
      break;
    case "unknown":
      riskBase = 48;
      break;
    default:
      riskBase = 40;
      break;
  }

  // Stability signals
  if (reviews < 3) riskBase += 20;
  else if (reviews < 8) riskBase += 12;
  else if (reviews < 20) riskBase += 5;

  if (reviews >= 20) {
    if (rating <= 3.2) riskBase += 25;
    else if (rating <= 3.5) riskBase += 15;
    else if (rating <= 3.8) riskBase += 8;
  }

  if (!hasWebsite && socialPresence === "low") riskBase += 8;

  // Evidence confidence modifier
  if (classificationConfidence !== null && classificationConfidence < 40)
    riskBase += 10;

  const risk = clamp(round(riskBase));

  const riskTooltip = [
    `Risk ${risk} —`,
    `Profile: ${riskProfile.replace(/_/g, " ")} (base ${riskBase > 20 ? "elevated" : "low"}).`,
    reviews < 8 ? "Very low review count increases uncertainty." : "",
    rating > 0 && rating < 3.5
      ? `Below-average rating (${rating.toFixed(1)}★) signals instability.`
      : "",
    !hasWebsite && socialPresence === "low"
      ? "No website or social presence increases outreach friction."
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  // ── READINESS (0-100) ─────────────────────────────────────────────────────
  // Is this business operationally ready to buy and benefit right now?

  let readinessBase = 0;

  // Maturity — review volume as proxy
  if (reviews >= 200) readinessBase += 40;
  else if (reviews >= 100) readinessBase += 32;
  else if (reviews >= 50) readinessBase += 25;
  else if (reviews >= 20) readinessBase += 17;
  else if (reviews >= 8) readinessBase += 10;
  else readinessBase += 3;

  // Stability — rating consistency
  if (rating >= 4.5) readinessBase += 25;
  else if (rating >= 4.2) readinessBase += 20;
  else if (rating >= 4.0) readinessBase += 15;
  else if (rating >= 3.5) readinessBase += 8;
  else if (rating > 0) readinessBase += 3;

  // Operational presence
  if (hasWebsite) readinessBase += 15;
  if (socialPresence === "high") readinessBase += 15;
  else if (socialPresence === "medium") readinessBase += 8;
  else readinessBase += 2;

  // Enrichment signals
  if (input.ownerResponds === true) readinessBase += 8;

  const readiness = clamp(round(readinessBase));

  const readinessTooltip = [
    `Readiness ${readiness} —`,
    `${reviews} reviews suggests ${reviews >= 50 ? "established revenue base" : reviews >= 20 ? "growing customer base" : "limited revenue history"}.`,
    rating >= 4.2
      ? `Strong rating (${rating.toFixed(1)}★) indicates stable operation.`
      : rating > 0
        ? `Rating ${rating.toFixed(1)}★.`
        : "No rating available.",
    !hasWebsite ? "No website detected." : "",
  ]
    .filter(Boolean)
    .join(" ");

  // ── COMPOSITE LEAD SCORE (0-100) ──────────────────────────────────────────
  // Opportunity×0.35 + Fit×0.30 + Readiness×0.20 + (100-Risk)×0.15

  const fitClamped = clamp(fitScore);
  let value = clamp(
    round(
      opportunity * 0.35 +
        fitClamped * 0.3 +
        readiness * 0.2 +
        (100 - risk) * 0.15,
    ),
  );

  // Hard caps
  if (riskProfile === "early_stage") value = Math.min(value, 30);
  if (riskProfile === "well_established" && opportunity < 20)
    value = Math.min(value, 35);
  if (fitClamped < 20) value = Math.min(value, 40);
  if (readiness < 20) value = Math.min(value, 35);
  if (riskProfile === "limited_data") value = Math.min(value, 28);

  // Evidence level — how much data backs this score
  let evidenceLevel: "high" | "medium" | "low" | "insufficient";
  const dataPoints = [
    rating > 0,
    reviews > 0,
    hasWebsite,
    classificationConfidence !== null,
    input.hasBookingCta !== undefined,
  ].filter(Boolean).length;

  if (dataPoints >= 4) evidenceLevel = "high";
  else if (dataPoints >= 3) evidenceLevel = "medium";
  else if (dataPoints >= 2) evidenceLevel = "low";
  else evidenceLevel = "insufficient";

  const valueTooltip = [
    `Lead Score ${value} —`,
    `Opportunity (${opportunity}) drives 35% of the score.`,
    `Fit (${fitClamped}) drives 30% — how well your capabilities match this lead's needs.`,
    `Readiness (${readiness}) drives 20% — how prepared they are to buy.`,
    `Risk (${risk}) drives 15% — lower risk improves the score.`,
    evidenceLevel === "insufficient"
      ? "⚠ Low confidence — limited signal data available."
      : evidenceLevel === "low"
        ? "Some signal data is thin — treat with caution."
        : "",
  ]
    .filter(Boolean)
    .join(" ");

  // ── BREAKDOWN (for signals tab bars) ─────────────────────────────────────
  const reputation = clamp(
    round(
      (reviews >= 100
        ? 45
        : reviews >= 50
          ? 35
          : reviews >= 20
            ? 25
            : reviews >= 10
              ? 15
              : 5) +
        (rating >= 4.8
          ? 45
          : rating >= 4.5
            ? 38
            : rating >= 4.2
              ? 30
              : rating >= 4.0
                ? 22
                : rating >= 3.5
                  ? 12
                  : 5),
    ),
  );

  const digitalPresence = clamp(
    round(
      (hasWebsite ? 55 : 0) +
        (socialPresence === "high" ? 45 : socialPresence === "medium" ? 25 : 5),
    ),
  );

  const evidenceConfidence = clamp(
    round(
      (reviews >= 100
        ? 45
        : reviews >= 50
          ? 35
          : reviews >= 20
            ? 25
            : reviews >= 10
              ? 15
              : 8) +
        (rating > 0 ? 15 : 0) +
        (hasWebsite ? 10 : 0) +
        (classificationConfidence !== null
          ? Math.round(classificationConfidence * 0.3)
          : 0),
    ),
  );

  const businessStrength = clamp(
    round(
      reputation * 0.5 + digitalPresence * 0.25 + evidenceConfidence * 0.25,
    ),
  );

  const stabilityRisk = risk;

  // opportunityGap = the gap signal (what needs solving)
  const opportunityGap = clamp(gapPoints + enrichmentBonus);

  return {
    value,
    opportunity,
    readiness,
    risk,
    riskProfile,
    priority: value,
    breakdown: {
      reputation,
      digitalPresence,
      businessStrength,
      opportunityGap,
      stabilityRisk,
      evidenceConfidence,
    },
    reasons: [
      `Gap: ${gapType}`,
      `Profile: ${riskProfile.replace(/_/g, " ")}`,
      `${reviews} reviews, ${rating > 0 ? rating.toFixed(1) + "★" : "no rating"}`,
      evidenceLevel !== "high" ? `Evidence: ${evidenceLevel}` : "",
    ].filter(Boolean),
    tooltips: {
      value: valueTooltip,
      opportunity: opportunityTooltip,
      fit:
        input.fitTooltip ??
        `Fit ${fitClamped} — based on how well your capabilities match this lead's detected needs. Open the lead detail to see matched and missing capabilities.`,
      risk: riskTooltip,
      readiness: readinessTooltip,
    },
    evidenceLevel,
  };
}
