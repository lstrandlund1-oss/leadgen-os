// lib/search/partitionedSearch.ts
//
// Coordinates a geographically-partitioned search: geocode the target area
// once, plan a grid of search cells, issue one ingestFromProvider call per
// cell (bounded concurrency), and return every resulting run ID.
//
// Deliberately does NOT do adaptive subdivision yet (detecting a cell that
// hit the provider's result ceiling and re-querying it as smaller
// sub-cells) — that's a real follow-up piece (subdivideCell already exists
// in geoPartition.ts for it to build on), kept separate so the static grid
// version can be verified working on its own first, per the project's own
// "incremental, not one giant uncontrolled change" principle.
//
// Falls back to a single, unpartitioned query whenever partitioning isn't
// applicable or geocoding fails — this must never make a search WORSE than
// today's single-query behavior, only better where it can be.

import { ingestFromProvider } from "@/lib/ingest/ingest";
import { geocodeLocation } from "@/lib/providers/geocode";
import { planSearchCells } from "@/lib/search/geoPartition";
import type { ProviderSearchIntent } from "@/lib/providers/types";

// Caps how many cell queries run at once — protects against a burst of
// simultaneous requests to the provider API, independent of the total
// cell count safety cap already enforced in planSearchCells.
const MAX_CONCURRENT_CELL_QUERIES = 4;

export type PartitionedSearchResult = {
  runIds: number[];
  partitioned: boolean;
  cellCount: number;
};

export async function runPartitionedSearch(
  baseIntent: Omit<ProviderSearchIntent, "lat" | "lng" | "radius_m">,
): Promise<PartitionedSearchResult> {
  const locationText = baseIntent.location ?? baseIntent.city ?? baseIntent.locationText;

  if (!locationText) {
    // No location to partition at all — same as today's behavior.
    const summary = await ingestFromProvider(baseIntent);
    return { runIds: summary.runId ? [summary.runId] : [], partitioned: false, cellCount: 1 };
  }

  const geocoded = await geocodeLocation(locationText);
  if (!geocoded) {
    // Couldn't resolve the location to coordinates — fall back cleanly
    // rather than failing the search entirely.
    const summary = await ingestFromProvider(baseIntent);
    return { runIds: summary.runId ? [summary.runId] : [], partitioned: false, cellCount: 1 };
  }

  const cells = planSearchCells(geocoded.viewport);
  if (!cells) {
    // Area too small to be worth partitioning.
    const summary = await ingestFromProvider(baseIntent);
    return { runIds: summary.runId ? [summary.runId] : [], partitioned: false, cellCount: 1 };
  }

  const runIds: number[] = [];
  for (let i = 0; i < cells.length; i += MAX_CONCURRENT_CELL_QUERIES) {
    const batch = cells.slice(i, i + MAX_CONCURRENT_CELL_QUERIES);
    const results = await Promise.all(
      batch.map((cell) =>
        ingestFromProvider({
          ...baseIntent,
          lat: cell.lat,
          lng: cell.lng,
          radius_m: cell.radiusMeters,
        }),
      ),
    );
    for (const summary of results) {
      if (summary.runId) runIds.push(summary.runId);
    }
  }

  return { runIds, partitioned: true, cellCount: cells.length };
}
