// lib/providers/index.ts
import type {
  ProviderAdapter,
  ProviderName,
  ProviderSearchIntent,
  ProviderResult,
} from "./types";

import { mockAdapter } from "./mock/adapter";
import { assertProviderResult } from "./validate";
import { googlePlacesAdapter } from "./googlePlaces";

const registry: Record<ProviderName, ProviderAdapter> = {
  mock: mockAdapter,

  // Stubs: return well-formed ProviderResult with an explicit error.
  google_places: googlePlacesAdapter,

  serp: {
    name: "serp",
    async search(intent) {
      return {
        ok: false,
        error: {
          code: "UNKNOWN",
          message: "serp adapter not implemented yet",
          retryable: false,
        },
        meta: {
          provider: "serp",
          requestId: intent.requestId,
          fetchedCount: 0,
          returnedCount: 0,
          nextCursor: null,
          exhausted: true,
        },
      };
    },
  },
};

export function getProviderAdapter(provider: ProviderName): ProviderAdapter {
  const adapter = registry[provider];
  if (!adapter) throw new Error(`Unknown provider: ${provider}`);
  return adapter;
}

export async function runProviderSearch(
  intent: ProviderSearchIntent,
): Promise<ProviderResult> {
  const adapter = getProviderAdapter(intent.provider);

  // Enforce sane defaults at the gateway boundary (not in adapters)
  const safeIntent: ProviderSearchIntent = {
    ...intent,
    limit: clamp(intent.limit ?? 25, 1, 200),
  };

  const result = await adapter.search(safeIntent);

  if (!result.ok) {
    return {
      ok: false,
      error: {
        code: "BAD_REQUEST",
        message: "...",
        retryable: false,
      },
      meta: {
        provider: result.meta.provider,
        requestId: result.meta?.requestId ?? undefined,
        fetchedCount: 0,
        returnedCount: 0,
        exhausted: true,
        nextCursor: null,
      },
    };
  }

  const rawNextCursor =
    typeof result.meta?.nextCursor === "string" ? result.meta.nextCursor : "";

  const nextCursor =
    rawNextCursor.trim().length > 0 ? rawNextCursor.trim() : null;

  const exhausted =
    typeof result.meta?.exhausted === "boolean"
      ? result.meta.exhausted
      : nextCursor === null;

  if (result.ok === true) {
    assertProviderResult(adapter, result);
  }

  return {
    ...result,
    meta: {
      ...result.meta,
      nextCursor,
      exhausted,
    },
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
