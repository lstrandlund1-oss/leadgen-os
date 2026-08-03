-- 0017_markets.sql
--
-- "Markets" (Week 3 of the rebuild, per the design reference): a named,
-- saved search definition (e.g. "Web Agencies in Sweden") a user can
-- revisit and refresh, rather than a disposable one-off search. This
-- reverses an earlier, deliberate decision to leave the dormant
-- `searches` table unused until a real feature needed it — confirmed
-- this is that feature.
--
-- `searches` itself is NOT reused here: it was designed as a per-search
-- history log (niche/location/company_size per attempt, no name, no
-- persistence concept), not a named entity a user manages over time.
-- Markets is a new, purpose-built concept sitting alongside it.
--
-- Runs are associated with a market via a new nullable market_id on
-- user_search_runs (already the correct join table linking users to the
-- shared provider_runs cache — see docs/SEARCH_CACHING_ARCHITECTURE.md).
-- A run with market_id = null is just an ordinary one-off search, exactly
-- as before this migration — fully backward compatible.

create table if not exists markets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  niche text not null,
  location text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_refreshed_at timestamptz
);

create index if not exists idx_markets_user on markets(user_id);

alter table user_search_runs add column if not exists market_id uuid references markets(id) on delete set null;
create index if not exists idx_user_search_runs_market on user_search_runs(market_id);

alter table markets enable row level security;

drop policy if exists "users_manage_own_markets" on markets;
create policy "users_manage_own_markets" on markets
  for all using (auth.uid()::text = user_id::text) with check (auth.uid()::text = user_id::text);