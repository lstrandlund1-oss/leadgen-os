"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getTranslations } from "@/lib/i18n";
import { getStoredLanguage } from "@/lib/languagePreference";
import Sidebar from "@/app/components/Sidebar";
import type { ConversionFunnel } from "@/lib/stats/getConversionFunnel";
import type { EconomicImpact } from "@/lib/stats/economicImpact";
import { computeLostReasonBreakdown, type LostReason } from "@/lib/stats/lostReasons";
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
    // exactly this data.
    fetch("/api/outcomes?all=true")
      .then((res) => (res.ok ? res.json() : { outcomes: [] }))
      .then((data) => {
        const reasons = (data.outcomes ?? []).map((o: { lost_reason: string | null }) => o.lost_reason);
        setLostReasons(computeLostReasonBreakdown(reasons));
      })
      .catch(() => setLostReasons([]));
  }, []);

  const hasAnyData =
    funnel &&
    funnel.contactedCount + funnel.repliedCount + funnel.meetingCount + funnel.wonCount + funnel.lostCount > 0;

  const shownFunnel = demoMode ? DEMO_FUNNEL : funnel;
  const shownImpact = demoMode ? DEMO_IMPACT : impact;
  const shownLostReasons = demoMode ? DEMO_LOST_REASONS : lostReasons;
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
        </main>
      </div>
    </div>
  );
}
