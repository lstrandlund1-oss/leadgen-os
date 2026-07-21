"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabaseBrowser";

type Mode = "signin" | "signup";

export default function BetaAcceptForm({ token, invitedEmail }: { token: string; invitedEmail: string }) {
  const router = useRouter();
  const supabase = createSupabaseBrowser();

  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);

  const [mode, setMode] = useState<Mode>("signin");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setSessionEmail(data.user?.email ?? null);
      setCheckingSession(false);
    });
  }, [supabase]);

  const emailMatches = sessionEmail && sessionEmail.toLowerCase() === invitedEmail.toLowerCase();

  async function completeAcceptance() {
    setAccepting(true);
    setError(null);
    try {
      const res = await fetch("/api/beta/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(acceptErrorCopy(data.error));
        setAccepting(false);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setAccepting(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setSessionEmail(null);
  }

  async function handleSubmit() {
    if (!password) {
      setError("Please enter a password.");
      return;
    }
    setLoading(true);
    setError(null);

    if (mode === "signup") {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: invitedEmail,
        password,
        options: { emailRedirectTo: `${window.location.origin}/beta/invite/${token}` },
      });
      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }
      if (data.session) {
        // Email confirmation disabled on this project — session is
        // immediately usable, proceed straight to acceptance.
        await completeAcceptance();
      } else {
        setAwaitingConfirmation(true);
        setLoading(false);
      }
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: invitedEmail, password });
      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }
      await completeAcceptance();
    }
  }

  if (checkingSession) {
    return <div className="text-sm text-[#555]">Loading…</div>;
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 text-center">
        <p className="text-[11px] tracking-[0.2em] uppercase text-[#8a6e30] mb-3">You&apos;re invited</p>
        <h1 className="text-3xl md:text-4xl font-light" style={{ fontFamily: "var(--font-display), serif" }}>
          Join the{" "}
          <span className="italic" style={{ color: "#c9a84c" }}>
            closed beta
          </span>
        </h1>
      </div>

      <div className="rounded-2xl border border-[#252525] bg-[#111] p-6 space-y-4">
        <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-[#c9a84c] to-transparent -mt-6 mb-6 rounded-full" />

        {error && (
          <div className="px-4 py-3 rounded-lg border border-rose-500/30 bg-rose-500/5 text-[12px] text-rose-400">
            {error}
          </div>
        )}

        {sessionEmail ? (
          emailMatches ? (
            <>
              <p className="text-sm text-[#ccc]">
                Signed in as <span className="text-[#c9a84c]">{sessionEmail}</span>.
              </p>
              <button
                type="button"
                onClick={completeAcceptance}
                disabled={accepting}
                className="w-full py-3.5 rounded-lg bg-[#c9a84c] text-[#080808] font-semibold text-[14px] tracking-wide hover:bg-[#e8c97a] disabled:opacity-50 transition-all">
                {accepting ? "Activating…" : "Accept invitation"}
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-[#ccc]">
                This invite is for <span className="text-[#c9a84c]">{invitedEmail}</span>, but you&apos;re signed in as{" "}
                <span className="text-[#888]">{sessionEmail}</span>.
              </p>
              <button
                type="button"
                onClick={handleSignOut}
                className="w-full py-3 rounded-lg border border-[#252525] text-[13px] text-[#ccc] hover:border-[rgba(201,168,76,0.4)] transition-colors">
                Sign out and continue with {invitedEmail}
              </button>
            </>
          )
        ) : awaitingConfirmation ? (
          <div className="px-4 py-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 text-[12px] text-emerald-400">
            Check <span className="text-[#c9a84c]">{invitedEmail}</span> to confirm your account, then come back to this
            same invite link to finish.
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <label className="block text-[11px] uppercase tracking-widest text-[#666]">Invited email</label>
              <div className="w-full bg-[#0a0a0a] border border-[#252525] rounded-lg px-4 py-3 text-sm text-[#888]">
                {invitedEmail}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] uppercase tracking-widest text-[#666]">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                placeholder={mode === "signup" ? "Min. 6 characters" : "••••••••"}
                className="w-full bg-[#0d0d0d] border border-[#252525] rounded-lg px-4 py-3 text-sm text-[#f5f0e8] placeholder-[#333] focus:outline-none focus:border-[rgba(201,168,76,0.5)] transition-colors"
              />
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="w-full py-3.5 rounded-lg bg-[#c9a84c] text-[#080808] font-semibold text-[14px] tracking-wide hover:bg-[#e8c97a] disabled:opacity-50 transition-all mt-2">
              {loading ? "Please wait…" : mode === "signin" ? "Sign in & accept" : "Create account & accept"}
            </button>

            <p className="text-center text-[12px] text-[#555] pt-2">
              {mode === "signin" ? (
                <>
                  New to Vantio?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setMode("signup");
                      setError(null);
                    }}
                    className="text-[#c9a84c] hover:text-[#e8c97a] transition-colors">
                    Create an account
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setMode("signin");
                      setError(null);
                    }}
                    className="text-[#c9a84c] hover:text-[#e8c97a] transition-colors">
                    Sign in
                  </button>
                </>
              )}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function acceptErrorCopy(reason: string): string {
  switch (reason) {
    case "expired":
      return "This invite has expired.";
    case "revoked":
      return "This invite is no longer active.";
    case "already_accepted":
      return "This invite has already been used.";
    case "email_mismatch":
      return "This invite is for a different email address.";
    case "already_has_membership":
      return "This account already has an active beta membership.";
    default:
      return "Something went wrong. Please try again.";
  }
}
