"use client";

import { useEffect, useState } from "react";
import type { Capability } from "@/lib/fit/needs";
import { useToast } from "../components/ToastProvider";
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
  acquisitionStyle: "volume" | "balanced" | "selective";
  budgetPreference: "low" | "medium" | "high";
  targetLocation: string;
  offerDescription: string;
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
  const { success: toastSuccess, error: toastError } = useToast();
  const [profile, setProfile] = useState<ProfileData>({
    profileType: "performance_marketer",
    businessName: "",
    experienceLevel: "intermediate",
    targetBusinessSize: "small",
    acquisitionStyle: "balanced",
    budgetPreference: "medium",
    targetLocation: "",
    offerDescription: "",
  });

  const [capabilities, setCapabilities] = useState<Record<Capability, number>>({
      ads: 90,
      tracking: 80,
      funnel: 80,
      content: 20,
      website: 20,
      seo: 10,
      crm: 30,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Load profile + stats on mount
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [profileRes] = await Promise.all([
          fetch("/api/profile"),
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
              offerDescription: data.profile.offerDescription ?? "",
            });
          }
          if (data.capabilities?.capabilities) {
            // Migrate legacy boolean profiles to numeric on load
            const raw = data.capabilities.capabilities as Record<string, unknown>;
            const migrated = Object.fromEntries(
              Object.entries(raw).map(([k, v]) => [
                k,
                typeof v === "boolean" ? (v ? 100 : 0) : typeof v === "number" ? v : 0,
              ])
            ) as Record<Capability, number>;
            setCapabilities(migrated);
          }
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
    setCapabilities(Object.fromEntries(
      Object.entries(def.defaultCapabilities).map(([k, v]) => [k, typeof v === 'boolean' ? (v ? 100 : 0) : v])
    ) as Record<Capability, number>);
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
          offerDescription: profile.offerDescription,
          capabilities,
        }),
      });
      if (res.ok) {
        setSaved(true);
        toastSuccess("Profile saved — new searches will use your updated settings");
      } else {
        toastError("Failed to save profile. Please try again.");
      }
    } catch (err) {
      console.error("Save error:", err);
      toastError("Failed to save profile. Please try again.");
    } finally {
      setSaving(false);
    }
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
      {/* Settings header */}
      <div className="pb-2 border-b border-[#252525]">
        <p className="text-[11px] uppercase tracking-widest text-[#555]">Profile Settings</p>
      </div>

      {/* PROFILE SETTINGS */}
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

            <div className="space-y-1">
              <label className="text-[11px] uppercase tracking-wide text-[#888]">
                Your offer
                <span className="ml-2 normal-case text-[#444]">— used by default in outreach generation</span>
              </label>
              <textarea
                rows={4}
                value={profile.offerDescription}
                onChange={(e) =>
                  setProfile((p: ProfileData) => ({ ...p, offerDescription: e.target.value }))
                }
                placeholder="e.g. We run Meta and Google ads, build high-converting landing pages, and set up full tracking for service businesses. We typically work with local businesses doing 1–10M SEK/year in revenue."
                className="w-full bg-[#080808] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-[#f5f0e8] placeholder-slate-600 focus:outline-none focus:border-[#c9a84c] resize-none"
              />
              <p className="text-[11px] text-[#444]">
                This is loaded automatically in Contact Leads when you generate outreach. You can always override it per message.
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
          <section className="bg-[#111111]/60 border border-[#252525] rounded-2xl p-5 space-y-5">
            <div>
              <h2 className="text-sm font-semibold text-[#f5f0e8]">
                Capability Depths
              </h2>
              <p className="text-[12px] text-[#888] mt-1">
                Set how much resource and expertise your team allocates to each area.
                0 = not offered. 100 = your core specialisation.
                A specialist with deep focus in one area scores higher than a generalist
                who spreads resources thin — leads are matched accordingly.
              </p>
            </div>
            <div className="space-y-4">
              {ALL_CAPABILITIES.map((cap) => {
                const depth = typeof capabilities[cap] === "number" ? capabilities[cap] : 0;
                const isActive = depth > 0;
                const isStrong = depth >= 70;
                const labelColor = isStrong
                  ? "text-[#c9a84c]"
                  : isActive
                  ? "text-[#f5f0e8]"
                  : "text-[#555]";
                const depthLabel =
                  depth === 0 ? "Not offered"
                  : depth < 30 ? "Light"
                  : depth < 60 ? "Capable"
                  : depth < 80 ? "Strong"
                  : "Specialist";
                const trackColor = isStrong
                  ? "accent-[#c9a84c]"
                  : isActive
                  ? "accent-emerald-400"
                  : "accent-[#444]";
                return (
                  <div key={cap} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className={"flex items-center gap-2 text-[12px] font-medium " + labelColor}>
                        <span>{CAPABILITY_ICONS[cap]}</span>
                        <span>{CAPABILITY_LABELS[cap]}</span>
                      </span>
                      <span className="text-[11px] text-[#555] tabular-nums">
                        {depth > 0 ? <span className="text-[#888]">{depthLabel} · </span> : null}
                        <span className={isStrong ? "text-[#c9a84c]" : "text-[#555]"}>
                          {depth}%
                        </span>
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
                      className={"w-full h-1.5 rounded-full appearance-none bg-[#1a1a1a] cursor-pointer " + trackColor}
                    />
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-[#444] pt-1">
              Tip — a specialist with one or two capabilities at 80%+ gets a match bonus
              on leads where those are the primary need.
            </p>
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
                  {(["volume", "balanced", "selective"] as const).map(
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
                ✓ Profile saved — new lead searches will use your updated profile.
              </span>
            )}
          </div>

          {/* GDPR — Delete account */}
          <DeleteAccountSection />
        </div>

    </div>
  );
}


// ---------------------------------------------------------------------------
// GDPR Delete Account Section
// ---------------------------------------------------------------------------
function DeleteAccountSection() {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (confirm !== "DELETE") { setError('Type "DELETE" to confirm.'); return; }
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/account/delete", { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError((json as { error?: string }).error ?? "Deletion failed. Please contact support.");
        setDeleting(false);
        return;
      }
      // Sign out and redirect to home
      window.location.href = "/?deleted=1";
    } catch {
      setError("Network error. Please try again.");
      setDeleting(false);
    }
  }

  return (
    <section className="mt-8 pt-8 border-t border-[#1a1a1a]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[13px] font-semibold text-[#888]">Danger zone</h2>
          <p className="text-[11px] text-[#444] mt-0.5 leading-relaxed">
            Permanently delete your account and all associated data. This cannot be undone.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="shrink-0 text-[12px] px-4 py-2 rounded-lg border border-rose-900/50 text-rose-600 hover:border-rose-700 hover:text-rose-400 transition-all"
        >
          Delete account
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-rose-900/40 bg-[#0d0d0d] p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg border border-rose-900/50 bg-rose-950/30 flex items-center justify-center text-rose-500 text-sm">⚠</div>
              <div>
                <p className="text-[14px] font-semibold text-[#f5f0e8]">Delete your account</p>
                <p className="text-[11px] text-[#555]">This action is permanent and irreversible</p>
              </div>
            </div>

            <p className="text-[12px] text-[#666] leading-relaxed">
              This will permanently delete your profile, all saved searches, lead outcomes, and your login credentials.
              Your data will be erased in accordance with GDPR Article 17.
            </p>

            {error && (
              <div className="px-3 py-2 rounded-lg border border-rose-500/30 bg-rose-500/5 text-[12px] text-rose-400">{error}</div>
            )}

            <div className="space-y-1.5">
              <label className="block text-[11px] uppercase tracking-widest text-[#555]">
                Type <span className="text-rose-500 font-bold">DELETE</span> to confirm
              </label>
              <input
                type="text"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="DELETE"
                className="w-full bg-[#080808] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-[#f5f0e8] placeholder-[#333] focus:outline-none focus:border-rose-800 transition-colors"
              />
            </div>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => { setOpen(false); setConfirm(""); setError(null); }}
                className="flex-1 py-2.5 rounded-lg border border-[#252525] text-[#888] text-[13px] hover:border-[#333] hover:text-[#aaa] transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting || confirm !== "DELETE"}
                className="flex-1 py-2.5 rounded-lg bg-rose-900/80 text-rose-200 text-[13px] font-semibold hover:bg-rose-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {deleting ? "Deleting…" : "Yes, delete everything"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
