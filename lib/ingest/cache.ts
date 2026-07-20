// lib/ingest/cache.ts
import type { ProviderSearchIntent } from "@/lib/providers/types";
import type { IngestSummary } from "@/lib/ingest/types";
import { intentHash } from "./intentHash";
import { getProviderRunByIntentHash } from "@/lib/persistence";

// 90-day run cache: the run just points to companies_raw rows which are stored
// permanently. Score freshness is handled separately via signal hashing in the
// leads route — if signals change, the score is recomputed regardless of run age.
// Re-fetching from Google Places only happens after 90 days to catch new businesses.
const CACHE_TTL_SECONDS = 90 * 24 * 60 * 60; // 90 days

export async function getCachedRun(
  intent: ProviderSearchIntent,
): Promise<{ hit: false } | { hit: true; summary: IngestSummary }> {
  const hash = intentHash(intent);

  const existing = await getProviderRunByIntentHash({
    provider: intent.provider,
    intentHash: hash,
  });

  // Cache miss conditions
  if (!existing) return { hit: false };
  if (existing.status !== "success") return { hit: false };
  if (isExpired(existing.created_at)) return { hit: false };

  // Cache hit — include age so the UI can display "Results from X days ago"
  const ageMs = Date.now() - Date.parse(existing.created_at);
  const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));

  return {
    hit: true,
    summary: {
      runId: existing.id,
      cached: true,
      cachedAt: existing.created_at,
      ageDays,
      status: "success",
      provider: intent.provider,
      requestId: existing.request_id ?? undefined,
      fetchedCount: existing.fetched_count ?? 0,
      returnedCount: existing.returned_count ?? 0,
      insertedRaw: existing.inserted_raw ?? 0,
      skippedDuplicates: existing.skipped_duplicates ?? 0,
      nextCursor: existing.next_cursor ?? null,
      exhausted: !!existing.exhausted,
      intent,
    },
  };
}

function isExpired(createdAtIso: string): boolean {
  const createdMs = Date.parse(createdAtIso);
  if (!Number.isFinite(createdMs)) return true;
  const ageSeconds = (Date.now() - createdMs) / 1000;
  return ageSeconds > CACHE_TTL_SECONDS;
}
