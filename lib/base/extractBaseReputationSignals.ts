// lib/base/extractBaseReputationSignals.ts
//
// Wraps the deterministic reputation scoring logic from categoryScores.ts
// into Signal objects. "Base" depth — derived purely from provider data
// (rating + review count from Google Places / mock).

import { buildSignal } from "@/lib/signals/evidence";
import type { Signal } from "@/lib/signals/signalTypes";
import { getReputationScore } from "@/lib/scoring/categoryScores";

export interface BaseReputationInput {
  rating: number | null;
  reviewCount: number | null;
}

export interface BaseReputationResult {
  signals: Signal[];
  reputationScore: number; // 0-100
}

export function extractBaseReputationSignals(
  input: BaseReputationInput,
): BaseReputationResult {
  const rating = input.rating ?? 0;
  const reviews = input.reviewCount ?? 0;

  const reputationScore = getReputationScore({ rating, reviews });

  const signals: Signal[] = [
    buildSignal({
      key: "rating",
      value: rating,
      confidence: reviews >= 20 ? 90 : reviews >= 5 ? 70 : 45,
      depth: "base",
      present: rating > 0,
      description:
        rating >= 4.6
          ? `Excellent rating (${rating}). Strong social proof.`
          : rating >= 4.0
          ? `Good rating (${rating}). Acceptable trust signal.`
          : rating >= 3.5
          ? `Below-average rating (${rating}). Possible reputation gap.`
          : rating > 0
          ? `Poor rating (${rating}). High conversion resistance likely.`
          : "No rating data available.",
    }),
    buildSignal({
      key: "review_count",
      value: reviews,
      confidence: 95,
      depth: "base",
      present: reviews > 0,
      description:
        reviews >= 100
          ? `${reviews} reviews. Established volume — high evidence confidence.`
          : reviews >= 25
          ? `${reviews} reviews. Sufficient signal to score reliably.`
          : reviews >= 5
          ? `${reviews} reviews. Thin evidence — scores treated with caution.`
          : reviews > 0
          ? `Only ${reviews} review(s). Very low confidence in rating signal.`
          : "No reviews. Business may be new or unindexed.",
    }),
  ];

  return { signals, reputationScore };
}