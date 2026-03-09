"use client";

import Link from "next/link";
import HamburgerMenu from "../components/HamburgerMenu";

const PLANS = [
  {
    name: "Starter",
    price: "—",
    period: "Free during beta",
    description: "Get started and explore the platform. No payment required.",
    highlight: false,
    features: [
      "Up to 25 lead searches per month",
      "Basic scoring (opportunity + risk)",
      "1 profile type",
      "Outreach scripts",
      "Outcome tracking",
    ],
    cta: "Start for Free",
    href: "/onboarding",
  },
  {
    name: "Pro",
    price: "Coming soon",
    period: "per month",
    description: "For active service providers running outreach every week.",
    highlight: true,
    features: [
      "Unlimited lead searches",
      "Full signal-driven scoring",
      "Light enrichment on every lead",
      "All 5 profile types",
      "Priority lead matching",
      "Pipeline analytics",
      "Export to CSV",
    ],
    cta: "Join Waitlist",
    href: "/onboarding",
  },
  {
    name: "Agency",
    price: "Coming soon",
    period: "per month",
    description: "For teams and agencies running multiple outreach campaigns.",
    highlight: false,
    features: [
      "Everything in Pro",
      "Multiple team members",
      "Deep enrichment (competitor analysis)",
      "Custom outreach playbooks",
      "CRM integrations",
      "Dedicated support",
    ],
    cta: "Contact Us",
    href: "mailto:hello@leadgenos.com",
  },
];

export default function PlansPage() {
  return (
    <div className="min-h-screen bg-[#080808] text-[#f5f0e8]">

      {/* Nav */}
      <nav className="flex items-center justify-between px-6 md:px-12 py-5 border-b border-[#252525]">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-[#c9a84c]">◈</span>
          <span className="text-lg font-light tracking-wide" style={{ fontFamily: "var(--font-display), serif" }}>LeadGenOS</span>
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
          <p className="text-[14px] text-[#666] max-w-lg mx-auto leading-relaxed">
            All plans include full access during the beta period. Pricing will be confirmed before public launch.
          </p>
        </div>

        {/* Plans grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map((plan, i) => (
            <div
              key={i}
              className={`relative rounded-2xl border p-7 flex flex-col ${
                plan.highlight
                  ? "border-[rgba(201,168,76,0.5)] bg-[#111]"
                  : "border-[#252525] bg-[#0d0d0d]"
              }`}
            >
              {/* Gold top line for highlight */}
              {plan.highlight && (
                <div className="absolute top-0 left-8 right-8 h-[2px] bg-gradient-to-r from-transparent via-[#c9a84c] to-transparent rounded-full" />
              )}

              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="text-[10px] tracking-[0.15em] uppercase px-3 py-1 rounded-full bg-[#c9a84c] text-[#080808] font-semibold">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="mb-6">
                <p className="text-[11px] tracking-[0.2em] uppercase text-[#8a6e30] mb-2">{plan.name}</p>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-3xl font-light" style={{ fontFamily: "var(--font-display), serif", color: plan.highlight ? "#c9a84c" : "#f5f0e8" }}>
                    {plan.price}
                  </span>
                  {plan.price !== "—" && (
                    <span className="text-[12px] text-[#555]">{plan.period}</span>
                  )}
                </div>
                {plan.price === "—" && (
                  <p className="text-[12px] text-[#555]">{plan.period}</p>
                )}
                <p className="text-[12px] text-[#666] leading-relaxed mt-2">{plan.description}</p>
              </div>

              <ul className="space-y-2.5 flex-1 mb-8">
                {plan.features.map((f, j) => (
                  <li key={j} className="flex items-start gap-2 text-[12px] text-[#888]">
                    <span className="text-[#8a6e30] mt-0.5 shrink-0">✦</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <Link
                href={plan.href}
                className={`w-full text-center py-3 rounded-lg text-[13px] font-semibold tracking-wide transition-all ${
                  plan.highlight
                    ? "bg-[#c9a84c] text-[#080808] hover:bg-[#e8c97a]"
                    : "border border-[#252525] text-[#888] hover:border-[#444] hover:text-[#f5f0e8]"
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        {/* FAQ note */}
        <div className="mt-16 text-center border-t border-[#252525] pt-12">
          <p className="text-[13px] text-[#555] leading-relaxed">
            Questions about plans?{" "}
            <a href="mailto:hello@leadgenos.com" className="text-[#c9a84c] hover:text-[#e8c97a] transition-colors">
              Get in touch →
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
