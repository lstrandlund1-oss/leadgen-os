// app/auth/callback/route.ts
// Handles the redirect from Supabase after email confirmation.
// Exchanges the code for a session, detects new vs returning users,
// sends day-1 onboarding email for new users, then redirects appropriately.

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
      // Detect new users by checking if they have a saved profile.
      // We do NOT rely on the `next` param because email clients (Gmail, Outlook)
      // can strip or rewrite query parameters on confirmation links.
      let isNewUser = false;
      try {
        const { data: profileData } = await supabase
          .from("user_profiles")
          .select("id, profile_data")
          .eq("id", data.user.id)
          .maybeSingle();

        // New user = no row in user_profiles, or row exists but no businessName set
        const businessName = (profileData?.profile_data as Record<string, unknown> | null)?.businessName;
        isNewUser = !profileData || !businessName;
      } catch {
        // If we can't check, default to respecting the `next` param
        isNewUser = next.includes("onboarding");
      }

      // Send day-1 onboarding email for new signups (non-blocking)
      if (isNewUser && data.user.email) {
        const name = data.user.user_metadata?.full_name?.split(" ")[0] ?? undefined;
        sendOnboardingDay1({ to: data.user.email, name }).catch(() => {});
      }

      // Route: new users always go to onboarding, returning users to dashboard or `next`
      const destination = isNewUser ? "/onboarding" : (next !== "/onboarding" ? next : "/dashboard");
      return NextResponse.redirect(`${origin}${destination}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}