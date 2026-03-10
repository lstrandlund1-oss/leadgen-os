// lib/runLeads/enrichLeadForUI.ts
//
// Transforms a HydratedLeadSummary + raw lead data into the shape the
// dashboard UI expects (LeadUI-compatible output). Also generates the
// business diagnosis line displayed in the Overview tab.

import type { HydratedLeadSummary } from "./hydrateLead";

export interface UIEnrichmentResult {
  /** Score values ready to merge into lead.score */
  scoreOverride: {
    value: number;
    opportunity: number;
    readiness: number;
    risk: number;
  };

  /** Fit block ready for lead.fit */
  fitBlock: {
    fitScore: number;
    matchedNeeds: string[];
    missingNeeds: string[];
    geoMatch: "exact" | "partial" | "none" | "unset" | undefined;
    reasons: string[];
  };

  /** Plain-English diagnosis for the Overview tab */
  diagnosisSummary: string;

  /** Category scores for the Signals tab bars */
  categoryScores: {
    reputation: number;
    digitalPresence: number;
    businessStrength: number;
    opportunityGap: number;
    stabilityRisk: number;
    evidenceConfidence: number;
  };
}

export function enrichLeadForUI(hydrated: HydratedLeadSummary): UIEnrichmentResult {
  const { reputation, digital, business, fit } = hydrated;
  const cs = business.categoryScores;

  // Reconstruct score from category scores (mirrors universalScore.ts logic)
  const readiness = Math.round(
    cs.businessStrength * 0.6 + cs.digitalPresence * 0.2 + cs.evidenceConfidence * 0.2,
  );
  const risk = Math.min(100, Math.round(cs.stabilityRisk * 0.75 + (100 - cs.evidenceConfidence) * 0.15));
  let opportunity = Math.round(cs.opportunityGap * 0.45 + cs.reputation * 0.1 + cs.evidenceConfidence * 0.1);
  opportunity = Math.max(0, Math.min(100, opportunity));
  const value = Math.max(0, Math.min(100, Math.round(opportunity * 0.5 + readiness * 0.3 - risk * 0.2)));

  return {
    scoreOverride: { value, opportunity, readiness, risk },
    fitBlock: {
      fitScore: fit.fitScore,
      matchedNeeds: fit.matchedNeeds,
      missingNeeds: fit.missingNeeds,
      geoMatch: fit.geoMatch,
      reasons: fit.reasons,
    },
    diagnosisSummary: business.diagnosis.summaryLine,
    categoryScores: {
      reputation: cs.reputation,
      digitalPresence: cs.digitalPresence,
      businessStrength: cs.businessStrength,
      opportunityGap: cs.opportunityGap,
      stabilityRisk: cs.stabilityRisk,
      evidenceConfidence: cs.evidenceConfidence,
    },
  };
}