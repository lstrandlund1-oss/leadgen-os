-- 0012_platform_kill_switches.sql
--
-- Addresses a gap from the original audit (Section 18): there was no way
-- to disable AI generation platform-wide without a code deploy. An env
-- var would work but requires a redeploy to take effect — the whole
-- point of an emergency kill switch is that it's instant.
--
-- A single small table, checked (with a short in-memory cache) at the
-- start of every AI-calling endpoint. Toggled from the admin dashboard.

create table if not exists platform_settings (
  key text primary key,
  enabled boolean not null default true,
  updated_by text,
  updated_at timestamptz not null default now()
);

insert into platform_settings (key, enabled)
values ('ai_generation_enabled', true)
on conflict (key) do nothing;

alter table platform_settings enable row level security;

-- Read-only for anyone with a valid session (needed so the check can run
-- from server-side code without necessarily always using the service
-- role) — writes only ever happen via the admin API route, using the
-- service role, so no client write policy is needed at all.
drop policy if exists "anyone_can_read_platform_settings" on platform_settings;
create policy "anyone_can_read_platform_settings" on platform_settings
  for select using (true);

drop policy if exists "no_client_writes_platform_settings" on platform_settings;
create policy "no_client_writes_platform_settings" on platform_settings
  for all using (false) with check (false);