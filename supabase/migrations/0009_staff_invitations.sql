-- Staff and authority invitations. Owners invite members from the Team page.
-- Only a hash of each invitation token is stored; the raw token is shown once.

alter table public.invitations
  drop constraint if exists invitations_role_check;

alter table public.invitations
  add constraint invitations_role_check check (role in ('owner', 'staff', 'authority'));

alter table public.invitations
  add column if not exists token_hash text,
  add column if not exists expires_at timestamptz not null default (now() + interval '7 days'),
  add column if not exists revoked_at timestamptz;

create unique index if not exists invitations_token_hash_key
  on public.invitations (token_hash)
  where token_hash is not null;

create unique index if not exists invitations_one_pending_per_email
  on public.invitations (institution_id, lower(email))
  where accepted_at is null and revoked_at is null;

-- Owners manage their own school's staff invitations. Super admins keep their policy.
create policy invitations_insert_owner on public.invitations
  for insert to authenticated
  with check (
    public.has_role(institution_id, array['owner'])
    and role in ('staff', 'authority')
    and invited_by = (select auth.uid())
  );

create policy invitations_revoke_owner on public.invitations
  for update to authenticated
  using (public.has_role(institution_id, array['owner']) and role in ('staff', 'authority'))
  with check (public.has_role(institution_id, array['owner']) and role in ('staff', 'authority'));
