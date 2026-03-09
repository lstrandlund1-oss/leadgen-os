"use client";

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
    body: "Every lead comes with a tailored pitch angle and two script variants. Soft or direct — chosen based on the lead's risk profile and your style.",
  },
  {
    icon: "◇",
    title: "Enriched Automatically",
    body: "Website reachability, booking CTAs, social presence, mobile friendliness — all scanned and factored into the score the moment you open a lead.",
  },
  {
    icon: "⬡",
    title: "Track Your Pipeline",
    body: "Mark leads as contacted, replied, booked, closed. See your conversion rates across every stage. Know what's working.",
  },
  {
    icon: "◉",
    title: "Any Industry, Any Service",
    body: "Real estate, beauty clinics, restaurants, tattoo studios — and everything beyond. Built to scale across all local business types.",
  },
];

const STEPS = [
  {
    number: "01",
    title: "Set your profile",
    body: "Tell LeadGenOS what you offer and who you serve. Marketer, web dev, SEO — your profile becomes the lens every score is seen through.",
  },
  {
    number: "02",
    title: "Search for leads",
    body: "Enter a niche and location. LeadGenOS pulls local businesses and runs them through a deterministic scoring engine in seconds.",
  },
  {
    number: "03",
    title: "Read the intelligence",
    body: "Every lead shows opportunity score, risk profile, website signals, and a personalised pitch angle — not just a name and phone number.",
  },
  {
    number: "04",
    title: "Reach out with confidence",
    body: "Copy the outreach script, send it, and track the outcome. Let your close rate tell the story.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] overflow-x-hidden">

      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-6 md:px-12 py-4 border-b border-[var(--border)] bg-[var(--background)]/90 backdrop-blur-md">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-[var(--gold)] text-lg">◈</span>
          <span className="font-display text-xl font-semibold tracking-wide" style={{ fontFamily: "var(--font-display), serif" }}>
            LeadGen<span style={{ background: "linear-gradient(135deg, #e8c97a 0%, #c9a84c 50%, #8a6e30 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>OS</span>
          </span>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/plans" className="hidden md:block text-[13px] text-[#888] hover:text-[#e8c97a] transition-colors tracking-wide">Pricing</Link>
          <Link href="/onboarding" className="hidden md:block text-[13px] px-4 py-2 rounded-lg border border-[rgba(201,168,76,0.3)] text-[#c9a84c] hover:bg-[rgba(201,168,76,0.1)] transition-all tracking-wide">Get Early Access</Link>
          <HamburgerMenu hasProfile={false} />
        </div>
      </nav>

      {/* HERO */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-24 pb-16 text-center overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(201,168,76,0.07) 0%, transparent 70%)" }} />
        <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: "linear-gradient(#c9a84c 1px, transparent 1px), linear-gradient(90deg, #c9a84c 1px, transparent 1px)", backgroundSize: "80px 80px" }} />

        <div className="animate-fade-up-delay-1 inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[rgba(201,168,76,0.3)] bg-[rgba(201,168,76,0.05)] mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-[#c9a84c] animate-pulse" />
          <span className="text-[11px] tracking-[0.15em] uppercase text-[#c9a84c]">Closed Beta — Limited Access</span>
        </div>

        <h1 className="animate-fade-up-delay-2 text-5xl md:text-7xl lg:text-8xl font-light leading-[1.05] tracking-tight max-w-5xl" style={{ fontFamily: "var(--font-display), serif" }}>
          The intelligence layer
          <br />
          <span className="font-semibold italic" style={{ background: "linear-gradient(135deg, #e8c97a 0%, #c9a84c 50%, #8a6e30 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>your outreach is missing.</span>
        </h1>

        <p className="animate-fade-up-delay-3 mt-8 text-[15px] md:text-lg text-[#888] max-w-2xl leading-relaxed tracking-wide">
          LeadGenOS finds local businesses and tells you exactly which ones are worth contacting — scored against your specific service, capability, and style.
        </p>

        <div className="animate-fade-up-delay-4 mt-10 flex flex-col sm:flex-row items-center gap-4">
          <Link href="/onboarding" className="relative px-8 py-3.5 rounded-lg bg-[#c9a84c] text-[#080808] font-semibold text-[14px] tracking-wide hover:bg-[#e8c97a] transition-all duration-300 shadow-lg" style={{ boxShadow: "0 8px 32px rgba(201,168,76,0.2)" }}>
            Request Early Access
          </Link>
          <Link href="#how-it-works" className="text-[13px] text-[#666] hover:text-[var(--foreground)] transition-colors tracking-wide flex items-center gap-2">
            See how it works <span className="text-[#8a6e30]">↓</span>
          </Link>
        </div>

        <p className="animate-fade-up-delay-5 mt-12 text-[11px] text-[#444] tracking-[0.2em] uppercase">
          Built for marketers · web developers · content creators · SEO specialists · agencies
        </p>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-30">
          <div className="w-[1px] h-12 bg-gradient-to-b from-transparent to-[#c9a84c]" />
        </div>
      </section>

      {/* FEATURES */}
      <section className="px-6 md:px-12 py-24 max-w-6xl mx-auto">
        <div className="mb-16 text-center">
          <p className="text-[11px] tracking-[0.2em] uppercase text-[#8a6e30] mb-4">What LeadGenOS does</p>
          <h2 className="text-4xl md:text-5xl font-light" style={{ fontFamily: "var(--font-display), serif" }}>
            Not a lead list.{" "}
            <span className="italic" style={{ background: "linear-gradient(135deg, #e8c97a 0%, #c9a84c 50%, #8a6e30 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>Lead intelligence.</span>
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f, i) => (
            <div key={i} className="group p-6 rounded-xl border border-[#252525] bg-[#111] hover:border-[rgba(201,168,76,0.3)] transition-all duration-300">
              <div className="text-[#8a6e30] text-xl mb-4 group-hover:text-[#c9a84c] transition-colors">{f.icon}</div>
              <h3 className="text-xl font-medium mb-2" style={{ fontFamily: "var(--font-display), serif" }}>{f.title}</h3>
              <p className="text-[13px] text-[#666] leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* DIVIDER */}
      <div className="max-w-6xl mx-auto px-6">
        <div className="h-[1px] bg-gradient-to-r from-transparent via-[rgba(201,168,76,0.3)] to-transparent" />
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
            <div key={i} className="flex gap-6 group">
              <div className="shrink-0">
                <span className="text-5xl font-light text-[#252525] group-hover:text-[#8a6e30] transition-colors duration-300" style={{ fontFamily: "var(--font-display), serif" }}>{s.number}</span>
              </div>
              <div className="pt-2">
                <h3 className="text-xl font-medium mb-2" style={{ fontFamily: "var(--font-display), serif" }}>{s.title}</h3>
                <p className="text-[13px] text-[#666] leading-relaxed">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA BAND */}
      <section className="px-6 md:px-12 py-24">
        <div className="max-w-4xl mx-auto rounded-2xl border border-[rgba(201,168,76,0.3)] bg-[#111] p-12 text-center relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 60% 60% at 50% 50%, rgba(201,168,76,0.05) 0%, transparent 70%)" }} />
          <p className="text-[11px] tracking-[0.2em] uppercase text-[#8a6e30] mb-6">Join the beta</p>
          <h2 className="text-4xl md:text-5xl font-light mb-6" style={{ fontFamily: "var(--font-display), serif" }}>
            Stop guessing.<br />
            <span className="italic" style={{ background: "linear-gradient(135deg, #e8c97a 0%, #c9a84c 50%, #8a6e30 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>Start converting.</span>
          </h2>
          <p className="text-[14px] text-[#666] mb-10 max-w-xl mx-auto leading-relaxed">
            We&apos;re opening beta access to a limited number of service providers. Create your profile now and get matched leads from day one.
          </p>
          <Link href="/onboarding" className="inline-block px-10 py-4 rounded-lg bg-[#c9a84c] text-[#080808] font-semibold text-[14px] tracking-wide hover:bg-[#e8c97a] transition-all duration-300" style={{ boxShadow: "0 8px 32px rgba(201,168,76,0.2)" }}>
            Create Your Profile — It&apos;s Free
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-[#252525] px-6 md:px-12 py-8">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[#8a6e30] text-sm">◈</span>
            <span className="text-sm text-[#444]" style={{ fontFamily: "var(--font-display), serif" }}>LeadGenOS</span>
          </div>
          <div className="flex items-center gap-6 text-[12px] text-[#444]">
            <Link href="/plans" className="hover:text-[#c9a84c] transition-colors">Pricing</Link>
            <Link href="/onboarding" className="hover:text-[#c9a84c] transition-colors">Get Access</Link>
            <a href="mailto:hello@leadgenos.com" className="hover:text-[#c9a84c] transition-colors">Contact</a>
          </div>
          <p className="text-[11px] text-[#333] tracking-wide">© 2025 LeadGenOS. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
