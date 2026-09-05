"use client";

import { useState } from "react";
import Link from "next/link";
import { createSupabaseBrowser } from "@/lib/supabaseBrowser";
import { getTranslations } from "@/lib/i18n";
import type { Language } from "@/lib/i18n/types";
import { getStoredLanguage, setStoredLanguage } from "@/lib/languagePreference";
import LanguageToggle from "@/app/components/LanguageToggle";

function useForgotPasswordLanguage(): [Language, (l: Language) => void] {
  const [language, setLanguageState] = useState<Language>(() => getStoredLanguage());
  function setLanguage(l: Language) {
    setLanguageState(l);
    setStoredLanguage(l);
  }
  return [language, setLanguage];
}

export default function ForgotPasswordPage() {
  const [language, setLanguage] = useForgotPasswordLanguage();
  const t = getTranslations(language).ui.forgotPassword;

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const BASE = typeof window !== "undefined" ? window.location.origin : "";

  async function handleSubmit() {
    if (!email.trim()) { setError(t.emptyEmailError); return; }
    setLoading(true);
    setError(null);
    const supabase = createSupabaseBrowser();
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${BASE}/reset-password`,
    });
    setLoading(false);
    if (err) { setError(err.message); return; }
    setSent(true);
  }

  return (
    <div className="min-h-screen bg-[#080808] text-[#f5f0e8] flex flex-col">
      <nav className="flex items-center justify-between px-6 md:px-12 py-5 border-b border-[#151515]">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-[#c9a84c]">◈</span>
          <span className="text-lg font-light tracking-wide" style={{ fontFamily: "var(--font-display), serif" }}>
            Van
            <span
              style={{
                background: "linear-gradient(135deg, #e8c97a 0%, #c9a84c 50%, #8a6e30 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}>
              tio
            </span>
          </span>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-[12px] text-[#555] hover:text-[#888] transition-colors">{t.backToSignIn}</Link>
          <LanguageToggle language={language} onChange={setLanguage} />
        </div>
      </nav>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <p className="text-[11px] tracking-[0.2em] uppercase text-[#8a6e30] mb-3">{t.badge}</p>
            <h1 className="text-3xl md:text-4xl font-light" style={{ fontFamily: "var(--font-display), serif" }}>
              {t.headingStart} <span className="italic" style={{ color: "#c9a84c" }}>{t.headingItalic}</span>
            </h1>
          </div>

          <div className="rounded-2xl border border-[#252525] bg-[#111] p-6 space-y-4">
            <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-[#c9a84c] to-transparent -mt-6 mb-6 rounded-full" />

            {sent ? (
              <div className="py-4 text-center space-y-3">
                <div className="w-12 h-12 rounded-full border border-emerald-500/30 bg-emerald-500/5 flex items-center justify-center mx-auto text-emerald-400 text-xl">✓</div>
                <p className="text-[13px] text-[#c8c0b0]">{t.sentTitle}</p>
                <p className="text-[12px] text-[#555] leading-relaxed">
                  {t.sentBodyBeforeEmail}<span className="text-[#888]">{email}</span>{t.sentBodyAfterEmail}
                </p>
                <Link href="/login" className="block mt-4 text-[12px] text-[#c9a84c] hover:text-[#e8c97a] transition-colors">
                  {t.backToSignIn}
                </Link>
              </div>
            ) : (
              <>
                {error && (
                  <div className="px-4 py-3 rounded-lg border border-rose-500/30 bg-rose-500/5 text-[12px] text-rose-400">{error}</div>
                )}
                <p className="text-[12px] text-[#555] leading-relaxed">
                  {t.body}
                </p>
                <div className="space-y-1.5">
                  <label className="block text-[11px] uppercase tracking-widest text-[#666]">{t.emailLabel}</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                    placeholder={t.emailPlaceholder}
                    className="w-full bg-[#0d0d0d] border border-[#252525] rounded-lg px-4 py-3 text-sm text-[#f5f0e8] placeholder-[#333] focus:outline-none focus:border-[rgba(201,168,76,0.5)] transition-colors"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading}
                  className="w-full py-3.5 rounded-lg bg-[#c9a84c] text-[#080808] font-semibold text-[14px] tracking-wide hover:bg-[#e8c97a] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-[rgba(201,168,76,0.15)] mt-2"
                >
                  {loading ? t.sendingButton : t.sendButton}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
