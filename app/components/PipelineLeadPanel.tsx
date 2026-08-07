"use client";

import { useEffect, useState } from "react";
import type { PipelineOpportunity } from "@/lib/pipeline/getPipelineOverview";
import type { LeadOutcomeUI } from "@/app/dashboard/page";

type QuickTab = "overview" | "outreach" | "templates" | "followup";

export default function PipelineLeadPanel({
  opportunity,
  language,
  onClose,
  onViewFullBreakdown,
  saveOutcome,
  loadAndSelectLead,
  selectedLead,
  scriptText,
}: {
  opportunity: PipelineOpportunity;
  language: "en" | "sv";
  onClose: () => void;
  onViewFullBreakdown: () => Promise<void>;
  saveOutcome: (args: {
    runId: number;
    leadId: string;
    patch: Partial<Pick<LeadOutcomeUI, "followup_date">>;
  }) => Promise<void>;
  loadAndSelectLead: (runId: number, leadId: string) => Promise<boolean>;
  selectedLead: { id: string } | null;
  scriptText: string;
}) {
  const [tab, setTab] = useState<QuickTab>("overview");
  const [loadingFullBreakdown, setLoadingFullBreakdown] = useState(false);
  const [loadingOutreach, setLoadingOutreach] = useState(false);
  const [outreachLoadFailed, setOutreachLoadFailed] = useState(false);
  const [copiedOutreach, setCopiedOutreach] = useState(false);

  // Outreach text lives on the full lead object (metadata.outreach),
  // pre-generated when the lead was scored — not something generated
  // on-demand here. Fetch the full lead once when this tab is opened,
  // same mechanism as "View full breakdown" uses, just without closing
  // the quick panel.
  useEffect(() => {
    if (tab !== "outreach") return;
    if (selectedLead?.id === opportunity.leadId) return; // already loaded
    if (!opportunity.runId) {
      setOutreachLoadFailed(true);
      return;
    }
    setLoadingOutreach(true);
    setOutreachLoadFailed(false);
    loadAndSelectLead(opportunity.runId, opportunity.leadId)
      .then((ok) => {
        if (!ok) setOutreachLoadFailed(true);
      })
      .finally(() => setLoadingOutreach(false));
  }, [tab, opportunity.runId, opportunity.leadId, selectedLead?.id, loadAndSelectLead]);

  async function handleCopyOutreach() {
    try {
      await navigator.clipboard.writeText(scriptText);
      setCopiedOutreach(true);
      setTimeout(() => setCopiedOutreach(false), 2000);
    } catch {
      // clipboard access denied — silently no-op
    }
  }

  // Existing follow-up date, if one was already set (e.g. from
  // Dashboard) — fetched once when the panel opens, since Pipeline
  // doesn't otherwise have this lead's outcome loaded. Reuses the same
  // ?all=true endpoint Stats already relies on rather than a new route.
  const [existingFollowupDate, setExistingFollowupDate] = useState<string | null | undefined>(undefined);
  const [followupInput, setFollowupInput] = useState("");
  const [savingFollowup, setSavingFollowup] = useState(false);
  const [followupSaved, setFollowupSaved] = useState(false);

  const [templates, setTemplates] = useState<
    { id: string; name: string; channel: string; subject: string | null; body: string }[] | null
  >(null);
  const [copiedTemplateId, setCopiedTemplateId] = useState<string | null>(null);

  useEffect(() => {
    if (tab !== "templates" || templates !== null) return;
    fetch("/api/outreach/templates")
      .then((res) => (res.ok ? res.json() : { templates: [] }))
      .then((data) => setTemplates(data.templates ?? []))
      .catch(() => setTemplates([]));
  }, [tab, templates]);

  async function handleCopyTemplate(id: string, body: string) {
    try {
      await navigator.clipboard.writeText(body);
      setCopiedTemplateId(id);
      setTimeout(() => setCopiedTemplateId(null), 2000);
    } catch {
      // clipboard access denied — silently no-op, button just won't confirm
    }
  }

  useEffect(() => {
    setExistingFollowupDate(undefined);
    setFollowupSaved(false);
    fetch("/api/outcomes?all=true")
      .then((res) => (res.ok ? res.json() : { outcomes: [] }))
      .then((data) => {
        const outcomes = (data.outcomes ?? []) as { lead_id: string; followup_date: string | null }[];
        const match = outcomes.find((o) => o.lead_id === opportunity.leadId);
        const date = match?.followup_date ?? null;
        setExistingFollowupDate(date);
        setFollowupInput(date ? date.slice(0, 10) : "");
      })
      .catch(() => setExistingFollowupDate(null));
  }, [opportunity.leadId]);

  async function handleSaveFollowup() {
    if (!opportunity.runId || !followupInput) return;
    setSavingFollowup(true);
    try {
      await saveOutcome({
        runId: opportunity.runId,
        leadId: opportunity.leadId,
        patch: { followup_date: followupInput },
      });
      setExistingFollowupDate(followupInput);
      setFollowupSaved(true);
      setTimeout(() => setFollowupSaved(false), 2000);
    } finally {
      setSavingFollowup(false);
    }
  }

  const tabs: { key: QuickTab; label: string; comingSoon?: boolean }[] = [
    { key: "overview", label: language === "sv" ? "Översikt" : "Overview" },
    { key: "outreach", label: language === "sv" ? "Utskick" : "Outreach" },
    { key: "templates", label: language === "sv" ? "Mallar" : "Templates" },
    { key: "followup", label: language === "sv" ? "Uppföljning" : "Follow-up" },
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
              {opportunity.reasons.length > 0 && (
                <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl p-3">
                  <p className="text-[10px] text-[#666] uppercase tracking-wide mb-1.5">
                    {language === "sv" ? "Eftersom" : "Because"}
                  </p>
                  <ul className="space-y-1">
                    {opportunity.reasons.map((reason, i) => (
                      <li key={i} className="text-[12px] text-[#ccc] flex gap-1.5">
                        <span className="text-[#555] shrink-0">•</span>
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {tab === "followup" && (
            <div className="space-y-4">
              {existingFollowupDate === undefined ? (
                <p className="text-[12px] text-[#666]">{language === "sv" ? "Laddar…" : "Loading…"}</p>
              ) : (
                <>
                  {existingFollowupDate && (
                    <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl p-3">
                      <p className="text-[10px] text-[#666] uppercase tracking-wide">
                        {language === "sv" ? "Nuvarande datum" : "Current date"}
                      </p>
                      <p className="text-[14px] text-[#f5f0e8] mt-1">
                        {new Date(existingFollowupDate).toLocaleDateString(language === "sv" ? "sv-SE" : "en-US")}
                      </p>
                    </div>
                  )}
                  <div>
                    <label className="text-[11px] text-[#888] block mb-1.5">
                      {existingFollowupDate
                        ? language === "sv"
                          ? "Ändra datum"
                          : "Change date"
                        : language === "sv"
                          ? "Sätt uppföljningsdatum"
                          : "Set a follow-up date"}
                    </label>
                    <input
                      type="date"
                      value={followupInput}
                      onChange={(e) => setFollowupInput(e.target.value)}
                      className="w-full bg-[#111111] border border-[#252525] rounded-lg px-3 py-2 text-[13px] text-[#f5f0e8] focus:outline-none focus:border-[#444]"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveFollowup}
                    disabled={!followupInput || savingFollowup || !opportunity.runId}
                    className="w-full py-2 rounded-lg border border-[#c9a84c] text-[#c9a84c] text-[12px] font-medium hover:bg-[rgba(201,168,76,0.08)] disabled:opacity-40 transition-colors">
                    {followupSaved
                      ? language === "sv"
                        ? "Sparat ✓"
                        : "Saved ✓"
                      : savingFollowup
                        ? language === "sv"
                          ? "Sparar…"
                          : "Saving…"
                        : language === "sv"
                          ? "Spara"
                          : "Save"}
                  </button>
                  {!opportunity.runId && (
                    <p className="text-[10px] text-[#666]">
                      {language === "sv"
                        ? "Denna möjlighet saknar en kopplad sökning och kan inte uppdateras här."
                        : "This opportunity has no linked search run and can't be updated here."}
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {tab === "templates" && (
            <div className="space-y-2">
              {templates === null ? (
                <p className="text-[12px] text-[#666]">{language === "sv" ? "Laddar…" : "Loading…"}</p>
              ) : templates.length === 0 ? (
                <p className="text-[12px] text-[#666] py-6 text-center">
                  {language === "sv"
                    ? "Inga sparade mallar än. Skapa mallar på sidan Mallar."
                    : "No saved templates yet. Create some on the Templates page."}
                </p>
              ) : (
                templates.map((tpl) => (
                  <div key={tpl.id} className="bg-[#111111] border border-[#1e1e1e] rounded-xl p-3">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-[13px] text-[#f5f0e8] font-medium truncate">{tpl.name}</p>
                      <span className="text-[9px] uppercase tracking-wide text-[#666] shrink-0">{tpl.channel}</span>
                    </div>
                    <p className="text-[11px] text-[#888] line-clamp-2 mb-2">{tpl.body}</p>
                    <button
                      type="button"
                      onClick={() => handleCopyTemplate(tpl.id, tpl.body)}
                      className="text-[11px] text-[#c9a84c] hover:text-[#e8c97a] transition-colors">
                      {copiedTemplateId === tpl.id
                        ? language === "sv"
                          ? "Kopierat ✓"
                          : "Copied ✓"
                        : language === "sv"
                          ? "Kopiera text"
                          : "Copy text"}
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === "outreach" && (
            <div className="space-y-3">
              {!opportunity.runId ? (
                <p className="text-[12px] text-[#666] py-6 text-center">
                  {language === "sv"
                    ? "Denna möjlighet saknar en kopplad sökning — utskicksförslag kan inte visas här."
                    : "This opportunity has no linked search run — outreach text can't be shown here."}
                </p>
              ) : loadingOutreach ? (
                <p className="text-[12px] text-[#666] py-6 text-center">
                  {language === "sv" ? "Laddar utskicksförslag…" : "Loading outreach draft…"}
                </p>
              ) : outreachLoadFailed ? (
                <p className="text-[12px] text-[#666] py-6 text-center">
                  {language === "sv"
                    ? 'Kunde inte ladda utskicksförslag. Prova "Se fullständig översikt" nedan.'
                    : 'Could not load the outreach draft. Try "View full breakdown" below.'}
                </p>
              ) : !scriptText ? (
                <p className="text-[12px] text-[#666] py-6 text-center">
                  {language === "sv"
                    ? "Inget utskicksförslag genererat för denna lead än."
                    : "No outreach draft generated for this lead yet."}
                </p>
              ) : (
                <>
                  <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl p-3">
                    <p className="text-[13px] text-[#f5f0e8] whitespace-pre-wrap leading-relaxed">{scriptText}</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyOutreach}
                    className="w-full py-2 rounded-lg border border-[#c9a84c] text-[#c9a84c] text-[12px] font-medium hover:bg-[rgba(201,168,76,0.08)] transition-colors">
                    {copiedOutreach
                      ? language === "sv"
                        ? "Kopierat ✓"
                        : "Copied ✓"
                      : language === "sv"
                        ? "Kopiera text"
                        : "Copy text"}
                  </button>
                  <p className="text-[10px] text-[#555]">
                    {language === "sv"
                      ? 'Vill du ändra ton eller generera om? Använd "Se fullständig översikt" nedan.'
                      : 'Want to change tone or regenerate? Use "View full breakdown" below.'}
                  </p>
                </>
              )}
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
