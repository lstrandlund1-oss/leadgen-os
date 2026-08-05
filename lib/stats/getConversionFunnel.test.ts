import { describe, it, expect } from "vitest";
import { computeConversionFunnel } from "./getConversionFunnel";
import type { PipelineOverview, PipelineOpportunity } from "@/lib/pipeline/getPipelineOverview";

function opp(overrides: Partial<PipelineOpportunity> = {}): PipelineOpportunity {
  return {
    rawId: 1,
    leadId: "google_places:1",
    runId: 1,
    name: "Test Co",
    city: null,
    stage: "recommended",
    revenue: null,
    opportunityValue: 70,
    stageEnteredAt: new Date().toISOString(),
    ...overrides,
  };
}

function overviewWith(counts: {
  recommended?: number;
  contacted?: number;
  replied?: number;
  meeting?: number;
  won?: number;
  lost?: number;
}): PipelineOverview {
  const make = (n: number, stage: PipelineOpportunity["stage"]) =>
    Array.from({ length: n }, (_, i) => opp({ rawId: i, stage }));
  return {
    stages: {
      recommended: make(counts.recommended ?? 0, "recommended"),
      contacted: make(counts.contacted ?? 0, "contacted"),
      replied: make(counts.replied ?? 0, "replied"),
      meeting: make(counts.meeting ?? 0, "meeting"),
      won: make(counts.won ?? 0, "won"),
      lost: make(counts.lost ?? 0, "lost"),
    },
    totalActiveCount: 0,
    totalWonRevenue: 0,
  };
}

describe("computeConversionFunnel", () => {
  it("all-zero pipeline yields null rates, not 0%", () => {
    const funnel = computeConversionFunnel(overviewWith({}));
    expect(funnel.contactToReplyRate).toBeNull();
    expect(funnel.replyToMeetingRate).toBeNull();
    expect(funnel.meetingToWonRate).toBeNull();
    expect(funnel.recommendedToContactRate).toBeNull();
  });

  it("counts are cumulative — a lead in 'won' also counted as having reached contact and reply", () => {
    const funnel = computeConversionFunnel(overviewWith({ won: 1 }));
    expect(funnel.contactToReplyRate).toBe(1);
    expect(funnel.replyToMeetingRate).toBe(1);
    expect(funnel.meetingToWonRate).toBe(1);
  });

  it("computes a real, verifiable contact->reply rate", () => {
    // 10 reached contact total (4 sitting at contacted, 6 progressed further)
    const funnel = computeConversionFunnel(overviewWith({ contacted: 4, replied: 3, meeting: 2, won: 1 }));
    // reachedContact = 4+3+2+1 = 10, reachedReply = 3+2+1 = 6
    expect(funnel.contactToReplyRate).toBeCloseTo(6 / 10);
  });

  it("meetingToWonRate reflects real win rate among closed deals only", () => {
    const funnel = computeConversionFunnel(overviewWith({ won: 3, lost: 1 }));
    expect(funnel.meetingToWonRate).toBeCloseTo(3 / 4);
  });

  it("lost deals count toward 'reached contact/reply/meeting' but not toward won rate numerator", () => {
    const funnel = computeConversionFunnel(overviewWith({ lost: 5 }));
    expect(funnel.contactToReplyRate).toBe(1);
    expect(funnel.meetingToWonRate).toBe(0);
  });
});
