// lib/providers/index.ts
import type {
  ProviderAdapter,
  ProviderName,
  ProviderSearchIntent,
  ProviderResult,
} from "./types";

import { mockAdapter } from "./mock/adapter";
import { assertProviderResult } from "./validate";

const registry: Record<ProviderName, ProviderAdapter> = {
  mock: mockAdapter,

  // Stubs: return well-formed ProviderResult with an explicit error.
  google_places: {
    name: "google_places",
    async search(intent) {
      return {
        ok: false,
        error: {
          code: "UNKNOWN",
          message: "google_places adapter not implemented yet",
          retryable: false,
        },
        meta: {
          provider: "google_places",
          requestId: intent.requestId,
          fetchedCount: 0,
          returnedCount: 0,
          nextCursor: null,
          exhausted: true,
        },
      };
    },
  },

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
  intent: ProviderSearchIntent
): Promise<ProviderResult> {
  const adapter = getProviderAdapter(intent.provider);

  // Enforce sane defaults at the gateway boundary (not in adapters)
  const safeIntent: ProviderSearchIntent = {
    ...intent,
    limit: clamp(intent.limit ?? 25, 1, 200),
  };

  const result = await adapter.search(safeIntent);

  // HARDENING GATE:
  // If ok=true, validate records before anything can touch the DB.
  // If ok=false, we just return the result and let the caller decide how to persist the failure.
  if (result.ok === true) {
    assertProviderResult(adapter, result);
  }

  return result;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}


