-- Check-in workflow and automatic insight generation.

-- ---------------------------------------------------------------------------
-- record_check_in: authority-only. The server stamps time_in and derives the status
-- from the institution's school_start_time, grace period, and timezone.
-- ---------------------------------------------------------------------------
create or replace function public.record_check_in(p_student_id uuid)
returns public.check_ins
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_institution public.institutions%rowtype;
  v_institution_id uuid;
  v_local_now timestamp;
  v_status text;
  v_row public.check_ins;
begin
  select s.institution_id into v_institution_id
  from public.students s
  where s.id = p_student_id;

  if v_institution_id is null then
    raise exception 'student not found' using errcode = 'P0002';
  end if;

  if not public.has_role(v_institution_id, array['authority']) then
    raise exception 'only authority staff can record check-ins' using errcode = '42501';
  end if;

  select * into v_institution from public.institutions i where i.id = v_institution_id;

  v_local_now := now() at time zone v_institution.timezone;

  v_status := case
    when v_local_now::time <= v_institution.school_start_time
                              + make_interval(mins => v_institution.grace_period_minutes)
      then 'on-time'
    else 'late'
  end;

  begin
    insert into public.check_ins (institution_id, student_id, school_date, time_in, status, recorded_by)
    values (v_institution_id, p_student_id, v_local_now::date, now(), v_status, (select auth.uid()))
    returning * into v_row;
  exception
    when unique_violation then
      raise exception 'student already has an attendance record today' using errcode = '23505';
  end;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- record_absence: authority-only. Writes an 'absent' row for today.
-- ---------------------------------------------------------------------------
create or replace function public.record_absence(p_student_id uuid)
returns public.check_ins
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_institution_id uuid;
  v_timezone text;
  v_row public.check_ins;
begin
  select s.institution_id into v_institution_id
  from public.students s
  where s.id = p_student_id;

  if v_institution_id is null then
    raise exception 'student not found' using errcode = 'P0002';
  end if;

  if not public.has_role(v_institution_id, array['authority']) then
    raise exception 'only authority staff can record absences' using errcode = '42501';
  end if;

  select i.timezone into v_timezone from public.institutions i where i.id = v_institution_id;

  begin
    insert into public.check_ins (institution_id, student_id, school_date, time_in, status, recorded_by)
    values (
      v_institution_id,
      p_student_id,
      (now() at time zone v_timezone)::date,
      null,
      'absent',
      (select auth.uid())
    )
    returning * into v_row;
  exception
    when unique_violation then
      raise exception 'student already has an attendance record today' using errcode = '23505';
  end;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- list_students_for_check_in: the only way authority staff see student names.
-- Returns just what the check-in screen needs, plus today's status.
-- ---------------------------------------------------------------------------
create or replace function public.list_students_for_check_in(p_institution_id uuid)
returns table (
  student_id uuid,
  full_name text,
  class_name text,
  today_status text,
  today_time_in timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date;
begin
  if not public.has_role(p_institution_id, array['authority']) then
    raise exception 'only authority staff can view the check-in list' using errcode = '42501';
  end if;

  v_today := public.institution_local_date(p_institution_id);

  return query
  select
    s.id,
    s.full_name,
    c.name,
    ci.status,
    ci.time_in
  from public.students s
  join public.classes c on c.id = s.class_id and c.institution_id = s.institution_id
  left join public.check_ins ci
    on ci.student_id = s.id and ci.school_date = v_today
  where s.institution_id = p_institution_id
  order by c.name, s.full_name;
end;
$$;

-- ---------------------------------------------------------------------------
-- Insight: three or more consecutive absences.
-- Fires on each new 'absent' row and checks the student's three most recent records.
-- ---------------------------------------------------------------------------
create or replace function public.detect_consecutive_absences()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_absent_streak integer;
begin
  if new.status <> 'absent' then
    return new;
  end if;

  select count(*)::integer into v_absent_streak
  from (
    select ci.status
    from public.check_ins ci
    where ci.student_id = new.student_id
      and ci.school_date <= new.school_date
    order by ci.school_date desc
    limit 3
  ) recent
  where recent.status = 'absent';

  if v_absent_streak >= 3 then
    insert into public.insights (
      institution_id, student_id, kind, severity, title, body, dedupe_key
    )
    values (
      new.institution_id,
      new.student_id,
      'consecutive_absence',
      'high',
      'Three consecutive absences',
      'This student has been absent for at least three school days in a row. Follow up with the family.',
      'consecutive_absence:' || new.student_id::text || ':' || new.school_date::text
    )
    on conflict (institution_id, dedupe_key) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists check_ins_detect_absences on public.check_ins;
create trigger check_ins_detect_absences
  after insert on public.check_ins
  for each row execute function public.detect_consecutive_absences();

-- ---------------------------------------------------------------------------
-- Insight: students with no result for a subject that has assessments this term.
-- Runs when a term is closed, and can be re-run by the owner.
-- ---------------------------------------------------------------------------
create or replace function public.generate_missing_result_insights(p_term_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_institution_id uuid;
  v_created integer;
begin
  select t.institution_id into v_institution_id
  from public.terms t
  where t.id = p_term_id;

  if v_institution_id is null then
    raise exception 'term not found' using errcode = 'P0002';
  end if;

  if not public.has_role(v_institution_id, array['owner']) then
    raise exception 'only the school owner can generate insights' using errcode = '42501';
  end if;

  with inserted as (
    insert into public.insights (
      institution_id, student_id, kind, severity, title, body, dedupe_key
    )
    select distinct
      v.institution_id,
      st.id,
      'missing_result',
      'medium',
      'Missing result at term end',
      st.full_name || ' has no final grade for ' || sub.name || ' in ' || t.name || '.',
      'missing_result:' || p_term_id::text || ':' || v.subject_id::text || ':' || st.id::text
    from (
      select distinct a.institution_id, a.class_id, a.subject_id
      from public.assessments a
      where a.term_id = p_term_id
    ) v
    join public.students st
      on st.institution_id = v.institution_id and st.class_id = v.class_id
    join public.subjects sub
      on sub.institution_id = v.institution_id and sub.id = v.subject_id
    join public.terms t
      on t.institution_id = v.institution_id and t.id = p_term_id
    where not exists (
      select 1
      from public.results r
      where r.term_id = p_term_id
        and r.subject_id = v.subject_id
        and r.student_id = st.id
    )
    on conflict (institution_id, dedupe_key) do nothing
    returning 1
  )
  select count(*)::integer into v_created from inserted;

  return v_created;
end;
$$;

create or replace function public.on_term_closed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.generate_missing_result_insights(new.id);
  return new;
end;
$$;

drop trigger if exists terms_on_closed on public.terms;
create trigger terms_on_closed
  after update of is_closed on public.terms
  for each row
  when (new.is_closed and not old.is_closed)
  execute function public.on_term_closed();

revoke all on function public.record_check_in(uuid) from public;
revoke all on function public.record_absence(uuid) from public;
revoke all on function public.list_students_for_check_in(uuid) from public;
revoke all on function public.generate_missing_result_insights(uuid) from public;

grant execute on function public.record_check_in(uuid) to authenticated;
grant execute on function public.record_absence(uuid) to authenticated;
grant execute on function public.list_students_for_check_in(uuid) to authenticated;
grant execute on function public.generate_missing_result_insights(uuid) to authenticated;
