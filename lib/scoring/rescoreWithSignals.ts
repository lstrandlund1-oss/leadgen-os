// lib/scoring/rescoreWithSignals.ts
// Called by light enrichment route after website + social signals are available.
// Uses the same single-pass computeUniversalScore with enrichment signals added.
// The gap type is refined using deriveGap once we know hasBookingCta etc.

import { classifyBusinessProfile } from "@/lib/scoring/businessCondition";
import { computeUniversalScore } from "@/lib/scoring/universalScore";
import type { ScoreResult, RiskProfile } from "@/lib/types";

type SocialPresence = "low" | "medium" | "high";
type GapType = "INFRASTRUCTURE" | "CONVERSION" | "VISIBILITY" | "OPTIMIZATION";

export interface RescoreInput {
  rating: number | null;
  reviewCount: number | null;
  hasWebsite: boolean;
  socialPresence: SocialPresence;
  classificationConfidence: number | null;
  fitScore?: number;
  fitTooltip?: string;
  gapType?: GapType;

  // Light enrichment signals
  websiteReachable: boolean;
  hasContactPage: boolean | null;
  hasBookingCta: boolean | null;
  hasClearOffer: boolean | null;
  isMobileFriendly: boolean | null;
  socialPlatformCount: number;
  ownerResponds: boolean | null;

  // For classification refinement
  categories?: string[];
  businessName?: string;
}

function deriveGapFromSignals(input: RescoreInput): GapType {
  // If caller already derived it, use that
  if (input.gapType) return input.gapType;

  const hasWebsite = input.hasWebsite;
  const websiteReachable = input.websiteReachable;

  if (!hasWebsite) return "INFRASTRUCTURE";
  if (websiteReachable && input.hasBookingCta === false) return "CONVERSION";
  if (input.socialPresence === "low") return "VISIBILITY";
  return "OPTIMIZATION";
}

export function rescoreWithLightSignals(input: RescoreInput): ScoreResult {
  const rating = input.rating ?? 0;
  const reviews = input.reviewCount ?? 0;

  // Refine social presence using platform count from enrichment
  const socialPresence: SocialPresence =
    input.socialPlatformCount >= 3 ? "high" :
    input.socialPlatformCount >= 1
      ? (input.socialPresence === "high" ? "high" : "medium")
      : input.socialPresence;

  // Reclassify using enrichment signals — now we know ownerResponds
  const businessProfile = classifyBusinessProfile({
    reviews,
    rating,
    hasWebsite: input.hasWebsite,
    categories: input.categories ?? [],
    businessName: input.businessName,
    socialPresence,
    socialPlatformCount: input.socialPlatformCount,
    ownerResponds: input.ownerResponds ?? undefined,
  });

  const gapType = deriveGapFromSignals(input);

  // Single-pass score with all enrichment signals
  const scored = computeUniversalScore({
    reviews,
    rating,
    hasWebsite: input.hasWebsite,
    socialPresence,
    riskProfile: businessProfile,
    fitScore: input.fitScore ?? 50,
    fitTooltip: input.fitTooltip,
    gapType,
    classificationConfidence: input.classificationConfidence,

    // Enrichment signals
    hasBookingCta: input.hasBookingCta,
    hasClearOffer: input.hasClearOffer,
    isMobileFriendly: input.isMobileFriendly,
    websiteReachable: input.websiteReachable,
    socialPlatformCount: input.socialPlatformCount,
    ownerResponds: input.ownerResponds ?? undefined,
  });

  return {
    ...scored,
    riskProfile: businessProfile,
    priority: scored.value,
  };
}