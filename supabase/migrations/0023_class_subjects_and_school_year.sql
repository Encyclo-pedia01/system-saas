-- Subjects are set per class. Every student enrolled in a class gets that class's subjects.
-- Terms come in sets of three per school year: 1st, 2nd and 3rd Term.

create table if not exists public.class_subjects (
  institution_id uuid not null references public.institutions (id) on delete cascade,
  class_id uuid not null,
  subject_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (institution_id, class_id, subject_id),
  foreign key (institution_id, class_id) references public.classes (institution_id, id) on delete cascade,
  foreign key (institution_id, subject_id) references public.subjects (institution_id, id) on delete cascade
);

create table if not exists public.student_subjects (
  institution_id uuid not null references public.institutions (id) on delete cascade,
  student_id uuid not null,
  subject_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (institution_id, student_id, subject_id),
  foreign key (institution_id, student_id) references public.students (institution_id, id) on delete cascade,
  foreign key (institution_id, subject_id) references public.subjects (institution_id, id) on delete cascade
);

alter table public.class_subjects enable row level security;
alter table public.class_subjects force row level security;
alter table public.student_subjects enable row level security;
alter table public.student_subjects force row level security;

grant select, insert, update, delete on public.class_subjects to authenticated;
grant select, insert, update, delete on public.student_subjects to authenticated;

create policy class_subjects_select on public.class_subjects
  for select to authenticated
  using (public.can_view_institution(institution_id, array['owner', 'school_admin', 'staff']));

create policy class_subjects_write_owner on public.class_subjects
  for all to authenticated
  using (public.has_role(institution_id, array['owner']))
  with check (public.has_role(institution_id, array['owner']));

create policy student_subjects_select on public.student_subjects
  for select to authenticated
  using (public.can_view_institution(institution_id, array['owner', 'school_admin', 'staff']));

create policy student_subjects_write_owner on public.student_subjects
  for all to authenticated
  using (public.has_role(institution_id, array['owner']))
  with check (public.has_role(institution_id, array['owner']));

-- A new student gets the subjects of their class.
create or replace function public.add_class_subjects_to_student()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.student_subjects (institution_id, student_id, subject_id)
  select cs.institution_id, new.id, cs.subject_id
  from public.class_subjects cs
  where cs.institution_id = new.institution_id and cs.class_id = new.class_id
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists students_add_class_subjects on public.students;
create trigger students_add_class_subjects
  after insert on public.students
  for each row execute function public.add_class_subjects_to_student();

-- A student moved to another class gets the new class's subjects and loses the old ones.
create or replace function public.move_student_subjects()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.class_id is distinct from old.class_id then
    delete from public.student_subjects ss
    where ss.institution_id = new.institution_id
      and ss.student_id = new.id
      and not exists (
        select 1 from public.class_subjects cs
        where cs.institution_id = new.institution_id and cs.class_id = new.class_id and cs.subject_id = ss.subject_id
      );
    insert into public.student_subjects (institution_id, student_id, subject_id)
    select cs.institution_id, new.id, cs.subject_id
    from public.class_subjects cs
    where cs.institution_id = new.institution_id and cs.class_id = new.class_id
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists students_move_subjects on public.students;
create trigger students_move_subjects
  after update of class_id on public.students
  for each row execute function public.move_student_subjects();

-- Adding a subject to a class adds it to every student already in that class.
create or replace function public.add_subject_to_class_students()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.student_subjects (institution_id, student_id, subject_id)
  select s.institution_id, s.id, new.subject_id
  from public.students s
  where s.institution_id = new.institution_id and s.class_id = new.class_id
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists class_subjects_added on public.class_subjects;
create trigger class_subjects_added
  after insert on public.class_subjects
  for each row execute function public.add_subject_to_class_students();

-- Removing a subject from a class removes it from the students in that class.
create or replace function public.remove_subject_from_class_students()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.student_subjects ss
  using public.students s
  where ss.institution_id = old.institution_id
    and ss.subject_id = old.subject_id
    and ss.student_id = s.id
    and s.class_id = old.class_id;
  return old;
end;
$$;

drop trigger if exists class_subjects_removed on public.class_subjects;
create trigger class_subjects_removed
  after delete on public.class_subjects
  for each row execute function public.remove_subject_from_class_students();

-- Creates the three terms of a school year (owner only).
-- Dates: 1st Term Sep–Dec, 2nd Term Jan–Apr, 3rd Term Apr–Jul.
create or replace function public.create_school_year(p_institution_id uuid, p_start_year integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_suffix text := right((p_start_year + 1)::text, 2);
begin
  if not public.has_role(p_institution_id, array['owner']) then
    raise exception 'Only the school owner can set up terms.' using errcode = '42501';
  end if;
  if p_start_year < 2000 or p_start_year > 2100 then
    raise exception 'Choose a valid start year.' using errcode = 'check_violation';
  end if;

  insert into public.terms (institution_id, name, starts_on, ends_on) values
    (p_institution_id, '1st Term ' || p_start_year || '/' || v_suffix, make_date(p_start_year, 9, 1), make_date(p_start_year, 12, 15)),
    (p_institution_id, '2nd Term ' || p_start_year || '/' || v_suffix, make_date(p_start_year + 1, 1, 8), make_date(p_start_year + 1, 4, 10)),
    (p_institution_id, '3rd Term ' || p_start_year || '/' || v_suffix, make_date(p_start_year + 1, 4, 25), make_date(p_start_year + 1, 7, 31));
end;
$$;

revoke all on function public.create_school_year(uuid, integer) from public;
grant execute on function public.create_school_year(uuid, integer) to authenticated;
