"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getTranslations } from "@/lib/i18n";
import { getStoredLanguage } from "@/lib/languagePreference";
import Sidebar from "@/app/components/Sidebar";
import type { PipelineOverview, PipelineStage, PipelineOpportunity } from "@/lib/pipeline/getPipelineOverview";
import { findStaleLeads } from "@/lib/pipeline/staleLeads";

const STAGE_ORDER: PipelineStage[] = ["recommended", "contacted", "replied", "meeting", "won", "lost"];

const STAGE_COLORS: Record<PipelineStage, string> = {
  recommended: "#555",
  contacted: "#7a8bb0",
  replied: "#8a7a4a",
  meeting: "#c9a84c",
  won: "#4ade80",
  lost: "#f87171",
};

function scoreColor(value: number): string {
  if (value >= 80) return "#c9a84c";
  if (value >= 60) return "#8a8a6e";
  return "#555";
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

// Demo data — never shown unless the user explicitly opts in via the
// toggle below. Varying stageEnteredAt values so the demo actually shows
// the "Needs attention" section working, not just an always-empty state.
const DEMO_OVERVIEW: PipelineOverview = {
  stages: {
    recommended: [
      {
        rawId: -1,
        leadId: "demo:1",
        runId: null,
        name: "Nordic Scale AB",
        city: "Stockholm",
        stage: "recommended",
        revenue: null,
        opportunityValue: 91,
        stageEnteredAt: daysAgo(0),
      },
      {
        rawId: -2,
        leadId: "demo:2",
        runId: null,
        name: "Webstrap Agency",
        city: "Gothenburg",
        stage: "recommended",
        revenue: null,
        opportunityValue: 87,
        stageEnteredAt: daysAgo(1),
      },
      ...Array.from({ length: 59 }, (_, i) => ({
        rawId: -100 - i,
        leadId: `demo:r${i}`,
        runId: null,
        name: `Company ${i}`,
        city: null,
        stage: "recommended" as const,
        revenue: null,
        opportunityValue: 50 + ((i * 7) % 45),
        stageEnteredAt: daysAgo(i % 20),
      })),
    ],
    contacted: [
      {
        rawId: -250,
        leadId: "demo:c-stale1",
        runId: null,
        name: "Flowbite AB",
        city: "Malmö",
        stage: "contacted",
        revenue: null,
        opportunityValue: 72,
        stageEnteredAt: daysAgo(11),
      },
      ...Array.from({ length: 36 }, (_, i) => ({
        rawId: -200 - i,
        leadId: `demo:c${i}`,
        runId: null,
        name: `Company ${i}`,
        city: null,
        stage: "contacted" as const,
        revenue: null,
        opportunityValue: 55 + ((i * 5) % 40),
        stageEnteredAt: daysAgo(i % 6),
      })),
    ],
    replied: [
      {
        rawId: -350,
        leadId: "demo:re-stale1",
        runId: null,
        name: "Nordvik Consulting",
        city: "Uppsala",
        stage: "replied",
        revenue: null,
        opportunityValue: 68,
        stageEnteredAt: daysAgo(9),
      },
      ...Array.from({ length: 17 }, (_, i) => ({
        rawId: -300 - i,
        leadId: `demo:re${i}`,
        runId: null,
        name: `Company ${i}`,
        city: null,
        stage: "replied" as const,
        revenue: null,
        opportunityValue: 60 + ((i * 6) % 35),
        stageEnteredAt: daysAgo(i % 5),
      })),
    ],
    meeting: Array.from({ length: 5 }, (_, i) => ({
      rawId: -400 - i,
      leadId: `demo:m${i}`,
      runId: null,
      name: `Company ${i}`,
      city: null,
      stage: "meeting" as const,
      revenue: null,
      opportunityValue: 70 + ((i * 4) % 25),
      stageEnteredAt: daysAgo(i),
    })),
    won: [
      {
        rawId: -501,
        leadId: "demo:w1",
        runId: null,
        name: "Studio Vertex",
        city: "Malmö",
        stage: "won",
        revenue: 95_000,
        opportunityValue: 86,
        stageEnteredAt: daysAgo(2),
      },
      {
        rawId: -502,
        leadId: "demo:w2",
        runId: null,
        name: "Creative Mill",
        city: "Uppsala",
        stage: "won",
        revenue: 50_000,
        opportunityValue: 88,
        stageEnteredAt: daysAgo(6),
      },
    ],
    lost: Array.from({ length: 4 }, (_, i) => ({
      rawId: -600 - i,
      leadId: `demo:l${i}`,
      runId: null,
      name: `Company ${i}`,
      city: null,
      stage: "lost" as const,
      revenue: null,
      opportunityValue: 40 + ((i * 3) % 30),
      stageEnteredAt: daysAgo(i + 3),
    })),
  },
  totalActiveCount: 61 + 37 + 18 + 5,
  totalWonRevenue: 145_000,
};

function rate(from: number, to: number): number | null {
  if (from === 0) return null;
  return Math.round((to / from) * 100);
}

export default function PipelinePage() {
  const [language] = useState(() => getStoredLanguage());
  const t = getTranslations(language).ui.pipeline;
  const tHome = getTranslations(language).ui.home;

  const [overview, setOverview] = useState<PipelineOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [demoMode, setDemoMode] = useState(false);

  useEffect(() => {
    fetch("/api/pipeline/overview")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setOverview(data))
      .catch(() => setOverview(null))
      .finally(() => setLoading(false));
  }, []);

  const stageLabel: Record<PipelineStage, string> = {
    recommended: t.stageRecommended,
    contacted: t.stageContacted,
    replied: t.stageReplied,
    meeting: t.stageMeeting,
    won: t.stageWon,
    lost: t.stageLost,
  };

  const isEmpty = overview && STAGE_ORDER.every((stage) => overview.stages[stage].length === 0);

  const shownOverview = demoMode ? DEMO_OVERVIEW : overview;
  const shownLoading = demoMode ? false : loading;
  const shownIsEmpty = demoMode ? false : isEmpty;

  const allActiveOpportunities: PipelineOpportunity[] = shownOverview
    ? [
        ...shownOverview.stages.recommended,
        ...shownOverview.stages.contacted,
        ...shownOverview.stages.replied,
        ...shownOverview.stages.meeting,
      ]
    : [];
  const staleLeads = findStaleLeads(allActiveOpportunities).slice(0, 5);

  // Conversion rates between adjacent columns, reusing the same counts
  // shown in the header — no separate computation from Stats needed.
  const rates = shownOverview
    ? [
        rate(shownOverview.stages.recommended.length, shownOverview.stages.contacted.length),
        rate(shownOverview.stages.contacted.length, shownOverview.stages.replied.length),
        rate(shownOverview.stages.replied.length, shownOverview.stages.meeting.length),
        rate(shownOverview.stages.meeting.length, shownOverview.stages.won.length),
      ]
    : [];

  return (
    <div className="min-h-screen bg-[#080808] text-[#f5f0e8] flex">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="px-8 pt-8 pb-6 shrink-0">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[26px] font-light" style={{ fontFamily: "var(--font-display), serif" }}>
              {t.title}
            </h2>
            <div className="flex items-center gap-6">
              {shownOverview && (
                <>
                  <div className="text-right">
                    <p className="text-[10px] text-[#666] uppercase tracking-wide">{t.activeOpportunities}</p>
                    <p className="text-[20px] font-semibold text-[#f5f0e8]">{shownOverview.totalActiveCount}</p>
                  </div>
                  <div className="w-px h-8 bg-[#1e1e1e]" />
                  <div className="text-right">
                    <p className="text-[10px] text-[#666] uppercase tracking-wide">{t.wonRevenue}</p>
                    <p className="text-[20px] font-semibold text-[#4ade80]">
                      {shownOverview.totalWonRevenue.toLocaleString(language === "sv" ? "sv-SE" : "en-US")}
                    </p>
                  </div>
                </>
              )}
              <button
                type="button"
                onClick={() => setDemoMode((v) => !v)}
                className={
                  "px-3 py-1.5 rounded-lg border text-[11px] font-medium transition-colors " +
                  (demoMode
                    ? "border-[#c9a84c] text-[#c9a84c] bg-[rgba(201,168,76,0.08)]"
                    : "border-[#252525] text-[#888] hover:border-[#444]")
                }>
                {demoMode ? tHome.viewingDemoData : tHome.showDemoData}
              </button>
            </div>
          </div>

          {!shownLoading && !shownIsEmpty && staleLeads.length >= 0 && (
            <div className="bg-[#111111] border border-[#252525] rounded-2xl p-4">
              <h3 className="text-[13px] font-medium text-[#f5f0e8] mb-3">{t.needsAttentionTitle}</h3>
              {staleLeads.length === 0 ? (
                <p className="text-[12px] text-[#666]">{t.needsAttentionEmpty}</p>
              ) : (
                <div className="flex gap-3 overflow-x-auto">
                  {staleLeads.map((lead) => (
                    <Link
                      key={lead.rawId}
                      href={
                        lead.runId
                          ? `/dashboard?runId=${lead.runId}&leadId=${encodeURIComponent(lead.leadId)}`
                          : "/dashboard"
                      }
                      className="shrink-0 w-[180px] bg-[#0d0d0d] border border-[#1e1e1e] hover:border-[#f87171]/40 rounded-xl px-3 py-2.5 transition-colors">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="text-[12px] text-[#f5f0e8] truncate">{lead.name}</p>
                        <span
                          className="text-[11px] font-semibold shrink-0"
                          style={{ color: scoreColor(lead.opportunityValue) }}>
                          {lead.opportunityValue}
                        </span>
                      </div>
                      <p className="text-[10px] text-[#666]">{stageLabel[lead.stage]}</p>
                      <p className="text-[10px] text-[#f87171] mt-1">{t.daysStuck(lead.daysStale)}</p>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </header>

        {shownLoading && <p className="text-[13px] text-[#666] py-10 text-center">{t.loading}</p>}

        {!shownLoading && shownIsEmpty && (
          <div className="mx-8 bg-[#111111] border border-[#252525] rounded-2xl p-4 md:p-5 text-center py-16 space-y-2">
            <p className="text-[14px] text-[#f5f0e8]">{t.emptyStateTitle}</p>
            <p className="text-[13px] text-[#666] max-w-sm mx-auto">{t.emptyStateBody}</p>
          </div>
        )}

        {!shownLoading && shownOverview && !shownIsEmpty && (
          <div className="flex-1 overflow-x-auto px-8 pb-8">
            <div className="flex items-start gap-1 h-full min-w-max">
              {STAGE_ORDER.map((stage, idx) => {
                const opportunities = shownOverview.stages[stage];
                const rateIntoThisStage = idx > 0 && idx <= 4 ? rates[idx - 1] : null;
                return (
                  <div key={stage} className="flex items-start">
                    {idx > 0 && idx <= 4 && (
                      <div className="flex flex-col items-center justify-center h-14 w-9 shrink-0 mt-2">
                        {rateIntoThisStage !== null && (
                          <span className="text-[10px] text-[#8a8a6e]">{t.rateToNext(rateIntoThisStage)}</span>
                        )}
                        <span className="text-[13px] text-[#333]">→</span>
                      </div>
                    )}
                    <div
                      className="w-[260px] shrink-0 bg-[#0d0d0d] border border-[#1e1e1e] rounded-2xl flex flex-col max-h-full"
                      style={{ borderTop: `3px solid ${STAGE_COLORS[stage]}` }}>
                      <div className="px-4 py-3.5 border-b border-[#1a1a1a] flex items-center justify-between shrink-0">
                        <p className="text-[13px] font-medium text-[#f5f0e8]">{stageLabel[stage]}</p>
                        <span
                          className="text-[12px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ color: STAGE_COLORS[stage], background: `${STAGE_COLORS[stage]}1a` }}>
                          {opportunities.length}
                        </span>
                      </div>

                      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 min-h-[120px] max-h-[520px]">
                        {opportunities.length === 0 && <p className="text-[11px] text-[#444] text-center py-6">—</p>}
                        {opportunities.map((opp) => (
                          <Link
                            key={opp.rawId}
                            href={
                              opp.runId
                                ? `/dashboard?runId=${opp.runId}&leadId=${encodeURIComponent(opp.leadId)}`
                                : "/dashboard"
                            }
                            className="block bg-[#111111] border border-[#1e1e1e] hover:border-[#333] rounded-xl px-3 py-2.5 transition-colors">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[12px] text-[#f5f0e8] truncate">{opp.name}</p>
                              <span
                                className="text-[11px] font-semibold shrink-0"
                                style={{ color: scoreColor(opp.opportunityValue) }}>
                                {opp.opportunityValue}
                              </span>
                            </div>
                            {opp.city && <p className="text-[10px] text-[#666] mt-0.5 truncate">{opp.city}</p>}
                            {stage === "won" && opp.revenue !== null && (
                              <p className="text-[10px] text-[#4ade80] mt-1">
                                {opp.revenue.toLocaleString(language === "sv" ? "sv-SE" : "en-US")}
                              </p>
                            )}
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
