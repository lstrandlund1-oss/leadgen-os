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

export function computeUniversalScore(input: UniversalScoreInput): UniversalScoreOutput {
  const { reviews, rating, hasWebsite, socialPresence, riskProfile, fitScore, gapType, classificationConfidence } =
    input;

  // ── OPPORTUNITY (0-100) ──────────────────────────────────────────────────
  // How big and specific is the gap you could sell into?

  // Gap strength — what problem can be solved?
  let gapPoints = 0;
  switch (gapType) {
    case "INFRASTRUCTURE":
      gapPoints = 40;
      break; // No website — clearest gap
    case "CONVERSION":
      gapPoints = 32;
      break; // Has site, no booking system
    case "VISIBILITY":
      gapPoints = 22;
      break; // Weak social/SEO
    case "OPTIMIZATION":
      gapPoints = 16;
      break; // Has everything — still a real gap
  }

  // Proof/trust — reviews + rating = real demand and budget
  // Wider spread: 15 reviews vs 200 reviews should meaningfully differ
  let proofPoints = 0;
  if (reviews >= 500) proofPoints = 28;
  else if (reviews >= 200) proofPoints = 24;
  else if (reviews >= 100) proofPoints = 20;
  else if (reviews >= 50) proofPoints = 15;
  else if (reviews >= 20) proofPoints = 10;
  else if (reviews >= 8) proofPoints = 6;
  else proofPoints = 2;

  if (rating >= 4.7) proofPoints = Math.min(30, proofPoints + 6);
  else if (rating >= 4.5) proofPoints = Math.min(30, proofPoints + 4);
  else if (rating >= 4.2) proofPoints = Math.min(30, proofPoints + 2);
  else if (rating > 0 && rating < 3.8) proofPoints = Math.max(0, proofPoints - 4);
  else if (rating > 0 && rating < 3.5) proofPoints = Math.max(0, proofPoints - 8);

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
  if (input.hasBookingCta === false && input.websiteReachable) enrichmentBonus += 6;
  if (input.hasClearOffer === false && input.websiteReachable) enrichmentBonus += 3;
  if (input.socialPlatformCount === 0 && gapType === "VISIBILITY") enrichmentBonus += 4;

  const opportunityRaw = gapPoints + proofPoints + approachPoints + enrichmentBonus;

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
  if (riskProfile === "well_established" && gapType === "OPTIMIZATION") opportunity = Math.min(opportunity, 28);

  // Plain-English opportunity explanation — what the gap is and why it matters
  const gapExplanation: Record<string, string> = {
    INFRASTRUCTURE:
      "This business has no website despite proven demand. That's a clear, urgent gap — they're losing customers they can't capture.",
    CONVERSION:
      "This business has a website but is missing a booking or conversion system. Customers can find them but can't easily take action.",
    VISIBILITY:
      "This business has solid fundamentals but low online visibility. They're not being found by people already looking for them.",
    OPTIMIZATION:
      "This business already has strong digital infrastructure. The opportunity is in improving and optimising what's already there.",
  };
  const profileContext: Partial<Record<string, string>> = {
    well_established:
      "Well-established businesses are harder to pitch new infrastructure to — they likely already have vendors.",
    local_authority: "Local authority businesses are trusted in their market but have limited gaps left to fill.",
    early_stage: "Early stage businesses may have gaps but their budget and stability are uncertain.",
    limited_data: "Limited data available on this business — treat this opportunity estimate with caution.",
  };
  const proofContext =
    reviews >= 100
      ? `Strong proof signals with ${reviews} reviews and ${rating > 0 ? rating.toFixed(1) + "★" : "no rating"}.`
      : reviews >= 20
        ? `Moderate proof with ${reviews} reviews and ${rating > 0 ? rating.toFixed(1) + "★" : "no rating"}.`
        : `Limited proof — only ${reviews} review${reviews !== 1 ? "s" : ""} available.`;

  const opportunityTooltip = [gapExplanation[gapType] ?? "", profileContext[riskProfile] ?? "", proofContext]
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
      riskBase = 55;
      break;
    case "well_established":
      riskBase = 50;
      break;
    case "local_authority":
      riskBase = 42;
      break;
    case "growing_business":
      riskBase = 28;
      break;
    case "solo_run":
      riskBase = 20;
      break;
    case "independent_business":
      riskBase = 30;
      break;
    case "unknown":
      riskBase = 45;
      break;
    default:
      riskBase = 38;
      break;
  }

  // Review volume modifies risk within profile — more volume = more proven = lower risk
  if (reviews >= 200) riskBase -= 8;
  else if (reviews >= 100) riskBase -= 5;
  else if (reviews >= 50) riskBase -= 2;
  else if (reviews < 8) riskBase += 12;
  else if (reviews < 20) riskBase += 6;

  // Rating quality
  if (reviews >= 20) {
    if (rating <= 3.2) riskBase += 25;
    else if (rating <= 3.5) riskBase += 15;
    else if (rating <= 3.8) riskBase += 8;
    else if (rating >= 4.7) riskBase -= 5;
  }

  if (!hasWebsite && socialPresence === "low") riskBase += 8;

  // Evidence confidence modifier
  if (classificationConfidence !== null && classificationConfidence < 40) riskBase += 10;

  const risk = clamp(round(riskBase));

  const riskProfileExplanation: Partial<Record<string, string>> = {
    solo_run:
      "Owner-operated — the decision maker is likely the person running the business. Easy to reach, fast to close.",
    growing_business:
      "Growing business with real customers and some budget. Good approach difficulty — right angle and it's very winnable.",
    independent_business:
      "Independent business with moderate signals. Reachable but may already have some service providers.",
    local_authority:
      "Well-known locally — already being pitched by others. Difficulty is higher without a sharp, specific angle.",
    well_established:
      "Established business likely already working with vendors. Difficulty is high — you need a clear differentiator to displace what they have.",
    early_stage:
      "Early stage — budget and stability are uncertain. Higher difficulty and higher risk of wasted effort.",
    limited_data: "Very limited data. Difficulty is hard to assess — approach with lower expectations.",
  };
  const riskFactors: string[] = [];
  if (reviews < 8) riskFactors.push("Very few reviews — uncertain budget capacity.");
  if (rating > 0 && rating < 3.5)
    riskFactors.push(`Low rating (${rating.toFixed(1)}★) may indicate operational problems.`);
  if (!hasWebsite && socialPresence === "low") riskFactors.push("No digital presence makes outreach harder.");
  if (reviews >= 100 && rating >= 4.5)
    riskFactors.push("Strong proof signals suggest a stable, professional operation.");

  const riskTooltip = [
    riskProfileExplanation[riskProfile] ?? `${riskProfile.replace(/_/g, " ")} profile.`,
    ...riskFactors,
  ]
    .filter(Boolean)
    .join(" ");

  // ── READINESS (0-100) ─────────────────────────────────────────────────────
  // Is this business operationally ready to buy and benefit right now?

  let readinessBase = 0;

  // Maturity — review volume as proxy (wider range for better differentiation)
  if (reviews >= 500) readinessBase += 45;
  else if (reviews >= 200) readinessBase += 38;
  else if (reviews >= 100) readinessBase += 30;
  else if (reviews >= 50) readinessBase += 22;
  else if (reviews >= 20) readinessBase += 14;
  else if (reviews >= 8) readinessBase += 8;
  else readinessBase += 2;

  // Stability — rating consistency (wider range)
  if (rating >= 4.7) readinessBase += 28;
  else if (rating >= 4.5) readinessBase += 23;
  else if (rating >= 4.2) readinessBase += 17;
  else if (rating >= 4.0) readinessBase += 11;
  else if (rating >= 3.5) readinessBase += 5;
  else if (rating > 0) readinessBase += 2;

  // Operational presence
  if (hasWebsite) readinessBase += 15;
  if (socialPresence === "high") readinessBase += 14;
  else if (socialPresence === "medium") readinessBase += 7;
  else readinessBase += 1;

  // Enrichment signals
  if (input.ownerResponds === true) readinessBase += 8;

  const readiness = clamp(round(readinessBase));

  const maturityDesc =
    reviews >= 200
      ? `${reviews} reviews signals a well-established business with consistent revenue and likely budget for new services.`
      : reviews >= 50
        ? `${reviews} reviews shows a growing business with real customers and some budget capacity.`
        : reviews >= 20
          ? `${reviews} reviews — operational but still relatively early. Budget capacity is moderate.`
          : `Only ${reviews} review${reviews !== 1 ? "s" : ""} — limited proof of revenue stability.`;

  const ratingDesc =
    rating >= 4.5
      ? `High rating (${rating.toFixed(1)}★) confirms consistent quality and stable operations.`
      : rating >= 4.0
        ? `Good rating (${rating.toFixed(1)}★) suggests a reliable business.`
        : rating > 0
          ? `Rating of ${rating.toFixed(1)}★ — some risk of instability.`
          : "";

  const readinessTooltip = [maturityDesc, ratingDesc].filter(Boolean).join(" ");

  // ── COMPOSITE LEAD SCORE (0-100) ──────────────────────────────────────────
  // Opportunity×0.35 + Fit×0.30 + Readiness×0.20 + (100-Risk)×0.15

  const fitClamped = clamp(fitScore);
  let value = clamp(round(opportunity * 0.35 + fitClamped * 0.3 + readiness * 0.2 + (100 - risk) * 0.15));

  // Hard caps
  if (riskProfile === "early_stage") value = Math.min(value, 30);
  if (riskProfile === "well_established" && opportunity < 20) value = Math.min(value, 35);
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

  // One flowing sentence verdict — all four factors woven in naturally, no labels or numbers visible
  const oppPhrase =
    opportunity >= 60
      ? "there's a clear and specific gap you can pitch into"
      : opportunity >= 40
        ? "there's a real gap but it'll need a focused angle"
        : opportunity >= 25
          ? "the gap is modest — they're reasonably well-served already"
          : "there's limited room to sell into — they may already have what they need";

  const fitPhrase =
    fitClamped >= 65
      ? "your capabilities are a strong match for what they need"
      : fitClamped >= 45
        ? "you cover most of what they need but not everything"
        : fitClamped >= 25
          ? "your service covers some of their needs but there are notable gaps"
          : "your profile doesn't align well with what this business actually needs";

  const readinessPhrase =
    readiness >= 70
      ? "the business looks stable and likely has budget to act on this"
      : readiness >= 50
        ? "they're reasonably established but may need convincing to prioritise this now"
        : readiness >= 30
          ? "budget and urgency are uncertain — they're still in a growth phase"
          : "they're not in a position to invest yet";

  const riskPhrase =
    risk <= 25
      ? "closing difficulty is low — they're reachable and likely open"
      : risk <= 45
        ? "closing difficulty is moderate — winnable with the right approach"
        : risk <= 65
          ? "closing difficulty is high — expect resistance or existing competition"
          : "closing difficulty is very high — unlikely to convert without a very specific edge";

  const sentenceStart =
    value >= 70
      ? "This is a strong lead worth prioritising"
      : value >= 50
        ? "This lead is worth pursuing"
        : value >= 35
          ? "This lead has potential but isn't a priority"
          : "This lead is a low priority right now";

  const evidenceSuffix =
    evidenceLevel === "insufficient"
      ? " Note: limited data available — treat as an early estimate."
      : evidenceLevel === "low"
        ? " Score will sharpen after enrichment runs."
        : "";

  const valueTooltip = `${sentenceStart} — ${oppPhrase}, ${fitPhrase}, ${readinessPhrase}, and ${riskPhrase}.${evidenceSuffix}`;

  // ── BREAKDOWN (for signals tab bars) ─────────────────────────────────────
  const reputation = clamp(
    round(
      (reviews >= 100 ? 45 : reviews >= 50 ? 35 : reviews >= 20 ? 25 : reviews >= 10 ? 15 : 5) +
        (rating >= 4.8 ? 45 : rating >= 4.5 ? 38 : rating >= 4.2 ? 30 : rating >= 4.0 ? 22 : rating >= 3.5 ? 12 : 5),
    ),
  );

  const digitalPresence = clamp(
    round((hasWebsite ? 55 : 0) + (socialPresence === "high" ? 45 : socialPresence === "medium" ? 25 : 5)),
  );

  // Evidence confidence — how much real signal data backs this score.
  // Does NOT include classificationConfidence — that reflects category certainty,
  // not how much we actually know about the business itself.
  // A business with 1 review, no website, no social = genuinely low evidence.
  const evidenceConfidence = clamp(
    round(
      (reviews >= 200 ? 50 : reviews >= 100 ? 42 : reviews >= 50 ? 32 : reviews >= 20 ? 22 : reviews >= 8 ? 12 : 4) +
        (rating > 0 && reviews >= 3 ? 12 : 0) + // rating only meaningful with real review volume
        (hasWebsite ? 18 : 0) +
        (socialPresence === "high" ? 16 : socialPresence === "medium" ? 8 : 0),
    ),
  );

  const businessStrength = clamp(round(reputation * 0.5 + digitalPresence * 0.25 + evidenceConfidence * 0.25));

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
