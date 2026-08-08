create or replace function public.nastardamus_admin_adjust_wallet(
  p_admin_id bigint,
  p_telegram_id bigint,
  p_amount_units bigint,
  p_idempotency_key text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_wallet public.nastardamus_wallets%rowtype;
  v_existing public.nastardamus_wallet_ledger%rowtype;
  v_ledger_key text;
begin
  if p_admin_id is null or p_admin_id <= 0 then raise exception 'invalid_admin_id'; end if;
  if p_telegram_id is null or p_telegram_id <= 0 then raise exception 'invalid_telegram_id'; end if;
  if p_amount_units is null or p_amount_units = 0
    or p_amount_units > 100000000 or p_amount_units < -100000000 then
    raise exception 'invalid_amount';
  end if;
  if p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$' then
    raise exception 'invalid_idempotency_key';
  end if;
  v_ledger_key := 'admin-adjust:' || p_idempotency_key;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_ledger_key, 0));

  select * into v_existing
  from public.nastardamus_wallet_ledger
  where idempotency_key = v_ledger_key
  limit 1;
  if found then
    return jsonb_build_object(
      'telegram_id', v_existing.telegram_id,
      'amount_units', v_existing.amount_units,
      'balance_units', v_existing.balance_after_units,
      'idempotent_replay', true
    );
  end if;

  insert into public.nastardamus_wallets (telegram_id)
  values (p_telegram_id)
  on conflict (telegram_id) do nothing;
  select * into v_wallet
  from public.nastardamus_wallets
  where telegram_id = p_telegram_id
  for update;
  if (v_wallet.balance_units + p_amount_units) < v_wallet.locked_units then
    raise exception 'insufficient_funds';
  end if;

  update public.nastardamus_wallets
  set balance_units = balance_units + p_amount_units, updated_at = now()
  where telegram_id = p_telegram_id
  returning * into v_wallet;

  insert into public.nastardamus_wallet_ledger (
    telegram_id, entry_type, amount_units, balance_after_units, locked_after_units,
    idempotency_key, reference_type, reference_id, metadata
  ) values (
    p_telegram_id, 'adjustment', p_amount_units, v_wallet.balance_units, v_wallet.locked_units,
    v_ledger_key, 'admin_adjustment', p_admin_id::text,
    jsonb_build_object('admin_id', p_admin_id, 'note', left(coalesce(p_note, ''), 300))
  );

  return jsonb_build_object(
    'telegram_id', p_telegram_id,
    'amount_units', p_amount_units,
    'balance_units', v_wallet.balance_units,
    'idempotent_replay', false
  );
end;
$function$;

revoke all on function public.nastardamus_admin_adjust_wallet(
  bigint, bigint, bigint, text, text
) from public, anon, authenticated;
grant execute on function public.nastardamus_admin_adjust_wallet(
  bigint, bigint, bigint, text, text
) to service_role;
