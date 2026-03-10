import type { RawCompany, Classification, ScoreResult } from "@/lib/types";
import { buildCategoryScores } from "@/lib/scoring/categoryScores";
import { classifyBusinessCondition } from "@/lib/scoring/businessCondition";
import { computeUniversalScore } from "@/lib/scoring/universalScore";
import type { SignalSet } from "@/lib/signals/signalTypes";

type SocialPresence = "low" | "medium" | "high";

// If provider delivers socialPresence on raw records, we accept it.
type RawCompanyExtras = {
  socialPresence?: SocialPresence;
};

function safeNum(n: unknown): number | null {
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

function hasNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function normalizeSocialPresence(
  raw: RawCompany & RawCompanyExtras,
): SocialPresence {
  if (
    raw.socialPresence === "low" ||
    raw.socialPresence === "medium" ||
    raw.socialPresence === "high"
  ) {
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

interface ScoreLeadInput {
  raw: RawCompany;
  classification: Classification;
  signals: SignalSet;
}

/**
 * Readiness = operational viability + ability to execute & pay.
 * This should be conservative (hard to get very high).
 */

export function scoreLead({
  raw,
  classification,
  signals,
}: ScoreLeadInput): ScoreResult {
  void signals;
  const c = classification;
  const extras = raw as RawCompany & {
    socialPresence?: "low" | "medium" | "high";
  };

  const rating = safeNum(raw.rating) ?? 0;
  const reviews = safeNum(raw.review_count) ?? 0;

  const hasWebsite = !!(raw.website && raw.website.trim().length > 0);

  const socialPresence = normalizeSocialPresence(extras);

  const classificationConfidence01 =
    typeof c.confidence === "number" && Number.isFinite(c.confidence)
      ? Math.max(0, Math.min(1, c.confidence / 100))
      : null;

  // 1️⃣ Build category scores
  const breakdownBase = buildCategoryScores({
    rating,
    reviews,
    hasWebsite,
    socialPresence,
    classificationConfidence01,
  });

  const breakdown = {
    ...breakdownBase,
    evidenceConfidence: signals.evidenceScore,
  };

  // 2️⃣ Determine business condition
  const riskProfile = classifyBusinessCondition({
    scores: breakdown,
    isGoodFit: c.isGoodFit ?? false,
    hasWebsite,
    socialPresence,
    reviews,
    rating,
  });

  // 3️⃣ Universal scoring
  const universal = computeUniversalScore({
    scores: breakdown,
    riskProfile,
    isGoodFit: c.isGoodFit ?? false,
    classificationConfidence: c.confidence ?? null,
    rating,
    reviews,
    hasWebsite,
    // fitScore not available at this stage (pre-fit); will be recalculated after fit scoring
  });

  const reasons: string[] = [];

  if (breakdown.reputation >= 80) {
    reasons.push("Strong reputation");
  }

  if (breakdown.digitalPresence <= 35) {
    reasons.push("Weak digital presence");
  }

  if (breakdown.opportunityGap >= 70) {
    reasons.push("High growth opportunity");
  }

  if (breakdown.stabilityRisk >= 60) {
    reasons.push("Possible operational risk");
  }

  if (breakdown.evidenceConfidence < 40) {
    reasons.push("Limited evidence signals");
  }

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