"use client";

import Link from "next/link";
import { useEffect, useState, useMemo } from "react";
import HamburgerMenu from "../components/HamburgerMenu";

type Outcome = {
  id: string;
  lead_id: string;
  run_id: number;
  contacted: boolean;
  replied: boolean;
  booked_call: boolean;
  closed: boolean;
  revenue: number | null;
  notes: string | null;
  tonality: "soft" | "direct" | null;
  angle_type: string | null;
  created_at: string;
  updated_at: string;
};

function pct(a: number, b: number) {
  if (b === 0) return 0;
  return Math.round((a / b) * 100);
}

function fmt(n: number) {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n.toLocaleString()}`;
}

// Group outcomes by week (YYYY-WW)
function getWeekKey(dateStr: string) {
  const d = new Date(dateStr);
  const year = d.getFullYear();
  const start = new Date(year, 0, 1);
  const week = Math.ceil(((d.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

function getWeekLabel(key: string) {
  const [, w] = key.split("-W");
  return `W${w}`;
}

type WeeklyPoint = {
  week: string;
  contacted: number;
  replied: number;
  booked: number;
  closed: number;
  replyRate: number;
  closeRate: number;
  revenue: number;
};

export default function AnalyticsPage() {
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<"all" | "30d" | "90d">("all");
  const [demoMode, setDemoMode] = useState(false);

  useEffect(() => {
    fetch("/api/outcomes?all=true")
      .then((r) => r.json())
      .then((d) => setOutcomes(d.outcomes ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const mockOutcomes = useMemo<Outcome[]>(() => {
    const now = new Date();
    const rows: Outcome[] = [];
    const angles = ["Conversion system upgrade", "Visibility + demand capture", "Foundation-first fix", "Value-first teardown", "Direct growth system"];
    const tonalities: ("soft" | "direct")[] = ["soft", "direct"];
    let id = 1;
    for (let week = 7; week >= 0; week--) {
      const base = new Date(now);
      base.setDate(base.getDate() - week * 7);
      const count = 4 + Math.floor(Math.random() * 6);
      for (let i = 0; i < count; i++) {
        const d = new Date(base);
        d.setDate(d.getDate() + Math.floor(Math.random() * 7));
        const replied = Math.random() < 0.22;
        const booked = replied && Math.random() < 0.45;
        const closed = booked && Math.random() < 0.6;
        rows.push({
          id: String(id++),
          lead_id: `lead-${id}`,
          run_id: week + 1,
          contacted: true,
          replied,
          booked_call: booked,
          closed,
          revenue: closed ? 500 + Math.floor(Math.random() * 4500) : null,
          notes: null,
          tonality: tonalities[Math.floor(Math.random() * 2)],
          angle_type: angles[Math.floor(Math.random() * angles.length)],
          created_at: d.toISOString(),
          updated_at: d.toISOString(),
        });
      }
    }
    return rows;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeData = demoMode ? mockOutcomes : outcomes;

  const filtered = useMemo(() => {
    if (timeRange === "all") return activeData;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - (timeRange === "30d" ? 30 : 90));
    return activeData.filter((o) => new Date(o.created_at) >= cutoff);
  }, [activeData, timeRange]);

  // ── Core funnel stats ──
  const total = filtered.length;
  const contacted = filtered.filter((o) => o.contacted).length;
  const replied = filtered.filter((o) => o.replied).length;
  const booked = filtered.filter((o) => o.booked_call).length;
  const closed = filtered.filter((o) => o.closed).length;
  const revenue = filtered.reduce((s, o) => s + (o.revenue ?? 0), 0);
  const avgDeal = closed > 0 ? Math.round(revenue / closed) : 0;

  // ── Tonality breakdown ──
  const softOutcomes = filtered.filter((o) => o.tonality === "soft");
  const directOutcomes = filtered.filter((o) => o.tonality === "direct");
  const softContacted = softOutcomes.filter((o) => o.contacted).length;
  const softReplied = softOutcomes.filter((o) => o.replied).length;
  const softClosed = softOutcomes.filter((o) => o.closed).length;
  const directContacted = directOutcomes.filter((o) => o.contacted).length;
  const directReplied = directOutcomes.filter((o) => o.replied).length;
  const directClosed = directOutcomes.filter((o) => o.closed).length;

  // ── Angle type breakdown ──
  const angleMap = new Map<string, { contacted: number; replied: number; closed: number; revenue: number }>();
  filtered.forEach((o) => {
    const key = o.angle_type ?? "Unknown";
    const existing = angleMap.get(key) ?? { contacted: 0, replied: 0, closed: 0, revenue: 0 };
    angleMap.set(key, {
      contacted: existing.contacted + (o.contacted ? 1 : 0),
      replied: existing.replied + (o.replied ? 1 : 0),
      closed: existing.closed + (o.closed ? 1 : 0),
      revenue: existing.revenue + (o.revenue ?? 0),
    });
  });
  const angleRows = Array.from(angleMap.entries())
    .map(([name, stats]) => ({ name, ...stats, replyRate: pct(stats.replied, stats.contacted) }))
    .sort((a, b) => b.replyRate - a.replyRate);

  // ── Weekly trend ──
  const weeklyMap = new Map<string, WeeklyPoint>();
  filtered.forEach((o) => {
    const week = getWeekKey(o.created_at);
    const existing = weeklyMap.get(week) ?? { week, contacted: 0, replied: 0, booked: 0, closed: 0, replyRate: 0, closeRate: 0, revenue: 0 };
    weeklyMap.set(week, {
      ...existing,
      contacted: existing.contacted + (o.contacted ? 1 : 0),
      replied: existing.replied + (o.replied ? 1 : 0),
      booked: existing.booked + (o.booked_call ? 1 : 0),
      closed: existing.closed + (o.closed ? 1 : 0),
      revenue: existing.revenue + (o.revenue ?? 0),
    });
  });
  const weeklyData: WeeklyPoint[] = Array.from(weeklyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => ({
      ...v,
      replyRate: pct(v.replied, v.contacted),
      closeRate: pct(v.closed, v.contacted),
    }));

  const maxContacted = Math.max(...weeklyData.map((w) => w.contacted), 1);
  const maxRate = 100;

  // ── Best performing week ──
  const bestReplyWeek = weeklyData.reduce<WeeklyPoint | null>((best, w) => {
    if (!best) return w.contacted > 0 ? w : null;
    return w.replyRate > best.replyRate && w.contacted > 0 ? w : best;
  }, null);

  const hasData = contacted > 0;

  return (
    <div className="min-h-screen bg-[#080808] text-[#f5f0e8]">

      {/* Nav */}
      <nav className="w-full border-b border-[#151515] bg-[#080808]/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-[#c9a84c]">◈</span>
            <Link href="/" className="text-[17px] font-light tracking-wide hover:opacity-80 transition-opacity" style={{ fontFamily: "var(--font-display), serif" }}>
              LeadGen<span style={{ background: "linear-gradient(135deg, #e8c97a 0%, #c9a84c 50%, #8a6e30 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>OS</span>
            </Link>
            <span className="text-[9px] tracking-[0.15em] uppercase px-2 py-0.5 rounded-full border border-[rgba(201,168,76,0.25)] text-[#8a6e30]">Beta</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/profile" className="text-[12px] text-[#555] hover:text-[#888] transition-colors tracking-wide">← Profile</Link>
            <Link href="/dashboard" className="text-[12px] text-[#555] hover:text-[#888] transition-colors tracking-wide">Dashboard</Link>
            <HamburgerMenu hasProfile={true} />
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-5 py-10 space-y-8">

        {/* Header + time range */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] tracking-[0.2em] uppercase text-[#8a6e30] mb-1">Performance</p>
            <h1 className="text-3xl md:text-4xl font-light" style={{ fontFamily: "var(--font-display), serif" }}>
              Your <span className="italic" style={{ color: "#c9a84c" }}>Analytics</span>
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setDemoMode(!demoMode)}
              className={`text-[11px] px-3 py-1.5 rounded-lg border transition-all ${demoMode ? "border-[#c9a84c]/40 bg-[rgba(201,168,76,0.08)] text-[#c9a84c]" : "border-[#252525] text-[#444] hover:text-[#666]"}`}>
              {demoMode ? "◉ Demo on" : "◎ Preview"}
            </button>
            <div className="flex items-center gap-1 rounded-xl border border-[#1a1a1a] bg-[#0d0d0d] p-1">
              {(["30d", "90d", "all"] as const).map((r) => (
                <button key={r} onClick={() => setTimeRange(r)}
                  className={`text-[11px] px-3 py-1.5 rounded-lg transition-all ${timeRange === r ? "bg-[#1a1a1a] text-[#f5f0e8]" : "text-[#555] hover:text-[#888]"}`}>
                  {r === "all" ? "All time" : r === "30d" ? "30 days" : "90 days"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {demoMode && (
          <div className="rounded-xl border border-[rgba(201,168,76,0.2)] bg-[rgba(201,168,76,0.04)] px-4 py-2.5 flex items-center gap-2">
            <span className="text-[#c9a84c] text-sm">◉</span>
            <p className="text-[11px] text-[#8a6e30]">Demo mode — showing sample data so you can preview what analytics look like with real usage.</p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-32 text-[#555] text-sm">
            <span className="animate-pulse">Loading analytics…</span>
          </div>
        ) : !hasData ? (
          <div className="rounded-2xl border border-[#1a1a1a] bg-[#0d0d0d] p-16 text-center space-y-3">
            <p className="text-4xl">📊</p>
            <p className="text-[15px] text-[#555]">No data yet.</p>
            <p className="text-[12px] text-[#333]">Start contacting leads from the dashboard and mark their outcomes. Your analytics will appear here.</p>
            <div className="flex items-center justify-center gap-3 mt-3">
              <Link href="/dashboard" className="text-[12px] text-[#c9a84c] hover:text-[#e8c97a] transition-colors">Go to Dashboard →</Link>
              <span className="text-[#333]">or</span>
              <button onClick={() => setDemoMode(true)} className="text-[12px] text-[#555] hover:text-[#888] transition-colors underline underline-offset-2">Preview with demo data</button>
            </div>
          </div>
        ) : (
          <>

            {/* ── KPI row ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Leads Contacted", value: contacted.toString(), sub: `${total} total tracked` },
                { label: "Reply Rate", value: `${pct(replied, contacted)}%`, sub: `${replied} replied` },
                { label: "Close Rate", value: `${pct(closed, contacted)}%`, sub: `${closed} deals closed` },
                { label: "Total Revenue", value: revenue > 0 ? fmt(revenue) : "—", sub: avgDeal > 0 ? `${fmt(avgDeal)} avg deal` : "no revenue logged" },
              ].map((kpi) => (
                <div key={kpi.label} className="rounded-2xl border border-[#1a1a1a] bg-[#0d0d0d] p-4 space-y-1">
                  <p className="text-[9px] uppercase tracking-widest text-[#444]">{kpi.label}</p>
                  <p className="text-2xl font-bold text-[#f5f0e8]">{kpi.value}</p>
                  <p className="text-[10px] text-[#333]">{kpi.sub}</p>
                </div>
              ))}
            </div>

            {/* ── Full funnel ── */}
            <section className="rounded-2xl border border-[#1a1a1a] bg-[#0d0d0d] p-6 space-y-5">
              <div>
                <p className="text-[10px] uppercase tracking-[0.15em] text-[#8a6e30] mb-1">Pipeline</p>
                <h2 className="text-[15px] font-semibold text-[#c8c0b0]">Conversion Funnel</h2>
              </div>
              <div className="space-y-4">
                {[
                  { label: "Contacted", value: contacted, color: "#3b82f6", pctOf: contacted },
                  { label: "Replied", value: replied, color: "#c9a84c", pctOf: contacted, bench: "15–25%" },
                  { label: "Call Booked", value: booked, color: "#8b5cf6", pctOf: replied, bench: "30–50% of replied" },
                  { label: "Closed", value: closed, color: "#4ade80", pctOf: booked, bench: "50–70% of booked" },
                ].map((row, i) => {
                  const base = i === 0 ? contacted : i === 1 ? contacted : i === 2 ? replied : booked;
                  const p = pct(row.value, base);
                  return (
                    <div key={row.label} className="space-y-1.5">
                      <div className="flex items-center justify-between text-[12px]">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ background: row.color }} />
                          <span className="text-[#888]">{row.label}</span>
                          {row.bench && <span className="text-[10px] text-[#333]">bench: {row.bench}</span>}
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-[#555]">{i === 0 ? "—" : `${p}%`}</span>
                          <span className="text-[#f5f0e8] font-bold w-8 text-right">{row.value}</span>
                        </div>
                      </div>
                      <div className="w-full bg-[#141414] rounded-full h-2">
                        <div className="h-2 rounded-full transition-all duration-700"
                          style={{ width: `${i === 0 ? 100 : p}%`, backgroundColor: row.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Stage conversion rates */}
              <div className="pt-2 border-t border-[#141414] grid grid-cols-3 gap-3">
                {[
                  { label: "Contact → Reply", value: pct(replied, contacted), bench: 20 },
                  { label: "Reply → Booked", value: pct(booked, replied), bench: 40 },
                  { label: "Booked → Closed", value: pct(closed, booked), bench: 60 },
                ].map(({ label, value, bench }) => {
                  const status = value >= bench * 1.2 ? "strong" : value >= bench * 0.7 ? "ok" : "weak";
                  const color = status === "strong" ? "#4ade80" : status === "ok" ? "#c9a84c" : "#f87171";
                  return (
                    <div key={label} className="rounded-xl border border-[#151515] bg-[#080808] p-3 text-center space-y-1">
                      <p className="text-[9px] uppercase tracking-wide text-[#444]">{label}</p>
                      <p className="text-xl font-bold" style={{ color }}>{value}%</p>
                      <p className="text-[10px]" style={{ color: `${color}80` }}>
                        {status === "strong" ? "Above avg" : status === "ok" ? "On track" : "Below avg"}
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* ── Weekly trend ── */}
            {weeklyData.length > 1 && (
              <section className="rounded-2xl border border-[#1a1a1a] bg-[#0d0d0d] p-6 space-y-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.15em] text-[#8a6e30] mb-1">Trends</p>
                    <h2 className="text-[15px] font-semibold text-[#c8c0b0]">Activity Over Time</h2>
                  </div>
                  {bestReplyWeek && (
                    <div className="text-right">
                      <p className="text-[10px] text-[#444]">Best reply week</p>
                      <p className="text-[13px] font-bold text-[#c9a84c]">{getWeekLabel(bestReplyWeek.week)} — {bestReplyWeek.replyRate}%</p>
                    </div>
                  )}
                </div>

                {/* Volume bars */}
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-[#444] mb-3">Leads contacted per week</p>
                  <div className="flex items-end gap-1.5 h-24">
                    {weeklyData.map((w) => {
                      const h = Math.max(4, Math.round((w.contacted / maxContacted) * 96));
                      return (
                        <div key={w.week} className="flex-1 flex flex-col items-center gap-1 group relative">
                          <div className="w-full rounded-t-sm bg-[#3b82f6]/40 hover:bg-[#3b82f6]/70 transition-colors cursor-default" style={{ height: `${h}px` }} />
                          <p className="text-[9px] text-[#333] group-hover:text-[#555]">{getWeekLabel(w.week)}</p>
                          {/* Tooltip */}
                          <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 bg-[#111] border border-[#252525] rounded-lg px-2 py-1.5 text-[10px] whitespace-nowrap space-y-0.5">
                            <p className="text-[#888]">{w.contacted} contacted</p>
                            <p className="text-[#c9a84c]">{w.replyRate}% reply</p>
                            <p className="text-[#4ade80]">{w.closeRate}% close</p>
                            {w.revenue > 0 && <p className="text-[#f5f0e8]">{fmt(w.revenue)}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Reply rate line chart (SVG) */}
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-[#444] mb-3">Reply rate % per week</p>
                  <div className="relative h-28">
                    <svg viewBox={`0 0 ${Math.max(weeklyData.length * 40, 200)} 80`} className="w-full h-full" preserveAspectRatio="none">
                      {/* Grid lines */}
                      {[0, 25, 50, 75, 100].map((g) => (
                        <line key={g} x1="0" y1={80 - (g / maxRate) * 80} x2="10000" y2={80 - (g / maxRate) * 80}
                          stroke="#1a1a1a" strokeWidth="0.5" />
                      ))}
                      {/* Reply rate line */}
                      {weeklyData.length > 1 && (
                        <polyline
                          points={weeklyData.map((w, i) => `${i * 40 + 20},${80 - (w.replyRate / maxRate) * 76}`).join(" ")}
                          fill="none" stroke="#c9a84c" strokeWidth="1.5" strokeLinejoin="round" />
                      )}
                      {/* Close rate line */}
                      {weeklyData.length > 1 && (
                        <polyline
                          points={weeklyData.map((w, i) => `${i * 40 + 20},${80 - (w.closeRate / maxRate) * 76}`).join(" ")}
                          fill="none" stroke="#4ade80" strokeWidth="1.5" strokeLinejoin="round" strokeDasharray="4 2" />
                      )}
                      {/* Dots */}
                      {weeklyData.map((w, i) => (
                        <circle key={w.week} cx={i * 40 + 20} cy={80 - (w.replyRate / maxRate) * 76} r="3" fill="#c9a84c" />
                      ))}
                    </svg>
                    {/* Legend */}
                    <div className="absolute top-0 right-0 flex items-center gap-4">
                      <div className="flex items-center gap-1.5">
                        <div className="w-4 h-0.5 bg-[#c9a84c]" />
                        <p className="text-[9px] text-[#555]">Reply rate</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-4 h-0.5 bg-[#4ade80] border-dashed" style={{ borderTop: "1.5px dashed #4ade80", background: "none" }} />
                        <p className="text-[9px] text-[#555]">Close rate</p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* ── Tonality breakdown ── */}
            {(softContacted > 0 || directContacted > 0) && (
              <section className="rounded-2xl border border-[#1a1a1a] bg-[#0d0d0d] p-6 space-y-5">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.15em] text-[#8a6e30] mb-1">Script Style</p>
                  <h2 className="text-[15px] font-semibold text-[#c8c0b0]">Soft vs Direct Tonality</h2>
                  <p className="text-[11px] text-[#444] mt-1">Which messaging style is actually getting responses.</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: "Soft", contacted: softContacted, replied: softReplied, closed: softClosed, color: "#8b5cf6" },
                    { label: "Direct", contacted: directContacted, replied: directReplied, closed: directClosed, color: "#c9a84c" },
                  ].map((t) => {
                    const rr = pct(t.replied, t.contacted);
                    const cr = pct(t.closed, t.contacted);
                    const winner = softContacted > 0 && directContacted > 0
                      ? (t.label === "Soft" ? pct(softReplied, softContacted) >= pct(directReplied, directContacted) : pct(directReplied, directContacted) > pct(softReplied, softContacted))
                      : false;
                    return (
                      <div key={t.label} className={`rounded-xl border p-4 space-y-3 ${winner ? "border-[rgba(201,168,76,0.3)] bg-[rgba(201,168,76,0.03)]" : "border-[#1a1a1a] bg-[#080808]"}`}>
                        <div className="flex items-center justify-between">
                          <p className="text-[13px] font-semibold text-[#f5f0e8]">{t.label}</p>
                          {winner && <span className="text-[9px] px-2 py-0.5 rounded-full border border-[#c9a84c]/30 text-[#c9a84c]">Best performer</span>}
                        </div>
                        <div className="space-y-2">
                          {[
                            { label: "Contacted", value: t.contacted, pct: null, color: "#555" },
                            { label: "Reply rate", value: t.replied, pct: rr, color: t.color },
                            { label: "Close rate", value: t.closed, pct: cr, color: "#4ade80" },
                          ].map((row) => (
                            <div key={row.label} className="flex items-center justify-between">
                              <span className="text-[11px] text-[#555]">{row.label}</span>
                              <div className="flex items-center gap-2">
                                {row.pct !== null && <span className="text-[11px] font-bold" style={{ color: row.color }}>{row.pct}%</span>}
                                <span className="text-[11px] text-[#333]">{row.value} leads</span>
                              </div>
                            </div>
                          ))}
                        </div>
                        {/* Reply rate bar */}
                        <div className="w-full bg-[#141414] rounded-full h-1.5">
                          <div className="h-1.5 rounded-full" style={{ width: `${rr}%`, backgroundColor: t.color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ── Angle type breakdown ── */}
            {angleRows.filter((r) => r.name !== "Unknown" && r.contacted > 0).length > 0 && (
              <section className="rounded-2xl border border-[#1a1a1a] bg-[#0d0d0d] p-6 space-y-5">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.15em] text-[#8a6e30] mb-1">Messaging</p>
                  <h2 className="text-[15px] font-semibold text-[#c8c0b0]">Angle Performance</h2>
                  <p className="text-[11px] text-[#444] mt-1">Which angles are generating the most replies and closes.</p>
                </div>
                <div className="space-y-2">
                  {/* Header */}
                  <div className="grid grid-cols-12 gap-2 px-3 text-[9px] uppercase tracking-widest text-[#333]">
                    <div className="col-span-4">Angle</div>
                    <div className="col-span-2 text-right">Contacted</div>
                    <div className="col-span-2 text-right">Reply %</div>
                    <div className="col-span-2 text-right">Closed</div>
                    <div className="col-span-2 text-right">Revenue</div>
                  </div>
                  {angleRows
                    .filter((r) => r.name !== "Unknown" && r.contacted > 0)
                    .map((row, i) => {
                      const isTop = i === 0;
                      return (
                        <div key={row.name} className={`grid grid-cols-12 gap-2 rounded-xl border px-3 py-3 items-center ${isTop ? "border-[rgba(201,168,76,0.25)] bg-[rgba(201,168,76,0.03)]" : "border-[#151515] bg-[#080808]"}`}>
                          <div className="col-span-4 flex items-center gap-2">
                            {isTop && <span className="text-[10px] text-[#c9a84c]">★</span>}
                            <p className="text-[12px] text-[#c8c0b0] truncate">{row.name}</p>
                          </div>
                          <div className="col-span-2 text-right">
                            <p className="text-[12px] text-[#666]">{row.contacted}</p>
                          </div>
                          <div className="col-span-2 text-right">
                            <p className="text-[12px] font-bold" style={{ color: row.replyRate >= 25 ? "#4ade80" : row.replyRate >= 15 ? "#c9a84c" : "#f87171" }}>
                              {row.replyRate}%
                            </p>
                          </div>
                          <div className="col-span-2 text-right">
                            <p className="text-[12px] text-[#666]">{row.closed}</p>
                          </div>
                          <div className="col-span-2 text-right">
                            <p className="text-[12px] text-[#888]">{row.revenue > 0 ? fmt(row.revenue) : "—"}</p>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </section>
            )}

            {/* ── Revenue timeline ── */}
            {revenue > 0 && weeklyData.some((w) => w.revenue > 0) && (
              <section className="rounded-2xl border border-[#1a1a1a] bg-[#0d0d0d] p-6 space-y-5">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.15em] text-[#8a6e30] mb-1">Revenue</p>
                  <h2 className="text-[15px] font-semibold text-[#c8c0b0]">Revenue Over Time</h2>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {[
                    { label: "Total Revenue", value: fmt(revenue), color: "#c9a84c" },
                    { label: "Deals Closed", value: closed.toString(), color: "#4ade80" },
                    { label: "Avg Deal Size", value: avgDeal > 0 ? fmt(avgDeal) : "—", color: "#8b5cf6" },
                  ].map((s) => (
                    <div key={s.label} className="rounded-xl border border-[#151515] bg-[#080808] p-3 text-center">
                      <p className="text-[9px] uppercase tracking-widest text-[#444]">{s.label}</p>
                      <p className="text-xl font-bold mt-1" style={{ color: s.color }}>{s.value}</p>
                    </div>
                  ))}
                </div>
                {/* Revenue bars per week */}
                {weeklyData.filter((w) => w.revenue > 0).length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-[#444] mb-3">Revenue per week</p>
                    <div className="flex items-end gap-1.5 h-20">
                      {weeklyData.map((w) => {
                        const maxRev = Math.max(...weeklyData.map((x) => x.revenue), 1);
                        const h = w.revenue > 0 ? Math.max(4, Math.round((w.revenue / maxRev) * 80)) : 2;
                        return (
                          <div key={w.week} className="flex-1 flex flex-col items-center gap-1 group relative">
                            <div className="w-full rounded-t-sm transition-colors cursor-default"
                              style={{ height: `${h}px`, backgroundColor: w.revenue > 0 ? "#c9a84c40" : "#1a1a1a" }} />
                            <p className="text-[9px] text-[#333]">{getWeekLabel(w.week)}</p>
                            {w.revenue > 0 && (
                              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 bg-[#111] border border-[#252525] rounded-lg px-2 py-1.5 text-[10px] whitespace-nowrap">
                                <p className="text-[#c9a84c] font-bold">{fmt(w.revenue)}</p>
                                <p className="text-[#555]">{w.closed} deal{w.closed !== 1 ? "s" : ""}</p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* ── Insight summary ── */}
            {(() => {
              const replyRate = pct(replied, contacted);
              const bookRate = pct(booked, replied);
              const closeRate = pct(closed, booked);
              const softReplyRate = pct(softReplied, softContacted);
              const directReplyRate = pct(directReplied, directContacted);
              const bothTonalities = softContacted > 0 && directContacted > 0;
              const winningTonality = bothTonalities
                ? (softReplyRate > directReplyRate ? "soft" : directReplyRate > softReplyRate ? "direct" : null)
                : null;

              const insights: string[] = [];

              if (contacted >= 5) {
                if (replyRate >= 25) {
                  insights.push(`Strong reply rate of ${replyRate}%. Your messaging is landing — focus on booking more calls from those replies.`);
                } else if (replyRate >= 15) {
                  insights.push(`Reply rate of ${replyRate}% is on track. To push past 25%, test a different angle or tighten your opening line.`);
                } else {
                  if (winningTonality) {
                    const losingTonality = winningTonality === "soft" ? "direct" : "soft";
                    const winRate = winningTonality === "soft" ? softReplyRate : directReplyRate;
                    const loseRate2 = winningTonality === "soft" ? directReplyRate : softReplyRate;
                    insights.push(`Reply rate is ${replyRate}% — below benchmark. Your data shows ${winningTonality} tonality outperforms ${losingTonality} (${winRate}% vs ${loseRate2}%). Lean into ${winningTonality}.`);
                  } else {
                    insights.push(`Reply rate is ${replyRate}% — below the 15% benchmark. Try a different angle, or split-test soft vs direct tonality to find what resonates.`);
                  }
                }
              }

              if (replied >= 3) {
                if (bookRate >= 50) {
                  insights.push(`Solid booking rate of ${bookRate}% from replies. You are converting conversations into calls effectively.`);
                } else if (bookRate < 30) {
                  insights.push(`Low booking rate of ${bookRate}% from replies. Add a direct ask with a specific time slot — open-ended follow-ups rarely convert.`);
                }
              }

              if (booked >= 2) {
                if (closeRate >= 70) {
                  insights.push(`Close rate of ${closeRate}% from booked calls is strong. Focus on scaling volume — your offer is working.`);
                } else if (closeRate < 50) {
                  insights.push(`Close rate of ${closeRate}% from calls needs attention. Review where objections come up — usually price framing or unclear ROI.`);
                }
              }

              if (bothTonalities && winningTonality) {
                const winRate = winningTonality === "soft" ? softReplyRate : directReplyRate;
                const loseRate = winningTonality === "soft" ? directReplyRate : softReplyRate;
                const diff = winRate - loseRate;
                if (diff >= 3) {
                  insights.push(`${winningTonality === "soft" ? "Soft" : "Direct"} tonality is outperforming ${winningTonality === "soft" ? "direct" : "soft"} by ${diff} points (${winRate}% vs ${loseRate}%). Prioritise it for new outreach.`);
                }
              } else if (bothTonalities && !winningTonality) {
                insights.push(`Soft and direct tonality are performing equally. Keep testing — you need more data to find a clear winner.`);
              }

              if (angleRows.length > 1 && angleRows[0].contacted >= 2 && angleRows[0].name !== "Unknown") {
                const diff = angleRows[0].replyRate - (angleRows[1]?.replyRate ?? 0);
                if (diff >= 5) {
                  insights.push(`"${angleRows[0].name}" is your best angle at ${angleRows[0].replyRate}% reply rate — ${diff} points ahead of the next best. Use it more.`);
                } else {
                  insights.push(`Top angles are closely matched. "${angleRows[0].name}" leads at ${angleRows[0].replyRate}% but keep testing to find a clear winner.`);
                }
              }

              if (bestReplyWeek && weeklyData.length > 2) {
                insights.push(`Best week: ${getWeekLabel(bestReplyWeek.week)} with a ${bestReplyWeek.replyRate}% reply rate and ${bestReplyWeek.contacted} contacts. What did you do differently that week?`);
              }

              if (contacted >= 10 && closed === 0) {
                insights.push(`You have ${contacted} contacts but no closed deals yet. Getting on calls is where deals happen — focus on improving your booking rate.`);
              }

              if (revenue > 0 && closed >= 3) {
                insights.push(`You have closed ${closed} deals for ${fmt(revenue)} total. To grow faster, your highest-leverage move is improving reply-to-book rate (currently ${bookRate}%).`);
              }

              return (
                <section className="rounded-2xl border border-[rgba(201,168,76,0.15)] bg-[rgba(201,168,76,0.03)] p-6 space-y-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.15em] text-[#8a6e30] mb-1">Insights</p>
                    <h2 className="text-[15px] font-semibold text-[#c8c0b0]">What the data is telling you</h2>
                  </div>
                  <div className="space-y-2">
                    {insights.length === 0 ? (
                      <div className="flex items-start gap-3 rounded-lg border border-[#1a1a1a] bg-[#0d0d0d] px-3 py-2.5">
                        <span className="text-[#555] mt-0.5 shrink-0">→</span>
                        <p className="text-[12px] text-[#555] leading-relaxed">Contact at least 5 leads to start seeing meaningful insights here.</p>
                      </div>
                    ) : insights.map((insight, i) => (
                      <div key={i} className="flex items-start gap-3 rounded-lg border border-[#1a1a1a] bg-[#0d0d0d] px-3 py-2.5">
                        <span className="text-[#c9a84c] mt-0.5 shrink-0">→</span>
                        <p className="text-[12px] text-[#888] leading-relaxed">{insight}</p>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })()}

          </>
        )}
      </div>
    </div>
  );
}
