-- 0002_beta_accept_invitation.sql
-- Atomic invitation acceptance. Locks the invitation row so concurrent or
-- repeated acceptance attempts cannot create duplicate memberships, and
-- enforces the email match + expiry/status checks inside the same
-- transaction rather than as separate application-level round trips.

create or replace function accept_beta_invitation(
  p_token_hash text,
  p_user_id uuid,
  p_user_email text
)
returns table (success boolean, reason text, membership_id uuid) as $$
declare
  v_invitation beta_invitations%rowtype;
  v_existing_membership_id uuid;
  v_new_membership_id uuid;
  v_hard_end timestamptz;
begin
  -- Lock the invitation row first so two concurrent accept attempts on the
  -- same token serialize here instead of racing.
  select * into v_invitation
  from beta_invitations
  where token_hash = p_token_hash
  for update;

  if v_invitation.id is null then
    return query select false, 'not_found'::text, null::uuid;
    return;
  end if;

  if v_invitation.status = 'revoked' then
    return query select false, 'revoked'::text, null::uuid;
    return;
  end if;

  if v_invitation.status = 'accepted' then
    return query select false, 'already_accepted'::text, null::uuid;
    return;
  end if;

  if v_invitation.expires_at < now() then
    -- Lazily mark expired on read, mirroring the membership expiration pattern.
    update beta_invitations set status = 'expired' where id = v_invitation.id and status = 'pending';
    return query select false, 'expired'::text, null::uuid;
    return;
  end if;

  -- Case-insensitive email match — the wrong account cannot claim access.
  if lower(v_invitation.email) <> lower(p_user_email) then
    return query select false, 'email_mismatch'::text, null::uuid;
    return;
  end if;

  -- Does this user already have a membership (from this or a prior invite)?
  select id into v_existing_membership_id from beta_memberships where user_id = p_user_id;
  if v_existing_membership_id is not null then
    return query select false, 'already_has_membership'::text, v_existing_membership_id;
    return;
  end if;

  -- Compare-and-set: only proceeds if still 'pending'. If this returns no
  -- row, another concurrent call already accepted/revoked it — abort rather
  -- than proceed to create a second membership.
  update beta_invitations
  set status = 'accepted', accepted_at = now(), accepted_user_id = p_user_id
  where id = v_invitation.id and status = 'pending';

  if not found then
    return query select false, 'already_accepted'::text, null::uuid;
    return;
  end if;

  v_hard_end := now() + interval '14 days';

  insert into beta_memberships (user_id, invitation_id, activated_at, hard_end_at)
  values (p_user_id, v_invitation.id, now(), v_hard_end)
  returning id into v_new_membership_id;

  return query select true, 'ok'::text, v_new_membership_id;
exception
  when unique_violation then
    -- Safety net: a race on the beta_memberships.user_id unique constraint
    -- slipped past the check above. Treat as already-activated rather than
    -- erroring the request.
    select id into v_existing_membership_id from beta_memberships where user_id = p_user_id;
    return query select false, 'already_has_membership'::text, v_existing_membership_id;
end;
$$ language plpgsql security definer;