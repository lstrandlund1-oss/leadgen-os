# Private Beta System — Manual QA Checklist

Everything below requires a live Supabase connection, real concurrent
requests, or actual wall-clock time passing — none of which is testable
from Claude's sandbox (no network access to Supabase, no way to simulate
real concurrency or real days passing). This is the verification Phase 10
calls for on these items; the automated unit tests cover the pure logic
(see `lib/beta/*.test.ts`, `lib/ai/cost.test.ts` — 22 tests, run via `npm test`).

Run all 5 migrations (`supabase/migrations/0001` through `0005`) before
starting. Set `ADMIN_EMAILS` in your environment.

## Invitation security

- [ ] Create an invitation, let it sit past `BETA_INVITATION_EXPIRY_DAYS`
      (7 days — or temporarily lower the constant in `lib/beta/config.ts`
      to test faster), confirm `/beta/invite/[token]` shows "expired."
- [ ] Create an invitation, revoke it from the admin dashboard, confirm
      the link shows "no longer active."
- [ ] Accept an invitation successfully, then try the *same link* again —
      confirm it shows "already been used," not a second signup flow.
- [ ] Accept an invitation as the correct email, confirm it works. Then
      try opening the same invitation link while logged in as a
      *different* account — confirm it shows the email-mismatch message
      and offers to sign out, not silent acceptance.
- [ ] Open the same invitation link in two browser tabs, sign in as the
      correct account in both, click "Accept" in both at roughly the same
      time — confirm only one `beta_memberships` row exists afterward
      (check the `beta_memberships` table directly in Supabase).
- [ ] Check the `beta_invitations` table directly — confirm `token_hash`
      contains a 64-character hex hash, never the raw token from the URL.

## Duration

- [ ] Log in as a beta tester and do nothing else — check
      `beta_memberships.active_days_used` afterward, confirm it's still 0.
- [ ] Run one standard search, check `active_days_used` becomes 1.
- [ ] Run several more searches the *same calendar day* — confirm
      `active_days_used` stays at 1 (doesn't double-count same-day
      actions).
- [ ] Wait until the next calendar day (in the tester's timezone) and run
      one more search — confirm `active_days_used` becomes 2.
- [ ] Manually set `active_days_used` to 7 in Supabase for a test account,
      reload the app — confirm the account is now treated as expired
      (shows the completion page / hides beta UI).
- [ ] Manually set a test account's `hard_end_at` to a past date (with
      `active_days_used` still low, e.g. 1) — confirm it's expired anyway.
- [ ] From the admin dashboard, grant a 7-day extension to an active
      tester — confirm `extended_days` increases and `active_days_used`
      is completely unchanged.

## AI enforcement

- [ ] As a beta tester at their daily outreach limit, try to generate one
      more outreach message — confirm a 429 with a clear, translated
      message (test in both `?lang=en` and default Swedish contexts).
- [ ] Same for total limit (generate enough outreach messages to hit 40
      total, or lower `BETA_DEFAULT_ALLOWANCES.outreach.total` temporarily
      for faster testing).
- [ ] Set a low monetary ceiling for a test account via the admin
      dashboard (e.g. $0.01), confirm the very next AI action is blocked
      with `monetary_ceiling` as the reason, even if the daily/total
      counts wouldn't otherwise block it.
- [ ] This is the hardest one to test manually: fire two outreach
      generation requests for the same tester at literally the same time
      (e.g. two browser tabs, both clicking "Generate" within the same
      second) when the tester has exactly 1 remaining in their allowance —
      confirm only one succeeds, not both. This is what
      `reserve_beta_usage`'s row lock exists to guarantee.
- [ ] Retry the exact same logical outreach request with a stable
      idempotency key (currently the client doesn't supply one — see
      "Known limitations" in the handoff doc) and confirm it doesn't
      double-consume. *This one is not fully wired yet — see handoff doc.*
- [ ] Force an AI provider error (e.g. temporarily use an invalid
      `ANTHROPIC_API_KEY`) and attempt a generation — confirm the
      `beta_usage` row for that attempt ends up with `status = 'released'`,
      not `'committed'`, and doesn't count against the tester's limit.
- [ ] Test the exact same three AI actions as a **non-beta** user on a
      paid/commercial plan — confirm behavior is completely unchanged
      from before this integration (existing commercial limits still
      apply, no beta-related messaging appears).

## Persistence

- [ ] Let (or force) a beta membership to expire. Confirm: the account
      still logs in, the profile is intact, past searches/leads/outreach
      messages are still visible, outcomes are still recorded, feedback
      history still shows in Settings, tutorial completion status is
      unchanged.
- [ ] As an expired beta tester, try to generate a new outreach message —
      confirm it's blocked (falls through to commercial gating, which
      should block it if they're not on a paid plan) but everything
      *existing* remains readable.
- [ ] From the admin dashboard, use "Mark converted" on a test account —
      confirm `beta_memberships.status` becomes `'converted'` and the
      account keeps functioning (no duplicate account, no data loss).

## Tutorials and feedback

- [ ] As a brand-new beta tester, load the dashboard — confirm the
      "dashboard" tutorial shows once. Reload the page — confirm it does
      NOT show again (already completed/skipped).
- [ ] From Settings → Tutorials, click "Replay" on a completed tutorial —
      confirm it shows again on the relevant page.
- [ ] Click into the niche/location search fields for the first time —
      confirm the "search" tutorial appears (distinct from "dashboard").
- [ ] Select a lead for the first time — confirm "lead_focus" tutorial
      appears; switch to the Outreach tab — confirm it swaps to the
      "outreach" tutorial; switch to Tracking — confirm it swaps to
      "outcomes." Confirm only ever one tutorial card is visible at a
      time, never two overlapping.
- [ ] Trigger two different feedback-eligible conditions in the same
      browser session (e.g. complete 2 searches AND record an outcome) —
      confirm only ONE automatic feedback prompt appears, not two.
- [ ] Submit feedback with "not used enough to rate" checked — check the
      `beta_feature_feedback` row directly: confirm `rating` is `NULL`,
      not `0` or any number.
- [ ] Submit lead-specific feedback (accuracy flag) and feature feedback
      for the same session — confirm they land in `beta_lead_feedback`
      and `beta_feature_feedback` respectively, never mixed.
- [ ] Switch the invite page and dashboard between `?lang=en` and Swedish
      (default) — read through every beta-related string (tutorials,
      feedback prompts, limit messages, completion page) and confirm
      nothing is untranslated or falls back to a raw key name.