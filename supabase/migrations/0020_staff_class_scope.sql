-- Teachers (staff) can read and write only the students, scores, and results of the classes
-- they teach. The headmaster (memberships.is_headmaster) keeps whole-school access, as the
-- report card view already assumes. Owners and the Encyclopedia (school_admin) are unchanged.

create or replace function public.can_work_in_class(p_institution_id uuid, p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.can_view_institution(p_institution_id, array['owner', 'school_admin'])
    or (
      public.has_role(p_institution_id, array['staff'])
      and (
        public.is_headmaster(p_institution_id)
        or exists (
          select 1
          from public.class_teachers ct
          where ct.institution_id = p_institution_id
            and ct.class_id = p_class_id
            and ct.user_id = (select auth.uid())
        )
      )
    );
$$;

revoke all on function public.can_work_in_class(uuid, uuid) from public;
grant execute on function public.can_work_in_class(uuid, uuid) to authenticated;

create or replace function public.can_work_on_student(p_institution_id uuid, p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.students s
    where s.id = p_student_id
      and s.institution_id = p_institution_id
      and public.can_work_in_class(s.institution_id, s.class_id)
  );
$$;

revoke all on function public.can_work_on_student(uuid, uuid) from public;
grant execute on function public.can_work_on_student(uuid, uuid) to authenticated;

-- Students
drop policy if exists students_select on public.students;
create policy students_select on public.students
  for select to authenticated
  using (public.can_work_in_class(institution_id, class_id));

-- Assessment scores
drop policy if exists assessment_scores_select on public.assessment_scores;
create policy assessment_scores_select on public.assessment_scores
  for select to authenticated
  using (
    public.can_view_institution(institution_id, array['owner', 'school_admin'])
    or public.can_work_on_student(institution_id, student_id)
  );

drop policy if exists assessment_scores_enter on public.assessment_scores;
create policy assessment_scores_enter on public.assessment_scores
  for insert to authenticated
  with check (
    public.has_role(institution_id, array['owner', 'school_admin', 'staff'])
    and public.can_work_on_student(institution_id, student_id)
  );

drop policy if exists assessment_scores_update on public.assessment_scores;
create policy assessment_scores_update on public.assessment_scores
  for update to authenticated
  using (
    public.has_role(institution_id, array['owner', 'school_admin', 'staff'])
    and public.can_work_on_student(institution_id, student_id)
  )
  with check (
    public.has_role(institution_id, array['owner', 'school_admin', 'staff'])
    and public.can_work_on_student(institution_id, student_id)
  );

-- Exam scores (carry their own class_id)
drop policy if exists exam_scores_select on public.exam_scores;
create policy exam_scores_select on public.exam_scores
  for select to authenticated
  using (
    public.can_view_institution(institution_id, array['owner', 'school_admin'])
    or public.can_work_in_class(institution_id, class_id)
  );

drop policy if exists exam_scores_enter on public.exam_scores;
create policy exam_scores_enter on public.exam_scores
  for insert to authenticated
  with check (
    public.has_role(institution_id, array['owner', 'school_admin', 'staff'])
    and public.can_work_in_class(institution_id, class_id)
  );

drop policy if exists exam_scores_update on public.exam_scores;
create policy exam_scores_update on public.exam_scores
  for update to authenticated
  using (
    public.has_role(institution_id, array['owner', 'school_admin', 'staff'])
    and public.can_work_in_class(institution_id, class_id)
  )
  with check (
    public.has_role(institution_id, array['owner', 'school_admin', 'staff'])
    and public.can_work_in_class(institution_id, class_id)
  );

-- Results (view only)
drop policy if exists results_select on public.results;
create policy results_select on public.results
  for select to authenticated
  using (
    public.can_view_institution(institution_id, array['owner', 'school_admin'])
    or public.can_work_on_student(institution_id, student_id)
  );
