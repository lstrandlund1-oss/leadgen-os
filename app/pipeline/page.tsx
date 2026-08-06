"use client";

import { useEffect, useState } from "react";
import { getTranslations } from "@/lib/i18n";
import { getStoredLanguage } from "@/lib/languagePreference";
import Sidebar from "@/app/components/Sidebar";
import type { PipelineOverview, PipelineStage, PipelineOpportunity } from "@/lib/pipeline/getPipelineOverview";
import { stageConversionRate } from "@/lib/pipeline/getPipelineOverview";
import { findStaleLeads } from "@/lib/pipeline/staleLeads";
import { getEffectivePlan, canUseDeepEnrichment } from "@/lib/plan";
import { useLeadDetailPanel } from "@/app/hooks/useLeadDetailPanel";
import { computeLeadDetailDerivedProps } from "@/app/hooks/leadDetailDerivedProps";
import LeadDetailModal from "@/app/components/LeadDetailModal";
import PipelineLeadPanel from "@/app/components/PipelineLeadPanel";

const STAGE_ORDER: PipelineStage[] = ["recommended", "contacted", "replied", "meeting", "won", "lost"];

const STAGE_COLORS: Record<PipelineStage, string> = {
  recommended: "#4a7ba6",
  contacted: "#4a93a6",
  replied: "#4aa695",
  meeting: "#4aa66e",
  won: "#2dd478",
  lost: "#ef4444",
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

export default function PipelinePage() {
  const [language] = useState(() => getStoredLanguage());
  const t = getTranslations(language).ui.pipeline;
  const tHome = getTranslations(language).ui.home;
  const fullT = getTranslations(language); // full schema — LeadDetailModal expects this shape, matching what Dashboard passes

  const [overview, setOverview] = useState<PipelineOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [demoMode, setDemoMode] = useState(false);

  // Quick panel — opens on Pipeline itself when a lead card is clicked,
  // instead of redirecting to Dashboard. "View full breakdown" inside it
  // renders the exact same LeadDetailModal Dashboard uses, via this
  // page's own instance of the shared hook.
  const [quickPanelOpp, setQuickPanelOpp] = useState<PipelineOpportunity | null>(null);
  const panel = useLeadDetailPanel({ language });
  const deepEnrichmentUnlocked = canUseDeepEnrichment(getEffectivePlan());
  const derivedProps = computeLeadDetailDerivedProps({
    selectedLead: panel.selectedLead,
    outcomesByLeadId: panel.outcomesByLeadId,
    enrichmentData: panel.enrichmentData,
    outreachVariant: panel.outreachVariant,
    language,
  });

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
  // Each stage's conversion rate, computed against the stage it came
  // from — explicit about the source stage so the percentage is
  // self-explanatory rather than a floating, ambiguous number. Meeting
  // has two real outcomes (Won or Lost), so both get their own rate
  // against Meeting specifically, rather than only ever showing the
  // Won path and leaving Lost unaccounted for.
  const stageRates: Partial<Record<PipelineStage, { percent: number | null; fromStage: PipelineStage }>> = shownOverview
    ? {
        contacted: {
          percent: stageConversionRate(shownOverview.stages.recommended.length, shownOverview.stages.contacted.length),
          fromStage: "recommended",
        },
        replied: {
          percent: stageConversionRate(shownOverview.stages.contacted.length, shownOverview.stages.replied.length),
          fromStage: "contacted",
        },
        meeting: {
          percent: stageConversionRate(shownOverview.stages.replied.length, shownOverview.stages.meeting.length),
          fromStage: "replied",
        },
        won: {
          percent: stageConversionRate(shownOverview.stages.meeting.length, shownOverview.stages.won.length),
          fromStage: "meeting",
        },
        lost: {
          percent: stageConversionRate(shownOverview.stages.meeting.length, shownOverview.stages.lost.length),
          fromStage: "meeting",
        },
      }
    : {};

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
                <div className="flex gap-3 overflow-x-auto themed-scrollbar">
                  {staleLeads.map((lead) => (
                    <button
                      key={lead.rawId}
                      type="button"
                      onClick={() => setQuickPanelOpp(lead)}
                      className="text-left shrink-0 w-[180px] bg-[#0d0d0d] border border-[#1e1e1e] hover:border-[#f87171]/40 rounded-xl px-3 py-2.5 transition-colors">
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
                    </button>
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
          <div className="flex-1 overflow-x-auto px-8 pb-8 themed-scrollbar">
            <div className="flex gap-3 min-w-max">
              {STAGE_ORDER.map((stage) => {
                const opportunities = shownOverview.stages[stage];
                const visible = opportunities.slice(0, 5);
                const remaining = opportunities.length - visible.length;
                const stageRate = stageRates[stage];
                const color = STAGE_COLORS[stage];
                return (
                  <div
                    key={stage}
                    className="w-[210px] shrink-0 rounded-2xl overflow-hidden"
                    style={{
                      background: `linear-gradient(180deg, ${color}14 0%, #0d0d0d 140px)`,
                      border: `1px solid ${color}33`,
                    }}>
                    <div className="px-4 pt-4 pb-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ background: color, boxShadow: `0 0 8px ${color}99` }}
                        />
                        <p className="text-[12px] font-medium tracking-wide" style={{ color }}>
                          {stageLabel[stage]}
                        </p>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <p className="text-[26px] font-semibold text-[#f5f0e8]">{opportunities.length}</p>
                        {stageRate && stageRate.percent !== null && (
                          <span
                            className="text-[11px] text-[#666] cursor-help"
                            title={t.conversionTooltip(
                              stageRate.percent,
                              stageLabel[stageRate.fromStage],
                              stageLabel[stage],
                            )}>
                            {t.conversionLabel(stageRate.percent, stageLabel[stageRate.fromStage])}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="px-3 pb-4 space-y-1.5">
                      {visible.length === 0 && <p className="text-[11px] text-[#3a3a3a] px-1 py-2">—</p>}
                      {visible.map((opp) => (
                        <button
                          key={opp.rawId}
                          type="button"
                          onClick={() => setQuickPanelOpp(opp)}
                          className="w-full text-left flex items-center gap-2 px-2.5 py-2 rounded-lg bg-[#111111] hover:bg-[#161616] border-l-2 transition-colors"
                          style={{ borderLeftColor: `${color}88` }}>
                          <span className="text-[12px] text-[#ccc] truncate flex-1">{opp.name}</span>
                          {stage === "won" && opp.revenue !== null ? (
                            <span className="text-[11px] font-semibold shrink-0 text-[#2dd478]">
                              {opp.revenue.toLocaleString(language === "sv" ? "sv-SE" : "en-US")}
                            </span>
                          ) : (
                            <span
                              className="text-[11px] font-semibold shrink-0"
                              style={{ color: scoreColor(opp.opportunityValue) }}>
                              {opp.opportunityValue}
                            </span>
                          )}
                        </button>
                      ))}
                      {remaining > 0 && <p className="text-[10px] text-[#555] px-2.5 pt-1">{t.moreCount(remaining)}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {quickPanelOpp && (
        <PipelineLeadPanel
          opportunity={quickPanelOpp}
          language={language}
          onClose={() => setQuickPanelOpp(null)}
          saveOutcome={panel.saveOutcome}
          loadAndSelectLead={panel.loadAndSelectLead}
          selectedLead={panel.selectedLead}
          scriptText={derivedProps.scriptText}
          onViewFullBreakdown={async () => {
            if (!quickPanelOpp.runId) return;
            const ok = await panel.loadAndSelectLead(quickPanelOpp.runId, quickPanelOpp.leadId);
            if (ok) setQuickPanelOpp(null);
          }}
        />
      )}

      <LeadDetailModal
        selectedLead={panel.selectedLead}
        setSelectedLead={panel.setSelectedLead}
        detailTab={panel.detailTab}
        setDetailTab={panel.setDetailTab}
        activeTabUI={panel.activeTabUI}
        setActiveTabUI={panel.setActiveTabUI}
        isTabPending={panel.isTabPending}
        snapshot={panel.snapshot}
        setSnapshot={panel.setSnapshot}
        snapshotLoading={panel.snapshotLoading}
        setSnapshotLoading={panel.setSnapshotLoading}
        sequenceSteps={panel.sequenceSteps}
        setSequenceSteps={panel.setSequenceSteps}
        sequenceLoading={panel.sequenceLoading}
        setSequenceLoading={panel.setSequenceLoading}
        sequenceGenerating={panel.sequenceGenerating}
        setSequenceGenerating={panel.setSequenceGenerating}
        sequenceExpandedStep={panel.sequenceExpandedStep}
        setSequenceExpandedStep={panel.setSequenceExpandedStep}
        saveOutcome={panel.saveOutcome}
        toggleSaveLead={panel.toggleSaveLead}
        language={language}
        t={fullT}
        location="Sweden"
        deepEnrichmentData={panel.deepEnrichmentData}
        setDeepScanData={panel.setDeepScanData}
        deepEnrichmentLoading={panel.deepEnrichmentLoading}
        setDeepScanLoading={panel.setDeepScanLoading}
        deepEnrichmentUnlocked={deepEnrichmentUnlocked}
        enrichmentData={panel.enrichmentData}
        setEnrichmentData={panel.setEnrichmentData}
        enrichmentLoading={panel.enrichmentLoading}
        setEnrichmentLoading={panel.setEnrichmentLoading}
        isRescoring={panel.isRescoring}
        setIsRescoring={panel.setIsRescoring}
        isSavingOutcome={panel.isSavingOutcome}
        setIsSavingOutcome={panel.setIsSavingOutcome}
        savedLeadIds={panel.savedLeadIds}
        setSavedLeadIds={panel.setSavedLeadIds}
        runDeepScan={panel.runDeepScan}
        selectedOutcome={derivedProps.selectedOutcome}
        safeOutreach={derivedProps.safeOutreach}
        safeEnrichment={derivedProps.safeEnrichment}
        runIdNum={derivedProps.runIdNum}
        contacted={derivedProps.contacted}
        replied={derivedProps.replied}
        bookedCall={derivedProps.bookedCall}
        detailInsight={derivedProps.detailInsight}
        detailWebsiteUrl={derivedProps.detailWebsiteUrl}
        enrichmentSignals={derivedProps.enrichmentSignals}
        isReachable={derivedProps.isReachable}
        detectedPlatforms={derivedProps.detectedPlatforms}
        angleTitle={derivedProps.angleTitle}
        angleWhy={derivedProps.angleWhy}
        scriptText={derivedProps.scriptText}
      />
    </div>
  );
}
