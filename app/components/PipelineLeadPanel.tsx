"use client";

import { useState } from "react";
import type { PipelineOpportunity } from "@/lib/pipeline/getPipelineOverview";

type QuickTab = "overview" | "outreach" | "templates" | "followup";

export default function PipelineLeadPanel({
  opportunity,
  language,
  onClose,
  onViewFullBreakdown,
}: {
  opportunity: PipelineOpportunity;
  language: "en" | "sv";
  onClose: () => void;
  onViewFullBreakdown: () => Promise<void>;
}) {
  const [tab, setTab] = useState<QuickTab>("overview");
  const [loadingFullBreakdown, setLoadingFullBreakdown] = useState(false);

  const tabs: { key: QuickTab; label: string; comingSoon?: boolean }[] = [
    { key: "overview", label: language === "sv" ? "Översikt" : "Overview" },
    { key: "outreach", label: language === "sv" ? "Utskick" : "Outreach", comingSoon: true },
    { key: "templates", label: language === "sv" ? "Mallar" : "Templates", comingSoon: true },
    { key: "followup", label: language === "sv" ? "Uppföljning" : "Follow-up", comingSoon: true },
  ];

  async function handleFullBreakdown() {
    setLoadingFullBreakdown(true);
    try {
      await onViewFullBreakdown();
    } finally {
      setLoadingFullBreakdown(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9998,
        background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(4px)",
        display: "flex",
        justifyContent: "flex-end",
      }}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="h-full w-full max-w-md bg-[#0d0d0d] border-l border-[#252525] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a1a1a] shrink-0">
          <div className="min-w-0">
            <p className="text-[15px] font-medium text-[#f5f0e8] truncate">{opportunity.name}</p>
            {opportunity.city && <p className="text-[12px] text-[#666]">{opportunity.city}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 w-8 h-8 rounded-lg border border-[#252525] text-[#888] hover:text-[#f5f0e8] hover:border-[#444] transition-colors flex items-center justify-center">
            ✕
          </button>
        </div>

        <div className="flex border-b border-[#1a1a1a] shrink-0">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={
                "flex-1 px-3 py-2.5 text-[12px] font-medium transition-colors relative " +
                (tab === t.key ? "text-[#c9a84c]" : "text-[#666] hover:text-[#999]")
              }>
              {t.label}
              {t.comingSoon && <span className="ml-1 text-[9px] text-[#444] align-top">soon</span>}
              {tab === t.key && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#c9a84c]" />}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {tab === "overview" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl p-3">
                  <p className="text-[10px] text-[#666] uppercase tracking-wide">
                    {language === "sv" ? "Poäng" : "Score"}
                  </p>
                  <p className="text-[20px] font-semibold text-[#c9a84c]">{opportunity.opportunityValue}</p>
                </div>
                <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl p-3">
                  <p className="text-[10px] text-[#666] uppercase tracking-wide">
                    {language === "sv" ? "Steg" : "Stage"}
                  </p>
                  <p className="text-[14px] font-medium text-[#f5f0e8] capitalize mt-1">{opportunity.stage}</p>
                </div>
              </div>
              {opportunity.revenue !== null && (
                <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl p-3">
                  <p className="text-[10px] text-[#666] uppercase tracking-wide">
                    {language === "sv" ? "Intäkt" : "Revenue"}
                  </p>
                  <p className="text-[16px] font-semibold text-[#4ade80]">
                    {opportunity.revenue.toLocaleString(language === "sv" ? "sv-SE" : "en-US")}
                  </p>
                </div>
              )}
            </div>
          )}

          {tab !== "overview" && (
            <div className="text-center py-16">
              <p className="text-[13px] text-[#666]">
                {language === "sv"
                  ? 'Denna funktion kommer snart — använd "Se fullständig översikt" nedan under tiden.'
                  : 'This is coming soon — use "View full breakdown" below in the meantime.'}
              </p>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-[#1a1a1a] shrink-0">
          <button
            type="button"
            onClick={handleFullBreakdown}
            disabled={loadingFullBreakdown}
            className="w-full py-2.5 rounded-lg bg-[#c9a84c] text-[#080808] text-[13px] font-semibold hover:bg-[#e8c97a] disabled:opacity-50 transition-colors">
            {loadingFullBreakdown
              ? language === "sv"
                ? "Laddar…"
                : "Loading…"
              : language === "sv"
                ? "Se fullständig översikt →"
                : "View full breakdown →"}
          </button>
        </div>
      </div>
    </div>
  );
}
