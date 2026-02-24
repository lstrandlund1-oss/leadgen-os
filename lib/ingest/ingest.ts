// lib/ingest/ingest.ts
import { runProviderSearch } from "@/lib/providers";
import type { ProviderSearchIntent } from "@/lib/providers/types";
import type { IngestSummary } from "./types";
import { upsertCompaniesRaw } from "./db";
import { runPipelineForRaw } from "./pipeline";
import { intentHash } from "./intentHash";

import {
  getRawCompanyById,
  attachRawIdsToRun,
  createProviderRun,
  finalizeProviderRun,
  getProviderRunByIntentHash,
  resetProviderRunForRetry,
} from "@/lib/persistence";

import { isRunRetryable } from "./retry";
import { computeRetryAfterSeconds } from "./retryAfter";

export async function ingestFromProvider(
  intent: ProviderSearchIntent
): Promise<IngestSummary> {
  const hash = intentHash(intent);

  // RUN LOOKUP (retry semantics only; cache is handled at the API boundary)
  const existing = await getProviderRunByIntentHash({
    provider: intent.provider,
    intentHash: hash,
  });

  /**
   * H2.15: Retry semantics
   * - One run per (provider, intent_hash)
   * - If that run is error:
   *   - retryable => reset the SAME run row and attempt again
   *   - not retryable => return existing error summary
   */
  if (existing && existing.status === "error") {
    const retryable = isRunRetryable(existing.error_code, false);

    if (!retryable) {
      return {
        runId: existing.id,
        cached: false,
        status: "error",
        provider: intent.provider,
        requestId: existing.request_id ?? undefined,
        fetchedCount: existing.fetched_count ?? 0,
        returnedCount: existing.returned_count ?? 0,
        insertedRaw: existing.inserted_raw ?? 0,
        skippedDuplicates: existing.skipped_duplicates ?? 0,
        nextCursor: existing.next_cursor ?? null,
        exhausted: !!existing.exhausted,

        retryable: false,
        retryAfterSeconds: 0,

        error: {
          code: existing.error_code ?? "UNKNOWN",
          message: existing.error_message ?? "Provider run failed",
          retryable: false,
        },
        intent,
      };
    }

    await resetProviderRunForRetry(existing.id);
    return runIngestionAttempt(existing.id, intent);
  }

  // Create (or reuse) a run row (unique constraint -> existing id)
  const runId = await createProviderRun({
    provider: intent.provider,
    intentHash: hash,
    intent,
    requestId: intent.requestId,
  });

  return runIngestionAttempt(runId, intent);
}

async function runIngestionAttempt(
  runId: number | null,
  intent: ProviderSearchIntent
): Promise<IngestSummary> {
  const res = await runProviderSearch(intent);

  // Defensive meta normalization
  const metaBase = res.meta;

  const metaObj: unknown = metaBase;
  const providerSuggestedRetryAfter =
    typeof metaObj === "object" &&
    metaObj !== null &&
    "retryAfterSeconds" in metaObj &&
    typeof (metaObj as { retryAfterSeconds?: unknown }).retryAfterSeconds === "number"
      ? (metaObj as { retryAfterSeconds: number }).retryAfterSeconds
      : null;

  const meta = {
    provider: metaBase?.provider ?? intent.provider,
    requestId: metaBase?.requestId ?? intent.requestId,
    fetchedCount: Number.isFinite(metaBase?.fetchedCount) ? metaBase.fetchedCount : 0,
    returnedCount: Number.isFinite(metaBase?.returnedCount) ? metaBase.returnedCount : 0,
    nextCursor: metaBase?.nextCursor ?? null,
    exhausted: metaBase?.exhausted ?? false,
    retryAfterSeconds: providerSuggestedRetryAfter,
  };

  if (!res.ok) {
    if (runId) {
      await finalizeProviderRun({
        runId,
        status: "error",
        fetchedCount: meta.fetchedCount,
        returnedCount: meta.returnedCount,
        insertedRaw: 0,
        skippedDuplicates: 0,
        nextCursor: meta.nextCursor,
        exhausted: meta.exhausted,
        errorCode: res.error.code,
        errorMessage: res.error.message,
      });
    }

    const retryAfterSeconds = computeRetryAfterSeconds(res.error.code, meta.retryAfterSeconds);
    const retryable = isRunRetryable(res.error.code, res.error.retryable);

    return {
      runId,
      cached: false,
      status: "error",
      provider: meta.provider,
      requestId: meta.requestId,
      fetchedCount: meta.fetchedCount,
      returnedCount: meta.returnedCount,
      insertedRaw: 0,
      skippedDuplicates: 0,
      nextCursor: meta.nextCursor,
      exhausted: meta.exhausted,

      retryable,
      retryAfterSeconds,

      error: {
        code: res.error.code,
        message: res.error.message,
        retryable: res.error.retryable,
      },
      intent,
    };
  }

  const { rawIdsBySourceId, insertedRaw, skippedDuplicates } =
    await upsertCompaniesRaw(res.records);

  const rawIds = Object.values(rawIdsBySourceId);

  // Attach run -> raw ids for perfect replay (idempotent)
  if (runId) {
    await attachRawIdsToRun(runId, rawIds);
  }

  // Pipeline (idempotent upserts by raw_id)
  for (const rawId of rawIds) {
    const raw = await getRawCompanyById(rawId);
    if (!raw) continue;
    await runPipelineForRaw(rawId, raw);
  }

  if (runId) {
    await finalizeProviderRun({
      runId,
      status: "success",
      fetchedCount: meta.fetchedCount,
      returnedCount: meta.returnedCount,
      insertedRaw,
      skippedDuplicates,
      nextCursor: meta.nextCursor,
      exhausted: meta.exhausted,
    });
  }

  return {
    runId,
    cached: false,
    status: "success",
    provider: meta.provider,
    requestId: meta.requestId,
    fetchedCount: meta.fetchedCount,
    returnedCount: meta.returnedCount,
    insertedRaw,
    skippedDuplicates,
    nextCursor: meta.nextCursor,
    exhausted: meta.exhausted,
    intent,
  };
}










