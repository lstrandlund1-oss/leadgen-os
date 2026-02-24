import type { Lead, RawCompany, Classification } from "@/lib/types";
import { scoreLead } from "@/lib/scoring";

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
  const fromRaw = normalizeSocialPresence(
    (raw as unknown as { socialPresence?: unknown }).socialPresence,
  );
  if (fromRaw) return fromRaw;

  // 3) rawPayload best-effort (provider-dependent; keep tolerant)
  const rp = raw.rawPayload;
  if (rp && typeof rp === "object") {
    const rec = rp as Record<string, unknown>;
    const v =
      rec.socialPresence ??
      rec.social_presence ??
      rec.instagramPresence ??
      rec.instagram_presence;
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

  const scoring = scoreLead(raw, classification);

  // Stable string id
  const leadId = `${raw.source}:${raw.sourceId}`;

  const socialPresence = inferSocialPresence({
    raw,
    normalized: normalized as unknown as Record<string, unknown>,
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
      confidence: classification.confidence,
    },

    score: {
      value: scoring.score,
      opportunity: scoring.opportunity,
      readiness: scoring.readiness,
      risk: scoring.risk,
      riskProfile: scoring.riskProfile,
    },

    metadata: {
      runId,
    },
  };
}
