create or replace function public.nastardamus_release_telegram_update(
  p_bot_scope text,
  p_update_id bigint
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_released boolean;
begin
  if p_bot_scope is null or p_bot_scope !~ '^[a-z0-9_-]{1,40}$' then
    raise exception 'invalid_bot_scope';
  end if;
  if p_update_id is null or p_update_id < 0 then
    raise exception 'invalid_update_id';
  end if;

  delete from public.nastardamus_telegram_updates
  where bot_scope = p_bot_scope and update_id = p_update_id;
  v_released := found;
  return v_released;
end;
$$;

revoke all on function public.nastardamus_release_telegram_update(text, bigint)
  from public, anon, authenticated;
grant execute on function public.nastardamus_release_telegram_update(text, bigint)
  to service_role;
