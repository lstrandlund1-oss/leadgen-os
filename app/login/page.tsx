"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabaseBrowser";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";
  const errorParam = searchParams.get("error");

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    errorParam === "auth_callback_failed" ? "Email confirmation failed. Please try again." : null
  );
  const [success, setSuccess] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  const supabase = createSupabaseBrowser();

  function switchMode(m: Mode) {
    setMode(m);
    setError(null);
    setSuccess(null);
  }

  async function handleSubmit() {
    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
        },
      });

      if (error) {
        setError(error.message);
      } else {
        setPendingEmail(email);
        setSuccess("Check your email to confirm your account, then come back to sign in.");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
      } else {
        router.push(next);
        router.refresh();
      }
    }

    setLoading(false);
  }

  async function resendConfirmation() {
    if (!pendingEmail || resending) return;
    setResending(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: pendingEmail,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding` },
    });
    setResending(false);
    if (!error) setResent(true);
  }

  return (
    <div className="min-h-screen bg-[#080808] text-[#f5f0e8] flex flex-col">

      {/* Nav */}
      <nav className="flex items-center justify-between px-6 md:px-12 py-5 border-b border-[#252525]">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-[#c9a84c]">◈</span>
          <span className="text-lg font-light tracking-wide" style={{ fontFamily: "var(--font-display), serif" }}>
            LeadGen
            <span style={{
              background: "linear-gradient(135deg, #e8c97a 0%, #c9a84c 50%, #8a6e30 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}>OS</span>
          </span>
        </Link>
        <Link href="/" className="text-[12px] text-[#666] hover:text-[#888] transition-colors">
          ← Back to home
        </Link>
      </nav>

      {/* Form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">

          {/* Header */}
          <div className="mb-8 text-center">
            <p className="text-[11px] tracking-[0.2em] uppercase text-[#8a6e30] mb-3">
              {mode === "signin" ? "Welcome back" : "Get started"}
            </p>
            <h1 className="text-3xl md:text-4xl font-light" style={{ fontFamily: "var(--font-display), serif" }}>
              {mode === "signin" ? (
                <>Sign <span className="italic" style={{ color: "#c9a84c" }}>in</span></>
              ) : (
                <>Create your <span className="italic" style={{ color: "#c9a84c" }}>account</span></>
              )}
            </h1>
          </div>

          {/* Card */}
          <div className="rounded-2xl border border-[#252525] bg-[#111] p-6 space-y-4">

            {/* Gold top line */}
            <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-[#c9a84c] to-transparent -mt-6 mb-6 rounded-full" />

            {/* Error / success */}
            {error && (
              <div className="px-4 py-3 rounded-lg border border-rose-500/30 bg-rose-500/5 text-[12px] text-rose-400">
                {error}
              </div>
            )}
            {success && (
              <div className="px-4 py-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 text-[12px] text-emerald-400 space-y-2">
                <p>{success}</p>
                {pendingEmail && !resent && (
                  <p className="text-[11px] text-[#555]">
                    Didn&apos;t get it?{" "}
                    <button
                      type="button"
                      onClick={resendConfirmation}
                      disabled={resending}
                      className="text-[#c9a84c] hover:text-[#e8c97a] transition-colors disabled:opacity-50"
                    >
                      {resending ? "Sending…" : "Resend confirmation email"}
                    </button>
                  </p>
                )}
                {resent && <p className="text-[11px] text-emerald-500">✓ New confirmation email sent.</p>}
              </div>
            )}

            {/* Email */}
            <div className="space-y-1.5">
              <label className="block text-[11px] uppercase tracking-widest text-[#666]">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                placeholder="you@example.com"
                className="w-full bg-[#0d0d0d] border border-[#252525] rounded-lg px-4 py-3 text-sm text-[#f5f0e8] placeholder-[#333] focus:outline-none focus:border-[rgba(201,168,76,0.5)] transition-colors"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="block text-[11px] uppercase tracking-widest text-[#666]">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                placeholder={mode === "signup" ? "Min. 6 characters" : "••••••••"}
                className="w-full bg-[#0d0d0d] border border-[#252525] rounded-lg px-4 py-3 text-sm text-[#f5f0e8] placeholder-[#333] focus:outline-none focus:border-[rgba(201,168,76,0.5)] transition-colors"
              />
            </div>

            {/* Forgot password — only show in sign in mode */}
            {mode === "signin" && (
              <div className="flex justify-end -mt-1">
                <Link
                  href="/forgot-password"
                  className="text-[11px] text-[#555] hover:text-[#c9a84c] transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
            )}

            {/* Submit */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="w-full py-3.5 rounded-lg bg-[#c9a84c] text-[#080808] font-semibold text-[14px] tracking-wide hover:bg-[#e8c97a] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-[rgba(201,168,76,0.15)] mt-2"
            >
              {loading
                ? "Please wait…"
                : mode === "signin"
                ? "Sign In"
                : "Create Account"}
            </button>

          </div>

          {/* Mode toggle */}
          <p className="text-center text-[12px] text-[#555] mt-6">
            {mode === "signin" ? (
              <>
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("signup")}
                  className="text-[#c9a84c] hover:text-[#e8c97a] transition-colors"
                >
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("signin")}
                  className="text-[#c9a84c] hover:text-[#e8c97a] transition-colors"
                >
                  Sign in
                </button>
              </>
            )}
          </p>

          <p className="text-center text-[11px] text-[#333] mt-4 tracking-wide">
            Beta access only — invites required
          </p>
        </div>
      </div>
    </div>
  );
}
