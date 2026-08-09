"use client";

import Link from "next/link";
import PageTutorial from "../components/PageTutorial";
import FeedbackPrompt from "../components/FeedbackPrompt";
import { useBetaStatus } from "@/lib/beta/useBetaStatus";
import type { TutorialKey } from "@/lib/beta/tutorialDefinitions";
import React, {
  Fragment,
  useEffect,
  useMemo,
  useRef,
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
import Sidebar from "../components/Sidebar";
import LeadDetailModal from "../components/LeadDetailModal";
import { useLeadDetailPanel } from "../hooks/useLeadDetailPanel";
import { applyDeepScanToLead } from "../hooks/useLeadDetailPanel";
import { createSupabaseBrowser } from "@/lib/supabaseBrowser";
import type { TranslationSchema as Translations } from "@/lib/i18n/types";
import type { SocialPresenceFilter } from "@/lib/providers/types";
import { useToast } from "../components/ToastProvider";
import { getSearchQueries } from "@/lib/niche/synonyms";
import { dedupeLeads } from "@/lib/search/dedupeLeads";
import { createPortal } from "react-dom";

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

export type OutreachVariant = "soft" | "consultative" | "direct" | "bold";

export type DetailTabKey = "overview" | "signals" | "outreach" | "tracking" | "followup";

export type LeadUI = Lead & {
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

export type LeadOutcomeUI = {
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

export type OutcomeKey = "contacted" | "replied" | "booked_call" | "closed";

export function buildOutcomePatch(key: OutcomeKey, value: boolean): Partial<Record<OutcomeKey, boolean>> {
  const patch: Partial<Record<OutcomeKey, boolean>> = {};
  patch[key] = value;
  return patch;
}

function leadLocation(lead: Lead): string {
  const parts = [lead.company.city, lead.company.country].filter(Boolean);
  return parts.length ? parts.join(", ") : "Unknown";
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

export function riskTitleFromProfile(p: Lead["score"]["riskProfile"] | null | undefined, t: Translations): string {
  if (!p || p === "unknown") return t.ui.table.riskProfile.none ?? "";
  const profileMap = t.ui.table.riskProfile as Record<string, string>;
  return profileMap[p] ?? p.replace(/_/g, " ");
}

export function riskMessage(language: Language, lead: Lead): string {
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
// Gap label — the short "why this lead" line shown on both the mobile
// card view and the desktop table row. Extracted here so both use the
// exact same reasoning rather than two separately-maintained copies.
// ---------------------
export function getGapLabel(lead: LeadUI, insight: OpportunitySignal | null, t: Translations): string {
  return insight?.type === "conversion_gap"
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
}

// ---------------------
// Score explanation
// ---------------------
export function getScoreReason(lead: Lead, language: Language): string {
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
export type StructuredAngle = { title: string; why: string; body: string };

export function getStructuredAngle(lead: LeadUI, language: Language): StructuredAngle {
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

// ── Search Progress Overlay ───────────────────────────────────────────────────
function SearchProgressOverlay({ pct, label }: { pct: number; label: string }) {
  const r = 44,
    circ = 2 * Math.PI * r;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(8,8,8,0.88)",
        backdropFilter: "blur(8px)",
      }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 28 }}>
        <div style={{ position: "relative", width: 120, height: 120 }}>
          <svg style={{ width: "100%", height: "100%", transform: "rotate(-90deg)" }} viewBox="0 0 100 100">
            <circle cx="50" cy="50" r={r} fill="none" stroke="#1a1a1a" strokeWidth="5" />
            <circle
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke="#c9a84c"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={circ * (1 - pct / 100)}
              style={{ transition: "stroke-dashoffset 0.6s ease" }}
            />
          </svg>
          <div
            style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 22, fontWeight: 700, color: "#c9a84c", fontFamily: "monospace" }}>
              {Math.round(pct)}%
            </span>
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: 15, fontWeight: 500, color: "#f5f0e8", marginBottom: 6 }}>{label}</p>
          <p
            style={{
              fontSize: 10,
              color: "#737373",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              fontFamily: "monospace",
            }}>
            AI-powered discovery
          </p>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#c9a84c",
                animation: `pulse 1.4s ease-in-out ${i * 0.18}s infinite`,
              }}
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
      href: "/settings",
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
// Lightweight tooltip. Supports **bold** markers for section labels.
// Use "**Label** explanation text" format in tooltip strings.
// Desktop: hover to show, mouse-leave to hide (unchanged behavior).
// Touch: tap to show, dismiss on tap-anywhere-else or on scroll — touch
// devices simulate mouseenter on tap but never fire mouseleave (there's
// no cursor to "leave" with), so relying on hover alone left the tooltip
// stuck open indefinitely on mobile.
export function ScoreTooltip({
  text,
  children,
  inline = false,
}: {
  text: string;
  children: React.ReactNode | React.ReactNode[];
  inline?: boolean;
}) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!rect) return;

    function handleOutsideInteraction(e: Event) {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        setRect(null);
      }
    }
    function handleScroll() {
      setRect(null);
    }

    document.addEventListener("touchstart", handleOutsideInteraction, { passive: true });
    document.addEventListener("mousedown", handleOutsideInteraction);
    window.addEventListener("scroll", handleScroll, { capture: true, passive: true });

    return () => {
      document.removeEventListener("touchstart", handleOutsideInteraction);
      document.removeEventListener("mousedown", handleOutsideInteraction);
      window.removeEventListener("scroll", handleScroll, { capture: true });
    };
  }, [rect]);

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

  // Clamp within the viewport on BOTH edges — the tooltip is horizontally
  // centered on this point via translateX(-50%), so a naive right-only
  // clamp (the old behavior) still let it clip off the LEFT edge when the
  // trigger sat near the left side of a narrow screen.
  const TOOLTIP_HALF_WIDTH = 140; // half of maxWidth (280) — matches the centering transform
  const VIEWPORT_MARGIN = 12;
  const clampedLeft = rect
    ? Math.min(
        Math.max(rect.left + rect.width / 2, TOOLTIP_HALF_WIDTH + VIEWPORT_MARGIN),
        window.innerWidth - TOOLTIP_HALF_WIDTH - VIEWPORT_MARGIN,
      )
    : 0;

  return (
    <span
      ref={triggerRef}
      style={{ position: "relative", display: "inline-block", ...(inline ? {} : { width: "100%" }) }}
      onMouseEnter={(e) => setRect((e.currentTarget as HTMLElement).getBoundingClientRect())}
      onMouseLeave={() => setRect(null)}
      onClick={(e) => {
        e.stopPropagation();
        setRect((prev) => (prev ? null : (e.currentTarget as HTMLElement).getBoundingClientRect()));
      }}>
      {children}
      {rect &&
        typeof window !== "undefined" &&
        createPortal(
          <div
            style={{
              position: "fixed",
              left: clampedLeft,
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

  const [language] = useState<Language>(() => {
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
  const betaStatus = useBetaStatus();
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
  // Drives the "search" tutorial trigger — the first genuine interaction
  // with the search panel, distinct from just having landed on the page
  // (which triggers the "dashboard" tutorial instead).
  const [hasInteractedWithSearch, setHasInteractedWithSearch] = useState(false);
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
  const [, setBulkAction] = useState<"contacted" | "replied" | "booked" | null>(null);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchProgress, setSearchProgress] = useState<{ pct: number; label: string } | null>(null);
  const [searchMode, setSearchMode] = useState<"standard" | "deep">("standard");
  const [hasSearched, setHasSearched] = useState(false);

  const [recentSearches, setRecentSearches] = useState<SearchRecord[]>([]);
  const [saveSearchName, setSaveSearchName] = useState("");
  const [showSaveSearchInput, setShowSaveSearchInput] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const panel = useLeadDetailPanel({
    language,
    onLeadRescored: (rescored) => {
      setLeads((prev: LeadUI[]) => prev.map((l: LeadUI) => (l.id === rescored.id ? rescored : l)));
    },
    onOutcomeSaved: () => {
      setChecklistState((prev: typeof checklistState) => ({ ...prev, hasOutcome: true }));
    },
  });
  const {
    selectedLead,
    setSelectedLead,
    detailTab,
    setDetailTab,
    activeTabUI,
    setActiveTabUI,
    isTabPending,
    snapshot,
    setSnapshot,
    snapshotLoading,
    setSnapshotLoading,
    sequenceSteps,
    setSequenceSteps,
    sequenceLoading,
    setSequenceLoading,
    sequenceGenerating,
    setSequenceGenerating,
    sequenceExpandedStep,
    setSequenceExpandedStep,
    saveOutcome,
    toggleSaveLead,
    deepEnrichmentData,
    setDeepScanData,
    deepEnrichmentLoading,
    setDeepScanLoading,
    enrichmentData,
    setEnrichmentData,
    enrichmentLoading,
    setEnrichmentLoading,
    isRescoring,
    setIsRescoring,
    isSavingOutcome,
    setIsSavingOutcome,
    savedLeadIds,
    setSavedLeadIds,
    runDeepScan,
    outreachVariant,
    setOutreachVariant,
    outcomesByLeadId,
    setOutcomesByLeadId,
  } = panel;

  // Fires whenever a genuinely different lead is opened, regardless of
  // which of the several click handlers (desktop row, mobile card, etc.)
  // triggered it — one centralized effect instead of duplicating the log
  // call at every entry point.
  useEffect(() => {
    if (!selectedLead || !betaStatus.active) return;
    fetch("/api/analytics/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "lead_opened" }),
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLead?.id]);

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

  const userPlan = getEffectivePlan();
  const deepEnrichmentUnlocked = canUseDeepEnrichment(userPlan);

  // Reset snapshot when selected lead changes
  useEffect(() => {
    setSnapshot(null);
    setSnapshotLoading(false);
  }, [selectedLead?.id]);

  const [runId, setRunId] = useState<number | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [exhausted, setExhausted] = useState(false);

  // Deep-linking: opens a specific run/lead directly when the page loads
  // with ?runId=&leadId= in the URL — e.g. from the Home page's "Prepare
  // outreach" link (see app/home/page.tsx). Reads window.location directly
  // rather than Next.js's useSearchParams(), since that hook requires a
  // Suspense boundary around whatever uses it, and this file isn't
  // currently wrapped in one — reading the URL directly in an effect
  // avoids that requirement entirely for this narrow, client-only need.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const deepLinkRunId = params.get("runId");
    const deepLinkLeadId = params.get("leadId");
    if (!deepLinkRunId) return;

    const parsedRunId = Number(deepLinkRunId);
    if (!Number.isFinite(parsedRunId)) return;

    (async () => {
      try {
        const res = await fetch(`/api/providers/runs/${parsedRunId}/leads`);
        if (!res.ok) {
          console.error(`[deep-link] runs/${parsedRunId}/leads returned ${res.status}`);
          return;
        }
        const data = (await res.json().catch(() => ({}))) as {
          leads?: LeadUI[];
          nextCursor?: string | null;
          exhausted?: boolean;
        };
        const fetchedLeads = Array.isArray(data.leads) ? data.leads : [];
        if (fetchedLeads.length === 0) {
          console.error(`[deep-link] runs/${parsedRunId}/leads returned zero leads`);
          return;
        }

        setLeads(fetchedLeads);
        setRunId(parsedRunId);
        setNextCursor(data.nextCursor ?? null);
        setExhausted(data.exhausted ?? true);

        if (deepLinkLeadId) {
          const match = fetchedLeads.find((l) => l.id === deepLinkLeadId);
          if (match) {
            setSelectedLead(match);
          } else {
            console.error(
              `[deep-link] leadId "${deepLinkLeadId}" not found among ${fetchedLeads.length} fetched leads. First few ids:`,
              fetchedLeads.slice(0, 5).map((l) => l.id),
            );
          }
        }
      } catch {
        // Deep link failed to resolve — fall through to the normal empty
        // dashboard state rather than blocking the page.
      }
    })();
    // Intentionally runs once on mount only — this is a one-time entry
    // action, not something that should re-fire on other state changes.
  }, []);

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
    const priority = { high: 3, medium: 2, low: 1 } as const;

    function primaryValue(lead: LeadUI): number {
      if (sortBy === "confidence") return lead.classification.confidence ?? 0;
      if (sortBy === "opportunity") return lead.score.opportunity ?? 0;
      if (sortBy === "risk") return -(lead.score.risk ?? 0); // lower risk = "higher" in sort terms
      if (sortBy === "fit") return lead.fit?.fitScore ?? 0;
      return lead.score.value ?? 0; // "score" — the main/final score, genuinely sorted now
    }

    arr.sort((a: LeadUI, b: LeadUI) => {
      const diff = primaryValue(b) - primaryValue(a);
      if (diff !== 0) return diff;
      // Tiebreaker only — previously this ran as a second, unconditional
      // full re-sort that silently overrode every sort option (not just
      // "score"). Now it only decides ordering between leads that are
      // genuinely tied on whatever the user actually selected.
      const ai = normalizeLegacyOrNewOpportunityInsight(a);
      const bi = normalizeLegacyOrNewOpportunityInsight(b);
      return priority[bi?.strength ?? "low"] - priority[ai?.strength ?? "low"];
    });
    return arr;
  }, [filteredLeads, sortBy]);

  // Picks exactly one contextually-relevant tutorial key at a time, so
  // there's never a risk of multiple tutorials trying to show
  // simultaneously as the user navigates between states. Lead-specific
  // views take priority over the general results/dashboard orientation.
  const activeTutorialKey = useMemo<TutorialKey>(() => {
    if (selectedLead) {
      if (detailTab === "outreach") return "outreach";
      if (detailTab === "tracking") return "outcomes";
      return "lead_focus";
    }
    if (sortedLeads.length > 0) return "results";
    if (hasInteractedWithSearch) return "search";
    return "dashboard";
  }, [selectedLead, detailTab, sortedLeads.length, hasInteractedWithSearch]);

  const LEADS_PER_BATCH = 20;
  const [displayCount, setDisplayCount] = useState(LEADS_PER_BATCH);
  // Only reset displayCount when the user runs a new search (niche+location changes),
  // NOT when background expansion silently adds more leads to the existing list.
  const searchKey = `${niche}::${location}`;
  useEffect(() => {
    setDisplayCount(LEADS_PER_BATCH);
  }, [searchKey]);
  const visibleLeads = useMemo(() => sortedLeads.slice(0, displayCount), [sortedLeads, displayCount]);
  // Show more locally if available, otherwise need API fetch
  const hasMoreLocal = displayCount < sortedLeads.length;
  const hasMoreRemote = !exhausted && nextCursor !== null && runId !== null;
  const hasMore = hasMoreLocal || hasMoreRemote;

  const activeRunId = useMemo(() => {
    const v = Number(sortedLeads?.[0]?.metadata?.runId ?? 0);
    return Number.isFinite(v) && v > 0 ? v : 0;
  }, [sortedLeads]);

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
    // Intentionally depends only on the id, not the whole selectedLead object —
    // this should re-trigger on lead *selection*, not on every data refresh of the same lead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        checklistCompleted?: boolean;
        checklistHasSearched?: boolean;
        checklistHasSelected?: boolean;
        checklistHasOutcome?: boolean;
      };
      // Only restore the dismiss/completed preference — NOT
      // hasSearched/hasSelected/hasOutcome individually. Those are derived
      // from real data (Supabase searches + session actions) to prevent
      // stale state from a previous session appearing on fresh accounts.
      // checklistCompleted is the one exception: it's a permanent latch set
      // once all four conditions are true in any session, specifically so
      // the panel doesn't reappear just because hasSelected/hasOutcome
      // (session-only signals) reset to false on the next page load.
      const storedUid = (parsed as { userId?: string }).userId ?? "";
      const currentUid = localStorage.getItem("vantio_uid") ?? "";
      if (storedUid && currentUid && storedUid === currentUid) {
        if (parsed.checklistDismissed) setChecklistDismissed(true);
        if (parsed.checklistCompleted) setChecklistCompleted(true);
      } else if (!storedUid) {
        // Legacy state without userId — still respect dismiss, ignore progress
        if (parsed.checklistDismissed) setChecklistDismissed(true);
        if (parsed.checklistCompleted) setChecklistCompleted(true);
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
  const [checklistCompleted, setChecklistCompleted] = useState(false);
  const [checklistState, setChecklistState] = useState({
    hasProfile: false,
    hasSearched: false,
    hasSelected: false,
    hasOutcome: false,
  });
  const [profileChecked, setProfileChecked] = useState(false); // true once profile API has responded

  // Permanently latch completion the moment all four are true in any
  // session. hasSelected/hasOutcome are session-only signals that reset to
  // false on every fresh page load — without this latch, a user who fully
  // completed the checklist once would see it reappear on their next visit.
  useEffect(() => {
    if (
      checklistState.hasProfile &&
      checklistState.hasSearched &&
      checklistState.hasSelected &&
      checklistState.hasOutcome
    ) {
      setChecklistCompleted(true);
    }
  }, [checklistState.hasProfile, checklistState.hasSearched, checklistState.hasSelected, checklistState.hasOutcome]);

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
          checklistCompleted,
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
    checklistCompleted,
    checklistState.hasSearched,
    checklistState.hasSelected,
    checklistState.hasOutcome,
  ]);

  // =====================
  // HANDLERS
  // =====================

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!niche.trim() || !location.trim()) return;

    setIsLoading(true);
    setSearchError(null);
    setLeads([]);
    setSelectedLead(null);
    setHasSearched(true);
    setChecklistState((prev: typeof checklistState) => ({ ...prev, hasSearched: true }));

    // Smooth progress ring — 1% every 600ms (~60s), stops when server responds
    let currentPct = 0;
    const LABELS: Record<number, string> = {
      0: "Planning your search…",
      15: "Searching Google Maps…",
      30: searchMode === "deep" ? "AI generating query variants…" : "Searching SERP directory…",
      50: "Searching multiple sources…",
      70: "Scoring leads…",
      88: "Almost ready…",
    };
    setSearchProgress({ pct: 0, label: LABELS[0] });
    const progressTimer = setInterval(() => {
      currentPct = Math.min(currentPct + 1, 98);
      const label =
        Object.entries(LABELS)
          .filter(([t]) => currentPct >= Number(t))
          .pop()?.[1] ?? "Searching…";
      setSearchProgress({ pct: currentPct, label });
    }, 600);

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
          searchMode,
        }),
      }).catch(() => null);

      clearInterval(progressTimer);
      setSearchProgress({ pct: 95, label: "Loading results…" });

      if (!discoverRes?.ok) throw new Error("Search failed — please try again.");

      const discoverData = (await discoverRes.json()) as {
        ok: boolean;
        runIds: number[];
        primaryRunId: number | null;
        code?: string;
        error?: string;
        deepSearchesRemaining?: number;
      };

      console.log("[search] discover response:", discoverData);

      if (!discoverData.ok) {
        if (discoverData.code === "DEEP_SEARCH_LIMIT") {
          toastError(discoverData.error ?? "Deep search limit reached for this month.");
        } else {
          toastInfo("No leads found — try a different niche or location");
        }
        return;
      }

      if (!discoverData.primaryRunId || discoverData.runIds.length === 0) {
        toastInfo("No leads found — try a different niche or location");
        return;
      }

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
      await new Promise((r) => setTimeout(r, 200));

      setLeads(deduped);
      setRunId(discoverData.primaryRunId);
      setNextCursor(null);
      setExhausted(true);
      setChecklistState((prev: typeof checklistState) => ({ ...prev, hasSearched: true }));

      if (deduped.length > 0) {
        const modeLabel = searchMode === "deep" ? " (deep search)" : "";
        toastSuccess(`Found ${deduped.length} lead${deduped.length !== 1 ? "s" : ""}${modeLabel}`);
        if (searchMode === "deep" && typeof discoverData.deepSearchesRemaining === "number") {
          toastInfo(`${discoverData.deepSearchesRemaining} deep searches remaining this month`);
        }
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
      <div className="min-h-screen bg-[#080808] text-[#f5f0e8] flex">
        <Sidebar />
        <div className="flex-1 min-w-0">
          <main className="flex flex-col items-center px-4">
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
                  <div className="h-4 w-px bg-[#1e1e1e] ml-1" />
                  <span className="text-[10px] tracking-[0.18em] uppercase text-[#616161] font-mono">Lead Scanner</span>
                </div>
              </div>
            </nav>

            <div className="w-full max-w-7xl space-y-6 py-8">
              {/* Getting Started — fixed left-edge tab + slide-in panel, never conflicts with z-index */}
              {!checklistDismissed &&
                !checklistCompleted &&
                !(
                  checklistState.hasProfile &&
                  checklistState.hasSearched &&
                  checklistState.hasSelected &&
                  checklistState.hasOutcome
                ) && (
                  <GettingStartedPanel checklistState={checklistState} onDismiss={() => setChecklistDismissed(true)} />
                )}

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
                        href="/settings"
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
                            className="text-base sm:text-[11px] bg-[#0d0d0d] border border-[rgba(201,168,76,0.3)] rounded-lg px-2 py-1 text-[#f5f0e8] placeholder-[#444] focus:outline-none focus:border-[rgba(201,168,76,0.6)] w-36"
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
                              (s.social_presence === "low" ||
                              s.social_presence === "medium" ||
                              s.social_presence === "high"
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
                              <p className="text-[11px] text-[#8a8a8a] truncate mt-0.5">
                                {s.location || "Any location"}
                              </p>
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

              {/* Profile banner */}
              {profileChecked && !checklistState.hasProfile && recentSearches.length === 0 && (
                <div className="flex items-center justify-between gap-4 rounded-xl border border-[#c9a84c]/20 bg-[rgba(201,168,76,0.04)] px-4 py-3">
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
                    href="/settings"
                    className="flex-shrink-0 text-[11px] px-3 py-1.5 rounded-lg border border-[rgba(201,168,76,0.3)] text-[#c9a84c] hover:bg-[rgba(201,168,76,0.08)] transition-all whitespace-nowrap">
                    {t.ui.profileBanner.cta}
                  </a>
                </div>
              )}

              {/* Search Command Interface */}
              <section
                className="relative rounded-2xl overflow-hidden"
                style={{
                  background: "linear-gradient(135deg,#0e0e0e 0%,#111111 100%)",
                  border: "1px solid #1e1e1e",
                  boxShadow: "0 0 60px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)",
                }}>
                <div
                  style={{
                    height: 1,
                    background: "linear-gradient(90deg,transparent 5%,rgba(201,168,76,0.4) 50%,transparent 95%)",
                  }}
                />
                <div className="p-6 md:p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <span
                      style={{
                        fontSize: 9,
                        letterSpacing: "0.2em",
                        textTransform: "uppercase",
                        color: "#8a6e30",
                        fontFamily: "monospace",
                      }}>
                      ◈ Lead Scanner
                    </span>
                    <div
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: "50%",
                        background: "#4ade80",
                        boxShadow: "0 0 6px rgba(74,222,128,0.5)",
                        animation: "pulse 2s infinite",
                      }}
                    />
                    <span
                      style={{
                        fontSize: 9,
                        letterSpacing: "0.15em",
                        textTransform: "uppercase",
                        color: "#4ade80",
                        fontFamily: "monospace",
                      }}>
                      Live
                    </span>
                  </div>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="flex gap-3 flex-col sm:flex-row">
                      <div className="flex-1 relative">
                        <div
                          className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                          style={{ color: "#555", fontSize: 14 }}>
                          ⌕
                        </div>
                        <input
                          type="text"
                          value={niche}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => setNiche(e.target.value)}
                          onFocus={() => {
                            setShowNicheDropdown(true);
                            setHasInteractedWithSearch(true);
                          }}
                          onBlur={() => setTimeout(() => setShowNicheDropdown(false), 150)}
                          placeholder="Niche or industry — e.g. tattoo studio, frisör"
                          className="w-full focus:outline-none focus:ring-1 focus:ring-[rgba(201,168,76,0.4)] text-base sm:text-[13px]"
                          style={{
                            background: "#0d0d0d",
                            border: "1px solid #262626",
                            borderRadius: 10,
                            padding: "13px 14px 13px 34px",
                            color: "#f0ebe3",
                          }}
                        />
                        {showNicheDropdown && recentSearches.length > 0 && (
                          <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-xl border border-[#252525] bg-[#111] shadow-xl overflow-hidden">
                            <p className="text-[10px] uppercase tracking-widest text-[#737373] px-3 pt-2.5 pb-1">
                              Recent
                            </p>
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
                        <div
                          className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                          style={{ color: "#555", fontSize: 13 }}>
                          ⌖
                        </div>
                        <input
                          type="text"
                          value={location}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => setLocation(e.target.value)}
                          onFocus={() => {
                            setShowLocationDropdown(true);
                            setHasInteractedWithSearch(true);
                          }}
                          onBlur={() => setTimeout(() => setShowLocationDropdown(false), 150)}
                          placeholder="City"
                          className="w-full focus:outline-none focus:ring-1 focus:ring-[rgba(201,168,76,0.4)] text-base sm:text-[13px]"
                          style={{
                            background: "#0d0d0d",
                            border: "1px solid #262626",
                            borderRadius: 10,
                            padding: "13px 14px 13px 34px",
                            color: "#f0ebe3",
                          }}
                        />
                        {showLocationDropdown && recentSearches.length > 0 && (
                          <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-xl border border-[#252525] bg-[#111] shadow-xl overflow-hidden">
                            <p className="text-[10px] uppercase tracking-widest text-[#737373] px-3 pt-2.5 pb-1">
                              Recent
                            </p>
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
                    </div>
                    {/* Search mode toggle removed — standard search now does
                    broad, geographically-partitioned discovery by default.
                    Deep search (AI-generated query variants) is reserved
                    for AI Mode, not exposed here as a manual toggle. The
                    backend route still supports searchMode: "deep" — left
                    intact for AI Mode to use once it ships, not deleted. */}
                    <div className="flex flex-col gap-3">
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full inline-flex items-center justify-center transition-all"
                        style={{
                          background: isLoading ? "rgba(201,168,76,0.06)" : "linear-gradient(135deg,#d4a84c,#c9a84c)",
                          color: isLoading ? "#555" : "#080808",
                          border: "none",
                          borderRadius: 10,
                          padding: "13px 28px",
                          fontSize: 13,
                          fontWeight: 700,
                          letterSpacing: "0.04em",
                          cursor: isLoading ? "not-allowed" : "pointer",
                        }}>
                        {isLoading ? "Scanning…" : "Scan Market →"}
                      </button>
                    </div>
                    <p style={{ fontSize: 10, color: "#4a4a4a", fontFamily: "monospace", letterSpacing: "0.05em" }}>
                      Multi-source discovery · Google Maps · Business directories · Review platforms
                    </p>
                  </form>
                </div>
              </section>

              {/* Results */}
              <section
                className="rounded-2xl overflow-hidden"
                style={{ background: "#0e0e0e", border: "1px solid #1a1a1a", boxShadow: "0 0 40px rgba(0,0,0,0.3)" }}>
                <div
                  style={{
                    height: 1,
                    background: "linear-gradient(90deg,transparent 5%,rgba(201,168,76,0.15) 50%,transparent 95%)",
                  }}
                />
                <div className="p-6 md:p-8 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5">
                        <span
                          style={{
                            fontSize: 9,
                            letterSpacing: "0.2em",
                            textTransform: "uppercase",
                            color: "#616161",
                            fontFamily: "monospace",
                          }}>
                          Intelligence Report
                        </span>
                        {sortedLeads.length > 0 && (
                          <span
                            style={{
                              fontSize: 9,
                              padding: "2px 7px",
                              borderRadius: 4,
                              background: "rgba(201,168,76,0.1)",
                              color: "#c9a84c",
                              fontFamily: "monospace",
                              fontWeight: 700,
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
                          className="flex-1 min-w-[180px] rounded-md bg-[#111111] border border-[#2a2a2a] px-2 py-1 text-base sm:text-xs"
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
                          const gapLabel = getGapLabel(lead, insight, t);
                          const scoreColor =
                            (lead.score.value ?? 0) >= 80
                              ? "#4ade80"
                              : (lead.score.value ?? 0) >= 60
                                ? "#c9a84c"
                                : "#888";
                          const fitColor =
                            (lead.fit?.fitScore ?? 0) >= 65
                              ? "#4ade80"
                              : (lead.fit?.fitScore ?? 0) >= 40
                                ? "#c9a84c"
                                : "#f87171";
                          const riskColor =
                            (lead.score.risk ?? 0) >= 70
                              ? "#f87171"
                              : (lead.score.risk ?? 0) >= 40
                                ? "#c9a84c"
                                : "#4ade80";
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
                              const gapLabel = getGapLabel(lead, getLocalizedOpportunityInsight(lead, language), t);

                              return (
                                <Fragment key={lead.id}>
                                  <tr
                                    onClick={() => {
                                      setSelectedLead(lead);
                                      setChecklistState((prev: typeof checklistState) => ({
                                        ...prev,
                                        hasSelected: true,
                                      }));
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
                                        <p className="text-[10px] text-[#8a8a8a] mt-0.5 leading-snug max-w-[220px]">
                                          ⚡ {gapLabel}
                                        </p>
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
                                            const rr = 9,
                                              circ = 2 * Math.PI * rr;
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
                                                    r={rr}
                                                    fill="none"
                                                    stroke="#1e1e1e"
                                                    strokeWidth="2.5"
                                                  />
                                                  <circle
                                                    cx="11"
                                                    cy="11"
                                                    r={rr}
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
                                          <p className="mt-1 text-[11px] leading-snug text-[#bababa]">Potential</p>
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
                                      <div
                                        className="h-full rounded-full"
                                        style={{ width: `${v}%`, backgroundColor: c }}
                                      />
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
                              <div
                                key={l.id}
                                className="rounded-xl border border-[#1a1a1a] bg-[#080808] p-3 text-center">
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
            <LeadDetailModal
              selectedLead={selectedLead}
              setSelectedLead={setSelectedLead}
              detailTab={detailTab}
              setDetailTab={setDetailTab}
              activeTabUI={activeTabUI}
              setActiveTabUI={setActiveTabUI}
              isTabPending={isTabPending}
              snapshot={snapshot}
              setSnapshot={setSnapshot}
              snapshotLoading={snapshotLoading}
              setSnapshotLoading={setSnapshotLoading}
              sequenceSteps={sequenceSteps}
              setSequenceSteps={setSequenceSteps}
              sequenceLoading={sequenceLoading}
              setSequenceLoading={setSequenceLoading}
              sequenceGenerating={sequenceGenerating}
              setSequenceGenerating={setSequenceGenerating}
              sequenceExpandedStep={sequenceExpandedStep}
              setSequenceExpandedStep={setSequenceExpandedStep}
              saveOutcome={saveOutcome}
              toggleSaveLead={toggleSaveLead}
              language={language}
              t={t}
              location={location}
              deepEnrichmentData={deepEnrichmentData}
              setDeepScanData={setDeepScanData}
              deepEnrichmentLoading={deepEnrichmentLoading}
              setDeepScanLoading={setDeepScanLoading}
              deepEnrichmentUnlocked={deepEnrichmentUnlocked}
              enrichmentData={enrichmentData}
              setEnrichmentData={setEnrichmentData}
              enrichmentLoading={enrichmentLoading}
              setEnrichmentLoading={setEnrichmentLoading}
              isRescoring={isRescoring}
              setIsRescoring={setIsRescoring}
              isSavingOutcome={isSavingOutcome}
              setIsSavingOutcome={setIsSavingOutcome}
              savedLeadIds={savedLeadIds}
              setSavedLeadIds={setSavedLeadIds}
              runDeepScan={runDeepScan}
              selectedOutcome={selectedOutcome}
              safeOutreach={safeOutreach}
              safeEnrichment={safeEnrichment}
              runIdNum={runIdNum}
              contacted={contacted}
              replied={replied}
              bookedCall={bookedCall}
              detailInsight={detailInsight}
              detailWebsiteUrl={detailWebsiteUrl}
              enrichmentSignals={enrichmentSignals}
              isReachable={isReachable}
              detectedPlatforms={detectedPlatforms}
              angleTitle={angleTitle}
              angleWhy={angleWhy}
              scriptText={scriptText}
            />
          </main>
        </div>
      </div>
      {betaStatus.active && <PageTutorial tutorialKey={activeTutorialKey} language={language} />}
      {betaStatus.active && <FeedbackPrompt language={language} />}
    </>
  );
}
