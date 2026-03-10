"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  PROFILE_TYPE_DEFINITIONS,
  PROFILE_TYPE_KEYS,
  type ProfileTypeKey,
} from "@/lib/profile/profileTypes";
import type { Capability } from "@/lib/fit/needs";
import { createSupabaseBrowser } from "@/lib/supabaseBrowser";

const ALL_CAPABILITIES: Capability[] = [
  "ads",
  "tracking",
  "funnel",
  "content",
  "website",
  "seo",
  "crm",
];

const CAPABILITY_LABELS: Record<Capability, string> = {
  ads: "Paid Ads",
  tracking: "Analytics & Tracking",
  funnel: "Funnel Building",
  content: "Content Creation",
  website: "Website / Landing Pages",
  seo: "SEO",
  crm: "CRM / Follow-up",
};

const CAPABILITY_ICONS: Record<Capability, string> = {
  ads: "📢",
  tracking: "📊",
  funnel: "🔻",
  content: "✍️",
  website: "🌐",
  seo: "🔍",
  crm: "🤝",
};

const STEPS = ["Service Type", "Capabilities", "Preferences", "Done"];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);

  // Guard: if somehow middleware is bypassed, redirect to login
  useEffect(() => {
    const supabase = createSupabaseBrowser();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace("/login?next=/onboarding");
      } else {
        setSessionChecked(true);
      }
    });
  }, [router]);

  const [profileType, setProfileType] = useState<ProfileTypeKey>(
    "performance_marketer",
  );
  const [businessName, setBusinessName] = useState("");
  const [capabilities, setCapabilities] = useState<Record<Capability, boolean>>(
    PROFILE_TYPE_DEFINITIONS["performance_marketer"].defaultCapabilities,
  );
  const [experienceLevel, setExperienceLevel] = useState<
    "beginner" | "intermediate" | "advanced"
  >("intermediate");
  const [acquisitionStyle, setAcquisitionStyle] = useState<
    "aggressive" | "balanced" | "premium"
  >("balanced");
  const [targetBusinessSize, setTargetBusinessSize] = useState<
    "small" | "medium" | "large"
  >("small");
  const [targetLocation, setTargetLocation] = useState("");

  function handleProfileTypeChange(key: ProfileTypeKey) {
    setProfileType(key);
    setCapabilities({ ...PROFILE_TYPE_DEFINITIONS[key].defaultCapabilities });
  }

  async function handleFinish() {
    setSaving(true);
    try {
      await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileType,
          businessName,
          experienceLevel,
          targetBusinessSize,
          acquisitionStyle,
          budgetPreference: "medium",
          targetLocation,
          capabilities,
        }),
      });
      setStep(3);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  // Show nothing while verifying session to avoid flash of content
  if (!sessionChecked) {
    return (
      <div className="min-h-screen bg-[#080808] flex items-center justify-center">
        <div className="w-5 h-5 rounded-full border-2 border-[#c9a84c] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080808] text-[#f5f0e8] flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 md:px-12 py-5 border-b border-[#252525]">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-[#c9a84c]">◈</span>
          <span
            className="text-lg font-light tracking-wide"
            style={{ fontFamily: "var(--font-display), serif" }}
          >
            LeadGenOS
          </span>
        </Link>
        <p className="text-[12px] text-[#444] tracking-wide">
          Step {step + 1} of {STEPS.length}
        </p>
      </div>

      {/* Progress bar */}
      <div className="h-[2px] bg-[#1a1a1a]">
        <div
          className="h-full bg-gradient-to-r from-[#8a6e30] to-[#c9a84c] transition-all duration-500"
          style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
        />
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-2xl">
          {/* Step labels */}
          <div className="flex items-center gap-2 mb-10 justify-center">
            {STEPS.map((label, i) => (
              <div key={i} className="flex items-center gap-2">
                <div
                  className={`flex items-center gap-1.5 text-[11px] tracking-wide uppercase transition-colors ${i === step ? "text-[#c9a84c]" : i < step ? "text-[#8a6e30]" : "text-[#333]"}`}
                >
                  <span
                    className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] ${i === step ? "border-[#c9a84c] text-[#c9a84c]" : i < step ? "border-[#8a6e30] bg-[#8a6e30] text-[#080808]" : "border-[#333] text-[#333]"}`}
                  >
                    {i < step ? "✓" : i + 1}
                  </span>
                  <span className="hidden md:block">{label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={`w-8 h-[1px] ${i < step ? "bg-[#8a6e30]" : "bg-[#252525]"}`}
                  />
                )}
              </div>
            ))}
          </div>

          {/* ── STEP 0: Service Type ── */}
          {step === 0 && (
            <div className="space-y-6 animate-fade-up">
              <div>
                <h1
                  className="text-3xl md:text-4xl font-light mb-2"
                  style={{ fontFamily: "var(--font-display), serif" }}
                >
                  What do you{" "}
                  <span className="italic" style={{ color: "#c9a84c" }}>
                    offer?
                  </span>
                </h1>
                <p className="text-[13px] text-[#666]">
                  Choose the option that best describes your service. This
                  shapes how leads are scored for you.
                </p>
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-widest text-[#666] mb-2">
                  Your business or agency name
                </label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g. Spark Agency"
                  className="w-full bg-[#111] border border-[#252525] rounded-lg px-4 py-3 text-sm text-[#f5f0e8] placeholder-[#333] focus:outline-none focus:border-[rgba(201,168,76,0.5)] transition-colors"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {PROFILE_TYPE_KEYS.map((key: ProfileTypeKey) => {
                  const def = PROFILE_TYPE_DEFINITIONS[key];
                  const active = profileType === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleProfileTypeChange(key)}
                      className={`text-left p-4 rounded-xl border transition-all duration-200 ${active ? "border-[#c9a84c] bg-[rgba(201,168,76,0.05)]" : "border-[#252525] bg-[#111] hover:border-[#444]"}`}
                    >
                      <p className="text-sm font-medium mb-1">{def.label}</p>
                      <p className="text-[11px] text-[#666] leading-relaxed">
                        {def.description}
                      </p>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-full py-3.5 rounded-lg bg-[#c9a84c] text-[#080808] font-semibold text-[14px] tracking-wide hover:bg-[#e8c97a] transition-colors"
              >
                Continue →
              </button>
            </div>
          )}

          {/* ── STEP 1: Capabilities ── */}
          {step === 1 && (
            <div className="space-y-6 animate-fade-up">
              <div>
                <h1
                  className="text-3xl md:text-4xl font-light mb-2"
                  style={{ fontFamily: "var(--font-display), serif" }}
                >
                  What can you{" "}
                  <span className="italic" style={{ color: "#c9a84c" }}>
                    actually deliver?
                  </span>
                </h1>
                <p className="text-[13px] text-[#666]">
                  Toggle what you offer. Only leads where your capabilities
                  match their needs will score highly.
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {ALL_CAPABILITIES.map((cap) => {
                  const active = !!capabilities[cap];
                  return (
                    <button
                      key={cap}
                      type="button"
                      onClick={() =>
                        setCapabilities((c: Record<Capability, boolean>) => ({
                          ...c,
                          [cap]: !c[cap],
                        }))
                      }
                      className={`flex items-center gap-2 px-3 py-3 rounded-lg border text-[12px] font-medium transition-all ${active ? "border-[#4ade80] bg-[rgba(74,222,128,0.05)] text-[#4ade80]" : "border-[#252525] bg-[#111] text-[#555] hover:border-[#444]"}`}
                    >
                      <span>{CAPABILITY_ICONS[cap]}</span>
                      <span>{CAPABILITY_LABELS[cap]}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(0)}
                  className="flex-1 py-3 rounded-lg border border-[#252525] text-[#666] text-sm hover:border-[#444] transition-colors"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="flex-[2] py-3 rounded-lg bg-[#c9a84c] text-[#080808] font-semibold text-[14px] hover:bg-[#e8c97a] transition-colors"
                >
                  Continue →
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 2: Preferences ── */}
          {step === 2 && (
            <div className="space-y-6 animate-fade-up">
              <div>
                <h1
                  className="text-3xl md:text-4xl font-light mb-2"
                  style={{ fontFamily: "var(--font-display), serif" }}
                >
                  How do you{" "}
                  <span className="italic" style={{ color: "#c9a84c" }}>
                    work?
                  </span>
                </h1>
                <p className="text-[13px] text-[#666]">
                  These preferences shape how leads are ranked and how outreach
                  scripts are generated.
                </p>
              </div>

              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[11px] uppercase tracking-widest text-[#666]">
                    Experience Level
                  </label>
                  <div className="flex gap-2">
                    {(["beginner", "intermediate", "advanced"] as const).map(
                      (v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setExperienceLevel(v)}
                          className={`flex-1 py-2.5 rounded-lg border text-[12px] capitalize transition-colors ${experienceLevel === v ? "border-[#c9a84c] bg-[rgba(201,168,76,0.08)] text-[#c9a84c]" : "border-[#252525] text-[#555] hover:border-[#444]"}`}
                        >
                          {v}
                        </button>
                      ),
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] uppercase tracking-widest text-[#666]">
                    Acquisition Style
                  </label>
                  <div className="flex gap-2">
                    {(["aggressive", "balanced", "premium"] as const).map(
                      (v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setAcquisitionStyle(v)}
                          className={`flex-1 py-2.5 rounded-lg border text-[12px] capitalize transition-colors ${acquisitionStyle === v ? "border-[#c9a84c] bg-[rgba(201,168,76,0.08)] text-[#c9a84c]" : "border-[#252525] text-[#555] hover:border-[#444]"}`}
                        >
                          {v}
                        </button>
                      ),
                    )}
                  </div>
                  <p className="text-[11px] text-[#444]">
                    {acquisitionStyle === "aggressive"
                      ? "Higher tolerance for imperfect leads — cast wide."
                      : acquisitionStyle === "premium"
                        ? "Stricter qualification — only high-readiness leads."
                        : "Balanced scoring — best for most service providers."}
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] uppercase tracking-widest text-[#666]">
                    Target Geography
                  </label>
                  <input
                    type="text"
                    value={targetLocation}
                    onChange={(e) => setTargetLocation(e.target.value)}
                    placeholder="e.g. Stockholm, London, New York"
                    className="w-full bg-[#111] border border-[#252525] rounded-lg px-4 py-2.5 text-sm text-[#f5f0e8] placeholder-[#333] focus:outline-none focus:border-[rgba(201,168,76,0.5)] transition-colors"
                  />
                  <p className="text-[11px] text-[#444]">
                    Pre-fills your location filter. Leave blank to search anywhere.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] uppercase tracking-widest text-[#666]">
                    Target Business Size
                  </label>
                  <div className="flex gap-2">
                    {(["small", "medium", "large"] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setTargetBusinessSize(v)}
                        className={`flex-1 py-2.5 rounded-lg border text-[12px] capitalize transition-colors ${targetBusinessSize === v ? "border-[#c9a84c] bg-[rgba(201,168,76,0.08)] text-[#c9a84c]" : "border-[#252525] text-[#555] hover:border-[#444]"}`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 py-3 rounded-lg border border-[#252525] text-[#666] text-sm hover:border-[#444] transition-colors"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={handleFinish}
                  disabled={saving}
                  className="flex-[2] py-3 rounded-lg bg-[#c9a84c] text-[#080808] font-semibold text-[14px] hover:bg-[#e8c97a] disabled:opacity-50 transition-colors"
                >
                  {saving ? "Saving…" : "Create My Profile →"}
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Done ── */}
          {step === 3 && (
            <div className="text-center space-y-6 animate-fade-up">
              <div className="w-16 h-16 rounded-full border border-[#c9a84c] bg-[rgba(201,168,76,0.08)] flex items-center justify-center mx-auto text-2xl">
                ✦
              </div>
              <div>
                <h1
                  className="text-3xl md:text-4xl font-light mb-3"
                  style={{ fontFamily: "var(--font-display), serif" }}
                >
                  Profile{" "}
                  <span className="italic" style={{ color: "#c9a84c" }}>
                    created.
                  </span>
                </h1>
                <p className="text-[14px] text-[#666] max-w-md mx-auto leading-relaxed">
                  Your profile is saved. Every lead search will now be scored
                  and matched against your specific capabilities and style.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  type="button"
                  onClick={() => router.push("/dashboard")}
                  className="px-8 py-3.5 rounded-lg bg-[#c9a84c] text-[#080808] font-semibold text-[14px] hover:bg-[#e8c97a] transition-colors"
                >
                  Go to Dashboard →
                </button>
                <Link
                  href="/plans"
                  className="px-8 py-3.5 rounded-lg border border-[rgba(201,168,76,0.3)] text-[#c9a84c] text-[14px] hover:bg-[rgba(201,168,76,0.05)] transition-colors"
                >
                  View Plans
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
