// lib/stats/getDailySummary.ts
//
// "What happened today, what's my pipeline, what's tomorrow" — the
// concise operational summary from the rebuild spec (temporarily called
// "After-Action Report" there — that name is explicitly flagged as not
// finalized, so it isn't used anywhere in this code or its output; the
// actual customer-facing name still needs to be decided before this gets
// a prominent UI treatment).
//
// Deliberately reuses getPipelineOverview rather than re-querying the
// same outcome data a third way (already used by both the Pipeline page
// and the conversion funnel).

import { getServiceClient } from "@/lib/supabaseServiceClient";
import { getPipelineOverview } from "@/lib/pipeline/getPipelineOverview";

export type DailySummary = {
  today: {
    contacted: number;
    replied: number;
    meetings: number;
    won: number;
  };
  pipeline: {
    activeCount: number;
    // Estimated only if the user has set an average deal value in their
    // (optional) economic profile — activeCount x averageDealValue. Null
    // otherwise, never a fabricated number. Explicitly an estimate, not
    // a sum of real per-lead values, since no such field exists.
    estimatedPipelineValueSek: number | null;
  };
  tomorrow: {
    followUpsDue: number;
    newRecommended: number;
  };
};

export async function getDailySummary(userId: string): Promise<DailySummary> {
  const client = await getServiceClient();
  const empty: DailySummary = {
    today: { contacted: 0, replied: 0, meetings: 0, won: 0 },
    pipeline: { activeCount: 0, estimatedPipelineValueSek: null },
    tomorrow: { followUpsDue: 0, newRecommended: 0 },
  };
  if (!client) return empty;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayStartIso = todayStart.toISOString();

  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const tomorrowEnd = new Date(tomorrowStart);
  tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);

  const [{ data: outcomes }, pipeline, { data: profileRow }] = await Promise.all([
    client
      .from("lead_outcomes")
      .select("contacted_at, replied_at, booked_call_at, closed_at, closed, lost_reason, followup_date")
      .eq("user_id", userId),
    getPipelineOverview(userId),
    client.from("user_profiles").select("profile_data").eq("id", userId).maybeSingle(),
  ]);

  let contacted = 0;
  let replied = 0;
  let meetings = 0;
  let won = 0;
  let followUpsDue = 0;

  for (const o of outcomes ?? []) {
    if (o.contacted_at && o.contacted_at >= todayStartIso) contacted += 1;
    if (o.replied_at && o.replied_at >= todayStartIso) replied += 1;
    if (o.booked_call_at && o.booked_call_at >= todayStartIso) meetings += 1;
    if (o.closed_at && o.closed_at >= todayStartIso && o.closed && !o.lost_reason) won += 1;

    if (o.followup_date) {
      const followupDate = new Date(o.followup_date as string);
      if (followupDate >= tomorrowStart && followupDate < tomorrowEnd && !o.closed) followUpsDue += 1;
    }
  }

  const activeCount = pipeline.totalActiveCount;
  const newRecommended = pipeline.stages.recommended.length;

  const profileData = profileRow?.profile_data as { averageDealValue?: number } | null;
  const estimatedPipelineValueSek =
    profileData?.averageDealValue && activeCount > 0 ? activeCount * profileData.averageDealValue : null;

  return {
    today: { contacted, replied, meetings, won },
    pipeline: { activeCount, estimatedPipelineValueSek },
    tomorrow: { followUpsDue, newRecommended },
  };
}
