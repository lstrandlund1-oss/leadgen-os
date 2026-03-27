"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import HamburgerMenu from "@/app/components/HamburgerMenu";
import { createSupabaseBrowser } from "@/lib/supabaseBrowser";
import type { Capability } from "@/lib/fit/needs";
import { PROFILE_TYPE_DEFINITIONS, PROFILE_TYPE_KEYS, type ProfileTypeKey } from "@/lib/profile/profileTypes";

type Tab = "profile" | "account" | "preferences" | "notifications";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "profile",       label: "Profile",       icon: "◈" },
  { key: "preferences",   label: "Preferences",   icon: "◆" },
  { key: "notifications", label: "Notifications", icon: "◉" },
  { key: "account",       label: "Account",       icon: "◇" },
];

const ALL_CAPABILITIES: Capability[] = ["ads","tracking","funnel","content","website","seo","crm"];
const CAPABILITY_LABELS: Record<Capability, string> = {
  ads: "Paid Ads", tracking: "Analytics & Tracking", funnel: "Funnel Building",
  content: "Content Creation", website: "Website / Landing Pages", seo: "SEO", crm: "CRM / Follow-up",
};
const CAPABILITY_ICONS: Record<Capability, string> = {
  ads: "📢", tracking: "📊", funnel: "🔻", content: "✍️", website: "🌐", seo: "🔍", crm: "🤝",
};

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowser();
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const [userEmail, setUserEmail] = useState("");
  const [userId, setUserId] = useState("");

  // Profile fields
  const [businessName, setBusinessName] = useState("");
  const [targetLocation, setTargetLocation] = useState("");
  const [yourOffer, setYourOffer] = useState("");
  const [experienceLevel, setExperienceLevel] = useState<"beginner"|"intermediate"|"advanced">("intermediate");
  const [acquisitionStyle, setAcquisitionStyle] = useState<"volume"|"balanced"|"selective">("balanced");
  const [targetBusinessSize, setTargetBusinessSize] = useState<"small"|"medium"|"large">("small");
  const [language, setLanguage] = useState<"en"|"sv">("en");

  // Capabilities
  const [profileType, setProfileType] = useState<ProfileTypeKey>("performance_marketer");
  const [capabilities, setCapabilities] = useState<Record<Capability, number>>({
    ads: 90, tracking: 80, funnel: 80, content: 20, website: 20, seo: 10, crm: 30,
  });

  // Notification prefs (stored client-side)
  const [notifyFollowup, setNotifyFollowup] = useState(true);
  const [notifyDealClosed, setNotifyDealClosed] = useState(true);
  const [notifyWeeklyDigest, setNotifyWeeklyDigest] = useState(false);

  const [saving, setSaving] = useState(false);
  const [deleteStep, setDeleteStep] = useState<0|1|2>(0); // 0=hidden 1=warning 2=confirm
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string|null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) { setUserEmail(data.user.email); setUserId(data.user.id); }
    });

    fetch("/api/profile").then(r => r.json()).then((d: {
      profile?: {
        businessName?: string; targetLocation?: string; offerDescription?: string;
        experienceLevel?: string; acquisitionStyle?: string; targetBusinessSize?: string; language?: string;
        profileType?: string;
      };
      capabilities?: {
        capabilities?: Record<string, unknown>;
      };
    }) => {
      if (d.profile) {
        setBusinessName(d.profile.businessName ?? "");
        setTargetLocation(d.profile.targetLocation ?? "");
        setYourOffer(d.profile.offerDescription ?? "");
        setExperienceLevel((d.profile.experienceLevel as typeof experienceLevel) ?? "intermediate");
        setAcquisitionStyle((d.profile.acquisitionStyle as typeof acquisitionStyle) ?? "balanced");
        setTargetBusinessSize((d.profile.targetBusinessSize as typeof targetBusinessSize) ?? "small");
        setLanguage((d.profile.language as typeof language) ?? "en");
        if (d.profile.profileType) setProfileType((d.profile.profileType as ProfileTypeKey) ?? "performance_marketer");
      }
      if (d.capabilities?.capabilities) {
        const raw = d.capabilities.capabilities as Record<string, unknown>;
        const migrated = Object.fromEntries(
          Object.entries(raw).map(([k, v]) => [k, typeof v === "boolean" ? (v ? 100 : 0) : typeof v === "number" ? v : 0])
        ) as Record<Capability, number>;
        setCapabilities(migrated);
      }
    }).finally(() => setLoading(false));

    // Load notification prefs from localStorage
    try {
      const np = JSON.parse(localStorage.getItem("vantio_notif_prefs") ?? "{}");
      if (np.followup !== undefined) setNotifyFollowup(np.followup);
      if (np.dealClosed !== undefined) setNotifyDealClosed(np.dealClosed);
      if (np.weeklyDigest !== undefined) setNotifyWeeklyDigest(np.weeklyDigest);
    } catch { /* ignore */ }
  }, []);

  async function saveProfile() {
    setSaving(true);
    try {
      await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileType, businessName, targetLocation, offerDescription: yourOffer,
          experienceLevel, acquisitionStyle, targetBusinessSize, language,
          capabilities,
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally { setSaving(false); }
  }

  function saveNotificationPrefs() {
    localStorage.setItem("vantio_notif_prefs", JSON.stringify({
      followup: notifyFollowup, dealClosed: notifyDealClosed, weeklyDigest: notifyWeeklyDigest,
    }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const inputClass = "w-full bg-[#0d0d0d] border border-[#252525] rounded-xl px-4 py-3 text-[13px] text-[#f5f0e8] placeholder-[#333] focus:outline-none focus:border-[rgba(201,168,76,0.5)] transition-colors";
  const labelClass = "block text-[10px] uppercase tracking-[0.15em] text-[#666] mb-2";
  const sectionClass = "rounded-2xl border border-[#1a1a1a] bg-[#0d0d0d] p-6 space-y-5";
  const toggleClass = (on: boolean) => `relative inline-flex h-5 w-9 items-center rounded-full border transition-colors cursor-pointer ${on ? "bg-[rgba(201,168,76,0.2)] border-[#c9a84c]" : "bg-[#111] border-[#252525]"}`;

  return (
    <div className="min-h-screen bg-[#080808] text-[#f5f0e8]">
      {/* Nav */}
      <nav className="w-full border-b border-[#151515] bg-[#080808]/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-[#c9a84c]">◈</span>
            <Link href="/" className="text-[17px] font-light tracking-wide hover:opacity-80 transition-opacity" style={{ fontFamily: "var(--font-display), serif" }}>
              Van<span style={{ background: "linear-gradient(135deg, #e8c97a 0%, #c9a84c 50%, #8a6e30 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>tio</span>
            </Link>
            <span className="text-[9px] tracking-[0.15em] uppercase px-2 py-0.5 rounded-full border border-[rgba(201,168,76,0.25)] text-[#8a6e30]">Beta</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-[12px] text-[#555] hover:text-[#888] transition-colors">← Dashboard</Link>
            <HamburgerMenu userEmail={userEmail} />
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-5 py-10">
        <div className="mb-8">
          <p className="text-[10px] tracking-[0.2em] uppercase text-[#8a6e30] mb-1">Platform</p>
          <h1 className="text-3xl md:text-4xl font-light" style={{ fontFamily: "var(--font-display), serif" }}>
            Settings
          </h1>
          <p className="text-[12px] text-[#444] mt-1.5">Manage your profile, preferences, and account</p>
        </div>

        <div className="flex flex-col md:flex-row gap-6 items-start">
          {/* Sidebar */}
          <div className="w-full md:w-48 flex-shrink-0">
            <div className="rounded-2xl border border-[#1a1a1a] bg-[#0d0d0d] overflow-hidden">
              {TABS.map((tab) => (
                <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)}
                  className={"w-full flex items-center gap-3 px-4 py-3 text-left transition-all " + (activeTab === tab.key ? "bg-[rgba(201,168,76,0.06)] text-[#c9a84c]" : "text-[#555] hover:text-[#888] hover:bg-[#111]")}>
                  <span className="text-xs">{tab.icon}</span>
                  <span className="text-[12px] font-medium">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-5">

            {loading ? (
              <div className="py-20 text-center text-[#444] text-sm animate-pulse">Loading…</div>
            ) : (
              <>
                {/* ── Profile tab ── */}
                {activeTab === "profile" && (
                  <>
                    <div className={sectionClass}>
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.15em] text-[#8a6e30] mb-1">Business</p>
                        <h2 className="text-[15px] font-semibold text-[#c8c0b0]">Your Business</h2>
                      </div>
                      <div className="space-y-4">
                        <div>
                          <label className={labelClass}>Business / Agency Name</label>
                          <input type="text" value={businessName} onChange={e => setBusinessName(e.target.value)}
                            placeholder="e.g. Spark Agency" className={inputClass} />
                        </div>
                        <div>
                          <label className={labelClass}>Target Geography</label>
                          <input type="text" value={targetLocation} onChange={e => setTargetLocation(e.target.value)}
                            placeholder="e.g. Stockholm, London, New York" className={inputClass} />
                          <p className="text-[11px] text-[#444] mt-1.5">Pre-fills your location filter on the dashboard</p>
                        </div>
                        <div>
                          <label className={labelClass}>Your Offer <span className="text-[#8a6e30] normal-case">— used in outreach generation</span></label>
                          <textarea rows={4} value={yourOffer} onChange={e => setYourOffer(e.target.value)}
                            placeholder="e.g. We run Meta and Google ads, build high-converting landing pages, and set up full tracking for service businesses. We typically work with businesses doing 1–10M SEK/year."
                            className={inputClass + " resize-none"} />
                          <p className="text-[11px] text-[#444] mt-1.5">Loaded automatically when generating outreach messages</p>
                        </div>
                      </div>
                    </div>

                    <div className={sectionClass}>
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.15em] text-[#8a6e30] mb-1">Preferences</p>
                        <h2 className="text-[15px] font-semibold text-[#c8c0b0]">How You Work</h2>
                      </div>
                      <div className="space-y-5">
                        <div>
                          <label className={labelClass}>Experience Level</label>
                          <div className="flex gap-2">
                            {(["beginner","intermediate","advanced"] as const).map(v => (
                              <button key={v} type="button" onClick={() => setExperienceLevel(v)}
                                className={"flex-1 py-2.5 rounded-xl border text-[12px] capitalize transition-colors " + (experienceLevel === v ? "border-[#c9a84c] bg-[rgba(201,168,76,0.08)] text-[#c9a84c]" : "border-[#252525] text-[#555] hover:border-[#444]")}>
                                {v}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className={labelClass}>Prospecting Style</label>
                          <div className="flex gap-2">
                            {(["volume","balanced","selective"] as const).map(v => (
                              <button key={v} type="button" onClick={() => setAcquisitionStyle(v)}
                                className={"flex-1 py-2.5 rounded-xl border text-[12px] capitalize transition-colors " + (acquisitionStyle === v ? "border-[#c9a84c] bg-[rgba(201,168,76,0.08)] text-[#c9a84c]" : "border-[#252525] text-[#555] hover:border-[#444]")}>
                                {v}
                              </button>
                            ))}
                          </div>
                          <p className="text-[11px] text-[#444] mt-1.5">
                            {acquisitionStyle === "volume" ? "Cast a wide net — more leads, lower threshold." : acquisitionStyle === "selective" ? "Strict qualification — only high-readiness leads." : "Balanced scoring — best for most service providers."}
                          </p>
                        </div>
                        <div>
                          <label className={labelClass}>Target Business Size</label>
                          <div className="flex gap-2">
                            {(["small","medium","large"] as const).map(v => (
                              <button key={v} type="button" onClick={() => setTargetBusinessSize(v)}
                                className={"flex-1 py-2.5 rounded-xl border text-[12px] capitalize transition-colors " + (targetBusinessSize === v ? "border-[#c9a84c] bg-[rgba(201,168,76,0.08)] text-[#c9a84c]" : "border-[#252525] text-[#555] hover:border-[#444]")}>
                                {v}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Service Type */}
                    <div className={sectionClass}>
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.15em] text-[#8a6e30] mb-1">Service Type</p>
                        <h2 className="text-[15px] font-semibold text-[#c8c0b0]">What You Offer</h2>
                        <p className="text-[12px] text-[#444] mt-1">Shapes how leads are scored and matched to your capabilities.</p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {PROFILE_TYPE_KEYS.map((key) => {
                          const def = PROFILE_TYPE_DEFINITIONS[key];
                          const isActive = profileType === key;
                          return (
                            <button key={key} type="button"
                              onClick={() => {
                                setProfileType(key);
                                const defaults = def.defaultCapabilities as Record<Capability, number>;
                                setCapabilities(Object.fromEntries(
                                  Object.entries(defaults).map(([k, v]) => [k, typeof v === "boolean" ? (v ? 100 : 0) : v])
                                ) as Record<Capability, number>);
                              }}
                              className={"text-left p-3.5 rounded-xl border transition-all " + (isActive ? "border-[#c9a84c] bg-[rgba(201,168,76,0.06)] text-[#f5f0e8]" : "border-[#1a1a1a] bg-[#080808] text-[#555] hover:border-[#333]")}>
                              <p className="text-[13px] font-semibold">{def.label}</p>
                              <p className="text-[11px] text-[#555] mt-0.5 leading-relaxed">{def.description}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Capability Depths */}
                    <div className={sectionClass}>
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.15em] text-[#8a6e30] mb-1">Capabilities</p>
                        <h2 className="text-[15px] font-semibold text-[#c8c0b0]">Capability Depths</h2>
                        <p className="text-[12px] text-[#444] mt-1">
                          0 = not offered · 100 = core specialisation. A specialist with deep focus scores higher than a generalist on leads that need that specific skill.
                        </p>
                      </div>
                      <div className="space-y-4">
                        {ALL_CAPABILITIES.map((cap) => {
                          const depth = capabilities[cap] ?? 0;
                          const isStrong = depth >= 70;
                          const isActive = depth > 0;
                          const depthLabel = depth === 0 ? "Not offered" : depth < 30 ? "Light" : depth < 60 ? "Capable" : depth < 80 ? "Strong" : "Specialist";
                          return (
                            <div key={cap} className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className={"flex items-center gap-2 text-[12px] font-medium " + (isStrong ? "text-[#c9a84c]" : isActive ? "text-[#f5f0e8]" : "text-[#444]")}>
                                  <span>{CAPABILITY_ICONS[cap]}</span>
                                  <span>{CAPABILITY_LABELS[cap]}</span>
                                </span>
                                <span className="text-[11px] tabular-nums">
                                  {depth > 0 && <span className="text-[#555]">{depthLabel} · </span>}
                                  <span className={isStrong ? "text-[#c9a84c]" : "text-[#444]"}>{depth}%</span>
                                </span>
                              </div>
                              <input type="range" min={0} max={100} step={5} value={depth}
                                onChange={(e) => setCapabilities(c => ({ ...c, [cap]: Number(e.target.value) }))}
                                className={"w-full h-1.5 rounded-full appearance-none bg-[#1a1a1a] cursor-pointer " + (isStrong ? "accent-[#c9a84c]" : isActive ? "accent-emerald-400" : "accent-[#333]")}
                              />
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-[11px] text-[#333] pt-1">Tip — one or two capabilities at 80%+ gets a specialist bonus on leads where those are the primary need.</p>
                    </div>

                    <button type="button" onClick={saveProfile} disabled={saving}
                      className="w-full py-3.5 rounded-xl bg-[#c9a84c] text-[#080808] font-semibold text-[14px] hover:bg-[#e8c97a] disabled:opacity-50 transition-all">
                      {saving ? "Saving…" : saved ? "✓ Saved!" : "Save changes"}
                    </button>
                  </>
                )}

                {/* ── Preferences tab ── */}
                {activeTab === "preferences" && (
                  <>
                    <div className={sectionClass}>
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.15em] text-[#8a6e30] mb-1">Platform</p>
                        <h2 className="text-[15px] font-semibold text-[#c8c0b0]">Display & Language</h2>
                      </div>
                      <div>
                        <label className={labelClass}>Language</label>
                        <div className="flex gap-2">
                          {(["en","sv"] as const).map(lang => (
                            <button key={lang} type="button" onClick={() => setLanguage(lang)}
                              className={"flex-1 py-2.5 rounded-xl border text-[12px] uppercase tracking-widest transition-colors " + (language === lang ? "border-[#c9a84c] bg-[rgba(201,168,76,0.08)] text-[#c9a84c]" : "border-[#252525] text-[#555] hover:border-[#444]")}>
                              {lang === "en" ? "English" : "Svenska"}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <button type="button" onClick={saveProfile} disabled={saving}
                      className="w-full py-3.5 rounded-xl bg-[#c9a84c] text-[#080808] font-semibold text-[14px] hover:bg-[#e8c97a] disabled:opacity-50 transition-all">
                      {saving ? "Saving…" : saved ? "✓ Saved!" : "Save preferences"}
                    </button>
                  </>
                )}

                {/* ── Notifications tab ── */}
                {activeTab === "notifications" && (
                  <>
                    <div className={sectionClass}>
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.15em] text-[#8a6e30] mb-1">Alerts</p>
                        <h2 className="text-[15px] font-semibold text-[#c8c0b0]">Notification Preferences</h2>
                        <p className="text-[12px] text-[#444] mt-1">Stored locally in your browser</p>
                      </div>
                      <div className="space-y-4">
                        {[
                          { label: "Follow-up reminders", sub: "Alert when a follow-up date passes", val: notifyFollowup, set: setNotifyFollowup },
                          { label: "Deal closed", sub: "Celebration alert when you close a deal", val: notifyDealClosed, set: setNotifyDealClosed },
                          { label: "Weekly digest", sub: "Summary of your pipeline activity each Monday", val: notifyWeeklyDigest, set: setNotifyWeeklyDigest },
                        ].map(({ label, sub, val, set }) => (
                          <div key={label} className="flex items-center justify-between gap-4 rounded-xl border border-[#1a1a1a] bg-[#080808] px-4 py-3.5">
                            <div>
                              <p className="text-[13px] text-[#c8c0b0]">{label}</p>
                              <p className="text-[11px] text-[#444] mt-0.5">{sub}</p>
                            </div>
                            <button type="button" onClick={() => set(!val)} className={toggleClass(val)}>
                              <span className={"absolute h-3.5 w-3.5 rounded-full transition-transform " + (val ? "translate-x-[18px] bg-[#c9a84c]" : "translate-x-[3px] bg-[#333]")} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                    <button type="button" onClick={saveNotificationPrefs}
                      className="w-full py-3.5 rounded-xl bg-[#c9a84c] text-[#080808] font-semibold text-[14px] hover:bg-[#e8c97a] transition-all">
                      {saved ? "✓ Saved!" : "Save preferences"}
                    </button>
                  </>
                )}

                {/* ── Account tab ── */}
                {activeTab === "account" && (
                  <div className="space-y-5">
                    <div className={sectionClass}>
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.15em] text-[#8a6e30] mb-1">Account</p>
                        <h2 className="text-[15px] font-semibold text-[#c8c0b0]">Your Account</h2>
                      </div>
                      <div className="space-y-4">
                        <div className="rounded-xl border border-[#1a1a1a] bg-[#080808] px-4 py-4 space-y-1">
                          <p className="text-[10px] uppercase tracking-widest text-[#444]">Signed in as</p>
                          <p className="text-[14px] text-[#f5f0e8]">{userEmail || "—"}</p>
                        </div>
                        <div className="flex gap-2">
                          <Link href="/forgot-password"
                            className="flex-1 py-2.5 rounded-xl border border-[#252525] text-[12px] text-[#555] hover:border-[#444] hover:text-[#888] transition-all text-center">
                            Change password →
                          </Link>
                          <button type="button" onClick={handleSignOut}
                            className="flex-1 py-2.5 rounded-xl border border-[#252525] text-[12px] text-[#555] hover:border-[#f87171]/30 hover:text-[#f87171] transition-all">
                            Sign out
                          </button>
                        </div>
                        <div className="rounded-xl border border-[#1a1a1a] bg-[#080808] px-4 py-4 space-y-1">
                          <p className="text-[10px] uppercase tracking-widests text-[#444]">Subscription</p>
                          <div className="flex items-center justify-between">
                            <p className="text-[13px] text-[#888] capitalize">Beta access</p>
                            <Link href="/plans" className="text-[11px] text-[#c9a84c] hover:text-[#e8c97a] transition-colors">View plans →</Link>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Clear local data */}
                    <div className={sectionClass}>
                      <div>
                        <p className="text-[13px] text-[#c8c0b0] font-medium">Clear local data</p>
                        <p className="text-[11px] text-[#555] mt-0.5">Reset notes, saved leads, and local preferences stored in this browser only.</p>
                      </div>
                      <button type="button"
                        onClick={() => {
                          ["vantio_saved_leads_v1","vantio_lead_notes_v1","vantio_outreach_lead","vantio_notif_prefs"].forEach(k => localStorage.removeItem(k));
                          setSaved(true); setTimeout(() => setSaved(false), 2000);
                        }}
                        className="text-[12px] px-4 py-2 rounded-lg border border-[#252525] text-[#555] hover:border-[#444] hover:text-[#888] transition-all">
                        Clear local data
                      </button>
                    </div>

                    {/* Delete account */}
                    <div className="rounded-2xl border border-[#f87171]/20 bg-[#0d0d0d] p-6 space-y-4">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.15em] text-[#f87171]/50 mb-1">Permanent action</p>
                        <p className="text-[14px] font-semibold text-[#c8c0b0]">Delete account</p>
                        <p className="text-[11px] text-[#555] mt-1 leading-relaxed">
                          Deletes your profile, all searches, lead outcomes, and login credentials in accordance with GDPR Article 17.
                        </p>
                      </div>
                      {deleteStep === 0 && (
                        <button type="button" onClick={() => setDeleteStep(1)}
                          className="text-[12px] px-4 py-2 rounded-lg border border-[#f87171]/25 text-[#f87171]/70 hover:border-[#f87171]/50 hover:text-[#f87171] transition-all">
                          Delete my account
                        </button>
                      )}
                      {deleteStep === 1 && (
                        <div className="rounded-xl border border-[#f87171]/20 bg-[#f87171]/04 p-4 space-y-4">
                          <div className="space-y-2">
                            <p className="text-[13px] font-medium text-[#f87171]">Are you sure?</p>
                            <p className="text-[12px] text-[#888] leading-relaxed">This will permanently erase your account. There is no recovery option and no exceptions.</p>
                            <p className="text-[11px] text-[#555] leading-relaxed">If you are on a paid plan, no refund will be issued for the remaining billing period. Please cancel your subscription first if applicable.</p>
                          </div>
                          <div className="flex gap-2">
                            <button type="button" onClick={() => setDeleteStep(0)}
                              className="flex-1 py-2 rounded-lg border border-[#252525] text-[#555] text-[12px] hover:border-[#444] transition-all">Cancel</button>
                            <button type="button" onClick={() => setDeleteStep(2)}
                              className="flex-1 py-2 rounded-lg border border-[#f87171]/40 text-[#f87171] text-[12px] hover:bg-[#f87171]/08 transition-all">Yes, continue</button>
                          </div>
                        </div>
                      )}
                      {deleteStep === 2 && (
                        <div className="rounded-xl border border-[#f87171]/20 bg-[#f87171]/04 p-4 space-y-4">
                          <p className="text-[12px] text-[#888]">Type <span className="font-mono text-[#f87171] font-bold">DELETE</span> to confirm permanent deletion.</p>
                          <input type="text" value={deleteConfirm} onChange={e => { setDeleteConfirm(e.target.value); setDeleteError(null); }}
                            placeholder="DELETE"
                            className="w-full bg-[#080808] border border-[#f87171]/30 rounded-lg px-3 py-2 text-[13px] text-[#f87171] placeholder-[#444] focus:outline-none focus:border-[#f87171]/60 transition-colors font-mono" />
                          {deleteError && <p className="text-[11px] text-[#f87171]">{deleteError}</p>}
                          <div className="flex gap-2">
                            <button type="button" onClick={() => { setDeleteStep(0); setDeleteConfirm(""); setDeleteError(null); }}
                              className="flex-1 py-2 rounded-lg border border-[#252525] text-[#555] text-[12px] hover:border-[#444] transition-all">Cancel</button>
                            <button type="button" disabled={deleting}
                              onClick={async () => {
                                if (deleteConfirm !== "DELETE") { setDeleteError(`Type "DELETE" exactly to confirm.`); return; }
                                setDeleting(true); setDeleteError(null);
                                try {
                                  const res = await fetch("/api/account/delete", { method: "DELETE" });
                                  if (!res.ok) {
                                    const j = await res.json().catch(() => ({}));
                                    setDeleteError((j as {error?:string}).error ?? "Deletion failed. Contact hello@vantioapp.com");
                                    setDeleting(false); return;
                                  }
                                  try { const { createSupabaseBrowser } = await import("@/lib/supabaseBrowser"); await createSupabaseBrowser().auth.signOut(); } catch { /* ignore */ }
                                  ["vantio_saved_leads_v1","vantio_lead_notes_v1","vantio_outreach_lead","vantio_notif_prefs","vantio_state_v1","vantio_theme"].forEach(k => { try { localStorage.removeItem(k); } catch { /* ignore */ } });
                                  window.location.href = "/?account=deleted";
                                } catch { setDeleteError("Network error. Please try again."); setDeleting(false); }
                              }}
                              className="flex-1 py-2 rounded-lg bg-[#f87171]/15 border border-[#f87171]/40 text-[#f87171] text-[12px] font-semibold hover:bg-[#f87171]/25 disabled:opacity-50 transition-all">
                              {deleting ? "Deleting…" : "Delete permanently"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
