import type { RawCompany, Classification, RiskFlag, RiskProfile, ScoreResult } from "@/lib/types";

type SocialPresence = "low" | "medium" | "high";

// If provider delivers socialPresence on raw records, we accept it.
type RawCompanyExtras = {
  socialPresence?: SocialPresence;
};

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n));
}

function round(n: number): number {
  return Math.round(n);
}

function safeNum(n: unknown): number | null {
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

function hasNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function normalizeSocialPresence(raw: RawCompany & RawCompanyExtras): SocialPresence {
  if (raw.socialPresence === "low" || raw.socialPresence === "medium" || raw.socialPresence === "high") {
    return raw.socialPresence;
  }

  // Fallback inference when provider does not supply social presence explicitly.
  const reviews = safeNum(raw.review_count) ?? 0;
  const rating = safeNum(raw.rating) ?? 0;
  const hasWebsite = hasNonEmptyString(raw.website);

  let points = 0;

  // Website is a modest signal
  if (hasWebsite) points += 1;

  // Reviews are “proof of existence / proof of demand”
  if (reviews >= 200) points += 3;
  else if (reviews >= 50) points += 2;
  else if (reviews >= 10) points += 1;

  // Rating quality (weakly)
  if (rating >= 4.6) points += 2;
  else if (rating >= 4.2) points += 1;

  if (points >= 5) return "high";
  if (points >= 3) return "medium";
  return "low";
}

/**
 * Readiness = operational viability + ability to execute & pay.
 * This should be conservative (hard to get very high).
 */
function readinessFromSignals(input: {
  hasWebsite: boolean;
  rating: number;
  reviews: number;
  socialPresence: SocialPresence;
}): number {
  let r = 0;

  // Infrastructure
  if (input.hasWebsite) r += 10;

  // Reputation quality (conservative)
  if (input.rating >= 4.7) r += 14;
  else if (input.rating >= 4.4) r += 10;
  else if (input.rating >= 4.0) r += 6;
  else if (input.rating >= 3.6) r += 3;

  // Proof (reviews)
  if (input.reviews >= 250) r += 20;
  else if (input.reviews >= 100) r += 14;
  else if (input.reviews >= 25) r += 8;
  else if (input.reviews >= 10) r += 5;
  else if (input.reviews >= 3) r += 2;

  // Social presence (small weight)
  if (input.socialPresence === "high") r += 8;
  else if (input.socialPresence === "medium") r += 4;
  else r += 1;

  return clamp(round(r));
}

/**
 * Opportunity = upside from gaps.
 * This should also be conservative; high opportunity requires both:
 * - proof that the business is real
 * - clear “gap” signals that you can fix.
 */
function opportunityFromSignals(input: {
  hasWebsite: boolean;
  rating: number;
  reviews: number;
  socialPresence: SocialPresence;
}): number {
  let o = 0;

  // Digital gap / visibility gap
  if (input.socialPresence === "low") o += 18;
  else if (input.socialPresence === "medium") o += 10;
  else o += 3;

  if (!input.hasWebsite) o += 20;
  else o += 4;

  // Proof component (only helps opportunity if gaps exist)
  // This prevents “random tiny businesses” from getting high opportunity.
  const proof =
    (input.reviews >= 200 ? 18 : input.reviews >= 100 ? 12 : input.reviews >= 30 ? 7 : input.reviews >= 10 ? 3 : 0) +
    (input.rating >= 4.6 ? 8 : input.rating >= 4.3 ? 5 : input.rating >= 4.0 ? 3 : 0);

  const hasClearGap = !input.hasWebsite || input.socialPresence !== "high";
  o += hasClearGap ? proof : Math.round(proof * 0.25);

  return clamp(round(o));
}

/**
 * Distress / operational instability.
 * You explicitly want this to mean “distressed / failing,” not “low visibility.”
 * Therefore it MUST require strong negative reputation evidence.
 */
function isDistressedBusiness(input: {
  rating: number | null;
  reviews: number | null;
}): boolean {
  const rating = typeof input.rating === "number" && Number.isFinite(input.rating) ? input.rating : null;
  const reviews = typeof input.reviews === "number" && Number.isFinite(input.reviews) ? input.reviews : null;

  if (rating == null || reviews == null) return false;

  // Strong negative evidence only:
  // - lots of reviews AND very low rating
  if (reviews >= 50 && rating <= 3.2) return true;

  // Alternative “extreme” threshold
  if (reviews >= 20 && rating <= 3.0) return true;

  return false;
}

function isMatureHardTarget(input: {
  hasWebsite: boolean;
  socialPresence: SocialPresence;
  rating: number;
  reviews: number;
}): boolean {
  return input.hasWebsite && input.socialPresence === "high" && input.reviews >= 150 && input.rating >= 4.3;
}

export function scoreLead(raw: RawCompany, c: Classification): ScoreResult {
  const extras = raw as RawCompany & RawCompanyExtras;

  const rating = safeNum(raw.rating) ?? 0;
  const reviews = safeNum(raw.review_count) ?? 0;
  const hasWebsite = hasNonEmptyString(raw.website);
  const socialPresence = normalizeSocialPresence(extras);

  const readiness = readinessFromSignals({ hasWebsite, rating, reviews, socialPresence });
  const opportunity = opportunityFromSignals({ hasWebsite, rating, reviews, socialPresence });

  // ==========================
  // GAP-BASED OPPORTUNITY DELTAS
  // ==========================

  let opportunityAdjusted = opportunity;
  let riskDelta = 0;

  const strongReputation = rating >= 4.3 && reviews >= 80;
  const veryStrongReputation = rating >= 4.4 && reviews >= 150;
  const lowProof = reviews < 15;

  // Strong proof but missing infrastructure = big conversion gap
  const conversionGap = strongReputation && !hasWebsite;

  // Very mature + well-instrumented competitor = harder displacement
  const matureCompetitor = veryStrongReputation && hasWebsite && socialPresence === "high";

  // Has website but weak proof = visibility/reputation gap
  const visibilityGap = hasWebsite && lowProof;

  // No website + low proof = early foundation (not “unstable”)
  const foundationGap = !hasWebsite && lowProof;

  if (conversionGap) {
    opportunityAdjusted += 16;
    riskDelta += 6;
  }

  if (matureCompetitor) {
    opportunityAdjusted -= 18;
    riskDelta += 16;
  }

  if (visibilityGap) {
    opportunityAdjusted += 8;
    riskDelta -= 3;
  }

  if (foundationGap) {
    opportunityAdjusted += 10;
    riskDelta += 8;
  }

  opportunityAdjusted = clamp(round(opportunityAdjusted));

  // ==========================
  // FLAGS + RISK
  // ==========================

  const riskFlags: RiskFlag[] = [];

  const distressed = isDistressedBusiness({ rating, reviews });
  const mature = isMatureHardTarget({ hasWebsite, socialPresence, rating, reviews });

  // Flags derived from known signals
  if (distressed) riskFlags.push("OPERATIONAL_INSTABILITY");
  if (mature) riskFlags.push("SATURATED_COMPETITION");

  if (!hasWebsite) riskFlags.push("NO_WEBSITE");
  if (socialPresence === "low") riskFlags.push("WEAK_SOCIAL");

  const classConf01 =
    typeof c.confidence === "number" && Number.isFinite(c.confidence)
      ? Math.max(0, Math.min(1, c.confidence / 100))
      : null;

  if (classConf01 !== null && classConf01 < 0.55) riskFlags.push("LOW_CLASS_CONF");

  const hasProof = reviews >= 15 || rating >= 4.3;
  if (!hasProof) riskFlags.push("LOW_PROOF");

  // Baseline risk from readiness (conservative)
  const readinessN = clamp(round(readiness));
  let riskBase = clamp(100 - readinessN * 0.7);

  // Only “real” risk bumps, not visibility gaps
  const flags = new Set<RiskFlag>(riskFlags);

  if (flags.has("OPERATIONAL_INSTABILITY")) riskBase = clamp(riskBase + 18);
  if (flags.has("SATURATED_COMPETITION")) riskBase = clamp(riskBase + 10);

  // Apply deltas from gap logic
  riskBase = clamp(riskBase + riskDelta);

  let risk = clamp(round(riskBase));

  // Add HIGH_RISK_SCORE only as a derived flag (never used to decide distress)
  if (risk >= 80 && !flags.has("OPERATIONAL_INSTABILITY")) {
    riskFlags.push("HIGH_RISK_SCORE");
  }

  // ==========================
  // RISK PROFILE (archetype)
  // ==========================

  // Principle:
  // - "unstable_business" == distressed / failing (rare).
  // - early-stage == low proof + low readiness.
  // - mature_competitor == high readiness + high proof + strong infra.
  // - owner_operator == default stable SMB.
  // - strong_local_brand == very high readiness + good fit.
  // - franchise/chain only when MULTI_LOCATION exists (future enrichment).

  let riskProfile: RiskProfile = "unknown";

  const franchiseEvidence = flags.has("MULTI_LOCATION");

  const matureEvidence =
    readinessN >= 70 &&
    reviews >= 120 &&
    rating >= 4.3 &&
    hasWebsite &&
    socialPresence === "high";

  const earlyEvidence = readinessN < 30 && reviews < 20;

  if (flags.has("OPERATIONAL_INSTABILITY")) {
    riskProfile = "unstable_business";
  } else if (franchiseEvidence) {
    riskProfile = "franchise_or_chain";
  } else if (matureEvidence) {
    riskProfile = "mature_competitor";
  } else if (earlyEvidence) {
    riskProfile = "early_stage";
  } else if (readinessN >= 80 && c.isGoodFit) {
    riskProfile = "strong_local_brand";
  } else {
    riskProfile = "owner_operator";
  }

  // ==========================
  // COMPOSITE (universal score)
  // ==========================

  // Your stated philosophy:
  // - hard to reach high opportunity
  // - hard to be labeled distressed
  // - universal score considers everything
  //
  // Use adjusted opportunity for the composite.
  const fitBoost = c.isGoodFit ? 8 : 0;
  const confBoost = clamp(round((c.confidence ?? 0) * 0.1), 0, 10);

  const value = clamp(
    round(opportunityAdjusted * 0.55 + readiness * 0.35 - risk * 0.2 + fitBoost + confBoost)
  );

  return {
    value,
    opportunity: opportunityAdjusted,
    readiness: clamp(round(readiness)),
    risk: clamp(round(risk)),
    riskProfile,
    // Keep legacy optional field available if you still use it anywhere.
    // If you don't, remove it.
    priority: value,
  };
}
