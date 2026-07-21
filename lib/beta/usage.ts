// lib/beta/usage.ts
// Atomic AI usage metering for beta members. Wraps the SQL-level
// reserve/commit/release functions (see supabase/migrations/0001_...sql).
//
// Usage pattern in an API route:
//
//   const reservation = await reserveBetaUsage(membership, "outreach", idempotencyKey);
//   if (!reservation.allowed) return NextResponse.json({ error: reservation.reason }, { status: 429 });
//   try {
//     const result = await callAnthropicOrWhatever();
//     await commitBetaUsage(reservation.usageId!, actualCostMicroUsd);
//     return NextResponse.json(result);
//   } catch (err) {
//     await releaseBetaUsage(reservation.usageId!);
//     throw err;
//   }

import { getBetaServiceClient } from "./serviceClient";
import { BETA_DEFAULT_ALLOWANCES, BETA_DEFAULT_MONETARY_CEILING_MICRO_USD, BETA_TIMEZONE } from "./config";
import type { BetaFeature, BetaMembership, BetaUsageReservation } from "./types";

export async function reserveBetaUsage(
  membership: BetaMembership,
  feature: BetaFeature,
  idempotencyKey: string,
  estimatedCostMicroUsd: number = 0,
): Promise<BetaUsageReservation> {
  const client = await getBetaServiceClient();
  if (!client) {
    // Fail closed for a cost-bearing action if the service client isn't
    // configured — better to block an AI call than risk unmetered spend.
    return { allowed: false, reason: "total_limit", usageId: null };
  }

  const allowance = BETA_DEFAULT_ALLOWANCES[feature];

  const { data, error } = await client
    .rpc("reserve_beta_usage", {
      p_membership_id: membership.id,
      p_feature: feature,
      p_daily_limit: allowance.daily,
      p_total_limit: allowance.total,
      p_monetary_ceiling_micro_usd: BETA_DEFAULT_MONETARY_CEILING_MICRO_USD,
      p_estimated_cost_micro_usd: estimatedCostMicroUsd,
      p_idempotency_key: idempotencyKey,
      p_timezone: membership.timezone ?? BETA_TIMEZONE,
    })
    .single();

  if (error || !data) {
    return { allowed: false, reason: "total_limit", usageId: null };
  }

  const row = data as { allowed: boolean; reason: BetaUsageReservation["reason"]; usage_id: number | null };
  return { allowed: row.allowed, reason: row.reason, usageId: row.usage_id };
}

export async function commitBetaUsage(usageId: number, realCostMicroUsd?: number): Promise<void> {
  const client = await getBetaServiceClient();
  if (!client) return;
  await client.rpc("commit_beta_usage", { p_usage_id: usageId, p_real_cost_micro_usd: realCostMicroUsd ?? null });
}

export async function releaseBetaUsage(usageId: number): Promise<void> {
  const client = await getBetaServiceClient();
  if (!client) return;
  await client.rpc("release_beta_usage", { p_usage_id: usageId });
}

// Read-only usage counts for display purposes (e.g. "3 left today"). This
// is NOT the gating mechanism — reserve_beta_usage's row lock is what
// actually prevents over-use — so a moment of staleness here is fine.
export async function getBetaUsageCounts(
  membershipId: string,
  feature: BetaFeature,
  timezone: string,
): Promise<{ usedToday: number; usedTotal: number }> {
  const client = await getBetaServiceClient();
  if (!client) return { usedToday: 0, usedTotal: 0 };

  const { count: usedTotal } = await client
    .from("beta_usage")
    .select("*", { count: "exact", head: true })
    .eq("membership_id", membershipId)
    .eq("feature", feature)
    .in("status", ["reserved", "committed"]);

  // Compute "today" in the membership's timezone the same way the SQL
  // function does, via a date string boundary rather than UTC midnight.
  // This is a JS-side approximation (not fully DST-precise like the SQL
  // function's `at time zone` arithmetic) — acceptable here since this is
  // a display-only count, not the enforcement mechanism.
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: timezone }); // en-CA gives YYYY-MM-DD
  const startOfDayUtc = new Date(`${todayStr}T00:00:00Z`).toISOString();

  const { count: usedToday } = await client
    .from("beta_usage")
    .select("*", { count: "exact", head: true })
    .eq("membership_id", membershipId)
    .eq("feature", feature)
    .in("status", ["reserved", "committed"])
    .gte("created_at", startOfDayUtc);

  return { usedToday: usedToday ?? 0, usedTotal: usedTotal ?? 0 };
}
