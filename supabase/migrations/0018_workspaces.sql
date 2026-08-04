-- 0018_workspaces.sql
--
-- Workspace architecture (Week 4 of the rebuild): moves toward
-- workspace-owned data instead of assuming everything belongs directly
-- to one user, per the rebuild spec's explicit instruction. This is
-- deliberately the additive migration strategy described back when this
-- was first planned: nullable workspace_id columns added alongside
-- existing user_id columns, not a replacement — every existing query,
-- RLS policy, and API route keeps working completely unchanged after
-- this migration runs. Nothing in the application is wired to actually
-- USE workspace_id yet; that's the deliberately separate next step, once
-- this foundation is verified safe on its own.
--
-- Roles are kept to Owner/Member only, per the spec's explicit
-- instruction not to overbuild enterprise permissions this month.

create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null,
  created_at timestamptz not null default now()
);

create table if not exists workspace_members (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index if not exists idx_workspace_members_user on workspace_members(user_id);

-- Additive workspace_id columns — nullable, no default behavior change
-- for any existing row or query. Every table here already has user_id;
-- workspace_id sits alongside it, not in place of it.
alter table user_profiles add column if not exists workspace_id uuid references workspaces(id) on delete set null;
alter table lead_outcomes add column if not exists workspace_id uuid references workspaces(id) on delete set null;
alter table outreach_emails add column if not exists workspace_id uuid references workspaces(id) on delete set null;
alter table outreach_templates add column if not exists workspace_id uuid references workspaces(id) on delete set null;
alter table lead_sequences add column if not exists workspace_id uuid references workspaces(id) on delete set null;
alter table lead_collections add column if not exists workspace_id uuid references workspaces(id) on delete set null;
alter table lead_collection_items add column if not exists workspace_id uuid references workspaces(id) on delete set null;
alter table user_search_runs add column if not exists workspace_id uuid references workspaces(id) on delete set null;
alter table markets add column if not exists workspace_id uuid references workspaces(id) on delete set null;
alter table company_intelligence add column if not exists workspace_id uuid references workspaces(id) on delete set null;

create index if not exists idx_user_profiles_workspace on user_profiles(workspace_id);
create index if not exists idx_lead_outcomes_workspace on lead_outcomes(workspace_id);
create index if not exists idx_outreach_emails_workspace on outreach_emails(workspace_id);
create index if not exists idx_outreach_templates_workspace on outreach_templates(workspace_id);
create index if not exists idx_lead_sequences_workspace on lead_sequences(workspace_id);
create index if not exists idx_lead_collections_workspace on lead_collections(workspace_id);
create index if not exists idx_lead_collection_items_workspace on lead_collection_items(workspace_id);
create index if not exists idx_user_search_runs_workspace on user_search_runs(workspace_id);
create index if not exists idx_markets_workspace on markets(workspace_id);
create index if not exists idx_company_intelligence_workspace on company_intelligence(workspace_id);

-- Backfill: create one personal workspace per existing user (identified
-- via user_profiles, since that's every real, onboarded user in the
-- system) and populate workspace_id on all of that user's existing rows
-- across every table above. Idempotent — re-running this migration
-- (e.g. after a partial failure) won't create duplicate workspaces,
-- since it only creates one for users who don't already have one.
do $$
declare
  user_record record;
  new_workspace_id uuid;
begin
  for user_record in
    select up.id as user_id
    from user_profiles up
    where not exists (
      select 1 from workspace_members wm where wm.user_id = up.id
    )
  loop
    insert into workspaces (name, owner_id)
    values ('My Workspace', user_record.user_id)
    returning id into new_workspace_id;

    insert into workspace_members (workspace_id, user_id, role)
    values (new_workspace_id, user_record.user_id, 'owner');

    update user_profiles set workspace_id = new_workspace_id where id = user_record.user_id;
    update lead_outcomes set workspace_id = new_workspace_id where user_id = user_record.user_id;
    update outreach_emails set workspace_id = new_workspace_id where user_id = user_record.user_id;
    update outreach_templates set workspace_id = new_workspace_id where user_id = user_record.user_id;
    update lead_sequences set workspace_id = new_workspace_id where user_id = user_record.user_id;
    update lead_collections set workspace_id = new_workspace_id where user_id = user_record.user_id;
    update lead_collection_items set workspace_id = new_workspace_id where user_id = user_record.user_id;
    update user_search_runs set workspace_id = new_workspace_id where user_id = user_record.user_id;
    update markets set workspace_id = new_workspace_id where user_id = user_record.user_id;
    update company_intelligence set workspace_id = new_workspace_id where user_id = user_record.user_id;
  end loop;
end $$;

alter table workspaces enable row level security;
alter table workspace_members enable row level security;

drop policy if exists "members_can_read_their_workspaces" on workspaces;
create policy "members_can_read_their_workspaces" on workspaces
  for select using (
    exists (select 1 from workspace_members wm where wm.workspace_id = workspaces.id and wm.user_id::text = auth.uid()::text)
  );

drop policy if exists "users_can_read_own_memberships" on workspace_members;
create policy "users_can_read_own_memberships" on workspace_members
  for select using (auth.uid()::text = user_id::text);

-- All writes to workspaces/workspace_members happen via the service-role
-- client (invitations, role changes) — same pattern as every other
-- privileged-write table this session. Client writes blocked entirely.
drop policy if exists "no_client_writes_workspaces" on workspaces;
create policy "no_client_writes_workspaces" on workspaces
  for insert with check (false);
drop policy if exists "no_client_updates_workspaces" on workspaces;
create policy "no_client_updates_workspaces" on workspaces
  for update using (false);
drop policy if exists "no_client_deletes_workspaces" on workspaces;
create policy "no_client_deletes_workspaces" on workspaces
  for delete using (false);

drop policy if exists "no_client_writes_workspace_members" on workspace_members;
create policy "no_client_writes_workspace_members" on workspace_members
  for insert with check (false);
drop policy if exists "no_client_updates_workspace_members" on workspace_members;
create policy "no_client_updates_workspace_members" on workspace_members
  for update using (false);
drop policy if exists "no_client_deletes_workspace_members" on workspace_members;
create policy "no_client_deletes_workspace_members" on workspace_members
  for delete using (false);