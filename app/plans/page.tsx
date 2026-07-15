"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import HamburgerMenu from "../components/HamburgerMenu";

// ── Types ─────────────────────────────────────────────────────────────────────

type Currency = "eur" | "usd" | "sek" | "gbp";
type Period = "monthly" | "quarterly" | "yearly";
type PlanKey = "scout" | "operator" | "agency";

// ── Pricing ───────────────────────────────────────────────────────────────────
// Base prices in EUR monthly. Other currencies derived via multiplier.
// Quarterly = 10% off, Yearly = 25% off.

const BASE_PRICES: Record<PlanKey, number> = {
  scout: 29,
  operator: 89,
  agency: 229,
};

const CURRENCY_MULTIPLIERS: Record<Currency, number> = {
  eur: 1,
  usd: 1.08,
  sek: 11.5,
  gbp: 0.86,
};

const CURRENCY_SYMBOLS: Record<Currency, string> = {
  eur: "€",
  usd: "$",
  sek: "kr",
  gbp: "£",
};

const PERIOD_DISCOUNT: Record<Period, number> = {
  monthly: 0,
  quarterly: 0.1,
  yearly: 0.25,
};

const PERIOD_MONTHS: Record<Period, number> = {
  monthly: 1,
  quarterly: 3,
  yearly: 12,
};

function getPrice(plan: PlanKey, period: Period, currency: Currency): number {
  const base = BASE_PRICES[plan];
  const discount = 1 - PERIOD_DISCOUNT[period];
  const months = PERIOD_MONTHS[period];
  const converted = base * discount * CURRENCY_MULTIPLIERS[currency];
  // Return total for the period
  return Math.round(converted * months);
}

function getMonthlyEquivalent(plan: PlanKey, period: Period, currency: Currency): number {
  const base = BASE_PRICES[plan];
  const discount = 1 - PERIOD_DISCOUNT[period];
  const converted = base * discount * CURRENCY_MULTIPLIERS[currency];
  return Math.round(converted);
}

function formatPrice(amount: number, currency: Currency): string {
  const sym = CURRENCY_SYMBOLS[currency];
  if (currency === "sek") return `${amount.toLocaleString()} ${sym}`;
  return `${sym}${amount.toLocaleString()}`;
}

// ── Detect user currency from locale ─────────────────────────────────────────

function detectCurrency(): Currency {
  if (typeof navigator === "undefined") return "eur";
  const lang = navigator.language ?? "";
  if (lang.startsWith("sv")) return "sek";
  if (lang.startsWith("en-GB")) return "gbp";
  if (lang.startsWith("en-US") || lang.startsWith("en-CA")) return "usd";
  return "eur";
}

// ── Plan definitions ──────────────────────────────────────────────────────────

const PLANS: {
  key: PlanKey;
  name: string;
  highlight: boolean;
  badge: string | null;
  description: string;
  features: { text: string; note: string | null }[];
  lockedFeatures: string[];
  trial: boolean;
}[] = [
  {
    key: "scout",
    name: "Scout",
    highlight: false,
    badge: null,
    description:
      "Find and evaluate leads using signal-driven intelligence. Know who to contact before you pick up the phone.",
    features: [
      { text: "50 lead searches / month", note: null },
      { text: "Opportunity, Risk & Fit scoring", note: "Know exactly why each lead scored high or low" },
      {
        text: "Gap type detection",
        note: "Each lead is classified — Visibility, Conversion, Infrastructure, or Optimization",
      },
      { text: "Lead detail panel", note: "Deep-dive into signals, ratings, social presence, and website data" },
      { text: "Outcome tracking", note: "Track where every lead sits in your pipeline" },
      { text: "Saved leads & notes", note: null },
      { text: "Follow-up queue", note: null },
      { text: "CSV export", note: null },
    ],
    lockedFeatures: [
      "AI outreach generator",
      "In-platform email sending",
      "Website signal deep scan",
      "Profile analytics & revenue tracking",
    ],
    trial: false,
  },
  {
    key: "operator",
    name: "Operator",
    highlight: true,
    badge: "Most Popular",
    description: "Everything in Scout, plus the tools to act on your leads — without switching to another platform.",
    features: [
      { text: "Everything in Scout", note: null },
      { text: "Unlimited lead searches", note: null },
      { text: "10 deep searches / month", note: "AI-generated query variants for broader coverage" },
      {
        text: "AI outreach generator",
        note: "Signal-driven first-touch messages for email, LinkedIn DM, or cold call",
      },
      { text: "Channel recommendation", note: "Vantio tells you which channel to use based on each lead's signals" },
      { text: "Multi-step sequence builder", note: "Generate a full follow-up cadence anchored to your first message" },
      { text: "200 AI messages / month", note: "Outreach + sequences share one credit pool" },
      { text: "Send outreach directly", note: "Send emails from within Vantio and log them automatically" },
      { text: "Website deep scan", note: "50 scans/month — booking flows, mobile friendliness, SEO signals" },
      { text: "Profile analytics", note: "Reply rates, booking rates, close rates, and revenue across your pipeline" },
    ],
    lockedFeatures: ["Team members", "Unlimited deep scans"],
    trial: true, // 7-day free trial
  },
  {
    key: "agency",
    name: "Agency",
    highlight: false,
    badge: "Best Value / Seat",
    description: "Built for teams running outreach for multiple clients across multiple niches at the same time.",
    features: [
      { text: "Everything in Operator", note: null },
      { text: "Unlimited deep searches", note: null },
      { text: "Unlimited AI messages", note: null },
      { text: "Up to 5 team members", note: "Each with their own profile, scoring, and outreach history" },
      { text: "Unlimited website deep scans", note: null },
      { text: "Bulk lead actions", note: "Mark, export, or move multiple leads in one action" },
      { text: "Competitor density signals", note: "See how saturated a market is before you pitch" },
      { text: "CSV import", note: "Score your own prospect lists with Vantio's signal engine" },
      { text: "Priority email support", note: "Response within 24 hours" },
    ],
    lockedFeatures: [],
    trial: false,
  },
];

const FAQ = [
  {
    q: "What are the four gap types?",
    a: "Vantio classifies every lead into one of four gap types. Visibility Gap — demand exists but they're not capturing it. Conversion Gap — traffic exists but leaks before becoming bookings. Infrastructure Gap — no digital foundation. Optimization Gap — strong base with clear room to sharpen. The gap type tells you exactly what angle to use in your outreach.",
  },
  {
    q: "Is there a free trial?",
    a: "Operator includes a 7-day free trial — no card charged until day 8. You get full Operator access during the trial. Cancel any time before day 8 and you won't be charged.",
  },
  {
    q: "What's the difference between monthly, quarterly, and yearly?",
    a: "All three give you the same features. Quarterly saves you 10% and yearly saves you 25%. The discount is applied to the monthly rate and billed as a single payment for the period.",
  },
  {
    q: "Can I switch plans later?",
    a: "Yes. Upgrades apply immediately. Downgrades take effect at the end of your current billing period. No lock-in.",
  },
  {
    q: "What counts as a 'lead search'?",
    a: "One search = one niche + location query (e.g. 'barber shops in Malmö'). Each search returns up to 25+ scored leads. Paginating through the same search doesn't use a new credit.",
  },
  {
    q: "What is a deep search?",
    a: "Deep search uses AI to generate tailored query variants for your niche — local language synonyms, district searches, alternative terms — then fires them all through multiple data sources. You get broader coverage than a standard search.",
  },
  {
    q: "Who is Agency for?",
    a: "Teams. Freelancers who bring in colleagues, small agencies managing client prospecting across multiple niches, or anyone who needs more than one person working the same pipeline.",
  },
  {
    q: "What currency will I be charged in?",
    a: "We automatically detect your currency based on your location. You can change it manually at any time using the currency selector on this page. You're always charged in the currency shown.",
  },
];

const CURRENCIES: { value: Currency; label: string }[] = [
  { value: "eur", label: "EUR €" },
  { value: "usd", label: "USD $" },
  { value: "sek", label: "SEK kr" },
  { value: "gbp", label: "GBP £" },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PlansPage() {
  const router = useRouter();
  const [period, setPeriod] = useState<Period>("monthly");
  const [currency, setCurrency] = useState<Currency>("eur");
  const [loading, setLoading] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    setCurrency(detectCurrency());
  }, []);

  async function handleCheckout(plan: PlanKey) {
    setLoading(plan);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, period, currency }),
      });

      if (res.status === 401) {
        // Not logged in — redirect to login then back to plans
        router.push(`/login?redirect=/plans`);
        return;
      }

      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error("Checkout error:", data.error);
        alert("Something went wrong. Please try again.");
      }
    } catch (err) {
      console.error("Checkout error:", err);
      alert("Something went wrong. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#080808] text-[#f5f0e8]">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 md:px-12 py-5 border-b border-[#151515]">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-[#c9a84c]">◈</span>
          <span className="text-lg font-light tracking-wide" style={{ fontFamily: "var(--font-display), serif" }}>
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
          </span>
        </Link>
        <HamburgerMenu hasProfile={false} />
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-20">
        {/* Header */}
        <div className="text-center mb-12">
          <p className="text-[11px] tracking-[0.2em] uppercase text-[#8a6e30] mb-4">Pricing</p>
          <h1 className="text-4xl md:text-6xl font-light mb-4" style={{ fontFamily: "var(--font-display), serif" }}>
            Simple,{" "}
            <span
              className="italic"
              style={{
                background: "linear-gradient(135deg, #e8c97a 0%, #c9a84c 50%, #8a6e30 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}>
              transparent.
            </span>
          </h1>
          <p className="text-[14px] text-[#555] max-w-lg mx-auto leading-relaxed mb-8">
            Beta pricing locked in for 12 months from your signup date.
          </p>

          {/* Billing period + currency controls */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {/* Period toggle */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-[#0d0d0d] border border-[#1a1a1a]">
              {(["monthly", "quarterly", "yearly"] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className="relative px-4 py-2 rounded-lg text-[11px] font-medium transition-all capitalize"
                  style={{
                    background: period === p ? "#1a1a1a" : "transparent",
                    color: period === p ? "#f5f0e8" : "#616161",
                    border: period === p ? "1px solid #2a2a2a" : "1px solid transparent",
                  }}>
                  {p}
                  {p === "quarterly" && (
                    <span className="absolute -top-2 -right-1 text-[8px] bg-[#c9a84c] text-[#080808] px-1 rounded font-bold">
                      -10%
                    </span>
                  )}
                  {p === "yearly" && (
                    <span className="absolute -top-2 -right-1 text-[8px] bg-[#4ade80] text-[#080808] px-1 rounded font-bold">
                      -25%
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Currency selector */}
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as Currency)}
              className="px-3 py-2 rounded-lg text-[11px] bg-[#0d0d0d] border border-[#1a1a1a] text-[#888] focus:outline-none focus:border-[rgba(201,168,76,0.3)] transition-colors cursor-pointer">
              {CURRENCIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Plans grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {PLANS.map((plan) => {
            const total = getPrice(plan.key, period, currency);
            const monthly = getMonthlyEquivalent(plan.key, period, currency);
            const isLoading = loading === plan.key;

            return (
              <div
                key={plan.key}
                className={`relative rounded-2xl border p-7 flex flex-col transition-all duration-300 ${
                  plan.highlight
                    ? "border-[rgba(201,168,76,0.4)] bg-[#0f0f0f]"
                    : "border-[#181818] bg-[#0a0a0a] hover:border-[#252525]"
                }`}>
                {plan.highlight && (
                  <div className="absolute top-0 left-8 right-8 h-[1px] bg-gradient-to-r from-transparent via-[#c9a84c] to-transparent" />
                )}
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span
                      className="text-[10px] tracking-[0.15em] uppercase px-3 py-1 rounded-full font-bold"
                      style={{
                        background: plan.key === "agency" ? "#1a1a1a" : "#c9a84c",
                        color: plan.key === "agency" ? "#c9a84c" : "#080808",
                        border: plan.key === "agency" ? "1px solid rgba(201,168,76,0.3)" : "none",
                      }}>
                      {plan.badge}
                    </span>
                  </div>
                )}

                {/* Header */}
                <div className="mb-6">
                  <p className="text-[10px] tracking-[0.2em] uppercase text-[#8a6e30] mb-3">{plan.name}</p>
                  <div className="flex items-baseline gap-1.5 mb-0.5">
                    <span
                      className="text-4xl font-light"
                      style={{
                        fontFamily: "var(--font-display), serif",
                        color: plan.highlight ? "#c9a84c" : "#f5f0e8",
                      }}>
                      {formatPrice(total, currency)}
                    </span>
                    <span className="text-[13px] text-[#555]">
                      {period === "monthly" ? "/ mo" : period === "quarterly" ? "/ qtr" : "/ yr"}
                    </span>
                  </div>
                  {period !== "monthly" && (
                    <p className="text-[11px] text-[#555]">
                      {formatPrice(monthly, currency)}/mo · {PERIOD_DISCOUNT[period] * 100}% off
                    </p>
                  )}
                  <p className="text-[11px] text-[#333] mb-3 mt-1">Beta pricing · locked in for 12 months</p>
                  {plan.trial && (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[rgba(74,222,128,0.08)] border border-[rgba(74,222,128,0.2)] mb-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#4ade80]" />
                      <span className="text-[10px] text-[#4ade80] font-medium">
                        7-day free trial · no card until day 8
                      </span>
                    </div>
                  )}
                  <p className="text-[12px] text-[#555] leading-relaxed mt-2">{plan.description}</p>
                </div>

                {/* Features */}
                <ul className="space-y-3 flex-1 mb-8">
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-2.5">
                      <span className="text-[#8a6e30] mt-0.5 shrink-0 text-[10px]">✦</span>
                      <div>
                        <p className="text-[12px] text-[#888]">{f.text}</p>
                        {f.note && <p className="text-[10px] text-[#555] mt-0.5 leading-relaxed">{f.note}</p>}
                      </div>
                    </li>
                  ))}
                  {plan.lockedFeatures.map((f, j) => (
                    <li key={`locked-${j}`} className="flex items-start gap-2.5 opacity-35">
                      <span className="text-[#444] mt-0.5 shrink-0 text-[10px]">✦</span>
                      <p className="text-[12px] text-[#444] line-through">{f}</p>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <button
                  onClick={() => handleCheckout(plan.key)}
                  disabled={isLoading}
                  className={`w-full text-center py-3 rounded-xl text-[13px] font-semibold tracking-wide transition-all ${
                    plan.highlight
                      ? "bg-[#c9a84c] text-[#080808] hover:bg-[#e8c97a] disabled:opacity-60"
                      : "border border-[#252525] text-[#888] hover:border-[#3a3a3a] hover:text-[#f5f0e8] disabled:opacity-60"
                  }`}>
                  {isLoading ? "Loading…" : plan.trial ? "Start Free Trial →" : "Get Started →"}
                </button>
              </div>
            );
          })}
        </div>

        {/* Trust line */}
        <p className="text-center text-[11px] text-[#333] mb-16">
          Secure payment via Stripe · Cancel any time · Beta price locked for 12 months
        </p>

        {/* How it works + FAQ */}
        <div className="border-t border-[#111] pt-16 space-y-16">
          <div>
            <div className="text-center mb-10">
              <p className="text-[11px] tracking-[0.2em] uppercase text-[#8a6e30] mb-3">The process</p>
              <h2 className="text-3xl font-light" style={{ fontFamily: "var(--font-display), serif" }}>
                How Vantio works
              </h2>
              <p className="text-[#555] text-sm mt-3 max-w-lg mx-auto">
                Signal-driven outreach in three steps. No cold list buying, no guesswork.
              </p>
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

          <div>
            <div className="text-center mb-10">
              <p className="text-[11px] tracking-[0.2em] uppercase text-[#8a6e30] mb-3">Common questions</p>
              <h2 className="text-3xl font-light" style={{ fontFamily: "var(--font-display), serif" }}>
                Questions & answers
              </h2>
            </div>
            <div className="max-w-2xl mx-auto space-y-2">
              {FAQ.map((item, i) => (
                <div key={i} className="border border-[#141414] rounded-xl overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between px-5 py-4 text-left text-[13px] text-[#ccc] hover:text-[#f5f0e8] transition-colors"
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                    <span>{item.q}</span>
                    <span
                      className="text-[#555] ml-4 shrink-0 text-lg transition-transform"
                      style={{ transform: openFaq === i ? "rotate(45deg)" : "none" }}>
                      +
                    </span>
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
