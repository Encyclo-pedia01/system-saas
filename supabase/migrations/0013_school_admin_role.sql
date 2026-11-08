-- Encyclopedia role (database identifier: school_admin), decided in DECISIONS.md items 11-13 and
-- ADMIN_ROLE_PLAN.md. An Encyclopedia can:
--   * view all staff-visible school data (students, classes, subjects, terms, assessments, scores, results, insights);
--   * add and edit students, and enter and edit scores;
--   * resolve insights;
--   * view the team and invite staff (staff role only).
-- An Encyclopedia cannot delete students or scores, manage classes/subjects/terms, compute grades,
-- see grading keys, change roles, remove members, or see the audit log.

-- 1. Allow the new role in memberships and invitations.
alter table public.memberships
  drop constraint if exists memberships_role_check;
alter table public.memberships
  add constraint memberships_role_check check (role in ('owner', 'school_admin', 'staff', 'authority'));

alter table public.invitations
  drop constraint if exists invitations_role_check;
alter table public.invitations
  add constraint invitations_role_check check (role in ('owner', 'school_admin', 'staff', 'authority'));

-- 2. Team: the Encyclopedia can see members and pending invitations.
drop policy if exists memberships_select on public.memberships;
create policy memberships_select on public.memberships
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_super_admin()
    or public.has_role(institution_id, array['owner', 'school_admin'])
    or public.is_impersonating(institution_id)
  );

drop policy if exists invitations_select on public.invitations;
create policy invitations_select on public.invitations
  for select to authenticated
  using (public.is_super_admin() or public.has_role(institution_id, array['owner', 'school_admin']));

-- The Encyclopedia may invite staff only. Owners keep their existing invite rights.
create policy invitations_insert_school_admin on public.invitations
  for insert to authenticated
  with check (
    public.has_role(institution_id, array['school_admin'])
    and role = 'staff'
    and invited_by = (select auth.uid())
  );

-- 3. Read access for the Encyclopedia (view-only tables).
drop policy if exists classes_select on public.classes;
create policy classes_select on public.classes
  for select to authenticated
  using (public.can_view_institution(institution_id, array['owner', 'school_admin', 'staff']));

drop policy if exists subjects_select on public.subjects;
create policy subjects_select on public.subjects
  for select to authenticated
  using (public.can_view_institution(institution_id, array['owner', 'school_admin', 'staff']));

drop policy if exists terms_select on public.terms;
create policy terms_select on public.terms
  for select to authenticated
  using (public.can_view_institution(institution_id, array['owner', 'school_admin', 'staff']));

drop policy if exists class_groups_select on public.class_groups;
create policy class_groups_select on public.class_groups
  for select to authenticated
  using (public.can_view_institution(institution_id, array['owner', 'school_admin', 'staff']));

drop policy if exists assessments_select on public.assessments;
create policy assessments_select on public.assessments
  for select to authenticated
  using (public.can_view_institution(institution_id, array['owner', 'school_admin', 'staff']));

-- 4. Students: the Encyclopedia can add and edit, but not delete.
drop policy if exists students_select on public.students;
create policy students_select on public.students
  for select to authenticated
  using (public.can_view_institution(institution_id, array['owner', 'school_admin', 'staff']));

drop policy if exists students_write_owner on public.students;

create policy students_insert_owner_admin on public.students
  for insert to authenticated
  with check (public.has_role(institution_id, array['owner', 'school_admin']));

create policy students_update_owner_admin on public.students
  for update to authenticated
  using (public.has_role(institution_id, array['owner', 'school_admin']))
  with check (public.has_role(institution_id, array['owner', 'school_admin']));

create policy students_delete_owner on public.students
  for delete to authenticated
  using (public.has_role(institution_id, array['owner']));

-- 5. Scores: the Encyclopedia enters and edits. Delete stays owner-only (existing policies).
drop policy if exists assessment_scores_select on public.assessment_scores;
create policy assessment_scores_select on public.assessment_scores
  for select to authenticated
  using (public.can_view_institution(institution_id, array['owner', 'school_admin', 'staff']));

drop policy if exists assessment_scores_enter on public.assessment_scores;
create policy assessment_scores_enter on public.assessment_scores
  for insert to authenticated
  with check (public.has_role(institution_id, array['owner', 'school_admin', 'staff']));

drop policy if exists assessment_scores_update on public.assessment_scores;
create policy assessment_scores_update on public.assessment_scores
  for update to authenticated
  using (public.has_role(institution_id, array['owner', 'school_admin', 'staff']))
  with check (public.has_role(institution_id, array['owner', 'school_admin', 'staff']));

drop policy if exists exam_scores_select on public.exam_scores;
create policy exam_scores_select on public.exam_scores
  for select to authenticated
  using (public.can_view_institution(institution_id, array['owner', 'school_admin', 'staff']));

drop policy if exists exam_scores_enter on public.exam_scores;
create policy exam_scores_enter on public.exam_scores
  for insert to authenticated
  with check (public.has_role(institution_id, array['owner', 'school_admin', 'staff']));

drop policy if exists exam_scores_update on public.exam_scores;
create policy exam_scores_update on public.exam_scores
  for update to authenticated
  using (public.has_role(institution_id, array['owner', 'school_admin', 'staff']))
  with check (public.has_role(institution_id, array['owner', 'school_admin', 'staff']));

-- 6. Results: view only for the Encyclopedia (written only by compute_final_grade).
drop policy if exists results_select on public.results;
create policy results_select on public.results
  for select to authenticated
  using (public.can_view_institution(institution_id, array['owner', 'school_admin', 'staff']));

-- 7. Insights: view and resolve.
drop policy if exists insights_select on public.insights;
create policy insights_select on public.insights
  for select to authenticated
  using (public.can_view_institution(institution_id, array['owner', 'school_admin', 'staff']));

drop policy if exists insights_resolve_owner on public.insights;
create policy insights_resolve_owner on public.insights
  for update to authenticated
  using (public.has_role(institution_id, array['owner', 'school_admin']))
  with check (public.has_role(institution_id, array['owner', 'school_admin']));
