"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getTranslations } from "@/lib/i18n";
import { getStoredLanguage } from "@/lib/languagePreference";
import HamburgerMenu from "@/app/components/HamburgerMenu";
import type { PipelineOverview, PipelineStage } from "@/lib/pipeline/getPipelineOverview";

const STAGE_ORDER: PipelineStage[] = ["recommended", "contacted", "replied", "meeting", "won", "lost"];

const STAGE_COLORS: Record<PipelineStage, string> = {
  recommended: "#555",
  contacted: "#7a8bb0",
  replied: "#c9a84c",
  meeting: "#c9a84c",
  won: "#4ade80",
  lost: "#f87171",
};

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
    <div className="min-h-screen bg-[#080808] text-[#f5f0e8]">
      <nav className="flex items-center justify-between px-6 py-5 border-b border-[#1a1a1a]">
        <h1 className="text-[18px] tracking-wide" style={{ fontFamily: "var(--font-display), serif" }}>
          Vantio
        </h1>
        <HamburgerMenu hasProfile={true} />
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <header className="mb-6">
          <h2 className="text-[26px] font-light" style={{ fontFamily: "var(--font-display), serif" }}>
            {t.title}
          </h2>
        </header>

        {loading && <p className="text-[13px] text-[#666] py-10 text-center">{t.loading}</p>}

        {!loading && overview && (
          <>
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-[#111111] border border-[#252525] rounded-2xl p-4">
                <p className="text-[11px] text-[#666] mb-1">{t.activeOpportunities}</p>
                <p className="text-[22px] font-semibold text-[#f5f0e8]">{overview.totalActiveCount}</p>
              </div>
              <div className="bg-[#111111] border border-[#252525] rounded-2xl p-4">
                <p className="text-[11px] text-[#666] mb-1">{t.wonRevenue}</p>
                <p className="text-[22px] font-semibold text-[#4ade80]">
                  {overview.totalWonRevenue.toLocaleString(language === "sv" ? "sv-SE" : "en-US")}
                </p>
              </div>
            </div>

            {isEmpty ? (
              <div className="bg-[#111111] border border-[#252525] rounded-2xl p-4 md:p-5 text-center py-12 space-y-2">
                <p className="text-[14px] text-[#f5f0e8]">{t.emptyStateTitle}</p>
                <p className="text-[13px] text-[#666] max-w-sm mx-auto">{t.emptyStateBody}</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {STAGE_ORDER.map((stage) => {
                  const opportunities = overview.stages[stage];
                  return (
                    <div
                      key={stage}
                      className="bg-[#111111] border border-[#252525] rounded-2xl p-4 space-y-3 min-h-[160px]">
                      <div>
                        <p className="text-[12px] text-[#888] mb-1">{stageLabel[stage]}</p>
                        <p className="text-[20px] font-semibold" style={{ color: STAGE_COLORS[stage] }}>
                          {opportunities.length}
                        </p>
                      </div>
                      <div className="space-y-1.5">
                        {opportunities.slice(0, 4).map((opp) => (
                          <Link
                            key={opp.rawId}
                            href={
                              opp.runId
                                ? `/dashboard?runId=${opp.runId}&leadId=${encodeURIComponent(opp.leadId)}`
                                : "/dashboard"
                            }
                            className="block text-[11px] text-[#999] hover:text-[#f5f0e8] truncate transition-colors">
                            {opp.name}
                          </Link>
                        ))}
                        {opportunities.length > 4 && (
                          <p className="text-[10px] text-[#555]">{t.moreCount(opportunities.length - 4)}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
