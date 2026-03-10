// lib/providers/serp.ts
//
// SerpApi adapter for LeadGenOS.
// Uses the SerpApi Google Maps search endpoint to find local businesses
// by niche + location query. Falls back gracefully when API key is missing.
//
// Required env: SERP_API_KEY
// Docs: https://serpapi.com/google-maps-api

import type {
  ProviderAdapter,
  ProviderResult,
  ProviderRecord,
  ProviderSearchIntent,
  ProviderErrorCode,
} from "./types";
import type { RawCompany } from "@/lib/types";

const SERP_API_BASE = "https://serpapi.com/search.json";

// ── SerpApi response types ────────────────────────────────────────────────────

type SerpPlaceResult = {
  place_id?: string;
  data_id?: string;
  title?: string;
  type?: string;
  types?: string[];
  website?: string;
  address?: string;
  rating?: number;
  reviews?: number;
  reviews_original?: string;
  phone?: string;
  hours?: Record<string, string>;
  thumbnail?: string;
  gps_coordinates?: { latitude?: number; longitude?: number };
};

type SerpMapsResponse = {
  error?: string;
  local_results?: SerpPlaceResult[];
  serpapi_pagination?: {
    next?: string;
    next_page_token?: string;
  };
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function asNonEmptyString(v: unknown): string | undefined {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : undefined;
}

function asFiniteNumber(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/,/g, ""));
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function mapStatus(status: number): ProviderErrorCode {
  if (status === 401 || status === 403) return "AUTH";
  if (status === 429) return "RATE_LIMITED";
  if (status === 400) return "BAD_REQUEST";
  if (status === 408) return "TIMEOUT";
  if (status >= 500) return "UPSTREAM";
  return "UNKNOWN";
}

function extractCity(address: string | undefined): string | undefined {
  if (!address) return undefined;
  // "Sveavägen 1, 111 57 Stockholm, Sweden" → "Stockholm"
  const parts = address.split(",").map((s) => s.trim());
  if (parts.length >= 2) {
    const candidate = parts[parts.length - 2];
    // Strip postal codes: "111 57 Stockholm" → "Stockholm"
    const stripped = candidate.replace(/^\d[\d\s]+/, "").trim();
    return stripped.length > 0 ? stripped : candidate;
  }
  return undefined;
}

function extractCountry(address: string | undefined): string | undefined {
  if (!address) return undefined;
  const parts = address.split(",").map((s) => s.trim());
  return parts.length > 0 ? parts[parts.length - 1] : undefined;
}

function toProviderRecord(
  place: SerpPlaceResult,
  query: string,
): ProviderRecord {
  const sourceId =
    asNonEmptyString(place.place_id) ??
    asNonEmptyString(place.data_id) ??
    `serp_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  const name = asNonEmptyString(place.title) ?? "Unknown";
  const address = asNonEmptyString(place.address);
  const city = extractCity(address);
  const country = extractCountry(address);

  const derivedCategories: string[] =
    Array.isArray(place.types) && place.types.length > 0
      ? place.types
      : asNonEmptyString(place.type)
      ? [place.type as string]
      : [query.toLowerCase().trim()].filter((s) => s.length > 0);

  const company: RawCompany = {
    source: "serp",
    sourceId,
    name,
    categories: derivedCategories,
    website: asNonEmptyString(place.website),
    address: address ?? undefined,
    city: city ?? undefined,
    country: country ?? undefined,
    rating: asFiniteNumber(place.rating),
    review_count: asFiniteNumber(place.reviews),
    rawPayload: place,
  };

  return {
    source: "serp",
    source_id: sourceId,
    raw_payload: place,
    company,
  };
}

// ── Adapter ───────────────────────────────────────────────────────────────────

export const serpAdapter: ProviderAdapter = {
  name: "serp",

  async search(intent: ProviderSearchIntent): Promise<ProviderResult> {
    const requestId = intent.requestId;

    const apiKey = process.env.SERP_API_KEY;
    if (!apiKey || apiKey.trim().length === 0) {
      return {
        ok: false,
        error: {
          code: "AUTH",
          message: "SERP_API_KEY is not configured. Add it to your .env.local file.",
          retryable: false,
        },
        meta: {
          provider: "serp",
          requestId,
          fetchedCount: 0,
          returnedCount: 0,
          exhausted: true,
          nextCursor: null,
        },
      };
    }

    const query = intent.query.trim();
    const location =
      typeof intent.location === "string" ? intent.location.trim() : "";
    const fullQuery = location.length > 0 ? `${query} ${location}` : query;

    // SerpApi uses ll= for gps or q= for text queries
    // We'll use the text query approach for maximum compatibility
    const params = new URLSearchParams({
      engine: "google_maps",
      q: fullQuery,
      api_key: apiKey,
      type: "search",
      hl: "en",
    });

    // Pagination: SerpApi uses start= offset or next_page_token
    if (typeof intent.cursor === "string" && intent.cursor.trim().length > 0) {
      params.set("next_page_token", intent.cursor.trim());
    }

    if (typeof intent.limit === "number") {
      // SerpApi returns ~20 per page, limit hints intent
      // No direct page_size param — just pass start for offset
    }

    const url = `${SERP_API_BASE}?${params.toString()}`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15_000);

      const res = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": "LeadGenOS/1.0" },
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        const code = mapStatus(res.status);
        return {
          ok: false,
          error: {
            code,
            message: `SerpApi returned ${res.status}: ${body.slice(0, 200)}`,
            retryable: res.status >= 500 || res.status === 429,
          },
          meta: {
            provider: "serp",
            requestId,
            fetchedCount: 0,
            returnedCount: 0,
            exhausted: true,
            nextCursor: null,
          },
        };
      }

      const data = (await res.json()) as SerpMapsResponse;

      if (data.error) {
        return {
          ok: false,
          error: {
            code: "UPSTREAM",
            message: `SerpApi error: ${data.error}`,
            retryable: false,
          },
          meta: {
            provider: "serp",
            requestId,
            fetchedCount: 0,
            returnedCount: 0,
            exhausted: true,
            nextCursor: null,
          },
        };
      }

      const places = Array.isArray(data.local_results)
        ? data.local_results
        : [];

      const nextCursor =
        asNonEmptyString(data.serpapi_pagination?.next_page_token) ?? null;

      const records: ProviderRecord[] = places
        .filter((p): p is SerpPlaceResult => typeof p === "object" && p !== null)
        .map((p) => toProviderRecord(p, query));

      return {
        ok: true,
        records,
        meta: {
          provider: "serp",
          requestId,
          fetchedCount: places.length,
          returnedCount: records.length,
          exhausted: nextCursor === null,
          nextCursor,
        },
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      const isTimeout = msg.includes("abort") || msg.includes("timeout");
      return {
        ok: false,
        error: {
          code: isTimeout ? "TIMEOUT" : "UNKNOWN",
          message: msg,
          retryable: isTimeout,
        },
        meta: {
          provider: "serp",
          requestId,
          fetchedCount: 0,
          returnedCount: 0,
          exhausted: true,
          nextCursor: null,
        },
      };
    }
  },
};