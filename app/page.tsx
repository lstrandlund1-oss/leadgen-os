"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import HamburgerMenu from "./components/HamburgerMenu";

const FEATURES = [
  {
    icon: "◈",
    title: "Signal-Driven Scoring",
    body: "Every lead is scored across opportunity, readiness, risk, and fit — not just star ratings. Know exactly why a business is worth your time.",
  },
  {
    icon: "◆",
    title: "Matched to Your Service",
    body: "Your profile shapes every score. A web developer sees different leads than an SEO specialist — same database, completely different intelligence.",
  },
  {
    icon: "✦",
    title: "Outreach Built In",
    body: "Every lead comes with a tailored pitch angle, gap analysis, and an AI-generated message — written around your offer and the lead's specific signals.",
  },
  {
    icon: "◇",
    title: "Enriched Automatically",
    body: "Website reachability, booking CTAs, social presence, mobile friendliness — all scanned and factored into the score the moment you open a lead.",
  },
  {
    icon: "⬡",
    title: "Track Your Pipeline",
    body: "Mark leads as contacted, replied, booked, closed. See your conversion rates across every stage. Revenue totals auto-calculated.",
  },
  {
    icon: "◉",
    title: "Geography Aware",
    body: "Set your target location once. Every fit score adjusts for proximity — leads in your market surface first, automatically.",
  },
];

const STEPS = [
  {
    number: "01",
    title: "Set your profile",
    body: "Tell Vantio what you offer and who you serve. Your profile becomes the lens every score is seen through.",
  },
  {
    number: "02",
    title: "Search for leads",
    body: "Enter a niche and location. The engine pulls local businesses and scores each one against your capabilities in seconds.",
  },
  {
    number: "03",
    title: "Read the intelligence",
    body: "Opportunity score, risk profile, website signals, gap type, fit score, and a personalised pitch angle — not just a name and phone number.",
  },
  {
    number: "04",
    title: "Reach out with confidence",
    body: "Save promising leads, generate a personalised AI message in seconds, send it, track the outcome. Your pipeline builds itself.",
  },
];

const STATS = [
  { value: "< 3s", label: "Average time to score a lead" },
  { value: "4", label: "Gap types detected automatically" },
  { value: "AI", label: "Messages written to your offer and the lead's signals" },
  { value: "100%", label: "Profile-matched — no generic lists" },
];



// Mini score card data for the mockup
const MOCK_LEAD = {
  name: "Bloom & Co Studio",
  industry: "Beauty Salon",
  city: "London",
  score: 74,
  fit: 81,
  opportunity: 68,
  risk: 22,
  gap: "CONVERSION",
  gapColor: "#fb923c",
  verdict: "Strong Lead",
  verdictColor: "#4ade80",
};

export default function LandingPage() {
  const [waitlistCount, setWaitlistCount] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/waitlist")
      .then(r => r.json())
      .then(d => { if (typeof d.count === "number" && d.count > 0) setWaitlistCount(d.count); })
      .catch(() => {});
  }, []);
  return (
    <div className="min-h-screen bg-[#080808] text-[#f5f0e8] overflow-x-hidden">

      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-6 md:px-12 py-4 border-b border-[#181818] bg-[#080808]/90 backdrop-blur-md">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-[#c9a84c] text-lg">◈</span>
          <span className="font-display text-xl font-semibold tracking-wide" style={{ fontFamily: "var(--font-display), serif" }}>
            Van<span style={{ background: "linear-gradient(135deg, #e8c97a 0%, #c9a84c 50%, #8a6e30 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>tio</span>
          </span>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/plans" className="hidden md:block text-[13px] text-[#555] hover:text-[#e8c97a] transition-colors tracking-wide">Pricing</Link>
          <Link href="/login" className="hidden md:block text-[13px] px-4 py-2 rounded-lg border border-[rgba(201,168,76,0.3)] text-[#c9a84c] hover:bg-[rgba(201,168,76,0.08)] transition-all tracking-wide">Get Early Access</Link>
          <HamburgerMenu hasProfile={false} />
        </div>
      </nav>

      {/* HERO */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-24 pb-16 text-center overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 70% 50% at 50% 0%, rgba(201,168,76,0.08) 0%, transparent 65%)" }} />
        <div className="absolute inset-0 pointer-events-none opacity-[0.025]" style={{ backgroundImage: "linear-gradient(#c9a84c 1px, transparent 1px), linear-gradient(90deg, #c9a84c 1px, transparent 1px)", backgroundSize: "80px 80px" }} />
        <div className="absolute top-1/3 left-1/4 w-96 h-96 rounded-full pointer-events-none opacity-[0.04]" style={{ background: "radial-gradient(circle, #c9a84c 0%, transparent 70%)" }} />

        <div className="animate-fade-up-delay-1 inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[rgba(201,168,76,0.25)] bg-[rgba(201,168,76,0.04)] mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-[#c9a84c] animate-pulse" />
          <span className="text-[11px] tracking-[0.15em] uppercase text-[#c9a84c]">
            {waitlistCount !== null
              ? `${waitlistCount} service providers in early access`
              : "Closed Beta — Limited Access"}
          </span>
        </div>

        <h1 className="animate-fade-up-delay-2 text-5xl md:text-7xl lg:text-8xl font-light leading-[1.05] tracking-tight max-w-5xl" style={{ fontFamily: "var(--font-display), serif" }}>
          The intelligence layer
          <br />
          <span className="font-semibold italic" style={{ background: "linear-gradient(135deg, #e8c97a 0%, #c9a84c 50%, #8a6e30 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>your outreach is missing.</span>
        </h1>

        <p className="animate-fade-up-delay-3 mt-8 text-[15px] md:text-lg text-[#666] max-w-2xl leading-relaxed tracking-wide">
          Vantio finds local businesses and tells you exactly which ones are worth contacting — scored against your specific service, capability, and style.
        </p>

        <div className="animate-fade-up-delay-4 mt-10 flex flex-col sm:flex-row items-center gap-4">
          <Link href="/login" className="relative px-8 py-3.5 rounded-lg bg-[#c9a84c] text-[#080808] font-semibold text-[14px] tracking-wide hover:bg-[#e8c97a] transition-all duration-300 shadow-lg" style={{ boxShadow: "0 8px 32px rgba(201,168,76,0.18)" }}>
            Request Early Access
          </Link>
          <Link href="#how-it-works" className="text-[13px] text-[#555] hover:text-[#f5f0e8] transition-colors tracking-wide flex items-center gap-2">
            See how it works <span className="text-[#8a6e30]">↓</span>
          </Link>
        </div>

        <p className="animate-fade-up-delay-5 mt-12 text-[11px] text-[#333] tracking-[0.2em] uppercase">
          Built for marketers · web developers · content creators · SEO specialists · agencies
        </p>

        {/* LIVE SCORE MOCKUP */}
        <div className="animate-fade-up-delay-5 mt-16 w-full max-w-md mx-auto">
          <div className="rounded-2xl border border-[#1e1e1e] bg-[#0d0d0d] p-5 text-left shadow-2xl" style={{ boxShadow: "0 24px 80px rgba(0,0,0,0.6)" }}>
            {/* Card header */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-[15px] font-semibold text-[#f5f0e8]">{MOCK_LEAD.name}</p>
                  <span className="text-[9px] px-2 py-0.5 rounded-full border border-[#252525] text-[#555]">{MOCK_LEAD.industry}</span>
                </div>
                <p className="text-[11px] text-[#444]">📍 {MOCK_LEAD.city}</p>
              </div>
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg" style={{ color: MOCK_LEAD.verdictColor, background: `${MOCK_LEAD.verdictColor}12`, border: `1px solid ${MOCK_LEAD.verdictColor}30` }}>
                {MOCK_LEAD.verdict}
              </span>
            </div>

            {/* Score bars */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 mb-4">
              {[
                { label: "Score", value: MOCK_LEAD.score, color: "#c9a84c" },
                { label: "Fit", value: MOCK_LEAD.fit, color: "#4ade80" },
                { label: "Opportunity", value: MOCK_LEAD.opportunity, color: "#818cf8" },
                { label: "Risk", value: MOCK_LEAD.risk, color: "#f87171" },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex justify-between text-[10px] mb-1">
                    <span className="text-[#555]">{item.label}</span>
                    <span style={{ color: item.color }} className="font-bold">{item.value}</span>
                  </div>
                  <div className="w-full h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${item.value}%`, backgroundColor: item.color }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Gap type */}
            <div className="rounded-lg p-2.5 flex items-center gap-2.5" style={{ background: `${MOCK_LEAD.gapColor}08`, border: `1px solid ${MOCK_LEAD.gapColor}20` }}>
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: MOCK_LEAD.gapColor }}>⬡ {MOCK_LEAD.gap} GAP</span>
              <span className="text-[10px] text-[#555]">— no booking flow detected</span>
            </div>

            {/* Mini pipeline stats */}
            <div className="mt-3 grid grid-cols-4 gap-1 border border-[#1a1a1a] rounded-xl bg-[#0a0a0a] p-2.5">
              {[
                { label: "Contacted", value: "12", icon: "✉", active: true },
                { label: "Replied", value: "5", icon: "↩", active: true },
                { label: "Calls", value: "2", icon: "📅", active: true },
                { label: "Closed", value: "1", icon: "✦", color: "#c9a84c" },
              ].map((item) => (
                <div key={item.label} className="flex flex-col items-center gap-0.5">
                  <span className="text-[11px]" style={{ color: item.color ?? (item.active ? "#4ade80" : "#333") }}>{item.icon}</span>
                  <span className="text-[13px] font-bold" style={{ color: item.color ?? "#f5f0e8" }}>{item.value}</span>
                  <span className="text-[9px] text-[#444] tracking-wide">{item.label}</span>
                </div>
              ))}
            </div>

            {/* Shimmer label */}
            <p className="text-[10px] text-[#333] text-center mt-3 tracking-widest uppercase">Live intelligence · scored in seconds</p>
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-20">
          <div className="w-[1px] h-12 bg-gradient-to-b from-transparent to-[#c9a84c]" />
        </div>
      </section>

      {/* STAT BAR */}
      <section className="border-y border-[#141414] bg-[#0a0a0a]">
        <div className="max-w-5xl mx-auto px-6 py-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {STATS.map((s) => (
              <div key={s.label}>
                <p className="text-3xl md:text-4xl font-light mb-1" style={{ fontFamily: "var(--font-display), serif", background: "linear-gradient(135deg, #e8c97a 0%, #c9a84c 60%, #8a6e30 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                  {s.value}
                </p>
                <p className="text-[11px] text-[#444] tracking-wide uppercase">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="px-6 md:px-12 py-24 max-w-6xl mx-auto">
        <div className="mb-16 text-center">
          <p className="text-[11px] tracking-[0.2em] uppercase text-[#8a6e30] mb-4">What Vantio does</p>
          <h2 className="text-4xl md:text-5xl font-light" style={{ fontFamily: "var(--font-display), serif" }}>
            Not a lead list.{" "}
            <span className="italic" style={{ background: "linear-gradient(135deg, #e8c97a 0%, #c9a84c 50%, #8a6e30 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>Lead intelligence.</span>
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f, i) => (
            <div key={i} className="group p-6 rounded-2xl border border-[#151515] bg-[#0d0d0d] hover:border-[rgba(201,168,76,0.2)] hover:bg-[#101010] transition-all duration-300">
              <div className="text-[#4a3a1a] text-xl mb-4 group-hover:text-[#c9a84c] transition-colors duration-300">{f.icon}</div>
              <h3 className="text-[17px] font-medium mb-2 text-[#e8e0d0]" style={{ fontFamily: "var(--font-display), serif" }}>{f.title}</h3>
              <p className="text-[13px] text-[#555] leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* DIVIDER */}
      <div className="max-w-6xl mx-auto px-6">
        <div className="h-[1px] bg-gradient-to-r from-transparent via-[rgba(201,168,76,0.15)] to-transparent" />
      </div>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="px-6 md:px-12 py-24 max-w-6xl mx-auto">
        <div className="mb-16 text-center">
          <p className="text-[11px] tracking-[0.2em] uppercase text-[#8a6e30] mb-4">The process</p>
          <h2 className="text-4xl md:text-5xl font-light" style={{ fontFamily: "var(--font-display), serif" }}>
            From search to{" "}
            <span className="italic" style={{ background: "linear-gradient(135deg, #e8c97a 0%, #c9a84c 50%, #8a6e30 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>signed client.</span>
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {STEPS.map((s, i) => (
            <div key={i} className="flex gap-6 group p-6 rounded-2xl border border-[#111] hover:border-[#1e1e1e] transition-colors">
              <div className="shrink-0">
                <span className="text-5xl font-light text-[#1a1a1a] group-hover:text-[#2a2010] transition-colors duration-300" style={{ fontFamily: "var(--font-display), serif" }}>{s.number}</span>
              </div>
              <div className="pt-2">
                <h3 className="text-[17px] font-medium mb-2 text-[#e8e0d0]" style={{ fontFamily: "var(--font-display), serif" }}>{s.title}</h3>
                <p className="text-[13px] text-[#555] leading-relaxed">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* DIFFERENTIATOR CALLOUT */}
      <section className="px-6 md:px-12 py-24 bg-[#060606] border-y border-[#111]">
        <div className="max-w-5xl mx-auto">
          <div className="mb-14 text-center">
            <p className="text-[11px] tracking-[0.2em] uppercase text-[#8a6e30] mb-4">Why Vantio is different</p>
            <h2 className="text-4xl md:text-5xl font-light" style={{ fontFamily: "var(--font-display), serif" }}>
              Other tools give you names.{" "}
              <span className="italic" style={{ background: "linear-gradient(135deg, #e8c97a 0%, #c9a84c 50%, #8a6e30 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>We give you reasons.</span>
            </h2>
            <p className="mt-4 text-[14px] text-[#444] max-w-2xl mx-auto leading-relaxed">
              Every other lead tool hands you a spreadsheet. Vantio hands you a verdict — scored against your specific service, with a strategic pitch angle and an AI-generated outreach message written around your offer and the lead&apos;s signals.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-[#151515] rounded-2xl overflow-hidden border border-[#151515]">
            {[
              {
                label: "Typical lead lists",
                icon: "✗",
                iconColor: "#f87171",
                points: ["Name, phone, address", "No scoring or context", "Same list for everyone", "Manual research required", "No outreach guidance"],
              },
              {
                label: "Vantio",
                icon: "◈",
                iconColor: "#c9a84c",
                highlight: true,
                points: ["Signal-driven lead score", "Gap type + pitch angle", "Matched to your profile", "Website signals auto-scanned", "AI message generated from your profile"],
              },
              {
                label: "Manual research",
                icon: "✗",
                iconColor: "#f87171",
                points: ["1–2 hours per lead", "Inconsistent judgment", "No structured scoring", "Easy to miss signals", "Hard to scale"],
              },
            ].map((col, i) => (
              <div key={i} className={`p-7 space-y-4 ${col.highlight ? "bg-[rgba(201,168,76,0.04)]" : "bg-[#0a0a0a]"}`}>
                <div className="flex items-center gap-2 mb-5">
                  <span className="text-lg" style={{ color: col.iconColor }}>{col.icon}</span>
                  <p className={`text-[13px] font-semibold tracking-wide ${col.highlight ? "text-[#c9a84c]" : "text-[#444]"}`}>{col.label}</p>
                  {col.highlight && <span className="text-[9px] px-2 py-0.5 rounded-full bg-[rgba(201,168,76,0.15)] text-[#c9a84c] uppercase tracking-widest ml-auto">You are here</span>}
                </div>
                <div className="space-y-3">
                  {col.points.map((pt, j) => (
                    <div key={j} className="flex items-start gap-2.5">
                      <span className={`mt-0.5 text-[10px] shrink-0 ${col.highlight ? "text-[#4ade80]" : "text-[#333]"}`}>{col.highlight ? "✓" : "—"}</span>
                      <p className={`text-[12px] leading-snug ${col.highlight ? "text-[#888]" : "text-[#333]"}`}>{pt}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA BAND */}
      <section className="px-6 md:px-12 py-28">
        <div className="max-w-4xl mx-auto rounded-2xl border border-[rgba(201,168,76,0.15)] bg-[#0d0d0d] p-12 text-center relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 60% 60% at 50% 50%, rgba(201,168,76,0.04) 0%, transparent 70%)" }} />
          <p className="text-[11px] tracking-[0.2em] uppercase text-[#8a6e30] mb-6">Join the beta</p>
          <h2 className="text-4xl md:text-5xl font-light mb-6" style={{ fontFamily: "var(--font-display), serif" }}>
            Stop guessing.<br />
            <span className="italic" style={{ background: "linear-gradient(135deg, #e8c97a 0%, #c9a84c 50%, #8a6e30 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>Start converting.</span>
          </h2>
          <p className="text-[14px] text-[#555] mb-10 max-w-xl mx-auto leading-relaxed">
            We&apos;re opening beta access to a limited number of service providers. Create your profile now and get matched leads from day one.
          </p>
          <Link href="/login" className="inline-block px-10 py-4 rounded-lg bg-[#c9a84c] text-[#080808] font-semibold text-[14px] tracking-wide hover:bg-[#e8c97a] transition-all duration-300" style={{ boxShadow: "0 8px 32px rgba(201,168,76,0.18)" }}>
            Create Your Profile — It&apos;s Free
          </Link>
          <p className="mt-4 text-[11px] text-[#333]">No credit card required · Cancel anytime</p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-[#111] px-6 md:px-12 py-8">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[#8a6e30] text-sm">◈</span>
            <span className="text-sm text-[#333]" style={{ fontFamily: "var(--font-display), serif" }}>Vantio</span>
          </div>
          <div className="flex items-center gap-6 text-[12px] text-[#333]">
            <Link href="/plans" className="hover:text-[#c9a84c] transition-colors">Pricing</Link>
            <Link href="/login" className="hover:text-[#c9a84c] transition-colors">Get Access</Link>
            <a href="mailto:hello@vantio.com" className="hover:text-[#c9a84c] transition-colors">Contact</a>
            <Link href="/privacy" className="hover:text-[#c9a84c] transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-[#c9a84c] transition-colors">Terms</Link>
          </div>
          <p className="text-[11px] text-[#222] tracking-wide">© 2025 Vantio. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
