// lib/search/searchMetrics.ts
//
// Aggregates yield/cost metrics across every run a single search action
// produced (which, with geographic partitioning, is now often many runs
// per search rather than one). Directly addresses the rebuild spec's
// "Search Runs Must Be Replayable/Auditable" and "Cost Discipline"
// sections: request count, raw/unique/duplicate results, and estimated
// cost, all logged against the search_completed event instead of the
// empty {} it was logging before.
//
// This is exactly the kind of measurement that would have caught the
// 64x-vs-19x query multiplier mistake empirically, if it had existed
// before that bug was found by manual code tracing instead.

import { getServiceClient } from "@/lib/supabaseServiceClient";

// Google Places Text Search, Enterprise tier ($35/1,000) — this app
// requests the `rating` field, which is what puts it on that tier rather
// than the cheaper Pro tier. See docs/ENVIRONMENT_VARIABLES.md /
// CURRENT_STATE.md for where this figure came from. SerpApi's actual
// per-call pricing isn't confirmed anywhere in this codebase, so its
// contribution to estimated cost is intentionally left at 0 rather than
// guessed — the alternative (a made-up number presented as real cost) is
// worse than an honest gap.
const GOOGLE_PLACES_COST_PER_CALL_USD = 0.035;

export type SearchYieldMetrics = {
  runCount: number;
  requestsByProvider: Record<string, number>;
  rawResultsFetched: number;
  uniqueCompanies: number;
  duplicatesWithinRuns: number; // caught by (source, source_id) matching, per existing provider_runs.skipped_duplicates
  duplicatesAcrossProviders: number; // caught by domain matching, see migration 0016
  estimatedCostUsd: number;
};

export async function computeSearchYieldMetrics(runIds: number[]): Promise<SearchYieldMetrics | null> {
  if (runIds.length === 0) return null;

  const client = await getServiceClient();
  if (!client) return null;

  const { data: runs, error: runsError } = await client
    .from("provider_runs")
    .select("id, provider, fetched_count, inserted_raw, skipped_duplicates")
    .in("id", runIds);

  if (runsError || !runs) return null;

  const requestsByProvider: Record<string, number> = {};
  let rawResultsFetched = 0;
  let duplicatesWithinRuns = 0;
  for (const run of runs) {
    requestsByProvider[run.provider] = (requestsByProvider[run.provider] ?? 0) + 1;
    rawResultsFetched += run.fetched_count ?? 0;
    duplicatesWithinRuns += run.skipped_duplicates ?? 0;
  }

  const { data: runRaws } = await client.from("provider_run_raws").select("raw_id").in("run_id", runIds);
  const rawIds = Array.from(new Set((runRaws ?? []).map((r) => r.raw_id as number)));

  let duplicatesAcrossProviders = 0;
  let uniqueCompanies = rawIds.length;
  if (rawIds.length > 0) {
    const { data: normalized } = await client
      .from("companies_normalized")
      .select("raw_id, duplicate_of_raw_id")
      .in("raw_id", rawIds);

    const flaggedAsDuplicate = (normalized ?? []).filter((n) => n.duplicate_of_raw_id !== null).length;
    duplicatesAcrossProviders = flaggedAsDuplicate;
    uniqueCompanies = rawIds.length - flaggedAsDuplicate;
  }

  const estimatedCostUsd = (requestsByProvider["google_places"] ?? 0) * GOOGLE_PLACES_COST_PER_CALL_USD;

  return {
    runCount: runs.length,
    requestsByProvider,
    rawResultsFetched,
    uniqueCompanies,
    duplicatesWithinRuns,
    duplicatesAcrossProviders,
    estimatedCostUsd,
  };
}
