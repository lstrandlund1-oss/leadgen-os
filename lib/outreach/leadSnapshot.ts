// lib/outreach/leadSnapshot.ts
//
// Converts a full LeadUI into the lighter LeadSnapshot shape the
// Outreach page works with. Extracted from LeadDetailModal's inline
// "Open in Outreach" mapping so the new deep-link flow (task
// notifications -> Outreach) can build the exact same snapshot without
// a second, separately-maintained copy of the field mapping.

import type { LeadUI } from "@/app/dashboard/page";

export type OutreachLeadSnapshot = {
  id: string;
  company_name: string;
  industry: string | null;
  city: string | null;
  website: string | null;
  rating: number | null;
  review_count: number | null;
  social_presence: string | null;
  opportunity: number;
  readiness: number;
  risk: number;
  signals: Record<string, unknown>;
  matched_needs: string[];
  missing_needs: string[];
  fit_score: number;
};

export function leadUIToOutreachSnapshot(
  lead: LeadUI,
  enrichmentSignals: Record<string, unknown> = {},
): OutreachLeadSnapshot {
  return {
    id: lead.id,
    company_name: lead.company.name,
    industry: lead.classification.primaryIndustry ?? null,
    city: lead.company.city ?? null,
    website: lead.company.website ?? null,
    rating: lead.metrics.rating ?? null,
    review_count: lead.metrics.reviewCount ?? null,
    social_presence: lead.metrics.socialPresence ?? null,
    opportunity: lead.score.opportunity,
    readiness: lead.score.readiness,
    risk: lead.score.risk,
    signals: enrichmentSignals,
    matched_needs: lead.fit?.matchedNeeds ?? [],
    missing_needs: lead.fit?.missingNeeds ?? [],
    fit_score: lead.fit?.fitScore ?? 0,
  };
}
