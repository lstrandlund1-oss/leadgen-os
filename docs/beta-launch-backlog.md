# Vantio — Beta Launch Backlog
**Target: Beta launch, beginning of September**
Compiled from every task decided since the decision to rebuild Vantio (originally triggered by the inability to refill AI tokens for existing users). Status markers: ✅ Done · 🟡 Partial · 🔲 Not started

---

## 1. Core Rebuild — Foundation (Weeks 0–4)

- ✅ Discovery Engine V2: geographic partitioning, query expansion (33 niche categories), cross-provider deduplication, real cost/yield measurement
- ✅ Cost multiplier bug fixed (was silently 64x, corrected to 19x)
- ✅ Home page rebuild: sidebar layout, two-column design, demo mode, recommendations, insight banner, goal tracking
- ✅ Pipeline page (data layer + original build)
- ✅ Markets feature: schema, create/list/refresh/snapshot, honest coverage estimate
- ✅ Stats page: conversion funnel, economic impact, "Today's Recap"
- ✅ Insight engine + goal engine — both real, data-driven, return null rather than fabricate
- ✅ Workspace architecture: workspaces, members, invitations (migrations 0018–0019, confirmed run)
- ✅ Sidebar replacing the old hamburger menu across every core page (Home, Pipeline, Stats, Markets, Templates, Members, Dashboard, Outreach, Followups, Collections, Settings)
- ✅ Sidebar restructured into Main / Engagement / Workspace tiers
- ✅ Post-login/onboarding redirect changed from `/dashboard` to `/home`
- ✅ Templates page (full CRUD)
- ✅ Members page (real invite flow via Resend)

## 2. Navigation & Consolidation Cleanup

- ✅ `/profile/settings` — was a stale duplicate of `/settings`, now redirects
- ✅ `/profile` — "saved leads" was reading from disconnected localStorage, now redirects; real data lives in Settings + Collections
- ✅ Dashboard's stale `/profile/settings` links fixed to point to `/settings`
- ✅ `/followups` — found with zero auth protection in middleware, fixed
- ✅ `/analytics` — now redirects to `/stats` (see section 6), resolves this too since `/stats` is already in the sidebar

## 3. Real Bugs Found & Fixed Along the Way

- ✅ `app/api/workspace/me/route.ts` — was missing entirely, broke Sidebar's workspace name display
- ✅ `app/api/collections/default/route.ts` — was missing entirely, broke Home's "Save lead" button
- ✅ Dashboard's `toggleSaveLead` — was using disconnected localStorage (`vantio_saved_leads_v1`), now uses the real database, matching Home and Collections
- 🔲 Dashboard's Pipeline/Home deep-link lead-selection bug — debug logging added (`[deep-link]` console errors), root cause not yet confirmed; needs live reproduction + console output to finish diagnosing

## 4. Dashboard Architecture Overhaul

- ✅ "AI-Powered" branding removed → "Live" (accurate to what the engine actually does)
- ✅ Deep search manual toggle removed from Dashboard (standard search is now the broad/partitioned search by default; backend deep-search logic intentionally preserved for future AI Mode)
- ✅ Lead detail view extracted from Dashboard into a standalone, reusable `LeadDetailModal` component (~2,000 lines pulled out of a single 5,345-line file)
- ✅ All shared state/handlers (`saveOutcome`, `runDeepScan`, `toggleSaveLead`, enrichment state, etc.) extracted into `useLeadDetailPanel` hook, usable by any page
- ✅ Dashboard rewired to use the shared hook (down to ~3,060 lines from the original 5,345)

## 5. Pipeline Page — Full Rebuild

- ✅ Kanban → column-card redesign, multiple iterations based on feedback
- ✅ Color palette: blue → teal → green progression, distinct red for Lost (replacing the original gray-to-gold scheme)
- ✅ Conversion rate clarity fix: labels now explicitly name the source stage ("49% of Contacted") with hover tooltips, instead of an unlabeled floating percentage
- ✅ Meeting stage shows both Won% and Lost% (previously only showed the Won path, Lost was unaccounted for)
- ✅ "Needs attention" section — real, timestamp-based stale-lead detection (7+ days without progressing), using data already tracked since Week 1, not fabricated
- ✅ Themed scrollbars (matching dark/gold aesthetic, replacing default browser scrollbars)
- ✅ Demo mode added
- ✅ Quick lead panel — opens on Pipeline itself instead of redirecting to Dashboard/Lead Tool
- ✅ Quick panel tabs: Overview, Outreach (real generated drafts), Templates (real saved templates), Follow-up (real date-setting via `saveOutcome`)
- ✅ "View full breakdown" — opens the exact same `LeadDetailModal` Dashboard uses, as an overlay on Pipeline, never navigating away
- ✅ Home's pipeline overview widget matched to the same palette/design/conversion labels as the full Pipeline page

## 6. Stats / Analytics — ✅ Complete

- ✅ "Why deals are being lost" ported from the old Analytics page into Stats, fully tested
- ✅ Tonality Performance ported into Stats, fully tested (10 tests)
- ✅ Angle Performance ported into Stats, fully tested (same module/tests as Tonality)
- ✅ Activity Over Time ported into Stats (bar chart + SVG line chart), fully tested (11 tests)
- ✅ Close Rate Over Time ported into Stats, same data as Activity Over Time
- ✅ `/analytics` now redirects to `/stats` — every real section confirmed ported first, nothing lost

## 7. Not Yet Started

- 🔲 Task modal + Outreach follow-up filtering — click a task, land on that specific filtered lead in Outreach
- ✅ Notification bell — reworked as "Today's Work": real triggers (overdue follow-ups, stale pipeline leads, today's top new recommendation), computed live from real state rather than a stored event log; now visible app-wide via the Sidebar
- ✅ Usage & Plan page — real beta usage data (daily/total limits per feature, days remaining, discount status), reusing the existing atomic usage-tracking system rather than fabricating a paid-plan display that wouldn't be accurate during beta
- 🔲 Performance charts + hover-context on Stats (e.g., click "Revenue Won," see a calendar breakdown of which days)

## 8. Strategic Repositioning — Commercial Intelligence Platform

New direction: shift Vantio's perception from "lead generation tool" to "commercial intelligence platform" — the thing businesses consult before making commercial decisions. Preserve the existing black-and-gold identity and deterministic scoring philosophy; this is about depth and messaging, not a redesign.

- 🔲 **Explainability audit** — extend real "why" reasoning (already present on Home's recommendation cards) to Pipeline cards and Dashboard's list view, which currently show bare scores with no reasoning
- 🔲 **"Today's Work" framing** — lean further into prioritization-over-search; likely merges with the notification bell work below rather than being separate
- 🔲 **Notification bell, reframed** — not generic notifications, but reasoned prompts tied to the recommendation engine and Pipeline's stale-lead detection ("scored 91 because X," "untouched 9 days")
- 🟡 **Homepage messaging rewrite** — hero eyebrow and all 6 feature titles rewritten from mechanism-first to outcome-first (e.g., "Signal-Driven Scoring" → "Know Who Deserves Your Next Hour," directly matching the strategy doc's own examples). **Not done**: the doc's desired section *order* (Problem → Outcome → Why → Evidence → Features) would mean physically reordering whole animated sections in a 4,413-line page with scroll-triggered reveals and particle fields tied to specific sections — genuinely high risk, and the doc itself says "not a redesign, avoid unnecessary redesigns." Deliberately left as a decision for you rather than guessed at.
- 🔲 **Personalization deepening** — an ongoing lens for future features (user profile as an increasingly influential scoring input), not a standalone task
- 🔲 **Learning-loop data model** — architectural principle to keep in mind for future implementations (Lead → Score → Reasoning → Angle → Outreach → Reply → Meeting → Sale → Revenue → Learning); not urgent before beta, but worth designing new features so they don't foreclose it
- 🔲 **Trust signal scaffolding** — structure the product so testimonials/case studies/historical outcomes can be added naturally post-beta; explicitly not fabricated now

## 9. After Beta — Deferred

- 🔲 **Internal command center** — an admin dashboard for measuring usage, future revenue, and platform-level metrics across all users. Explicitly deferred until everything above is done; not part of the beta-launch scope.

---

## Suggested priority order before beta

1. **Explainability audit** (Pipeline + Dashboard list view) — highest leverage, extends what already works, no new infrastructure
2. **Notification bell, built as reasoned "Today's Work" prompts** — merges two backlog items into one coherent feature
3. **Finish the Stats/Analytics merge** — already scoped, closes a half-open thread, then unblocks the `/analytics` redirect
4. **Homepage messaging rewrite** — isolated from the authenticated app, safe to parallelize
5. **Usage & Plan page**
6. **Performance charts on Stats**
7. **Task modal + Outreach follow-up filtering**
8. **`/analytics` sidebar fix** — trivial, do whenever convenient
9. **Dashboard deep-link bug** — needs your live reproduction + console output before I can fix it correctly; not schedulable until then