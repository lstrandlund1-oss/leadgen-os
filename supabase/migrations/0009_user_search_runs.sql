-- 0009_user_search_runs.sql
--
-- Records which user "used" which provider_runs row, without changing
-- provider_runs itself at all. provider_runs stays a shared cache keyed by
-- (provider, intent_hash) — deliberately preserved, since deduplicating
-- identical searches across ALL users (not just one user's own repeats) is
-- the actual cost-saving design once the platform has real concurrent
-- traffic, not an oversight to be undone.
--
-- This fixes the real bug found during the RLS audit: app/api/outreach/
-- leads/route.ts (the outreach page's "saved leads" picker) was filtering
-- provider_runs by a user_id column that never existed and was never
-- populated by the active search pipeline, so the picker was always
-- empty for every user. It's rewired to query through this table instead.

create table if not exists user_search_runs (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  run_id bigint not null references provider_runs(id),
  created_at timestamptz not null default now(),
  unique (user_id, run_id)
);

create index if not exists idx_user_search_runs_user on user_search_runs(user_id);
create index if not exists idx_user_search_runs_run on user_search_runs(run_id);

alter table user_search_runs enable row level security;

-- Users can read their own association rows (used by the outreach page's
-- saved-leads picker, via a session-aware server client).
drop policy if exists "users_read_own_search_runs" on user_search_runs;
create policy "users_read_own_search_runs" on user_search_runs
  for select using (auth.uid()::text = user_id::text);

-- Writes happen server-side via the service-role client (the search
-- pipeline runs through the anon-key client with no forwarded session, so
-- auth.uid() isn't available there — same reasoning as the earlier
-- user_profiles fix). Block direct client writes entirely as defense in
-- depth, even though the service role bypasses RLS regardless.
drop policy if exists "no_client_writes_search_runs" on user_search_runs;
create policy "no_client_writes_search_runs" on user_search_runs
  for insert with check (false);