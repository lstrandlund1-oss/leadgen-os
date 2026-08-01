// lib/stripeClient.ts
import Stripe from "stripe";

let cached: Stripe | null = null;

export function getStripeClient(): Stripe | null {
  if (cached) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  cached = new Stripe(key);
  return cached;
}

// Price ID lookup — matches the existing env var naming convention already
// configured: STRIPE_PRICE_{PLAN}_{PERIOD}_{CURRENCY}, e.g.
// STRIPE_PRICE_SCOUT_MONTHLY_SEK. All 36 combinations (3 plans x 3 periods x
// 4 currencies) are already set in the environment — this just needs to
// reference them correctly.
export function getStripePriceId(plan: string, period: string, currency: string): string | null {
  const key = `STRIPE_PRICE_${plan.toUpperCase()}_${period.toUpperCase()}_${currency.toUpperCase()}`;
  return process.env[key] ?? null;
}
