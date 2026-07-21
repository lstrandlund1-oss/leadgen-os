// app/beta/invite/[token]/page.tsx
// Personal invite link: /beta/invite/[token]
// Server-validates the token before rendering anything interactive.
// Defaults to Swedish (initial beta audience is Swedish agencies/consultants
// per the product brief) with an EN toggle via ?lang=en.

import Link from "next/link";
import { validateInviteToken } from "@/lib/beta/invitations";
import { getTranslations } from "@/lib/i18n";
import type { Language } from "@/lib/i18n/types";
import BetaAcceptForm from "./BetaAcceptForm";

export default async function BetaInvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { token } = await params;
  const { lang } = await searchParams;
  const language: Language = lang === "en" ? "en" : "sv";
  const t = getTranslations(language).ui.beta;

  const validation = await validateInviteToken(token);

  const errorCopy: Record<string, { title: string; body: string }> = {
    not_found: { title: t.invite.errorNotFoundTitle, body: t.invite.errorNotFoundBody },
    expired: { title: t.invite.errorExpiredTitle, body: t.invite.errorExpiredBody },
    revoked: { title: t.invite.errorRevokedTitle, body: t.invite.errorRevokedBody },
    accepted: { title: t.invite.errorAcceptedTitle, body: t.invite.errorAcceptedBody },
  };

  const otherLang = language === "sv" ? "en" : "sv";

  return (
    <div className="min-h-screen bg-[#080808] text-[#f5f0e8] flex flex-col">
      <nav className="flex items-center justify-between px-6 md:px-12 py-5 border-b border-[#252525]">
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
        <Link
          href={`/beta/invite/${token}?lang=${otherLang}`}
          className="text-[12px] text-[#666] hover:text-[#c9a84c] transition-colors uppercase tracking-wide">
          {otherLang}
        </Link>
      </nav>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        {validation.valid ? (
          <BetaAcceptForm token={token} invitedEmail={validation.email} language={language} />
        ) : (
          <div className="w-full max-w-sm text-center">
            <p className="text-[11px] tracking-[0.2em] uppercase text-[#8a6e30] mb-3">Private Beta</p>
            <h1 className="text-2xl font-light mb-4" style={{ fontFamily: "var(--font-display), serif" }}>
              {errorCopy[validation.reason]?.title ?? errorCopy.not_found.title}
            </h1>
            <p className="text-sm text-[#888] mb-8">{errorCopy[validation.reason]?.body ?? errorCopy.not_found.body}</p>
            <Link href="/" className="text-[13px] text-[#c9a84c] hover:text-[#e8c97a] transition-colors">
              {t.invite.backHome}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
