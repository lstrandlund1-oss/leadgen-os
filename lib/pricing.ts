// lib/pricing.ts
//
// Single source of truth for plan pricing — extracted from
// app/plans/page.tsx so the economic-impact feature (Week 3 of the
// rebuild) uses the exact same real prices shown on the actual plans
// page, rather than a second, potentially-drifting copy of the numbers.

export type PlanKey = "scout" | "operator" | "agency";
export type Period = "monthly" | "quarterly" | "yearly";
export type Currency = "eur" | "usd" | "sek" | "gbp";

export const BASE_PRICES: Record<PlanKey, number> = {
  scout: 29,
  operator: 89,
  agency: 229,
};

export const CURRENCY_MULTIPLIERS: Record<Currency, number> = {
  eur: 1,
  usd: 1.08,
  sek: 11.5,
  gbp: 0.86,
};

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  eur: "€",
  usd: "$",
  sek: "kr",
  gbp: "£",
};

const PERIOD_DISCOUNT: Record<Period, number> = {
  monthly: 0,
  quarterly: 0.1,
  yearly: 0.25,
};

const PERIOD_MONTHS: Record<Period, number> = {
  monthly: 1,
  quarterly: 3,
  yearly: 12,
};

export function getPrice(plan: PlanKey, period: Period, currency: Currency): number {
  const base = BASE_PRICES[plan];
  const discount = 1 - PERIOD_DISCOUNT[period];
  const months = PERIOD_MONTHS[period];
  const converted = base * discount * CURRENCY_MULTIPLIERS[currency];
  return Math.round(converted * months);
}

export function getMonthlyEquivalent(plan: PlanKey, period: Period, currency: Currency): number {
  const base = BASE_PRICES[plan];
  const discount = 1 - PERIOD_DISCOUNT[period];
  const converted = base * discount * CURRENCY_MULTIPLIERS[currency];
  return Math.round(converted);
}

export function formatPrice(amount: number, currency: Currency): string {
  const sym = CURRENCY_SYMBOLS[currency];
  if (currency === "sek") return `${amount.toLocaleString()} ${sym}`;
  return `${sym}${amount.toLocaleString()}`;
}
