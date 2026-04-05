// lib/search/executePlan.ts
//
// Executes a SearchPlan against Google Places.
// Fires all query variants in parallel, collects raw results per query.
// Each query gets its own provider run (existing pipeline handles storage).
// Returns array of { runId, query, leads } ready for aggregation.

import type { SearchPlan } from "./anthropicPlanner";

export interface PlanExecutionArgs {
  plan: SearchPlan;
  city: string;
  country: string;
  socialPresence: string;
  searchMode: "standard" | "deep";
}

export interface QueryResult {
  runId: number;
  query: string;
  location: string;
  leads: unknown[];
}

// How many query variants to fire per tier
const QUERY_LIMITS = {
  standard: { maxVariants: 3, maxDistricts: 0, maxMunicipalities: 0 },
  deep: { maxVariants: 6, maxDistricts: 4, maxMunicipalities: 3 },
} as const;

async function fetchOneQuery(
  query: string,
  location: string,
  socialPresence: string,
  forceRefresh = false,
): Promise<QueryResult | null> {
  try {
    const res = await fetch("/api/providers/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "google_places",
        query,
        country: "Sweden",
        location,
        socialPresence,
        limit: 20,
        forceRefresh,
      }),
    }).catch(() => null);
    if (!res?.ok) return null;

    const data = (await res.json()) as { runId?: number; ok?: boolean };
    const runId = typeof data.runId === "number" ? data.runId : null;
    if (!runId) return null;

    const leadsRes = await fetch(
      `/api/providers/runs/${runId}/leads?location=${encodeURIComponent(location)}&niche=${encodeURIComponent(query)}`,
    ).catch(() => null);
    if (!leadsRes?.ok) return null;

    const leadsData = (await leadsRes.json()) as { leads?: unknown[] };
    return {
      runId,
      query,
      location,
      leads: Array.isArray(leadsData?.leads) ? leadsData.leads : [],
    };
  } catch {
    return null;
  }
}

export async function executePlan(args: PlanExecutionArgs): Promise<QueryResult[]> {
  const { plan, city, socialPresence, searchMode } = args;
  const limits = QUERY_LIMITS[searchMode];

  // Build the full query list according to tier limits
  const queries: Array<{ query: string; location: string; forceRefresh: boolean }> = [];

  // Primary query always runs first (cached OK — it's the user's exact term)
  const primaryQuery = plan.queryVariants[0] ?? plan.canonicalNiche;
  queries.push({ query: primaryQuery, location: city, forceRefresh: false });

  // Additional query variants (force refresh — these expand coverage)
  const extraVariants = [...plan.queryVariants.slice(1), ...plan.languageVariants].slice(0, limits.maxVariants - 1);
  for (const q of extraVariants) {
    queries.push({ query: q, location: city, forceRefresh: true });
  }

  // District queries (deep only)
  for (const dq of plan.districtVariants.slice(0, limits.maxDistricts)) {
    queries.push({ query: dq, location: city, forceRefresh: true });
  }

  // Municipality queries (deep only)
  for (const mq of plan.municipalityVariants.slice(0, limits.maxMunicipalities)) {
    queries.push({ query: mq, location: city, forceRefresh: true });
  }

  // Fire all in parallel
  const results = await Promise.allSettled(
    queries.map(({ query, location, forceRefresh }) => fetchOneQuery(query, location, socialPresence, forceRefresh)),
  );

  return results
    .filter((r): r is PromiseFulfilledResult<QueryResult> => r.status === "fulfilled" && r.value !== null)
    .map((r) => r.value);
}
