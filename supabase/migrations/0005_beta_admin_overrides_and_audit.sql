-- 0005_beta_admin_overrides_and_audit.sql
-- Per-tester AI allowance overrides (admin action: "Adjust AI allowance",
-- "Adjust monetary ceiling") and a lightweight admin-action audit trail.
--
-- Without this, every beta tester shares the exact same global defaults
-- from lib/beta/config.ts with no way for an admin to give one specific
-- tester a different limit — a real gap against the Phase 8 requirement.

-- ── Per-feature allowance overrides ─────────────────────────────────────
-- A row here overrides the global default from lib/beta/config.ts for
-- that specific membership+feature. No row = use the global default.
create table if not exists beta_feature_allowances (
  id bigint generated always as identity primary key,
  membership_id uuid not null references beta_memberships(id),
  feature text not null check (feature in ('outreach', 'followup', 'ai_deep_search')),
  daily_limit int, -- null = no daily cap
  total_limit int, -- null = unlimited
  updated_by text not null, -- admin email
  updated_at timestamptz not null default now(),
  unique (membership_id, feature)
);

alter table beta_feature_allowances enable row level security;
create policy "service_role_only_beta_feature_allowances" on beta_feature_allowances
  for all using (false) with check (false);

-- ── Monetary ceiling override ────────────────────────────────────────────
alter table beta_memberships add column if not exists monetary_ceiling_micro_usd bigint; -- null = use global default

-- ── Admin action audit trail ─────────────────────────────────────────────
-- Every sensitive admin mutation must be auditable. Rather than a new
-- dedicated table, this reuses analytics_events (already service-role-only,
-- already exists) with a consistent event_name prefix.
-- Example: event_name = 'admin_action', properties = {
--   action: 'expire_membership', membershipId, adminEmail, details: {...}
-- }
-- No schema change needed for this — analytics_events already supports it.