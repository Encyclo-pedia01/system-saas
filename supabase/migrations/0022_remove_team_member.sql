-- DRAFT: not applied yet (needs owner approval). Dev and production use the same database.
-- Removes a teacher's or Encyclopedia staff member's access to one school. Their account is kept.
-- Class assignments for that person are removed by the existing cascade.

create or replace function public.remove_team_member(p_membership_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_institution uuid;
  v_role text;
  v_user uuid;
begin
  select institution_id, role, user_id into v_institution, v_role, v_user
  from public.memberships where id = p_membership_id;

  if v_institution is null then
    raise exception 'That team member no longer exists.' using errcode = 'P0002';
  end if;
  if not public.has_role(v_institution, array['owner']) then
    raise exception 'You do not have permission to do that.' using errcode = '42501';
  end if;
  if v_user = auth.uid() then
    raise exception 'You cannot remove your own access.' using errcode = '42501';
  end if;
  if v_role = 'owner' then
    raise exception 'The school owner cannot be removed.' using errcode = '42501';
  end if;

  delete from public.memberships where id = p_membership_id;
end;
$$;

revoke all on function public.remove_team_member(uuid) from public;
grant execute on function public.remove_team_member(uuid) to authenticated;
