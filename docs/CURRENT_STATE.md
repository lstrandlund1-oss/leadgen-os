# Current State — Vantio

Last updated after a multi-session security/localization/beta-readiness
audit. This is a snapshot of what's actually true right now, verified
where stated — not a roadmap, not a wishlist. If something here turns out
to be wrong, fix this file in the same change that proves it wrong.

## Working

- **Authentication** — Supabase auth, email/password, session-based.
- **Onboarding** — profile creation (business info, capabilities,
  prospecting preferences), fully localized EN/SV.
- **Search** — Google Places-based lead discovery, both standard and
  AI-assisted "deep search" (Haiku-generated query variants). Live
  pipeline is `app/api/search/discover/route.ts` and
  `app/api/providers/search/route.ts` — both verified live, both properly
  authenticated and cost-tracked as of this audit.
- **Search result caching** — a deliberate, verified-correct architecture:
  `provider_runs` is a shared cache across all users keyed by
  `(provider, intent_hash)`; individual companies are separately
  deduplicated by `(source, source_id)`. See
  `docs/SEARCH_CACHING_ARCHITECTURE.md`. Per-user ownership (for "my saved
  leads") is tracked via a separate `user_search_runs` join table, not by
  adding ownership to the shared cache itself.
- **Lead scoring & signals** — opportunity/risk/fit scoring, gap
  classification, confidence scoring. Not independently re-verified in
  this audit beyond confirming it now correctly reads the searching
  user's real profile (see "Fixed this session" below).
- **Deep enrichment** — website scan feature (`app/api/deep-scan/route.ts`),
  fixed this session to require real authentication instead of falling
  back to a shared placeholder identity.
- **Outreach generation** — three-stage AI pipeline (strategy → generate →
  humanize), channel-aware (email/LinkedIn DM/cold call), tone selection,
  one-click refinement. Fully localized EN/SV. Real per-call cost
  tracking (verified Haiku 4.5 pricing).
- **Follow-up sequences** — AI-generated multi-step cadences, tracked in
  the Sequence Queue page. Fully localized EN/SV.
- **Outcome tracking** — contacted/replied/booked/closed, revenue, notes.
  RLS-secured this session (was a live, unauthenticated cross-tenant data
  leak before the fix — see Known Risks Resolved below).
- **Feedback & tutorials** — beta-tester-facing, both fully built with
  DB-persisted progress and EN/SV content.
- **Private beta system** — invitations, entitlements, per-tester AI
  allowances, admin dashboard, expiration/completion/discount logic. Built
  across 10 phases earlier in this project; considered feature-complete.
- **Localization** — every in-app page a real user reaches is fully
  translated EN/SV: dashboard, onboarding, login, settings,
  profile/settings, outreach, followups. See
  `docs/LOCALIZATION_STATUS.md` for exact scope and the one deliberate
  exception (AI refine instructions stay English — they're prompts, not
  UI text).
- **AI cost telemetry** — outreach, sequences, deep search, lead snapshot,
  and support chat all now log real per-call cost from actual token
  usage. Verified this session; previously only outreach/sequences/deep
  search had this.
- **AI kill switch** — a single admin-toggleable platform setting
  (`platform_settings` table) instantly disables all 6 AI-calling
  endpoints, no redeploy required. Built this session, addressing a gap
  flagged in the original audit.
- **Row-level security** — comprehensively audited this session. Every
  table checked; every table with a real gap fixed. See "Known Risks
  Resolved" below for the specifics, since several were genuinely severe.

## Partially working

- **Support chat** — functions correctly, but was completely unmetered
  (no auth, no rate limit, no cost tracking) until this session. Now rate
  limited by IP and cost-tracked. Still worth deciding whether it should
  be exempt from the AI kill switch (currently is not — an emergency
  AI-spend stop also takes down support chat, which may or may not be
  what you want during an actual incident).
- **Search history** — the `searches` table exists, is now correctly
  secured (was previously readable by anyone, unscoped), but the *live*
  search pipeline has never actually written to it. "Recent searches,"
  the niche/location autocomplete, and the getting-started checklist's
  "you've searched" step all depend on this table having real data, so in
  practice these currently show nothing / never complete for real users.
  Deliberately left this way — you indicated a future feature will need
  real search history and would rather wire the write path properly then
  than build it twice. Nothing to fix here until that happens.

## Broken (confirmed, not yet fixed)

- **`/api/stripe/checkout`** — `app/plans/page.tsx` calls this route
  directly. It does not exist anywhere in the codebase. Anyone who isn't
  a beta member and clicks "upgrade" gets a 404, not a checkout flow.
  `stripe` is an installed dependency but there is no `app/api/stripe/`
  directory at all. **Correction to an earlier assessment in this
  project**: this is not waiting on Stripe setup or credentials from you —
  `.env.local` already has a complete, real Stripe configuration (secret
  key, webhook secret, publishable key, and a full 36-price-ID matrix
  across 3 plans × 3 periods × 4 currencies), confirmed unused by any
  code. See `docs/ENVIRONMENT_VARIABLES.md`. What's missing is purely the
  application code — a checkout route and a webhook handler.

## Not implemented

- Any actual Stripe integration (checkout, webhooks, customer portal) —
  see above.
- A baseline migration that reproduces the *core* schema (leads, runs,
  profiles, outcomes, etc.) from scratch. The `supabase/migrations/`
  folder only contains additions from this project's beta/security work
  (0001-0012) — the original core tables predate any migration file and
  were applied directly via the SQL editor at some point. If this
  Supabase project were lost, the repo alone cannot reconstruct the core
  schema. Waiting on a columns export from you (excluding `beta_%` tables,
  to avoid the row-limit truncation that happened on the first attempt)
  to build this properly.
- Structural mobile rework of the dashboard's lead list (table → cards).
  Flagged during the mobile-fix work as a bigger, separate undertaking;
  several individual mobile bugs were fixed without doing this larger
  rebuild.

## Beta blockers

None remaining, as far as this audit found. Localization (the actual
blocker identified) is done. The RLS/security findings were arguably
worse than "blocks the beta" — several were live, exploitable
vulnerabilities regardless of beta status — and are now fixed.

## Technical debt (non-blocking)

- `app/settings/page.tsx` and `app/profile/settings/page.tsx` are two
  substantially overlapping implementations of the same concept (profile,
  preferences, notifications, account tabs). Not fixed — a product
  decision about whether both should exist, not a bug. See
  `docs/LOCALIZATION_STATUS.md` for the specifics of what differs between
  them.
- Several dead/unused files were found and removed this session
  (`app/api/leads/route.ts`) or fixed-but-still-unused
  (`lib/runLeads/fetchRunContext.ts` — nothing calls it, fixed for
  correctness anyway since it was cheap and already being audited).
  Worth a periodic sweep for more of these; this audit wasn't exhaustive
  about finding every unused file, only the ones encountered while
  tracing RLS issues.

## Known risks resolved this session (were real, not theoretical)

- `user_profiles` had a policy (`allow_all`) that overrode every other
  scoped policy on the table, making every user's business profile
  readable/writable by anyone — and was *load-bearing*, since the
  profile-read code was using the wrong (anon, no-session) Supabase
  client. Both fixed together.
- `lead_outcomes` was readable by **any unauthenticated visitor**, and
  enumerable by guessing sequential run IDs — a live, no-login-required
  data leak of revenue figures and private notes.
- The live lead-scoring endpoint (`providers/runs/[id]/leads`) was
  reading `user_profiles` via the same wrong client — meaning real
  searches were likely being scored against a generic default profile
  instead of the searching user's actual one, silently, for an unknown
  period before this audit.
- Five tables (`contact_submissions`, `waitlist`, `lead_deep_scans`,
  `lead_outcomes`, `support_tickets`) had RLS completely disabled.
- Five more tables (`provider_runs`, `provider_run_raws`, `companies_raw`,
  `companies_normalized`, `company_classifications`) had fully open
  "dev_"-prefixed policies — anyone with the public anon key could
  read/modify/delete data the entire platform depends on.
- `rate_limits` was fully open, meaning a user could delete their own
  rate-limit rows to bypass throttling entirely.
- `app/api/support-chat/route.ts` had zero auth, zero rate limiting, and
  zero cost tracking — a live, unauthenticated, unmetered AI cost
  exposure, reachable from every page of the app.

Full detail on each of these, including exactly what was checked and how
each fix was verified, is in the git history for this period — every fix
was compiled, linted, and tested before being handed over, and several
were caught and corrected mid-session when a first attempt turned out to
be wrong (worth knowing if you're ever auditing the audit itself).

## Next milestone

First real external Swedish beta tester successfully completes the core
workflow: search → lead review → outreach → outcome tracking → feedback.
Nothing currently blocks this from a code standpoint. Remaining
dependencies are operational: confirming your own Supabase/Vercel
verification from earlier in this audit, and lining up the actual first
tester.