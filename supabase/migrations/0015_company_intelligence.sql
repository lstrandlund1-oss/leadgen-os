-- 0015_company_intelligence.sql
--
-- Fixes a confirmed, live bug found while cross-checking the schema
-- export: companies_normalized.cached_score was a SHARED cache keyed only
-- by signal_hash (derived from the company's own data — rating, reviews,
-- website, etc.), but the score itself embeds fitScore, which is
-- unambiguously profile-dependent (scoreFit() takes userProfile and
-- capabilityProfile directly, and fit contributes 30% of the composite
-- score formula). Two different sellers with different capability
-- profiles searching for the same company would see the same cached
-- score — contaminated by whichever seller's profile happened to trigger
-- the original calculation.
--
-- This also happens to be exactly the "company_intelligence" table the
-- rebuild spec calls for: workspace/user-specific intelligence, kept
-- separate from canonical company facts (companies_normalized stays
-- exactly as it is for opportunity_signals/primary_insight, which are
-- genuinely generic — detectOpportunitySignals() takes no profile input
-- at all, confirmed separately).
--
-- companies_normalized.cached_score / signal_hash are left in place
-- (not dropped) but the application no longer writes to them as of this
-- change — removing columns is a separate, more invasive decision better
-- made once nothing references them at all.

create table if not exists company_intelligence (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  raw_id bigint not null,
  signal_hash text not null,
  score jsonb not null,
  scoring_model_version text not null default 'v1',
  scored_at timestamptz not null default now(),
  unique (user_id, raw_id)
);

create index if not exists idx_company_intelligence_user on company_intelligence(user_id);
create index if not exists idx_company_intelligence_raw on company_intelligence(raw_id);

alter table company_intelligence enable row level security;

drop policy if exists "users_read_own_intelligence" on company_intelligence;
create policy "users_read_own_intelligence" on company_intelligence
  for select using (auth.uid()::text = user_id::text);

-- Writes happen via the service-role client (same reasoning as every
-- other table touched by the search/scoring pipeline this session) —
-- block direct client writes entirely as defense in depth.
drop policy if exists "no_client_writes_intelligence" on company_intelligence;
create policy "no_client_writes_intelligence" on company_intelligence
  for all using (false) with check (false);