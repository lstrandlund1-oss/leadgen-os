// lib/pipeline/getPipelineOverview.ts
//
// Groups a user's opportunities into pipeline stages for the Pipeline
// page (Week 2 of the rebuild). Reconciled with the EXISTING outcome
// states rather than inventing new ones the spec's fuller stage list
// (Qualified, Proposal) doesn't have data for yet — per the rebuild
// spec's own instruction: "Reconcile with existing outcome states. Do
// not create unnecessary complexity."
//
// Stages, in order: Recommended (scored, never touched) -> Contacted ->
// Replied -> Meeting (booked_call) -> Won / Lost (closed, split by
// whether lost_reason is set — the same convention already established
// in app/api/outcomes/route.ts).

import { getServiceClient } from "@/lib/supabaseServiceClient";

export type PipelineStage = "recommended" | "contacted" | "replied" | "meeting" | "won" | "lost";

export type PipelineOpportunity = {
  rawId: number;
  leadId: string;
  runId: number | null;
  name: string;
  city: string | null;
  stage: PipelineStage;
  revenue: number | null;
};

export type PipelineOverview = {
  stages: Record<PipelineStage, PipelineOpportunity[]>;
  totalActiveCount: number; // everything not won/lost
  totalWonRevenue: number; // real, actual revenue — never an estimate
};

const EMPTY_STAGES: Record<PipelineStage, PipelineOpportunity[]> = {
  recommended: [],
  contacted: [],
  replied: [],
  meeting: [],
  won: [],
  lost: [],
};

export async function getPipelineOverview(userId: string): Promise<PipelineOverview> {
  const client = await getServiceClient();
  if (!client) return { stages: EMPTY_STAGES, totalActiveCount: 0, totalWonRevenue: 0 };

  const { data: intelligence } = await client.from("company_intelligence").select("raw_id").eq("user_id", userId);

  if (!intelligence || intelligence.length === 0) {
    return { stages: EMPTY_STAGES, totalActiveCount: 0, totalWonRevenue: 0 };
  }

  const rawIds = intelligence.map((i) => i.raw_id as number);

  const [{ data: rawRows }, { data: normalizedRows }, { data: runRaws }] = await Promise.all([
    client.from("companies_raw").select("id, source, source_id").in("id", rawIds),
    client.from("companies_normalized").select("raw_id, name, city, duplicate_of_raw_id").in("raw_id", rawIds),
    client.from("provider_run_raws").select("run_id, raw_id").in("raw_id", rawIds),
  ]);

  const rawById = new Map((rawRows ?? []).map((r) => [r.id as number, r]));
  const normalizedByRawId = new Map((normalizedRows ?? []).map((n) => [n.raw_id as number, n]));
  const runIdByRawId = new Map((runRaws ?? []).map((r) => [r.raw_id as number, r.run_id as number]));

  const leadIdByRawId = new Map<number, string>();
  for (const rawId of rawIds) {
    const raw = rawById.get(rawId);
    if (raw) leadIdByRawId.set(rawId, `${raw.source}:${raw.source_id}`);
  }

  const leadIds = Array.from(leadIdByRawId.values());
  const { data: outcomes } = leadIds.length
    ? await client.from("lead_outcomes").select("*").eq("user_id", userId).in("lead_id", leadIds)
    : { data: [] };

  const outcomeByLeadId = new Map<string, NonNullable<typeof outcomes>[number]>();
  for (const outcome of outcomes ?? []) {
    const existing = outcomeByLeadId.get(outcome.lead_id as string);
    if (!existing || outcomeStageRank(outcome) > outcomeStageRank(existing)) {
      outcomeByLeadId.set(outcome.lead_id as string, outcome);
    }
  }

  const stages: Record<PipelineStage, PipelineOpportunity[]> = {
    recommended: [],
    contacted: [],
    replied: [],
    meeting: [],
    won: [],
    lost: [],
  };

  let totalWonRevenue = 0;

  for (const rawId of rawIds) {
    const normalized = normalizedByRawId.get(rawId);
    // Same rule as the recommendation engine: skip cross-provider
    // duplicates, only the canonical record is ever shown.
    if (normalized?.duplicate_of_raw_id) continue;

    const leadId = leadIdByRawId.get(rawId);
    if (!leadId) continue;

    const outcome = outcomeByLeadId.get(leadId);
    const stage = classifyStage(outcome);

    const opportunity: PipelineOpportunity = {
      rawId,
      leadId,
      runId: runIdByRawId.get(rawId) ?? null,
      name: normalized?.name ?? "Unknown",
      city: normalized?.city ?? null,
      stage,
      revenue: (outcome?.revenue as number | null) ?? null,
    };

    stages[stage].push(opportunity);
    if (stage === "won" && opportunity.revenue) totalWonRevenue += opportunity.revenue;
  }

  const totalActiveCount =
    stages.recommended.length + stages.contacted.length + stages.replied.length + stages.meeting.length;

  return { stages, totalActiveCount, totalWonRevenue };
}

export function classifyStage(
  outcome:
    | {
        closed?: boolean;
        lost_reason?: string | null;
        booked_call?: boolean;
        replied?: boolean;
        contacted?: boolean;
      }
    | undefined,
): PipelineStage {
  if (!outcome) return "recommended";
  if (outcome.closed) return outcome.lost_reason ? "lost" : "won";
  if (outcome.booked_call) return "meeting";
  if (outcome.replied) return "replied";
  if (outcome.contacted) return "contacted";
  return "recommended";
}

// Same progress ranking as the recommendation engine — when the same
// lead appears across multiple runs, the most-advanced outcome wins.
function outcomeStageRank(outcome: {
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
