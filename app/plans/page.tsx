"use client";

import { useState } from "react";
import Link from "next/link";
import HamburgerMenu from "../components/HamburgerMenu";

const PLANS = [
  {
    name: "Scout",
    price: "$29",
    sub: "/ month",
    billing: "Beta pricing · locks in for 12 months",
    description: "Find and evaluate leads using signal-driven intelligence. Know who to contact before you pick up the phone.",
    highlight: false,
    badge: null,
    features: [
      { text: "50 lead searches / month", note: null },
      { text: "Opportunity, Risk & Fit scoring", note: "Know exactly why each lead scored high or low" },
      { text: "Gap type detection", note: "Each lead is classified — Visibility, Conversion, Infrastructure, or Optimization — so you know what angle to use" },
      { text: "Lead detail panel", note: "Deep-dive into signals, ratings, social presence, and website data for each lead" },
      { text: "Outcome tracking", note: "Track where every lead sits in your pipeline" },
      { text: "Saved leads & notes", note: null },
      { text: "Follow-up queue", note: "See all leads with upcoming or overdue follow-up dates in one place" },
      { text: "CSV export", note: null },
    ],
    lockedFeatures: [
      "AI outreach generator",
      "In-platform email sending",
      "Website signal deep scan",
      "Profile analytics & revenue tracking",
    ],
    cta: "Join Waitlist",
    href: null,
  },
  {
    name: "Operator",
    price: "$79",
    sub: "/ month",
    billing: "Beta pricing · locks in for 12 months",
    description: "Everything in Scout, plus the tools to act on your leads — without switching to another platform.",
    highlight: true,
    badge: "Most Popular",
    features: [
      { text: "Unlimited lead searches", note: null },
      { text: "Everything in Scout", note: null },
      { text: "AI outreach generator", note: "Signal-driven messages for email, LinkedIn DM, or cold call — tailored to each lead's gap type" },
      { text: "Send outreach directly", note: "Send emails from within Vantio and log them automatically to the lead's activity history" },
      { text: "Message template library", note: "Save your best messages and reuse them in one click" },
      { text: "Website deep scan", note: "50 scans/month — checks booking flows, contact pages, mobile friendliness and more" },
      { text: "Profile analytics", note: "Track reply rates, booking rates, close rates, and revenue across your pipeline" },
      { text: "Lead scoring explanation", note: "See exactly why a lead scored the way it did, with the full evidence breakdown" },
    ],
    lockedFeatures: [
      "Team members",
      "Unlimited deep scans",
    ],
    cta: "Join Waitlist",
    href: null,
  },
  {
    name: "Agency",
    price: "$199",
    sub: "/ month",
    billing: "Beta pricing · locks in for 12 months",
    description: "Built for teams running outreach for multiple clients across multiple niches at the same time.",
    highlight: false,
    badge: null,
    features: [
      { text: "Everything in Operator", note: null },
      { text: "Up to 5 team members", note: "Each with their own profile, scoring, and outreach history" },
      { text: "Unlimited website deep scans", note: null },
      { text: "Bulk lead actions", note: "Mark multiple leads as contacted, export selections, or move them between collections in one action" },
      { text: "Competitor density signals", note: "See how saturated a market is before you pitch" },
      { text: "CSV import", note: "Score your own prospect lists with Vantio's signal engine" },
      { text: "Priority email support", note: "We respond within 24 hours" },
    ],
    lockedFeatures: [],
    cta: "Join Waitlist",
    href: null,
  },
];


const FAQ = [
  {
    q: "What are the four gap types?",
    a: "Vantio classifies every lead into one of four gap types based on their digital signals. Visibility Gap — demand exists but they're not capturing it. Conversion Gap — traffic or interest exists but leaks before becoming bookings. Infrastructure Gap — no digital foundation. Optimization Gap — strong base with clear room to sharpen. The gap type tells you exactly what angle to use in your outreach.",
  },
  {
    q: "When do paid plans launch?",
    a: "We're in beta right now. Joining the waitlist locks in your beta price for 12 months from launch — 30–40% below the public rate.",
  },
  {
    q: "Is there a free trial?",
    a: "During beta, full platform access is available. When we launch publicly, each paid plan includes a 7-day free trial — no card charged until day 8.",
  },
  {
    q: "What counts as a 'lead search'?",
    a: "One search = one niche + location query (e.g. 'barber shops in Malmö'). Each search returns up to 25 scored leads. Paginating through the same search doesn't count as a new search.",
  },
  {
    q: "Can I switch plans later?",
    a: "Yes. Upgrades apply immediately, downgrades at your next billing cycle. No lock-in beyond the current month.",
  },
  {
    q: "What's the difference between Scout and Operator?",
    a: "Scout is the intelligence layer — find, score, and evaluate leads. Operator adds the action layer — AI outreach generation, in-platform email sending, website deep scans, and pipeline analytics. If you're running regular outreach and want to do it without switching tools, Operator is built for you.",
  },
  {
    q: "Who is Agency for?",
    a: "Teams. Freelancers who bring in colleagues, small agencies managing client prospecting across multiple niches, or anyone who needs more than one person working the same pipeline. The key additions are up to 5 team seats, unlimited deep scans, bulk lead actions, and an onboarding call.",
  },
];

export default function PlansPage() {
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistPlan, setWaitlistPlan] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  async function handleWaitlist(planName: string) {
    setWaitlistPlan(planName);
    setSubmitted(false);
  }

  async function handleSubmitWaitlist(e: { preventDefault: () => void }) {
    e.preventDefault();
    if (!waitlistEmail.trim()) return;
    setSubmitting(true);
    try {
      await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: waitlistEmail.trim(), plan: waitlistPlan }),
      });
    } catch {
      // Still show success — we don't want to block the user on a network error
    }
    setSubmitting(false);
    setSubmitted(true);
  }

  return (
    <div className="min-h-screen bg-[#080808] text-[#f5f0e8]">

      {/* Nav */}
      <nav className="flex items-center justify-between px-6 md:px-12 py-5 border-b border-[#151515]">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-[#c9a84c]">◈</span>
          <span className="text-lg font-light tracking-wide" style={{ fontFamily: "var(--font-display), serif" }}>
            Van<span style={{ background: "linear-gradient(135deg, #e8c97a 0%, #c9a84c 50%, #8a6e30 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>tio</span>
          </span>
        </Link>
        <HamburgerMenu hasProfile={false} />
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-20">

        {/* Header */}
        <div className="text-center mb-16">
          <p className="text-[11px] tracking-[0.2em] uppercase text-[#8a6e30] mb-4">Pricing</p>
          <h1 className="text-4xl md:text-6xl font-light mb-4" style={{ fontFamily: "var(--font-display), serif" }}>
            Simple,{" "}
            <span className="italic" style={{ background: "linear-gradient(135deg, #e8c97a 0%, #c9a84c 50%, #8a6e30 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              transparent.
            </span>
          </h1>
          <p className="text-[14px] text-[#555] max-w-lg mx-auto leading-relaxed">
            Full platform access during beta. Paid plans launch soon — join the waitlist to lock in beta pricing.
          </p>
        </div>

        {/* Plans grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl border p-7 flex flex-col transition-all duration-300 ${
                plan.highlight
                  ? "border-[rgba(201,168,76,0.4)] bg-[#0f0f0f]"
                  : "border-[#181818] bg-[#0a0a0a] hover:border-[#252525]"
              }`}
            >
              {/* Gold accent line */}
              {plan.highlight && (
                <div className="absolute top-0 left-8 right-8 h-[1px] bg-gradient-to-r from-transparent via-[#c9a84c] to-transparent" />
              )}

              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="text-[10px] tracking-[0.15em] uppercase px-3 py-1 rounded-full bg-[#c9a84c] text-[#080808] font-bold">
                    {plan.badge}
                  </span>
                </div>
              )}

              {/* Plan header */}
              <div className="mb-6">
                <p className="text-[10px] tracking-[0.2em] uppercase text-[#8a6e30] mb-3">{plan.name}</p>
                <div className="flex items-baseline gap-1.5 mb-0.5">
                  <span
                    className="text-4xl font-light"
                    style={{
                      fontFamily: "var(--font-display), serif",
                      color: plan.highlight ? "#c9a84c" : "#f5f0e8",
                    }}
                  >
                    {plan.price}
                  </span>
                  <span className="text-[13px] text-[#555]">{plan.sub}</span>
                </div>
                {plan.billing && (
                  <p className="text-[11px] text-[#333] mb-3">{plan.billing}</p>
                )}
                <p className="text-[12px] text-[#555] leading-relaxed mt-2">{plan.description}</p>
              </div>

              {/* Features */}
              <ul className="space-y-3 flex-1 mb-8">
                {plan.features.map((f, j) => {
                  const feat = typeof f === "string" ? { text: f, note: null } : f as { text: string; note: string | null };
                  return (
                    <li key={j} className="flex items-start gap-2.5">
                      <span className="text-[#8a6e30] mt-0.5 shrink-0 text-[10px]">✦</span>
                      <div>
                        <p className="text-[12px] text-[#888]">{feat.text}</p>
                        {feat.note && <p className="text-[10px] text-[#555] mt-0.5 leading-relaxed">{feat.note}</p>}
                      </div>
                    </li>
                  );
                })}

              </ul>

              {/* CTA */}
              {plan.href ? (
                <Link
                  href={plan.href}
                  className={`w-full text-center py-3 rounded-xl text-[13px] font-semibold tracking-wide transition-all ${
                    plan.highlight
                      ? "bg-[#c9a84c] text-[#080808] hover:bg-[#e8c97a]"
                      : "border border-[#252525] text-[#888] hover:border-[#3a3a3a] hover:text-[#f5f0e8]"
                  }`}
                >
                  {plan.cta}
                </Link>
              ) : (
                <button
                  onClick={() => handleWaitlist(plan.name)}
                  className={`w-full text-center py-3 rounded-xl text-[13px] font-semibold tracking-wide transition-all ${
                    plan.highlight
                      ? "bg-[#c9a84c] text-[#080808] hover:bg-[#e8c97a]"
                      : "border border-[#252525] text-[#888] hover:border-[#3a3a3a] hover:text-[#f5f0e8]"
                  }`}
                >
                  {plan.cta}
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Waitlist modal */}
        {waitlistPlan && !submitted && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/70 backdrop-blur-sm" onClick={() => setWaitlistPlan(null)}>
            <div
              className="w-full max-w-md rounded-2xl border border-[rgba(201,168,76,0.3)] bg-[#0d0d0d] p-8 relative"
              style={{ boxShadow: "0 24px 80px rgba(0,0,0,0.7)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="absolute top-4 right-4 text-[#444] hover:text-[#888] text-xl transition-colors"
                onClick={() => setWaitlistPlan(null)}
              >
                ×
              </button>

              <div className="mb-6">
                <p className="text-[10px] tracking-[0.2em] uppercase text-[#8a6e30] mb-2">Join waitlist</p>
                <h3 className="text-2xl font-light mb-2" style={{ fontFamily: "var(--font-display), serif" }}>
                  Vantio <span style={{ background: "linear-gradient(135deg, #e8c97a 0%, #c9a84c 50%, #8a6e30 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{waitlistPlan}</span>
                </h3>
                <p className="text-[13px] text-[#555] leading-relaxed">
                  We&apos;ll email you when {waitlistPlan} launches — plus early access and a locked-in beta rate.
                </p>
              </div>

              <form onSubmit={handleSubmitWaitlist} className="space-y-4">
                <input
                  type="email"
                  required
                  placeholder="your@email.com"
                  value={waitlistEmail}
                  onChange={(e) => setWaitlistEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-[#111] border border-[#252525] text-[#f5f0e8] text-[13px] placeholder-[#444] focus:outline-none focus:border-[rgba(201,168,76,0.4)] transition-colors"
                />
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 rounded-xl bg-[#c9a84c] text-[#080808] font-semibold text-[13px] tracking-wide hover:bg-[#e8c97a] transition-all disabled:opacity-60"
                >
                  {submitting ? "Saving…" : "Reserve My Spot →"}
                </button>
                <p className="text-[11px] text-[#333] text-center">No spam. One email when we launch.</p>
              </form>
            </div>
          </div>
        )}

        {/* Waitlist success */}
        {submitted && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/70 backdrop-blur-sm" onClick={() => { setWaitlistPlan(null); setSubmitted(false); }}>
            <div
              className="w-full max-w-md rounded-2xl border border-[rgba(201,168,76,0.3)] bg-[#0d0d0d] p-10 text-center relative"
              style={{ boxShadow: "0 24px 80px rgba(0,0,0,0.7)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-4xl mb-4">✦</div>
              <h3 className="text-2xl font-light mb-3" style={{ fontFamily: "var(--font-display), serif", color: "#c9a84c" }}>You&apos;re on the list.</h3>
              <p className="text-[13px] text-[#555] leading-relaxed mb-6">
                We&apos;ll email <span className="text-[#888]">{waitlistEmail}</span> when {waitlistPlan} opens. Early access pricing is locked for you.
              </p>
              <button
                onClick={() => { setWaitlistPlan(null); setSubmitted(false); }}
                className="px-6 py-2.5 rounded-xl border border-[#252525] text-[#888] text-[12px] hover:border-[#444] transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* How it works + FAQ */}
        <div className="border-t border-[#111] pt-16 space-y-16">

          {/* How it works */}
          <div>
            <div className="text-center mb-10">
              <p className="text-[11px] tracking-[0.2em] uppercase text-[#8a6e30] mb-3">The process</p>
              <h2 className="text-3xl font-light" style={{ fontFamily: "var(--font-display), serif" }}>How Vantio works</h2>
              <p className="text-[#555] text-sm mt-3 max-w-lg mx-auto">Signal-driven outreach in three steps. No cold list buying, no guesswork.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
              {[
                {
                  step: "01",
                  title: "Search your niche",
                  body: "Enter any niche and location. Vantio pulls real businesses and scores each one using reputation, digital presence, opportunity gap, and risk signals.",
                },
                {
                  step: "02",
                  title: "Read the angle",
                  body: "Every lead gets a tailored outreach angle and ready-to-send script — soft or direct — based on the specific gap detected in that business.",
                },
                {
                  step: "03",
                  title: "Track and close",
                  body: "Log outcomes as you contact, follow up, book calls, and close. Your pipeline stats update in real time so you can see what's working.",
                },
              ].map(({ step, title, body }) => (
                <div key={step} className="rounded-2xl border border-[#141414] bg-[#0d0d0d] p-6 space-y-3">
                  <p className="text-[11px] tracking-widest text-[#8a6e30]">{step}</p>
                  <p className="text-[15px] font-medium text-[#f5f0e8]">{title}</p>
                  <p className="text-[12px] text-[#555] leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </div>

          {/* FAQ accordion */}
          <div>
            <div className="text-center mb-10">
              <p className="text-[11px] tracking-[0.2em] uppercase text-[#8a6e30] mb-3">Common questions</p>
              <h2 className="text-3xl font-light" style={{ fontFamily: "var(--font-display), serif" }}>Questions & answers</h2>
            </div>
            <div className="max-w-2xl mx-auto space-y-2">
              {FAQ.map((item, i) => (
                <div key={i} className="border border-[#141414] rounded-xl overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between px-5 py-4 text-left text-[13px] text-[#ccc] hover:text-[#f5f0e8] transition-colors"
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  >
                    <span>{item.q}</span>
                    <span className="text-[#555] ml-4 shrink-0 text-lg transition-transform" style={{ transform: openFaq === i ? "rotate(45deg)" : "none" }}>+</span>
                  </button>
                  {openFaq === i && (
                    <div className="px-5 pb-4">
                      <p className="text-[12px] text-[#555] leading-relaxed">{item.a}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer note */}
        <div className="mt-12 text-center">
          <p className="text-[12px] text-[#333]">
            Questions?{" "}
            <a href="/contact" className="text-[#c9a84c] hover:text-[#e8c97a] transition-colors">
              Contact us →
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
