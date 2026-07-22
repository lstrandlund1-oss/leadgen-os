// lib/beta/tutorialDefinitions.ts
// Typed tutorial configuration. Each tutorial is versioned — bump the
// version only when the page changes substantially enough that the old
// walkthrough would be misleading; minor tweaks should NOT bump it (that
// would force everyone to see it again, which the spec explicitly says
// not to do for minor changes).
//
// Step content lives in lib/i18n/{en,sv}.ts under ui.beta.tutorials[key],
// keyed by stable step index — this file only defines structure (which
// keys exist, how many steps, current version), not the copy itself.

export type TutorialKey = "dashboard" | "search" | "results" | "lead_focus" | "outreach" | "outcomes" | "settings";

export type TutorialDefinition = {
  key: TutorialKey;
  version: string;
  stepCount: number;
};

// Bump `version` (e.g. "v1" -> "v2") when a page changes enough that the
// existing steps would point at things that no longer exist or work
// differently. Testers who already completed/skipped the old version will
// see the new version once; testers who haven't touched it yet just see
// the current version.
export const TUTORIAL_DEFINITIONS: Record<TutorialKey, TutorialDefinition> = {
  dashboard: { key: "dashboard", version: "v1", stepCount: 4 },
  search: { key: "search", version: "v1", stepCount: 4 },
  results: { key: "results", version: "v1", stepCount: 4 },
  lead_focus: { key: "lead_focus", version: "v1", stepCount: 5 },
  outreach: { key: "outreach", version: "v1", stepCount: 4 },
  outcomes: { key: "outcomes", version: "v1", stepCount: 3 },
  settings: { key: "settings", version: "v1", stepCount: 3 },
};
