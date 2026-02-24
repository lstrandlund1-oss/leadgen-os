// lib/providers/types.ts
import type { RawCompany, RawCompanySource } from "@/lib/types";

export type ProviderName = "mock" | "google_places" | "serp";

export type ProviderErrorCode =
  | "RATE_LIMITED"
  | "AUTH"
  | "BAD_REQUEST"
  | "UPSTREAM"
  | "TIMEOUT"
  | "UNKNOWN";

export type SocialPresenceFilter = "any" | "low" | "medium" | "high";

export type ProviderSearchIntent = {
  // Keep provider in intent (current pipeline depends on it)
  provider: ProviderName;

  query: string;

  // Location (human / structured)
  country?: string;
  city?: string;

  /**
   * Unified location field coming from UI.
   * Use this for "Stockholm", "Göteborg", etc.
   * Providers can interpret it as they want.
   */
  location?: string;

  /**
   * Free-form location text (optional, legacy-ish).
   * Keep if some providers use it (SERP / Places often do).
   */
  locationText?: string;

  // Geo (optional)
  lat?: number;
  lng?: number;
  radius_m?: number;

  // Pagination/limits
  limit?: number;
  page?: number;
  cursor?: string | null;

  // Optional hints / tracking
  nicheHint?: string;
  requestId?: string;

  /**
   * UI filter: used by mock now, later by real providers (or derived by enrichment).
   * "any" means do not filter.
   */
  socialPresence?: SocialPresenceFilter;
};

export type ProviderRecord = {
  // MUST match RawCompany.source domain (pipeline expects this)
  source: RawCompanySource;
  source_id: string;
  raw_payload: unknown;
  company: RawCompany;
};

export type ProviderResultMeta = {
  provider: ProviderName;

  // Keep optional to avoid breaking existing adapters
  requestId?: string;

  fetchedCount: number;
  returnedCount: number;

  nextCursor?: string | null;
  exhausted?: boolean;

  rateLimited?: boolean;
  retryAfterSeconds?: number;
};

export type ProviderError = {
  code: ProviderErrorCode;
  message: string;
  details?: unknown;

  // Default false if omitted (validator can normalize)
  retryable?: boolean;
};

export type ProviderResult =
  | { ok: true; records: ProviderRecord[]; meta: ProviderResultMeta }
  | { ok: false; error: ProviderError; meta: ProviderResultMeta };

export type ProviderAdapter = {
  name: ProviderName;
  search(intent: ProviderSearchIntent): Promise<ProviderResult>;
};




