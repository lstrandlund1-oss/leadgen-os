// lib/stats/lostReasons.ts
//
// "Why deals are being lost" — ported from the old Analytics page
// (app/profile/AnalyticsPage.tsx), which is being merged into Stats.
// Reuses the same lost_reason categories already written by the
// outcomes route, just computed as a pure, testable function here
// instead of inline in a component.

export type LostReason =
  | "no_response"
  | "not_interested"
  | "has_provider"
  | "wrong_timing"
  | "price_too_high"
  | "chose_competitor"
  | "other";

export type LostReasonBreakdown = {
  reason: LostReason;
  count: number;
  percentOfLost: number;
};

const ALL_REASONS: LostReason[] = [
  "no_response",
  "not_interested",
  "has_provider",
  "wrong_timing",
  "price_too_high",
  "chose_competitor",
  "other",
];

export function computeLostReasonBreakdown(lostReasons: (string | null)[]): LostReasonBreakdown[] {
  const validReasons = lostReasons.filter((r): r is LostReason => !!r && ALL_REASONS.includes(r as LostReason));
  const total = validReasons.length;
  if (total === 0) return [];

  return ALL_REASONS.map((reason) => {
    const count = validReasons.filter((r) => r === reason).length;
    return { reason, count, percentOfLost: Math.round((count / total) * 100) };
  })
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count);
}
