"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabaseBrowser";
import { getTranslations } from "@/lib/i18n";
import { getStoredLanguage } from "@/lib/languagePreference";

export default function AcceptInvitePage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const [language] = useState(() => getStoredLanguage());
  const t = getTranslations(language).ui.members;
  const [status, setStatus] = useState<"checking" | "accepting" | "success" | "error">("checking");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowser();
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        router.replace(`/login?next=${encodeURIComponent(`/workspace/accept/${params.token}`)}`);
        return;
      }

      setStatus("accepting");
      try {
        const res = await fetch(`/api/workspace/accept/${params.token}`, { method: "POST" });
        const body = await res.json().catch(() => ({}));
        if (res.ok) {
          setStatus("success");
          setTimeout(() => router.replace("/home"), 1500);
        } else {
          setStatus("error");
          setErrorMessage(body.error ?? "This invitation could not be accepted.");
        }
      } catch {
        setStatus("error");
        setErrorMessage("This invitation could not be accepted.");
      }
    });
  }, [params.token, router]);

  return (
    <div className="min-h-screen bg-[#080808] text-[#f5f0e8] flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        {(status === "checking" || status === "accepting") && (
          <p className="text-[14px] text-[#888]">{t.joiningWorkspace}</p>
        )}
        {status === "success" && <p className="text-[14px] text-[#4ade80]">{t.acceptSuccess}</p>}
        {status === "error" && (
          <>
            <p className="text-[14px] text-[#f87171] mb-2">{t.acceptError}</p>
            <p className="text-[12px] text-[#666]">{errorMessage}</p>
          </>
        )}
      </div>
    </div>
  );
}
