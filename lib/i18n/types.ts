export type Language = "en" | "sv";

export type SocialPresenceFilter = "any" | "low" | "medium" | "high";
export type SortKey = "score" | "opportunity" | "risk" | "confidence" | "fit";
export type RiskProfile =
  | "well_established"
  | "local_authority"
  | "early_stage"
  | "limited_data"
  | "growing_business"
  | "solo_run"
  | "independent_business"
  | "unknown"
  | null;

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
        well_established: string;
        local_authority: string;
        early_stage: string;
        limited_data: string;
        growing_business: string;
        solo_run: string;
        independent_business: string;
        unknown: string;
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
      tabOverview: string;
      tabSignals: string;
      tabOutreach: string;
      tabTracking: string;
      dealValue: string;
      notes: string;
      savesOnBlur: string;
      followUpReminder: string;
      followUpHint: string;
      stagesReached: string;
      dealClosed: string;
      overdueLabel: string;
      todayLabel: string;
      inDaysLabel: string;
      upside: string;
      deliverability: string;
      inboxReady: string;
      useWithCare: string;
      likelyFiltered: string;
      whyNoBookingFlow: string;
      whyLowDigital: string;
      whyMissingInfra: string;
      whyAlreadyEstablished: string;
      whyUnstableSignals: string;
      whyTopTier: string;
      whyGoodValueFit: string;
      whyLowPriority: string;
    };
    savedSearches: {
      title: string;
      subtitle: string;
      saveCurrent: string;
      nameInputPlaceholder: string;
      rerun: string;
    };
    profileBanner: {
      title: string;
      body: string;
      cta: string;
    };
    feedback: {
      buttonLabel: string;
      tooltip: string;
    };
    beta: {
      invite: {
        heading: string;
        subheading: string;
        invitedEmailLabel: string;
        passwordLabel: string;
        passwordPlaceholderSignup: string;
        passwordPlaceholderSignin: string;
        submitSignin: string;
        submitSignup: string;
        pleaseWait: string;
        newToVantio: string;
        createAccount: string;
        alreadyHaveAccount: string;
        signIn: string;
        signedInAs: string;
        acceptButton: string;
        activating: string;
        emailMismatchBody: string; // {invited}, {current} placeholders
        signOutAndContinue: string; // {email} placeholder
        awaitingConfirmation: string; // {email} placeholder
        errorNotFoundTitle: string;
        errorNotFoundBody: string;
        errorExpiredTitle: string;
        errorExpiredBody: string;
        errorRevokedTitle: string;
        errorRevokedBody: string;
        errorAcceptedTitle: string;
        errorAcceptedBody: string;
        backHome: string;
      };
      acceptErrors: {
        expired: string;
        revoked: string;
        alreadyAccepted: string;
        emailMismatch: string;
        alreadyHasMembership: string;
        generic: string;
      };
      limits: {
        dailyLimitReached: string; // {remaining} placeholder context handled by caller
        totalLimitReached: string;
        costCeilingReached: string;
        remainingToday: string; // {count}
        remainingTotal: string; // {count}
      };
      tutorials: {
        skip: string;
        finish: string;
        next: string;
        back: string;
        stepOf: string; // "{current} of {total}" — {current}/{total} placeholders
        settingsHeading: string;
        settingsSubheading: string;
        replay: string;
        replayed: string;
        notStartedYet: string;
        content: Record<
          "dashboard" | "search" | "results" | "lead_focus" | "outreach" | "outcomes" | "settings",
          { title: string; steps: { title: string; body: string }[] }
        >;
      };
    };
  };
};
