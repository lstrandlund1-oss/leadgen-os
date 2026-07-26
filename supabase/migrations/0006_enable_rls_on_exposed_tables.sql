-- 0006_enable_rls_on_exposed_tables.sql
--
-- CRITICAL SECURITY FIX. Found via a Supabase audit: five tables had RLS
-- completely disabled. The application's own Supabase client
-- (lib/supabaseClient.ts) uses the ANON key — which is public, embedded in
-- every page's JS bundle. With RLS off, that key's default grants on the
-- public schema mean ANYONE can read/write every row directly via
-- Supabase's REST API, bypassing the Next.js app entirely.
--
-- lead_outcomes was independently confirmed exploitable even through the
-- app's own API (a missing user_id filter meant any visitor — logged in
-- or not — could read every user's outcome data, including revenue
-- figures and private notes, and enumerate it by run_id). That specific
-- app-code bug is fixed separately in app/api/outcomes/route.ts, but RLS
-- must ALSO be enabled here — it's not defense-in-depth in this case, it's
-- the primary boundary, since the anon key can reach these tables directly.
--
-- Fully idempotent: every DROP POLICY IF EXISTS / ENABLE ROW LEVEL SECURITY
-- statement is safe to re-run, since a first attempt at this migration
-- partially applied before failing (lead_outcomes.user_id turned out to be
-- text, not uuid, and auth.uid() = user_id has no operator for uuid = text).
-- Casts both sides to ::text below so this works regardless of the actual
-- column type on either table.

-- ── lead_outcomes — per-user business data (revenue, notes, contact status) ──
alter table lead_outcomes enable row level security;
drop policy if exists "users_manage_own_outcomes" on lead_outcomes;
create policy "users_manage_own_outcomes" on lead_outcomes
  for all using (auth.uid()::text = user_id::text) with check (auth.uid()::text = user_id::text);

-- ── lead_deep_scans — per-user enrichment results ───────────────────────
alter table lead_deep_scans enable row level security;
drop policy if exists "users_manage_own_deep_scans" on lead_deep_scans;
create policy "users_manage_own_deep_scans" on lead_deep_scans
  for all using (auth.uid()::text = user_id::text) with check (auth.uid()::text = user_id::text);

-- ── contact_submissions — public contact form, insert-only from clients ─
-- Anyone (including anonymous visitors) can submit a contact form, but
-- nobody can read submissions back through the anon/authenticated role —
-- only the service role (used for any future admin view) can.
alter table contact_submissions enable row level security;
drop policy if exists "anyone_can_submit_contact_form" on contact_submissions;
create policy "anyone_can_submit_contact_form" on contact_submissions
  for insert with check (true);
drop policy if exists "no_client_reads_contact_submissions" on contact_submissions;
create policy "no_client_reads_contact_submissions" on contact_submissions
  for select using (false);

-- ── waitlist — public signup, insert-only from clients ──────────────────
-- Same reasoning as contact_submissions. The existing waitlist count
-- endpoint (app/api/waitlist/route.ts) now uses a service-role client
-- instead of the anon key, since it can no longer read rows (even for a
-- count) once this lands. See lib/supabaseServiceClient.ts.
alter table waitlist enable row level security;
drop policy if exists "anyone_can_join_waitlist" on waitlist;
create policy "anyone_can_join_waitlist" on waitlist
  for insert with check (true);
-- The waitlist route uses upsert(..., { onConflict: "email" }) — the
-- conflict-resolution path is an UPDATE under the hood, so this needs its
-- own policy or a repeat signup with the same email would silently fail.
-- There's no user_id to scope by here (anonymous public signups), so this
-- matches the same openness as the insert policy above.
drop policy if exists "anyone_can_update_own_waitlist_row" on waitlist;
create policy "anyone_can_update_own_waitlist_row" on waitlist
  for update using (true) with check (true);
drop policy if exists "no_client_reads_waitlist" on waitlist;
create policy "no_client_reads_waitlist" on waitlist
  for select using (false);

-- ── support_tickets — created via an internal API route, insert-only ────
-- The support-chat route currently uses the anon-key client to insert
-- tickets. Allow that; block all client reads (no read UI exists today).
alter table support_tickets enable row level security;
drop policy if exists "insert_support_tickets" on support_tickets;
create policy "insert_support_tickets" on support_tickets
  for insert with check (true);
drop policy if exists "no_client_reads_support_tickets" on support_tickets;
create policy "no_client_reads_support_tickets" on support_tickets
  for select using (false);