"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getTranslations } from "@/lib/i18n";
import { getStoredLanguage } from "@/lib/languagePreference";
import HamburgerMenu from "@/app/components/HamburgerMenu";
import ScoreRing from "@/app/components/ScoreRing";
import type { RecommendedOpportunity } from "@/lib/recommendations/getTodaysRecommendations";

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

  const [recommendations, setRecommendations] = useState<RecommendedOpportunity[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [greeting, setGreeting] = useState(t.greetingMorning);

  useEffect(() => {
    const hour = new Date().getHours();
    setGreeting(hour < 12 ? t.greetingMorning : hour < 18 ? t.greetingAfternoon : t.greetingEvening);
  }, [t]);

  useEffect(() => {
    fetch("/api/recommendations/today")
      .then((res) => (res.ok ? res.json() : { recommendations: [] }))
      .then((data) => setRecommendations(data.recommendations ?? []))
      .catch(() => setRecommendations([]))
      .finally(() => setLoading(false));
  }, []);

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
      </main>
    </div>
  );
}
