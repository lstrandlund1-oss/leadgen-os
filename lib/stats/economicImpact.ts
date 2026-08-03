// lib/stats/economicImpact.ts
//
// "Vantio as an investment" (Week 3 of the rebuild): shows the economic
// asymmetry between what one average customer is worth and what Vantio
// costs, using the user's own numbers from their (optional) economic
// profile — not a generic estimate.
//
// Deliberately assumes SEK — the user's average deal value is entered as
// a plain number with no currency selector, and this is a Swedish-market
// product (Swedish default locale, "Sweden" hardcoded as the default
// search country throughout the codebase). If Vantio expands to other
// currencies, this assumption needs revisiting alongside a currency
// field on the economic profile itself.
//
// Uses the Operator plan's real monthly price (from lib/pricing.ts, the
// same source the actual plans page uses) since that's the plan
// getEffectivePlan() defaults every user to during beta, and the most
// likely plan a real paying customer would be on afterward.

import { getMonthlyEquivalent } from "@/lib/pricing";

export type EconomicImpact = {
  averageDealValue: number;
  vantioMonthlyCostSek: number;
  monthsOfSubscriptionCovered: number;
};

export function computeEconomicImpact(averageDealValue: number): EconomicImpact | null {
  if (!averageDealValue || averageDealValue <= 0) return null;

  const vantioMonthlyCostSek = getMonthlyEquivalent("operator", "monthly", "sek");
  const monthsOfSubscriptionCovered = averageDealValue / vantioMonthlyCostSek;

  return {
    averageDealValue,
    vantioMonthlyCostSek,
    monthsOfSubscriptionCovered,
  };
}
