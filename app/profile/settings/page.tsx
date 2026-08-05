"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// This page was an earlier, since-superseded duplicate of /settings (same
// component, same tabs, just copied and left to diverge). /settings is the
// actively-maintained version — it has everything this page had plus
// everything built since (economic profile fields, sidebar navigation,
// etc.). Rather than delete this route outright and risk breaking any
// bookmarked or externally-linked URLs, it now redirects to the real page.
export default function ProfileSettingsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/settings");
  }, [router]);

  return (
    <div className="min-h-screen bg-[#080808] flex items-center justify-center">
      <p className="text-[13px] text-[#666]">Redirecting…</p>
    </div>
  );
}
