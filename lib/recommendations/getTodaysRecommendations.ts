// lib/recommendations/getTodaysRecommendations.ts
//
// Assembles "what should I work on today" — joins a user's scored
// companies (company_intelligence) with their outcome history
// (lead_outcomes) and applies the deterministic priority formula in
// priorityScore.ts. This is the data layer for the Home experience
// (Week 2 of the rebuild) — no UI here, just the ranked result set a
// future Home page will render.

import { getServiceClient } from "@/lib/supabaseServiceClient";
import { computePriorityScore } from "./priorityScore";

export type RecommendedOpportunity = {
  rawId: number;
  leadId: string;
  runId: number | null;
  name: string;
  city: string | null;
  country: string | null;
  website: string | null;
  opportunityValue: number;
  priorityScore: number;
  isContacted: boolean;
  isReplied: boolean;
  followupOverdue: boolean;
  scoredAt: string;
  // The one genuinely available piece of "why this matters" text —
  // companies_normalized.primary_insight is a real, computed signal
  // (detectOpportunitySignals/getPrimaryInsight, no profile input, purely
  // factual about the company itself). Null when no signal was strong
  // enough to surface one — shown as no gap text at all rather than a
  // fabricated placeholder.
  detectedGap: string | null;
  // Fuller "Because: ..." breakdown — up to 3 real, computed signals
  // (opportunity_signals), sorted strongest first. Same underlying data
  // as detectedGap (which is just reasons[0]), already computed and
  // stored per company, just not previously queried beyond the single
  // strongest one. Empty array when nothing was strong enough to surface.
  reasons: string[];
};

// Pool size fetched from company_intelligence before ranking — large
// enough to give the priority formula real material to work with (a
// user with hundreds of scored companies shouldn't just see whatever
// happened to be scored most recently), small enough to stay a fast,
// single query rather than loading a user's entire history.
const CANDIDATE_POOL_SIZE = 150;

export async function getTodaysRecommendations(userId: string, limit: number = 5): Promise<RecommendedOpportunity[]> {
  const client = await getServiceClient();
  if (!client) return [];

  const { data: intelligence } = await client
    .from("company_intelligence")
    .select("raw_id, score, scored_at")
    .eq("user_id", userId)
    .order("scored_at", { ascending: false })
    .limit(CANDIDATE_POOL_SIZE);

  if (!intelligence || intelligence.length === 0) return [];

  const rawIds = intelligence.map((i) => i.raw_id as number);

  const [{ data: rawRows }, { data: normalizedRows }, { data: runRaws }] = await Promise.all([
    client.from("companies_raw").select("id, source, source_id").in("id", rawIds),
    client
      .from("companies_normalized")
      .select("raw_id, name, city, country, website, duplicate_of_raw_id, primary_insight, opportunity_signals")
      .in("raw_id", rawIds),
    client.from("provider_run_raws").select("run_id, raw_id").in("raw_id", rawIds),
  ]);

  const rawById = new Map((rawRows ?? []).map((r) => [r.id as number, r]));
  const normalizedByRawId = new Map((normalizedRows ?? []).map((n) => [n.raw_id as number, n]));
  const runIdByRawId = new Map((runRaws ?? []).map((r) => [r.raw_id as number, r.run_id as number]));

  // Build lead_id ("source:source_id") for each candidate, since outcomes
  // are keyed by that composite string, not raw_id directly.
  const leadIdByRawId = new Map<number, string>();
  for (const rawId of rawIds) {
    const raw = rawById.get(rawId);
    if (raw) leadIdByRawId.set(rawId, `${raw.source}:${raw.source_id}`);
  }

  const leadIds = Array.from(leadIdByRawId.values());
  const { data: outcomes } = leadIds.length
    ? await client.from("lead_outcomes").select("*").eq("user_id", userId).in("lead_id", leadIds)
    : { data: [] };

  // A lead can appear across multiple runs (found in more than one
  // search) — if so, take whichever outcome row shows the most progress,
  // not just the first one encountered.
  const outcomeByLeadId = new Map<string, NonNullable<typeof outcomes>[number]>();
  for (const outcome of outcomes ?? []) {
    const existing = outcomeByLeadId.get(outcome.lead_id as string);
    if (!existing || outcomeRank(outcome) > outcomeRank(existing)) {
      outcomeByLeadId.set(outcome.lead_id as string, outcome);
    }
  }

  const today = new Date();
  const candidates: RecommendedOpportunity[] = [];

  for (const entry of intelligence) {
    const rawId = entry.raw_id as number;
    const normalized = normalizedByRawId.get(rawId);
    // Skip anything already flagged as a cross-provider duplicate (see
    // migration 0016) — only the canonical record should ever be
    // recommended, not every provider's copy of the same business.
    if (normalized?.duplicate_of_raw_id) continue;

    const leadId = leadIdByRawId.get(rawId);
    if (!leadId) continue;

    const outcome = outcomeByLeadId.get(leadId);
    const isClosed = !!outcome?.closed;
    const isContacted = !!outcome?.contacted;
    const isReplied = !!outcome?.replied;
    const followupOverdue = !!(
      outcome?.followup_date &&
      !isClosed &&
      new Date(outcome.followup_date as string) <= today
    );

    const score = entry.score as { value?: number; opportunity?: number } | null;
    const opportunityValue = score?.value ?? score?.opportunity ?? 0;

    const scoredAt = entry.scored_at as string;
    const daysSinceScored = Math.max(0, (today.getTime() - new Date(scoredAt).getTime()) / (1000 * 60 * 60 * 24));

    const priorityScore = computePriorityScore({
      opportunityValue,
      isContacted,
      isReplied,
      isClosed,
      followupOverdue,
      daysSinceScored,
    });

    if (priorityScore === -Infinity) continue; // closed — never recommend

    const insight = normalized?.primary_insight as { message?: string } | null;
    const allSignals = (normalized?.opportunity_signals as { message?: string; strength?: string }[] | null) ?? [];
    const strengthRank: Record<string, number> = { high: 3, medium: 2, low: 1 };
    const reasons = allSignals
      .filter((s) => !!s.message)
      .sort((a, b) => (strengthRank[b.strength ?? ""] ?? 0) - (strengthRank[a.strength ?? ""] ?? 0))
      .slice(0, 3)
      .map((s) => s.message as string);

    candidates.push({
      rawId,
      leadId,
      runId: runIdByRawId.get(rawId) ?? null,
      name: normalized?.name ?? "Unknown",
      city: normalized?.city ?? null,
      country: normalized?.country ?? null,
      website: normalized?.website ?? null,
      opportunityValue,
      priorityScore,
      isContacted,
      isReplied,
      followupOverdue,
      scoredAt,
      detectedGap: insight?.message ?? null,
      reasons,
    });
  }

  candidates.sort((a, b) => b.priorityScore - a.priorityScore);
  return candidates.slice(0, limit);
}

// Ranks outcome progress so the most-advanced state wins when the same
// lead appears across multiple runs. Order matches the pipeline stages
// from the rebuild spec: closed > booked_call > replied > contacted > none.
function outcomeRank(outcome: {
  closed?: boolean;
  booked_call?: boolean;
  replied?: boolean;
  contacted?: boolean;
}): number {
  if (outcome.closed) return 4;
  if (outcome.booked_call) return 3;
  if (outcome.replied) return 2;
  if (outcome.contacted) return 1;
  return 0;
}
