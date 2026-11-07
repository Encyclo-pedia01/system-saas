-- Class groups: a class can be split into groups (for example Basic 5 -> 5A, 5B).
-- A student belongs to a group only when their class has groups.

alter table public.classes
  add column if not exists has_groups boolean not null default false;

create table if not exists public.class_groups (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions (id) on delete cascade,
  class_id uuid not null,
  name text not null check (char_length(name) between 1 and 40),
  created_at timestamptz not null default now(),
  unique (institution_id, class_id, name),
  unique (institution_id, class_id, id),
  foreign key (institution_id, class_id) references public.classes (institution_id, id) on delete cascade
);

alter table public.students
  add column if not exists group_id uuid;

alter table public.students
  drop constraint if exists students_group_same_class;

alter table public.students
  add constraint students_group_same_class
  foreign key (institution_id, class_id, group_id)
  references public.class_groups (institution_id, class_id, id) on delete restrict;

create or replace function public.enforce_student_group()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_has_groups boolean;
begin
  select c.has_groups into v_has_groups
  from public.classes c
  where c.institution_id = new.institution_id and c.id = new.class_id;

  if v_has_groups and new.group_id is null then
    raise exception 'This class has groups. Choose a group for the student.'
      using errcode = 'check_violation';
  end if;

  if not v_has_groups and new.group_id is not null then
    raise exception 'This class has no groups.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists students_enforce_group on public.students;
create trigger students_enforce_group
  before insert or update of class_id, group_id on public.students
  for each row execute function public.enforce_student_group();

alter table public.class_groups enable row level security;
alter table public.class_groups force row level security;

grant select, insert, update, delete on public.class_groups to authenticated;

create policy class_groups_select on public.class_groups
  for select to authenticated
  using (public.can_view_institution(institution_id, array['owner', 'staff']));

create policy class_groups_write_owner on public.class_groups
  for all to authenticated
  using (public.has_role(institution_id, array['owner']))
  with check (public.has_role(institution_id, array['owner']));
