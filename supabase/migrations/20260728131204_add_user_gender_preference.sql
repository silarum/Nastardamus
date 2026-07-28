alter table public.nastardamus_users
  add column if not exists gender text not null default 'unspecified';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'nastardamus_users_gender_check'
      and conrelid = 'public.nastardamus_users'::regclass
  ) then
    alter table public.nastardamus_users
      add constraint nastardamus_users_gender_check
      check (gender in ('female', 'male', 'unspecified'));
  end if;
end
$$;

comment on column public.nastardamus_users.gender is
  'User-selected grammatical form for Esoterium responses; never inferred from name or image.';

revoke all on table public.nastardamus_users from public, anon, authenticated;
grant select, insert, update on table public.nastardamus_users to service_role;
