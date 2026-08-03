// ==========================================
// Shared Types for Vantio
// ==========================================
import type { Capability } from "@/lib/fit/needs";
import type { OpportunityBucket } from "@/lib/scoring/buckets";

// Language support for UI + outreach generation
export type Language = "en" | "sv";

// Social presence levels
export type SocialPresence = "low" | "medium" | "high" | "";

// Lead priority categories
export type LeadPriority = "Easy Win" | "Warm" | "Long Shot";

// Future classification types (Stage 1 will expand these)
export type PrimaryIndustry = "real_estate" | "tattoo_studio" | "beauty_clinic" | "restaurant" | "other";

export type ServiceType = "local_service" | "online_service" | "ecommerce" | "other";

export type B2B_B2C = "b2b" | "b2c" | "both" | "unknown";

export type CapabilityKey = Capability; // if Capability is already an enum/union

export type CapabilityProfile = {
  id: string;
  // 0 = not offered, 1-100 = capability depth (higher = stronger)
  capabilities: Record<CapabilityKey, number>;
};

export type UserProfileV1 = {
  id: string;
  profileType?: string;
  businessName?: string;

  // Positioning
  niche: string;
  serviceFocus: ("ads" | "content" | "seo" | "branding")[];

  // Capability level
  experienceLevel: "beginner" | "intermediate" | "advanced";

  // Target preference
  targetBusinessSize: "any" | "small" | "medium" | "large";

  // Geography targeting
  targetLocation?: string;

  // Strategy bias
  acquisitionStyle: "volume" | "balanced" | "selective";

  // Constraints
  budgetPreference: "low" | "medium" | "high";

  // Optional expansion later
  notes?: string;

  // Free-text offer description — default context for outreach generation
  offerDescription?: string;

  // Economic profile (Week 3 of the rebuild) — all deliberately optional,
  // per the spec's own "progressive profiling may be better than demanding
  // everything upfront" instruction. Never asked during onboarding; only
  // ever entered voluntarily in Settings. Enables the economic-impact
  // views (Vantio cost vs. one additional customer's value, etc.) without
  // forcing every user through extra onboarding fields.
  averageDealValue?: number;
  closeRatePercent?: number; // 0-100
  hoursPerWeekProspecting?: number;
  peopleInvolvedInProspecting?: number;
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
// Business profile labels — plain English, shown in lead detail panel
export type RiskProfile =
  | "limited_data" // < 5 reviews, no website — not enough to classify
  | "early_stage" // < 15 reviews, rating < 4.0 — not yet proven
  | "well_established" // 100+ reviews, 4.2+★, website, medium/high social
  | "local_authority" // 50+ reviews, 4.5+★, website, low opportunity gap
  | "growing_business" // 20-99 reviews, 4.0+★, website, low/med social
  | "solo_run" // 8-60 reviews, 4.0+★, owner engaged (post-enrichment)
  | "independent_business" // everything else — includes established-offline businesses
  | "unknown"; // fallback, should be rare

// Human-readable label for each profile
export type BusinessProfileLabel =
  | "Limited data"
  | "Early stage"
  | "Well-established"
  | "Local authority"
  | "Growing business"
  | "Solo-run"
  | "Independent business"
  | "Unknown";

export const BUSINESS_PROFILE_LABELS: Record<RiskProfile, BusinessProfileLabel> = {
  limited_data: "Limited data",
  early_stage: "Early stage",
  well_established: "Well-established",
  local_authority: "Local authority",
  growing_business: "Growing business",
  solo_run: "Solo-run",
  independent_business: "Independent business",
  unknown: "Unknown",
};

export const BUSINESS_PROFILE_TOOLTIPS: Record<RiskProfile, string> = {
  limited_data:
    "We don't have enough signals to classify this business reliably. Very low review count and no website detected. Treat with caution until you know more.",
  early_stage:
    "This business shows signs of being newly established or not yet proven. Low review volume suggests limited or inconsistent revenue. Higher effort to convert, higher risk of non-payment.",
  well_established:
    "This business has strong proof signals — high review volume, good rating, and active digital presence. They're likely already working with service providers. You'll need a specific angle to displace what they have.",
  local_authority:
    "A trusted name in their local market with strong reputation and established presence. The opportunity gap is smaller — focus on a very specific improvement, not a full overhaul pitch.",
  growing_business:
    "Proven demand and actively operating, but hasn't fully built out their digital presence. Good timing — established enough to have budget but still has clear gaps you can fill.",
  solo_run:
    "Signals suggest this is owner-operated — the decision maker is likely the person running the business day to day. Easier to reach, faster decisions, but smaller budget ceiling.",
  independent_business:
    "A standard independent business. May have strong offline presence without strong digital infrastructure — that's your opportunity, not a weakness.",
  unknown: "Classification unclear from available signals. Use the opportunity and risk scores to guide your approach.",
};

export type RiskFlag =
  | "LOW_PROOF"
  | "NO_WEBSITE"
  | "WEAK_SOCIAL"
  | "LOW_CLASS_CONF"
  | "HIGH_RISK_SCORE"
  | "SATURATED_COMPETITION"
  | "OPERATIONAL_INSTABILITY"
  | "MULTI_LOCATION";

export type ScoreCategoryBreakdown = {
  reputation: number; // 0-100
  digitalPresence: number; // 0-100
  businessStrength: number; // 0-100
  opportunityGap: number; // 0-100
  stabilityRisk: number; // 0-100
  evidenceConfidence: number; // 0-100
};

export type ScoreResult = {
  value: number; // 0-100
  opportunity: number; // 0-100
  readiness: number; // 0-100
  risk: number; // 0-100
  riskProfile: RiskProfile;

  // legacy compatibility (can remove later)
  priority?: number;

  // category visibility
  breakdown: ScoreCategoryBreakdown;

  // human explanation layer
  reasons: string[];

  // tooltip text for each score — shown on hover in UI
  tooltips?: {
    value?: string;
    opportunity?: string;
    fit?: string;
    risk?: string;
    readiness?: string;
  };

  // evidence confidence — how much data backs this score
  evidenceLevel?: "high" | "medium" | "low" | "insufficient";
};

export type OutreachVariantKey = "soft" | "consultative" | "direct" | "bold";

export type SellerType = "MARKETING" | "WEB_DEV" | "CONTENT" | "FREELANCER";

export type GapType = "VISIBILITY" | "CONVERSION" | "INFRASTRUCTURE" | "OPTIMIZATION";

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

    // classification confidence indicator shown in list
    dataLevel?: "strong" | "moderate" | "thin";
  };
};
