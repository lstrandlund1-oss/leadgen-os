"use client";

import { Fragment, useEffect, useMemo, useState, FormEvent } from "react";
import type { Lead, Language, SearchRecord } from "@/lib/types";
import type { ProviderName } from "@/lib/providers/types";
import { getTranslations } from "@/lib/i18n";
import type { TranslationSchema as Translations } from "@/lib/i18n/types";
import type { SocialPresenceFilter } from "@/lib/providers/types";

const STORAGE_KEY = "leadgen_os_state_v1";

// ---------------------
// UI-only enrichment
// ---------------------
type OpportunitySignal = {
  type: string;
  message: string;
  strength: "high" | "medium" | "low";
};

type FitUI = {
  fitScore: number; // 0-100
  matchedNeeds: string[];
  missingNeeds: string[];
  reasons: string[];
};

type LeadUI = Lead & {
  // Legacy (still tolerated while DB/UI migrates)
  opportunitySignals?: OpportunitySignal[] | null;
  primaryInsight?: OpportunitySignal | null;

  // ✅ NEW
  fit?: FitUI;

  // New (preferred when present)
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

type LeadOutcomeUI = {
  run_id: number;
  lead_id: string;
  contacted: boolean;
  replied: boolean;
  booked_call: boolean;
  closed: boolean;
  revenue: number | null;
  notes: string | null;
};

type OutcomeKey = "contacted" | "replied" | "booked_call" | "closed";

const OUTCOME_STATUS_KEYS: readonly OutcomeKey[] = [
  "contacted",
  "replied",
  "booked_call",
  "closed",
] as const;

function outcomeLabel(k: OutcomeKey, t: Translations): string {
  switch (k) {
    case "contacted":
      return t.ui.detail.contacted;
    case "replied":
      return t.ui.detail.replied;
    case "booked_call":
      return t.ui.detail.booked;
    case "closed":
      return t.ui.detail.closed;
  }
}

function buildOutcomePatch(
  key: OutcomeKey,
  value: boolean,
): Partial<Record<OutcomeKey, boolean>> {
  const patch: Partial<Record<OutcomeKey, boolean>> = {};
  patch[key] = value;
  return patch;
}

function leadLocation(lead: Lead): string {
  const parts = [lead.company.city, lead.company.country].filter(Boolean);
  return parts.length ? parts.join(", ") : "Unknown";
}

function bandLabel(language: Language, n: number): string {
  const v = Math.max(0, Math.min(100, Math.round(n)));
  const level = v >= 70 ? "high" : v >= 45 ? "medium" : "low";

  if (language === "sv") {
    if (level === "high") return "Hög";
    if (level === "medium") return "Medium";
    return "Låg";
  }
  return level === "high" ? "High" : level === "medium" ? "Medium" : "Low";
}

// ---------------------
// Insight selection + localization
// ---------------------

function localizeOpportunityMessage(
  signal: OpportunitySignal | null | undefined,
  language: Language,
): string | null {
  if (!signal) return null;

  if (signal.type === "conversion_gap") {
    return language === "sv"
      ? "Stark reputation men ingen webbplats — tydligt konverteringsgap."
      : "Strong reputation but no website — clear conversion gap.";
  }

  if (signal.type === "mature_competitor") {
    return language === "sv"
      ? "Stark närvaro + starkt proof — troligen redan väloptimerad (svårare att vinna)."
      : "Strong presence + strong proof — likely already well-served (harder to win).";
  }

  if (signal.type === "visibility_gap") {
    return language === "sv"
      ? "Webbplats finns men få recensioner — synlighets-/räckviddsgap."
      : "Website exists but low reviews — visibility/reach gap.";
  }

  if (signal.type === "foundation_gap") {
    return language === "sv"
      ? "Låg grundnivå (få recensioner + ingen webbplats) — kräver foundation först."
      : "Low foundation (few reviews + no website) — needs fundamentals first.";
  }

  const sv: Record<string, string> = {
    conversion_gap:
      "Starka recensioner men ingen webbplats — tydlig konverteringspotential.",
    trust_gap: "Ingen webbplats — konverteringsfriktion och tappat förtroende.",
    untapped_attention:
      "Hög efterfrågan men svag närvaro — tydlig content-lucka.",
    underexposed_quality: "Hög kvalitet men låg synlighet — tillväxtmöjlighet.",
    scaling_ready:
      "Stabil grund men det skalar inte — redo för ett tillväxtsystem.",
  };

  const en: Record<string, string> = {
    conversion_gap:
      "Strong reputation but no website — high conversion upside.",
    trust_gap: "No website — conversion + trust friction.",
    untapped_attention: "High demand but weak social presence — content gap.",
    underexposed_quality:
      "High quality service but low visibility — growth opportunity.",
    scaling_ready: "Stable base but not scaling — ready for a growth system.",
  };

  const dict = language === "sv" ? sv : en;
  return dict[signal.type] ?? signal.message ?? null;
}

function deriveDeterministicOpportunityFallback(
  lead: LeadUI,
): OpportunitySignal | null {
  const rating = lead.metrics?.rating ?? 0;
  const reviews = lead.metrics?.reviewCount ?? 0;
  const hasWebsite = Boolean(lead.company?.website);

  const strongReputation = rating >= 4.3 && reviews >= 80;
  const veryStrongReputation = rating >= 4.4 && reviews >= 150;
  const weakReputation = reviews < 15;

  if (strongReputation && !hasWebsite) {
    return { type: "conversion_gap", strength: "high", message: "" };
  }
  if (veryStrongReputation && hasWebsite) {
    return { type: "mature_competitor", strength: "high", message: "" };
  }
  if (hasWebsite && weakReputation) {
    return { type: "visibility_gap", strength: "medium", message: "" };
  }
  if (!hasWebsite && weakReputation) {
    return { type: "foundation_gap", strength: "high", message: "" };
  }

  return null;
}

function normalizeLegacyOrNewOpportunityInsight(
  lead: LeadUI,
): OpportunitySignal | null {
  // Prefer new structured insight if present
  if (lead.primaryWorkTypeInsight?.message) {
    return {
      type: lead.primaryWorkTypeInsight.code,
      message: lead.primaryWorkTypeInsight.message,
      strength: lead.primaryWorkTypeInsight.strength,
    };
  }

  // Fallback to legacy
  if (lead.primaryInsight) return lead.primaryInsight;

  // Deterministic fallback (for when we don't have structured or legacy signals)
  const deterministic = deriveDeterministicOpportunityFallback(lead);
  if (deterministic) return deterministic;

  const sigs = Array.isArray(lead.opportunitySignals)
    ? lead.opportunitySignals
    : [];
  if (!sigs.length) return null;

  const priority = { high: 3, medium: 2, low: 1 } as const;
  return sigs
    .slice()
    .sort((a, b) => priority[b.strength] - priority[a.strength])[0];
}

function getLocalizedOpportunityInsight(
  lead: LeadUI,
  language: Language,
): OpportunitySignal | null {
  const base = normalizeLegacyOrNewOpportunityInsight(lead);
  if (!base) return null;

  const msg = localizeOpportunityMessage(base, language);
  if (!msg) return null;

  return { ...base, message: msg };
}

function riskTitleFromProfile(
  p: Lead["score"]["riskProfile"] | null | undefined,
  t: Translations,
): string {
  if (p === "unstable_business")
    return t.ui.table.riskProfile.unstable_business;
  if (p === "mature_competitor")
    return t.ui.table.riskProfile.mature_competitor;
  return t.ui.table.riskProfile.none;
}

function riskMessage(language: Language, lead: Lead): string {
  const rp = lead.score.riskProfile;
  const risk = lead.score.risk ?? 0;

  if (language === "sv") {
    if (rp === "unstable_business") {
      return "Låg mognad + låg proof. Ofta svårt att få momentum utan att fixa grunderna först.";
    }
    if (rp === "mature_competitor") {
      return "Stark närvaro + starkt proof. Svårare att vinna — kräver tydlig differentiering och systemvinkel.";
    }
    if (risk >= 70)
      return "Hög risk. Kräver tydlig vinkel och starkare erbjudande för att vinna.";
    if (risk >= 45)
      return "Mellanrisk. Går att vinna med rätt angle och tydlig payoff.";
    return "Låg risk. Relativt lätt att få respons om erbjudandet är skarpt.";
  }

  if (rp === "unstable_business") {
    return "Low maturity + weak proof. Usually hard to convert unless fundamentals are fixed first.";
  }
  if (rp === "mature_competitor") {
    return "Strong presence + strong proof. Harder to displace — requires differentiation and a system angle.";
  }
  if (risk >= 70)
    return "High risk. Needs a sharp angle and stronger offer to win.";
  if (risk >= 45)
    return "Medium risk. Winnable with the right angle and clear payoff.";
  return "Low risk. Easier to get a response if your offer is sharp.";
}

// ---------------------
// Score explanation
// ---------------------
function getScoreReason(lead: Lead, language: Language): string {
  const reasons: string[] = [];

  const score = lead.score.value ?? 0;
  const opportunity = lead.score.opportunity ?? 0;
  const readiness = lead.score.readiness ?? 0;
  const risk = lead.score.risk ?? 0;

  const industry = lead.classification.primaryIndustry.replaceAll("_", " ");
  const confidence = lead.classification.confidence ?? 0;

  const rc = lead.metrics.reviewCount;
  const rating = lead.metrics.rating;

  if (language === "en") {
    reasons.push(
      `Opportunity: ${opportunity}/100. Risk: ${risk}/100. Readiness: ${readiness}/100.`,
    );
    reasons.push(`Classification: ${industry} (${confidence}/100).`);

    if (typeof rc === "number") reasons.push(`Reviews: ${rc}.`);
    if (typeof rating === "number") reasons.push(`Rating: ${rating}.`);

    if (score >= 80)
      reasons.push("Top-tier composite score for direct outreach.");
    else if (score >= 60)
      reasons.push("Good candidate for value-first outreach.");
    else
      reasons.push("Lower composite score — use for volume / testing hooks.");
  } else {
    reasons.push(
      `Opportunity: ${opportunity}/100. Risk: ${risk}/100. Readiness: ${readiness}/100.`,
    );
    reasons.push(`Klassning: ${industry} (${confidence}/100).`);

    if (typeof rc === "number") reasons.push(`Recensioner: ${rc}.`);
    if (typeof rating === "number") reasons.push(`Betyg: ${rating}.`);

    if (score >= 80) reasons.push("Toppscore för direkt outreach.");
    else if (score >= 60)
      reasons.push("Bra kandidat för värde-först outreach.");
    else reasons.push("Lägre score — använd för volym / testa hooks.");
  }

  return reasons.join(" ");
}

// ---------------------
// Outreach upgrades
// ---------------------
function getOutreachAngle(lead: LeadUI, language: Language): string {
  const parts: string[] = [];
  const industry = lead.classification.primaryIndustry.replaceAll("_", " ");
  const loc = leadLocation(lead);

  const oppInsight = getLocalizedOpportunityInsight(lead, language);

  const opportunity = lead.score.opportunity ?? 0;
  const risk = lead.score.risk ?? 0;
  const rp = lead.score.riskProfile;

  // Prefer insight "type" if present (new system), otherwise fall back to numeric/risk profile logic.
  const type = oppInsight?.type ?? null;

  if (language === "en") {
    if (oppInsight?.message) parts.push(`Opportunity: ${oppInsight.message}`);
    parts.push(`Context: I'm reviewing ${industry} businesses in ${loc}.`);

    // 1) Primary driver: insight type
    if (type === "conversion_gap") {
      parts.push(
        "Angle: Strong reputation, but weak conversion flow — this is a booking/leads system upgrade.",
      );
    } else if (type === "visibility_gap") {
      parts.push(
        "Angle: Solid foundation but low visibility — growth through visibility + demand capture.",
      );
    } else if (type === "foundation_gap") {
      parts.push(
        "Angle: Foundation gap — trust + capture must be fixed before scaling.",
      );
    } else if (type === "mature_competitor") {
      parts.push(
        "Angle: You’re already strong — winning here is differentiation + system leverage, not “more followers”.",
      );
    }
    // 2) Secondary driver: risk profile
    else if (rp === "unstable_business") {
      parts.push(
        "Angle: Quick fundamentals upgrade (trust + capture) before scaling.",
      );
    }
    // 3) Numeric fallback
    else if (opportunity >= 70 && risk <= 45) {
      parts.push(
        "Angle: Clear upside with manageable risk — direct growth system.",
      );
    } else {
      parts.push(
        "Angle: Value-first teardown + one concrete change that improves bookings/leads.",
      );
    }

    parts.push(
      "Offer: 10–15 min teardown + a simple plan you can implement immediately.",
    );
    return parts.join(" ");
  }

  if (language === "sv") {
    if (oppInsight?.message) parts.push(`Opportunity: ${oppInsight.message}`);
    parts.push(`Context: Jag går igenom ${industry} i ${loc}.`);

    // 1) Primary driver: insight type
    if (type === "conversion_gap") {
      parts.push(
        "Vinkel: Stark reputation men svagt konverteringsflöde — detta är en boknings-/leads-systemuppgradering.",
      );
    } else if (type === "visibility_gap") {
      parts.push(
        "Vinkel: Stabil grund men låg synlighet — tillväxt via synlighet + bättre efterfråge-fångst.",
      );
    } else if (type === "foundation_gap") {
      parts.push(
        "Vinkel: Grundglapp — förtroende + lead capture måste sitta innan man skalar.",
      );
    } else if (type === "mature_competitor") {
      parts.push(
        "Vinkel: Ni är redan starka — här handlar det om differentiering + systemhävarm, inte 'fler följare'.",
      );
    }
    // 2) Secondary driver: risk profile
    else if (rp === "unstable_business") {
      parts.push(
        "Vinkel: Snabb stabilisering av grunden (förtroende + lead capture) innan tillväxt.",
      );
    }
    // 3) Numeric fallback
    else if (opportunity >= 70 && risk <= 45) {
      parts.push(
        "Vinkel: Tydlig uppsida med hanterbar risk — direkt tillväxtsystem.",
      );
    } else {
      parts.push(
        "Vinkel: Värde-först teardown + en konkret förändring som ökar bokningar/leads.",
      );
    }

    parts.push(
      "Erbjudande: 10–15 min teardown + enkel plan ni kan implementera direkt.",
    );
    return parts.join(" ");
  }

  // Safety fallback (if Language ever expands)
  if (oppInsight?.message) parts.push(`Opportunity: ${oppInsight.message}`);
  parts.push(`Context: I'm reviewing ${industry} businesses in ${loc}.`);
  parts.push(
    "Offer: 10–15 min teardown + a simple plan you can implement immediately.",
  );
  return parts.join(" ");
}

type ProviderSearchResponse = {
  ok?: boolean;
  runId?: number | null;
  summary?: unknown;

  // pagination
  nextCursor?: string | null;
  exhausted?: boolean;
};

type RunLeadsResponse = {
  leads?: unknown;
};

async function runProviderSearchAndFetchLeads(args: {
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

  const locationText = args.location.trim();
  const socialPresence = args.socialPresence;

  const provider = args.provider;

  const runIdArg = args.runId ?? null;
  const cursor = args.cursor ?? null;

  const searchRes = await fetch("/api/providers/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider,
      query: niche,
      country: "Sweden",
      location: locationText || undefined,
      socialPresence: socialPresence,
      limit: 25,
      runId: runIdArg,
      cursor,
    }),
  }).catch(() => null);

  if (!searchRes?.ok) return null;

  const searchData = (await searchRes
    .json()
    .catch(() => ({}))) as ProviderSearchResponse;
  const runId = typeof searchData.runId === "number" ? searchData.runId : null;

  if (!runId) return null;

  const leadsRes = await fetch(`/api/providers/runs/${runId}/leads`).catch(
    () => null,
  );
  if (!leadsRes?.ok) return null;

  const leadsData = (await leadsRes
    .json()
    .catch(() => ({}))) as RunLeadsResponse;
  const incoming = (leadsData?.leads ?? null) as unknown;

  return {
    runId,
    leads: Array.isArray(incoming) ? (incoming as LeadUI[]) : [],
    nextCursor: searchData.nextCursor ?? null,
    exhausted: searchData.exhausted ?? false,
  };
}

export default function Home() {
  // =====================
  // STATE
  // =====================

  const [provider, setProvider] = useState<ProviderName>("google_places");

  const [language, setLanguage] = useState<Language>("en");
  const t = useMemo(() => getTranslations(language), [language]);

  const [niche, setNiche] = useState("");
  const [location, setLocation] = useState("");
  const [socialPresence, setSocialPresence] =
    useState<SocialPresenceFilter>("any");

  const [leads, setLeads] = useState<LeadUI[]>([]);
  const [sortBy, setSortBy] = useState<
    "score" | "opportunity" | "risk" | "confidence" | "fit"
  >("score");
  const [minScore, setMinScore] = useState(0);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [recentSearches, setRecentSearches] = useState<SearchRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const [selectedLead, setSelectedLead] = useState<LeadUI | null>(null);
  const [detailTab, setDetailTab] = useState<
    "overview" | "signals" | "outreach" | "tracking"
  >("overview");
  const [enrichmentLoading, setEnrichmentLoading] = useState(false);
  const [enrichmentData, setEnrichmentData] = useState<{
    reachable: boolean;
    detectedPlatforms: string[];
    signals: Record<string, { value: unknown; confidence: number }>;
  } | null>(null);

  type OutreachVariant = "soft" | "direct";
  const [outreachVariant, setOutreachVariant] =
    useState<OutreachVariant>("soft");

  const [outcomesByLeadId, setOutcomesByLeadId] = useState<
    Record<string, LeadOutcomeUI>
  >({});
  const [isSavingOutcome, setIsSavingOutcome] = useState(false);

  const [runId, setRunId] = useState<number | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [exhausted, setExhausted] = useState(false);

  async function handleLoadMore(): Promise<void> {
    if (isLoading || exhausted || nextCursor == null || runId == null) return;

    setIsLoading(true);
    try {
      const more = await runProviderSearchAndFetchLeads({
        provider,
        niche,
        location,
        socialPresence,
        runId,
        cursor: nextCursor,
      });

      if (!more) return;

      // Update pagination state (NOT leads)
      setRunId(more.runId);
      setNextCursor(more.nextCursor);
      setExhausted(more.exhausted);

      // Update leads ONLY with LeadUI[]
      setLeads((prev: LeadUI[]) => {
        const seen = new Set(prev.map((l: LeadUI) => l.id));
        const merged = [...prev];
        for (const lead of more.leads) {
          if (!seen.has(lead.id)) merged.push(lead);
        }
        return merged;
      });
    } finally {
      setIsLoading(false);
    }
  }

  const outreach = selectedLead?.metadata?.outreach;
  const selectedVariant = outreachVariant; // or just use outreachVariant directly
  const outreachScript = outreach?.variants?.[selectedVariant] ?? "";
  const scriptText = outreachScript.trim();

  async function saveOutcome(args: {
    runId: number;
    leadId: string;
    patch: Partial<
      Pick<LeadOutcomeUI, "contacted" | "replied" | "booked_call" | "closed">
    >;
  }) {
    const { runId, leadId, patch } = args;

    // optimistic update
    setOutcomesByLeadId((prev) => {
      const existing = prev[leadId];
      const next: LeadOutcomeUI = {
        run_id: runId,
        lead_id: leadId,
        contacted: existing?.contacted ?? false,
        replied: existing?.replied ?? false,
        booked_call: existing?.booked_call ?? false,
        closed: existing?.closed ?? false,
        revenue: existing?.revenue ?? null,
        notes: existing?.notes ?? null,
        ...patch,
      };
      return { ...prev, [leadId]: next };
    });

    setIsSavingOutcome(true);

    try {
      const body = {
        runId,
        leadId,
        contacted: patch.contacted,
        replied: patch.replied,
        bookedCall: patch.booked_call,
        closed: patch.closed,
      };

      const res = await fetch("/api/outcomes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        outcome?: LeadOutcomeUI;
      };

      const outcome = res.ok ? (data.outcome ?? null) : null;

      if (outcome) {
        setOutcomesByLeadId((prev) => ({ ...prev, [leadId]: outcome }));
      }
    } finally {
      setIsSavingOutcome(false);
    }
  }

  // =====================
  // DERIVED
  // =====================

  const filteredLeads = useMemo(() => {
    return leads.filter((l) => {
      if ((l.score.value ?? 0) < minScore) return false;

      const q = query.trim().toLowerCase();
      if (q) {
        const hay =
          `${l.company.name} ${l.classification.primaryIndustry} ${leadLocation(l)}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });
  }, [leads, minScore, query]);

  const sortedLeads = useMemo(() => {
    const arr = [...filteredLeads];

    arr.sort((a, b) => {
      if (sortBy === "confidence") {
        return (
          (b.classification.confidence ?? 0) -
          (a.classification.confidence ?? 0)
        );
      }
      if (sortBy === "opportunity") {
        return (b.score.opportunity ?? 0) - (a.score.opportunity ?? 0);
      }
      if (sortBy === "risk") {
        // lower risk first (more attractive)
        return (a.score.risk ?? 0) - (b.score.risk ?? 0);
      }
      if (sortBy === "fit") {
        return (b.fit?.fitScore ?? 0) - (a.fit?.fitScore ?? 0);
      }
      return (b.score.value ?? 0) - (a.score.value ?? 0);
    });

    // Secondary sort = stronger opportunity insight (quiet leverage)
    const priority = { high: 3, medium: 2, low: 1 } as const;
    arr.sort((a, b) => {
      const ai = normalizeLegacyOrNewOpportunityInsight(a);
      const bi = normalizeLegacyOrNewOpportunityInsight(b);
      const av = priority[ai?.strength ?? "low"];
      const bv = priority[bi?.strength ?? "low"];
      if (bv !== av) return bv - av;
      return 0;
    });

    return arr;
  }, [filteredLeads, sortBy]);

  const activeRunId = useMemo(() => {
    const v = Number(sortedLeads?.[0]?.metadata?.runId ?? 0);
    return Number.isFinite(v) && v > 0 ? v : 0;
  }, [sortedLeads]);

  const selectedOutcome = useMemo(() => {
    if (!selectedLead) return null;
    return outcomesByLeadId[selectedLead.id] ?? null;
  }, [outcomesByLeadId, selectedLead]);

  // =====================
  // EFFECTS
  // =====================

  useEffect(() => {
    if (!selectedLead?.metadata?.outreach) return;

    const dv = selectedLead.metadata.outreach.defaultVariant;
    setOutreachVariant(dv === "direct" ? "direct" : "soft");
  }, [selectedLead]);

  useEffect(() => {
    if (!selectedLead) {
      setEnrichmentData(null);
      setDetailTab("overview");
      return;
    }

    const leadId = selectedLead.id;
    const website = selectedLead.company.website ?? null;
    const reviewCount = selectedLead.metrics.reviewCount ?? null;
    const rating = selectedLead.metrics.rating ?? null;
    const socialPresence = selectedLead.metrics.socialPresence ?? "low";
    const isGoodFit = selectedLead.classification.isGoodFit ?? false;
    const classificationConfidence =
      selectedLead.classification.confidence ?? null;
    const riskProfile = selectedLead.score.riskProfile ?? "unknown";

    const run = async () => {
      setEnrichmentLoading(true);
      setEnrichmentData(null);
      try {
        const res = await fetch("/api/enrich/light", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            website,
            reviewCount,
            rating,
            socialPresence,
            isGoodFit,
            classificationConfidence,
            riskProfile,
          }),
        });
        if (!res.ok) return;
        const data = await res.json();
        setEnrichmentData({
          reachable: data.reachable ?? false,
          detectedPlatforms: data.detectedPlatforms ?? [],
          signals: data.signals?.byKey ?? {},
        });

        if (data.updatedScore) {
          setLeads((prev) =>
            prev.map((l) =>
              l.id === leadId ? { ...l, score: data.updatedScore } : l,
            ),
          );
          setSelectedLead((prev) =>
            prev?.id === leadId ? { ...prev, score: data.updatedScore } : prev,
          );
        }
      } catch {
        // fail soft
      } finally {
        setEnrichmentLoading(false);
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLead?.id]);

  useEffect(() => {
    const runId = activeRunId;
    if (!runId) return;

    const load = async () => {
      try {
        const res = await fetch(`/api/outcomes?runId=${runId}`);
        if (!res.ok) return;

        const data = (await res.json().catch(() => ({}))) as {
          outcomes?: LeadOutcomeUI[];
        };

        const map: Record<string, LeadOutcomeUI> = {};
        for (const o of data.outcomes ?? []) map[o.lead_id] = o;
        setOutcomesByLeadId(map);
      } catch {
        // fail soft
      }
    };

    load();
  }, [activeRunId]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw) as {
        language?: Language;
        niche?: string;
        location?: string;
        socialPresence?: string;
      };

      if (parsed.language === "en" || parsed.language === "sv")
        setLanguage(parsed.language);
      if (typeof parsed.niche === "string") setNiche(parsed.niche);
      if (typeof parsed.location === "string") setLocation(parsed.location);

      if (
        parsed.socialPresence === "low" ||
        parsed.socialPresence === "medium" ||
        parsed.socialPresence === "high" ||
        parsed.socialPresence === ""
      ) {
        setSocialPresence(parsed.socialPresence as SocialPresenceFilter);
      }
    } catch (e) {
      console.error("Failed to load state from localStorage:", e);
    }
  }, []);

  useEffect(() => {
    const fetchRecentSearches = async () => {
      try {
        setIsLoadingHistory(true);
        const res = await fetch("/api/searches");
        if (!res.ok) return;
        const data = (await res.json().catch(() => ({}))) as {
          searches?: SearchRecord[];
        };
        setRecentSearches(Array.isArray(data.searches) ? data.searches : []);
      } catch (e) {
        console.error("Error loading recent searches:", e);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    fetchRecentSearches();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          language,
          niche,
          location,
          socialPresence,
        }),
      );
    } catch (e) {
      console.error("Failed to save state to localStorage:", e);
    }
  }, [language, niche, location, socialPresence]);

  // =====================
  // HANDLERS
  // =====================

  const downloadCsv = () => {
    if (sortedLeads.length === 0) return;

    const header = [
      "Company",
      "Industry",
      "Location",
      "Score",
      "Opportunity",
      "Risk",
      "Readiness",
      "Risk Profile",
      "Confidence",
      "Rating",
      "Review Count",
      "Website",
      "Primary Opportunity Insight",
    ];

    const rows = sortedLeads.map((lead) => {
      const insight = getLocalizedOpportunityInsight(lead, language);
      return [
        lead.company.name,
        lead.classification.primaryIndustry,
        leadLocation(lead),
        String(lead.score.value ?? 0),
        String(lead.score.opportunity ?? 0),
        String(lead.score.risk ?? 0),
        String(lead.score.readiness ?? 0),
        lead.score.riskProfile ?? "",
        String(lead.classification.confidence ?? 0),
        lead.metrics.rating ?? "",
        lead.metrics.reviewCount ?? "",
        lead.company.website ?? "",
        insight?.message ?? "",
      ];
    });

    const csvContent = [header, ...rows]
      .map((row) =>
        row.map((field) => `"${String(field).replace(/"/g, '""')}"`).join(","),
      )
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "leads_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const providerLeads = await runProviderSearchAndFetchLeads({
        provider,
        niche,
        location,
        socialPresence,
      });

      if (providerLeads !== null) {
        setLeads(providerLeads.leads);
        setRunId(providerLeads.runId);
        setNextCursor(providerLeads.nextCursor);
        setExhausted(providerLeads.exhausted);

        setSelectedLead(null);
        return;
      }
    } catch (error) {
      console.error("Error fetching leads:", error);
      setLeads([]);
      setSelectedLead(null);
    } finally {
      setIsLoading(false);
    }
  };

  // =====================
  // RENDER
  // =====================

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 flex flex-col items-center py-10 px-4">
      <div className="w-full max-w-4xl space-y-8">
        <header className="space-y-3 md:flex md:items-center md:justify-between md:space-y-0">
          <div className="space-y-2">
            <h1 className="text-3xl md:text-4xl font-bold">
              {t.ui.header.title}
            </h1>
            <p className="text-slate-300 text-sm md:text-base">
              {t.ui.header.subtitle}
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">{t.ui.header.languageLabel}</span>
            <button
              type="button"
              onClick={() => setLanguage("en")}
              className={
                "px-2 py-1 rounded-md border text-[11px] " +
                (language === "en"
                  ? "border-indigo-500 bg-indigo-600 text-white"
                  : "border-slate-700 bg-slate-900 text-slate-200")
              }
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setLanguage("sv")}
              className={
                "px-2 py-1 rounded-md border text-[11px] " +
                (language === "sv"
                  ? "border-indigo-500 bg-indigo-600 text-white"
                  : "border-slate-700 bg-slate-900 text-slate-200")
              }
            >
              SV
            </button>
          </div>
        </header>

        {recentSearches.length > 0 && (
          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 md:p-5 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-100">
                Recent searches
              </h2>
              {isLoadingHistory && (
                <span className="text-[11px] text-slate-400">Updating…</span>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {recentSearches.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setNiche(s.niche || "");
                    setLocation(s.location || "");
                    setSocialPresence(
                      (s.social_presence === "low" ||
                      s.social_presence === "medium" ||
                      s.social_presence === "high"
                        ? s.social_presence
                        : "") as SocialPresenceFilter,
                    );
                  }}
                  className="text-[11px] md:text-xs px-2.5 py-1.5 rounded-full border border-slate-700 bg-slate-950/70 hover:bg-slate-900/80 text-slate-200 flex items-center gap-2"
                >
                  <span className="font-medium">{s.niche || "N/A"}</span>
                  <span className="text-slate-400">
                    · {s.location || "Unknown"}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Filter Form */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-lg space-y-6">
          <h2 className="text-xl font-semibold">{t.ui.filters.title}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-sm font-medium">
                  {t.ui.filters.nicheLabel}
                </label>
                <input
                  type="text"
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                  placeholder="e.g. real estate, tattoo studio"
                  className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs text-slate-400">
                  {t.ui.filters.providerLabel}
                </label>
                <select
                  value={provider}
                  onChange={(e) => {
                    const v = e.target.value as ProviderName;
                    setProvider(v);
                  }}
                  className="bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm"
                >
                  <option value="google_places">Google Places</option>
                  <option value="mock">Mock (Dev)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-medium">
                  {t.ui.filters.locationLabel}
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Stockholm"
                  className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-medium">
                  {t.ui.filters.socialPresenceLabel}
                </label>
                <select
                  value={socialPresence}
                  onChange={(e) =>
                    setSocialPresence(e.target.value as SocialPresenceFilter)
                  }
                  className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="any">
                    {t.ui.filters.socialPresenceOptions.any}
                  </option>
                  <option value="low">
                    {t.ui.filters.socialPresenceOptions.low}
                  </option>
                  <option value="medium">
                    {t.ui.filters.socialPresenceOptions.medium}
                  </option>
                  <option value="high">
                    {t.ui.filters.socialPresenceOptions.high}
                  </option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center justify-center rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900 px-4 py-2 text-sm font-semibold transition"
            >
              {isLoading
                ? t.ui.filters.generatingButton
                : t.ui.filters.generateButton}
            </button>
          </form>
        </section>

        {/* Results */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-lg space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold">{t.ui.results.title}</h2>
              <p className="text-xs text-slate-400">
                {t.ui.results.showing} {sortedLeads.length} {t.ui.results.leads}
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <label className="flex items-center gap-2 text-xs text-slate-300">
                  {t.ui.results.minScore}:
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={minScore}
                    onChange={(e) => setMinScore(Number(e.target.value))}
                  />
                  <span className="w-8 text-right">{minScore}</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-slate-300">
                  {t.ui.results.sortBy}
                  <select
                    value={sortBy}
                    onChange={(e) =>
                      setSortBy(
                        e.target.value as
                          | "score"
                          | "opportunity"
                          | "risk"
                          | "confidence"
                          | "fit",
                      )
                    }
                    className="rounded-md bg-slate-900 border border-slate-700 px-2 py-1"
                  >
                    <option value="score">
                      {t.ui.results.sortOptions.score}
                    </option>
                    <option value="opportunity">
                      {t.ui.results.sortOptions.opportunity}
                    </option>
                    <option value="risk">
                      {t.ui.results.sortOptions.risk}
                    </option>
                    <option value="confidence">
                      {t.ui.results.sortOptions.confidence}
                    </option>
                    <option value="fit">{t.ui.results.sortOptions.fit}</option>
                  </select>
                </label>

                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t.ui.results.searchPlaceholder}
                  className="flex-1 min-w-[180px] rounded-md bg-slate-900 border border-slate-700 px-2 py-1 text-xs"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleLoadMore}
              disabled={
                isLoading || exhausted || nextCursor == null || runId == null
              }
            >
              Load more
            </button>

            <button
              type="button"
              onClick={downloadCsv}
              disabled={sortedLeads.length === 0}
              className="text-xs border border-slate-600 rounded-lg px-3 py-1 bg-slate-900/60 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 transition"
            >
              {t.ui.results.download}
            </button>
          </div>

          {sortedLeads.length === 0 ? (
            <p className="text-slate-400 text-sm">
              {t.ui.results.empty}
              <span className="font-semibold text-slate-100">
                &quot;Generate Leads&quot;
              </span>
              .
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-900 border-b border-slate-800">
                    <th className="text-left py-2 px-3">
                      {t.ui.table.company}
                    </th>
                    <th className="text-left py-2 px-3">
                      {t.ui.table.industry}
                    </th>
                    <th className="text-left py-2 px-3">
                      {t.ui.table.location}
                    </th>
                    <th className="text-left py-2 px-3">{t.ui.table.score}</th>
                    <th className="text-left py-2 px-3">
                      {t.ui.table.opportunity}
                    </th>
                    <th className="text-left py-2 px-3">{t.ui.table.risk}</th>
                    <th className="text-left py-2 px-3">
                      {t.ui.table.insight}
                    </th>
                    <th className="text-left py-2 px-3">
                      {t.ui.table.website}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedLeads.map((lead) => {
                    const isSelected = selectedLead?.id === lead.id;
                    const mainInsight = getLocalizedOpportunityInsight(
                      lead,
                      language,
                    );
                    const mainOpp = Number.isFinite(lead.score.opportunity)
                      ? (lead.score.opportunity as number)
                      : 0;

                    const detailLead = isSelected ? selectedLead : null;
                    const detailInsight = detailLead
                      ? getLocalizedOpportunityInsight(detailLead, language)
                      : null;

                    const safeOutreach = detailLead?.metadata?.outreach ?? null;
                    const safeEnrichment = isSelected ? enrichmentData : null;
                    const runIdNum = Number(detailLead?.metadata?.runId ?? 0);

                    const contacted = selectedOutcome?.contacted ?? false;
                    const replied = selectedOutcome?.replied ?? false;
                    const bookedCall = selectedOutcome?.booked_call ?? false;
                    const closed = selectedOutcome?.closed ?? false;

                    const tabs = [
                      { key: "overview", label: "Overview" },
                      { key: "signals", label: "Signals" },
                      { key: "outreach", label: "Outreach" },
                      { key: "tracking", label: "Tracking" },
                    ] as const;

                    const detailWebsiteUrl =
                      detailLead?.company.website ?? undefined;
                    const enrichmentSignals = safeEnrichment?.signals ?? {};
                    const detectedPlatforms =
                      safeEnrichment?.detectedPlatforms ?? [];
                    const isReachable = safeEnrichment?.reachable ?? false;

                    const angleTitle = safeOutreach?.angleTitle ?? "";
                    const angleWhy = safeOutreach?.angleWhy ?? "";

                    return (
                      <Fragment key={lead.id}>
                        <tr
                          onClick={() => setSelectedLead(lead)}
                          className={
                            "border-b border-slate-800 hover:bg-slate-900/70 cursor-pointer " +
                            (isSelected ? "bg-slate-900/90" : "")
                          }
                        >
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium">
                                {lead.company.name}
                              </span>

                              <span className="text-[10px] px-2 py-0.5 rounded-full border border-slate-700 bg-slate-900/70">
                                {lead.source === "google_places"
                                  ? "Google Places"
                                  : lead.source === "mock"
                                    ? "Mock (Dev)"
                                    : lead.source}
                              </span>

                              <span className="text-[10px] px-2 py-0.5 rounded-full border border-slate-700 bg-slate-900/70">
                                {lead.classification.primaryIndustry.replaceAll(
                                  "_",
                                  " ",
                                )}
                              </span>
                            </div>
                          </td>

                          <td className="py-2 px-3">
                            {lead.classification.primaryIndustry.replaceAll(
                              "_",
                              " ",
                            )}
                          </td>

                          <td className="py-2 px-3">{leadLocation(lead)}</td>

                          <td className="py-2 px-3">
                            <div className="text-xs font-medium mb-1">
                              {lead.score.value ?? 0}
                            </div>
                            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={
                                  "h-1.5 rounded-full " +
                                  ((lead.score.value ?? 0) >= 80
                                    ? "bg-emerald-400"
                                    : (lead.score.value ?? 0) >= 60
                                      ? "bg-amber-400"
                                      : "bg-slate-500")
                                }
                                style={{ width: `${lead.score.value ?? 0}%` }}
                              />
                            </div>
                          </td>

                          <td className="py-2 px-3">
                            <span className="text-slate-200 font-semibold">
                              {lead.score.opportunity ?? 0}
                            </span>
                            <p className="mt-1 text-[11px] leading-snug text-slate-400">
                              {language === "sv" ? "Uppsida" : "Upside"}
                            </p>
                          </td>

                          <td className="py-2 px-3">
                            <span
                              className={
                                (lead.score.risk ?? 0) >= 70
                                  ? "text-rose-300 font-semibold"
                                  : (lead.score.risk ?? 0) >= 45
                                    ? "text-amber-300 font-semibold"
                                    : "text-emerald-300 font-semibold"
                              }
                            >
                              {lead.score.risk ?? 0}
                            </span>
                            <p className="mt-1 text-[11px] leading-snug text-slate-400">
                              {lead.score.riskProfile
                                ? lead.score.riskProfile.replaceAll("_", " ")
                                : "—"}
                            </p>
                          </td>

                          <td className="py-2 px-3">
                            <div className="text-[11px] leading-snug">
                              <div className="text-orange-300 font-semibold flex items-center gap-2">
                                <span>⚡</span>
                                <span>
                                  {t.ui.table.opportunity}{" "}
                                  <span className="text-slate-200 font-semibold">
                                    {mainOpp}/100
                                  </span>{" "}
                                  <span className="text-slate-400">
                                    ({bandLabel(language, mainOpp)})
                                  </span>
                                </span>
                              </div>

                              {mainInsight?.message ? (
                                <div className="text-slate-200">
                                  {mainInsight.message}
                                </div>
                              ) : (
                                <div className="text-slate-500 text-[11px]">
                                  —
                                </div>
                              )}
                            </div>
                          </td>

                          <td className="py-2 px-3">
                            {lead.company.website ? (
                              <a
                                href={lead.company.website}
                                target="_blank"
                                rel="noreferrer"
                                className="text-indigo-400 hover:underline"
                              >
                                Visit
                              </a>
                            ) : (
                              <span className="text-slate-500">N/A</span>
                            )}
                          </td>
                        </tr>

                        {isSelected && detailLead && (
                          <tr key={`${lead.id}-detail`}>
                            <td colSpan={8} className="p-0">
                              <div className="border-b border-slate-700 bg-slate-950/80 px-4 py-4 space-y-3">
                                <div className="flex gap-1 border-b border-slate-800 pb-0">
                                  {tabs.map((tab) => (
                                    <button
                                      key={tab.key}
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setDetailTab(tab.key);
                                      }}
                                      className={
                                        "text-[11px] px-3 py-1.5 rounded-t-md font-medium transition-colors " +
                                        (detailTab === tab.key
                                          ? "bg-slate-800 text-slate-100 border border-b-0 border-slate-700"
                                          : "text-slate-400 hover:text-slate-200")
                                      }
                                    >
                                      {tab.label}
                                    </button>
                                  ))}

                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedLead(null);
                                    }}
                                    className="ml-auto text-[11px] px-2 py-1 rounded-md border border-slate-700 bg-slate-900/70 hover:bg-slate-800"
                                  >
                                    {t.ui.detail.clear}
                                  </button>
                                </div>

                                {detailTab === "overview" && (
                                  <div className="space-y-3 pt-1">
                                    {detailInsight?.message && (
                                      <div className="rounded-xl border border-orange-500/20 bg-orange-500/10 p-3">
                                        <p className="text-[11px] uppercase tracking-wide text-orange-200/80 mb-1">
                                          {t.ui.detail.opportunityInsight}
                                        </p>
                                        <p className="text-sm font-semibold text-orange-200">
                                          ⚡ {detailInsight.message}
                                        </p>
                                        <p className="mt-1 text-[11px] text-orange-200/70">
                                          Opportunity:{" "}
                                          <span className="text-orange-100 font-semibold">
                                            {detailLead.score.opportunity ?? 0}
                                            /100
                                          </span>{" "}
                                          <span className="text-orange-200/60">
                                            (
                                            {bandLabel(
                                              language,
                                              detailLead.score.opportunity ?? 0,
                                            )}
                                            )
                                          </span>
                                        </p>
                                      </div>
                                    )}

                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                      <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3 space-y-1">
                                        <p className="text-slate-400">
                                          {t.ui.detail.scoreLabel}
                                        </p>
                                        <p className="text-lg font-semibold">
                                          {detailLead.score.value ?? 0}
                                        </p>
                                        <p className="text-[11px] text-slate-400">
                                          {getScoreReason(detailLead, language)}
                                        </p>
                                      </div>

                                      <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3 space-y-1">
                                        <p className="text-slate-400">
                                          {t.ui.detail.opportunityLabel}
                                        </p>
                                        <p className="text-sm font-semibold">
                                          {detailLead.score.opportunity ?? 0}
                                          /100
                                        </p>
                                        <p className="text-[11px] text-slate-400">
                                          {t.ui.detail.readinessLabel}:{" "}
                                          {detailLead.score.readiness ?? 0}
                                          /100
                                        </p>
                                      </div>

                                      <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3 space-y-1">
                                        <p className="text-slate-400">
                                          {t.ui.detail.riskLabel}
                                        </p>
                                        <p className="text-sm font-semibold">
                                          {detailLead.score.risk ?? 0}/100
                                        </p>
                                        <p className="text-[11px] text-slate-400">
                                          {detailLead.score.riskProfile?.replaceAll(
                                            "_",
                                            " ",
                                          ) ?? "—"}
                                        </p>
                                      </div>

                                      <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3 space-y-1">
                                        <p className="text-slate-400">
                                          {t.ui.detail.websiteLabel}
                                        </p>
                                        {detailWebsiteUrl ? (
                                          <a
                                            href={detailWebsiteUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-xs text-indigo-400 hover:underline break-all"
                                          >
                                            {detailWebsiteUrl}
                                          </a>
                                        ) : (
                                          <p className="text-[11px] text-slate-500">
                                            {t.ui.detail.noWebsite}
                                          </p>
                                        )}
                                      </div>
                                    </div>

                                    <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3">
                                      <p className="text-[11px] uppercase tracking-wide text-rose-200/80 mb-1">
                                        {t.ui.detail.risk}
                                      </p>
                                      <p className="text-sm font-semibold text-rose-100">
                                        {riskTitleFromProfile(
                                          detailLead.score.riskProfile,
                                          t,
                                        )}
                                      </p>
                                      <p className="mt-1 text-[11px] text-rose-200/70">
                                        {riskMessage(language, detailLead)}
                                      </p>
                                    </div>
                                  </div>
                                )}

                                {detailTab === "signals" && (
                                  <div className="space-y-3 pt-1">
                                    {detailLead.score.breakdown && (
                                      <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                                        <p className="text-[11px] uppercase tracking-wide text-slate-400 mb-2">
                                          Scoring Breakdown
                                        </p>
                                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[12px]">
                                          <div>
                                            <span className="text-slate-400">
                                              Reputation:
                                            </span>{" "}
                                            <span className="text-slate-100 font-semibold">
                                              {
                                                detailLead.score.breakdown
                                                  .reputation
                                              }
                                            </span>
                                          </div>
                                          <div>
                                            <span className="text-slate-400">
                                              Digital:
                                            </span>{" "}
                                            <span className="text-slate-100 font-semibold">
                                              {
                                                detailLead.score.breakdown
                                                  .digitalPresence
                                              }
                                            </span>
                                          </div>
                                          <div>
                                            <span className="text-slate-400">
                                              Business:
                                            </span>{" "}
                                            <span className="text-slate-100 font-semibold">
                                              {
                                                detailLead.score.breakdown
                                                  .businessStrength
                                              }
                                            </span>
                                          </div>
                                          <div>
                                            <span className="text-slate-400">
                                              Opportunity Gap:
                                            </span>{" "}
                                            <span className="text-slate-100 font-semibold">
                                              {
                                                detailLead.score.breakdown
                                                  .opportunityGap
                                              }
                                            </span>
                                          </div>
                                          <div>
                                            <span className="text-slate-400">
                                              Risk:
                                            </span>{" "}
                                            <span className="text-slate-100 font-semibold">
                                              {
                                                detailLead.score.breakdown
                                                  .stabilityRisk
                                              }
                                            </span>
                                          </div>
                                          <div>
                                            <span className="text-slate-400">
                                              Evidence:
                                            </span>{" "}
                                            <span className="text-slate-100 font-semibold">
                                              {
                                                detailLead.score.breakdown
                                                  .evidenceConfidence
                                              }
                                            </span>
                                          </div>
                                        </div>

                                        {detailLead.score.reasons?.length >
                                          0 && (
                                          <div className="mt-3 flex flex-wrap gap-2">
                                            {detailLead.score.reasons.map(
                                              (reason, i) => (
                                                <span
                                                  key={i}
                                                  className="text-[11px] px-2 py-1 rounded border border-slate-700 text-slate-200"
                                                >
                                                  {reason}
                                                </span>
                                              ),
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    {enrichmentLoading && (
                                      <div className="text-xs text-slate-400 animate-pulse">
                                        Scanning website signals...
                                      </div>
                                    )}

                                    {safeEnrichment && !enrichmentLoading && (
                                      <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3 space-y-2">
                                        <p className="text-[11px] uppercase tracking-wide text-slate-400">
                                          Website Signals
                                        </p>

                                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12px]">
                                          <p
                                            className={
                                              isReachable
                                                ? "text-emerald-400"
                                                : "text-rose-400"
                                            }
                                          >
                                            {isReachable ? "✓" : "✗"} Website
                                            reachable
                                          </p>

                                          {isReachable && (
                                            <>
                                              <p
                                                className={
                                                  enrichmentSignals[
                                                    "website_has_contact_page"
                                                  ]?.value
                                                    ? "text-emerald-400"
                                                    : "text-slate-500"
                                                }
                                              >
                                                {enrichmentSignals[
                                                  "website_has_contact_page"
                                                ]?.value
                                                  ? "✓"
                                                  : "✗"}{" "}
                                                Contact page
                                              </p>

                                              <p
                                                className={
                                                  enrichmentSignals[
                                                    "website_has_booking_cta"
                                                  ]?.value
                                                    ? "text-emerald-400"
                                                    : "text-slate-500"
                                                }
                                              >
                                                {enrichmentSignals[
                                                  "website_has_booking_cta"
                                                ]?.value
                                                  ? "✓"
                                                  : "✗"}{" "}
                                                Booking CTA
                                              </p>

                                              <p
                                                className={
                                                  enrichmentSignals[
                                                    "website_has_clear_offer"
                                                  ]?.value
                                                    ? "text-emerald-400"
                                                    : "text-slate-500"
                                                }
                                              >
                                                {enrichmentSignals[
                                                  "website_has_clear_offer"
                                                ]?.value
                                                  ? "✓"
                                                  : "✗"}{" "}
                                                Clear offer
                                              </p>

                                              <p
                                                className={
                                                  enrichmentSignals[
                                                    "website_mobile_friendly"
                                                  ]?.value
                                                    ? "text-emerald-400"
                                                    : "text-slate-500"
                                                }
                                              >
                                                {enrichmentSignals[
                                                  "website_mobile_friendly"
                                                ]?.value
                                                  ? "✓"
                                                  : "✗"}{" "}
                                                Mobile friendly
                                              </p>
                                            </>
                                          )}
                                        </div>

                                        {detectedPlatforms.length > 0 && (
                                          <p className="text-[12px] text-slate-400">
                                            Social:{" "}
                                            <span className="text-slate-200">
                                              {detectedPlatforms.join(", ")}
                                            </span>
                                          </p>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}

                                {detailTab === "outreach" && (
                                  <div className="space-y-3 pt-1">
                                    <p className="text-[11px] uppercase tracking-wide text-slate-400">
                                      {t.ui.detail.suggestedAngle}
                                    </p>
                                    <p className="text-xs text-slate-200 leading-relaxed">
                                      {getOutreachAngle(detailLead, language)}
                                    </p>

                                    <div className="space-y-2">
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                          <p className="text-[11px] uppercase tracking-wide text-slate-400">
                                            {t.ui.detail.outreachScript} (draft)
                                          </p>

                                          {safeOutreach && (
                                            <div className="flex items-center gap-1">
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  setOutreachVariant("soft")
                                                }
                                                className={
                                                  "text-[10px] px-2 py-0.5 rounded-md border " +
                                                  (outreachVariant === "soft"
                                                    ? "border-slate-500 bg-slate-900/70 text-slate-100"
                                                    : "border-slate-800 bg-slate-900/40 text-slate-300")
                                                }
                                              >
                                                Soft
                                              </button>

                                              <button
                                                type="button"
                                                onClick={() =>
                                                  setOutreachVariant("direct")
                                                }
                                                className={
                                                  "text-[10px] px-2 py-0.5 rounded-md border " +
                                                  (outreachVariant === "direct"
                                                    ? "border-slate-500 bg-slate-900/70 text-slate-100"
                                                    : "border-slate-800 bg-slate-900/40 text-slate-300")
                                                }
                                              >
                                                Direct
                                              </button>
                                            </div>
                                          )}
                                        </div>

                                        <button
                                          type="button"
                                          onClick={async () => {
                                            try {
                                              await navigator.clipboard.writeText(
                                                scriptText,
                                              );
                                            } catch (e) {
                                              console.error(e);
                                            }
                                          }}
                                          disabled={!scriptText}
                                          className="text-[11px] px-2 py-1 rounded-md border border-slate-700 bg-slate-900/70 hover:bg-slate-800 disabled:opacity-50"
                                        >
                                          {t.ui.detail.copy}
                                        </button>
                                      </div>

                                      <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 max-h-56 overflow-auto">
                                        {angleTitle && (
                                          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3 mb-3">
                                            <p className="text-[11px] uppercase tracking-wide text-slate-300/80">
                                              {t.ui.detail.suggestedAngle}
                                            </p>
                                            <p className="text-sm font-semibold text-slate-100">
                                              {angleTitle}
                                            </p>
                                            {angleWhy && (
                                              <p className="mt-1 text-[12px] text-slate-200/70">
                                                {angleWhy}
                                              </p>
                                            )}
                                          </div>
                                        )}

                                        <pre className="whitespace-pre-wrap wrap-break-words text-[11px] text-slate-200">
                                          {scriptText ||
                                            t.ui.detail.clickLeadHint}
                                        </pre>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {detailTab === "tracking" && (
                                  <div className="space-y-3 pt-1">
                                    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
                                      <p className="text-[11px] uppercase tracking-wide text-slate-300/80 mb-2">
                                        {t.ui.detail.outcomeTracking}{" "}
                                        {isSavingOutcome &&
                                          `… ${t.ui.detail.saving}`}
                                      </p>

                                      <div className="flex flex-wrap gap-4 text-xs text-slate-200">
                                        {OUTCOME_STATUS_KEYS.map((k) => (
                                          <label
                                            key={k}
                                            className="flex items-center gap-2"
                                          >
                                            <input
                                              type="checkbox"
                                              checked={
                                                k === "contacted"
                                                  ? contacted
                                                  : k === "replied"
                                                    ? replied
                                                    : k === "booked_call"
                                                      ? bookedCall
                                                      : closed
                                              }
                                              onChange={(e) => {
                                                if (
                                                  !Number.isFinite(runIdNum) ||
                                                  runIdNum <= 0
                                                ) {
                                                  return;
                                                }
                                                saveOutcome({
                                                  runId: runIdNum,
                                                  leadId: detailLead.id,
                                                  patch: buildOutcomePatch(
                                                    k,
                                                    e.target.checked,
                                                  ),
                                                });
                                              }}
                                            />
                                            <span>{outcomeLabel(k, t)}</span>
                                          </label>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
