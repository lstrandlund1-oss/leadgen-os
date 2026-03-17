// app/auth/callback/route.ts
// Handles the redirect from Supabase after email confirmation.
// Exchanges the code for a session, sends day-1 onboarding email for new users,
// then redirects to dashboard or onboarding.

import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { sendOnboardingDay1 } from "@/lib/email/send";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createSupabaseServer();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      const isNewUser = next.includes("onboarding");

      // Send day-1 email for new signups (non-blocking)
      if (isNewUser && data.user.email) {
        const name = data.user.user_metadata?.full_name?.split(" ")[0] ?? undefined;
        sendOnboardingDay1({ to: data.user.email, name }).catch(() => {});
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}