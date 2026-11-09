-- Daily attendance. Teachers mark present or absent for students in their own classes.
-- The owner can see and change every class in their school. Platform admins can read only.
-- One row per student, per class, per day. Rows are never deleted by the app.

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  attendance_date date not null,
  present boolean not null,
  marked_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint attendance_one_per_day unique (class_id, student_id, attendance_date)
);

create index attendance_institution_date_idx on public.attendance (institution_id, attendance_date);

alter table public.attendance enable row level security;

revoke all on public.attendance from anon;
grant select, insert, update on public.attendance to authenticated;

-- The student must belong to the class and school named on the row.
create or replace function public.attendance_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.students s
    where s.id = new.student_id
      and s.class_id = new.class_id
      and s.institution_id = new.institution_id
  ) then
    raise exception 'That student is not in this class.' using errcode = '23514';
  end if;
  new.marked_by := (select auth.uid());
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.attendance_guard() from public;

create trigger attendance_guard_change
  before insert or update on public.attendance
  for each row execute function public.attendance_guard();

create or replace function public.can_mark_attendance(p_institution_id uuid, p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role(p_institution_id, array['owner'])
    or (
      public.has_role(p_institution_id, array['staff'])
      and exists (
        select 1
        from public.class_teachers ct
        where ct.institution_id = p_institution_id
          and ct.class_id = p_class_id
          and ct.user_id = (select auth.uid())
      )
    );
$$;

revoke all on function public.can_mark_attendance(uuid, uuid) from public;
grant execute on function public.can_mark_attendance(uuid, uuid) to authenticated;

create policy attendance_read on public.attendance
  for select to authenticated
  using (
    public.can_mark_attendance(institution_id, class_id)
    or public.is_super_admin()
  );

create policy attendance_write on public.attendance
  for insert to authenticated
  with check (public.can_mark_attendance(institution_id, class_id));

create policy attendance_update on public.attendance
  for update to authenticated
  using (public.can_mark_attendance(institution_id, class_id))
  with check (public.can_mark_attendance(institution_id, class_id));

create trigger audit_attendance
  after insert or update on public.attendance
  for each row execute function public.audit_row_change();
