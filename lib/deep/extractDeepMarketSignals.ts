// lib/deep/extractDeepMarketSignals.ts
//
// Deterministic local market intelligence.
// Derives competitor density and market saturation from available data
// (Google Places nearby counts, review volume distribution, price tier signals).
// No ML — all rule-based scoring with explicit reasoning.

import { buildSignal } from "@/lib/signals/evidence";
import type { Signal } from "@/lib/signals/signalTypes";

export interface DeepMarketInput {
  // Competitor landscape (from same-category nearby search)
  nearbyCompetitorCount: number;        // businesses in same category within ~2km
  nearbyWithWebsite: number;            // how many have a website
  nearbyHighRated: number;              // competitors with rating >= 4.3
  nearbyHighReviewCount: number;        // competitors with 50+ reviews

  // Price positioning signals
  hasPricingPage: boolean;
  priceKeywords: string[];              // e.g. ["affordable", "luxury", "budget", "premium"]

  // Demand-side signals
  searchVolumeProxy: "low" | "medium" | "high" | null; // inferred from category + location
  hasSeasonalDemand: boolean;
  isEmergencyService: boolean;          // plumber, locksmith, etc. — always-on demand
}

export interface DeepMarketResult {
  signals: Signal[];
  scores: {
    competitorDensity: number;      // 0-100 (higher = more crowded)
    localSaturation: number;        // 0-100 (higher = harder to break in)
    opportunityWindow: number;      // 0-100 (higher = more whitespace)
  };
  competitorSummary: string;
  recommendation: string;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function extractDeepMarketSignals(input: DeepMarketInput): DeepMarketResult {
  const total = input.nearbyCompetitorCount;

  // Competitor density: how many rivals are present
  let density = 0;
  if (total >= 30) density = 90;
  else if (total >= 20) density = 75;
  else if (total >= 10) density = 55;
  else if (total >= 5) density = 35;
  else density = 15;
  const competitorDensity = clamp(density);

  // Saturation: density + quality of competition
  const qualityRatio = total > 0
    ? (input.nearbyHighRated + input.nearbyHighReviewCount / 2) / total
    : 0;
  const saturation = clamp(competitorDensity * 0.6 + qualityRatio * 100 * 0.4);
  const localSaturation = saturation;

  // Opportunity window: whitespace in the market
  // High density + low quality = opportunity (weak competition)
  // Low density = wide open market
  const weakCompetitorRatio = total > 0
    ? 1 - (input.nearbyWithWebsite / total)
    : 0.8;

  let opportunity = 100 - saturation * 0.5 + weakCompetitorRatio * 30;
  if (input.searchVolumeProxy === "high") opportunity += 15;
  if (input.searchVolumeProxy === "low") opportunity -= 15;
  if (input.isEmergencyService) opportunity += 10; // always demand
  if (input.hasSeasonalDemand) opportunity -= 5;   // timing risk
  const opportunityWindow = clamp(opportunity);

  const signals: Signal[] = [
    buildSignal({
      key: "competitor_density",
      value: competitorDensity,
      confidence: total > 0 ? 80 : 40,
      depth: "deep",
      present: competitorDensity < 50,
      description:
        competitorDensity >= 75
          ? `Highly competitive area: ${total} nearby businesses in same category.`
          : competitorDensity >= 45
          ? `Moderate competition: ${total} competitors detected locally.`
          : `Low competition: only ${total} nearby rivals — whitespace opportunity.`,
    }),
    buildSignal({
      key: "local_market_saturation",
      value: localSaturation,
      confidence: total > 0 ? 75 : 40,
      depth: "deep",
      present: localSaturation < 50,
      description:
        localSaturation >= 70
          ? `Market is saturated. ${input.nearbyHighRated} high-rated competitors dominate.`
          : localSaturation >= 45
          ? "Market has established players but room for differentiated positioning."
          : "Market is under-served. Limited strong competition — high conversion potential.",
    }),
  ];

  // Generate human-readable competitor summary
  const competitorSummary =
    total === 0
      ? "No nearby competitors detected — rare whitespace opportunity."
      : `${total} nearby competitors. ${input.nearbyWithWebsite} have websites, ${input.nearbyHighRated} are highly rated.`;

  // Recommendation based on market position
  const recommendation =
    localSaturation >= 70
      ? "Saturated market. Lead with differentiation — niche down or emphasise speed/trust over peers."
      : localSaturation >= 45
      ? "Competitive but winnable. Outrank the weakest players first; position against the weakest websites."
      : "Open market. Aggressive outreach justified — establish presence before competitors catch up.";

  return {
    signals,
    scores: { competitorDensity, localSaturation, opportunityWindow },
    competitorSummary,
    recommendation,
  };
}