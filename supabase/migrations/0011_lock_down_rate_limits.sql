-- 0011_lock_down_rate_limits.sql
--
-- Found via RLS audit: rate_limits had a fully open policy
-- (dev_all_rate_limits, ALL commands, qual=true, with_check=true). Since
-- rate limiting is enforced by directly reading/writing this table, an
-- open policy meant any user could delete or reset their own rate-limit
-- rows via the anon key, bypassing the throttling entirely — the control
-- existed but could be trivially defeated.
--
-- rate_limit_consume() is NOT a SECURITY DEFINER function (confirmed:
-- prosecdef = false), so it runs with the privileges of whoever calls it.
-- That made the open policy load-bearing — locking down RLS without
-- changing anything else would have broken rate limiting outright, since
-- the anon-key caller would no longer have table access for the function
-- to use internally.
--
-- Fixed the other side instead: lib/rateLimitDb.ts now calls this RPC via
-- the service-role client. Supabase's service_role has BYPASSRLS at the
-- Postgres level, so it bypasses RLS entirely regardless of the function's
-- own security definer status — no SQL function changes needed, just a
-- different caller. Deploy that code change before running this
-- migration, same ordering reasoning as previous migrations.

alter table rate_limits enable row level security;
drop policy if exists "dev_all_rate_limits" on rate_limits;
drop policy if exists "no_client_access_rate_limits" on rate_limits;
create policy "no_client_access_rate_limits" on rate_limits
  for all using (false) with check (false);