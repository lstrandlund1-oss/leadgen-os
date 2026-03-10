// lib/base/extractBaseDigitalSignals.ts
//
// Base-depth digital presence signals. Derived from provider-level data:
// whether a website URL exists, and social presence classification.
// No fetching — these are facts from the source record.

import { buildSignal } from "@/lib/signals/evidence";
import type { Signal } from "@/lib/signals/signalTypes";
import { getDigitalPresenceScore } from "@/lib/scoring/categoryScores";

export interface BaseDigitalInput {
  website: string | null;
  socialPresence: "low" | "medium" | "high" | null;
}

export interface BaseDigitalResult {
  signals: Signal[];
  digitalPresenceScore: number; // 0-100
  hasWebsite: boolean;
}

export function extractBaseDigitalSignals(
  input: BaseDigitalInput,
): BaseDigitalResult {
  const hasWebsite = !!(input.website && input.website.trim().length > 0);
  const socialPresence = input.socialPresence ?? "low";

  const digitalPresenceScore = getDigitalPresenceScore({
    hasWebsite,
    socialPresence,
  });

  const signals: Signal[] = [
    buildSignal({
      key: "website_exists",
      value: hasWebsite,
      confidence: 95,
      depth: "base",
      present: hasWebsite,
      description: hasWebsite
        ? "Website URL present. Digital footprint confirmed."
        : "No website detected. Significant conversion infrastructure gap.",
    }),
    buildSignal({
      key: "social_presence",
      value: socialPresence,
      confidence: 70,
      depth: "base",
      present: socialPresence !== "low",
      description:
        socialPresence === "high"
          ? "High social presence. Active on multiple platforms."
          : socialPresence === "medium"
          ? "Medium social presence. Some platform activity detected."
          : "Low or no social presence. Organic reach gap confirmed.",
    }),
  ];

  return { signals, digitalPresenceScore, hasWebsite };
}