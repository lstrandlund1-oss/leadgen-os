// lib/pipeline/staleLeads.ts
//
// "Needs attention" — leads sitting in an active stage (recommended,
// contacted, replied, meeting) longer than the threshold without
// progressing. Closed stages (won/lost) are excluded — nothing to act on
// there. Pure function, separate from data-fetching, so the threshold
// logic itself is directly testable.

import type { PipelineOpportunity, PipelineStage } from "./getPipelineOverview";

// A week without progress is a reasonable, if not rigorously derived,
// point at which a lead is worth surfacing rather than letting it sit
// silently. Same "deliberately simple, documented starting point" spirit
// as the priority-score weights — worth recalibrating once real usage
// patterns exist.
export const STALE_THRESHOLD_DAYS = 7;

const ACTIVE_STAGES: PipelineStage[] = ["recommended", "contacted", "replied", "meeting"];

export type StaleLead = PipelineOpportunity & { daysStale: number };

export function findStaleLeads(opportunities: PipelineOpportunity[], now: Date = new Date()): StaleLead[] {
  return opportunities
    .filter((o) => ACTIVE_STAGES.includes(o.stage))
    .map((o) => {
      const days = Math.floor((now.getTime() - new Date(o.stageEnteredAt).getTime()) / (1000 * 60 * 60 * 24));
      return { ...o, daysStale: days };
    })
    .filter((o) => o.daysStale >= STALE_THRESHOLD_DAYS)
    .sort((a, b) => b.daysStale - a.daysStale);
}
