// lib/ingest/pipeline.ts
import type { RawCompany } from "@/lib/types";
import { classifyCompany } from "@/lib/classification";
import { scoreLead } from "@/lib/scoring";
import { extractSignals } from "@/lib/signals/extractSignals";

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
  raw: RawCompany,
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
  const signalSet = extractSignals({
    rating: raw.rating ?? null,
    reviewCount: raw.review_count ?? null,
    website: raw.website ?? null,
    socialPresence: null,
    classificationConfidence: classification.confidence ?? null,
    isGoodFit: classification.isGoodFit ?? null,
  });

  scoreLead({
    raw,
    classification,
    signals: signalSet,
  });

  const opportunitySignals = detectOpportunitySignals({
    rating: raw.rating ?? 0,
    reviews: raw.review_count ?? 0,
    hasWebsite: Boolean(raw.website),
    socialPresence: "medium",
    categories: raw.categories ?? undefined,
  });

  getPrimaryInsight(opportunitySignals);
}
