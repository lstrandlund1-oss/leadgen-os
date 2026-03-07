// lib/scoring/opportunity.ts
import type { RiskProfile } from "@/lib/types";

export type OpportunityInput = {
  // gap / need strength
  gap: "VISIBILITY" | "CONVERSION" | "INFRASTRUCTURE" | "OPTIMIZATION";
  fitScore: number; // 0-100

  // proof / trust signals (not always present)
  rating: number | null; // 1-5
  reviewCount: number | null; // 0+
  hasWebsite: boolean;

  // presence (if you have it)
  socialPresence: "low" | "medium" | "high" | null;

  // your existing risk output
  risk: number; // 0-100
  riskProfile: RiskProfile;

  // classification certainty
  classificationConfidence: number | null; // 0-100
};

export type OpportunityResult = {
  opportunity: number; // 0-100 (always)
  confidence: number; // 0-1 (always)
  reasons: string[]; // short bullets
};

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

function sigmoid(z: number) {
  return 1 / (1 + Math.exp(-z));
}

function log1p(n: number) {
  return Math.log(1 + Math.max(0, n));
}

export function scoreOpportunity(input: OpportunityInput): OpportunityResult {
  // --- Evidence & confidence (missing data ≠ negative) ---
  let evidence = 0;
  let possible = 0;

  const have = (v: unknown) => v !== null && v !== undefined;

  // rating + reviews are optional; website/social often present; fitScore/risk always present
  const evidenceWeights = {
    rating: 0.15,
    reviews: 0.2,
    website: 0.15,
    social: 0.1,
    classConf: 0.1,
    fit: 0.15,
    risk: 0.15,
  };

  possible =
    evidenceWeights.rating +
    evidenceWeights.reviews +
    evidenceWeights.website +
    evidenceWeights.social +
    evidenceWeights.classConf +
    evidenceWeights.fit +
    evidenceWeights.risk;

  evidence += have(input.rating) ? evidenceWeights.rating : 0;
  evidence += have(input.reviewCount) ? evidenceWeights.reviews : 0;
  evidence += evidenceWeights.website; // always known (boolean)
  evidence += have(input.socialPresence) ? evidenceWeights.social : 0;
  evidence += have(input.classificationConfidence)
    ? evidenceWeights.classConf
    : 0;
  evidence += evidenceWeights.fit; // always known
  evidence += evidenceWeights.risk; // always known

  const confidence = clamp((evidence / possible) * 100, 0, 100) / 100;

  // --- Feature engineering (normalize to roughly -1..+1 where possible) ---
  const fit = clamp(input.fitScore) / 100; // 0..1

  // risk should penalize close-probability
  const riskPenalty = clamp(input.risk) / 100; // 0..1

  // reviews: use log so 10->50 isn’t treated the same as 500->540
  const reviews = input.reviewCount ?? null;
  const reviewsNorm =
    reviews === null ? 0 : clamp(log1p(reviews) / log1p(500), 0, 1); // 0..1, saturates ~500

  // rating: don’t over-trust; center around ~4.2 in many categories
  const rating = input.rating ?? null;
  const ratingNorm = rating === null ? 0 : clamp((rating - 4.2) / 1.0, -1, 1); // -1..+1

  const website = input.hasWebsite ? 1 : 0;

  const social =
    input.socialPresence === "high"
      ? 1
      : input.socialPresence === "medium"
        ? 0.4
        : input.socialPresence === "low"
          ? 0.1
          : 0.25; // unknown defaults mildly positive (don’t punish unknown)

  const classConf = clamp(input.classificationConfidence ?? 50) / 100; // default 0.5

  // gap: this is SELLABILITY. big gap = easier sell (if not too risky)
  const gapBoost =
    input.gap === "INFRASTRUCTURE"
      ? 0.9
      : input.gap === "CONVERSION"
        ? 0.75
        : input.gap === "VISIBILITY"
          ? 0.6
          : 0.35; // OPTIMIZATION is harder to sell unless they’re mature

  // riskProfile: subtle shaping, not absolute truth
  const profileAdj =
    input.riskProfile === "unstable_business"
      ? -0.25
      : input.riskProfile === "mature_competitor"
        ? 0.1
        : 0;

  // --- Close probability model (logistic) ---
  // Strong opinion: start with a logistic model now, because later you can fit weights from outcomes.
  // This is the bridge between heuristic v1 and learned v2.
  const z =
    -0.4 + // base rate (closing isn’t default)
    1.6 * fit + // fit matters a lot
    1.1 * gapBoost + // sellable problem matters
    0.35 * website + // website slightly helps (trust), but not huge
    0.4 * social + // presence helps
    0.55 * reviewsNorm + // proof helps
    0.3 * ratingNorm + // rating helps a bit
    0.3 * classConf + // certainty helps
    profileAdj - // riskProfile modifier
    1.4 * riskPenalty; // risk strongly hurts close-probability

  const opportunity = clamp(Math.round(sigmoid(z) * 100), 0, 100);

  // --- Reasons (keep short + believable) ---
  const reasons: string[] = [];

  const riskProfileLabel = (
    input.riskProfile ?? "unstable_business"
  ).replaceAll("_", " ");

  reasons.push(`Gap: ${input.gap.toLowerCase()} (sellable issue)`);
  reasons.push(`Fit: ${Math.round(fit * 100)}/100`);
  reasons.push(
    `Risk: ${Math.round(riskPenalty * 100)}/100 (${riskProfileLabel})`,
  );

  if (input.hasWebsite) reasons.push("Website present (trust)");
  else reasons.push("No website (clear infrastructure gap)");

  if (reviews !== null) reasons.push(`Reviews: ${reviews} (proof)`);
  else reasons.push("Reviews unknown (lower certainty)");

  if (rating !== null) reasons.push(`Rating: ${rating.toFixed(1)}`);
  else reasons.push("Rating unknown (lower certainty)");

  return { opportunity, confidence, reasons };
}
