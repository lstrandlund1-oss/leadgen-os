"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getTranslations } from "@/lib/i18n";
import type { Language } from "@/lib/i18n/types";
import { TUTORIAL_DEFINITIONS, type TutorialKey } from "@/lib/beta/tutorialDefinitions";

// Maps each tutorial key to the page it should replay on. search/results/
// lead_focus/outreach/outcomes all live within /dashboard as sub-states of
// that one page, not separate routes.
const TUTORIAL_PAGE: Record<TutorialKey, string> = {
  dashboard: "/dashboard",
  search: "/dashboard",
  results: "/dashboard",
  lead_focus: "/dashboard",
  outreach: "/dashboard",
  outcomes: "/dashboard",
  settings: "/settings",
};

type ProgressEntry = { completedAt: string | null; skippedAt: string | null };

export default function TutorialsSettingsList({ language }: { language: Language }) {
  const router = useRouter();
  const t = getTranslations(language).ui.beta.tutorials;
  const [progress, setProgress] = useState<Record<string, ProgressEntry>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/beta/tutorials")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.active) setProgress(data.progress ?? {});
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleReplay(key: TutorialKey) {
    await fetch("/api/beta/tutorials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, action: "replay" }),
    }).catch(() => {});
    router.push(TUTORIAL_PAGE[key]);
  }

  if (loading) return null;

  return (
    <div>
      <div className="mb-3">
        <p className="text-[10px] uppercase tracking-[0.15em] text-[#8a6e30] mb-1">{t.settingsHeading}</p>
        <h2 className="text-[15px] font-semibold text-[#c8c0b0]">{t.settingsSubheading}</h2>
      </div>
      <div className="rounded-xl border border-[#1a1a1a] bg-[#080808] divide-y divide-[#141414]">
        {(Object.keys(TUTORIAL_DEFINITIONS) as TutorialKey[]).map((key) => {
          const def = TUTORIAL_DEFINITIONS[key];
          const entry = progress[`${key}:${def.version}`];
          const status = entry?.completedAt ? t.finish : entry?.skippedAt ? t.skip : t.notStartedYet;
          const content = t.content[key];
          return (
            <div key={key} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-[13px] text-[#c8c0b0] font-medium">{content.title}</p>
                <p className="text-[11px] text-[#555] mt-0.5">{status}</p>
              </div>
              <button
                type="button"
                onClick={() => handleReplay(key)}
                className="text-[11px] px-3 py-1.5 rounded-lg border border-[rgba(201,168,76,0.25)] text-[#c9a84c] hover:bg-[rgba(201,168,76,0.06)] transition-all">
                {t.replay}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
