// app/dashboard/helpers.ts
// Pure helper functions for the dashboard. No React imports — fully testable.

import type { Lead, Language } from "@/lib/types";
import type { OpportunitySignal, LeadUI } from "./types";
import type { TranslationSchema as Translations } from "@/lib/i18n/types";

export type { OpportunitySignal };

// ── Location ──────────────────────────────────────────────────────────────────

export function leadLocation(lead: Lead): string {
  const parts = [lead.company.city, lead.company.country].filter(Boolean);
  return parts.length ? parts.join(", ") : "Unknown";
}

// ── Banding ───────────────────────────────────────────────────────────────────

export function bandLabel(language: Language, n: number): string {
  const v = Math.max(0, Math.min(100, Math.round(n)));
  const level = v >= 70 ? "high" : v >= 45 ? "medium" : "low";
  if (language === "sv") {
    if (level === "high") return "Hög";
    if (level === "medium") return "Medium";
    return "Låg";
  }
  return level === "high" ? "High" : level === "medium" ? "Medium" : "Low";
}

// ── Outcome labels ────────────────────────────────────────────────────────────

export type OutcomeKey = "contacted" | "replied" | "booked_call" | "closed";

export function outcomeLabel(k: OutcomeKey, t: Translations): string {
  switch (k) {
    case "contacted": return t.ui.detail.contacted;
    case "replied": return t.ui.detail.replied;
    case "booked_call": return t.ui.detail.booked;
    case "closed": return t.ui.detail.closed;
  }
}

// ── Opportunity insight resolution ───────────────────────────────────────────

export function localizeOpportunityMessage(
  signal: OpportunitySignal | null | undefined,
  language: Language,
): string | null {
  if (!signal) return null;

  const sv: Record<string, string> = {
    conversion_gap: "Stark reputation men ingen webbplats — tydlig konverteringspotential.",
    trust_gap: "Ingen webbplats — konverteringsfriktion och tappat förtroende.",
    untapped_attention: "Hög efterfrågan men svag närvaro — tydlig content-lucka.",
    underexposed_quality: "Hög kvalitet men låg synlighet — tillväxtmöjlighet.",
    scaling_ready: "Stabil grund men det skalar inte — redo för ett tillväxtsystem.",
    visibility_gap: "Webbplats finns men få recensioner — synlighets-/räckviddsgap.",
    foundation_gap: "Låg grundnivå (få recensioner + ingen webbplats) — kräver foundation först.",
    mature_competitor: "Stark närvaro + starkt proof. Svårare att vinna — kräver tydlig differentiering.",
  };

  const en: Record<string, string> = {
    conversion_gap: "Strong reputation but no website — high conversion upside.",
    trust_gap: "No website — conversion + trust friction.",
    untapped_attention: "High demand but weak social presence — content gap.",
    underexposed_quality: "High quality service but low visibility — growth opportunity.",
    scaling_ready: "Stable base but not scaling — ready for a growth system.",
    visibility_gap: "Website exists but low reviews — visibility/reach gap.",
    foundation_gap: "Low foundation (few reviews + no website) — needs fundamentals first.",
    mature_competitor: "Strong presence + strong proof. Harder to displace — requires differentiation.",
  };

  const dict = language === "sv" ? sv : en;
  return dict[signal.type] ?? signal.message ?? null;
}

export function deriveDeterministicOpportunityFallback(lead: LeadUI): OpportunitySignal | null {
  const rating = lead.metrics?.rating ?? 0;
  const reviews = lead.metrics?.reviewCount ?? 0;
  const hasWebsite = Boolean(lead.company?.website);

  if (rating >= 4.3 && reviews >= 80 && !hasWebsite) return { type: "conversion_gap", strength: "high", message: "" };
  if (rating >= 4.4 && reviews >= 150 && hasWebsite) return { type: "mature_competitor", strength: "high", message: "" };
  if (hasWebsite && reviews < 15) return { type: "visibility_gap", strength: "medium", message: "" };
  if (!hasWebsite && reviews < 15) return { type: "foundation_gap", strength: "high", message: "" };
  return null;
}

export function getLocalizedOpportunityInsight(lead: LeadUI, language: Language): OpportunitySignal | null {
  let base: OpportunitySignal | null = null;

  if (lead.primaryWorkTypeInsight?.message) {
    base = { type: lead.primaryWorkTypeInsight.code, message: lead.primaryWorkTypeInsight.message, strength: lead.primaryWorkTypeInsight.strength };
  } else if (lead.primaryInsight) {
    base = lead.primaryInsight;
  } else {
    base = deriveDeterministicOpportunityFallback(lead);
  }

  if (!base) {
    const sigs = Array.isArray(lead.opportunitySignals) ? lead.opportunitySignals : [];
    if (!sigs.length) return null;
    const priority = { high: 3, medium: 2, low: 1 } as const;
    base = sigs.slice().sort((a, b) => priority[b.strength] - priority[a.strength])[0];
  }

  const msg = localizeOpportunityMessage(base, language);
  if (!msg) return null;
  return { ...base, message: msg };
}

// ── Risk ─────────────────────────────────────────────────────────────────────

export function riskMessage(language: Language, lead: Lead): string {
  const rp = lead.score.riskProfile;
  const risk = lead.score.risk ?? 0;

  if (language === "sv") {
    if (rp === "early_stage" || rp === "limited_data") return "Låg mognad + låg proof. Ofta svårt att få momentum utan att fixa grunderna först.";
    if (rp === "well_established" || rp === "local_authority") return "Stark närvaro + starkt proof. Svårare att vinna — kräver tydlig differentiering.";
    if (risk >= 70) return "Hög risk. Kräver tydlig vinkel och starkare erbjudande.";
    if (risk >= 45) return "Mellanrisk. Går att vinna med rätt angle och tydlig payoff.";
    return "Låg risk. Relativt lätt att få respons om erbjudandet är skarpt.";
  }

  if (rp === "early_stage" || rp === "limited_data") return "Low maturity + weak proof. Hard to convert unless fundamentals are fixed first.";
  if (rp === "well_established" || rp === "local_authority") return "Strong presence + strong proof. Harder to displace — requires differentiation.";
  if (risk >= 70) return "High risk. Needs a sharp angle and stronger offer.";
  if (risk >= 45) return "Medium risk. Winnable with the right angle and clear payoff.";
  return "Low risk. Easier to get a response if your offer is sharp.";
}

// ── Score explanation ─────────────────────────────────────────────────────────

export function getScoreReason(lead: Lead, language: Language): string {
  const score = lead.score.value ?? 0;
  const opportunity = lead.score.opportunity ?? 0;
  const readiness = lead.score.readiness ?? 0;
  const risk = lead.score.risk ?? 0;
  const industry = lead.classification.primaryIndustry.replaceAll("_", " ");
  const confidence = lead.classification.confidence ?? 0;
  const rc = lead.metrics.reviewCount;
  const rating = lead.metrics.rating;

  const parts: string[] = [
    `Opportunity: ${opportunity}/100. Risk: ${risk}/100. Readiness: ${readiness}/100.`,
    language === "sv" ? `Klassning: ${industry} (${confidence}/100).` : `Classification: ${industry} (${confidence}/100).`,
  ];
  if (typeof rc === "number") parts.push(language === "sv" ? `Recensioner: ${rc}.` : `Reviews: ${rc}.`);
  if (typeof rating === "number") parts.push(language === "sv" ? `Betyg: ${rating}.` : `Rating: ${rating}.`);

  if (score >= 80) parts.push(language === "sv" ? "Toppscore för direkt outreach." : "Top-tier composite score for direct outreach.");
  else if (score >= 60) parts.push(language === "sv" ? "Bra kandidat för värde-först outreach." : "Good candidate for value-first outreach.");
  else parts.push(language === "sv" ? "Lägre score — använd för volym / testa hooks." : "Lower composite score — use for volume / testing hooks.");

  return parts.join(" ");
}

// ── Outreach angle ────────────────────────────────────────────────────────────

export function getOutreachAngle(lead: LeadUI, language: Language): string {
  const parts: string[] = [];
  const industry = lead.classification.primaryIndustry.replaceAll("_", " ");
  const loc = leadLocation(lead);
  const oppInsight = getLocalizedOpportunityInsight(lead, language);
  const opportunity = lead.score.opportunity ?? 0;
  const risk = lead.score.risk ?? 0;
  const rp = lead.score.riskProfile;
  const type = oppInsight?.type ?? null;

  if (language === "sv") {
    if (oppInsight?.message) parts.push(`Opportunity: ${oppInsight.message}`);
    parts.push(`Context: Jag går igenom ${industry} i ${loc}.`);
    if (type === "conversion_gap") parts.push("Vinkel: Stark reputation men svagt konverteringsflöde — boknings-/leads-systemuppgradering.");
    else if (type === "visibility_gap") parts.push("Vinkel: Stabil grund men låg synlighet — tillväxt via synlighet + efterfråge-fångst.");
    else if (type === "foundation_gap") parts.push("Vinkel: Grundglapp — förtroende + lead capture måste sitta innan man skalar.");
    else if (type === "mature_competitor") parts.push("Vinkel: Ni är redan starka — differentiering + systemhävarm, inte 'fler följare'.");
    else if (rp === "early_stage" || rp === "limited_data") parts.push("Vinkel: Snabb stabilisering av grunden (förtroende + lead capture) innan tillväxt.");
    else if (opportunity >= 70 && risk <= 45) parts.push("Vinkel: Tydlig uppsida med hanterbar risk — direkt tillväxtsystem.");
    else parts.push("Vinkel: Värde-först teardown + en konkret förändring som ökar bokningar/leads.");
    parts.push("Erbjudande: 10–15 min teardown + enkel plan ni kan implementera direkt.");
  } else {
    if (oppInsight?.message) parts.push(`Opportunity: ${oppInsight.message}`);
    parts.push(`Context: I'm reviewing ${industry} businesses in ${loc}.`);
    if (type === "conversion_gap") parts.push("Angle: Strong reputation, but weak conversion flow — booking/leads system upgrade.");
    else if (type === "visibility_gap") parts.push("Angle: Solid foundation but low visibility — growth through visibility + demand capture.");
    else if (type === "foundation_gap") parts.push("Angle: Foundation gap — trust + capture must be fixed before scaling.");
    else if (type === "mature_competitor") parts.push("Angle: You're already strong — differentiation + system leverage, not 'more followers'.");
    else if (rp === "early_stage" || rp === "limited_data") parts.push("Angle: Quick fundamentals upgrade (trust + capture) before scaling.");
    else if (opportunity >= 70 && risk <= 45) parts.push("Angle: Clear upside with manageable risk — direct growth system.");
    else parts.push("Angle: Value-first teardown + one concrete change that improves bookings/leads.");
    parts.push("Offer: 10–15 min teardown + a simple plan you can implement immediately.");
  }

  return parts.join(" ");
}

// ── Risk title ────────────────────────────────────────────────────────────────

export function riskTitleFromProfile(
  p: Lead["score"]["riskProfile"] | null | undefined,
  t: Translations,
): string {
  if (!p || p === "unknown") return t.ui.table.riskProfile.none ?? "";
  // Map to i18n key — use the profile value directly since i18n now has all new keys
  const profileMap = t.ui.table.riskProfile as Record<string, string>;
  return profileMap[p] ?? p.replace(/_/g, " ");
}