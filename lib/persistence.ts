import { getServiceClient } from "@/lib/supabaseServiceClient";
import { RawCompany, Classification } from "@/lib/types";
import type { ProviderSearchIntent, ProviderName } from "@/lib/providers/types";

import { detectOpportunitySignals, getPrimaryInsight } from "@/lib/scoring/opportunitySignals";
import { normalizeDomain } from "@/lib/ingest/normalizeDomain";

export async function createProviderRun(params: {
  provider: ProviderName;
  intentHash: string;
  intent: ProviderSearchIntent;
  requestId?: string;
}): Promise<number | null> {
  const supabase = await getServiceClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("provider_runs")
    .insert({
      provider: params.provider,
      intent_hash: params.intentHash,
      request_id: params.requestId ?? null,
      intent: params.intent,
      status: "running",
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    // If unique constraint hits, fetch existing run id.
    const { data: existing } = await supabase
      .from("provider_runs")
      .select("id")
      .eq("provider", params.provider)
      .eq("intent_hash", params.intentHash)
      .single();

    return existing?.id ?? null;
  }

  return data?.id ?? null;
}

/**
 * H2.15: Retry semantics require reusing the same run row for (provider, intent_hash).
 * This resets the run into a "running" state and clears previous attempt outputs/errors.
 */
export async function resetProviderRunForRetry(runId: number): Promise<number | null> {
  const supabase = await getServiceClient();
  if (!supabase) return null;
  if (!runId || runId <= 0) return null;

  const { data, error } = await supabase
    .from("provider_runs")
    .update({
      status: "running",
      started_at: new Date().toISOString(),
      finished_at: null,

      // Clear prior attempt outputs
      fetched_count: 0,
      returned_count: 0,
      inserted_raw: 0,
      skipped_duplicates: 0,
      next_cursor: null,
      exhausted: false,

      // Clear prior errors
      error_code: null,
      error_message: null,
    })
    .eq("id", runId)
    .select("id")
    .single();

  if (error) {
    console.error("provider_runs reset-for-retry error:", error.message);
    return null;
  }

  return data?.id ?? null;
}

export async function attachRawIdsToRun(runId: number, rawIds: number[]): Promise<void> {
  const supabase = await getServiceClient();
  if (!supabase) return;
  if (!runId || rawIds.length === 0) return;

  const rows = rawIds.map((rawId) => ({ run_id: runId, raw_id: rawId }));

  const { error } = await supabase.from("provider_run_raws").upsert(rows, { onConflict: "run_id,raw_id" });

  if (error) {
    console.error("provider_run_raws upsert error:", error.message);
  }
}

export async function getProviderRunByIntentHash(params: { provider: ProviderName; intentHash: string }): Promise<{
  id: number;
  provider: string;
  status: string;
  fetched_count: number;
  returned_count: number;
  inserted_raw: number;
  skipped_duplicates: number;
  next_cursor: string | null;
  exhausted: boolean;
  request_id: string | null;
  intent: unknown;
  created_at: string;
  error_code: string | null;
  error_message: string | null;
} | null> {
  const supabase = await getServiceClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("provider_runs")
    .select(
      "id, provider, status, fetched_count, returned_count, inserted_raw, skipped_duplicates, next_cursor, exhausted, request_id, intent, created_at, error_code, error_message",
    )
    .eq("provider", params.provider)
    .eq("intent_hash", params.intentHash)
    .single();

  if (error) return null;
  return data ?? null;
}

export async function getRawIdsForRun(runId: number): Promise<number[]> {
  const supabase = await getServiceClient();
  if (!supabase) return [];

  const { data, error } = await supabase.from("provider_run_raws").select("raw_id").eq("run_id", runId);

  if (error || !data) return [];

  return data
    .map((row) => (typeof row?.raw_id === "number" ? row.raw_id : null))
    .filter((v): v is number => v !== null);
}

export async function finalizeProviderRun(params: {
  runId: number;
  status: "success" | "error";
  fetchedCount: number;
  returnedCount: number;
  insertedRaw: number;
  skippedDuplicates: number;
  nextCursor?: string | null;
  exhausted?: boolean;
  errorCode?: string;
  errorMessage?: string;
}): Promise<void> {
  const supabase = await getServiceClient();
  if (!supabase) return;

  const { error } = await supabase
    .from("provider_runs")
    .update({
      status: params.status,
      fetched_count: params.fetchedCount,
      returned_count: params.returnedCount,
      inserted_raw: params.insertedRaw,
      skipped_duplicates: params.skippedDuplicates,
      next_cursor: params.nextCursor ?? null,
      exhausted: params.exhausted ?? false,
      error_code: params.errorCode ?? null,
      error_message: params.errorMessage ?? null,
      finished_at: new Date().toISOString(),
    })
    .eq("id", params.runId);

  if (error) {
    console.error("provider_runs finalize error:", error.message);
  }
}

export async function persistRawCompany(raw: RawCompany): Promise<number | null> {
  const supabase = await getServiceClient();
  if (!supabase) return null;

  const payload = raw.rawPayload ?? raw;

  const { data, error } = await supabase
    .from("companies_raw")
    .upsert(
      {
        source: raw.source,
        source_id: raw.sourceId,
        payload,
      },
      { onConflict: "source,source_id" },
    )
    .select("id")
    .single();

  if (error) {
    console.error("companies_raw upsert error:", error.message);
    return null;
  }

  return data?.id ?? null;
}

/**
 * Simple deterministic heuristic.
 * If you already have a better socialPresence projection elsewhere,
 * replace this with your existing logic so everything stays consistent.
 */
function deriveSocialPresence(raw: RawCompany): "low" | "medium" | "high" {
  const reviews = raw.review_count ?? 0;
  const rating = raw.rating ?? 0;
  const hasWebsite = !!raw.website;

  if (reviews >= 150 && rating >= 4.3 && hasWebsite) return "high";
  if (reviews >= 40 && hasWebsite) return "medium";
  return "low";
}

export async function persistNormalizedCompany(rawId: number, raw: RawCompany): Promise<void> {
  const supabase = await getServiceClient();
  if (!supabase) return;

  // --- NEW: compute opportunity insight at the same time we persist normalized ---
  // This prevents recomputation in API/UI and makes every lead "actionable" by default.
  const normalizedForSignals = {
    rating: raw.rating ?? 0,
    reviews: raw.review_count ?? 0,
    hasWebsite: !!raw.website,
    socialPresence: deriveSocialPresence(raw),
    categories: raw.categories ?? [],
  };

  const opportunitySignals = detectOpportunitySignals(normalizedForSignals);
  const primaryInsight = getPrimaryInsight(opportunitySignals);

  // Deduplication upgrade: the same real business found via a different
  // provider has a completely different (source, source_id), so the
  // existing per-source dedup never catches it. Domain matching catches
  // it here — the raw record itself is still kept untouched (provenance
  // preserved), this only records which OTHER raw_id represents the same
  // business, so the read side can collapse them for display.
  //
  // normalized_domain is stored as its own indexed column specifically so
  // this is a direct, exact-match lookup — not a fetch-and-filter over an
  // arbitrary subset of rows, which wouldn't scale and could silently miss
  // real duplicates once the table grows past a couple hundred rows.
  let duplicateOfRawId: number | null = null;
  const normalizedWebsite = normalizeDomain(raw.website);
  if (normalizedWebsite) {
    const { data: match } = await supabase
      .from("companies_normalized")
      .select("raw_id, duplicate_of_raw_id")
      .eq("normalized_domain", normalizedWebsite)
      .neq("raw_id", rawId)
      .limit(1)
      .maybeSingle();

    if (match) {
      // Point at whatever that match's own canonical raw_id already is
      // (in case it's itself already marked as a duplicate of something
      // else), rather than chaining duplicate-of-a-duplicate pointers.
      duplicateOfRawId = (match.duplicate_of_raw_id as number | null) ?? (match.raw_id as number);
    }
  }

  const { error } = await supabase.from("companies_normalized").upsert(
    {
      raw_id: rawId,
      name: raw.name,
      address: raw.address ?? null,
      city: raw.city ?? null,
      country: raw.country ?? null,
      website: raw.website ?? null,
      categories: raw.categories ?? [],
      rating: raw.rating ?? null,
      review_count: raw.review_count ?? null,

      // 🔥 NEW FIELDS (requires jsonb columns)
      opportunity_signals: opportunitySignals,
      primary_insight: primaryInsight,
      duplicate_of_raw_id: duplicateOfRawId,
      normalized_domain: normalizedWebsite,
    },
    { onConflict: "raw_id" },
  );

  if (error) {
    console.error("companies_normalized upsert error:", error.message);
  }
}

export async function persistClassification(rawId: number, classification: Classification): Promise<void> {
  const supabase = await getServiceClient();
  if (!supabase) return;

  const { error } = await supabase.from("company_classifications").upsert(
    {
      raw_id: rawId,
      primary_industry: classification.primaryIndustry,
      sub_niche: classification.subNiche,
      service_type: classification.serviceType,
      b2b_b2c: classification.b2b_b2c,
      is_good_fit: classification.isGoodFit,
      fit_reason: classification.fitScoreReason,
      confidence: classification.confidence,
      source: classification.source,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "raw_id" },
  );

  if (error) {
    console.error("company_classifications upsert error:", error.message);
  }
}

export async function getRawCompanyById(rawId: number): Promise<RawCompany | null> {
  const supabase = await getServiceClient();
  if (!supabase) return null;

  const { data, error } = await supabase.from("companies_raw").select("payload").eq("id", rawId).single();

  if (error) {
    console.error("companies_raw select error:", error.message);
    return null;
  }

  const payload: unknown = data?.payload;

  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const p = payload as Record<string, unknown>;

    // normalize reviewCount -> review_count
    if (p.reviewCount != null && p.review_count == null) {
      p.review_count = p.reviewCount;
    }

    return p as unknown as RawCompany;
  }

  return null;
}

// ── Score cache ───────────────────────────────────────────────────────────────
// Scores are cached in companies_normalized alongside the company data.
// A signal_hash captures the inputs that produced the score.
// If signals change (new website, more reviews, etc.) the hash changes
// and the score is recomputed and updated.

export type CachedScore = {
  value: number;
  opportunity: number;
  risk: number;
  readiness: number;
  riskProfile: string;
  breakdown: Record<string, number>;
  tooltips: Record<string, string>;
  evidenceLevel: string;
  scoredAt: string;
};

export function buildSignalHash(inputs: {
  reviews: number;
  rating: number;
  hasWebsite: boolean;
  socialPresence: string;
  fitScore: number;
  gapType: string;
}): string {
  // Simple deterministic hash of the scoring inputs
  const str = JSON.stringify({
    r: inputs.reviews,
    ra: Math.round(inputs.rating * 10) / 10,
    w: inputs.hasWebsite,
    s: inputs.socialPresence,
    f: Math.round(inputs.fitScore),
    g: inputs.gapType,
  });
  // FNV-1a hash
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

// Per-user scoring cache. Previously this read/wrote a shared field on
// companies_normalized, keyed only by signal_hash — but the score embeds
// fitScore, which depends on the requesting user's own profile and
// capabilities, so different users could see each other's cached scores.
// See migration 0015 for the full explanation. Keyed by (user_id, raw_id),
// still gated by signal_hash so a genuine change in the company's own
// data (not the user's profile) correctly invalidates the cache.
export async function getCachedScore(
  userId: string,
  rawId: number,
): Promise<{ score: CachedScore; signalHash: string } | null> {
  const supabase = await getServiceClient();
  if (!supabase) return null;
  try {
    const { data } = await supabase
      .from("company_intelligence")
      .select("score, signal_hash")
      .eq("user_id", userId)
      .eq("raw_id", rawId)
      .maybeSingle();
    if (!data?.score || !data?.signal_hash) return null;
    return { score: data.score as CachedScore, signalHash: data.signal_hash as string };
  } catch {
    return null;
  }
}

export async function setCachedScore(
  userId: string,
  rawId: number,
  score: CachedScore,
  signalHash: string,
): Promise<void> {
  const supabase = await getServiceClient();
  if (!supabase) return;
  try {
    const { error } = await supabase
      .from("company_intelligence")
      .upsert(
        { user_id: userId, raw_id: rawId, score, signal_hash: signalHash, scored_at: new Date().toISOString() },
        { onConflict: "user_id,raw_id" },
      );
    if (error) console.error("company_intelligence upsert error:", error.message);
  } catch (err) {
    console.error("setCachedScore error:", err);
  }
}
