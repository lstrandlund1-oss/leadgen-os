"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// This page showed "profile type" and a "saved leads" list, but the saved
// leads read from an old, disconnected localStorage key
// (vantio_saved_leads_v1) rather than the real lead_collections database
// table — meaning it silently diverged from what Collections and Home's
// "Save lead" button actually show, and could never agree with either.
// Both real capabilities this page offered now live in properly
// database-backed places: profile type/business info is in Settings'
// profile tab, and saved leads are in Collections (both reachable from the
// sidebar). Redirects rather than 404s, in case anything still links here.
export default function ProfileRedirect() {
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
