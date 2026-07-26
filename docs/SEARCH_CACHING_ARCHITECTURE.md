# Search Result Caching & Ownership

Documents a real pattern discovered during a security audit — worth
understanding before touching anything in the search pipeline, since it's
not obvious from the code alone and nearly got duplicated by accident.

## The core design: shared cache, separate ownership

`provider_runs` is a **shared cache across all users**, keyed by
`(provider, intent_hash)`. If two different agencies search for the exact
same niche + location + filters, they get routed to the same run and reuse
the same already-fetched results — a deliberate cost-saving design to
avoid paying for duplicate Google Places API calls once the platform has
real concurrent traffic. This is not an oversight or something to "fix" —
it was chosen deliberately over the alternative (every user's search
always creates its own run, even for identical queries).

The individual **company records** themselves (`companies_raw`,
`companies_normalized`, `company_classifications`) are deduplicated
independently, keyed by `(source, source_id)` — Google's own place ID.
This means the valuable, expensive-to-produce data (scraped/classified
company info) is cached at the company level regardless of which run or
which user discovered it, completely independent of the `provider_runs`
sharing behavior above.

## The problem this created

Because `provider_runs` is shared, it has no natural single-user owner —
adding a plain `user_id` column to it would be semantically wrong (whose
row is it, if five different agencies all searched the same thing and
share it?). But some features genuinely need "show me runs I've used" —
specifically, the outreach page's saved-leads picker.

**`lib/userSearchRuns.ts`** solves this with a separate, additive join
table: `user_search_runs (user_id, run_id, created_at)`. Every time a
user's search resolves to a run — whether freshly created for them or
reused from someone else's identical search — a row is recorded here.
`provider_runs` itself never changes. This is purely an ownership record
sitting alongside the shared cache, not a replacement for it.

## Where this is wired in

- **Producers** (record the association): `app/api/search/discover/route.ts`
  and `app/api/providers/search/route.ts`, both calling
  `recordUserSearchRuns(userId, runIds)` after a search resolves.
- **Consumer** (reads the association): `app/api/outreach/leads/route.ts`
  — the outreach page's "saved leads" picker queries
  `user_search_runs` by `user_id`, then joins through to
  `provider_run_raws` / `companies_normalized` / etc. from there.
- **Migration**: `supabase/migrations/0009_user_search_runs.sql` — also
  documents the FK confirms `provider_runs.id` is `bigint`.

## The bug this fixed

Before this existed, `app/api/outreach/leads/route.ts` filtered
`provider_runs` directly by a `user_id` column that **never existed and
was never populated** by the active search pipeline (`createProviderRun`
in `lib/persistence.ts` has no `userId` parameter at all — by design,
since the row it creates may be shared). That meant the outreach page's
saved-leads picker was always empty for every user, silently, with no
error — the query just always matched zero rows.

## If you're about to touch the search pipeline

- Do **not** add a `user_id` column directly to `provider_runs` — that
  would break the shared-cache design. Ownership tracking goes through
  `user_search_runs` instead.
- If a new feature needs "leads/runs this specific user has seen," query
  through `user_search_runs`, not `provider_runs` directly.
- The company-level cache (`source` + `source_id`) is separate from all of
  this and doesn't need to change for anything described here.