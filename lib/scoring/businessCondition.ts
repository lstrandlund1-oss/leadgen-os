import type { RiskProfile, ScoreCategoryBreakdown } from "@/lib/types";

export function classifyBusinessCondition(input: {
  scores: ScoreCategoryBreakdown;
  isGoodFit: boolean;
  hasWebsite: boolean;
  socialPresence: "low" | "medium" | "high";
  reviews: number;
  rating: number;
}): RiskProfile {
  const s = input.scores;

  // Distressed / unstable must be rare
  if (
    s.stabilityRisk >= 85 &&
    s.evidenceConfidence >= 60 &&
    input.reviews >= 20 &&
    input.rating <= 3.2
  ) {
    return "unstable_business";
  }

  if (
    s.businessStrength >= 80 &&
    s.digitalPresence >= 75 &&
    s.reputation >= 75 &&
    s.opportunityGap <= 20
  ) {
    return "mature_competitor";
  }

  if (s.businessStrength >= 70 && s.opportunityGap >= 45 && input.isGoodFit) {
    return "strong_local_brand";
  }

  if (s.evidenceConfidence < 35 && input.reviews < 20) {
    return "early_stage";
  }

  return "owner_operator";
}
