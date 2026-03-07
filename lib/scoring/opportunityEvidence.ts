// lib/scoring/opportunityEvidence.ts
import { RiskProfile } from "@/lib/types";
import { Gap, SocialPresence } from "@/lib/scoring/opportunityModel";

export type EvidenceInput = {
  gap: Gap;
  fitScore: number;

  rating: number | null;
  reviewCount: number | null;
  hasWebsite: boolean;
  socialPresence: SocialPresence;

  risk: number;
  riskProfile: RiskProfile;

  classificationConfidence: number | null;
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function scoreEvidenceConfidence(input: EvidenceInput): number {
  // Start high, subtract for missing/weak evidence.
  // This is NOT “truth confidence”, it’s “evidence completeness” for UI + future learning.
  let c = 1.0;

  // Fit & gap are core, should basically always exist at this pipeline stage.
  if (!Number.isFinite(input.fitScore)) c -= 0.25;
  if (!input.gap) c -= 0.20;

  // Proof evidence
  if (input.rating === null) c -= 0.10;
  if (input.reviewCount === null) c -= 0.10;

  // Social presence is often missing/unstable depending on provider coverage.
  if (input.socialPresence === null) c -= 0.08;

  // Classification confidence missing is meaningful (model knows less about niche/category).
  if (input.classificationConfidence === null) c -= 0.12;

  // Risk is required; if missing, evidence confidence should tank.
  if (!Number.isFinite(input.risk)) c -= 0.25;

  // Floor/ceiling
  return clamp(c, 0, 1);
}