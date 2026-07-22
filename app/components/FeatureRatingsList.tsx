"use client";

import { useEffect, useState } from "react";
import { getTranslations } from "@/lib/i18n";
import type { Language } from "@/lib/i18n/types";
import { reasonKeysForRating, FEEDBACK_FEATURE_VERSION, type FeedbackFeatureKey } from "@/lib/beta/feedbackTriggers";

const FEATURE_KEYS: FeedbackFeatureKey[] = [
  "search",
  "deep_search",
  "lead_scoring",
  "outreach",
  "followup",
  "outcomes",
  "tutorial",
];

export default function FeatureRatingsList({ language }: { language: Language }) {
  const t = getTranslations(language).ui.beta.feedback;
  const [rated, setRated] = useState<Set<string>>(new Set());
  const [openFeature, setOpenFeature] = useState<FeedbackFeatureKey | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [reasonKey, setReasonKey] = useState<string | null>(null);
  const [freeText, setFreeText] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/beta/feedback")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.active) setRated(new Set<string>(data.rated ?? []));
      })
      .finally(() => setLoading(false));
  }, []);

  function openRating(key: FeedbackFeatureKey) {
    setOpenFeature(key);
    setRating(null);
    setReasonKey(null);
    setFreeText("");
  }

  async function submit() {
    if (!openFeature || rating === null) return;
    await fetch("/api/beta/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ featureKey: openFeature, rating, reasonKey, freeText }),
    }).catch(() => {});
    setRated((prev) => new Set(prev).add(`${openFeature}:${FEEDBACK_FEATURE_VERSION[openFeature]}`));
    setOpenFeature(null);
  }

  if (loading) return null;

  return (
    <div>
      <div className="mb-3">
        <p className="text-[10px] uppercase tracking-[0.15em] text-[#8a6e30] mb-1">{t.settingsHeading}</p>
        <h2 className="text-[15px] font-semibold text-[#c8c0b0]">{t.settingsSubheading}</h2>
      </div>
      <div className="rounded-xl border border-[#1a1a1a] bg-[#080808] divide-y divide-[#141414]">
        {FEATURE_KEYS.map((key) => {
          const hasRated = rated.has(`${key}:${FEEDBACK_FEATURE_VERSION[key]}`);
          const isOpen = openFeature === key;
          return (
            <div key={key} className="px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] text-[#c8c0b0] font-medium">{t.featureNames[key]}</p>
                  <p className="text-[11px] text-[#555] mt-0.5">{hasRated ? "" : t.notYetRated}</p>
                </div>
                <button
                  type="button"
                  onClick={() => (isOpen ? setOpenFeature(null) : openRating(key))}
                  className="text-[11px] px-3 py-1.5 rounded-lg border border-[rgba(201,168,76,0.25)] text-[#c9a84c] hover:bg-[rgba(201,168,76,0.06)] transition-all">
                  {hasRated ? t.rateAgain : t.submit}
                </button>
              </div>

              {isOpen && (
                <div className="mt-4 pt-4 border-t border-[#141414]">
                  <div className="flex items-center justify-center gap-2 mb-3">
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
                  {rating !== null && (
                    <>
                      <div className="flex flex-wrap gap-1.5 mb-3 justify-center">
                        {reasonKeysForRating(rating).map((rk) => (
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
                        className="w-full bg-[#0d0d0d] border border-[#252525] rounded-lg px-3 py-2 text-[12px] text-[#f5f0e8] placeholder-[#333] focus:outline-none focus:border-[rgba(201,168,76,0.5)] transition-colors mb-3 resize-none"
                      />
                      <button
                        type="button"
                        onClick={submit}
                        className="w-full text-[12px] py-2 rounded-lg bg-[#c9a84c] text-[#080808] font-semibold hover:bg-[#e8c97a] transition-colors">
                        {t.submit}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
