-- 0019_workspace_invitations.sql
--
-- Workspace member invitations. Separate from the beta invitation system
-- (lib/beta/*) — that's for admitting new users to the private beta
-- program, this is for an existing workspace owner adding a teammate to
-- their own workspace. Different purpose, different table, deliberately
-- not reused.

create table if not exists workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  invited_email text not null,
  invited_by uuid not null,
  token uuid not null default gen_random_uuid() unique,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

create index if not exists idx_workspace_invitations_workspace on workspace_invitations(workspace_id);
create index if not exists idx_workspace_invitations_token on workspace_invitations(token);

alter table workspace_invitations enable row level security;

drop policy if exists "members_can_read_workspace_invitations" on workspace_invitations;
create policy "members_can_read_workspace_invitations" on workspace_invitations
  for select using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = workspace_invitations.workspace_id
        and wm.user_id::text = auth.uid()::text
    )
  );

drop policy if exists "no_client_writes_workspace_invitations" on workspace_invitations;
create policy "no_client_writes_workspace_invitations" on workspace_invitations
  for insert with check (false);
drop policy if exists "no_client_updates_workspace_invitations" on workspace_invitations;
create policy "no_client_updates_workspace_invitations" on workspace_invitations
  for update using (false);