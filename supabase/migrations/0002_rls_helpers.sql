-- Helper functions used by RLS policies and RPCs.
-- All helpers are SECURITY DEFINER with an empty search_path so policy evaluation
-- cannot be hijacked by objects created in other schemas.

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.is_super_admin
  );
$$;

-- Any membership, regardless of institution status. Used so a suspended school's
-- members can still see that their school is suspended.
create or replace function public.is_member(p_institution_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    where m.user_id = (select auth.uid())
      and m.institution_id = p_institution_id
  );
$$;

-- Role check for tenant data. Suspended institutions fail this check, which blocks
-- every tenant read and write for their members.
create or replace function public.has_role(p_institution_id uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    join public.institutions i on i.id = m.institution_id
    where m.user_id = (select auth.uid())
      and m.institution_id = p_institution_id
      and m.role = any (p_roles)
      and i.status = 'active'
  );
$$;

-- Read-only platform impersonation. Requires a live, unexpired session for the caller.
create or replace function public.is_impersonating(p_institution_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.impersonation_sessions s
    join public.profiles p on p.id = s.actor_id
    where s.actor_id = (select auth.uid())
      and s.institution_id = p_institution_id
      and s.ended_at is null
      and s.expires_at > now()
      and p.is_super_admin
  );
$$;

create or replace function public.can_view_institution(p_institution_id uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role(p_institution_id, p_roles)
      or public.is_impersonating(p_institution_id);
$$;

-- Current calendar date at the institution, used for "today's" check-in visibility.
create or replace function public.institution_local_date(p_institution_id uuid)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select (now() at time zone i.timezone)::date
  from public.institutions i
  where i.id = p_institution_id;
$$;

-- Auto-create a profile whenever an auth user is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

revoke all on function public.is_super_admin() from public;
revoke all on function public.is_member(uuid) from public;
revoke all on function public.has_role(uuid, text[]) from public;
revoke all on function public.is_impersonating(uuid) from public;
revoke all on function public.can_view_institution(uuid, text[]) from public;
revoke all on function public.institution_local_date(uuid) from public;

grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.is_member(uuid) to authenticated;
grant execute on function public.has_role(uuid, text[]) to authenticated;
grant execute on function public.is_impersonating(uuid) to authenticated;
grant execute on function public.can_view_institution(uuid, text[]) to authenticated;
grant execute on function public.institution_local_date(uuid) to authenticated;
