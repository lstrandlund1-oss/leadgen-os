"use client";

import { useEffect, useState } from "react";
import { getTranslations } from "@/lib/i18n";
import { getStoredLanguage } from "@/lib/languagePreference";
import HamburgerMenu from "@/app/components/HamburgerMenu";
import type { ConversionFunnel } from "@/lib/stats/getConversionFunnel";

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stats/conversion")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setFunnel(data))
      .catch(() => setFunnel(null))
      .finally(() => setLoading(false));
  }, []);

  const hasAnyData =
    funnel &&
    funnel.contactedCount + funnel.repliedCount + funnel.meetingCount + funnel.wonCount + funnel.lostCount > 0;

  return (
    <div className="min-h-screen bg-[#080808] text-[#f5f0e8]">
      <nav className="flex items-center justify-between px-6 py-5 border-b border-[#1a1a1a]">
        <h1 className="text-[18px] tracking-wide" style={{ fontFamily: "var(--font-display), serif" }}>
          Vantio
        </h1>
        <HamburgerMenu hasProfile={true} />
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-10">
        <header className="mb-6">
          <h2 className="text-[26px] font-light" style={{ fontFamily: "var(--font-display), serif" }}>
            {t.title}
          </h2>
        </header>

        {loading && <p className="text-[13px] text-[#666] py-10 text-center">{t.loading}</p>}

        {!loading && (
          <section className="bg-[#111111] border border-[#252525] rounded-2xl p-4 md:p-5">
            <h3 className="text-[15px] font-medium mb-4">{t.conversionFunnelTitle}</h3>

            {!hasAnyData ? (
              <p className="text-[13px] text-[#666] py-6 text-center">{t.noDataYet}</p>
            ) : (
              <div className="space-y-4">
                <FunnelRow label={t.recommendedToContacted} rate={funnel!.recommendedToContactRate} />
                <FunnelRow label={t.contactToReply} rate={funnel!.contactToReplyRate} />
                <FunnelRow label={t.replyToMeeting} rate={funnel!.replyToMeetingRate} />
                <FunnelRow label={t.meetingToWon} rate={funnel!.meetingToWonRate} />
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
