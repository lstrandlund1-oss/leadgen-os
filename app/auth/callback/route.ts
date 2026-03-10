// app/auth/callback/route.ts
// Handles the redirect from Supabase after email confirmation.
// Exchanges the code for a session and redirects to dashboard or onboarding.

import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createSupabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Auth failed — redirect to login with error state
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}