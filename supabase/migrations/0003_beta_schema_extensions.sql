-- 0003_beta_schema_extensions.sql
-- Corrections to Phase 1 against a closer re-read of the spec: testimonial
-- approval and discount grants need to be their own tables (not flat fields
-- on beta_memberships), and tutorial progress needs replay count / current
-- step, not just a jsonb status blob.
--
-- Safe to restructure beta_memberships directly (drop + replace columns)
-- rather than deprecate-and-migrate, since the private beta hasn't started
-- yet and no rows exist in these tables in production.

-- ── Invitations: add company name ───────────────────────────────────────
alter table beta_invitations add column if not exists company_name text;

-- ── Usage ledger: richer audit trail ─────────────────────────────────────
alter table beta_usage add column if not exists provider text; -- e.g. 'anthropic'
alter table beta_usage add column if not exists model text;   -- e.g. 'claude-haiku-4-5-20251001'
alter table beta_usage add column if not exists request_id text; -- provider's own request id, when available
alter table beta_usage add column if not exists related_lead_id text;
alter table beta_usage add column if not exists related_run_id bigint;

-- ── Memberships: drop the flat discount/tutorial fields now replaced by
-- dedicated tables below. Also widen the status check to include
-- 'converted' for Phase 7 (paid conversion). ────────────────────────────
alter table beta_memberships drop column if exists discount_eligible;
alter table beta_memberships drop column if exists discount_awarded_at;
alter table beta_memberships drop column if exists discount_redeemed_at;
alter table beta_memberships drop column if exists tutorial_state;

alter table beta_memberships drop constraint if exists beta_memberships_status_check;
alter table beta_memberships add constraint beta_memberships_status_check
  check (status in ('active', 'expired', 'revoked', 'converted'));

-- converted_at marks when a beta member became a paying customer on the
-- same account (Phase 7) — distinct from expired_at, which just means
-- cost-bearing access was cut off.
alter table beta_memberships add column if not exists converted_at timestamptz;

-- ── Tutorial progress — proper table instead of a jsonb blob ────────────
create table if not exists beta_tutorial_progress (
  id bigint generated always as identity primary key,
  membership_id uuid not null references beta_memberships(id),
  user_id uuid not null references auth.users(id),
  tutorial_key text not null,
  tutorial_version text not null default 'v1',
  current_step int not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  skipped_at timestamptz,
  replay_count int not null default 0,
  updated_at timestamptz not null default now(),
  unique (membership_id, tutorial_key, tutorial_version)
);

alter table beta_tutorial_progress enable row level security;
create policy "users_manage_own_tutorial_progress" on beta_tutorial_progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Discount grants — own table, per spec ───────────────────────────────
create table if not exists beta_discount_grants (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references beta_memberships(id) unique,
  user_id uuid not null references auth.users(id),
  source text not null default 'private_beta',
  percent int not null default 30,
  duration_months int not null default 12,
  eligible_at timestamptz not null default now(),
  redemption_deadline timestamptz not null, -- eligible_at + 30 days from official launch, set at award time
  status text not null default 'pending' check (status in ('pending', 'earned', 'redeemed', 'expired')),
  redeemed_at timestamptz,
  subscription_reference text, -- Stripe subscription/customer id once redeemed, when that integration exists
  created_at timestamptz not null default now()
);

create index if not exists idx_beta_discount_grants_user on beta_discount_grants(user_id);

alter table beta_discount_grants enable row level security;
-- Users may read their own discount grant (drives UI: "you've earned 30%
-- off"), but only server-side code (service role) can create/update it —
-- eligibility is admin/system-determined, never client-writable.
create policy "users_read_own_discount_grant" on beta_discount_grants
  for select using (auth.uid() = user_id);
create policy "no_client_writes_discount_grant" on beta_discount_grants
  for insert with check (false);
create policy "no_client_updates_discount_grant" on beta_discount_grants
  for update using (false);

-- ── Testimonial publication permission — own table, per spec ────────────
-- Deliberately separate from feedback and beta completion: a tester can
-- complete the beta and earn the discount without ever giving a
-- testimonial, and a testimonial requires its own explicit approval of the
-- exact published wording.
create table if not exists beta_testimonials (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references beta_memberships(id) unique,
  user_id uuid not null references auth.users(id),
  approved_quote text,
  approved_name text,
  approved_role text,
  approved_company text,
  logo_permission boolean not null default false,
  photo_permission boolean not null default false,
  permitted_channels text[] not null default '{}', -- e.g. {'landing_page','case_study'}
  status text not null default 'pending' check (status in ('pending', 'approved', 'revoked')),
  approved_at timestamptz,
  revoked_at timestamptz,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table beta_testimonials enable row level security;
-- Users may read their own testimonial record; all writes (including the
-- tester's own initial submission) go through an API route using the
-- service role, since approval state must not be client-settable.
create policy "users_read_own_testimonial" on beta_testimonials
  for select using (auth.uid() = user_id);
create policy "no_client_writes_testimonial" on beta_testimonials
  for insert with check (false);
create policy "no_client_updates_testimonial" on beta_testimonials
  for update using (false);