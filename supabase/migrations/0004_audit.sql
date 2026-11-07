-- Append-only audit trail for key tables.
-- A single SECURITY DEFINER trigger writes before/after JSON for every row change.
-- Clients cannot write, edit, or delete audit rows.

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb;
  v_institution_id uuid;
begin
  v_row := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;

  v_institution_id := coalesce(
    (v_row ->> 'institution_id')::uuid,
    case when tg_table_name = 'institutions' then (v_row ->> 'id')::uuid end
  );

  insert into public.audit_log (
    institution_id,
    table_name,
    record_id,
    operation,
    actor_id,
    before_data,
    after_data
  )
  values (
    v_institution_id,
    tg_table_name,
    v_row ->> 'id',
    tg_op,
    (select auth.uid()),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );

  return coalesce(new, old);
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'institutions', 'profiles', 'memberships', 'invitations', 'classes', 'students',
    'subjects', 'terms', 'assessments', 'assessment_scores', 'exam_scores',
    'grading_keys', 'results', 'check_ins', 'insights', 'impersonation_sessions'
  ]
  loop
    execute format('drop trigger if exists audit_%1$s on public.%1$I', t);
    execute format(
      'create trigger audit_%1$s after insert or update or delete on public.%1$I
         for each row execute function public.audit_row_change()',
      t
    );
  end loop;
end
$$;
