import { describe, it, expect } from "vitest";
import { findStaleLeads } from "./staleLeads";
import type { PipelineOpportunity } from "./getPipelineOverview";

const NOW = new Date("2026-08-15T00:00:00Z");

function opp(overrides: Partial<PipelineOpportunity> = {}): PipelineOpportunity {
  return {
    rawId: 1,
    leadId: "google_places:1",
    runId: 1,
    name: "Test Co",
    city: null,
    stage: "contacted",
    revenue: null,
    opportunityValue: 70,
    stageEnteredAt: NOW.toISOString(),
    ...overrides,
  };
}

function daysBefore(days: number): string {
  const d = new Date(NOW);
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

describe("findStaleLeads", () => {
  it("excludes leads below the staleness threshold", () => {
    const result = findStaleLeads([opp({ stageEnteredAt: daysBefore(3) })], NOW);
    expect(result).toHaveLength(0);
  });

  it("includes leads at or above the threshold", () => {
    const result = findStaleLeads([opp({ stageEnteredAt: daysBefore(7) })], NOW);
    expect(result).toHaveLength(1);
    expect(result[0].daysStale).toBe(7);
  });

  it("excludes won and lost leads even if very old", () => {
    const result = findStaleLeads(
      [opp({ stage: "won", stageEnteredAt: daysBefore(100) }), opp({ stage: "lost", stageEnteredAt: daysBefore(100) })],
      NOW,
    );
    expect(result).toHaveLength(0);
  });

  it("sorts by staleness, most stuck first", () => {
    const result = findStaleLeads(
      [
        opp({ rawId: 1, stageEnteredAt: daysBefore(8) }),
        opp({ rawId: 2, stageEnteredAt: daysBefore(20) }),
        opp({ rawId: 3, stageEnteredAt: daysBefore(10) }),
      ],
      NOW,
    );
    expect(result.map((r) => r.rawId)).toEqual([2, 3, 1]);
  });

  it("includes recommended-stage leads, not just contacted onward", () => {
    const result = findStaleLeads([opp({ stage: "recommended", stageEnteredAt: daysBefore(15) })], NOW);
    expect(result).toHaveLength(1);
  });
});
