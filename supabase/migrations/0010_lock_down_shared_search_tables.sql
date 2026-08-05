-- 0010_lock_down_shared_search_tables.sql
--
-- Found via RLS audit: provider_runs, provider_run_raws, companies_raw,
-- companies_normalized, and company_classifications all had "dev_"-
-- prefixed, fully open policies (ALL commands, qual=true, with_check=true)
-- — meaning anyone holding the public anon key could read, modify, or
-- delete this data directly via Supabase's REST API, bypassing the app
-- entirely.
--
-- These tables are all legitimately SHARED across users (provider_runs is
-- a deliberate cross-user cache keyed by intent_hash; the company tables
-- are deduplicated by source_id, independent of any single user or run —
-- see docs/SEARCH_CACHING_ARCHITECTURE.md). So the concern here isn't
-- "one user reading another user's private data" the way it was for
-- lead_outcomes/user_profiles — it's that ANY user could corrupt or
-- delete data that the ENTIRE platform depends on, or bypass the
-- rate-limiting/cost-control logic that's supposed to gate expensive
-- provider calls.
--
-- Every read and write path for these 5 tables has been migrated to the
-- service-role client (lib/persistence.ts, lib/ingest/db.ts,
-- lib/runLeads/fetchRunContext.ts, app/api/providers/runs/[id]/leads/
-- route.ts) — confirmed via a full grep sweep, not just the obvious call
-- sites. None of these tables are read directly from client-side code.
-- Deploy that code before running this migration, same ordering
-- reasoning as migrations 0007/0008.

alter table provider_runs enable row level security;
drop policy if exists "dev_all_provider_runs" on provider_runs;
drop policy if exists "no_client_access_provider_runs" on provider_runs;
create policy "no_client_access_provider_runs" on provider_runs
  for all using (false) with check (false);

alter table provider_run_raws enable row level security;
drop policy if exists "dev_all_provider_run_raws" on provider_run_raws;
drop policy if exists "no_client_access_provider_run_raws" on provider_run_raws;
create policy "no_client_access_provider_run_raws" on provider_run_raws
  for all using (false) with check (false);

alter table companies_raw enable row level security;
drop policy if exists "dev_anon_select_raw" on companies_raw;
drop policy if exists "dev_anon_update_raw" on companies_raw;
drop policy if exists "Allow anon insert normalized" on companies_raw;
drop policy if exists "dev_anon_insert_raw" on companies_raw;
drop policy if exists "no_client_access_companies_raw" on companies_raw;
create policy "no_client_access_companies_raw" on companies_raw
  for all using (false) with check (false);

alter table companies_normalized enable row level security;
drop policy if exists "dev_anon_select_normalized" on companies_normalized;
drop policy if exists "dev_anon_update_normalized" on companies_normalized;
drop policy if exists "Allow anon insert normalized" on companies_normalized;
drop policy if exists "dev_anon_insert_normalized" on companies_normalized;
drop policy if exists "no_client_access_companies_normalized" on companies_normalized;
create policy "no_client_access_companies_normalized" on companies_normalized
  for all using (false) with check (false);

alter table company_classifications enable row level security;
drop policy if exists "dev_anon_select_classifications" on company_classifications;
drop policy if exists "dev_anon_update_classifications" on company_classifications;
drop policy if exists "dev_anon_insert_classifications" on company_classifications;
drop policy if exists "no_client_access_company_classifications" on company_classifications;
create policy "no_client_access_company_classifications" on company_classifications
  for all using (false) with check (false);