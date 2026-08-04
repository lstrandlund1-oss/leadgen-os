// lib/stats/getDailyInsight.ts
//
// Fetches the user's closed leads, bridges each back to its detected
// gap category, and applies the pure insight engine. Uses one query per
// closed lead to resolve lead_id -> raw_id — not maximally efficient,
// but closed-deal counts are small at current usage scale (a handful of
// real won/lost deals per user), so this is fine for now; worth
// revisiting with a batched OR-query if usage grows meaningfully.

import { getServiceClient } from "@/lib/supabaseServiceClient";
import { computeBestInsight, type ClosedLeadRecord, type Insight } from "./insightEngine";

export async function getDailyInsight(userId: string): Promise<Insight | null> {
  const client = await getServiceClient();
  if (!client) return null;

  const { data: outcomes } = await client
    .from("lead_outcomes")
    .select("lead_id, closed, lost_reason")
    .eq("user_id", userId)
    .eq("closed", true);

  if (!outcomes || outcomes.length === 0) return null;

  const sourceSourceIdPairs = outcomes.map((o) => (o.lead_id as string).split(":"));
  const rawRowsPromises = sourceSourceIdPairs.map(([source, sourceId]) =>
    client
      .from("companies_raw")
      .select("id, source, source_id")
      .eq("source", source)
      .eq("source_id", sourceId)
      .maybeSingle(),
  );
  const rawRows = await Promise.all(rawRowsPromises);

  const rawIdByLeadId = new Map<string, number>();
  outcomes.forEach((o, i) => {
    const rawId = rawRows[i].data?.id as number | undefined;
    if (rawId) rawIdByLeadId.set(o.lead_id as string, rawId);
  });

  const rawIds = Array.from(rawIdByLeadId.values());
  if (rawIds.length === 0) return null;

  const { data: normalizedRows } = await client
    .from("companies_normalized")
    .select("raw_id, primary_insight")
    .in("raw_id", rawIds);

  const insightByRawId = new Map(
    (normalizedRows ?? []).map((n) => [
      n.raw_id as number,
      n.primary_insight as { type?: string; message?: string } | null,
    ]),
  );

  const closedLeads: ClosedLeadRecord[] = outcomes.map((o) => {
    const rawId = rawIdByLeadId.get(o.lead_id as string);
    const insight = rawId ? insightByRawId.get(rawId) : null;
    return {
      gapType: insight?.type ?? null,
      gapMessage: insight?.message ?? null,
      won: !o.lost_reason,
    };
  });

  return computeBestInsight(closedLeads);
}
