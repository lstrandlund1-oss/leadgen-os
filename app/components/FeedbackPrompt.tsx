"use client";

import { useEffect, useState } from "react";
import { getTranslations } from "@/lib/i18n";
import type { Language } from "@/lib/i18n/types";
import { reasonKeysForRating, type FeedbackFeatureKey } from "@/lib/beta/feedbackTriggers";

const SESSION_KEY = "vantio_feedback_shown_this_session";

type EligibleResponse = { active: boolean; eligibleFeature: FeedbackFeatureKey | null };

// Renders nothing unless (a) the user has active beta membership, (b) a
// feature has actually met its usage threshold and hasn't been rated yet,
// and (c) no automatic feedback prompt has already been shown this browser
// session. A floating card, never a blocking modal — this never interrupts
// an in-progress search, generation, or lead review, since it only ever
// checks eligibility on mount (page load, after the triggering action
// already completed), not mid-action.
export default function FeedbackPrompt({ language }: { language: Language }) {
  const t = getTranslations(language).ui.beta.feedback;

  const [feature, setFeature] = useState<FeedbackFeatureKey | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [notUsedEnough, setNotUsedEnough] = useState(false);
  const [reasonKey, setReasonKey] = useState<string | null>(null);
  const [freeText, setFreeText] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem(SESSION_KEY)) return; // already shown this session

    fetch("/api/beta/feedback")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: EligibleResponse | null) => {
        if (data?.active && data.eligibleFeature) {
          setFeature(data.eligibleFeature);
          sessionStorage.setItem(SESSION_KEY, "1");
        }
      })
      .catch(() => {});
  }, []);

  async function handleSubmit() {
    if (!feature) return;
    await fetch("/api/beta/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ featureKey: feature, rating, notUsedEnough, reasonKey, freeText }),
    }).catch(() => {});
    setSubmitted(true);
    setTimeout(() => setDismissed(true), 1800);
  }

  function handleNotUsedEnough() {
    setNotUsedEnough(true);
    setRating(null);
    setReasonKey(null);
  }

  if (!feature || dismissed) return null;

  const featureName = t.featureNames[feature];
  const reasons = rating ? reasonKeysForRating(rating) : [];

  return (
    <div
      className="fixed z-[9998] bottom-4 right-4 left-4 md:left-auto md:w-[380px] rounded-2xl border border-[rgba(201,168,76,0.25)] bg-[#111] shadow-2xl shadow-black/60 p-5"
      role="dialog"
      aria-label={t.promptTitle.replace("{feature}", featureName)}>
      <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-[#c9a84c] to-transparent -mt-5 mb-4 rounded-full" />

      {submitted ? (
        <p className="text-[14px] text-[#c9a84c] text-center py-4">{t.thanks}</p>
      ) : notUsedEnough ? (
        <>
          <h3 className="text-[14px] font-semibold text-[#e8e0d0] mb-4">
            {t.promptTitle.replace("{feature}", featureName)}
          </h3>
          <p className="text-[13px] text-[#999] mb-4">{t.notUsedEnough}</p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="text-[12px] text-[#555] hover:text-[#888] transition-colors">
              {t.skip}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="text-[12px] px-4 py-1.5 rounded-lg bg-[#c9a84c] text-[#080808] font-semibold hover:bg-[#e8c97a] transition-colors">
              {t.submit}
            </button>
          </div>
        </>
      ) : (
        <>
          <h3 className="text-[14px] font-semibold text-[#e8e0d0] mb-4">
            {t.promptTitle.replace("{feature}", featureName)}
          </h3>

          <div className="flex items-center justify-center gap-2 mb-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => {
                  setRating(n);
                  setReasonKey(null);
                }}
                className="text-2xl transition-transform hover:scale-110"
                style={{ color: rating && n <= rating ? "#c9a84c" : "#2a2a2a" }}
                aria-label={String(n)}>
                ★
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={handleNotUsedEnough}
            className="block w-full text-center text-[11px] text-[#555] hover:text-[#888] transition-colors mb-4">
            {t.notUsedEnough}
          </button>

          {rating !== null && (
            <>
              <p className="text-[11px] uppercase tracking-widest text-[#666] mb-2">{t.reasonPrompt}</p>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {reasons.map((rk) => (
                  <button
                    key={rk}
                    type="button"
                    onClick={() => setReasonKey(rk)}
                    className={
                      "text-[11px] px-2.5 py-1 rounded-full border transition-colors " +
                      (reasonKey === rk
                        ? "border-[#c9a84c] text-[#c9a84c] bg-[rgba(201,168,76,0.06)]"
                        : "border-[#2a2a2a] text-[#888] hover:border-[#3a3a3a]")
                    }>
                    {t.reasons[rk]}
                  </button>
                ))}
              </div>
              <textarea
                value={freeText}
                onChange={(e) => setFreeText(e.target.value)}
                placeholder={t.freeTextPlaceholder}
                rows={2}
                className="w-full bg-[#0d0d0d] border border-[#252525] rounded-lg px-3 py-2 text-[12px] text-[#f5f0e8] placeholder-[#333] focus:outline-none focus:border-[rgba(201,168,76,0.5)] transition-colors mb-4 resize-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDismissed(true)}
                  className="text-[12px] text-[#555] hover:text-[#888] transition-colors">
                  {t.skip}
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="text-[12px] px-4 py-1.5 rounded-lg bg-[#c9a84c] text-[#080808] font-semibold hover:bg-[#e8c97a] transition-colors">
                  {t.submit}
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
