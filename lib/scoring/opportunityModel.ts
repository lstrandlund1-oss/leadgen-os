// lib/scoring/opportunityModel.ts
import { RiskProfile } from "@/lib/types";

export type Gap =
  | "VISIBILITY"
  | "CONVERSION"
  | "INFRASTRUCTURE"
  | "OPTIMIZATION";

export type SocialPresence = "low" | "medium" | "high" | null;

export type OpportunityModelInput = {
  gap: Gap;
  fitScore: number; // 0..100

  rating: number | null; // typically 1..5
  reviewCount: number | null; // 0..N
  hasWebsite: boolean;

  socialPresence: SocialPresence;

  risk: number; // 0..100 (higher = worse)
  riskProfile: RiskProfile;

  classificationConfidence: number | null; // 0..1
};

type Coefficients = {
  intercept: number;

  // Main drivers
  fit: number; // + per normalized fit unit
  gapVisibility: number;
  gapConversion: number;
  gapInfrastructure: number;
  gapOptimization: number;

  // Weak proof signals
  rating: number;
  reviewsLog: number;
  website: number;
  socialLow: number;
  socialMedium: number;
  socialHigh: number;

  // Risk (strong negative)
  risk: number;
  unstableBusinessPenalty: number;
  matureCompetitorPenalty: number;

  // Classification certainty (small)
  classConf: number;
};

const DEFAULT_COEF: Coefficients = {
  // Adjusting intercept shifts the global “baseline” close probability.
  intercept: -0.35,

  // Fit should dominate (your locked philosophy).
  fit: 1.35,

  // Gap sellability: visibility & conversion generally sell easier than infra/opt.
  gapVisibility: 0.55,
  gapConversion: 0.65,
  gapInfrastructure: 0.25,
  gapOptimization: 0.3,

  // Proof signals: weak modifiers.
  rating: 0.18,
  reviewsLog: 0.16,
  website: 0.08,
  socialLow: 0.08,
  socialMedium: 0.02,
  socialHigh: -0.06,

  // Risk: strong negative. This is the “don’t waste time on bad bets” lever.
  risk: -1.1,
  unstableBusinessPenalty: -0.25,
  matureCompetitorPenalty: -0.18,

  // Classification confidence: small nudge.
  classConf: 0.2,
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function norm100(x: number): number {
  return clamp(x, 0, 100) / 100;
}

function safeRating(r: number | null): number {
  if (r === null) return 0;
  return clamp(r, 0, 5) / 5; // normalize to 0..1
}

function safeReviewsLog(count: number | null): number {
  if (count === null) return 0;
  const c = Math.max(0, count);
  // log1p scaling; normalize roughly by a typical “strong” review count
  // 0->0, 10->~2.4, 100->~4.6, 1000->~6.9
  const scaled = Math.log1p(c);
  return clamp(scaled / 6.5, 0, 1); // 6.5 ~ “very strong” bucket
}

function gapWeight(gap: Gap, c: Coefficients): number {
  switch (gap) {
    case "VISIBILITY":
      return c.gapVisibility;
    case "CONVERSION":
      return c.gapConversion;
    case "INFRASTRUCTURE":
      return c.gapInfrastructure;
    case "OPTIMIZATION":
      return c.gapOptimization;
    default: {
      const exhaustive: never = gap;
      return exhaustive;
    }
  }
}

function socialWeight(sp: SocialPresence, c: Coefficients): number {
  if (sp === "low") return c.socialLow;
  if (sp === "medium") return c.socialMedium;
  if (sp === "high") return c.socialHigh;
  return 0;
}

function riskProfilePenalty(profile: RiskProfile, c: Coefficients): number {
  switch (profile) {
    case "early_stage":
    case "limited_data":
      return c.unstableBusinessPenalty;
    case "well_established":
    case "local_authority":
      return c.matureCompetitorPenalty;
    case "growing_business":
    case "solo_run":
    case "independent_business":
    case "unknown":
      return 0;
    default:
      return 0;
  }
}

export type OpportunityModelOutput = {
  probability01: number; // 0..1
  reasons: string[];
};

export function scoreCloseProbability(
  input: OpportunityModelInput,
  coef: Coefficients = DEFAULT_COEF,
): OpportunityModelOutput {
  const fitN = norm100(input.fitScore);
  const riskN = norm100(input.risk);
  const ratingN = safeRating(input.rating);
  const reviewsN = safeReviewsLog(input.reviewCount);
  const classConf =
    input.classificationConfidence === null
      ? 0
      : clamp(input.classificationConfidence, 0, 1);

  // Linear logit
  const logit =
    coef.intercept +
    coef.fit * fitN +
    gapWeight(input.gap, coef) +
    coef.rating * ratingN +
    coef.reviewsLog * reviewsN +
    (input.hasWebsite ? coef.website : 0) +
    socialWeight(input.socialPresence, coef) +
    coef.risk * riskN +
    riskProfilePenalty(input.riskProfile, coef) +
    coef.classConf * classConf;

  const p = clamp(sigmoid(logit), 0, 1);

  const reasons: string[] = [];

  // Reasons: keep them stable, deterministic, and tied to your philosophy.
  if (fitN >= 0.75) reasons.push("Strong fit");
  if (input.gap === "CONVERSION" || input.gap === "VISIBILITY")
    reasons.push("Sellable gap");
  if (riskN >= 0.65) reasons.push("High risk");
  if (input.riskProfile === "early_stage" || input.riskProfile === "limited_data")
    reasons.push("Early stage or limited data profile");
  if (input.riskProfile === "well_established" || input.riskProfile === "local_authority")
    reasons.push("Well-established business profile");
  if (ratingN >= 0.8 && (input.reviewCount ?? 0) >= 25)
    reasons.push("Proof signals present");
  if (classConf >= 0.7) reasons.push("Confident classification");

  return { probability01: p, reasons };
}