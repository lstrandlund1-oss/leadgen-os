// app/api/providers/runs/[id]/leads/route.ts
import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabaseServiceClient";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getRawIdsForRun, getCachedScore, setCachedScore, buildSignalHash } from "@/lib/persistence";
import type { Lead, RawCompany, Classification, PrimaryIndustry } from "@/lib/types";
import { mapToLead } from "@/lib/mappers/leadMapper";
import {
  detectSignalsV2,
  getPrimaryWorkTypeInsight,
  getPrimaryResistanceInsight,
  type WorkTypeSignal,
  type ResistanceSignal,
} from "@/lib/scoring/opportunitySignals";
import { buildUserProfile, buildCapabilityProfile, isValidProfileTypeKey } from "@/lib/profile/profileTypes";
import { getAuthUser } from "@/lib/supabaseServer";
import type { UserProfileV1, CapabilityProfile } from "@/lib/types";
import { deriveGap, generateScript, inferSellerType, deriveDifficulty } from "@/lib/outreach/generateScript";
import { deriveNeedsFromSignals } from "@/lib/fit/needs";
import { scoreFit, type FitResult } from "@/lib/fit/fitScore";
import type { RiskProfile } from "@/lib/types";
import { classifyBusinessProfile, getDataLevel } from "@/lib/scoring/businessCondition";
import { computeUniversalScore } from "@/lib/scoring/universalScore";
import { bucketOpportunity } from "@/lib/scoring/buckets";

type RawRow = {
  id: number;
  source: string | null;
  source_id: string | null;
  payload: unknown;
};

type SocialPresence = "low" | "medium" | "high";
type SocialPresenceFilter = "any" | SocialPresence;

type RunRow = {
  id: number;
  intent: unknown; // jsonb
};

// Keep these legacy types loose to avoid coupling this route to exact JSON shape.
type OpportunitySignal = {
  type: string;
  message: string;
  strength: "high" | "medium" | "low";
};
type PrimaryInsight = OpportunitySignal | null;

type NormalizedRow = {
  raw_id: number;
  name: string | null;
  website: string | null;
  city: string | null;
  country: string | null;

  // NOTE: these may exist in DB but are now considered legacy and may be stale.
  opportunity_signals: OpportunitySignal[] | null;
  primary_insight: PrimaryInsight;
};

type ClassificationRow = {
  raw_id: number;
  primary_industry: string | null;
  sub_niche: string | null;
  is_good_fit: boolean | null;
  confidence: number | null;
  fit_reason: string | null;
  source: string | null;
};

type LeadWithSignals = Lead & {
  // Legacy (keep temporarily so UI doesn’t break)
  opportunitySignals?: OpportunitySignal[] | null;
  primaryInsight?: PrimaryInsight;

  // New structured outputs (what the UI should move to)
  workTypeSignals?: WorkTypeSignal[];
  resistanceSignals?: ResistanceSignal[];
  primaryWorkTypeInsight?: WorkTypeSignal | null;
  primaryResistanceInsight?: ResistanceSignal | null;

  // ✅ NEW: user-relative fit layer
  fit?: FitResult;
};

const IN_CLAUSE_CHUNK_SIZE = 250;

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function getString(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  return typeof v === "string" ? v : undefined;
}

function getNumber(obj: Record<string, unknown>, key: string): number | undefined {
  const v = obj[key];
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  if (size <= 0) return [Array.from(items)];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function coercePresenceFilter(v: unknown): SocialPresenceFilter {
  if (v === "low" || v === "medium" || v === "high" || v === "any") return v;
  return "any";
}

function coercePresence(v: unknown): SocialPresence | null {
  if (v === "low" || v === "medium" || v === "high") return v;
  return null;
}

function projectSocialPresence(input: {
  website: string | null | undefined;
  rating: number | null | undefined;
  reviewCount: number | null | undefined;
}): SocialPresence {
  const rc = typeof input.reviewCount === "number" ? input.reviewCount : 0;
  const rating = typeof input.rating === "number" ? input.rating : 0;
  const hasWebsite = !!(input.website && input.website.trim().length > 0);

  let points = 0;
  if (hasWebsite) points += 1;

  if (rc >= 200) points += 3;
  else if (rc >= 50) points += 2;
  else if (rc >= 10) points += 1;

  if (rating >= 4.6) points += 2;
  else if (rating >= 4.2) points += 1;

  if (points >= 5) return "high";
  if (points >= 3) return "medium";
  return "low";
}

function isPrimaryIndustry(value: string): value is PrimaryIndustry {
  return (
    value === "real_estate" ||
    value === "tattoo_studio" ||
    value === "beauty_clinic" ||
    value === "restaurant" ||
    value === "other"
  );
}

function normalizeRawCompany(r: RawRow): RawCompany & { socialPresence?: SocialPresence } {
  const payload = asRecord(r.payload);

  // normalize reviewCount -> review_count if older payloads exist
  if (payload["reviewCount"] != null && payload["review_count"] == null) {
    payload["review_count"] = payload["reviewCount"];
  }

  const source = (
    typeof r.source === "string" && r.source.trim().length > 0 ? r.source : "other"
  ) as RawCompany["source"];

  const sourceId = typeof r.source_id === "string" && r.source_id.trim().length > 0 ? r.source_id : "unknown";

  const rawName = getString(payload, "name");
  const name = rawName && rawName.trim().length > 0 ? rawName.trim() : "Unknown Company";

  const categories =
    Array.isArray(payload["categories"]) && (payload["categories"] as unknown[]).every((x) => typeof x === "string")
      ? (payload["categories"] as string[])
      : [];

  const website = getString(payload, "website");
  const address = getString(payload, "address");
  const city = getString(payload, "city");
  const country = getString(payload, "country");
  const description = getString(payload, "description");

  const rating = getNumber(payload, "rating");
  const review_count = getNumber(payload, "review_count");

  // optional explicit presence
  const socialPresence = coercePresence(payload["socialPresence"]) ?? undefined;

  return {
    source,
    sourceId,
    name,
    categories,
    website,
    address,
    city,
    country,
    description,
    rating,
    review_count,
    rawPayload: r.payload,
    ...(socialPresence ? { socialPresence } : {}),
  };
}

function normalizeClassification(c: ClassificationRow | null): Classification {
  if (!c) {
    return {
      primaryIndustry: "other",
      subNiche: "",
      serviceType: "other",
      b2b_b2c: "unknown",
      isGoodFit: false,
      fitScoreReason: "",
      confidence: 0,
      source: "rules",
    };
  }

  const primary: PrimaryIndustry = isPrimaryIndustry(c.primary_industry ?? "")
    ? (c.primary_industry as PrimaryIndustry)
    : "other";

  return {
    primaryIndustry: primary,
    subNiche: c.sub_niche ?? "",
    serviceType: "other",
    b2b_b2c: "unknown",
    isGoodFit: c.is_good_fit ?? false,
    fitScoreReason: c.fit_reason ?? "",
    confidence: c.confidence ?? 0,
    source: c.source === "ai" || c.source === "manual" ? c.source : "rules",
  };
}

async function fetchRunIntent(
  client: SupabaseClient,
  runId: number,
): Promise<{ socialPresence: SocialPresenceFilter }> {
  const { data, error } = await client.from("provider_runs").select("id, intent").eq("id", runId).single();

  if (error || !data) return { socialPresence: "any" };

  const row = data as RunRow;
  const intentObj = asRecord(row.intent);

  return {
    socialPresence: coercePresenceFilter(intentObj["socialPresence"]),
  };
}

async function fetchUserProfile(
  client: SupabaseClient,
  userId: string,
): Promise<{ profile: UserProfileV1; capabilities: CapabilityProfile }> {
  try {
    const { data, error } = await client
      .from("user_profiles")
      .select("profile_data, capabilities_data")
      .eq("id", userId)
      .maybeSingle();

    if (error || !data) {
      return {
        profile: buildUserProfile(userId, "performance_marketer"),
        capabilities: buildCapabilityProfile(userId, "performance_marketer"),
      };
    }

    const row = data as { profile_data: unknown; capabilities_data: unknown };
    const profileData = row.profile_data as UserProfileV1;
    const typeKey = isValidProfileTypeKey(profileData?.profileType ?? "")
      ? (profileData.profileType as Parameters<typeof buildUserProfile>[1])
      : "performance_marketer";

    return {
      profile: profileData,
      capabilities: (row.capabilities_data as CapabilityProfile) ?? buildCapabilityProfile(userId, typeKey),
    };
  } catch {
    return {
      profile: buildUserProfile(userId, "performance_marketer"),
      capabilities: buildCapabilityProfile(userId, "performance_marketer"),
    };
  }
}

async function fetchRawRowsByIds(client: SupabaseClient, ids: number[]): Promise<RawRow[]> {
  const parts = chunk(ids, IN_CLAUSE_CHUNK_SIZE);
  const all: RawRow[] = [];

  for (const part of parts) {
    const { data, error } = await client.from("companies_raw").select("id, source, source_id, payload").in("id", part);

    if (error) throw new Error(`Failed to fetch raw rows: ${error.message}`);
    all.push(...((data ?? []) as RawRow[]));
  }

  return all;
}

async function fetchNormalizedRowsByRawIds(client: SupabaseClient, ids: number[]): Promise<NormalizedRow[]> {
  const parts = chunk(ids, IN_CLAUSE_CHUNK_SIZE);
  const all: NormalizedRow[] = [];

  for (const part of parts) {
    const { data, error } = await client
      .from("companies_normalized")
      .select("raw_id, name, website, city, country, opportunity_signals, primary_insight")
      .in("raw_id", part);

    if (error) throw new Error(`Failed to fetch normalized rows: ${error.message}`);
    all.push(...((data ?? []) as NormalizedRow[]));
  }

  return all;
}

async function fetchClassificationRowsByRawIds(client: SupabaseClient, ids: number[]): Promise<ClassificationRow[]> {
  const parts = chunk(ids, IN_CLAUSE_CHUNK_SIZE);
  const all: ClassificationRow[] = [];

  for (const part of parts) {
    const { data, error } = await client
      .from("company_classifications")
      .select("raw_id, primary_industry, sub_niche, is_good_fit, confidence, fit_reason, source")
      .in("raw_id", part);

    if (error) throw new Error(`Failed to fetch classifications: ${error.message}`);
    all.push(...((data ?? []) as ClassificationRow[]));
  }

  return all;
}

function toLegacySignals(workTypes: WorkTypeSignal[], resistances: ResistanceSignal[]): OpportunitySignal[] {
  const all = [...resistances, ...workTypes];
  return all.map((s) => ({
    type: s.code,
    message: s.message,
    strength: s.strength,
  }));
}

function toLegacyPrimaryInsightFromWorkType(primary: WorkTypeSignal | null): PrimaryInsight {
  if (!primary) return null;
  return {
    type: primary.code,
    message: primary.message,
    strength: primary.strength,
  };
}

export async function GET(_request: Request, { params }: { params: { id: string } | Promise<{ id: string }> }) {
  try {
    const supabase = await getServiceClient();
    if (!supabase) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
    }

    const { id } = await Promise.resolve(params);
    const runId = Number(id);

    const { searchParams } = new URL(_request.url);

    const niche = searchParams.get("niche") ?? undefined;
    const locationStr = searchParams.get("location") ?? undefined;

    if (!Number.isFinite(runId) || runId <= 0) {
      return NextResponse.json({ error: "Invalid run id" }, { status: 400 });
    }

    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = authUser.id;

    const [runIntent, userProfileData] = await Promise.all([
      fetchRunIntent(supabase, runId),
      fetchUserProfile(supabase, userId),
    ]);
    const presenceFilter = runIntent.socialPresence;
    const activeProfile = userProfileData.profile;
    const activeCapabilities = userProfileData.capabilities;

    const rawIds = await getRawIdsForRun(runId);
    if (rawIds.length === 0) {
      return NextResponse.json({ runId, count: 0, leads: [] satisfies LeadWithSignals[] }, { status: 200 });
    }

    const rawRows = await fetchRawRowsByIds(supabase, rawIds);
    const fetchedIds = rawRows.map((r) => r.id);

    const [normRows, clsRows] = await Promise.all([
      fetchNormalizedRowsByRawIds(supabase, fetchedIds),
      fetchClassificationRowsByRawIds(supabase, fetchedIds),
    ]);

    const normByRawId = new Map<number, NormalizedRow>();
    for (const n of normRows) normByRawId.set(n.raw_id, n);

    const clsByRawId = new Map<number, ClassificationRow>();
    for (const c of clsRows) clsByRawId.set(c.raw_id, c);

    const rawById = new Map<number, RawRow>();
    for (const r of rawRows) rawById.set(r.id, r);

    const leadsRaw = await Promise.all(
      rawIds
        .map((rid) => rawById.get(rid))
        .filter((r): r is RawRow => !!r)
        .map(async (r) => {
          const rawCompany = normalizeRawCompany(r);
          const n = normByRawId.get(r.id);
          const classification = normalizeClassification(clsByRawId.get(r.id) ?? null);

          const website = n?.website ?? rawCompany.website ?? null;
          const rating = rawCompany.rating ?? 0;
          const reviews = rawCompany.review_count ?? 0;

          const computedPresence =
            rawCompany.socialPresence ?? projectSocialPresence({ website, rating, reviewCount: reviews });

          if (presenceFilter !== "any" && computedPresence !== presenceFilter) {
            return null;
          }

          const normalized = {
            name: n?.name ?? rawCompany.name,
            website,
            address: rawCompany.address ?? null,
            city: n?.city ?? rawCompany.city ?? null,
            country: n?.country ?? rawCompany.country ?? null,
          };

          const rawWithPresence = {
            ...rawCompany,
            socialPresence: computedPresence,
          };

          const lead = mapToLead({
            raw: rawWithPresence,
            normalized,
            classification,
            runId: String(runId),
          }) as LeadWithSignals;

          // ── STEP 1: Signals ─────────────────────────────────────────────────
          const hasWebsiteBool = !!(website && website.trim().length > 0);

          const { workTypes, resistances } = detectSignalsV2({
            rating,
            reviews,
            hasWebsite: hasWebsiteBool,
            socialPresence: computedPresence,
            categories: rawCompany.categories,
          });

          const primaryWork = getPrimaryWorkTypeInsight(workTypes);
          const primaryRes = getPrimaryResistanceInsight(resistances);

          lead.workTypeSignals = workTypes;
          lead.resistanceSignals = resistances;
          lead.primaryWorkTypeInsight = primaryWork;
          lead.primaryResistanceInsight = primaryRes;
          lead.opportunitySignals = toLegacySignals(workTypes, resistances);
          lead.primaryInsight = toLegacyPrimaryInsightFromWorkType(primaryWork);

          // ── STEP 2: Fit ──────────────────────────────────────────────────────
          const { needs, reasons: needReasons } = deriveNeedsFromSignals({
            workTypes,
            resistances,
          });

          const fit = scoreFit(activeProfile, activeCapabilities, needs, {
            city: lead.company.city,
            country: lead.company.country,
          });

          lead.fit = {
            fitScore: fit.fitScore,
            matchedNeeds: fit.matchedNeeds,
            missingNeeds: fit.missingNeeds,
            partialNeeds: fit.partialNeeds ?? [],
            geoMatch: fit.geoMatch,
            reasons: [...fit.reasons, ...needReasons],
            tooltip: fit.tooltip,
          };

          // ── STEP 3: Gap + outreach context ───────────────────────────────────
          const pitchContext = {
            hasWebsite: hasWebsiteBool,
            socialPresence: computedPresence,
            opportunity: 50, // placeholder — real value comes from universalScore below
            risk: 50,
            riskProfile: null as RiskProfile | null,
            fitScore: fit.fitScore,
            missingNeeds: fit.missingNeeds,
          };

          const sellerType = inferSellerType(activeProfile);
          const gap = deriveGap(pitchContext);
          const difficulty = deriveDifficulty(50, 50); // refined below

          // ── STEP 4: Business classification ──────────────────────────────────
          const businessProfile = classifyBusinessProfile({
            reviews,
            rating,
            hasWebsite: hasWebsiteBool,
            categories: rawCompany.categories,
            businessName: lead.company.name,
            socialPresence: computedPresence,
          });

          const dataLevel = getDataLevel(reviews, hasWebsiteBool);

          // ── STEP 5: Single-pass composite score (with cache) ─────────────────
          // Build a signal hash from the inputs that drive the score.
          // If signals haven't changed since last time, use the cached score.
          // If signals changed (new website, more reviews, etc.) recompute and save.
          const rawId = r.id as number;
          const signalHash = buildSignalHash({
            reviews,
            rating,
            hasWebsite: hasWebsiteBool,
            socialPresence: computedPresence,
            fitScore: fit.fitScore,
            gapType: gap,
          });

          const cachedEntry = await getCachedScore(userId, rawId);
          let scored: ReturnType<typeof computeUniversalScore>;

          if (cachedEntry && cachedEntry.signalHash === signalHash) {
            // Signals unchanged — use cached score (fast path, no recompute)
            const cs = cachedEntry.score;
            scored = {
              value: cs.value,
              opportunity: cs.opportunity,
              risk: cs.risk,
              readiness: cs.readiness,
              riskProfile: cs.riskProfile as ReturnType<typeof computeUniversalScore>["riskProfile"],
              breakdown: cs.breakdown as ReturnType<typeof computeUniversalScore>["breakdown"],
              tooltips: cs.tooltips as ReturnType<typeof computeUniversalScore>["tooltips"],
              evidenceLevel: cs.evidenceLevel as ReturnType<typeof computeUniversalScore>["evidenceLevel"],
              reasons: [],
            };
          } else {
            // Signals changed or no cache — recompute
            scored = computeUniversalScore({
              reviews,
              rating,
              hasWebsite: hasWebsiteBool,
              socialPresence: computedPresence,
              riskProfile: businessProfile,
              fitScore: fit.fitScore,
              fitTooltip: fit.tooltip,
              gapType: gap,
              classificationConfidence: lead.classification.confidence ?? null,
            });

            // Persist the new score (fire-and-forget — don't block the response)
            setCachedScore(
              userId,
              rawId,
              {
                value: scored.value,
                opportunity: scored.opportunity,
                risk: scored.risk,
                readiness: scored.readiness,
                riskProfile: businessProfile,
                breakdown: scored.breakdown as Record<string, number>,
                tooltips: scored.tooltips as Record<string, string>,
                evidenceLevel: scored.evidenceLevel ?? "low",
                scoredAt: new Date().toISOString(),
              },
              signalHash,
            ).catch(() => {});
          }

          lead.score = {
            ...scored,
            riskProfile: businessProfile,
          };

          // ── STEP 6: Outreach script ───────────────────────────────────────────
          const refinedDifficulty = deriveDifficulty(scored.opportunity, scored.risk);

          const outreach = generateScript({
            industry: niche ?? undefined,
            city: locationStr ?? undefined,
            sellerType,
            gap,
            difficulty: refinedDifficulty,
            ctx: {
              ...pitchContext,
              opportunity: scored.opportunity,
              risk: scored.risk,
              riskProfile: businessProfile,
            },
          });

          lead.metadata = {
            ...lead.metadata,
            outreach,
            dataLevel,
            opportunityMeta: {
              confidence:
                scored.evidenceLevel === "high"
                  ? 0.9
                  : scored.evidenceLevel === "medium"
                    ? 0.7
                    : scored.evidenceLevel === "low"
                      ? 0.5
                      : 0.3,
              reasons: scored.reasons,
              bucket: bucketOpportunity(scored.opportunity),
            },
          };

          return lead;
        }),
    );
    const leads: LeadWithSignals[] = leadsRaw.filter((x): x is LeadWithSignals => x !== null && x !== undefined);

    return NextResponse.json({ runId, count: leads.length, leads }, { status: 200 });
  } catch (err) {
    console.error("/api/providers/runs/[id]/leads GET error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
