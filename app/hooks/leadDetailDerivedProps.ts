// app/hooks/leadDetailDerivedProps.ts
//
// LeadDetailModal needs several derived values that aren't part of
// useLeadDetailPanel's own state - they're computed from it
// (selectedOutcome, safeOutreach, scriptText, etc.). Dashboard computes
// these inline; this is the same formulas extracted into one function so
// Pipeline can compute the exact same values without a second,
// separately-maintained copy of the logic.

import type { Language } from "@/lib/types";
import type { LeadUI, LeadOutcomeUI, OutreachVariant } from "@/app/dashboard/page";
import { getLocalizedOpportunityInsight } from "@/app/dashboard/helpers";
import type { EnrichmentData } from "./useLeadDetailPanel";

export function computeLeadDetailDerivedProps(opts: {
  selectedLead: LeadUI | null;
  outcomesByLeadId: Record<string, LeadOutcomeUI>;
  enrichmentData: EnrichmentData;
  outreachVariant: OutreachVariant;
  language: Language;
}) {
  const { selectedLead, outcomesByLeadId, enrichmentData, outreachVariant, language } = opts;

  const selectedOutcome = selectedLead ? (outcomesByLeadId[selectedLead.id] ?? null) : null;
  const safeOutreach = (selectedLead?.metadata?.outreach ?? null) as {
    angleTitle?: string;
    angleWhy?: string;
    script?: string;
    variants?: Record<string, string>;
  } | null;
  const safeEnrichment = enrichmentData;
  const runIdNum = Number(selectedLead?.metadata?.runId ?? 0);
  const contacted = selectedOutcome?.contacted ?? false;
  const replied = selectedOutcome?.replied ?? false;
  const bookedCall = selectedOutcome?.booked_call ?? false;
  const detailInsight = selectedLead ? getLocalizedOpportunityInsight(selectedLead, language) : null;
  const detailWebsiteUrl = selectedLead?.company.website ?? undefined;
  const enrichmentSignals = safeEnrichment?.signals ?? {};
  const isReachable = safeEnrichment?.reachable ?? false;
  const detectedPlatforms = safeEnrichment?.detectedPlatforms ?? [];
  const angleTitle = safeOutreach?.angleTitle ?? "";
  const angleWhy = safeOutreach?.angleWhy ?? "";
  const outreachScript = safeOutreach?.variants?.[outreachVariant] ?? "";
  const scriptText = outreachScript.trim();

  return {
    selectedOutcome,
    safeOutreach,
    safeEnrichment,
    runIdNum,
    contacted,
    replied,
    bookedCall,
    detailInsight,
    detailWebsiteUrl,
    enrichmentSignals,
    isReachable,
    detectedPlatforms,
    angleTitle,
    angleWhy,
    scriptText,
  };
}
