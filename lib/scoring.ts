// lib/scoring.ts
// Legacy scoring entry point — used by classify route.
// Updated to use new single-pass engine and signal-based classifier.

import type { RawCompany, Classification, ScoreResult } from "@/lib/types";
import { classifyBusinessProfile } from "@/lib/scoring/businessCondition";
import { computeUniversalScore } from "@/lib/scoring/universalScore";
import type { SignalSet } from "@/lib/signals/signalTypes";

type SocialPresence = "low" | "medium" | "high";

type RawCompanyExtras = {
  socialPresence?: SocialPresence;
};

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
  const reviews = safeNum(raw.review_count) ?? 0;
  const rating = safeNum(raw.rating) ?? 0;
  const hasWebsite = hasNonEmptyString(raw.website);
  let points = 0;
  if (hasWebsite) points += 1;
  if (reviews >= 200) points += 3;
  else if (reviews >= 50) points += 2;
  else if (reviews >= 10) points += 1;
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

export function scoreLead({ raw, classification: c }: ScoreLeadInput): ScoreResult {
  const extras = raw as RawCompany & { socialPresence?: SocialPresence };
  const rating = safeNum(raw.rating) ?? 0;
  const reviews = safeNum(raw.review_count) ?? 0;
  const hasWebsite = !!(raw.website && raw.website.trim().length > 0);
  const socialPresence = normalizeSocialPresence(extras);

  // Classify business profile from available signals
  const riskProfile = classifyBusinessProfile({
    reviews,
    rating,
    hasWebsite,
    categories: raw.categories ?? [],
    businessName: raw.name,
    socialPresence,
  });

  // Derive gap type from available signals
  const gapType = !hasWebsite ? "INFRASTRUCTURE" : socialPresence === "low" ? "VISIBILITY" : "OPTIMIZATION";

  // Single-pass score
  const scored = computeUniversalScore({
    reviews,
    rating,
    hasWebsite,
    socialPresence,
    riskProfile,
    fitScore: c.isGoodFit ? 65 : 45, // best estimate pre-fit scoring
    gapType,
    classificationConfidence: c.confidence ?? null,
  });

  return {
    ...scored,
    riskProfile,
    priority: scored.value,
  };
}
