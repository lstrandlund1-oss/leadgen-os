import type { Lead, RawCompany, Classification } from "@/lib/types";
import { scoreLead } from "@/lib/scoring";
import { computeRiskFlags } from "@/lib/riskFlags";
import { bucketOpportunity } from "@/lib/scoring/buckets";
import { extractSignals } from "@/lib/signals/extractSignals";

type SocialPresence = "low" | "medium" | "high";

function normalizeSocialPresence(value: unknown): SocialPresence | null {
  if (value === "low" || value === "medium" || value === "high") return value;
  return null;
}

/**
 * Extract social presence from any known place deterministically.
 * Priority:
 *  1) normalized payload (if provided)
 *  2) raw typed extras (RawCompanyExtras in scoring)
 *  3) rawPayload fallbacks (best-effort)
 */
function inferSocialPresence(args: {
  raw: RawCompany;
  normalized?: Record<string, unknown> | null;
}): SocialPresence | null {
  const { raw, normalized } = args;

  // 1) normalized (if you later compute it there)
  const fromNormalized = normalizeSocialPresence(normalized?.socialPresence);
  if (fromNormalized) return fromNormalized;

  // 2) raw extras (you already support this in scoring.ts)
  const fromRaw = normalizeSocialPresence((raw as unknown as { socialPresence?: unknown }).socialPresence);
  if (fromRaw) return fromRaw;

  // 3) rawPayload best-effort (provider-dependent; keep tolerant)
  const rp = raw.rawPayload;
  if (rp && typeof rp === "object") {
    const rec = rp as Record<string, unknown>;
    const v = rec.socialPresence ?? rec.social_presence ?? rec.instagramPresence ?? rec.instagram_presence;
    const fromPayload = normalizeSocialPresence(v);
    if (fromPayload) return fromPayload;
  }

  return null;
}

export function mapToLead(args: {
  raw: RawCompany;
  normalized: {
    name: string;
    website?: string | null;
    address?: string | null;
    city?: string | null;
    country?: string | null;

    // optional: allows route to pass computed presence later without breaking callers
    socialPresence?: "low" | "medium" | "high" | null;
  };
  classification: Classification;
  runId: string;
}): Lead {
  const { raw, normalized, classification, runId } = args;

  const signalSet = extractSignals({
    rating: raw.rating ?? null,
    reviewCount: raw.review_count ?? null,
    website: normalized.website ?? raw.website ?? null,
    socialPresence: normalized.socialPresence ?? null,
    classificationConfidence: classification.confidence ?? null,
    isGoodFit: classification.isGoodFit ?? null,
  });

  const scoring = scoreLead({
    raw,
    classification,
    signals: signalSet,
  });

  // Stable string id
  const leadId = `${raw.source}:${raw.sourceId}`;

  const inferredSocialPresence = inferSocialPresence({
    raw,
    normalized: normalized as unknown as Record<string, unknown>,
  });

  const socialPresence: "low" | "medium" | "high" = inferredSocialPresence ?? "low";

  const classificationConfidence01 =
    typeof classification.confidence === "number" ? Math.max(0, Math.min(1, classification.confidence / 100)) : null;

  const riskFlags = computeRiskFlags({
    hasWebsite: Boolean((normalized.website ?? raw.website ?? "").toString().trim().length > 0),
    socialPresence,
    rating: typeof raw.rating === "number" ? raw.rating : null,
    reviews: typeof raw.review_count === "number" ? raw.review_count : null,
    classificationConfidence01,
    isMatureCompetitor: scoring.riskProfile === "well_established" || scoring.riskProfile === "local_authority",
    isDistressed: scoring.riskProfile === "early_stage" || scoring.riskProfile === "limited_data",
  });

  return {
    id: leadId,
    source: raw.source,
    sourceId: raw.sourceId,

    company: {
      name: normalized.name,
      website: (normalized.website ?? raw.website ?? null) as string | null,
      address: (normalized.address ?? raw.address ?? null) as string | null,
      city: (normalized.city ?? raw.city ?? null) as string | null,
      country: (normalized.country ?? raw.country ?? null) as string | null,
    },

    metrics: {
      rating: raw.rating ?? null,
      reviewCount: raw.review_count ?? null,
      socialPresence,
    },

    classification: {
      primaryIndustry: classification.primaryIndustry,
      subNiche: classification.subNiche ?? "unknown",
      serviceType: classification.serviceType ?? "other",
      b2b_b2c: classification.b2b_b2c ?? "b2b",
      isGoodFit: classification.isGoodFit ?? false,
      fitScoreReason: classification.fitScoreReason ?? "",
      confidence: classification.confidence,
      source: classification.source ?? "rules",
    },

    score: {
      value: scoring.value,
      opportunity: scoring.opportunity,
      readiness: scoring.readiness,
      risk: scoring.risk,
      riskProfile: scoring.riskProfile,
      priority: scoring.priority,
      breakdown: scoring.breakdown,
      reasons: scoring.reasons,
    },

    metadata: {
      runId,
      opportunityMeta: {
        confidence: classification.confidence ?? 0,
        reasons: [],
        bucket: bucketOpportunity(scoring.opportunity),
        riskFlags,
      },
    },
  };
}
