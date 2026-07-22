"use client";

import { useState } from "react";
import Link from "next/link";
import { getTranslations } from "@/lib/i18n";
import type { Language } from "@/lib/i18n/types";
import { useBetaStatus } from "@/lib/beta/useBetaStatus";

export default function BetaCompletedPage() {
  const status = useBetaStatus();
  const [language] = useState<Language>(() => {
    if (typeof window === "undefined") return "sv";
    try {
      const raw = localStorage.getItem("vantio_state_v1");
      const p = raw ? JSON.parse(raw) : null;
      return p?.language === "en" || p?.language === "sv" ? p.language : "sv";
    } catch {
      return "sv";
    }
  });

  const t = getTranslations(language).ui.beta.completed;

  if (status.loading) return null;

  const discountStatus = status.discount?.status;

  return (
    <div className="min-h-screen bg-[#080808] text-[#f5f0e8] flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-md text-center">
        <p className="text-[11px] tracking-[0.2em] uppercase text-[#8a6e30] mb-4">Private Beta</p>
        <h1 className="text-3xl font-light mb-4" style={{ fontFamily: "var(--font-display), serif" }}>
          {t.heading}
        </h1>
        <p className="text-[14px] text-[#999] leading-relaxed mb-6">{t.body}</p>

        <div className="rounded-2xl border border-[#252525] bg-[#111] p-6 mb-6 text-left">
          <p className="text-[12px] text-[#888] leading-relaxed">{t.dataPreserved}</p>
        </div>

        {status.reason === "expired" && (
          <div className="rounded-2xl border border-[rgba(201,168,76,0.25)] bg-[rgba(201,168,76,0.04)] p-6 text-left">
            {discountStatus === "earned" || discountStatus === "redeemed" ? (
              <>
                <p className="text-[13px] font-semibold text-[#c9a84c] mb-2">{t.discountEarnedTitle}</p>
                <p className="text-[12px] text-[#999] leading-relaxed">
                  {t.discountEarnedBody
                    .replace("{percent}", String(status.discount?.percent ?? 30))
                    .replace("{months}", String(status.discount?.durationMonths ?? 12))}
                </p>
              </>
            ) : (
              <>
                <p className="text-[13px] font-semibold text-[#c8c0b0] mb-2">{t.discountNotEarnedTitle}</p>
                <p className="text-[12px] text-[#999] leading-relaxed">{t.discountNotEarnedBody}</p>
              </>
            )}
          </div>
        )}

        <Link
          href="/dashboard"
          className="inline-block mt-8 text-[13px] text-[#c9a84c] hover:text-[#e8c97a] transition-colors">
          {t.backToDashboard}
        </Link>
      </div>
    </div>
  );
}
