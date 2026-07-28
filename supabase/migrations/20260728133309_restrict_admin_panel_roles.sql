-- Keep the control-panel role model intentionally small.
-- Owner is immutable through ordinary team operations; admins and operators
-- are appointed by an authorized owner/admin and may still receive narrower
-- permissions in the existing permissions JSON.

alter table public.nastardamus_admins
  drop constraint if exists nastardamus_admins_role_check;

update public.nastardamus_admins
set
  role = 'operator',
  updated_at = now()
where role not in ('owner', 'admin', 'operator');

alter table public.nastardamus_admins
  add constraint nastardamus_admins_role_check
  check (role in ('owner', 'admin', 'operator'))
  not valid;

alter table public.nastardamus_admins
  validate constraint nastardamus_admins_role_check;
