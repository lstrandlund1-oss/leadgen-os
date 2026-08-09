"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/app/components/Sidebar";
import { getTranslations } from "@/lib/i18n";
import { getStoredLanguage } from "@/lib/languagePreference";

type FeatureUsage = {
  feature: "outreach" | "followup" | "ai_deep_search";
  dailyLimit: number;
  totalLimit: number;
  usedToday: number;
  usedTotal: number;
};

type UsageData =
  | {
      active: true;
      daysRemainingActive: number;
      daysRemainingCalendar: number;
      activatedAt: string;
      hardEndAt: string;
      usage: FeatureUsage[];
      discount: { percent: number; duration_months: number; status: string } | null;
    }
  | { active: false; reason: string; discount: null; usage: [] };

function barColor(used: number, limit: number): string {
  if (limit === 0) return "#333";
  const ratio = used / limit;
  if (ratio >= 1) return "#f87171";
  if (ratio >= 0.8) return "#c9a84c";
  return "#4ade80";
}

export default function UsagePlanPage() {
  const [language] = useState(() => getStoredLanguage());
  const t = getTranslations(language).ui.usagePlan;
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

  const featureLabel: Record<FeatureUsage["feature"], string> = {
    outreach: t.featureOutreach,
    followup: t.featureFollowup,
    ai_deep_search: t.featureAiDeepSearch,
  };

  useEffect(() => {
    fetch("/api/usage")
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-[#080808] text-[#f5f0e8] flex">
      <Sidebar />
      <div className="flex-1 min-w-0">
        <header className="px-8 pt-8 pb-6">
          <h2 className="text-[26px] font-light" style={{ fontFamily: "var(--font-display), serif" }}>
            {t.title}
          </h2>
        </header>

        <main className="px-8 pb-12 max-w-3xl">
          {loading && <p className="text-[13px] text-[#666] py-10 text-center">{t.loading}</p>}

          {!loading && !data && (
            <div className="bg-[#111111] border border-[#252525] rounded-2xl p-6 text-center">
              <p className="text-[13px] text-[#666]">{t.loadError}</p>
            </div>
          )}

          {!loading && data && !data.active && (
            <div className="bg-[#111111] border border-[#252525] rounded-2xl p-6">
              <p className="text-[14px] text-[#f5f0e8] mb-1">{t.noMembershipTitle}</p>
              <p className="text-[13px] text-[#666]">
                {data.reason === "expired"
                  ? t.noMembershipExpired
                  : data.reason === "revoked"
                    ? t.noMembershipRevoked
                    : t.noMembershipGeneric}
              </p>
            </div>
          )}

          {!loading && data && data.active && (
            <div className="space-y-6">
              <section className="bg-[#111111] border border-[#252525] rounded-2xl p-5">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] uppercase tracking-widest text-[#8a6e30]">{t.betaStatusLabel}</p>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[rgba(74,222,128,0.1)] text-[#4ade80] border border-[rgba(74,222,128,0.25)]">
                    {t.activeLabel}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div>
                    <p className="text-[20px] font-semibold">{data.daysRemainingActive}</p>
                    <p className="text-[11px] text-[#666]">{t.activeDaysRemaining}</p>
                  </div>
                  <div>
                    <p className="text-[20px] font-semibold">{data.daysRemainingCalendar}</p>
                    <p className="text-[11px] text-[#666]">{t.calendarDaysRemaining}</p>
                  </div>
                </div>
              </section>

              <section className="bg-[#111111] border border-[#252525] rounded-2xl p-5">
                <h3 className="text-[15px] font-medium mb-4">{t.usageThisPeriodTitle}</h3>
                <div className="space-y-5">
                  {data.usage.map((u) => {
                    const dailyPct =
                      u.dailyLimit > 0 ? Math.min(100, Math.round((u.usedToday / u.dailyLimit) * 100)) : 0;
                    const totalPct =
                      u.totalLimit > 0 ? Math.min(100, Math.round((u.usedTotal / u.totalLimit) * 100)) : 0;
                    return (
                      <div key={u.feature} className="space-y-3">
                        <p className="text-[13px] text-[#f5f0e8] font-medium">{featureLabel[u.feature]}</p>
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-[#666]">{t.todayLabel}</span>
                            <span className="text-[#999] tabular-nums">
                              {u.usedToday} / {u.dailyLimit}
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-[#1a1a1a] overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${dailyPct}%`, background: barColor(u.usedToday, u.dailyLimit) }}
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-[#666]">{t.betaTotalLabel}</span>
                            <span className="text-[#999] tabular-nums">
                              {u.usedTotal} / {u.totalLimit}
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-[#1a1a1a] overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${totalPct}%`, background: barColor(u.usedTotal, u.totalLimit) }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {data.discount && (
                <section className="bg-[#111111] border border-[rgba(201,168,76,0.25)] rounded-2xl p-5">
                  <h3 className="text-[15px] font-medium mb-2">{t.discountTitle}</h3>
                  <p className="text-[13px] text-[#999]">
                    {t.discountMessage(data.discount.percent, data.discount.duration_months)}
                    {data.discount.status === "earned" && ` — ${t.discountEarned}`}
                    {data.discount.status === "pending" && ` — ${t.discountPending}`}
                    {data.discount.status === "redeemed" && ` — ${t.discountRedeemed}`}
                  </p>
                </section>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
