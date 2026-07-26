"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import HamburgerMenu from "@/app/components/HamburgerMenu";
import { getEffectivePlan, canUseOutreach } from "@/lib/plan";
import { createSupabaseBrowser } from "@/lib/supabaseBrowser";
import { getTranslations } from "@/lib/i18n";
import type { Language } from "@/lib/i18n/types";

type OutreachChannel = "email" | "linkedin_dm" | "cold_call";
type OutreachTone = "professional" | "consultative" | "friendly" | "direct" | "bold";
type OutreachObjective = "first_touch";
type RefineAction = "shorten" | "warmer" | "more_direct" | "more_formal";

type OutreachResult = {
  brief: {
    gap_type: string;
    tone: string;
    channel: string;
    top_opportunity: string;
    recommended_angle: string;
    lead_strengths: string[];
    lead_weaknesses: string[];
    evidence_confidence: string;
    max_words: number;
    peer_group: string;
  };
  message: { subject?: string; body: string; word_count: number; channel: string };
  generated_at: string;
};

type LeadSnapshot = {
  id: string;
  company_name: string;
  industry: string | null;
  city: string | null;
  website: string | null;
  rating: number | null;
  review_count: number | null;
  social_presence: string | null;
  opportunity: number;
  readiness: number;
  risk: number;
  signals: Record<string, unknown>;
  matched_needs: string[];
  missing_needs: string[];
  fit_score: number;
};

type SavedLeadItem = {
  id: string;
  run_id: number;
  company_name: string;
  industry: string | null;
  city: string | null;
  website: string | null;
  rating: number | null;
  review_count: number | null;
  social_presence: string | null;
};

const CONFIDENCE_COLOR: Record<string, string> = {
  high: "#4ade80",
  medium: "#c9a84c",
  low: "#f87171",
};

export default function OutreachPage() {
  const plan = getEffectivePlan();
  const unlocked = canUseOutreach(plan);
  const [language] = useState<Language>(() => {
    if (typeof window === "undefined") return "sv";
    try {
      const p = JSON.parse(localStorage.getItem("vantio_state_v1") ?? "{}");
      return p.language === "en" || p.language === "sv" ? p.language : "sv";
    } catch {
      return "sv";
    }
  });
  const t = getTranslations(language).ui.outreach;

  const CHANNEL_META: Record<OutreachChannel, { label: string; icon: string; note: string }> = useMemo(
    () => ({
      email: { label: t.channels.email.label, icon: "✉", note: t.channels.email.note },
      linkedin_dm: { label: t.channels.linkedin_dm.label, icon: "◈", note: t.channels.linkedin_dm.note },
      cold_call: { label: t.channels.cold_call.label, icon: "☎", note: t.channels.cold_call.note },
    }),
    [t],
  );

  const TONE_META: Record<OutreachTone, { label: string; desc: string }> = useMemo(
    () => ({
      professional: t.tones.professional,
      consultative: t.tones.consultative,
      friendly: t.tones.friendly,
      direct: t.tones.direct,
      bold: t.tones.bold,
    }),
    [t],
  );

  const OBJECTIVE_META: Record<OutreachObjective, { label: string; desc: string; icon: string }> = useMemo(
    () => ({
      first_touch: { ...t.objectiveFirstTouch, icon: "◎" },
    }),
    [t],
  );

  const GAP_CONFIG: Record<string, { label: string; color: string; icon: string }> = useMemo(
    () => ({
      VISIBILITY: { label: t.gapLabels.visibility, color: "#818cf8", icon: "◎" },
      CONVERSION: { label: t.gapLabels.conversion, color: "#fb923c", icon: "⬡" },
      INFRASTRUCTURE: { label: t.gapLabels.infrastructure, color: "#f87171", icon: "△" },
      OPTIMIZATION: { label: t.gapLabels.optimization, color: "#34d399", icon: "◆" },
    }),
    [t],
  );

  // Instructions are AI prompts (backend-facing, not UI text) — deliberately
  // left in English regardless of interface language, since Claude reads
  // them as a modifier alongside the separate outreach-language parameter.
  // Only the button label is translated.
  const REFINE_ACTIONS: { key: RefineAction; label: string; instruction: string }[] = useMemo(
    () => [
      {
        key: "shorten" as const,
        label: t.refineActions.shorten,
        instruction: "Make this message shorter and more punchy. Cut to the essential. Stay under the word limit.",
      },
      {
        key: "warmer" as const,
        label: t.refineActions.warmer,
        instruction: "Make this message warmer and more human. Less formal, more like a real person typed it.",
      },
      {
        key: "more_direct" as const,
        label: t.refineActions.moreDirect,
        instruction: "Make this more direct and confident. Remove hedging and filler. Get to the point faster.",
      },
      {
        key: "more_formal" as const,
        label: t.refineActions.moreFormal,
        instruction: "Make this more professional and polished. Slightly elevate the register without sounding stiff.",
      },
    ],
    [t],
  );

  const [userEmail, setUserEmail] = useState("");
  const [lead, setLead] = useState<LeadSnapshot | null>(null);
  const [channel, setChannel] = useState<OutreachChannel>("email");
  const [tone, setTone] = useState<OutreachTone | null>(null);
  const objective: OutreachObjective = "first_touch"; // always first touch — sequences handle follow-up
  const [loading, setLoading] = useState(false);
  const [refining, setRefining] = useState<RefineAction | null>(null);
  const [result, setResult] = useState<OutreachResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showSend, setShowSend] = useState(false);
  const [sendTo, setSendTo] = useState("");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<"sent" | "error" | null>(null);
  const [templates, setTemplates] = useState<
    Array<{ id: string; name: string; channel: string; subject?: string; body: string }>
  >([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [savedLeads, setSavedLeads] = useState<SavedLeadItem[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(true);
  const [leadSearch, setLeadSearch] = useState("");

  useEffect(() => {
    const supabase = createSupabaseBrowser();
    supabase.auth.getUser().then(({ data }: { data: { user: { email?: string } | null } }) => {
      if (data.user?.email) setUserEmail(data.user.email);
    });

    // Load saved leads — primary source is localStorage (same as profile page)
    // Supplemented by Supabase API for any additional runs
    const localRaw = localStorage.getItem("vantio_saved_leads_v1");
    const localLeads: SavedLeadItem[] = [];
    if (localRaw) {
      try {
        const parsed = JSON.parse(localRaw) as Array<{
          id: string;
          name?: string;
          company_name?: string;
          industry?: string;
          city?: string;
          website?: string | null;
          rating?: number | null;
          review_count?: number | null;
          social_presence?: string | null;
          score?: number;
        }>;
        for (const l of parsed) {
          localLeads.push({
            id: l.id,
            run_id: 0,
            company_name: l.name ?? l.company_name ?? "Unknown",
            industry: l.industry ?? null,
            city: l.city ?? null,
            website: l.website ?? null,
            rating: l.rating ?? null,
            review_count: l.review_count ?? null,
            social_presence: l.social_presence ?? null,
          });
        }
      } catch {
        /* ignore */
      }
    }

    // Also fetch from Supabase to get any leads not in localStorage
    fetch("/api/outreach/leads")
      .then((r) => r.json())
      .then((d: { leads?: SavedLeadItem[] }) => {
        const supabaseLeads = d.leads ?? [];
        // Merge: localStorage leads take precedence, add any Supabase leads not already present
        const seenIds = new Set(localLeads.map((l) => l.id));
        const merged = [...localLeads, ...supabaseLeads.filter((l) => !seenIds.has(l.id))];
        setSavedLeads(merged);
        // Pre-select lead if passed from dashboard — consumed once, then
        // cleared, so a later visit to this page without a fresh handoff
        // doesn't keep re-showing the last lead someone sent here.
        const stored = localStorage.getItem("vantio_outreach_lead");
        if (stored) {
          try {
            setLead(JSON.parse(stored) as LeadSnapshot);
          } catch {
            /* ignore */
          } finally {
            localStorage.removeItem("vantio_outreach_lead");
          }
        }
      })
      .catch(() => {
        // Fallback to localStorage only if API fails
        setSavedLeads(localLeads);
        const stored = localStorage.getItem("vantio_outreach_lead");
        if (stored) {
          try {
            setLead(JSON.parse(stored) as LeadSnapshot);
          } catch {
            /* ignore */
          } finally {
            localStorage.removeItem("vantio_outreach_lead");
          }
        }
      })
      .finally(() => setLeadsLoading(false));

    // Load saved templates
    fetch("/api/outreach/templates")
      .then((r) => r.json())
      .then(
        (d: { templates?: Array<{ id: string; name: string; channel: string; subject?: string; body: string }> }) => {
          setTemplates(d.templates ?? []);
        },
      )
      .catch(() => {});
  }, []);

  const generate = useCallback(
    async (regen = false) => {
      if (!lead || loading) return;
      if (result && !regen) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/generate-outreach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            company_name: lead.company_name,
            industry: lead.industry,
            city: lead.city,
            website: lead.website,
            rating: lead.rating,
            review_count: lead.review_count,
            social_presence: lead.social_presence,
            opportunity: lead.opportunity,
            readiness: lead.readiness,
            risk: lead.risk,
            signals: lead.signals,
            matched_needs: lead.matched_needs,
            missing_needs: lead.missing_needs,
            fit_score: lead.fit_score,
            channel,
            tone: tone ?? undefined,
            objective,
            language: "sv",
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Unknown error" }));
          setError((err as { error?: string }).error ?? "Generation failed");
          return;
        }
        setResult(await res.json());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to generate");
      } finally {
        setLoading(false);
      }
    },
    [lead, loading, result, channel, tone, objective],
  );

  const refine = useCallback(
    async (action: RefineAction) => {
      if (!result || refining) return;
      setRefining(action);
      const instruction = REFINE_ACTIONS.find((r) => r.key === action)?.instruction ?? "";
      try {
        const currentText = result.message.subject
          ? `Subject: ${result.message.subject}

${result.message.body}`
          : result.message.body;
        const res = await fetch("/api/generate-outreach/refine", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            current_message: currentText,
            instruction,
            channel: result.message.channel,
            max_words: result.brief.max_words,
            language: "sv",
          }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as { subject?: string; body: string; word_count: number };
        setResult((prev) => (prev ? { ...prev, message: { ...prev.message, ...data } } : prev));
      } catch {
        /* fail soft */
      } finally {
        setRefining(null);
      }
    },
    [result, refining, REFINE_ACTIONS],
  );

  useEffect(() => {
    setResult(null);
    setError(null);
    setShowSend(false);
    setSendResult(null);
  }, [channel, tone]);

  const sendOutreachEmail = useCallback(async () => {
    if (!result || !sendTo.trim() || sending) return;
    setSending(true);
    setSendResult(null);
    try {
      const res = await fetch("/api/outreach/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: sendTo.trim(),
          subject: result.message.subject ?? `Re: ${lead?.company_name ?? "Your business"}`,
          body: result.message.body,
          company_name: lead?.company_name,
        }),
      });
      if (res.ok && lead) {
        setSendResult("sent");
        // Log to per-lead activity in localStorage
        try {
          const key = `vantio_activity_${lead.id}`;
          const existing = JSON.parse(localStorage.getItem(key) ?? "[]");
          existing.unshift({
            subject: result!.message.subject ?? "Outreach",
            to: sendTo.trim(),
            sentAt: new Date().toISOString(),
            body: result!.message.body,
          });
          localStorage.setItem(key, JSON.stringify(existing.slice(0, 20)));
        } catch {
          /* ignore */
        }
      } else {
        setSendResult("error");
      }
    } catch {
      setSendResult("error");
    } finally {
      setSending(false);
    }
  }, [result, sendTo, sending, lead]);

  const saveTemplate = useCallback(async () => {
    if (!result || !templateName.trim() || savingTemplate) return;
    setSavingTemplate(true);
    try {
      const res = await fetch("/api/outreach/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: templateName.trim(),
          channel: result.message.channel,
          subject: result.message.subject,
          body: result.message.body,
          tone: result.brief.tone,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          template: { id: string; name: string; channel: string; subject?: string; body: string };
        };
        setTemplates((prev) => [data.template, ...prev]);
        setTemplateName("");
        setShowTemplates(false);
      }
    } catch {
      /* fail soft */
    } finally {
      setSavingTemplate(false);
    }
  }, [result, templateName, savingTemplate]);

  if (!unlocked) {
    return (
      <div className="min-h-screen bg-[#080808] text-[#f5f0e8] flex flex-col">
        <Nav userEmail={userEmail} language={language} />
        <div className="flex-1 flex items-center justify-center px-6 py-20">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="w-16 h-16 rounded-full border border-[rgba(201,168,76,0.2)] bg-[rgba(201,168,76,0.04)] flex items-center justify-center mx-auto text-2xl">
              🔒
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#8a6e30] mb-3">{t.lockedEyebrow}</p>
              <h1 className="text-3xl font-light mb-3" style={{ fontFamily: "var(--font-display), serif" }}>
                {t.lockedHeadingStart}{" "}
                <span className="italic" style={{ color: "#c9a84c" }}>
                  {t.lockedHeadingItalic}
                </span>{" "}
                {t.lockedHeadingEnd}
              </h1>
              <p className="text-[13px] text-[#555] leading-relaxed">{t.lockedBody}</p>
            </div>
            <div className="rounded-2xl border border-[#1a1a1a] bg-[#0d0d0d] p-5 text-left space-y-3">
              {t.lockedFeatures.map((f) => (
                <div key={f} className="flex items-center gap-3">
                  <span className="text-[#c9a84c] text-xs">✦</span>
                  <p className="text-[12px] text-[#888]">{f}</p>
                </div>
              ))}
            </div>
            <Link
              href="/plans"
              className="inline-block px-8 py-3.5 rounded-xl bg-[#c9a84c] text-[#080808] font-semibold text-[14px] hover:bg-[#e8c97a] transition-all">
              {t.viewPlans}
            </Link>
            <p className="text-[11px] text-[#333]">
              <Link href="/dashboard" className="hover:text-[#555] transition-colors">
                {t.backToDashboard}
              </Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  const gc = result?.brief?.gap_type ? (GAP_CONFIG[result.brief.gap_type] ?? null) : null;
  const wordCount = result?.message?.word_count ?? 0;
  const wordLimit = result?.brief?.max_words ?? 100;
  const wordPct = Math.min(100, Math.round((wordCount / wordLimit) * 100));
  const wordColor = wordPct > 90 ? "#f87171" : wordPct > 70 ? "#c9a84c" : "#4ade80";
  const confColor = CONFIDENCE_COLOR[result?.brief?.evidence_confidence ?? ""] ?? "#555";

  return (
    <div className="min-h-screen bg-[#080808] text-[#f5f0e8]">
      <Nav userEmail={userEmail} language={language} />
      <div className="max-w-5xl mx-auto px-5 py-10">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="text-[10px] tracking-[0.2em] uppercase text-[#8a6e30] mb-1">{t.headerEyebrow}</p>
            <h1 className="text-3xl md:text-4xl font-light" style={{ fontFamily: "var(--font-display), serif" }}>
              {t.headerTitleStart}{" "}
              <span className="italic" style={{ color: "#c9a84c" }}>
                {t.headerTitleItalic}
              </span>
            </h1>
            <p className="text-[12px] text-[#444] mt-1.5">{t.headerSubtitle}</p>
          </div>
          {lead && (
            <div className="text-right hidden md:block">
              <p className="text-[10px] text-[#444] uppercase tracking-widest mb-1">{t.currentLead}</p>
              <p className="text-[13px] font-semibold text-[#c8c0b0]">{lead.company_name}</p>
              <p className="text-[11px] text-[#444]">{[lead.industry, lead.city].filter(Boolean).join(" · ")}</p>
            </div>
          )}
        </div>

        <div className="grid md:grid-cols-[360px_1fr] gap-6 items-start">
          {/* Left col */}
          <div className="space-y-3">
            {/* ── Lead picker ── */}
            <div className="rounded-2xl border border-[#252525] bg-[#0d0d0d] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[9px] uppercase tracking-widest text-[#555]">{t.leadSectionLabel}</p>
                {lead && (
                  <button
                    type="button"
                    onClick={() => setLead(null)}
                    className="text-[10px] text-[#444] hover:text-[#f87171] transition-colors">
                    {t.clearLead}
                  </button>
                )}
              </div>

              {/* Selected lead summary */}
              {lead && (
                <div className="rounded-xl border border-[#c9a84c]/30 bg-[rgba(201,168,76,0.04)] px-3 py-2.5">
                  <p className="text-[12px] font-semibold text-[#e8c97a] truncate">{lead.company_name}</p>
                  <p className="text-[10px] text-[#666] mt-0.5">
                    {[lead.industry, lead.city].filter(Boolean).join(" · ") || t.unknownPlaceholder}
                  </p>
                </div>
              )}

              {/* Search */}
              <input
                type="text"
                value={leadSearch}
                onChange={(e) => setLeadSearch(e.target.value)}
                placeholder={
                  leadsLoading ? t.loadingLeads : t.searchLeadsPlaceholder.replace("{count}", String(savedLeads.length))
                }
                className="w-full bg-[#080808] border border-[#1e1e1e] rounded-lg px-3 py-2 text-base sm:text-[12px] text-[#f5f0e8] placeholder-[#333] focus:outline-none focus:border-[rgba(201,168,76,0.4)] transition-colors"
              />

              {/* Lead list */}
              <div className="space-y-1 max-h-64 overflow-y-auto scrollbar-none">
                {leadsLoading ? (
                  <div className="py-4 text-center">
                    <div className="w-4 h-4 rounded-full border-2 border-[#c9a84c] border-t-transparent animate-spin mx-auto" />
                  </div>
                ) : savedLeads.length === 0 ? (
                  <div className="py-4 text-center space-y-1.5">
                    <p className="text-[12px] text-[#444]">{t.noSavedLeads}</p>
                    <Link
                      href="/dashboard"
                      className="text-[11px] text-[#c9a84c] hover:text-[#e8c97a] transition-colors">
                      {t.runSearchLink}
                    </Link>
                  </div>
                ) : (
                  savedLeads
                    .filter((l) => {
                      if (!leadSearch.trim()) return true;
                      const q = leadSearch.toLowerCase();
                      return (
                        l.company_name.toLowerCase().includes(q) ||
                        (l.industry ?? "").toLowerCase().includes(q) ||
                        (l.city ?? "").toLowerCase().includes(q)
                      );
                    })
                    .slice(0, 30)
                    .map((l) => {
                      const isSelected = lead?.id === l.id;
                      return (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() => {
                            // Convert SavedLeadItem to LeadSnapshot with defaults
                            const snapshot: LeadSnapshot = {
                              id: l.id,
                              company_name: l.company_name,
                              industry: l.industry,
                              city: l.city,
                              website: l.website,
                              rating: l.rating,
                              review_count: l.review_count,
                              social_presence: l.social_presence as LeadSnapshot["social_presence"],
                              opportunity: 50,
                              readiness: 50,
                              risk: 50,
                              signals: {},
                              matched_needs: [],
                              missing_needs: [],
                              fit_score: 0,
                            };
                            setLead(snapshot);
                            setResult(null);
                            setError(null);
                            localStorage.setItem("vantio_outreach_lead", JSON.stringify(snapshot));
                          }}
                          className={
                            "w-full text-left px-3 py-2.5 rounded-xl border transition-all " +
                            (isSelected
                              ? "border-[#c9a84c]/50 bg-[rgba(201,168,76,0.06)]"
                              : "border-[#1a1a1a] hover:border-[#333] hover:bg-[#111]")
                          }>
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p
                                className={
                                  "text-[12px] font-medium truncate " +
                                  (isSelected ? "text-[#e8c97a]" : "text-[#c8c0b0]")
                                }>
                                {l.company_name}
                              </p>
                              <p className="text-[10px] text-[#444] truncate">
                                {[l.industry, l.city].filter(Boolean).join(" · ") || t.unknownPlaceholder}
                              </p>
                            </div>
                            {l.rating && <span className="text-[10px] text-[#555] flex-shrink-0">{l.rating}★</span>}
                          </div>
                        </button>
                      );
                    })
                )}
              </div>

              {savedLeads.length > 0 && (
                <p className="text-[9px] text-[#2d2d2d] text-center">
                  {
                    savedLeads.filter((l) => {
                      if (!leadSearch.trim()) return true;
                      const q = leadSearch.toLowerCase();
                      return (
                        l.company_name.toLowerCase().includes(q) ||
                        (l.industry ?? "").toLowerCase().includes(q) ||
                        (l.city ?? "").toLowerCase().includes(q)
                      );
                    }).length
                  }{" "}
                  leads {leadSearch ? t.leadsMatched : t.leadsSaved}
                </p>
              )}
            </div>

            {/* Channel */}
            <div className="rounded-2xl border border-[#252525] bg-[#0d0d0d] p-4 space-y-2.5">
              <p className="text-[9px] uppercase tracking-widest text-[#555]">
                {t.channelLabel} <span className="text-[#f87171]">*</span>
              </p>

              {/* Signal-based recommendation */}
              {lead &&
                (() => {
                  const hasWebsite = !!lead.website;
                  const social = lead.social_presence ?? "low";
                  const reviews = lead.review_count ?? 0;

                  let rec: OutreachChannel;
                  let reason: string;

                  if (!hasWebsite && reviews < 10) {
                    rec = "cold_call";
                    reason = t.channelReasons.noWebsiteNoReviews;
                  } else if (social === "high") {
                    rec = "linkedin_dm";
                    reason = t.channelReasons.highSocial;
                  } else if (hasWebsite && social === "low") {
                    rec = "email";
                    reason = t.channelReasons.websiteLowSocial;
                  } else if (!hasWebsite) {
                    rec = "cold_call";
                    reason = t.channelReasons.noWebsite;
                  } else {
                    rec = "email";
                    reason = t.channelReasons.established;
                  }

                  return (
                    <div className="flex items-start gap-2.5 rounded-xl border border-[#1e1e1e] bg-[#0a0a0a] px-3 py-2.5 mb-1">
                      <span className="text-[#c9a84c] text-[10px] mt-0.5 flex-shrink-0">◈</span>
                      <div className="min-w-0">
                        <p className="text-[9px] uppercase tracking-widest text-[#555] mb-0.5">
                          {t.channelRecommended}
                        </p>
                        <p className="text-[11px] font-semibold text-[#c9a84c]">{CHANNEL_META[rec].label}</p>
                        <p className="text-[9px] text-[#616161] mt-0.5 leading-snug">{reason}</p>
                        {channel !== rec && (
                          <button
                            type="button"
                            onClick={() => setChannel(rec)}
                            className="mt-1.5 text-[9px] text-[#8a6e30] hover:text-[#c9a84c] transition-colors underline underline-offset-2">
                            {t.useRecommended}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}

              <div className="space-y-1.5">
                {(Object.entries(CHANNEL_META) as [OutreachChannel, (typeof CHANNEL_META)[OutreachChannel]][]).map(
                  ([ch, meta]) => (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => setChannel(ch)}
                      className={
                        "w-full text-left px-3 py-2.5 rounded-xl border transition-all " +
                        (channel === ch
                          ? "border-[#c9a84c] bg-[rgba(201,168,76,0.06)]"
                          : "border-[#1a1a1a] bg-[#080808] hover:border-[#333]")
                      }>
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <div className="flex items-center gap-2">
                          <span className={channel === ch ? "text-[#c9a84c]" : "text-[#555]"}>{meta.icon}</span>
                          <p
                            className={
                              "text-[12px] font-semibold " + (channel === ch ? "text-[#f5f0e8]" : "text-[#666]")
                            }>
                            {meta.label}
                          </p>
                        </div>
                      </div>
                      <p className="text-[10px] text-[#444] pl-5">{meta.note}</p>
                    </button>
                  ),
                )}
              </div>
            </div>

            {/* Tone — auto + 2×2 grid */}
            <div className="rounded-2xl border border-[#252525] bg-[#0d0d0d] p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-[9px] uppercase tracking-widest text-[#555]">{t.toneLabel}</p>
                <span className="text-[9px] text-[#333]">{t.toneAutoIfNotSet}</span>
              </div>
              <button
                type="button"
                onClick={() => setTone(null)}
                className={
                  "w-full py-2 rounded-lg border text-[11px] font-medium transition-all " +
                  (tone === null
                    ? "border-[#c9a84c] bg-[rgba(201,168,76,0.06)] text-[#c9a84c]"
                    : "border-[#1a1a1a] text-[#444] hover:border-[#333]")
                }>
                {t.toneAutoDetect}
                {result && tone === null ? ` — ${result.brief.tone}` : ""}
              </button>
              <div className="grid grid-cols-2 gap-1.5">
                {(Object.entries(TONE_META) as [OutreachTone, (typeof TONE_META)[OutreachTone]][]).map(([tn, meta]) => (
                  <button
                    key={tn}
                    type="button"
                    onClick={() => setTone(tn)}
                    className={
                      "text-left px-3 py-2.5 rounded-xl border transition-all " +
                      (tone === tn
                        ? "border-[#c9a84c] bg-[rgba(201,168,76,0.06)]"
                        : "border-[#1a1a1a] bg-[#080808] hover:border-[#333]")
                    }>
                    <p className={"text-[11px] font-semibold " + (tone === tn ? "text-[#e8c97a]" : "text-[#666]")}>
                      {meta.label}
                    </p>
                    <p className="text-[9px] text-[#444] mt-0.5 leading-snug">{meta.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => generate(!!result)}
              disabled={!lead || loading}
              className="w-full py-3.5 rounded-xl bg-[#c9a84c] text-[#080808] font-semibold text-[14px] tracking-wide hover:bg-[#e8c97a] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-[rgba(201,168,76,0.1)]">
              {loading ? t.generating : result ? t.regenerate : t.generateMessage}
            </button>
          </div>

          {/* Right col */}
          <div className="space-y-4">
            {loading && (
              <div className="rounded-2xl border border-[#252525] bg-[#0d0d0d] p-10 flex flex-col items-center gap-4 text-center">
                <div className="w-6 h-6 rounded-full border-2 border-[#c9a84c] border-t-transparent animate-spin" />
                <div className="space-y-1.5">
                  <p className="text-[13px] text-[#888]">{t.buildingStrategyBrief}</p>
                  <p className="text-[11px] text-[#444]">{t.analyzingSignals}</p>
                </div>
                <div className="flex gap-2 mt-1">
                  {t.pipelineStages.map((s, i) => (
                    <div
                      key={s}
                      className="px-2.5 py-1 rounded-lg border border-[#1e1e1e] text-[9px] text-[#333] uppercase tracking-widest"
                      style={{ opacity: 0.3 + i * 0.25 }}>
                      {s}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {error && !loading && (
              <div className="rounded-2xl border border-rose-500/20 bg-rose-500/05 p-5 space-y-2">
                <p className="text-[13px] text-rose-400">{t.generationFailed}</p>
                <p className="text-[11px] text-[#555]">{error}</p>
                <button
                  type="button"
                  onClick={() => generate(false)}
                  className="text-[11px] text-[#c9a84c] hover:text-[#e8c97a]">
                  {t.tryAgain}
                </button>
              </div>
            )}

            {!result && !loading && !error && (
              <div className="rounded-2xl border border-[#151515] bg-[#0a0a0a] p-12 text-center space-y-4">
                <div className="w-12 h-12 rounded-full border border-[rgba(201,168,76,0.12)] bg-[rgba(201,168,76,0.03)] flex items-center justify-center mx-auto">
                  <span className="text-[#c9a84c] text-lg">✦</span>
                </div>
                <div className="space-y-1.5">
                  <p className="text-[13px] text-[#444]">{t.configureAndGenerate}</p>
                  <p className="text-[11px] text-[#2a2a2a] leading-relaxed max-w-xs mx-auto">{t.configureBody}</p>
                </div>
                <div className="flex items-center justify-center gap-3 pt-2">
                  {t.pipelineStages.map((s, i) => (
                    <div key={s} className="flex items-center gap-2">
                      <span className="text-[9px] text-[#252525]">{s}</span>
                      {i < 2 && <span className="text-[9px] text-[#1e1e1e]">→</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result && !loading && (
              <>
                {/* Strategy brief */}
                <div className="rounded-2xl border border-[#1e1e1e] bg-[#0a0a0a] p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <p className="text-[9px] uppercase tracking-widest text-[#555]">{t.strategyBriefLabel}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {gc && (
                        <span
                          className="text-[9px] px-2.5 py-1 rounded-full border font-semibold uppercase tracking-widest"
                          style={{ borderColor: `${gc.color}50`, color: gc.color, backgroundColor: `${gc.color}0d` }}>
                          {gc.icon} {gc.label}
                        </span>
                      )}
                      <span
                        className="text-[9px] px-2 py-1 rounded-full border font-medium capitalize"
                        style={{ borderColor: `${confColor}40`, color: confColor, backgroundColor: `${confColor}0a` }}>
                        {result.brief.evidence_confidence} {t.confidenceSuffix}
                      </span>
                    </div>
                  </div>
                  <p className="text-[13px] text-[#c8c0b0] font-medium leading-relaxed">
                    {result.brief.top_opportunity}
                  </p>
                  <p className="text-[11px] text-[#555] leading-relaxed">{result.brief.recommended_angle}</p>
                  <div className="flex flex-wrap gap-1.5 pt-2 border-t border-[#141414]">
                    {result.brief.lead_strengths.slice(0, 4).map((s) => (
                      <span
                        key={s}
                        className="text-[9px] px-2 py-0.5 rounded-full border border-[#4ade80]/20 text-[#4ade80]/60 bg-[#4ade80]/04">
                        ✓ {s}
                      </span>
                    ))}
                    {result.brief.lead_weaknesses.slice(0, 3).map((w) => (
                      <span
                        key={w}
                        className="text-[9px] px-2 py-0.5 rounded-full border border-[#f87171]/20 text-[#f87171]/60 bg-[#f87171]/04">
                        ✗ {w}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-[#333] pt-1">
                    <span className="capitalize">{result.brief.tone} tone</span>
                    <span>·</span>
                    <span className="capitalize">{OBJECTIVE_META[objective]?.label}</span>
                    <span>·</span>
                    <span>{CHANNEL_META[result.message.channel as OutreachChannel]?.label}</span>
                  </div>
                </div>

                {/* Generated message */}
                <div className="rounded-2xl border border-[rgba(201,168,76,0.2)] bg-[rgba(201,168,76,0.015)] p-5 space-y-4">
                  <div className="flex items-center gap-3">
                    <p className="text-[9px] uppercase tracking-widest text-[#8a6e30] flex-shrink-0">
                      {CHANNEL_META[result.message.channel as OutreachChannel]?.label ?? result.message.channel}
                    </p>
                    <div className="flex-1 flex items-center gap-2">
                      <div className="flex-1 h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${wordPct}%`, backgroundColor: wordColor }}
                        />
                      </div>
                      <p className="text-[9px] flex-shrink-0 font-medium" style={{ color: wordColor }}>
                        {wordCount}/{wordLimit}w
                      </p>
                    </div>
                  </div>

                  {result.message.subject && (
                    <div className="rounded-xl border border-[#252525] bg-[#0d0d0d] px-4 py-3">
                      <p className="text-[9px] uppercase tracking-widest text-[#444] mb-1.5">{t.subjectLabel}</p>
                      <p className="text-[14px] font-semibold text-[#f5f0e8]">{result.message.subject}</p>
                    </div>
                  )}

                  <div className="rounded-xl border border-[#252525] bg-[#0d0d0d] px-4 py-4">
                    <p className="text-[13px] text-[#c8c0b0] leading-relaxed whitespace-pre-wrap">
                      {result.message.body}
                    </p>
                  </div>

                  {/* Refine */}
                  <div>
                    <p className="text-[9px] uppercase tracking-widest text-[#444] mb-2">{t.refineLabel}</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {REFINE_ACTIONS.map(({ key, label }) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => refine(key)}
                          disabled={!!refining}
                          className={
                            "py-2 rounded-lg border text-[11px] font-medium transition-all " +
                            (refining === key
                              ? "border-[#c9a84c]/40 text-[#c9a84c] bg-[rgba(201,168,76,0.06)]"
                              : "border-[#1e1e1e] text-[#555] hover:border-[#333] hover:text-[#888] disabled:opacity-40")
                          }>
                          {refining === key ? "…" : label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Primary actions */}
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={async () => {
                        const text = result.message.subject
                          ? `Subject: ${result.message.subject}

${result.message.body}`
                          : result.message.body;
                        await navigator.clipboard.writeText(text);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                        fetch("/api/analytics/track", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ event: "outreach_copied" }),
                        }).catch(() => {});
                      }}
                      className="flex-1 py-2.5 rounded-xl border border-[#c9a84c]/30 text-[12px] font-semibold text-[#c9a84c] hover:bg-[rgba(201,168,76,0.08)] transition-all">
                      {copied ? t.copied : t.copyMessage}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowSend((s) => !s)}
                      className={
                        "flex-1 py-2.5 rounded-xl border text-[12px] font-semibold transition-all " +
                        (showSend
                          ? "border-[#4ade80]/30 text-[#4ade80] bg-[rgba(74,222,128,0.05)]"
                          : "border-[#252525] text-[#555] hover:border-[#444] hover:text-[#888]")
                      }>
                      {t.sendEmail}
                    </button>
                    <button
                      type="button"
                      onClick={() => generate(true)}
                      className="px-3 py-2.5 rounded-xl border border-[#252525] text-[12px] text-[#555] hover:border-[#444] hover:text-[#888] transition-all">
                      ↺
                    </button>
                  </div>

                  {/* Send email panel */}
                  {showSend && (
                    <div className="rounded-xl border border-[#252525] bg-[#0d0d0d] p-4 space-y-3">
                      <p className="text-[9px] uppercase tracking-widest text-[#555]">{t.sendViaVantio}</p>
                      <input
                        type="email"
                        value={sendTo}
                        onChange={(e) => {
                          setSendTo(e.target.value);
                          setSendResult(null);
                        }}
                        placeholder={t.recipientPlaceholder}
                        className="w-full bg-[#080808] border border-[#1e1e1e] rounded-lg px-3 py-2 text-base sm:text-[12px] text-[#f5f0e8] placeholder-[#333] focus:outline-none focus:border-[rgba(201,168,76,0.4)] transition-colors"
                      />
                      {sendResult === "sent" && <p className="text-[11px] text-[#4ade80]">{t.emailSentSuccess}</p>}
                      {sendResult === "error" && <p className="text-[11px] text-[#f87171]">{t.emailSentError}</p>}
                      <button
                        type="button"
                        onClick={sendOutreachEmail}
                        disabled={!sendTo.trim() || sending}
                        className="w-full py-2.5 rounded-xl bg-[#4ade80]/10 border border-[#4ade80]/30 text-[12px] font-semibold text-[#4ade80] hover:bg-[#4ade80]/15 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                        {sending ? t.sending : t.sendTo.replace("{recipient}", sendTo || t.recipientPlaceholder)}
                      </button>
                      <p className="text-[10px] text-[#2d2d2d]">{t.sentFooter}</p>
                    </div>
                  )}

                  {/* Save as template */}
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setShowTemplates((s) => !s)}
                      className="text-[10px] text-[#444] hover:text-[#666] transition-colors">
                      {showTemplates ? t.hideTemplates : t.showTemplates}
                    </button>

                    {showTemplates && (
                      <div className="rounded-xl border border-[#1e1e1e] bg-[#0a0a0a] p-4 space-y-3">
                        {/* Save current */}
                        <div className="space-y-2">
                          <p className="text-[9px] uppercase tracking-widest text-[#444]">{t.saveThisMessage}</p>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={templateName}
                              onChange={(e) => setTemplateName(e.target.value)}
                              placeholder={t.templateNamePlaceholder}
                              className="flex-1 bg-[#080808] border border-[#1e1e1e] rounded-lg px-3 py-2 text-base sm:text-[12px] text-[#f5f0e8] placeholder-[#333] focus:outline-none focus:border-[rgba(201,168,76,0.4)] transition-colors"
                            />
                            <button
                              type="button"
                              onClick={saveTemplate}
                              disabled={!templateName.trim() || savingTemplate}
                              className="px-3 py-2 rounded-lg border border-[#c9a84c]/30 text-[11px] text-[#c9a84c] hover:bg-[rgba(201,168,76,0.08)] disabled:opacity-40 transition-all">
                              {savingTemplate ? "…" : t.saveButton}
                            </button>
                          </div>
                        </div>

                        {/* Saved templates list */}
                        {templates.length > 0 && (
                          <div className="space-y-1.5 pt-2 border-t border-[#141414]">
                            <p className="text-[9px] uppercase tracking-widests text-[#333]">{t.savedTemplatesLabel}</p>
                            {templates.map((tmpl) => (
                              <button
                                key={tmpl.id}
                                type="button"
                                onClick={() => {
                                  setResult((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          message: {
                                            ...prev.message,
                                            subject: tmpl.subject,
                                            body: tmpl.body,
                                            word_count: tmpl.body.split(/\s+/).length,
                                          },
                                        }
                                      : prev,
                                  );
                                  setShowTemplates(false);
                                }}
                                className="w-full text-left px-3 py-2 rounded-lg border border-[#1a1a1a] hover:border-[#333] transition-all group">
                                <div className="flex items-center justify-between">
                                  <p className="text-[11px] text-[#888] group-hover:text-[#c8c0b0] transition-colors">
                                    {tmpl.name}
                                  </p>
                                  <span className="text-[9px] text-[#333] capitalize">{tmpl.channel}</span>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-[#141414] bg-[#080808] px-4 py-3">
                  <p className="text-[10px] text-[#2d2d2d] leading-relaxed">{t.constraintsFooter}</p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Nav({ userEmail, language }: { userEmail: string; language: Language }) {
  const tShared = getTranslations(language).ui.settings;
  return (
    <nav className="w-full border-b border-[#151515] bg-[#080808]/90 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-5 py-4 flex items-center justify-between">
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
            {tShared.backToDashboard}
          </Link>
          <HamburgerMenu userEmail={userEmail} />
        </div>
      </div>
    </nav>
  );
}
