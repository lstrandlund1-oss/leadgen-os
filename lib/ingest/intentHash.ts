// lib/ingest/intentHash.ts
import type { ProviderSearchIntent } from "@/lib/providers/types";

export function intentHash(intent: ProviderSearchIntent): string {
  // Hash only stable fields (NO requestId)
  const canonical = {
    provider: intent.provider,
    query: intent.query,
    country: intent.country,
    city: intent.city,
    locationText: intent.locationText,
    lat: intent.lat,
    lng: intent.lng,
    radius_m: intent.radius_m,
    limit: intent.limit,
    page: intent.page,
    cursor: intent.cursor,
    nicheHint: intent.nicheHint,
  };

  const stable = stableStringify(canonical);
  return fnv1a(stable);
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);

  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};

    for (const key of Object.keys(obj).sort()) {
      out[key] = sortKeys(obj[key]);
    }

    return out;
  }

  return value;
}

function fnv1a(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

