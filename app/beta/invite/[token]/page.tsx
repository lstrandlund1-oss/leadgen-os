// app/beta/invite/[token]/page.tsx
// Personal invite link: /beta/invite/[token]
// Server-validates the token before rendering anything interactive.

import Link from "next/link";
import { validateInviteToken } from "@/lib/beta/invitations";
import BetaAcceptForm from "./BetaAcceptForm";

const ERROR_COPY: Record<string, { title: string; body: string }> = {
  not_found: {
    title: "Invite link not recognized",
    body: "This invite link doesn't match an active invitation. Double-check the link, or ask for a new one.",
  },
  expired: {
    title: "This invite has expired",
    body: "Personal invite links expire after a set window. Ask for a new invitation.",
  },
  revoked: {
    title: "This invite is no longer active",
    body: "This invitation was revoked. Ask for a new one if you'd still like to join.",
  },
  accepted: {
    title: "This invite has already been used",
    body: "This invitation was already accepted. If that was you, just sign in as usual.",
  },
};

export default async function BetaInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const validation = await validateInviteToken(token);

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
      </nav>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        {validation.valid ? (
          <BetaAcceptForm token={token} invitedEmail={validation.email} />
        ) : (
          <div className="w-full max-w-sm text-center">
            <p className="text-[11px] tracking-[0.2em] uppercase text-[#8a6e30] mb-3">Private Beta</p>
            <h1 className="text-2xl font-light mb-4" style={{ fontFamily: "var(--font-display), serif" }}>
              {ERROR_COPY[validation.reason]?.title ?? "This invite link isn't valid"}
            </h1>
            <p className="text-sm text-[#888] mb-8">
              {ERROR_COPY[validation.reason]?.body ?? "Please check the link or ask for a new invitation."}
            </p>
            <Link href="/" className="text-[13px] text-[#c9a84c] hover:text-[#e8c97a] transition-colors">
              ← Back to home
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
