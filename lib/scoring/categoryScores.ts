// lib/scoring/categoryScores.ts
//
// v2 scoring model. Philosophy:
//   Score = "how good is this lead FOR YOU to pursue right now"
//
// Four dimensions, each 0-100:
//   1. needSignal      - does this business have a specific, monetisable gap?
//   2. abilityToPay    - can they afford services? (reviews x rating proxy for revenue)
//   3. approachability - is the timing / profile right to pitch?
//   4. fitAlignment    - does your service actually match the gap? (from fitScore)
//
// Composite: need*0.38 + fit*0.30 + atp*0.18 + approach*0.14
// Hard caps: unstable_business <=22, mature_competitor with no gap <=32

import type { ScoreCategoryBreakdown, RiskProfile } from "@/lib/types";

type SocialPresence = "low" | "medium" | "high";

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n));
}

function round(n: number): number {
  return Math.round(n);
}

// Ability to Pay: review count x rating quality proxies revenue and maturity.
// A business with 100+ good reviews is paying rent and has discretionary budget.
export function getAbilityToPayScore(input: {
  rating: number;
  reviews: number;
  hasWebsite: boolean;
}): number {
  let score = 0;
  if (input.reviews >= 200) score = 88;
  else if (input.reviews >= 100) score = 73;
  else if (input.reviews >= 50) score = 58;
  else if (input.reviews >= 20) score = 43;
  else if (input.reviews >= 8) score = 28;
  else score = 13;
  if (input.rating >= 4.5) score = Math.min(100, score + 10);
  if (input.hasWebsite) score = Math.min(100, score + 8);
  return clamp(round(score));
}

// Need Signal: detects a real, specific, monetisable gap.
// Best: site exists but lacks booking/CTA = conversion gap (easiest sell).
// Second: no website + proven demand = foundation gap (clear problem).
// Worst: everything already solved = nothing to sell.
export function getNeedSignalScore(input: {
  hasWebsite: boolean;
  socialPresence: SocialPresence;
  reviews: number;
  hasBookingCta: boolean | null;
  hasClearOffer: boolean | null;
  isMobileFriendly: boolean | null;
  websiteReachable: boolean;
}): number {
  let score = 0;

  const noCtaGap = input.websiteReachable && input.hasBookingCta === false;
  const noClearOfferGap = input.websiteReachable && input.hasClearOffer === false;
  const notMobileFriendlyGap = input.websiteReachable && input.isMobileFriendly === false;

  if (noCtaGap) score += 55;
  else if (!input.hasWebsite && input.reviews >= 20) score += 50;
  else if (!input.hasWebsite && input.reviews >= 8) score += 38;
  else if (!input.hasWebsite) score += 25;

  if (noClearOfferGap && !noCtaGap) score += 12;
  if (notMobileFriendlyGap) score += 8;

  if (input.socialPresence === "low" && input.hasWebsite && !noCtaGap) score += 22;
  else if (input.socialPresence === "low" && !input.hasWebsite) score += 8;
  else if (input.socialPresence === "medium" && input.hasWebsite) score += 10;

  // Already has everything - nothing to sell
  if (
    input.hasWebsite &&
    input.hasBookingCta === true &&
    input.hasClearOffer === true &&
    input.socialPresence === "high"
  ) {
    score = Math.min(score, 12);
  }

  return clamp(round(score));
}

// Approachability: reflects profile/timing for pitching.
// owner_operator = best: decision-maker reachable and motivated.
// mature_competitor = worst: already locked in with vendors.
export function getApproachabilityScore(riskProfile: RiskProfile): number {
  switch (riskProfile) {
    case "owner_operator":     return 72;
    case "strong_local_brand": return 65;
    case "franchise_or_chain": return 50;
    case "high_regulation":    return 48;
    case "seasonal":           return 45;
    case "early_stage":        return 42;
    case "unknown":            return 50;
    case "mature_competitor":  return 28;
    case "unstable_business":  return 18;
    default:                   return 50;
  }
}

// Legacy wrappers - kept for UI Signals tab bars.
export function getReputationScore(input: { rating: number; reviews: number }): number {
  let score = 0;
  if (input.rating >= 4.8) score += 45;
  else if (input.rating >= 4.6) score += 40;
  else if (input.rating >= 4.3) score += 32;
  else if (input.rating >= 4.0) score += 22;
  else if (input.rating >= 3.6) score += 12;
  else if (input.rating >= 3.2) score += 5;
  if (input.reviews >= 250) score += 45;
  else if (input.reviews >= 100) score += 35;
  else if (input.reviews >= 50) score += 25;
  else if (input.reviews >= 20) score += 16;
  else if (input.reviews >= 10) score += 10;
  else if (input.reviews >= 3) score += 4;
  return clamp(round(score));
}

export function getDigitalPresenceScore(input: {
  hasWebsite: boolean;
  socialPresence: SocialPresence;
}): number {
  let score = input.hasWebsite ? 55 : 0;
  if (input.socialPresence === "high") score += 45;
  else if (input.socialPresence === "medium") score += 25;
  else score += 5;
  return clamp(round(score));
}

export function getEvidenceConfidenceScore(input: {
  rating: number;
  reviews: number;
  hasWebsite: boolean;
  classificationConfidence01: number | null;
}): number {
  let score = 0;
  if (input.reviews >= 100) score += 45;
  else if (input.reviews >= 50) score += 35;
  else if (input.reviews >= 20) score += 25;
  else if (input.reviews >= 10) score += 15;
  else if (input.reviews >= 3) score += 8;
  if (input.rating > 0) score += 15;
  if (input.hasWebsite) score += 10;
  if (input.classificationConfidence01 !== null) {
    score += Math.round(input.classificationConfidence01 * 30);
  }
  return clamp(round(score));
}

export function getBusinessStrengthScore(input: {
  reputation: number;
  digitalPresence: number;
  evidenceConfidence: number;
}): number {
  return clamp(round(
    input.reputation * 0.5 + input.digitalPresence * 0.25 + input.evidenceConfidence * 0.25
  ));
}

// v2: opportunityGap now represents needSignal
export function getOpportunityGapScore(input: {
  hasWebsite: boolean;
  socialPresence: SocialPresence;
  reviews: number;
  hasBookingCta?: boolean | null;
  hasClearOffer?: boolean | null;
  isMobileFriendly?: boolean | null;
  websiteReachable?: boolean;
}): number {
  return getNeedSignalScore({
    hasWebsite: input.hasWebsite,
    socialPresence: input.socialPresence,
    reviews: input.reviews,
    hasBookingCta: input.hasBookingCta ?? null,
    hasClearOffer: input.hasClearOffer ?? null,
    isMobileFriendly: input.isMobileFriendly ?? null,
    websiteReachable: input.websiteReachable ?? input.hasWebsite,
  });
}

export function getStabilityRiskScore(input: {
  rating: number;
  reviews: number;
  hasWebsite: boolean;
  socialPresence: SocialPresence;
}): number {
  let score = 0;
  if (input.reviews >= 50) {
    if (input.rating <= 3.2) score += 80;
    else if (input.rating <= 3.5) score += 55;
    else if (input.rating <= 3.8) score += 30;
  } else if (input.reviews >= 20) {
    if (input.rating <= 3.0) score += 75;
    else if (input.rating <= 3.3) score += 45;
    else if (input.rating <= 3.6) score += 22;
  } else if (input.reviews >= 8) {
    if (input.rating <= 3.0) score += 35;
    else if (input.rating <= 3.3) score += 20;
  }
  if (!input.hasWebsite) score += 5;
  if (input.socialPresence === "low") score += 5;
  return clamp(round(score));
}

export function buildCategoryScores(input: {
  rating: number;
  reviews: number;
  hasWebsite: boolean;
  socialPresence: SocialPresence;
  classificationConfidence01: number | null;
  hasBookingCta?: boolean | null;
  hasClearOffer?: boolean | null;
  isMobileFriendly?: boolean | null;
  websiteReachable?: boolean;
}): ScoreCategoryBreakdown {
  const reputation = getReputationScore({ rating: input.rating, reviews: input.reviews });
  const digitalPresence = getDigitalPresenceScore({ hasWebsite: input.hasWebsite, socialPresence: input.socialPresence });
  const evidenceConfidence = getEvidenceConfidenceScore({
    rating: input.rating, reviews: input.reviews,
    hasWebsite: input.hasWebsite, classificationConfidence01: input.classificationConfidence01,
  });
  const businessStrength = getBusinessStrengthScore({ reputation, digitalPresence, evidenceConfidence });
  const opportunityGap = getOpportunityGapScore({
    hasWebsite: input.hasWebsite, socialPresence: input.socialPresence,
    reviews: input.reviews, hasBookingCta: input.hasBookingCta,
    hasClearOffer: input.hasClearOffer, isMobileFriendly: input.isMobileFriendly,
    websiteReachable: input.websiteReachable,
  });
  const stabilityRisk = getStabilityRiskScore({
    rating: input.rating, reviews: input.reviews,
    hasWebsite: input.hasWebsite, socialPresence: input.socialPresence,
  });
  return { reputation, digitalPresence, businessStrength, opportunityGap, stabilityRisk, evidenceConfidence };
}