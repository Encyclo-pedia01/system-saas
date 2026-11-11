-- School logo for report cards. DRAFT: not applied yet (needs owner approval).

alter table public.institutions add column if not exists logo_path text
  check (logo_path is null or char_length(logo_path) <= 200);

-- Public read bucket: the logo is printed on report cards and shown in the app.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('school-logos', 'school-logos', true, 1048576, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

-- Files live under "<institution_id>/...". Only that institution's owner can write them.
create policy school_logos_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'school-logos' and public.has_role(((storage.foldername(name))[1])::uuid, array['owner']));

create policy school_logos_owner_update on storage.objects for update to authenticated
  using (bucket_id = 'school-logos' and public.has_role(((storage.foldername(name))[1])::uuid, array['owner']))
  with check (bucket_id = 'school-logos' and public.has_role(((storage.foldername(name))[1])::uuid, array['owner']));

create policy school_logos_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'school-logos' and public.has_role(((storage.foldername(name))[1])::uuid, array['owner']));

-- institutions updates are super-admin only, so the owner sets the logo path through this function.
create or replace function public.set_school_logo(p_institution_id uuid, p_path text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_role(p_institution_id, array['owner']) then
    raise exception 'You do not have permission to do that.' using errcode = '42501';
  end if;
  if p_path is not null and p_path not like p_institution_id::text || '/%' then
    raise exception 'Invalid logo path.' using errcode = '22023';
  end if;
  update public.institutions set logo_path = p_path where id = p_institution_id;
end;
$$;

revoke all on function public.set_school_logo(uuid, text) from public;
grant execute on function public.set_school_logo(uuid, text) to authenticated;
