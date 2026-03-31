// app/dashboard/types.ts
// All UI-local types for the dashboard. Extracted from page.tsx for maintainability.

import type { Lead, Language } from "@/lib/types";

export type OpportunitySignal = {
  type: string;
  message: string;
  strength: "high" | "medium" | "low";
};

export type FitUI = {
  fitScore: number;
  matchedNeeds: string[];
  missingNeeds: string[];
  partialNeeds?: string[];
  reasons: string[];
  tooltip?: string;
  geoMatch?: "exact" | "partial" | "none" | "unset";
};

export type LeadUI = Lead & {
  opportunitySignals?: OpportunitySignal[] | null;
  primaryInsight?: OpportunitySignal | null;
  fit?: FitUI;
  primaryWorkTypeInsight?: {
    code: string;
    message: string;
    strength: "high" | "medium" | "low";
  } | null;
  primaryResistanceInsight?: {
    code: string;
    message: string;
    strength: "high" | "medium" | "low";
  } | null;
};

export type LeadOutcomeUI = {
  run_id: number;
  lead_id: string;
  contacted: boolean;
  replied: boolean;
  booked_call: boolean;
  closed: boolean;
  revenue: number | null;
  notes: string | null;
};

export type OutcomeKey = "contacted" | "replied" | "booked_call" | "closed";

export const OUTCOME_STATUS_KEYS: readonly OutcomeKey[] = [
  "contacted",
  "replied",
  "booked_call",
  "closed",
] as const;