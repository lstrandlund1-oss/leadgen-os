// lib/stats/getSuggestedGoal.ts
import { getServiceClient } from "@/lib/supabaseServiceClient";
import { computeSuggestedGoal, type MonthlyWinCount, type SuggestedGoal } from "./goalEngine";

const LOOKBACK_MONTHS = 6;

export async function getSuggestedGoal(userId: string): Promise<SuggestedGoal | null> {
  const client = await getServiceClient();
  if (!client) return null;

  const windowStart = new Date();
  windowStart.setMonth(windowStart.getMonth() - LOOKBACK_MONTHS);
  windowStart.setDate(1);
  windowStart.setHours(0, 0, 0, 0);

  const currentMonthStart = new Date();
  currentMonthStart.setDate(1);
  currentMonthStart.setHours(0, 0, 0, 0);

  const { data: outcomes } = await client
    .from("lead_outcomes")
    .select("closed_at, closed, lost_reason")
    .eq("user_id", userId)
    .eq("closed", true)
    .gte("closed_at", windowStart.toISOString());

  if (!outcomes || outcomes.length === 0) return null;

  const winsByMonth = new Map<string, number>();
  for (const o of outcomes) {
    if (!o.closed_at || o.lost_reason) continue;
    const closedAt = new Date(o.closed_at as string);
    if (closedAt >= currentMonthStart) continue;
    const key = `${closedAt.getFullYear()}-${String(closedAt.getMonth() + 1).padStart(2, "0")}`;
    winsByMonth.set(key, (winsByMonth.get(key) ?? 0) + 1);
  }

  const history: MonthlyWinCount[] = Array.from(winsByMonth.entries()).map(([month, wins]) => ({ month, wins }));
  return computeSuggestedGoal(history);
}
