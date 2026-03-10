"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#080808] text-[#f5f0e8] flex flex-col items-center justify-center px-6 text-center">
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(201,168,76,0.05) 0%, transparent 65%)" }} />

      <span className="text-5xl text-[#1a1a1a] mb-6 block">△</span>
      <h1 className="text-2xl font-light mb-3" style={{ fontFamily: "var(--font-display), serif" }}>Something went wrong</h1>
      <p className="text-[14px] text-[#555] max-w-sm leading-relaxed mb-8">
        An unexpected error occurred. This has been noted. Try refreshing — if the problem persists, contact support.
      </p>
      {error.digest && (
        <p className="text-[11px] text-[#333] font-mono mb-6">Error ref: {error.digest}</p>
      )}
      <div className="flex items-center gap-3">
        <button
          onClick={reset}
          className="px-5 py-2.5 rounded-lg bg-[#c9a84c] text-[#080808] text-[13px] font-semibold hover:bg-[#e8c97a] transition-colors"
        >
          Try again
        </button>
        <Link
          href="/dashboard"
          className="px-5 py-2.5 rounded-lg border border-[#252525] text-[13px] text-[#888] hover:border-[#444] hover:text-[#f5f0e8] transition-all"
        >
          Back to dashboard
        </Link>
      </div>
      <Link href="/contact" className="mt-8 text-[12px] text-[#333] hover:text-[#555] transition-colors">
        Report this issue →
      </Link>
    </div>
  );
}
