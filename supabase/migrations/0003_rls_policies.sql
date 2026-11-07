-- Row Level Security for every public table.
-- Deny by default: RLS is enabled and forced, and privileges are granted explicitly.
-- Roles: owner (school principal), staff (teacher), authority (check-in officer),
-- and super admin (platform owner, profiles.is_super_admin).

-- Make this file safe to re-run: drop any policies left by an earlier partial run.
do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end
$$;

-- Start from zero privileges so nothing is reachable without an explicit grant below.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
-- Helper functions keep their explicit grants from 0002 and 0006.
-- Anonymous callers get no function execution at all.
revoke execute on all functions in schema public from anon;
grant usage on schema public to anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array[
    'institutions', 'profiles', 'memberships', 'invitations', 'classes', 'students',
    'subjects', 'terms', 'assessments', 'assessment_scores', 'exam_scores',
    'grading_keys', 'results', 'check_ins', 'insights', 'impersonation_sessions', 'audit_log'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- institutions
-- ---------------------------------------------------------------------------
grant select, insert, update on public.institutions to authenticated;

create policy institutions_select on public.institutions
  for select to authenticated
  using (
    public.is_super_admin()
    or public.is_member(id)
    or public.is_impersonating(id)
  );

create policy institutions_insert on public.institutions
  for insert to authenticated
  with check (public.is_super_admin());

create policy institutions_update on public.institutions
  for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ---------------------------------------------------------------------------
-- profiles: users edit their own name only. is_super_admin is never writable by clients.
-- ---------------------------------------------------------------------------
grant select on public.profiles to authenticated;
revoke update on public.profiles from authenticated;
grant update (full_name) on public.profiles to authenticated;

create policy profiles_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.is_super_admin());

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- memberships: super admin provisions; owners see their school's team.
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.memberships to authenticated;

create policy memberships_select on public.memberships
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_super_admin()
    or public.has_role(institution_id, array['owner'])
    or public.is_impersonating(institution_id)
  );

create policy memberships_write_super_admin on public.memberships
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ---------------------------------------------------------------------------
-- invitations: super admin issues owner invitations; owners can see their own.
-- ---------------------------------------------------------------------------
grant select, insert, update on public.invitations to authenticated;

create policy invitations_select on public.invitations
  for select to authenticated
  using (public.is_super_admin() or public.has_role(institution_id, array['owner']));

create policy invitations_write_super_admin on public.invitations
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ---------------------------------------------------------------------------
-- Academic setup: owners manage classes, subjects, terms, and students.
-- Staff can read; authority has no direct access to students (see list_students_for_check_in).
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.classes to authenticated;
grant select, insert, update, delete on public.subjects to authenticated;
grant select, insert, update, delete on public.terms to authenticated;
grant select, insert, update, delete on public.students to authenticated;

create policy classes_select on public.classes
  for select to authenticated
  using (public.can_view_institution(institution_id, array['owner', 'staff']));

create policy classes_write_owner on public.classes
  for all to authenticated
  using (public.has_role(institution_id, array['owner']))
  with check (public.has_role(institution_id, array['owner']));

create policy subjects_select on public.subjects
  for select to authenticated
  using (public.can_view_institution(institution_id, array['owner', 'staff']));

create policy subjects_write_owner on public.subjects
  for all to authenticated
  using (public.has_role(institution_id, array['owner']))
  with check (public.has_role(institution_id, array['owner']));

create policy terms_select on public.terms
  for select to authenticated
  using (public.can_view_institution(institution_id, array['owner', 'staff']));

create policy terms_write_owner on public.terms
  for all to authenticated
  using (public.has_role(institution_id, array['owner']))
  with check (public.has_role(institution_id, array['owner']));

create policy students_select on public.students
  for select to authenticated
  using (public.can_view_institution(institution_id, array['owner', 'staff']));

create policy students_write_owner on public.students
  for all to authenticated
  using (public.has_role(institution_id, array['owner']))
  with check (public.has_role(institution_id, array['owner']));

-- ---------------------------------------------------------------------------
-- Assessments: owners define them; staff enter scores only.
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.assessments to authenticated;
grant select, insert, update, delete on public.assessment_scores to authenticated;
grant select, insert, update, delete on public.exam_scores to authenticated;

create policy assessments_select on public.assessments
  for select to authenticated
  using (public.can_view_institution(institution_id, array['owner', 'staff']));

create policy assessments_write_owner on public.assessments
  for all to authenticated
  using (public.has_role(institution_id, array['owner']))
  with check (public.has_role(institution_id, array['owner']));

create policy assessment_scores_select on public.assessment_scores
  for select to authenticated
  using (public.can_view_institution(institution_id, array['owner', 'staff']));

create policy assessment_scores_enter on public.assessment_scores
  for insert to authenticated
  with check (public.has_role(institution_id, array['owner', 'staff']));

create policy assessment_scores_update on public.assessment_scores
  for update to authenticated
  using (public.has_role(institution_id, array['owner', 'staff']))
  with check (public.has_role(institution_id, array['owner', 'staff']));

create policy assessment_scores_delete_owner on public.assessment_scores
  for delete to authenticated
  using (public.has_role(institution_id, array['owner']));

create policy exam_scores_select on public.exam_scores
  for select to authenticated
  using (public.can_view_institution(institution_id, array['owner', 'staff']));

create policy exam_scores_enter on public.exam_scores
  for insert to authenticated
  with check (public.has_role(institution_id, array['owner', 'staff']));

create policy exam_scores_update on public.exam_scores
  for update to authenticated
  using (public.has_role(institution_id, array['owner', 'staff']))
  with check (public.has_role(institution_id, array['owner', 'staff']));

create policy exam_scores_delete_owner on public.exam_scores
  for delete to authenticated
  using (public.has_role(institution_id, array['owner']));

-- ---------------------------------------------------------------------------
-- Grading: owner sets weights; results are read-only for clients.
-- Writes to results happen only through compute_final_grade (0005).
-- ---------------------------------------------------------------------------
grant select, insert, update on public.grading_keys to authenticated;
grant select on public.results to authenticated;

create policy grading_keys_select on public.grading_keys
  for select to authenticated
  using (public.can_view_institution(institution_id, array['owner', 'staff']));

create policy grading_keys_write_owner on public.grading_keys
  for all to authenticated
  using (public.has_role(institution_id, array['owner']))
  with check (public.has_role(institution_id, array['owner']));

create policy results_select on public.results
  for select to authenticated
  using (public.can_view_institution(institution_id, array['owner', 'staff']));

-- ---------------------------------------------------------------------------
-- Check-ins: authority only. Owners can read history. Authority sees today only.
-- Writes go through record_check_in / record_absence (0006) so the server sets time.
-- ---------------------------------------------------------------------------
grant select on public.check_ins to authenticated;

create policy check_ins_select_owner on public.check_ins
  for select to authenticated
  using (public.can_view_institution(institution_id, array['owner']));

create policy check_ins_select_authority_today on public.check_ins
  for select to authenticated
  using (
    public.has_role(institution_id, array['authority'])
    and school_date = public.institution_local_date(institution_id)
  );

-- ---------------------------------------------------------------------------
-- Insights: owners and staff read; owners resolve.
-- ---------------------------------------------------------------------------
grant select on public.insights to authenticated;
grant update (status) on public.insights to authenticated;

create policy insights_select on public.insights
  for select to authenticated
  using (public.can_view_institution(institution_id, array['owner', 'staff']));

create policy insights_resolve_owner on public.insights
  for update to authenticated
  using (public.has_role(institution_id, array['owner']))
  with check (public.has_role(institution_id, array['owner']));

-- ---------------------------------------------------------------------------
-- Audit log: owners and super admin read. Nobody writes or edits directly.
-- ---------------------------------------------------------------------------
grant select on public.audit_log to authenticated;

create policy audit_log_select on public.audit_log
  for select to authenticated
  using (
    public.is_super_admin()
    or public.has_role(institution_id, array['owner'])
  );

-- ---------------------------------------------------------------------------
-- Impersonation sessions: only the acting super admin sees and manages their own.
-- ---------------------------------------------------------------------------
grant select, insert, update on public.impersonation_sessions to authenticated;

create policy impersonation_select_actor on public.impersonation_sessions
  for select to authenticated
  using (actor_id = (select auth.uid()) and public.is_super_admin());

create policy impersonation_start on public.impersonation_sessions
  for insert to authenticated
  with check (
    actor_id = (select auth.uid())
    and public.is_super_admin()
    and exists (
      select 1
      from public.memberships m
      where m.user_id = target_user_id
        and m.institution_id = impersonation_sessions.institution_id
        and m.role = 'owner'
    )
  );

create policy impersonation_end on public.impersonation_sessions
  for update to authenticated
  using (actor_id = (select auth.uid()) and public.is_super_admin())
  with check (actor_id = (select auth.uid()));
