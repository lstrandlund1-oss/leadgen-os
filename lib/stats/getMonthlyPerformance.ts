// lib/stats/getMonthlyPerformance.ts
//
// "Performance this month" for the Home page — uses the real transition
// timestamps (contacted_at, replied_at, booked_call_at, closed_at) added
// in migration 0014, so this counts events by when they actually
// happened, not just current totals. Time saved is intentionally NOT
// included here — the rebuild spec is explicit that time-saved estimates
// must be labeled as estimates with a documented methodology, and no
// such methodology exists yet; fabricating an hours-saved number would
// violate that directly.

import { getServiceClient } from "@/lib/supabaseServiceClient";

export type MonthlyPerformance = {
  contactsMade: number;
  replies: number;
  meetings: number;
  won: number;
  revenueWon: number;
};

export async function getMonthlyPerformance(userId: string): Promise<MonthlyPerformance> {
  const client = await getServiceClient();
  const empty: MonthlyPerformance = { contactsMade: 0, replies: 0, meetings: 0, won: 0, revenueWon: 0 };
  if (!client) return empty;

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthStartIso = monthStart.toISOString();

  const { data: outcomes } = await client
    .from("lead_outcomes")
    .select("contacted_at, replied_at, booked_call_at, closed_at, closed, lost_reason, revenue")
    .eq("user_id", userId);

  if (!outcomes) return empty;

  let contactsMade = 0;
  let replies = 0;
  let meetings = 0;
  let won = 0;
  let revenueWon = 0;

  for (const o of outcomes) {
    if (o.contacted_at && o.contacted_at >= monthStartIso) contactsMade += 1;
    if (o.replied_at && o.replied_at >= monthStartIso) replies += 1;
    if (o.booked_call_at && o.booked_call_at >= monthStartIso) meetings += 1;
    if (o.closed_at && o.closed_at >= monthStartIso && o.closed && !o.lost_reason) {
      won += 1;
      revenueWon += (o.revenue as number | null) ?? 0;
    }
  }

  return { contactsMade, replies, meetings, won, revenueWon };
}
