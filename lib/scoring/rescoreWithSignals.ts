// lib/scoring/rescoreWithSignals.ts
// v2: passes enrichment signals into categoryScores and universalScore

import { buildCategoryScores } from "@/lib/scoring/categoryScores";
import { classifyBusinessCondition } from "@/lib/scoring/businessCondition";
import { computeUniversalScore } from "@/lib/scoring/universalScore";
import type { ScoreResult, RiskProfile } from "@/lib/types";

type SocialPresence = "low" | "medium" | "high";

export interface RescoreInput {
  rating: number | null;
  reviewCount: number | null;
  hasWebsite: boolean;
  socialPresence: SocialPresence;
  isGoodFit: boolean;
  classificationConfidence: number | null;
  riskProfile: RiskProfile;
  fitScore?: number;

  // Light enrichment results
  websiteReachable: boolean;
  hasContactPage: boolean | null;
  hasBookingCta: boolean | null;
  hasClearOffer: boolean | null;
  isMobileFriendly: boolean | null;
  socialPlatformCount: number;
  ownerResponds: boolean | null;
}

export function rescoreWithLightSignals(input: RescoreInput): ScoreResult {
  const rating = input.rating ?? 0;
  const reviews = input.reviewCount ?? 0;
  const classificationConfidence01 =
    input.classificationConfidence !== null
      ? Math.max(0, Math.min(1, input.classificationConfidence / 100))
      : null;

  // Social presence from platform count + existing signal
  const socialPresence: SocialPresence =
    input.socialPlatformCount >= 3 ? "high" :
    input.socialPlatformCount >= 1 ? (input.socialPresence === "high" ? "high" : "medium") :
    input.socialPresence;

  // Build category scores with all enrichment signals
  const breakdown = buildCategoryScores({
    rating,
    reviews,
    hasWebsite: input.hasWebsite,
    socialPresence,
    classificationConfidence01,
    hasBookingCta: input.hasBookingCta,
    hasClearOffer: input.hasClearOffer,
    isMobileFriendly: input.isMobileFriendly,
    websiteReachable: input.websiteReachable,
  });

  const riskProfile = classifyBusinessCondition({
    scores: breakdown,
    isGoodFit: input.isGoodFit,
    hasWebsite: input.hasWebsite,
    socialPresence,
    reviews,
    rating,
  });

  const universal = computeUniversalScore({
    scores: breakdown,
    riskProfile,
    isGoodFit: input.isGoodFit,
    classificationConfidence: input.classificationConfidence,
    fitScore: input.fitScore,
    rating,
    reviews,
    hasWebsite: input.hasWebsite,
  });

  // Build reasons
  const reasons: string[] = [];
  if (breakdown.reputation >= 80) reasons.push("Strong reputation");
  if (breakdown.digitalPresence <= 35) reasons.push("Weak digital presence");
  if (breakdown.opportunityGap >= 50) reasons.push("Clear monetisable gap");
  if (breakdown.stabilityRisk >= 60) reasons.push("Possible operational risk");
  if (breakdown.evidenceConfidence < 40) reasons.push("Limited evidence signals");
  if (input.websiteReachable && input.hasBookingCta === false) reasons.push("No booking CTA detected");
  if (input.socialPlatformCount === 0) reasons.push("No social presence detected");
  if (input.websiteReachable && input.hasClearOffer === false) reasons.push("Weak offer presentation");

  return {
    value: universal.value,
    opportunity: universal.opportunity,
    readiness: universal.readiness,
    risk: universal.risk,
    riskProfile,
    priority: universal.value,
    breakdown,
    reasons,
  };
}