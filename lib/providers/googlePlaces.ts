// lib/providers/googlePlaces.ts
import type { RawCompany } from "@/lib/types";
import type {
  ProviderAdapter,
  ProviderResult,
  ProviderRecord,
  ProviderSearchIntent,
  ProviderErrorCode,
} from "./types";

const PLACES_TEXT_SEARCH_URL =
  "https://places.googleapis.com/v1/places:searchText";

type GooglePlacesTextSearchResponse = {
  places?: GooglePlace[];
};

type GooglePlace = {
  id: string;
  formattedAddress?: string;
  rating?: number;
  websiteUri?: string;
  userRatingCount?: number;
  displayName?: { text?: string; languageCode?: string };

  types?: string[];
  primaryType?: string;
  businessStatus?: string;
};

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.trim().length === 0) throw new Error(`Missing env var: ${name}`);
  return v;
}

function asNonEmptyString(v: unknown): string | undefined {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : undefined;
}

function asFiniteNumber(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function isProviderSearchIntent(v: unknown): v is ProviderSearchIntent {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return typeof o.provider === "string" && typeof o.query === "string";
}

function mapStatusToErrorCode(status: number): ProviderErrorCode {
  if (status === 401 || status === 403) return "AUTH";
  if (status === 429) return "RATE_LIMITED";
  if (status === 400) return "BAD_REQUEST";
  if (status === 408) return "TIMEOUT";
  if (status >= 500) return "UPSTREAM";
  return "UNKNOWN";
}

function toProviderRecord(
  place: GooglePlace,
  query: string,
  city?: string,
): ProviderRecord {
  const name = asNonEmptyString(place.displayName?.text) ?? "Unknown";
  const businessStatus = place.businessStatus;

  // Use Google types if available, otherwise fallback to query
  const derivedCategories =
    Array.isArray(place.types) && place.types.length > 0
      ? place.types.filter(
          (t: unknown): t is string =>
            typeof t === "string" && t.trim().length > 0,
        )
      : [query.trim().toLowerCase()].filter((s) => s.length > 0);

  const company = {
    source: "google_places",
    sourceId: place.id,
    name,

    categories: derivedCategories,

    website: asNonEmptyString(place.websiteUri),

    // City comes from intent if available
    city: city ?? undefined,
    country: "SE",

    rating: asFiniteNumber(place.rating),
    review_count: asFiniteNumber(place.userRatingCount),

    // Keep full Google object for future intelligence layers
    rawPayload: place,
  } satisfies RawCompany;

  return {
    source: "google_places",
    source_id: place.id,
    raw_payload: place,
    company,
  };
}

export const googlePlacesAdapter: ProviderAdapter = {
  name: "google_places",

  async search(intent: unknown): Promise<ProviderResult> {
    if (!isProviderSearchIntent(intent)) {
      return {
        ok: false,
        error: {
          code: "BAD_REQUEST",
          message: "Invalid ProviderSearchIntent",
          retryable: false,
        },
        meta: {
          provider: "google_places",
          requestId: undefined,
          fetchedCount: 0,
          returnedCount: 0,
          exhausted: true,
          nextCursor: null,
        },
      };
    }

    const i = intent;
    const requestId = typeof i.requestId === "string" ? i.requestId : undefined;

    try {
      const apiKey = requireEnv("GOOGLE_MAPS_API_KEY");

      const query = i.query.trim();
      const location = typeof i.location === "string" ? i.location.trim() : "";
      const city = location.length > 0 ? location : undefined;

      const textQuery = location.length > 0 ? `${query} ${location}` : query;

      const res = await fetch(PLACES_TEXT_SEARCH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          // Required by Places API (New)
          "X-Goog-FieldMask": [
            "places.id",
            "places.displayName",
            "places.formattedAddress",
            "places.rating",
            "places.userRatingCount",
            "places.websiteUri",
            "places.types",
            "places.primaryType",
            "places.businessStatus",
            "places.location",
          ].join(","),
        },
        body: JSON.stringify({
          textQuery,
          languageCode: "sv",
          regionCode: "SE",
          pageSize: typeof i.limit === "number" ? i.limit : 25,
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        const code = mapStatusToErrorCode(res.status);
        return {
          ok: false,
          error: {
            code,
            message: `Google Places searchText failed (${res.status}): ${body}`,
            retryable: res.status >= 500 || res.status === 429,
          },
          meta: {
            provider: "google_places",
            requestId,
            fetchedCount: 0,
            returnedCount: 0,
            exhausted: true,
            nextCursor: null,
          },
        };
      }

      const data = (await res.json()) as GooglePlacesTextSearchResponse;
      const places = Array.isArray(data.places) ? data.places : [];

      const records: ProviderRecord[] = places
        // Skip dead businesses so they don't pollute runs
        .filter((p) => p.businessStatus !== "CLOSED_PERMANENTLY")
        // Basic sanity: must have an id
        .filter(
          (p): p is GooglePlace => typeof p?.id === "string" && p.id.length > 0,
        )
        .map((p) => toProviderRecord(p, query, city));

      return {
        ok: true,
        records,
        meta: {
          provider: "google_places",
          requestId,
          fetchedCount: places.length,
          returnedCount: records.length,
          exhausted: true,
          nextCursor: null,
        },
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      return {
        ok: false,
        error: {
          code: "UNKNOWN",
          message: msg,
          retryable: false,
        },
        meta: {
          provider: "google_places",
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
