// lib/ingest/cache.ts
import type { ProviderSearchIntent } from "@/lib/providers/types";
import type { IngestSummary } from "@/lib/ingest/types";
import { intentHash } from "./intentHash";
import { getProviderRunByIntentHash } from "@/lib/persistence";

// 14-day cache: serve stored results for 14 days, then re-fetch from Google Places
// This protects the API quota while keeping signals reasonably fresh.
const CACHE_TTL_SECONDS = 14 * 24 * 60 * 60; // 14 days

export async function getCachedRun(
  intent: ProviderSearchIntent
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