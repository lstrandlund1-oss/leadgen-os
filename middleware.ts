// middleware.ts
// Protects /dashboard and /profile — redirects to /login if no session.
// Also refreshes the auth token on every request to keep sessions alive.
// Adds onboarding gate — users without a profile are sent to /onboarding.

import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_ROUTES = ["/dashboard", "/profile", "/onboarding", "/plans"];
const AUTH_ROUTES = ["/login"];

// Routes that require a completed profile
const PROFILE_GATED_ROUTES = ["/dashboard", "/outreach", "/collections", "/analytics"];

export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
      },
    },
  });

  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    return supabaseResponse;
  }

  const { pathname } = request.nextUrl;

  // ── Guard 1: Auth — redirect unauthenticated users ────────────────────────
  const isProtected = PROTECTED_ROUTES.some((route) => pathname.startsWith(route));
  if (isProtected && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ── Guard 2: Redirect authenticated users away from login ─────────────────
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));
  if (isAuthRoute && user) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // ── Guard 3: Onboarding gate — no profile → /onboarding ──────────────────
  // Skip if already on /onboarding or /settings to avoid redirect loops
  const needsProfileCheck =
    user &&
    PROFILE_GATED_ROUTES.some((route) => pathname.startsWith(route)) &&
    !pathname.startsWith("/onboarding") &&
    !pathname.startsWith("/settings");

  if (needsProfileCheck) {
    try {
      const { data: profileData } = await supabase
        .from("user_profiles")
        .select("profile_data")
        .eq("user_id", user!.id)
        .single();

      const hasProfile = !!(profileData?.profile_data as Record<string, unknown> | null)?.businessName;

      if (!hasProfile) {
        return NextResponse.redirect(new URL("/onboarding", request.url));
      }
    } catch {
      // Profile check failed — fail open, let the dashboard handle it
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public|api).*)"],
};
