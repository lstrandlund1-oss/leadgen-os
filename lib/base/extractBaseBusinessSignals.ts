// lib/base/extractBaseBusinessSignals.ts
//
// Composite base-depth business signals. Combines reputation and digital
// signals into the higher-order scores used by the universal scorer:
// businessStrength, opportunityGap, stabilityRisk, evidenceConfidence.
// These are the "why" behind the final score numbers the UI shows.

import type { ScoreCategoryBreakdown } from "@/lib/types";
import {
  buildCategoryScores,
  getBusinessStrengthScore,
  getOpportunityGapScore,
  getStabilityRiskScore,
  getEvidenceConfidenceScore,
} from "@/lib/scoring/categoryScores";

export interface BaseBusinessInput {
  rating: number | null;
  reviewCount: number | null;
  hasWebsite: boolean;
  socialPresence: "low" | "medium" | "high" | null;
  classificationConfidence: number | null; // 0-1
}

export interface BaseBusinessResult {
  /** Full breakdown for the universal scorer */
  categoryScores: ScoreCategoryBreakdown;

  /** Plain-English diagnosis of the business condition */
  diagnosis: {
    strengthLevel: "strong" | "moderate" | "weak";
    opportunityLevel: "high" | "medium" | "low";
    riskLevel: "high" | "medium" | "low";
    evidenceLevel: "high" | "medium" | "low";
    summaryLine: string;
  };
}

function bandThree<T extends string>(value: number, high: number, low: number, labels: [T, T, T]): T {
  return value >= high ? labels[0] : value >= low ? labels[1] : labels[2];
}

export function extractBaseBusinessSignals(
  input: BaseBusinessInput,
): BaseBusinessResult {
  const rating = input.rating ?? 0;
  const reviews = input.reviewCount ?? 0;
  const socialPresence = input.socialPresence ?? "low";
  const confidence01 = input.classificationConfidence;

  const categoryScores = buildCategoryScores({
    rating,
    reviews,
    hasWebsite: input.hasWebsite,
    socialPresence,
    classificationConfidence01: confidence01,
  });

  const strengthLevel = bandThree(categoryScores.businessStrength, 65, 40, ["strong", "moderate", "weak"] as const);
  const opportunityLevel = bandThree(categoryScores.opportunityGap, 55, 30, ["high", "medium", "low"] as const);
  const riskLevel = bandThree(categoryScores.stabilityRisk, 55, 30, ["high", "medium", "low"] as const);
  const evidenceLevel = bandThree(categoryScores.evidenceConfidence, 60, 35, ["high", "medium", "low"] as const);

  // Build a single diagnostic summary line
  let summaryLine: string;
  if (strengthLevel === "strong" && opportunityLevel === "high") {
    summaryLine = "Strong, established business with significant digital gaps — ideal service candidate.";
  } else if (strengthLevel === "strong" && opportunityLevel === "low") {
    summaryLine = "Well-established business with a mature digital presence — low conversion opportunity.";
  } else if (strengthLevel === "weak" && riskLevel === "high") {
    summaryLine = "Unstable signals — low review volume, poor rating, or no web presence. High resistance expected.";
  } else if (evidenceLevel === "low") {
    summaryLine = "Insufficient data to score with confidence. Treat scores as directional only.";
  } else if (opportunityLevel === "high") {
    summaryLine = "Meaningful digital gap detected. Business has demand but lacks conversion infrastructure.";
  } else {
    summaryLine = "Moderate signals. Standard outreach approach recommended.";
  }

  return {
    categoryScores,
    diagnosis: { strengthLevel, opportunityLevel, riskLevel, evidenceLevel, summaryLine },
  };
}