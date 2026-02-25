// lib/scoring/opportunitySignals.ts

/**
 * Legacy shape (kept for backward compatibility)
 */
export type OpportunityType =
  | "conversion_gap"
  | "mature_competitor"
  | "visibility_gap"
  | "foundation_gap"
  | "growth_opportunity"
  | "moderate_opportunity"
  | string; // fallback for legacy values

export type OpportunitySignal = {
  type: OpportunityType;
  message: string;
  strength: "high" | "medium" | "low";
};

/**
 * v1 Work Types (derived directly from your existing signal logic)
 * These represent monetizable "problems/gaps" that a service provider can solve.
 */
export type WorkType =
  | "conversion_gap_no_website"
  | "content_gap_low_social"
  | "underexposed_quality"
  | "trust_gap_no_website"
  | "untapped_attention"
  | "conversion_gap"
  | "scaling_ready";

/**
 * Resistance/Risk types (also derived directly from existing logic)
 * These represent friction or risk (not opportunity).
 */
export type ResistanceType =
  | "mature_hard_target"
  | "basics_missing"
  | "unstable_basics_missing"
  | "trust_gap"
  | "reputation_risk";

export type SignalStrength = "high" | "medium" | "low";

export type WorkTypeSignal = {
  kind: "workType";
  code: WorkType;
  message: string;
  strength: SignalStrength;
};

export type ResistanceSignal = {
  kind: "resistance";
  code: ResistanceType;
  message: string;
  strength: SignalStrength;
};

export type SignalV2 = WorkTypeSignal | ResistanceSignal;

export type DetectSignalsInput = {
  rating: number;
  reviews: number;
  hasWebsite: boolean;
  socialPresence: "low" | "medium" | "high";
  categories?: string[]; // currently unused; reserved for future vertical logic
};

const strengthPriority = { high: 3, medium: 2, low: 1 } as const;

function strongest<T extends { strength: SignalStrength }>(items: T[]): T | null {
  if (!items || items.length === 0) return null;
  return items
    .slice()
    .sort((a, b) => strengthPriority[b.strength] - strengthPriority[a.strength])[0];
}

/**
 * NEW: structured detection.
 * - workTypes: monetizable gaps (feeds ServiceMatchScore later)
 * - resistances: friction/risk (feeds Feasibility/Difficulty later)
 * - all: combined list (useful for debugging/logging/UI if needed)
 */
export function detectSignalsV2(input: DetectSignalsInput): {
  workTypes: WorkTypeSignal[];
  resistances: ResistanceSignal[];
  all: SignalV2[];
} {
  const rating = input.rating ?? 0;
  const reviews = input.reviews ?? 0;
  const hasWebsite = !!input.hasWebsite;
  const socialPresence = input.socialPresence;

  const workTypes: WorkTypeSignal[] = [];
  const resistances: ResistanceSignal[] = [];

  // --- RESISTANCE / RISK (not opportunity) ---

  // 1) Mature hard target (already solved / harder to win)
  if (hasWebsite && socialPresence === "high" && reviews >= 150 && rating >= 4.3) {
    resistances.push({
      kind: "resistance",
      code: "mature_hard_target",
      message: "Strong presence + strong proof — likely already well-served (harder to win)",
      strength: "high",
    });
  }

  // 2) Unstable / risky prospect (needs basics before growth)
  if (!hasWebsite && reviews < 10) {
    resistances.push({
      kind: "resistance",
      code: "basics_missing",
      message: "Missing basics (no website + low proof) — higher risk to convert",
      strength: "high",
    });
  } else if (rating > 0 && rating < 3.6 && reviews < 25) {
    resistances.push({
      kind: "resistance",
      code: "reputation_risk",
      message: "Weak proof signals — may need fundamentals before scaling",
      strength: "medium",
    });
  }

  // --- WORK TYPES (monetizable gaps / opportunity) ---

  // 3) Conversion gap: strong proof but missing website
  if (rating >= 4.3 && reviews > 50 && !hasWebsite) {
    workTypes.push({
      kind: "workType",
      code: "conversion_gap_no_website",
      message: "Strong reputation but no website — major conversion upside",
      strength: "high",
    });
  }

  // 4) Demand exists but weak social (content gap)
  if (reviews > 100 && socialPresence === "low") {
    workTypes.push({
      kind: "workType",
      code: "content_gap_low_social",
      message: "High demand but weak social presence — clear content gap",
      strength: "high",
    });
  }

  // 5) Underexposed quality (good rating, low reviews)
  if (rating >= 4.5 && reviews < 20) {
    workTypes.push({
      kind: "workType",
      code: "underexposed_quality",
      message: "High quality but low visibility — growth opportunity",
      strength: "medium",
    });
  }

  // 6) Trust / conversion friction baseline from no website
  if (!hasWebsite) {
    workTypes.push({
      kind: "workType",
      code: "trust_gap_no_website",
      message: "No website — trust + conversion friction",
      strength: reviews >= 30 || rating >= 4.3 ? "high" : "medium",
    });
  }

  // 7) Scaling-ready middle (stable but not expanding)
  if (reviews >= 30 && reviews < 120 && (socialPresence === "medium" || socialPresence === "low")) {
    workTypes.push({
      kind: "workType",
      code: "scaling_ready",
      message: "Stable base but not scaling — ready for a growth system",
      strength: "medium",
    });
  }

  const all: SignalV2[] = [...resistances, ...workTypes];
  return { workTypes, resistances, all };
}

/**
 * LEGACY: keep old function signature and return shape.
 * This prevents breaking existing API routes / scoring.ts callers.
 *
 * Note:
 * - We map WorkTypes + Resistances back into legacy `OpportunitySignal` items.
 * - We preserve the legacy `type` strings for compatibility.
 */
export function detectOpportunitySignals(input: DetectSignalsInput): OpportunitySignal[] {
  const { all } = detectSignalsV2(input);
  return all.map((s) => ({
    type: s.code, // keeps old behavior of string identifiers
    message: s.message,
    strength: s.strength,
  }));
}

/**
 * NEW: primary "opportunity" insight (work type).
 * This should drive the "Insight" column / messaging.
 */
export function getPrimaryWorkTypeInsight(workTypes: WorkTypeSignal[]): WorkTypeSignal | null {
  return strongest(workTypes);
}

/**
 * NEW: primary "difficulty/risk" insight (resistance).
 * This should drive Feasibility/Difficulty explanations later.
 */
export function getPrimaryResistanceInsight(resistances: ResistanceSignal[]): ResistanceSignal | null {
  return strongest(resistances);
}

/**
 * UPDATED DEFAULT: primary insight should reflect OPPORTUNITY (work types) by default,
 * not automatically return "mature_hard_target".
 *
 * If you still want the old behavior for a specific UI area, use getPrimaryInsightLegacy().
 */
export function getPrimaryInsight(signals: OpportunitySignal[]): OpportunitySignal | null {
  if (!signals || signals.length === 0) return null;

  // Treat legacy `type` as either a workType or resistance code.
  const workTypeCodes: Set<WorkType> = new Set([
    "conversion_gap_no_website",
    "content_gap_low_social",
    "underexposed_quality",
    "trust_gap_no_website",
    "scaling_ready",
  ]);

  const workTypes = signals.filter((s) => workTypeCodes.has(s.type as WorkType));
  if (workTypes.length > 0) {
    return workTypes
      .slice()
      .sort((a, b) => strengthPriority[b.strength] - strengthPriority[a.strength])[0];
  }

  // fallback: strongest overall if no work types exist
  return signals
    .slice()
    .sort((a, b) => strengthPriority[b.strength] - strengthPriority[a.strength])[0];
}

/**
 * LEGACY BEHAVIOR: preserves the previous “mature_hard_target always wins” logic.
 * Keep this around if you have UI logic that depends on it right now.
 */
export function getPrimaryInsightLegacy(signals: OpportunitySignal[]): OpportunitySignal | null {
  if (!signals || signals.length === 0) return null;

  const mature = signals.find((s) => s.type === "mature_hard_target");
  if (mature) return mature;

  return signals
    .slice()
    .sort((a, b) => strengthPriority[b.strength] - strengthPriority[a.strength])[0];
}