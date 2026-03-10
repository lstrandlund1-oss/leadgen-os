import Link from "next/link";

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-[#080808] text-[#f5f0e8] flex flex-col items-center justify-center px-6 text-center">
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(201,168,76,0.04) 0%, transparent 65%)" }} />

      <span className="text-6xl font-light text-[#1e1e1e] mb-6 block" style={{ fontFamily: "var(--font-display), serif" }}>404</span>
      <h1 className="text-2xl font-light mb-3" style={{ fontFamily: "var(--font-display), serif" }}>Page not found</h1>
      <p className="text-[14px] text-[#555] max-w-sm leading-relaxed mb-8">
        The page you&apos;re looking for doesn&apos;t exist, or may have moved. Let&apos;s get you back on track.
      </p>
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <Link
          href="/dashboard"
          className="px-5 py-2.5 rounded-lg bg-[#c9a84c] text-[#080808] text-[13px] font-semibold hover:bg-[#e8c97a] transition-colors"
        >
          Go to dashboard
        </Link>
        <Link
          href="/"
          className="px-5 py-2.5 rounded-lg border border-[#252525] text-[13px] text-[#888] hover:border-[#444] hover:text-[#f5f0e8] transition-all"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
