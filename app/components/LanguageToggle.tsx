"use client";

import type { Language } from "@/lib/i18n/types";

export default function LanguageToggle({
  language,
  onChange,
}: {
  language: Language;
  onChange: (lang: Language) => void;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        border: "1px solid #252525",
        borderRadius: 8,
        padding: 2,
        gap: 2,
      }}>
      {(["sv", "en"] as const).map((lang) => {
        const active = language === lang;
        return (
          <button
            key={lang}
            type="button"
            onClick={() => onChange(lang)}
            style={{
              padding: "4px 10px",
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.04em",
              border: "none",
              cursor: "pointer",
              background: active ? "rgba(201,168,76,0.15)" : "transparent",
              color: active ? "#c9a84c" : "#555",
            }}>
            {lang.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
