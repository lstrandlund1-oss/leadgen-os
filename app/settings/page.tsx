"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Sidebar from "@/app/components/Sidebar";
import NotificationBell from "@/app/components/NotificationBell";
import { createSupabaseBrowser } from "@/lib/supabaseBrowser";
import { useTheme } from "@/app/components/ThemeProvider";
import { useBetaStatus } from "@/lib/beta/useBetaStatus";
import TutorialsSettingsList from "@/app/components/TutorialsSettingsList";
import PageTutorial from "@/app/components/PageTutorial";
import FeedbackPrompt from "@/app/components/FeedbackPrompt";
import FeatureRatingsList from "@/app/components/FeatureRatingsList";
import { getTranslations } from "@/lib/i18n";

type Tab = "profile" | "preferences" | "notifications" | "account";

export default function SettingsPage() {
  const betaStatus = useBetaStatus();
  const router = useRouter();
  const supabase = createSupabaseBrowser();
  const { theme, toggle: toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const [userEmail, setUserEmail] = useState("");

  // Profile fields
  const [businessName, setBusinessName] = useState("");
  const [targetLocation, setTargetLocation] = useState("");
  // Economic profile (Week 3 of the rebuild) — all optional, stored as
  // empty-string in the input (easier to bind to a text input than
  // number|undefined) and converted to a real number or omitted entirely
  // on save.
  const [averageDealValue, setAverageDealValue] = useState("");
  const [closeRatePercent, setCloseRatePercent] = useState("");
  const [hoursPerWeekProspecting, setHoursPerWeekProspecting] = useState("");
  const [peopleInvolvedInProspecting, setPeopleInvolvedInProspecting] = useState("");
  const [yourOffer, setYourOffer] = useState("");
  const [experienceLevel, setExperienceLevel] = useState<"beginner" | "intermediate" | "advanced">("intermediate");
  const [acquisitionStyle, setAcquisitionStyle] = useState<"volume" | "balanced" | "selective">("balanced");
  const [targetBusinessSize, setTargetBusinessSize] = useState<"any" | "small" | "medium" | "large">("any");
  const [language, setLanguage] = useState<"en" | "sv">("en");
  const t = getTranslations(language).ui.settings;
  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: "profile", label: t.tabs.profile, icon: "◈" },
    { key: "preferences", label: t.tabs.preferences, icon: "◆" },
    { key: "notifications", label: t.tabs.notifications, icon: "◉" },
    { key: "account", label: t.tabs.account, icon: "◇" },
  ];

  // Notification prefs
  const [notifyFollowup, setNotifyFollowup] = useState(true);
  const [notifyDealClosed, setNotifyDealClosed] = useState(true);
  const [notifyWeeklyDigest, setNotifyWeeklyDigest] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState(false);

  // UI state
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  // Delete account state
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Clear local data confirmation
  const [clearConfirm, setClearConfirm] = useState(false);

  useEffect(() => {
    // Read tab from URL hash
    const hash = window.location.hash.replace("#", "") as Tab;
    if (["profile", "preferences", "notifications", "account"].includes(hash)) setActiveTab(hash as Tab);

    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setUserEmail(data.user.email);
    });

    fetch("/api/profile")
      .then((r) => r.json())
      .then(
        (d: {
          profile?: {
            businessName?: string;
            targetLocation?: string;
            offerDescription?: string;
            experienceLevel?: string;
            acquisitionStyle?: string;
            targetBusinessSize?: string;
            language?: string;
            averageDealValue?: number;
            closeRatePercent?: number;
            hoursPerWeekProspecting?: number;
            peopleInvolvedInProspecting?: number;
          };
        }) => {
          if (d.profile) {
            setBusinessName(d.profile.businessName ?? "");
            setTargetLocation(d.profile.targetLocation ?? "");
            setYourOffer(d.profile.offerDescription ?? "");
            setExperienceLevel((d.profile.experienceLevel as typeof experienceLevel) ?? "intermediate");
            setAcquisitionStyle((d.profile.acquisitionStyle as typeof acquisitionStyle) ?? "balanced");
            setTargetBusinessSize((d.profile.targetBusinessSize as typeof targetBusinessSize) ?? "any");
            setLanguage((d.profile.language as typeof language) ?? "en");
            setAverageDealValue(d.profile.averageDealValue != null ? String(d.profile.averageDealValue) : "");
            setCloseRatePercent(d.profile.closeRatePercent != null ? String(d.profile.closeRatePercent) : "");
            setHoursPerWeekProspecting(
              d.profile.hoursPerWeekProspecting != null ? String(d.profile.hoursPerWeekProspecting) : "",
            );
            setPeopleInvolvedInProspecting(
              d.profile.peopleInvolvedInProspecting != null ? String(d.profile.peopleInvolvedInProspecting) : "",
            );
          }
        },
      )
      .finally(() => setLoading(false));

    try {
      const np = JSON.parse(localStorage.getItem("vantio_notif_prefs") ?? "{}");
      if (np.followup !== undefined) setNotifyFollowup(np.followup);
      if (np.dealClosed !== undefined) setNotifyDealClosed(np.dealClosed);
      if (np.weeklyDigest !== undefined) setNotifyWeeklyDigest(np.weeklyDigest);
      if (np.email !== undefined) setNotifyEmail(np.email);
    } catch {
      /* ignore */
    }
  }, []);

  async function saveProfile() {
    setSaving(true);
    try {
      await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName,
          targetLocation,
          offerDescription: yourOffer,
          experienceLevel,
          acquisitionStyle,
          targetBusinessSize,
          language,
          // Always sent (as null when blank, not omitted) — buildUserProfile
          // rebuilds the profile from scratch on every save rather than
          // merging with what's already stored, so omitting a field here
          // would mean a user could never actually clear a previously-set
          // value, not just "leave it unset."
          averageDealValue: averageDealValue.trim() !== "" ? Number(averageDealValue) : null,
          closeRatePercent: closeRatePercent.trim() !== "" ? Number(closeRatePercent) : null,
          hoursPerWeekProspecting: hoursPerWeekProspecting.trim() !== "" ? Number(hoursPerWeekProspecting) : null,
          peopleInvolvedInProspecting:
            peopleInvolvedInProspecting.trim() !== "" ? Number(peopleInvolvedInProspecting) : null,
        }),
      });
      // The database profile is only reachable once logged in — but the
      // login and onboarding pages have no session yet, so they read the
      // language choice from localStorage instead. Without this, changing
      // the language here had zero effect on what those pages showed,
      // since nothing ever wrote the choice there.
      try {
        const existing = JSON.parse(localStorage.getItem("vantio_state_v1") ?? "{}");
        localStorage.setItem("vantio_state_v1", JSON.stringify({ ...existing, language }));
      } catch {
        /* ignore */
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  function saveNotificationPrefs() {
    localStorage.setItem(
      "vantio_notif_prefs",
      JSON.stringify({
        followup: notifyFollowup,
        dealClosed: notifyDealClosed,
        weeklyDigest: notifyWeeklyDigest,
        email: notifyEmail,
      }),
    );
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const inputClass =
    "w-full bg-[#0d0d0d] border border-[#252525] rounded-xl px-4 py-3 text-base sm:text-[13px] text-[#f5f0e8] placeholder-[#333] focus:outline-none focus:border-[rgba(201,168,76,0.5)] transition-colors";
  const labelClass = "block text-[10px] uppercase tracking-[0.15em] text-[#666] mb-2";
  const sectionClass = "rounded-2xl border border-[#1a1a1a] bg-[#0d0d0d] p-6 space-y-5";
  const toggle = (on: boolean) => (
    <button
      type="button"
      onClick={() => {}}
      className={
        "relative inline-flex h-5 w-9 items-center rounded-full border transition-colors " +
        (on ? "bg-[rgba(201,168,76,0.2)] border-[#c9a84c]" : "bg-[#111] border-[#252525]")
      }>
      <span
        className={
          "absolute h-3.5 w-3.5 rounded-full transition-transform " +
          (on ? "translate-x-[18px] bg-[#c9a84c]" : "translate-x-[3px] bg-[#333]")
        }
      />
    </button>
  );

  const sizeOptions: { value: "any" | "small" | "medium" | "large"; label: string; desc: string }[] = [
    { value: "any", label: t.profile.sizeOptions.any.label, desc: t.profile.sizeOptions.any.desc },
    { value: "small", label: t.profile.sizeOptions.small.label, desc: t.profile.sizeOptions.small.desc },
    { value: "medium", label: t.profile.sizeOptions.medium.label, desc: t.profile.sizeOptions.medium.desc },
    { value: "large", label: t.profile.sizeOptions.large.label, desc: t.profile.sizeOptions.large.desc },
  ];

  return (
    <div className="min-h-screen bg-[#080808] text-[#f5f0e8] flex">
      <Sidebar />
      <div className="flex-1 min-w-0">
        <nav className="w-full border-b border-[#151515] bg-[#080808]/90 backdrop-blur-md sticky top-0 z-40">
          <div className="max-w-5xl mx-auto px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="text-[#c9a84c]">◈</span>
              <Link
                href="/"
                className="text-[17px] font-light tracking-wide hover:opacity-80 transition-opacity"
                style={{ fontFamily: "var(--font-display), serif" }}>
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
              </Link>
              <span className="text-[9px] tracking-[0.15em] uppercase px-2 py-0.5 rounded-full border border-[rgba(201,168,76,0.25)] text-[#8a6e30]">
                {t.betaBadge}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/dashboard" className="text-[12px] text-[#555] hover:text-[#888] transition-colors mr-1">
                {t.backToDashboard}
              </Link>
              <NotificationBell emailNotifications={notifyEmail} />
            </div>
          </div>
        </nav>

        <div className="max-w-5xl mx-auto px-5 py-10">
          <div className="mb-8">
            <p className="text-[10px] tracking-[0.2em] uppercase text-[#8a6e30] mb-1">{t.platformEyebrow}</p>
            <h1 className="text-3xl md:text-4xl font-light" style={{ fontFamily: "var(--font-display), serif" }}>
              {t.headerTitle}
            </h1>
            <p className="text-[12px] text-[#444] mt-1.5">{t.headerSubtitle}</p>
          </div>

          <div className="flex flex-col md:flex-row gap-6 items-start">
            {/* Sidebar */}
            <div className="w-full md:w-48 flex-shrink-0">
              <div className="rounded-2xl border border-[#1a1a1a] bg-[#0d0d0d] overflow-hidden">
                {TABS.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={
                      "w-full flex items-center gap-3 px-4 py-3 text-left transition-all " +
                      (activeTab === tab.key
                        ? "bg-[rgba(201,168,76,0.06)] text-[#c9a84c]"
                        : "text-[#555] hover:text-[#888] hover:bg-[#111]")
                    }>
                    <span className="text-xs">{tab.icon}</span>
                    <span className="text-[12px] font-medium">{tab.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 space-y-5">
              {loading ? (
                <div className="py-20 text-center text-[#444] text-sm animate-pulse">{t.loading}</div>
              ) : (
                <>
                  {/* ── Profile tab ── */}
                  {activeTab === "profile" && (
                    <>
                      {/* Business */}
                      <div className={sectionClass}>
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.15em] text-[#8a6e30] mb-1">
                            {t.profile.businessEyebrow}
                          </p>
                          <h2 className="text-[15px] font-semibold text-[#c8c0b0]">{t.profile.businessTitle}</h2>
                        </div>
                        <div className="space-y-4">
                          <div>
                            <label className={labelClass}>{t.profile.businessNameLabel}</label>
                            <input
                              type="text"
                              value={businessName}
                              onChange={(e) => setBusinessName(e.target.value)}
                              placeholder={t.profile.businessNamePlaceholder}
                              className={inputClass}
                            />
                          </div>
                          <div>
                            <label className={labelClass}>{t.profile.targetGeographyLabel}</label>
                            <input
                              type="text"
                              value={targetLocation}
                              onChange={(e) => setTargetLocation(e.target.value)}
                              placeholder={t.profile.targetGeographyPlaceholder}
                              className={inputClass}
                            />
                            <p className="text-[11px] text-[#444] mt-1.5">{t.profile.targetGeographyHint}</p>
                          </div>
                          <div>
                            <label className={labelClass}>
                              {t.profile.yourOfferLabel}{" "}
                              <span className="text-[#8a6e30] normal-case">{t.profile.yourOfferSubLabel}</span>
                            </label>
                            <textarea
                              rows={4}
                              value={yourOffer}
                              onChange={(e) => setYourOffer(e.target.value)}
                              placeholder={t.profile.yourOfferPlaceholder}
                              className={inputClass + " resize-none"}
                            />
                          </div>
                        </div>
                      </div>

                      {/* How You Work */}
                      <div className={sectionClass}>
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.15em] text-[#8a6e30] mb-1">
                            {t.profile.prospectingEyebrow}
                          </p>
                          <h2 className="text-[15px] font-semibold text-[#c8c0b0]">{t.profile.prospectingTitle}</h2>
                        </div>
                        <div className="space-y-5">
                          <div>
                            <label className={labelClass}>{t.profile.experienceLevelLabel}</label>
                            <div className="flex gap-2">
                              {(["beginner", "intermediate", "advanced"] as const).map((v) => (
                                <button
                                  key={v}
                                  type="button"
                                  onClick={() => setExperienceLevel(v)}
                                  className={
                                    "flex-1 py-2.5 rounded-xl border text-[12px] transition-colors " +
                                    (experienceLevel === v
                                      ? "border-[#c9a84c] bg-[rgba(201,168,76,0.08)] text-[#c9a84c]"
                                      : "border-[#252525] text-[#555] hover:border-[#444]")
                                  }>
                                  {t.profile.experienceLevels[v]}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <label className={labelClass}>{t.profile.prospectingStyleLabel}</label>
                            <div className="flex gap-2">
                              {(["volume", "balanced", "selective"] as const).map((v) => (
                                <button
                                  key={v}
                                  type="button"
                                  onClick={() => setAcquisitionStyle(v)}
                                  className={
                                    "flex-1 py-2.5 rounded-xl border text-[12px] transition-colors " +
                                    (acquisitionStyle === v
                                      ? "border-[#c9a84c] bg-[rgba(201,168,76,0.08)] text-[#c9a84c]"
                                      : "border-[#252525] text-[#555] hover:border-[#444]")
                                  }>
                                  {t.profile.acquisitionStyles[v]}
                                </button>
                              ))}
                            </div>
                            <p className="text-[11px] text-[#444] mt-1.5">
                              {t.profile.acquisitionStyleHints[acquisitionStyle]}
                            </p>
                          </div>
                          <div>
                            <label className={labelClass}>{t.profile.targetBusinessSizeLabel}</label>
                            <p className="text-[11px] text-[#444] mb-3">{t.profile.targetBusinessSizeHint}</p>
                            <div className="space-y-2">
                              {sizeOptions.map((opt) => (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => setTargetBusinessSize(opt.value)}
                                  className={
                                    "w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors " +
                                    (targetBusinessSize === opt.value
                                      ? "border-[#c9a84c] bg-[rgba(201,168,76,0.06)]"
                                      : "border-[#252525] hover:border-[#333]")
                                  }>
                                  <div
                                    className={
                                      "w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center " +
                                      (targetBusinessSize === opt.value ? "border-[#c9a84c]" : "border-[#444]")
                                    }>
                                    {targetBusinessSize === opt.value && (
                                      <span className="w-2 h-2 rounded-full bg-[#c9a84c] block" />
                                    )}
                                  </div>
                                  <div>
                                    <p
                                      className={
                                        "text-[12px] font-medium " +
                                        (targetBusinessSize === opt.value ? "text-[#c9a84c]" : "text-[#888]")
                                      }>
                                      {opt.label}
                                    </p>
                                    <p className="text-[10px] text-[#444]">{opt.desc}</p>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Account actions (moved from danger zone) */}
                      <div className={sectionClass}>
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.15em] text-[#8a6e30] mb-1">
                            {t.profile.dataEyebrow}
                          </p>
                          <h2 className="text-[15px] font-semibold text-[#c8c0b0]">{t.profile.dataTitle}</h2>
                        </div>
                        <div className="space-y-3">
                          <p className="text-[12px] text-[#555]">{t.profile.dataBody}</p>
                          {!clearConfirm ? (
                            <button
                              type="button"
                              onClick={() => setClearConfirm(true)}
                              className="text-[12px] px-4 py-2 rounded-lg border border-[#252525] text-[#555] hover:border-[#444] hover:text-[#888] transition-all">
                              {t.profile.clearLocalData}
                            </button>
                          ) : (
                            <div className="flex items-center gap-2">
                              <p className="text-[12px] text-[#888]">{t.profile.clearConfirmQuestion}</p>
                              <button
                                type="button"
                                onClick={() => {
                                  [
                                    "vantio_saved_leads_v1",
                                    "vantio_lead_notes_v1",
                                    "vantio_outreach_lead",
                                    "vantio_notif_prefs",
                                  ].forEach((k) => localStorage.removeItem(k));
                                  setClearConfirm(false);
                                  setSaved(true);
                                  setTimeout(() => setSaved(false), 2000);
                                }}
                                className="text-[12px] px-3 py-1.5 rounded-lg border border-[#f87171]/30 text-[#f87171] hover:bg-[#f87171]/08 transition-all">
                                {t.profile.yesClear}
                              </button>
                              <button
                                type="button"
                                onClick={() => setClearConfirm(false)}
                                className="text-[12px] px-3 py-1.5 rounded-lg border border-[#252525] text-[#555] hover:border-[#444] transition-all">
                                {t.profile.cancel}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Delete account (moved from danger zone) */}
                      <div className="rounded-2xl border border-[#f87171]/15 bg-[#0d0d0d] p-5 space-y-4">
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.15em] text-[#f87171]/50 mb-1">
                            {t.profile.deleteEyebrow}
                          </p>
                          <p className="text-[14px] font-semibold text-[#c8c0b0]">{t.profile.deleteTitle}</p>
                          <p className="text-[11px] text-[#555] mt-1 leading-relaxed">{t.profile.deleteBody}</p>
                        </div>
                        {deleteStep === 0 && (
                          <button
                            type="button"
                            onClick={() => setDeleteStep(1)}
                            className="text-[12px] px-4 py-2 rounded-lg border border-[#f87171]/25 text-[#f87171]/70 hover:border-[#f87171]/50 hover:text-[#f87171] transition-all">
                            {t.profile.deleteMyAccount}
                          </button>
                        )}
                        {deleteStep === 1 && (
                          <div className="rounded-xl border border-[#f87171]/20 bg-[#f87171]/04 p-4 space-y-4">
                            <div className="space-y-2">
                              <p className="text-[13px] font-medium text-[#f87171]">{t.profile.deleteConfirmTitle}</p>
                              <p className="text-[12px] text-[#888] leading-relaxed">{t.profile.deleteConfirmBody}</p>
                              <p className="text-[11px] text-[#555] leading-relaxed">
                                {t.profile.deleteConfirmSubBody}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => setDeleteStep(0)}
                                className="flex-1 py-2 rounded-lg border border-[#252525] text-[#555] text-[12px] hover:border-[#444] transition-all">
                                {t.profile.cancel}
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteStep(2)}
                                className="flex-1 py-2 rounded-lg border border-[#f87171]/40 text-[#f87171] text-[12px] hover:bg-[#f87171]/08 transition-all">
                                {t.profile.yesContinue}
                              </button>
                            </div>
                          </div>
                        )}
                        {deleteStep === 2 && (
                          <div className="rounded-xl border border-[#f87171]/20 bg-[#f87171]/04 p-4 space-y-4">
                            <p className="text-[12px] text-[#888]">
                              {t.profile.typeDeleteToConfirm.split("DELETE").map((part, i, arr) => (
                                <span key={i}>
                                  {part}
                                  {i < arr.length - 1 && (
                                    <span className="font-mono text-[#f87171] font-bold">DELETE</span>
                                  )}
                                </span>
                              ))}
                            </p>
                            <input
                              type="text"
                              value={deleteConfirm}
                              onChange={(e) => {
                                setDeleteConfirm(e.target.value);
                                setDeleteError(null);
                              }}
                              placeholder="DELETE"
                              className="w-full bg-[#080808] border border-[#f87171]/30 rounded-lg px-3 py-2 text-base sm:text-[13px] text-[#f87171] placeholder-[#444] focus:outline-none focus:border-[#f87171]/60 transition-colors font-mono"
                            />
                            {deleteError && <p className="text-[11px] text-[#f87171]">{deleteError}</p>}
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setDeleteStep(0);
                                  setDeleteConfirm("");
                                  setDeleteError(null);
                                }}
                                className="flex-1 py-2 rounded-lg border border-[#252525] text-[#555] text-[12px] hover:border-[#444] transition-all">
                                {t.profile.cancel}
                              </button>
                              <button
                                type="button"
                                disabled={deleting}
                                onClick={async () => {
                                  if (deleteConfirm !== "DELETE") {
                                    setDeleteError(t.profile.deleteErrorMustTypeExactly);
                                    return;
                                  }
                                  setDeleting(true);
                                  setDeleteError(null);
                                  try {
                                    const res = await fetch("/api/account/delete", { method: "DELETE" });
                                    if (!res.ok) {
                                      const j = await res.json().catch(() => ({}));
                                      setDeleteError((j as { error?: string }).error ?? t.profile.deleteErrorGeneric);
                                      setDeleting(false);
                                      return;
                                    }
                                    try {
                                      await createSupabaseBrowser().auth.signOut();
                                    } catch {
                                      /* ignore */
                                    }
                                    [
                                      "vantio_saved_leads_v1",
                                      "vantio_lead_notes_v1",
                                      "vantio_outreach_lead",
                                      "vantio_notif_prefs",
                                      "vantio_state_v1",
                                      "vantio_theme",
                                    ].forEach((k) => {
                                      try {
                                        localStorage.removeItem(k);
                                      } catch {
                                        /* ignore */
                                      }
                                    });
                                    window.location.href = "/?account=deleted";
                                  } catch {
                                    setDeleteError(t.profile.deleteErrorNetwork);
                                    setDeleting(false);
                                  }
                                }}
                                className="flex-1 py-2 rounded-lg bg-[#f87171]/15 border border-[#f87171]/40 text-[#f87171] text-[12px] font-semibold hover:bg-[#f87171]/25 disabled:opacity-50 transition-all">
                                {deleting ? t.profile.deleting : t.profile.deletePermanently}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="pt-2">
                        <p className="text-[11px] uppercase tracking-widest text-[#666] mb-1">
                          {t.profile.economicEyebrow}
                        </p>
                        <h3 className="text-[15px] font-medium text-[#f5f0e8] mb-2">{t.profile.economicTitle}</h3>
                        <p className="text-[12px] text-[#777] mb-4">{t.profile.economicBody}</p>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="block text-[11px] uppercase tracking-widest text-[#666]">
                              {t.profile.averageDealValueLabel}
                            </label>
                            <input
                              type="number"
                              value={averageDealValue}
                              onChange={(e) => setAverageDealValue(e.target.value)}
                              className="w-full px-3 py-2.5 rounded-lg bg-[#0d0d0d] border border-[#252525] text-[13px] text-[#f5f0e8]"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="block text-[11px] uppercase tracking-widest text-[#666]">
                              {t.profile.closeRatePercentLabel}
                            </label>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={closeRatePercent}
                              onChange={(e) => setCloseRatePercent(e.target.value)}
                              className="w-full px-3 py-2.5 rounded-lg bg-[#0d0d0d] border border-[#252525] text-[13px] text-[#f5f0e8]"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="block text-[11px] uppercase tracking-widest text-[#666]">
                              {t.profile.hoursPerWeekProspectingLabel}
                            </label>
                            <input
                              type="number"
                              min={0}
                              value={hoursPerWeekProspecting}
                              onChange={(e) => setHoursPerWeekProspecting(e.target.value)}
                              className="w-full px-3 py-2.5 rounded-lg bg-[#0d0d0d] border border-[#252525] text-[13px] text-[#f5f0e8]"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="block text-[11px] uppercase tracking-widest text-[#666]">
                              {t.profile.peopleInvolvedInProspectingLabel}
                            </label>
                            <input
                              type="number"
                              min={0}
                              value={peopleInvolvedInProspecting}
                              onChange={(e) => setPeopleInvolvedInProspecting(e.target.value)}
                              className="w-full px-3 py-2.5 rounded-lg bg-[#0d0d0d] border border-[#252525] text-[13px] text-[#f5f0e8]"
                            />
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={saveProfile}
                        disabled={saving}
                        className="w-full py-3.5 rounded-xl bg-[#c9a84c] text-[#080808] font-semibold text-[14px] hover:bg-[#e8c97a] disabled:opacity-50 transition-all">
                        {saving ? t.profile.saving : saved ? t.profile.saved : t.profile.saveChanges}
                      </button>
                    </>
                  )}

                  {/* ── Preferences tab ── */}
                  {activeTab === "preferences" && (
                    <>
                      <div className={sectionClass}>
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.15em] text-[#8a6e30] mb-1">
                            {t.preferences.displayEyebrow}
                          </p>
                          <h2 className="text-[15px] font-semibold text-[#c8c0b0]">{t.preferences.appearanceTitle}</h2>
                        </div>
                        <div>
                          <label className={labelClass}>{t.preferences.themeLabel}</label>
                          <div className="flex items-center justify-between rounded-xl border border-[#1a1a1a] bg-[#080808] px-4 py-3.5">
                            <div>
                              <p className="text-[13px] text-[#c8c0b0]">
                                {theme === "dark" ? t.preferences.darkMode : t.preferences.lightMode}
                              </p>
                              <p className="text-[11px] text-[#444] mt-0.5">
                                {theme === "dark" ? t.preferences.darkModeDesc : t.preferences.lightModeDesc}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={toggleTheme}
                              className={
                                "relative inline-flex h-5 w-9 items-center rounded-full border transition-colors " +
                                (theme === "light"
                                  ? "bg-[rgba(184,148,46,0.2)] border-[#b8942e]"
                                  : "bg-[#111] border-[#252525]")
                              }>
                              <span
                                className={
                                  "absolute h-3.5 w-3.5 rounded-full transition-transform " +
                                  (theme === "light"
                                    ? "translate-x-[18px] bg-[#b8942e]"
                                    : "translate-x-[3px] bg-[#333]")
                                }
                              />
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className={sectionClass}>
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.15em] text-[#8a6e30] mb-1">
                            {t.preferences.languageEyebrow}
                          </p>
                          <h2 className="text-[15px] font-semibold text-[#c8c0b0]">{t.preferences.languageTitle}</h2>
                        </div>
                        <div className="flex gap-2">
                          {(["en", "sv"] as const).map((lang) => (
                            <button
                              key={lang}
                              type="button"
                              onClick={() => setLanguage(lang)}
                              className={
                                "flex-1 py-2.5 rounded-xl border text-[12px] uppercase tracking-widest transition-colors " +
                                (language === lang
                                  ? "border-[#c9a84c] bg-[rgba(201,168,76,0.08)] text-[#c9a84c]"
                                  : "border-[#252525] text-[#555] hover:border-[#444]")
                              }>
                              {lang === "en" ? "English" : "Svenska"}
                            </button>
                          ))}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={saveProfile}
                        disabled={saving}
                        className="w-full py-3.5 rounded-xl bg-[#c9a84c] text-[#080808] font-semibold text-[14px] hover:bg-[#e8c97a] disabled:opacity-50 transition-all">
                        {saving ? t.profile.saving : saved ? t.profile.saved : t.preferences.savePreferences}
                      </button>
                    </>
                  )}

                  {/* ── Notifications tab ── */}
                  {activeTab === "notifications" && (
                    <>
                      <div className={sectionClass}>
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.15em] text-[#8a6e30] mb-1">
                            {t.notifications.inAppEyebrow}
                          </p>
                          <h2 className="text-[15px] font-semibold text-[#c8c0b0]">{t.notifications.title}</h2>
                          <p className="text-[12px] text-[#444] mt-1">{t.notifications.subtitle}</p>
                        </div>
                        <div className="space-y-3">
                          {[
                            {
                              label: t.notifications.followupLabel,
                              sub: t.notifications.followupSub,
                              val: notifyFollowup,
                              set: setNotifyFollowup,
                            },
                            {
                              label: t.notifications.dealClosedLabel,
                              sub: t.notifications.dealClosedSub,
                              val: notifyDealClosed,
                              set: setNotifyDealClosed,
                            },
                            {
                              label: t.notifications.weeklyDigestLabel,
                              sub: t.notifications.weeklyDigestSub,
                              val: notifyWeeklyDigest,
                              set: setNotifyWeeklyDigest,
                            },
                          ].map(({ label, sub, val, set }) => (
                            <div
                              key={label}
                              className="flex items-center justify-between gap-4 rounded-xl border border-[#1a1a1a] bg-[#080808] px-4 py-3.5">
                              <div>
                                <p className="text-[13px] text-[#c8c0b0]">{label}</p>
                                <p className="text-[11px] text-[#444] mt-0.5">{sub}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => set(!val)}
                                className={
                                  "relative inline-flex h-5 w-9 items-center rounded-full border transition-colors cursor-pointer " +
                                  (val ? "bg-[rgba(201,168,76,0.2)] border-[#c9a84c]" : "bg-[#111] border-[#252525]")
                                }>
                                <span
                                  className={
                                    "absolute h-3.5 w-3.5 rounded-full transition-transform " +
                                    (val ? "translate-x-[18px] bg-[#c9a84c]" : "translate-x-[3px] bg-[#333]")
                                  }
                                />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className={sectionClass}>
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.15em] text-[#8a6e30] mb-1">
                            {t.notifications.emailEyebrow}
                          </p>
                          <h2 className="text-[15px] font-semibold text-[#c8c0b0]">{t.notifications.emailTitle}</h2>
                        </div>
                        <div className="flex items-center justify-between gap-4 rounded-xl border border-[#1a1a1a] bg-[#080808] px-4 py-3.5">
                          <div>
                            <p className="text-[13px] text-[#c8c0b0]">{t.notifications.emailToggleLabel}</p>
                            <p className="text-[11px] text-[#444] mt-0.5">
                              {t.notifications.emailToggleSub.replace(
                                "{email}",
                                userEmail || (language === "sv" ? "din e-post" : "your email"),
                              )}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setNotifyEmail(!notifyEmail)}
                            className={
                              "relative inline-flex h-5 w-9 items-center rounded-full border transition-colors cursor-pointer " +
                              (notifyEmail
                                ? "bg-[rgba(201,168,76,0.2)] border-[#c9a84c]"
                                : "bg-[#111] border-[#252525]")
                            }>
                            <span
                              className={
                                "absolute h-3.5 w-3.5 rounded-full transition-transform " +
                                (notifyEmail ? "translate-x-[18px] bg-[#c9a84c]" : "translate-x-[3px] bg-[#333]")
                              }
                            />
                          </button>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={saveNotificationPrefs}
                        className="w-full py-3.5 rounded-xl bg-[#c9a84c] text-[#080808] font-semibold text-[14px] hover:bg-[#e8c97a] transition-all">
                        {saved ? t.profile.saved : t.preferences.savePreferences}
                      </button>
                    </>
                  )}

                  {/* ── Account tab ── */}
                  {activeTab === "account" && (
                    <>
                      <div className={sectionClass}>
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.15em] text-[#8a6e30] mb-1">
                            {t.account.eyebrow}
                          </p>
                          <h2 className="text-[15px] font-semibold text-[#c8c0b0]">{t.account.title}</h2>
                        </div>
                        <div className="space-y-4">
                          <div className="rounded-xl border border-[#1a1a1a] bg-[#080808] px-4 py-4 space-y-1">
                            <p className="text-[10px] uppercase tracking-widest text-[#444]">{t.account.signedInAs}</p>
                            <p className="text-[14px] text-[#f5f0e8]">{userEmail || "—"}</p>
                          </div>
                          <div className="flex gap-2">
                            <Link
                              href="/forgot-password"
                              className="flex-1 py-2.5 rounded-xl border border-[#252525] text-[12px] text-[#555] hover:border-[#444] hover:text-[#888] transition-all text-center">
                              {t.account.changePassword}
                            </Link>
                            <button
                              type="button"
                              onClick={handleSignOut}
                              className="flex-1 py-2.5 rounded-xl border border-[#252525] text-[12px] text-[#555] hover:border-[#f87171]/30 hover:text-[#f87171] transition-all">
                              {t.account.signOut}
                            </button>
                          </div>
                        </div>
                      </div>

                      {betaStatus.active ? (
                        <div className={sectionClass}>
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.15em] text-[#8a6e30] mb-1">
                              {t.account.betaEyebrow}
                            </p>
                            <h2 className="text-[15px] font-semibold text-[#c8c0b0]">{t.account.betaTesterTitle}</h2>
                          </div>
                          <div className="rounded-xl border border-[#1a1a1a] bg-[#080808] px-4 py-4 space-y-1">
                            <p className="text-[13px] text-[#c8c0b0] font-medium">{t.account.betaFullAccess}</p>
                            <p className="text-[11px] text-[#444] mt-0.5">
                              {(betaStatus.daysRemainingActive === 1
                                ? t.account.activeDaysRemainingSingular
                                : t.account.activeDaysRemainingPlural
                              ).replace("{count}", String(betaStatus.daysRemainingActive))}
                            </p>
                          </div>
                        </div>
                      ) : betaStatus.reason === "expired" ? (
                        <div className={sectionClass}>
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.15em] text-[#8a6e30] mb-1">
                              {t.account.betaEyebrow}
                            </p>
                            <h2 className="text-[15px] font-semibold text-[#c8c0b0]">{t.account.betaEndedTitle}</h2>
                          </div>
                          <div className="rounded-xl border border-[#1a1a1a] bg-[#080808] px-4 py-4 space-y-2">
                            <p className="text-[13px] text-[#c8c0b0] font-medium">{t.account.betaEndedBody}</p>
                            <Link
                              href="/beta/completed"
                              className="text-[11px] text-[#c9a84c] hover:text-[#e8c97a] transition-colors">
                              {t.account.viewDetails}
                            </Link>
                          </div>
                        </div>
                      ) : (
                        <div className={sectionClass}>
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.15em] text-[#8a6e30] mb-1">
                              {t.account.subscriptionEyebrow}
                            </p>
                            <h2 className="text-[15px] font-semibold text-[#c8c0b0]">{t.account.yourPlanTitle}</h2>
                          </div>
                          <div className="rounded-xl border border-[#1a1a1a] bg-[#080808] px-4 py-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-[13px] text-[#c8c0b0] capitalize font-medium">
                                  {t.account.betaAccessLabel}
                                </p>
                                <p className="text-[11px] text-[#444] mt-0.5">{t.account.fullAccessDuringBeta}</p>
                              </div>
                              <Link
                                href="/plans"
                                className="text-[11px] px-3 py-1.5 rounded-lg border border-[rgba(201,168,76,0.25)] text-[#c9a84c] hover:bg-[rgba(201,168,76,0.06)] transition-all">
                                {t.account.changePlan}
                              </Link>
                            </div>
                            <div className="pt-2 border-t border-[#141414]">
                              <p className="text-[11px] text-[#444] leading-relaxed">{t.account.downgradeNotice}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {(betaStatus.active || betaStatus.reason === "expired") && (
                        <div className={sectionClass}>
                          <TutorialsSettingsList language={language} />
                        </div>
                      )}

                      {(betaStatus.active || betaStatus.reason === "expired") && (
                        <div className={sectionClass}>
                          <FeatureRatingsList language={language} />
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      {betaStatus.active && <PageTutorial tutorialKey="settings" language={language} />}
      {betaStatus.active && <FeedbackPrompt language={language} />}
    </div>
  );
}
