-- Campus Veritas operates in Ghana only. Existing schools move to Africa/Accra,
-- and the column rejects any other zone so the app and database stay in agreement.

update public.institutions
set timezone = 'Africa/Accra'
where timezone <> 'Africa/Accra';

alter table public.institutions
  drop constraint if exists institutions_timezone_ghana;

alter table public.institutions
  add constraint institutions_timezone_ghana check (timezone = 'Africa/Accra');
