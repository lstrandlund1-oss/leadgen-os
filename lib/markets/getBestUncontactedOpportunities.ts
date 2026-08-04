// lib/markets/getBestUncontactedOpportunities.ts
//
// "Show more" on Home's top-opportunities list doesn't extend the list
// downward — it redirects to Markets, which shows the best-scored
// opportunities discovered in the last 30 days that haven't been
// contacted yet. This is that data layer.

import { getServiceClient } from "@/lib/supabaseServiceClient";

export type UncontactedOpportunity = {
  rawId: number;
  leadId: string;
  runId: number | null;
  name: string;
  city: string | null;
  country: string | null;
  opportunityValue: number;
  scoredAt: string;
};

const WINDOW_DAYS = 30;
const RESULT_LIMIT = 50;

export async function getBestUncontactedOpportunities(userId: string): Promise<UncontactedOpportunity[]> {
  const client = await getServiceClient();
  if (!client) return [];

  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - WINDOW_DAYS);

  const { data: intelligence } = await client
    .from("company_intelligence")
    .select("raw_id, score, scored_at")
    .eq("user_id", userId)
    .gte("scored_at", windowStart.toISOString())
    .order("scored_at", { ascending: false });

  if (!intelligence || intelligence.length === 0) return [];

  const rawIds = intelligence.map((i) => i.raw_id as number);

  const [{ data: rawRows }, { data: normalizedRows }, { data: runRaws }] = await Promise.all([
    client.from("companies_raw").select("id, source, source_id").in("id", rawIds),
    client.from("companies_normalized").select("raw_id, name, city, country, duplicate_of_raw_id").in("raw_id", rawIds),
    client.from("provider_run_raws").select("run_id, raw_id").in("raw_id", rawIds),
  ]);

  const rawById = new Map((rawRows ?? []).map((r) => [r.id as number, r]));
  const normalizedByRawId = new Map((normalizedRows ?? []).map((n) => [n.raw_id as number, n]));
  const runIdByRawId = new Map((runRaws ?? []).map((r) => [r.raw_id as number, r.run_id as number]));

  const leadIdByRawId = new Map<number, string>();
  for (const rawId of rawIds) {
    const raw = rawById.get(rawId);
    if (raw) leadIdByRawId.set(rawId, `${raw.source}:${raw.source_id}`);
  }

  const leadIds = Array.from(leadIdByRawId.values());
  const { data: outcomes } = leadIds.length
    ? await client.from("lead_outcomes").select("lead_id, contacted").eq("user_id", userId).in("lead_id", leadIds)
    : { data: [] };
  const contactedLeadIds = new Set((outcomes ?? []).filter((o) => o.contacted).map((o) => o.lead_id as string));

  const results: UncontactedOpportunity[] = [];
  for (const entry of intelligence) {
    const rawId = entry.raw_id as number;
    const normalized = normalizedByRawId.get(rawId);
    if (normalized?.duplicate_of_raw_id) continue;

    const leadId = leadIdByRawId.get(rawId);
    if (!leadId || contactedLeadIds.has(leadId)) continue;

    const score = entry.score as { value?: number; opportunity?: number } | null;
    const opportunityValue = score?.value ?? score?.opportunity ?? 0;

    results.push({
      rawId,
      leadId,
      runId: runIdByRawId.get(rawId) ?? null,
      name: normalized?.name ?? "Unknown",
      city: normalized?.city ?? null,
      country: normalized?.country ?? null,
      opportunityValue,
      scoredAt: entry.scored_at as string,
    });
  }

  results.sort((a, b) => b.opportunityValue - a.opportunityValue);
  return results.slice(0, RESULT_LIMIT);
}
