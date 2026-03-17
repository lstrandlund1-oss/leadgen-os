"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import HamburgerMenu from "../components/HamburgerMenu";
import { createSupabaseBrowser } from "@/lib/supabaseBrowser";

type FollowupLead = {
  lead_id: string;
  run_id: number;
  company_name: string | null;
  followup_date: string;
  contacted: boolean;
  replied: boolean;
  notes: string | null;
  days_until: number;
  is_overdue: boolean;
};

function daysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 86400000);
}

export default function FollowupsPage() {
  const supabase = createSupabaseBrowser();
  const [userEmail, setUserEmail] = useState("");
  const [leads, setLeads] = useState<FollowupLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "overdue" | "today" | "upcoming">("all");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setUserEmail(data.user.email);
    });

    fetch("/api/outcomes?all=true")
      .then(r => r.json())
      .then((d: { outcomes?: Array<{
        lead_id: string; run_id: number; followup_date?: string | null;
        contacted: boolean; replied: boolean; notes?: string | null;
        company_name?: string | null;
      }> }) => {
        const withDates = (d.outcomes ?? [])
          .filter(o => o.followup_date)
          .map(o => {
            const days = daysUntil(o.followup_date!);
            return {
              lead_id: o.lead_id,
              run_id: o.run_id,
              company_name: o.company_name ?? null,
              followup_date: o.followup_date!,
              contacted: o.contacted,
              replied: o.replied,
              notes: o.notes ?? null,
              days_until: days,
              is_overdue: days < 0,
            };
          })
          .sort((a, b) => a.days_until - b.days_until);

        setLeads(withDates);
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = leads.filter(l => {
    if (filter === "overdue") return l.is_overdue;
    if (filter === "today") return l.days_until === 0;
    if (filter === "upcoming") return l.days_until > 0;
    return true;
  });

  const overdue = leads.filter(l => l.is_overdue).length;
  const today = leads.filter(l => l.days_until === 0).length;
  const upcoming = leads.filter(l => l.days_until > 0).length;

  function dateLabel(days: number): string {
    if (days < 0) return `${Math.abs(days)}d overdue`;
    if (days === 0) return "Today";
    if (days === 1) return "Tomorrow";
    return `In ${days} days`;
  }

  function dateColor(days: number): string {
    if (days < 0) return "#f87171";
    if (days === 0) return "#c9a84c";
    if (days <= 3) return "#fb923c";
    return "#4ade80";
  }

  return (
    <div className="min-h-screen bg-[#080808] text-[#f5f0e8]">
      <nav className="w-full border-b border-[#151515] bg-[#080808]/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-5 py-4 flex items-center justify-between">
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

      <div className="max-w-3xl mx-auto px-5 py-10 space-y-6">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] tracking-[0.2em] uppercase text-[#8a6e30] mb-1">Pipeline</p>
            <h1 className="text-3xl md:text-4xl font-light" style={{ fontFamily: "var(--font-display), serif" }}>
              Follow-up <span className="italic" style={{ color: "#c9a84c" }}>Queue</span>
            </h1>
            <p className="text-[12px] text-[#444] mt-1.5">Leads with scheduled follow-up dates</p>
          </div>
          {overdue > 0 && (
            <div className="rounded-xl border border-[#f87171]/25 bg-[#f87171]/06 px-4 py-2 text-center">
              <p className="text-[18px] font-bold text-[#f87171]">{overdue}</p>
              <p className="text-[10px] text-[#f87171]/60 uppercase tracking-widest">Overdue</p>
            </div>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2">
          {([
            { key: "all",      label: `All (${leads.length})` },
            { key: "overdue",  label: `Overdue (${overdue})` },
            { key: "today",    label: `Today (${today})` },
            { key: "upcoming", label: `Upcoming (${upcoming})` },
          ] as const).map(({ key, label }) => (
            <button key={key} type="button" onClick={() => setFilter(key)}
              className={"px-3 py-1.5 rounded-lg border text-[11px] font-medium transition-all " + (filter === key ? "border-[#c9a84c] bg-[rgba(201,168,76,0.08)] text-[#c9a84c]" : "border-[#252525] text-[#555] hover:border-[#333]")}>
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-20 text-center text-[#444] text-sm animate-pulse">Loading…</div>
        ) : leads.length === 0 ? (
          <div className="rounded-2xl border border-[#1a1a1a] bg-[#0d0d0d] p-12 text-center space-y-3">
            <p className="text-3xl text-[#222]">◎</p>
            <p className="text-[14px] text-[#444]">No follow-ups scheduled</p>
            <p className="text-[12px] text-[#2a2a2a] leading-relaxed max-w-xs mx-auto">
              Set a follow-up date on any lead in the dashboard tracking tab to see it here.
            </p>
            <Link href="/dashboard" className="inline-block mt-2 text-[12px] text-[#c9a84c] hover:text-[#e8c97a] transition-colors">
              Go to Dashboard →
            </Link>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-[#1a1a1a] bg-[#0d0d0d] p-8 text-center">
            <p className="text-[13px] text-[#444]">No leads match this filter</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((lead) => {
              const color = dateColor(lead.days_until);
              return (
                <div key={lead.lead_id} className="rounded-2xl border border-[#1a1a1a] bg-[#0d0d0d] p-4 flex items-start gap-4">
                  {/* Date badge */}
                  <div className="flex-shrink-0 rounded-xl border px-3 py-2.5 text-center min-w-[72px]"
                    style={{ borderColor: `${color}35`, backgroundColor: `${color}0a` }}>
                    <p className="text-[11px] font-bold" style={{ color }}>{dateLabel(lead.days_until)}</p>
                    <p className="text-[9px] mt-0.5" style={{ color: `${color}80` }}>
                      {new Date(lead.followup_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </p>
                  </div>

                  {/* Lead info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium text-[#c8c0b0] truncate">
                      {lead.company_name ?? `Lead ${lead.lead_id.slice(0, 8)}`}
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      {lead.contacted && <span className="text-[10px] text-[#3b82f6]">✓ Contacted</span>}
                      {lead.replied && <span className="text-[10px] text-[#c9a84c]">✓ Replied</span>}
                      {!lead.contacted && <span className="text-[10px] text-[#444]">Not contacted yet</span>}
                    </div>
                    {lead.notes && (
                      <p className="text-[11px] text-[#555] mt-1.5 line-clamp-2 leading-relaxed">{lead.notes}</p>
                    )}
                  </div>

                  {/* Action */}
                  <Link href="/dashboard"
                    className="flex-shrink-0 px-3 py-2 rounded-xl border border-[#252525] text-[11px] text-[#555] hover:border-[rgba(201,168,76,0.3)] hover:text-[#c9a84c] transition-all whitespace-nowrap">
                    Open →
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
