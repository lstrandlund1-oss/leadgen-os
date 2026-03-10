// lib/runLeads/hydrateLead.ts
//
// Pure function: takes raw DB rows + run context and returns a fully
// hydrated, scored lead ready for the API response. Extracted from the
// leads route to make the pipeline testable and independently evolvable.

import type { UserProfileV1, CapabilityProfile, RawCompany } from "@/lib/types";
import { extractBaseReputationSignals } from "@/lib/base/extractBaseReputationSignals";
import { extractBaseDigitalSignals } from "@/lib/base/extractBaseDigitalSignals";
import { extractBaseBusinessSignals } from "@/lib/base/extractBaseBusinessSignals";
import { scoreFit } from "@/lib/fit/fitScore";
import type { WeightedNeed } from "@/lib/fit/needs";

export interface RawLeadRow {
  id: number;
  name: string;
  website: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  rating: number | null;
  reviewCount: number | null;
  socialPresence: "low" | "medium" | "high" | null;
  categories: string[];
}

export interface HydratedLeadSummary {
  reputation: ReturnType<typeof extractBaseReputationSignals>;
  digital: ReturnType<typeof extractBaseDigitalSignals>;
  business: ReturnType<typeof extractBaseBusinessSignals>;
  fit: ReturnType<typeof scoreFit>;
}

/**
 * Hydrates a single raw lead row into scored signal layers.
 * The result is consumed by the leads route to build the full LeadWithSignals.
 */
export function hydrateLead(
  row: RawLeadRow,
  needs: WeightedNeed[],
  userProfile: UserProfileV1,
  capabilities: CapabilityProfile,
): HydratedLeadSummary {
  const reputation = extractBaseReputationSignals({
    rating: row.rating,
    reviewCount: row.reviewCount,
  });

  const digital = extractBaseDigitalSignals({
    website: row.website,
    socialPresence: row.socialPresence,
  });

  const business = extractBaseBusinessSignals({
    rating: row.rating,
    reviewCount: row.reviewCount,
    hasWebsite: digital.hasWebsite,
    socialPresence: row.socialPresence,
    classificationConfidence: null, // populated post-classification
  });

  const fit = scoreFit(userProfile, capabilities, needs, {
    city: row.city,
    country: row.country,
  });

  return { reputation, digital, business, fit };
}