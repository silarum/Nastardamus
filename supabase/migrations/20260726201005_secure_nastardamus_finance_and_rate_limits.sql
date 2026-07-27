-- Lock privileged Nastardamus RPCs behind service_role and make financial
-- writes replay-safe. The public Data API must never be able to invoke these
-- SECURITY DEFINER functions directly.

revoke execute on function public.nastardamus_request_withdrawal(
  bigint, bigint, numeric, bigint, text
) from public, anon, authenticated;
grant execute on function public.nastardamus_request_withdrawal(
  bigint, bigint, numeric, bigint, text
) to service_role;

alter function public.nastardamus_request_withdrawal(
  bigint, bigint, numeric, bigint, text
) set search_path = '';

alter table public.nastardamus_withdrawal_requests
  add column if not exists idempotency_key text;

create unique index if not exists nastardamus_withdrawals_user_idempotency_idx
  on public.nastardamus_withdrawal_requests (telegram_id, idempotency_key)
  where idempotency_key is not null;

create or replace function public.nastardamus_request_withdrawal(
  p_telegram_id bigint,
  p_amount_units bigint,
  p_fee_percent numeric,
  p_minimum_units bigint,
  p_destination text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_wallet public.nastardamus_wallets%rowtype;
  v_existing public.nastardamus_withdrawal_requests%rowtype;
  v_fee_units bigint;
  v_net_units bigint;
  v_request_id uuid;
begin
  if p_telegram_id is null or p_telegram_id <= 0 then
    raise exception 'invalid_telegram_id';
  end if;
  if p_amount_units is null or p_amount_units <= 0 then
    raise exception 'invalid_amount';
  end if;
  if p_minimum_units is null or p_minimum_units < 0 or p_amount_units < p_minimum_units then
    raise exception 'below_minimum';
  end if;
  if p_fee_percent is null or p_fee_percent < 0 or p_fee_percent > 100 then
    raise exception 'invalid_fee';
  end if;
  if length(trim(coalesce(p_destination, ''))) < 6 or length(trim(p_destination)) > 200 then
    raise exception 'invalid_destination';
  end if;
  if p_idempotency_key is null
    or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$'
  then
    raise exception 'invalid_idempotency_key';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_telegram_id::text || ':' || p_idempotency_key,
      0
    )
  );

  select *
  into v_existing
  from public.nastardamus_withdrawal_requests
  where telegram_id = p_telegram_id
    and idempotency_key = p_idempotency_key
  limit 1;

  if found then
    return jsonb_build_object(
      'id', v_existing.id,
      'gross_units', v_existing.gross_units,
      'fee_units', v_existing.fee_units,
      'net_units', v_existing.net_units,
      'status', v_existing.status,
      'idempotent_replay', true
    );
  end if;

  insert into public.nastardamus_wallets (telegram_id)
  values (p_telegram_id)
  on conflict (telegram_id) do nothing;

  select *
  into v_wallet
  from public.nastardamus_wallets
  where telegram_id = p_telegram_id
  for update;

  if (v_wallet.balance_units - v_wallet.locked_units) < p_amount_units then
    raise exception 'insufficient_funds';
  end if;

  v_fee_units := ceil(p_amount_units::numeric * p_fee_percent / 100)::bigint;
  v_net_units := p_amount_units - v_fee_units;
  if v_net_units <= 0 then
    raise exception 'net_amount_too_small';
  end if;

  update public.nastardamus_wallets
  set locked_units = locked_units + p_amount_units,
      updated_at = now()
  where telegram_id = p_telegram_id
  returning * into v_wallet;

  insert into public.nastardamus_withdrawal_requests (
    telegram_id,
    gross_units,
    fee_units,
    net_units,
    destination,
    idempotency_key
  ) values (
    p_telegram_id,
    p_amount_units,
    v_fee_units,
    v_net_units,
    trim(p_destination),
    p_idempotency_key
  )
  returning id into v_request_id;

  insert into public.nastardamus_wallet_ledger (
    telegram_id,
    entry_type,
    amount_units,
    balance_after_units,
    locked_after_units,
    idempotency_key,
    reference_type,
    reference_id,
    metadata
  ) values (
    p_telegram_id,
    'withdrawal_hold',
    0,
    v_wallet.balance_units,
    v_wallet.locked_units,
    'withdrawal:' || p_telegram_id::text || ':' || p_idempotency_key,
    'withdrawal',
    v_request_id::text,
    jsonb_build_object(
      'gross_units', p_amount_units,
      'fee_units', v_fee_units,
      'net_units', v_net_units
    )
  );

  return jsonb_build_object(
    'id', v_request_id,
    'gross_units', p_amount_units,
    'fee_units', v_fee_units,
    'net_units', v_net_units,
    'status', 'pending',
    'balance_units', v_wallet.balance_units,
    'locked_units', v_wallet.locked_units,
    'idempotent_replay', false
  );
end;
$function$;

revoke execute on function public.nastardamus_request_withdrawal(
  bigint, bigint, numeric, bigint, text, text
) from public, anon, authenticated;
grant execute on function public.nastardamus_request_withdrawal(
  bigint, bigint, numeric, bigint, text, text
) to service_role;

create table if not exists public.nastardamus_request_limits (
  telegram_id bigint not null,
  scope text not null,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (telegram_id, scope),
  check (scope ~ '^[a-z0-9:_-]{1,80}$')
);

alter table public.nastardamus_request_limits enable row level security;
revoke all on table public.nastardamus_request_limits from public, anon, authenticated;
grant select, insert, update, delete on table public.nastardamus_request_limits to service_role;

create or replace function public.nastardamus_take_rate_limit(
  p_telegram_id bigint,
  p_scope text,
  p_limit integer,
  p_window_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_row public.nastardamus_request_limits%rowtype;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if p_telegram_id is null or p_telegram_id <= 0 then
    raise exception 'invalid_telegram_id';
  end if;
  if p_scope is null or p_scope !~ '^[a-z0-9:_-]{1,80}$' then
    raise exception 'invalid_scope';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 10000 then
    raise exception 'invalid_limit';
  end if;
  if p_window_seconds is null or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'invalid_window';
  end if;

  insert into public.nastardamus_request_limits (
    telegram_id, scope, window_started_at, request_count, updated_at
  )
  values (p_telegram_id, p_scope, v_now, 1, v_now)
  on conflict (telegram_id, scope) do update
  set
    window_started_at = case
      when public.nastardamus_request_limits.window_started_at
        <= v_now - pg_catalog.make_interval(secs => p_window_seconds)
      then v_now
      else public.nastardamus_request_limits.window_started_at
    end,
    request_count = case
      when public.nastardamus_request_limits.window_started_at
        <= v_now - pg_catalog.make_interval(secs => p_window_seconds)
      then 1
      else public.nastardamus_request_limits.request_count + 1
    end,
    updated_at = v_now
  returning * into v_row;

  return jsonb_build_object(
    'allowed', v_row.request_count <= p_limit,
    'limit', p_limit,
    'remaining', greatest(0, p_limit - v_row.request_count),
    'retry_after_seconds', greatest(
      0,
      ceil(extract(epoch from (
        v_row.window_started_at
          + pg_catalog.make_interval(secs => p_window_seconds)
          - v_now
      )))::integer
    )
  );
end;
$function$;

revoke execute on function public.nastardamus_take_rate_limit(
  bigint, text, integer, integer
) from public, anon, authenticated;
grant execute on function public.nastardamus_take_rate_limit(
  bigint, text, integer, integer
) to service_role;

create table if not exists public.nastardamus_telegram_updates (
  bot_scope text not null,
  update_id bigint not null,
  processed_at timestamptz not null default now(),
  primary key (bot_scope, update_id),
  check (bot_scope ~ '^[a-z0-9_-]{1,40}$')
);

alter table public.nastardamus_telegram_updates enable row level security;
revoke all on table public.nastardamus_telegram_updates from public, anon, authenticated;
grant select, insert, delete on table public.nastardamus_telegram_updates to service_role;

create or replace function public.nastardamus_claim_telegram_update(
  p_bot_scope text,
  p_update_id bigint
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_inserted boolean;
begin
  if p_bot_scope is null or p_bot_scope !~ '^[a-z0-9_-]{1,40}$' then
    raise exception 'invalid_bot_scope';
  end if;
  if p_update_id is null or p_update_id < 0 then
    raise exception 'invalid_update_id';
  end if;

  insert into public.nastardamus_telegram_updates (bot_scope, update_id)
  values (p_bot_scope, p_update_id)
  on conflict do nothing;
  v_inserted := found;

  delete from public.nastardamus_telegram_updates
  where processed_at < now() - interval '14 days';

  return v_inserted;
end;
$function$;

revoke execute on function public.nastardamus_claim_telegram_update(
  text, bigint
) from public, anon, authenticated;
grant execute on function public.nastardamus_claim_telegram_update(
  text, bigint
) to service_role;

create index if not exists nastardamus_ai_agents_provider_id_idx
  on public.nastardamus_ai_agents (provider_id);

create index if not exists nastardamus_ai_agents_fallback_provider_id_idx
  on public.nastardamus_ai_agents (fallback_provider_id);

create index if not exists nastardamus_support_tickets_assigned_admin_id_idx
  on public.nastardamus_support_tickets (assigned_admin_id);
