// lib/fit/needs.ts
import type { WorkTypeSignal, ResistanceSignal } from "@/lib/scoring/opportunitySignals";

export type Capability =
  | "ads"
  | "tracking"
  | "funnel"
  | "content"
  | "website"
  | "seo"
  | "crm";

export type DerivedNeeds = {
  needs: Capability[];
  reasons: string[];
};

/**
 * Keep a central list of codes we intentionally support.
 * If your V2 signal unions change, update these arrays.
 */
const WORKTYPE_CODES = new Set<string>([
  "untapped_attention",
  "conversion_gap",
  "scaling_ready",
  "underexposed_quality",
]);

const RESISTANCE_CODES = new Set<string>([
  "mature_hard_target",
  "unstable_basics_missing",
  "reputation_risk",
  "trust_gap",
]);

function addNeed(
  set: Set<Capability>,
  reasons: string[],
  need: Capability,
  reason?: string,
) {
  set.add(need);
  if (reason) reasons.push(reason);
}

function dedupeStrings(items: string[]): string[] {
  const out: string[] = [];
  for (const x of items) if (!out.includes(x)) out.push(x);
  return out;
}

/**
 * Deterministic mapping:
 * signals -> capability needs
 *
 * IMPORTANT:
 * We purposely do not assume every signal.code exists forever.
 * We check membership against known code sets, but keep strings tolerant.
 */
export function deriveNeedsFromSignals(args: {
  workTypes: WorkTypeSignal[];
  resistances: ResistanceSignal[];
}): DerivedNeeds {
  const needs = new Set<Capability>();
  const reasons: string[] = [];

  for (const s of args.workTypes ?? []) {
    const code = String((s as { code?: unknown }).code ?? "");

    if (!WORKTYPE_CODES.has(code)) continue;

    if (code === "untapped_attention") {
      addNeed(needs, reasons, "ads", "Untapped attention → ads needed.");
      addNeed(needs, reasons, "content", "Untapped attention → content needed.");
    }

    if (code === "conversion_gap") {
      addNeed(needs, reasons, "funnel", "Conversion gap → funnel needed.");
      addNeed(needs, reasons, "tracking", "Conversion gap → tracking needed.");
      addNeed(needs, reasons, "website", "Conversion gap → website/LP needed.");
    }

    if (code === "scaling_ready") {
      addNeed(needs, reasons, "ads", "Scaling-ready → ads to increase volume.");
      addNeed(needs, reasons, "tracking", "Scaling-ready → tracking to measure growth.");
    }

    if (code === "underexposed_quality") {
      addNeed(needs, reasons, "ads", "Underexposed quality → ads to increase visibility.");
      addNeed(needs, reasons, "content", "Underexposed quality → content to build attention.");
    }
  }

  for (const s of args.resistances ?? []) {
    const code = String((s as { code?: unknown }).code ?? "");

    if (!RESISTANCE_CODES.has(code)) continue;

    if (code === "mature_hard_target") {
      addNeed(needs, reasons, "ads", "Mature competitor → sharper ads to displace.");
      addNeed(needs, reasons, "tracking", "Mature competitor → measurement to prove lift.");
    }

    if (code === "unstable_basics_missing" || code === "reputation_risk") {
      addNeed(needs, reasons, "website", "Unstable basics → website/foundation needed first.");
      addNeed(needs, reasons, "crm", "Unstable basics → ops/CRM may be required before scaling.");
    }

    if (code === "trust_gap") {
      addNeed(needs, reasons, "website", "Trust gap → website/landing page needed.");
    }
  }

  return {
    needs: Array.from(needs),
    reasons: dedupeStrings(reasons),
  };
}