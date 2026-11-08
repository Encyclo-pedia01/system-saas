-- School licence and subscription.
-- Schools created after this migration get a 30-day trial. Schools that already exist keep full
-- access (subscription_ends_on stays null) until the platform administrator sets a date.
-- Only the platform administrator can change these fields (institutions_update is super-admin only).

alter table public.institutions
  add column if not exists plan text not null default 'trial' check (plan in ('trial', 'paid')),
  add column if not exists subscription_ends_on date,
  add column if not exists licence_reference text check (licence_reference is null or char_length(licence_reference) between 1 and 80);

alter table public.institutions
  alter column subscription_ends_on set default ((now() at time zone 'Africa/Accra')::date + 30);

-- open: no end date set (existing schools)
-- active: up to and including the end date
-- grace: 7 days after the end date, writes still allowed, owner sees a renewal notice
-- expired: after the grace period, writes blocked; records can still be viewed and exported
create or replace function public.institution_access_state(p_institution_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when i.subscription_ends_on is null then 'open'
    when public.institution_local_date(i.id) <= i.subscription_ends_on then 'active'
    when public.institution_local_date(i.id) <= i.subscription_ends_on + 7 then 'grace'
    else 'expired'
  end
  from public.institutions i
  where i.id = p_institution_id
$$;

revoke all on function public.institution_access_state(uuid) from public;
grant execute on function public.institution_access_state(uuid) to authenticated;
