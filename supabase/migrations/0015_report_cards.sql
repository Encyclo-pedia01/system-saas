-- Terminal report cards (REPORT_CARD_PLAN.md, approved in DECISIONS.md item 19).
-- Grade bands are stored by minimum score. The lowest band must start at 0, so the bands
-- always cover 0-100 with no gaps or overlaps.
-- Remarks: a class teacher remark (written by that class's teacher) and a headmaster remark
-- (written by the owner, or by a staff/Encyclopedia member tagged as headmaster).
-- A card marked final keeps a snapshot and locks its remarks.

-- ---------------------------------------------------------------------------
-- Headmaster tag on memberships (set only through set_headmaster_tag).
-- ---------------------------------------------------------------------------
alter table public.memberships
  add column if not exists is_headmaster boolean not null default false;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.grade_bands (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions (id) on delete cascade,
  letter text not null check (char_length(letter) between 1 and 3),
  min_score numeric(5, 2) not null check (min_score >= 0 and min_score <= 100),
  label text not null check (char_length(label) between 1 and 40),
  unique (institution_id, letter),
  unique (institution_id, min_score)
);

create table public.class_teachers (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions (id) on delete cascade,
  class_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (institution_id, class_id),
  foreign key (institution_id, class_id) references public.classes (institution_id, id) on delete cascade
);

create table public.report_remarks (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions (id) on delete cascade,
  term_id uuid not null,
  student_id uuid not null,
  kind text not null check (kind in ('class_teacher', 'headmaster')),
  body text not null check (char_length(body) between 1 and 300),
  written_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (institution_id, term_id, student_id, kind),
  foreign key (institution_id, term_id) references public.terms (institution_id, id) on delete cascade,
  foreign key (institution_id, student_id) references public.students (institution_id, id) on delete cascade
);

create table public.report_finals (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions (id) on delete cascade,
  term_id uuid not null,
  student_id uuid not null,
  snapshot jsonb not null,
  marked_by uuid references auth.users (id) on delete set null,
  marked_at timestamptz not null default now(),
  unique (institution_id, term_id, student_id),
  foreign key (institution_id, term_id) references public.terms (institution_id, id) on delete cascade,
  foreign key (institution_id, student_id) references public.students (institution_id, id) on delete cascade
);

alter table public.grade_bands enable row level security;
alter table public.class_teachers enable row level security;
alter table public.report_remarks enable row level security;
alter table public.report_finals enable row level security;

-- ---------------------------------------------------------------------------
-- Role helpers
-- ---------------------------------------------------------------------------
create or replace function public.is_headmaster(p_institution_id uuid)
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
      and m.is_headmaster
      and m.role in ('staff', 'school_admin')
      and i.status = 'active'
  );
$$;

create or replace function public.can_write_remark(p_institution_id uuid, p_kind text, p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_kind = 'class_teacher' then exists (
      select 1
      from public.students s
      join public.class_teachers ct on ct.institution_id = s.institution_id and ct.class_id = s.class_id
      where s.id = p_student_id
        and s.institution_id = p_institution_id
        and ct.user_id = (select auth.uid())
        and public.has_role(p_institution_id, array['staff'])
    )
    when p_kind = 'headmaster' then
      public.has_role(p_institution_id, array['owner']) or public.is_headmaster(p_institution_id)
    else false
  end;
$$;

-- ---------------------------------------------------------------------------
-- Guards
-- ---------------------------------------------------------------------------
create or replace function public.report_remarks_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.report_finals f
    where f.institution_id = new.institution_id and f.term_id = new.term_id and f.student_id = new.student_id
  ) then
    raise exception 'This report card is final. Unlock it before changing remarks.' using errcode = '23514';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger report_remarks_guard_change
  before insert or update on public.report_remarks
  for each row execute function public.report_remarks_guard();

create or replace function public.class_teachers_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.memberships m
    where m.user_id = new.user_id and m.institution_id = new.institution_id and m.role = 'staff'
  ) then
    raise exception 'A class teacher must be a staff member of this school.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger class_teachers_guard_change
  before insert or update on public.class_teachers
  for each row execute function public.class_teachers_guard();

-- ---------------------------------------------------------------------------
-- Owner actions (security definer; each checks the caller is the owner)
-- ---------------------------------------------------------------------------
create or replace function public.set_grade_scale(p_institution_id uuid, p_bands jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
  v_min_of_all numeric;
begin
  if not public.has_role(p_institution_id, array['owner']) then
    raise exception 'Only the school owner can set the grade scale.' using errcode = '42501';
  end if;
  if exists (select 1 from public.report_finals f where f.institution_id = p_institution_id) then
    raise exception 'Report cards are already final. Unlock them before changing the grade scale.' using errcode = '23514';
  end if;
  if jsonb_typeof(p_bands) <> 'array' or jsonb_array_length(p_bands) = 0 then
    raise exception 'Add at least one grade band.' using errcode = '23514';
  end if;

  create temporary table if not exists _incoming_bands (letter text, min_score numeric, label text) on commit drop;
  delete from _incoming_bands;
  insert into _incoming_bands (letter, min_score, label)
  select trim(b->>'letter'), (b->>'minScore')::numeric, trim(b->>'label')
  from jsonb_array_elements(p_bands) as b;

  if exists (select 1 from _incoming_bands where letter is null or letter = '' or char_length(letter) > 3
             or label is null or label = '' or char_length(label) > 40
             or min_score is null or min_score < 0 or min_score > 100) then
    raise exception 'Each band needs a letter (up to 3 characters), a label, and a minimum score from 0 to 100.' using errcode = '23514';
  end if;
  if (select count(distinct letter) from _incoming_bands) <> (select count(*) from _incoming_bands) then
    raise exception 'Each grade letter can be used only once.' using errcode = '23514';
  end if;
  if (select count(distinct min_score) from _incoming_bands) <> (select count(*) from _incoming_bands) then
    raise exception 'Two bands cannot start at the same score.' using errcode = '23514';
  end if;
  select min(min_score) into v_min_of_all from _incoming_bands;
  if v_min_of_all <> 0 then
    raise exception 'The lowest band must start at 0.' using errcode = '23514';
  end if;

  delete from public.grade_bands where institution_id = p_institution_id;
  insert into public.grade_bands (institution_id, letter, min_score, label)
  select p_institution_id, letter, min_score, label from _incoming_bands;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.set_class_teacher(p_class_id uuid, p_user_id uuid)
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
  if p_user_id is null then
    delete from public.class_teachers where institution_id = v_institution and class_id = p_class_id;
  else
    insert into public.class_teachers (institution_id, class_id, user_id)
    values (v_institution, p_class_id, p_user_id)
    on conflict (institution_id, class_id) do update set user_id = excluded.user_id;
  end if;
end;
$$;

create or replace function public.set_headmaster_tag(p_membership_id uuid, p_value boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_institution uuid;
begin
  select institution_id into v_institution from public.memberships where id = p_membership_id;
  if v_institution is null then
    raise exception 'That team member could not be found.' using errcode = 'P0002';
  end if;
  if not public.has_role(v_institution, array['owner']) then
    raise exception 'Only the school owner can tag the headmaster.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.memberships where id = p_membership_id and role in ('staff', 'school_admin')) then
    raise exception 'Only a teacher or an Encyclopedia member can be tagged as headmaster.' using errcode = '23514';
  end if;
  update public.memberships set is_headmaster = p_value where id = p_membership_id;
end;
$$;

-- Staff list for the owner's class teacher and headmaster pickers. Names and emails come from
-- the auth and profile tables, which members cannot read directly.
create or replace function public.list_school_staff(p_institution_id uuid)
returns table (membership_id uuid, user_id uuid, full_name text, email text, role text, is_headmaster boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_role(p_institution_id, array['owner']) then
    raise exception 'Only the school owner can see the staff list.' using errcode = '42501';
  end if;
  return query
    select m.id, m.user_id, coalesce(p.full_name, ''), coalesce(u.email::text, ''), m.role, m.is_headmaster
    from public.memberships m
    left join public.profiles p on p.id = m.user_id
    left join auth.users u on u.id = m.user_id
    where m.institution_id = p_institution_id
      and m.role in ('staff', 'school_admin')
    order by coalesce(p.full_name, ''), m.created_at;
end;
$$;

revoke all on function public.list_school_staff(uuid) from public;
grant execute on function public.list_school_staff(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Calculations
-- ---------------------------------------------------------------------------

-- Students in a class who are missing a final grade for a subject taught in the term.
-- A subject counts as taught when an assessment exists for the class in that term.
create or replace function public.report_missing_grades(p_class_id uuid, p_term_id uuid)
returns table (student_id uuid, student_name text, subject_name text)
language sql
stable
security invoker
set search_path = ''
as $$
  select st.id, st.full_name, sub.name
  from public.students st
  join public.classes c on c.id = st.class_id and c.institution_id = st.institution_id
  join (
    select distinct a.subject_id, a.institution_id
    from public.assessments a
    where a.class_id = p_class_id and a.term_id = p_term_id
  ) taught on taught.institution_id = st.institution_id
  join public.subjects sub on sub.id = taught.subject_id and sub.institution_id = st.institution_id
  left join public.results r
    on r.student_id = st.id and r.subject_id = taught.subject_id and r.term_id = p_term_id
  where st.class_id = p_class_id
    and r.final_grade is null
  order by st.full_name, sub.name;
$$;

-- The full report card for one student in one term, as JSON.
-- Positions use standard ranking: tied students share a position.
create or replace function public.report_card_snapshot(p_term_id uuid, p_student_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_student record;
  v_term record;
  v_subjects jsonb;
  v_average numeric;
  v_position integer;
  v_class_size integer;
  v_class_teacher_remark text;
  v_headmaster_remark text;
  v_next_term jsonb;
  v_school text;
begin
  select s.id, s.institution_id, s.class_id, s.full_name, s.admission_number, c.name as class_name
    into v_student
  from public.students s
  join public.classes c on c.id = s.class_id and c.institution_id = s.institution_id
  where s.id = p_student_id;
  if not found then
    raise exception 'That student could not be found.' using errcode = 'P0002';
  end if;

  select t.id, t.name, t.ends_on into v_term
  from public.terms t
  where t.id = p_term_id and t.institution_id = v_student.institution_id;
  if not found then
    raise exception 'That term could not be found.' using errcode = 'P0002';
  end if;

  select name into v_school from public.institutions where id = v_student.institution_id;

  with class_results as (
    select r.student_id, r.subject_id, r.final_grade
    from public.results r
    join public.students st on st.id = r.student_id
    where r.term_id = p_term_id
      and r.final_grade is not null
      and st.class_id = v_student.class_id
  ),
  subject_ranks as (
    select cr.student_id, cr.subject_id, cr.final_grade,
           rank() over (partition by cr.subject_id order by cr.final_grade desc) as subject_position,
           count(*) over (partition by cr.subject_id) as subject_out_of
    from class_results cr
  ),
  overall as (
    select cr.student_id, avg(cr.final_grade) as average_grade
    from class_results cr
    group by cr.student_id
  ),
  overall_ranks as (
    select o.student_id, o.average_grade,
           rank() over (order by o.average_grade desc) as class_position,
           count(*) over () as class_size
    from overall o
  )
  select
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'subject', sub.name,
          'grade', round(sr.final_grade, 1),
          'letter', (
            select gb.letter from public.grade_bands gb
            where gb.institution_id = v_student.institution_id and gb.min_score <= sr.final_grade
            order by gb.min_score desc limit 1
          ),
          'remark', (
            select gb.label from public.grade_bands gb
            where gb.institution_id = v_student.institution_id and gb.min_score <= sr.final_grade
            order by gb.min_score desc limit 1
          ),
          'subjectPosition', sr.subject_position,
          'subjectOutOf', sr.subject_out_of
        )
        order by sub.name
      )
      from subject_ranks sr
      join public.subjects sub on sub.id = sr.subject_id
      where sr.student_id = p_student_id
    ), '[]'::jsonb),
    (select round(o.average_grade, 1) from overall o where o.student_id = p_student_id),
    (select orr.class_position from overall_ranks orr where orr.student_id = p_student_id),
    (select max(orr.class_size) from overall_ranks orr)
  into v_subjects, v_average, v_position, v_class_size;

  select rm.body into v_class_teacher_remark from public.report_remarks rm
  where rm.student_id = p_student_id and rm.term_id = p_term_id and rm.kind = 'class_teacher';
  select rm.body into v_headmaster_remark from public.report_remarks rm
  where rm.student_id = p_student_id and rm.term_id = p_term_id and rm.kind = 'headmaster';

  select jsonb_build_object('name', t.name, 'startsOn', t.starts_on) into v_next_term
  from public.terms t
  where t.institution_id = v_student.institution_id and t.starts_on > v_term.ends_on
  order by t.starts_on limit 1;

  return jsonb_build_object(
    'school', v_school,
    'term', v_term.name,
    'className', v_student.class_name,
    'studentName', v_student.full_name,
    'admissionNumber', v_student.admission_number,
    'subjects', v_subjects,
    'average', v_average,
    'position', v_position,
    'classSize', coalesce(v_class_size, 0),
    'classTeacherRemark', v_class_teacher_remark,
    'headmasterRemark', v_headmaster_remark,
    'nextTerm', v_next_term
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants and row-level security
-- ---------------------------------------------------------------------------
revoke all on function public.set_grade_scale(uuid, jsonb) from public;
revoke all on function public.set_class_teacher(uuid, uuid) from public;
revoke all on function public.set_headmaster_tag(uuid, boolean) from public;
revoke all on function public.report_missing_grades(uuid, uuid) from public;
revoke all on function public.report_card_snapshot(uuid, uuid) from public;
revoke all on function public.can_write_remark(uuid, text, uuid) from public;
revoke all on function public.is_headmaster(uuid) from public;
grant execute on function public.set_grade_scale(uuid, jsonb) to authenticated;
grant execute on function public.set_class_teacher(uuid, uuid) to authenticated;
grant execute on function public.set_headmaster_tag(uuid, boolean) to authenticated;
grant execute on function public.report_missing_grades(uuid, uuid) to authenticated;
grant execute on function public.report_card_snapshot(uuid, uuid) to authenticated;
grant execute on function public.can_write_remark(uuid, text, uuid) to authenticated;
grant execute on function public.is_headmaster(uuid) to authenticated;

grant select on public.grade_bands to authenticated;
grant select on public.class_teachers to authenticated;
grant select, insert, update on public.report_remarks to authenticated;
grant select, insert, delete on public.report_finals to authenticated;

create policy grade_bands_select on public.grade_bands
  for select to authenticated
  using (public.can_view_institution(institution_id, array['owner', 'school_admin']));

create policy class_teachers_select on public.class_teachers
  for select to authenticated
  using (
    public.can_view_institution(institution_id, array['owner', 'school_admin'])
    or user_id = (select auth.uid())
  );

create policy report_remarks_select on public.report_remarks
  for select to authenticated
  using (
    public.can_view_institution(institution_id, array['owner', 'school_admin'])
    or public.can_write_remark(institution_id, kind, student_id)
  );

create policy report_remarks_insert on public.report_remarks
  for insert to authenticated
  with check (
    written_by = (select auth.uid())
    and public.can_write_remark(institution_id, kind, student_id)
  );

create policy report_remarks_update on public.report_remarks
  for update to authenticated
  using (public.can_write_remark(institution_id, kind, student_id))
  with check (
    written_by = (select auth.uid())
    and public.can_write_remark(institution_id, kind, student_id)
  );

create policy report_finals_select on public.report_finals
  for select to authenticated
  using (public.can_view_institution(institution_id, array['owner', 'school_admin']));

create policy report_finals_insert_owner on public.report_finals
  for insert to authenticated
  with check (public.has_role(institution_id, array['owner']) and marked_by = (select auth.uid()));

create policy report_finals_delete_owner on public.report_finals
  for delete to authenticated
  using (public.has_role(institution_id, array['owner']));

-- ---------------------------------------------------------------------------
-- Audit trail
-- ---------------------------------------------------------------------------
create trigger audit_grade_bands after insert or update or delete on public.grade_bands
  for each row execute function public.audit_row_change();
create trigger audit_class_teachers after insert or update or delete on public.class_teachers
  for each row execute function public.audit_row_change();
create trigger audit_report_finals after insert or update or delete on public.report_finals
  for each row execute function public.audit_row_change();
