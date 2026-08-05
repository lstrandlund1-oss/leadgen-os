-- 0000_baseline_core_schema.sql
--
-- Reconstructs the core tables that existed before any migration file in
-- this repo (0001 onward only ever covered beta-system and security-audit
-- additions) — closes the gap identified in the original audit: "the repo
-- alone cannot reproduce the database from scratch."
--
-- This is a RECONSTRUCTION based on the live, observed schema (via
-- information_schema.columns), not a byte-perfect replay of the original
-- CREATE statements — those were never captured. Every statement uses
-- IF NOT EXISTS, so running this against the actual live database (which
-- already has these tables) is a safe no-op, and running it against a
-- fresh database correctly builds the starting point that migrations
-- 0001+ then apply on top of.
--
-- Deliberately does NOT include RLS policies here — those are already
-- correctly established by the later numbered migrations (0006, 0007,
-- 0008, 0010, 0011), which remain the source of truth for security rules.
-- This file is schema structure only.
--
-- Also deliberately does NOT include explicit foreign key constraints —
-- the available schema export (information_schema.columns) doesn't surface
-- FK relationships, and guessing at them risks a migration that fails on
-- a real database whose actual constraints differ. If FK enforcement at
-- the database level matters going forward, that's worth doing as its own
-- deliberate pass with a proper constraint export, not guessed here.
-- One exception: lead_collection_items -> lead_collections is included,
-- since that relationship is unambiguous from the column names and table
-- purpose alone (an item cannot sensibly exist without its collection).

-- ── Search & discovery pipeline (shared/canonical — see
--    docs/SEARCH_CACHING_ARCHITECTURE.md for why these are shared) ──────────

create table if not exists provider_runs (
  id bigint generated always as identity primary key,
  provider text not null,
  intent_hash text not null,
  request_id text,
  intent jsonb not null,
  status text not null default 'queued',
  fetched_count integer not null default 0,
  returned_count integer not null default 0,
  inserted_raw integer not null default 0,
  skipped_duplicates integer not null default 0,
  next_cursor text,
  exhausted boolean not null default false,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  provider_cursor text,
  provider_exhausted boolean default false,
  unique (provider, intent_hash)
);

create table if not exists companies_raw (
  id bigint generated always as identity primary key,
  source text default '',
  source_id text default '',
  payload jsonb,
  created_at timestamp default now(),
  unique (source, source_id)
);

create table if not exists provider_run_raws (
  run_id bigint not null,
  raw_id bigint not null,
  created_at timestamptz not null default now(),
  primary key (run_id, raw_id)
);

create table if not exists companies_normalized (
  id bigint generated always as identity primary key,
  raw_id bigint unique,
  name text default '',
  address text,
  city text,
  country text,
  website text,
  categories text[],
  rating numeric,
  review_count integer,
  created_at timestamptz not null default now(),
  opportunity_signals jsonb,
  primary_insight jsonb,
  -- cached_score / signal_hash: superseded by company_intelligence
  -- (migration 0015) — left here for backward compatibility with any
  -- historical data, but no longer written to by the application.
  cached_score jsonb,
  signal_hash text
);

create table if not exists company_classifications (
  id bigint generated always as identity primary key,
  raw_id bigint not null,
  primary_industry text not null,
  sub_niche text not null,
  service_type text not null,
  b2b_b2c text not null,
  is_good_fit boolean not null,
  fit_reason text not null,
  confidence integer not null,
  source text not null,
  updated_at timestamptz not null default now()
);

-- ── User-owned data ─────────────────────────────────────────────────────────

create table if not exists user_profiles (
  id uuid primary key,
  line_of_business text,
  capabilities jsonb default '{}'::jsonb,
  capabilities_data jsonb,
  profile_data jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists searches (
  id uuid primary key default gen_random_uuid(),
  niche text,
  location text,
  company_size text,
  social_presence text,
  user_id uuid,
  created_at timestamp default now()
);

create table if not exists lead_outcomes (
  id bigint generated always as identity primary key,
  run_id bigint not null,
  lead_id text not null,
  user_id uuid,
  contacted boolean not null default false,
  replied boolean not null default false,
  booked_call boolean not null default false,
  closed boolean not null default false,
  revenue numeric,
  notes text,
  tonality text,
  angle_type text,
  followup_date date,
  lost_reason text,
  score_at_outreach integer,
  company_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (run_id, lead_id, user_id)
);
-- contacted_at / replied_at / booked_call_at / closed_at added by
-- migration 0014 — not repeated here, that migration is idempotent
-- (ADD COLUMN IF NOT EXISTS) and remains the source of truth for them.

create table if not exists lead_deep_scans (
  id uuid primary key default gen_random_uuid(),
  source_id text not null,
  lead_id text not null,
  user_id text not null,
  scan_result jsonb not null,
  derived_signals jsonb not null,
  scanned_at timestamptz default now()
);

create table if not exists lead_collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  description text,
  color text default '#c9a84c',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists lead_collection_items (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references lead_collections(id) on delete cascade,
  user_id uuid not null,
  lead_id text not null,
  run_id integer,
  company_name text,
  notes text,
  added_at timestamptz not null default now()
);

create table if not exists lead_sequences (
  id bigint generated always as identity primary key,
  lead_id text not null,
  run_id integer not null,
  user_id uuid,
  company_name text,
  step integer not null,
  day_offset integer not null,
  scheduled_date date not null,
  channel text not null,
  subject text,
  message text not null,
  objective text not null,
  cta text not null,
  status text not null default 'pending',
  cadence_type text not null default 'standard',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists outreach_emails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  lead_id text,
  run_id integer,
  company_name text,
  recipient_email text not null,
  subject text not null,
  body text not null,
  sender_name text,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists outreach_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  channel text not null default 'email',
  subject text,
  body text not null,
  tone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Usage tracking ────────────────────────────────────────────────────────

create table if not exists deep_scan_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  created_at timestamptz default now()
);

create table if not exists deep_search_usage (
  id bigint generated always as identity primary key,
  user_id uuid,
  created_at timestamptz default now()
);

create table if not exists outreach_usage (
  id bigint generated always as identity primary key,
  user_id uuid,
  type text default 'message',
  created_at timestamptz default now()
);

-- ── Public-facing, no user ownership ─────────────────────────────────────

create table if not exists contact_submissions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  subject text,
  message text not null,
  created_at timestamptz default now()
);

create table if not exists waitlist (
  email text primary key,
  plan text,
  created_at timestamptz default now(),
  beta_user boolean default false,
  beta_plan text,
  beta_join_date timestamptz,
  beta_source text
);

create table if not exists support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  user_email text,
  user_plan text,
  business_name text,
  summary text,
  transcript text not null,
  status text not null default 'needs_human',
  created_at timestamptz default now()
);

-- ── Platform infrastructure ───────────────────────────────────────────────

create table if not exists rate_limits (
  key text primary key,
  window_start_ms bigint not null,
  count integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists analytics_events (
  id bigint generated always as identity primary key,
  user_id uuid,
  event_name text not null,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);