# Environment Variables

Complete inventory of every environment variable referenced anywhere in
the codebase, built by searching for actual usage (`process.env.X` and
the `requireEnv()` wrapper pattern), not by reading `.env.local`'s values.
**No secret values appear anywhere in this file or should ever be added
to it.**

## How to read "Required"

- **Required** — the feature it powers breaks or silently degrades without it.
- **Required (has fallback)** — code checks for its absence and degrades
  gracefully (e.g., returns empty results) rather than crashing.
- **Optional** — genuinely optional, or currently unused.

## Core infrastructure

| Variable | Purpose | Client/Server | Required |
|---|---|---|---|
| `SUPABASE_URL` | Supabase project URL, server-side | Server | Required |
| `NEXT_PUBLIC_SUPABASE_URL` | Same URL, exposed to the browser | Client | Required |
| `SUPABASE_ANON_KEY` | Public anon key, server-side reference | Server | Required |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same anon key, used by the browser client (`lib/supabaseClient.ts`, `lib/supabaseBrowser.ts`) | Client | Required |
| `SUPABASE_SERVICE_ROLE_KEY` | Bypasses RLS — used by `lib/supabaseServiceClient.ts` and `lib/beta/serviceClient.ts` for all the service-role operations built during the security audit (search pipeline persistence, rate limiting, kill switch, etc.) | Server only — **never expose this to the client** | Required |

## AI providers

| Variable | Purpose | Client/Server | Required |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | Every Claude call in the app: outreach generation/refine, sequences, deep search query planning, lead snapshot, support chat | Server only | Required (has fallback — each endpoint returns a clear "not configured" error if missing, rather than crashing) |

## Search providers

| Variable | Purpose | Client/Server | Required |
|---|---|---|---|
| `GOOGLE_MAPS_API_KEY` | Google Places API — the core lead-discovery search. Accessed via a `requireEnv()` wrapper in `lib/providers/googlePlaces.ts`, not a direct `process.env` reference — worth knowing if you're ever grepping for it. | Server only | Required — search is the core product, this is not optional |
| `SERP_API_KEY` | Secondary/supplementary search provider | Server only | Required for whatever specific feature uses it (2 files reference it — not independently verified which feature this session) |
| `PLACES_TEXT_SEARCH_URL` | **Present in `.env.local` but not actually read by the code** — `lib/providers/googlePlaces.ts` has its own hardcoded constant with the same name and value. This env var is currently dead/redundant. Safe to remove from `.env.local` if you want to tidy up, or leave it — it has zero effect either way. | N/A | Unused |

## Email

| Variable | Purpose | Client/Server | Required |
|---|---|---|---|
| `RESEND_API_KEY` | Transactional email sending (Resend) | Server only | Required for whatever email flows use it — not independently re-verified this session which ones |
| `SUPPORT_EMAIL` | Support contact address, likely used in outbound email templates | Server only | Optional/contextual |
| `SUPPORT_NOTIFY_EMAIL` | Internal notification address for support tickets | Server only | Optional/contextual |

## Beta system

| Variable | Purpose | Client/Server | Required |
|---|---|---|---|
| `ADMIN_EMAILS` | Comma-separated allowlist for `/admin/beta` and `/admin/platform-settings` access | Server only | Required for admin dashboard access at all |
| `NEXT_PUBLIC_BETA_PLAN` | Referenced by `lib/plan.ts` — appears to be the pre-launch "treat everyone as operator tier" mechanism mentioned repeatedly throughout this project's plan-gating logic | Client | Currently load-bearing for the whole commercial plan system's pre-launch behavior — do not remove without understanding `lib/plan.ts` fully first |

## Deployment

| Variable | Purpose | Client/Server | Required |
|---|---|---|---|
| `NEXT_PUBLIC_BASE_URL` | Used to build absolute URLs (e.g., invite links, email redirect URLs) | Client | Required — several flows (invite links, auth email redirects) would generate wrong URLs without it |
| `NEXT_PUBLIC_SHOW_MOCK_PROVIDER` | Present in `.env.local`, zero references found anywhere in the code. Either fully dead, or was removed from the code without removing the env var. | N/A | Unused (as far as this audit found) |

## Stripe — configured, but genuinely not wired into any code yet

**Important finding from this audit**: `.env.local` already contains a
complete, real Stripe configuration — secret key, publishable key,
webhook secret, and a full price ID matrix (3 plans × 3 billing periods ×
4 currencies = 36 price IDs). **Zero of these are referenced anywhere in
the actual application code.** This is not a "missing credentials"
situation — someone did the Stripe product/pricing setup work already.
What's missing is purely the application code: a checkout session
creation route, a webhook handler, and whatever UI wires the plans page
to actually use them.

| Variable | Purpose |
|---|---|
| `STRIPE_SECRET_KEY` | Server-side Stripe API key |
| `STRIPE_PUBLISHABLE_KEY` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Client-side Stripe.js key |
| `STRIPE_WEBHOOK_SECRET` | Verifies incoming Stripe webhook signatures |
| `STRIPE_PRICE_{SCOUT,OPERATOR,AGENCY}_{MONTHLY,QUARTERLY,YEARLY}_{SEK,USD,EUR,GBP}` | 36 individual price IDs, one per plan/period/currency combination |

See `docs/CURRENT_STATE.md` for how this fits into the broader picture —
this is the one confirmed "not implemented" item with no beta-blocking
impact, since beta testers get free access regardless.

## What to do when adding a new environment variable

Update this file in the same change that introduces the variable. If it's
a secret, only the name/purpose/scope belongs here — never the value.