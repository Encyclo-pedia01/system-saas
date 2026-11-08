-- Class levels and class-teacher invitations (CLASS_LEVELS_PLAN.md).
-- Each class belongs to one school level. New classes must have a level. Existing classes
-- start with no level, and the owner sets each one by hand. Until a level is set, the class is
-- shown as "Level not set".
-- Teacher invitations (staff role) expire 30 minutes after they are sent. The database sets the
-- expiry, so the browser clock cannot change it.

-- ---------------------------------------------------------------------------
-- 1. Class level
-- ---------------------------------------------------------------------------
alter table public.classes
  add column if not exists level text check (level in ('pre_school', 'primary', 'jhs'));

create or replace function public.classes_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.level is null then
      raise exception 'Choose the class level: Pre-school, Primary, or JHS.' using errcode = '23514';
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.level is null and old.level is not null then
      raise exception 'Every class needs a level. Choose one instead.' using errcode = '23514';
    end if;
    if new.level is distinct from old.level and (
      exists (select 1 from public.students s where s.institution_id = old.institution_id and s.class_id = old.id)
      or exists (select 1 from public.fee_charges fc where fc.institution_id = old.institution_id and fc.student_id in (
        select s.id from public.students s where s.institution_id = old.institution_id and s.class_id = old.id))
    ) then
      raise exception 'This class has students or fee charges, so its level cannot be changed.' using errcode = '23514';
    end if;
    if old.has_groups and not new.has_groups and exists (
      select 1 from public.students s where s.institution_id = old.institution_id and s.class_id = old.id and s.group_id is not null
    ) then
      raise exception 'Move the students out of their groups before turning groups off.' using errcode = '23514';
    end if;
    return new;
  end if;

  -- DELETE
  if exists (select 1 from public.students s where s.institution_id = old.institution_id and s.class_id = old.id)
     or exists (select 1 from public.assessments a where a.institution_id = old.institution_id and a.class_id = old.id)
     or exists (select 1 from public.fee_items fi where fi.institution_id = old.institution_id and fi.class_id = old.id) then
    raise exception 'This class has students, assessments, or fee items, so it cannot be deleted.' using errcode = '23514';
  end if;
  return old;
end;
$$;

drop trigger if exists classes_guard_change on public.classes;
create trigger classes_guard_change
  before insert or update or delete on public.classes
  for each row execute function public.classes_guard();

-- ---------------------------------------------------------------------------
-- 2. Class-teacher invitations
-- ---------------------------------------------------------------------------
alter table public.invitations
  add column if not exists class_id uuid,
  add column if not exists kind text not null default 'member' check (kind in ('member', 'class_teacher'));

alter table public.invitations
  drop constraint if exists invitations_class_fk;
alter table public.invitations
  add constraint invitations_class_fk
  foreign key (institution_id, class_id) references public.classes (institution_id, id) on delete cascade;

alter table public.invitations
  drop constraint if exists invitations_class_teacher_shape;
alter table public.invitations
  add constraint invitations_class_teacher_shape
  check ((kind = 'class_teacher') = (class_id is not null));

-- One open teacher link per class. Regenerating revokes the old link first.
create unique index if not exists invitations_one_pending_class_teacher
  on public.invitations (institution_id, class_id)
  where kind = 'class_teacher' and accepted_at is null and revoked_at is null;

-- Teacher invitations (staff role) expire 30 minutes after they are sent.
-- Authority invitations keep the default expiry.
create or replace function public.invitations_set_expiry()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.role = 'staff' then
    new.expires_at := now() + interval '30 minutes';
  end if;
  return new;
end;
$$;

drop trigger if exists invitations_set_expiry_trigger on public.invitations;
create trigger invitations_set_expiry_trigger
  before insert on public.invitations
  for each row execute function public.invitations_set_expiry();

-- Assigning a teacher to a class closes any open teacher link for that class.
create or replace function public.set_class_teacher_checked(p_class_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_institution uuid;
begin
  select institution_id into v_institution from public.classes where id = p_class_id;
  if v_institution is null then
    raise exception 'That class could not be found.' using errcode = 'P0002';
  end if;
  if not public.has_role(v_institution, array['owner']) then
    raise exception 'Only the school owner can assign class teachers.' using errcode = '42501';
  end if;

  update public.invitations
     set revoked_at = now()
   where institution_id = v_institution and class_id = p_class_id
     and kind = 'class_teacher' and accepted_at is null and revoked_at is null;

  if p_user_id is null then
    delete from public.class_teachers where institution_id = v_institution and class_id = p_class_id;
  else
    insert into public.class_teachers (institution_id, class_id, user_id)
    values (v_institution, p_class_id, p_user_id)
    on conflict (institution_id, class_id) do update set user_id = excluded.user_id;
  end if;
end;
$$;

revoke all on function public.set_class_teacher_checked(uuid, uuid) from public;
grant execute on function public.set_class_teacher_checked(uuid, uuid) to authenticated;

-- A class with no level cannot have assessments, so its scores cannot be entered either.
create or replace function public.assessments_require_class_level()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.classes c
    where c.institution_id = new.institution_id and c.id = new.class_id and c.level is null
  ) then
    raise exception 'Set this class''s level (Pre-school, Primary, or JHS) before adding assessments.' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists assessments_require_class_level_trigger on public.assessments;
create trigger assessments_require_class_level_trigger
  before insert or update of class_id on public.assessments
  for each row execute function public.assessments_require_class_level();
