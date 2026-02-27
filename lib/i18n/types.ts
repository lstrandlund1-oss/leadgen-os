export type Language = "en" | "sv";

export type TranslationSchema = {
  ui: {
    header: {
      title: string;
      subtitle: string;
    };
    filters: {
      title: string;
      nicheLabel: string;
      locationLabel: string;
      providerLabel: string;
      socialPresenceLabel: string;
      generateButton: string;
      generatingButton: string;
      socialPresenceOptions: {
        any: string;
        low: string;
        medium: string;
        high: string;
      };
    };
    results: {
      title: string;
      empty: string;
      minScore: string;
      sortBy: string;
      download: string;
      showing: string;
      leads: string;
      searchPlaceholder: string;

      sortOptions: {
        score: string;
        opportunity: string;
        riskLowFirst: string;
        confidence: string;
        fit: string;
      };
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
    };
  };
};
