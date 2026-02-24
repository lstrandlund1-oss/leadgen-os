// lib/fit/needs.ts
import type {
  WorkTypeSignal,
  ResistanceSignal,
} from "@/lib/scoring/opportunitySignals";
import type { PrimaryIndustry } from "@/lib/types";

export type Capability =
  | "ads"
  | "tracking"
  | "funnel"
  | "content"
  | "website"
  | "seo"
  | "crm";

export type WeightedNeed = {
  key: Capability;
  label: string;
  weight: number; // 1–5
};

export type DerivedNeeds = {
  needs: WeightedNeed[];
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

const NEED_LABEL: Record<Capability, string> = {
  ads: "Ads",
  tracking: "Tracking",
  funnel: "Funnel",
  content: "Content",
  website: "Website/Landing page",
  seo: "SEO",
  crm: "CRM/Follow-up",
};

function dedupeStrings(items: string[]): string[] {
  const out: string[] = [];
  for (const x of items) if (!out.includes(x)) out.push(x);
  return out;
}

function addNeed(
  map: Map<Capability, WeightedNeed>,
  reasons: string[],
  key: Capability,
  weight: number,
  reason?: string,
) {
  const existing = map.get(key);
  if (!existing || weight > existing.weight) {
    map.set(key, { key, label: NEED_LABEL[key], weight });
  }
  if (reason) reasons.push(reason);
}

/**
 * Baseline needs by industry.
 * This is NOT "capabilities"—it’s what that industry typically needs to grow.
 * Signals will upgrade (increase weight) or add extra needs.
 */
const BASE_NEEDS_BY_INDUSTRY: Record<PrimaryIndustry, Array<Pick<WeightedNeed, "key" | "weight">>> =
  {
    real_estate: [
      { key: "ads", weight: 5 },
      { key: "funnel", weight: 5 },
      { key: "tracking", weight: 4 },
      { key: "crm", weight: 3 },
      { key: "website", weight: 2 },
    ],
    tattoo_studio: [
      { key: "content", weight: 5 },
      { key: "ads", weight: 4 },
      { key: "website", weight: 2 },
    ],
    beauty_clinic: [
      { key: "ads", weight: 5 },
      { key: "funnel", weight: 4 },
      { key: "content", weight: 4 },
      { key: "tracking", weight: 3 },
      { key: "website", weight: 3 },
      { key: "crm", weight: 2 },
    ],
    restaurant: [
      { key: "seo", weight: 5 },
      { key: "content", weight: 3 },
      { key: "website", weight: 2 },
    ],
    other: [
      { key: "ads", weight: 3 },
      { key: "content", weight: 3 },
      { key: "website", weight: 2 },
    ],
  };

/**
 * Deterministic mapping:
 * signals -> weighted needs
 *
 * IMPORTANT:
 * We do not assume every signal.code exists forever.
 * We check membership against known code sets.
 */
export function deriveNeedsFromSignals(args: {
  workTypes: WorkTypeSignal[];
  resistances: ResistanceSignal[];
}): DerivedNeeds {
  const needs = new Map<Capability, WeightedNeed>();
  const reasons: string[] = [];

  for (const s of args.workTypes ?? []) {
    const code =
      typeof s.code === "string" && s.code.trim().length > 0 ? s.code : "";
    if (!WORKTYPE_CODES.has(code)) continue;

    if (code === "untapped_attention") {
      addNeed(needs, reasons, "ads", 5, "Untapped attention → ads needed.");
      addNeed(
        needs,
        reasons,
        "content",
        4,
        "Untapped attention → content needed.",
      );
    }

    if (code === "conversion_gap") {
      addNeed(needs, reasons, "funnel", 5, "Conversion gap → funnel needed.");
      addNeed(
        needs,
        reasons,
        "tracking",
        5,
        "Conversion gap → tracking needed.",
      );
      addNeed(
        needs,
        reasons,
        "website",
        5,
        "Conversion gap → website/LP needed.",
      );
    }

    if (code === "scaling_ready") {
      addNeed(
        needs,
        reasons,
        "ads",
        4,
        "Scaling-ready → ads to increase volume.",
      );
      addNeed(
        needs,
        reasons,
        "tracking",
        4,
        "Scaling-ready → tracking to measure growth.",
      );
      addNeed(
        needs,
        reasons,
        "crm",
        3,
        "Scaling-ready → follow-up/CRM to capture increased demand.",
      );
    }

    if (code === "underexposed_quality") {
      addNeed(
        needs,
        reasons,
        "ads",
        4,
        "Underexposed quality → ads to increase visibility.",
      );
      addNeed(
        needs,
        reasons,
        "content",
        4,
        "Underexposed quality → content to build attention.",
      );
    }
  }

  for (const s of args.resistances ?? []) {
    const code =
      typeof s.code === "string" && s.code.trim().length > 0 ? s.code : "";
    if (!RESISTANCE_CODES.has(code)) continue;

    if (code === "mature_hard_target") {
      addNeed(
        needs,
        reasons,
        "ads",
        4,
        "Mature competitor → sharper ads to displace.",
      );
      addNeed(
        needs,
        reasons,
        "tracking",
        4,
        "Mature competitor → measurement to prove lift.",
      );
      addNeed(
        needs,
        reasons,
        "funnel",
        3,
        "Mature competitor → conversion system matters more.",
      );
    }

    if (code === "unstable_basics_missing" || code === "reputation_risk") {
      addNeed(
        needs,
        reasons,
        "website",
        5,
        "Unstable basics → website/foundation needed first.",
      );
      addNeed(
        needs,
        reasons,
        "crm",
        4,
        "Unstable basics → CRM/ops may be needed before scaling.",
      );
    }

    if (code === "trust_gap") {
      addNeed(
        needs,
        reasons,
        "website",
        5,
        "Trust gap → website/landing page needed.",
      );
    }
  }

  return {
    needs: Array.from(needs.values()),
    reasons: dedupeStrings(reasons),
  };
}

/**
 * Complementary layer:
 * baseline (industry + facts) + signals
 *
 * This is the “make differences obvious” upgrade.
 */
export function deriveNeedsForLead(args: {
  primaryIndustry: PrimaryIndustry;
  hasWebsite: boolean;
  socialPresence: "low" | "medium" | "high" | null;
  workTypes: WorkTypeSignal[];
  resistances: ResistanceSignal[];
}): DerivedNeeds {
  const needs = new Map<Capability, WeightedNeed>();
  const reasons: string[] = [];

  const base = BASE_NEEDS_BY_INDUSTRY[args.primaryIndustry] ?? BASE_NEEDS_BY_INDUSTRY.other;
  for (const n of base) {
    addNeed(
      needs,
      reasons,
      n.key,
      n.weight,
      `Baseline (${args.primaryIndustry}) → ${NEED_LABEL[n.key]}.`,
    );
  }

  if (!args.hasWebsite) {
    addNeed(needs, reasons, "website", 5, "No website → website/LP is required.");
    addNeed(needs, reasons, "funnel", 4, "No website → funnel capture is required.");
  }

  if (args.socialPresence === "low") {
    addNeed(needs, reasons, "content", 5, "Low social presence → content engine required.");
    addNeed(needs, reasons, "ads", 5, "Low social presence → ads needed to create demand.");
  }

  const fromSignals = deriveNeedsFromSignals({
    workTypes: args.workTypes,
    resistances: args.resistances,
  });

  for (const n of fromSignals.needs) {
    addNeed(needs, reasons, n.key, n.weight, undefined);
  }
  reasons.push(...fromSignals.reasons);

  return { needs: Array.from(needs.values()), reasons: dedupeStrings(reasons) };
}