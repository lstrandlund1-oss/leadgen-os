-- 0013_user_subscriptions.sql
--
-- Stores per-user Stripe subscription state. Nothing like this existed
-- before — checkout/webhook code would have had nowhere to record the
-- result of a payment. This is deliberately a standalone table, separate
-- from the beta entitlement system (lib/beta/*) and from
-- lib/plan.ts's getEffectivePlan(), which currently returns a single
-- global value from an env var. Wiring getEffectivePlan() to actually
-- read this table is a separate, deliberately deferred task — it doesn't
-- matter yet since beta testers bypass all of this via BETA_FULL_ACCESS,
-- and getEffectivePlan() is called throughout the app, so that rewiring
-- needs its own careful pass, not a rushed side effect of adding checkout.

create table if not exists user_subscriptions (
  user_id uuid primary key,
  plan text not null check (plan in ('scout', 'operator', 'agency')),
  period text not null check (period in ('monthly', 'quarterly', 'yearly')),
  currency text not null check (currency in ('eur', 'usd', 'sek', 'gbp')),
  status text not null check (status in ('active', 'past_due', 'canceled', 'incomplete', 'trialing')),
  stripe_customer_id text not null,
  stripe_subscription_id text not null unique,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_subscriptions_customer on user_subscriptions(stripe_customer_id);

alter table user_subscriptions enable row level security;

-- Users can read their own subscription (for a future "your plan" UI read
-- via the session-aware server client). All writes happen exclusively via
-- the webhook route using the service-role client, which bypasses RLS
-- regardless — client writes are blocked entirely as defense in depth.
drop policy if exists "users_read_own_subscription" on user_subscriptions;
create policy "users_read_own_subscription" on user_subscriptions
  for select using (auth.uid()::text = user_id::text);

drop policy if exists "no_client_writes_subscriptions" on user_subscriptions;
create policy "no_client_writes_subscriptions" on user_subscriptions
  for all using (false) with check (false);