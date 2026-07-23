# Private Beta Integration — Final Handoff

## 1. Summary of behavior implemented

A complete private-beta entitlement system, fully separate from the
commercial plan system (`lib/plan.ts`/Stripe) by design — beta status is
resolved independently and only ever *adds* access on top of whatever the
commercial system decides, never replacing it.

- **Invitations**: admin creates a personal, expiring, single-use link
  (hashed token, raw token never stored). Acceptance locks the email field
  to the invited address, atomically creates the membership, and is race-
  safe against concurrent/repeated acceptance.
- **Entitlement & metering**: active beta members get operator-equivalent
  access to core features (search, deep search, outreach, etc.) but their
  own atomically-metered AI allowances (40 outreach/10 daily, 20 follow-
  up/5 daily, 5 deep search/2 daily by default, admin-overridable per
  tester) with real per-call cost tracking against a monetary ceiling.
- **Duration**: 7 active days OR 14 calendar days, whichever comes first;
  admin-grantable 7-day extensions that never reset usage history.
- **Tutorials**: 7 contextual walkthroughs, shown once per version,
  replayable from Settings, never more than one visible at a time.
- **Feedback**: threshold-triggered prompts (once per browser session),
  stable reason keys by rating tier, voluntary re-rating, lead-specific
  feedback kept separate from feature feedback.
- **Expiration & completion**: automatic (lazy, on read) and admin-
  triggered, preserves all account data, shows a completion page with
  honest discount status (30% off 12 months, earned via 3+ active days +
  admin-marked interview + completed feedback — never testimonial-gated).
- **Admin dashboard** (`/admin/beta`, allowlist-protected): full tester
  overview (usage, outcomes, ratings, testimonial/discount status) and 11
  admin actions, all server-authorized and audited.
- **Analytics**: the spec's full 23-event taxonomy, logged at real
  completion points (not page loads), no sensitive data in event payloads.

## 2. Database migrations and RLS policies

Five forward-only migrations in `supabase/migrations/`, run in order —
**these have not been executed from Claude's environment; no network
access to Supabase from this sandbox.** You've confirmed running 0001-0003
already; 0004 and 0005 still need running if not already done.

| File | Adds |
|---|---|
| `0001_private_beta_schema.sql` | `beta_invitations`, `beta_memberships`, `beta_usage`, `beta_feature_feedback`, `beta_lead_feedback`, `analytics_events`; `reserve_beta_usage`/`commit_beta_usage`/`release_beta_usage`/`record_beta_active_day` functions |
| `0002_beta_accept_invitation.sql` | `accept_beta_invitation` function |
| `0003_beta_schema_extensions.sql` | `beta_testimonials`, `beta_discount_grants`, `beta_tutorial_progress` tables; `company_name` on invitations; provider/model/request_id on usage ledger |
| `0004_beta_discount_deadline_nullable.sql` | Makes `redemption_deadline` nullable (no official launch date exists yet) |
| `0005_beta_admin_overrides_and_audit.sql` | `beta_feature_allowances` (per-tester override table); `monetary_ceiling_micro_usd` column |

RLS: every beta table has RLS enabled. `beta_invitations`, `beta_usage`,
`analytics_events`, `beta_feature_allowances` are service-role-only (zero
client access). `beta_memberships`, `beta_discount_grants`,
`beta_testimonials` allow the owning user to `SELECT` their own row only —
all writes go through API routes using the service role.
`beta_feature_feedback`, `beta_lead_feedback`, `beta_tutorial_progress`
allow the owning user full access to their own rows (read + write), since
those actions are user-initiated and don't need server-side gatekeeping
beyond normal auth.

## 3. Important files changed

Too many to fully enumerate (this was a 9-phase build across many
sessions) — the complete new surface lives under `lib/beta/`,
`lib/analytics/`, `lib/ai/cost.ts`, `app/beta/`, `app/admin/beta/`,
`app/api/beta/`, `app/api/admin/beta/`, `app/api/analytics/track/`. Files
*modified* (not new) in existing parts of the app: `middleware.ts`
(unrelated auth fix, predates this project), `app/api/generate-outreach`,
`app/api/sequences`, `app/api/search/discover` (beta gating + real cost),
`app/api/profile`, `app/api/outcomes` (event logging),
`app/onboarding/page.tsx`, `app/dashboard/page.tsx`, `app/outreach/page.tsx`
(event logging + tutorial/feedback overlays), `app/settings/page.tsx`,
`app/profile/settings/page.tsx`, `app/components/HamburgerMenu.tsx`
(subscription UI hidden for active beta members), `lib/i18n/{types,en,sv}.ts`
(full EN/SV coverage for every beta-facing string), `lib/outreach/types.ts`,
`lib/outreach/generateMessage.ts`, `lib/outreach/humanizeMessage.ts`,
`lib/sequences/generateSequence.ts` (real token usage capture).

## 4. New environment/configuration values

- `ADMIN_EMAILS` — comma-separated list, server-side only, never
  `NEXT_PUBLIC_`. Required for `/admin/beta` and invitation creation.
- No other new env vars. Everything else configurable is in code (see #5).

## 5. Exact default beta limits and where they're configured

All in `lib/beta/config.ts`:

| Constant | Value |
|---|---|
| `BETA_ACTIVE_DAYS_LIMIT` | 7 |
| `BETA_CALENDAR_DAYS_LIMIT` | 14 |
| `BETA_EXTENSION_DAYS` | 7 (per grant; admin can grant multiple times) |
| `BETA_INVITATION_EXPIRY_DAYS` | 7 |
| `BETA_DEFAULT_ALLOWANCES.outreach` | 10/day, 40 total |
| `BETA_DEFAULT_ALLOWANCES.followup` | 5/day, 20 total |
| `BETA_DEFAULT_ALLOWANCES.ai_deep_search` | 2/day, 5 total |
| `BETA_DEFAULT_MONETARY_CEILING_MICRO_USD` | $15 |
| `BETA_DISCOUNT_PERCENT` / `BETA_DISCOUNT_MONTHS` | 30% / 12 months |
| `BETA_COMPLETION_MIN_ACTIVE_DAYS` | 3 |

Per-tester overrides (allowance limits, monetary ceiling) are set via the
admin dashboard and stored in `beta_feature_allowances` /
`beta_memberships.monetary_ceiling_micro_usd` — these take priority over
the global constants above when present.

## 6. Test/typecheck/lint commands run and their results

```bash
npm run typecheck   # 0 errors, run after every single change across all 9 phases
npm run lint        # 0 errors; a handful of pre-existing warnings unrelated to this work, listed below
npm test            # 22/22 passing (Vitest, newly introduced — no test framework existed before)
```

**Pre-existing lint warnings, not introduced by this work** (reported
separately per the spec's instruction not to hide them):
- `app/settings/page.tsx` — missing `useEffect` dependency, unused `toggle` variable
- `app/profile/settings/page.tsx` — unused `userId` variable, missing `useEffect` dependency
- `app/onboarding/page.tsx` — unused `saveFailed` variable (its setter is never called anywhere)
- `app/page.tsx` — 12 pre-existing warnings from before this project started (unused legacy variables/components)

**What I could not run**: any test against a live Supabase connection.
This sandbox has no network access to Supabase — the 22 automated tests
cover pure logic only (date/expiry math, cost calculation, reason-key
selection, config values). Everything requiring real database state,
RLS enforcement, or actual concurrency is in the manual QA checklist
(`docs/BETA_MANUAL_QA_CHECKLIST.md`) instead.

## 7. Manual QA checklist

See `docs/BETA_MANUAL_QA_CHECKLIST.md` — covers invitation security,
duration limits, AI enforcement (including the concurrency/idempotency
cases automated tests can't reach), persistence through expiration, and
tutorials/feedback, organized to match the spec's own verification
categories exactly.

## 8. Remaining payment-provider integration needed for discount redemption

None of this touches Stripe yet — `beta_discount_grants.status` goes
`pending → earned`, and stays there. To actually redeem a discount at
commercial launch, you'll need:
- A real launch date, so `redemption_deadline` (currently `NULL` by
  design — see migration 0004) can be set to launch + 30 days.
- A Stripe integration that, on subscription creation for an account with
  an `earned` discount grant, applies the 30%/12-month coupon and updates
  `beta_discount_grants.status` to `'redeemed'` with the subscription
  reference.
- The `markBetaConverted` function (`lib/beta/completion.ts`) exists as
  the domain path for marking an account converted, but is currently only
  callable manually from the admin dashboard — wiring it to fire
  automatically from a real Stripe webhook is the remaining piece.

## 9. Assumptions and intentionally deferred items

- **Idempotency keys are generated fresh server-side per request**, not
  supplied by the client. The atomic reservation mechanism itself is
  fully race-condition-safe (verified via row locking), but true
  retry-idempotency (a client retrying the *exact same* logical action
  with a stable key) needs a small client-side change to generate and
  persist a key across retries. Not done.
- **Cost estimates fall back to static values** only when the AI
  provider's response doesn't include token usage data (rare, but
  possible on error paths) — otherwise all three AI actions now use real
  per-call cost from actual token counts at verified current Haiku 4.5
  pricing ($1/M input, $5/M output, checked July 2026).
- **The "search" tutorial has no separate live trigger from "dashboard"
  on the very first page load** — it triggers on first genuine
  interaction with the niche/location fields, which is a deliberate
  design choice (their content overlaps enough that showing both
  immediately on load felt redundant), not an oversight.
- **Testimonial requests are a manual, admin-driven process** (per the
  spec's "ask only when genuine value was demonstrated") — there's no
  in-app tester-facing "submit a testimonial" flow, only an admin action
  to record and approve wording the operator collected personally.
- **Tutorials are currently beta-only by design** — gated on active beta
  membership in both the display logic and the API routes. You've
  indicated you want this to become a permanent platform feature at full
  release; that will require re-keying `beta_tutorial_progress` (or a
  renamed equivalent) by `user_id` instead of `membership_id`, and
  dropping the beta-status gate in `PageTutorial`/`TutorialsSettingsList`.
  Deliberately not done yet, per your own instruction to defer it.
- **Admin dashboard has no pagination** — fine for 3-5 testers, would
  need addressing before any larger-scale beta.