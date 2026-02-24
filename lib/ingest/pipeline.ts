// lib/ingest/pipeline.ts
import type { RawCompany } from "@/lib/types";
import { classifyCompany } from "@/lib/classification";
import { scoreLead } from "@/lib/scoring";

import {
  detectOpportunitySignals,
  getPrimaryInsight,
} from "@/lib/scoring/opportunitySignals";

import {
  persistNormalizedCompany,
  persistClassification,
} from "@/lib/persistence";

export async function runPipelineForRaw(
  rawId: number,
  raw: RawCompany
): Promise<void> {
  // 1) normalized
  // NOTE: Your current design persists a normalized company from `raw`.
  // If/when you want to persist opportunity signals too, the best place to attach them
  // is inside persistNormalizedCompany() where the normalized object is assembled.
  await persistNormalizedCompany(rawId, raw);

  // 2) classification (pure)
  const classification = classifyCompany(raw);

  // 3) persist classification
  await persistClassification(rawId, classification);

  // 4) scoring is computed deterministically as needed by API/UI
  // We do NOT need to persist scoring unless you already have a table for it.
  scoreLead(raw, classification);

  // 5) opportunity signals (computed deterministically as needed by API/UI)
  // Same philosophy as scoring: pipeline "knows" how to compute it,
  // but we don't persist unless you add a table / column.
  const signals = detectOpportunitySignals(raw, classification);
  getPrimaryInsight(signals);
}
