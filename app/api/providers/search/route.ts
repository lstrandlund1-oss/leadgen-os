// app/api/providers/search/route.ts
import { NextResponse } from "next/server";
import type { ProviderName, ProviderSearchIntent } from "@/lib/providers/types";
import { ingestFromProvider } from "@/lib/ingest/ingest";
import { rateLimitDb } from "@/lib/rateLimitDb";
import { getCachedRun } from "@/lib/ingest/cache";

const GLOBAL_LIMIT = { limit: 30, windowMs: 60_000 }; // 30/min per caller
const PROVIDER_LIMIT = { limit: 10, windowMs: 60_000 }; // 10/min per caller+provider

const PROVIDERS: ProviderName[] = ["mock", "google_places", "serp"];

type SocialPresence = "low" | "medium" | "high";
type SocialPresenceFilter = "any" | SocialPresence;

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

function getString(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  return typeof v === "string" ? v : undefined;
}

function getNumber(obj: Record<string, unknown>, key: string): number | undefined {
  const v = obj[key];
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function normalizeSocialPresenceFilter(v: unknown): SocialPresenceFilter | undefined {
  // Accept UI variants: "" means “no filter”
  if (v === "" || v == null) return "any";
  if (v === "any" || v === "low" || v === "medium" || v === "high") return v;
  return undefined;
}

export async function POST(request: Request) {
  try {
    const body = asRecord(await request.json());

    const providerRaw = getString(body, "provider");
    const provider =
      typeof providerRaw === "string" ? (providerRaw as ProviderName) : null;

    if (!provider || !PROVIDERS.includes(provider)) {
      return NextResponse.json(
        { error: "Missing or invalid 'provider'" },
        { status: 400 },
      );
    }

    const queryRaw = getString(body, "query");
    if (!queryRaw || queryRaw.trim().length === 0) {
      return NextResponse.json({ error: "Missing or invalid 'query'" }, { status: 400 });
    }

    const requestIdRaw = getString(body, "requestId");
    const requestId =
      typeof requestIdRaw === "string" && requestIdRaw.trim().length > 0
        ? requestIdRaw.trim()
        : makeRequestId();

    // Canonical filters (must affect caching + provider output)
    const locationRaw = getString(body, "location");
    const location =
      typeof locationRaw === "string" && locationRaw.trim().length > 0
        ? locationRaw.trim()
        : undefined;

    const socialPresence = normalizeSocialPresenceFilter(body["socialPresence"]);

    const intent: ProviderSearchIntent = {
      provider,
      query: queryRaw.trim(),

      // existing fields
      country: getString(body, "country"),
      city: getString(body, "city"),
      locationText: getString(body, "locationText"),

      lat: getNumber(body, "lat"),
      lng: getNumber(body, "lng"),
      radius_m: getNumber(body, "radius_m"),

      limit: getNumber(body, "limit"),
      page: getNumber(body, "page"),
      cursor:
        typeof body["cursor"] === "string"
          ? (body["cursor"] as string)
          : body["cursor"] === null
            ? null
            : undefined,

      nicheHint: getString(body, "nicheHint"),

      // ✅ NEW: canonical filters
      location,
      // If ProviderSearchIntent.socialPresence is optional, this is safe.
      // If it’s required, this still satisfies it because we default ""/null -> "any".
      socialPresence: socialPresence,

      requestId,
    };

    // Cache-first (now varies by socialPresence + location)
    const cached = await getCachedRun(intent);
    if (cached.hit && cached.summary) {
      return NextResponse.json(
        {
          ok: true,
          runId: cached.summary.runId ?? null,
          summary: cached.summary,
        },
        { status: 200 },
      );
    }

    // Rate limit only on cache miss
    const caller = getCallerId(request);

    const globalKey = `providers:global:${caller}`;
    const g = await rateLimitDb({ key: globalKey, ...GLOBAL_LIMIT });
    if (!g.ok) {
      return rateLimitedResponse(g.retryAfterSeconds, "Global rate limit exceeded");
    }

    const providerKey = `providers:${intent.provider}:${caller}`;
    const p = await rateLimitDb({ key: providerKey, ...PROVIDER_LIMIT });
    if (!p.ok) {
      return rateLimitedResponse(
        p.retryAfterSeconds,
        `Rate limit exceeded for provider '${intent.provider}'`,
      );
    }

    const summary = await ingestFromProvider(intent);

    return NextResponse.json(
      {
        ok: summary.status === "success",
        runId: summary.runId ?? null,
        summary,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("/api/providers/search error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

function getCallerId(request: Request): string {
  const xf = request.headers.get("x-forwarded-for");
  if (xf) {
    const first = xf.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;

  return "dev";
}

function rateLimitedResponse(retryAfterSeconds: number, message: string) {
  return new NextResponse(JSON.stringify({ error: message, retryAfterSeconds }), {
    status: 429,
    headers: {
      "Content-Type": "application/json",
      "Retry-After": String(retryAfterSeconds),
    },
  });
}

function makeRequestId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return c.randomUUID();
  return `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}
