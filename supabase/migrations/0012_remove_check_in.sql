-- Check-in is removed from the product for now (decision recorded in DECISIONS.md).
-- No data is deleted: the check_ins and sync_conflicts tables stay so existing records are kept.
-- What changes:
--   * the functions that write or read check-ins can no longer be called by the app;
--   * the rule that creates absence insights from check-ins stops running.
-- The tables stay readable by the owner through their existing row-level security policies.

drop trigger if exists check_ins_detect_absences on public.check_ins;

revoke execute on function public.record_check_in(uuid) from authenticated;
revoke execute on function public.record_absence(uuid) from authenticated;
revoke execute on function public.list_students_for_check_in(uuid) from authenticated;
revoke execute on function public.sync_check_in(uuid, uuid, timestamptz) from authenticated;

comment on table public.check_ins is 'Removed from the product (migration 0012). Kept for existing records only.';
comment on table public.sync_conflicts is 'Removed from the product (migration 0012). Kept for existing records only.';
