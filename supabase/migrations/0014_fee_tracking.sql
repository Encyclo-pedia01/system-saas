-- Fee tracking (FEE_TRACKING_PLAN.md). Amounts are whole pesewas (GHS x 100).
-- Payments are never edited or deleted; a wrong payment is corrected by a reversal entry.
-- Owners and the Encyclopedia role (school_admin) can view balances; the Encyclopedia can record payments.
-- Owners create fee items, reverse payments, and waive charges. Staff and authority see no fee data.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.fee_items (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions (id) on delete cascade,
  term_id uuid not null,
  class_id uuid,
  name text not null check (char_length(name) between 1 and 120),
  amount_pesewas integer not null check (amount_pesewas > 0),
  due_on date,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (institution_id, id),
  foreign key (institution_id, term_id) references public.terms (institution_id, id) on delete restrict,
  foreign key (institution_id, class_id) references public.classes (institution_id, id) on delete restrict
);

create table public.fee_charges (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions (id) on delete cascade,
  fee_item_id uuid not null,
  student_id uuid not null,
  term_id uuid not null,
  amount_pesewas integer not null check (amount_pesewas > 0),
  waived_at timestamptz,
  waive_reason text check (waive_reason is null or char_length(waive_reason) between 3 and 200),
  created_at timestamptz not null default now(),
  unique (fee_item_id, student_id),
  unique (institution_id, id),
  check ((waived_at is null) = (waive_reason is null)),
  foreign key (institution_id, fee_item_id) references public.fee_items (institution_id, id) on delete cascade,
  foreign key (institution_id, student_id) references public.students (institution_id, id) on delete restrict,
  foreign key (institution_id, term_id) references public.terms (institution_id, id) on delete restrict
);

create table public.fee_payments (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions (id) on delete cascade,
  student_id uuid not null,
  term_id uuid not null,
  amount_pesewas integer not null check (amount_pesewas <> 0),
  paid_on date not null,
  method text not null check (method in ('cash', 'mobile_money', 'bank', 'other')),
  reference text check (reference is null or char_length(reference) <= 80),
  note text check (note is null or char_length(note) <= 200),
  reverses_id uuid references public.fee_payments (id) on delete restrict,
  recorded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (institution_id, id),
  check (
    (reverses_id is null and amount_pesewas > 0)
    or (reverses_id is not null and amount_pesewas < 0)
  ),
  foreign key (institution_id, student_id) references public.students (institution_id, id) on delete restrict,
  foreign key (institution_id, term_id) references public.terms (institution_id, id) on delete restrict
);

create unique index fee_payments_one_reversal on public.fee_payments (reverses_id) where reverses_id is not null;
create index fee_items_term_idx on public.fee_items (institution_id, term_id);
create index fee_charges_student_idx on public.fee_charges (institution_id, student_id, term_id);
create index fee_payments_student_idx on public.fee_payments (institution_id, student_id, term_id);

alter table public.fee_items enable row level security;
alter table public.fee_charges enable row level security;
alter table public.fee_payments enable row level security;

-- ---------------------------------------------------------------------------
-- Balances per student per term. Waived charges are not counted.
-- security_invoker: the caller's row-level security applies to the underlying tables.
-- ---------------------------------------------------------------------------
create view public.fee_balances with (security_invoker = true) as
with charged as (
  select institution_id, student_id, term_id, sum(amount_pesewas) as charged_pesewas
  from public.fee_charges
  where waived_at is null
  group by institution_id, student_id, term_id
),
paid as (
  select institution_id, student_id, term_id, sum(amount_pesewas) as paid_pesewas
  from public.fee_payments
  group by institution_id, student_id, term_id
),
keys as (
  select institution_id, student_id, term_id from public.fee_charges
  union
  select institution_id, student_id, term_id from public.fee_payments
)
select
  k.institution_id,
  k.student_id,
  k.term_id,
  coalesce(c.charged_pesewas, 0)::integer as charged_pesewas,
  coalesce(p.paid_pesewas, 0)::integer as paid_pesewas,
  (coalesce(c.charged_pesewas, 0) - coalesce(p.paid_pesewas, 0))::integer as balance_pesewas
from keys k
left join charged c using (institution_id, student_id, term_id)
left join paid p using (institution_id, student_id, term_id);

grant select on public.fee_balances to authenticated;

-- ---------------------------------------------------------------------------
-- Charges are created automatically: when a fee item is added, and when a student is enrolled
-- into a class while a fee item for a current or future term applies to that class.
-- ---------------------------------------------------------------------------
create or replace function public.fee_items_create_charges()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.fee_charges (institution_id, fee_item_id, student_id, term_id, amount_pesewas)
  select new.institution_id, new.id, s.id, new.term_id, new.amount_pesewas
  from public.students s
  where s.institution_id = new.institution_id
    and (new.class_id is null or s.class_id = new.class_id);
  return new;
end;
$$;

create trigger fee_items_after_insert_charges
  after insert on public.fee_items
  for each row execute function public.fee_items_create_charges();

create or replace function public.students_create_fee_charges()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.fee_charges (institution_id, fee_item_id, student_id, term_id, amount_pesewas)
  select fi.institution_id, fi.id, new.id, fi.term_id, fi.amount_pesewas
  from public.fee_items fi
  join public.terms t on t.id = fi.term_id and t.institution_id = fi.institution_id
  where fi.institution_id = new.institution_id
    and (fi.class_id is null or fi.class_id = new.class_id)
    and t.ends_on >= public.institution_local_date(new.institution_id)
  on conflict (fee_item_id, student_id) do nothing;
  return new;
end;
$$;

create trigger students_after_insert_fee_charges
  after insert on public.students
  for each row execute function public.students_create_fee_charges();

-- ---------------------------------------------------------------------------
-- Guards: fee items are created and removed, not edited. Removal is blocked once any
-- payment is recorded for that term. Charges have no delete grant (removing a fee item cascades
-- to its charges). A charge can only be waived, once, with a reason.
-- Payments are append-only. Rule violations use error code 23514 so the app shows the message.
-- ---------------------------------------------------------------------------
create or replace function public.fee_items_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'Fee items cannot be edited. Remove it and add it again before any payment is recorded.'
      using errcode = '23514';
  end if;
  if exists (
    select 1 from public.fee_payments p
    where p.institution_id = old.institution_id and p.term_id = old.term_id
  ) then
    raise exception 'Payments are already recorded for this term, so this fee item is locked.'
      using errcode = '23514';
  end if;
  return old;
end;
$$;

create trigger fee_items_guard_change
  before update or delete on public.fee_items
  for each row execute function public.fee_items_guard();

create or replace function public.fee_charges_guard()
returns trigger
language plpgsql
as $$
begin
  if new.amount_pesewas is distinct from old.amount_pesewas
     or new.student_id is distinct from old.student_id
     or new.fee_item_id is distinct from old.fee_item_id
     or new.term_id is distinct from old.term_id then
    raise exception 'Only a waiver can change a fee charge.' using errcode = '23514';
  end if;
  if old.waived_at is not null then
    raise exception 'This charge has already been waived.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger fee_charges_guard_change
  before update on public.fee_charges
  for each row execute function public.fee_charges_guard();

create or replace function public.fee_payments_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_original public.fee_payments;
begin
  if tg_op <> 'INSERT' then
    raise exception 'Payments cannot be edited or deleted. Record a reversal instead.' using errcode = '23514';
  end if;

  if new.reverses_id is not null then
    select * into v_original from public.fee_payments where id = new.reverses_id;
    if not found
       or v_original.institution_id <> new.institution_id
       or v_original.student_id <> new.student_id
       or v_original.term_id <> new.term_id
       or v_original.reverses_id is not null then
      raise exception 'The payment to reverse does not match this student and term.' using errcode = '23514';
    end if;
    if new.amount_pesewas <> -v_original.amount_pesewas then
      raise exception 'A reversal must equal the original payment.' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger fee_payments_guard_change
  before insert or update or delete on public.fee_payments
  for each row execute function public.fee_payments_guard();

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
grant select, insert, delete on public.fee_items to authenticated;
grant select, update on public.fee_charges to authenticated;
grant select, insert on public.fee_payments to authenticated;

create policy fee_items_select on public.fee_items
  for select to authenticated
  using (public.can_view_institution(institution_id, array['owner', 'school_admin']));

create policy fee_items_insert_owner on public.fee_items
  for insert to authenticated
  with check (public.has_role(institution_id, array['owner']) and created_by = (select auth.uid()));

create policy fee_items_delete_owner on public.fee_items
  for delete to authenticated
  using (public.has_role(institution_id, array['owner']));

create policy fee_charges_select on public.fee_charges
  for select to authenticated
  using (public.can_view_institution(institution_id, array['owner', 'school_admin']));

create policy fee_charges_waive_owner on public.fee_charges
  for update to authenticated
  using (public.has_role(institution_id, array['owner']))
  with check (public.has_role(institution_id, array['owner']));

create policy fee_payments_select on public.fee_payments
  for select to authenticated
  using (public.can_view_institution(institution_id, array['owner', 'school_admin']));

create policy fee_payments_record on public.fee_payments
  for insert to authenticated
  with check (
    reverses_id is null
    and public.has_role(institution_id, array['owner', 'school_admin'])
    and recorded_by = (select auth.uid())
  );

create policy fee_payments_reverse_owner on public.fee_payments
  for insert to authenticated
  with check (
    reverses_id is not null
    and public.has_role(institution_id, array['owner'])
    and recorded_by = (select auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Audit trail
-- ---------------------------------------------------------------------------
create trigger audit_fee_items after insert or update or delete on public.fee_items
  for each row execute function public.audit_row_change();
create trigger audit_fee_charges after insert or update or delete on public.fee_charges
  for each row execute function public.audit_row_change();
create trigger audit_fee_payments after insert or update or delete on public.fee_payments
  for each row execute function public.audit_row_change();
