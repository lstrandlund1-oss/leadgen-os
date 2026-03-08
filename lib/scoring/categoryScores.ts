import type { ScoreCategoryBreakdown } from "@/lib/types";

type SocialPresence = "low" | "medium" | "high";

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n));
}

function round(n: number): number {
  return Math.round(n);
}

export function getReputationScore(input: {
  rating: number;
  reviews: number;
}): number {
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
  let score = 0;

  if (input.hasWebsite) score += 55;

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
  const score =
    input.reputation * 0.5 +
    input.digitalPresence * 0.25 +
    input.evidenceConfidence * 0.25;

  return clamp(round(score));
}

export function getOpportunityGapScore(input: {
  reputation: number;
  digitalPresence: number;
  hasWebsite: boolean;
  socialPresence: SocialPresence;
}): number {
  let score = 0;

  // Only genuinely strong businesses with weak digital maturity should score high
  if (input.reputation >= 80 && input.digitalPresence <= 30) score += 26;
  else if (input.reputation >= 70 && input.digitalPresence <= 35) score += 20;
  else if (input.reputation >= 60 && input.digitalPresence <= 40) score += 14;
  else if (input.reputation >= 50 && input.digitalPresence <= 45) score += 8;

  if (!input.hasWebsite) score += 8;
  if (input.socialPresence === "low") score += 8;
  else if (input.socialPresence === "medium") score += 3;

  if (input.digitalPresence >= 75) score -= 25;
  else if (input.digitalPresence >= 60) score -= 15;
  else if (input.digitalPresence >= 45) score -= 8;

  return clamp(round(score));
}

export function getStabilityRiskScore(input: {
  rating: number;
  reviews: number;
  hasWebsite: boolean;
  socialPresence: SocialPresence;
}): number {
  let score = 0;

  // Only harshly punish when there is enough proof
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

  // weak signals should not imply instability, only a small bump
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
}): ScoreCategoryBreakdown {
  const reputation = getReputationScore({
    rating: input.rating,
    reviews: input.reviews,
  });

  const digitalPresence = getDigitalPresenceScore({
    hasWebsite: input.hasWebsite,
    socialPresence: input.socialPresence,
  });

  const evidenceConfidence = getEvidenceConfidenceScore({
    rating: input.rating,
    reviews: input.reviews,
    hasWebsite: input.hasWebsite,
    classificationConfidence01: input.classificationConfidence01,
  });

  const businessStrength = getBusinessStrengthScore({
    reputation,
    digitalPresence,
    evidenceConfidence,
  });

  const opportunityGap = getOpportunityGapScore({
    reputation,
    digitalPresence,
    hasWebsite: input.hasWebsite,
    socialPresence: input.socialPresence,
  });

  const stabilityRisk = getStabilityRiskScore({
    rating: input.rating,
    reviews: input.reviews,
    hasWebsite: input.hasWebsite,
    socialPresence: input.socialPresence,
  });

  return {
    reputation,
    digitalPresence,
    businessStrength,
    opportunityGap,
    stabilityRisk,
    evidenceConfidence,
  };
}
