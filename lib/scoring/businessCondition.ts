// lib/scoring/businessCondition.ts
//
// Signal-based business profile classifier.
// Runs in two passes:
//   Pass 1 — search-time: uses review count, rating, website, categories
//   Pass 2 — post-enrichment: can upgrade to solo_run if owner signals present
//
// Priority order: first match wins.
// Tooltip text lives in lib/types.ts — BUSINESS_PROFILE_TOOLTIPS.

import type { RiskProfile } from "@/lib/types";

export type ClassifyInput = {
  // Always available from Google Places
  reviews: number;
  rating: number; // 0 if no rating
  hasWebsite: boolean;
  categories: string[]; // Google Places types array
  businessName?: string;

  // Available after light enrichment (optional)
  ownerResponds?: boolean; // inferred from rating+reviews if not directly known
  socialPlatformCount?: number;
  socialPresence?: "low" | "medium" | "high";

  // Available after scoring pass (optional)
  opportunityGap?: number; // 0-100, used for local_authority detection
};

// Chain/franchise name patterns — conservative list, only clear cases
const CHAIN_NAME_PATTERNS = [
  /mcdonald/i,
  /burger king/i,
  /subway/i,
  /starbucks/i,
  /ikea/i,
  /h&m/i,
  /zara/i,
  /systembolaget/i,
  /ica\s/i,
  /coop\s/i,
  /lidl/i,
  /pressbyrån/i,
  /7-eleven/i,
  /circle k/i,
  /shell\s/i,
];

function isLikelyChain(name: string, categories: string[]): boolean {
  if (CHAIN_NAME_PATTERNS.some((p) => p.test(name))) return true;
  // Google categories that indicate chains
  const chainCategories = ["department_store", "supermarket", "grocery_store", "convenience_store"];
  return categories.some((c) => chainCategories.includes(c.toLowerCase()));
}

export function classifyBusinessProfile(input: ClassifyInput): RiskProfile {
  const { reviews, rating, hasWebsite, categories, businessName = "" } = input;
  const opportunityGap = input.opportunityGap ?? 50;
  const socialPlatformCount = input.socialPlatformCount ?? 0;
  const socialPresence = input.socialPresence ?? "low";

  // ── Priority 1: Limited data ──────────────────────────────────────────────
  // Genuinely not enough to work with. Under 5 reviews AND no website.
  if (reviews < 5 && !hasWebsite) {
    return "limited_data";
  }

  // ── Priority 2: Early stage ───────────────────────────────────────────────
  // Low proof AND poor or missing rating. Website presence does NOT matter here.
  // A business with no website but 40 reviews at 4.6★ is NOT early stage.
  if (reviews < 15 && (rating < 4.0 || rating === 0)) {
    return "early_stage";
  }

  // ── Priority 3: Multi-location / chain ────────────────────────────────────
  // Conservative — only trigger on clear chain signals
  if (isLikelyChain(businessName, categories)) {
    return "independent_business"; // treated as independent for scoring, flagged separately
  }

  // ── Priority 4: Well-established ─────────────────────────────────────────
  // Strong across the board — high reviews, good rating, website, active social
  if (
    reviews >= 100 &&
    rating >= 4.2 &&
    hasWebsite &&
    (socialPresence === "medium" || socialPresence === "high" || socialPlatformCount >= 1)
  ) {
    return "well_established";
  }

  // ── Priority 5: Local authority ───────────────────────────────────────────
  // Highly rated with strong reputation, but smaller opportunity gap
  // (they're well-served — need a targeted angle, not a full pitch)
  if (reviews >= 50 && rating >= 4.5 && hasWebsite && opportunityGap <= 25) {
    return "local_authority";
  }

  // ── Priority 6: Growing business ─────────────────────────────────────────
  // Has proven demand and website, but digital presence gaps remain.
  // The sweet spot — established enough for budget, still has gaps.
  if (
    reviews >= 20 &&
    reviews <= 150 &&
    rating >= 4.0 &&
    hasWebsite &&
    (socialPresence === "low" || socialPresence === "medium")
  ) {
    return "growing_business";
  }

  // ── Priority 7: Solo-run (post-enrichment only) ───────────────────────────
  // Owner-operated signals — only reliable after enrichment
  if (input.ownerResponds === true && reviews >= 8 && reviews <= 60 && rating >= 4.0) {
    return "solo_run";
  }

  // ── Priority 8: Independent business (default) ───────────────────────────
  // Catches everything else — including established-offline businesses
  // (strong reviews + good rating but no/weak digital = opportunity, not weakness)
  return "independent_business";
}

// Returns the data confidence level for the list indicator
export function getDataLevel(reviews: number, hasWebsite: boolean): "strong" | "moderate" | "thin" {
  if (reviews >= 50 && hasWebsite) return "strong";
  if (reviews >= 8 || hasWebsite) return "moderate";
  return "thin";
}
