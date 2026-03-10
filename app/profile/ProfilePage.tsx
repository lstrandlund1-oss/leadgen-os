"use client";

import { useEffect, useState } from "react";
import type { Capability } from "@/lib/fit/needs";
import {
  PROFILE_TYPE_DEFINITIONS,
  PROFILE_TYPE_KEYS,
  type ProfileTypeKey,
} from "@/lib/profile/profileTypes";

type ProfileData = {
  profileType: string;
  businessName: string;
  experienceLevel: "beginner" | "intermediate" | "advanced";
  targetBusinessSize: "small" | "medium" | "large";
  acquisitionStyle: "aggressive" | "balanced" | "premium";
  budgetPreference: "low" | "medium" | "high";
  targetLocation: string;
};

type OutcomeStats = {
  contacted: number;
  replied: number;
  booked: number;
  closed: number;
  totalRevenue: number;
};

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

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileData>({
    profileType: "performance_marketer",
    businessName: "",
    experienceLevel: "intermediate",
    targetBusinessSize: "small",
    acquisitionStyle: "balanced",
    budgetPreference: "medium",
    targetLocation: "",
  });

  const [capabilities, setCapabilities] = useState<Record<Capability, boolean>>(
    {
      ads: true,
      tracking: true,
      funnel: true,
      content: false,
      website: false,
      seo: false,
      crm: false,
    },
  );

  const [stats, setStats] = useState<OutcomeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<"profile" | "stats">("profile");

  // Load profile + stats on mount
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [profileRes, outcomesRes] = await Promise.all([
          fetch("/api/profile"),
          fetch("/api/outcomes?all=true"),
        ]);

        if (profileRes.ok) {
          const data = await profileRes.json();
          if (data.profile) {
            setProfile({
              profileType: data.profile.profileType ?? "performance_marketer",
              businessName: data.profile.businessName ?? "",
              experienceLevel: data.profile.experienceLevel ?? "intermediate",
              targetBusinessSize:
                data.profile.targetBusinessSize ?? "small",
              acquisitionStyle:
                data.profile.acquisitionStyle ?? "balanced",
              budgetPreference: data.profile.budgetPreference ?? "medium",
              targetLocation: data.profile.targetLocation ?? "",
            });
          }
          if (data.capabilities?.capabilities) {
            setCapabilities(data.capabilities.capabilities);
          }
        }

        if (outcomesRes.ok) {
          const outcomesData = await outcomesRes.json();
          const outcomes: Array<{
            contacted?: boolean;
            replied?: boolean;
            booked_call?: boolean;
            closed?: boolean;
            revenue?: number | null;
          }> = outcomesData.outcomes ?? [];

          setStats({
            contacted: outcomes.filter((o) => o.contacted).length,
            replied: outcomes.filter((o) => o.replied).length,
            booked: outcomes.filter((o) => o.booked_call).length,
            closed: outcomes.filter((o) => o.closed).length,
            totalRevenue: outcomes.reduce((sum, o) => sum + (o.revenue ?? 0), 0),
          });
        }
      } catch (err) {
        console.error("ProfilePage load error:", err);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  // When profile type changes, apply its default capabilities
  function handleProfileTypeChange(key: ProfileTypeKey) {
    const def = PROFILE_TYPE_DEFINITIONS[key];
    setProfile((p: ProfileData) => ({ ...p, profileType: key }));
    setCapabilities({ ...def.defaultCapabilities });
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileType: profile.profileType,
          businessName: profile.businessName,
          experienceLevel: profile.experienceLevel,
          targetBusinessSize: profile.targetBusinessSize,
          acquisitionStyle: profile.acquisitionStyle,
          budgetPreference: profile.budgetPreference,
          targetLocation: profile.targetLocation,
          capabilities,
        }),
      });
      if (res.ok) setSaved(true);
    } catch (err) {
      console.error("Save error:", err);
    } finally {
      setSaving(false);
    }
  }

  function conversionRate(a: number, b: number): string {
    if (b === 0) return "—";
    return Math.round((a / b) * 100) + "%";
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-[#888] text-sm animate-pulse">
        Loading profile...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-[#252525]">
        {(["profile", "stats"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={
              "text-[13px] px-4 py-2 rounded-t-lg font-medium transition-colors capitalize " +
              (activeTab === tab
                ? "bg-[#1a1a1a] text-[#f5f0e8] border border-b-0 border-[#2a2a2a]"
                : "text-[#888] hover:text-[#c8c0b0]")
            }
          >
            {tab === "profile" ? "⚙️ My Profile" : "📈 My Stats"}
          </button>
        ))}
      </div>

      {/* PROFILE TAB */}
      {activeTab === "profile" && (
        <div className="space-y-6">

          {/* Business name */}
          <section className="bg-[#111111]/60 border border-[#252525] rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-[#f5f0e8]">
              Your Business
            </h2>
            <div className="space-y-1">
              <label className="text-[11px] uppercase tracking-wide text-[#888]">
                Business / Agency Name
              </label>
              <input
                type="text"
                value={profile.businessName}
                onChange={(e) =>
                  setProfile((p: ProfileData) => ({ ...p, businessName: e.target.value }))
                }
                placeholder="e.g. Spark Agency"
                className="w-full bg-[#080808] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-[#f5f0e8] placeholder-slate-600 focus:outline-none focus:border-[#c9a84c]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] uppercase tracking-wide text-[#888]">
                Target Geography
              </label>
              <input
                type="text"
                value={profile.targetLocation}
                onChange={(e) =>
                  setProfile((p: ProfileData) => ({ ...p, targetLocation: e.target.value }))
                }
                placeholder="e.g. Stockholm, London, New York"
                className="w-full bg-[#080808] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-[#f5f0e8] placeholder-slate-600 focus:outline-none focus:border-[#c9a84c]"
              />
              <p className="text-[11px] text-[#444]">
                Pre-fills the location field when you search. Leave blank to search anywhere.
              </p>
            </div>
          </section>

          {/* Profile type selector */}
          <section className="bg-[#111111]/60 border border-[#252525] rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-[#f5f0e8]">
              Service Type
            </h2>
            <p className="text-[12px] text-[#888]">
              Choose what best describes your service. This shapes how leads are
              scored and matched to your capabilities.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {PROFILE_TYPE_KEYS.map((key: ProfileTypeKey) => {
                const def = PROFILE_TYPE_DEFINITIONS[key];
                const isActive = profile.profileType === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleProfileTypeChange(key)}
                    className={
                      "text-left p-4 rounded-xl border transition-all " +
                      (isActive
                        ? "border-[#c9a84c] bg-[#c9a84c]/10 text-[#f5f0e8]"
                        : "border-[#2a2a2a] bg-[#111111]/40 text-[#aaa] hover:border-[#333]")
                    }
                  >
                    <p className="text-sm font-semibold">{def.label}</p>
                    <p className="text-[11px] text-[#888] mt-1 leading-relaxed">
                      {def.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Capabilities */}
          <section className="bg-[#111111]/60 border border-[#252525] rounded-2xl p-5 space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-[#f5f0e8]">
                Your Capabilities
              </h2>
              <p className="text-[12px] text-[#888] mt-1">
                Toggle what you can actually deliver. This directly affects fit
                scoring — only leads you can serve will score highly.
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
                      setCapabilities((c: Record<Capability, boolean>) => ({ ...c, [cap]: !c[cap] }))
                    }
                    className={
                      "flex items-center gap-2 px-3 py-2 rounded-lg border text-[12px] font-medium transition-all " +
                      (active
                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-300"
                        : "border-[#2a2a2a] bg-[#111111]/40 text-[#888] hover:border-[#333]")
                    }
                  >
                    <span>{CAPABILITY_ICONS[cap]}</span>
                    <span>{CAPABILITY_LABELS[cap]}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Profile settings */}
          <section className="bg-[#111111]/60 border border-[#252525] rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-[#f5f0e8]">
              Preferences
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

              {/* Experience level */}
              <div className="space-y-1">
                <label className="text-[11px] uppercase tracking-wide text-[#888]">
                  Experience Level
                </label>
                <div className="flex gap-2">
                  {(["beginner", "intermediate", "advanced"] as const).map(
                    (v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() =>
                          setProfile((p: ProfileData) => ({ ...p, experienceLevel: v }))
                        }
                        className={
                          "flex-1 py-1.5 rounded-lg border text-[11px] capitalize transition-colors " +
                          (profile.experienceLevel === v
                            ? "border-[#c9a84c] bg-[#c9a84c]/10 text-[#c9a84c]"
                            : "border-[#2a2a2a] text-[#888] hover:border-[#333]")
                        }
                      >
                        {v}
                      </button>
                    ),
                  )}
                </div>
              </div>

              {/* Acquisition style */}
              <div className="space-y-1">
                <label className="text-[11px] uppercase tracking-wide text-[#888]">
                  Acquisition Style
                </label>
                <div className="flex gap-2">
                  {(["aggressive", "balanced", "premium"] as const).map(
                    (v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() =>
                          setProfile((p: ProfileData) => ({ ...p, acquisitionStyle: v }))
                        }
                        className={
                          "flex-1 py-1.5 rounded-lg border text-[11px] capitalize transition-colors " +
                          (profile.acquisitionStyle === v
                            ? "border-[#c9a84c] bg-[#c9a84c]/10 text-[#c9a84c]"
                            : "border-[#2a2a2a] text-[#888] hover:border-[#333]")
                        }
                      >
                        {v}
                      </button>
                    ),
                  )}
                </div>
              </div>

              {/* Target business size */}
              <div className="space-y-1">
                <label className="text-[11px] uppercase tracking-wide text-[#888]">
                  Target Business Size
                </label>
                <div className="flex gap-2">
                  {(["small", "medium", "large"] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() =>
                        setProfile((p: ProfileData) => ({
                          ...p,
                          targetBusinessSize: v,
                        }))
                      }
                      className={
                        "flex-1 py-1.5 rounded-lg border text-[11px] capitalize transition-colors " +
                        (profile.targetBusinessSize === v
                          ? "border-[#c9a84c] bg-[#c9a84c]/10 text-[#c9a84c]"
                          : "border-[#2a2a2a] text-[#888] hover:border-[#333]")
                      }
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Save button */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 rounded-lg bg-[#c9a84c] hover:bg-[#c9a84c] disabled:opacity-50 text-white text-sm font-semibold transition-colors"
            >
              {saving ? "Saving…" : "Save Profile"}
            </button>
            {saved && (
              <span className="text-[12px] text-emerald-400">
                ✓ Profile saved — new lead searches will use your updated
                profile.
              </span>
            )}
          </div>
        </div>
      )}

      {/* STATS TAB */}
      {activeTab === "stats" && (
        <div className="space-y-6">
          <section className="bg-[#111111]/60 border border-[#252525] rounded-2xl p-5 space-y-5">
            <h2 className="text-sm font-semibold text-[#f5f0e8]">
              Pipeline Overview
            </h2>

            {stats === null ? (
              <p className="text-[12px] text-[#888]">
                No outcome data yet. Start tracking leads in the Tracking tab.
              </p>
            ) : (
              <>
                {/* Funnel bars */}
                <div className="space-y-3">
                  {[
                    {
                      label: "Contacted",
                      value: stats.contacted,
                      color: "bg-blue-500",
                      icon: "📬",
                    },
                    {
                      label: "Replied",
                      value: stats.replied,
                      color: "bg-[#c9a84c]",
                      icon: "💬",
                    },
                    {
                      label: "Booked",
                      value: stats.booked,
                      color: "bg-violet-500",
                      icon: "📅",
                    },
                    {
                      label: "Closed",
                      value: stats.closed,
                      color: "bg-emerald-500",
                      icon: "✅",
                    },
                  ].map((row) => {
                    const maxVal = stats.contacted || 1;
                    const pct = Math.round((row.value / maxVal) * 100);
                    return (
                      <div key={row.label} className="space-y-1">
                        <div className="flex items-center justify-between text-[12px]">
                          <span className="text-[#aaa]">
                            {row.icon} {row.label}
                          </span>
                          <span className="text-[#f5f0e8] font-semibold">
                            {row.value}
                          </span>
                        </div>
                        <div className="w-full bg-[#1a1a1a] rounded-full h-2">
                          <div
                            className={row.color + " h-2 rounded-full transition-all"}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Conversion rates */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                  {[
                    {
                      label: "Contact → Reply",
                      rate: conversionRate(
                        stats.replied,
                        stats.contacted,
                      ),
                    },
                    {
                      label: "Reply → Booked",
                      rate: conversionRate(stats.booked, stats.replied),
                    },
                    {
                      label: "Booked → Closed",
                      rate: conversionRate(stats.closed, stats.booked),
                    },
                    {
                      label: "Overall Close Rate",
                      rate: conversionRate(
                        stats.closed,
                        stats.contacted,
                      ),
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-lg border border-[#252525] bg-[#111111]/50 p-3 text-center space-y-1"
                    >
                      <p className="text-[10px] uppercase tracking-wide text-[#888]">
                        {item.label}
                      </p>
                      <p className="text-lg font-bold text-[#f5f0e8]">
                        {item.rate}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Revenue summary */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="rounded-xl border border-[rgba(201,168,76,0.2)] bg-[rgba(201,168,76,0.04)] p-4 text-center space-y-1">
                    <p className="text-[10px] uppercase tracking-widest text-[#8a6e30]">Total Revenue</p>
                    <p className="text-2xl font-bold text-[#c9a84c]">
                      {stats.totalRevenue > 0
                        ? `$${stats.totalRevenue.toLocaleString()}`
                        : "—"}
                    </p>
                    <p className="text-[11px] text-[#555]">from {stats.closed} closed deal{stats.closed !== 1 ? "s" : ""}</p>
                  </div>
                  <div className="rounded-xl border border-[#252525] bg-[#111111]/50 p-4 text-center space-y-1">
                    <p className="text-[10px] uppercase tracking-widest text-[#888]">Avg Deal Size</p>
                    <p className="text-2xl font-bold text-[#f5f0e8]">
                      {stats.closed > 0 && stats.totalRevenue > 0
                        ? `$${Math.round(stats.totalRevenue / stats.closed).toLocaleString()}`
                        : "—"}
                    </p>
                    <p className="text-[11px] text-[#555]">per closed lead</p>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
