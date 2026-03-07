import type { RiskFlag } from "@/lib/types";

type SocialPresence = "low" | "medium" | "high";

export function computeRiskFlags(input: {
  hasWebsite: boolean;
  socialPresence: SocialPresence;
  rating: number | null;
  reviews: number | null;
  classificationConfidence01: number | null; // 0..1
  isMatureCompetitor?: boolean;
  isDistressed?: boolean;
}): RiskFlag[] {
  const flags: RiskFlag[] = [];

  if (input.isDistressed) flags.push("OPERATIONAL_INSTABILITY");
  if (input.isMatureCompetitor) flags.push("SATURATED_COMPETITION");

  if (!input.hasWebsite) flags.push("NO_WEBSITE");
  if (input.socialPresence === "low") flags.push("WEAK_SOCIAL");

  if (input.classificationConfidence01 !== null && input.classificationConfidence01 < 0.55) {
    flags.push("LOW_CLASS_CONF");
  }

  const rating = input.rating;
  const reviews = input.reviews;

  const hasProof =
    (typeof reviews === "number" && reviews >= 15) ||
    (typeof rating === "number" && rating >= 4.3);

  if (!hasProof) flags.push("LOW_PROOF");

  return flags;
}