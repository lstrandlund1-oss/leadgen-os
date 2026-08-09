// lib/stats/getMonthlyPerformanceDetail.ts
//
// Day-level breakdown of this month's activity, powering the calendar
// drill-down on Stats ("click Revenue Won, see which days"). Same
// underlying transition timestamps as getMonthlyPerformance (Home's
// simpler monthly-totals widget) — this is a separate, additive module
// rather than a modification of that already-working function, so
// Home's widget carries zero risk from this work.

export type DayActivity = {
  date: string; // YYYY-MM-DD
  contacted: number;
  replied: number;
  meetings: number;
  won: number;
  revenueWon: number;
};

export type OutcomeForMonthlyDetail = {
  contacted_at: string | null;
  replied_at: string | null;
  booked_call_at: string | null;
  closed_at: string | null;
  closed: boolean;
  lost_reason: string | null;
  revenue: number | null;
};

function dayKey(iso: string): string {
  return iso.slice(0, 10); // YYYY-MM-DD, timezone-naive but consistent with how the rest of the day/week grouping in this codebase already works
}

export function computeMonthlyPerformanceDetail(
  outcomes: OutcomeForMonthlyDetail[],
  monthStartIso: string,
): DayActivity[] {
  const byDay = new Map<string, DayActivity>();

  function bump(iso: string | null, field: "contacted" | "replied" | "meetings") {
    if (!iso || iso < monthStartIso) return;
    const key = dayKey(iso);
    const existing = byDay.get(key) ?? { date: key, contacted: 0, replied: 0, meetings: 0, won: 0, revenueWon: 0 };
    existing[field] += 1;
    byDay.set(key, existing);
  }

  for (const o of outcomes) {
    bump(o.contacted_at, "contacted");
    bump(o.replied_at, "replied");
    bump(o.booked_call_at, "meetings");

    if (o.closed_at && o.closed_at >= monthStartIso && o.closed && !o.lost_reason) {
      const key = dayKey(o.closed_at);
      const existing = byDay.get(key) ?? { date: key, contacted: 0, replied: 0, meetings: 0, won: 0, revenueWon: 0 };
      existing.won += 1;
      existing.revenueWon += o.revenue ?? 0;
      byDay.set(key, existing);
    }
  }

  return Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date));
}
