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

// Middleware runs on every navigation site-wide. Without a timeout, a slow
// or hanging Supabase call (auth check or profile lookup) blocks the whole
// site indefinitely — this is what an "endless loading" page actually is,
// since Next.js won't serve the page until middleware resolves. Both calls
// below race against this and fail open (let the request through) on
// timeout, rather than hang forever.
const MIDDLEWARE_TIMEOUT_MS = 2500;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([promise, new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))]);
}

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

  // getUser() re-validates the JWT against Supabase's auth server on every
  // call — a network round-trip, on every single navigation site-wide.
  // getSession() reads the JWT locally from cookies with no network call,
  // which is what we actually need here: middleware only gates UX-level
  // redirects (send unauthenticated users to /login, gate onboarding).
  // Real authorization for data access is independently verified via
  // getUser() in the API routes themselves (see e.g. generate-outreach,
  // leads/snapshot) and enforced by RLS, so this doesn't weaken security —
  // it just stops paying a network round-trip for a check that isn't the
  // actual security boundary.
  let user = null;
  try {
    const result = await withTimeout(supabase.auth.getSession(), MIDDLEWARE_TIMEOUT_MS);
    user = result?.data.session?.user ?? null;
    if (result === null) {
      // Auth check timed out — fail open. Don't force a redirect either way;
      // let the request through and let the page/client handle actual auth
      // state, rather than hanging navigation indefinitely.
      return supabaseResponse;
    }
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
  // Exception: if there's an explicit error on the URL (e.g.
  // ?error=auth_callback_failed — the redirect target when a confirmation
  // link's code exchange fails, most commonly because it was opened on a
  // different device than the one that started signup, which is expected
  // PKCE behaviour), don't silently bounce away from it just because this
  // browser happens to have some OTHER, unrelated session already active.
  // That previously meant a confirmation failure was invisible — the
  // visitor would just land on their existing account's dashboard with no
  // explanation, rather than seeing the actual error and a path to recover
  // (see the login page's "already confirmed on another device" prompt).
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));
  const hasAuthError = request.nextUrl.searchParams.has("error");
  if (isAuthRoute && user && !hasAuthError) {
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
      const result = await withTimeout(
        // NOTE: user_profiles is keyed by `id` = the user's UID directly
        // (see app/api/profile/route.ts and every other query site in the
        // codebase) — not a separate `user_id` column. Querying the wrong
        // column here meant this NEVER matched, so hasProfile was always
        // false and every authenticated user got redirected to /onboarding
        // on every single visit to a profile-gated route. Since the
        // onboarding page's own check (via /api/profile, which uses the
        // correct column) would then correctly find their profile and
        // redirect back to /dashboard, this was an infinite redirect loop -
        // the actual cause of the "endless loading."
        Promise.resolve(supabase.from("user_profiles").select("profile_data").eq("id", user!.id).single()),
        MIDDLEWARE_TIMEOUT_MS,
      );

      // Timed out — fail open, same as a query error below.
      if (result !== null) {
        const hasProfile = !!(result.data?.profile_data as Record<string, unknown> | null)?.businessName;
        if (!hasProfile) {
          return NextResponse.redirect(new URL("/onboarding", request.url));
        }
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
