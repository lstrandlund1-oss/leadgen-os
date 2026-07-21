// lib/beta/gate.ts
// Shared entry point for gating a metered AI action. Each of the three AI
// routes (generate-outreach, sequences, discover's deep-search path) calls
// this first: if the user has active beta membership, it reserves usage
// against their beta allowance and the route must NOT also apply the
// existing plan-based limit. If the user isn't a beta member, the route
// falls through to its existing plan-based gating exactly as before —
// this module changes nothing about non-beta behavior.

import crypto from "crypto";
import { getBetaAccess, recordBetaActiveDay } from "./access";
import { reserveBetaUsage, commitBetaUsage, releaseBetaUsage, getBetaUsageCounts } from "./usage";
import { BETA_DEFAULT_ALLOWANCES, BETA_TIMEZONE } from "./config";
import { getTranslations } from "@/lib/i18n";
import type { Language } from "@/lib/i18n/types";
import type { BetaFeature, BetaMembership } from "./types";

export type BetaGateResult =
  | { mode: "not_beta" }
  | { mode: "beta_blocked"; reason: string; remainingTotal: number | null; remainingToday: number | null }
  | {
      mode: "beta_allowed";
      usageId: number;
      membership: BetaMembership;
      remainingTotal: number | null;
      remainingToday: number | null;
    };

export async function beginBetaGatedAction(
  userId: string,
  feature: BetaFeature,
  estimatedCostMicroUsd: number = 0,
  idempotencyKey?: string,
): Promise<BetaGateResult> {
  const access = await getBetaAccess(userId);
  if (!access.active) return { mode: "not_beta" };

  const timezone = access.membership.timezone ?? BETA_TIMEZONE;
  const allowance = BETA_DEFAULT_ALLOWANCES[feature];

  const reservation = await reserveBetaUsage(
    access.membership,
    feature,
    idempotencyKey ?? crypto.randomUUID(),
    estimatedCostMicroUsd,
  );

  // Counts reflect state AFTER the reservation attempt (whether it
  // succeeded or not), so "remaining" is always accurate to show the user.
  const counts = await getBetaUsageCounts(access.membership.id, feature, timezone);
  const remainingTotal = allowance.total === null ? null : Math.max(0, allowance.total - counts.usedTotal);
  const remainingToday = allowance.daily === null ? null : Math.max(0, allowance.daily - counts.usedToday);

  if (!reservation.allowed || reservation.usageId === null) {
    return { mode: "beta_blocked", reason: reservation.reason, remainingTotal, remainingToday };
  }

  return {
    mode: "beta_allowed",
    usageId: reservation.usageId,
    membership: access.membership,
    remainingTotal,
    remainingToday,
  };
}

// Call after the AI action succeeds.
export async function finishBetaGatedAction(gate: BetaGateResult, realCostMicroUsd?: number): Promise<void> {
  if (gate.mode !== "beta_allowed") return;
  await commitBetaUsage(gate.usageId, realCostMicroUsd);
  // Standard search/deep search/outreach/follow-up are all qualifying
  // active-day actions — this call is idempotent per calendar day.
  await recordBetaActiveDay(gate.membership.id);
}

// Call if the AI action failed, so the reservation doesn't count against
// the tester's limits.
export async function abortBetaGatedAction(gate: BetaGateResult): Promise<void> {
  if (gate.mode !== "beta_allowed") return;
  await releaseBetaUsage(gate.usageId);
}

export function betaBlockedResponseBody(
  gate: Extract<BetaGateResult, { mode: "beta_blocked" }>,
  language: Language,
): { error: string; code: string; remainingTotal: number | null; remainingToday: number | null } {
  const t = getTranslations(language).ui.beta.limits;
  const messages: Record<string, string> = {
    daily_limit: t.dailyLimitReached,
    total_limit: t.totalLimitReached,
    monetary_ceiling: t.costCeilingReached,
  };
  return {
    error: messages[gate.reason] ?? t.totalLimitReached,
    code: `BETA_${gate.reason.toUpperCase()}`,
    remainingTotal: gate.remainingTotal,
    remainingToday: gate.remainingToday,
  };
}
