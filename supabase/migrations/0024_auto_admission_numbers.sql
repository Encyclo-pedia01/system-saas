-- Automatic admission numbers, for example TOS/2026/001.
-- TOS is the school code: the first letter of each word in the school name (at least two letters, otherwise SCH).
-- Numbers run in order per school and per year. Numbers that are already in use are skipped.

alter table public.institutions
  add column if not exists admission_code text;

alter table public.institutions
  drop constraint if exists institutions_admission_code_format;

alter table public.institutions
  add constraint institutions_admission_code_format
  check (admission_code is null or admission_code ~ '^[A-Z]{2,6}$');

update public.institutions i
set admission_code = (
  select case when char_length(c.x) >= 2 then c.x else 'SCH' end
  from (
    select left(coalesce((
      select string_agg(upper(left(w, 1)), '')
      from regexp_split_to_table(regexp_replace(i.name, '[^A-Za-z ]', '', 'g'), '\s+') as w
      where w <> ''
    ), ''), 6) as x
  ) c
)
where i.admission_code is null;

create table if not exists public.admission_counters (
  institution_id uuid not null references public.institutions (id) on delete cascade,
  year integer not null,
  last_seq integer not null default 0,
  primary key (institution_id, year)
);

-- Not readable or writable by the app directly. Only the function below changes it.
alter table public.admission_counters enable row level security;
alter table public.admission_counters force row level security;

create or replace function public.allocate_admission_numbers(p_institution_id uuid, p_count integer)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
  v_year integer;
  v_last integer;
  v_seq integer;
  v_candidate text;
  v_numbers text[] := '{}';
begin
  if not public.has_role(p_institution_id, array['owner', 'school_admin']) then
    raise exception 'You do not have permission to add students.' using errcode = '42501';
  end if;
  if p_count < 1 or p_count > 500 then
    raise exception 'Choose between 1 and 500 admission numbers.' using errcode = 'check_violation';
  end if;

  select coalesce(i.admission_code, 'SCH') into v_code
  from public.institutions i
  where i.id = p_institution_id;

  v_year := extract(year from (now() at time zone 'Africa/Accra'))::integer;

  insert into public.admission_counters (institution_id, year, last_seq)
  values (p_institution_id, v_year, 0)
  on conflict do nothing;

  select c.last_seq into v_last
  from public.admission_counters c
  where c.institution_id = p_institution_id and c.year = v_year
  for update;

  v_seq := v_last;
  while cardinality(v_numbers) < p_count loop
    v_seq := v_seq + 1;
    v_candidate := v_code || '/' || v_year || '/' || lpad(v_seq::text, 3, '0');
    if not exists (
      select 1 from public.students s
      where s.institution_id = p_institution_id and lower(s.admission_number) = lower(v_candidate)
    ) then
      v_numbers := v_numbers || v_candidate;
    end if;
  end loop;

  update public.admission_counters
  set last_seq = v_seq
  where institution_id = p_institution_id and year = v_year;

  return v_numbers;
end;
$$;

revoke all on function public.allocate_admission_numbers(uuid, integer) from public;
grant execute on function public.allocate_admission_numbers(uuid, integer) to authenticated;
