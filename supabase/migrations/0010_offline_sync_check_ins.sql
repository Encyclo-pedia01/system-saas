-- Offline sync, first slice: check-ins recorded on a device without internet.
-- The real time of the check-in is kept (device_time). Each entry carries a client_id so
-- re-sending after a dropped connection never creates a duplicate. Conflicts go to the owner.

alter table public.check_ins
  add column if not exists client_id uuid,
  add column if not exists recorded_offline boolean not null default false,
  add column if not exists synced_at timestamptz not null default now();

create unique index if not exists check_ins_client_id_key
  on public.check_ins (institution_id, client_id)
  where client_id is not null;

create table if not exists public.sync_conflicts (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions (id) on delete cascade,
  entity text not null check (entity in ('check_in')),
  client_id uuid not null,
  payload jsonb not null,
  reason text not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users (id) on delete set null,
  resolution text check (resolution in ('kept_existing', 'replaced_with_offline', 'dismissed'))
);

alter table public.sync_conflicts enable row level security;
alter table public.sync_conflicts force row level security;

grant select, update on public.sync_conflicts to authenticated;

create policy sync_conflicts_select_owner on public.sync_conflicts
  for select to authenticated
  using (public.has_role(institution_id, array['owner']));

create policy sync_conflicts_resolve_owner on public.sync_conflicts
  for update to authenticated
  using (public.has_role(institution_id, array['owner']))
  with check (public.has_role(institution_id, array['owner']));

-- Records an offline check-in. Idempotent on client_id. Late status is worked out
-- from the device time, in the school's local time zone.
create or replace function public.sync_check_in(
  p_client_id uuid,
  p_student_id uuid,
  p_device_time timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_institution public.institutions%rowtype;
  v_institution_id uuid;
  v_local_time timestamp;
  v_local_date date;
  v_status text;
  v_existing public.check_ins%rowtype;
  v_row public.check_ins%rowtype;
begin
  if p_client_id is null or p_device_time is null then
    raise exception 'client_id and device_time are required' using errcode = '22023';
  end if;

  select s.institution_id into v_institution_id
  from public.students s
  where s.id = p_student_id;

  if v_institution_id is null then
    raise exception 'student not found' using errcode = 'P0002';
  end if;

  if not public.has_role(v_institution_id, array['authority']) then
    raise exception 'only authority staff can record check-ins' using errcode = '42501';
  end if;

  -- Already synced: return the stored result so a retry is harmless.
  select * into v_existing
  from public.check_ins c
  where c.institution_id = v_institution_id and c.client_id = p_client_id;

  if found then
    return jsonb_build_object('result', 'synced', 'check_in_id', v_existing.id, 'status', v_existing.status);
  end if;

  select * into v_institution from public.institutions i where i.id = v_institution_id;

  -- Reject times that cannot be real: far in the future or more than 36 hours old.
  if p_device_time > now() + interval '5 minutes' or p_device_time < now() - interval '36 hours' then
    raise exception 'the device time is outside the allowed window; check the device clock'
      using errcode = '22007';
  end if;

  v_local_time := p_device_time at time zone v_institution.timezone;
  v_local_date := v_local_time::date;

  v_status := case
    when v_local_time::time <= v_institution.school_start_time
                              + make_interval(mins => v_institution.grace_period_minutes)
      then 'on-time'
    else 'late'
  end;

  begin
    insert into public.check_ins (
      institution_id, student_id, school_date, time_in, status,
      recorded_by, client_id, recorded_offline, synced_at
    )
    values (
      v_institution_id, p_student_id, v_local_date, p_device_time, v_status,
      (select auth.uid()), p_client_id, true, now()
    )
    returning * into v_row;
  exception
    when unique_violation then
      -- Already checked in for that day by another route. Keep the existing record and log the conflict.
      select * into v_existing
      from public.check_ins c
      where c.student_id = p_student_id and c.school_date = v_local_date;

      insert into public.sync_conflicts (institution_id, entity, client_id, payload, reason)
      values (
        v_institution_id,
        'check_in',
        p_client_id,
        jsonb_build_object(
          'student_id', p_student_id,
          'school_date', v_local_date,
          'device_time', p_device_time,
          'device_status', v_status,
          'existing_check_in_id', v_existing.id,
          'existing_status', v_existing.status
        ),
        'Student already had an attendance record for this day.'
      );

      return jsonb_build_object('result', 'conflict', 'existing_check_in_id', v_existing.id);
  end;

  return jsonb_build_object('result', 'recorded', 'check_in_id', v_row.id, 'status', v_row.status);
end;
$$;

revoke all on function public.sync_check_in(uuid, uuid, timestamptz) from public;
grant execute on function public.sync_check_in(uuid, uuid, timestamptz) to authenticated;
