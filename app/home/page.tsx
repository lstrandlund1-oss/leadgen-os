"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getTranslations } from "@/lib/i18n";
import { getStoredLanguage } from "@/lib/languagePreference";
import HamburgerMenu from "@/app/components/HamburgerMenu";
import ScoreRing from "@/app/components/ScoreRing";
import type { RecommendedOpportunity } from "@/lib/recommendations/getTodaysRecommendations";
import type { PipelineOverview, PipelineStage } from "@/lib/pipeline/getPipelineOverview";
import type { MonthlyPerformance } from "@/lib/stats/getMonthlyPerformance";
import DonutChart from "@/app/components/DonutChart";
import type { Market } from "@/lib/markets/markets";
import type { MarketSnapshot } from "@/lib/markets/getMarketSnapshot";

function getFitLabel(value: number, t: ReturnType<typeof getTranslations>["ui"]["home"]): string {
  return value >= 80 ? t.highFit : t.goodFit;
}

function getRiskLabel(value: number, t: ReturnType<typeof getTranslations>["ui"]["home"]): string {
  // Uses the same opportunity value as a rough proxy until risk is
  // surfaced as its own field on RecommendedOpportunity — a real
  // simplification, not a hidden assumption; noted here plainly rather
  // than presented as a distinct signal it isn't yet.
  if (value >= 75) return t.lowRisk;
  if (value >= 50) return t.mediumRisk;
  return t.highRisk;
}

export default function HomePage() {
  const [language] = useState(() => getStoredLanguage());
  const t = getTranslations(language).ui.home;
  const tPipeline = getTranslations(language).ui.pipeline;
  const tMarkets = getTranslations(language).ui.markets;

  const [recommendations, setRecommendations] = useState<RecommendedOpportunity[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [pipeline, setPipeline] = useState<PipelineOverview | null>(null);
  const [performance, setPerformance] = useState<MonthlyPerformance | null>(null);
  const [markets, setMarkets] = useState<Market[] | null>(null);
  const [selectedMarketId, setSelectedMarketId] = useState<string | null>(null);
  const [marketSnapshot, setMarketSnapshot] = useState<MarketSnapshot | null>(null);
  const [greeting, setGreeting] = useState(t.greetingMorning);

  useEffect(() => {
    // Deliberately not computed directly during render: this is a client
    // component, but Next.js still server-renders it first. Computing
    // new Date().getHours() directly during render would run on the
    // server's clock (potentially a different timezone, or a moment
    // that crosses an hour boundary before client hydration completes),
    // risking a hydration mismatch between server and client output.
    // Rendering a safe, fixed default first and updating only after
    // mount (guaranteed client-side) avoids that entirely — this is the
    // documented exception to "don't setState in an effect for a pure
    // derivation," not an oversight of that rule.
    const hour = new Date().getHours();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGreeting(hour < 12 ? t.greetingMorning : hour < 18 ? t.greetingAfternoon : t.greetingEvening);
  }, [t]);

  useEffect(() => {
    fetch("/api/recommendations/today")
      .then((res) => (res.ok ? res.json() : { recommendations: [] }))
      .then((data) => setRecommendations(data.recommendations ?? []))
      .catch(() => setRecommendations([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetch("/api/pipeline/overview")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setPipeline(data))
      .catch(() => setPipeline(null));
  }, []);

  useEffect(() => {
    fetch("/api/stats/monthly")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setPerformance(data))
      .catch(() => setPerformance(null));
  }, []);

  useEffect(() => {
    fetch("/api/markets")
      .then((res) => (res.ok ? res.json() : { markets: [] }))
      .then((data) => {
        const list: Market[] = data.markets ?? [];
        setMarkets(list);
        if (list.length > 0) setSelectedMarketId(list[0].id);
      })
      .catch(() => setMarkets([]));
  }, []);

  useEffect(() => {
    if (!selectedMarketId) return;
    fetch(`/api/markets/${selectedMarketId}/snapshot`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setMarketSnapshot(data))
      .catch(() => setMarketSnapshot(null));
  }, [selectedMarketId]);

  return (
    <div className="min-h-screen bg-[#080808] text-[#f5f0e8]">
      <nav className="flex items-center justify-between px-6 py-5 border-b border-[#1a1a1a]">
        <h1 className="text-[18px] tracking-wide" style={{ fontFamily: "var(--font-display), serif" }}>
          Vantio
        </h1>
        <HamburgerMenu hasProfile={true} />
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <header className="mb-8">
          <h2 className="text-[26px] font-light mb-1" style={{ fontFamily: "var(--font-display), serif" }}>
            {greeting} 👋
          </h2>
          {recommendations && recommendations.length > 0 && (
            <p className="text-[14px] text-[#888]">{t.subtitle(recommendations.length)}</p>
          )}
        </header>

        <section className="bg-[#111111] border border-[#252525] rounded-2xl p-4 md:p-5 shadow-xl shadow-black/40">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[15px] font-medium text-[#f5f0e8]">{t.sectionTitle}</h3>
            <Link href="/dashboard" className="text-[12px] text-[#c9a84c] hover:text-[#e8c97a] transition-colors">
              {t.viewAll} →
            </Link>
          </div>

          {loading && <p className="text-[13px] text-[#666] py-8 text-center">{t.loading}</p>}

          {!loading && recommendations && recommendations.length === 0 && (
            <div className="text-center py-10 space-y-3">
              <p className="text-[14px] text-[#f5f0e8]">{t.emptyStateTitle}</p>
              <p className="text-[13px] text-[#666] max-w-sm mx-auto">{t.emptyStateBody}</p>
              <Link
                href="/dashboard"
                className="inline-block mt-2 px-5 py-2.5 rounded-lg bg-[#c9a84c] text-[#080808] text-[13px] font-semibold hover:bg-[#e8c97a] transition-colors">
                {t.emptyStateCta}
              </Link>
            </div>
          )}

          {!loading && recommendations && recommendations.length > 0 && (
            <div className="space-y-3">
              {recommendations.map((rec) => (
                <div
                  key={rec.rawId}
                  className="flex items-center gap-4 p-4 rounded-xl border border-[#1e1e1e] bg-[#0d0d0d] hover:border-[#333] transition-colors">
                  <ScoreRing value={rec.opportunityValue} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[14px] font-medium text-[#f5f0e8] truncate">{rec.name}</span>
                      {rec.followupOverdue && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded border border-amber-500/30 text-amber-400 bg-amber-500/5">
                          {t.followupOverdueBadge}
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] text-[#666] mt-0.5">
                      {[rec.city, rec.country].filter(Boolean).join(", ")}
                    </p>
                    <p className="text-[11px] text-[#555] mt-1">
                      <span className="text-[#8a8a6e]">{getFitLabel(rec.opportunityValue, t)}</span>
                      {" · "}
                      <span className="text-[#8a8a6e]">{getRiskLabel(rec.opportunityValue, t)}</span>
                    </p>
                    {rec.detectedGap && (
                      <p className="text-[12px] text-[#999] mt-1.5">
                        <span className="text-[#666]">{t.detectedGap}:</span> {rec.detectedGap}
                      </p>
                    )}
                  </div>

                  <Link
                    href={
                      rec.runId
                        ? `/dashboard?runId=${rec.runId}&leadId=${encodeURIComponent(rec.leadId)}`
                        : "/dashboard"
                    }
                    className="shrink-0 px-4 py-2 rounded-lg bg-[#c9a84c] text-[#080808] text-[12px] font-semibold hover:bg-[#e8c97a] transition-colors whitespace-nowrap">
                    {t.prepareOutreach}
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>

        {pipeline && (
          <section className="bg-[#111111] border border-[#252525] rounded-2xl p-4 md:p-5 mt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[15px] font-medium text-[#f5f0e8]">{t.pipelineOverviewTitle}</h3>
              <Link href="/pipeline" className="text-[12px] text-[#c9a84c] hover:text-[#e8c97a] transition-colors">
                {t.viewPipeline} →
              </Link>
            </div>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
              {(["recommended", "contacted", "replied", "meeting", "won", "lost"] as PipelineStage[]).map((stage) => {
                const stageLabel: Record<PipelineStage, string> = {
                  recommended: tPipeline.stageRecommended,
                  contacted: tPipeline.stageContacted,
                  replied: tPipeline.stageReplied,
                  meeting: tPipeline.stageMeeting,
                  won: tPipeline.stageWon,
                  lost: tPipeline.stageLost,
                };
                return (
                  <div key={stage} className="bg-[#0d0d0d] border border-[#1e1e1e] rounded-xl p-3 text-center">
                    <p className="text-[18px] font-semibold text-[#f5f0e8]">{pipeline.stages[stage].length}</p>
                    <p className="text-[10px] text-[#666] mt-0.5">{stageLabel[stage]}</p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {performance && (
          <section className="bg-[#111111] border border-[#252525] rounded-2xl p-4 md:p-5 mt-6">
            <h3 className="text-[15px] font-medium text-[#f5f0e8] mb-4">{t.performanceTitle}</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div>
                <p className="text-[11px] text-[#666]">{t.contactsMade}</p>
                <p className="text-[18px] font-semibold text-[#f5f0e8]">{performance.contactsMade}</p>
              </div>
              <div>
                <p className="text-[11px] text-[#666]">{t.repliesLabel}</p>
                <p className="text-[18px] font-semibold text-[#f5f0e8]">{performance.replies}</p>
              </div>
              <div>
                <p className="text-[11px] text-[#666]">{t.meetingsLabel}</p>
                <p className="text-[18px] font-semibold text-[#f5f0e8]">{performance.meetings}</p>
              </div>
              <div>
                <p className="text-[11px] text-[#666]">{t.wonLabel}</p>
                <p className="text-[18px] font-semibold text-[#4ade80]">{performance.won}</p>
              </div>
              <div>
                <p className="text-[11px] text-[#666]">{t.revenueWonLabel}</p>
                <p className="text-[18px] font-semibold text-[#4ade80]">
                  {performance.revenueWon.toLocaleString(language === "sv" ? "sv-SE" : "en-US")}
                </p>
              </div>
            </div>
          </section>
        )}

        <section className="bg-[#111111] border border-[#252525] rounded-2xl p-4 md:p-5 mt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[15px] font-medium text-[#f5f0e8]">{t.marketSnapshotTitle}</h3>
            {markets && markets.length > 1 && (
              <select
                value={selectedMarketId ?? ""}
                onChange={(e) => setSelectedMarketId(e.target.value)}
                className="bg-[#0d0d0d] border border-[#252525] rounded-lg text-[12px] text-[#f5f0e8] px-2 py-1">
                {markets.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {markets && markets.length === 0 && (
            <p className="text-[13px] text-[#666] py-4 text-center">
              {t.noMarketsYetHome}{" "}
              <Link href="/markets" className="text-[#c9a84c] hover:text-[#e8c97a] transition-colors">
                {t.createMarketLink}
              </Link>
            </p>
          )}

          {marketSnapshot && (
            <div className="flex items-center gap-6">
              <DonutChart
                total={marketSnapshot.totalCompanies}
                segments={[
                  { value: marketSnapshot.highOpportunityCount, color: "#c9a84c" },
                  { value: marketSnapshot.goodOpportunityCount, color: "#8a8a6e" },
                  { value: marketSnapshot.lowOpportunityCount, color: "#333" },
                  { value: marketSnapshot.contactedCount, color: "#555" },
                ]}
              />
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[12px]">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#c9a84c]" />
                  <span className="text-[#999]">{tMarkets.highOpportunity}</span>
                  <span className="text-[#f5f0e8] font-medium ml-auto">{marketSnapshot.highOpportunityCount}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#8a8a6e]" />
                  <span className="text-[#999]">{tMarkets.goodOpportunity}</span>
                  <span className="text-[#f5f0e8] font-medium ml-auto">{marketSnapshot.goodOpportunityCount}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#333]" />
                  <span className="text-[#999]">{tMarkets.lowOpportunity}</span>
                  <span className="text-[#f5f0e8] font-medium ml-auto">{marketSnapshot.lowOpportunityCount}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#555]" />
                  <span className="text-[#999]">{tMarkets.contacted}</span>
                  <span className="text-[#f5f0e8] font-medium ml-auto">{marketSnapshot.contactedCount}</span>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
