// app/dashboard/dataLayer.ts
// All async data-fetching functions for the dashboard. No React imports.

import type { ProviderName } from "@/lib/providers/types";
import type { SocialPresenceFilter } from "@/lib/providers/types";
import type { LeadUI, LeadOutcomeUI, OutcomeKey } from "./types";

// ── Types ─────────────────────────────────────────────────────────────────────

type ProviderSearchResponse = {
  ok?: boolean;
  runId?: number | null;
  summary?: unknown;
  nextCursor?: string | null;
  exhausted?: boolean;
};

type RunLeadsResponse = {
  leads?: unknown;
};

// ── Provider search + leads fetch ─────────────────────────────────────────────

export async function runProviderSearchAndFetchLeads(args: {
  provider: ProviderName;
  niche: string;
  location: string;
  socialPresence: SocialPresenceFilter;
  runId?: number | null;
  cursor?: string | null;
}): Promise<{
  runId: number;
  leads: LeadUI[];
  nextCursor: string | null;
  exhausted: boolean;
} | null> {
  const niche = args.niche.trim();
  if (!niche) return null;

  const searchRes = await fetch("/api/providers/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: args.provider,
      query: niche,
      country: "Sweden",
      location: args.location.trim() || undefined,
      socialPresence: args.socialPresence,
      limit: 25,
      runId: args.runId ?? null,
      cursor: args.cursor ?? null,
    }),
  }).catch(() => null);

  if (!searchRes?.ok) return null;

  const searchData = (await searchRes.json().catch(() => ({}))) as ProviderSearchResponse;
  const runId = typeof searchData.runId === "number" ? searchData.runId : null;
  if (!runId) return null;

  const leadsRes = await fetch(`/api/providers/runs/${runId}/leads`).catch(() => null);
  if (!leadsRes?.ok) return null;

  const leadsData = (await leadsRes.json().catch(() => ({}))) as RunLeadsResponse;
  const incoming = leadsData?.leads ?? null;

  return {
    runId,
    leads: Array.isArray(incoming) ? (incoming as LeadUI[]) : [],
    nextCursor: searchData.nextCursor ?? null,
    exhausted: searchData.exhausted ?? false,
  };
}

// ── Outcome operations ────────────────────────────────────────────────────────

export async function fetchOutcomes(runId: number): Promise<LeadOutcomeUI[]> {
  const res = await fetch(`/api/outcomes?runId=${runId}`).catch(() => null);
  if (!res?.ok) return [];
  const data = await res.json().catch(() => ({ outcomes: [] })) as { outcomes?: LeadOutcomeUI[] };
  return Array.isArray(data.outcomes) ? data.outcomes : [];
}

export async function saveOutcome(args: {
  runId: number;
  leadId: string;
  key: OutcomeKey;
  value: boolean;
  revenue?: number | null;
  notes?: string | null;
}): Promise<boolean> {
  const patch: Record<string, unknown> = { [args.key]: args.value };
  if (args.revenue !== undefined) patch.revenue = args.revenue;
  if (args.notes !== undefined) patch.notes = args.notes;

  const res = await fetch("/api/outcomes", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      run_id: args.runId,
      lead_id: args.leadId,
      ...patch,
    }),
  }).catch(() => null);

  return res?.ok ?? false;
}

// ── Enrich (light) ────────────────────────────────────────────────────────────

export type LightEnrichmentResult = {
  reachable: boolean;
  fetchedUrl: string | null;
  errorReason: string | null;
  detectedPlatforms: string[];
  signals: Record<string, unknown>;
  updatedScore: unknown;
};

export async function runLightEnrichment(args: {
  website: string | null;
  reviewCount: number | null;
  rating: number | null;
  ownerResponseCount: number | null;
  socialPresence: "low" | "medium" | "high";
  isGoodFit: boolean;
  classificationConfidence: number | null;
  riskProfile: string;
}): Promise<LightEnrichmentResult | null> {
  const res = await fetch("/api/enrich/light", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  }).catch(() => null);

  if (!res?.ok) return null;

  const data = await res.json().catch(() => null);
  if (!data?.success) return null;

  return {
    reachable: data.reachable ?? false,
    fetchedUrl: data.fetchedUrl ?? null,
    errorReason: data.errorReason ?? null,
    detectedPlatforms: data.detectedPlatforms ?? [],
    signals: data.signals ?? {},
    updatedScore: data.updatedScore ?? null,
  };
}