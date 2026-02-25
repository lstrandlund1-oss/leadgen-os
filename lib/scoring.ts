import type { RawCompany, Classification } from "@/lib/types";

export type RiskProfile = "mature_competitor" | "unstable_business" | null;

export type ScoreResult = {
  score: number; // Composite (sorting)
  opportunity: number; // Upside potential (0–100)
  readiness: number; // Operational viability (0–100)
  risk: number; // Difficulty / displacement friction (0–100)
  riskProfile: RiskProfile;
};

type RawCompanyExtras = {
  socialPresence?: "low" | "medium" | "high";
};

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n));
}

function round(n: number): number {
  return Math.round(n);
}

function safeNum(n: unknown): number | null {
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

function normalizeSocialPresence(
  raw: RawCompany & RawCompanyExtras,
): "low" | "medium" | "high" {
  if (
    raw.socialPresence === "low" ||
    raw.socialPresence === "medium" ||
    raw.socialPresence === "high"
  ) {
    return raw.socialPresence;
  }

  const rc = safeNum(raw.review_count) ?? 0;
  const rating = safeNum(raw.rating) ?? 0;
  const hasWebsite = !!(raw.website && raw.website.trim().length > 0);

  let points = 0;

  if (hasWebsite) points += 1;
  if (rc >= 200) points += 3;
  else if (rc >= 50) points += 2;
  else if (rc >= 10) points += 1;

  if (rating >= 4.6) points += 2;
  else if (rating >= 4.2) points += 1;

  if (points >= 5) return "high";
  if (points >= 3) return "medium";
  return "low";
}

/**
 * Readiness = ability to execute & pay.
 */
function readinessFromSignals(input: {
  hasWebsite: boolean;
  rating: number;
  reviews: number;
  socialPresence: "low" | "medium" | "high";
}): number {
  let r = 0;

  if (input.hasWebsite) r += 12;

  if (input.rating >= 4.7) r += 18;
  else if (input.rating >= 4.4) r += 14;
  else if (input.rating >= 4.0) r += 8;
  else if (input.rating >= 3.6) r += 4;

  if (input.reviews >= 250) r += 22;
  else if (input.reviews >= 100) r += 16;
  else if (input.reviews >= 25) r += 10;
  else if (input.reviews >= 10) r += 6;
  else if (input.reviews >= 3) r += 3;

  if (input.socialPresence === "high") r += 10;
  else if (input.socialPresence === "medium") r += 6;
  else r += 2;

  return clamp(round(r));
}

/**
 * Opportunity = upside from gap.
 */
function opportunityFromSignals(input: {
  hasWebsite: boolean;
  rating: number;
  reviews: number;
  socialPresence: "low" | "medium" | "high";
}): number {
  let o = 0;

  if (input.socialPresence === "low") o += 26;
  else if (input.socialPresence === "medium") o += 14;
  else o += 4;

  if (!input.hasWebsite) o += 26;
  else o += 6;

  const proof =
    (input.reviews >= 200
      ? 20
      : input.reviews >= 100
        ? 14
        : input.reviews >= 30
          ? 8
          : input.reviews >= 10
            ? 4
            : 0) +
    (input.rating >= 4.6
      ? 10
      : input.rating >= 4.3
        ? 7
        : input.rating >= 4.0
          ? 4
          : 0);

  if (!input.hasWebsite || input.socialPresence === "low") {
    o += proof;
  } else {
    o += Math.round(proof * 0.35);
  }

  return clamp(round(o));
}

function isOperationallyUnstable(input: {
  hasWebsite: boolean;
  rating: number;
  reviews: number;
}): boolean {
  if (!input.hasWebsite && input.reviews < 10) return true;
  if (input.reviews < 3 && input.rating < 4.0) return true;
  if (input.rating > 0 && input.rating < 3.6 && input.reviews < 25) return true;
  return false;
}

function isMatureHardTarget(input: {
  hasWebsite: boolean;
  socialPresence: "low" | "medium" | "high";
  rating: number;
  reviews: number;
}): boolean {
  return (
    input.hasWebsite &&
    input.socialPresence === "high" &&
    input.reviews >= 150 &&
    input.rating >= 4.3
  );
}

export function scoreLead(raw: RawCompany, c: Classification): ScoreResult {
  const extras = raw as RawCompany & RawCompanyExtras;

  const rating = safeNum(raw.rating) ?? 0;
  const reviews = safeNum(raw.review_count) ?? 0;
  const hasWebsite = !!(raw.website && raw.website.trim().length > 0);
  const socialPresence = normalizeSocialPresence(extras);

  const readiness = readinessFromSignals({
    hasWebsite,
    rating,
    reviews,
    socialPresence,
  });

  const opportunity = opportunityFromSignals({
    hasWebsite,
    rating,
    reviews,
    socialPresence,
  });

  // ==========================
  // GOOGLE REPUTATION DELTAS
  // ==========================

  let opportunityAdjusted = opportunity;
  let riskAdjusted = 0;

  const strongReputation = rating >= 4.3 && reviews >= 80;
  const veryStrongReputation = rating >= 4.4 && reviews >= 150;
  const weakReputation = reviews < 15;

  const conversionGap = strongReputation && !hasWebsite;
  const matureCompetitor = veryStrongReputation && hasWebsite;
  const visibilityGap = hasWebsite && weakReputation;
  const foundationGap = !hasWebsite && weakReputation;

  // 1) Strong proof but no website -> very strong opportunity
  if (conversionGap) {
    opportunityAdjusted += 18;
    riskAdjusted += 6;
  }

  // 2) Very mature competitor -> lower opportunity, higher risk
  if (matureCompetitor) {
    opportunityAdjusted -= 14;
    riskAdjusted += 14;
  }

  // 3) Website but low reviews -> visibility opportunity
  if (visibilityGap) {
    opportunityAdjusted += 10;
    riskAdjusted -= 4;
  }

  // 4) Low reviews + no website -> foundational gap
  if (foundationGap) {
    opportunityAdjusted += 12;
    riskAdjusted += 10;
  }

  // Clamp opportunity to 0–100
  opportunityAdjusted = Math.max(0, Math.min(100, opportunityAdjusted));

  const unstable = isOperationallyUnstable({
    hasWebsite,
    rating,
    reviews,
  });

  const mature = isMatureHardTarget({
    hasWebsite,
    socialPresence,
    rating,
    reviews,
  });

  let riskProfile: RiskProfile = null;
  let risk = 0;

  risk += riskAdjusted;
  risk = Math.max(0, Math.min(100, risk));

  if (unstable) {
    riskProfile = "unstable_business";
    risk = 85;
  } else if (mature) {
    riskProfile = "mature_competitor";
    risk = 75;
  } else {
    // baseline risk derived from maturity
    risk = clamp(100 - readiness * 0.7);
  }

  // Fit boosts composite only slightly
  const fitBoost = c.isGoodFit ? 8 : 0;
  const confBoost = clamp(round((c.confidence ?? 0) * 0.1), 0, 10);

  const score = clamp(
    round(
      opportunity * 0.55 + readiness * 0.35 - risk * 0.2 + fitBoost + confBoost,
    ),
  );

  return {
    score,
    opportunity: opportunityAdjusted,
    readiness,
    risk: clamp(round(risk)),
    riskProfile,
  };
}
