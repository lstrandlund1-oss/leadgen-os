// lib/markets/getMarketSnapshot.ts
//
// Computes the "Market snapshot" stats for one market: total companies,
// opportunity buckets, contacted count, new this month, and a coverage
// estimate.
//
// Coverage is the one genuinely hard metric here — there's no way to
// know the true total number of businesses matching a niche+location
// without external data Vantio doesn't have. Rather than fabricate a
// number, this uses a real, honestly-labeled proxy: the fraction of this
// market's search runs that the provider reported as fully exhausted
// (provider_runs.exhausted) — i.e. "how much of what Google Places says
// exists here have we actually pulled in," not "what fraction of the
// true market this represents." Labeled as an estimate in the UI for
// exactly this reason.

import { getServiceClient } from "@/lib/supabaseServiceClient";

export type MarketSnapshot = {
  marketId: string;
  totalCompanies: number;
  highOpportunityCount: number;
  goodOpportunityCount: number;
  lowOpportunityCount: number;
  contactedCount: number;
  lostOrNotFitCount: number;
  newThisMonth: number;
  newThisMonthVsLastMonthPct: number | null;
  estimatedCoveragePct: number | null; // null if no runs yet — nothing to estimate from
};

export async function getMarketSnapshot(userId: string, marketId: string): Promise<MarketSnapshot | null> {
  const client = await getServiceClient();
  if (!client) return null;

  const { data: marketRuns } = await client
    .from("user_search_runs")
    .select("run_id")
    .eq("user_id", userId)
    .eq("market_id", marketId);

  const runIds = (marketRuns ?? []).map((r) => r.run_id as number);

  const empty: MarketSnapshot = {
    marketId,
    totalCompanies: 0,
    highOpportunityCount: 0,
    goodOpportunityCount: 0,
    lowOpportunityCount: 0,
    contactedCount: 0,
    lostOrNotFitCount: 0,
    newThisMonth: 0,
    newThisMonthVsLastMonthPct: null,
    estimatedCoveragePct: null,
  };

  if (runIds.length === 0) return empty;

  // Coverage estimate: fraction of this market's runs the provider
  // reported as exhausted (no more results available for that query/cell).
  const { data: runRows } = await client.from("provider_runs").select("id, exhausted").in("id", runIds);
  const exhaustedCount = (runRows ?? []).filter((r) => r.exhausted).length;
  const estimatedCoveragePct = runRows && runRows.length > 0 ? exhaustedCount / runRows.length : null;

  const { data: runRaws } = await client.from("provider_run_raws").select("raw_id, created_at").in("run_id", runIds);
  const rawIds = Array.from(new Set((runRaws ?? []).map((r) => r.raw_id as number)));
  if (rawIds.length === 0) return { ...empty, estimatedCoveragePct };

  const [{ data: normalizedRows }, { data: intelligenceRows }, { data: rawRows }] = await Promise.all([
    client.from("companies_normalized").select("raw_id, duplicate_of_raw_id").in("raw_id", rawIds),
    client.from("company_intelligence").select("raw_id, score").eq("user_id", userId).in("raw_id", rawIds),
    client.from("companies_raw").select("id, source, source_id").in("id", rawIds),
  ]);

  const normalizedByRawId = new Map((normalizedRows ?? []).map((n) => [n.raw_id as number, n]));
  const scoreByRawId = new Map(
    (intelligenceRows ?? []).map((i) => [i.raw_id as number, (i.score as { value?: number } | null)?.value ?? 0]),
  );
  const rawById = new Map((rawRows ?? []).map((r) => [r.id as number, r]));

  const leadIdByRawId = new Map<number, string>();
  for (const rawId of rawIds) {
    const raw = rawById.get(rawId);
    if (raw) leadIdByRawId.set(rawId, `${raw.source}:${raw.source_id}`);
  }
  const leadIds = Array.from(leadIdByRawId.values());
  const { data: outcomes } = leadIds.length
    ? await client
        .from("lead_outcomes")
        .select("lead_id, contacted, closed, lost_reason")
        .eq("user_id", userId)
        .in("lead_id", leadIds)
    : { data: [] };
  const outcomeByLeadId = new Map((outcomes ?? []).map((o) => [o.lead_id as string, o]));

  const canonicalRawIds = rawIds.filter((rawId) => !normalizedByRawId.get(rawId)?.duplicate_of_raw_id);

  let highOpportunityCount = 0;
  let goodOpportunityCount = 0;
  let lowOpportunityCount = 0;
  let contactedCount = 0;
  let lostOrNotFitCount = 0;

  for (const rawId of canonicalRawIds) {
    const score = scoreByRawId.get(rawId) ?? 0;
    if (score >= 80) highOpportunityCount += 1;
    else if (score >= 60) goodOpportunityCount += 1;
    else lowOpportunityCount += 1;

    const leadId = leadIdByRawId.get(rawId);
    const outcome = leadId ? outcomeByLeadId.get(leadId) : undefined;
    if (outcome?.contacted) contactedCount += 1;
    if (outcome?.closed && outcome?.lost_reason) lostOrNotFitCount += 1;
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  let newThisMonth = 0;
  let newLastMonth = 0;
  for (const r of runRaws ?? []) {
    const createdAt = new Date(r.created_at as string);
    if (createdAt >= monthStart) newThisMonth += 1;
    else if (createdAt >= lastMonthStart) newLastMonth += 1;
  }

  const newThisMonthVsLastMonthPct = newLastMonth > 0 ? (newThisMonth - newLastMonth) / newLastMonth : null;

  return {
    marketId,
    totalCompanies: canonicalRawIds.length,
    highOpportunityCount,
    goodOpportunityCount,
    lowOpportunityCount,
    contactedCount,
    lostOrNotFitCount,
    newThisMonth,
    newThisMonthVsLastMonthPct,
    estimatedCoveragePct,
  };
}
