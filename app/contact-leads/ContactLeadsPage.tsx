"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import HamburgerMenu from "../components/HamburgerMenu";

// ─── Types ────────────────────────────────────────────────────────────────────

type StoredLead = {
  id: string;
  name: string;
  industry: string;
  city: string | null;
  country: string | null;
  score: number;
  opportunity: number;
  risk: number;
  riskProfile: string;
  reputation: number;
  digitalPresence: number;
  businessStrength: number;
  rating: number | null;
  reviewCount: number | null;
  website: string | null;
  opportunityMessage: string | null;
  opportunityType: string | null;
  fitScore: number | null;
  matchedNeeds: string[];
  hasBookingCta: boolean | null;
  hasClearOffer: boolean | null;
  isMobileFriendly: boolean | null;
  socialPresence: string | null;
};

type AngleOption = {
  key: string;
  label: string;
  description: string;
};

type TonalityOption = {
  key: "soft" | "direct" | "consultative" | "bold";
  label: string;
  description: string;
};

type LengthOption = {
  key: "short" | "medium" | "long";
  label: string;
  description: string;
};

type GeneratedMessage = {
  subject: string;
  body: string;
  angleUsed: string;
  tonalityUsed: string;
  reasoning: string[];
  hookExplained: string;
  callToAction: string;
  warnings: string[];
};

// ─── Constants ────────────────────────────────────────────────────────────────

const ANGLE_OPTIONS: AngleOption[] = [
  { key: "auto", label: "Auto-detect", description: "Let the system pick the best angle based on lead signals" },
  { key: "conversion_gap", label: "Conversion gap", description: "Site exists but lacks booking/CTA — visitors aren't converting" },
  { key: "visibility_gap", label: "Visibility gap", description: "Good reputation but low digital presence — demand not captured" },
  { key: "foundation_gap", label: "Foundation gap", description: "Missing core digital infrastructure — no website or weak trust signals" },
  { key: "social_gap", label: "Social gap", description: "Website strong but social presence weak or inactive" },
  { key: "differentiation", label: "Differentiation", description: "Already established — needs a sharper competitive edge" },
  { key: "value_teardown", label: "Value-first teardown", description: "Mixed signals — open with a free observation before pitching" },
];

const TONALITY_OPTIONS: TonalityOption[] = [
  { key: "soft", label: "Soft", description: "Warm, empathetic, low-pressure. Best for owner-operators and early-stage businesses." },
  { key: "consultative", label: "Consultative", description: "Expert framing, data-led. Best for established businesses who respect authority." },
  { key: "direct", label: "Direct", description: "Confident, no fluff. Best for busy decision-makers who value brevity." },
  { key: "bold", label: "Bold", description: "High contrast opener, pattern-interrupt. Best for saturated markets." },
];

const LENGTH_OPTIONS: LengthOption[] = [
  { key: "short", label: "Short", description: "3–4 lines. Punchy hook + one ask. Cold outreach optimised." },
  { key: "medium", label: "Medium", description: "6–8 lines. Context + insight + offer. Balanced." },
  { key: "long", label: "Long", description: "10–12 lines. Full breakdown + social proof framing. Warm leads." },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildLeadContext(lead: StoredLead): string {
  const lines = [
    `Business name: ${lead.name}`,
    `Industry: ${lead.industry.replaceAll("_", " ")}`,
    `Location: ${[lead.city, lead.country].filter(Boolean).join(", ") || "Unknown"}`,
    `Lead score: ${lead.score}/100`,
    `Risk profile: ${lead.riskProfile.replaceAll("_", " ")}`,
    `Reputation score: ${lead.reputation}/100`,
    `Digital presence: ${lead.digitalPresence}/100`,
    `Business strength: ${lead.businessStrength}/100`,
    lead.rating ? `Rating: ${lead.rating}★` : null,
    lead.reviewCount ? `Reviews: ${lead.reviewCount}` : null,
    lead.website ? `Has website: yes` : `Has website: no`,
    lead.hasBookingCta === true ? `Has booking CTA: yes` : lead.hasBookingCta === false ? `Has booking CTA: no` : null,
    lead.hasClearOffer === true ? `Has clear offer: yes` : lead.hasClearOffer === false ? `Has clear offer: no` : null,
    lead.isMobileFriendly === false ? `Mobile friendly: no` : null,
    lead.socialPresence ? `Social presence: ${lead.socialPresence}` : null,
    lead.fitScore ? `Fit score: ${lead.fitScore}/100` : null,
    lead.matchedNeeds.length ? `Matched needs: ${lead.matchedNeeds.join(", ")}` : null,
    lead.opportunityMessage ? `Opportunity insight: ${lead.opportunityMessage}` : null,
  ];
  return lines.filter(Boolean).join("\n");
}

function buildPrompt(
  lead: StoredLead,
  angle: string,
  tonality: string,
  length: string,
  senderContext: string,
  customNotes: string,
): string {
  const angleInstruction = angle === "auto"
    ? "Choose the most appropriate angle based on the lead signals provided."
    : `Use the following angle: ${angle.replaceAll("_", " ")}.`;

  const lengthGuide = length === "short"
    ? "3–4 lines maximum. One hook, one specific observation, one clear ask. No padding."
    : length === "medium"
    ? "6–8 lines. Hook, specific insight about their business, your offer, clear CTA."
    : "10–12 lines. Full context, specific observations, proof framing, offer, CTA.";

  return `You are an expert outreach copywriter for a digital marketing agency. Write a cold outreach email for the following lead.

LEAD SIGNALS:
${buildLeadContext(lead)}

SENDER CONTEXT:
${senderContext || "A digital marketing agency offering ads, tracking, funnel optimisation, and social media management."}

INSTRUCTIONS:
- Angle: ${angleInstruction}
- Tonality: ${tonality} — ${TONALITY_OPTIONS.find(t => t.key === tonality)?.description}
- Length: ${lengthGuide}
- Write in first person from the sender's perspective
- Reference specific, observable details about this business — do NOT write generic copy
- The subject line must be specific to this business, not generic
- Do NOT mention their score or any internal metrics
- The call to action should be low-friction (e.g. a 10-minute call, a free teardown)
${customNotes ? `- Additional notes from the user: ${customNotes}` : ""}

After the email, provide a JSON block with the following structure:
{
  "subject": "the email subject line",
  "body": "the full email body",
  "angleUsed": "which angle was used and why it fits this lead",
  "tonalityUsed": "why this tonality was chosen for this lead",
  "reasoning": ["signal 1 that drove this approach", "signal 2", "signal 3"],
  "hookExplained": "why the opening line was written this way",
  "callToAction": "why this specific CTA was chosen",
  "warnings": ["any concerns about this lead worth noting before outreach"]
}

Return ONLY the JSON block, no preamble, no markdown fences.`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ContactLeadsPage() {
  const [leads, setLeads] = useState<StoredLead[]>([]);
  const [selectedLead, setSelectedLead] = useState<StoredLead | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [angle, setAngle] = useState("auto");
  const [tonality, setTonality] = useState<"soft" | "direct" | "consultative" | "bold">("consultative");
  const [length, setLength] = useState<"short" | "medium" | "long">("medium");
  const [senderContext, setSenderContext] = useState("");
  const [customNotes, setCustomNotes] = useState("");

  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<GeneratedMessage | null>(null);
  const [editedBody, setEditedBody] = useState("");
  const [editedSubject, setEditedSubject] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showReasoning, setShowReasoning] = useState(true);

  const [profileOffer, setProfileOffer] = useState<string>("");

  // Load leads from saved leads localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem("vantio_saved_leads_v1");
      if (raw) {
        setLeads(JSON.parse(raw));
      }
    } catch { /* ignore */ }
  }, []);

  // Load profile offer description as default sender context
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/profile");
        if (!res.ok) return;
        const data = await res.json() as { profile?: { offerDescription?: string } };
        const offer = data.profile?.offerDescription?.trim() ?? "";
        if (offer) {
          setProfileOffer(offer);
          // Only pre-fill if the user hasn't typed anything yet
          setSenderContext((prev: string) => prev || offer);
        }
      } catch { /* ignore */ }
    })();
  }, []);

  const filteredLeads = leads.filter(l =>
    l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.industry.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const generate = useCallback(async () => {
    if (!selectedLead) return;
    setGenerating(true);
    setResult(null);
    setError(null);

    try {
      const prompt = buildPrompt(selectedLead, angle, tonality, length, senderContext, customNotes);

      const res = await fetch("/api/generate-outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? data.detail ?? "API error");
      const text = data.content?.find((b: { type: string }) => b.type === "text")?.text ?? "";

      // Strip possible markdown fences
      const clean = text.replace(/```json\n?|```\n?/g, "").trim();
      const parsed: GeneratedMessage = JSON.parse(clean);

      setResult(parsed);
      setEditedSubject(parsed.subject);
      setEditedBody(parsed.body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate message. Please try again.");
      console.error(e);
    } finally {
      setGenerating(false);
    }
  }, [selectedLead, angle, tonality, length, senderContext, customNotes]);

  const copyToClipboard = () => {
    const text = `Subject: ${editedSubject}\n\n${editedBody}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const scoreColor = (s: number) =>
    s >= 70 ? "#4ade80" : s >= 50 ? "#c9a84c" : "#f87171";

  return (
    <div className="min-h-screen bg-[#080808] text-[#f5f0e8]">

      {/* Nav */}
      <nav className="w-full border-b border-[#151515] bg-[#080808]/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-[#c9a84c]">◈</span>
            <Link href="/" className="text-[17px] font-light tracking-wide hover:opacity-80 transition-opacity" style={{ fontFamily: "var(--font-display), serif" }}>
              LeadGen<span style={{ background: "linear-gradient(135deg, #e8c97a 0%, #c9a84c 50%, #8a6e30 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>OS</span>
            </Link>
            <span className="text-[9px] tracking-[0.15em] uppercase px-2 py-0.5 rounded-full border border-[rgba(201,168,76,0.25)] text-[#8a6e30]">Beta</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-[12px] text-[#555] hover:text-[#888] transition-colors tracking-wide">← Dashboard</Link>
            <HamburgerMenu hasProfile={true} />
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-5 py-10">

        {/* Header */}
        <div className="mb-8">
          <p className="text-[10px] tracking-[0.2em] uppercase text-[#8a6e30] mb-1">Outreach</p>
          <h1 className="text-3xl md:text-4xl font-light" style={{ fontFamily: "var(--font-display), serif" }}>
            Contact <span className="italic" style={{ color: "#c9a84c" }}>Leads</span>
          </h1>
          <p className="text-[13px] text-[#555] mt-2 max-w-xl">
            Your saved leads, ready to contact. AI-generated messages built from each lead&apos;s actual signals — not templates. Reasoned, explained, and fully editable.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">

          {/* ── Left panel: Lead selector + controls ── */}
          <div className="space-y-4">

            {/* Lead selector */}
            <div className="rounded-2xl border border-[#1a1a1a] bg-[#0d0d0d] p-4 space-y-3">
              <p className="text-[10px] uppercase tracking-widest text-[#555]">Saved leads</p>

              {leads.length === 0 ? (
                <div className="text-center py-6 space-y-2">
                  <p className="text-[13px] text-[#444]">No saved leads yet.</p>
                  <p className="text-[11px] text-[#333]">Bookmark leads from the dashboard to contact them here.</p>
                  <Link href="/dashboard" className="inline-block mt-2 text-[11px] text-[#c9a84c] hover:text-[#e8c97a] transition-colors">
                    Go to Dashboard →
                  </Link>
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    placeholder="Search leads…"
                    value={searchQuery}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                    className="w-full bg-[#111] border border-[#252525] rounded-lg px-3 py-2 text-[12px] text-[#f5f0e8] placeholder-[#333] focus:outline-none focus:border-[rgba(201,168,76,0.4)] transition-colors"
                  />
                  <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                    {filteredLeads.map(lead => (
                      <div key={lead.id} className="relative group/item">
                        <button
                          type="button"
                          onClick={() => { setSelectedLead(lead); setResult(null); }}
                          className={`w-full text-left rounded-xl border px-3 py-2.5 pr-8 transition-all ${
                            selectedLead?.id === lead.id
                              ? "border-[rgba(201,168,76,0.4)] bg-[rgba(201,168,76,0.05)]"
                              : "border-[#1a1a1a] bg-[#080808] hover:border-[#252525]"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <p className="text-[12px] text-[#c8c0b0] truncate pr-2">{lead.name}</p>
                            <span className="text-[11px] font-bold shrink-0" style={{ color: scoreColor(lead.score) }}>{lead.score}</span>
                          </div>
                          <p className="text-[10px] text-[#444] mt-0.5 truncate">{lead.industry.replaceAll("_", " ")} · {lead.city || lead.country || "Unknown"}</p>
                        </button>
                        <button
                          type="button"
                          title="Remove from saved"
                          onClick={() => {
                            const updated = leads.filter(l => l.id !== lead.id);
                            setLeads(updated);
                            if (selectedLead?.id === lead.id) { setSelectedLead(null); setResult(null); }
                            try { localStorage.setItem("vantio_saved_leads_v1", JSON.stringify(updated)); } catch { /* ignore */ }
                          }}
                          className="absolute top-2 right-2 w-5 h-5 flex items-center justify-center rounded opacity-0 group-hover/item:opacity-100 transition-opacity text-[#444] hover:text-[#f87171] text-[10px]"
                        >✕</button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Angle */}
            <div className="rounded-2xl border border-[#1a1a1a] bg-[#0d0d0d] p-4 space-y-3">
              <p className="text-[10px] uppercase tracking-widests text-[#555]">Angle</p>
              <div className="space-y-1.5">
                {ANGLE_OPTIONS.map(a => (
                  <button
                    key={a.key}
                    type="button"
                    onClick={() => setAngle(a.key)}
                    className={`w-full text-left rounded-xl border px-3 py-2.5 transition-all ${
                      angle === a.key
                        ? "border-[rgba(201,168,76,0.4)] bg-[rgba(201,168,76,0.05)]"
                        : "border-[#1a1a1a] bg-[#080808] hover:border-[#252525]"
                    }`}
                  >
                    <p className={`text-[12px] ${angle === a.key ? "text-[#c9a84c]" : "text-[#888]"}`}>{a.label}</p>
                    <p className="text-[10px] text-[#444] mt-0.5 leading-relaxed">{a.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Tonality */}
            <div className="rounded-2xl border border-[#1a1a1a] bg-[#0d0d0d] p-4 space-y-3">
              <p className="text-[10px] uppercase tracking-widests text-[#555]">Tonality</p>
              <div className="grid grid-cols-2 gap-1.5">
                {TONALITY_OPTIONS.map(t => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTonality(t.key)}
                    className={`text-left rounded-xl border px-3 py-2.5 transition-all ${
                      tonality === t.key
                        ? "border-[rgba(201,168,76,0.4)] bg-[rgba(201,168,76,0.05)]"
                        : "border-[#1a1a1a] bg-[#080808] hover:border-[#252525]"
                    }`}
                  >
                    <p className={`text-[12px] ${tonality === t.key ? "text-[#c9a84c]" : "text-[#888]"}`}>{t.label}</p>
                    <p className="text-[10px] text-[#444] mt-0.5 leading-relaxed">{t.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Length */}
            <div className="rounded-2xl border border-[#1a1a1a] bg-[#0d0d0d] p-4 space-y-3">
              <p className="text-[10px] uppercase tracking-widests text-[#555]">Length</p>
              <div className="flex gap-1.5">
                {LENGTH_OPTIONS.map(l => (
                  <button
                    key={l.key}
                    type="button"
                    onClick={() => setLength(l.key)}
                    className={`flex-1 rounded-xl border px-2 py-2.5 transition-all text-center ${
                      length === l.key
                        ? "border-[rgba(201,168,76,0.4)] bg-[rgba(201,168,76,0.05)]"
                        : "border-[#1a1a1a] bg-[#080808] hover:border-[#252525]"
                    }`}
                  >
                    <p className={`text-[12px] ${length === l.key ? "text-[#c9a84c]" : "text-[#888]"}`}>{l.label}</p>
                    <p className="text-[10px] text-[#444] mt-0.5">{l.description.split(".")[0]}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Sender context */}
            <div className="rounded-2xl border border-[#1a1a1a] bg-[#0d0d0d] p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-widests text-[#555]">Your offer</p>
                {profileOffer && senderContext === profileOffer && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded border border-[#c9a84c]/20 bg-[#c9a84c]/06 text-[#8a6e30]">from profile</span>
                )}
              </div>
              <textarea
                rows={3}
                placeholder="e.g. We run Meta ads, build landing pages, and handle Google tracking for service businesses in Stockholm…"
                value={senderContext}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSenderContext(e.target.value)}
                className="w-full bg-[#111] border border-[#252525] rounded-lg px-3 py-2 text-[12px] text-[#c8c0b0] placeholder-[#333] focus:outline-none focus:border-[rgba(201,168,76,0.4)] transition-colors resize-none"
              />
              {profileOffer && senderContext !== profileOffer && (
                <button
                  type="button"
                  onClick={() => setSenderContext(profileOffer)}
                  className="text-[10px] text-[#555] hover:text-[#888] transition-colors"
                >
                  ↺ Reset to profile default
                </button>
              )}
            </div>

            {/* Custom notes */}
            <div className="rounded-2xl border border-[#1a1a1a] bg-[#0d0d0d] p-4 space-y-2">
              <p className="text-[10px] uppercase tracking-widests text-[#555]">Notes for this lead <span className="normal-case text-[#333]">(optional)</span></p>
              <textarea
                rows={2}
                placeholder="e.g. Met at a local event, they mentioned wanting more bookings…"
                value={customNotes}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCustomNotes(e.target.value)}
                className="w-full bg-[#111] border border-[#252525] rounded-lg px-3 py-2 text-[12px] text-[#c8c0b0] placeholder-[#333] focus:outline-none focus:border-[rgba(201,168,76,0.4)] transition-colors resize-none"
              />
            </div>

          </div>

          {/* ── Right panel: Output ── */}
          <div className="space-y-4">

            {/* Selected lead summary */}
            {selectedLead && (
              <div className="rounded-2xl border border-[#1a1a1a] bg-[#0d0d0d] px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-widests text-[#555] mb-1">Writing for</p>
                    <h2 className="text-[18px] font-light" style={{ fontFamily: "var(--font-display), serif" }}>{selectedLead.name}</h2>
                    <p className="text-[11px] text-[#555] mt-0.5">{selectedLead.industry.replaceAll("_", " ")} · {[selectedLead.city, selectedLead.country].filter(Boolean).join(", ")}</p>
                  </div>
                  <div className="flex gap-3 shrink-0">
                    {[
                      { label: "Score", value: selectedLead.score, color: scoreColor(selectedLead.score) },
                      { label: "Rep", value: selectedLead.reputation, color: scoreColor(selectedLead.reputation) },
                      { label: "Digital", value: selectedLead.digitalPresence, color: scoreColor(selectedLead.digitalPresence) },
                    ].map(s => (
                      <div key={s.label} className="text-center">
                        <p className="text-[9px] uppercase tracking-widests text-[#444]">{s.label}</p>
                        <p className="text-[15px] font-bold" style={{ color: s.color }}>{s.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
                {selectedLead.opportunityMessage && (
                  <div className="mt-3 pt-3 border-t border-[#141414]">
                    <p className="text-[11px] text-[#8a6e30]">⚡ {selectedLead.opportunityMessage}</p>
                  </div>
                )}
              </div>
            )}

            {/* Generate button */}
            <button
              type="button"
              disabled={!selectedLead || generating}
              onClick={generate}
              className="w-full py-3.5 rounded-2xl border transition-all text-[13px] font-medium disabled:cursor-not-allowed disabled:opacity-40"
              style={{
                background: selectedLead && !generating ? "linear-gradient(135deg, rgba(201,168,76,0.15) 0%, rgba(201,168,76,0.08) 100%)" : undefined,
                borderColor: selectedLead && !generating ? "rgba(201,168,76,0.4)" : "#1a1a1a",
                color: selectedLead && !generating ? "#c9a84c" : "#333",
              }}
            >
              {generating ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-[#c9a84c]/30 border-t-[#c9a84c] animate-spin" />
                  Generating…
                </span>
              ) : result ? "↻ Regenerate" : "✦ Generate message"}
            </button>

            {error && (
              <div className="rounded-xl border border-[#f87171]/20 bg-[#f87171]/5 px-4 py-3">
                <p className="text-[12px] text-[#f87171]">{error}</p>
              </div>
            )}

            {/* No lead selected state */}
            {!selectedLead && !generating && (
              <div className="rounded-2xl border border-[#1a1a1a] bg-[#0d0d0d] p-12 text-center space-y-2">
                <p className="text-3xl">✦</p>
                <p className="text-[14px] text-[#444]">Select a lead to get started</p>
                <p className="text-[11px] text-[#333]">Choose a lead from the panel on the left, tune your settings, then generate.</p>
              </div>
            )}

            {/* Result */}
            {result && (
              <div className="space-y-4">

                {/* Email editor */}
                <div className="rounded-2xl border border-[#252525] bg-[#0d0d0d] overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3 border-b border-[#1a1a1a]">
                    <p className="text-[10px] uppercase tracking-widests text-[#555]">Generated message</p>
                    <div className="flex items-center gap-2">
                      <p className="text-[10px] text-[#333]">Edit freely before sending</p>
                      <button
                        type="button"
                        onClick={copyToClipboard}
                        className="text-[11px] px-3 py-1.5 rounded-lg border border-[#252525] text-[#555] hover:border-[#444] hover:text-[#888] transition-all"
                      >
                        {copied ? "✓ Copied" : "Copy"}
                      </button>
                    </div>
                  </div>

                  {/* Subject */}
                  <div className="px-5 py-3 border-b border-[#1a1a1a]">
                    <p className="text-[10px] uppercase tracking-widests text-[#444] mb-1.5">Subject</p>
                    <input
                      type="text"
                      value={editedSubject}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditedSubject(e.target.value)}
                      className="w-full bg-transparent text-[13px] text-[#f5f0e8] focus:outline-none placeholder-[#333]"
                    />
                  </div>

                  {/* Body */}
                  <div className="px-5 py-4">
                    <textarea
                      value={editedBody}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditedBody(e.target.value)}
                      rows={12}
                      className="w-full bg-transparent text-[13px] text-[#c8c0b0] leading-relaxed focus:outline-none resize-none"
                    />
                  </div>
                </div>

                {/* Reasoning panel */}
                <div className="rounded-2xl border border-[#1a1a1a] bg-[#0d0d0d] overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowReasoning(!showReasoning)}
                    className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-[#111] transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[#c9a84c] text-sm">◈</span>
                      <p className="text-[11px] uppercase tracking-widests text-[#888]">Why this message was written this way</p>
                    </div>
                    <span className="text-[#444] text-xs">{showReasoning ? "▲" : "▼"}</span>
                  </button>

                  {showReasoning && (
                    <div className="px-5 pb-5 space-y-4 border-t border-[#141414] pt-4">

                      {/* Angle + tonality used */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-xl border border-[#151515] bg-[#080808] p-3 space-y-1">
                          <p className="text-[9px] uppercase tracking-widests text-[#444]">Angle chosen</p>
                          <p className="text-[12px] text-[#c8c0b0] leading-relaxed">{result.angleUsed}</p>
                        </div>
                        <div className="rounded-xl border border-[#151515] bg-[#080808] p-3 space-y-1">
                          <p className="text-[9px] uppercase tracking-widests text-[#444]">Tonality reasoning</p>
                          <p className="text-[12px] text-[#c8c0b0] leading-relaxed">{result.tonalityUsed}</p>
                        </div>
                      </div>

                      {/* Signals that drove the copy */}
                      <div className="space-y-2">
                        <p className="text-[10px] uppercase tracking-widests text-[#444]">Signals that shaped the copy</p>
                        <div className="space-y-1.5">
                          {result.reasoning.map((r, i) => (
                            <div key={i} className="flex items-start gap-2.5 rounded-lg border border-[#151515] bg-[#080808] px-3 py-2">
                              <span className="text-[#c9a84c] text-[10px] mt-0.5 shrink-0">→</span>
                              <p className="text-[12px] text-[#777] leading-relaxed">{r}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Hook explanation */}
                      <div className="rounded-xl border border-[#151515] bg-[#080808] p-3 space-y-1">
                        <p className="text-[9px] uppercase tracking-widests text-[#444]">Why the opening line works</p>
                        <p className="text-[12px] text-[#c8c0b0] leading-relaxed">{result.hookExplained}</p>
                      </div>

                      {/* CTA explanation */}
                      <div className="rounded-xl border border-[#151515] bg-[#080808] p-3 space-y-1">
                        <p className="text-[9px] uppercase tracking-widests text-[#444]">Call to action rationale</p>
                        <p className="text-[12px] text-[#c8c0b0] leading-relaxed">{result.callToAction}</p>
                      </div>

                      {/* Warnings */}
                      {result.warnings.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-[10px] uppercase tracking-widests text-[#444]">Worth knowing before you send</p>
                          {result.warnings.map((w, i) => (
                            <div key={i} className="flex items-start gap-2.5 rounded-lg border border-[#f87171]/15 bg-[#f87171]/5 px-3 py-2">
                              <span className="text-[#f87171] text-[10px] mt-0.5 shrink-0">⚠</span>
                              <p className="text-[12px] text-[#888] leading-relaxed">{w}</p>
                            </div>
                          ))}
                        </div>
                      )}

                    </div>
                  )}
                </div>

              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
