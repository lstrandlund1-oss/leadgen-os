export type Language = "en" | "sv";

export type SocialPresenceFilter = "any" | "low" | "medium" | "high";
export type SortKey = "score" | "opportunity" | "risk" | "confidence" | "fit";
export type RiskProfile = "mature_competitor" | "unstable_business" | null;

export type TranslationSchema = {
  ui: {
    common: {
      na: string;
      visit: string;
    };
    header: {
      title: string;
      subtitle: string;
      languageLabel: string;
    };
    filters: {
      title: string;
      nicheLabel: string;
      locationLabel: string;
      providerLabel: string;
      socialPresenceLabel: string;
      socialPresenceOptions: Record<SocialPresenceFilter, string>;
      generateButton: string;
      generatingButton: string;
    };
    results: {
      title: string;
      empty: string;
      minScore: string;
      sortBy: string;
      sortOptions: Record<SortKey, string>;
      download: string;
      showing: string;
      leads: string;
      searchPlaceholder: string;
    };
    table: {
      company: string;
      industry: string;
      location: string;
      score: string;
      opportunity: string;
      risk: string;
      insight: string;
      website: string;
      insightPrefix: {
        opportunity: string;
        risk: string;
        readiness: string;
    };
    riskProfile: {
        none: string;
        mature_competitor: string;
        unstable_business: string;
      };
    };
    detail: {
      clear: string;
      leadFocus: string;
      opportunityInsight: string;
      risk: string;
      outcomeTracking: string;
      contacted: string;
      replied: string;
      booked: string;
      closed: string;
      suggestedAngle: string;
      outreachScript: string;
      copy: string;
      saving: string;
      scoreLabel: string;
      opportunityLabel: string;
      riskLabel: string;
      websiteLabel: string;
      noWebsite: string;
      suggestedAngleLabel: string;
      readinessLabel: string;
      clickLeadHint: string;
      riskProfileLabel?: string;
    };
  };
};
