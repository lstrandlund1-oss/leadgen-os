"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import HamburgerMenu from "../components/HamburgerMenu";
import { getEffectivePlan, canUseOutreach } from "@/lib/plan";
import { createSupabaseBrowser } from "@/lib/supabaseBrowser";

type OutreachChannel = "email" | "linkedin_dm" | "cold_call";
type OutreachTone = "professional" | "consultative" | "friendly" | "direct" | "bold";
type OutreachObjective = "first_touch" | "follow_up" | "re_engage";
type RefineAction = "shorten" | "warmer" | "more_direct" | "more_formal";

type OutreachResult = {
  brief: {
    gap_type: string; tone: string; channel: string;
    top_opportunity: string; recommended_angle: string;
    lead_strengths: string[]; lead_weaknesses: string[];
    evidence_confidence: string; max_words: number; peer_group: string;
  };
  message: { subject?: string; body: string; word_count: number; channel: string };
  generated_at: string;
};

type LeadSnapshot = {
  id: string; company_name: string; industry: string | null; city: string | null;
  website: string | null; rating: number | null; review_count: number | null;
  social_presence: string | null; opportunity: number; readiness: number; risk: number;
  signals: Record<string, unknown>; matched_needs: string[]; missing_needs: string[]; fit_score: number;
};

const CHANNEL_META: Record<OutreachChannel, { label: string; icon: string; note: string }> = {
  email:       { label: "Email",       icon: "✉",  note: "50–100 words · subject 1–4 words · offer-based CTA" },
  linkedin_dm: { label: "LinkedIn DM", icon: "◈",  note: "25–75 words · conversational · permission framing" },
  cold_call:   { label: "Cold Call",   icon: "☎",  note: "Opener script · permission or peer-context opener" },
};

const TONE_META: Record<OutreachTone, { label: string; desc: string }> = {
  professional: { label: "Professional", desc: "Polished, executive register" },
  consultative: { label: "Consultative", desc: "Advisory, insight-led" },
  friendly:     { label: "Friendly",     desc: "Warm but professional" },
  direct:       { label: "Direct",       desc: "Confident, no hedging" },
  bold:         { label: "Bold",         desc: "Pattern-interrupt" },
};

const OBJECTIVE_META: Record<OutreachObjective, { label: string; desc: string; icon: string }> = {
  first_touch: { label: "First touch", desc: "Never contacted", icon: "◎" },
  follow_up:   { label: "Follow-up",   desc: "No reply yet",    icon: "↩" },
  re_engage:   { label: "Re-engage",   desc: "Gone cold",       icon: "✦" },
};

const GAP_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  VISIBILITY:     { label: "Visibility Gap",     color: "#818cf8", icon: "◎" },
  CONVERSION:     { label: "Conversion Gap",     color: "#fb923c", icon: "⬡" },
  INFRASTRUCTURE: { label: "Infrastructure Gap", color: "#f87171", icon: "△" },
  OPTIMIZATION:   { label: "Optimization Gap",   color: "#34d399", icon: "◆" },
};

const REFINE_ACTIONS: { key: RefineAction; label: string; instruction: string }[] = [
  { key: "shorten",     label: "Shorten",     instruction: "Make this message shorter and more punchy. Cut to the essential. Stay under the word limit." },
  { key: "warmer",      label: "Make warmer", instruction: "Make this message warmer and more human. Less formal, more like a real person typed it." },
  { key: "more_direct", label: "More direct", instruction: "Make this more direct and confident. Remove hedging and filler. Get to the point faster." },
  { key: "more_formal", label: "More formal", instruction: "Make this more professional and polished. Slightly elevate the register without sounding stiff." },
];

const CONFIDENCE_COLOR: Record<string, string> = {
  high: "#4ade80", medium: "#c9a84c", low: "#f87171",
};

export default function OutreachPage() {
  const plan = getEffectivePlan();
  const unlocked = canUseOutreach(plan);

  const [userEmail, setUserEmail] = useState("");
  const [lead, setLead] = useState<LeadSnapshot | null>(null);
  const [channel, setChannel] = useState<OutreachChannel>("email");
  const [tone, setTone] = useState<OutreachTone | null>(null);
  const [objective, setObjective] = useState<OutreachObjective>("first_touch");
  const [loading, setLoading] = useState(false);
  const [refining, setRefining] = useState<RefineAction | null>(null);
  const [result, setResult] = useState<OutreachResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("vantio_outreach_lead");
    if (stored) { try { setLead(JSON.parse(stored)); } catch { /* ignore */ } }
    const supabase = createSupabaseBrowser();
    supabase.auth.getUser().then(({ data }: { data: { user: { email?: string } | null } }) => {
      if (data.user?.email) setUserEmail(data.user.email);
    });
  }, []);

  const generate = useCallback(async (regen = false) => {
    if (!lead || loading) return;
    if (result && !regen) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/generate-outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: lead.company_name, industry: lead.industry, city: lead.city,
          website: lead.website, rating: lead.rating, review_count: lead.review_count,
          social_presence: lead.social_presence, opportunity: lead.opportunity,
          readiness: lead.readiness, risk: lead.risk, signals: lead.signals,
          matched_needs: lead.matched_needs, missing_needs: lead.missing_needs,
          fit_score: lead.fit_score, channel, tone: tone ?? undefined, objective, language: "sv",
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        setError((err as { error?: string }).error ?? "Generation failed"); return;
      }
      setResult(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate");
    } finally { setLoading(false); }
  }, [lead, loading, result, channel, tone, objective]);

  const refine = useCallback(async (action: RefineAction) => {
    if (!result || refining) return;
    setRefining(action);
    const instruction = REFINE_ACTIONS.find(r => r.key === action)?.instruction ?? "";
    try {
      const currentText = result.message.subject
        ? `Subject: ${result.message.subject}

${result.message.body}`
        : result.message.body;
      const res = await fetch("/api/generate-outreach/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_message: currentText, instruction,
          channel: result.message.channel, max_words: result.brief.max_words, language: "sv",
        }),
      });
      if (!res.ok) return;
      const data = await res.json() as { subject?: string; body: string; word_count: number };
      setResult(prev => prev ? { ...prev, message: { ...prev.message, ...data } } : prev);
    } catch { /* fail soft */ } finally { setRefining(null); }
  }, [result, refining]);

  useEffect(() => { setResult(null); setError(null); }, [channel, tone, objective]);

  if (!unlocked) {
    return (
      <div className="min-h-screen bg-[#080808] text-[#f5f0e8] flex flex-col">
        <Nav userEmail={userEmail} />
        <div className="flex-1 flex items-center justify-center px-6 py-20">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="w-16 h-16 rounded-full border border-[rgba(201,168,76,0.2)] bg-[rgba(201,168,76,0.04)] flex items-center justify-center mx-auto text-2xl">🔒</div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#8a6e30] mb-3">Operator & Agency</p>
              <h1 className="text-3xl font-light mb-3" style={{ fontFamily: "var(--font-display), serif" }}>
                Outreach is a <span className="italic" style={{ color: "#c9a84c" }}>premium</span> feature
              </h1>
              <p className="text-[13px] text-[#555] leading-relaxed">Signal-driven outreach pipeline — three-stage AI generation, channel-optimised messaging, and evidence-backed strategy.</p>
            </div>
            <div className="rounded-2xl border border-[#1a1a1a] bg-[#0d0d0d] p-5 text-left space-y-3">
              {["Signal-grounded message generation","Email · LinkedIn DM · Cold call scripts","Three-stage pipeline: strategy → generate → humanize","One-click refinement: shorten, warmer, more direct","Evidence confidence scoring"].map((f) => (
                <div key={f} className="flex items-center gap-3"><span className="text-[#c9a84c] text-xs">✦</span><p className="text-[12px] text-[#888]">{f}</p></div>
              ))}
            </div>
            <Link href="/plans" className="inline-block px-8 py-3.5 rounded-xl bg-[#c9a84c] text-[#080808] font-semibold text-[14px] hover:bg-[#e8c97a] transition-all">View plans →</Link>
            <p className="text-[11px] text-[#333]"><Link href="/dashboard" className="hover:text-[#555] transition-colors">← Back to dashboard</Link></p>
          </div>
        </div>
      </div>
    );
  }

  const gc = result?.brief?.gap_type ? GAP_CONFIG[result.brief.gap_type] ?? null : null;
  const wordCount = result?.message?.word_count ?? 0;
  const wordLimit = result?.brief?.max_words ?? 100;
  const wordPct = Math.min(100, Math.round((wordCount / wordLimit) * 100));
  const wordColor = wordPct > 90 ? "#f87171" : wordPct > 70 ? "#c9a84c" : "#4ade80";
  const confColor = CONFIDENCE_COLOR[result?.brief?.evidence_confidence ?? ""] ?? "#555";

  return (
    <div className="min-h-screen bg-[#080808] text-[#f5f0e8]">
      <Nav userEmail={userEmail} />
      <div className="max-w-5xl mx-auto px-5 py-10">

        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="text-[10px] tracking-[0.2em] uppercase text-[#8a6e30] mb-1">Operator</p>
            <h1 className="text-3xl md:text-4xl font-light" style={{ fontFamily: "var(--font-display), serif" }}>
              Outreach <span className="italic" style={{ color: "#c9a84c" }}>Generator</span>
            </h1>
            <p className="text-[12px] text-[#444] mt-1.5">Signal-driven · Three-stage pipeline · Evidence-backed</p>
          </div>
          {lead && (
            <div className="text-right hidden md:block">
              <p className="text-[10px] text-[#444] uppercase tracking-widest mb-1">Current lead</p>
              <p className="text-[13px] font-semibold text-[#c8c0b0]">{lead.company_name}</p>
              <p className="text-[11px] text-[#444]">{[lead.industry, lead.city].filter(Boolean).join(" · ")}</p>
            </div>
          )}
        </div>

        <div className="grid md:grid-cols-[360px_1fr] gap-6 items-start">

          {/* Left col */}
          <div className="space-y-3">

            {lead ? (
              <div className="rounded-2xl border border-[#252525] bg-[#0d0d0d] p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[9px] uppercase tracking-widest text-[#555] mb-1">Lead</p>
                    <p className="text-[14px] font-semibold text-[#f5f0e8] truncate">{lead.company_name}</p>
                    <p className="text-[11px] text-[#555] mt-0.5">{[lead.industry, lead.city].filter(Boolean).join(" · ") || "Unknown"}</p>
                  </div>
                  <Link href="/dashboard" className="text-[10px] text-[#444] hover:text-[#c9a84c] transition-colors whitespace-nowrap flex-shrink-0">← Change</Link>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[{label:"OPP",value:lead.opportunity,color:"#c9a84c"},{label:"RISK",value:lead.risk,color:"#f87171"},{label:"FIT",value:lead.fit_score,color:"#4ade80"}].map((s) => (
                    <div key={s.label} className="rounded-lg border border-[#1a1a1a] bg-[#080808] py-2 text-center">
                      <p className="text-[8px] uppercase tracking-widest text-[#444] mb-0.5">{s.label}</p>
                      <p className="text-[14px] font-bold" style={{ color: s.color }}>{s.value}</p>
                    </div>
                  ))}
                </div>
                {(lead.matched_needs.length > 0 || lead.missing_needs.length > 0) && (
                  <div className="flex flex-wrap gap-1.5 pt-2 border-t border-[#1a1a1a]">
                    {lead.matched_needs.slice(0,3).map((n) => <span key={n} className="text-[9px] px-2 py-0.5 rounded-full border border-[#4ade80]/20 text-[#4ade80]/70 bg-[#4ade80]/04 capitalize">✓ {n}</span>)}
                    {lead.missing_needs.slice(0,2).map((n) => <span key={n} className="text-[9px] px-2 py-0.5 rounded-full border border-[#f87171]/20 text-[#f87171]/70 bg-[#f87171]/04 capitalize">✗ {n}</span>)}
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-[#252525] bg-[#0d0d0d] p-5 text-center space-y-2">
                <p className="text-[13px] text-[#555]">No lead selected</p>
                <p className="text-[11px] text-[#333]">Open a lead in the dashboard and click &ldquo;Generate outreach message&rdquo;</p>
                <Link href="/dashboard" className="inline-block text-[12px] text-[#c9a84c] hover:text-[#e8c97a] transition-colors mt-1">Go to Dashboard →</Link>
              </div>
            )}

            {/* Objective */}
            <div className="rounded-2xl border border-[#252525] bg-[#0d0d0d] p-4 space-y-2.5">
              <p className="text-[9px] uppercase tracking-widest text-[#555]">Objective</p>
              <div className="grid grid-cols-3 gap-1.5">
                {(Object.entries(OBJECTIVE_META) as [OutreachObjective, typeof OBJECTIVE_META[OutreachObjective]][]).map(([obj, meta]) => (
                  <button key={obj} type="button" onClick={() => setObjective(obj)}
                    className={"rounded-xl border py-2.5 px-2 text-center transition-all " + (objective === obj ? "border-[#c9a84c] bg-[rgba(201,168,76,0.06)]" : "border-[#1a1a1a] bg-[#080808] hover:border-[#333]")}>
                    <p className={"text-sm mb-0.5 " + (objective === obj ? "text-[#c9a84c]" : "text-[#444]")}>{meta.icon}</p>
                    <p className={"text-[10px] font-semibold " + (objective === obj ? "text-[#e8c97a]" : "text-[#555]")}>{meta.label}</p>
                    <p className="text-[9px] text-[#333] mt-0.5">{meta.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Channel */}
            <div className="rounded-2xl border border-[#252525] bg-[#0d0d0d] p-4 space-y-2.5">
              <p className="text-[9px] uppercase tracking-widest text-[#555]">Channel <span className="text-[#f87171]">*</span></p>
              <div className="space-y-1.5">
                {(Object.entries(CHANNEL_META) as [OutreachChannel, typeof CHANNEL_META[OutreachChannel]][]).map(([ch, meta]) => (
                  <button key={ch} type="button" onClick={() => setChannel(ch)}
                    className={"w-full text-left px-3 py-2.5 rounded-xl border transition-all " + (channel === ch ? "border-[#c9a84c] bg-[rgba(201,168,76,0.06)]" : "border-[#1a1a1a] bg-[#080808] hover:border-[#333]")}>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={channel === ch ? "text-[#c9a84c]" : "text-[#555]"}>{meta.icon}</span>
                      <p className={"text-[12px] font-semibold " + (channel === ch ? "text-[#f5f0e8]" : "text-[#666]")}>{meta.label}</p>
                    </div>
                    <p className="text-[10px] text-[#444] pl-5">{meta.note}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Tone — auto + 2×2 grid */}
            <div className="rounded-2xl border border-[#252525] bg-[#0d0d0d] p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-[9px] uppercase tracking-widest text-[#555]">Tone</p>
                <span className="text-[9px] text-[#333]">Auto if not set</span>
              </div>
              <button type="button" onClick={() => setTone(null)}
                className={"w-full py-2 rounded-lg border text-[11px] font-medium transition-all " + (tone === null ? "border-[#c9a84c] bg-[rgba(201,168,76,0.06)] text-[#c9a84c]" : "border-[#1a1a1a] text-[#444] hover:border-[#333]")}>
                ✦ Auto-detect{result && tone === null ? ` — ${result.brief.tone}` : ""}
              </button>
              <div className="grid grid-cols-2 gap-1.5">
                {(Object.entries(TONE_META) as [OutreachTone, typeof TONE_META[OutreachTone]][]).map(([t, meta]) => (
                  <button key={t} type="button" onClick={() => setTone(t)}
                    className={"text-left px-3 py-2.5 rounded-xl border transition-all " + (tone === t ? "border-[#c9a84c] bg-[rgba(201,168,76,0.06)]" : "border-[#1a1a1a] bg-[#080808] hover:border-[#333]")}>
                    <p className={"text-[11px] font-semibold " + (tone === t ? "text-[#e8c97a]" : "text-[#666]")}>{meta.label}</p>
                    <p className="text-[9px] text-[#444] mt-0.5 leading-snug">{meta.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <button type="button" onClick={() => generate(!!result)} disabled={!lead || loading}
              className="w-full py-3.5 rounded-xl bg-[#c9a84c] text-[#080808] font-semibold text-[14px] tracking-wide hover:bg-[#e8c97a] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-[rgba(201,168,76,0.1)]">
              {loading ? "Generating…" : result ? "Regenerate ↺" : "Generate message ✦"}
            </button>
          </div>

          {/* Right col */}
          <div className="space-y-4">

            {loading && (
              <div className="rounded-2xl border border-[#252525] bg-[#0d0d0d] p-10 flex flex-col items-center gap-4 text-center">
                <div className="w-6 h-6 rounded-full border-2 border-[#c9a84c] border-t-transparent animate-spin" />
                <div className="space-y-1.5">
                  <p className="text-[13px] text-[#888]">Building strategy brief…</p>
                  <p className="text-[11px] text-[#444]">Analyzing signals → generating → humanizing</p>
                </div>
                <div className="flex gap-2 mt-1">
                  {["A — Strategy", "B — Generate", "C — Humanize"].map((s, i) => (
                    <div key={s} className="px-2.5 py-1 rounded-lg border border-[#1e1e1e] text-[9px] text-[#333] uppercase tracking-widest" style={{ opacity: 0.3 + i * 0.25 }}>{s}</div>
                  ))}
                </div>
              </div>
            )}

            {error && !loading && (
              <div className="rounded-2xl border border-rose-500/20 bg-rose-500/05 p-5 space-y-2">
                <p className="text-[13px] text-rose-400">Generation failed</p>
                <p className="text-[11px] text-[#555]">{error}</p>
                <button type="button" onClick={() => generate(false)} className="text-[11px] text-[#c9a84c] hover:text-[#e8c97a]">Try again →</button>
              </div>
            )}

            {!result && !loading && !error && (
              <div className="rounded-2xl border border-[#151515] bg-[#0a0a0a] p-12 text-center space-y-4">
                <div className="w-12 h-12 rounded-full border border-[rgba(201,168,76,0.12)] bg-[rgba(201,168,76,0.03)] flex items-center justify-center mx-auto">
                  <span className="text-[#c9a84c] text-lg">✦</span>
                </div>
                <div className="space-y-1.5">
                  <p className="text-[13px] text-[#444]">Configure and generate</p>
                  <p className="text-[11px] text-[#2a2a2a] leading-relaxed max-w-xs mx-auto">Select your objective, channel, and optional tone — the pipeline handles the rest.</p>
                </div>
                <div className="flex items-center justify-center gap-3 pt-2">
                  {["A — Strategy", "B — Generate", "C — Humanize"].map((s, i) => (
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
                    <p className="text-[9px] uppercase tracking-widest text-[#555]">Strategy brief</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {gc && (
                        <span className="text-[9px] px-2.5 py-1 rounded-full border font-semibold uppercase tracking-widest"
                          style={{ borderColor: `${gc.color}50`, color: gc.color, backgroundColor: `${gc.color}0d` }}>
                          {gc.icon} {gc.label}
                        </span>
                      )}
                      <span className="text-[9px] px-2 py-1 rounded-full border font-medium capitalize"
                        style={{ borderColor: `${confColor}40`, color: confColor, backgroundColor: `${confColor}0a` }}>
                        {result.brief.evidence_confidence} confidence
                      </span>
                    </div>
                  </div>
                  <p className="text-[13px] text-[#c8c0b0] font-medium leading-relaxed">{result.brief.top_opportunity}</p>
                  <p className="text-[11px] text-[#555] leading-relaxed">{result.brief.recommended_angle}</p>
                  <div className="flex flex-wrap gap-1.5 pt-2 border-t border-[#141414]">
                    {result.brief.lead_strengths.slice(0,4).map((s) => <span key={s} className="text-[9px] px-2 py-0.5 rounded-full border border-[#4ade80]/20 text-[#4ade80]/60 bg-[#4ade80]/04">✓ {s}</span>)}
                    {result.brief.lead_weaknesses.slice(0,3).map((w) => <span key={w} className="text-[9px] px-2 py-0.5 rounded-full border border-[#f87171]/20 text-[#f87171]/60 bg-[#f87171]/04">✗ {w}</span>)}
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
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${wordPct}%`, backgroundColor: wordColor }} />
                      </div>
                      <p className="text-[9px] flex-shrink-0 font-medium" style={{ color: wordColor }}>{wordCount}/{wordLimit}w</p>
                    </div>
                  </div>

                  {result.message.subject && (
                    <div className="rounded-xl border border-[#252525] bg-[#0d0d0d] px-4 py-3">
                      <p className="text-[9px] uppercase tracking-widest text-[#444] mb-1.5">Subject</p>
                      <p className="text-[14px] font-semibold text-[#f5f0e8]">{result.message.subject}</p>
                    </div>
                  )}

                  <div className="rounded-xl border border-[#252525] bg-[#0d0d0d] px-4 py-4">
                    <p className="text-[13px] text-[#c8c0b0] leading-relaxed whitespace-pre-wrap">{result.message.body}</p>
                  </div>

                  {/* Refine */}
                  <div>
                    <p className="text-[9px] uppercase tracking-widest text-[#444] mb-2">Refine</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {REFINE_ACTIONS.map(({ key, label }) => (
                        <button key={key} type="button" onClick={() => refine(key)} disabled={!!refining}
                          className={"py-2 rounded-lg border text-[11px] font-medium transition-all " + (refining === key ? "border-[#c9a84c]/40 text-[#c9a84c] bg-[rgba(201,168,76,0.06)]" : "border-[#1e1e1e] text-[#555] hover:border-[#333] hover:text-[#888] disabled:opacity-40")}>
                          {refining === key ? "…" : label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button type="button"
                      onClick={async () => {
                        const text = result.message.subject ? `Subject: ${result.message.subject}

${result.message.body}` : result.message.body;
                        await navigator.clipboard.writeText(text);
                        setCopied(true); setTimeout(() => setCopied(false), 2000);
                      }}
                      className="flex-1 py-2.5 rounded-xl border border-[#c9a84c]/30 text-[12px] font-semibold text-[#c9a84c] hover:bg-[rgba(201,168,76,0.08)] transition-all">
                      {copied ? "✓ Copied!" : "Copy message"}
                    </button>
                    <button type="button" onClick={() => generate(true)}
                      className="flex-1 py-2.5 rounded-xl border border-[#252525] text-[12px] text-[#555] hover:border-[#444] hover:text-[#888] transition-all">
                      Regenerate ↺
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-[#141414] bg-[#080808] px-4 py-3">
                  <p className="text-[10px] text-[#2d2d2d] leading-relaxed">
                    Constraints: Gong (28M emails, 300M calls) · Salesloft (15M emails) · no pitch on first touch · offer-based CTA · ≥20% personalization
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Nav({ userEmail }: { userEmail: string }) {
  return (
    <nav className="w-full border-b border-[#151515] bg-[#080808]/90 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="text-[#c9a84c]">◈</span>
          <Link href="/" className="text-[17px] font-light tracking-wide hover:opacity-80 transition-opacity" style={{ fontFamily: "var(--font-display), serif" }}>
            Van<span style={{ background: "linear-gradient(135deg, #e8c97a 0%, #c9a84c 50%, #8a6e30 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>tio</span>
          </Link>
          <span className="text-[9px] tracking-[0.15em] uppercase px-2 py-0.5 rounded-full border border-[rgba(201,168,76,0.25)] text-[#8a6e30]">Beta</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-[12px] text-[#555] hover:text-[#888] transition-colors">← Dashboard</Link>
          <HamburgerMenu userEmail={userEmail} />
        </div>
      </div>
    </nav>
  );
}
