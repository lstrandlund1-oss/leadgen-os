"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import HamburgerMenu from "@/app/components/HamburgerMenu";
import { createSupabaseBrowser } from "@/lib/supabaseBrowser";
import { getTranslations } from "@/lib/i18n";
import type { Language } from "@/lib/i18n/types";

type SequenceStep = {
  id: number;
  lead_id: string;
  run_id: number;
  company_name: string | null;
  step: number;
  day_offset: number;
  scheduled_date: string;
  channel: "email" | "call" | "dm" | "linkedin";
  subject: string | null;
  message: string;
  objective: string;
  cta: string;
  status: "pending" | "sent" | "replied" | "skipped";
  cadence_type: "aggressive" | "standard" | "nurture";
};

// Legacy follow-up (from lead_outcomes)
type LegacyFollowup = {
  lead_id: string;
  run_id: number;
  company_name: string | null;
  followup_date: string | null;
  contacted: boolean;
  replied: boolean;
  notes: string | null;
  days_until: number | null;
  is_overdue: boolean;
};

function daysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 86400000);
}

function dateColor(days: number): string {
  if (days < 0) return "#f87171";
  if (days === 0) return "#c9a84c";
  if (days <= 3) return "#fb923c";
  return "#4ade80";
}

const CHANNEL_ICONS: Record<string, string> = {
  email: "✉",
  call: "☎",
  dm: "◎",
  linkedin: "in",
};

const CADENCE_COLORS: Record<string, string> = {
  aggressive: "#f87171",
  standard: "#c9a84c",
  nurture: "#4ade80",
};

export default function FollowupsPage() {
  const supabase = createSupabaseBrowser();
  const [language] = useState<Language>(() => {
    if (typeof window === "undefined") return "sv";
    try {
      const p = JSON.parse(localStorage.getItem("vantio_state_v1") ?? "{}");
      return p.language === "en" || p.language === "sv" ? p.language : "sv";
    } catch {
      return "sv";
    }
  });
  const t = getTranslations(language).ui.followups;
  const tShared = getTranslations(language).ui.settings; // reused for betaBadge — identical concept, avoids duplicating it here

  function dateLabel(days: number): string {
    if (days < 0) return t.dateLabels.overdue.replace("{days}", String(Math.abs(days)));
    if (days === 0) return t.dateLabels.today;
    if (days === 1) return t.dateLabels.tomorrow;
    return t.dateLabels.inDays.replace("{days}", String(days));
  }

  const CHANNEL_LABELS: Record<string, string> = t.channels;
  const CADENCE_LABELS: Record<string, string> = t.cadenceLabels;
  const STATUS_STYLES: Record<string, { color: string; label: string }> = {
    pending: { color: "#555", label: t.statusLabels.pending },
    sent: { color: "#3b82f6", label: t.statusLabels.sent },
    replied: { color: "#4ade80", label: t.statusLabels.replied },
    skipped: { color: "#333", label: t.statusLabels.skipped },
  };

  // Locale-aware date formatting — the previous hardcoded "en-GB" formatted
  // dates in English regardless of interface language.
  const dateLocale = language === "sv" ? "sv-SE" : "en-GB";
  const [userEmail, setUserEmail] = useState("");
  const [steps, setSteps] = useState<SequenceStep[]>([]);
  const [legacyFollowups, setLegacyFollowups] = useState<LegacyFollowup[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "today" | "upcoming" | "overdue">("today");
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setUserEmail(data.user.email);
    });

    // Load sequence steps
    const loadSteps = supabase
      .from("lead_sequences")
      .select("*")
      .in("status", ["pending", "sent"])
      .order("scheduled_date", { ascending: true })
      .then(({ data }) => setSteps((data ?? []) as SequenceStep[]));

    // Load legacy follow-ups from outcomes
    const loadLegacy = fetch("/api/outcomes?all=true")
      .then((r) => r.json())
      .then(
        (d: {
          outcomes?: Array<{
            lead_id: string;
            run_id: number;
            followup_date?: string | null;
            contacted: boolean;
            replied: boolean;
            notes?: string | null;
            company_name?: string | null;
          }>;
        }) => {
          // Previously filtered to only outcomes with a followup_date set,
          // which meant a lead marked "contacted" without also scheduling a
          // specific follow-up date was silently excluded from this page
          // entirely. Now includes any outcome that's contacted OR has a
          // date, so contacted leads are always visible here.
          const withDates = (d.outcomes ?? [])
            .filter((o) => o.contacted || o.followup_date)
            .map((o) => {
              const days = o.followup_date ? daysUntil(o.followup_date) : null;
              return {
                lead_id: o.lead_id,
                run_id: o.run_id,
                company_name: o.company_name ?? null,
                followup_date: o.followup_date ?? null,
                contacted: o.contacted,
                replied: o.replied,
                notes: o.notes ?? null,
                days_until: days,
                is_overdue: days !== null && days < 0,
              };
            })
            .sort((a, b) => {
              // Dated ones first (soonest/most overdue first), date-less
              // contacted leads after, grouped at the end rather than
              // interleaved arbitrarily.
              if (a.days_until === null && b.days_until === null) return 0;
              if (a.days_until === null) return 1;
              if (b.days_until === null) return -1;
              return a.days_until - b.days_until;
            });
          setLegacyFollowups(withDates);
        },
      );

    Promise.allSettled([loadSteps, loadLegacy]).finally(() => setLoading(false));
  }, []);

  async function updateStepStatus(stepId: number, status: SequenceStep["status"]) {
    setUpdatingId(stepId);
    try {
      const res = await fetch(`/api/sequences/${stepId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setSteps((prev) => prev.map((s) => (s.id === stepId ? { ...s, status } : s)));
      }
    } finally {
      setUpdatingId(null);
    }
  }

  // Filter steps
  const filteredSteps = steps.filter((s) => {
    const days = daysUntil(s.scheduled_date);
    if (filter === "today") return days === 0;
    if (filter === "overdue") return days < 0;
    if (filter === "upcoming") return days > 0;
    return true;
  });

  const todayCount = steps.filter((s) => daysUntil(s.scheduled_date) === 0).length;
  const overdueCount = steps.filter((s) => daysUntil(s.scheduled_date) < 0).length;
  const upcomingCount = steps.filter((s) => daysUntil(s.scheduled_date) > 0).length;

  // Group steps by lead
  const stepsByLead = filteredSteps.reduce<Record<string, SequenceStep[]>>((acc, step) => {
    const key = step.lead_id;
    if (!acc[key]) acc[key] = [];
    acc[key].push(step);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-[#080808] text-[#f5f0e8] overflow-x-hidden">
      <nav className="w-full border-b border-[#151515] bg-[#080808]/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-[#c9a84c]">◈</span>
            <Link
              href="/"
              className="text-[17px] font-light tracking-wide hover:opacity-80 transition-opacity"
              style={{ fontFamily: "var(--font-display), serif" }}>
              Van
              <span
                style={{
                  background: "linear-gradient(135deg, #e8c97a 0%, #c9a84c 50%, #8a6e30 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}>
                tio
              </span>
            </Link>
            <span className="text-[9px] tracking-[0.15em] uppercase px-2 py-0.5 rounded-full border border-[rgba(201,168,76,0.25)] text-[#8a6e30]">
              {tShared.betaBadge}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-[12px] text-[#555] hover:text-[#888] transition-colors">
              ← Dashboard
            </Link>
            <HamburgerMenu userEmail={userEmail} />
          </div>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-5 py-10 space-y-6">
        {/* Header */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] tracking-[0.2em] uppercase text-[#8a6e30] mb-1">{t.pipelineEyebrow}</p>
            <h1 className="text-3xl md:text-4xl font-light" style={{ fontFamily: "var(--font-display), serif" }}>
              {t.headerTitleStart}{" "}
              <span className="italic" style={{ color: "#c9a84c" }}>
                {t.headerTitleItalic}
              </span>
            </h1>
            <p className="text-[12px] text-[#444] mt-1.5">{t.headerSubtitle}</p>
          </div>
          {/* Stats */}
          <div className="flex items-center gap-3">
            {overdueCount > 0 && (
              <div className="rounded-xl border border-[#f87171]/25 bg-[#f87171]/06 px-4 py-2 text-center">
                <p className="text-[18px] font-bold text-[#f87171]">{overdueCount}</p>
                <p className="text-[10px] text-[#f87171]/60 uppercase tracking-widest">{t.overdueLabel}</p>
              </div>
            )}
            {todayCount > 0 && (
              <div className="rounded-xl border border-[rgba(201,168,76,0.25)] bg-[rgba(201,168,76,0.04)] px-4 py-2 text-center">
                <p className="text-[18px] font-bold text-[#c9a84c]">{todayCount}</p>
                <p className="text-[10px] text-[#8a6e30] uppercase tracking-widest">{t.todayLabel}</p>
              </div>
            )}
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 flex-wrap">
          {(
            [
              { key: "today", label: t.filterToday.replace("{count}", String(todayCount)) },
              { key: "overdue", label: t.filterOverdue.replace("{count}", String(overdueCount)) },
              { key: "upcoming", label: t.filterUpcoming.replace("{count}", String(upcomingCount)) },
              { key: "all", label: t.filterAll.replace("{count}", String(steps.length)) },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={
                "px-3 py-1.5 rounded-lg border text-[11px] font-medium transition-all " +
                (filter === key
                  ? "border-[#c9a84c] bg-[rgba(201,168,76,0.08)] text-[#c9a84c]"
                  : "border-[#252525] text-[#555] hover:border-[#333]")
              }>
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-20 text-center text-[#444] text-sm animate-pulse">{t.loadingSequences}</div>
        ) : steps.length === 0 && legacyFollowups.length === 0 ? (
          <div className="rounded-2xl border border-[#1a1a1a] bg-[#0d0d0d] p-12 text-center space-y-3">
            <p className="text-3xl text-[#1a1a1a]">⇉</p>
            <p className="text-[14px] text-[#444]">{t.noActiveSequences}</p>
            <p className="text-[12px] text-[#2a2a2a] leading-relaxed max-w-xs mx-auto">
              {t.noActiveSequencesBodyStart} <span className="text-[#c9a84c]">{t.buildSequenceHighlight}</span>{" "}
              {t.noActiveSequencesBodyEnd}
            </p>
            <Link
              href="/dashboard"
              className="inline-block mt-2 text-[12px] text-[#c9a84c] hover:text-[#e8c97a] transition-colors">
              {t.goToDashboard}
            </Link>
          </div>
        ) : filteredSteps.length === 0 ? (
          <div className="rounded-2xl border border-[#1a1a1a] bg-[#0d0d0d] p-8 text-center">
            <p className="text-[13px] text-[#444]">{filter === "today" ? t.noStepsToday : t.noStepsFilter}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {Object.entries(stepsByLead).map(([leadId, leadSteps]) => {
              const company = leadSteps[0].company_name ?? `Lead ${leadId.slice(0, 8)}`;
              const cadence = leadSteps[0].cadence_type;
              const cadenceColor = CADENCE_COLORS[cadence] ?? "#888";

              return (
                <div key={leadId} className="rounded-2xl border border-[#1a1a1a] bg-[#0d0d0d] overflow-hidden">
                  {/* Lead header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[#141414]">
                    <div className="flex items-center gap-3">
                      <span className="text-[13px] font-medium text-[#c8c0b0]">{company}</span>
                      <span
                        className="text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded border"
                        style={{
                          color: cadenceColor,
                          borderColor: `${cadenceColor}30`,
                          background: `${cadenceColor}08`,
                        }}>
                        {CADENCE_LABELS[cadence]} {t.cadenceSuffix}
                      </span>
                    </div>
                    <Link href="/dashboard" className="text-[11px] text-[#444] hover:text-[#c9a84c] transition-colors">
                      {t.viewLead}
                    </Link>
                  </div>

                  {/* Steps */}
                  {leadSteps.map((step) => {
                    const days = daysUntil(step.scheduled_date);
                    const color = dateColor(days);
                    const isExpanded = expandedStep === step.id;
                    const statusStyle = STATUS_STYLES[step.status];

                    return (
                      <div key={step.id} className="border-b border-[#0f0f0f] last:border-0">
                        {/* Step row */}
                        <div
                          className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[#111] transition-colors"
                          onClick={() => setExpandedStep(isExpanded ? null : step.id)}>
                          {/* Step number */}
                          <div className="flex-shrink-0 w-6 h-6 rounded-full border border-[#252525] flex items-center justify-center">
                            <span className="text-[10px] text-[#555]">{step.step}</span>
                          </div>

                          {/* Date badge */}
                          <div className="flex-shrink-0 w-[72px] text-right">
                            <p className="text-[11px] font-medium" style={{ color }}>
                              {dateLabel(days)}
                            </p>
                            <p className="text-[9px]" style={{ color: `${color}70` }}>
                              {new Date(step.scheduled_date).toLocaleDateString(dateLocale, {
                                day: "numeric",
                                month: "short",
                              })}
                            </p>
                          </div>

                          {/* Channel */}
                          <div className="flex-shrink-0 w-[52px] flex items-center gap-1">
                            <span className="text-[12px] text-[#555]">{CHANNEL_ICONS[step.channel]}</span>
                            <span className="text-[10px] text-[#444]">{CHANNEL_LABELS[step.channel]}</span>
                          </div>

                          {/* Objective */}
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] text-[#888] truncate">{step.objective}</p>
                          </div>

                          {/* Status */}
                          <div className="flex-shrink-0 flex items-center gap-2">
                            <span className="text-[10px]" style={{ color: statusStyle.color }}>
                              {statusStyle.label}
                            </span>
                            <span className="text-[#333] text-[10px]">{isExpanded ? "▲" : "▼"}</span>
                          </div>
                        </div>

                        {/* Expanded message */}
                        {isExpanded && (
                          <div className="px-4 pb-4 space-y-3 bg-[#0a0a0a]">
                            {step.subject && (
                              <div>
                                <p className="text-[9px] uppercase tracking-widest text-[#333] mb-1">
                                  {t.subjectLabel}
                                </p>
                                <p className="text-[12px] text-[#888]">{step.subject}</p>
                              </div>
                            )}
                            <div>
                              <p className="text-[9px] uppercase tracking-widest text-[#333] mb-1.5">
                                {t.messageLabel}
                              </p>
                              <p className="text-[12px] text-[#c8c0b0] leading-relaxed whitespace-pre-wrap">
                                {step.message}
                              </p>
                            </div>
                            <div>
                              <p className="text-[9px] uppercase tracking-widests text-[#333] mb-1">{t.ctaLabel}</p>
                              <p className="text-[11px] text-[#666]">{step.cta}</p>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2 pt-1 flex-wrap">
                              {step.status === "pending" && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => updateStepStatus(step.id, "sent")}
                                    disabled={updatingId === step.id}
                                    className="px-3 py-1.5 rounded-lg border border-[#3b82f6]/30 text-[11px] text-[#3b82f6] hover:bg-[#3b82f6]/08 disabled:opacity-40 transition-all">
                                    {updatingId === step.id ? "…" : t.markSent}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => updateStepStatus(step.id, "skipped")}
                                    disabled={updatingId === step.id}
                                    className="px-3 py-1.5 rounded-lg border border-[#252525] text-[11px] text-[#444] hover:border-[#333] hover:text-[#666] disabled:opacity-40 transition-all">
                                    {t.skip}
                                  </button>
                                </>
                              )}
                              {step.status === "sent" && (
                                <button
                                  type="button"
                                  onClick={() => updateStepStatus(step.id, "replied")}
                                  disabled={updatingId === step.id}
                                  className="px-3 py-1.5 rounded-lg border border-[#4ade80]/30 text-[11px] text-[#4ade80] hover:bg-[#4ade80]/08 disabled:opacity-40 transition-all">
                                  {updatingId === step.id ? "…" : t.gotReply}
                                </button>
                              )}
                              {(step.status === "sent" || step.status === "replied") && (
                                <span className="text-[10px] text-[#333]">
                                  {step.status === "replied" ? t.repliedCelebration : t.sentAwaitingReply}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}

        {/* Legacy follow-ups section — shown if any exist */}
        {legacyFollowups.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <p className="text-[10px] uppercase tracking-widest text-[#333]">{t.legacyFollowupsLabel}</p>
              <div className="flex-1 h-px bg-[#1a1a1a]" />
            </div>
            {legacyFollowups.map((lead) => {
              const color = lead.days_until !== null ? dateColor(lead.days_until) : "#3b82f6";
              return (
                <div
                  key={lead.lead_id}
                  className="rounded-2xl border border-[#1a1a1a] bg-[#0d0d0d] p-4 flex items-start gap-4">
                  <div
                    className="flex-shrink-0 rounded-xl border px-3 py-2.5 text-center min-w-[72px]"
                    style={{ borderColor: `${color}35`, backgroundColor: `${color}0a` }}>
                    {lead.days_until !== null && lead.followup_date ? (
                      <>
                        <p className="text-[11px] font-bold" style={{ color }}>
                          {dateLabel(lead.days_until)}
                        </p>
                        <p className="text-[9px] mt-0.5" style={{ color: `${color}80` }}>
                          {new Date(lead.followup_date).toLocaleDateString(dateLocale, {
                            day: "numeric",
                            month: "short",
                          })}
                        </p>
                      </>
                    ) : (
                      <p className="text-[11px] font-bold" style={{ color }}>
                        {t.contactedStatusLabel}
                      </p>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-[#888] truncate">
                      {lead.company_name ?? t.leadFallback.replace("{id}", lead.lead_id.slice(0, 8))}
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      {lead.contacted && <span className="text-[10px] text-[#3b82f6]">{t.contactedBadge}</span>}
                      {lead.replied && <span className="text-[10px] text-[#c9a84c]">{t.repliedBadge}</span>}
                      {!lead.contacted && <span className="text-[10px] text-[#333]">{t.notContactedYet}</span>}
                    </div>
                    {lead.notes && <p className="text-[11px] text-[#444] mt-1.5 line-clamp-2">{lead.notes}</p>}
                  </div>
                  <Link
                    href="/dashboard"
                    className="flex-shrink-0 px-3 py-2 rounded-xl border border-[#1a1a1a] text-[11px] text-[#444] hover:border-[rgba(201,168,76,0.3)] hover:text-[#c9a84c] transition-all whitespace-nowrap">
                    {t.open}
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
