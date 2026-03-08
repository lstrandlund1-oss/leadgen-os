import { mergeSignals } from "@/lib/signals/mergeSignals";
import { buildSignal } from "@/lib/signals/evidence";
import { buildCategoryScores } from "@/lib/scoring/categoryScores";
import { classifyBusinessCondition } from "@/lib/scoring/businessCondition";
import { computeUniversalScore } from "@/lib/scoring/universalScore";
import type { ScoreResult, RiskProfile } from "@/lib/types";

type SocialPresence = "low" | "medium" | "high";

export interface RescoreInput {
  // Original lead data
  rating: number | null;
  reviewCount: number | null;
  hasWebsite: boolean;
  socialPresence: SocialPresence;
  isGoodFit: boolean;
  classificationConfidence: number | null;
  riskProfile: RiskProfile;

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

  // Build base category scores (same as before)
  const baseBreakdown = buildCategoryScores({
    rating,
    reviews,
    hasWebsite: input.hasWebsite,
    socialPresence: input.socialPresence,
    classificationConfidence01,
  });

  // --- Apply light enrichment boosts ---
  // These are additive adjustments based on what we actually found

  let digitalBoost = 0;
  let opportunityAdjust = 0;
  let evidenceBoost = 0;

  // Website was reachable = confirmed real digital presence
  if (input.websiteReachable) {
    evidenceBoost += 8;
  }

  // Contact page exists = basic conversion infrastructure present
  if (input.hasContactPage === true) {
    digitalBoost += 5;
    evidenceBoost += 4;
  }

  // Booking CTA = direct conversion signal
  // This is a strong opportunity gap signal — business CAN take bookings but may not be maximizing
  if (input.hasBookingCta === true) {
    digitalBoost += 6;
    opportunityAdjust += 5;
    evidenceBoost += 4;
  } else if (input.hasBookingCta === false && input.websiteReachable) {
    // Site is reachable but no booking CTA = clear gap = higher opportunity
    opportunityAdjust += 8;
  }

  // Clear offer = business knows how to present itself
  if (input.hasClearOffer === true) {
    digitalBoost += 4;
    evidenceBoost += 3;
  } else if (input.hasClearOffer === false && input.websiteReachable) {
    opportunityAdjust += 5;
  }

  // Mobile friendly = modern web presence
  if (input.isMobileFriendly === true) {
    digitalBoost += 4;
    evidenceBoost += 3;
  } else if (input.isMobileFriendly === false && input.websiteReachable) {
    opportunityAdjust += 4;
  }

  // Social platform count
  if (input.socialPlatformCount >= 3) {
    digitalBoost += 8;
    evidenceBoost += 5;
  } else if (input.socialPlatformCount === 2) {
    digitalBoost += 5;
    evidenceBoost += 3;
  } else if (input.socialPlatformCount === 1) {
    digitalBoost += 3;
    evidenceBoost += 2;
  }

  // Owner responds to reviews = engaged, approachable business
  if (input.ownerResponds === true) {
    evidenceBoost += 5;
    opportunityAdjust += 3;
  }

  // Apply boosts — clamped to 100
  const enrichedBreakdown = {
    ...baseBreakdown,
    digitalPresence: Math.min(100, baseBreakdown.digitalPresence + digitalBoost),
    opportunityGap: Math.min(100, baseBreakdown.opportunityGap + opportunityAdjust),
    evidenceConfidence: Math.min(100, baseBreakdown.evidenceConfidence + evidenceBoost),
  };

  // Recalculate business strength with new digital + evidence
  enrichedBreakdown.businessStrength = Math.min(
    100,
    Math.round(
      enrichedBreakdown.reputation * 0.5 +
      enrichedBreakdown.digitalPresence * 0.25 +
      enrichedBreakdown.evidenceConfidence * 0.25,
    ),
  );

  // Recompute risk profile and universal score
  const riskProfile = classifyBusinessCondition({
    scores: enrichedBreakdown,
    isGoodFit: input.isGoodFit,
    hasWebsite: input.hasWebsite,
    socialPresence: input.socialPresence,
    reviews,
    rating,
  });

  const universal = computeUniversalScore({
    scores: enrichedBreakdown,
    riskProfile,
    isGoodFit: input.isGoodFit,
    classificationConfidence: input.classificationConfidence,
  });

  // Build reasons
  const reasons: string[] = [];
  if (enrichedBreakdown.reputation >= 80) reasons.push("Strong reputation");
  if (enrichedBreakdown.digitalPresence <= 35) reasons.push("Weak digital presence");
  if (enrichedBreakdown.opportunityGap >= 70) reasons.push("High growth opportunity");
  if (enrichedBreakdown.stabilityRisk >= 60) reasons.push("Possible operational risk");
  if (enrichedBreakdown.evidenceConfidence < 40) reasons.push("Limited evidence signals");
  if (input.websiteReachable && !input.hasBookingCta) reasons.push("No booking CTA detected");
  if (input.socialPlatformCount === 0) reasons.push("No social presence detected");

  return {
    value: universal.value,
    opportunity: universal.opportunity,
    readiness: universal.readiness,
    risk: universal.risk,
    riskProfile,
    priority: universal.value,
    breakdown: enrichedBreakdown,
    reasons,
  };
}