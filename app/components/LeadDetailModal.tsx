"use client";

// Extracted from app/dashboard/page.tsx's inline lead-detail portal
// (~2000 lines that lived directly inside the Dashboard component,
// reading its state via closure). Pulled out so the exact same lead
// detail experience can be reused from Pipeline's "full breakdown"
// button, not just Dashboard — per an explicit decision to take on this
// larger refactor rather than build a second, separately-maintained view.
//
// This is a direct extraction, not a rewrite: the JSX body below is
// byte-identical to what was inline in Dashboard, just wrapped in a
// component function with everything it used to read via closure now
// passed in as props instead. Every state value and handler Dashboard
// already owns gets threaded through unchanged — this component holds
// no state of its own for anything that used to live in Dashboard.

import type { MouseEvent, FocusEvent } from "react";
import { createPortal } from "react-dom";
import type { Language } from "@/lib/types";
import type { TranslationSchema as Translations } from "@/lib/i18n/types";
import type { OpportunitySignal } from "@/lib/scoring/opportunitySignals";
import { useToast } from "@/app/components/ToastProvider";
import { leadUIToOutreachSnapshot } from "@/lib/outreach/leadSnapshot";
import {
  buildOutcomePatch,
  getScoreReason,
  riskMessage,
  riskTitleFromProfile,
  getStructuredAngle,
  ScoreTooltip,
  type LeadUI,
  type DetailTabKey,
  type LeadOutcomeUI,
} from "@/app/dashboard/page";

export type SequenceStep = {
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
};

export type LeadDetailModalProps = {
  selectedLead: LeadUI | null;
  setSelectedLead: (lead: LeadUI | null) => void;
  detailTab: DetailTabKey;
  setDetailTab: (tab: DetailTabKey) => void;
  activeTabUI: DetailTabKey;
  setActiveTabUI: (tab: DetailTabKey) => void;
  isTabPending: boolean;
  snapshot: string | null;
  setSnapshot: (s: string | null) => void;
  snapshotLoading: boolean;
  setSnapshotLoading: (b: boolean) => void;
  sequenceSteps: SequenceStep[];
  setSequenceSteps: (steps: SequenceStep[] | ((prev: SequenceStep[]) => SequenceStep[])) => void;
  sequenceLoading: boolean;
  setSequenceLoading: (b: boolean) => void;
  sequenceGenerating: boolean;
  setSequenceGenerating: (b: boolean) => void;
  sequenceExpandedStep: number | null;
  setSequenceExpandedStep: (n: number | null) => void;
  saveOutcome: (args: {
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
  }) => Promise<void>;
  toggleSaveLead: (lead: LeadUI) => void | Promise<void>;
  language: Language;
  t: Translations;
  location: string;

  // Enrichment / deep-scan state — same shape as declared in Dashboard,
  // passed through unchanged rather than duplicated.
  deepEnrichmentData: {
    deepScore: number;
    pageReachable: boolean;
    scannedAt?: string;
    isFromCache?: boolean;
    website: { scores: Record<string, number>; summary: string };
    market: { scores: Record<string, number>; competitorSummary: string; recommendation: string };
    brand: { scores: Record<string, number>; brandGrade: string; weakestArea: string; strengthArea: string };
  } | null;
  setDeepScanData: (
    d:
      | LeadDetailModalProps["deepEnrichmentData"]
      | ((prev: LeadDetailModalProps["deepEnrichmentData"]) => LeadDetailModalProps["deepEnrichmentData"]),
  ) => void;
  deepEnrichmentLoading: boolean;
  setDeepScanLoading: (b: boolean) => void;
  deepEnrichmentUnlocked: boolean;
  enrichmentData: {
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
  } | null;
  setEnrichmentData: (
    d:
      | LeadDetailModalProps["enrichmentData"]
      | ((prev: LeadDetailModalProps["enrichmentData"]) => LeadDetailModalProps["enrichmentData"]),
  ) => void;
  enrichmentLoading: boolean;
  setEnrichmentLoading: (b: boolean) => void;
  isRescoring: boolean;
  setIsRescoring: (b: boolean) => void;
  isSavingOutcome: boolean;
  setIsSavingOutcome: (b: boolean) => void;
  savedLeadIds: Set<string>;
  setSavedLeadIds: (ids: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  runDeepScan: (lead: LeadUI) => Promise<void>;

  // Derived values — computed once in Dashboard from selectedLead/
  // enrichmentData/outcomesByLeadId, passed through as-is rather than
  // recomputed here, so behavior stays byte-identical to before this
  // extraction.
  selectedOutcome: LeadOutcomeUI | null;
  safeOutreach: { angleTitle?: string; angleWhy?: string; script?: string } | null;
  safeEnrichment: LeadDetailModalProps["enrichmentData"];
  runIdNum: number;
  contacted: boolean;
  replied: boolean;
  bookedCall: boolean;
  detailInsight: OpportunitySignal | null;
  detailWebsiteUrl: string | undefined;
  enrichmentSignals: NonNullable<LeadDetailModalProps["enrichmentData"]>["signals"] | Record<string, never>;
  isReachable: boolean;
  detectedPlatforms: string[];
  angleTitle: string;
  angleWhy: string;
  scriptText: string;
};

export default function LeadDetailModal(props: LeadDetailModalProps) {
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
    language,
    t,
    location,
    deepEnrichmentData,
    setDeepScanData,
    deepEnrichmentLoading,
    setDeepScanLoading,
    deepEnrichmentUnlocked,
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
  } = props;
  const { error: toastError } = useToast();
  const detailLead = selectedLead;

  return (
    selectedLead &&
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
                    (activeTabUI === tab.key
                      ? "bg-[#1a1a1a] text-[#c9a84c] border border-b-0 border-[rgba(201,168,76,0.3)]"
                      : "text-[#999999] hover:text-[#bababa]")
                  }>
                  {tab.label}
                  {isTabPending && activeTabUI === tab.key && (
                    <span className="inline-block ml-1.5 w-2.5 h-2.5 rounded-full border-[1.5px] border-[#c9a84c] border-t-transparent animate-spin align-[-1px]" />
                  )}
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
                        isRescoring ? "opacity-0 pointer-events-none" : "space-y-3 transition-opacity duration-500"
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
                              <p className="text-[11px] text-[#999999] mt-1 leading-snug break-words">{gapInfo.desc}</p>
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

                      {/* ── Lead Snapshot ─────────────────────────────── */}
                      <div className="rounded-xl border border-[#1e1e1e] bg-[#0d0d0d] p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-[10px] uppercase tracking-widest text-[#555]">AI Snapshot</p>
                            <p className="text-[11px] text-[#616161] mt-0.5">Plain-English summary of this lead</p>
                          </div>
                          {!snapshot && (
                            <button
                              onClick={async () => {
                                setSnapshotLoading(true);
                                try {
                                  const res = await fetch("/api/leads/snapshot", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                      company_name: detailLead.company.name,
                                      city: detailLead.company.city,
                                      industry: detailLead.classification.primaryIndustry,
                                      rating: detailLead.metrics.rating,
                                      review_count: detailLead.metrics.reviewCount,
                                      has_website: !!detailLead.company.website,
                                      social_presence: detailLead.metrics.socialPresence,
                                      opportunity: detailLead.score.opportunity,
                                      risk: detailLead.score.risk,
                                      fit_score: detailLead.fit?.fitScore,
                                      gap_type: (detailLead.metadata?.outreach as { gap?: string } | null)?.gap,
                                      gap_tooltip: detailLead.score.tooltips?.opportunity,
                                      risk_profile: detailLead.score.riskProfile,
                                      matched_needs: detailLead.fit?.matchedNeeds,
                                    }),
                                  });
                                  const data = (await res.json()) as {
                                    ok: boolean;
                                    snapshot?: string;
                                    error?: string;
                                    code?: string;
                                  };
                                  if (data.ok && data.snapshot) {
                                    setSnapshot(data.snapshot);
                                  } else if (data.code === "OUTREACH_LIMIT") {
                                    toastError("Monthly limit reached — upgrade for more snapshots");
                                  } else {
                                    toastError("Snapshot failed — please try again");
                                  }
                                } catch {
                                  toastError("Something went wrong");
                                } finally {
                                  setSnapshotLoading(false);
                                }
                              }}
                              disabled={snapshotLoading}
                              className="flex-shrink-0 text-[11px] px-3 py-1.5 rounded-lg border border-[rgba(201,168,76,0.3)] text-[#c9a84c] hover:bg-[rgba(201,168,76,0.08)] transition-all disabled:opacity-50">
                              {snapshotLoading ? (
                                <span className="flex items-center gap-1.5">
                                  <span className="w-3 h-3 rounded-full border border-[#c9a84c] border-t-transparent animate-spin" />
                                  Analyzing…
                                </span>
                              ) : (
                                "◈ Generate"
                              )}
                            </button>
                          )}
                          {snapshot && (
                            <button
                              onClick={() => setSnapshot(null)}
                              className="text-[10px] text-[#555] hover:text-[#888] transition-colors">
                              Clear
                            </button>
                          )}
                        </div>
                        {snapshot && (
                          <p className="text-[12px] text-[#a0a0a0] leading-relaxed border-t border-[#1a1a1a] pt-2">
                            {snapshot}
                          </p>
                        )}
                      </div>

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
                            <p className="text-[10px] uppercase tracking-widest text-[#737373]">Signal breakdown</p>
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
                  { key: "digitalPresence", label: "Digital Presence", hint: "Website & social visibility." },
                  { key: "businessStrength", label: "Business Strength", hint: "Maturity & ability to pay." },
                  { key: "opportunityGap", label: "Opportunity Gap", hint: "Growth headroom available." },
                  {
                    key: "stabilityRisk",
                    label: "Difficulty",
                    hint: "How hard to close — higher = harder.",
                    invert: true,
                  },
                  { key: "evidenceConfidence", label: "Evidence Confidence", hint: "Signal data quality." },
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
                                <ScoreTooltip text={hint} inline>
                                  <span className="flex items-center gap-1.5">
                                    <p className="text-[11px] text-[#bababa]">{label}</p>
                                    <span
                                      className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-[#3a3a3a] text-[#666] text-[9px] leading-none cursor-help flex-shrink-0"
                                      aria-label={`What is ${label}?`}>
                                      i
                                    </span>
                                  </span>
                                </ScoreTooltip>
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
                            const isPositive = /strong|high|good|great|excellent|active|present|above/i.test(reason);
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
                                <p className="text-[10px] uppercase tracking-widest text-[#8a8a8a] mb-1.5">Social</p>
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
                          <ScoreTooltip text={deepEnrichmentData.website.summary} inline>
                            <span
                              className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-[#3a3a3a] text-[#666] text-[9px] leading-none cursor-help flex-shrink-0"
                              aria-label="Primary gap insight">
                              i
                            </span>
                          </ScoreTooltip>
                        )}
                      </div>
                      {Object.entries(deepEnrichmentData.website.scores).map(([key, val]) => {
                        const label = key.replace(/([A-Z])/g, " $1").replace(/^./, (s: string) => s.toUpperCase());
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
                        Deep Enrichment fetches the lead&apos;s website and analyses SEO structure, CTA strength, brand
                        consistency, and market positioning — giving you a composite intelligence score before you reach
                        out.
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

                const gapConfig: Record<string, { label: string; color: string; icon: string; intervention: string }> =
                  {
                    VISIBILITY: {
                      label: "Visibility Gap",
                      color: "#818cf8",
                      icon: "◎",
                      intervention: "Build high-intent capture channels — search, retargeting, demand-side content.",
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
                          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: gc.color }}>
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
                        <p className="text-[10px] text-[#8a8a8a] mt-1 leading-snug">Best first point of contact</p>
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
                                    "text-[11px] font-semibold " + (isRecommended ? "text-[#c9a84c]" : "text-[#999999]")
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
                        // Store full lead snapshot in localStorage for outreach page
                        const snapshot = leadUIToOutreachSnapshot(detailLead, enrichmentData?.signals ?? {});
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
                      <span className="text-[#8a6e30] group-hover:text-[#c9a84c] transition-colors text-sm">→</span>
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
                            (scoreSnap >= 70 ? "text-[#4ade80]" : scoreSnap >= 50 ? "text-[#c9a84c]" : "text-[#f87171]")
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
                                    ...(isFirstContact ? { score_at_outreach: detailLead.score.value ?? null } : {}),
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
                      <p className="text-[10px] uppercase tracking-widest text-[#8a8a8a]">{t.ui.detail.dealValue}</p>
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
                                className="flex-1 bg-[#111] border border-[#252525] rounded-lg px-3 py-2 text-base sm:text-sm text-[#f5f0e8] placeholder-[#333] focus:outline-none focus:border-[rgba(201,168,76,0.4)] transition-colors disabled:opacity-40"
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
                        className="w-full bg-[#111] border border-[#252525] rounded-lg px-3 py-2 text-base sm:text-[12px] text-[#c8c0b0] placeholder-[#333] focus:outline-none focus:border-[rgba(201,168,76,0.4)] transition-colors resize-none disabled:opacity-40"
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
                                <p className="text-[11px] text-[#8a8a8a] line-clamp-2 leading-relaxed">{e.body}</p>
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
                        firstTouchMessage: scriptText || undefined,
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
                  if (res.ok) setSequenceSteps((prev) => prev.map((s) => (s.id === stepId ? { ...s, status } : s)));
                }

                if (sequenceLoading)
                  return <div className="py-8 text-center text-[#737373] text-sm animate-pulse">Loading…</div>;

                // Next pending step from sequence
                const nextSeqStep =
                  sequenceSteps
                    .filter((s) => s.status === "pending")
                    .sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime())[0] ??
                  null;

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
                                  <span className="text-[11px] text-[#8a8a8a]">{CH_ICONS_FU[nextSeqStep.channel]}</span>
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
                        <div className="flex items-center justify-between gap-2 flex-wrap">
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
                          className="w-full bg-[#111] border border-[#252525] rounded-lg px-3 py-2 text-base sm:text-[12px] text-[#c8c0b0] focus:outline-none focus:border-[rgba(201,168,76,0.4)] transition-colors disabled:opacity-40 [color-scheme:dark]"
                        />
                        <p className="text-[10px] text-[#616161]">Build a sequence below for smarter scheduling</p>
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
                              (new Date(step.scheduled_date).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) /
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
                                  <span className="flex-1 text-[11px] text-[#8a8a8a] truncate">{step.objective}</span>
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
                                      <p className="text-[9px] uppercase tracking-widest text-[#2a2a2a] mb-1">CTA</p>
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
    )
  );
}
