// lib/beta/config.ts
// Default private-beta limits. All are configurable per-tester later via
// the admin dashboard (Phase 8) — these are the fallback defaults.

import type { BetaAllowance, BetaFeature } from "./types";

export const BETA_TIMEZONE = "Europe/Stockholm";
export const BETA_ACTIVE_DAYS_LIMIT = 7;
export const BETA_CALENDAR_DAYS_LIMIT = 14;
export const BETA_EXTENSION_DAYS = 7;
export const BETA_INVITATION_EXPIRY_DAYS = 7;

export const BETA_DEFAULT_ALLOWANCES: Record<BetaFeature, BetaAllowance> = {
  outreach: { daily: 10, total: 40 },
  followup: { daily: 5, total: 20 },
  ai_deep_search: { daily: 2, total: 5 },
};

// Default hard monetary ceiling per tester, in integer micro-USD.
// 1 USD = 1_000_000 micro-USD. $15 default ceiling.
export const BETA_DEFAULT_MONETARY_CEILING_MICRO_USD = 15_000_000;

// Discount terms (Phase 7) — not enforced here, just the shared constants
// so the discount UI and any future redemption adapter agree with each other.
export const BETA_DISCOUNT_PERCENT = 30;
export const BETA_DISCOUNT_MONTHS = 12;
export const BETA_DISCOUNT_REDEMPTION_WINDOW_DAYS = 30;
export const BETA_COMPLETION_MIN_ACTIVE_DAYS = 3;

export function microUsdToDisplay(micro: number): string {
  return `$${(micro / 1_000_000).toFixed(2)}`;
}
