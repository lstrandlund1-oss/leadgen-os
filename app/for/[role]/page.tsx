import Link from "next/link";
import { notFound } from "next/navigation";
import HamburgerMenu from "@/app/components/HamburgerMenu";

const ROLES: Record<string, {
  slug: string;
  title: string;
  headline: string;
  subheadline: string;
  painPoints: string[];
  benefits: { icon: string; title: string; body: string }[];
  mockSearch: { niche: string; location: string; result: string; score: number; gap: string; gapColor: string };
  cta: string;
}> = {
  "web-developers": {
    slug: "web-developers",
    title: "Web Developers",
    headline: "Stop cold-DMing businesses that already have a great website.",
    subheadline: "LeadGenOS scans local businesses and surfaces the ones with broken, missing, or low-converting websites — scored against your stack and capabilities.",
    painPoints: [
      "Spending hours researching businesses manually on Google Maps",
      "Pitching businesses that don't actually need a new site",
      "Generic outreach that gets ignored because it could be anyone",
      "No way to know if a business is worth the time before reaching out",
    ],
    benefits: [
      { icon: "◈", title: "Website signal scanning", body: "Every lead is checked for reachability, mobile friendliness, booking flow presence, and CTA quality — so you know exactly what to pitch before you reach out." },
      { icon: "⬡", title: "Gap type detection", body: "Know if a business has an Infrastructure Gap, Conversion Gap, or Visibility Gap. Your pitch writes itself when you know exactly what's broken." },
      { icon: "✦", title: "Scripts matched to gap type", body: "Two outreach variants — soft and direct — written specifically around the website problem you found. Not generic templates." },
      { icon: "◉", title: "Fit score for your stack", body: "Set your profile once. LeadGenOS weights leads for service type, project size readiness, and client receptivity — so top results match your business model." },
    ],
    mockSearch: { niche: "café", location: "Manchester", result: "The Daily Grind", score: 81, gap: "CONVERSION", gapColor: "#fb923c" },
    cta: "Find your first web dev lead",
  },
  "seo-specialists": {
    slug: "seo-specialists",
    title: "SEO Specialists",
    headline: "Find businesses with traffic potential and no SEO system in place.",
    subheadline: "LeadGenOS scores local businesses against search visibility signals — revealing who has demand in their market but no infrastructure to capture it.",
    painPoints: [
      "Businesses with no organic presence are impossible to find without manual research",
      "No way to know if a market has enough search volume before pitching",
      "Getting ignored because your pitch sounds the same as every other SEO agency",
      "Wasting time on saturated markets with strong established players",
    ],
    benefits: [
      { icon: "◈", title: "Visibility gap detection", body: "LeadGenOS identifies businesses that have market demand but low digital presence — your ideal target. Find them in under 3 seconds." },
      { icon: "⬡", title: "Market competition signals", body: "Opportunity and risk scores reflect how competitive the local market is. Know where you can actually move the needle before you pitch." },
      { icon: "✦", title: "Outreach framed around search", body: "Scripts written specifically for SEO pitches — leading with the specific gap you found, not a generic 'I can get you ranked' opener." },
      { icon: "◇", title: "Social presence scoring", body: "Filter by social presence level. Low-presence businesses are often the easiest SEO wins — they have nowhere to go but up." },
    ],
    mockSearch: { niche: "plumber", location: "Bristol", result: "Morrison Plumbing", score: 77, gap: "VISIBILITY", gapColor: "#818cf8" },
    cta: "Find your first SEO lead",
  },
  "content-creators": {
    slug: "content-creators",
    title: "Content Creators",
    headline: "Get paid to create content for local businesses that need it most.",
    subheadline: "LeadGenOS identifies businesses with high reputation but weak content presence — the exact clients who will pay for what you create.",
    painPoints: [
      "Local businesses ignore cold emails because they don't understand the ROI of content",
      "Hard to prove value upfront without knowing their specific situation",
      "Spending time pitching businesses that already have a strong content operation",
      "No systematic way to find new clients — it's all referrals or luck",
    ],
    benefits: [
      { icon: "◈", title: "Reputation vs. presence gap", body: "Businesses with strong review scores but low digital presence are exactly your target — they have proof of quality but no content to amplify it." },
      { icon: "⬡", title: "Conversion gap framing", body: "Many great local businesses are invisible online. Your pitch frames content as the bridge between what they offer and what potential customers see." },
      { icon: "✦", title: "Value-first outreach built in", body: "Scripts designed for content creators lead with a specific observation — 'You have 4.9 stars and no Instagram presence' — before asking for anything." },
      { icon: "◉", title: "Niche filtering", body: "Search any category — restaurants, fitness studios, salons — and LeadGenOS surfaces the ones with the biggest content gap in seconds." },
    ],
    mockSearch: { niche: "yoga studio", location: "Edinburgh", result: "Sunrise Yoga Co.", score: 72, gap: "VISIBILITY", gapColor: "#818cf8" },
    cta: "Find your first content client",
  },
  "agencies": {
    slug: "agencies",
    title: "Agencies",
    headline: "Scale your prospecting without scaling your headcount.",
    subheadline: "LeadGenOS gives your whole team a systematic lead discovery engine — scored, enriched, and matched to your agency's services. No more guessing.",
    painPoints: [
      "Business development takes 20+ hours per week that should be on client work",
      "Junior team members can't qualify leads without extensive training",
      "Inconsistent outreach because every rep uses a different approach",
      "CRM full of cold leads that were never properly qualified in the first place",
    ],
    benefits: [
      { icon: "◈", title: "Systematic qualification", body: "Every lead arrives pre-scored across opportunity, risk, readiness, and fit. Your team spends time on outreach, not manual research." },
      { icon: "⬡", title: "Consistent gap framing", body: "Gap types (Visibility, Conversion, Infrastructure, Optimization) create a shared language for your whole team. Everyone pitches from the same framework." },
      { icon: "✦", title: "Pipeline tracking built in", body: "Mark leads as contacted, replied, booked, closed. See conversion rates across stages. Revenue tracked automatically." },
      { icon: "◇", title: "Deep enrichment on demand", body: "Website signals, booking flow detection, social presence, mobile score — available on every lead. Agency plan includes unlimited deep scans." },
    ],
    mockSearch: { niche: "dental clinic", location: "London", result: "Bright Smile Dental", score: 88, gap: "CONVERSION", gapColor: "#fb923c" },
    cta: "Start prospecting at scale",
  },
  "performance-marketers": {
    slug: "performance-marketers",
    title: "Performance Marketers",
    headline: "Find businesses ready to spend on paid — before their competitors do.",
    subheadline: "LeadGenOS surfaces businesses with proven demand, weak capture infrastructure, and the budget readiness signals to invest in performance marketing.",
    painPoints: [
      "Hard to identify businesses that would actually benefit from paid ads",
      "Most local businesses have tried ads once and been burned by poor execution",
      "Pitching ads to a business with no landing page is a waste of everyone's time",
      "Conversion data doesn't exist until you've already won the client",
    ],
    benefits: [
      { icon: "◈", title: "Conversion infrastructure scoring", body: "Every lead is scanned for booking CTAs, landing pages, and funnel presence. Find businesses with demand but no system to capture it — your perfect pitch." },
      { icon: "⬡", title: "Market demand signals", body: "Opportunity scores reflect local market volume and competition. Know if paid traffic would actually have an audience before you build the pitch." },
      { icon: "✦", title: "Risk profile matching", body: "Filter by risk profile to find stable businesses that are ready to invest — not businesses in survival mode who can't afford a test budget." },
      { icon: "◉", title: "Scripts for skeptics", body: "Performance marketing outreach requires handling the 'I tried ads before' objection. Your scripts are built around their specific infrastructure gap, not a generic ROAS promise." },
    ],
    mockSearch: { niche: "gym", location: "Birmingham", result: "Peak Performance Fitness", score: 84, gap: "CONVERSION", gapColor: "#fb923c" },
    cta: "Find your first performance client",
  },
};

export function generateStaticParams() {
  return Object.keys(ROLES).map((role) => ({ role }));
}

export default function RoleLandingPage({ params }: { params: { role: string } }) {
  const data = ROLES[params.role];
  if (!data) notFound();

  return (
    <div className="min-h-screen bg-[#080808] text-[#f5f0e8] overflow-x-hidden">

      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-6 md:px-12 py-4 border-b border-[#181818] bg-[#080808]/90 backdrop-blur-md">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-[#c9a84c] text-lg">◈</span>
          <span className="font-display text-xl font-semibold tracking-wide" style={{ fontFamily: "var(--font-display), serif" }}>
            LeadGen<span style={{ background: "linear-gradient(135deg, #e8c97a 0%, #c9a84c 50%, #8a6e30 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>OS</span>
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
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 70% 50% at 50% 0%, rgba(201,168,76,0.07) 0%, transparent 65%)" }} />
        <div className="absolute inset-0 pointer-events-none opacity-[0.02]" style={{ backgroundImage: "linear-gradient(#c9a84c 1px, transparent 1px), linear-gradient(90deg, #c9a84c 1px, transparent 1px)", backgroundSize: "80px 80px" }} />

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[rgba(201,168,76,0.25)] bg-[rgba(201,168,76,0.04)] mb-8">
          <span className="text-[11px] tracking-[0.15em] uppercase text-[#c9a84c]">Built for {data.title}</span>
        </div>

        <h1 className="text-4xl md:text-6xl lg:text-7xl font-light leading-[1.1] tracking-tight max-w-4xl" style={{ fontFamily: "var(--font-display), serif" }}>
          {data.headline.split(" — ")[0]}
          {data.headline.includes(" — ") && (
            <>
              <br />
              <span className="font-semibold italic" style={{ background: "linear-gradient(135deg, #e8c97a 0%, #c9a84c 50%, #8a6e30 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                — {data.headline.split(" — ")[1]}
              </span>
            </>
          )}
        </h1>

        <p className="mt-8 text-[15px] md:text-lg text-[#666] max-w-2xl leading-relaxed tracking-wide">
          {data.subheadline}
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center gap-4">
          <Link href="/login" className="relative px-8 py-3.5 rounded-lg bg-[#c9a84c] text-[#080808] font-semibold text-[14px] tracking-wide hover:bg-[#e8c97a] transition-all duration-300" style={{ boxShadow: "0 8px 32px rgba(201,168,76,0.18)" }}>
            {data.cta}
          </Link>
          <Link href="/" className="text-[13px] text-[#555] hover:text-[#f5f0e8] transition-colors tracking-wide flex items-center gap-2">
            See all features <span className="text-[#8a6e30]">→</span>
          </Link>
        </div>

        {/* Mock search result */}
        <div className="mt-16 w-full max-w-sm mx-auto">
          <div className="rounded-2xl border border-[#1e1e1e] bg-[#0d0d0d] p-5 text-left shadow-2xl">
            <div className="text-[10px] text-[#444] tracking-widest uppercase mb-3">
              ◎ Searching: {data.mockSearch.niche} · {data.mockSearch.location}
            </div>
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-[15px] font-semibold text-[#f5f0e8]">{data.mockSearch.result}</p>
                <p className="text-[11px] text-[#444] mt-0.5">📍 {data.mockSearch.location}</p>
              </div>
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg text-[#4ade80]" style={{ background: "#4ade8012", border: "1px solid #4ade8030" }}>
                Strong Lead
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="text-[#555]">Score</span>
                  <span className="text-[#c9a84c] font-bold">{data.mockSearch.score}</span>
                </div>
                <div className="w-full h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-[#c9a84c]" style={{ width: `${data.mockSearch.score}%` }} />
                </div>
                <p className="text-[10px] text-[#555] mt-1">
                  {data.mockSearch.gap === "CONVERSION" ? "No booking flow" : "Low digital presence"}
                </p>
              </div>
              <div>
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="text-[#555]">Fit</span>
                  <span className="text-[#4ade80] font-bold">89</span>
                </div>
                <div className="w-full h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-[#4ade80]" style={{ width: "89%" }} />
                </div>
              </div>
            </div>
            <div className="rounded-lg p-2.5 flex items-center gap-2" style={{ background: `${data.mockSearch.gapColor}08`, border: `1px solid ${data.mockSearch.gapColor}20` }}>
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: data.mockSearch.gapColor }}>⬡ {data.mockSearch.gap} GAP</span>
            </div>
          </div>
        </div>
      </section>

      {/* PAIN POINTS */}
      <section className="border-t border-[#141414] bg-[#0a0a0a] py-20 px-6">
        <div className="max-w-3xl mx-auto">
          <p className="text-[11px] tracking-[0.2em] uppercase text-[#555] mb-8 text-center">The problem with how most {data.title.toLowerCase()} find clients</p>
          <div className="space-y-3">
            {data.painPoints.map((p, i) => (
              <div key={i} className="flex items-start gap-3 rounded-xl border border-[#1a1a1a] bg-[#0d0d0d] px-4 py-3">
                <span className="text-[#333] mt-0.5 flex-shrink-0">✕</span>
                <p className="text-[14px] text-[#666] leading-relaxed">{p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BENEFITS */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <p className="text-[11px] tracking-[0.2em] uppercase text-[#555] mb-3 text-center">How LeadGenOS fixes it</p>
          <h2 className="text-3xl md:text-4xl font-light text-center mb-12" style={{ fontFamily: "var(--font-display), serif" }}>
            Built for how {data.title.toLowerCase()} actually sell.
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {data.benefits.map((b) => (
              <div key={b.title} className="rounded-2xl border border-[#1a1a1a] bg-[#0d0d0d] p-6 space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-[#c9a84c] text-xl">{b.icon}</span>
                  <h3 className="text-[15px] font-semibold text-[#f5f0e8]">{b.title}</h3>
                </div>
                <p className="text-[13px] text-[#666] leading-relaxed">{b.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* OTHER ROLES */}
      <section className="border-t border-[#141414] bg-[#0a0a0a] py-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-[11px] tracking-[0.2em] uppercase text-[#555] mb-6">Also built for</p>
          <div className="flex flex-wrap justify-center gap-2">
            {Object.values(ROLES)
              .filter((r) => r.slug !== data.slug)
              .map((r) => (
                <Link
                  key={r.slug}
                  href={`/for/${r.slug}`}
                  className="text-[13px] px-4 py-2 rounded-lg border border-[#252525] text-[#555] hover:border-[rgba(201,168,76,0.3)] hover:text-[#c9a84c] transition-all"
                >
                  {r.title}
                </Link>
              ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 text-center">
        <div className="max-w-xl mx-auto space-y-6">
          <h2 className="text-3xl md:text-4xl font-light" style={{ fontFamily: "var(--font-display), serif" }}>
            Ready to find your next client?
          </h2>
          <p className="text-[#555] text-[14px] leading-relaxed">
            LeadGenOS is in closed beta. Request early access and start prospecting smarter.
          </p>
          <Link href="/login" className="inline-block px-10 py-4 rounded-xl bg-[#c9a84c] text-[#080808] font-semibold text-[14px] tracking-wide hover:bg-[#e8c97a] transition-all duration-300" style={{ boxShadow: "0 8px 32px rgba(201,168,76,0.18)" }}>
            {data.cta} →
          </Link>
        </div>
      </section>

    </div>
  );
}
