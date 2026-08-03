// lib/search/executeSearch.ts
//
// Shared search-execution logic, extracted from
// app/api/search/discover/route.ts so it can be reused by the market
// refresh endpoint (app/api/markets/[id]/refresh/route.ts) too — Next.js
// route.ts files can only export HTTP method handlers and a few specific
// config values, not arbitrary helper functions, so this couldn't just be
// exported directly from the route file.

import { ingestFromProvider } from "@/lib/ingest/ingest";
import { runPartitionedSearch } from "@/lib/search/partitionedSearch";
import { computeSearchYieldMetrics } from "@/lib/search/searchMetrics";
import { recordUserSearchRuns } from "@/lib/userSearchRuns";
import { logEvent } from "@/lib/analytics/log";

export async function runQueries(queries: string[], city: string, socialPresence: string): Promise<number[]> {
  const runIds: number[] = [];
  const [primaryQuery, ...variantQueries] = queries;

  await Promise.allSettled([
    runPartitionedSearch({
      provider: "google_places",
      query: primaryQuery,
      location: city,
      country: "Sweden",
      socialPresence: socialPresence as "any",
      limit: 20,
    })
      .then((result) => {
        runIds.push(...result.runIds);
      })
      .catch(() => {}),

    ...(process.env.SERP_API_KEY
      ? [
          ingestFromProvider({
            provider: "serp",
            query: primaryQuery,
            location: city,
            country: "Sweden",
            socialPresence: socialPresence as "any",
            limit: 20,
          })
            .then((s) => {
              if (s.runId) runIds.push(s.runId);
            })
            .catch(() => {}),
        ]
      : []),

    ...variantQueries.flatMap((query) => [
      ingestFromProvider({
        provider: "google_places",
        query,
        location: city,
        country: "Sweden",
        socialPresence: socialPresence as "any",
        limit: 20,
      })
        .then((s) => {
          if (s.runId) runIds.push(s.runId);
        })
        .catch(() => {}),

      ...(process.env.SERP_API_KEY
        ? [
            ingestFromProvider({
              provider: "serp",
              query,
              location: city,
              country: "Sweden",
              socialPresence: socialPresence as "any",
              limit: 20,
            })
              .then((s) => {
                if (s.runId) runIds.push(s.runId);
              })
              .catch(() => {}),
          ]
        : []),
    ]),
  ]);

  return runIds;
}

export async function executeAndRespond(
  queries: string[],
  city: string,
  socialPresence: string,
  searchMode: string,
  deepRemaining: number | null,
  userId: string | null,
  marketId?: string | null,
) {
  const runIds = await runQueries(queries, city, socialPresence);
  console.log(`[discover] ${queries.length} queries → ${runIds.length} runs`);

  await recordUserSearchRuns(userId, runIds, marketId);

  if (userId) {
    const metrics = await computeSearchYieldMetrics(runIds);
    const eventName = searchMode === "deep" ? "deep_search_completed" : "search_completed";
    await logEvent(userId, eventName, metrics ? { ...metrics } : {});
  }

  if (runIds.length === 0) {
    return { ok: false, runIds: [], primaryRunId: null, searchMode };
  }

  return {
    ok: true,
    runIds,
    primaryRunId: runIds[0],
    queryCount: queries.length,
    searchMode,
    ...(deepRemaining !== null ? { deepSearchesRemaining: deepRemaining } : {}),
  };
}
