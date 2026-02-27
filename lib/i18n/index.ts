import { en } from "./en";
import { sv } from "./sv";
import type { Language, TranslationSchema } from "./types";

const translations: Record<Language, TranslationSchema> = {
  en,
  sv,
};

export function getTranslations(language: Language): TranslationSchema {
  return translations[language];
}