"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import HamburgerMenu from "../components/HamburgerMenu";
import {
  PROFILE_TYPE_DEFINITIONS,
  type ProfileTypeKey,
} from "@/lib/profile/profileTypes";
import type { Capability } from "@/lib/fit/needs";

type ProfileData = {
  profileType: string;
  businessName: string;
  experienceLevel: string;
  targetBusinessSize: string;
  acquisitionStyle: string;
  targetLocation: string;
};

type OutcomeStats = {
  contacted: number;
  replied: number;
  booked: number;
  closed: number;
  totalRevenue: number;
};

const CAPABILITY_LABELS: Record<Capability, string> = {
  ads: "Paid Ads",
  tracking: "Analytics & Tracking",
  funnel: "Funnel Building",
  content: "Content Creation",
  website: "Website / Landing Pages",
  seo: "SEO",
  crm: "CRM / Follow-up",
};

function conversionRate(a: number, b: number): string {
  if (b === 0) return "—";
  return Math.round((a / b) * 100) + "%";
}

export default function ProfileOverview() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [capabilities, setCapabilities] = useState<Record<string, boolean>>({});
  const [stats, setStats] = useState<OutcomeStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
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
              targetBusinessSize: data.profile.targetBusinessSize ?? "small",
              acquisitionStyle: data.profile.acquisitionStyle ?? "balanced",
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
        console.error("Profile overview load error:", err);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  const profileDef = profile
    ? PROFILE_TYPE_DEFINITIONS[profile.profileType as ProfileTypeKey] ?? null
    : null;

  const activeCapabilities = Object.entries(capabilities)
    .filter(([, v]) => v)
    .map(([k]) => k as Capability);

  return (
    <div className="min-h-screen bg-[#080808] text-[#f5f0e8]">

      {/* Nav */}
      <nav className="w-full border-b border-[#151515] bg-[#080808]/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-[#c9a84c]">◈</span>
            <Link
              href="/"
              className="text-[17px] font-light tracking-wide hover:opacity-80 transition-opacity"
              style={{ fontFamily: "var(--font-display), serif" }}
            >
              LeadGen
              <span style={{
                background: "linear-gradient(135deg, #e8c97a 0%, #c9a84c 50%, #8a6e30 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}>OS</span>
            </Link>
            <span className="text-[9px] tracking-[0.15em] uppercase px-2 py-0.5 rounded-full border border-[rgba(201,168,76,0.25)] text-[#8a6e30]">Beta</span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="text-[12px] text-[#555] hover:text-[#888] transition-colors tracking-wide"
            >
              ← Dashboard
            </Link>
            {/* Settings cogwheel */}
            <Link
              href="/profile/settings"
              className="w-8 h-8 rounded-lg border border-[#252525] bg-[#111] flex items-center justify-center text-[#666] hover:border-[rgba(201,168,76,0.3)] hover:text-[#c9a84c] transition-all"
              title="Profile Settings"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </Link>
            <HamburgerMenu hasProfile={true} />
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-5 py-10 space-y-6">

        {/* Page title */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] tracking-[0.2em] uppercase text-[#8a6e30] mb-1">Overview</p>
            <h1 className="text-3xl md:text-4xl font-light" style={{ fontFamily: "var(--font-display), serif" }}>
              Your <span className="italic" style={{ color: "#c9a84c" }}>Profile</span>
            </h1>
          </div>
          <Link
            href="/profile/settings"
            className="hidden md:flex items-center gap-2 text-[12px] px-4 py-2 rounded-xl border border-[#252525] text-[#888] hover:border-[rgba(201,168,76,0.3)] hover:text-[#c9a84c] transition-all"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            Profile Settings
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24 text-[#555] text-sm">
            <span className="animate-pulse">Loading…</span>
          </div>
        ) : (
          <>
            {/* Identity card */}
            <section className="rounded-2xl border border-[#1a1a1a] bg-[#0d0d0d] p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-xl border border-[rgba(201,168,76,0.2)] bg-[rgba(201,168,76,0.05)] flex items-center justify-center text-[#c9a84c] text-xl font-light" style={{ fontFamily: "var(--font-display), serif" }}>
                    {(profile?.businessName?.[0] ?? "◈")}
                  </div>
                  <div>
                    <p className="text-[16px] font-medium text-[#f5f0e8]">
                      {profile?.businessName || "Unnamed Business"}
                    </p>
                    <p className="text-[12px] text-[#555] mt-0.5">
                      {profileDef?.label ?? profile?.profileType ?? "—"}
                      {profile?.targetLocation ? ` · ${profile.targetLocation}` : ""}
                    </p>
                  </div>
                </div>
                <Link
                  href="/profile/settings"
                  className="shrink-0 text-[11px] px-3 py-1.5 rounded-lg border border-[#252525] text-[#666] hover:border-[rgba(201,168,76,0.25)] hover:text-[#c9a84c] transition-all flex items-center gap-1.5"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                  Edit
                </Link>
              </div>

              {/* Capabilities strip */}
              {activeCapabilities.length > 0 && (
                <div className="mt-5 pt-4 border-t border-[#141414]">
                  <p className="text-[10px] uppercase tracking-[0.15em] text-[#444] mb-2.5">Active capabilities</p>
                  <div className="flex flex-wrap gap-2">
                    {activeCapabilities.map((cap) => (
                      <span key={cap} className="text-[11px] px-2.5 py-1 rounded-lg border border-[#1e1e1e] bg-[#111] text-[#888]">
                        {CAPABILITY_LABELS[cap] ?? cap}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Profile preferences strip */}
              <div className="mt-4 pt-4 border-t border-[#141414] flex flex-wrap gap-x-6 gap-y-2">
                {[
                  { label: "Experience", value: profile?.experienceLevel },
                  { label: "Style", value: profile?.acquisitionStyle },
                  { label: "Target size", value: profile?.targetBusinessSize },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-1.5">
                    <span className="text-[10px] uppercase tracking-wide text-[#444]">{item.label}</span>
                    <span className="text-[11px] text-[#777] capitalize">{item.value ?? "—"}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Pipeline stats */}
            <section className="rounded-2xl border border-[#1a1a1a] bg-[#0d0d0d] p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-[13px] font-semibold text-[#c8c0b0]">Pipeline</h2>
                {stats && stats.contacted > 0 && (
                  <p className="text-[11px] text-[#555]">{stats.contacted} total outreach</p>
                )}
              </div>

              {!stats || stats.contacted === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-[13px] text-[#444]">No pipeline data yet.</p>
                  <p className="text-[11px] text-[#333] mt-1">
                    Start tracking leads in the{" "}
                    <Link href="/dashboard" className="text-[#8a6e30] hover:text-[#c9a84c] transition-colors">
                      Dashboard →
                    </Link>
                  </p>
                </div>
              ) : (
                <>
                  {/* Funnel bars */}
                  <div className="space-y-3">
                    {[
                      { label: "Contacted", value: stats.contacted, color: "#3b82f6" },
                      { label: "Replied", value: stats.replied, color: "#c9a84c" },
                      { label: "Booked", value: stats.booked, color: "#8b5cf6" },
                      { label: "Closed", value: stats.closed, color: "#4ade80" },
                    ].map((row) => {
                      const pct = Math.round((row.value / (stats.contacted || 1)) * 100);
                      return (
                        <div key={row.label}>
                          <div className="flex items-center justify-between text-[11px] mb-1.5">
                            <span className="text-[#666]">{row.label}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-[#888] font-medium">{pct}%</span>
                              <span className="text-[#f5f0e8] font-bold w-6 text-right">{row.value}</span>
                            </div>
                          </div>
                          <div className="w-full bg-[#141414] rounded-full h-1.5">
                            <div
                              className="h-1.5 rounded-full transition-all duration-700"
                              style={{ width: `${pct}%`, backgroundColor: row.color }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* KPI grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
                    {[
                      { label: "Contact → Reply", rate: conversionRate(stats.replied, stats.contacted) },
                      { label: "Reply → Booked", rate: conversionRate(stats.booked, stats.replied) },
                      { label: "Booked → Closed", rate: conversionRate(stats.closed, stats.booked) },
                      { label: "Overall Close", rate: conversionRate(stats.closed, stats.contacted) },
                    ].map((item) => (
                      <div key={item.label} className="rounded-xl border border-[#151515] bg-[#080808] p-3 text-center space-y-1">
                        <p className="text-[9px] uppercase tracking-wide text-[#444]">{item.label}</p>
                        <p className="text-xl font-bold text-[#f5f0e8]">{item.rate}</p>
                      </div>
                    ))}
                  </div>

                  {/* Revenue */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-[rgba(201,168,76,0.15)] bg-[rgba(201,168,76,0.03)] p-4 text-center space-y-1">
                      <p className="text-[9px] uppercase tracking-widest text-[#8a6e30]">Total Revenue</p>
                      <p className="text-2xl font-bold text-[#c9a84c]">
                        {stats.totalRevenue > 0 ? `$${stats.totalRevenue.toLocaleString()}` : "—"}
                      </p>
                      <p className="text-[10px] text-[#555]">{stats.closed} closed deal{stats.closed !== 1 ? "s" : ""}</p>
                    </div>
                    <div className="rounded-xl border border-[#151515] bg-[#080808] p-4 text-center space-y-1">
                      <p className="text-[9px] uppercase tracking-widest text-[#444]">Avg Deal Size</p>
                      <p className="text-2xl font-bold text-[#f5f0e8]">
                        {stats.closed > 0 && stats.totalRevenue > 0
                          ? `$${Math.round(stats.totalRevenue / stats.closed).toLocaleString()}`
                          : "—"}
                      </p>
                      <p className="text-[10px] text-[#555]">per closed lead</p>
                    </div>
                  </div>
                </>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
