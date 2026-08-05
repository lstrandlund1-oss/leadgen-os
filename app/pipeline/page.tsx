"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getTranslations } from "@/lib/i18n";
import { getStoredLanguage } from "@/lib/languagePreference";
import Sidebar from "@/app/components/Sidebar";
import type { PipelineOverview, PipelineStage } from "@/lib/pipeline/getPipelineOverview";

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

export default function PipelinePage() {
  const [language] = useState(() => getStoredLanguage());
  const t = getTranslations(language).ui.pipeline;

  const [overview, setOverview] = useState<PipelineOverview | null>(null);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="min-h-screen bg-[#080808] text-[#f5f0e8] flex">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="px-8 pt-8 pb-6 shrink-0">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[26px] font-light" style={{ fontFamily: "var(--font-display), serif" }}>
              {t.title}
            </h2>
            {overview && (
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-[10px] text-[#666] uppercase tracking-wide">{t.activeOpportunities}</p>
                  <p className="text-[20px] font-semibold text-[#f5f0e8]">{overview.totalActiveCount}</p>
                </div>
                <div className="w-px h-8 bg-[#1e1e1e]" />
                <div className="text-right">
                  <p className="text-[10px] text-[#666] uppercase tracking-wide">{t.wonRevenue}</p>
                  <p className="text-[20px] font-semibold text-[#4ade80]">
                    {overview.totalWonRevenue.toLocaleString(language === "sv" ? "sv-SE" : "en-US")}
                  </p>
                </div>
              </div>
            )}
          </div>
        </header>

        {loading && <p className="text-[13px] text-[#666] py-10 text-center">{t.loading}</p>}

        {!loading && isEmpty && (
          <div className="mx-8 bg-[#111111] border border-[#252525] rounded-2xl p-4 md:p-5 text-center py-16 space-y-2">
            <p className="text-[14px] text-[#f5f0e8]">{t.emptyStateTitle}</p>
            <p className="text-[13px] text-[#666] max-w-sm mx-auto">{t.emptyStateBody}</p>
          </div>
        )}

        {!loading && overview && !isEmpty && (
          <div className="flex-1 overflow-x-auto px-8 pb-8">
            <div className="flex gap-4 h-full min-w-max">
              {STAGE_ORDER.map((stage) => {
                const opportunities = overview.stages[stage];
                return (
                  <div
                    key={stage}
                    className="w-[280px] shrink-0 bg-[#0d0d0d] border border-[#1e1e1e] rounded-2xl flex flex-col max-h-full"
                    style={{ borderTop: `3px solid ${STAGE_COLORS[stage]}` }}>
                    <div className="px-4 py-3.5 border-b border-[#1a1a1a] flex items-center justify-between shrink-0">
                      <p className="text-[13px] font-medium text-[#f5f0e8]">{stageLabel[stage]}</p>
                      <span
                        className="text-[12px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ color: STAGE_COLORS[stage], background: `${STAGE_COLORS[stage]}1a` }}>
                        {opportunities.length}
                      </span>
                    </div>

                    <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 min-h-[120px]">
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
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
