"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getTranslations } from "@/lib/i18n";
import { getStoredLanguage } from "@/lib/languagePreference";
import Sidebar from "@/app/components/Sidebar";
import type { ConversionFunnel } from "@/lib/stats/getConversionFunnel";
import type { EconomicImpact } from "@/lib/stats/economicImpact";
import { computeLostReasonBreakdown, type LostReason } from "@/lib/stats/lostReasons";
import {
  computeTonalityPerformance,
  bestTonality,
  computeAnglePerformance,
  type TonalityStat,
  type AngleStat,
} from "@/lib/stats/outreachPerformance";
import { computeWeeklyActivity, bestReplyWeek, getWeekLabel, type WeeklyPoint } from "@/lib/stats/weeklyActivity";
import { formatPrice } from "@/lib/pricing";

// Demo data — never shown unless the user explicitly opts in via the
// toggle below. Numbers chosen to look like a real, moderately active
// account, not an idealized best case.
const DEMO_FUNNEL: ConversionFunnel = {
  contactedCount: 37,
  repliedCount: 18,
  meetingCount: 5,
  wonCount: 2,
  lostCount: 4,
  recommendedCount: 61,
  recommendedToContactRate: 0.27,
  contactToReplyRate: 0.28,
  replyToMeetingRate: 0.5,
  meetingToWonRate: 0.33,
};

const DEMO_IMPACT: EconomicImpact = {
  averageDealValue: 42_000,
  vantioMonthlyCostSek: 1_023,
  monthsOfSubscriptionCovered: 41.1,
};

const DEMO_LOST_REASONS = computeLostReasonBreakdown([
  "no_response",
  "no_response",
  "not_interested",
  "price_too_high",
]);

const DEMO_OUTCOMES_FOR_PERFORMANCE = [
  { contacted: true, replied: true, closed: true, tonality: "consultative" as const, angle_type: "Visibility gap" },
  { contacted: true, replied: true, closed: false, tonality: "consultative" as const, angle_type: "Conversion gap" },
  { contacted: true, replied: false, closed: false, tonality: "soft" as const, angle_type: "Visibility gap" },
  { contacted: true, replied: true, closed: true, tonality: "direct" as const, angle_type: "Positioning gap" },
  { contacted: true, replied: false, closed: false, tonality: "direct" as const, angle_type: "Process gap" },
  { contacted: true, replied: false, closed: false, tonality: "bold" as const, angle_type: "Conversion gap" },
];
const DEMO_TONALITY_STATS = computeTonalityPerformance(DEMO_OUTCOMES_FOR_PERFORMANCE);
const DEMO_ANGLE_STATS = computeAnglePerformance(DEMO_OUTCOMES_FOR_PERFORMANCE);

const DEMO_WEEKLY_ACTIVITY = computeWeeklyActivity([
  { created_at: "2026-07-06T00:00:00Z", contacted: true, replied: true, booked_call: false, closed: false },
  { created_at: "2026-07-07T00:00:00Z", contacted: true, replied: false, booked_call: false, closed: false },
  { created_at: "2026-07-13T00:00:00Z", contacted: true, replied: true, booked_call: true, closed: false },
  { created_at: "2026-07-14T00:00:00Z", contacted: true, replied: true, booked_call: false, closed: true },
  { created_at: "2026-07-20T00:00:00Z", contacted: true, replied: false, booked_call: false, closed: false },
  { created_at: "2026-07-27T00:00:00Z", contacted: true, replied: true, booked_call: true, closed: true },
  { created_at: "2026-07-28T00:00:00Z", contacted: true, replied: true, booked_call: false, closed: false },
]);

function FunnelRow({ label, rate }: { label: string; rate: number | null }) {
  const pct = rate !== null ? Math.round(rate * 100) : null;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[12px]">
        <span className="text-[#999]">{label}</span>
        <span className="text-[#f5f0e8] font-medium tabular-nums">{pct !== null ? `${pct}%` : "—"}</span>
      </div>
      <div className="h-1.5 rounded-full bg-[#1a1a1a] overflow-hidden">
        <div className="h-full rounded-full bg-[#c9a84c]" style={{ width: pct !== null ? `${pct}%` : "0%" }} />
      </div>
    </div>
  );
}

export default function StatsPage() {
  const [language] = useState(() => getStoredLanguage());
  const t = getTranslations(language).ui.stats;

  const [funnel, setFunnel] = useState<ConversionFunnel | null>(null);
  const [impact, setImpact] = useState<EconomicImpact | null | undefined>(undefined);
  const [lostReasons, setLostReasons] = useState<ReturnType<typeof computeLostReasonBreakdown> | null>(null);
  const [tonalityStats, setTonalityStats] = useState<TonalityStat[] | null>(null);
  const [angleStats, setAngleStats] = useState<AngleStat[] | null>(null);
  const [weeklyActivity, setWeeklyActivity] = useState<WeeklyPoint[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [demoMode, setDemoMode] = useState(false);
  const tHome = getTranslations(language).ui.home;

  useEffect(() => {
    fetch("/api/stats/conversion")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setFunnel(data))
      .catch(() => setFunnel(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetch("/api/stats/economic-impact")
      .then((res) => (res.ok ? res.json() : { impact: null }))
      .then((data) => setImpact(data.impact ?? null))
      .catch(() => setImpact(null));
  }, []);

  useEffect(() => {
    // Reuses the existing outcomes API directly rather than a new route —
    // ported from the old Analytics page's approach, which already fetched
    // exactly this data. One fetch, three computations, rather than
    // fetching the same data three separate times for each section.
    fetch("/api/outcomes?all=true")
      .then((res) => (res.ok ? res.json() : { outcomes: [] }))
      .then((data) => {
        const outcomes = (data.outcomes ?? []) as {
          lost_reason: string | null;
          contacted: boolean;
          replied: boolean;
          closed: boolean;
          booked_call: boolean;
          created_at: string;
          tonality: "soft" | "direct" | "consultative" | "bold" | null;
          angle_type: string | null;
        }[];
        setLostReasons(computeLostReasonBreakdown(outcomes.map((o) => o.lost_reason)));
        setTonalityStats(computeTonalityPerformance(outcomes));
        setAngleStats(computeAnglePerformance(outcomes));
        setWeeklyActivity(computeWeeklyActivity(outcomes));
      })
      .catch(() => {
        setLostReasons([]);
        setTonalityStats([]);
        setAngleStats([]);
        setWeeklyActivity([]);
      });
  }, []);

  const hasAnyData =
    funnel &&
    funnel.contactedCount + funnel.repliedCount + funnel.meetingCount + funnel.wonCount + funnel.lostCount > 0;

  const shownFunnel = demoMode ? DEMO_FUNNEL : funnel;
  const shownImpact = demoMode ? DEMO_IMPACT : impact;
  const shownLostReasons = demoMode ? DEMO_LOST_REASONS : lostReasons;
  const shownTonalityStats = demoMode ? DEMO_TONALITY_STATS : tonalityStats;
  const shownAngleStats = demoMode ? DEMO_ANGLE_STATS : angleStats;
  const shownWeeklyActivity = demoMode ? DEMO_WEEKLY_ACTIVITY : weeklyActivity;
  const shownLoading = demoMode ? false : loading;
  const shownHasAnyData = demoMode ? true : hasAnyData;

  return (
    <div className="min-h-screen bg-[#080808] text-[#f5f0e8] flex">
      <Sidebar />
      <div className="flex-1 min-w-0">
        <main className="max-w-2xl mx-auto px-6 py-10">
          <header className="mb-6 flex items-center justify-between">
            <h2 className="text-[26px] font-light" style={{ fontFamily: "var(--font-display), serif" }}>
              {t.title}
            </h2>
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
          </header>

          {shownLoading && <p className="text-[13px] text-[#666] py-10 text-center">{t.loading}</p>}

          {!shownLoading && (
            <section className="bg-[#111111] border border-[#252525] rounded-2xl p-4 md:p-5">
              <h3 className="text-[15px] font-medium mb-4">{t.conversionFunnelTitle}</h3>

              {!shownHasAnyData ? (
                <p className="text-[13px] text-[#666] py-6 text-center">{t.noDataYet}</p>
              ) : (
                <div className="space-y-4">
                  <FunnelRow label={t.recommendedToContacted} rate={shownFunnel!.recommendedToContactRate} />
                  <FunnelRow label={t.contactToReply} rate={shownFunnel!.contactToReplyRate} />
                  <FunnelRow label={t.replyToMeeting} rate={shownFunnel!.replyToMeetingRate} />
                  <FunnelRow label={t.meetingToWon} rate={shownFunnel!.meetingToWonRate} />
                </div>
              )}
            </section>
          )}

          {shownImpact !== undefined && (
            <section className="bg-[#111111] border border-[#252525] rounded-2xl p-4 md:p-5 mt-6">
              <h3 className="text-[15px] font-medium mb-3">{t.economicImpactTitle}</h3>
              {shownImpact === null ? (
                <div className="space-y-2">
                  <p className="text-[13px] text-[#666]">{t.economicImpactEmptyBody}</p>
                  <Link href="/settings" className="text-[12px] text-[#c9a84c] hover:text-[#e8c97a] transition-colors">
                    {t.economicImpactEmptyCta} →
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[14px] text-[#f5f0e8]">
                    {t.economicImpactBody(
                      formatPrice(shownImpact.averageDealValue, "sek"),
                      shownImpact.monthsOfSubscriptionCovered.toFixed(1),
                      formatPrice(shownImpact.vantioMonthlyCostSek, "sek"),
                    )}
                  </p>
                  <p className="text-[11px] text-[#555]">{t.economicImpactDisclaimer}</p>
                </div>
              )}
            </section>
          )}

          {shownLostReasons && (
            <section className="bg-[#111111] border border-[#252525] rounded-2xl p-4 md:p-5 mt-6">
              <h3 className="text-[15px] font-medium mb-4">{t.lostReasonsTitle}</h3>
              {shownLostReasons.length === 0 ? (
                <p className="text-[13px] text-[#666] py-6 text-center">{t.lostReasonsEmpty}</p>
              ) : (
                <div className="space-y-3">
                  {shownLostReasons.map((r) => {
                    const reasonLabel: Record<LostReason, string> = {
                      no_response: t.lostReasonNoResponse,
                      not_interested: t.lostReasonNotInterested,
                      has_provider: t.lostReasonHasProvider,
                      wrong_timing: t.lostReasonWrongTiming,
                      price_too_high: t.lostReasonPriceTooHigh,
                      chose_competitor: t.lostReasonChoseCompetitor,
                      other: t.lostReasonOther,
                    };
                    return (
                      <div key={r.reason} className="space-y-1.5">
                        <div className="flex items-center justify-between text-[12px]">
                          <span className="text-[#999]">{reasonLabel[r.reason]}</span>
                          <span className="text-[#f5f0e8] font-medium tabular-nums">
                            {r.count} · {r.percentOfLost}%
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-[#1a1a1a] overflow-hidden">
                          <div className="h-full rounded-full bg-[#f87171]" style={{ width: `${r.percentOfLost}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {shownTonalityStats && (
            <section className="bg-[#111111] border border-[#252525] rounded-2xl p-4 md:p-5 mt-6">
              <h3 className="text-[15px] font-medium mb-4">{t.tonalityPerformanceTitle}</h3>
              {shownTonalityStats.every((s) => s.contacted === 0) ? (
                <p className="text-[13px] text-[#666] py-6 text-center">{t.tonalityPerformanceEmpty}</p>
              ) : (
                <>
                  <div className="space-y-3">
                    {shownTonalityStats.map((s) => (
                      <div key={s.key} className="space-y-1.5">
                        <div className="flex items-center justify-between text-[12px]">
                          <span className="text-[#999]">{s.label}</span>
                          <span className="text-[#f5f0e8] font-medium tabular-nums">
                            {s.contacted > 0 ? `${s.replyRate}% ${t.replyRateLabel}` : "—"} ·{" "}
                            {t.contactedCountLabel(s.contacted)}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-[#1a1a1a] overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${s.replyRate}%`, background: s.color }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  {(() => {
                    const best = bestTonality(shownTonalityStats);
                    return best ? (
                      <p className="text-[12px] text-[#8a8a8a] mt-4">
                        {t.bestTonalityMessage(best.label, best.replyRate)}
                      </p>
                    ) : null;
                  })()}
                </>
              )}
            </section>
          )}

          {shownAngleStats && (
            <section className="bg-[#111111] border border-[#252525] rounded-2xl p-4 md:p-5 mt-6">
              <h3 className="text-[15px] font-medium mb-4">{t.anglePerformanceTitle}</h3>
              {shownAngleStats.length === 0 ? (
                <p className="text-[13px] text-[#666] py-6 text-center">{t.anglePerformanceEmpty}</p>
              ) : (
                <div className="space-y-3">
                  {shownAngleStats.map((a) => (
                    <div key={a.name} className="space-y-1.5">
                      <div className="flex items-center justify-between text-[12px]">
                        <span className="text-[#999]">{a.name}</span>
                        <span className="text-[#f5f0e8] font-medium tabular-nums">
                          {a.contacted > 0 ? `${a.replyRate}% ${t.replyRateLabel}` : "—"} ·{" "}
                          {t.contactedCountLabel(a.contacted)}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[#1a1a1a] overflow-hidden">
                        <div className="h-full rounded-full bg-[#c9a84c]" style={{ width: `${a.replyRate}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {shownWeeklyActivity && (
            <section className="bg-[#111111] border border-[#252525] rounded-2xl p-4 md:p-5 mt-6">
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-[15px] font-medium">{t.activityOverTimeTitle}</h3>
                {(() => {
                  const best = bestReplyWeek(shownWeeklyActivity);
                  return best ? (
                    <div className="text-right">
                      <p className="text-[10px] text-[#555]">{t.bestReplyWeekLabel}</p>
                      <p className="text-[13px] font-semibold text-[#c9a84c]">
                        {getWeekLabel(best.week)} — {best.replyRate}%
                      </p>
                    </div>
                  ) : null;
                })()}
              </div>

              {shownWeeklyActivity.length === 0 ? (
                <p className="text-[13px] text-[#666] py-6 text-center">{t.activityOverTimeEmpty}</p>
              ) : (
                <>
                  {(() => {
                    const maxContacted = Math.max(...shownWeeklyActivity.map((w) => w.contacted), 1);
                    const maxRate = 100;
                    return (
                      <>
                        <div className="mb-6">
                          <p className="text-[10px] uppercase tracking-widest text-[#555] mb-3">
                            {t.leadsContactedPerWeek}
                          </p>
                          <div className="flex items-end gap-1.5 h-24">
                            {shownWeeklyActivity.map((w) => {
                              const h = Math.max(4, Math.round((w.contacted / maxContacted) * 96));
                              return (
                                <div key={w.week} className="flex-1 flex flex-col items-center gap-1 group relative">
                                  <div
                                    className="w-full rounded-t-sm bg-[#3b82f6]/40 hover:bg-[#3b82f6]/70 transition-colors cursor-default"
                                    style={{ height: `${h}px` }}
                                  />
                                  <p className="text-[9px] text-[#444] group-hover:text-[#666]">
                                    {getWeekLabel(w.week)}
                                  </p>
                                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 bg-[#080808] border border-[#252525] rounded-lg px-2 py-1.5 text-[10px] whitespace-nowrap space-y-0.5">
                                    <p className="text-[#888]">{w.contacted} contacted</p>
                                    <p className="text-[#c9a84c]">{w.replyRate}% reply</p>
                                    <p className="text-[#4ade80]">{w.closeRate}% close</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <div>
                          <p className="text-[10px] uppercase tracking-widest text-[#555] mb-3">{t.replyRatePerWeek}</p>
                          <div className="relative h-28">
                            <svg
                              viewBox={`0 0 ${Math.max(shownWeeklyActivity.length * 40, 200)} 80`}
                              className="w-full h-full"
                              preserveAspectRatio="none">
                              {[0, 25, 50, 75, 100].map((g) => (
                                <line
                                  key={g}
                                  x1="0"
                                  y1={80 - (g / maxRate) * 80}
                                  x2="10000"
                                  y2={80 - (g / maxRate) * 80}
                                  stroke="#1a1a1a"
                                  strokeWidth="0.5"
                                />
                              ))}
                              {shownWeeklyActivity.length > 1 && (
                                <polyline
                                  points={shownWeeklyActivity
                                    .map((w, i) => `${i * 40 + 20},${80 - (w.replyRate / maxRate) * 76}`)
                                    .join(" ")}
                                  fill="none"
                                  stroke="#c9a84c"
                                  strokeWidth="1.5"
                                  strokeLinejoin="round"
                                />
                              )}
                              {shownWeeklyActivity.length > 1 && (
                                <polyline
                                  points={shownWeeklyActivity
                                    .map((w, i) => `${i * 40 + 20},${80 - (w.closeRate / maxRate) * 76}`)
                                    .join(" ")}
                                  fill="none"
                                  stroke="#4ade80"
                                  strokeWidth="1.5"
                                  strokeLinejoin="round"
                                  strokeDasharray="4 2"
                                />
                              )}
                              {shownWeeklyActivity.map((w, i) => (
                                <circle
                                  key={w.week}
                                  cx={i * 40 + 20}
                                  cy={80 - (w.replyRate / maxRate) * 76}
                                  r="3"
                                  fill="#c9a84c"
                                />
                              ))}
                            </svg>
                            <div className="absolute top-0 right-0 flex items-center gap-4">
                              <div className="flex items-center gap-1.5">
                                <div className="w-4 h-0.5 bg-[#c9a84c]" />
                                <p className="text-[9px] text-[#555]">{t.replyRateLabel}</p>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <div style={{ width: 16, borderTop: "1.5px dashed #4ade80" }} />
                                <p className="text-[9px] text-[#555]">{t.overallCloseRateLabel}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </>
              )}
            </section>
          )}

          {shownWeeklyActivity && shownWeeklyActivity.length > 1 && (
            <section className="bg-[#111111] border border-[#252525] rounded-2xl p-4 md:p-5 mt-6">
              <h3 className="text-[15px] font-medium mb-4">{t.closeRateOverTimeTitle}</h3>
              {(() => {
                const totalContacted = shownWeeklyActivity.reduce((sum, w) => sum + w.contacted, 0);
                const totalClosed = shownWeeklyActivity.reduce((sum, w) => sum + w.closed, 0);
                const overallCloseRate = totalContacted > 0 ? Math.round((totalClosed / totalContacted) * 100) : 0;
                return (
                  <>
                    <div className="grid grid-cols-3 gap-3 mb-5">
                      {[
                        { label: t.totalContactedLabel, value: totalContacted.toString(), color: "#3b82f6" },
                        { label: t.dealsClosedLabel, value: totalClosed.toString(), color: "#4ade80" },
                        { label: t.overallCloseRateLabel, value: `${overallCloseRate}%`, color: "#c9a84c" },
                      ].map((s) => (
                        <div key={s.label} className="rounded-xl border border-[#1e1e1e] bg-[#0d0d0d] p-3 text-center">
                          <p className="text-[9px] uppercase tracking-widest text-[#555]">{s.label}</p>
                          <p className="text-xl font-bold mt-1" style={{ color: s.color }}>
                            {s.value}
                          </p>
                        </div>
                      ))}
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-[#555] mb-3">{t.closeRatePerWeek}</p>
                      <div className="flex items-end gap-1.5 h-20">
                        {shownWeeklyActivity.map((w) => {
                          const hasActivity = w.contacted > 0;
                          const h = hasActivity ? Math.max(4, Math.round((w.closeRate / 100) * 80)) : 2;
                          return (
                            <div key={w.week} className="flex-1 flex flex-col items-center gap-1 group relative">
                              <div
                                className="w-full rounded-t-sm transition-colors cursor-default"
                                style={{ height: `${h}px`, backgroundColor: hasActivity ? "#4ade8040" : "#1a1a1a" }}
                              />
                              <p className="text-[9px] text-[#444]">{getWeekLabel(w.week)}</p>
                              {hasActivity && (
                                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 bg-[#080808] border border-[#252525] rounded-lg px-2 py-1.5 text-[10px] whitespace-nowrap space-y-0.5">
                                  <p className="text-[#4ade80] font-semibold">{w.closeRate}% close rate</p>
                                  <p className="text-[#555]">
                                    {w.closed} / {w.contacted}
                                  </p>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                );
              })()}
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
