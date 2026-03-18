"use client";

import { Fragment, useEffect, useMemo, useState, FormEvent, ChangeEvent, MouseEvent, KeyboardEvent, FocusEvent } from "react";
import type { Lead, Language, SearchRecord } from "@/lib/types";
import type { ProviderName } from "@/lib/providers/types";
import { getEffectivePlan, canUseDeepEnrichment } from "@/lib/plan";
import { getTranslations } from "@/lib/i18n";
import HamburgerMenu from "../components/HamburgerMenu";
import { createSupabaseBrowser } from "@/lib/supabaseBrowser";
import type { TranslationSchema as Translations } from "@/lib/i18n/types";
import type { SocialPresenceFilter } from "@/lib/providers/types";
import { useToast } from "../components/ToastProvider";
import { getSearchQueries } from "@/lib/niche/synonyms";
import { rescoreWithLightSignals } from "@/lib/scoring/rescoreWithSignals";

const STORAGE_KEY = "vantio_state_v1";

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
  geoMatch?: "exact" | "partial" | "none" | "unset";
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
  followup_date: string | null;
  tonality: "soft" | "consultative" | "direct" | "bold" | null;
  angle_type: string | null;
  lost_reason: "no_response" | "not_interested" | "has_provider" | "wrong_timing" | "price_too_high" | "chose_competitor" | "other" | null;
  score_at_outreach: number | null;
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
// Returns the plain-text angle string (legacy compat)
function getOutreachAngle(lead: LeadUI, language: Language): string {
  return getStructuredAngle(lead, language).body;
}

type StructuredAngle = { title: string; why: string; body: string };

function getStructuredAngle(lead: LeadUI, language: Language): StructuredAngle {
  const industry = lead.classification.primaryIndustry.replaceAll("_", " ");
  const loc = leadLocation(lead);
  const oppInsight = getLocalizedOpportunityInsight(lead, language);
  const opportunity = lead.score.opportunity ?? 0;
  const risk = lead.score.risk ?? 0;
  const rp = lead.score.riskProfile;
  const type = oppInsight?.type ?? null;
  const score = lead.score.value ?? 0;
  const rep = lead.score.breakdown?.reputation ?? 0;
  const digital = lead.score.breakdown?.digitalPresence ?? 0;
  const name = lead.company.name;

  if (language === "en") {
    let title = "";
    let why = "";
    if (type === "conversion_gap") {
      title = "Conversion system upgrade";
      why = `${name} has strong reputation (${rep}/100) and proven demand, but their conversion flow is leaking — visitors aren't turning into bookings. This angle lands well because the gap is visible and the business already has proof of market fit.`;
    } else if (type === "visibility_gap") {
      title = "Visibility + demand capture";
      why = `${name} has solid fundamentals (score ${score}/100) but low digital presence (${digital}/100). Demand exists in their market but isn't being captured. The angle resonates because growth feels achievable — you're not asking them to fix broken basics.`;
    } else if (type === "foundation_gap") {
      title = "Foundation-first fix";
      why = `${name} lacks core digital infrastructure. Without trust signals and a capture mechanism, any traffic spend is wasted. Frame your offer as a prerequisite to growth — not an optional add-on.`;
    } else if (type === "mature_competitor") {
      title = "Differentiation + system leverage";
      why = `${name} is already strong — generic growth pitches won't land. Lead with system efficiency and competitive differentiation. They don't need more followers; they need better conversion mechanics and a sharper edge.`;
    } else if (rp === "unstable_business") {
      title = "Stabilise before scaling";
      why = `${name} shows instability signals (risk ${risk}/100). The pitch needs to build confidence first — frame your offer as a stabilising move that protects and compounds what they've built, rather than aggressive new growth.`;
    } else if (opportunity >= 70 && risk <= 45) {
      title = "Direct growth system";
      why = `${name} has clear upside (opportunity ${opportunity}/100) with manageable risk (${risk}/100). Lead direct and confident — they have the foundation and market conditions to grow, they just need the right system to capture it.`;
    } else {
      title = "Value-first teardown";
      why = `${name} is a mixed-signal lead. The safest angle is a specific observation about their business followed by a free teardown offer. This lowers resistance and lets the value sell itself before you ask for anything.`;
    }
    const body = [
      oppInsight?.message ? `Opportunity: ${oppInsight.message}` : "",
      `Context: I'm reviewing ${industry} businesses in ${loc}.`,
      `Angle: ${title}.`,
      `Offer: 10–15 min teardown + a simple plan you can implement immediately.`,
    ].filter(Boolean).join(" ");
    return { title, why, body };
  }

  if (language === "sv") {
    let title = "";
    let why = "";
    if (type === "conversion_gap") {
      title = "Konverteringssystemuppgradering";
      why = `${name} har stark reputation (${rep}/100) och bevisad efterfrågan, men konverteringsflödet läcker — besökare omvandlas inte till bokningar. Hög mottaglighet eftersom gapet syns tydligt och efterfrågan redan är bevisad.`;
    } else if (type === "visibility_gap") {
      title = "Synlighet + efterfråge-fångst";
      why = `${name} har stabil grund (score ${score}/100) men låg digital närvaro (${digital}/100). Efterfrågan finns men fångas inte. Vinkeln resonerar eftersom tillväxt känns uppnåelig — du ber dem inte laga grunden.`;
    } else if (type === "foundation_gap") {
      title = "Grund-fix först";
      why = `${name} saknar digital infrastruktur. Utan förtroendesignaler och lead capture är all trafik bortkastad. Positionera ditt erbjudande som förutsättning för tillväxt.`;
    } else if (type === "mature_competitor") {
      title = "Differentiering + systemhävarm";
      why = `${name} är redan starka — generiska pitchar landar inte. Fokusera på systemeffektivitet och differentiering. De behöver inte fler följare utan bättre konverteringsmekanik och en skarpare edge.`;
    } else if (rp === "unstable_business") {
      title = "Stabilisera innan skalning";
      why = `${name} visar instabilitetstecken (risk ${risk}/100). Bygg förtroende först — rama in erbjudandet som en stabiliserande åtgärd som skyddar och förstärker det de byggt.`;
    } else if (opportunity >= 70 && risk <= 45) {
      title = "Direkt tillväxtsystem";
      why = `${name} har tydlig uppsida (möjlighet ${opportunity}/100) med hanterbar risk (${risk}/100). Direkt och självsäker pitch — de har grunden och marknadsförutsättningarna, de behöver bara rätt system.`;
    } else {
      title = "Värde-först teardown";
      why = `${name} är ett blandat lead. Säkraste vinkeln: en specifik observation om deras verksamhet följt av ett gratis teardown-erbjudande. Minskar motstånd och låter värdet sälja sig självt.`;
    }
    const body = [
      oppInsight?.message ? `Opportunity: ${oppInsight.message}` : "",
      `Context: Jag går igenom ${industry} i ${loc}.`,
      `Vinkel: ${title}.`,
      `Erbjudande: 10–15 min teardown + enkel plan ni kan implementera direkt.`,
    ].filter(Boolean).join(" ");
    return { title, why, body };
  }

  return {
    title: "Value-first teardown",
    why: `${name} — lead with a specific observation and offer a free teardown.`,
    body: `Context: I'm reviewing ${industry} businesses in ${loc}. Offer: 10–15 min teardown + a simple plan you can implement immediately.`,
  };
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
  forceRefresh?: boolean;
}): Promise<{
  runId: number;
  leads: LeadUI[];
  nextCursor: string | null;
  exhausted: boolean;
  cached: boolean;
  ageDays: number;
  cachedAt: string | null;
} | null> {
  const niche = args.niche.trim();
  if (!niche) return null;

  const locationText = args.location.trim();
  const socialPresence = args.socialPresence;

  const provider = args.provider;

  const runIdArg = args.runId ?? null;
  const cursor = args.cursor ?? null;

  // 30s timeout on search — prevents indefinite hang on slow APIs
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), 30000);

  // Expand niche into synonym queries (e.g. "mäklare" → ["mäklare", "real estate"])
  // Only expand on first page (no cursor) to avoid doubling paginated requests
  const searchQueries = cursor ? [niche] : getSearchQueries(niche);
  const primaryQuery = searchQueries[0];
  const expandedQueries = searchQueries.slice(1);

  const searchRes = await fetch("/api/providers/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: timeoutController.signal,
    body: JSON.stringify({
      provider,
      query: primaryQuery,
      country: "Sweden",
      location: locationText || undefined,
      socialPresence: socialPresence,
      limit: 25,
      runId: runIdArg,
      cursor,
      forceRefresh: args.forceRefresh ?? false,
    }),
  }).catch((err) => {
    if (err?.name === "AbortError") {
      throw new Error("Search timed out. Try again or check your connection.");
    }
    return null;
  });

  clearTimeout(timeoutId);

  if (!searchRes?.ok) return null;

  const searchData = (await searchRes
    .json()
    .catch(() => ({}))) as ProviderSearchResponse;
  const runId = typeof searchData.runId === "number" ? searchData.runId : null;
  // Expose cache metadata for UI badge
  const _cacheInfo = (searchData.summary as Record<string, unknown> | null) ?? null;

  if (!runId) return null;

  const leadsRes = await fetch(`/api/providers/runs/${runId}/leads`).catch(
    () => null,
  );
  if (!leadsRes?.ok) return null;

  const leadsData = (await leadsRes
    .json()
    .catch(() => ({}))) as RunLeadsResponse;
  const incoming = (leadsData?.leads ?? null) as unknown;
  const primaryLeads: LeadUI[] = Array.isArray(incoming) ? (incoming as LeadUI[]) : [];

  // ── Synonym expansion: fire secondary searches in parallel ──────────────
  // e.g. if user searched "mäklare", also search "real estate" and merge
  let expandedLeads: LeadUI[] = [];
  if (expandedQueries.length > 0) {
    const secondaryResults = await Promise.allSettled(
      expandedQueries.map(async (q) => {
        const res = await fetch("/api/providers/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider,
            query: q,
            country: "Sweden",
            location: locationText || undefined,
            socialPresence: socialPresence,
            limit: 25,
          }),
        }).catch(() => null);
        if (!res?.ok) return [];
        const data = (await res.json().catch(() => ({}))) as ProviderSearchResponse;
        const secRunId = typeof data.runId === "number" ? data.runId : null;
        if (!secRunId) return [];
        const secLeadsRes = await fetch(`/api/providers/runs/${secRunId}/leads`).catch(() => null);
        if (!secLeadsRes?.ok) return [];
        const secLeadsData = (await secLeadsRes.json().catch(() => ({}))) as RunLeadsResponse;
        return Array.isArray(secLeadsData?.leads) ? (secLeadsData.leads as LeadUI[]) : [];
      })
    );
    for (const result of secondaryResults) {
      if (result.status === "fulfilled") expandedLeads = expandedLeads.concat(result.value);
    }
  }

  // Deduplicate by company name (case-insensitive) — primary results take precedence
  const seenNames = new Set(primaryLeads.map((l: LeadUI) => l.company.name.toLowerCase()));
  const uniqueExpanded = expandedLeads.filter((l: LeadUI) => !seenNames.has(l.company.name.toLowerCase()));
  const allLeads = [...primaryLeads, ...uniqueExpanded];

  return {
    runId,
    leads: allLeads,
    nextCursor: searchData.nextCursor ?? null,
    exhausted: searchData.exhausted ?? false,
    cached: (_cacheInfo?.cached as boolean) ?? false,
    ageDays: (_cacheInfo?.ageDays as number) ?? 0,
    cachedAt: (_cacheInfo?.cachedAt as string) ?? null,
  };
}

export default function Home() {
  const { success: toastSuccess, error: toastError, info: toastInfo } = useToast();

  // =====================
  // STATE
  // =====================

  const [provider, setProvider] = useState<ProviderName>("google_places");

  const [language, setLanguage] = useState<Language>(() => {
    if (typeof window === "undefined") return "en";
    try {
      const raw = localStorage.getItem("vantio_state_v1");
      if (!raw) return "en";
      const p = JSON.parse(raw);
      return p.language === "en" || p.language === "sv" ? p.language : "en";
    } catch { return "en"; }
  });
  const [userEmail, setUserEmail] = useState<string>("");

  // Fetch current user email
  useEffect(() => {
    const supabase = createSupabaseBrowser();
    supabase.auth.getUser().then(({ data }: { data: { user: { email?: string } | null } }) => {
      if (data.user?.email) setUserEmail(data.user.email);
    });
  }, []);
  const t = useMemo(() => getTranslations(language), [language]);

  const [niche, setNiche] = useState(() => {
    if (typeof window === "undefined") return "";
    try { const p = JSON.parse(localStorage.getItem("vantio_state_v1") ?? "{}"); return typeof p.niche === "string" ? p.niche : ""; } catch { return ""; }
  });
  const [location, setLocation] = useState(() => {
    if (typeof window === "undefined") return "";
    try { const p = JSON.parse(localStorage.getItem("vantio_state_v1") ?? "{}"); return typeof p.location === "string" ? p.location : ""; } catch { return ""; }
  });
  const [showNicheDropdown, setShowNicheDropdown] = useState(false);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [socialPresence, setSocialPresence] = useState<SocialPresenceFilter>(() => {
    if (typeof window === "undefined") return "any";
    try {
      const p = JSON.parse(localStorage.getItem("vantio_state_v1") ?? "{}");
      const v = p.socialPresence;
      return (v === "low" || v === "medium" || v === "high" || v === "") ? v : "any";
    } catch { return "any"; }
  });

  const [leads, setLeads] = useState<LeadUI[]>([]);
  const [sortBy, setSortBy] = useState<
    "score" | "opportunity" | "risk" | "confidence" | "fit"
  >("score");
  const [minScore, setMinScore] = useState(0);
  const [filterHasWebsite, setFilterHasWebsite] = useState<"any"|"yes"|"no">("any");
  const [showScoreModal, setShowScoreModal] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<"contacted"|"replied"|"booked"|null>(null);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const [recentSearches, setRecentSearches] = useState<SearchRecord[]>([]);
  const [saveSearchName, setSaveSearchName] = useState("");
  const [showSaveSearchInput, setShowSaveSearchInput] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const [savedLeadIds, setSavedLeadIds] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = JSON.parse(localStorage.getItem("vantio_saved_leads_v1") ?? "[]") as { id: string }[];
      return new Set(raw.map((l) => l.id));
    } catch { return new Set(); }
  });

  const [selectedLead, setSelectedLead] = useState<LeadUI | null>(null);
  const [detailTab, setDetailTab] = useState<
    "overview" | "signals" | "outreach" | "tracking"
  >("overview");
  const userPlan = getEffectivePlan();
  const deepScanUnlocked = canUseDeepEnrichment(userPlan);

  const [enrichmentLoading, setEnrichmentLoading] = useState(false);
  const [isRescoring, setIsRescoring] = useState(false);

  const [enrichmentData, setEnrichmentData] = useState<{
    reachable: boolean;
    detectedPlatforms: string[];
    signals: Record<string, { value: unknown; confidence: number }>;
  } | null>(null);
  const [deepScanLoading, setDeepScanLoading] = useState(false);
  const [deepScanData, setDeepScanData] = useState<{
    deepScore: number;
    pageReachable: boolean;
    scannedAt?: string;   // ISO string — set on restore from DB or on fresh scan
    isFromCache?: boolean;
    website: { scores: Record<string, number>; summary: string };
    market: { scores: Record<string, number>; competitorSummary: string; recommendation: string };
    brand: { scores: Record<string, number>; brandGrade: string; weakestArea: string; strengthArea: string };
  } | null>(null);

  // Variant for outcome tracking
  type OutreachVariant = "soft" | "consultative" | "direct" | "bold";
  const [outreachVariant, setOutreachVariant] =
    useState<OutreachVariant>("consultative");

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

  // Derive hasBookingCta / hasClearOffer / isMobileFriendly from deep scan result
  function deriveDeepSignals(data: { pageReachable: boolean; website: { scores: Record<string, number> } }) {
    return {
      websiteReachable: data.pageReachable,
      hasBookingCta:    data.pageReachable ? (data.website.scores.ctaStrength ?? 0) >= 50 : null,
      hasClearOffer:    data.pageReachable ? (data.website.scores.ctaStrength ?? 0) >= 40 : null,
      isMobileFriendly: data.pageReachable ? (data.website.scores.pageSpeed ?? 0) >= 50 : null,
    };
  }

  function applyDeepScanToLead(lead: LeadUI, deepData: typeof deepScanData, derivedSignals: ReturnType<typeof deriveDeepSignals>): LeadUI {
    if (!deepData) return lead;
    try {
      const newScore = rescoreWithLightSignals({
        rating: lead.metrics.rating ?? 0,
        reviewCount: lead.metrics.reviewCount ?? 0,
        hasWebsite: !!lead.company.website,
        socialPresence: lead.metrics.socialPresence ?? "low",
        isGoodFit: lead.classification.isGoodFit ?? false,
        classificationConfidence: lead.classification.confidence ?? null,
        riskProfile: lead.score.riskProfile ?? "unknown",
        fitScore: lead.fit?.fitScore ?? 0,
        websiteReachable: derivedSignals.websiteReachable,
        hasContactPage: null,
        hasBookingCta: derivedSignals.hasBookingCta,
        hasClearOffer: derivedSignals.hasClearOffer,
        isMobileFriendly: derivedSignals.isMobileFriendly,
        socialPlatformCount: 0,
        ownerResponds: null,
      });
      return { ...lead, score: newScore };
    } catch {
      return lead;
    }
  }

  async function runDeepScan(lead: LeadUI): Promise<void> {
    if (deepScanLoading) return;
    setDeepScanLoading(true);
    setDeepScanData(null);
    try {
      const res = await fetch("/api/enrich/deep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          website: lead.company.website ?? null,
          nearbyCompetitorCount: 8,
          nearbyWithWebsite: 4,
          nearbyHighRated: 3,
          nearbyHighReviewCount: 2,
          searchVolumeProxy: lead.score.opportunity >= 70 ? "high" : lead.score.opportunity >= 40 ? "medium" : "low",
        }),
      });
      if (!res.ok) {
        if (res.status === 429 || res.status === 403) {
          const errData = await res.json().catch(() => ({})) as { error?: string };
          toastError(errData.error ?? "Deep scan limit reached.");
        }
        return;
      }
      const data = await res.json();
      if (data.success) {
        const scanResult = {
          deepScore: data.deepScore,
          pageReachable: data.pageReachable,
          scannedAt: new Date().toISOString(),
          isFromCache: false,
          website: data.website,
          market: data.market,
          brand: data.brand,
        };
        const derivedSignals = deriveDeepSignals(scanResult);

        // 1. Update display state
        setDeepScanData(scanResult);

        // 2. Rescore lead in-memory so outreach tab + score reflect deep signals immediately
        const rescored = applyDeepScanToLead(lead, scanResult, derivedSignals);
        setLeads((prev: LeadUI[]) => prev.map((l: LeadUI) => l.id === lead.id ? rescored : l));
        setSelectedLead(rescored);

        // 3. Persist to Supabase (fire-and-forget — don't block UX)
        fetch("/api/deep-scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceId: lead.sourceId,
            leadId: lead.id,
            scanResult,
            derivedSignals,
          }),
        }).catch(() => { /* ignore persistence errors */ });
      }
    } catch {
      // fail soft
    } finally {
      setDeepScanLoading(false);
    }
  }

  async function saveOutcome(args: {
    runId: number;
    leadId: string;
    patch: Partial<
      Pick<LeadOutcomeUI, "contacted" | "replied" | "booked_call" | "closed" | "revenue" | "notes" | "followup_date" | "lost_reason" | "tonality" | "angle_type" | "score_at_outreach">
    >;
  }) {
    const { runId, leadId, patch } = args;

    // optimistic update
    setOutcomesByLeadId((prev: Record<string, LeadOutcomeUI>) => {
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
        followup_date: existing?.followup_date ?? null,
        tonality: existing?.tonality ?? null,
        angle_type: existing?.angle_type ?? null,
        lost_reason: existing?.lost_reason ?? null,
        score_at_outreach: existing?.score_at_outreach ?? null,
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
        revenue: patch.revenue,
        notes: patch.notes,
        followupDate: patch.followup_date,
        tonality: patch.tonality !== undefined ? patch.tonality : outreachVariant,
        angleType: patch.angle_type !== undefined ? patch.angle_type : (selectedLead ? getStructuredAngle(selectedLead as LeadUI, language).title : null),
        lostReason: patch.lost_reason,
        scoreAtOutreach: patch.score_at_outreach,
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
        setOutcomesByLeadId((prev: Record<string, LeadOutcomeUI>) => ({ ...prev, [leadId]: outcome }));
        setChecklistState((prev: typeof checklistState) => ({ ...prev, hasOutcome: true }));
      }
    } finally {
      setIsSavingOutcome(false);
    }
  }

  // =====================
  // DERIVED
  // =====================

  const filteredLeads = useMemo(() => {
    return leads.filter((l: LeadUI) => {
      if ((l.score.value ?? 0) < minScore) return false;

      if (filterHasWebsite === "yes" && !l.company.website) return false;
      if (filterHasWebsite === "no" && !!l.company.website) return false;

      const q = query.trim().toLowerCase();
      if (q) {
        const hay =
          `${l.company.name} ${l.classification.primaryIndustry} ${leadLocation(l)}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });
  }, [leads, minScore, query, filterHasWebsite]);

  const sortedLeads = useMemo(() => {
    const arr = [...filteredLeads];

    arr.sort((a: LeadUI, b: LeadUI) => {
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
    arr.sort((a: LeadUI, b: LeadUI) => {
      const ai = normalizeLegacyOrNewOpportunityInsight(a);
      const bi = normalizeLegacyOrNewOpportunityInsight(b);
      const av = priority[ai?.strength ?? "low"];
      const bv = priority[bi?.strength ?? "low"];
      if (bv !== av) return bv - av;
      return 0;
    });

    return arr;
  }, [filteredLeads, sortBy]);

  const LEADS_PER_PAGE = 20;
  const [currentPage, setCurrentPage] = useState(1);

  // Reset to page 1 whenever the sorted list changes
  const sortedLeadsKey = sortedLeads.map((l: LeadUI) => l.id).join(",");
  useEffect(() => { setCurrentPage(1); }, [sortedLeadsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalPages = Math.max(1, Math.ceil(sortedLeads.length / LEADS_PER_PAGE));
  const pagedLeads = useMemo(() => {
    const start = (currentPage - 1) * LEADS_PER_PAGE;
    return sortedLeads.slice(start, start + LEADS_PER_PAGE);
  }, [sortedLeads, currentPage]);

  const activeRunId = useMemo(() => {
    const v = Number(sortedLeads?.[0]?.metadata?.runId ?? 0);
    return Number.isFinite(v) && v > 0 ? v : 0;
  }, [sortedLeads]);

  const toggleSaveLead = (lead: LeadUI) => {
    const oppInsight = getLocalizedOpportunityInsight(lead, language);
    const isSaved = savedLeadIds.has(lead.id);
    try {
      const existing = JSON.parse(localStorage.getItem("vantio_saved_leads_v1") ?? "[]") as { id: string }[];
      let updated: { id: string }[];
      if (isSaved) {
        updated = existing.filter((l) => l.id !== lead.id);
      } else {
        const entry = {
          id: lead.id,
          name: lead.company.name,
          industry: lead.classification.primaryIndustry,
          city: lead.company.city,
          country: lead.company.country,
          score: lead.score.value ?? 0,
          opportunity: lead.score.opportunity ?? 0,
          risk: lead.score.risk ?? 0,
          riskProfile: lead.score.riskProfile ?? "unknown",
          reputation: lead.score.breakdown?.reputation ?? 0,
          digitalPresence: lead.score.breakdown?.digitalPresence ?? 0,
          businessStrength: lead.score.breakdown?.businessStrength ?? 0,
          rating: lead.metrics?.rating ?? null,
          reviewCount: lead.metrics?.reviewCount ?? null,
          website: lead.company.website ?? null,
          opportunityMessage: oppInsight?.message ?? null,
          opportunityType: oppInsight?.type ?? null,
          fitScore: lead.fit?.fitScore ?? null,
          matchedNeeds: lead.fit?.matchedNeeds ?? [],
          hasBookingCta: null,
          hasClearOffer: null,
          isMobileFriendly: null,
          socialPresence: lead.metrics?.socialPresence ?? null,
        };
        updated = [entry, ...existing.filter((l) => l.id !== lead.id)].slice(0, 100);
      }
      localStorage.setItem("vantio_saved_leads_v1", JSON.stringify(updated));
      setSavedLeadIds(new Set(updated.map((l) => l.id)));
    } catch { /* ignore */ }
  };

  const selectedOutcome = useMemo(() => {
    if (!selectedLead) return null;
    return outcomesByLeadId[selectedLead.id] ?? null;
  }, [outcomesByLeadId, selectedLead]);

  // =====================
  // EFFECTS
  // =====================

  // Smooth rescoring transition — show "Analyzing…" for 1.5s on lead select
  useEffect(() => {
    if (!selectedLead) { setIsRescoring(false); return; }
    setIsRescoring(true);
    const t = setTimeout(() => setIsRescoring(false), 1500);
    return () => clearTimeout(t);
  }, [selectedLead?.id]);

  useEffect(() => {
    if (!selectedLead?.metadata?.outreach) return;

    const dv = selectedLead.metadata.outreach.defaultVariant;
    setOutreachVariant((["soft","consultative","direct","bold"].includes(dv ?? "") ? dv : "consultative") as OutreachVariant);

  }, [selectedLead]);

  // Scroll to detail panel on mobile when a lead is selected
  useEffect(() => {
    if (!selectedLead) return;
    const isMobile = window.innerWidth < 640;
    if (!isMobile) return;
    setTimeout(() => {
      const el = document.getElementById(`lead-detail-${selectedLead.id}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }, [selectedLead]);

  // Restore persisted deep scan when a lead is selected
  useEffect(() => {
    if (!selectedLead) return;
    const sourceId = selectedLead.sourceId;
    if (!sourceId) return;

    (async () => {
      try {
        const res = await fetch(`/api/deep-scan?sourceId=${encodeURIComponent(sourceId)}`);
        if (!res.ok) return;
        const { data } = await res.json() as { data: {
          scan_result: { deepScore: number; pageReachable: boolean; website: { scores: Record<string, number>; summary: string; signalCount: number }; market: { scores: Record<string, number>; competitorSummary: string; recommendation: string; signalCount: number }; brand: { scores: Record<string, number>; brandGrade: string; weakestArea: string; strengthArea: string; signalCount: number } };
          derived_signals: { hasBookingCta: boolean | null; hasClearOffer: boolean | null; isMobileFriendly: boolean | null; websiteReachable: boolean };
          scanned_at: string;
        } | null };
        if (!data?.scan_result) return;

        // Restore display state
        setDeepScanData({ ...data.scan_result, scannedAt: data.scanned_at, isFromCache: true });

        // Rescore the lead with the persisted deep signals so outreach tab is accurate
        const rescored = applyDeepScanToLead(selectedLead, data.scan_result, data.derived_signals);
        if (rescored.score.value !== selectedLead.score.value) {
          setLeads((prev: LeadUI[]) => prev.map((l: LeadUI) => l.id === selectedLead.id ? rescored : l));
          setSelectedLead(rescored);
        }
      } catch {
        // fail soft — no deep scan cached
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLead?.id]);

  useEffect(() => {
    if (!selectedLead) {
      setEnrichmentData(null);
      setDeepScanData(null);
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
            fitScore: selectedLead?.fit?.fitScore ?? null,
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
          setLeads((prev: LeadUI[]) =>
            prev.map((l: LeadUI) =>
              l.id === leadId ? { ...l, score: data.updatedScore } : l,
            ),
          );
          setSelectedLead((prev: LeadUI | null) =>
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

  // Checklist persistence — other fields (language, niche, location, socialPresence) use lazy useState initialisers
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        checklistDismissed?: boolean;
        checklistHasSearched?: boolean;
        checklistHasSelected?: boolean;
        checklistHasOutcome?: boolean;
      };
      // Only restore checklist progress if it belongs to the current user.
      // This prevents a new account on the same device inheriting another account's state.
      const storedUid = (parsed as { userId?: string }).userId ?? "";
      const currentUid = localStorage.getItem("vantio_uid") ?? "";
      if (!storedUid || !currentUid || storedUid === currentUid) {
        if (parsed.checklistDismissed) setChecklistDismissed(true);
        setChecklistState((prev: typeof checklistState) => ({
          ...prev,
          hasSearched: parsed.checklistHasSearched ?? false,
          hasSelected: parsed.checklistHasSelected ?? false,
          hasOutcome: parsed.checklistHasOutcome ?? false,
        }));
      }
    } catch (e) {
      console.error("Failed to load checklist state:", e);
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
        const searches = Array.isArray(data.searches) ? data.searches : [];
        setRecentSearches(searches);
        // Pre-fill from most recent search if fields are still empty
        if (searches.length > 0) {
          const latest = searches[0];
          setNiche((prev: string) => prev === "" && latest.niche ? latest.niche : prev);
          setLocation((prev: string) => prev === "" && latest.location ? latest.location : prev);
        }
      } catch (e) {
        console.error("Error loading recent searches:", e);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    fetchRecentSearches();
  }, []);

  // Pre-fill location from saved profile if field is still empty
  // Also check checklist completion
  const [checklistDismissed, setChecklistDismissed] = useState(false);
  const [checklistState, setChecklistState] = useState({ hasProfile: false, hasSearched: false, hasSelected: false, hasOutcome: false });
  const [profileChecked, setProfileChecked] = useState(false); // true once profile API has responded

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((data: { profile?: { targetLocation?: string; businessName?: string }; userId?: string }) => {
        const geo = data?.profile?.targetLocation;
        if (geo && typeof geo === "string") {
          setLocation((prev: string) => (prev === "" ? geo : prev));
        }
        const hasProfile = !!(data?.profile?.businessName);
        // Store current user ID so checklist state can be user-scoped
        const supabaseForUid = createSupabaseBrowser();
        supabaseForUid.auth.getUser().then(({ data: authData }) => {
          if (authData.user?.id) {
            try { localStorage.setItem("vantio_uid", authData.user.id); } catch { /* ignore */ }
          }
        }).catch(() => {});
        setChecklistState((prev: typeof checklistState) => ({ ...prev, hasProfile }));
        setProfileChecked(true); // profile API has responded — safe to show banner
        // First-time user: no profile → always redirect to onboarding.
        // We do NOT rely on localStorage because it can contain state from a
        // previous account on the same device (e.g. switching from Outlook to Gmail).
        if (!hasProfile) {
          window.location.href = "/onboarding";
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          userId: (typeof window !== "undefined" ? (localStorage.getItem("vantio_uid") ?? "") : ""),
          language,
          niche,
          location,
          socialPresence,
          checklistDismissed,
          checklistHasSearched: checklistState.hasSearched,
          checklistHasSelected: checklistState.hasSelected,
          checklistHasOutcome: checklistState.hasOutcome,
        }),
      );
    } catch (e) {
      console.error("Failed to save state to localStorage:", e);
    }
  }, [language, niche, location, socialPresence, checklistDismissed, checklistState.hasSearched, checklistState.hasSelected, checklistState.hasOutcome]);

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

    const rows = sortedLeads.map((lead: LeadUI) => {
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
        row.map((field: string | number) => `"${String(field).replace(/"/g, '""')}"`).join(","),
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
    setSearchError(null);
    setHasSearched(true);
    setChecklistState((prev: typeof checklistState) => ({ ...prev, hasSearched: true }));

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

        if (providerLeads.leads.length > 0) {
          toastSuccess(`Found ${providerLeads.leads.length} lead${providerLeads.leads.length !== 1 ? "s" : ""}`);
        } else {
          toastInfo("No leads found — try a different niche or location");
        }
        return;
      }
    } catch (error) {
      console.error("Error fetching leads:", error);
      setLeads([]);
      setSelectedLead(null);
      const msg = error instanceof Error ? error.message : "Something went wrong. Please try again.";
      setSearchError(msg);
      toastError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // =====================
  // RENDER
  // =====================

  // ── CSV EXPORT ─────────────────────────────────────────────
  function exportCSV() {
    const rows: string[][] = [
      [
        "Company", "Website", "City", "Country", "Industry", "Sub-niche",
        "Score", "Fit", "Opportunity", "Readiness", "Risk", "Risk Profile",
        "Social Presence", "Rating", "Reviews",
        "Gap Type", "Seller Type",
        "Contacted", "Replied", "Call Booked", "Closed", "Revenue", "Notes",
      ],
    ];

    for (const lead of sortedLeads) {
      const o = outcomesByLeadId[lead.id];
      const outreach = lead.metadata?.outreach as { gap?: string; sellerType?: string } | null;
      rows.push([
        lead.company.name,
        lead.company.website ?? "",
        lead.company.city ?? "",
        lead.company.country ?? "",
        lead.classification.primaryIndustry.replaceAll("_", " "),
        lead.classification.subNiche ?? "",
        String(lead.score.value ?? 0),
        String(lead.fit?.fitScore ?? ""),
        String(lead.score.opportunity ?? 0),
        String(lead.score.readiness ?? 0),
        String(lead.score.risk ?? 0),
        lead.score.riskProfile ?? "",
        lead.metrics.socialPresence ?? "",
        String(lead.metrics.rating ?? ""),
        String(lead.metrics.reviewCount ?? ""),
        outreach?.gap ?? "",
        outreach?.sellerType ?? "",
        o?.contacted ? "yes" : "no",
        o?.replied ? "yes" : "no",
        o?.booked_call ? "yes" : "no",
        o?.closed ? "yes" : "no",
        String(o?.revenue ?? ""),
        (o?.notes ?? "").replace(/"/g, "'"),
      ]);
    }

    const csv = rows
      .map((r) => r.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toastSuccess(`Exported ${sortedLeads.length} lead${sortedLeads.length !== 1 ? "s" : ""} to CSV`);
  }


  return (
    <main className="min-h-screen bg-[#080808] text-[#f5f0e8] flex flex-col items-center px-4">

      {/* Premium nav bar */}
      <nav className="w-full border-b border-[#252525] bg-[#080808]/90 backdrop-blur-md mb-0">
        <div className="max-w-4xl mx-auto px-0 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[#c9a84c]">◈</span>
            <span className="text-lg font-light tracking-wide" style={{ fontFamily: "var(--font-display), serif" }}>
              Van<span style={{ background: "linear-gradient(135deg, #e8c97a 0%, #c9a84c 50%, #8a6e30 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>tio</span>
            </span>
            <span className="ml-2 text-[10px] tracking-[0.15em] uppercase px-2 py-0.5 rounded-full border border-[rgba(201,168,76,0.3)] text-[#8a6e30]">Beta</span>
          </div>
          <HamburgerMenu hasProfile={true} language={language} onLanguageChange={setLanguage} userEmail={userEmail} />
        </div>
      </nav>

      <div className="w-full max-w-4xl space-y-8 py-8">
        <header className="space-y-1">
          <p className="text-[11px] tracking-[0.2em] uppercase text-[#8a6e30]">{t.ui.header.subtitle}</p>
          <h1 className="text-2xl md:text-3xl font-light" style={{ fontFamily: "var(--font-display), serif" }}>
            {t.ui.header.title}
          </h1>
        </header>

        {/* Top nav */}
        <nav className="flex gap-1 border-b border-[#252525] pb-0">
          <span className="text-[13px] px-4 py-2 font-medium border-b-2 border-[#c9a84c] text-[#c9a84c]">
            🔍 Leads
          </span>
        </nav>

        {/* Onboarding checklist — shown until all steps done or dismissed */}
        {!checklistDismissed && !(checklistState.hasProfile && checklistState.hasSearched && checklistState.hasSelected && checklistState.hasOutcome) && (
          <section className="bg-[#0d0d0d] border border-[#252525] rounded-2xl p-4 md:p-5 shadow-xl shadow-black/40 relative z-0">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <p className="text-[11px] uppercase tracking-widest text-[#c9a84c] mb-0.5">Getting started</p>
                <p className="text-sm text-[#888] leading-snug">Complete these steps to get the most out of Vantio.</p>
              </div>
              <button type="button" onClick={() => setChecklistDismissed(true)} className="text-[#333] hover:text-[#555] text-lg leading-none mt-0.5 shrink-0" title="Dismiss">×</button>
            </div>
            <div className="space-y-2">
              {[
                { done: checklistState.hasProfile,   label: "Set up your profile",    sub: "Tell us your business type and target market",  href: "/profile/settings" },
                { done: checklistState.hasSearched,  label: "Run your first search",  sub: "Enter a niche + location and score your first leads",  href: null },
                { done: checklistState.hasSelected,  label: "Open a lead",            sub: "Click any lead to see signals, gap analysis, and outreach script", href: null },
                { done: checklistState.hasOutcome,   label: "Log an outcome",         sub: "Mark a lead as contacted, replied, or booked", href: null },
              ].map(({ done, label, sub, href }) => (
                <div key={label} className={`flex items-start gap-3 rounded-lg px-3 py-2.5 border transition-colors ${done ? "border-[#1a1a1a] opacity-50 pointer-events-none" : "border-[#252525] bg-[#111]"}`}>
                  <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${done ? "border-[#4ade80] bg-[#4ade80]/10" : "border-[#333]"}`}>
                    {done && <span className="text-[9px] text-[#4ade80]">✓</span>}
                  </div>
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <p className={`text-[12px] font-medium ${done ? "line-through text-[#444]" : "text-[#c8c0b0]"}`}>{label}</p>
                    <p className="text-[11px] text-[#444] mt-0.5">{sub}</p>
                  </div>
                  {!done && href && (
                    <a href={href} className="shrink-0 text-[11px] text-[#c9a84c] hover:text-[#e8c97a] transition-colors mt-0.5">Go →</a>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {recentSearches.length > 0 && (
          <section className="bg-[#111111] border border-[#252525] rounded-2xl p-4 md:p-5 shadow-xl shadow-black/40 space-y-3 relative z-0">
            {/* Profile completeness warning banner — only after profile API responds to prevent flicker */}
            {profileChecked && !checklistState.hasProfile && (
              <div className="flex items-center justify-between gap-4 rounded-xl border border-[#c9a84c]/20 bg-[#c9a84c]/04 px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-[#c9a84c] text-base flex-shrink-0">⚠</span>
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-[#c9a84c] leading-tight">{t.ui.profileBanner.title}</p>
                    <p className="text-[11px] text-[#666] mt-0.5 leading-snug">{t.ui.profileBanner.body}</p>
                  </div>
                </div>
                <a href="/profile/settings" className="flex-shrink-0 text-[11px] px-3 py-1.5 rounded-lg border border-[rgba(201,168,76,0.3)] text-[#c9a84c] hover:bg-[rgba(201,168,76,0.08)] transition-all whitespace-nowrap">
                  {t.ui.profileBanner.cta}
                </a>
              </div>
            )}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-[#f5f0e8]">{t.ui.savedSearches.title}</h2>
                <p className="text-[11px] text-[#555] mt-0.5">{t.ui.savedSearches.subtitle}</p>
              </div>
              <div className="flex items-center gap-2">
                {isLoadingHistory && (
                  <span className="text-[11px] text-[#555] animate-pulse">Updating…</span>
                )}
                {showSaveSearchInput ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      autoFocus
                      type="text"
                      value={saveSearchName}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setSaveSearchName(e.target.value)}
                      onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                        if (e.key === "Enter") {
                          setSaveSearchName("");
                          setShowSaveSearchInput(false);
                        }
                        if (e.key === "Escape") {
                          setSaveSearchName("");
                          setShowSaveSearchInput(false);
                        }
                      }}
                      placeholder={t.ui.savedSearches.nameInputPlaceholder}
                      className="text-[11px] bg-[#0d0d0d] border border-[rgba(201,168,76,0.3)] rounded-lg px-2 py-1 text-[#f5f0e8] placeholder-[#444] focus:outline-none focus:border-[rgba(201,168,76,0.6)] w-36"
                    />
                    <button
                      type="button"
                      onClick={() => { setSaveSearchName(""); setShowSaveSearchInput(false); }}
                      className="text-[11px] text-[#555] hover:text-[#888] px-1"
                    >✕</button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowSaveSearchInput(true)}
                    className="text-[10px] px-2.5 py-1 rounded-lg border border-[rgba(201,168,76,0.25)] text-[#c9a84c] hover:bg-[rgba(201,168,76,0.06)] transition-all tracking-wide"
                  >
                    {t.ui.savedSearches.saveCurrent}
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {recentSearches.map((s: SearchRecord) => {
                const date = new Date(s.created_at);
                const dateStr = date.toLocaleDateString(language === "sv" ? "sv-SE" : "en-GB", { day: "numeric", month: "short" });
                const timeStr = date.toLocaleTimeString(language === "sv" ? "sv-SE" : "en-GB", { hour: "2-digit", minute: "2-digit" });
                return (
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
                    className="text-left rounded-xl border border-[#1a1a1a] bg-[#0d0d0d] hover:border-[rgba(201,168,76,0.3)] hover:bg-[#111] transition-all p-3 space-y-2 group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <p className="text-[13px] font-semibold text-[#f5f0e8] truncate group-hover:text-[#e8c97a] transition-colors">
                          {s.niche || "—"}
                        </p>
                        <p className="text-[11px] text-[#555] truncate mt-0.5">
                          {s.location || "Any location"}
                        </p>
                      </div>
                      <span className="flex-shrink-0 text-[#c9a84c] text-xs opacity-0 group-hover:opacity-100 transition-opacity">↺</span>
                    </div>
                    <div className="flex items-center justify-between">
                      {s.social_presence && s.social_presence !== "" && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded border border-[#252525] text-[#555] capitalize">
                          {s.social_presence} social
                        </span>
                      )}
                      <span className="text-[10px] text-[#333] ml-auto">{dateStr} · {timeStr}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Filter Form */}
        <section className="bg-[#111111] border border-[#252525] rounded-2xl p-6 md:p-8 shadow-xl shadow-black/40 space-y-6">
          {/* Profile completeness banner — show here too when no saved searches exist */}
          {profileChecked && !checklistState.hasProfile && recentSearches.length === 0 && (
            <div className="flex items-center justify-between gap-4 rounded-xl border border-[#c9a84c]/20 bg-[#c9a84c]/04 px-4 py-3 -mb-2">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-[#c9a84c] text-base flex-shrink-0">⚠</span>
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold text-[#c9a84c] leading-tight">{t.ui.profileBanner.title}</p>
                  <p className="text-[11px] text-[#666] mt-0.5 leading-snug">{t.ui.profileBanner.body}</p>
                </div>
              </div>
              <a href="/profile/settings" className="flex-shrink-0 text-[11px] px-3 py-1.5 rounded-lg border border-[rgba(201,168,76,0.3)] text-[#c9a84c] hover:bg-[rgba(201,168,76,0.08)] transition-all whitespace-nowrap">
                {t.ui.profileBanner.cta}
              </a>
            </div>
          )}
          <h2 className="text-xl font-semibold mt-3">{t.ui.filters.title}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1 relative">
                <label className="block text-sm font-medium">
                  {t.ui.filters.nicheLabel}
                </label>
                <input
                  type="text"
                  value={niche}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setNiche(e.target.value)}
                  onFocus={() => setShowNicheDropdown(true)}
                  onBlur={() => setTimeout(() => setShowNicheDropdown(false), 150)}
                  placeholder="e.g. real estate, tattoo studio"
                  className="w-full rounded-lg bg-[#111111] border border-[#2a2a2a] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {showNicheDropdown && recentSearches.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-xl border border-[#252525] bg-[#111] shadow-xl overflow-hidden">
                    <p className="text-[10px] uppercase tracking-widests text-[#444] px-3 pt-2.5 pb-1">Recent searches</p>
                    {recentSearches.slice(0, 5).map((s: SearchRecord, i: number) => (
                      <button key={i} type="button"
                        onMouseDown={() => { setNiche(s.niche || ""); setLocation(s.location || ""); setShowNicheDropdown(false); }}
                        className="w-full text-left px-3 py-2 text-[12px] text-[#888] hover:bg-[#1a1a1a] hover:text-[#c8c0b0] transition-colors flex items-center justify-between"
                      >
                        <span>{s.niche || "—"}</span>
                        <span className="text-[#444]">{s.location || ""}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs text-[#888]">
                  {t.ui.filters.providerLabel}
                </label>
                <select
                  value={provider}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                    const v = e.target.value as ProviderName;
                    setProvider(v);
                  }}
                  className="bg-[#111111] border border-[#2a2a2a] rounded-md px-3 py-2 text-sm"
                >
                  <option value="google_places">Google Places</option>
                  {process.env.NEXT_PUBLIC_SERP_API_KEY && (
                    <option value="serp">SERP (Organic)</option>
                  )}
                  {process.env.NEXT_PUBLIC_SHOW_MOCK_PROVIDER === "true" && (
                    <option value="mock">Mock (Dev)</option>
                  )}
                </select>
              </div>

              <div className="space-y-1 relative">
                <label className="block text-sm font-medium">
                  {t.ui.filters.locationLabel}
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setLocation(e.target.value)}
                  onFocus={() => setShowLocationDropdown(true)}
                  onBlur={() => setTimeout(() => setShowLocationDropdown(false), 150)}
                  placeholder="e.g. Stockholm"
                  className="w-full rounded-lg bg-[#111111] border border-[#2a2a2a] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {showLocationDropdown && recentSearches.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-xl border border-[#252525] bg-[#111] shadow-xl overflow-hidden">
                    <p className="text-[10px] uppercase tracking-widests text-[#444] px-3 pt-2.5 pb-1">Recent searches</p>
                    {recentSearches.slice(0, 5).map((s: SearchRecord, i: number) => (
                      <button key={i} type="button"
                        onMouseDown={() => { setNiche(s.niche || ""); setLocation(s.location || ""); setShowLocationDropdown(false); }}
                        className="w-full text-left px-3 py-2 text-[12px] text-[#888] hover:bg-[#1a1a1a] hover:text-[#c8c0b0] transition-colors flex items-center justify-between"
                      >
                        <span>{s.location || "—"}</span>
                        <span className="text-[#444]">{s.niche || ""}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-medium">
                  {t.ui.filters.socialPresenceLabel}
                </label>
                <select
                  value={socialPresence}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                setSocialPresence(e.target.value as SocialPresenceFilter)
                  }
                  className="w-full rounded-lg bg-[#111111] border border-[#2a2a2a] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
              className="inline-flex items-center justify-center rounded-lg bg-[#c9a84c] text-[#080808] hover:bg-[#e8c97a] disabled:bg-[rgba(201,168,76,0.1)] disabled:text-[#666] px-6 py-2.5 text-sm font-semibold tracking-wide transition-all shadow-lg shadow-[rgba(201,168,76,0.15)]"
            >
              {isLoading
                ? t.ui.filters.generatingButton
                : t.ui.filters.generateButton}
            </button>
          </form>
        </section>

        {/* Results */}
        <section className="bg-[#111111] border border-[#252525] rounded-2xl p-6 md:p-8 shadow-xl shadow-black/40 space-y-4 overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold">{t.ui.results.title}</h2>
              <p className="text-xs text-[#888]">
                {t.ui.results.showing} {sortedLeads.length} {t.ui.results.leads}
                {totalPages > 1 && (
                  <span className="text-[#444] ml-1">· page {currentPage}/{totalPages}</span>
                )}
              </p>


              <div className="flex flex-wrap items-center gap-3 pt-2">
                <label className="flex items-center gap-2 text-xs text-[#aaa]">
                  {t.ui.results.minScore}:
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={minScore}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setMinScore(Number(e.target.value))}
                  />
                  <span className="w-8 text-right">{minScore}</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-[#aaa]">
                  {t.ui.results.sortBy}
                  <select
                    value={sortBy}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                      setSortBy(
                        e.target.value as
                          | "score"
                          | "opportunity"
                          | "risk"
                          | "confidence"
                          | "fit",
                      )
                    }
                    className="rounded-md bg-[#111111] border border-[#2a2a2a] px-2 py-1"
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

                <label className="flex items-center gap-2 text-xs text-[#aaa]">
                  Website
                  <select
                    value={filterHasWebsite}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) => setFilterHasWebsite(e.target.value as "any"|"yes"|"no")}
                    className="rounded-md bg-[#111111] border border-[#2a2a2a] px-2 py-1"
                  >
                    <option value="any">Any</option>
                    <option value="yes">Has website</option>
                    <option value="no">No website</option>
                  </select>
                </label>

                <input
                  value={query}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
                  placeholder={t.ui.results.searchPlaceholder}
                  className="flex-1 min-w-[180px] rounded-md bg-[#111111] border border-[#2a2a2a] px-2 py-1 text-xs"
                />

                {sortedLeads.length > 0 && (
                  <button
                    type="button"
                    onClick={exportCSV}
                    className="text-[11px] px-3 py-1.5 rounded-md border border-[rgba(201,168,76,0.3)] text-[#c9a84c] hover:bg-[rgba(201,168,76,0.08)] transition-colors flex items-center gap-1.5 whitespace-nowrap"
                  >
                    ↓ Export CSV
                  </button>
                )}
              </div>
            </div>

            {/* Load more */}
            {!exhausted && nextCursor !== null && runId !== null && (
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={isLoading}
                className="text-xs border border-[#333] rounded-lg px-4 py-1.5 bg-[#111111]/60 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#1a1a1a] transition text-[#888] hover:text-[#c8c0b0]"
              >
                {isLoading ? "Loading…" : `Load more`}
              </button>
            )}
            {exhausted && leads.length > 0 && (
              <span className="text-[11px] text-[#333]">All leads loaded</span>
            )}

            <button
              type="button"
              onClick={downloadCsv}
              disabled={sortedLeads.length === 0}
              className="text-xs border border-[#333] rounded-lg px-3 py-1 bg-[#111111]/60 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#1a1a1a] transition"
            >
              {t.ui.results.download}
            </button>
          </div>

          {sortedLeads.length === 0 ? (
            <div className="py-6">
              {/* Error state */}
              {searchError && (
                <div className="rounded-xl border border-[#f87171]/20 bg-[#f87171]/5 p-5 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[#f87171]">⚠</span>
                    <p className="text-[13px] font-semibold text-[#f87171]">Search failed</p>
                  </div>
                  <p className="text-[12px] text-[#888] leading-relaxed">{searchError}</p>
                  <p className="text-[11px] text-[#555]">Check your API key configuration or try a different search.</p>
                </div>
              )}

              {/* Loading state */}
              {isLoading && !searchError && (
                <div className="flex flex-col items-center gap-4 py-8">
                  <div className="w-6 h-6 rounded-full border-2 border-[#c9a84c] border-t-transparent animate-spin" />
                  <p className="text-[13px] text-[#555]">Scanning leads and scoring…</p>
                </div>
              )}

              {/* Empty after search */}
              {!isLoading && !searchError && hasSearched && leads.length === 0 && (
                <div className="flex flex-col items-center gap-3 py-10 text-center">
                  <span className="text-3xl text-[#333]">◈</span>
                  <p className="text-[14px] text-[#888] font-medium">No leads found for this search</p>
                  <p className="text-[12px] text-[#555] max-w-sm leading-relaxed">
                    Try broadening your niche, removing the location, or lowering the minimum score filter.
                  </p>
                </div>
              )}

              {/* Empty after filter */}
              {!isLoading && !searchError && hasSearched && leads.length > 0 && sortedLeads.length === 0 && (
                <div className="flex flex-col items-center gap-3 py-10 text-center">
                  <span className="text-3xl text-[#333]">◇</span>
                  <p className="text-[14px] text-[#888] font-medium">All leads filtered out</p>
                  <p className="text-[12px] text-[#555] max-w-sm leading-relaxed">
                    {leads.length} lead{leads.length !== 1 ? "s" : ""} found but none pass the current filters. Lower the minimum score or clear the search query.
                  </p>
                </div>
              )}

              {/* Pre-search prompt */}
              {!isLoading && !searchError && !hasSearched && (
                <div className="flex flex-col items-center gap-3 py-10 text-center">
                  <span className="text-3xl text-[#252525]">◈</span>
                  <p className="text-[13px] text-[#555]">
                    {t.ui.results.empty}
                    <span className="font-semibold text-[#888]"> &quot;Generate Leads&quot;</span>.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* ── Bulk action toolbar ── */}
              {bulkSelected.size > 0 && (
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-[rgba(201,168,76,0.3)] bg-[rgba(201,168,76,0.06)] mb-2">
                  <p className="text-[12px] text-[#c9a84c] font-medium">{bulkSelected.size} selected</p>
                  <div className="flex gap-2 ml-auto">
                    {bulkSelected.size >= 2 && bulkSelected.size <= 3 && (
                      <button type="button"
                        onClick={() => { setCompareIds([...bulkSelected]); setCompareMode(true); }}
                        className="text-[11px] px-3 py-1.5 rounded-lg border border-[#818cf8]/30 text-[#818cf8] hover:bg-[rgba(129,140,248,0.08)] transition-all">
                        ⊡ Compare
                      </button>
                    )}
                    {(["contacted","replied","booked"] as const).map(action => (
                      <button key={action} type="button"
                        onClick={async () => {
                          setBulkAction(action);
                          const activeRunId = sortedLeads.find((l: LeadUI) => bulkSelected.has(l.id))?.metadata?.runId;
                          await Promise.all([...bulkSelected].map(id =>
                            fetch("/api/outcomes", { method: "POST", headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ leadId: id, runId: activeRunId ?? 0, [action]: true }) })
                          ));
                          setBulkSelected(new Set());
                          setBulkAction(null);
                          toastSuccess(`Marked ${bulkSelected.size} leads as ${action}`);
                        }}
                        className="text-[11px] px-3 py-1.5 rounded-lg border border-[#c9a84c]/25 text-[#c9a84c] hover:bg-[rgba(201,168,76,0.1)] transition-all capitalize">
                        Mark {action}
                      </button>
                    ))}
                    <button type="button" onClick={() => setBulkSelected(new Set())}
                      className="text-[11px] px-3 py-1.5 rounded-lg border border-[#252525] text-[#555] hover:border-[#444] transition-all">
                      Clear
                    </button>
                  </div>
                </div>
              )}

              {/* ── LEADS TABLE (desktop) / CARDS (mobile) ── */}

              {/* MOBILE CARD LIST */}
              <div className="flex flex-col gap-2 sm:hidden">
                {pagedLeads.map((lead) => {
                  const isSelected = selectedLead?.id === lead.id;
                  const insight = getLocalizedOpportunityInsight(lead, language);
                  const gapLabel = insight?.type === "conversion_gap" ? t.ui.detail.whyNoBookingFlow
                    : insight?.type === "visibility_gap" ? t.ui.detail.whyLowDigital
                    : insight?.type === "foundation_gap" ? t.ui.detail.whyMissingInfra
                    : insight?.type === "mature_competitor" ? t.ui.detail.whyAlreadyEstablished
                    : lead.score.riskProfile === "unstable_business" ? t.ui.detail.whyUnstableSignals
                    : (lead.score.value ?? 0) >= 80 ? t.ui.detail.whyTopTier
                    : (lead.score.value ?? 0) >= 60 ? t.ui.detail.whyGoodValueFit
                    : t.ui.detail.whyLowPriority;
                  const scoreColor = (lead.score.value ?? 0) >= 80 ? "#4ade80" : (lead.score.value ?? 0) >= 60 ? "#c9a84c" : "#888";
                  const fitColor = (lead.fit?.fitScore ?? 0) >= 65 ? "#4ade80" : (lead.fit?.fitScore ?? 0) >= 40 ? "#c9a84c" : "#f87171";
                  const riskColor = (lead.score.risk ?? 0) >= 70 ? "#f87171" : (lead.score.risk ?? 0) >= 40 ? "#c9a84c" : "#4ade80";
                  return (
                    <div
                      key={lead.id}
                      onClick={() => { setSelectedLead(lead); setChecklistState((prev: typeof checklistState) => ({ ...prev, hasSelected: true })); }}
                      className={"rounded-xl border cursor-pointer transition-colors p-3 " + (isSelected ? "border-[rgba(201,168,76,0.4)] bg-[#111]" : "border-[#1e1e1e] bg-[#0d0d0d] hover:border-[#2a2a2a] hover:bg-[#111]")}
                    >
                      {/* Row 1: name + score badge */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0">
                          <p className="font-medium text-[13px] truncate">{lead.company.name}</p>
                          <p className="text-[10px] text-[#555] mt-0.5 truncate">
                            {leadLocation(lead)} · {lead.classification.primaryIndustry.replaceAll("_", " ")}
                          </p>
                        </div>
                        <span className="text-[12px] font-bold shrink-0 px-2 py-0.5 rounded-md" style={{ color: scoreColor, background: `${scoreColor}18`, border: `1px solid ${scoreColor}30` }}>
                          {lead.score.value ?? 0}
                        </span>
                      </div>
                      {/* Row 2: score metrics grid */}
                      <div className="grid grid-cols-3 gap-1.5 mb-2">
                        {[
                          { label: "Fit", value: lead.fit?.fitScore ?? 0, color: fitColor },
                          { label: "Opp", value: lead.score.opportunity ?? 0, color: "#818cf8" },
                          { label: "Risk", value: lead.score.risk ?? 0, color: riskColor },
                        ].map((m) => (
                          <div key={m.label} className="rounded-lg bg-[#111] border border-[#1a1a1a] px-2 py-1.5 text-center">
                            <p className="text-[11px] font-bold" style={{ color: m.color }}>{m.value}</p>
                            <p className="text-[9px] text-[#444] uppercase tracking-wide">{m.label}</p>
                          </div>
                        ))}
                      </div>
                      {/* Row 3: insight */}
                      <p className="text-[10px] text-[#555] leading-snug">⚡ {gapLabel}</p>
                    </div>
                  );
                })}
              </div>

              {/* DESKTOP TABLE — hidden on mobile except when a lead is selected */}
              <div className={selectedLead ? "block overflow-x-auto" : "hidden sm:block overflow-x-auto"}>
              <table className="w-full text-sm border-collapse min-w-[600px]">
                <thead className="hidden sm:table-header-group">
                  <tr className="bg-[#111111] border-b border-[#252525]">
                    <th className="text-left py-2 px-3 w-[30%]">
                      {t.ui.table.company}
                    </th>
                    <th className="text-left py-2 px-3 w-[10%]">{t.ui.table.score}</th>
                    <th className="text-left py-2 px-3 w-[8%]">Fit</th>
                    <th className="text-left py-2 px-3 w-[12%]">
                      {t.ui.table.opportunity}
                    </th>
                    <th className="text-left py-2 px-3 w-[8%]">{t.ui.table.risk}</th>
                    <th className="text-left py-2 px-3">
                      {t.ui.table.insight}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pagedLeads.map((lead: LeadUI) => {
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
                      { key: "overview", label: t.ui.detail.tabOverview },
                      { key: "signals", label: t.ui.detail.tabSignals },
                      { key: "outreach", label: t.ui.detail.tabOutreach },
                      { key: "tracking", label: t.ui.detail.tabTracking },
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
                          onClick={() => { setSelectedLead(lead); setChecklistState((prev: typeof checklistState) => ({ ...prev, hasSelected: true })); }}
                          className={
                            "border-b border-[#252525] hover:bg-[#111111]/70 cursor-pointer " +
                            (isSelected ? "bg-[#111111]/90" : "") +
                            " hidden sm:table-row"
                          }
                        >
                          <td className="py-2 pl-3 pr-1 w-6">
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                setBulkSelected(prev => {
                                  const next = new Set(prev);
                                  if (next.has(lead.id)) next.delete(lead.id);
                                  else next.add(lead.id);
                                  return next;
                                });
                              }}
                              className="flex items-center justify-center w-4 h-4 focus:outline-none"
                              title="Select lead"
                            >
                              {/* Diamond shape — rotated square */}
                              <span
                                className="block w-3 h-3 rotate-45 border transition-all duration-150"
                                style={bulkSelected.has(lead.id) ? {
                                  backgroundColor: "#c9a84c",
                                  borderColor: "#c9a84c",
                                  boxShadow: "0 0 6px rgba(201,168,76,0.4)"
                                } : {
                                  backgroundColor: "transparent",
                                  borderColor: "#2a2a2a"
                                }}
                              />
                            </button>
                          </td>
                          <td className="py-2 px-3">
                            <div>
                              <span className="font-medium text-[13px] truncate max-w-[140px] sm:max-w-none block">
                                {lead.company.name}
                              </span>
                              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                <span className="text-[10px] text-[#555]">{leadLocation(lead)}</span>
                                <span className="text-[10px] text-[#444]">·</span>
                                <span className="text-[10px] text-[#555]">
                                  {lead.classification.primaryIndustry.replaceAll("_", " ")}
                                </span>
                                {lead.company.website && (
                                  <a href={lead.company.website} target="_blank" rel="noreferrer"
                                    onClick={(e: MouseEvent) => e.stopPropagation()}
                                    className="text-[10px] text-[#c9a84c] hover:underline">
                                    Visit ↗
                                  </a>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="py-2 px-3">
                            <div className="text-xs font-medium mb-1">
                              {lead.score.value ?? 0}
                            </div>
                            <div className="w-full bg-[#1a1a1a] rounded-full h-1.5 overflow-hidden">
                              <div
                                className={
                                  "h-1.5 rounded-full " +
                                  ((lead.score.value ?? 0) >= 80
                                    ? "bg-emerald-400"
                                    : (lead.score.value ?? 0) >= 60
                                      ? "bg-amber-400"
                                      : "bg-[#555]")
                                }
                                style={{ width: `${lead.score.value ?? 0}%` }}
                              />
                            </div>
                            {(() => {
                              const insight = getLocalizedOpportunityInsight(lead, language);
                              const score = lead.score.value ?? 0;
                              const whyLabel = insight?.type === "conversion_gap"
                                ? t.ui.detail.whyNoBookingFlow
                                : insight?.type === "visibility_gap"
                                ? t.ui.detail.whyLowDigital
                                : insight?.type === "foundation_gap"
                                ? t.ui.detail.whyMissingInfra
                                : insight?.type === "mature_competitor"
                                ? t.ui.detail.whyAlreadyEstablished
                                : lead.score.riskProfile === "unstable_business"
                                ? t.ui.detail.whyUnstableSignals
                                : score >= 80
                                ? t.ui.detail.whyTopTier
                                : score >= 60
                                ? t.ui.detail.whyGoodValueFit
                                : t.ui.detail.whyLowPriority;
                              return (
                                <p className="text-[10px] text-[#555] mt-1 leading-tight truncate max-w-[120px]">
                                  {whyLabel}
                                </p>
                              );
                            })()}
                          </td>

                          <td className="py-2 px-3 hidden sm:table-cell">
                            {lead.fit ? (
                              <>
                                <div className={
                                  "text-xs font-semibold mb-1 " +
                                  ((lead.fit.fitScore ?? 0) >= 65 ? "text-[#4ade80]" :
                                   (lead.fit.fitScore ?? 0) >= 40 ? "text-[#c9a84c]" : "text-[#f87171]")
                                }>
                                  {lead.fit.fitScore ?? 0}
                                </div>
                                <div className="w-full bg-[#1a1a1a] rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className="h-1.5 rounded-full"
                                    style={{
                                      width: `${lead.fit.fitScore ?? 0}%`,
                                      backgroundColor:
                                        (lead.fit.fitScore ?? 0) >= 65 ? "#4ade80" :
                                        (lead.fit.fitScore ?? 0) >= 40 ? "#c9a84c" : "#f87171",
                                    }}
                                  />
                                </div>
                                {lead.fit.geoMatch && lead.fit.geoMatch !== "unset" && (
                                  <div className="mt-1">
                                    <span className={
                                      "text-[9px] px-1.5 py-0.5 rounded border " +
                                      (lead.fit.geoMatch === "exact"
                                        ? "border-[#4ade80]/30 text-[#4ade80] bg-[#4ade80]/5"
                                        : lead.fit.geoMatch === "partial"
                                        ? "border-[#c9a84c]/30 text-[#c9a84c] bg-[#c9a84c]/5"
                                        : "border-[#f87171]/20 text-[#f87171]/60 bg-transparent")
                                    }>
                                      📍{lead.fit.geoMatch === "exact" ? " match" : lead.fit.geoMatch === "partial" ? " near" : " far"}
                                    </span>
                                  </div>
                                )}
                              </>
                            ) : (
                              <span className="text-[#333] text-xs">—</span>
                            )}
                          </td>

                          <td className="py-2 px-3 hidden sm:table-cell">
                            <span className="text-[#c8c0b0] font-semibold">
                              {lead.score.opportunity ?? 0}
                            </span>
                            <p className="mt-1 text-[11px] leading-snug text-[#888]">
                              {t.ui.detail.upside}
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
                            <p className="mt-1 text-[11px] leading-snug text-[#888]">
                              {lead.score.riskProfile
                                ? lead.score.riskProfile.replaceAll("_", " ")
                                : "—"}
                            </p>
                          </td>

                          <td className="py-2 px-3 hidden md:table-cell">
                            <div className="text-[11px] leading-snug">
                              <div className="text-[#c9a84c] font-semibold flex items-center gap-2">
                                <span>⚡</span>
                                <span>
                                  {t.ui.table.opportunity}{" "}
                                  <span className="text-[#c8c0b0] font-semibold">
                                    {mainOpp}/100
                                  </span>{" "}
                                  <span className="text-[#888]">
                                    ({bandLabel(language, mainOpp)})
                                  </span>
                                </span>
                              </div>

                              {mainInsight?.message ? (
                                <div className="text-[#c8c0b0]">
                                  {mainInsight.message}
                                </div>
                              ) : (
                                <div className="text-[#f5f0e8]0 text-[11px]">
                                  —
                                </div>
                              )}
                            </div>
                          </td>

                          <td className="py-2 px-2 w-8">
                            {!isSelected && (
                              <button
                                type="button"
                                title={savedLeadIds.has(lead.id) ? "Remove from Contact Leads" : "Save to Contact Leads"}
                                onClick={(e: MouseEvent) => { e.stopPropagation(); toggleSaveLead(lead); }}
                                className="w-7 h-7 flex items-center justify-center rounded-lg border transition-all"
                                style={{
                                  borderColor: savedLeadIds.has(lead.id) ? "rgba(201,168,76,0.5)" : "#252525",
                                  background: savedLeadIds.has(lead.id) ? "rgba(201,168,76,0.1)" : "transparent",
                                  color: savedLeadIds.has(lead.id) ? "#c9a84c" : "#444",
                                }}
                              >
                                {savedLeadIds.has(lead.id) ? "◈" : "◇"}
                              </button>
                            )}
                          </td>

                        </tr>

                        {isSelected && detailLead && (
                          <tr key={`${lead.id}-detail`} id={`lead-detail-${lead.id}`}>
                            <td colSpan={6} className="p-0" style={{ maxWidth: "100%", width: "100%" }}>
                              <div className="border-b border-[#2a2a2a] bg-[#080808]/80 px-3 py-4 space-y-3 w-full overflow-x-hidden">
                                <div className="sm:hidden flex justify-between items-center mb-1"><span className="text-[12px] font-medium text-[#c8c0b0]">{detailLead.company.name}</span><button type="button" onClick={(e: MouseEvent) => { e.stopPropagation(); setSelectedLead(null); }} className="text-[11px] text-[#555] hover:text-[#888] px-2 py-1">✕ Close</button></div>
                                <div className="flex gap-1 border-b border-[#252525] pb-0 overflow-x-auto scrollbar-none">
                                  {tabs.map((tab) => (
                                    <button
                                      key={tab.key}
                                      type="button"
                                      onClick={(e: MouseEvent) => {
                                        e.stopPropagation();
                                        setDetailTab(tab.key);
                                      }}
                                      className={
                                        "text-[11px] px-3 py-1.5 rounded-t-md font-medium transition-colors " +
                                        (detailTab === tab.key
                                          ? "bg-[#1a1a1a] text-[#c9a84c] border border-b-0 border-[rgba(201,168,76,0.3)]"
                                          : "text-[#666] hover:text-[#888]")
                                      }
                                    >
                                      {tab.label}
                                    </button>
                                  ))}

                                  <div className="ml-auto flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={(e: MouseEvent) => {
                                        e.stopPropagation();
                                        toggleSaveLead(detailLead);
                                      }}
                                      className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-md border transition-all"
                                      style={{
                                        borderColor: savedLeadIds.has(detailLead.id) ? "rgba(201,168,76,0.4)" : "#2a2a2a",
                                        background: savedLeadIds.has(detailLead.id) ? "rgba(201,168,76,0.08)" : "rgba(17,17,17,0.7)",
                                        color: savedLeadIds.has(detailLead.id) ? "#c9a84c" : "#666",
                                      }}
                                    >
                                      <span>{savedLeadIds.has(detailLead.id) ? "◈" : "◇"}</span>
                                      <span>{savedLeadIds.has(detailLead.id) ? "Saved" : "Save lead"}</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e: MouseEvent) => {
                                        e.stopPropagation();
                                        setSelectedLead(null);
                                      }}
                                      className="text-[11px] px-2 py-1 rounded-md border border-[#2a2a2a] bg-[#111111]/70 hover:bg-[#1a1a1a]"
                                    >
                                      {t.ui.detail.clear}
                                    </button>
                                  </div>
                                </div>

                                {detailTab === "overview" && (() => {
                                  const opp = detailLead.score.opportunity ?? 0;
                                  const readiness = detailLead.score.readiness ?? 0;
                                  const risk = detailLead.score.risk ?? 0;
                                  const value = detailLead.score.value ?? 0;
                                  const fit = detailLead.fit?.fitScore ?? null;
                                  const rp = detailLead.score.riskProfile ?? "unknown";
                                  const hasRisk = rp === "unstable_business" || rp === "mature_competitor";

                                  // Score ring colour
                                  const scoreColor = value >= 70 ? "#4ade80" : value >= 45 ? "#c9a84c" : "#f87171";
                                  const scoreLabel = value >= 70 ? "Strong Lead" : value >= 45 ? "Moderate Lead" : "Weak Lead";

                                  // Gap type from outreach metadata
                                  const gap = (detailLead.metadata?.outreach as { gap?: string } | null)?.gap ?? null;
                                  const gapLabels: Record<string, { label: string; desc: string; color: string }> = {
                                    VISIBILITY:    { label: "Visibility Gap",    desc: "Demand exists but this business isn't capturing it — weak channels or low presence.", color: "#818cf8" },
                                    CONVERSION:    { label: "Conversion Gap",    desc: "Traffic or interest exists but leaks before becoming bookings or enquiries.",           color: "#fb923c" },
                                    INFRASTRUCTURE:{ label: "Infrastructure Gap",desc: "No digital foundation — interest has nowhere to land and convert.",                    color: "#f87171" },
                                    OPTIMIZATION:  { label: "Optimization Gap",  desc: "Strong fundamentals — opportunity is in sharpening what already works.",               color: "#34d399" },
                                  };
                                  const gapInfo = gap ? gapLabels[gap] ?? null : null;

                                  function ScoreBar({ value: v, color }: { value: number; color: string }) {
                                    return (
                                      <div className="h-1.5 w-full rounded-full bg-[#1a1a1a] overflow-hidden">
                                        <div
                                          className="h-full rounded-full transition-all duration-700"
                                          style={{ width: `${v}%`, backgroundColor: color }}
                                        />
                                      </div>
                                    );
                                  }

                                  return (
                                    <div className="space-y-3 pt-1">

                                      {/* Rescoring transition */}
                                      {isRescoring && (
                                        <div className="rounded-xl border border-[#252525] bg-[#0d0d0d] p-6 flex flex-col items-center gap-3 text-center">
                                          <div className="w-5 h-5 rounded-full border-2 border-[#c9a84c] border-t-transparent animate-spin" />
                                          <div>
                                            <p className="text-[12px] text-[#888]">Analyzing signals…</p>
                                            <p className="text-[10px] text-[#444] mt-0.5">Scoring this lead for your profile</p>
                                          </div>
                                        </div>
                                      )}

                                      {/* Score content — hidden while rescoring */}
                                      <div className={isRescoring ? "opacity-0 pointer-events-none" : "space-y-3 transition-opacity duration-500"}>

                                      {/* Hero score row — click to open explanation modal */}
                                      <button type="button" onClick={() => setShowScoreModal(detailLead.id)}
                                        className="rounded-xl border border-[#252525] bg-[#0d0d0d] p-3 w-full text-left hover:border-[rgba(201,168,76,0.3)] transition-colors group">
                                        <div className="flex items-center gap-3 mb-2">
                                          <div className="relative flex-shrink-0 w-12 h-12">
                                            <svg viewBox="0 0 56 56" className="w-full h-full -rotate-90">
                                              <circle cx="28" cy="28" r="24" fill="none" stroke="#1a1a1a" strokeWidth="5" />
                                              <circle cx="28" cy="28" r="24" fill="none" stroke={scoreColor} strokeWidth="5"
                                                strokeDasharray={`${(value / 100) * 150.8} 150.8`} strokeLinecap="round" />
                                            </svg>
                                            <div className="absolute inset-0 flex items-center justify-center">
                                              <span className="text-[13px] font-bold" style={{ color: scoreColor }}>{value}</span>
                                            </div>
                                          </div>
                                          <div className="min-w-0">
                                            <p className="text-[10px] uppercase tracking-widest text-[#555]">Score</p>
                                            <p className="font-semibold text-sm" style={{ color: scoreColor }}>{scoreLabel}</p>
                                          </div>
                                        </div>
                                        <p className="text-[11px] text-[#666] leading-relaxed">
                                          {getScoreReason(detailLead, language)}
                                        </p>
                                        <p className="text-[10px] text-[#333] mt-1.5 group-hover:text-[#555] transition-colors">Tap for full breakdown →</p>
                                        {detailWebsiteUrl && (
                                          <a href={detailWebsiteUrl} target="_blank" rel="noreferrer"
                                            onClick={e => e.stopPropagation()}
                                            className="inline-block mt-1.5 text-[11px] text-[#c9a84c] hover:underline">
                                            Visit site ↗
                                          </a>
                                        )}
                                      </button>

                                      {/* 2×2 compact score circles */}
                                      <div className="grid grid-cols-2 gap-2">
                                        {([
                                          { short: "OPP",   label: "Opportunity", value: opp,        color: opp >= 60 ? "#4ade80" : opp >= 35 ? "#c9a84c" : "#f87171" },
                                          { short: "READY", label: "Readiness",   value: readiness,  color: readiness >= 60 ? "#4ade80" : readiness >= 35 ? "#c9a84c" : "#f87171" },
                                          { short: "RISK",  label: "Risk",        value: risk,       color: risk >= 60 ? "#f87171" : risk >= 35 ? "#c9a84c" : "#4ade80" },
                                          { short: "FIT",   label: "Fit",         value: fit ?? 0,   color: (fit ?? 0) >= 65 ? "#4ade80" : (fit ?? 0) >= 40 ? "#c9a84c" : "#f87171" },
                                        ] as { short: string; label: string; value: number; color: string }[]).map(({ short, label, value: v, color }) => (
                                          <div key={short} className="rounded-xl border border-[#1e1e1e] bg-[#0d0d0d] p-3 flex items-center gap-3">
                                            <div className="relative flex-shrink-0 w-11 h-11">
                                              <svg viewBox="0 0 44 44" className="w-full h-full -rotate-90">
                                                <circle cx="22" cy="22" r="18" fill="none" stroke="#1a1a1a" strokeWidth="3.5" />
                                                <circle cx="22" cy="22" r="18" fill="none" stroke={color} strokeWidth="3.5"
                                                  strokeDasharray={`${(v / 100) * 113.1} 113.1`} strokeLinecap="round" />
                                              </svg>
                                              <div className="absolute inset-0 flex items-center justify-center">
                                                <span className="text-[11px] font-bold tabular-nums" style={{ color }}>{v}</span>
                                              </div>
                                            </div>
                                            <div className="min-w-0">
                                              <p className="text-[9px] uppercase tracking-widest text-[#444]">{short}</p>
                                              <p className="text-[12px] text-[#888]">{label}</p>
                                            </div>
                                          </div>
                                        ))}
                                      </div>

                                      {/* Gap + insight */}
                                      {(gapInfo || detailInsight?.message) && (
                                        <div className="space-y-2">
                                          {gapInfo && (
                                            <div className="rounded-xl border p-3" style={{ borderColor: `${gapInfo.color}30`, backgroundColor: `${gapInfo.color}06` }}>
                                              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: gapInfo.color }}>◆ {gapInfo.label}</span>
                                              <p className="text-[11px] text-[#666] mt-1 leading-snug break-words">{gapInfo.desc}</p>
                                            </div>
                                          )}
                                          {detailInsight?.message && (
                                            <div className="rounded-xl border border-[rgba(201,168,76,0.2)] bg-[rgba(201,168,76,0.04)] p-3">
                                              <p className="text-[13px] font-semibold text-[#e8c97a] break-words">⚡ {detailInsight.message}</p>
                                            </div>
                                          )}
                                        </div>
                                      )}

                                      {/* Fit needs */}
                                      {fit !== null && ((detailLead.fit?.matchedNeeds ?? []).length > 0 || (detailLead.fit?.missingNeeds ?? []).length > 0) && (
                                        <div className="rounded-xl border border-[#1e1e1e] bg-[#0d0d0d] p-3 space-y-2">
                                          {(detailLead.fit?.matchedNeeds ?? []).length > 0 && (
                                            <div>
                                              <p className="text-[9px] uppercase tracking-widest text-[#4ade80]/70 mb-1">✓ Can deliver</p>
                                              <div className="flex flex-wrap gap-1">
                                                {(detailLead.fit?.matchedNeeds ?? []).map((n: string) => (
                                                  <span key={n} className="text-[10px] px-1.5 py-0.5 rounded bg-[#4ade80]/10 border border-[#4ade80]/20 text-[#4ade80]">{n}</span>
                                                ))}
                                              </div>
                                            </div>
                                          )}
                                          {(detailLead.fit?.missingNeeds ?? []).length > 0 && (
                                            <div>
                                              <p className="text-[9px] uppercase tracking-widest text-[#f87171]/70 mb-1">✗ Can&apos;t cover</p>
                                              <div className="flex flex-wrap gap-1">
                                                {(detailLead.fit?.missingNeeds ?? []).map((n: string) => (
                                                  <span key={n} className="text-[10px] px-1.5 py-0.5 rounded bg-[#f87171]/10 border border-[#f87171]/20 text-[#f87171]">{n}</span>
                                                ))}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      )}

                                      {/* Risk flag */}
                                      {hasRisk && (
                                        <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3">
                                          <p className="text-[13px] font-semibold text-rose-300">{riskTitleFromProfile(detailLead.score.riskProfile, t)}</p>
                                          <p className="mt-0.5 text-[11px] text-rose-400/60 leading-relaxed break-words">{riskMessage(language, detailLead)}</p>
                                        </div>
                                      )}

                                      {/* No website */}
                                      {!detailWebsiteUrl && (
                                        <div className="rounded-lg border border-[#252525] bg-[#0d0d0d] px-3 py-2 flex items-center gap-2">
                                          <span className="text-[#f87171] text-xs">✗</span>
                                          <p className="text-[11px] text-[#555]">{t.ui.detail.noWebsite}</p>
                                        </div>
                                      )}
                                      </div>{/* end score content wrapper */}
                                    </div>
                                  );
                                })()}

                                {detailTab === "signals" && (() => {
                                  const bd = detailLead.score.breakdown;

                                  type CatDef = { key: keyof typeof bd; label: string; hint: string; invert?: boolean };
                                  const categories: CatDef[] = [
                                    { key: "reputation",         label: "Reputation",        hint: "Reviews & rating quality." },
                                    { key: "digitalPresence",    label: "Digital Pres.",      hint: "Website & social visibility." },
                                    { key: "businessStrength",   label: "Biz Strength",       hint: "Maturity & ability to pay." },
                                    { key: "opportunityGap",     label: "Opp. Gap",           hint: "Growth headroom available." },
                                    { key: "stabilityRisk",      label: "Stability Risk",     hint: "Higher = riskier.", invert: true },
                                    { key: "evidenceConfidence", label: "Evidence Conf.",     hint: "Signal data quality." },
                                  ];

                                  function barColor(v: number, invert = false) {
                                    const high = invert ? "#f87171" : "#4ade80";
                                    const mid  = "#c9a84c";
                                    const low  = invert ? "#4ade80" : "#f87171";
                                    return v >= 65 ? high : v >= 35 ? mid : low;
                                  }

                                  return (
                                    <div className="space-y-3 pt-1">

                                      {/* Category score bars */}
                                      {bd && (
                                        <div className="rounded-xl border border-[#252525] bg-[#0d0d0d] p-4 space-y-3">
                                          <p className="text-[10px] uppercase tracking-widest text-[#555]">Breakdown</p>
                                          {categories.map(({ key, label, hint, invert }) => {
                                            const v = bd[key] ?? 0;
                                            const color = barColor(v, invert);
                                            return (
                                              <div key={key} className="space-y-1">
                                                <div className="flex items-center justify-between">
                                                  <p className="text-[11px] text-[#888]">{label}</p>
                                                  <p className="text-[12px] font-bold tabular-nums" style={{ color }}>{v}</p>
                                                </div>
                                                <div className="h-1.5 w-full rounded-full bg-[#1a1a1a] overflow-hidden">
                                                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${v}%`, backgroundColor: color }} />
                                                </div>
                                                <p className="text-[10px] text-[#444] leading-snug hidden sm:block">{hint}</p>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}

                                      {/* Score reasons */}
                                      {detailLead.score.reasons?.length > 0 && (
                                        <div className="rounded-xl border border-[#252525] bg-[#0d0d0d] p-3 space-y-2">
                                          <div className="flex items-center gap-2">
                                            <p className="text-[9px] uppercase tracking-widest text-[#555]">Score evidence</p>
                                            <div className="flex-1 h-[1px] bg-[#1a1a1a]" />
                                          </div>
                                          <div className="space-y-1.5">
                                            {detailLead.score.reasons.map((reason: string, i: number) => {
                                              const isPositive = /strong|high|good|great|excellent|active|present|above/i.test(reason);
                                              const isNegative = /no |missing|low|weak|below|lacks|absent|poor/i.test(reason);
                                              return (
                                                <div key={i} className="flex items-start gap-2.5">
                                                  <span className={`text-[10px] mt-0.5 flex-shrink-0 ${isPositive ? "text-[#4ade80]" : isNegative ? "text-[#f87171]" : "text-[#555]"}`}>
                                                    {isPositive ? "✓" : isNegative ? "✗" : "·"}
                                                  </span>
                                                  <p className="text-[11px] text-[#888] leading-snug">{reason}</p>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      )}

                                      {/* Website enrichment */}
                                      {enrichmentLoading && (
                                        <div className="rounded-lg border border-[#252525] bg-[#0d0d0d] p-4 flex items-center gap-3">
                                          <div className="w-3.5 h-3.5 rounded-full border-2 border-[#c9a84c] border-t-transparent animate-spin shrink-0" />
                                          <span className="text-[12px] text-[#555]">Scanning website signals…</span>
                                        </div>
                                      )}
                                      {!safeEnrichment && !enrichmentLoading && detailLead.company.website && (
                                        <div className="rounded-lg border border-[#252525] bg-[#0d0d0d] p-4 space-y-1">
                                          <p className="text-[10px] uppercase tracking-widest text-[#555]">Web Signals</p>
                                          <p className="text-[12px] text-[#444]">Scan failed — unreachable or blocked.</p>
                                          <p className="text-[11px] text-[#333]">{detailLead.company.website}</p>
                                        </div>
                                      )}
                                      {!safeEnrichment && !enrichmentLoading && !detailLead.company.website && (
                                        <div className="rounded-lg border border-[#252525] bg-[#0d0d0d] p-4">
                                          <p className="text-[10px] uppercase tracking-widest text-[#555] mb-1">Web Signals</p>
                                          <p className="text-[12px] text-[#444]">No website — signals unavailable.</p>
                                        </div>
                                      )}

                                      {safeEnrichment && !enrichmentLoading && (
                                        <div className="rounded-xl border border-[#252525] bg-[#0d0d0d] p-4 space-y-3">
                                          <div className="flex items-center justify-between">
                                            <p className="text-[10px] uppercase tracking-widest text-[#555]">Web Signals</p>
                                            <button type="button"
                                              onClick={() => detailLead && runDeepScan(detailLead)}
                                              disabled={enrichmentLoading}
                                              className="text-[10px] px-2 py-1 rounded border border-[#252525] text-[#555] hover:border-[#444] hover:text-[#888] disabled:opacity-40 transition-colors">
                                              ↻ Re-scan
                                            </button>
                                          </div>
                                          <div className="grid grid-cols-2 gap-2">
                                            {[
                                              { key: "website_reachable",         label: "Reachable",        value: isReachable },
                                              { key: "website_has_contact_page",  label: "Contact pg",       value: enrichmentSignals["website_has_contact_page"]?.value },
                                              { key: "website_has_booking_cta",   label: "Booking CTA",      value: enrichmentSignals["website_has_booking_cta"]?.value },
                                              { key: "website_has_clear_offer",   label: "Clear offer",      value: enrichmentSignals["website_has_clear_offer"]?.value },
                                              { key: "website_mobile_friendly",   label: "Mobile ok",        value: enrichmentSignals["website_mobile_friendly"]?.value },
                                            ].map(({ key, label, value: v }) => (
                                              <div key={key} className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${v ? "border-[#4ade80]/20 bg-[#4ade80]/5" : "border-[#f87171]/15 bg-[#f87171]/5"}`}>
                                                <span className={`text-xs ${v ? "text-[#4ade80]" : "text-[#f87171]"}`}>{v ? "✓" : "✗"}</span>
                                                <span className="text-[11px] text-[#888]">{label}</span>
                                              </div>
                                            ))}
                                          </div>
                                          {detectedPlatforms.length > 0 && (
                                            <div>
                                              <p className="text-[10px] uppercase tracking-widest text-[#555] mb-1.5">Social</p>
                                              <div className="flex flex-wrap gap-1.5">
                                                {detectedPlatforms.map((p: string) => (
                                                  <span key={p} className="text-[11px] px-2 py-0.5 rounded-md border border-[#252525] text-[#c8c0b0]">{p}</span>
                                                ))}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                      
                                    </div>
                                  );
                                })()}

                                {detailTab === "signals" && deepScanData && (
                                  <div className="space-y-3">
                                    {/* Deep Score */}
                                    <div className="rounded-xl border border-[rgba(201,168,76,0.25)] bg-[rgba(201,168,76,0.04)] p-4">
                                      <div className="flex items-center justify-between mb-3">
                                        <div className="space-y-1">
                                          <p className="text-[10px] uppercase tracking-widest text-[#8a6e30]">Deep Scan</p>
                                          {deepScanData.scannedAt && (
                                            <div className="flex items-center gap-1.5">
                                              {deepScanData.isFromCache && (
                                                <span className="text-[9px] px-1.5 py-0.5 rounded border border-[#c9a84c]/20 bg-[#c9a84c]/08 text-[#8a6e30]">cached</span>
                                              )}
                                              <p className="text-[10px] text-[#444]">
                                                Scanned {(() => {
                                                  const diff = Date.now() - new Date(deepScanData.scannedAt).getTime();
                                                  const mins = Math.floor(diff / 60000);
                                                  const hours = Math.floor(diff / 3600000);
                                                  const days = Math.floor(diff / 86400000);
                                                  return days > 0 ? `${days}d ago` : hours > 0 ? `${hours}h ago` : mins > 0 ? `${mins}m ago` : "just now";
                                                })()}
                                              </p>
                                            </div>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-3">
                                          <span className="text-2xl font-bold text-[#c9a84c]">{deepScanData.deepScore}</span>
                                          {deepScanData.isFromCache && (
                                            <button
                                              type="button"
                                              onClick={() => detailLead && runDeepScan(detailLead)}
                                              className="text-[10px] px-2 py-1 rounded border border-[#252525] text-[#555] hover:border-[#444] hover:text-[#888] transition-colors"
                                            >↻ Rescan</button>
                                          )}
                                        </div>
                                      </div>
                                      {!deepScanData.pageReachable && (
                                        <p className="text-[11px] text-[#555]">Unreachable — partial scores only.</p>
                                      )}
                                    </div>

                                    {/* Website scores */}
                                    <div className="rounded-xl border border-[#252525] bg-[#0d0d0d] p-4 space-y-3">
                                      <div className="flex items-center justify-between">
                                        <p className="text-[10px] uppercase tracking-widest text-[#555]">Website</p>
                                        {deepScanData.website.summary && (
                                          <p className="text-[10px] text-[#444] max-w-[60%] text-right truncate">{deepScanData.website.summary}</p>
                                        )}
                                      </div>
                                      {Object.entries(deepScanData.website.scores).map(([key, val]) => {
                                        const label = key.replace(/([A-Z])/g, " $1").replace(/^./, (s: string) => s.toUpperCase());
                                        const score = val as number;
                                        const color = score >= 65 ? "#4ade80" : score >= 35 ? "#c9a84c" : "#f87171";
                                        return (
                                          <div key={key} className="space-y-1">
                                            <div className="flex items-center justify-between">
                                              <p className="text-[11px] text-[#888]">{label}</p>
                                              <p className="text-[12px] font-bold tabular-nums" style={{ color }}>{val}</p>
                                            </div>
                                            <div className="h-1.5 w-full rounded-full bg-[#1a1a1a]">
                                              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${val}%`, backgroundColor: color }} />
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>

                                    {/* Market signals */}
                                    <div className="rounded-xl border border-[#252525] bg-[#0d0d0d] p-4 space-y-3">
                                      <p className="text-[10px] uppercase tracking-widest text-[#555]">Market</p>
                                      {Object.entries(deepScanData.market.scores).map(([key, val]) => {
                                        const label = key.replace(/([A-Z])/g, " $1").replace(/^./, (s: string) => s.toUpperCase());
                                        const score = val as number;
                                        const color = score >= 65 ? "#4ade80" : score >= 35 ? "#c9a84c" : "#f87171";
                                        return (
                                          <div key={key} className="space-y-1">
                                            <div className="flex items-center justify-between">
                                              <p className="text-[11px] text-[#888]">{label}</p>
                                              <p className="text-[12px] font-bold tabular-nums" style={{ color }}>{val}</p>
                                            </div>
                                            <div className="h-1.5 w-full rounded-full bg-[#1a1a1a]">
                                              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${val}%`, backgroundColor: color }} />
                                            </div>
                                          </div>
                                        );
                                      })}
                                      {deepScanData.market.recommendation && (
                                        <p className="text-[11px] text-[#666] border-t border-[#1a1a1a] pt-2">{deepScanData.market.recommendation}</p>
                                      )}
                                    </div>

                                    {/* Brand grade */}
                                    <div className="rounded-xl border border-[#252525] bg-[#0d0d0d] p-4 space-y-3">
                                      <div className="flex items-center justify-between">
                                        <p className="text-[10px] uppercase tracking-widest text-[#555]">Brand</p>
                                        <span className="text-[13px] font-bold text-[#c9a84c]">Grade: {deepScanData.brand.brandGrade}</span>
                                      </div>
                                      {Object.entries(deepScanData.brand.scores).map(([key, val]) => {
                                        const label = key.replace(/([A-Z])/g, " $1").replace(/^./, (s: string) => s.toUpperCase());
                                        const score = val as number;
                                        const color = score >= 65 ? "#4ade80" : score >= 35 ? "#c9a84c" : "#f87171";
                                        return (
                                          <div key={key} className="space-y-1">
                                            <div className="flex items-center justify-between">
                                              <p className="text-[11px] text-[#888]">{label}</p>
                                              <p className="text-[12px] font-bold tabular-nums" style={{ color }}>{val}</p>
                                            </div>
                                            <div className="h-1.5 w-full rounded-full bg-[#1a1a1a]">
                                              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${val}%`, backgroundColor: color }} />
                                            </div>
                                          </div>
                                        );
                                      })}
                                      <div className="grid grid-cols-2 gap-2 border-t border-[#1a1a1a] pt-2">
                                        <div className="rounded-lg border border-[#4ade80]/15 bg-[#4ade80]/5 px-2 py-1.5">
                                          <p className="text-[9px] uppercase tracking-widest text-[#4ade80]/60 mb-0.5">Strength</p>
                                          <p className="text-[11px] text-[#888]">{deepScanData.brand.strengthArea}</p>
                                        </div>
                                        <div className="rounded-lg border border-[#f87171]/15 bg-[#f87171]/5 px-2 py-1.5">
                                          <p className="text-[9px] uppercase tracking-widest text-[#f87171]/60 mb-0.5">Weakest</p>
                                          <p className="text-[11px] text-[#888]">{deepScanData.brand.weakestArea}</p>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {detailTab === "signals" && !deepScanData && !deepScanLoading && (
                                  <div className="rounded-xl border border-[#252525] bg-[#0d0d0d] p-4 flex items-center justify-between">
                                    <div>
                                      <p className="text-[12px] text-[#888] font-medium">Deep Scan</p>
                                      <p className="text-[11px] text-[#444] mt-0.5 hidden sm:block">Website · market · brand</p>
                                    </div>
                                    {deepScanUnlocked ? (
                                      <button
                                        type="button"
                                        onClick={() => detailLead && runDeepScan(detailLead)}
                                        className="text-[11px] px-3 py-1.5 rounded-lg border border-[rgba(201,168,76,0.3)] bg-[rgba(201,168,76,0.06)] text-[#c9a84c] hover:bg-[rgba(201,168,76,0.12)] transition-colors"
                                      >
                                        ◉ Run Scan
                                      </button>
                                    ) : (
                                      <div className="relative group">
                                        <button
                                          type="button"
                                          disabled
                                          className="text-[11px] px-3 py-1.5 rounded-lg border border-[#2a2a2a] bg-[#111] text-[#444] cursor-not-allowed flex items-center gap-1.5"
                                        >
                                          <span>🔒</span>
                                          <span>Deep Scan</span>
                                        </button>
                                        <div className="absolute bottom-full right-0 mb-2 w-56 rounded-xl border border-[#2a2a2a] bg-[#111] p-3 text-[11px] text-[#666] leading-relaxed opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 z-50 shadow-xl">
                                          <p className="text-[#c9a84c] font-medium mb-1">Operator & Agency feature</p>
                                          <p>Deep Scan fetches the lead&apos;s website and analyses SEO structure, CTA strength, brand consistency, and market positioning — giving you a composite intelligence score before you reach out.</p>
                                          <p className="mt-1 text-[#555]">Upgrade to unlock.</p>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {detailTab === "signals" && deepScanLoading && (
                                  <div className="rounded-xl border border-[#252525] bg-[#0d0d0d] p-4 flex items-center gap-3">
                                    <div className="w-3.5 h-3.5 rounded-full border-2 border-[#c9a84c] border-t-transparent animate-spin shrink-0" />
                                    <span className="text-[12px] text-[#555]">Running deep scan — fetching website, market & brand signals…</span>
                                  </div>
                                )}

                                {detailTab === "outreach" && (() => {
                                  const gap = (safeOutreach as { gap?: string } | null)?.gap ?? null;
                                  const difficulty = (safeOutreach as { difficulty?: string } | null)?.difficulty ?? null;
                                  const structured = getStructuredAngle(detailLead, language);
                                  const title = angleTitle || structured.title;
                                  const why = angleWhy || structured.why;

                                  const gapConfig: Record<string, { label: string; color: string; icon: string; intervention: string }> = {
                                    VISIBILITY:     { label: "Visibility Gap",     color: "#818cf8", icon: "◎", intervention: "Build high-intent capture channels — search, retargeting, demand-side content." },
                                    CONVERSION:     { label: "Conversion Gap",     color: "#fb923c", icon: "⬡", intervention: "Fix the funnel — booking flow, tracking, and follow-up sequence." },
                                    INFRASTRUCTURE: { label: "Infrastructure Gap", color: "#f87171", icon: "△", intervention: "Build the foundation — a conversion-focused page with clear offer and CTA." },
                                    OPTIMIZATION:   { label: "Optimization Gap",   color: "#34d399", icon: "◆", intervention: "Sharpen what works — A/B test, optimise copy, tighten conversion paths." },
                                  };
                                  const gc = gap ? gapConfig[gap] ?? null : null;

                                  const tones = [
                                    { key: "soft",         label: "Soft",         desc: "Friendly, low-pressure. Best for cold or high-risk leads." },
                                    { key: "consultative", label: "Consultative", desc: "Advisory tone. Lead with insight, not pitch." },
                                    { key: "direct",       label: "Direct",       desc: "Assertive and confident. Best for warm or low-friction leads." },
                                    { key: "bold",         label: "Bold",         desc: "Pattern-interrupt. Stands out but requires strong positioning." },
                                  ];

                                  const difficultyConfig: Record<string, { label: string; color: string; desc: string }> = {
                                    LOW:    { label: "Low friction",    color: "#4ade80", desc: "Easy to engage — direct or bold tone recommended." },
                                    MEDIUM: { label: "Medium friction", color: "#c9a84c", desc: "Approach carefully — consultative tone works well." },
                                    HIGH:   { label: "High friction",   color: "#f87171", desc: "Hard to reach — soft or consultative tone only." },
                                  };
                                  const dc = difficulty ? difficultyConfig[difficulty] ?? null : null;
                                  const channelPrimary = !detailLead.company.website ? "Direct visit or phone" : "Email";

                                  return (
                                    <div className="space-y-3 pt-1">

                                      {/* Angle */}
                                      {title && (
                                        <div className="rounded-xl border border-[#252525] bg-[#0d0d0d] p-4">
                                          <p className="text-[9px] uppercase tracking-widest text-[#555] mb-1.5">Angle</p>
                                          <p className="text-[13px] font-semibold text-[#e8c97a] mb-1">{title}</p>
                                          {why && <p className="text-[11px] text-[#666] leading-relaxed">{why}</p>}
                                        </div>
                                      )}

                                      {/* Gap */}
                                      {gc && (
                                        <div className="rounded-xl border p-4" style={{ borderColor: `${gc.color}30`, backgroundColor: `${gc.color}06` }}>
                                          <div className="flex items-center gap-2 mb-1.5">
                                            <span style={{ color: gc.color }}>{gc.icon}</span>
                                            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: gc.color }}>{gc.label}</p>
                                          </div>
                                          <p className="text-[11px] text-[#888] leading-relaxed">{gc.intervention}</p>
                                        </div>
                                      )}

                                      {/* Friction + channel */}
                                      <div className="grid grid-cols-2 gap-2">
                                        {dc && (
                                          <div className="rounded-xl border border-[#1e1e1e] bg-[#0d0d0d] p-3">
                                            <p className="text-[9px] uppercase tracking-widest text-[#444] mb-1">Friction</p>
                                            <p className="text-[11px] font-semibold" style={{ color: dc.color }}>{dc.label}</p>
                                            <p className="text-[10px] text-[#555] mt-1 leading-snug">{dc.desc}</p>
                                          </div>
                                        )}
                                        <div className="rounded-xl border border-[#1e1e1e] bg-[#0d0d0d] p-3">
                                          <p className="text-[9px] uppercase tracking-widest text-[#444] mb-1">Channel</p>
                                          <p className="text-[11px] font-semibold text-[#c9a84c]">{channelPrimary}</p>
                                          <p className="text-[10px] text-[#555] mt-1 leading-snug">Best first point of contact</p>
                                        </div>
                                      </div>

                                      {/* Tone guide */}
                                      <div className="rounded-xl border border-[#1e1e1e] bg-[#0d0d0d] p-4">
                                        <p className="text-[9px] uppercase tracking-widest text-[#444] mb-2.5">Tone guide</p>
                                        <div className="space-y-2">
                                          {tones.map((tone) => {
                                            const isRecommended = dc
                                              ? (difficulty === "HIGH" && (tone.key === "soft" || tone.key === "consultative"))
                                                || (difficulty === "MEDIUM" && tone.key === "consultative")
                                                || (difficulty === "LOW" && (tone.key === "direct" || tone.key === "bold"))
                                              : false;
                                            return (
                                              <div key={tone.key} className={"flex items-start gap-2.5 rounded-lg p-2 " + (isRecommended ? "bg-[rgba(201,168,76,0.06)] border border-[rgba(201,168,76,0.15)]" : "")}>
                                                <span className={"text-[10px] mt-0.5 " + (isRecommended ? "text-[#c9a84c]" : "text-[#333]")}>{isRecommended ? "★" : "○"}</span>
                                                <div>
                                                  <p className={"text-[11px] font-semibold " + (isRecommended ? "text-[#c9a84c]" : "text-[#666]")}>{tone.label}</p>
                                                  <p className="text-[10px] text-[#444] leading-snug">{tone.desc}</p>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>

                                      {/* Open in Outreach CTA */}
                                      <button type="button"
                                        onClick={() => {
                                          // Store full lead snapshot in sessionStorage for outreach page
                                          const snapshot = {
                                            id: detailLead.id,
                                            company_name: detailLead.company.name,
                                            industry: detailLead.classification.primaryIndustry ?? null,
                                            city: detailLead.company.city ?? null,
                                            website: detailLead.company.website ?? null,
                                            rating: detailLead.metrics.rating ?? null,
                                            review_count: detailLead.metrics.reviewCount ?? null,
                                            social_presence: detailLead.metrics.socialPresence ?? null,
                                            opportunity: detailLead.score.opportunity,
                                            readiness: detailLead.score.readiness,
                                            risk: detailLead.score.risk,
                                            signals: enrichmentData?.signals ?? {},
                                            matched_needs: detailLead.fit?.matchedNeeds ?? [],
                                            missing_needs: detailLead.fit?.missingNeeds ?? [],
                                            fit_score: detailLead.fit?.fitScore ?? 0,
                                          };
                                          localStorage.setItem("vantio_outreach_lead", JSON.stringify(snapshot));
                                          window.location.href = "/outreach";
                                        }}
                                        className="flex items-center justify-between w-full px-4 py-3 rounded-xl border border-[rgba(201,168,76,0.25)] bg-[rgba(201,168,76,0.04)] hover:bg-[rgba(201,168,76,0.08)] transition-all group">
                                        <div>
                                          <p className="text-[12px] font-semibold text-[#c9a84c]">Generate outreach message</p>
                                          <p className="text-[10px] text-[#555] mt-0.5">Signal-driven · 3-stage pipeline · Operator+</p>
                                        </div>
                                        <span className="text-[#8a6e30] group-hover:text-[#c9a84c] transition-colors text-sm">→</span>
                                      </button>

                                    </div>
                                  );
                                })()}

                                {detailTab === "tracking" && (() => {
                                  const canSave = Number.isFinite(runIdNum) && runIdNum > 0;

                                  // Pipeline stage — furthest reached
                                  const stage = closed ? 3 : bookedCall ? 2 : replied ? 1 : contacted ? 0 : -1;
                                  const stages = [
                                    { key: "contacted",  label: "Contacted",  icon: "✉" },
                                    { key: "replied",    label: "Replied",    icon: "↩" },
                                    { key: "booked_call",label: "Booked",     icon: "📅" },
                                    { key: "closed",     label: "Closed",     icon: "✦" },
                                  ] as const;

                                  const lostReason  = selectedOutcome?.lost_reason ?? null;
                                  const isLost = !!lostReason;

                                  const revenueVal  = selectedOutcome?.revenue ?? null;
                                  const notesVal    = selectedOutcome?.notes ?? "";
                                  const followupVal = selectedOutcome?.followup_date ?? "";
                                  // Derive difficulty for auto follow-up calculation
                                  const safeOutreachForTracking = (detailLead?.metadata?.outreach ?? null) as { difficulty?: string } | null;
                                  const difficultyForTracking = safeOutreachForTracking?.difficulty ?? null;
                                  const tonalityVal = selectedOutcome?.tonality ?? null;
                                  const scoreSnap   = selectedOutcome?.score_at_outreach ?? detailLead.score.value ?? null;

                                  // Show lost reason picker when contacted but never progressed past contacted, or explicitly stalled
                                  const showLostReason = (contacted && !closed) || isLost;

                                  const lostReasons: { key: LeadOutcomeUI["lost_reason"]; label: string }[] = [
                                    { key: "no_response",      label: "No response" },
                                    { key: "not_interested",   label: "Not interested" },
                                    { key: "has_provider",     label: "Has provider" },
                                    { key: "wrong_timing",     label: "Wrong timing" },
                                    { key: "price_too_high",   label: "Price too high" },
                                    { key: "chose_competitor", label: "Chose competitor" },
                                    { key: "other",            label: "Other" },
                                  ];

                                  return (
                                    <div className="space-y-3 pt-1">

                                      {/* Score snapshot */}
                                      {scoreSnap !== null && (
                                        <div className="rounded-xl border border-[#1a1a1a] bg-[#0d0d0d] px-4 py-3 flex items-center justify-between">
                                          <p className="text-[10px] uppercase tracking-widest text-[#444]">Score at outreach</p>
                                          <span className={
                                            "text-sm font-medium " +
                                            (scoreSnap >= 70 ? "text-[#4ade80]" : scoreSnap >= 50 ? "text-[#c9a84c]" : "text-[#f87171]")
                                          }>{scoreSnap}</span>
                                        </div>
                                      )}

                                      {/* Pipeline funnel */}
                                      <div className="rounded-xl border border-[#252525] bg-[#0d0d0d] p-4">
                                        <div className="flex items-center justify-between mb-3">
                                          <p className="text-[10px] uppercase tracking-widest text-[#555]">{t.ui.detail.outcomeTracking}</p>
                                          {isSavingOutcome && <p className="text-[10px] text-[#555] animate-pulse">{t.ui.detail.saving}…</p>}
                                        </div>
                                        <div className="flex items-stretch gap-1">
                                          {stages.map(({ key, label, icon }, i) => {
                                            const checked = key === "contacted" ? contacted : key === "replied" ? replied : key === "booked_call" ? bookedCall : closed;
                                            const isActive = i <= stage;
                                            const isCurrent = i === stage;
                                            return (
                                              <button key={key} type="button"
                                                disabled={!canSave || isLost}
                                                onClick={() => {
                                                  if (!canSave || isLost) return;
                                                  const isFirstContact = key === "contacted" && !contacted;
                                                  saveOutcome({
                                                    runId: runIdNum,
                                                    leadId: detailLead.id,
                                                    patch: {
                                                      ...buildOutcomePatch(key, !checked),
                                                      ...(isFirstContact ? { score_at_outreach: detailLead.score.value ?? null } : {}),
                                                    },
                                                  });
                                                }}
                                                className={"flex-1 flex flex-col items-center gap-1.5 py-2.5 rounded-lg border transition-all " + (isLost ? "opacity-30 cursor-not-allowed border-[#1a1a1a] bg-[#0d0d0d]" : isCurrent ? "border-[#c9a84c] bg-[rgba(201,168,76,0.08)]" : isActive ? "border-[#4ade80]/30 bg-[#4ade80]/5" : "border-[#1a1a1a] bg-[#111] hover:border-[#252525]") + " disabled:cursor-not-allowed"}>
                                                <span className={"text-sm transition-colors " + (isLost ? "text-[#333]" : isCurrent ? "text-[#c9a84c]" : isActive ? "text-[#4ade80]" : "text-[#333]")}>{isActive ? (i < stage ? "✓" : icon) : icon}</span>
                                                <span className={"text-[9px] tracking-wide " + (isLost ? "text-[#333]" : isActive ? "text-[#888]" : "text-[#333]")}>{label}</span>
                                              </button>
                                            );
                                          })}
                                          {/* Lost button */}
                                          <button
                                            type="button"
                                            disabled={!canSave}
                                            onClick={() => {
                                              if (!canSave) return;
                                              if (isLost) {
                                                // Un-mark as lost
                                                saveOutcome({ runId: runIdNum, leadId: detailLead.id, patch: { lost_reason: null } });
                                              } else {
                                                // Mark as lost with default reason — user picks reason below
                                                saveOutcome({ runId: runIdNum, leadId: detailLead.id, patch: { lost_reason: "no_response" } });
                                              }
                                            }}
                                            className={"flex flex-col items-center gap-1.5 py-2.5 px-2.5 rounded-lg border transition-all disabled:cursor-not-allowed " + (isLost ? "border-[#f87171]/50 bg-[#f87171]/10 text-[#f87171]" : "border-[#1a1a1a] bg-[#111] text-[#555] hover:border-[#f87171]/30 hover:text-[#f87171]/70")}
                                          >
                                            <span className="text-sm">✗</span>
                                            <span className="text-[9px] tracking-wide">Lost</span>
                                          </button>
                                        </div>
                                        {isLost && (
                                          <p className="text-[11px] text-[#f87171]/70 mt-2 text-center">Marked as lost — select reason below</p>
                                        )}
                                        {!isLost && stage >= 0 && (
                                          <p className="text-[11px] text-[#555] mt-2 text-center">
                                            {stage === 3 ? t.ui.detail.dealClosed : `${stage + 1} ${t.ui.detail.stagesReached}`}
                                          </p>
                                        )}
                                      </div>

                                      {/* Lost reason — shown when contacted but stalled */}
                                      {showLostReason && (
                                        <div className="rounded-xl border border-[#252525] bg-[#0d0d0d] p-4 space-y-2">
                                          <p className="text-[10px] uppercase tracking-widest text-[#555]">Lost why</p>
                                          <div className="grid grid-cols-2 gap-1.5">
                                            {lostReasons.map(({ key, label }) => (
                                              <button
                                                key={key}
                                                type="button"
                                                disabled={!canSave}
                                                onClick={() => canSave && saveOutcome({ runId: runIdNum, leadId: detailLead.id, patch: { lost_reason: lostReason === key ? null : key } })}
                                                className={"px-3 py-2 rounded-lg border text-[11px] transition-all text-left " + (lostReason === key ? "border-[#f87171]/40 bg-[#f87171]/8 text-[#f87171]" : "border-[#1a1a1a] bg-[#111] text-[#555] hover:border-[#252525] hover:text-[#888]") + " disabled:cursor-not-allowed"}
                                              >
                                                {label}
                                              </button>
                                            ))}
                                          </div>
                                        </div>
                                      )}

                                      {/* Tonality used */}
                                      <div className="rounded-xl border border-[#252525] bg-[#0d0d0d] p-4 space-y-2">
                                        <p className="text-[10px] uppercase tracking-widest text-[#555]">Tone</p>
                                        <div className="grid grid-cols-2 gap-1.5">
                                          {([
                                            { key: "soft",         label: "Soft" },
                                            { key: "consultative", label: "Consultative" },
                                            { key: "direct",       label: "Direct" },
                                            { key: "bold",         label: "Bold" },
                                          ] as const).map((tone) => (
                                            <button
                                              key={tone.key}
                                              type="button"
                                              disabled={!canSave}
                                              onClick={() => canSave && saveOutcome({ runId: runIdNum, leadId: detailLead.id, patch: { tonality: tonalityVal === tone.key ? null : tone.key } })}
                                              className={"py-2 rounded-lg border text-[11px] transition-all " + (tonalityVal === tone.key ? "border-[#c9a84c]/40 bg-[rgba(201,168,76,0.08)] text-[#c9a84c]" : "border-[#1a1a1a] bg-[#111] text-[#555] hover:border-[#252525] hover:text-[#888]") + " disabled:cursor-not-allowed"}
                                            >
                                              {tone.label}
                                            </button>
                                          ))}
                                        </div>
                                      </div>

                                      {/* Revenue input */}
                                      <div className="rounded-xl border border-[#252525] bg-[#0d0d0d] p-4 space-y-3">
                                        <p className="text-[10px] uppercase tracking-widest text-[#555]">{t.ui.detail.dealValue}</p>
                                        {(() => {
                                          const loc = (location ?? "").toLowerCase();
                                          const sym = loc.includes("sweden") || loc.includes("sverige") || loc.includes("stockholm") || loc.includes("göteborg") || loc.includes("malmö") || loc.includes(", se") || loc.endsWith(" se") ? "kr" : loc.includes("uk") || loc.includes("london") || loc.includes("england") ? "£" : loc.includes("euro") || loc.includes("germany") || loc.includes("france") || loc.includes("spain") ? "€" : "$";
                                          return (
                                            <>
                                              <div className="flex items-center gap-2">
                                                <span className="text-[#555] text-sm">{sym}</span>
                                                <input
                                                  type="number"
                                                  min="0"
                                                  placeholder="0"
                                                  defaultValue={revenueVal ?? ""}
                                                  disabled={!canSave}
                                                  onBlur={(e: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
                                                    if (!canSave) return;
                                                    const v = parseFloat(e.target.value);
                                                    saveOutcome({ runId: runIdNum, leadId: detailLead.id, patch: { revenue: Number.isFinite(v) ? v : null } });
                                                  }}
                                                  className="flex-1 bg-[#111] border border-[#252525] rounded-lg px-3 py-2 text-sm text-[#f5f0e8] placeholder-[#333] focus:outline-none focus:border-[rgba(201,168,76,0.4)] transition-colors disabled:opacity-40"
                                                />
                                              </div>
                                              {closed && revenueVal && (
                                                <p className="text-[11px] text-[#4ade80]">✦ {sym}{revenueVal.toLocaleString()} closed</p>
                                              )}
                                            </>
                                          );
                                        })()}
                                      </div>

                                      {/* Notes */}
                                      <div className="rounded-xl border border-[#252525] bg-[#0d0d0d] p-4 space-y-2">
                                        <p className="text-[10px] uppercase tracking-widest text-[#555]">{t.ui.detail.notes}</p>
                                        <textarea
                                          rows={3}
                                          placeholder="Objections, context, follow-up reminders…"
                                          defaultValue={notesVal ?? ""}
                                          disabled={!canSave}
                                          onBlur={(e: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
                                            if (!canSave) return;
                                            saveOutcome({ runId: runIdNum, leadId: detailLead.id, patch: { notes: e.target.value.trim() || null } });
                                          }}
                                          className="w-full bg-[#111] border border-[#252525] rounded-lg px-3 py-2 text-[12px] text-[#c8c0b0] placeholder-[#333] focus:outline-none focus:border-[rgba(201,168,76,0.4)] transition-colors resize-none disabled:opacity-40"
                                        />
                                        <p className="text-[10px] text-[#333]">{t.ui.detail.savesOnBlur}</p>
                                      </div>

                                      {/* Activity log — sent emails for this lead */}
                                      {(() => {
                                        const leadEmails = (() => {
                                          try {
                                            const key = `vantio_activity_${detailLead.id}`;
                                            return JSON.parse(localStorage.getItem(key) ?? "[]") as Array<{ subject: string; to: string; sentAt: string; body: string }>;
                                          } catch { return []; }
                                        })();
                                        if (leadEmails.length === 0) return null;
                                        return (
                                          <div className="rounded-xl border border-[#252525] bg-[#0d0d0d] p-4 space-y-3">
                                            <p className="text-[10px] uppercase tracking-widests text-[#555]">Sent messages</p>
                                            <div className="space-y-2">
                                              {leadEmails.map((e, i) => (
                                                <div key={i} className="rounded-lg border border-[#1a1a1a] bg-[#080808] px-3 py-2.5 space-y-1">
                                                  <div className="flex items-center justify-between gap-2">
                                                    <p className="text-[12px] font-medium text-[#c8c0b0] truncate">{e.subject}</p>
                                                    <p className="text-[10px] text-[#333] flex-shrink-0">{new Date(e.sentAt).toLocaleDateString()}</p>
                                                  </div>
                                                  <p className="text-[10px] text-[#444]">To: {e.to}</p>
                                                  <p className="text-[11px] text-[#555] line-clamp-2 leading-relaxed">{e.body}</p>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        );
                                      })()}

                                      {/* Follow-up reminder — auto-suggested from friction level */}
                                      {(() => {
                                        const frictionDays: Record<string, number> = { LOW: 3, MEDIUM: 5, HIGH: 7 };
                                        const suggestedDays = difficultyForTracking ? (frictionDays[difficultyForTracking] ?? 5) : 5;
                                        const suggestedDate = (() => {
                                          const d = new Date();
                                          d.setDate(d.getDate() + suggestedDays);
                                          return d.toISOString().slice(0, 10);
                                        })();
                                        const displayVal = followupVal || suggestedDate;
                                        return (
                                          <div className="rounded-xl border border-[#252525] bg-[#0d0d0d] p-4 space-y-2">
                                            <div className="flex items-center justify-between">
                                              <p className="text-[10px] uppercase tracking-widest text-[#555]">{t.ui.detail.followUpReminder}</p>
                                              {!followupVal && (
                                                <span className="text-[9px] px-2 py-0.5 rounded-full border border-[#252525] text-[#444]">
                                                  auto · {suggestedDays}d
                                                </span>
                                              )}
                                              {followupVal && !closed && (() => {
                                                const diff = Math.ceil((new Date(followupVal).getTime() - Date.now()) / 86400000);
                                                const overdue = diff < 0;
                                                const today = diff === 0;
                                                return (
                                                  <span className={"text-[10px] px-2 py-0.5 rounded-full border " + (overdue ? "border-[#f87171]/30 text-[#f87171] bg-[#f87171]/5" : today ? "border-[#c9a84c]/30 text-[#c9a84c] bg-[#c9a84c]/5" : "border-[#4ade80]/20 text-[#4ade80] bg-[#4ade80]/5")}>
                                                    {overdue ? `${Math.abs(diff)}${t.ui.detail.overdueLabel}` : today ? t.ui.detail.todayLabel : `${t.ui.detail.inDaysLabel} ${diff}d`}
                                                  </span>
                                                );
                                              })()}
                                            </div>
                                            <input
                                              type="date"
                                              disabled={!canSave}
                                              defaultValue={displayVal}
                                              key={displayVal}
                                              onBlur={(e: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
                                                if (!canSave) return;
                                                saveOutcome({ runId: runIdNum, leadId: detailLead.id, patch: { followup_date: e.target.value || null } });
                                              }}
                                              className="w-full bg-[#111] border border-[#252525] rounded-lg px-3 py-2 text-[12px] text-[#c8c0b0] focus:outline-none focus:border-[rgba(201,168,76,0.4)] transition-colors disabled:opacity-40 [color-scheme:dark]"
                                            />
                                            <p className="text-[10px] text-[#333]">
                                              {followupVal
                                                ? t.ui.detail.followUpHint
                                                : `${difficultyForTracking ? difficultyForTracking.charAt(0) + difficultyForTracking.slice(1).toLowerCase() : "Medium"} friction — edit to override`}
                                            </p>
                                          </div>
                                        );
                                      })()}
                                    </div>
                                  );
                                })()}
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

              {/* ── PAGINATION BAR ── */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-1 pt-4 pb-1 flex-wrap">
                  {/* First page */}
                  <button
                    type="button"
                    onClick={() => { setCurrentPage(1); setSelectedLead(null); }}
                    disabled={currentPage === 1}
                    className="w-8 h-8 text-[12px] rounded-lg flex items-center justify-center text-[#555] hover:text-[#888] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="First page"
                  >
                    «
                  </button>
                  {/* Prev */}
                  <button
                    type="button"
                    onClick={() => { setCurrentPage((p: number) => Math.max(1, p - 1)); setSelectedLead(null); }}
                    disabled={currentPage === 1}
                    className="w-8 h-8 text-[12px] rounded-lg flex items-center justify-center text-[#555] hover:text-[#888] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    ‹
                  </button>

                  {/* Page numbers — show at most 7 buttons with ellipsis */}
                  {(() => {
                    const pages: (number | "…")[] = [];
                    if (totalPages <= 7) {
                      for (let i = 1; i <= totalPages; i++) pages.push(i);
                    } else {
                      pages.push(1);
                      if (currentPage > 3) pages.push("…");
                      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pages.push(i);
                      if (currentPage < totalPages - 2) pages.push("…");
                      pages.push(totalPages);
                    }
                    return pages.map((p, i) =>
                      p === "…" ? (
                        <span key={`ellipsis-${i}`} className="w-8 h-8 flex items-center justify-center text-[#333] text-[12px]">…</span>
                      ) : (
                        <button
                          key={p}
                          type="button"
                          onClick={() => { setCurrentPage(p as number); setSelectedLead(null); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                          className={
                            "w-8 h-8 text-[12px] rounded-lg flex items-center justify-center font-medium transition-all " +
                            (currentPage === p
                              ? "bg-[#c9a84c] text-[#080808]"
                              : "text-[#555] hover:text-[#c9a84c] hover:bg-[rgba(201,168,76,0.08)] border border-transparent hover:border-[rgba(201,168,76,0.2)]")
                          }
                        >
                          {p}
                        </button>
                      )
                    );
                  })()}

                  {/* Next */}
                  <button
                    type="button"
                    onClick={() => { setCurrentPage((p: number) => Math.min(totalPages, p + 1)); setSelectedLead(null); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                    disabled={currentPage === totalPages}
                    className="w-8 h-8 text-[12px] rounded-lg flex items-center justify-center text-[#555] hover:text-[#888] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    ›
                  </button>
                  {/* Last */}
                  <button
                    type="button"
                    onClick={() => { setCurrentPage(totalPages); setSelectedLead(null); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                    disabled={currentPage === totalPages}
                    className="w-8 h-8 text-[12px] rounded-lg flex items-center justify-center text-[#555] hover:text-[#888] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Last page"
                  >
                    »
                  </button>

                  <span className="text-[11px] text-[#333] ml-2">
                    Page {currentPage} of {totalPages} · {sortedLeads.length} leads
                  </span>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {/* ── Score Explanation Modal ── */}
      {showScoreModal && (() => {
        const modalLead = leads.find((l: LeadUI) => l.id === showScoreModal);
        if (!modalLead) return null;
        const val = modalLead.score.value ?? 0;
        const opp = modalLead.score.opportunity ?? 0;
        const risk = modalLead.score.risk ?? 0;
        const ready = modalLead.score.readiness ?? 0;
        const fit = modalLead.fit?.fitScore ?? 0;
        const color = val >= 70 ? "#4ade80" : val >= 45 ? "#c9a84c" : "#f87171";
        const bd = modalLead.score.breakdown;
        return (
          <>
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[70]" onClick={() => setShowScoreModal(null)} />
            <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-[#0a0a0a] border border-[#252525] rounded-2xl z-[80] shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
              <div className="flex items-start justify-between p-6 border-b border-[#141414]">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-[#8a6e30] mb-1">Score explanation</p>
                  <h2 className="text-[17px] font-medium text-[#f5f0e8]" style={{ fontFamily: "var(--font-display), serif" }}>
                    {modalLead.company.name}
                  </h2>
                </div>
                <button onClick={() => setShowScoreModal(null)} className="text-[#444] hover:text-[#888] transition-colors text-xl leading-none mt-1">×</button>
              </div>
              <div className="p-6 space-y-5">
                {/* Overall score */}
                <div className="flex items-center gap-4 rounded-xl border border-[#1a1a1a] bg-[#080808] p-4">
                  <div className="relative w-16 h-16 flex-shrink-0">
                    <svg viewBox="0 0 56 56" className="w-full h-full -rotate-90">
                      <circle cx="28" cy="28" r="24" fill="none" stroke="#1a1a1a" strokeWidth="5" />
                      <circle cx="28" cy="28" r="24" fill="none" stroke={color} strokeWidth="5"
                        strokeDasharray={`${(val / 100) * 150.8} 150.8`} strokeLinecap="round" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-[15px] font-bold" style={{ color }}>{val}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold" style={{ color }}>
                      {val >= 70 ? "Strong Lead" : val >= 45 ? "Moderate Lead" : "Weak Lead"}
                    </p>
                    <p className="text-[12px] text-[#666] mt-1 leading-relaxed">{getScoreReason(modalLead, language)}</p>
                  </div>
                </div>

                {/* Sub-scores */}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Opportunity", value: opp, color: opp >= 60 ? "#4ade80" : opp >= 35 ? "#c9a84c" : "#f87171", desc: "Untapped potential for your services" },
                    { label: "Readiness", value: ready, color: ready >= 60 ? "#4ade80" : ready >= 35 ? "#c9a84c" : "#f87171", desc: "How prepared they are to buy" },
                    { label: "Risk", value: risk, color: risk >= 60 ? "#f87171" : risk >= 35 ? "#c9a84c" : "#4ade80", desc: "Likelihood of a difficult sale" },
                    { label: "Profile Fit", value: fit, color: fit >= 65 ? "#4ade80" : fit >= 40 ? "#c9a84c" : "#f87171", desc: "Match to your capabilities" },
                  ].map(s => (
                    <div key={s.label} className="rounded-xl border border-[#1a1a1a] bg-[#080808] p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] text-[#666]">{s.label}</p>
                        <p className="text-[14px] font-bold" style={{ color: s.color }}>{s.value}</p>
                      </div>
                      <div className="w-full h-1 bg-[#141414] rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${s.value}%`, backgroundColor: s.color }} />
                      </div>
                      <p className="text-[10px] text-[#444]">{s.desc}</p>
                    </div>
                  ))}
                </div>

                {/* Category breakdown */}
                {bd && (
                  <div className="space-y-2">
                    <p className="text-[10px] uppercase tracking-widests text-[#444]">Category breakdown</p>
                    {([
                      { key: "reputation", label: "Reputation", hint: "Reviews & ratings" },
                      { key: "digitalPresence", label: "Digital presence", hint: "Website & social" },
                      { key: "businessStrength", label: "Business strength", hint: "Stability signals" },
                      { key: "opportunityGap", label: "Opportunity gap", hint: "Missing capabilities" },
                      { key: "stabilityRisk", label: "Stability risk", hint: "Risk indicators" },
                      { key: "evidenceConfidence", label: "Evidence confidence", hint: "Signal quality" },
                    ] as const).map(({ key, label, hint }) => {
                      const v = bd[key as keyof typeof bd] ?? 0;
                      const c = v >= 70 ? "#4ade80" : v >= 40 ? "#c9a84c" : "#f87171";
                      return (
                        <div key={key} className="flex items-center gap-3">
                          <div className="w-28 flex-shrink-0">
                            <p className="text-[11px] text-[#666] truncate">{label}</p>
                            <p className="text-[9px] text-[#333]">{hint}</p>
                          </div>
                          <div className="flex-1 h-1.5 bg-[#141414] rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${v}%`, backgroundColor: c }} />
                          </div>
                          <p className="text-[11px] font-bold w-8 text-right" style={{ color: c }}>{v}</p>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Evidence reasons */}
                {modalLead.score.reasons?.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] uppercase tracking-widests text-[#444]">Evidence</p>
                    <div className="space-y-1.5">
                      {modalLead.score.reasons.map((r: string, i: number) => {
                        const pos = /strong|high|good|great|active|present|above/i.test(r);
                        const neg = /no |missing|low|weak|below|lacks/i.test(r);
                        return (
                          <div key={i} className="flex items-start gap-2.5">
                            <span className={`text-[10px] mt-0.5 flex-shrink-0 ${pos ? "text-[#4ade80]" : neg ? "text-[#f87171]" : "text-[#555]"}`}>
                              {pos ? "✓" : neg ? "✗" : "·"}
                            </span>
                            <p className="text-[12px] text-[#888] leading-snug">{r}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        );
      })()}


      {/* ── Lead Comparison Modal ── */}
      {compareMode && compareIds.length >= 2 && (() => {
        const compareLeads = compareIds.map(id => leads.find((l: LeadUI) => l.id === id)).filter(Boolean) as LeadUI[];
        if (compareLeads.length < 2) return null;
        const metrics = [
          { label: "Score",       key: (l: LeadUI) => l.score.value ?? 0,       color: (v: number) => v >= 70 ? "#4ade80" : v >= 45 ? "#c9a84c" : "#f87171" },
          { label: "Opportunity", key: (l: LeadUI) => l.score.opportunity ?? 0,  color: (v: number) => v >= 60 ? "#4ade80" : v >= 35 ? "#c9a84c" : "#f87171" },
          { label: "Risk",        key: (l: LeadUI) => l.score.risk ?? 0,         color: (v: number) => v >= 60 ? "#f87171" : v >= 35 ? "#c9a84c" : "#4ade80" },
          { label: "Fit",         key: (l: LeadUI) => l.fit?.fitScore ?? 0,      color: (v: number) => v >= 65 ? "#4ade80" : v >= 40 ? "#c9a84c" : "#f87171" },
          { label: "Readiness",   key: (l: LeadUI) => l.score.readiness ?? 0,    color: (v: number) => v >= 60 ? "#4ade80" : v >= 35 ? "#c9a84c" : "#f87171" },
        ];
        return (
          <>
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[70]" onClick={() => setCompareMode(false)} />
            <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-[#0a0a0a] border border-[#252525] rounded-2xl z-[80] shadow-2xl max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between p-5 border-b border-[#141414]">
                <div>
                  <p className="text-[10px] uppercase tracking-widests text-[#8a6e30] mb-0.5">Comparison</p>
                  <h2 className="text-[15px] font-medium text-[#f5f0e8]">Side-by-side comparison</h2>
                </div>
                <button onClick={() => setCompareMode(false)} className="text-[#444] hover:text-[#888] transition-colors text-xl leading-none">×</button>
              </div>
              <div className="p-5 space-y-4">
                {/* Lead names header */}
                <div className={"grid gap-3"} style={{ gridTemplateColumns: `140px repeat(${compareLeads.length}, 1fr)` }}>
                  <div />
                  {compareLeads.map(l => (
                    <div key={l.id} className="rounded-xl border border-[#1a1a1a] bg-[#080808] p-3 text-center">
                      <p className="text-[12px] font-semibold text-[#c8c0b0] truncate">{l.company.name}</p>
                      <p className="text-[10px] text-[#444] mt-0.5 truncate">{l.classification.primaryIndustry.replace(/_/g, " ")}</p>
                      {l.company.city && <p className="text-[10px] text-[#333]">{l.company.city}</p>}
                    </div>
                  ))}
                </div>

                {/* Metrics */}
                {metrics.map(m => {
                  const vals = compareLeads.map(l => m.key(l));
                  const maxVal = Math.max(...vals);
                  return (
                    <div key={m.label} className={"grid gap-3 items-center"} style={{ gridTemplateColumns: `140px repeat(${compareLeads.length}, 1fr)` }}>
                      <p className="text-[11px] text-[#555]">{m.label}</p>
                      {vals.map((v, i) => {
                        const c = m.color(v);
                        const isBest = v === maxVal && vals.filter(x => x === maxVal).length === 1;
                        return (
                          <div key={i} className={"rounded-xl border p-3 text-center " + (isBest ? "border-[rgba(201,168,76,0.3)] bg-[rgba(201,168,76,0.04)]" : "border-[#1a1a1a] bg-[#080808]")}>
                            <p className="text-[16px] font-bold" style={{ color: c }}>{v}</p>
                            <div className="w-full h-1 bg-[#1a1a1a] rounded-full overflow-hidden mt-1.5">
                              <div className="h-full rounded-full" style={{ width: `${v}%`, backgroundColor: c }} />
                            </div>
                            {isBest && <p className="text-[9px] text-[#8a6e30] mt-1">Best</p>}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}

                {/* Gap type */}
                <div className={"grid gap-3 items-start"} style={{ gridTemplateColumns: `140px repeat(${compareLeads.length}, 1fr)` }}>
                  <p className="text-[11px] text-[#555]">Gap type</p>
                  {compareLeads.map(l => {
                    const gap = (l.metadata?.outreach as { gap?: string } | null)?.gap ?? null;
                    return (
                      <div key={l.id} className="rounded-xl border border-[#1a1a1a] bg-[#080808] p-3 text-center">
                        <p className="text-[11px] text-[#888]">{gap ? gap.replace(/_/g, " ") : "—"}</p>
                      </div>
                    );
                  })}
                </div>

                {/* Website */}
                <div className={"grid gap-3 items-start"} style={{ gridTemplateColumns: `140px repeat(${compareLeads.length}, 1fr)` }}>
                  <p className="text-[11px] text-[#555]">Website</p>
                  {compareLeads.map(l => (
                    <div key={l.id} className="rounded-xl border border-[#1a1a1a] bg-[#080808] p-3 text-center">
                      {l.company.website
                        ? <a href={l.company.website} target="_blank" rel="noreferrer" className="text-[11px] text-[#c9a84c] hover:underline" onClick={e => e.stopPropagation()}>Visit ↗</a>
                        : <p className="text-[11px] text-[#333]">None</p>
                      }
                    </div>
                  ))}
                </div>

                {/* Action buttons */}
                <div className={"grid gap-3"} style={{ gridTemplateColumns: `140px repeat(${compareLeads.length}, 1fr)` }}>
                  <p className="text-[11px] text-[#555]">Action</p>
                  {compareLeads.map(l => (
                    <button key={l.id} type="button"
                      onClick={() => { setSelectedLead(l); setCompareMode(false); }}
                      className="py-2 rounded-xl border border-[rgba(201,168,76,0.25)] text-[11px] text-[#c9a84c] hover:bg-[rgba(201,168,76,0.06)] transition-all">
                      Open lead →
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        );
      })()}

    </main>
  );
}
