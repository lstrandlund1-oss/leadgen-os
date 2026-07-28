// lib/languagePreference.ts
// Single source of truth for reading/writing the language preference to
// localStorage. Multiple pages had their own inline copy of this logic —
// several of which only updated in-memory React state and never actually
// wrote to localStorage at all, meaning the toggle appeared to work for
// that page view but reset on the next visit. Centralised so every
// toggle location behaves the same way.

import type { Language } from "@/lib/i18n/types";

const STORAGE_KEY = "vantio_state_v1";

export function getStoredLanguage(): Language {
  if (typeof window === "undefined") return "sv";
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    return parsed.language === "en" || parsed.language === "sv" ? parsed.language : "sv";
  } catch {
    return "sv";
  }
}

// Writes to localStorage only. Deliberately does NOT also call
// /api/profile: that endpoint rebuilds the entire profile from type
// defaults plus whatever fields are in the request body — it does not
// merge with the user's existing stored profile. Calling it with just
// { language } would silently wipe business name, target location,
// capabilities, and everything else back to defaults for any logged-in
// user. The settings pages are safe because they always send every field
// together; this utility is used from places (login, hamburger menu) that
// have no reason to know or send the rest of the profile, so it must stay
// localStorage-only until/unless /api/profile is changed to merge
// properly instead of rebuilding from scratch.
export function setStoredLanguage(language: Language): void {
  if (typeof window === "undefined") return;
  try {
    const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...existing, language }));
  } catch {
    /* ignore */
  }
}
