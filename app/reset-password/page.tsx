"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabaseBrowser";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);

  // Supabase sends the token in the URL hash: #access_token=...&type=recovery
  // Hash fragments are browser-only — we must manually call setSession from them.
  useEffect(() => {
    const supabase = createSupabaseBrowser();

    // 1. Listen for the PASSWORD_RECOVERY event (fires if session is already set)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setSessionReady(true);
    });

    // 2. Also manually parse the hash and call setSession directly
    //    This is necessary when the page loads fresh from the email link
    const hash = window.location.hash;
    if (hash) {
      const params = new URLSearchParams(hash.replace(/^#/, ""));
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");
      const type = params.get("type");
      if (accessToken && type === "recovery") {
        supabase.auth
          .setSession({ access_token: accessToken, refresh_token: refreshToken ?? "" })
          .then(({ error }) => {
            if (!error) setSessionReady(true);
          });
      }
    }

    return () => subscription.unsubscribe();
  }, []);

  async function handleReset() {
    if (!password || password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (password !== confirm) { setError("Passwords don't match."); return; }
    setLoading(true);
    setError(null);
    const supabase = createSupabaseBrowser();
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (err) { setError(err.message); return; }
    setDone(true);
    setTimeout(() => router.push("/dashboard"), 2500);
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
      </nav>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <p className="text-[11px] tracking-[0.2em] uppercase text-[#8a6e30] mb-3">Account recovery</p>
            <h1 className="text-3xl md:text-4xl font-light" style={{ fontFamily: "var(--font-display), serif" }}>
              New <span className="italic" style={{ color: "#c9a84c" }}>password</span>
            </h1>
          </div>

          <div className="rounded-2xl border border-[#252525] bg-[#111] p-6 space-y-4">
            <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-[#c9a84c] to-transparent -mt-6 mb-6 rounded-full" />

            {done ? (
              <div className="py-4 text-center space-y-3">
                <div className="w-12 h-12 rounded-full border border-emerald-500/30 bg-emerald-500/5 flex items-center justify-center mx-auto text-emerald-400 text-xl">✓</div>
                <p className="text-[13px] text-[#c8c0b0]">Password updated</p>
                <p className="text-[12px] text-[#555]">Redirecting you to the dashboard…</p>
              </div>
            ) : !sessionReady ? (
              <div className="py-8 text-center space-y-3">
                <div className="w-5 h-5 rounded-full border-2 border-[#c9a84c] border-t-transparent animate-spin mx-auto" />
                <p className="text-[12px] text-[#555]">Verifying reset link…</p>
                <p className="text-[11px] text-[#333]">If this takes too long, your link may have expired.</p>
                <Link href="/forgot-password" className="block text-[12px] text-[#c9a84c] hover:text-[#e8c97a] transition-colors mt-2">
                  Request a new link →
                </Link>
              </div>
            ) : (
              <>
                {error && (
                  <div className="px-4 py-3 rounded-lg border border-rose-500/30 bg-rose-500/5 text-[12px] text-rose-400">{error}</div>
                )}
                <div className="space-y-1.5">
                  <label className="block text-[11px] uppercase tracking-widest text-[#666]">New password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 6 characters"
                    className="w-full bg-[#0d0d0d] border border-[#252525] rounded-lg px-4 py-3 text-sm text-[#f5f0e8] placeholder-[#333] focus:outline-none focus:border-[rgba(201,168,76,0.5)] transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[11px] uppercase tracking-widests text-[#666]">Confirm password</label>
                  <input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleReset()}
                    placeholder="Repeat password"
                    className="w-full bg-[#0d0d0d] border border-[#252525] rounded-lg px-4 py-3 text-sm text-[#f5f0e8] placeholder-[#333] focus:outline-none focus:border-[rgba(201,168,76,0.5)] transition-colors"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={loading}
                  className="w-full py-3.5 rounded-lg bg-[#c9a84c] text-[#080808] font-semibold text-[14px] tracking-wide hover:bg-[#e8c97a] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-[rgba(201,168,76,0.15)] mt-2"
                >
                  {loading ? "Updating…" : "Update password"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
