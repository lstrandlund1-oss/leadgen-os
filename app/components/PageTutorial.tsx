"use client";

import { useEffect, useState } from "react";
import { getTranslations } from "@/lib/i18n";
import type { Language } from "@/lib/i18n/types";
import { TUTORIAL_DEFINITIONS, type TutorialKey } from "@/lib/beta/tutorialDefinitions";

type TutorialsApiResponse = {
  active: boolean;
  progress: Record<string, { currentStep: number; completedAt: string | null; skippedAt: string | null }>;
};

// Renders nothing until it's confirmed (a) the user has active beta
// membership and (b) this tutorial hasn't been completed/skipped at its
// current version yet. A floating card, not a full-screen modal — normal
// page interaction is never blocked, on mobile or desktop.
export default function PageTutorial({ tutorialKey, language }: { tutorialKey: TutorialKey; language: Language }) {
  const t = getTranslations(language).ui.beta.tutorials;
  const def = TUTORIAL_DEFINITIONS[tutorialKey];
  const content = t.content[tutorialKey];

  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setVisible(false); // reset before checking the new key — otherwise a
    // previous key's "visible" state could leak into this one if the new
    // key turns out to already be completed/skipped.
    setChecked(false);
    fetch("/api/beta/tutorials")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: TutorialsApiResponse | null) => {
        if (cancelled || !data?.active) return;
        const progressKey = `${tutorialKey}:${def.version}`;
        const existing = data.progress[progressKey];
        if (existing?.completedAt || existing?.skippedAt) return; // already seen this version
        setStep(existing?.currentStep ?? 0);
        setVisible(true);
        post("start");
      })
      .finally(() => {
        if (!cancelled) setChecked(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutorialKey]);

  function post(action: "start" | "step" | "complete" | "skip" | "replay", stepArg?: number) {
    fetch("/api/beta/tutorials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: tutorialKey, action, step: stepArg }),
    }).catch(() => {});
  }

  function handleNext() {
    if (step + 1 >= def.stepCount) {
      post("complete");
      setVisible(false);
      return;
    }
    const nextStep = step + 1;
    setStep(nextStep);
    post("step", nextStep);
  }

  function handleBack() {
    if (step === 0) return;
    setStep(step - 1);
  }

  function handleSkip() {
    post("skip");
    setVisible(false);
  }

  if (!checked || !visible || !content) return null;

  const current = content.steps[step];

  return (
    <div
      className="fixed z-[9999] bottom-4 right-4 left-4 md:left-auto md:w-[360px] rounded-2xl border border-[rgba(201,168,76,0.25)] bg-[#111] shadow-2xl shadow-black/60 p-5"
      role="dialog"
      aria-label={content.title}>
      <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-[#c9a84c] to-transparent -mt-5 mb-4 rounded-full" />
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] uppercase tracking-[0.15em] text-[#8a6e30]">{content.title}</p>
        <p className="text-[10px] text-[#555] font-mono">
          {t.stepOf.replace("{current}", String(step + 1)).replace("{total}", String(def.stepCount))}
        </p>
      </div>
      <h3 className="text-[15px] font-semibold text-[#e8e0d0] mb-2">{current.title}</h3>
      <p className="text-[13px] text-[#999] leading-relaxed mb-5">{current.body}</p>
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={handleSkip}
          className="text-[12px] text-[#555] hover:text-[#888] transition-colors">
          {t.skip}
        </button>
        <div className="flex items-center gap-2">
          {step > 0 && (
            <button
              type="button"
              onClick={handleBack}
              className="text-[12px] px-3 py-1.5 rounded-lg border border-[#2a2a2a] text-[#999] hover:border-[#3a3a3a] transition-colors">
              {t.back}
            </button>
          )}
          <button
            type="button"
            onClick={handleNext}
            className="text-[12px] px-4 py-1.5 rounded-lg bg-[#c9a84c] text-[#080808] font-semibold hover:bg-[#e8c97a] transition-colors">
            {step + 1 >= def.stepCount ? t.finish : t.next}
          </button>
        </div>
      </div>
    </div>
  );
}
