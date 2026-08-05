-- 0008_searches_user_scoping.sql
--
-- Found via RLS audit: the `searches` table had only one policy at all —
-- an open INSERT (`dev_anon_insert_searches`, check=true) — with NO select
-- policy whatsoever. Worse, the only code that ever wrote to this table
-- (app/api/leads/route.ts, confirmed dead — nothing in the frontend calls
-- it) never recorded a user_id in the first place. The live GET handler
-- (app/api/searches/route.ts, called from the dashboard for the "recent
-- searches" list, niche/location autocomplete, and the getting-started
-- checklist's hasSearched signal) queried this table with zero user
-- scoping in the application code — the 5 most recent searches shown to
-- ANY user were pooled across ALL users, not filtered to their own.
--
-- The application code (app/api/searches/route.ts) is fixed separately to
-- require auth and scope by user_id — deploy that change before this
-- migration, same ordering reasoning as migration 0007.
--
-- Note: since the only write path was already dead code, this migration
-- only secures the read side and prepares the column/policies for a
-- future write path (if the search-history feature is revived) — it does
-- not itself make search history start recording again.

alter table searches add column if not exists user_id uuid;

alter table searches enable row level security;

drop policy if exists "dev_anon_insert_searches" on searches;

drop policy if exists "users_select_own_searches" on searches;
create policy "users_select_own_searches" on searches
  for select using (auth.uid()::text = user_id::text);

drop policy if exists "users_insert_own_searches" on searches;
create policy "users_insert_own_searches" on searches
  for insert with check (auth.uid()::text = user_id::text);