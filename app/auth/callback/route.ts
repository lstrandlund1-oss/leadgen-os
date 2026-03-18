// app/auth/callback/route.ts
// Handles the redirect from Supabase after email confirmation.
// IMPORTANT: Must write session cookies directly onto the redirect response —
// using next/headers cookieStore alone does NOT forward cookies on a redirect.

import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { sendOnboardingDay1 } from "@/lib/email/send";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
  }

  // Build the redirect response first, then write cookies onto it directly.
  // This is the correct pattern for Next.js App Router — cookies set via
  // next/headers are NOT forwarded on a NextResponse.redirect().
  const redirectTo = next.startsWith("/") ? `${origin}${next}` : `${origin}/dashboard`;
  const response = NextResponse.redirect(redirectTo);

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.headers
          .get("cookie")
          ?.split(";")
          .map((c) => {
            const [name, ...rest] = c.trim().split("=");
            return { name: name.trim(), value: rest.join("=") };
          }) ?? [];
      },
      setAll(cookiesToSet) {
        // Write every session cookie directly onto the redirect response
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    console.error("auth/callback exchangeCodeForSession error:", error?.message);
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
  }

  // Send day-1 onboarding email for new signups (non-blocking)
  if (next.includes("onboarding") && data.user.email) {
    const name = data.user.user_metadata?.full_name?.split(" ")[0] ?? undefined;
    sendOnboardingDay1({ to: data.user.email, name }).catch(() => {});
  }

  // Return the redirect with session cookies attached
  return response;
}