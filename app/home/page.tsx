"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getTranslations } from "@/lib/i18n";
import { getStoredLanguage } from "@/lib/languagePreference";
import { createSupabaseBrowser } from "@/lib/supabaseBrowser";
import Sidebar from "@/app/components/Sidebar";
import ScoreRing from "@/app/components/ScoreRing";
import CompanyAvatar from "@/app/components/CompanyAvatar";
import DonutChart from "@/app/components/DonutChart";
import { formatPrice } from "@/lib/pricing";
import type { RecommendedOpportunity } from "@/lib/recommendations/getTodaysRecommendations";
import type { PipelineOverview, PipelineStage } from "@/lib/pipeline/getPipelineOverview";
import { stageConversionRate } from "@/lib/pipeline/getPipelineOverview";
import type { MonthlyPerformance } from "@/lib/stats/getMonthlyPerformance";
import type { Market } from "@/lib/markets/markets";
import type { MarketSnapshot } from "@/lib/markets/getMarketSnapshot";
import type { DailySummary } from "@/lib/stats/getDailySummary";
import type { Insight } from "@/lib/stats/insightEngine";
import type { SuggestedGoal } from "@/lib/stats/goalEngine";

// ── Demo data ────────────────────────────────────────────────────────────
// Shown only when the user explicitly opts into demo mode - never mixed
// into real data, and always clearly labeled on screen when active.

const DEMO_RECOMMENDATIONS: RecommendedOpportunity[] = [
  {
    rawId: -1,
    leadId: "demo:1",
    runId: null,
    name: "Nordic Scale AB",
    city: "Stockholm",
    country: "Sweden",
    website: null,
    opportunityValue: 91,
    priorityScore: 91,
    isContacted: false,
    isReplied: false,
    followupOverdue: false,
    scoredAt: new Date().toISOString(),
    detectedGap: "Weak outbound acquisition",
    reasons: ["Weak outbound acquisition", "Strong market demand in this category", "No active content strategy"],
  },
  {
    rawId: -2,
    leadId: "demo:2",
    runId: null,
    name: "Webstrap Agency",
    city: "Gothenburg",
    country: "Sweden",
    website: null,
    opportunityValue: 87,
    priorityScore: 87,
    isContacted: false,
    isReplied: false,
    followupOverdue: false,
    scoredAt: new Date().toISOString(),
    detectedGap: "Visibility gap",
    reasons: ["Visibility gap", "High traffic, low brand presence"],
  },
  {
    rawId: -3,
    leadId: "demo:3",
    runId: null,
    name: "Inkognito Studios",
    city: "Malmö",
    country: "Sweden",
    website: null,
    opportunityValue: 83,
    priorityScore: 83,
    isContacted: false,
    isReplied: false,
    followupOverdue: false,
    scoredAt: new Date().toISOString(),
    detectedGap: "Conversion gap",
    reasons: ["Conversion gap", "Good traffic, weak conversions"],
  },
  {
    rawId: -4,
    leadId: "demo:4",
    runId: null,
    name: "BrightCom Solutions",
    city: "Uppsala",
    country: "Sweden",
    website: null,
    opportunityValue: 78,
    priorityScore: 78,
    isContacted: false,
    isReplied: false,
    followupOverdue: false,
    scoredAt: new Date().toISOString(),
    detectedGap: "Positioning gap",
    reasons: ["Positioning gap", "Expanding team, unclear positioning"],
  },
  {
    rawId: -5,
    leadId: "demo:5",
    runId: null,
    name: "Avento Logistics AB",
    city: "Stockholm",
    country: "Sweden",
    website: null,
    opportunityValue: 74,
    priorityScore: 74,
    isContacted: false,
    isReplied: false,
    followupOverdue: false,
    scoredAt: new Date().toISOString(),
    detectedGap: "Process gap",
    reasons: ["Process gap", "Scaling operations, manual processes"],
  },
];

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

const DEMO_PIPELINE: PipelineOverview = {
  stages: {
    recommended: Array.from({ length: 61 }, (_, i) => ({
      rawId: -100 - i,
      leadId: `demo:r${i}`,
      runId: null,
      name: `Company ${i}`,
      city: null,
      stage: "recommended",
      revenue: null,
      opportunityValue: 50 + ((i * 7) % 45),
      stageEnteredAt: daysAgo(i % 20),
      reasons: [],
    })),
    contacted: Array.from({ length: 37 }, (_, i) => ({
      rawId: -200 - i,
      leadId: `demo:c${i}`,
      runId: null,
      name: `Company ${i}`,
      city: null,
      stage: "contacted",
      revenue: null,
      opportunityValue: 55 + ((i * 5) % 40),
      stageEnteredAt: daysAgo(i % 15),
      reasons: [],
    })),
    replied: Array.from({ length: 18 }, (_, i) => ({
      rawId: -300 - i,
      leadId: `demo:re${i}`,
      runId: null,
      name: `Company ${i}`,
      city: null,
      stage: "replied",
      revenue: null,
      opportunityValue: 60 + ((i * 6) % 35),
      stageEnteredAt: daysAgo(i % 12),
      reasons: [],
    })),
    meeting: Array.from({ length: 5 }, (_, i) => ({
      rawId: -400 - i,
      leadId: `demo:m${i}`,
      runId: null,
      name: `Company ${i}`,
      city: null,
      stage: "meeting",
      revenue: null,
      opportunityValue: 70 + ((i * 4) % 25),
      stageEnteredAt: daysAgo(i * 2),
      reasons: [],
    })),
    won: Array.from({ length: 2 }, (_, i) => ({
      rawId: -500 - i,
      leadId: `demo:w${i}`,
      runId: null,
      name: `Company ${i}`,
      city: null,
      stage: "won",
      revenue: 47_500,
      opportunityValue: 85 + i,
      stageEnteredAt: daysAgo(i + 1),
      reasons: [],
    })),
    lost: Array.from({ length: 4 }, (_, i) => ({
      rawId: -600 - i,
      leadId: `demo:l${i}`,
      runId: null,
      name: `Company ${i}`,
      city: null,
      stage: "lost",
      revenue: null,
      opportunityValue: 40 + ((i * 3) % 30),
      stageEnteredAt: daysAgo(i + 3),
      reasons: [],
    })),
  },
  totalActiveCount: 61 + 37 + 18 + 5,
  totalWonRevenue: 95_000,
};

const DEMO_PERFORMANCE: MonthlyPerformance = {
  contactsMade: 156,
  replies: 42,
  meetings: 12,
  won: 2,
  revenueWon: 95_000,
};

const DEMO_MARKET: Market = {
  id: "demo",
  name: "Web Agencies in Sweden",
  niche: "web agency",
  location: "Sweden",
  createdAt: new Date().toISOString(),
  lastRefreshedAt: new Date().toISOString(),
};

const DEMO_MARKET_SNAPSHOT: MarketSnapshot = {
  marketId: "demo",
  totalCompanies: 842,
  highOpportunityCount: 127,
  goodOpportunityCount: 215,
  lowOpportunityCount: 288,
  contactedCount: 164,
  lostOrNotFitCount: 48,
  newThisMonth: 23,
  newThisMonthVsLastMonthPct: 0.18,
  estimatedCoveragePct: 0.76,
};

const DEMO_SUMMARY: DailySummary = {
  today: { contacted: 5, replied: 2, meetings: 1, won: 0 },
  pipeline: { activeCount: 121, estimatedPipelineValueSek: 240_000 },
  tomorrow: { followUpsDue: 3, newRecommended: 5 },
};

const DEMO_INSIGHT: Insight = {
  gapType: "content_gap_low_social",
  gapMessage: "Companies with 10-50 employees in Stockholm that have not posted on LinkedIn for 30+ days",
  liftMultiplier: 2.3,
  sampleSize: 12,
};

const DEMO_GOAL: SuggestedGoal = { targetWins: 3, basedOnMonths: 4 };

function getFitLabel(value: number, t: ReturnType<typeof getTranslations>["ui"]["home"]): string {
  return value >= 80 ? t.highFit : t.goodFit;
}

function getRiskLabel(value: number, t: ReturnType<typeof getTranslations>["ui"]["home"]): string {
  if (value >= 75) return t.lowRisk;
  if (value >= 50) return t.mediumRisk;
  return t.highRisk;
}

function daysAgoLabel(scoredAt: string, language: "en" | "sv"): string {
  const days = Math.floor((Date.now() - new Date(scoredAt).getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return language === "sv" ? "idag" : "today";
  if (days === 1) return language === "sv" ? "1 dag sedan" : "1 day ago";
  return language === "sv" ? `${days} dagar sedan` : `${days} days ago`;
}

export default function HomePage() {
  const [language] = useState(() => getStoredLanguage());
  const t = getTranslations(language).ui.home;
  const tPipeline = getTranslations(language).ui.pipeline;
  const tMarkets = getTranslations(language).ui.markets;

  const [demoMode, setDemoMode] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [savedLeadIds, setSavedLeadIds] = useState<Set<string>>(new Set());
  const [savingLeadId, setSavingLeadId] = useState<string | null>(null);

  const [recommendations, setRecommendations] = useState<RecommendedOpportunity[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [pipeline, setPipeline] = useState<PipelineOverview | null>(null);
  const [performance, setPerformance] = useState<MonthlyPerformance | null>(null);
  const [markets, setMarkets] = useState<Market[] | null>(null);
  const [selectedMarketId, setSelectedMarketId] = useState<string | null>(null);
  const [marketSnapshot, setMarketSnapshot] = useState<MarketSnapshot | null>(null);
  const [dailySummary, setDailySummary] = useState<DailySummary | null>(null);
  const [insight, setInsight] = useState<Insight | null | undefined>(undefined);
  const [goal, setGoal] = useState<SuggestedGoal | null | undefined>(undefined);
  const [greeting, setGreeting] = useState(t.greetingMorning);

  useEffect(() => {
    const hour = new Date().getHours();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGreeting(hour < 12 ? t.greetingMorning : hour < 18 ? t.greetingAfternoon : t.greetingEvening);
  }, [t]);

  useEffect(() => {
    // No dedicated first-name field exists in the profile — only
    // businessName (a company name, not a personal one) and email. The
    // email's local part is the most reasonable available source for a
    // personal greeting; a real "your name" field would be a better fix
    // but doesn't exist in onboarding today.
    const supabase = createSupabaseBrowser();
    supabase.auth.getSession().then(({ data }) => {
      const email = data.session?.user?.email;
      if (email) {
        const local = email.split("@")[0].split(/[._-]/)[0];
        setDisplayName(local.charAt(0).toUpperCase() + local.slice(1));
      }
    });
  }, []);

  useEffect(() => {
    fetch("/api/recommendations/today")
      .then((res) => (res.ok ? res.json() : { recommendations: [] }))
      .then((data) => setRecommendations(data.recommendations ?? []))
      .catch(() => setRecommendations([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetch("/api/stats/daily-summary")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setDailySummary(data))
      .catch(() => setDailySummary(null));
  }, []);

  useEffect(() => {
    fetch("/api/stats/insight")
      .then((res) => (res.ok ? res.json() : { insight: null }))
      .then((data) => setInsight(data.insight ?? null))
      .catch(() => setInsight(null));
  }, []);

  useEffect(() => {
    fetch("/api/stats/goal")
      .then((res) => (res.ok ? res.json() : { goal: null }))
      .then((data) => setGoal(data.goal ?? null))
      .catch(() => setGoal(null));
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

  const shownRecommendations = demoMode ? DEMO_RECOMMENDATIONS : recommendations;
  const shownPipeline = demoMode ? DEMO_PIPELINE : pipeline;
  const shownPerformance = demoMode ? DEMO_PERFORMANCE : performance;
  const shownMarkets = demoMode ? [DEMO_MARKET] : markets;
  const shownMarketSnapshot = demoMode ? DEMO_MARKET_SNAPSHOT : marketSnapshot;
  const shownSummary = demoMode ? DEMO_SUMMARY : dailySummary;
  const shownInsight = demoMode ? DEMO_INSIGHT : insight;
  const shownGoal = demoMode ? DEMO_GOAL : goal;
  const shownLoading = demoMode ? false : loading;
  const shownDisplayName = demoMode ? "Alex" : displayName;

  async function handleSaveLead(rec: RecommendedOpportunity) {
    if (demoMode || savingLeadId || savedLeadIds.has(rec.leadId)) return;
    setSavingLeadId(rec.leadId);
    try {
      const collectionRes = await fetch("/api/collections/default");
      if (!collectionRes.ok) return;
      const { collectionId } = await collectionRes.json();
      const saveRes = await fetch("/api/collections/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collection_id: collectionId,
          lead_id: rec.leadId,
          run_id: rec.runId,
          company_name: rec.name,
        }),
      });
      if (saveRes.ok) {
        setSavedLeadIds((prev) => new Set(prev).add(rec.leadId));
      }
    } finally {
      setSavingLeadId(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#080808] text-[#f5f0e8] flex">
      <Sidebar />

      <div className="flex-1 min-w-0">
        <nav className="flex items-center justify-between px-8 py-5 border-b border-[#1a1a1a]">
          <div>
            <h2 className="text-[22px] font-light" style={{ fontFamily: "var(--font-display), serif" }}>
              {greeting}
              {shownDisplayName ? `, ${shownDisplayName}` : ""} 👋
            </h2>
            {shownRecommendations && shownRecommendations.length > 0 && (
              <p className="text-[13px] text-[#888] mt-0.5">{t.subtitle(shownRecommendations.length)}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setDemoMode((v) => !v)}
            className={
              "px-3 py-1.5 rounded-lg border text-[11px] font-medium transition-colors " +
              (demoMode
                ? "border-[#c9a84c] text-[#c9a84c] bg-[rgba(201,168,76,0.08)]"
                : "border-[#252525] text-[#888] hover:border-[#444]")
            }>
            {demoMode ? t.viewingDemoData : t.showDemoData}
          </button>
        </nav>

        <main className="px-8 py-8 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
          <div className="space-y-6 min-w-0">
            <section className="bg-[#111111] border border-[#252525] rounded-2xl p-4 md:p-5 shadow-xl shadow-black/40">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[15px] font-medium text-[#f5f0e8]">{t.sectionTitle}</h3>
                <Link href="/markets" className="text-[12px] text-[#c9a84c] hover:text-[#e8c97a] transition-colors">
                  {t.viewAll} →
                </Link>
              </div>

              {shownLoading && <p className="text-[13px] text-[#666] py-8 text-center">{t.loading}</p>}

              {!shownLoading && shownRecommendations && shownRecommendations.length === 0 && (
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

              {!shownLoading && shownRecommendations && shownRecommendations.length > 0 && (
                <div className="space-y-3">
                  {shownRecommendations.map((rec) => (
                    <div
                      key={rec.rawId}
                      className="flex items-center gap-4 p-4 rounded-xl border border-[#1e1e1e] bg-[#0d0d0d] hover:border-[#333] transition-colors">
                      <CompanyAvatar name={rec.name} />
                      <div className="flex items-center gap-4 flex-1 min-w-0">
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
                        </div>
                        <ScoreRing value={rec.opportunityValue} size={48} />
                        <div className="w-[220px] shrink-0 hidden md:block">
                          <p className="text-[11px] text-[#555]">
                            <span className="text-[#8a8a6e]">{getFitLabel(rec.opportunityValue, t)}</span>
                            {" · "}
                            <span className="text-[#8a8a6e]">{getRiskLabel(rec.opportunityValue, t)}</span>
                          </p>
                          {rec.reasons.length > 0 && (
                            <div className="mt-1">
                              <span className="text-[11px] text-[#666]">{t.becauseLabel}:</span>
                              <ul className="mt-0.5 space-y-0.5">
                                {rec.reasons.map((reason, i) => (
                                  <li key={i} className="text-[12px] text-[#999] flex gap-1.5">
                                    <span className="text-[#555] shrink-0">•</span>
                                    <span>{reason}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0 flex items-start gap-2">
                        <div>
                          <Link
                            href={
                              demoMode
                                ? "/dashboard"
                                : rec.runId
                                  ? `/dashboard?runId=${rec.runId}&leadId=${encodeURIComponent(rec.leadId)}`
                                  : "/dashboard"
                            }
                            className="inline-block px-4 py-2 rounded-lg bg-[#c9a84c] text-[#080808] text-[12px] font-semibold hover:bg-[#e8c97a] transition-colors whitespace-nowrap">
                            {t.prepareOutreach}
                          </Link>
                          <p className="text-[10px] text-[#555] mt-1.5">
                            {t.lastSeen}: {daysAgoLabel(rec.scoredAt, language)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSaveLead(rec)}
                          disabled={savingLeadId === rec.leadId}
                          title={savedLeadIds.has(rec.leadId) ? t.savedLabel : t.saveLeadLabel}
                          className={
                            "w-9 h-9 rounded-lg border flex items-center justify-center text-[14px] shrink-0 transition-colors " +
                            (savedLeadIds.has(rec.leadId)
                              ? "border-[#c9a84c] text-[#c9a84c] bg-[rgba(201,168,76,0.08)]"
                              : "border-[#252525] text-[#666] hover:border-[#444] hover:text-[#999]")
                          }>
                          {savedLeadIds.has(rec.leadId) ? "★" : "☆"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {!shownLoading && shownRecommendations && shownRecommendations.length > 0 && (
                <div className="text-center mt-4 pt-3 border-t border-[#1a1a1a]">
                  <Link
                    href="/markets"
                    className="inline-flex items-center gap-1 text-[12px] text-[#888] hover:text-[#f5f0e8] transition-colors">
                    {t.showMore} ⌄
                  </Link>
                </div>
              )}
            </section>

            {shownSummary && (
              <section className="bg-[#111111] border border-[#252525] rounded-2xl p-4 md:p-5">
                <h3 className="text-[15px] font-medium text-[#f5f0e8] mb-4">{t.todaysRecapTitle}</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <div>
                    <p className="text-[11px] text-[#666]">{t.contactedToday}</p>
                    <p className="text-[18px] font-semibold text-[#f5f0e8]">{shownSummary.today.contacted}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-[#666]">{t.repliedToday}</p>
                    <p className="text-[18px] font-semibold text-[#f5f0e8]">{shownSummary.today.replied}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-[#666]">{t.meetingsToday}</p>
                    <p className="text-[18px] font-semibold text-[#f5f0e8]">{shownSummary.today.meetings}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-[#666]">{t.wonToday}</p>
                    <p className="text-[18px] font-semibold text-[#4ade80]">{shownSummary.today.won}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-[#1e1e1e]">
                  <div>
                    <p className="text-[11px] text-[#666]">{t.activePipeline}</p>
                    <p className="text-[16px] font-medium text-[#f5f0e8]">{shownSummary.pipeline.activeCount}</p>
                  </div>
                  {shownSummary.pipeline.estimatedPipelineValueSek !== null && (
                    <div>
                      <p className="text-[11px] text-[#666]">{t.estimatedPipelineValue}</p>
                      <p className="text-[16px] font-medium text-[#f5f0e8]">
                        {formatPrice(shownSummary.pipeline.estimatedPipelineValueSek, "sek")}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-[11px] text-[#666]">{t.followUpsDueTomorrow}</p>
                    <p className="text-[16px] font-medium text-[#f5f0e8]">{shownSummary.tomorrow.followUpsDue}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-[#666]">{t.newRecommendedTomorrow}</p>
                    <p className="text-[16px] font-medium text-[#f5f0e8]">{shownSummary.tomorrow.newRecommended}</p>
                  </div>
                </div>
              </section>
            )}

            {shownPipeline && (
              <section className="bg-[#111111] border border-[#252525] rounded-2xl p-4 md:p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[15px] font-medium text-[#f5f0e8]">{t.pipelineOverviewTitle}</h3>
                  <Link href="/pipeline" className="text-[12px] text-[#c9a84c] hover:text-[#e8c97a] transition-colors">
                    {t.viewPipeline} →
                  </Link>
                </div>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                  {(["recommended", "contacted", "replied", "meeting", "won", "lost"] as PipelineStage[]).map(
                    (stage) => {
                      const stageLabel: Record<PipelineStage, string> = {
                        recommended: tPipeline.stageRecommended,
                        contacted: tPipeline.stageContacted,
                        replied: tPipeline.stageReplied,
                        meeting: tPipeline.stageMeeting,
                        won: tPipeline.stageWon,
                        lost: tPipeline.stageLost,
                      };
                      // Same palette as the Pipeline page itself — blue to
                      // green through the active funnel, vibrant green for
                      // Won, a distinct red for Lost, rather than the old
                      // gray-to-gold scheme this widget still had.
                      const stageColor: Record<PipelineStage, string> = {
                        recommended: "#4a7ba6",
                        contacted: "#4a93a6",
                        replied: "#4aa695",
                        meeting: "#4aa66e",
                        won: "#2dd478",
                        lost: "#ef4444",
                      };
                      const fromStage: Partial<Record<PipelineStage, PipelineStage>> = {
                        contacted: "recommended",
                        replied: "contacted",
                        meeting: "replied",
                        won: "meeting",
                        lost: "meeting",
                      };
                      const source = fromStage[stage];
                      const percent = source
                        ? stageConversionRate(shownPipeline.stages[source].length, shownPipeline.stages[stage].length)
                        : null;
                      const color = stageColor[stage];
                      return (
                        <div
                          key={stage}
                          className="rounded-xl p-3 text-center overflow-hidden"
                          style={{
                            background: `linear-gradient(180deg, ${color}14 0%, #0d0d0d 60px)`,
                            border: `1px solid ${color}33`,
                          }}>
                          <p className="text-[18px] font-semibold text-[#f5f0e8]">
                            {shownPipeline.stages[stage].length}
                          </p>
                          <p className="text-[10px] text-[#666] mt-0.5">{stageLabel[stage]}</p>
                          {percent !== null && source && (
                            <p
                              className="text-[9px] text-[#666] mt-1 cursor-help"
                              title={tPipeline.conversionTooltip(percent, stageLabel[source], stageLabel[stage])}>
                              {tPipeline.conversionLabel(percent, stageLabel[source])}
                            </p>
                          )}
                        </div>
                      );
                    },
                  )}
                </div>
              </section>
            )}

            {shownInsight && (
              <section className="bg-[#111111] border border-[#252525] rounded-2xl p-4 md:p-5 flex items-center gap-4 flex-wrap">
                <span className="text-[20px] text-[#c9a84c] shrink-0">◢</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase tracking-widest text-[#666] mb-1">{t.insightPrefix}</p>
                  <p className="text-[13px] text-[#f5f0e8]">
                    {t.insightBody(shownInsight.gapMessage, shownInsight.liftMultiplier.toFixed(1))}
                  </p>
                </div>
                <Link
                  href="/markets"
                  className="shrink-0 px-4 py-2 rounded-lg border border-[#c9a84c]/30 text-[#c9a84c] text-[12px] font-medium hover:bg-[rgba(201,168,76,0.08)] transition-colors whitespace-nowrap">
                  {t.seeSimilarOpportunities}
                </Link>
              </section>
            )}
          </div>

          <div className="space-y-6 min-w-0">
            <section className="bg-[#111111] border border-[#252525] rounded-2xl p-4 md:p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[15px] font-medium text-[#f5f0e8]">{t.marketSnapshotTitle}</h3>
                {shownMarkets && shownMarkets.length > 1 && (
                  <select
                    value={selectedMarketId ?? ""}
                    onChange={(e) => setSelectedMarketId(e.target.value)}
                    className="bg-[#0d0d0d] border border-[#252525] rounded-lg text-[12px] text-[#f5f0e8] px-2 py-1">
                    {shownMarkets.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {shownMarkets && shownMarkets.length === 0 && (
                <p className="text-[13px] text-[#666] py-4 text-center">
                  {t.noMarketsYetHome}{" "}
                  <Link href="/markets" className="text-[#c9a84c] hover:text-[#e8c97a] transition-colors">
                    {t.createMarketLink}
                  </Link>
                </p>
              )}

              {shownMarketSnapshot && (
                <div className="flex items-center gap-6 flex-wrap">
                  <DonutChart
                    total={shownMarketSnapshot.totalCompanies}
                    segments={[
                      { value: shownMarketSnapshot.highOpportunityCount, color: "#c9a84c" },
                      { value: shownMarketSnapshot.goodOpportunityCount, color: "#8a8a6e" },
                      { value: shownMarketSnapshot.lowOpportunityCount, color: "#333" },
                      { value: shownMarketSnapshot.contactedCount, color: "#555" },
                    ]}
                  />
                  <div className="grid grid-cols-1 gap-y-2 text-[12px]">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#c9a84c]" />
                      <span className="text-[#999]">{tMarkets.highOpportunity}</span>
                      <span className="text-[#f5f0e8] font-medium ml-auto">
                        {shownMarketSnapshot.highOpportunityCount}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#8a8a6e]" />
                      <span className="text-[#999]">{tMarkets.goodOpportunity}</span>
                      <span className="text-[#f5f0e8] font-medium ml-auto">
                        {shownMarketSnapshot.goodOpportunityCount}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#333]" />
                      <span className="text-[#999]">{tMarkets.lowOpportunity}</span>
                      <span className="text-[#f5f0e8] font-medium ml-auto">
                        {shownMarketSnapshot.lowOpportunityCount}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#555]" />
                      <span className="text-[#999]">{tMarkets.contacted}</span>
                      <span className="text-[#f5f0e8] font-medium ml-auto">{shownMarketSnapshot.contactedCount}</span>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {shownPerformance && (
              <section className="bg-[#111111] border border-[#252525] rounded-2xl p-4 md:p-5">
                <h3 className="text-[15px] font-medium text-[#f5f0e8] mb-4">{t.performanceTitle}</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[11px] text-[#666]">{t.contactsMade}</p>
                    <p className="text-[18px] font-semibold text-[#f5f0e8]">{shownPerformance.contactsMade}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-[#666]">{t.repliesLabel}</p>
                    <p className="text-[18px] font-semibold text-[#f5f0e8]">{shownPerformance.replies}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-[#666]">{t.meetingsLabel}</p>
                    <p className="text-[18px] font-semibold text-[#f5f0e8]">{shownPerformance.meetings}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-[#666]">{t.wonLabel}</p>
                    <p className="text-[18px] font-semibold text-[#4ade80]">{shownPerformance.won}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-[11px] text-[#666]">{t.revenueWonLabel}</p>
                    <p className="text-[18px] font-semibold text-[#4ade80]">
                      {shownPerformance.revenueWon.toLocaleString(language === "sv" ? "sv-SE" : "en-US")}
                    </p>
                  </div>
                </div>
              </section>
            )}

            {shownGoal && shownPerformance && (
              <section className="bg-[#111111] border border-[#252525] rounded-2xl p-4 md:p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[16px] text-[#c9a84c]">◆</span>
                  <h3 className="text-[13px] font-medium text-[#f5f0e8]">{t.goalTitle}</h3>
                </div>
                <p className="text-[18px] font-semibold text-[#f5f0e8] mb-1">
                  {t.goalProgress(shownPerformance.won, shownGoal.targetWins)}
                </p>
                <div className="h-1.5 rounded-full bg-[#1a1a1a] overflow-hidden mb-2">
                  <div
                    className="h-full rounded-full bg-[#c9a84c]"
                    style={{
                      width: `${Math.min(100, (shownPerformance.won / shownGoal.targetWins) * 100)}%`,
                    }}
                  />
                </div>
                <p className="text-[11px] text-[#666]">{t.goalBasedOn(String(shownGoal.basedOnMonths))}</p>
              </section>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
