"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PROFILE_TYPE_DEFINITIONS, PROFILE_TYPE_KEYS, type ProfileTypeKey } from "@/lib/profile/profileTypes";
import type { Capability } from "@/lib/fit/needs";
import { createSupabaseBrowser } from "@/lib/supabaseBrowser";
import { getTranslations } from "@/lib/i18n";
import { getStoredLanguage, setStoredLanguage } from "@/lib/languagePreference";
import LanguageToggle from "@/app/components/LanguageToggle";
import type { Language } from "@/lib/i18n/types";

const ALL_CAPABILITIES: Capability[] = ["ads", "tracking", "funnel", "content", "website", "seo", "crm"];

const CAPABILITY_ICONS: Record<Capability, string> = {
  ads: "📢",
  tracking: "📊",
  funnel: "🔻",
  content: "✍️",
  website: "🌐",
  seo: "🔍",
  crm: "🤝",
};

const PROFILE_TYPE_ICONS: Record<string, string> = {
  performance_marketer: "📢",
  web_developer: "🌐",
  content_creator: "✍️",
  seo_specialist: "🔍",
  full_service_agency: "◈",
};

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [language, setLanguageState] = useState<Language>(() => getStoredLanguage());
  function setLanguage(l: Language) {
    setLanguageState(l);
    setStoredLanguage(l);
  }
  const t = getTranslations(language).ui.onboarding;
  // Reused for capability depth-slider labels — already correctly built
  // and translated for profile/settings; no reason to duplicate that
  // content a third time here.
  const tDepth = getTranslations(language).ui.profileSettings.profile;
  const STEPS = t.stepLabels;

  // Guard: if no session → login. If profile already exists → skip to dashboard.
  useEffect(() => {
    const supabase = createSupabaseBrowser();

    // Hard deadline — never wait more than 5s total for session + profile check
    const deadline = setTimeout(() => setSessionChecked(true), 5000);

    supabase.auth
      .getUser()
      .then(async ({ data }) => {
        if (!data.user) {
          clearTimeout(deadline);
          router.replace("/login?next=/onboarding");
          return;
        }
        // Check if user already has a saved profile — if so, skip onboarding
        try {
          const controller = new AbortController();
          const profileTimeout = setTimeout(() => controller.abort(), 3000);
          const res = await fetch("/api/profile", { signal: controller.signal });
          clearTimeout(profileTimeout);
          if (res.ok) {
            const json = await res.json();
            if (json.profile?.businessName) {
              clearTimeout(deadline);
              router.replace("/dashboard");
              return;
            }
          }
        } catch {
          // Timeout or error — show onboarding anyway
        }
        clearTimeout(deadline);
        fetch("/api/analytics/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event: "profile_started" }),
        }).catch(() => {});
        setSessionChecked(true);
      })
      .catch(() => {
        // getUser itself failed — show onboarding as safe fallback
        clearTimeout(deadline);
        setSessionChecked(true);
      });
  }, [router]);

  const [profileType, setProfileType] = useState<ProfileTypeKey>("performance_marketer");
  const [businessName, setBusinessName] = useState("");
  const [capabilities, setCapabilities] = useState<Record<Capability, number>>(
    PROFILE_TYPE_DEFINITIONS["performance_marketer"].defaultCapabilities as Record<Capability, number>,
  );
  const [experienceLevel, setExperienceLevel] = useState<"beginner" | "intermediate" | "advanced">("intermediate");
  const [acquisitionStyle, setAcquisitionStyle] = useState<"volume" | "balanced" | "selective">("balanced");
  const [targetBusinessSize, setTargetBusinessSize] = useState<"small" | "medium" | "large">("small");
  const [targetLocation, setTargetLocation] = useState("");

  function handleProfileTypeChange(key: ProfileTypeKey) {
    setProfileType(key);
    setCapabilities({ ...PROFILE_TYPE_DEFINITIONS[key].defaultCapabilities });
  }

  async function handleFinish() {
    setSaving(true);
    // 8-second timeout — prevents infinite save state if server hangs
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    try {
      await fetch("/api/profile", {
        method: "POST",
        signal: controller.signal,
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
    } catch (err) {
      // Timeout or network error — still advance.
      // Profile can be completed later from /settings.
      console.warn("Profile save failed or timed out:", err);
      setSaveFailed(true);
    } finally {
      clearTimeout(timeoutId);
      setSaving(false);
      // Always advance to the done screen regardless of server response.
      // A failed save is recoverable — getting stuck here is not.
      setStep(3);
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
          <span className="text-lg font-light tracking-wide" style={{ fontFamily: "var(--font-display), serif" }}>
            Vantio
          </span>
        </Link>
        <div className="flex items-center gap-4">
          <p className="text-[12px] text-[#444] tracking-wide">
            {t.stepOf.replace("{current}", String(step + 1)).replace("{total}", String(STEPS.length))}
          </p>
          <LanguageToggle language={language} onChange={setLanguage} />
        </div>
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
          {/* Welcome banner — only on first step */}
          {step === 0 && (
            <div className="rounded-2xl border border-[rgba(201,168,76,0.2)] bg-[rgba(201,168,76,0.04)] px-5 py-4 mb-8 text-center">
              <p className="text-[11px] uppercase tracking-[0.15em] text-[#8a6e30] mb-1">{t.welcomeBadge}</p>
              <p className="text-[13px] text-[#888] leading-relaxed">{t.welcomeBody}</p>
            </div>
          )}

          {/* Step labels */}
          <div className="flex items-center gap-2 mb-10 justify-center">
            {STEPS.map((label, i) => (
              <div key={i} className="flex items-center gap-2">
                <div
                  className={`flex items-center gap-1.5 text-[11px] tracking-wide uppercase transition-colors ${i === step ? "text-[#c9a84c]" : i < step ? "text-[#8a6e30]" : "text-[#333]"}`}>
                  <span
                    className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] ${i === step ? "border-[#c9a84c] text-[#c9a84c]" : i < step ? "border-[#8a6e30] bg-[#8a6e30] text-[#080808]" : "border-[#333] text-[#333]"}`}>
                    {i < step ? "✓" : i + 1}
                  </span>
                  <span className="hidden md:block">{label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`w-8 h-[1px] ${i < step ? "bg-[#8a6e30]" : "bg-[#252525]"}`} />
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
                  style={{ fontFamily: "var(--font-display), serif" }}>
                  {t.step0.headingStart}{" "}
                  <span className="italic" style={{ color: "#c9a84c" }}>
                    {t.step0.headingItalic}
                  </span>
                </h1>
                <p className="text-[13px] text-[#666]">{t.step0.body}</p>
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-widest text-[#666] mb-2">
                  {t.step0.businessNameLabel}
                </label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder={t.step0.businessNamePlaceholder}
                  className="w-full bg-[#111] border border-[#252525] rounded-lg px-4 py-3 text-base sm:text-sm text-[#f5f0e8] placeholder-[#333] focus:outline-none focus:border-[rgba(201,168,76,0.5)] transition-colors"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {PROFILE_TYPE_KEYS.map((key: ProfileTypeKey) => {
                  const def = t.profileTypes[key];
                  const active = profileType === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleProfileTypeChange(key)}
                      className={`text-left p-4 rounded-xl border transition-all duration-200 group ${active ? "border-[#c9a84c] bg-[rgba(201,168,76,0.06)]" : "border-[#252525] bg-[#0d0d0d] hover:border-[#3a3a3a] hover:bg-[#111]"}`}>
                      <div className="flex items-start gap-3">
                        <span
                          className={`text-xl mt-0.5 transition-all ${active ? "scale-110" : "opacity-50 group-hover:opacity-80"}`}>
                          {PROFILE_TYPE_ICONS[key]}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className={`text-[13px] font-semibold ${active ? "text-[#f5f0e8]" : "text-[#888]"}`}>
                              {def.label}
                            </p>
                            {active && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[rgba(201,168,76,0.15)] text-[#c9a84c] uppercase tracking-widest">
                                {t.step0.selectedBadge}
                              </span>
                            )}
                          </div>
                          <p
                            className={`text-[10px] uppercase tracking-widest mb-1.5 ${active ? "text-[#8a6e30]" : "text-[#333]"}`}>
                            {def.tag}
                          </p>
                          <p className="text-[11px] text-[#555] leading-relaxed">{def.description}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {businessName.trim() === "" && (
                <p className="text-[11px] text-[#555] -mt-2">{t.step0.businessNameRequired}</p>
              )}
              <button
                type="button"
                onClick={() => setStep(1)}
                disabled={businessName.trim() === ""}
                className="w-full py-3.5 rounded-lg bg-[#c9a84c] text-[#080808] font-semibold text-[14px] tracking-wide hover:bg-[#e8c97a] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                {t.step0.continueButton}
              </button>
            </div>
          )}

          {/* ── STEP 1: Capabilities ── */}
          {step === 1 && (
            <div className="space-y-6 animate-fade-up">
              <div>
                <h1
                  className="text-3xl md:text-4xl font-light mb-2"
                  style={{ fontFamily: "var(--font-display), serif" }}>
                  {t.step1.headingStart}{" "}
                  <span className="italic" style={{ color: "#c9a84c" }}>
                    {t.step1.headingItalic}
                  </span>
                </h1>
                <p className="text-[13px] text-[#666]">{t.step1.body}</p>
              </div>

              <div className="space-y-4">
                {ALL_CAPABILITIES.map((cap) => {
                  const depth = capabilities[cap] ?? 0;
                  const isStrong = depth >= 70;
                  const isActive = depth > 0;
                  const depthLabel =
                    depth === 0
                      ? tDepth.depthLabels.notOffered
                      : depth < 30
                        ? tDepth.depthLabels.light
                        : depth < 60
                          ? tDepth.depthLabels.capable
                          : depth < 80
                            ? tDepth.depthLabels.strong
                            : tDepth.depthLabels.specialist;
                  return (
                    <div key={cap} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span
                          className={
                            "flex items-center gap-2 text-[12px] font-medium " +
                            (isStrong ? "text-[#c9a84c]" : isActive ? "text-[#f5f0e8]" : "text-[#666]")
                          }>
                          <span>{CAPABILITY_ICONS[cap]}</span>
                          <span>{t.capabilities[cap]}</span>
                        </span>
                        <span className="text-[11px] tabular-nums">
                          {depth > 0 && <span className="text-[#555]">{depthLabel} · </span>}
                          <span className={isStrong ? "text-[#c9a84c]" : "text-[#555]"}>{depth}%</span>
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={depth}
                        onChange={(e) =>
                          setCapabilities((c: Record<Capability, number>) => ({
                            ...c,
                            [cap]: Number(e.target.value),
                          }))
                        }
                        className={
                          "w-full h-1.5 rounded-full appearance-none bg-[#1a1a1a] cursor-pointer " +
                          (isStrong ? "accent-[#c9a84c]" : isActive ? "accent-emerald-400" : "accent-[#333]")
                        }
                      />
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] text-[#333]">{tDepth.capabilitiesTip}</p>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(0)}
                  className="flex-1 py-3 rounded-lg border border-[#252525] text-[#666] text-sm hover:border-[#444] transition-colors">
                  {t.step1.back}
                </button>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="flex-[2] py-3 rounded-lg bg-[#c9a84c] text-[#080808] font-semibold text-[14px] hover:bg-[#e8c97a] transition-colors">
                  {t.step1.continueButton}
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
                  style={{ fontFamily: "var(--font-display), serif" }}>
                  {t.step2.headingStart}{" "}
                  <span className="italic" style={{ color: "#c9a84c" }}>
                    {t.step2.headingItalic}
                  </span>
                </h1>
                <p className="text-[13px] text-[#666]">{t.step2.body}</p>
              </div>

              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[11px] uppercase tracking-widest text-[#666]">
                    {t.step2.experienceLevelLabel}
                  </label>
                  <div className="flex gap-2">
                    {(["beginner", "intermediate", "advanced"] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setExperienceLevel(v)}
                        className={`flex-1 py-2.5 rounded-lg border text-[12px] transition-colors ${experienceLevel === v ? "border-[#c9a84c] bg-[rgba(201,168,76,0.08)] text-[#c9a84c]" : "border-[#252525] text-[#555] hover:border-[#444]"}`}>
                        {t.step2.experienceLevels[v]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] uppercase tracking-widest text-[#666]">
                    {t.step2.acquisitionStyleLabel}
                  </label>
                  <div className="flex gap-2">
                    {(["volume", "balanced", "selective"] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setAcquisitionStyle(v)}
                        className={`flex-1 py-2.5 rounded-lg border text-[12px] transition-colors ${acquisitionStyle === v ? "border-[#c9a84c] bg-[rgba(201,168,76,0.08)] text-[#c9a84c]" : "border-[#252525] text-[#555] hover:border-[#444]"}`}>
                        {t.step2.acquisitionStyles[v]}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-[#444]">{t.step2.acquisitionStyleHints[acquisitionStyle]}</p>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] uppercase tracking-widest text-[#666]">
                    {t.step2.targetGeographyLabel}
                  </label>
                  <input
                    type="text"
                    value={targetLocation}
                    onChange={(e) => setTargetLocation(e.target.value)}
                    placeholder={t.step2.targetGeographyPlaceholder}
                    className="w-full bg-[#111] border border-[#252525] rounded-lg px-4 py-2.5 text-base sm:text-sm text-[#f5f0e8] placeholder-[#333] focus:outline-none focus:border-[rgba(201,168,76,0.5)] transition-colors"
                  />
                  <p className="text-[11px] text-[#444]">{t.step2.targetGeographyHint}</p>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] uppercase tracking-widest text-[#666]">
                    {t.step2.targetBusinessSizeLabel}
                  </label>
                  <div className="flex gap-2">
                    {(["small", "medium", "large"] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setTargetBusinessSize(v)}
                        className={`flex-1 py-2.5 rounded-lg border text-[12px] transition-colors ${targetBusinessSize === v ? "border-[#c9a84c] bg-[rgba(201,168,76,0.08)] text-[#c9a84c]" : "border-[#252525] text-[#555] hover:border-[#444]"}`}>
                        {t.step2.businessSizes[v]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 py-3 rounded-lg border border-[#252525] text-[#666] text-sm hover:border-[#444] transition-colors">
                  {t.step2.back}
                </button>
                <button
                  type="button"
                  onClick={handleFinish}
                  disabled={saving}
                  className="flex-[2] py-3 rounded-lg bg-[#c9a84c] text-[#080808] font-semibold text-[14px] hover:bg-[#e8c97a] disabled:opacity-50 transition-colors">
                  {saving ? t.step2.saving : t.step2.createProfile}
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Done ── */}
          {step === 3 && (
            <div className="text-center space-y-8 animate-fade-up">
              <div className="relative mx-auto w-20 h-20">
                <div className="absolute inset-0 rounded-full bg-[rgba(201,168,76,0.08)] border border-[rgba(201,168,76,0.2)] animate-pulse" />
                <div className="absolute inset-0 flex items-center justify-center text-3xl">✦</div>
              </div>
              <div>
                <p className="text-[11px] tracking-[0.2em] uppercase text-[#8a6e30] mb-3">
                  {t.step3.profileReadyBadge}
                </p>
                <h1
                  className="text-3xl md:text-4xl font-light mb-4"
                  style={{ fontFamily: "var(--font-display), serif" }}>
                  {t.step3.headingStart}{" "}
                  <span className="italic" style={{ color: "#c9a84c" }}>
                    {t.step3.headingItalic}
                  </span>
                </h1>
                <p className="text-[14px] text-[#555] max-w-md mx-auto leading-relaxed">{t.step3.body}</p>
              </div>
              <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto">
                {t.step3.features.map((f) => (
                  <div key={f.label} className="rounded-xl border border-[#1e1e1e] bg-[#0d0d0d] p-3 text-center">
                    <p className="text-[#c9a84c] text-lg mb-1">{f.icon}</p>
                    <p className="text-[10px] text-[#444] leading-tight">{f.label}</p>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => router.push("/dashboard")}
                className="inline-block px-10 py-4 rounded-lg bg-[#c9a84c] text-[#080808] font-semibold text-[14px] tracking-wide hover:bg-[#e8c97a] transition-all shadow-lg shadow-[rgba(201,168,76,0.15)]">
                {t.step3.findLeads}
              </button>
              <p className="text-[11px] text-[#333]">{t.step3.updateAnytime}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
