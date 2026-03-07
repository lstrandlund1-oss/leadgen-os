// ==========================================
// Shared Types for LeadGen OS
// ==========================================
import type { Capability } from "@/lib/fit/needs";
import type { OpportunityBucket } from "@/lib/scoring/buckets";
import { computeRiskFlags } from "@/lib/riskFlags";
// Language support for UI + outreach generation
export type Language = "en" | "sv";

// Social presence levels
export type SocialPresence = "low" | "medium" | "high" | "";

// Lead priority categories
export type LeadPriority = "Easy Win" | "Warm" | "Long Shot";

// Future classification types (Stage 1 will expand these)
export type PrimaryIndustry =
  | "real_estate"
  | "tattoo_studio"
  | "beauty_clinic"
  | "restaurant"
  | "other";

export type ServiceType =
  | "local_service"
  | "online_service"
  | "ecommerce"
  | "other";

export type B2B_B2C = "b2b" | "b2c" | "both" | "unknown";

export type CapabilityKey = Capability; // if Capability is already an enum/union

export type CapabilityProfile = {
  id: string;
  capabilities: Record<CapabilityKey, boolean>;
};

export type UserProfileV1 = {
  id: string;

  // Positioning
  niche: string;
  serviceFocus: ("ads" | "content" | "seo" | "branding")[];

  // Capability level
  experienceLevel: "beginner" | "intermediate" | "advanced";

  // Target preference
  targetBusinessSize: "small" | "medium" | "large";

  // Strategy bias
  acquisitionStyle: "aggressive" | "balanced" | "premium";

  // Constraints
  budgetPreference: "low" | "medium" | "high";

  // Optional expansion later
  notes?: string;
};

// Classification block returned by rule-based and AI classifiers
export type Classification = {
  primaryIndustry: PrimaryIndustry;
  subNiche: string;
  serviceType: ServiceType;
  b2b_b2c: B2B_B2C;
  isGoodFit: boolean;
  fitScoreReason: string;

  confidence: number; // 0–100 confidence in classification
  source: "rules" | "ai" | "manual";
};

// Search history records (used on homepage)
export type SearchRecord = {
  id: number;
  niche: string;
  location: string;
  company_size: string;
  social_presence: string;
  created_at: string;
};

// Raw company data coming from external providers (Google Maps, SERP APIs, etc.)
export type RawCompanySource = "mock" | "google_places" | "serp";

export type RawCompany = {
  source: RawCompanySource;
  sourceId: string;
  name: string;
  categories: string[];

  website?: string;
  address?: string;
  city?: string;
  country?: string;

  description?: string;
  rating?: number;
  review_count?: number;

  rawPayload?: unknown;
};

// ==========================================
// Canonical Lead shape (H2.13)
// ==========================================

// API/UI-ready lead object (provider-agnostic, deterministic, stable)
// --- Score (canonical) ---
export type RiskProfile =
  | "unstable_business"
  | "mature_competitor"
  | "early_stage"
  | "owner_operator"
  | "franchise_or_chain"
  | "seasonal"
  | "high_regulation"
  | "strong_local_brand"
  | "unknown";

export type RiskFlag =
  | "LOW_PROOF"
  | "NO_WEBSITE"
  | "WEAK_SOCIAL"
  | "LOW_CLASS_CONF"
  | "HIGH_RISK_SCORE"
  | "SATURATED_COMPETITION"
  | "OPERATIONAL_INSTABILITY"
  | "MULTI_LOCATION";

export type ScoreResult = {
  value: number; // 0–100
  opportunity: number; // 0–100
  readiness: number; // 0–100
  risk: number; // 0–100
  riskProfile: RiskProfile;

  /**
   * Legacy / optional.
   * Some older routes still reference score.priority.
   * Keep it optional for stability until you delete it everywhere.
   */
  priority?: number;
};

export type OutreachVariantKey = "soft" | "direct";

export type SellerType = "MARKETING" | "WEB_DEV" | "CONTENT" | "FREELANCER";

export type GapType =
  | "VISIBILITY"
  | "CONVERSION"
  | "INFRASTRUCTURE"
  | "OPTIMIZATION";

export type Difficulty = "LOW" | "MEDIUM" | "HIGH";

export type OutreachPackage = {
  sellerType: SellerType;
  gap: GapType;
  difficulty: Difficulty;

  angleTitle: string;
  angleWhy: string;

  variants: Record<OutreachVariantKey, string>;
  defaultVariant: OutreachVariantKey;
};

// --- Lead (canonical) ---
export type Lead = {
  id: string;

  source: RawCompanySource;
  sourceId: string;

  company: {
    name: string;
    website: string | null;
    address: string | null;
    city: string | null;
    country: string | null;
  };

  metrics: {
    rating: number | null;
    reviewCount: number | null;
    socialPresence: "low" | "medium" | "high" | null;
  };

  // Use the canonical Classification type (single truth)
  classification: Pick<
    Classification,
    | "primaryIndustry"
    | "subNiche"
    | "serviceType"
    | "b2b_b2c"
    | "isGoodFit"
    | "fitScoreReason"
    | "confidence"
    | "source"
  >;

  score: ScoreResult;

  metadata: {
    runId: string;
    outreach?: OutreachPackage;

    opportunityMeta?: {
      confidence: number;
      reasons: string[];
      bucket: OpportunityBucket;
      riskFlags?: RiskFlag[];
    };
  };
};
