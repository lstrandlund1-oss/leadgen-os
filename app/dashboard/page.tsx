"use client";

import Link from "next/link";
import React, {
  Fragment,
  useEffect,
  useMemo,
  useState,
  FormEvent,
  ChangeEvent,
  MouseEvent,
  KeyboardEvent,
  FocusEvent,
} from "react";
import type { Lead, Language, SearchRecord } from "@/lib/types";
import type { ProviderName } from "@/lib/providers/types";
import { getEffectivePlan, canUseDeepEnrichment } from "@/lib/plan";
import { getTranslations } from "@/lib/i18n";
import HamburgerMenu from "../components/HamburgerMenu";
import NotificationBell from "../components/NotificationBell";
import { createSupabaseBrowser } from "@/lib/supabaseBrowser";
import type { TranslationSchema as Translations } from "@/lib/i18n/types";
import type { SocialPresenceFilter } from "@/lib/providers/types";
import { useToast } from "../components/ToastProvider";
import { getSearchQueries, getSearchVariants } from "@/lib/niche/synonyms";
import { dedupeLeads } from "@/lib/search/dedupeLeads";
import type { SearchPlan } from "@/lib/search/anthropicPlanner";
import { createPortal } from "react-dom";
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
  partialNeeds?: string[];
  reasons: string[];
  tooltip?: string;
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
  lost_reason:
    | "no_response"
    | "not_interested"
    | "has_provider"
    | "wrong_timing"
    | "price_too_high"
    | "chose_competitor"
    | "other"
    | null;
  score_at_outreach: number | null;
};

type OutcomeKey = "contacted" | "replied" | "booked_call" | "closed";

const OUTCOME_STATUS_KEYS: readonly OutcomeKey[] = ["contacted", "replied", "booked_call", "closed"] as const;

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

function buildOutcomePatch(key: OutcomeKey, value: boolean): Partial<Record<OutcomeKey, boolean>> {
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

function localizeOpportunityMessage(signal: OpportunitySignal | null | undefined, language: Language): string | null {
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
    conversion_gap: "Starka recensioner men ingen webbplats — tydlig konverteringspotential.",
    trust_gap: "Ingen webbplats — konverteringsfriktion och tappat förtroende.",
    untapped_attention: "Hög efterfrågan men svag närvaro — tydlig content-lucka.",
    underexposed_quality: "Hög kvalitet men låg synlighet — tillväxtmöjlighet.",
    scaling_ready: "Stabil grund men det skalar inte — redo för ett tillväxtsystem.",
  };

  const en: Record<string, string> = {
    conversion_gap: "Strong reputation but no website — high conversion upside.",
    trust_gap: "No website — conversion + trust friction.",
    untapped_attention: "High demand but weak social presence — content gap.",
    underexposed_quality: "High quality service but low visibility — growth opportunity.",
    scaling_ready: "Stable base but not scaling — ready for a growth system.",
  };

  const dict = language === "sv" ? sv : en;
  return dict[signal.type] ?? signal.message ?? null;
}

function deriveDeterministicOpportunityFallback(lead: LeadUI): OpportunitySignal | null {
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

function normalizeLegacyOrNewOpportunityInsight(lead: LeadUI): OpportunitySignal | null {
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

  const sigs = Array.isArray(lead.opportunitySignals) ? lead.opportunitySignals : [];
  if (!sigs.length) return null;

  const priority = { high: 3, medium: 2, low: 1 } as const;
  return sigs.slice().sort((a, b) => priority[b.strength] - priority[a.strength])[0];
}

function getLocalizedOpportunityInsight(lead: LeadUI, language: Language): OpportunitySignal | null {
  const base = normalizeLegacyOrNewOpportunityInsight(lead);
  if (!base) return null;

  const msg = localizeOpportunityMessage(base, language);
  if (!msg) return null;

  return { ...base, message: msg };
}

function riskTitleFromProfile(p: Lead["score"]["riskProfile"] | null | undefined, t: Translations): string {
  if (!p || p === "unknown") return t.ui.table.riskProfile.none ?? "";
  const profileMap = t.ui.table.riskProfile as Record<string, string>;
  return profileMap[p] ?? p.replace(/_/g, " ");
}

function riskMessage(language: Language, lead: Lead): string {
  const rp = lead.score.riskProfile;
  const risk = lead.score.risk ?? 0;

  if (language === "sv") {
    if (rp === "early_stage" || rp === "limited_data") {
      return "Låg mognad + låg proof. Ofta svårt att få momentum utan att fixa grunderna först.";
    }
    if (rp === "well_established" || rp === "local_authority") {
      return "Stark närvaro + starkt proof. Svårare att vinna — kräver tydlig differentiering och systemvinkel.";
    }
    if (risk >= 70) return "Hög risk. Kräver tydlig vinkel och starkare erbjudande för att vinna.";
    if (risk >= 45) return "Mellanrisk. Går att vinna med rätt angle och tydlig payoff.";
    return "Låg risk. Relativt lätt att få respons om erbjudandet är skarpt.";
  }

  if (rp === "early_stage" || rp === "limited_data") {
    return "Low maturity + weak proof. Usually hard to convert unless fundamentals are fixed first.";
  }
  if (rp === "well_established" || rp === "local_authority") {
    return "Strong presence + strong proof. Harder to displace — requires differentiation and a system angle.";
  }
  if (risk >= 70) return "High risk. Needs a sharp angle and stronger offer to win.";
  if (risk >= 45) return "Medium risk. Winnable with the right angle and clear payoff.";
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
    reasons.push(`Opportunity: ${opportunity}/100. Risk: ${risk}/100. Readiness: ${readiness}/100.`);
    reasons.push(`Classification: ${industry} (${confidence}/100).`);

    if (typeof rc === "number") reasons.push(`Reviews: ${rc}.`);
    if (typeof rating === "number") reasons.push(`Rating: ${rating}.`);

    if (score >= 80) reasons.push("Top-tier composite score for direct outreach.");
    else if (score >= 60) reasons.push("Good candidate for value-first outreach.");
    else reasons.push("Lower composite score — use for volume / testing hooks.");
  } else {
    reasons.push(`Opportunity: ${opportunity}/100. Risk: ${risk}/100. Readiness: ${readiness}/100.`);
    reasons.push(`Klassning: ${industry} (${confidence}/100).`);

    if (typeof rc === "number") reasons.push(`Recensioner: ${rc}.`);
    if (typeof rating === "number") reasons.push(`Betyg: ${rating}.`);

    if (score >= 80) reasons.push("Toppscore för direkt outreach.");
    else if (score >= 60) reasons.push("Bra kandidat för värde-först outreach.");
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
    } else if (rp === "early_stage" || rp === "limited_data") {
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
    ]
      .filter(Boolean)
      .join(" ");
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
    } else if (rp === "early_stage" || rp === "limited_data") {
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
    ]
      .filter(Boolean)
      .join(" ");
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
  _expansionContext: {
    provider: ProviderName;
    primaryQuery: string;
    expandedQueries: string[];
    locationText: string;
    socialPresence: SocialPresenceFilter;
    seenIds: Set<string>;
    seenNames: Set<string>;
  } | null;
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
      socialPresence,
      limit: 20,
      ...(runIdArg != null ? { runId: runIdArg } : {}),
      ...(cursor != null ? { cursor } : {}),
      forceRefresh: args.forceRefresh ?? false,
    }),
  }).catch((err) => {
    if (err?.name === "AbortError") throw new Error("Search timed out. Try again or check your connection.");
    return null;
  });

  clearTimeout(timeoutId);
  if (!searchRes?.ok) return null;

  const searchData = (await searchRes.json().catch(() => ({}))) as ProviderSearchResponse;
  const runId = typeof searchData.runId === "number" ? searchData.runId : null;
  const _cacheInfo = (searchData.summary as Record<string, unknown> | null) ?? null;
  if (!runId) return null;

  const finalNextCursor = searchData.nextCursor ?? null;
  const finalExhausted = searchData.exhausted ?? false;

  // Pagination via cursor is handled by "Load more" — variant expansion handles volume

  const leadsRes = await fetch(
    `/api/providers/runs/${runId}/leads?${locationText ? `location=${encodeURIComponent(locationText)}&` : ""}${niche ? `niche=${encodeURIComponent(niche)}` : ""}`,
  ).catch(() => null);
  if (!leadsRes?.ok) return null;

  const leadsData = (await leadsRes.json().catch(() => ({}))) as RunLeadsResponse;
  const primaryLeads: LeadUI[] = Array.isArray(leadsData?.leads) ? (leadsData.leads as LeadUI[]) : [];

  // Deduplicate primary results only — expanded variants load in background
  const seenIds = new Set<string>(primaryLeads.map((l) => l.sourceId).filter(Boolean) as string[]);
  const seenNames = new Set<string>(primaryLeads.map((l) => l.company.name.toLowerCase().trim()));

  return {
    runId,
    leads: primaryLeads,
    nextCursor: finalNextCursor,
    exhausted: finalExhausted,
    cached: (_cacheInfo?.cached as boolean) ?? false,
    ageDays: (_cacheInfo?.ageDays as number) ?? 0,
    cachedAt: (_cacheInfo?.cachedAt as string) ?? null,
    // Pass expansion params so caller can fire background fetch
    _expansionContext:
      !cursor && locationText
        ? {
            provider,
            primaryQuery,
            expandedQueries,
            locationText,
            socialPresence,
            seenIds,
            seenNames,
          }
        : null,
  };
}

// SearchProgressOverlay
function SearchProgressOverlay({ pct, label }: { pct: number; label: string }) {
  const r = 44;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct / 100);
  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 9999, background: "rgba(8,8,8,0.88)", backdropFilter: "blur(8px)" }}>
      <div className="flex flex-col items-center gap-7">
        <div className="relative" style={{ width: 120, height: 120 }}>
          <svg width="120" height="120" style={{ transform: "rotate(-90deg)" }}>
            <circle cx="60" cy="60" r={r} fill="none" stroke="#1a1a1a" strokeWidth="5" />
            <circle
              cx="60"
              cy="60"
              r={r}
              fill="none"
              stroke="#c9a84c"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={offset}
              style={{ transition: "stroke-dashoffset 0.7s cubic-bezier(0.4,0,0.2,1)" }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[#c9a84c] font-bold" style={{ fontSize: 22, fontFamily: "monospace" }}>
              {Math.round(pct)}%
            </span>
          </div>
        </div>
        <div className="text-center space-y-1.5">
          <p className="text-[15px] font-medium text-[#f5f0e8]">{label}</p>
          <p
            className="text-[#737373]"
            style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "monospace" }}>
            AI-powered discovery
          </p>
        </div>
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="block rounded-full bg-[#c9a84c]"
              style={{ width: 6, height: 6, animation: `pulse 1.4s ease-in-out ${i * 0.18}s infinite` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Getting Started Side Panel ────────────────────────────────────────────────
// Rendered as a fixed left-edge tab + slide-in drawer.
// Uses fixed positioning so it is NEVER part of the page stacking context.
function GettingStartedPanel({
  checklistState,
  onDismiss,
}: {
  checklistState: { hasProfile: boolean; hasSearched: boolean; hasSelected: boolean; hasOutcome: boolean };
  onDismiss: () => void;
}) {
  const [open, setOpen] = useState(false);
  const steps = [
    {
      done: checklistState.hasProfile,
      label: "Set up your profile",
      sub: "Tell us your business type and target market",
      href: "/profile/settings",
    },
    {
      done: checklistState.hasSearched,
      label: "Run your first search",
      sub: "Enter a niche + location and score your first leads",
      href: null,
    },
    {
      done: checklistState.hasSelected,
      label: "Open a lead",
      sub: "Click any lead to see signals, gap analysis, and outreach script",
      href: null,
    },
    {
      done: checklistState.hasOutcome,
      label: "Log an outcome",
      sub: "Mark a lead as contacted, replied, or booked",
      href: null,
    },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <>
      {/* Left-edge trigger tab — always visible, never in flow */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Getting started checklist"
        style={{ zIndex: 8000 }}
        className="fixed left-0 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1.5 px-1.5 py-3 rounded-r-xl border border-l-0 border-[rgba(201,168,76,0.3)] bg-[#0d0d0d] hover:bg-[#111] transition-all group">
        <span className="text-[#c9a84c] text-xs">◈</span>
        <span
          className="text-[#8a6e30] group-hover:text-[#c9a84c] transition-colors"
          style={{
            writingMode: "vertical-rl",
            textOrientation: "mixed",
            fontSize: "9px",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}>
          Getting started
        </span>
        <span className="text-[9px] font-bold text-[#c9a84c]">{doneCount}/4</span>
      </button>

      {/* Backdrop */}
      {open && <div className="fixed inset-0 bg-black/40" style={{ zIndex: 8001 }} onClick={() => setOpen(false)} />}

      {/* Slide-in panel from the left */}
      <div
        className="fixed top-0 left-0 h-full w-72 bg-[#0a0a0a] border-r border-[#1a1a1a] flex flex-col transition-transform duration-300 ease-out"
        style={{ zIndex: 8002, transform: open ? "translateX(0)" : "translateX(-100%)" }}>
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-[#141414]">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#8a6e30] mb-1">Setup</p>
            <h2 className="text-[16px] font-light text-[#f5f0e8]" style={{ fontFamily: "var(--font-display), serif" }}>
              Getting{" "}
              <span className="italic" style={{ color: "#c9a84c" }}>
                started
              </span>
            </h2>
            <p className="text-[11px] text-[#737373] mt-1">{doneCount} of 4 complete</p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-[#616161] hover:text-[#999999] text-xl leading-none mt-1">
            ×
          </button>
        </div>

        {/* Progress bar */}
        <div className="px-5 py-3 border-b border-[#141414]">
          <div className="w-full h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#c9a84c] rounded-full transition-all duration-500"
              style={{ width: `${(doneCount / 4) * 100}%` }}
            />
          </div>
        </div>

        {/* Steps */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {steps.map(({ done, label, sub, href }) => (
            <div
              key={label}
              className={
                "rounded-xl border p-3.5 transition-all " +
                (done ? "border-[#141414] opacity-50" : "border-[#252525] bg-[#0d0d0d]")
              }>
              <div className="flex items-start gap-3">
                <div
                  className={
                    "mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 " +
                    (done ? "border-[#4ade80] bg-[#4ade80]/10" : "border-[#333]")
                  }>
                  {done && <span className="text-[9px] text-[#4ade80]">✓</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={"text-[12px] font-medium " + (done ? "line-through text-[#737373]" : "text-[#c8c0b0]")}>
                    {label}
                  </p>
                  <p className="text-[11px] text-[#737373] mt-0.5 leading-snug">{sub}</p>
                  {!done && href && (
                    <a
                      href={href}
                      className="text-[11px] text-[#c9a84c] hover:text-[#e8c97a] transition-colors mt-1.5 inline-block"
                      onClick={() => setOpen(false)}>
                      Go →
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#141414]">
          <button
            type="button"
            onClick={onDismiss}
            className="w-full py-2.5 rounded-xl border border-[#252525] text-[12px] text-[#737373] hover:border-[#333] hover:text-[#999999] transition-all">
            Dismiss checklist
          </button>
        </div>
      </div>
    </>
  );
}

// ── ScoreTooltip ─────────────────────────────────────────────────────────────
// Lightweight hover tooltip. Supports **bold** markers for section labels.
// Use "**Label** explanation text" format in tooltip strings.
function ScoreTooltip({ text, children }: { text: string; children: React.ReactNode | React.ReactNode[] }) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  if (!text) return <>{children}</>;

  // Parse text into segments — split on newlines, bold-wrap **...** markers
  function renderText(raw: string) {
    return raw.split("\n").map((line, i) => {
      const parts = line.split(/\*\*([^*]+)\*\*/g);
      return (
        <p key={i} style={{ margin: i === 0 ? 0 : "6px 0 0", fontSize: 11, color: "#bbb", lineHeight: 1.55 }}>
          {parts.map((part, j) =>
            j % 2 === 1 ? (
              <span key={j} style={{ color: "#e8c97a", fontWeight: 600 }}>
                {part}
              </span>
            ) : (
              part
            ),
          )}
        </p>
      );
    });
  }

  return (
    <span
      style={{ position: "relative", display: "inline-block", width: "100%" }}
      onMouseEnter={(e) => setRect((e.currentTarget as HTMLElement).getBoundingClientRect())}
      onMouseLeave={() => setRect(null)}>
      {children}
      {rect &&
        typeof window !== "undefined" &&
        createPortal(
          <div
            style={{
              position: "fixed",
              left: Math.min(rect.left + rect.width / 2, window.innerWidth - 160),
              top: rect.top - 12,
              transform: "translate(-50%, -100%)",
              zIndex: 999999,
              background: "#1a1a1a",
              border: "1px solid #333",
              borderRadius: 8,
              padding: "10px 14px",
              maxWidth: 280,
              pointerEvents: "none",
              boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
            }}>
            {renderText(text)}
            <div
              style={{
                position: "absolute",
                bottom: -4,
                left: "50%",
                transform: "translateX(-50%) rotate(45deg)",
                width: 7,
                height: 7,
                background: "#1a1a1a",
                borderRight: "1px solid #333",
                borderBottom: "1px solid #333",
              }}
            />
          </div>,
          document.body,
        )}
    </span>
  );
}

export default function Home() {
  const { success: toastSuccess, error: toastError, info: toastInfo } = useToast();

  // =====================
  // STATE
  // =====================

  const provider: ProviderName = "google_places";

  const [language, setLanguage] = useState<Language>(() => {
    if (typeof window === "undefined") return "en";
    try {
      const raw = localStorage.getItem("vantio_state_v1");
      if (!raw) return "en";
      const p = JSON.parse(raw);
      return p.language === "en" || p.language === "sv" ? p.language : "en";
    } catch {
      return "en";
    }
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
    try {
      const p = JSON.parse(localStorage.getItem("vantio_state_v1") ?? "{}");
      return typeof p.niche === "string" ? p.niche : "";
    } catch {
      return "";
    }
  });
  const [location, setLocation] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      const p = JSON.parse(localStorage.getItem("vantio_state_v1") ?? "{}");
      return typeof p.location === "string" ? p.location : "";
    } catch {
      return "";
    }
  });
  const [showNicheDropdown, setShowNicheDropdown] = useState(false);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [socialPresence, setSocialPresence] = useState<SocialPresenceFilter>(() => {
    if (typeof window === "undefined") return "any";
    try {
      const p = JSON.parse(localStorage.getItem("vantio_state_v1") ?? "{}");
      const v = p.socialPresence;
      return v === "low" || v === "medium" || v === "high" || v === "" ? v : "any";
    } catch {
      return "any";
    }
  });

  const [leads, setLeads] = useState<LeadUI[]>([]);
  const [sortBy, setSortBy] = useState<"score" | "opportunity" | "risk" | "confidence" | "fit">("score");
  const [minScore, setMinScore] = useState(0);
  const [filterHasWebsite, setFilterHasWebsite] = useState<"any" | "yes" | "no">("any");
  const [compareMode, setCompareMode] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<"contacted" | "replied" | "booked" | null>(null);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchProgress, setSearchProgress] = useState<{ pct: number; label: string } | null>(null);
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
    } catch {
      return new Set();
    }
  });

  const [selectedLead, setSelectedLead] = useState<LeadUI | null>(null);

  useEffect(() => {
    if (selectedLead) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [selectedLead]);

  // Lock body scroll when lead panel is open
  useEffect(() => {
    if (selectedLead) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [selectedLead]);
  const [detailTab, setDetailTab] = useState<"overview" | "signals" | "outreach" | "tracking" | "followup">("overview");
  const userPlan = getEffectivePlan();
  const deepEnrichmentUnlocked = canUseDeepEnrichment(userPlan);

  const [enrichmentLoading, setEnrichmentLoading] = useState(false);
  const [isRescoring, setIsRescoring] = useState(false);

  const [stableOrder, setStableOrder] = useState<Map<string, number>>(new Map());
  const [sequenceSteps, setSequenceSteps] = useState<
    Array<{
      id: number;
      step: number;
      day_offset: number;
      scheduled_date: string;
      channel: string;
      subject: string | null;
      message: string;
      objective: string;
      cta: string;
      status: string;
      cadence_type: string;
    }>
  >([]);
  const [sequenceLoading, setSequenceLoading] = useState(false);
  const [sequenceGenerating, setSequenceGenerating] = useState(false);
  const [sequenceExpandedStep, setSequenceExpandedStep] = useState<number | null>(null);

  const [enrichmentData, setEnrichmentData] = useState<{
    reachable: boolean;
    detectedPlatforms: string[];
    signals: Record<
      string,
      {
        key: string;
        value: string | number | boolean | null;
        present: boolean;
        label: string;
        category: string;
        confidence?: number;
      }
    >;
  } | null>(null);
  const [deepEnrichmentLoading, setDeepScanLoading] = useState(false);
  const [deepEnrichmentData, setDeepScanData] = useState<{
    deepScore: number;
    pageReachable: boolean;
    scannedAt?: string; // ISO string — set on restore from DB or on fresh scan
    isFromCache?: boolean;
    website: { scores: Record<string, number>; summary: string };
    market: { scores: Record<string, number>; competitorSummary: string; recommendation: string };
    brand: { scores: Record<string, number>; brandGrade: string; weakestArea: string; strengthArea: string };
  } | null>(null);

  // Variant for outcome tracking
  type OutreachVariant = "soft" | "consultative" | "direct" | "bold";
  const [outreachVariant, setOutreachVariant] = useState<OutreachVariant>("consultative");

  const [outcomesByLeadId, setOutcomesByLeadId] = useState<Record<string, LeadOutcomeUI>>({});
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
        location: location,
        socialPresence,
        runId,
        cursor: nextCursor,
      });

      if (!more) return;

      // Update pagination state (NOT leads)
      setRunId(more.runId);
      setNextCursor(more.nextCursor);
      setExhausted(more.exhausted);

      setLeads((prev: LeadUI[]) => {
        const seen = new Set(prev.map((l: LeadUI) => l.id));
        const merged = [...prev];
        for (const lead of more.leads) {
          if (!seen.has(lead.id)) merged.push(lead);
        }
        setStableOrder(new Map(merged.map((l: LeadUI, i: number) => [l.id, i])));
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

  // Derive hasBookingCta / hasClearOffer / isMobileFriendly from deep enrichment result
  function deriveDeepSignals(data: { pageReachable: boolean; website: { scores: Record<string, number> } }) {
    return {
      websiteReachable: data.pageReachable,
      hasBookingCta: data.pageReachable ? (data.website.scores.ctaStrength ?? 0) >= 50 : null,
      hasClearOffer: data.pageReachable ? (data.website.scores.ctaStrength ?? 0) >= 40 : null,
      isMobileFriendly: data.pageReachable ? (data.website.scores.pageSpeed ?? 0) >= 50 : null,
    };
  }

  function applyDeepScanToLead(
    lead: LeadUI,
    deepData: typeof deepEnrichmentData,
    derivedSignals: ReturnType<typeof deriveDeepSignals>,
  ): LeadUI {
    if (!deepData) return lead;
    try {
      const newScore = rescoreWithLightSignals({
        rating: lead.metrics.rating ?? 0,
        reviewCount: lead.metrics.reviewCount ?? 0,
        hasWebsite: !!lead.company.website,
        socialPresence: lead.metrics.socialPresence ?? "low",
        classificationConfidence: lead.classification.confidence ?? null,
        fitScore: lead.fit?.fitScore ?? 0,
        websiteReachable: derivedSignals.websiteReachable,
        hasContactPage: null,
        hasBookingCta: derivedSignals.hasBookingCta,
        hasClearOffer: derivedSignals.hasClearOffer,
        isMobileFriendly: derivedSignals.isMobileFriendly,
        socialPlatformCount: 0,
        ownerResponds: null,
      });

      // Deep scan tooltip merge: same rule as light enrichment.
      // Score changed → fresh tooltip. Score same → keep original + append context.
      const leadHasWebsite = !!lead.company.website;
      const deepAddendumParts: string[] = [];
      if (!leadHasWebsite) {
        deepAddendumParts.push("no website — full web analysis unavailable");
      } else {
        if (derivedSignals.hasBookingCta === false)
          deepAddendumParts.push("no booking CTA confirmed by deep enrichment");
        if (derivedSignals.isMobileFriendly === false) deepAddendumParts.push("site is not mobile-friendly");
        if (derivedSignals.hasClearOffer === false) deepAddendumParts.push("no clear service offer on site");
      }
      const deepAddendum =
        deepAddendumParts.length > 0
          ? `
Deep scan: ${deepAddendumParts.join(", ")}.`
          : "";

      const mergeDeepTooltips = (
        existingScore: LeadUI["score"],
        freshScore: LeadUI["score"],
      ): LeadUI["score"]["tooltips"] => {
        const existing = existingScore.tooltips;
        const fresh = freshScore.tooltips;
        if (!existing || !fresh) return fresh;
        const resolve = (
          key: keyof NonNullable<LeadUI["score"]["tooltips"]>,
          oldVal: number,
          newVal: number,
        ): string => {
          if (oldVal !== newVal) return fresh[key] ?? "";
          const base = existing[key] ?? "";
          return deepAddendum ? `${base}${deepAddendum}` : base;
        };
        return {
          value: resolve("value", existingScore.value ?? 0, freshScore.value ?? 0),
          opportunity: resolve("opportunity", existingScore.opportunity ?? 0, freshScore.opportunity ?? 0),
          fit: resolve("fit", existingScore.value ?? 0, freshScore.value ?? 0),
          risk: resolve("risk", existingScore.risk ?? 0, freshScore.risk ?? 0),
          readiness: resolve("readiness", existingScore.readiness ?? 0, freshScore.readiness ?? 0),
        };
      };

      return {
        ...lead,
        score: {
          ...newScore,
          tooltips: mergeDeepTooltips(lead.score, newScore),
        },
      };
    } catch {
      return lead;
    }
  }

  async function runDeepScan(lead: LeadUI): Promise<void> {
    if (deepEnrichmentLoading) return;
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
          const errData = (await res.json().catch(() => ({}))) as { error?: string };
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
        setLeads((prev: LeadUI[]) => prev.map((l: LeadUI) => (l.id === lead.id ? rescored : l)));
        setSelectedLead(rescored);

        // 3. Persist to Supabase (fire-and-forget — don't block UX)
        fetch("/api/deep-enrichment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceId: lead.sourceId,
            leadId: lead.id,
            scanResult,
            derivedSignals,
          }),
        }).catch(() => {
          /* ignore persistence errors */
        });
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
      Pick<
        LeadOutcomeUI,
        | "contacted"
        | "replied"
        | "booked_call"
        | "closed"
        | "revenue"
        | "notes"
        | "followup_date"
        | "lost_reason"
        | "tonality"
        | "angle_type"
        | "score_at_outreach"
      >
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
        angleType:
          patch.angle_type !== undefined
            ? patch.angle_type
            : selectedLead
              ? getStructuredAngle(selectedLead as LeadUI, language).title
              : null,
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
        const hay = `${l.company.name} ${l.classification.primaryIndustry} ${leadLocation(l)}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });
  }, [leads, minScore, query, filterHasWebsite]);

  const sortedLeads = useMemo(() => {
    const arr = [...filteredLeads];
    if (stableOrder.size > 0 && sortBy === "score") {
      arr.sort((a: LeadUI, b: LeadUI) => (stableOrder.get(a.id) ?? 9999) - (stableOrder.get(b.id) ?? 9999));
      return arr;
    }
    arr.sort((a: LeadUI, b: LeadUI) => {
      if (sortBy === "confidence") return (b.classification.confidence ?? 0) - (a.classification.confidence ?? 0);
      if (sortBy === "opportunity") return (b.score.opportunity ?? 0) - (a.score.opportunity ?? 0);
      if (sortBy === "risk") return (a.score.risk ?? 0) - (b.score.risk ?? 0);
      if (sortBy === "fit") return (b.fit?.fitScore ?? 0) - (a.fit?.fitScore ?? 0);
      return (b.score.value ?? 0) - (a.score.value ?? 0);
    });
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
  }, [filteredLeads, sortBy, stableOrder]);

  const LEADS_PER_BATCH = 20;
  const [displayCount, setDisplayCount] = useState(LEADS_PER_BATCH);
  // Only reset displayCount when the user runs a new search (niche+location changes),
  // NOT when background expansion silently adds more leads to the existing list.
  const searchKey = `${niche}::${location}`;
  useEffect(() => {
    setDisplayCount(LEADS_PER_BATCH);
  }, [searchKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const visibleLeads = useMemo(() => sortedLeads.slice(0, displayCount), [sortedLeads, displayCount]);
  // Show more locally if available, otherwise need API fetch
  const hasMoreLocal = displayCount < sortedLeads.length;
  const hasMoreRemote = !exhausted && nextCursor !== null && runId !== null;
  const hasMore = hasMoreLocal || hasMoreRemote;

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
    } catch {
      /* ignore */
    }
  };

  const selectedOutcome = useMemo(() => {
    if (!selectedLead) return null;
    return outcomesByLeadId[selectedLead.id] ?? null;
  }, [outcomesByLeadId, selectedLead]);

  // ── Modal-level derived variables ────────────────────────────────────────
  // Defined after selectedOutcome and enrichmentData so they're in scope.
  const detailLead = selectedLead;
  const safeOutreach = detailLead?.metadata?.outreach ?? null;
  const safeEnrichment = enrichmentData;
  const runIdNum = Number(detailLead?.metadata?.runId ?? 0);
  const contacted = selectedOutcome?.contacted ?? false;
  const replied = selectedOutcome?.replied ?? false;
  const bookedCall = selectedOutcome?.booked_call ?? false;
  const closed = selectedOutcome?.closed ?? false;
  const detailInsight = detailLead ? getLocalizedOpportunityInsight(detailLead as LeadUI, language) : null;
  const detailWebsiteUrl = detailLead?.company.website ?? undefined;
  const enrichmentSignals = safeEnrichment?.signals ?? {};
  const detectedPlatforms: string[] = safeEnrichment?.signals
    ? (Object.values(safeEnrichment.signals) as Array<{ category?: string; present?: boolean; label?: string }>)
        .filter((s) => s.category === "social" && s.present === true)
        .map((s) => s.label ?? "")
    : [];
  const isReachable = safeEnrichment?.reachable ?? false;
  const angleTitle = safeOutreach?.angleTitle ?? "";
  const angleWhy = safeOutreach?.angleWhy ?? "";

  // =====================
  // EFFECTS
  // =====================

  // Smooth rescoring transition — show "Analyzing…" for 1.5s on lead select
  useEffect(() => {
    if (!selectedLead) {
      setIsRescoring(false);
      return;
    }
    setIsRescoring(true);
    const t = setTimeout(() => setIsRescoring(false), 1500);
    return () => clearTimeout(t);
  }, [selectedLead?.id]);

  useEffect(() => {
    if (!selectedLead?.metadata?.outreach) return;

    const dv = selectedLead.metadata.outreach.defaultVariant;
    setOutreachVariant(
      (["soft", "consultative", "direct", "bold"].includes(dv ?? "") ? dv : "consultative") as OutreachVariant,
    );
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

  // Restore persisted deep enrichment when a lead is selected
  useEffect(() => {
    if (!selectedLead) return;
    const sourceId = selectedLead.sourceId;
    if (!sourceId) return;

    (async () => {
      try {
        const res = await fetch(`/api/deep-enrichment?sourceId=${encodeURIComponent(sourceId)}`);
        if (!res.ok) return;
        const { data } = (await res.json()) as {
          data: {
            scan_result: {
              deepScore: number;
              pageReachable: boolean;
              website: { scores: Record<string, number>; summary: string; signalCount: number };
              market: {
                scores: Record<string, number>;
                competitorSummary: string;
                recommendation: string;
                signalCount: number;
              };
              brand: {
                scores: Record<string, number>;
                brandGrade: string;
                weakestArea: string;
                strengthArea: string;
                signalCount: number;
              };
            };
            derived_signals: {
              hasBookingCta: boolean | null;
              hasClearOffer: boolean | null;
              isMobileFriendly: boolean | null;
              websiteReachable: boolean;
            };
            scanned_at: string;
          } | null;
        };
        if (!data?.scan_result) return;

        // Restore display state
        setDeepScanData({ ...data.scan_result, scannedAt: data.scanned_at, isFromCache: true });

        // Rescore the lead with the persisted deep signals so outreach tab is accurate
        const rescored = applyDeepScanToLead(selectedLead, data.scan_result, data.derived_signals);
        if (rescored.score.value !== selectedLead.score.value) {
          setLeads((prev: LeadUI[]) => prev.map((l: LeadUI) => (l.id === selectedLead.id ? rescored : l)));
          setSelectedLead(rescored);
        }
      } catch {
        // fail soft — no deep enrichment cached
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLead?.id]);

  useEffect(() => {
    if (!selectedLead) {
      setSequenceSteps([]);
      return;
    }
    setSequenceLoading(true);
    fetch(`/api/sequences?leadId=${encodeURIComponent(selectedLead.id)}`)
      .then((r) => (r.ok ? r.json() : { steps: [] }))
      .then((d: { steps?: unknown[] }) => {
        setSequenceSteps((d.steps ?? []) as typeof sequenceSteps);
      })
      .catch(() => setSequenceSteps([]))
      .finally(() => setSequenceLoading(false));
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
    const classificationConfidence = selectedLead.classification.confidence ?? null;
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
          // Append enrichment context to existing tooltips rather than replacing them.
          // This preserves the original explanation and adds what light enrichment learned.
          const signals = data.signals?.byKey ?? {};
          const enrichmentSignals = {
            hasBookingCta: (signals["website_has_booking_cta"]?.value as boolean | null) ?? null,
            hasClearOffer: (signals["website_has_clear_offer"]?.value as boolean | null) ?? null,
            socialPlatformCount: (signals["social_platform_count"]?.value as number) ?? 0,
          };

          // Build enrichment addendum for dimensions whose score didn't change
          const enrichedLead = leads.find((l: LeadUI) => l.id === leadId);
          const hasWebsite = !!enrichedLead?.company.website;
          const addendumParts: string[] = [];
          if (!hasWebsite) {
            addendumParts.push("no website found — any web-based signals are unavailable");
          } else {
            if (enrichmentSignals.hasBookingCta === false) addendumParts.push("no booking CTA found on their website");
            if (enrichmentSignals.hasClearOffer === false)
              addendumParts.push("their offer isn't clearly presented on their site");
          }
          if (enrichmentSignals.socialPlatformCount === 0)
            addendumParts.push("no social platforms linked from their site");
          else if (enrichmentSignals.socialPlatformCount >= 2)
            addendumParts.push(`${enrichmentSignals.socialPlatformCount} social platforms detected`);
          const addendum =
            addendumParts.length > 0
              ? `
Light enrichment: ${addendumParts.join(", ")}.`
              : "";

          // Tooltip merge: if score changed → fresh tooltip (matches new score).
          // If score stayed the same → keep original and append enrichment context.
          const mergeTooltips = (
            existingScore: LeadUI["score"],
            freshScore: LeadUI["score"],
          ): LeadUI["score"]["tooltips"] => {
            const existing = existingScore.tooltips;
            const fresh = freshScore.tooltips;
            if (!existing || !fresh) return fresh;

            const resolve = (
              key: keyof NonNullable<LeadUI["score"]["tooltips"]>,
              oldVal: number,
              newVal: number,
            ): string => {
              if (oldVal !== newVal) return fresh[key] ?? ""; // score changed → use fresh tooltip
              const base = existing[key] ?? "";
              return addendum ? `${base}${addendum}` : base; // same score → append context
            };

            return {
              value: resolve("value", existingScore.value ?? 0, freshScore.value ?? 0),
              opportunity: resolve("opportunity", existingScore.opportunity ?? 0, freshScore.opportunity ?? 0),
              fit: resolve("fit", existingScore.value ?? 0, freshScore.value ?? 0),
              risk: resolve("risk", existingScore.risk ?? 0, freshScore.risk ?? 0),
              readiness: resolve("readiness", existingScore.readiness ?? 0, freshScore.readiness ?? 0),
            };
          };

          setLeads((prev: LeadUI[]) =>
            prev.map((l: LeadUI) => {
              if (l.id !== leadId) return l;
              return {
                ...l,
                score: {
                  ...data.updatedScore,
                  tooltips: mergeTooltips(l.score, data.updatedScore),
                },
              };
            }),
          );
          setSelectedLead((prev: LeadUI | null) => {
            if (prev?.id !== leadId) return prev;
            return {
              ...prev,
              score: {
                ...data.updatedScore,
                tooltips: mergeTooltips(prev.score, data.updatedScore),
              },
            };
          });
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
      // Only restore the dismiss preference — NOT hasSearched/hasSelected/hasOutcome.
      // Those are derived from real data (Supabase searches + session actions)
      // to prevent stale state from a previous session appearing on fresh accounts.
      const storedUid = (parsed as { userId?: string }).userId ?? "";
      const currentUid = localStorage.getItem("vantio_uid") ?? "";
      if (storedUid && currentUid && storedUid === currentUid) {
        if (parsed.checklistDismissed) setChecklistDismissed(true);
      } else if (!storedUid) {
        // Legacy state without userId — still respect dismiss, ignore progress
        if (parsed.checklistDismissed) setChecklistDismissed(true);
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
        // Derive hasSearched from real Supabase data — not localStorage
        if (searches.length > 0) {
          setChecklistState((prev: typeof checklistState) => ({ ...prev, hasSearched: true }));
        }
        // Pre-fill from most recent search if fields are still empty
        if (searches.length > 0) {
          const latest = searches[0];
          setNiche((prev: string) => (prev === "" && latest.niche ? latest.niche : prev));
          setLocation((prev: string) => (prev === "" && latest.location ? latest.location : prev));
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
  const [checklistState, setChecklistState] = useState({
    hasProfile: false,
    hasSearched: false,
    hasSelected: false,
    hasOutcome: false,
  });
  const [profileChecked, setProfileChecked] = useState(false); // true once profile API has responded

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((data: { profile?: { targetLocation?: string; businessName?: string }; userId?: string }) => {
        const geo = data?.profile?.targetLocation;
        if (geo && typeof geo === "string") {
          setLocation((prev: string) => (prev === "" ? geo : prev));
        }
        const hasProfile = !!data?.profile?.businessName;
        // Store current user ID so checklist state can be user-scoped
        const supabaseForUid = createSupabaseBrowser();
        supabaseForUid.auth
          .getUser()
          .then(({ data: authData }) => {
            if (authData.user?.id) {
              try {
                localStorage.setItem("vantio_uid", authData.user.id);
              } catch {
                /* ignore */
              }
            }
          })
          .catch(() => {});
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
          userId: typeof window !== "undefined" ? (localStorage.getItem("vantio_uid") ?? "") : "",
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
  }, [
    language,
    niche,
    location,
    socialPresence,
    checklistDismissed,
    checklistState.hasSearched,
    checklistState.hasSelected,
    checklistState.hasOutcome,
  ]);

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
      .map((row) => row.map((field: string | number) => `"${String(field).replace(/"/g, '""')}"`).join(","))
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
    if (!niche.trim() || !location.trim()) return;
    setIsLoading(true);
    setSearchError(null);
    setLeads([]);
    setSelectedLead(null);
    setHasSearched(true);
    setChecklistState((prev: typeof checklistState) => ({ ...prev, hasSearched: true }));
    // Smooth progress — increments 1% every 300ms, reaching ~100% over 30s.
    // Caps at 98% so it never falsely completes before the server responds.
    const LABELS: Record<number, string> = {
      0: "Planning your search…",
      20: "Searching Google Maps…",
      40: "AI scanning directories and review sites…",
      65: "Aggregating results…",
      80: "Scoring leads…",
      92: "Almost ready…",
    };
    let currentPct = 0;
    setSearchProgress({ pct: 0, label: LABELS[0] });
    const progressTimer = setInterval(() => {
      currentPct = Math.min(currentPct + 1, 98);
      const label =
        Object.entries(LABELS)
          .filter(([threshold]) => currentPct >= Number(threshold))
          .pop()?.[1] ?? "Searching…";
      setSearchProgress({ pct: currentPct, label });
    }, 600); // 1% per 600ms = 100% in 60s

    try {
      const discoverRes = await fetch("/api/search/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          niche,
          city: location,
          country: "Sweden",
          language: language === "sv" ? "sv" : "en",
          socialPresence,
        }),
      }).catch(() => null);

      clearInterval(progressTimer);
      setSearchProgress({ pct: 94, label: "Loading results…" });

      if (!discoverRes?.ok) throw new Error("Discovery search failed — please try again.");
      const discoverData = (await discoverRes.json()) as {
        ok: boolean;
        runIds: number[];
        primaryRunId: number | null;
        error?: string;
      };

      // Log what we got back for debugging
      console.log("[search] discover response:", discoverData);

      if (!discoverData.ok || !discoverData.primaryRunId || discoverData.runIds.length === 0) {
        toastInfo("No leads found — try a different niche or location");
        return;
      }

      // Fetch scored leads from all runs
      const allLeadResults = await Promise.allSettled(
        discoverData.runIds.map(async (rid) => {
          const res = await fetch(
            `/api/providers/runs/${rid}/leads?location=${encodeURIComponent(location)}&niche=${encodeURIComponent(niche)}`,
          ).catch(() => null);
          if (!res?.ok) return [] as LeadUI[];
          const data = (await res.json().catch(() => ({}))) as RunLeadsResponse;
          return Array.isArray(data?.leads) ? (data.leads as LeadUI[]) : [];
        }),
      );

      const allLeads: LeadUI[] = [];
      for (const r of allLeadResults) {
        if (r.status === "fulfilled") allLeads.push(...r.value);
      }

      setSearchProgress({ pct: 99, label: "Almost ready…" });
      const deduped = dedupeLeads(allLeads);
      await new Promise((r) => setTimeout(r, 300));

      setLeads(deduped);
      setStableOrder(new Map(deduped.map((l: LeadUI, i: number) => [l.id, i])));
      setRunId(discoverData.primaryRunId);
      setNextCursor(null);
      setExhausted(true);
      setChecklistState((prev: typeof checklistState) => ({ ...prev, hasSearched: true }));

      if (deduped.length > 0) {
        toastSuccess(`Found ${deduped.length} lead${deduped.length !== 1 ? "s" : ""}`);
      } else {
        toastInfo("No leads found — try a different niche or location");
      }
    } catch (error) {
      clearInterval(progressTimer);
      console.error("Error fetching leads:", error);
      setLeads([]);
      const msg = error instanceof Error ? error.message : "Something went wrong. Please try again.";
      setSearchError(msg);
      toastError(msg);
    } finally {
      setIsLoading(false);
      setSearchProgress(null);
    }
  };

  // =====================
  // RENDER
  // =====================

  // ── CSV EXPORT ─────────────────────────────────────────────
  function exportCSV() {
    const rows: string[][] = [
      [
        "Company",
        "Website",
        "City",
        "Country",
        "Industry",
        "Sub-niche",
        "Score",
        "Fit",
        "Opportunity",
        "Readiness",
        "Risk",
        "Risk Profile",
        "Social Presence",
        "Rating",
        "Reviews",
        "Gap Type",
        "Seller Type",
        "Contacted",
        "Replied",
        "Call Booked",
        "Closed",
        "Revenue",
        "Notes",
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

    const csv = rows.map((r) => r.map((cell) => `"${cell}"`).join(",")).join("\n");

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
    <>
      {searchProgress && <SearchProgressOverlay pct={searchProgress.pct} label={searchProgress.label} />}
      <main className="min-h-screen bg-[#080808] text-[#f5f0e8] flex flex-col items-center px-4">
        {/* Nav */}
        <nav className="sticky top-0 z-50 w-full border-b border-[#1a1a1a] bg-[#080808]/95 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/" className="flex items-center gap-2">
                <span className="text-[#c9a84c] text-sm">◈</span>
                <span
                  className="text-[15px] font-light tracking-wide"
                  style={{ fontFamily: "var(--font-display), serif" }}>
                  Van
                  <span
                    style={{
                      background: "linear-gradient(135deg,#e8c97a,#c9a84c)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                    }}>
                    tio
                  </span>
                </span>
                <span className="text-[9px] tracking-[0.18em] uppercase px-1.5 py-0.5 rounded border border-[rgba(201,168,76,0.25)] text-[#8a6e30]">
                  Beta
                </span>
              </Link>
              <div className="h-4 w-px bg-[#1e1e1e]" />
              <span className="text-[10px] tracking-[0.18em] uppercase text-[#616161] font-mono">Lead Scanner</span>
            </div>
            <div className="flex items-center gap-2">
              <NotificationBell />
              <HamburgerMenu hasProfile={true} userEmail={userEmail} />
            </div>
          </div>
        </nav>

        <div className="w-full max-w-7xl space-y-6 py-8">
          {/* Getting Started — fixed left-edge tab + slide-in panel, never conflicts with z-index */}
          {!checklistDismissed &&
            !(
              checklistState.hasProfile &&
              checklistState.hasSearched &&
              checklistState.hasSelected &&
              checklistState.hasOutcome
            ) && <GettingStartedPanel checklistState={checklistState} onDismiss={() => setChecklistDismissed(true)} />}

          {recentSearches.length > 0 && (
            <section className="bg-[#111111] border border-[#252525] rounded-2xl p-4 md:p-5 shadow-xl shadow-black/40 space-y-3 relative z-0">
              {/* Profile completeness warning banner — only after profile API responds to prevent flicker */}
              {profileChecked && !checklistState.hasProfile && (
                <div className="flex items-center justify-between gap-4 rounded-xl border border-[#c9a84c]/20 bg-[#c9a84c]/04 px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-[#c9a84c] text-base flex-shrink-0">⚠</span>
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-[#c9a84c] leading-tight">
                        {t.ui.profileBanner.title}
                      </p>
                      <p className="text-[11px] text-[#999999] mt-0.5 leading-snug">{t.ui.profileBanner.body}</p>
                    </div>
                  </div>
                  <a
                    href="/profile/settings"
                    className="flex-shrink-0 text-[11px] px-3 py-1.5 rounded-lg border border-[rgba(201,168,76,0.3)] text-[#c9a84c] hover:bg-[rgba(201,168,76,0.08)] transition-all whitespace-nowrap">
                    {t.ui.profileBanner.cta}
                  </a>
                </div>
              )}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-[#f5f0e8]">{t.ui.savedSearches.title}</h2>
                  <p className="text-[11px] text-[#8a8a8a] mt-0.5">{t.ui.savedSearches.subtitle}</p>
                </div>
                <div className="flex items-center gap-2">
                  {isLoadingHistory && <span className="text-[11px] text-[#8a8a8a] animate-pulse">Updating…</span>}
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
                        onClick={() => {
                          setSaveSearchName("");
                          setShowSaveSearchInput(false);
                        }}
                        className="text-[11px] text-[#8a8a8a] hover:text-[#bababa] px-1">
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowSaveSearchInput(true)}
                      className="text-[10px] px-2.5 py-1 rounded-lg border border-[rgba(201,168,76,0.25)] text-[#c9a84c] hover:bg-[rgba(201,168,76,0.06)] transition-all tracking-wide">
                      {t.ui.savedSearches.saveCurrent}
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {recentSearches.map((s: SearchRecord) => {
                  const date = new Date(s.created_at);
                  const dateStr = date.toLocaleDateString(language === "sv" ? "sv-SE" : "en-GB", {
                    day: "numeric",
                    month: "short",
                  });
                  const timeStr = date.toLocaleTimeString(language === "sv" ? "sv-SE" : "en-GB", {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setNiche(s.niche || "");
                        setLocation(s.location || "");
                        setSocialPresence(
                          (s.social_presence === "low" || s.social_presence === "medium" || s.social_presence === "high"
                            ? s.social_presence
                            : "") as SocialPresenceFilter,
                        );
                      }}
                      className="text-left rounded-xl border border-[#1a1a1a] bg-[#0d0d0d] hover:border-[rgba(201,168,76,0.3)] hover:bg-[#111] transition-all p-3 space-y-2 group">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <p className="text-[13px] font-semibold text-[#f5f0e8] truncate group-hover:text-[#e8c97a] transition-colors">
                            {s.niche || "—"}
                          </p>
                          <p className="text-[11px] text-[#8a8a8a] truncate mt-0.5">{s.location || "Any location"}</p>
                        </div>
                        <span className="flex-shrink-0 text-[#c9a84c] text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                          ↺
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        {s.social_presence && s.social_presence !== "" && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded border border-[#252525] text-[#8a8a8a] capitalize">
                            {s.social_presence} social
                          </span>
                        )}
                        <span className="text-[10px] text-[#616161] ml-auto">
                          {dateStr} · {timeStr}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Search command interface */}
          {profileChecked && !checklistState.hasProfile && recentSearches.length === 0 && (
            <div className="flex items-center justify-between gap-4 rounded-xl border border-[rgba(201,168,76,0.2)] bg-[rgba(201,168,76,0.04)] px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-[#c9a84c] flex-shrink-0">⚠</span>
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold text-[#c9a84c] leading-tight">{t.ui.profileBanner.title}</p>
                  <p className="text-[11px] text-[#999999] mt-0.5">{t.ui.profileBanner.body}</p>
                </div>
              </div>
              <a
                href="/profile/settings"
                className="flex-shrink-0 text-[11px] px-3 py-1.5 rounded-lg border border-[rgba(201,168,76,0.3)] text-[#c9a84c] hover:bg-[rgba(201,168,76,0.08)] transition-all whitespace-nowrap">
                {t.ui.profileBanner.cta}
              </a>
            </div>
          )}
          <section
            className="rounded-2xl overflow-hidden border border-[#1e1e1e] bg-[#0d0d0d]"
            style={{ boxShadow: "0 0 60px rgba(0,0,0,0.5)" }}>
            <div
              style={{
                height: 1,
                background: "linear-gradient(90deg,transparent,rgba(201,168,76,0.5) 50%,transparent)",
              }}
            />
            <div className="p-6 md:p-8">
              <div className="flex items-center gap-3 mb-5">
                <span
                  className="text-[#8a6e30] font-mono"
                  style={{ fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase" }}>
                  ◈ Lead Scanner
                </span>
                <span
                  className="block rounded-full bg-[#4ade80]"
                  style={{ width: 5, height: 5, boxShadow: "0 0 6px rgba(74,222,128,0.6)" }}
                />
                <span
                  className="text-[#4ade80] font-mono"
                  style={{ fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase" }}>
                  AI-Powered
                </span>
              </div>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1 relative">
                    <span
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#555] pointer-events-none select-none"
                      style={{ fontSize: 15 }}>
                      ⌕
                    </span>
                    <input
                      type="text"
                      value={niche}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setNiche(e.target.value)}
                      onFocus={() => setShowNicheDropdown(true)}
                      onBlur={() => setTimeout(() => setShowNicheDropdown(false), 150)}
                      placeholder="Niche or industry — e.g. tattoo studio, frisör"
                      className="w-full rounded-xl border border-[#262626] bg-[#0a0a0a] pl-9 pr-3 py-3.5 text-[13px] text-[#f0ebe3] placeholder-[#3a3a3a] focus:outline-none focus:border-[rgba(201,168,76,0.4)] transition-colors"
                    />
                    {showNicheDropdown && recentSearches.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-xl border border-[#252525] bg-[#111] shadow-xl overflow-hidden">
                        <p className="text-[10px] uppercase tracking-widest text-[#737373] px-3 pt-2.5 pb-1">Recent</p>
                        {recentSearches.slice(0, 5).map((s: SearchRecord, i: number) => (
                          <button
                            key={i}
                            type="button"
                            onMouseDown={() => {
                              setNiche(s.niche || "");
                              setLocation(s.location || "");
                              setShowNicheDropdown(false);
                            }}
                            className="w-full text-left px-3 py-2 text-[12px] text-[#bababa] hover:bg-[#1a1a1a] transition-colors flex items-center justify-between">
                            <span>{s.niche || "—"}</span>
                            <span className="text-[#616161]">{s.location || ""}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="sm:w-[200px] relative">
                    <span
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#555] pointer-events-none select-none"
                      style={{ fontSize: 14 }}>
                      ⌖
                    </span>
                    <input
                      type="text"
                      value={location}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setLocation(e.target.value)}
                      onFocus={() => setShowLocationDropdown(true)}
                      onBlur={() => setTimeout(() => setShowLocationDropdown(false), 150)}
                      placeholder="City"
                      className="w-full rounded-xl border border-[#262626] bg-[#0a0a0a] pl-9 pr-3 py-3.5 text-[13px] text-[#f0ebe3] placeholder-[#3a3a3a] focus:outline-none focus:border-[rgba(201,168,76,0.4)] transition-colors"
                    />
                    {showLocationDropdown && recentSearches.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-xl border border-[#252525] bg-[#111] shadow-xl overflow-hidden">
                        <p className="text-[10px] uppercase tracking-widest text-[#737373] px-3 pt-2.5 pb-1">Recent</p>
                        {recentSearches.slice(0, 5).map((s: SearchRecord, i: number) => (
                          <button
                            key={i}
                            type="button"
                            onMouseDown={() => {
                              setNiche(s.niche || "");
                              setLocation(s.location || "");
                              setShowLocationDropdown(false);
                            }}
                            className="w-full text-left px-3 py-2 text-[12px] text-[#bababa] hover:bg-[#1a1a1a] transition-colors flex items-center justify-between">
                            <span>{s.location || "—"}</span>
                            <span className="text-[#616161]">{s.niche || ""}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className={`rounded-xl px-7 py-3.5 text-[13px] font-bold tracking-wide transition-all whitespace-nowrap ${isLoading ? "bg-[rgba(201,168,76,0.06)] text-[#555] cursor-not-allowed" : "bg-[#c9a84c] text-[#080808] hover:bg-[#e8c97a]"}`}>
                    {isLoading ? "Scanning…" : "Scan Market →"}
                  </button>
                </div>
                <p className="text-[#3a3a3a] font-mono" style={{ fontSize: 10, letterSpacing: "0.05em" }}>
                  Multi-source AI discovery · Google Maps · Business directories · Review platforms
                </p>
              </form>
            </div>
          </section>

          <section
            className="rounded-2xl overflow-hidden border border-[#1a1a1a] bg-[#0d0d0d]"
            style={{ boxShadow: "0 0 40px rgba(0,0,0,0.4)" }}>
            <div
              style={{
                height: 1,
                background: "linear-gradient(90deg,transparent,rgba(201,168,76,0.15) 50%,transparent)",
              }}
            />
            <div className="p-6 md:p-8 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5 mb-1">
                    <span
                      className="text-[#555] font-mono"
                      style={{ fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase" }}>
                      Intelligence Report
                    </span>
                    {sortedLeads.length > 0 && (
                      <span
                        className="text-[#c9a84c] font-mono font-bold"
                        style={{
                          fontSize: 9,
                          padding: "2px 6px",
                          borderRadius: 4,
                          background: "rgba(201,168,76,0.1)",
                        }}>
                        {sortedLeads.length} leads
                      </span>
                    )}
                  </div>
                  <h2 className="text-lg font-semibold text-[#f5f0e8]">{t.ui.results.title}</h2>

                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <label className="flex items-center gap-2 text-xs text-[#c4c0b8]">
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

                    <label className="flex items-center gap-2 text-xs text-[#c4c0b8]">
                      {t.ui.results.sortBy}
                      <select
                        value={sortBy}
                        onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                          setSortBy(e.target.value as "score" | "opportunity" | "risk" | "confidence" | "fit")
                        }
                        className="rounded-md bg-[#111111] border border-[#2a2a2a] px-2 py-1">
                        <option value="score">{t.ui.results.sortOptions.score}</option>
                        <option value="opportunity">{t.ui.results.sortOptions.opportunity}</option>
                        <option value="risk">{t.ui.results.sortOptions.risk}</option>
                        <option value="confidence">{t.ui.results.sortOptions.confidence}</option>
                        <option value="fit">{t.ui.results.sortOptions.fit}</option>
                      </select>
                    </label>

                    <label className="flex items-center gap-2 text-xs text-[#c4c0b8]">
                      Website
                      <select
                        value={filterHasWebsite}
                        onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                          setFilterHasWebsite(e.target.value as "any" | "yes" | "no")
                        }
                        className="rounded-md bg-[#111111] border border-[#2a2a2a] px-2 py-1">
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
                        className="text-[11px] px-3 py-1.5 rounded-md border border-[rgba(201,168,76,0.3)] text-[#c9a84c] hover:bg-[rgba(201,168,76,0.08)] transition-colors flex items-center gap-1.5 whitespace-nowrap">
                        ↓ Export CSV
                      </button>
                    )}
                  </div>
                </div>
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
                      <p className="text-[12px] text-[#bababa] leading-relaxed">{searchError}</p>
                      <p className="text-[11px] text-[#8a8a8a]">
                        Check your API key configuration or try a different search.
                      </p>
                    </div>
                  )}

                  {/* Loading state */}
                  {isLoading && !searchError && (
                    <div className="flex flex-col items-center gap-4 py-8">
                      <div className="w-6 h-6 rounded-full border-2 border-[#c9a84c] border-t-transparent animate-spin" />
                      <p className="text-[13px] text-[#8a8a8a]">Scanning leads and scoring…</p>
                    </div>
                  )}

                  {/* Empty after search */}
                  {!isLoading && !searchError && hasSearched && leads.length === 0 && (
                    <div className="flex flex-col items-center gap-3 py-10 text-center">
                      <span className="text-3xl text-[#616161]">◈</span>
                      <p className="text-[14px] text-[#bababa] font-medium">No leads found for this search</p>
                      <p className="text-[12px] text-[#8a8a8a] max-w-sm leading-relaxed">
                        Try broadening your niche, removing the location, or lowering the minimum score filter.
                      </p>
                    </div>
                  )}

                  {/* Empty after filter */}
                  {!isLoading && !searchError && hasSearched && leads.length > 0 && sortedLeads.length === 0 && (
                    <div className="flex flex-col items-center gap-3 py-10 text-center">
                      <span className="text-3xl text-[#616161]">◇</span>
                      <p className="text-[14px] text-[#bababa] font-medium">All leads filtered out</p>
                      <p className="text-[12px] text-[#8a8a8a] max-w-sm leading-relaxed">
                        {leads.length} lead{leads.length !== 1 ? "s" : ""} found but none pass the current filters.
                        Lower the minimum score or clear the search query.
                      </p>
                    </div>
                  )}

                  {/* Pre-search prompt */}
                  {!isLoading && !searchError && !hasSearched && (
                    <div className="flex flex-col items-center gap-3 py-10 text-center">
                      <span className="text-3xl text-[#252525]">◈</span>
                      <p className="text-[13px] text-[#8a8a8a]">
                        {t.ui.results.empty}
                        <span className="font-semibold text-[#bababa]"> &quot;Generate Leads&quot;</span>.
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
                          <button
                            type="button"
                            onClick={() => {
                              setCompareIds([...bulkSelected]);
                              setCompareMode(true);
                            }}
                            className="text-[11px] px-3 py-1.5 rounded-lg border border-[#818cf8]/30 text-[#818cf8] hover:bg-[rgba(129,140,248,0.08)] transition-all">
                            ⊡ Compare
                          </button>
                        )}
                        {(["contacted", "replied", "booked"] as const).map((action) => (
                          <button
                            key={action}
                            type="button"
                            onClick={async () => {
                              setBulkAction(action);
                              const activeRunId = sortedLeads.find((l: LeadUI) => bulkSelected.has(l.id))?.metadata
                                ?.runId;
                              await Promise.all(
                                [...bulkSelected].map((id) =>
                                  fetch("/api/outcomes", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ leadId: id, runId: activeRunId ?? 0, [action]: true }),
                                  }),
                                ),
                              );
                              setBulkSelected(new Set());
                              setBulkAction(null);
                              toastSuccess(`Marked ${bulkSelected.size} leads as ${action}`);
                            }}
                            className="text-[11px] px-3 py-1.5 rounded-lg border border-[#c9a84c]/25 text-[#c9a84c] hover:bg-[rgba(201,168,76,0.1)] transition-all capitalize">
                            Mark {action}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => setBulkSelected(new Set())}
                          className="text-[11px] px-3 py-1.5 rounded-lg border border-[#252525] text-[#8a8a8a] hover:border-[#444] transition-all">
                          Clear
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ── LEADS TABLE (desktop) / CARDS (mobile) ── */}

                  {/* MOBILE CARD LIST */}
                  <div className="flex flex-col gap-2 sm:hidden">
                    {visibleLeads.map((lead) => {
                      const isSelected = selectedLead?.id === lead.id;
                      const insight = getLocalizedOpportunityInsight(lead, language);
                      const gapLabel =
                        insight?.type === "conversion_gap"
                          ? t.ui.detail.whyNoBookingFlow
                          : insight?.type === "visibility_gap"
                            ? t.ui.detail.whyLowDigital
                            : insight?.type === "foundation_gap"
                              ? t.ui.detail.whyMissingInfra
                              : insight?.type === "mature_competitor"
                                ? t.ui.detail.whyAlreadyEstablished
                                : lead.score.riskProfile === "early_stage" || lead.score.riskProfile === "limited_data"
                                  ? t.ui.detail.whyUnstableSignals
                                  : (lead.score.value ?? 0) >= 80
                                    ? t.ui.detail.whyTopTier
                                    : (lead.score.value ?? 0) >= 60
                                      ? t.ui.detail.whyGoodValueFit
                                      : t.ui.detail.whyLowPriority;
                      const scoreColor =
                        (lead.score.value ?? 0) >= 80 ? "#4ade80" : (lead.score.value ?? 0) >= 60 ? "#c9a84c" : "#888";
                      const fitColor =
                        (lead.fit?.fitScore ?? 0) >= 65
                          ? "#4ade80"
                          : (lead.fit?.fitScore ?? 0) >= 40
                            ? "#c9a84c"
                            : "#f87171";
                      const riskColor =
                        (lead.score.risk ?? 0) >= 70 ? "#f87171" : (lead.score.risk ?? 0) >= 40 ? "#c9a84c" : "#4ade80";
                      return (
                        <div
                          key={lead.id}
                          onClick={() => {
                            setSelectedLead(lead);
                            setChecklistState((prev: typeof checklistState) => ({ ...prev, hasSelected: true }));
                          }}
                          className={
                            "rounded-xl border cursor-pointer transition-colors p-3 " +
                            (isSelected
                              ? "border-[rgba(201,168,76,0.4)] bg-[#111]"
                              : "border-[#1e1e1e] bg-[#0d0d0d] hover:border-[#2a2a2a] hover:bg-[#111]")
                          }>
                          {/* Row 1: name + score badge */}
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="min-w-0">
                              <p className="font-medium text-[13px] truncate">{lead.company.name}</p>
                              <p className="text-[10px] text-[#8a8a8a] mt-0.5 truncate">
                                {leadLocation(lead)} · {lead.classification.primaryIndustry.replaceAll("_", " ")}
                              </p>
                            </div>
                            <span
                              className="text-[12px] font-bold shrink-0 px-2 py-0.5 rounded-md"
                              style={{
                                color: scoreColor,
                                background: `${scoreColor}18`,
                                border: `1px solid ${scoreColor}30`,
                              }}>
                              {lead.score.value ?? 0}
                            </span>
                          </div>
                          {/* Row 2: score metrics grid */}
                          <div className="grid grid-cols-3 gap-1.5 mb-2">
                            {[
                              { label: "Fit", value: lead.fit?.fitScore ?? 0, color: fitColor },
                              { label: "Opportunity", value: lead.score.opportunity ?? 0, color: "#818cf8" },
                              { label: "Risk", value: lead.score.risk ?? 0, color: riskColor },
                            ].map((m) => (
                              <div
                                key={m.label}
                                className="rounded-lg bg-[#111] border border-[#1a1a1a] px-2 py-1.5 text-center">
                                <p className="text-[11px] font-bold" style={{ color: m.color }}>
                                  {m.value}
                                </p>
                                <p className="text-[9px] text-[#737373] uppercase tracking-wide">{m.label}</p>
                              </div>
                            ))}
                          </div>
                          {/* Row 3: insight */}
                          <p className="text-[10px] text-[#8a8a8a] leading-snug">⚡ {gapLabel}</p>
                        </div>
                      );
                    })}
                  </div>

                  {/* DESKTOP TABLE — hidden on mobile except when a lead is selected */}
                  <div className="block overflow-x-hidden">
                    <table className="w-full text-sm border-collapse">
                      <thead className="hidden sm:table-header-group">
                        <tr className="bg-[#111111] border-b border-[#252525]">
                          <th className="py-2 px-3 w-[32px]" />
                          <th className="text-left py-2 px-3 w-[35%]">{t.ui.table.company}</th>
                          <th className="text-left py-2 px-3 w-[10%]">Fit</th>
                          <th className="text-left py-2 px-3 w-[13%]">{t.ui.table.opportunity}</th>
                          <th className="text-left py-2 px-3 w-[10%]">Difficulty</th>
                          <th className="text-left py-2 px-3">Lead Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleLeads.map((lead: LeadUI) => {
                          const isSelected = selectedLead?.id === lead.id;
                          const mainInsight = getLocalizedOpportunityInsight(lead, language);
                          const mainOpp = Number.isFinite(lead.score.opportunity)
                            ? (lead.score.opportunity as number)
                            : 0;

                          return (
                            <Fragment key={lead.id}>
                              <tr
                                onClick={() => {
                                  setSelectedLead(lead);
                                  setChecklistState((prev: typeof checklistState) => ({ ...prev, hasSelected: true }));
                                }}
                                className={
                                  "border-b border-[#252525] hover:bg-[#111111]/70 cursor-pointer " +
                                  (isSelected ? "bg-[#111111]/90" : "") +
                                  " hidden sm:table-row"
                                }>
                                <td className="py-2 pl-3 pr-1 w-6">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setBulkSelected((prev) => {
                                        const next = new Set(prev);
                                        if (next.has(lead.id)) next.delete(lead.id);
                                        else next.add(lead.id);
                                        return next;
                                      });
                                    }}
                                    className="flex items-center justify-center w-4 h-4 focus:outline-none"
                                    title="Select lead">
                                    {/* Diamond shape — rotated square */}
                                    <span
                                      className="block w-3 h-3 rotate-45 border transition-all duration-150"
                                      style={
                                        bulkSelected.has(lead.id)
                                          ? {
                                              backgroundColor: "#c9a84c",
                                              borderColor: "#c9a84c",
                                              boxShadow: "0 0 6px rgba(201,168,76,0.4)",
                                            }
                                          : {
                                              backgroundColor: "transparent",
                                              borderColor: "#2a2a2a",
                                            }
                                      }
                                    />
                                  </button>
                                </td>
                                <td className="py-2 px-3">
                                  <div>
                                    <span className="font-medium text-[13px] truncate max-w-[140px] sm:max-w-none block">
                                      {lead.company.name}
                                    </span>
                                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                      <span className="text-[10px] text-[#8a8a8a]">{leadLocation(lead)}</span>
                                      <span className="text-[10px] text-[#737373]">·</span>
                                      <span className="text-[10px] text-[#8a8a8a]">
                                        {lead.classification.primaryIndustry.replaceAll("_", " ")}
                                      </span>
                                      {lead.company.website && (
                                        <a
                                          href={lead.company.website}
                                          target="_blank"
                                          rel="noreferrer"
                                          onClick={(e: MouseEvent) => e.stopPropagation()}
                                          className="text-[10px] text-[#c9a84c] hover:underline">
                                          Visit ↗
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                </td>

                                <td className="py-2 px-3 hidden sm:table-cell">
                                  <ScoreTooltip text={lead.fit?.tooltip ?? lead.score.tooltips?.fit ?? ""}>
                                    <div>
                                      {(() => {
                                        const fitVal = lead.fit?.fitScore ?? 0;
                                        const fitLabel =
                                          fitVal >= 75
                                            ? "Ideal match"
                                            : fitVal >= 50
                                              ? "Strong match"
                                              : fitVal >= 25
                                                ? "Partial match"
                                                : "Weak match";

                                        // Smooth colour interpolation across 0-100
                                        // 0-25:  red    (#f87171) → amber (#f59e0b)
                                        // 25-50: amber  (#f59e0b) → gold  (#c9a84c)
                                        // 50-75: gold   (#c9a84c) → light green (#86efac)
                                        // 75-100: light green (#86efac) → bright green (#22c55e)
                                        function lerpColor(
                                          a: [number, number, number],
                                          b: [number, number, number],
                                          t: number,
                                        ): string {
                                          const r = Math.round(a[0] + (b[0] - a[0]) * t);
                                          const g = Math.round(a[1] + (b[1] - a[1]) * t);
                                          const bl = Math.round(a[2] + (b[2] - a[2]) * t);
                                          return `rgb(${r},${g},${bl})`;
                                        }
                                        const RED: [number, number, number] = [248, 113, 113];
                                        const AMBER: [number, number, number] = [245, 158, 11];
                                        const GOLD: [number, number, number] = [201, 168, 76];
                                        const LGRN: [number, number, number] = [134, 239, 172];
                                        const GRN: [number, number, number] = [34, 197, 94];
                                        let fitColor: string;
                                        if (fitVal < 25) fitColor = lerpColor(RED, AMBER, fitVal / 25);
                                        else if (fitVal < 50) fitColor = lerpColor(AMBER, GOLD, (fitVal - 25) / 25);
                                        else if (fitVal < 75) fitColor = lerpColor(GOLD, LGRN, (fitVal - 50) / 25);
                                        else fitColor = lerpColor(LGRN, GRN, (fitVal - 75) / 25);

                                        // Mini ring — fills to fitVal%
                                        const r = 9,
                                          circ = 2 * Math.PI * r;
                                        const dash = circ * (fitVal / 100);

                                        return lead.fit ? (
                                          <div className="flex items-center gap-2">
                                            <svg
                                              width="22"
                                              height="22"
                                              viewBox="0 0 22 22"
                                              style={{ flexShrink: 0, transform: "rotate(-90deg)" }}>
                                              <circle
                                                cx="11"
                                                cy="11"
                                                r={r}
                                                fill="none"
                                                stroke="#1e1e1e"
                                                strokeWidth="2.5"
                                              />
                                              <circle
                                                cx="11"
                                                cy="11"
                                                r={r}
                                                fill="none"
                                                stroke={fitColor}
                                                strokeWidth="2.5"
                                                strokeLinecap="round"
                                                strokeDasharray={`${dash} ${circ}`}
                                              />
                                            </svg>
                                            <span className="text-[11px] font-medium" style={{ color: fitColor }}>
                                              {fitLabel}
                                            </span>
                                          </div>
                                        ) : (
                                          <span className="text-[#616161] text-xs">—</span>
                                        );
                                      })()}
                                    </div>
                                  </ScoreTooltip>
                                </td>

                                <td className="py-2 px-3 hidden sm:table-cell">
                                  <ScoreTooltip text={lead.score.tooltips?.opportunity ?? ""}>
                                    <div>
                                      <span className="text-[#c8c0b0] font-semibold">
                                        {lead.score.opportunity ?? 0}
                                      </span>
                                      <p className="mt-1 text-[11px] leading-snug text-[#bababa]">
                                        {t.ui.detail.upside}
                                      </p>
                                    </div>
                                  </ScoreTooltip>
                                </td>

                                <td className="py-2 px-3">
                                  <ScoreTooltip text={lead.score.tooltips?.risk ?? ""}>
                                    <div>
                                      <span
                                        className={
                                          (lead.score.risk ?? 0) >= 70
                                            ? "text-rose-300 font-semibold"
                                            : (lead.score.risk ?? 0) >= 45
                                              ? "text-amber-300 font-semibold"
                                              : "text-emerald-300 font-semibold"
                                        }>
                                        {lead.score.risk ?? 0}
                                      </span>
                                      <p className="mt-1 text-[11px] leading-snug text-[#bababa]">
                                        {lead.score.riskProfile ? lead.score.riskProfile.replaceAll("_", " ") : "—"}
                                      </p>
                                    </div>
                                  </ScoreTooltip>
                                </td>

                                <td className="py-2 px-3 hidden md:table-cell">
                                  <ScoreTooltip text={lead.score.tooltips?.value ?? ""}>
                                    <div>
                                      {(() => {
                                        const val = lead.score.value ?? 0;
                                        const color = val >= 70 ? "#4ade80" : val >= 45 ? "#c9a84c" : "#f87171";
                                        const label =
                                          val >= 70
                                            ? "Strong lead"
                                            : val >= 45
                                              ? "Good lead"
                                              : val >= 25
                                                ? "Moderate lead"
                                                : "Weak lead";
                                        return (
                                          <>
                                            <div className="flex items-center gap-2 mb-1">
                                              <span className="text-sm font-bold" style={{ color }}>
                                                {val}
                                              </span>
                                              <div className="flex-1 h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                                                <div
                                                  className="h-full rounded-full"
                                                  style={{ width: `${val}%`, backgroundColor: color }}
                                                />
                                              </div>
                                            </div>
                                            <p className="text-[10px]" style={{ color }}>
                                              {label}
                                            </p>
                                          </>
                                        );
                                      })()}
                                    </div>
                                  </ScoreTooltip>
                                </td>
                              </tr>
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Load more — single unified button */}
                  <div className="flex flex-col items-center gap-3 pt-5 pb-2">
                    {hasMore && (
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => {
                          if (hasMoreLocal) {
                            // More leads already fetched — just reveal them
                            setDisplayCount((n: number) => n + LEADS_PER_BATCH);
                          } else if (hasMoreRemote) {
                            // All local leads shown — fetch next page from API
                            handleLoadMore();
                          }
                        }}
                        className="px-8 py-2.5 rounded-xl border border-[#252525] text-[13px] text-[#bababa] hover:border-[rgba(201,168,76,0.3)] hover:text-[#c9a84c] hover:bg-[rgba(201,168,76,0.04)] disabled:opacity-40 disabled:cursor-not-allowed transition-all font-medium">
                        {isLoading ? "Loading…" : "Load more ↓"}
                      </button>
                    )}
                    <p className="text-[11px] text-[#616161]">
                      {visibleLeads.length} of {sortedLeads.length} lead{sortedLeads.length !== 1 ? "s" : ""} shown
                    </p>
                  </div>
                </>
              )}
            </div>
          </section>
        </div>

        {/* ── Lead Comparison Modal ── */}
        {compareMode &&
          compareIds.length >= 2 &&
          (() => {
            const compareLeads = compareIds
              .map((id) => leads.find((l: LeadUI) => l.id === id))
              .filter(Boolean) as LeadUI[];
            if (compareLeads.length < 2) return null;
            const metrics = [
              {
                label: "Score",
                key: (l: LeadUI) => l.score.value ?? 0,
                color: (v: number) => (v >= 70 ? "#4ade80" : v >= 45 ? "#c9a84c" : "#f87171"),
              },
              {
                label: "Opportunity",
                key: (l: LeadUI) => l.score.opportunity ?? 0,
                color: (v: number) => (v >= 60 ? "#4ade80" : v >= 35 ? "#c9a84c" : "#f87171"),
              },
              {
                label: "Risk",
                key: (l: LeadUI) => l.score.risk ?? 0,
                color: (v: number) => (v >= 60 ? "#f87171" : v >= 35 ? "#c9a84c" : "#4ade80"),
              },
              {
                label: "Fit",
                key: (l: LeadUI) => l.fit?.fitScore ?? 0,
                color: (v: number) => (v >= 65 ? "#4ade80" : v >= 40 ? "#c9a84c" : "#f87171"),
              },
              {
                label: "Readiness",
                key: (l: LeadUI) => l.score.readiness ?? 0,
                color: (v: number) => (v >= 60 ? "#4ade80" : v >= 35 ? "#c9a84c" : "#f87171"),
              },
            ];
            return (
              <>
                <div
                  className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[70]"
                  onClick={() => setCompareMode(false)}
                />
                <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-[#0a0a0a] border border-[#252525] rounded-2xl z-[80] shadow-2xl max-h-[85vh] overflow-y-auto">
                  <div className="flex items-center justify-between p-5 border-b border-[#141414]">
                    <div>
                      <p className="text-[10px] uppercase tracking-widests text-[#8a6e30] mb-0.5">Comparison</p>
                      <h2 className="text-[15px] font-medium text-[#f5f0e8]">Side-by-side comparison</h2>
                    </div>
                    <button
                      onClick={() => setCompareMode(false)}
                      className="text-[#737373] hover:text-[#bababa] transition-colors text-xl leading-none">
                      ×
                    </button>
                  </div>
                  <div className="p-5 space-y-4">
                    {/* Lead names header */}
                    <div
                      className={"grid gap-3"}
                      style={{ gridTemplateColumns: `140px repeat(${compareLeads.length}, 1fr)` }}>
                      <div />
                      {compareLeads.map((l) => (
                        <div key={l.id} className="rounded-xl border border-[#1a1a1a] bg-[#080808] p-3 text-center">
                          <p className="text-[12px] font-semibold text-[#c8c0b0] truncate">{l.company.name}</p>
                          <p className="text-[10px] text-[#737373] mt-0.5 truncate">
                            {l.classification.primaryIndustry.replace(/_/g, " ")}
                          </p>
                          {l.company.city && <p className="text-[10px] text-[#616161]">{l.company.city}</p>}
                        </div>
                      ))}
                    </div>

                    {/* Metrics */}
                    {metrics.map((m) => {
                      const vals = compareLeads.map((l) => m.key(l));
                      const maxVal = Math.max(...vals);
                      return (
                        <div
                          key={m.label}
                          className={"grid gap-3 items-center"}
                          style={{ gridTemplateColumns: `140px repeat(${compareLeads.length}, 1fr)` }}>
                          <p className="text-[11px] text-[#8a8a8a]">{m.label}</p>
                          {vals.map((v, i) => {
                            const c = m.color(v);
                            const isBest = v === maxVal && vals.filter((x) => x === maxVal).length === 1;
                            return (
                              <div
                                key={i}
                                className={
                                  "rounded-xl border p-3 text-center " +
                                  (isBest
                                    ? "border-[rgba(201,168,76,0.3)] bg-[rgba(201,168,76,0.04)]"
                                    : "border-[#1a1a1a] bg-[#080808]")
                                }>
                                <p className="text-[16px] font-bold" style={{ color: c }}>
                                  {v}
                                </p>
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
                    <div
                      className={"grid gap-3 items-start"}
                      style={{ gridTemplateColumns: `140px repeat(${compareLeads.length}, 1fr)` }}>
                      <p className="text-[11px] text-[#8a8a8a]">Gap type</p>
                      {compareLeads.map((l) => {
                        const gap = (l.metadata?.outreach as { gap?: string } | null)?.gap ?? null;
                        return (
                          <div key={l.id} className="rounded-xl border border-[#1a1a1a] bg-[#080808] p-3 text-center">
                            <p className="text-[11px] text-[#bababa]">{gap ? gap.replace(/_/g, " ") : "—"}</p>
                          </div>
                        );
                      })}
                    </div>

                    {/* Website */}
                    <div
                      className={"grid gap-3 items-start"}
                      style={{ gridTemplateColumns: `140px repeat(${compareLeads.length}, 1fr)` }}>
                      <p className="text-[11px] text-[#8a8a8a]">Website</p>
                      {compareLeads.map((l) => (
                        <div key={l.id} className="rounded-xl border border-[#1a1a1a] bg-[#080808] p-3 text-center">
                          {l.company.website ? (
                            <a
                              href={l.company.website}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] text-[#c9a84c] hover:underline"
                              onClick={(e) => e.stopPropagation()}>
                              Visit ↗
                            </a>
                          ) : (
                            <p className="text-[11px] text-[#616161]">None</p>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Action buttons */}
                    <div
                      className={"grid gap-3"}
                      style={{ gridTemplateColumns: `140px repeat(${compareLeads.length}, 1fr)` }}>
                      <p className="text-[11px] text-[#8a8a8a]">Action</p>
                      {compareLeads.map((l) => (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() => {
                            setSelectedLead(l);
                            setCompareMode(false);
                          }}
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

        {/* ── LEAD DETAIL MODAL ── */}
        {selectedLead &&
          detailLead &&
          typeof window !== "undefined" &&
          createPortal(
            <>
              {/* Backdrop */}
              <div
                onClick={() => setSelectedLead(null)}
                style={{
                  position: "fixed",
                  inset: 0,
                  zIndex: 88888,
                  background: "rgba(0,0,0,0.82)",
                  backdropFilter: "blur(4px)",
                  WebkitBackdropFilter: "blur(4px)",
                }}
              />
              {/* Modal card */}
              <div
                style={{
                  position: "fixed",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  zIndex: 88889,
                  width: "min(92vw, 760px)",
                  maxHeight: "88vh",
                  overflowY: "auto",
                  borderRadius: 16,
                  border: "1px solid rgba(201,168,76,0.2)",
                  background: "#0a0a0a",
                  boxShadow: "0 40px 120px rgba(0,0,0,0.9)",
                  scrollbarWidth: "thin",
                  scrollbarColor: "#2a2010 #0a0a0a",
                }}>
                {/* Sticky header */}
                <div
                  style={{
                    position: "sticky",
                    top: 0,
                    zIndex: 2,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "14px 16px 12px",
                    borderBottom: "1px solid #1a1a1a",
                    background: "#0a0a0a",
                  }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <span
                      style={{
                        fontSize: 10,
                        letterSpacing: "0.15em",
                        textTransform: "uppercase",
                        color: "#8a6e30",
                        flexShrink: 0,
                      }}>
                      Lead
                    </span>
                    <span
                      style={{
                        fontSize: 15,
                        fontWeight: 600,
                        color: "#f5f0e8",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}>
                      {detailLead.company.name}
                    </span>
                    {detailLead.company.city && (
                      <span style={{ fontSize: 11, color: "#555", flexShrink: 0 }}>{detailLead.company.city}</span>
                    )}
                    {detailLead.company.website && (
                      <a
                        href={detailLead.company.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e: MouseEvent) => e.stopPropagation()}
                        style={{ fontSize: 11, color: "#8a6e30", textDecoration: "none", flexShrink: 0 }}>
                        Visit ↗
                      </a>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedLead(null)}
                    aria-label="Close lead panel"
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      border: "1px solid #252525",
                      background: "transparent",
                      cursor: "pointer",
                      fontSize: 16,
                      color: "#555",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      marginLeft: 8,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "#f87171";
                      e.currentTarget.style.color = "#f87171";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "#252525";
                      e.currentTarget.style.color = "#555";
                    }}>
                    ✕
                  </button>
                </div>
                {/* Panel content */}
                <div className="px-3 py-4 space-y-3 w-full overflow-x-hidden">
                  <div className="flex gap-1 border-b border-[#252525] pb-0 overflow-x-auto scrollbar-none">
                    {(
                      [
                        { key: "overview" as const, label: t.ui.detail.tabOverview },
                        { key: "signals" as const, label: t.ui.detail.tabSignals },
                        { key: "outreach" as const, label: t.ui.detail.tabOutreach },
                        { key: "tracking" as const, label: t.ui.detail.tabTracking },
                        { key: "followup" as const, label: "Follow-up" },
                      ] as const
                    ).map((tab) => (
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
                            : "text-[#999999] hover:text-[#bababa]")
                        }>
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
                        }}>
                        <span>{savedLeadIds.has(detailLead.id) ? "◈" : "◇"}</span>
                        <span>{savedLeadIds.has(detailLead.id) ? "Saved" : "Save lead"}</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e: MouseEvent) => {
                          e.stopPropagation();
                          setSelectedLead(null);
                        }}
                        className="text-[11px] px-2 py-1 rounded-md border border-[#2a2a2a] bg-[#111111]/70 hover:bg-[#1a1a1a]">
                        {t.ui.detail.clear}
                      </button>
                    </div>
                  </div>

                  {detailTab === "overview" &&
                    (() => {
                      const opp = detailLead.score.opportunity ?? 0;
                      const readiness = detailLead.score.readiness ?? 0;
                      const risk = detailLead.score.risk ?? 0;
                      const value = detailLead.score.value ?? 0;
                      const fit = detailLead.fit?.fitScore ?? null;
                      const rp = detailLead.score.riskProfile ?? "unknown";
                      const hasRisk =
                        rp === "early_stage" ||
                        rp === "limited_data" ||
                        rp === "well_established" ||
                        rp === "local_authority";

                      // Score ring colour
                      const scoreColor = value >= 70 ? "#4ade80" : value >= 45 ? "#c9a84c" : "#f87171";
                      const scoreLabel = value >= 70 ? "Strong Lead" : value >= 45 ? "Moderate Lead" : "Weak Lead";

                      // Gap type from outreach metadata
                      const gap = (detailLead.metadata?.outreach as { gap?: string } | null)?.gap ?? null;
                      const gapLabels: Record<string, { label: string; desc: string; color: string }> = {
                        VISIBILITY: {
                          label: "Visibility Gap",
                          desc: "Demand exists but this business isn't capturing it — weak channels or low presence.",
                          color: "#818cf8",
                        },
                        CONVERSION: {
                          label: "Conversion Gap",
                          desc: "Traffic or interest exists but leaks before becoming bookings or enquiries.",
                          color: "#fb923c",
                        },
                        INFRASTRUCTURE: {
                          label: "Infrastructure Gap",
                          desc: "No digital foundation — interest has nowhere to land and convert.",
                          color: "#f87171",
                        },
                        OPTIMIZATION: {
                          label: "Optimization Gap",
                          desc: "Strong fundamentals — opportunity is in sharpening what already works.",
                          color: "#34d399",
                        },
                      };
                      const gapInfo = gap ? (gapLabels[gap] ?? null) : null;

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
                                <p className="text-[12px] text-[#bababa]">Analyzing signals…</p>
                                <p className="text-[10px] text-[#737373] mt-0.5">Scoring this lead for your profile</p>
                              </div>
                            </div>
                          )}

                          {/* Score content — hidden while rescoring */}
                          <div
                            className={
                              isRescoring
                                ? "opacity-0 pointer-events-none"
                                : "space-y-3 transition-opacity duration-500"
                            }>
                            {/* Hero score row */}
                            <div className="rounded-xl border border-[#252525] bg-[#0d0d0d] p-3 w-full">
                              <div className="flex items-center gap-3 mb-2">
                                <div className="relative flex-shrink-0 w-12 h-12">
                                  <svg viewBox="0 0 56 56" className="w-full h-full -rotate-90">
                                    <circle cx="28" cy="28" r="24" fill="none" stroke="#1a1a1a" strokeWidth="5" />
                                    <circle
                                      cx="28"
                                      cy="28"
                                      r="24"
                                      fill="none"
                                      stroke={scoreColor}
                                      strokeWidth="5"
                                      strokeDasharray={`${(value / 100) * 150.8} 150.8`}
                                      strokeLinecap="round"
                                    />
                                  </svg>
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-[13px] font-bold" style={{ color: scoreColor }}>
                                      {value}
                                    </span>
                                  </div>
                                </div>
                                <div className="min-w-0">
                                  <p className="text-[10px] uppercase tracking-widest text-[#8a8a8a]">Score</p>
                                  <p className="font-semibold text-sm" style={{ color: scoreColor }}>
                                    {scoreLabel}
                                  </p>
                                </div>
                              </div>
                              <p className="text-[11px] text-[#999999] leading-relaxed">
                                {detailLead.score.tooltips?.value ?? getScoreReason(detailLead, language)}
                              </p>

                              {detailWebsiteUrl && (
                                <a
                                  href={detailWebsiteUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-block mt-1.5 text-[11px] text-[#c9a84c] hover:underline">
                                  Visit site ↗
                                </a>
                              )}
                            </div>

                            {/* 2×2 compact score circles */}
                            <div className="grid grid-cols-2 gap-2">
                              {(
                                [
                                  {
                                    short: "Opportunity",
                                    label: "Opportunity",
                                    value: opp,
                                    color: opp >= 60 ? "#4ade80" : opp >= 35 ? "#c9a84c" : "#f87171",
                                    tooltip: detailLead.score.tooltips?.opportunity ?? "",
                                  },
                                  {
                                    short: "Readiness",
                                    label: "Readiness",
                                    value: readiness,
                                    color: readiness >= 60 ? "#4ade80" : readiness >= 35 ? "#c9a84c" : "#f87171",
                                    tooltip: detailLead.score.tooltips?.readiness ?? "",
                                  },
                                  {
                                    short: "Difficulty",
                                    label: "Difficulty",
                                    value: risk,
                                    color: risk >= 60 ? "#f87171" : risk >= 35 ? "#c9a84c" : "#4ade80",
                                    tooltip: detailLead.score.tooltips?.risk ?? "",
                                  },
                                  {
                                    short: "Fit",
                                    label: "Fit",
                                    value: fit ?? 0,
                                    color: (fit ?? 0) >= 65 ? "#4ade80" : (fit ?? 0) >= 40 ? "#c9a84c" : "#f87171",
                                    tooltip: detailLead.fit?.tooltip ?? detailLead.score.tooltips?.fit ?? "",
                                  },
                                ] as { short: string; label: string; value: number; color: string; tooltip: string }[]
                              ).map(({ short, label, value: v, color, tooltip }) => (
                                <ScoreTooltip key={short} text={tooltip}>
                                  <div className="rounded-xl border border-[#1e1e1e] bg-[#0d0d0d] p-3 flex items-center gap-3 cursor-help">
                                    <div className="relative flex-shrink-0 w-11 h-11">
                                      <svg viewBox="0 0 44 44" className="w-full h-full -rotate-90">
                                        <circle cx="22" cy="22" r="18" fill="none" stroke="#1a1a1a" strokeWidth="3.5" />
                                        <circle
                                          cx="22"
                                          cy="22"
                                          r="18"
                                          fill="none"
                                          stroke={color}
                                          strokeWidth="3.5"
                                          strokeDasharray={`${(v / 100) * 113.1} 113.1`}
                                          strokeLinecap="round"
                                        />
                                      </svg>
                                      <div className="absolute inset-0 flex items-center justify-center">
                                        <span className="text-[11px] font-bold tabular-nums" style={{ color }}>
                                          {v}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-[12px] text-[#bababa] font-medium">{label}</p>
                                    </div>
                                  </div>
                                </ScoreTooltip>
                              ))}
                            </div>

                            {/* Gap + insight */}
                            {(gapInfo || detailInsight?.message) && (
                              <div className="space-y-2">
                                {gapInfo && (
                                  <div
                                    className="rounded-xl border p-3"
                                    style={{
                                      borderColor: `${gapInfo.color}30`,
                                      backgroundColor: `${gapInfo.color}06`,
                                    }}>
                                    <span
                                      className="text-[10px] font-bold uppercase tracking-widest"
                                      style={{ color: gapInfo.color }}>
                                      ◆ {gapInfo.label}
                                    </span>
                                    <p className="text-[11px] text-[#999999] mt-1 leading-snug break-words">
                                      {gapInfo.desc}
                                    </p>
                                  </div>
                                )}
                                {detailInsight?.message && (
                                  <div className="rounded-xl border border-[rgba(201,168,76,0.2)] bg-[rgba(201,168,76,0.04)] p-3">
                                    <p className="text-[13px] font-semibold text-[#e8c97a] break-words">
                                      ⚡ {detailInsight.message}
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Fit needs */}
                            {fit !== null &&
                              ((detailLead.fit?.matchedNeeds ?? []).length > 0 ||
                                (detailLead.fit?.missingNeeds ?? []).length > 0) && (
                                <div className="rounded-xl border border-[#1e1e1e] bg-[#0d0d0d] p-3 space-y-2">
                                  {(detailLead.fit?.matchedNeeds ?? []).length > 0 && (
                                    <div>
                                      <p className="text-[9px] uppercase tracking-widest text-[#4ade80]/70 mb-1">
                                        ✓ Can deliver
                                      </p>
                                      <div className="flex flex-wrap gap-1">
                                        {(detailLead.fit?.matchedNeeds ?? []).map((n: string) => (
                                          <span
                                            key={n}
                                            className="text-[10px] px-1.5 py-0.5 rounded bg-[#4ade80]/10 border border-[#4ade80]/20 text-[#4ade80]">
                                            {n}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {(detailLead.fit?.missingNeeds ?? []).length > 0 && (
                                    <div>
                                      <p className="text-[9px] uppercase tracking-widest text-[#f87171]/70 mb-1">
                                        ✗ Can&apos;t cover
                                      </p>
                                      <div className="flex flex-wrap gap-1">
                                        {(detailLead.fit?.missingNeeds ?? []).map((n: string) => (
                                          <span
                                            key={n}
                                            className="text-[10px] px-1.5 py-0.5 rounded bg-[#f87171]/10 border border-[#f87171]/20 text-[#f87171]">
                                            {n}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}

                            {/* Risk flag */}
                            {hasRisk && (
                              <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3">
                                <p className="text-[13px] font-semibold text-rose-300">
                                  {riskTitleFromProfile(detailLead.score.riskProfile, t)}
                                </p>
                                <p className="mt-0.5 text-[11px] text-rose-400/60 leading-relaxed break-words">
                                  {riskMessage(language, detailLead)}
                                </p>
                              </div>
                            )}

                            {/* No website */}
                            {!detailWebsiteUrl && (
                              <div className="rounded-lg border border-[#252525] bg-[#0d0d0d] px-3 py-2 flex items-center gap-2">
                                <span className="text-[#f87171] text-xs">✗</span>
                                <p className="text-[11px] text-[#8a8a8a]">{t.ui.detail.noWebsite}</p>
                              </div>
                            )}

                            {/* Signal breakdown bars — moved from Signals tab */}
                            {(() => {
                              const bd = detailLead.score.breakdown;
                              if (!bd) return null;
                              const bars = [
                                {
                                  key: "reputation",
                                  label: "Reputation",
                                  hint: "Review volume & rating quality",
                                  invert: false,
                                },
                                {
                                  key: "digitalPresence",
                                  label: "Digital presence",
                                  hint: "Website & social footprint",
                                  invert: false,
                                },
                                {
                                  key: "businessStrength",
                                  label: "Business strength",
                                  hint: "Overall stability signals",
                                  invert: false,
                                },
                                {
                                  key: "opportunityGap",
                                  label: "Gap size",
                                  hint: "Size of gap you can sell into",
                                  invert: false,
                                },
                                {
                                  key: "stabilityRisk",
                                  label: "Difficulty",
                                  hint: "How hard this lead will be to close",
                                  invert: true,
                                },
                                {
                                  key: "evidenceConfidence",
                                  label: "Evidence confidence",
                                  hint: "How reliable is this data",
                                  invert: false,
                                },
                              ] as const;
                              return (
                                <div className="rounded-xl border border-[#1e1e1e] bg-[#0d0d0d] p-3 space-y-3">
                                  <p className="text-[10px] uppercase tracking-widest text-[#737373]">
                                    Signal breakdown
                                  </p>
                                  {bars.map(({ key, label, hint, invert }) => {
                                    const v = (bd as Record<string, number>)[key] ?? 0;
                                    const color = invert
                                      ? v >= 65
                                        ? "#f87171"
                                        : v >= 35
                                          ? "#c9a84c"
                                          : "#4ade80"
                                      : v >= 65
                                        ? "#4ade80"
                                        : v >= 35
                                          ? "#c9a84c"
                                          : "#f87171";
                                    return (
                                      <div key={key}>
                                        <div className="flex items-center justify-between mb-1">
                                          <div>
                                            <p className="text-[11px] text-[#bababa]">{label}</p>
                                            <p className="text-[9px] text-[#737373]">{hint}</p>
                                          </div>
                                          <p className="text-[12px] font-bold tabular-nums" style={{ color }}>
                                            {v}
                                          </p>
                                        </div>
                                        <div className="h-1.5 w-full rounded-full bg-[#1a1a1a] overflow-hidden">
                                          <div
                                            className="h-full rounded-full"
                                            style={{ width: `${v}%`, backgroundColor: color }}
                                          />
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })()}

                            {/* Lead Snapshot button */}
                            <button
                              type="button"
                              disabled
                              className="w-full py-2 rounded-xl border border-[rgba(201,168,76,0.2)] text-[11px] text-[#8a6e30] bg-[rgba(201,168,76,0.04)] opacity-60 cursor-not-allowed flex items-center justify-center gap-2">
                              <span>◈</span>
                              <span>Lead Snapshot — coming soon</span>
                            </button>
                          </div>
                          {/* end score content wrapper */}
                        </div>
                      );
                    })()}

                  {detailTab === "signals" &&
                    (() => {
                      const bd = detailLead.score.breakdown;

                      type CatDef = { key: keyof typeof bd; label: string; hint: string; invert?: boolean };
                      const categories: CatDef[] = [
                        { key: "reputation", label: "Reputation", hint: "Reviews & rating quality." },
                        { key: "digitalPresence", label: "Digital Pres.", hint: "Website & social visibility." },
                        { key: "businessStrength", label: "Biz Strength", hint: "Maturity & ability to pay." },
                        { key: "opportunityGap", label: "Opp. Gap", hint: "Growth headroom available." },
                        {
                          key: "stabilityRisk",
                          label: "Difficulty",
                          hint: "How hard to close — higher = harder.",
                          invert: true,
                        },
                        { key: "evidenceConfidence", label: "Evidence Conf.", hint: "Signal data quality." },
                      ];

                      function barColor(v: number, invert = false) {
                        const high = invert ? "#f87171" : "#4ade80";
                        const mid = "#c9a84c";
                        const low = invert ? "#4ade80" : "#f87171";
                        return v >= 65 ? high : v >= 35 ? mid : low;
                      }

                      return (
                        <div className="space-y-3 pt-1">
                          {/* Category score bars */}
                          {bd && (
                            <div className="rounded-xl border border-[#252525] bg-[#0d0d0d] p-4 space-y-3">
                              <p className="text-[10px] uppercase tracking-widest text-[#8a8a8a]">Breakdown</p>
                              {categories.map(({ key, label, hint, invert }) => {
                                const v = bd[key] ?? 0;
                                const color = barColor(v, invert);
                                return (
                                  <div key={key} className="space-y-1">
                                    <div className="flex items-center justify-between">
                                      <p className="text-[11px] text-[#bababa]">{label}</p>
                                      <p className="text-[12px] font-bold tabular-nums" style={{ color }}>
                                        {v}
                                      </p>
                                    </div>
                                    <div className="h-1.5 w-full rounded-full bg-[#1a1a1a] overflow-hidden">
                                      <div
                                        className="h-full rounded-full transition-all duration-700"
                                        style={{ width: `${v}%`, backgroundColor: color }}
                                      />
                                    </div>
                                    <p className="text-[10px] text-[#737373] leading-snug hidden sm:block">{hint}</p>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Score reasons */}
                          {detailLead.score.reasons?.length > 0 && (
                            <div className="rounded-xl border border-[#252525] bg-[#0d0d0d] p-3 space-y-2">
                              <div className="flex items-center gap-2">
                                <p className="text-[9px] uppercase tracking-widest text-[#8a8a8a]">Score evidence</p>
                                <div className="flex-1 h-[1px] bg-[#1a1a1a]" />
                              </div>
                              <div className="space-y-1.5">
                                {detailLead.score.reasons.map((reason: string, i: number) => {
                                  const isPositive = /strong|high|good|great|excellent|active|present|above/i.test(
                                    reason,
                                  );
                                  const isNegative = /no |missing|low|weak|below|lacks|absent|poor/i.test(reason);
                                  return (
                                    <div key={i} className="flex items-start gap-2.5">
                                      <span
                                        className={`text-[10px] mt-0.5 flex-shrink-0 ${isPositive ? "text-[#4ade80]" : isNegative ? "text-[#f87171]" : "text-[#8a8a8a]"}`}>
                                        {isPositive ? "✓" : isNegative ? "✗" : "·"}
                                      </span>
                                      <p className="text-[11px] text-[#bababa] leading-snug">{reason}</p>
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
                              <span className="text-[12px] text-[#8a8a8a]">Scanning website signals…</span>
                            </div>
                          )}
                          {!safeEnrichment && !enrichmentLoading && detailLead.company.website && (
                            <div className="rounded-lg border border-[#252525] bg-[#0d0d0d] p-4 space-y-1">
                              <p className="text-[10px] uppercase tracking-widest text-[#8a8a8a]">Web Signals</p>
                              <p className="text-[12px] text-[#737373]">Scan failed — unreachable or blocked.</p>
                              <p className="text-[11px] text-[#616161]">{detailLead.company.website}</p>
                            </div>
                          )}
                          {!safeEnrichment && !enrichmentLoading && !detailLead.company.website && (
                            <div className="rounded-lg border border-[#252525] bg-[#0d0d0d] p-4">
                              <p className="text-[10px] uppercase tracking-widest text-[#8a8a8a] mb-1">Web Signals</p>
                              <p className="text-[12px] text-[#737373]">No website — signals unavailable.</p>
                            </div>
                          )}

                          {safeEnrichment &&
                            !enrichmentLoading &&
                            (() => {
                              const noWebsite = !detailLead?.company.website;
                              return (
                                <div
                                  className="rounded-xl border border-[#252525] bg-[#0d0d0d] p-4 space-y-3"
                                  style={{ opacity: noWebsite ? 0.45 : 1, position: "relative" }}>
                                  {noWebsite && (
                                    <div
                                      style={{
                                        position: "absolute",
                                        inset: 0,
                                        zIndex: 2,
                                        borderRadius: 12,
                                        pointerEvents: "none",
                                        overflow: "hidden",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                      }}>
                                      <svg
                                        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
                                        preserveAspectRatio="none">
                                        <line
                                          x1="0"
                                          y1="0"
                                          x2="100%"
                                          y2="100%"
                                          stroke="#f87171"
                                          strokeWidth="1.5"
                                          strokeOpacity="0.35"
                                        />
                                        <line
                                          x1="100%"
                                          y1="0"
                                          x2="0"
                                          y2="100%"
                                          stroke="#f87171"
                                          strokeWidth="1.5"
                                          strokeOpacity="0.35"
                                        />
                                      </svg>
                                      <span
                                        style={{
                                          fontSize: 10,
                                          color: "#f87171",
                                          background: "#0d0d0d",
                                          padding: "2px 8px",
                                          borderRadius: 4,
                                          border: "1px solid rgba(248,113,113,0.2)",
                                          zIndex: 3,
                                          position: "relative",
                                        }}>
                                        No website
                                      </span>
                                    </div>
                                  )}
                                  <div className="flex items-center justify-between">
                                    <p className="text-[10px] uppercase tracking-widest text-[#8a8a8a]">Web Signals</p>
                                    <button
                                      type="button"
                                      onClick={() => detailLead && runDeepScan(detailLead)}
                                      disabled={enrichmentLoading}
                                      className="text-[10px] px-2 py-1 rounded border border-[#252525] text-[#8a8a8a] hover:border-[#444] hover:text-[#bababa] disabled:opacity-40 transition-colors">
                                      ↻ Re-enrich
                                    </button>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    {[
                                      { key: "website_reachable", label: "Reachable", value: isReachable },
                                      {
                                        key: "website_has_contact_page",
                                        label: "Contact pg",
                                        value: enrichmentSignals["website_has_contact_page"]?.value,
                                      },
                                      {
                                        key: "website_has_booking_cta",
                                        label: "Booking CTA",
                                        value: enrichmentSignals["website_has_booking_cta"]?.value,
                                      },
                                      {
                                        key: "website_has_clear_offer",
                                        label: "Clear offer",
                                        value: enrichmentSignals["website_has_clear_offer"]?.value,
                                      },
                                      {
                                        key: "website_mobile_friendly",
                                        label: "Mobile ok",
                                        value: enrichmentSignals["website_mobile_friendly"]?.value,
                                      },
                                    ].map(({ key, label, value: v }) => (
                                      <div
                                        key={key}
                                        className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${v ? "border-[#4ade80]/20 bg-[#4ade80]/5" : "border-[#f87171]/15 bg-[#f87171]/5"}`}>
                                        <span className={`text-xs ${v ? "text-[#4ade80]" : "text-[#f87171]"}`}>
                                          {v ? "✓" : "✗"}
                                        </span>
                                        <span className="text-[11px] text-[#bababa]">{label}</span>
                                      </div>
                                    ))}
                                  </div>
                                  {detectedPlatforms.length > 0 && (
                                    <div>
                                      <p className="text-[10px] uppercase tracking-widest text-[#8a8a8a] mb-1.5">
                                        Social
                                      </p>
                                      <div className="flex flex-wrap gap-1.5">
                                        {detectedPlatforms.map((p: string) => (
                                          <span
                                            key={p}
                                            className="text-[11px] px-2 py-0.5 rounded-md border border-[#252525] text-[#c8c0b0]">
                                            {p}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                        </div>
                      );
                    })()}

                  {detailTab === "signals" && deepEnrichmentData && (
                    <div className="space-y-3">
                      {/* Deep Score */}
                      <div className="rounded-xl border border-[rgba(201,168,76,0.25)] bg-[rgba(201,168,76,0.04)] p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="space-y-1">
                            <p className="text-[10px] uppercase tracking-widest text-[#8a6e30]">Deep Enrichment</p>
                            {deepEnrichmentData.scannedAt && (
                              <div className="flex items-center gap-1.5">
                                {deepEnrichmentData.isFromCache && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded border border-[#c9a84c]/20 bg-[#c9a84c]/08 text-[#8a6e30]">
                                    cached
                                  </span>
                                )}
                                <p className="text-[10px] text-[#737373]">
                                  Scanned{" "}
                                  {(() => {
                                    const diff = Date.now() - new Date(deepEnrichmentData.scannedAt).getTime();
                                    const mins = Math.floor(diff / 60000);
                                    const hours = Math.floor(diff / 3600000);
                                    const days = Math.floor(diff / 86400000);
                                    return days > 0
                                      ? `${days}d ago`
                                      : hours > 0
                                        ? `${hours}h ago`
                                        : mins > 0
                                          ? `${mins}m ago`
                                          : "just now";
                                  })()}
                                </p>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-2xl font-bold text-[#c9a84c]">{deepEnrichmentData.deepScore}</span>
                            {deepEnrichmentData.isFromCache && (
                              <button
                                type="button"
                                onClick={() => detailLead && runDeepScan(detailLead)}
                                className="text-[10px] px-2 py-1 rounded border border-[#252525] text-[#8a8a8a] hover:border-[#444] hover:text-[#bababa] transition-colors">
                                ↻ Re-enrich
                              </button>
                            )}
                          </div>
                        </div>
                        {!deepEnrichmentData.pageReachable && (
                          <p className="text-[11px] text-[#8a8a8a]">Unreachable — partial scores only.</p>
                        )}
                      </div>

                      {/* Website scores */}
                      {(() => {
                        const noWebsite = !detailLead?.company.website;
                        return (
                          <div
                            className="rounded-xl border border-[#252525] bg-[#0d0d0d] p-4 space-y-3"
                            style={{ opacity: noWebsite ? 0.4 : 1, position: "relative" }}>
                            {noWebsite && (
                              <div
                                style={{
                                  position: "absolute",
                                  inset: 0,
                                  zIndex: 2,
                                  borderRadius: 12,
                                  pointerEvents: "none",
                                  overflow: "hidden",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}>
                                <svg
                                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
                                  preserveAspectRatio="none">
                                  <line
                                    x1="0"
                                    y1="0"
                                    x2="100%"
                                    y2="100%"
                                    stroke="#f87171"
                                    strokeWidth="1.5"
                                    strokeOpacity="0.35"
                                  />
                                  <line
                                    x1="100%"
                                    y1="0"
                                    x2="0"
                                    y2="100%"
                                    stroke="#f87171"
                                    strokeWidth="1.5"
                                    strokeOpacity="0.35"
                                  />
                                </svg>
                                <span
                                  style={{
                                    fontSize: 10,
                                    color: "#f87171",
                                    background: "#0d0d0d",
                                    padding: "2px 8px",
                                    borderRadius: 4,
                                    border: "1px solid rgba(248,113,113,0.2)",
                                    zIndex: 3,
                                    position: "relative",
                                  }}>
                                  No website
                                </span>
                              </div>
                            )}
                            <div className="flex items-center justify-between">
                              <p className="text-[10px] uppercase tracking-widest text-[#8a8a8a]">Website</p>
                              {!noWebsite && deepEnrichmentData.website.summary && (
                                <p className="text-[10px] text-[#737373] max-w-[60%] text-right truncate">
                                  {deepEnrichmentData.website.summary}
                                </p>
                              )}
                            </div>
                            {Object.entries(deepEnrichmentData.website.scores).map(([key, val]) => {
                              const label = key
                                .replace(/([A-Z])/g, " $1")
                                .replace(/^./, (s: string) => s.toUpperCase());
                              const displayVal = noWebsite ? 0 : (val as number);
                              const color = displayVal >= 65 ? "#4ade80" : displayVal >= 35 ? "#c9a84c" : "#f87171";
                              return (
                                <div key={key} className="space-y-1">
                                  <div className="flex items-center justify-between">
                                    <p className="text-[11px] text-[#bababa]">{label}</p>
                                    <p className="text-[12px] font-bold tabular-nums" style={{ color }}>
                                      {displayVal}
                                    </p>
                                  </div>
                                  <div className="h-1.5 w-full rounded-full bg-[#1a1a1a]">
                                    <div
                                      className="h-full rounded-full transition-all duration-700"
                                      style={{ width: `${displayVal}%`, backgroundColor: color }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}

                      {/* Market signals */}
                      <div className="rounded-xl border border-[#252525] bg-[#0d0d0d] p-4 space-y-3">
                        <p className="text-[10px] uppercase tracking-widest text-[#8a8a8a]">Market</p>
                        {Object.entries(deepEnrichmentData.market.scores).map(([key, val]) => {
                          const label = key.replace(/([A-Z])/g, " $1").replace(/^./, (s: string) => s.toUpperCase());
                          const score = val as number;
                          const color = score >= 65 ? "#4ade80" : score >= 35 ? "#c9a84c" : "#f87171";
                          return (
                            <div key={key} className="space-y-1">
                              <div className="flex items-center justify-between">
                                <p className="text-[11px] text-[#bababa]">{label}</p>
                                <p className="text-[12px] font-bold tabular-nums" style={{ color }}>
                                  {val}
                                </p>
                              </div>
                              <div className="h-1.5 w-full rounded-full bg-[#1a1a1a]">
                                <div
                                  className="h-full rounded-full transition-all duration-700"
                                  style={{ width: `${val}%`, backgroundColor: color }}
                                />
                              </div>
                            </div>
                          );
                        })}
                        {deepEnrichmentData.market.recommendation && (
                          <p className="text-[11px] text-[#999999] border-t border-[#1a1a1a] pt-2">
                            {deepEnrichmentData.market.recommendation}
                          </p>
                        )}
                      </div>

                      {/* Brand grade */}
                      <div className="rounded-xl border border-[#252525] bg-[#0d0d0d] p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] uppercase tracking-widest text-[#8a8a8a]">Brand</p>
                          <span className="text-[13px] font-bold text-[#c9a84c]">
                            Grade: {deepEnrichmentData.brand.brandGrade}
                          </span>
                        </div>
                        {Object.entries(deepEnrichmentData.brand.scores).map(([key, val]) => {
                          const label = key.replace(/([A-Z])/g, " $1").replace(/^./, (s: string) => s.toUpperCase());
                          const score = val as number;
                          const color = score >= 65 ? "#4ade80" : score >= 35 ? "#c9a84c" : "#f87171";
                          return (
                            <div key={key} className="space-y-1">
                              <div className="flex items-center justify-between">
                                <p className="text-[11px] text-[#bababa]">{label}</p>
                                <p className="text-[12px] font-bold tabular-nums" style={{ color }}>
                                  {val}
                                </p>
                              </div>
                              <div className="h-1.5 w-full rounded-full bg-[#1a1a1a]">
                                <div
                                  className="h-full rounded-full transition-all duration-700"
                                  style={{ width: `${val}%`, backgroundColor: color }}
                                />
                              </div>
                            </div>
                          );
                        })}
                        <div className="grid grid-cols-2 gap-2 border-t border-[#1a1a1a] pt-2">
                          <div className="rounded-lg border border-[#4ade80]/15 bg-[#4ade80]/5 px-2 py-1.5">
                            <p className="text-[9px] uppercase tracking-widest text-[#4ade80]/60 mb-0.5">Strength</p>
                            <p className="text-[11px] text-[#bababa]">{deepEnrichmentData.brand.strengthArea}</p>
                          </div>
                          <div className="rounded-lg border border-[#f87171]/15 bg-[#f87171]/5 px-2 py-1.5">
                            <p className="text-[9px] uppercase tracking-widest text-[#f87171]/60 mb-0.5">Weakest</p>
                            <p className="text-[11px] text-[#bababa]">{deepEnrichmentData.brand.weakestArea}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {detailTab === "signals" && !deepEnrichmentData && !deepEnrichmentLoading && (
                    <div className="rounded-xl border border-[#252525] bg-[#0d0d0d] p-4 flex items-center justify-between">
                      <div>
                        <p className="text-[12px] text-[#bababa] font-medium">Deep Enrichment</p>
                        <p className="text-[11px] text-[#737373] mt-0.5 hidden sm:block">Website · market · brand</p>
                      </div>
                      {deepEnrichmentUnlocked ? (
                        <button
                          type="button"
                          onClick={() => detailLead && runDeepScan(detailLead)}
                          className="text-[11px] px-3 py-1.5 rounded-lg border border-[rgba(201,168,76,0.3)] bg-[rgba(201,168,76,0.06)] text-[#c9a84c] hover:bg-[rgba(201,168,76,0.12)] transition-colors">
                          ◉ Run Scan
                        </button>
                      ) : (
                        <div className="relative group">
                          <button
                            type="button"
                            disabled
                            className="text-[11px] px-3 py-1.5 rounded-lg border border-[#2a2a2a] bg-[#111] text-[#737373] cursor-not-allowed flex items-center gap-1.5">
                            <span>🔒</span>
                            <span>Deep Enrichment</span>
                          </button>
                          <div className="absolute bottom-full right-0 mb-2 w-56 rounded-xl border border-[#2a2a2a] bg-[#111] p-3 text-[11px] text-[#999999] leading-relaxed opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 z-50 shadow-xl">
                            <p className="text-[#c9a84c] font-medium mb-1">Operator & Agency feature</p>
                            <p>
                              Deep Enrichment fetches the lead&apos;s website and analyses SEO structure, CTA strength,
                              brand consistency, and market positioning — giving you a composite intelligence score
                              before you reach out.
                            </p>
                            <p className="mt-1 text-[#8a8a8a]">Upgrade to unlock.</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {detailTab === "signals" && deepEnrichmentLoading && (
                    <div className="rounded-xl border border-[#252525] bg-[#0d0d0d] p-4 flex items-center gap-3">
                      <div className="w-3.5 h-3.5 rounded-full border-2 border-[#c9a84c] border-t-transparent animate-spin shrink-0" />
                      <span className="text-[12px] text-[#8a8a8a]">
                        Running deep enrichment — fetching website, market & brand signals…
                      </span>
                    </div>
                  )}

                  {detailTab === "outreach" &&
                    (() => {
                      const gap = (safeOutreach as { gap?: string } | null)?.gap ?? null;
                      const difficulty = (safeOutreach as { difficulty?: string } | null)?.difficulty ?? null;
                      const structured = getStructuredAngle(detailLead, language);
                      const title = angleTitle || structured.title;
                      const why = angleWhy || structured.why;

                      const gapConfig: Record<
                        string,
                        { label: string; color: string; icon: string; intervention: string }
                      > = {
                        VISIBILITY: {
                          label: "Visibility Gap",
                          color: "#818cf8",
                          icon: "◎",
                          intervention:
                            "Build high-intent capture channels — search, retargeting, demand-side content.",
                        },
                        CONVERSION: {
                          label: "Conversion Gap",
                          color: "#fb923c",
                          icon: "⬡",
                          intervention: "Fix the funnel — booking flow, tracking, and follow-up sequence.",
                        },
                        INFRASTRUCTURE: {
                          label: "Infrastructure Gap",
                          color: "#f87171",
                          icon: "△",
                          intervention: "Build the foundation — a conversion-focused page with clear offer and CTA.",
                        },
                        OPTIMIZATION: {
                          label: "Optimization Gap",
                          color: "#34d399",
                          icon: "◆",
                          intervention: "Sharpen what works — A/B test, optimise copy, tighten conversion paths.",
                        },
                      };
                      const gc = gap ? (gapConfig[gap] ?? null) : null;

                      const tones = [
                        {
                          key: "soft",
                          label: "Soft",
                          desc: "Friendly, low-pressure. Best for cold or high-risk leads.",
                        },
                        {
                          key: "consultative",
                          label: "Consultative",
                          desc: "Advisory tone. Lead with insight, not pitch.",
                        },
                        {
                          key: "direct",
                          label: "Direct",
                          desc: "Assertive and confident. Best for warm or low-friction leads.",
                        },
                        {
                          key: "bold",
                          label: "Bold",
                          desc: "Pattern-interrupt. Stands out but requires strong positioning.",
                        },
                      ];

                      const difficultyConfig: Record<string, { label: string; color: string; desc: string }> = {
                        LOW: {
                          label: "Low friction",
                          color: "#4ade80",
                          desc: "Easy to engage — direct or bold tone recommended.",
                        },
                        MEDIUM: {
                          label: "Medium friction",
                          color: "#c9a84c",
                          desc: "Approach carefully — consultative tone works well.",
                        },
                        HIGH: {
                          label: "High friction",
                          color: "#f87171",
                          desc: "Hard to reach — soft or consultative tone only.",
                        },
                      };
                      const dc = difficulty ? (difficultyConfig[difficulty] ?? null) : null;
                      const channelPrimary = !detailLead.company.website ? "Direct visit or phone" : "Email";

                      return (
                        <div className="space-y-3 pt-1">
                          {/* Angle */}
                          {title && (
                            <div className="rounded-xl border border-[#252525] bg-[#0d0d0d] p-4">
                              <p className="text-[9px] uppercase tracking-widest text-[#8a8a8a] mb-1.5">Angle</p>
                              <p className="text-[13px] font-semibold text-[#e8c97a] mb-1">{title}</p>
                              {why && <p className="text-[11px] text-[#999999] leading-relaxed">{why}</p>}
                            </div>
                          )}

                          {/* Gap */}
                          {gc && (
                            <div
                              className="rounded-xl border p-4"
                              style={{ borderColor: `${gc.color}30`, backgroundColor: `${gc.color}06` }}>
                              <div className="flex items-center gap-2 mb-1.5">
                                <span style={{ color: gc.color }}>{gc.icon}</span>
                                <p
                                  className="text-[10px] font-bold uppercase tracking-widest"
                                  style={{ color: gc.color }}>
                                  {gc.label}
                                </p>
                              </div>
                              <p className="text-[11px] text-[#bababa] leading-relaxed">{gc.intervention}</p>
                            </div>
                          )}

                          {/* Friction + channel */}
                          <div className="grid grid-cols-2 gap-2">
                            {dc && (
                              <div className="rounded-xl border border-[#1e1e1e] bg-[#0d0d0d] p-3">
                                <p className="text-[9px] uppercase tracking-widest text-[#737373] mb-1">Friction</p>
                                <p className="text-[11px] font-semibold" style={{ color: dc.color }}>
                                  {dc.label}
                                </p>
                                <p className="text-[10px] text-[#8a8a8a] mt-1 leading-snug">{dc.desc}</p>
                              </div>
                            )}
                            <div className="rounded-xl border border-[#1e1e1e] bg-[#0d0d0d] p-3">
                              <p className="text-[9px] uppercase tracking-widest text-[#737373] mb-1">Channel</p>
                              <p className="text-[11px] font-semibold text-[#c9a84c]">{channelPrimary}</p>
                              <p className="text-[10px] text-[#8a8a8a] mt-1 leading-snug">
                                Best first point of contact
                              </p>
                            </div>
                          </div>

                          {/* Tone guide */}
                          <div className="rounded-xl border border-[#1e1e1e] bg-[#0d0d0d] p-4">
                            <p className="text-[9px] uppercase tracking-widest text-[#737373] mb-2.5">Tone guide</p>
                            <div className="space-y-2">
                              {tones.map((tone) => {
                                const isRecommended = dc
                                  ? (difficulty === "HIGH" && (tone.key === "soft" || tone.key === "consultative")) ||
                                    (difficulty === "MEDIUM" && tone.key === "consultative") ||
                                    (difficulty === "LOW" && (tone.key === "direct" || tone.key === "bold"))
                                  : false;
                                return (
                                  <div
                                    key={tone.key}
                                    className={
                                      "flex items-start gap-2.5 rounded-lg p-2 " +
                                      (isRecommended
                                        ? "bg-[rgba(201,168,76,0.06)] border border-[rgba(201,168,76,0.15)]"
                                        : "")
                                    }>
                                    <span
                                      className={
                                        "text-[10px] mt-0.5 " + (isRecommended ? "text-[#c9a84c]" : "text-[#616161]")
                                      }>
                                      {isRecommended ? "★" : "○"}
                                    </span>
                                    <div>
                                      <p
                                        className={
                                          "text-[11px] font-semibold " +
                                          (isRecommended ? "text-[#c9a84c]" : "text-[#999999]")
                                        }>
                                        {tone.label}
                                      </p>
                                      <p className="text-[10px] text-[#737373] leading-snug">{tone.desc}</p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Open in Outreach CTA */}
                          <button
                            type="button"
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
                              <p className="text-[10px] text-[#8a8a8a] mt-0.5">
                                Signal-driven · 3-stage pipeline · Operator+
                              </p>
                            </div>
                            <span className="text-[#8a6e30] group-hover:text-[#c9a84c] transition-colors text-sm">
                              →
                            </span>
                          </button>
                        </div>
                      );
                    })()}

                  {detailTab === "tracking" &&
                    (() => {
                      const canSave = Number.isFinite(runIdNum) && runIdNum > 0;

                      // Pipeline stage — furthest reached
                      const stage = closed ? 3 : bookedCall ? 2 : replied ? 1 : contacted ? 0 : -1;
                      const stages = [
                        { key: "contacted", label: "Contacted", icon: "✉" },
                        { key: "replied", label: "Replied", icon: "↩" },
                        { key: "booked_call", label: "Booked", icon: "📅" },
                        { key: "closed", label: "Closed", icon: "✦" },
                      ] as const;

                      const lostReason = selectedOutcome?.lost_reason ?? null;
                      const isLost = !!lostReason;

                      const revenueVal = selectedOutcome?.revenue ?? null;
                      const notesVal = selectedOutcome?.notes ?? "";
                      const followupVal = selectedOutcome?.followup_date ?? "";
                      // Derive difficulty for auto follow-up calculation
                      const safeOutreachForTracking = (detailLead?.metadata?.outreach ?? null) as {
                        difficulty?: string;
                      } | null;
                      const difficultyForTracking = safeOutreachForTracking?.difficulty ?? null;
                      const tonalityVal = selectedOutcome?.tonality ?? null;
                      const scoreSnap = selectedOutcome?.score_at_outreach ?? detailLead.score.value ?? null;

                      // Show lost reason picker when contacted but never progressed past contacted, or explicitly stalled
                      const showLostReason = (contacted && !closed) || isLost;

                      const lostReasons: { key: LeadOutcomeUI["lost_reason"]; label: string }[] = [
                        { key: "no_response", label: "No response" },
                        { key: "not_interested", label: "Not interested" },
                        { key: "has_provider", label: "Has provider" },
                        { key: "wrong_timing", label: "Wrong timing" },
                        { key: "price_too_high", label: "Price too high" },
                        { key: "chose_competitor", label: "Chose competitor" },
                        { key: "other", label: "Other" },
                      ];

                      return (
                        <div className="space-y-3 pt-1">
                          {/* Score snapshot */}
                          {scoreSnap !== null && (
                            <div className="rounded-xl border border-[#1a1a1a] bg-[#0d0d0d] px-4 py-3 flex items-center justify-between">
                              <p className="text-[10px] uppercase tracking-widest text-[#737373]">Score at outreach</p>
                              <span
                                className={
                                  "text-sm font-medium " +
                                  (scoreSnap >= 70
                                    ? "text-[#4ade80]"
                                    : scoreSnap >= 50
                                      ? "text-[#c9a84c]"
                                      : "text-[#f87171]")
                                }>
                                {scoreSnap}
                              </span>
                            </div>
                          )}

                          {/* Pipeline funnel */}
                          <div className="rounded-xl border border-[#252525] bg-[#0d0d0d] p-4">
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-[10px] uppercase tracking-widest text-[#8a8a8a]">
                                {t.ui.detail.outcomeTracking}
                              </p>
                              {isSavingOutcome && (
                                <p className="text-[10px] text-[#8a8a8a] animate-pulse">{t.ui.detail.saving}…</p>
                              )}
                            </div>
                            <div className="flex items-stretch gap-1">
                              {stages.map(({ key, label, icon }, i) => {
                                const checked =
                                  key === "contacted"
                                    ? contacted
                                    : key === "replied"
                                      ? replied
                                      : key === "booked_call"
                                        ? bookedCall
                                        : closed;
                                const isActive = i <= stage;
                                const isCurrent = i === stage;
                                return (
                                  <button
                                    key={key}
                                    type="button"
                                    disabled={!canSave || isLost}
                                    onClick={() => {
                                      if (!canSave || isLost) return;
                                      const isFirstContact = key === "contacted" && !contacted;
                                      saveOutcome({
                                        runId: runIdNum,
                                        leadId: detailLead.id,
                                        patch: {
                                          ...buildOutcomePatch(key, !checked),
                                          ...(isFirstContact
                                            ? { score_at_outreach: detailLead.score.value ?? null }
                                            : {}),
                                        },
                                      });
                                    }}
                                    className={
                                      "flex-1 flex flex-col items-center gap-1.5 py-2.5 rounded-lg border transition-all " +
                                      (isLost
                                        ? "opacity-30 cursor-not-allowed border-[#1a1a1a] bg-[#0d0d0d]"
                                        : isCurrent
                                          ? "border-[#c9a84c] bg-[rgba(201,168,76,0.08)]"
                                          : isActive
                                            ? "border-[#4ade80]/30 bg-[#4ade80]/5"
                                            : "border-[#1a1a1a] bg-[#111] hover:border-[#252525]") +
                                      " disabled:cursor-not-allowed"
                                    }>
                                    <span
                                      className={
                                        "text-sm transition-colors " +
                                        (isLost
                                          ? "text-[#616161]"
                                          : isCurrent
                                            ? "text-[#c9a84c]"
                                            : isActive
                                              ? "text-[#4ade80]"
                                              : "text-[#616161]")
                                      }>
                                      {isActive ? (i < stage ? "✓" : icon) : icon}
                                    </span>
                                    <span
                                      className={
                                        "text-[9px] tracking-wide " +
                                        (isLost ? "text-[#616161]" : isActive ? "text-[#bababa]" : "text-[#616161]")
                                      }>
                                      {label}
                                    </span>
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
                                    saveOutcome({
                                      runId: runIdNum,
                                      leadId: detailLead.id,
                                      patch: { lost_reason: null },
                                    });
                                  } else {
                                    // Mark as lost with default reason — user picks reason below
                                    saveOutcome({
                                      runId: runIdNum,
                                      leadId: detailLead.id,
                                      patch: { lost_reason: "no_response" },
                                    });
                                  }
                                }}
                                className={
                                  "flex flex-col items-center gap-1.5 py-2.5 px-2.5 rounded-lg border transition-all disabled:cursor-not-allowed " +
                                  (isLost
                                    ? "border-[#f87171]/50 bg-[#f87171]/10 text-[#f87171]"
                                    : "border-[#1a1a1a] bg-[#111] text-[#8a8a8a] hover:border-[#f87171]/30 hover:text-[#f87171]/70")
                                }>
                                <span className="text-sm">✗</span>
                                <span className="text-[9px] tracking-wide">Lost</span>
                              </button>
                            </div>
                            {isLost && (
                              <p className="text-[11px] text-[#f87171]/70 mt-2 text-center">
                                Marked as lost — select reason below
                              </p>
                            )}
                            {!isLost && stage >= 0 && (
                              <p className="text-[11px] text-[#8a8a8a] mt-2 text-center">
                                {stage === 3 ? t.ui.detail.dealClosed : `${stage + 1} ${t.ui.detail.stagesReached}`}
                              </p>
                            )}
                          </div>

                          {/* Lost reason — shown when contacted but stalled */}
                          {showLostReason && (
                            <div className="rounded-xl border border-[#252525] bg-[#0d0d0d] p-4 space-y-2">
                              <p className="text-[10px] uppercase tracking-widest text-[#8a8a8a]">Lost why</p>
                              <div className="grid grid-cols-2 gap-1.5">
                                {lostReasons.map(({ key, label }) => (
                                  <button
                                    key={key}
                                    type="button"
                                    disabled={!canSave}
                                    onClick={() =>
                                      canSave &&
                                      saveOutcome({
                                        runId: runIdNum,
                                        leadId: detailLead.id,
                                        patch: { lost_reason: lostReason === key ? null : key },
                                      })
                                    }
                                    className={
                                      "px-3 py-2 rounded-lg border text-[11px] transition-all text-left " +
                                      (lostReason === key
                                        ? "border-[#f87171]/40 bg-[#f87171]/8 text-[#f87171]"
                                        : "border-[#1a1a1a] bg-[#111] text-[#8a8a8a] hover:border-[#252525] hover:text-[#bababa]") +
                                      " disabled:cursor-not-allowed"
                                    }>
                                    {label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Tonality used */}
                          <div className="rounded-xl border border-[#252525] bg-[#0d0d0d] p-4 space-y-2">
                            <p className="text-[10px] uppercase tracking-widest text-[#8a8a8a]">Tone</p>
                            <div className="grid grid-cols-2 gap-1.5">
                              {(
                                [
                                  { key: "soft", label: "Soft" },
                                  { key: "consultative", label: "Consultative" },
                                  { key: "direct", label: "Direct" },
                                  { key: "bold", label: "Bold" },
                                ] as const
                              ).map((tone) => (
                                <button
                                  key={tone.key}
                                  type="button"
                                  disabled={!canSave}
                                  onClick={() =>
                                    canSave &&
                                    saveOutcome({
                                      runId: runIdNum,
                                      leadId: detailLead.id,
                                      patch: { tonality: tonalityVal === tone.key ? null : tone.key },
                                    })
                                  }
                                  className={
                                    "py-2 rounded-lg border text-[11px] transition-all " +
                                    (tonalityVal === tone.key
                                      ? "border-[#c9a84c]/40 bg-[rgba(201,168,76,0.08)] text-[#c9a84c]"
                                      : "border-[#1a1a1a] bg-[#111] text-[#8a8a8a] hover:border-[#252525] hover:text-[#bababa]") +
                                    " disabled:cursor-not-allowed"
                                  }>
                                  {tone.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Revenue input */}
                          <div className="rounded-xl border border-[#252525] bg-[#0d0d0d] p-4 space-y-3">
                            <p className="text-[10px] uppercase tracking-widest text-[#8a8a8a]">
                              {t.ui.detail.dealValue}
                            </p>
                            {(() => {
                              const loc = (location ?? "").toLowerCase();
                              const sym =
                                loc.includes("sweden") ||
                                loc.includes("sverige") ||
                                loc.includes("stockholm") ||
                                loc.includes("göteborg") ||
                                loc.includes("malmö") ||
                                loc.includes(", se") ||
                                loc.endsWith(" se")
                                  ? "kr"
                                  : loc.includes("uk") || loc.includes("london") || loc.includes("england")
                                    ? "£"
                                    : loc.includes("euro") ||
                                        loc.includes("germany") ||
                                        loc.includes("france") ||
                                        loc.includes("spain")
                                      ? "€"
                                      : "$";
                              return (
                                <>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[#8a8a8a] text-sm">{sym}</span>
                                    <input
                                      type="number"
                                      min="0"
                                      placeholder="0"
                                      defaultValue={revenueVal ?? ""}
                                      disabled={!canSave}
                                      onBlur={(e: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
                                        if (!canSave) return;
                                        const v = parseFloat(e.target.value);
                                        saveOutcome({
                                          runId: runIdNum,
                                          leadId: detailLead.id,
                                          patch: { revenue: Number.isFinite(v) ? v : null },
                                        });
                                      }}
                                      className="flex-1 bg-[#111] border border-[#252525] rounded-lg px-3 py-2 text-sm text-[#f5f0e8] placeholder-[#333] focus:outline-none focus:border-[rgba(201,168,76,0.4)] transition-colors disabled:opacity-40"
                                    />
                                  </div>
                                  {closed && revenueVal && (
                                    <p className="text-[11px] text-[#4ade80]">
                                      ✦ {sym}
                                      {revenueVal.toLocaleString()} closed
                                    </p>
                                  )}
                                </>
                              );
                            })()}
                          </div>

                          {/* Notes */}
                          <div className="rounded-xl border border-[#252525] bg-[#0d0d0d] p-4 space-y-2">
                            <p className="text-[10px] uppercase tracking-widest text-[#8a8a8a]">{t.ui.detail.notes}</p>
                            <textarea
                              rows={3}
                              placeholder="Objections, context, follow-up reminders…"
                              defaultValue={notesVal ?? ""}
                              disabled={!canSave}
                              onBlur={(e: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
                                if (!canSave) return;
                                saveOutcome({
                                  runId: runIdNum,
                                  leadId: detailLead.id,
                                  patch: { notes: e.target.value.trim() || null },
                                });
                              }}
                              className="w-full bg-[#111] border border-[#252525] rounded-lg px-3 py-2 text-[12px] text-[#c8c0b0] placeholder-[#333] focus:outline-none focus:border-[rgba(201,168,76,0.4)] transition-colors resize-none disabled:opacity-40"
                            />
                            <p className="text-[10px] text-[#616161]">{t.ui.detail.savesOnBlur}</p>
                          </div>

                          {/* Activity log — sent emails for this lead */}
                          {(() => {
                            const leadEmails = (() => {
                              try {
                                const key = `vantio_activity_${detailLead.id}`;
                                return JSON.parse(localStorage.getItem(key) ?? "[]") as Array<{
                                  subject: string;
                                  to: string;
                                  sentAt: string;
                                  body: string;
                                }>;
                              } catch {
                                return [];
                              }
                            })();
                            if (leadEmails.length === 0) return null;
                            return (
                              <div className="rounded-xl border border-[#252525] bg-[#0d0d0d] p-4 space-y-3">
                                <p className="text-[10px] uppercase tracking-widests text-[#8a8a8a]">Sent messages</p>
                                <div className="space-y-2">
                                  {leadEmails.map((e, i) => (
                                    <div
                                      key={i}
                                      className="rounded-lg border border-[#1a1a1a] bg-[#080808] px-3 py-2.5 space-y-1">
                                      <div className="flex items-center justify-between gap-2">
                                        <p className="text-[12px] font-medium text-[#c8c0b0] truncate">{e.subject}</p>
                                        <p className="text-[10px] text-[#616161] flex-shrink-0">
                                          {new Date(e.sentAt).toLocaleDateString()}
                                        </p>
                                      </div>
                                      <p className="text-[10px] text-[#737373]">To: {e.to}</p>
                                      <p className="text-[11px] text-[#8a8a8a] line-clamp-2 leading-relaxed">
                                        {e.body}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })()}

                  {detailTab === "followup" &&
                    (() => {
                      const canSaveFollowup = Number.isFinite(runIdNum) && runIdNum > 0;
                      const followupVal = selectedOutcome?.followup_date ?? "";
                      const closedFU = !!selectedOutcome?.closed;
                      const CH_ICONS_FU: Record<string, string> = { email: "✉", call: "☎", dm: "◎", linkedin: "in" };
                      const CH_LABELS_FU: Record<string, string> = {
                        email: "Email",
                        call: "Call",
                        dm: "DM",
                        linkedin: "LinkedIn",
                      };
                      const ST_STYLES_FU: Record<string, { color: string; label: string }> = {
                        pending: { color: "#555", label: "Pending" },
                        sent: { color: "#3b82f6", label: "Sent" },
                        replied: { color: "#4ade80", label: "Replied" },
                        skipped: { color: "#333", label: "Skipped" },
                      };
                      const CAD_LABELS_FU: Record<string, string> = {
                        aggressive: "Hot cadence",
                        standard: "Standard cadence",
                        nurture: "Nurture cadence",
                      };

                      async function buildSeq() {
                        if (!detailLead || sequenceGenerating) return;
                        setSequenceGenerating(true);
                        try {
                          const res = await fetch("/api/sequences", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              leadId: detailLead.id,
                              runId: Number(detailLead.metadata.runId),
                              companyName: detailLead.company.name,
                              outreachRequest: {
                                company_name: detailLead.company.name,
                                industry: detailLead.classification.primaryIndustry ?? null,
                                city: detailLead.company.city ?? null,
                                website: detailLead.company.website ?? null,
                                rating: detailLead.metrics.rating ?? null,
                                review_count: detailLead.metrics.reviewCount ?? null,
                                social_presence: detailLead.metrics.socialPresence ?? null,
                                opportunity: detailLead.score.opportunity ?? 0,
                                readiness: detailLead.score.readiness ?? 0,
                                risk: detailLead.score.risk ?? 0,
                                signals: enrichmentSignals ?? {},
                                matched_needs: detailLead.fit?.matchedNeeds ?? [],
                                missing_needs: detailLead.fit?.missingNeeds ?? [],
                                fit_score: detailLead.fit?.fitScore ?? 50,
                                language: language,
                              },
                              opportunity: detailLead.score.opportunity ?? 0,
                              fitScore: detailLead.fit?.fitScore ?? 50,
                              riskProfile: detailLead.score.riskProfile ?? "unknown",
                            }),
                          });
                          if (res.ok) {
                            const data = (await res.json()) as { steps?: typeof sequenceSteps };
                            setSequenceSteps(data.steps ?? []);
                          }
                        } finally {
                          setSequenceGenerating(false);
                        }
                      }

                      async function patchSeqStep(stepId: number, status: string) {
                        const res = await fetch(`/api/sequences/${stepId}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ status }),
                        });
                        if (res.ok)
                          setSequenceSteps((prev) => prev.map((s) => (s.id === stepId ? { ...s, status } : s)));
                      }

                      if (sequenceLoading)
                        return <div className="py-8 text-center text-[#737373] text-sm animate-pulse">Loading…</div>;

                      // Next pending step from sequence
                      const nextSeqStep =
                        sequenceSteps
                          .filter((s) => s.status === "pending")
                          .sort(
                            (a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime(),
                          )[0] ?? null;

                      return (
                        <div className="space-y-4 pt-1">
                          {/* Follow-up reminder — sequence driven */}
                          {nextSeqStep ? (
                            (() => {
                              const daysOff = Math.round(
                                (new Date(nextSeqStep.scheduled_date).setHours(0, 0, 0, 0) -
                                  new Date().setHours(0, 0, 0, 0)) /
                                  86400000,
                              );
                              const overdue = daysOff < 0;
                              const tod = daysOff === 0;
                              const dateColor = overdue ? "#f87171" : tod ? "#c9a84c" : "#4ade80";
                              const dateLabel = overdue
                                ? `${Math.abs(daysOff)}d overdue`
                                : tod
                                  ? "Today"
                                  : daysOff === 1
                                    ? "Tomorrow"
                                    : `In ${daysOff}d`;
                              const sentCount = sequenceSteps.filter(
                                (s) => s.status === "sent" || s.status === "replied",
                              ).length;
                              const totalCount = sequenceSteps.length;
                              return (
                                <div className="rounded-xl border border-[#252525] bg-[#0d0d0d] p-4 space-y-3">
                                  <div className="flex items-center justify-between">
                                    <p className="text-[10px] uppercase tracking-widest text-[#8a8a8a]">Next Touch</p>
                                    <span className="text-[9px] px-2 py-0.5 rounded-full border border-[#252525] text-[#737373]">
                                      {sentCount}/{totalCount} steps sent
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <div
                                      className="flex-shrink-0 rounded-lg border px-3 py-2 text-center min-w-[64px]"
                                      style={{ borderColor: `${dateColor}30`, background: `${dateColor}08` }}>
                                      <p className="text-[12px] font-semibold" style={{ color: dateColor }}>
                                        {dateLabel}
                                      </p>
                                      <p className="text-[9px] mt-0.5" style={{ color: `${dateColor}70` }}>
                                        {new Date(nextSeqStep.scheduled_date).toLocaleDateString("en-GB", {
                                          day: "numeric",
                                          month: "short",
                                        })}
                                      </p>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-1.5 mb-1">
                                        <span className="text-[11px] text-[#8a8a8a]">
                                          {CH_ICONS_FU[nextSeqStep.channel]}
                                        </span>
                                        <span className="text-[10px] text-[#737373]">
                                          {CH_LABELS_FU[nextSeqStep.channel]}
                                        </span>
                                        <span className="text-[10px] text-[#2a2a2a]">· Step {nextSeqStep.step}</span>
                                      </div>
                                      <p className="text-[11px] text-[#999999] truncate">{nextSeqStep.objective}</p>
                                    </div>
                                  </div>
                                  <div className="h-1 w-full bg-[#1a1a1a] rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-[#c9a84c] rounded-full transition-all"
                                      style={{ width: `${totalCount > 0 ? (sentCount / totalCount) * 100 : 0}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })()
                          ) : (
                            <div className="rounded-xl border border-[#252525] bg-[#0d0d0d] p-4 space-y-2">
                              <div className="flex items-center justify-between">
                                <p className="text-[10px] uppercase tracking-widest text-[#8a8a8a]">Manual Follow-up</p>
                                {followupVal &&
                                  !closedFU &&
                                  (() => {
                                    const diff = Math.ceil((new Date(followupVal).getTime() - Date.now()) / 86400000);
                                    const ov = diff < 0;
                                    const td = diff === 0;
                                    return (
                                      <span
                                        className={
                                          "text-[10px] px-2 py-0.5 rounded-full border " +
                                          (ov
                                            ? "border-[#f87171]/30 text-[#f87171]"
                                            : td
                                              ? "border-[#c9a84c]/30 text-[#c9a84c]"
                                              : "border-[#4ade80]/20 text-[#4ade80]")
                                        }>
                                        {ov ? `${Math.abs(diff)}d overdue` : td ? "Today" : `In ${diff}d`}
                                      </span>
                                    );
                                  })()}
                              </div>
                              <input
                                type="date"
                                disabled={!canSaveFollowup}
                                defaultValue={followupVal || ""}
                                key={followupVal || "no-date"}
                                onBlur={(e: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
                                  if (!canSaveFollowup) return;
                                  saveOutcome({
                                    runId: runIdNum,
                                    leadId: detailLead.id,
                                    patch: { followup_date: e.target.value || null },
                                  });
                                }}
                                className="w-full bg-[#111] border border-[#252525] rounded-lg px-3 py-2 text-[12px] text-[#c8c0b0] focus:outline-none focus:border-[rgba(201,168,76,0.4)] transition-colors disabled:opacity-40 [color-scheme:dark]"
                              />
                              <p className="text-[10px] text-[#616161]">
                                Build a sequence below for smarter scheduling
                              </p>
                            </div>
                          )}

                          {/* Sequence builder */}
                          <div>
                            <div className="flex items-center gap-3 mb-3">
                              <p className="text-[10px] uppercase tracking-widest text-[#616161]">Outreach Sequence</p>
                              <div className="flex-1 h-px bg-[#141414]" />
                              <button
                                type="button"
                                onClick={buildSeq}
                                disabled={sequenceGenerating}
                                className="px-3 py-1.5 rounded-xl border border-[rgba(201,168,76,0.3)] text-[11px] text-[#c9a84c] hover:bg-[rgba(201,168,76,0.06)] disabled:opacity-40 transition-all">
                                {sequenceGenerating
                                  ? "Generating…"
                                  : sequenceSteps.length > 0
                                    ? "↻ Rebuild"
                                    : "⇉ Build Sequence"}
                              </button>
                            </div>
                            {sequenceGenerating ? (
                              <div className="rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] p-6 text-center space-y-2">
                                <div className="w-5 h-5 border border-[#c9a84c] border-t-transparent rounded-full animate-spin mx-auto" />
                                <p className="text-[12px] text-[#8a8a8a]">Generating sequence…</p>
                              </div>
                            ) : sequenceSteps.length === 0 ? (
                              <div className="rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] p-5 text-center space-y-1.5">
                                <p className="text-[13px] text-[#2a2a2a]">⇉</p>
                                <p className="text-[12px] text-[#737373]">No sequence yet</p>
                                <p className="text-[11px] text-[#2a2a2a] leading-relaxed">
                                  Build a 5-step cadence tailored to this lead&apos;s gap type and signals.
                                </p>
                              </div>
                            ) : (
                              <div className="space-y-1.5">
                                {sequenceSteps.map((step) => {
                                  const isExp = sequenceExpandedStep === step.id;
                                  const st = ST_STYLES_FU[step.status] ?? ST_STYLES_FU.pending;
                                  const daysOff = Math.round(
                                    (new Date(step.scheduled_date).setHours(0, 0, 0, 0) -
                                      new Date().setHours(0, 0, 0, 0)) /
                                      86400000,
                                  );
                                  const dayStr =
                                    daysOff < 0
                                      ? `${Math.abs(daysOff)}d overdue`
                                      : daysOff === 0
                                        ? "Today"
                                        : daysOff === 1
                                          ? "Tomorrow"
                                          : `Day ${step.day_offset}`;
                                  const dayClr = daysOff < 0 ? "#f87171" : daysOff === 0 ? "#c9a84c" : "#555";
                                  return (
                                    <div key={step.id} className="rounded-xl border border-[#1a1a1a] overflow-hidden">
                                      <div
                                        className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-[#111] transition-colors"
                                        onClick={() => setSequenceExpandedStep(isExp ? null : step.id)}>
                                        <span className="text-[10px] text-[#2a2a2a] w-3">{step.step}</span>
                                        <span className="text-[11px] w-20 font-medium" style={{ color: dayClr }}>
                                          {dayStr}
                                        </span>
                                        <span className="text-[11px] text-[#737373] w-14">
                                          {CH_ICONS_FU[step.channel]} {CH_LABELS_FU[step.channel]}
                                        </span>
                                        <span className="flex-1 text-[11px] text-[#8a8a8a] truncate">
                                          {step.objective}
                                        </span>
                                        <span className="text-[10px]" style={{ color: st.color }}>
                                          {st.label}
                                        </span>
                                        <span className="text-[10px] text-[#1a1a1a]">{isExp ? "▲" : "▼"}</span>
                                      </div>
                                      {isExp && (
                                        <div className="px-3 pb-3 pt-2 bg-[#0a0a0a] space-y-2 border-t border-[#0f0f0f]">
                                          {step.subject && (
                                            <div>
                                              <p className="text-[9px] uppercase tracking-widest text-[#2a2a2a] mb-1">
                                                Subject
                                              </p>
                                              <p className="text-[12px] text-[#ababab]">{step.subject}</p>
                                            </div>
                                          )}
                                          <div>
                                            <p className="text-[9px] uppercase tracking-widest text-[#2a2a2a] mb-1.5">
                                              Message
                                            </p>
                                            <p className="text-[12px] text-[#c8c0b0] leading-relaxed whitespace-pre-wrap">
                                              {step.message}
                                            </p>
                                          </div>
                                          <div>
                                            <p className="text-[9px] uppercase tracking-widest text-[#2a2a2a] mb-1">
                                              CTA
                                            </p>
                                            <p className="text-[11px] text-[#8a8a8a]">{step.cta}</p>
                                          </div>
                                          <div className="flex gap-2 pt-0.5 flex-wrap">
                                            {step.status === "pending" && (
                                              <>
                                                <button
                                                  type="button"
                                                  onClick={() => patchSeqStep(step.id, "sent")}
                                                  className="px-3 py-1.5 rounded-lg border border-[#3b82f6]/25 text-[10px] text-[#3b82f6] hover:bg-[#3b82f6]/08 transition-all">
                                                  ✓ Sent
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => patchSeqStep(step.id, "skipped")}
                                                  className="px-3 py-1.5 rounded-lg border border-[#252525] text-[10px] text-[#737373] hover:border-[#333] transition-all">
                                                  Skip
                                                </button>
                                              </>
                                            )}
                                            {step.status === "sent" && (
                                              <button
                                                type="button"
                                                onClick={() => patchSeqStep(step.id, "replied")}
                                                className="px-3 py-1.5 rounded-lg border border-[#4ade80]/25 text-[10px] text-[#4ade80] hover:bg-[#4ade80]/08 transition-all">
                                                ✓ Got reply
                                              </button>
                                            )}
                                            {step.status === "replied" && (
                                              <span className="text-[10px] text-[#4ade80]">🎉 Replied</span>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                                <a
                                  href="/followups"
                                  className="block text-center text-[11px] text-[#616161] hover:text-[#c9a84c] transition-colors pt-1">
                                  View all sequences →
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                </div>
              </div>
            </>,
            document.body,
          )}
      </main>
    </>
  );
}
