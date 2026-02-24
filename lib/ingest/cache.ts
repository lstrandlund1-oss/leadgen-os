// lib/ingest/cache.ts
import type { ProviderSearchIntent } from "@/lib/providers/types";
import type { IngestSummary } from "@/lib/ingest/types";
import { intentHash } from "./intentHash";
import { getProviderRunByIntentHash } from "@/lib/persistence";

const CACHE_TTL_SECONDS = 24 * 60 * 60;

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

  // Cache hit
  return {
    hit: true,
    summary: {
      runId: existing.id,
      cached: true,
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

