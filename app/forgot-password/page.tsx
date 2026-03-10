"use client";

import { useState } from "react";
import Link from "next/link";
import { createSupabaseBrowser } from "@/lib/supabaseBrowser";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const BASE = typeof window !== "undefined" ? window.location.origin : "";

  async function handleSubmit() {
    if (!email.trim()) { setError("Please enter your email address."); return; }
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
            LeadGen<span style={{ background: "linear-gradient(135deg, #e8c97a 0%, #c9a84c 50%, #8a6e30 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>OS</span>
          </span>
        </Link>
        <Link href="/login" className="text-[12px] text-[#555] hover:text-[#888] transition-colors">← Back to sign in</Link>
      </nav>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <p className="text-[11px] tracking-[0.2em] uppercase text-[#8a6e30] mb-3">Account recovery</p>
            <h1 className="text-3xl md:text-4xl font-light" style={{ fontFamily: "var(--font-display), serif" }}>
              Reset your <span className="italic" style={{ color: "#c9a84c" }}>password</span>
            </h1>
          </div>

          <div className="rounded-2xl border border-[#252525] bg-[#111] p-6 space-y-4">
            <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-[#c9a84c] to-transparent -mt-6 mb-6 rounded-full" />

            {sent ? (
              <div className="py-4 text-center space-y-3">
                <div className="w-12 h-12 rounded-full border border-emerald-500/30 bg-emerald-500/5 flex items-center justify-center mx-auto text-emerald-400 text-xl">✓</div>
                <p className="text-[13px] text-[#c8c0b0]">Check your inbox</p>
                <p className="text-[12px] text-[#555] leading-relaxed">
                  We&apos;ve sent a password reset link to <span className="text-[#888]">{email}</span>. It expires in 1 hour.
                </p>
                <Link href="/login" className="block mt-4 text-[12px] text-[#c9a84c] hover:text-[#e8c97a] transition-colors">
                  ← Back to sign in
                </Link>
              </div>
            ) : (
              <>
                {error && (
                  <div className="px-4 py-3 rounded-lg border border-rose-500/30 bg-rose-500/5 text-[12px] text-rose-400">{error}</div>
                )}
                <p className="text-[12px] text-[#555] leading-relaxed">
                  Enter your email and we&apos;ll send you a link to reset your password.
                </p>
                <div className="space-y-1.5">
                  <label className="block text-[11px] uppercase tracking-widest text-[#666]">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                    placeholder="you@example.com"
                    className="w-full bg-[#0d0d0d] border border-[#252525] rounded-lg px-4 py-3 text-sm text-[#f5f0e8] placeholder-[#333] focus:outline-none focus:border-[rgba(201,168,76,0.5)] transition-colors"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading}
                  className="w-full py-3.5 rounded-lg bg-[#c9a84c] text-[#080808] font-semibold text-[14px] tracking-wide hover:bg-[#e8c97a] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-[rgba(201,168,76,0.15)] mt-2"
                >
                  {loading ? "Sending…" : "Send reset link"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
