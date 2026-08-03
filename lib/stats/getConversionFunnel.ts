// lib/stats/getConversionFunnel.ts
//
// Computes real stage-to-stage conversion rates from a user's actual
// outcome history — the "Conversion" section of Stats (Week 3 of the
// rebuild). Deliberately built on top of getPipelineOverview rather than
// re-querying the same data a second way, since the pipeline counts are
// already the exact input a funnel needs.
//
// Every rate here is computed from real counts — there is no case where
// a rate is estimated or fabricated. A stage with zero opportunities
// yields a null rate (not 0%, which would misleadingly imply "everyone
// failed" rather than "no data yet").

import { getPipelineOverview, type PipelineOverview } from "@/lib/pipeline/getPipelineOverview";

export type ConversionFunnel = {
  contactedCount: number;
  repliedCount: number;
  meetingCount: number;
  wonCount: number;
  lostCount: number;
  recommendedCount: number;

  // Each rate is (count reaching this stage or further) / (count reaching
  // the previous stage or further) — null when the denominator is 0.
  contactToReplyRate: number | null;
  replyToMeetingRate: number | null;
  meetingToWonRate: number | null;
  recommendedToContactRate: number | null;
};

function rate(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return numerator / denominator;
}

export function computeConversionFunnel(overview: PipelineOverview): ConversionFunnel {
  const recommendedCount = overview.stages.recommended.length;
  const contactedCount = overview.stages.contacted.length;
  const repliedCount = overview.stages.replied.length;
  const meetingCount = overview.stages.meeting.length;
  const wonCount = overview.stages.won.length;
  const lostCount = overview.stages.lost.length;

  // "Reached at least this far" totals — a lead currently sitting in
  // "meeting" also reached "contacted" and "replied" earlier, so the
  // funnel counts are cumulative from the current stage upward, not just
  // whoever happens to be sitting in that exact stage today.
  const reachedContact = contactedCount + repliedCount + meetingCount + wonCount + lostCount;
  const reachedReply = repliedCount + meetingCount + wonCount + lostCount;
  const reachedMeeting = meetingCount + wonCount + lostCount;
  const reachedClosed = wonCount + lostCount;

  return {
    contactedCount,
    repliedCount,
    meetingCount,
    wonCount,
    lostCount,
    recommendedCount,
    recommendedToContactRate: rate(reachedContact, recommendedCount + reachedContact),
    contactToReplyRate: rate(reachedReply, reachedContact),
    replyToMeetingRate: rate(reachedMeeting, reachedReply),
    meetingToWonRate: rate(wonCount, reachedClosed),
  };
}

export async function getConversionFunnel(userId: string): Promise<ConversionFunnel> {
  const overview = await getPipelineOverview(userId);
  return computeConversionFunnel(overview);
}
