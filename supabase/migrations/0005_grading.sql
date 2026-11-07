-- Grading engine.
-- Owners set weights in grading_keys. compute_final_grade is the only code path that
-- writes results.final_grade. Teachers and other clients cannot change it directly.

-- ---------------------------------------------------------------------------
-- Weight validation: exactly {"assessment": n, "exam": m}, both 0-100, sum to 100.
-- ---------------------------------------------------------------------------
create or replace function public.validate_grading_weights()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_assessment numeric;
  v_exam numeric;
begin
  if jsonb_typeof(new.weights) <> 'object' then
    raise exception 'grading weights must be a JSON object'
      using errcode = 'check_violation';
  end if;

  if (
    select array_agg(k order by k)
    from jsonb_object_keys(new.weights) as k
  ) is distinct from array['assessment', 'exam'] then
    raise exception 'grading weights must contain exactly the keys assessment and exam'
      using errcode = 'check_violation';
  end if;

  if jsonb_typeof(new.weights -> 'assessment') <> 'number'
     or jsonb_typeof(new.weights -> 'exam') <> 'number' then
    raise exception 'grading weights must be numbers'
      using errcode = 'check_violation';
  end if;

  v_assessment := (new.weights ->> 'assessment')::numeric;
  v_exam := (new.weights ->> 'exam')::numeric;

  if v_assessment < 0 or v_assessment > 100 or v_exam < 0 or v_exam > 100 then
    raise exception 'each grading weight must be between 0 and 100'
      using errcode = 'check_violation';
  end if;

  if v_assessment + v_exam <> 100 then
    raise exception 'grading weights must add up to 100'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists grading_keys_validate on public.grading_keys;
create trigger grading_keys_validate
  before insert or update on public.grading_keys
  for each row execute function public.validate_grading_weights();

-- ---------------------------------------------------------------------------
-- Score must not exceed the assessment's maximum.
-- ---------------------------------------------------------------------------
create or replace function public.validate_assessment_score()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_max numeric;
begin
  select a.max_score into v_max
  from public.assessments a
  where a.id = new.assessment_id
    and a.institution_id = new.institution_id;

  if new.score > v_max then
    raise exception 'score % exceeds the assessment maximum of %', new.score, v_max
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists assessment_scores_validate on public.assessment_scores;
create trigger assessment_scores_validate
  before insert or update on public.assessment_scores
  for each row execute function public.validate_assessment_score();

-- ---------------------------------------------------------------------------
-- Protect final_grade: only compute_final_grade may set it, via a transaction flag.
-- Column privileges already block clients; this trigger guards against future grants.
-- ---------------------------------------------------------------------------
create or replace function public.guard_final_grade()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.final_grade is not distinct from old.final_grade then
    return new;
  end if;

  if coalesce(current_setting('app.grading_engine', true), '') <> 'on' then
    raise exception 'final_grade can only be set by the grading engine'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists results_guard_final_grade on public.results;
create trigger results_guard_final_grade
  before insert or update on public.results
  for each row execute function public.guard_final_grade();

revoke update (final_grade) on public.results from authenticated;
revoke insert, update, delete on public.results from authenticated;

-- ---------------------------------------------------------------------------
-- compute_final_grade: owner-only.
-- final_grade = assessment_average * assessment_weight/100 + exam_percent * exam_weight/100
-- A student needs both an assessment score and an exam score to receive a result.
-- Returns how many results were written and how many students were skipped.
-- ---------------------------------------------------------------------------
create or replace function public.compute_final_grade(p_term_id uuid, p_subject_id uuid)
returns table (computed_count integer, skipped_count integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_institution_id uuid;
  v_weights jsonb;
  v_assessment_weight numeric;
  v_exam_weight numeric;
  v_computed integer;
  v_skipped integer;
begin
  select t.institution_id into v_institution_id
  from public.terms t
  where t.id = p_term_id;

  if v_institution_id is null then
    raise exception 'term not found' using errcode = 'P0002';
  end if;

  if not public.has_role(v_institution_id, array['owner']) then
    raise exception 'only the school owner can compute grades' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.subjects s
    where s.id = p_subject_id and s.institution_id = v_institution_id
  ) then
    raise exception 'subject not found' using errcode = 'P0002';
  end if;

  select gk.weights into v_weights
  from public.grading_keys gk
  where gk.institution_id = v_institution_id;

  if v_weights is null then
    raise exception 'grading weights have not been set for this school' using errcode = 'P0001';
  end if;

  v_assessment_weight := (v_weights ->> 'assessment')::numeric;
  v_exam_weight := (v_weights ->> 'exam')::numeric;

  perform set_config('app.grading_engine', 'on', true);

  with assessment_averages as (
    select sc.student_id, avg(sc.score / a.max_score * 100) as percent
    from public.assessment_scores sc
    join public.assessments a on a.id = sc.assessment_id
    where a.institution_id = v_institution_id
      and a.term_id = p_term_id
      and a.subject_id = p_subject_id
    group by sc.student_id
  ),
  exam_percentages as (
    select e.student_id, e.score / e.max_score * 100 as percent
    from public.exam_scores e
    where e.institution_id = v_institution_id
      and e.term_id = p_term_id
      and e.subject_id = p_subject_id
  ),
  eligible as (
    select ep.student_id, aa.percent as assessment_percent, ep.percent as exam_percent
    from exam_percentages ep
    join assessment_averages aa on aa.student_id = ep.student_id
  ),
  upserted as (
    insert into public.results (institution_id, term_id, subject_id, student_id, final_grade, computed_at)
    select
      v_institution_id,
      p_term_id,
      p_subject_id,
      el.student_id,
      round((el.assessment_percent * v_assessment_weight + el.exam_percent * v_exam_weight) / 100, 2),
      now()
    from eligible el
    on conflict (term_id, subject_id, student_id) do update
      set final_grade = excluded.final_grade,
          computed_at = excluded.computed_at
    returning 1
  )
  select count(*)::integer into v_computed from upserted;

  select count(*)::integer into v_skipped
  from public.exam_scores e
  where e.institution_id = v_institution_id
    and e.term_id = p_term_id
    and e.subject_id = p_subject_id
    and not exists (
      select 1
      from public.assessment_scores sc
      join public.assessments a on a.id = sc.assessment_id
      where sc.student_id = e.student_id
        and a.term_id = p_term_id
        and a.subject_id = p_subject_id
        and a.institution_id = v_institution_id
    );

  return query select v_computed, v_skipped;
end;
$$;

revoke all on function public.compute_final_grade(uuid, uuid) from public;
grant execute on function public.compute_final_grade(uuid, uuid) to authenticated;
