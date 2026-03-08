import type { ScoreCategoryBreakdown, RiskProfile } from "@/lib/types";

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n));
}

function round(n: number): number {
  return Math.round(n);
}

export function computeUniversalScore(input: {
  scores: ScoreCategoryBreakdown;
  riskProfile: RiskProfile;
  isGoodFit: boolean;
  classificationConfidence: number | null;
}): {
  value: number;
  opportunity: number;
  readiness: number;
  risk: number;
} {
  const s = input.scores;

  const readiness = clamp(
    round(
      s.businessStrength * 0.6 +
        s.digitalPresence * 0.2 +
        s.evidenceConfidence * 0.2,
    ),
  );

  const risk = clamp(
    round(
      s.stabilityRisk * 0.75 +
        (100 - s.evidenceConfidence) * 0.15 +
        (input.riskProfile === "mature_competitor" ? 10 : 0),
    ),
  );

  let opportunity = clamp(
    round(
      s.opportunityGap * 0.45 +
        s.reputation * 0.1 +
        s.evidenceConfidence * 0.1 +
        (input.isGoodFit ? 5 : 0),
    ),
  );

  // Hard caps

  if (s.evidenceConfidence < 35) opportunity = Math.min(opportunity, 35);
  else if (s.evidenceConfidence < 50) opportunity = Math.min(opportunity, 50);
  else if (s.evidenceConfidence < 65) opportunity = Math.min(opportunity, 65);

  if (s.reputation < 45) opportunity = Math.min(opportunity, 40);
  else if (s.reputation < 60) opportunity = Math.min(opportunity, 55);
  else if (s.reputation < 70) opportunity = Math.min(opportunity, 70);

  if (s.digitalPresence >= 75) opportunity = Math.min(opportunity, 35);
  else if (s.digitalPresence >= 60) opportunity = Math.min(opportunity, 50);
  else if (s.digitalPresence >= 45) opportunity = Math.min(opportunity, 65);

  if (s.businessStrength < 40) opportunity = Math.min(opportunity, 40);
  else if (s.businessStrength < 55) opportunity = Math.min(opportunity, 60);

  if (s.stabilityRisk >= 60) opportunity = Math.min(opportunity, 35);
  else if (s.stabilityRisk >= 40) opportunity = Math.min(opportunity, 55);

  if (input.riskProfile === "mature_competitor") {
    opportunity = Math.min(opportunity, 55);
  }

  if (input.riskProfile === "unstable_business") {
    opportunity = Math.min(opportunity, 20);
  }

  let value = clamp(round(opportunity * 0.5 + readiness * 0.3 - risk * 0.2));

  if (s.evidenceConfidence < 35 && value > 50) value = 50;
  if (input.riskProfile === "unstable_business") value = Math.min(value, 20);

  return {
    value,
    opportunity,
    readiness,
    risk,
  };
}
