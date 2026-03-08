import { buildSignal } from "@/lib/signals/evidence";
import type { Signal } from "@/lib/signals/signalTypes";

export interface GoogleSignalInput {
  reviewCount: number | null;
  rating: number | null;
  // Google Places API returns these when available
  userRatingsTotal?: number | null;
  ownerResponseCount?: number | null;
}

export interface GoogleSignalResult {
  signals: Signal[];
}

export function extractLightGoogleSignals(
  input: GoogleSignalInput,
): GoogleSignalResult {
  const reviewCount = input.reviewCount ?? 0;
  const rating = input.rating ?? 0;

  // --- Owner Response Presence ---
  // If Google explicitly tells us, use it. Otherwise infer from rating+reviews.
  // A business with high rating AND many reviews almost certainly responds.
  let ownerResponds: boolean;
  let ownerConfidence: number;

  if (typeof input.ownerResponseCount === "number") {
    ownerResponds = input.ownerResponseCount > 0;
    ownerConfidence = 90;
  } else {
    // Inference: high rating + decent review volume = likely engaged owner
    ownerResponds = rating >= 4.3 && reviewCount >= 15;
    ownerConfidence = 55;
  }

  // --- Review Velocity Estimate ---
  // We don't have timestamps, so we bucket by volume as a proxy.
  // Logic: more reviews = faster accumulation = more active/established business.
  let velocityScore: number;
  let velocityConfidence: number;

  if (reviewCount >= 200) {
    velocityScore = 90;
    velocityConfidence = 80;
  } else if (reviewCount >= 75) {
    velocityScore = 70;
    velocityConfidence = 75;
  } else if (reviewCount >= 25) {
    velocityScore = 45;
    velocityConfidence = 65;
  } else if (reviewCount >= 5) {
    velocityScore = 20;
    velocityConfidence = 55;
  } else {
    velocityScore = 5;
    velocityConfidence = 50;
  }

  return {
    signals: [
      buildSignal({
        key: "owner_response_presence",
        value: ownerResponds,
        confidence: ownerConfidence,
      }),
      buildSignal({
        key: "review_velocity_estimate",
        value: velocityScore,
        confidence: velocityConfidence,
      }),
    ],
  };
}