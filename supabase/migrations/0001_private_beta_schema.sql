-- 0001_private_beta_schema.sql
-- Private beta system: invitations, memberships, atomic AI usage metering,
-- feedback, and analytics events.
--
-- Forward-only. Run this against the Supabase SQL editor or CLI — Claude
-- does not have network access to the project's database from its
-- environment and cannot run this directly.
--
-- Design notes:
-- - beta_memberships is completely separate from the commercial plan
--   system (lib/plan.ts / user_profiles.plan). It does not touch, extend,
--   or depend on Stripe. A beta user's *core* feature access should be
--   treated as operator-tier by application code (see lib/beta/access.ts),
--   but that is an application-level decision, not something enforced here.
-- - Money is stored as integer micro-USD (1 USD = 1,000,000 micro-USD) —
--   never floating point.
-- - beta_usage implements a reserve -> commit/release lifecycle instead of
--   the existing check-then-log pattern used by outreach_usage, because the
--   existing pattern cannot guarantee that two simultaneous requests won't
--   both pass the limit check before either write lands. reserve_beta_usage()
--   below does the check-and-insert atomically under a row lock.

create extension if not exists pgcrypto; -- required for gen_random_uuid()

-- ── Invitations ──────────────────────────────────────────────────────────
create table if not exists beta_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  token_hash text not null unique, -- sha256 hex of the actual invite token; raw token is never stored
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_user_id uuid references auth.users(id),
  created_by text, -- admin email/identifier; no separate admin table exists yet
  notes text
);

create index if not exists idx_beta_invitations_email on beta_invitations(email);
create index if not exists idx_beta_invitations_token_hash on beta_invitations(token_hash);

alter table beta_invitations enable row level security;
-- No client-side access at all — invitations are only ever read/written by
-- API routes using the service-role key. Tokens are sensitive.
create policy "service_role_only_beta_invitations" on beta_invitations
  for all using (false) with check (false);

-- ── Memberships ──────────────────────────────────────────────────────────
create table if not exists beta_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) unique, -- one membership per user
  invitation_id uuid references beta_invitations(id),
  status text not null default 'active' check (status in ('active', 'expired', 'revoked')),
  timezone text not null default 'Europe/Stockholm',

  activated_at timestamptz not null default now(),
  hard_end_at timestamptz not null, -- activated_at + 14 calendar days, set at activation

  active_days_used int not null default 0,
  last_active_date date, -- last calendar date (in `timezone`) that counted as an active day — prevents double-counting same-day actions

  extended_days int not null default 0,
  extension_granted_by text,
  extension_granted_at timestamptz,

  expired_at timestamptz,
  revoked_at timestamptz,

  final_interview_completed boolean not null default false,
  final_interview_completed_at timestamptz,
  required_feedback_completed boolean not null default false,
  required_feedback_completed_at timestamptz,

  discount_eligible boolean not null default false,
  discount_awarded_at timestamptz,
  discount_redeemed_at timestamptz,

  tutorial_state jsonb not null default '{}', -- { [tutorialKey]: "completed" | "skipped" }

  internal_notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_beta_memberships_user_id on beta_memberships(user_id);
create index if not exists idx_beta_memberships_status on beta_memberships(status);

alter table beta_memberships enable row level security;
-- Users may read their own membership (drives UI: days remaining, tutorial
-- state, etc.) but all writes go through API routes using the service role —
-- active_days_used, limits, and admin fields must never be client-writable.
create policy "users_read_own_beta_membership" on beta_memberships
  for select using (auth.uid() = user_id);
create policy "no_client_writes_beta_membership" on beta_memberships
  for insert with check (false);
create policy "no_client_updates_beta_membership" on beta_memberships
  for update using (false);

-- ── Usage ledger (atomic reserve/commit/release) ────────────────────────
create table if not exists beta_usage (
  id bigint generated always as identity primary key,
  membership_id uuid not null references beta_memberships(id),
  user_id uuid not null references auth.users(id),
  feature text not null check (feature in ('outreach', 'followup', 'ai_deep_search')),
  idempotency_key text, -- caller-supplied; lets retries of the same logical action consume only one reservation
  status text not null default 'reserved' check (status in ('reserved', 'committed', 'released')),
  cost_micro_usd bigint not null default 0, -- integer micro-USD; updated on commit with the real cost
  created_at timestamptz not null default now(),
  committed_at timestamptz,
  released_at timestamptz
);

create index if not exists idx_beta_usage_membership_feature_created
  on beta_usage(membership_id, feature, created_at);
-- Enforces "idempotent retries consume only one reservation" at the DB level
create unique index if not exists idx_beta_usage_idempotency
  on beta_usage(membership_id, feature, idempotency_key)
  where idempotency_key is not null;

alter table beta_usage enable row level security;
-- No direct client access whatsoever — only reserve_beta_usage() and the
-- commit/release helpers (called from API routes with the service role)
-- touch this table.
create policy "service_role_only_beta_usage" on beta_usage
  for all using (false) with check (false);

-- ── Feature feedback (Phase 6) ───────────────────────────────────────────
create table if not exists beta_feature_feedback (
  id bigint generated always as identity primary key,
  membership_id uuid not null references beta_memberships(id),
  user_id uuid not null references auth.users(id),
  feature_key text not null, -- 'search' | 'deep_search' | 'lead_scoring' | 'outreach' | 'followup' | 'outcomes' | 'tutorial'
  feature_version text not null default 'v1',
  rating int check (rating between 1 and 5), -- null when not_used_enough is true
  not_used_enough boolean not null default false,
  reason_key text, -- stable reason key, e.g. 'confusing' | 'saved_time' — never a translated string
  free_text text,
  created_at timestamptz not null default now(),
  unique (membership_id, feature_key, feature_version)
);

alter table beta_feature_feedback enable row level security;
create policy "users_manage_own_feature_feedback" on beta_feature_feedback
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Lead-specific feedback (kept separate from feature feedback) ────────
create table if not exists beta_lead_feedback (
  id bigint generated always as identity primary key,
  membership_id uuid not null references beta_memberships(id),
  user_id uuid not null references auth.users(id),
  lead_id text not null,
  run_id bigint,
  accurate boolean,
  comment text,
  created_at timestamptz not null default now()
);

create index if not exists idx_beta_lead_feedback_membership on beta_lead_feedback(membership_id);

alter table beta_lead_feedback enable row level security;
create policy "users_manage_own_lead_feedback" on beta_lead_feedback
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Analytics events (Phase 9 — minimal, generic; no system existed) ────
create table if not exists analytics_events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id),
  event_name text not null,
  properties jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_analytics_events_name_created on analytics_events(event_name, created_at);
create index if not exists idx_analytics_events_user on analytics_events(user_id, created_at);

alter table analytics_events enable row level security;
-- No direct client access — events are logged server-side, from within the
-- API routes where the corresponding action already happens, using the
-- service role. This keeps the event schema controlled and prevents
-- arbitrary client-side event spam.
create policy "service_role_only_analytics_events" on analytics_events
  for all using (false) with check (false);

-- ── Atomic reserve function ──────────────────────────────────────────────
-- Locks the membership row, checks idempotency + daily/total limits + the
-- monetary ceiling, and inserts a 'reserved' row — all inside one
-- transaction under a row lock, so two concurrent calls cannot both pass.
-- Call this BEFORE invoking the AI provider. On success, call
-- commit_beta_usage() with the real cost; on failure, call
-- release_beta_usage() so the reservation doesn't count against limits.
create or replace function reserve_beta_usage(
  p_membership_id uuid,
  p_feature text,
  p_daily_limit int,       -- null = no daily limit
  p_total_limit int,       -- null = unlimited
  p_monetary_ceiling_micro_usd bigint, -- null = no ceiling
  p_estimated_cost_micro_usd bigint,
  p_idempotency_key text,
  p_timezone text default 'Europe/Stockholm'
)
returns table (allowed boolean, reason text, usage_id bigint) as $$
declare
  v_existing_id bigint;
  v_existing_status text;
  v_daily_count int;
  v_total_count int;
  v_spent_micro_usd bigint;
  v_new_id bigint;
begin
  -- Lock the membership row so concurrent reservations for the same tester
  -- serialize here rather than racing.
  perform 1 from beta_memberships where id = p_membership_id for update;

  -- Idempotent retry: if this exact action was already reserved/committed,
  -- return the existing result instead of consuming a second reservation.
  if p_idempotency_key is not null then
    select id, status into v_existing_id, v_existing_status
    from beta_usage
    where membership_id = p_membership_id
      and feature = p_feature
      and idempotency_key = p_idempotency_key;

    if v_existing_id is not null and v_existing_status in ('reserved', 'committed') then
      return query select true, 'idempotent_replay'::text, v_existing_id;
      return;
    end if;
  end if;

  select count(*) into v_daily_count
  from beta_usage
  where membership_id = p_membership_id
    and feature = p_feature
    and status in ('reserved', 'committed')
    and (created_at at time zone p_timezone)::date = (now() at time zone p_timezone)::date;

  if p_daily_limit is not null and v_daily_count >= p_daily_limit then
    return query select false, 'daily_limit'::text, null::bigint;
    return;
  end if;

  select count(*) into v_total_count
  from beta_usage
  where membership_id = p_membership_id
    and feature = p_feature
    and status in ('reserved', 'committed');

  if p_total_limit is not null and v_total_count >= p_total_limit then
    return query select false, 'total_limit'::text, null::bigint;
    return;
  end if;

  if p_monetary_ceiling_micro_usd is not null then
    select coalesce(sum(cost_micro_usd), 0) into v_spent_micro_usd
    from beta_usage
    where membership_id = p_membership_id
      and status in ('reserved', 'committed');

    if v_spent_micro_usd + p_estimated_cost_micro_usd > p_monetary_ceiling_micro_usd then
      return query select false, 'monetary_ceiling'::text, null::bigint;
      return;
    end if;
  end if;

  insert into beta_usage (membership_id, user_id, feature, idempotency_key, status, cost_micro_usd)
  select p_membership_id, user_id, p_feature, p_idempotency_key, 'reserved', p_estimated_cost_micro_usd
  from beta_memberships where id = p_membership_id
  returning id into v_new_id;

  return query select true, 'ok'::text, v_new_id;
end;
$$ language plpgsql security definer;

-- Marks a reservation as committed (the AI call succeeded), optionally
-- updating it with the real cost if it differs from the estimate.
create or replace function commit_beta_usage(p_usage_id bigint, p_real_cost_micro_usd bigint default null)
returns void as $$
begin
  update beta_usage
  set status = 'committed',
      committed_at = now(),
      cost_micro_usd = coalesce(p_real_cost_micro_usd, cost_micro_usd)
  where id = p_usage_id and status = 'reserved';
end;
$$ language plpgsql security definer;

-- Releases a reservation (the AI call failed) so it no longer counts
-- against the tester's daily/total/monetary limits.
create or replace function release_beta_usage(p_usage_id bigint)
returns void as $$
begin
  update beta_usage
  set status = 'released', released_at = now()
  where id = p_usage_id and status = 'reserved';
end;
$$ language plpgsql security definer;

-- Records an active usage day, idempotent per calendar date in the given
-- timezone. Call this AFTER a qualifying action succeeds (search completed,
-- deep search completed, outreach generated, follow-up generated) — never
-- on login, settings, tutorial replay, or viewing an existing lead.
-- Done as a single atomic statement rather than read-then-write from the
-- application, both to avoid a race and because a plain client-side
-- .neq('last_active_date', today) filter would not match NULL correctly
-- (SQL's three-valued logic: NULL <> 'today' is NULL, not true).
create or replace function record_beta_active_day(p_membership_id uuid, p_timezone text default 'Europe/Stockholm')
returns void as $$
begin
  update beta_memberships
  set active_days_used = active_days_used + 1,
      last_active_date = (now() at time zone p_timezone)::date,
      updated_at = now()
  where id = p_membership_id
    and (last_active_date is null or last_active_date <> (now() at time zone p_timezone)::date);
end;
$$ language plpgsql security definer;