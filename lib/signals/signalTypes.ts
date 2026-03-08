export type SignalKey =
  // Base signals
  | "rating"
  | "review_count"
  | "website_exists"
  | "social_presence"
  | "classification_confidence"
  | "is_good_fit"

  // Light enrichment
  | "website_has_contact_page"
  | "website_has_booking_cta"
  | "website_has_clear_offer"
  | "website_mobile_friendly"
  | "social_platform_count"
  | "social_last_post_days"
  | "owner_response_presence"
  | "review_velocity_estimate"

  // Deep enrichment
  | "website_page_speed_score"
  | "website_seo_structure_score"
  | "website_cta_strength"
  | "booking_flow_quality"
  | "competitor_density"
  | "local_market_saturation"
  | "brand_content_quality"
  | "posting_frequency_score";

export type EvidenceDepth = "base" | "light" | "deep";

export type SignalSource =
  | "provider"
  | "google_places"
  | "website_scan"
  | "social_scan"
  | "market_scan"
  | "classification"
  | "system";

export type SignalCategory =
  | "reputation"
  | "digitalPresence"
  | "businessStrength"
  | "opportunityGap"
  | "stabilityRisk"
  | "evidenceConfidence";

export type SignalValuePrimitive = string | number | boolean | null;

export interface Signal<T extends SignalValuePrimitive = SignalValuePrimitive> {
  key: SignalKey;
  label: string;
  category: SignalCategory;
  value: T;
  source: SignalSource;
  depth: EvidenceDepth;
  confidence: number; // 0-100
  reliability: number; // 0-1
  present: boolean;
  description?: string;
}

export type SignalMap = Partial<Record<SignalKey, Signal>>;

export interface SignalSet {
  byKey: SignalMap;
  byCategory: Partial<Record<SignalCategory, Signal[]>>;
  counts: {
    total: number;
    base: number;
    light: number;
    deep: number;
  };
  evidenceScore: number; // 0-100
}
