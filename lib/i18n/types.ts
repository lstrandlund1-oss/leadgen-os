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
      feedback: {
        promptTitle: string; // "How's {feature} working for you?"
        notUsedEnough: string;
        reasonPrompt: string;
        freeTextPlaceholder: string;
        submit: string;
        skip: string;
        thanks: string;
        settingsHeading: string;
        settingsSubheading: string;
        rateAgain: string;
        notYetRated: string;
        yourRating: string; // "{rating}/5"
        featureNames: Record<
          "search" | "deep_search" | "lead_scoring" | "outreach" | "followup" | "outcomes" | "tutorial",
          string
        >;
        reasons: Record<
          | "confusing"
          | "inaccurate"
          | "too_slow"
          | "too_limited"
          | "did_not_solve_need"
          | "partly_useful"
          | "missing_information"
          | "required_too_much_editing"
          | "unsure_i_trust_it"
          | "easy_to_use"
          | "accurate"
          | "saved_time"
          | "changed_my_decision"
          | "ready_to_use",
          string
        >;
      };
      completed: {
        heading: string;
        body: string;
        dataPreserved: string;
        discountEarnedTitle: string;
        discountEarnedBody: string; // {percent}, {months} placeholders
        discountPendingTitle: string;
        discountPendingBody: string;
        discountNotEarnedTitle: string;
        discountNotEarnedBody: string;
        backToDashboard: string;
      };
    };
    onboarding: {
      stepLabels: [string, string, string, string];
      stepOf: string; // "Step {current} of {total}"
      welcomeBadge: string;
      welcomeBody: string;
      step0: {
        headingStart: string;
        headingItalic: string;
        body: string;
        businessNameLabel: string;
        businessNamePlaceholder: string;
        selectedBadge: string;
        continueButton: string;
      };
      step1: {
        headingStart: string;
        headingItalic: string;
        body: string;
        back: string;
        continueButton: string;
      };
      step2: {
        headingStart: string;
        headingItalic: string;
        body: string;
        experienceLevelLabel: string;
        experienceLevels: { beginner: string; intermediate: string; advanced: string };
        acquisitionStyleLabel: string;
        acquisitionStyles: { volume: string; balanced: string; selective: string };
        acquisitionStyleHints: { volume: string; balanced: string; selective: string };
        targetGeographyLabel: string;
        targetGeographyPlaceholder: string;
        targetGeographyHint: string;
        targetBusinessSizeLabel: string;
        businessSizes: { small: string; medium: string; large: string };
        back: string;
        saving: string;
        createProfile: string;
      };
      step3: {
        profileReadyBadge: string;
        headingStart: string;
        headingItalic: string;
        body: string;
        features: { icon: string; label: string }[];
        findLeads: string;
        updateAnytime: string;
      };
      capabilities: Record<"ads" | "tracking" | "funnel" | "content" | "website" | "seo" | "crm", string>;
      profileTypes: Record<
        "performance_marketer" | "web_developer" | "content_creator" | "seo_specialist" | "full_service_agency",
        { label: string; description: string; tag: string }
      >;
    };
    login: {
      welcomeBackBadge: string;
      getStartedBadge: string;
      signInHeadingStart: string;
      signInHeadingItalic: string;
      signUpHeadingStart: string;
      signUpHeadingItalic: string;
      emailConfirmFailedError: string;
      fillFieldsError: string;
      checkEmailSuccess: string;
      didntGetIt: string;
      resending: string;
      resendConfirmation: string;
      newConfirmationSent: string;
      emailLabel: string;
      emailPlaceholder: string;
      passwordLabel: string;
      passwordPlaceholderSignup: string;
      passwordPlaceholderSignin: string;
      forgotPassword: string;
      pleaseWait: string;
      signInButton: string;
      createAccountButton: string;
      noAccount: string;
      signUpLink: string;
      haveAccount: string;
      signInLink: string;
      freeDuringBeta: string;
      backToHome: string;
      loadingFallback: string;
    };
    settings: {
      betaBadge: string;
      platformEyebrow: string;
      headerTitle: string;
      headerSubtitle: string;
      tabs: { profile: string; preferences: string; notifications: string; account: string };
      backToDashboard: string;
      loading: string;
      profile: {
        businessEyebrow: string;
        businessTitle: string;
        businessNameLabel: string;
        businessNamePlaceholder: string;
        targetGeographyLabel: string;
        targetGeographyPlaceholder: string;
        targetGeographyHint: string;
        yourOfferLabel: string;
        yourOfferSubLabel: string;
        yourOfferPlaceholder: string;
        prospectingEyebrow: string;
        prospectingTitle: string;
        experienceLevelLabel: string;
        experienceLevels: { beginner: string; intermediate: string; advanced: string };
        prospectingStyleLabel: string;
        acquisitionStyles: { volume: string; balanced: string; selective: string };
        acquisitionStyleHints: { volume: string; balanced: string; selective: string };
        targetBusinessSizeLabel: string;
        targetBusinessSizeHint: string;
        sizeOptions: {
          any: { label: string; desc: string };
          small: { label: string; desc: string };
          medium: { label: string; desc: string };
          large: { label: string; desc: string };
        };
        dataEyebrow: string;
        dataTitle: string;
        dataBody: string;
        clearLocalData: string;
        clearConfirmQuestion: string;
        yesClear: string;
        cancel: string;
        deleteEyebrow: string;
        deleteTitle: string;
        deleteBody: string;
        deleteMyAccount: string;
        deleteConfirmTitle: string;
        deleteConfirmBody: string;
        deleteConfirmSubBody: string;
        yesContinue: string;
        typeDeleteToConfirm: string;
        deletePermanently: string;
        deleting: string;
        deleteErrorMustTypeExactly: string;
        deleteErrorGeneric: string;
        deleteErrorNetwork: string;
        saving: string;
        saved: string;
        saveChanges: string;
      };
      preferences: {
        displayEyebrow: string;
        appearanceTitle: string;
        themeLabel: string;
        darkMode: string;
        lightMode: string;
        darkModeDesc: string;
        lightModeDesc: string;
        languageEyebrow: string;
        languageTitle: string;
        savePreferences: string;
      };
      notifications: {
        inAppEyebrow: string;
        title: string;
        subtitle: string;
        followupLabel: string;
        followupSub: string;
        dealClosedLabel: string;
        dealClosedSub: string;
        weeklyDigestLabel: string;
        weeklyDigestSub: string;
        emailEyebrow: string;
        emailTitle: string;
        emailToggleLabel: string;
        emailToggleSub: string; // {email} placeholder
      };
      account: {
        eyebrow: string;
        title: string;
        signedInAs: string;
        changePassword: string;
        signOut: string;
        betaEyebrow: string;
        betaTesterTitle: string;
        betaFullAccess: string;
        activeDaysRemainingSingular: string; // {count}
        activeDaysRemainingPlural: string; // {count}
        betaEndedTitle: string;
        betaEndedBody: string;
        viewDetails: string;
        subscriptionEyebrow: string;
        yourPlanTitle: string;
        betaAccessLabel: string;
        fullAccessDuringBeta: string;
        changePlan: string;
        downgradeNotice: string;
      };
    };
  };
};
