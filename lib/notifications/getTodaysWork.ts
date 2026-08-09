// lib/notifications/getTodaysWork.ts
//
// "Today's Work" — reasoned prompts for what actually needs attention
// right now, computed live from real current state rather than a stored
// event log. Three real sources, each with a genuine reason attached:
//   1. Overdue follow-ups (lead_outcomes.followup_date in the past)
//   2. Stale pipeline leads (reusing Pipeline's own findStaleLeads)
//   3. Today's top new recommendation (reusing getTodaysRecommendations)
//
// Deliberately not an "event happened, log it" system — there's no
// server-side job deciding when a follow-up "becomes" overdue, no queue
// to fall out of sync with reality. Every call reflects exactly what's
// true in the database at that moment, the same honesty principle behind
// the insight/goal engines returning null rather than fabricating data.

import { getServiceClient } from "@/lib/supabaseServiceClient";
import { getPipelineOverview } from "@/lib/pipeline/getPipelineOverview";
import { findStaleLeads } from "@/lib/pipeline/staleLeads";
import { getTodaysRecommendations } from "@/lib/recommendations/getTodaysRecommendations";

export type WorkItemType = "overdue_followup" | "stale_lead" | "new_recommendation";

export type WorkItem = {
  id: string; // stable per underlying entity, so client-side "seen" tracking survives across calls
  type: WorkItemType;
  title: string;
  reason: string; // the real "why" — never generic
  href: string;
  createdAt: string; // for sorting/display, not a stored event time — derived from the underlying real timestamp
};

const MAX_OVERDUE_FOLLOWUPS = 5;
const MAX_STALE_LEADS = 3;

export async function getTodaysWork(userId: string): Promise<WorkItem[]> {
  const client = await getServiceClient();
  if (!client) return [];

  const items: WorkItem[] = [];

  // ── 1. Overdue follow-ups ────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);
  const { data: overdue } = await client
    .from("lead_outcomes")
    .select("run_id, lead_id, followup_date, closed")
    .eq("user_id", userId)
    .not("followup_date", "is", null)
    .lte("followup_date", today)
    .eq("closed", false)
    .order("followup_date", { ascending: true })
    .limit(MAX_OVERDUE_FOLLOWUPS);

  if (overdue && overdue.length > 0) {
    // Names aren't on lead_outcomes — resolve each lead_id
    // ("source:source_id") individually. Small scale (max 5 items), so
    // parallel targeted queries are simpler and far cheaper than
    // fetching companies_raw unfiltered and matching client-side.
    const nameByLeadId = new Map<string, string>();
    await Promise.all(
      overdue.map(async (o) => {
        const leadId = o.lead_id as string;
        const sepIdx = leadId.indexOf(":");
        if (sepIdx === -1) return;
        const source = leadId.slice(0, sepIdx);
        const sourceId = leadId.slice(sepIdx + 1);
        const { data: rawRow } = await client
          .from("companies_raw")
          .select("id")
          .eq("source", source)
          .eq("source_id", sourceId)
          .maybeSingle();
        if (!rawRow) return;
        const { data: normRow } = await client
          .from("companies_normalized")
          .select("name")
          .eq("raw_id", rawRow.id)
          .maybeSingle();
        if (normRow?.name) nameByLeadId.set(leadId, normRow.name);
      }),
    );

    for (const o of overdue) {
      const name = nameByLeadId.get(o.lead_id) ?? "A lead";
      const daysOverdue = Math.floor((Date.now() - new Date(o.followup_date as string).getTime()) / 86_400_000);
      items.push({
        id: `followup:${o.lead_id}`,
        type: "overdue_followup",
        title: `Follow up with ${name}`,
        reason:
          daysOverdue <= 0
            ? "Follow-up due today"
            : `Follow-up was due ${daysOverdue} day${daysOverdue === 1 ? "" : "s"} ago`,
        href: o.run_id ? `/outreach?runId=${o.run_id}&leadId=${encodeURIComponent(o.lead_id)}` : "/pipeline",
        createdAt: o.followup_date as string,
      });
    }
  }

  // ── 2. Stale pipeline leads ──────────────────────────────────────────
  try {
    const overview = await getPipelineOverview(userId);
    const allActive = [
      ...overview.stages.recommended,
      ...overview.stages.contacted,
      ...overview.stages.replied,
      ...overview.stages.meeting,
    ];
    const stale = findStaleLeads(allActive).slice(0, MAX_STALE_LEADS);
    for (const lead of stale) {
      items.push({
        id: `stale:${lead.leadId}`,
        type: "stale_lead",
        title: lead.name,
        reason: `Sitting ${lead.daysStale} days in ${lead.stage} without progress`,
        href: "/pipeline",
        createdAt: lead.stageEnteredAt,
      });
    }
  } catch {
    // Pipeline data unavailable — skip this source rather than fail the whole aggregation.
  }

  // ── 3. Today's top new recommendation ────────────────────────────────
  try {
    const recs = await getTodaysRecommendations(userId, 1);
    const top = recs[0];
    if (top && top.opportunityValue >= 80) {
      items.push({
        id: `rec:${top.leadId}`,
        type: "new_recommendation",
        title: top.name,
        reason:
          top.reasons.length > 0
            ? `Scored ${top.opportunityValue} — ${top.reasons[0]}`
            : `Scored ${top.opportunityValue}`,
        href: "/home",
        createdAt: top.scoredAt,
      });
    }
  } catch {
    // Recommendations unavailable — skip this source too.
  }

  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return items;
}
