-- Manual SBP settlement and paid-service accounting for Nastardamus.
-- Telegram authentication is performed by the Vercel API. All database
-- objects remain service-role only and every monetary mutation is replay-safe.

create table if not exists public.nastardamus_sbp_topups (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null check (telegram_id > 0),
  silarum_units bigint not null check (silarum_units > 0),
  ruble_kopecks bigint not null check (ruble_kopecks > 0),
  payment_reference text not null unique,
  status text not null default 'pending'
    check (status in ('pending','awaiting_confirmation','paid','rejected','cancelled','expired')),
  idempotency_key text not null,
  reviewed_by bigint,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  unique (telegram_id, idempotency_key)
);

create table if not exists public.nastardamus_service_orders (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null check (telegram_id > 0),
  service_id text not null check (service_id ~ '^[a-z0-9_-]{1,64}$'),
  service_title text not null,
  price_units bigint not null check (price_units >= 0),
  payment_source text not null check (payment_source in ('wallet','entitlement')),
  status text not null default 'charged'
    check (status in ('charged','fulfilled','refunded')),
  idempotency_key text not null,
  refund_reason text,
  created_at timestamptz not null default now(),
  fulfilled_at timestamptz,
  refunded_at timestamptz,
  unique (telegram_id, idempotency_key)
);

create index if not exists nastardamus_sbp_topups_user_created_idx
  on public.nastardamus_sbp_topups (telegram_id, created_at desc);

create index if not exists nastardamus_sbp_topups_review_idx
  on public.nastardamus_sbp_topups (status, created_at)
  where status in ('pending','awaiting_confirmation');

create index if not exists nastardamus_service_orders_user_created_idx
  on public.nastardamus_service_orders (telegram_id, created_at desc);

alter table public.nastardamus_sbp_topups enable row level security;
alter table public.nastardamus_service_orders enable row level security;

revoke all on table public.nastardamus_sbp_topups from public, anon, authenticated;
revoke all on table public.nastardamus_service_orders from public, anon, authenticated;
grant select, insert, update on table public.nastardamus_sbp_topups to service_role;
grant select, insert, update on table public.nastardamus_service_orders to service_role;

create or replace function public.nastardamus_create_sbp_topup(
  p_telegram_id bigint,
  p_silarum_units bigint,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_settings jsonb;
  v_existing public.nastardamus_sbp_topups%rowtype;
  v_minimum_units bigint;
  v_maximum_units bigint;
  v_ruble_rate numeric;
  v_ruble_kopecks bigint;
  v_order_id uuid := gen_random_uuid();
  v_reference text;
begin
  if p_telegram_id is null or p_telegram_id <= 0 then
    raise exception 'invalid_telegram_id';
  end if;
  if p_silarum_units is null or p_silarum_units <= 0 then
    raise exception 'invalid_amount';
  end if;
  if p_idempotency_key is null
    or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$'
  then
    raise exception 'invalid_idempotency_key';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_telegram_id::text || ':topup:' || p_idempotency_key,
      0
    )
  );

  select *
  into v_existing
  from public.nastardamus_sbp_topups
  where telegram_id = p_telegram_id
    and idempotency_key = p_idempotency_key
  limit 1;

  if found then
    return jsonb_build_object(
      'id', v_existing.id,
      'silarum_units', v_existing.silarum_units,
      'ruble_kopecks', v_existing.ruble_kopecks,
      'payment_reference', v_existing.payment_reference,
      'status', v_existing.status,
      'expires_at', v_existing.expires_at,
      'idempotent_replay', true
    );
  end if;

  select coalesce(settings, '{}'::jsonb)
  into v_settings
  from public.nastardamus_settings
  where key = 'global';

  if coalesce((v_settings->>'paymentsEnabled')::boolean, true) is not true then
    raise exception 'payments_disabled';
  end if;
  if coalesce((v_settings->>'sbpTopupsEnabled')::boolean, false) is not true then
    raise exception 'sbp_topups_disabled';
  end if;

  v_minimum_units := greatest(
    1,
    round(coalesce((v_settings->>'sbpMinimumSilarum')::numeric, 10) * 100)::bigint
  );
  v_maximum_units := greatest(
    v_minimum_units,
    round(coalesce((v_settings->>'sbpMaximumSilarum')::numeric, 1000) * 100)::bigint
  );
  if p_silarum_units < v_minimum_units then
    raise exception 'below_topup_minimum';
  end if;
  if p_silarum_units > v_maximum_units then
    raise exception 'above_topup_maximum';
  end if;

  v_ruble_rate := coalesce((v_settings->>'sbpRoublesPerSilarum')::numeric, 0);
  if v_ruble_rate <= 0 or v_ruble_rate > 1000000 then
    raise exception 'sbp_rate_not_configured';
  end if;
  if length(trim(coalesce(v_settings->>'sbpRecipientName', ''))) < 2 then
    raise exception 'sbp_recipient_not_configured';
  end if;
  if length(trim(coalesce(v_settings->>'sbpPhone', ''))) < 5
    and length(trim(coalesce(v_settings->>'sbpPaymentUrl', ''))) < 12
  then
    raise exception 'sbp_destination_not_configured';
  end if;

  v_ruble_kopecks := round(p_silarum_units::numeric * v_ruble_rate)::bigint;
  if v_ruble_kopecks <= 0 then
    raise exception 'invalid_ruble_amount';
  end if;
  v_reference := 'NS-' || upper(substr(replace(v_order_id::text, '-', ''), 1, 10));

  insert into public.nastardamus_sbp_topups (
    id,
    telegram_id,
    silarum_units,
    ruble_kopecks,
    payment_reference,
    idempotency_key
  ) values (
    v_order_id,
    p_telegram_id,
    p_silarum_units,
    v_ruble_kopecks,
    v_reference,
    p_idempotency_key
  );

  return jsonb_build_object(
    'id', v_order_id,
    'silarum_units', p_silarum_units,
    'ruble_kopecks', v_ruble_kopecks,
    'payment_reference', v_reference,
    'status', 'pending',
    'expires_at', now() + interval '24 hours',
    'idempotent_replay', false
  );
end;
$function$;

revoke execute on function public.nastardamus_create_sbp_topup(
  bigint, bigint, text
) from public, anon, authenticated;
grant execute on function public.nastardamus_create_sbp_topup(
  bigint, bigint, text
) to service_role;

create or replace function public.nastardamus_mark_sbp_topup_sent(
  p_telegram_id bigint,
  p_order_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_order public.nastardamus_sbp_topups%rowtype;
begin
  select *
  into v_order
  from public.nastardamus_sbp_topups
  where id = p_order_id and telegram_id = p_telegram_id
  for update;

  if not found then raise exception 'topup_not_found'; end if;
  if v_order.status = 'paid' then
    return jsonb_build_object('id', v_order.id, 'status', v_order.status);
  end if;
  if v_order.status not in ('pending','awaiting_confirmation') then
    raise exception 'topup_not_pending';
  end if;
  if v_order.expires_at <= now() then
    update public.nastardamus_sbp_topups
    set status = 'expired', updated_at = now()
    where id = v_order.id;
    raise exception 'topup_expired';
  end if;

  update public.nastardamus_sbp_topups
  set status = 'awaiting_confirmation', updated_at = now()
  where id = v_order.id;

  return jsonb_build_object('id', v_order.id, 'status', 'awaiting_confirmation');
end;
$function$;

revoke execute on function public.nastardamus_mark_sbp_topup_sent(
  bigint, uuid
) from public, anon, authenticated;
grant execute on function public.nastardamus_mark_sbp_topup_sent(
  bigint, uuid
) to service_role;

create or replace function public.nastardamus_review_sbp_topup(
  p_order_id uuid,
  p_decision text,
  p_admin_id bigint,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_order public.nastardamus_sbp_topups%rowtype;
  v_wallet public.nastardamus_wallets%rowtype;
begin
  if p_decision not in ('paid','rejected') then
    raise exception 'invalid_topup_decision';
  end if;
  if p_admin_id is null or p_admin_id <= 0 then
    raise exception 'invalid_admin_id';
  end if;

  select *
  into v_order
  from public.nastardamus_sbp_topups
  where id = p_order_id
  for update;
  if not found then raise exception 'topup_not_found'; end if;

  if v_order.status = p_decision then
    return jsonb_build_object(
      'id', v_order.id,
      'status', v_order.status,
      'idempotent_replay', true
    );
  end if;
  if v_order.status not in ('pending','awaiting_confirmation') then
    raise exception 'topup_already_reviewed';
  end if;

  if p_decision = 'paid' then
    insert into public.nastardamus_wallets (telegram_id)
    values (v_order.telegram_id)
    on conflict (telegram_id) do nothing;

    select *
    into v_wallet
    from public.nastardamus_wallets
    where telegram_id = v_order.telegram_id
    for update;

    update public.nastardamus_wallets
    set balance_units = balance_units + v_order.silarum_units,
        updated_at = now()
    where telegram_id = v_order.telegram_id
    returning * into v_wallet;

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
      v_order.telegram_id,
      'purchase',
      v_order.silarum_units,
      v_wallet.balance_units,
      v_wallet.locked_units,
      'sbp-topup:' || v_order.id::text,
      'sbp_topup',
      v_order.id::text,
      jsonb_build_object(
        'ruble_kopecks', v_order.ruble_kopecks,
        'payment_reference', v_order.payment_reference,
        'reviewed_by', p_admin_id
      )
    ) on conflict (idempotency_key) do nothing;
  end if;

  update public.nastardamus_sbp_topups
  set status = p_decision,
      reviewed_by = p_admin_id,
      review_note = nullif(left(trim(coalesce(p_note, '')), 500), ''),
      paid_at = case when p_decision = 'paid' then now() else paid_at end,
      updated_at = now()
  where id = v_order.id;

  return jsonb_build_object(
    'id', v_order.id,
    'telegram_id', v_order.telegram_id,
    'status', p_decision,
    'silarum_units', v_order.silarum_units,
    'idempotent_replay', false
  );
end;
$function$;

revoke execute on function public.nastardamus_review_sbp_topup(
  uuid, text, bigint, text
) from public, anon, authenticated;
grant execute on function public.nastardamus_review_sbp_topup(
  uuid, text, bigint, text
) to service_role;

create or replace function public.nastardamus_charge_service(
  p_telegram_id bigint,
  p_service_id text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_settings jsonb;
  v_service jsonb;
  v_existing public.nastardamus_service_orders%rowtype;
  v_wallet public.nastardamus_wallets%rowtype;
  v_entitlement integer;
  v_price_units bigint;
  v_source text;
  v_order_id uuid := gen_random_uuid();
  v_title text;
begin
  if p_telegram_id is null or p_telegram_id <= 0 then
    raise exception 'invalid_telegram_id';
  end if;
  if p_service_id is null or p_service_id !~ '^[a-z0-9_-]{1,64}$' then
    raise exception 'invalid_service_id';
  end if;
  if p_idempotency_key is null
    or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$'
  then
    raise exception 'invalid_idempotency_key';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_telegram_id::text || ':service:' || p_idempotency_key,
      0
    )
  );

  select *
  into v_existing
  from public.nastardamus_service_orders
  where telegram_id = p_telegram_id
    and idempotency_key = p_idempotency_key
  limit 1;
  if found then
    return jsonb_build_object(
      'charge_id', v_existing.id,
      'service_id', v_existing.service_id,
      'price_units', v_existing.price_units,
      'payment_source', v_existing.payment_source,
      'status', v_existing.status,
      'idempotent_replay', true
    );
  end if;

  select coalesce(settings, '{}'::jsonb)
  into v_settings
  from public.nastardamus_settings
  where key = 'global';
  if coalesce((v_settings->>'paymentsEnabled')::boolean, true) is not true then
    raise exception 'payments_disabled';
  end if;

  v_service := coalesce(v_settings->'serviceCatalog'->p_service_id, '{}'::jsonb);
  if coalesce((v_service->>'enabled')::boolean, false) is not true then
    raise exception 'service_disabled';
  end if;
  v_title := left(coalesce(nullif(trim(v_service->>'title'), ''), p_service_id), 120);

  insert into public.nastardamus_wallets (telegram_id)
  values (p_telegram_id)
  on conflict (telegram_id) do nothing;

  select quantity
  into v_entitlement
  from public.nastardamus_service_entitlements
  where telegram_id = p_telegram_id and service_id = p_service_id
  for update;

  if coalesce(v_entitlement, 0) > 0 then
    update public.nastardamus_service_entitlements
    set quantity = quantity - 1, updated_at = now()
    where telegram_id = p_telegram_id and service_id = p_service_id;
    v_price_units := 0;
    v_source := 'entitlement';
  else
    if v_service->>'price' is null or (v_service->>'price')::numeric <= 0 then
      raise exception 'service_price_not_configured';
    end if;
    v_price_units := round((v_service->>'price')::numeric * 100)::bigint;
    select *
    into v_wallet
    from public.nastardamus_wallets
    where telegram_id = p_telegram_id
    for update;
    if (v_wallet.balance_units - v_wallet.locked_units) < v_price_units then
      raise exception 'insufficient_funds';
    end if;
    update public.nastardamus_wallets
    set balance_units = balance_units - v_price_units, updated_at = now()
    where telegram_id = p_telegram_id
    returning * into v_wallet;
    v_source := 'wallet';
  end if;

  insert into public.nastardamus_service_orders (
    id,
    telegram_id,
    service_id,
    service_title,
    price_units,
    payment_source,
    idempotency_key
  ) values (
    v_order_id,
    p_telegram_id,
    p_service_id,
    v_title,
    v_price_units,
    v_source,
    p_idempotency_key
  );

  select *
  into v_wallet
  from public.nastardamus_wallets
  where telegram_id = p_telegram_id;

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
    'service_charge',
    -v_price_units,
    v_wallet.balance_units,
    v_wallet.locked_units,
    'service-charge:' || v_order_id::text,
    'service_order',
    v_order_id::text,
    jsonb_build_object(
      'service_id', p_service_id,
      'service_title', v_title,
      'payment_source', v_source
    )
  );

  return jsonb_build_object(
    'charge_id', v_order_id,
    'service_id', p_service_id,
    'price_units', v_price_units,
    'payment_source', v_source,
    'status', 'charged',
    'balance_units', v_wallet.balance_units,
    'idempotent_replay', false
  );
end;
$function$;

revoke execute on function public.nastardamus_charge_service(
  bigint, text, text
) from public, anon, authenticated;
grant execute on function public.nastardamus_charge_service(
  bigint, text, text
) to service_role;

create or replace function public.nastardamus_complete_service_charge(
  p_telegram_id bigint,
  p_charge_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_order public.nastardamus_service_orders%rowtype;
begin
  select *
  into v_order
  from public.nastardamus_service_orders
  where id = p_charge_id and telegram_id = p_telegram_id
  for update;
  if not found then raise exception 'service_charge_not_found'; end if;
  if v_order.status = 'refunded' then raise exception 'service_charge_refunded'; end if;
  if v_order.status = 'fulfilled' then
    return jsonb_build_object('charge_id', v_order.id, 'status', 'fulfilled');
  end if;
  update public.nastardamus_service_orders
  set status = 'fulfilled', fulfilled_at = now()
  where id = v_order.id;
  return jsonb_build_object('charge_id', v_order.id, 'status', 'fulfilled');
end;
$function$;

revoke execute on function public.nastardamus_complete_service_charge(
  bigint, uuid
) from public, anon, authenticated;
grant execute on function public.nastardamus_complete_service_charge(
  bigint, uuid
) to service_role;

create or replace function public.nastardamus_refund_service_charge(
  p_telegram_id bigint,
  p_charge_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_order public.nastardamus_service_orders%rowtype;
  v_wallet public.nastardamus_wallets%rowtype;
begin
  select *
  into v_order
  from public.nastardamus_service_orders
  where id = p_charge_id and telegram_id = p_telegram_id
  for update;
  if not found then raise exception 'service_charge_not_found'; end if;
  if v_order.status = 'refunded' then
    return jsonb_build_object('charge_id', v_order.id, 'status', 'refunded', 'idempotent_replay', true);
  end if;
  if v_order.status = 'fulfilled' then raise exception 'service_already_fulfilled'; end if;

  if v_order.payment_source = 'entitlement' then
    insert into public.nastardamus_service_entitlements (telegram_id, service_id, quantity)
    values (p_telegram_id, v_order.service_id, 1)
    on conflict (telegram_id, service_id) do update
    set quantity = public.nastardamus_service_entitlements.quantity + 1,
        updated_at = now();
  else
    select *
    into v_wallet
    from public.nastardamus_wallets
    where telegram_id = p_telegram_id
    for update;
    update public.nastardamus_wallets
    set balance_units = balance_units + v_order.price_units, updated_at = now()
    where telegram_id = p_telegram_id
    returning * into v_wallet;

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
      'service_refund',
      v_order.price_units,
      v_wallet.balance_units,
      v_wallet.locked_units,
      'service-refund:' || v_order.id::text,
      'service_order',
      v_order.id::text,
      jsonb_build_object(
        'service_id', v_order.service_id,
        'reason', left(trim(coalesce(p_reason, 'provider_error')), 200)
      )
    ) on conflict (idempotency_key) do nothing;
  end if;

  update public.nastardamus_service_orders
  set status = 'refunded',
      refund_reason = left(trim(coalesce(p_reason, 'provider_error')), 200),
      refunded_at = now()
  where id = v_order.id;

  return jsonb_build_object(
    'charge_id', v_order.id,
    'status', 'refunded',
    'idempotent_replay', false
  );
end;
$function$;

revoke execute on function public.nastardamus_refund_service_charge(
  bigint, uuid, text
) from public, anon, authenticated;
grant execute on function public.nastardamus_refund_service_charge(
  bigint, uuid, text
) to service_role;

update public.nastardamus_settings
set settings = coalesce(settings, '{}'::jsonb) || jsonb_build_object(
  'paymentsEnabled', coalesce(settings->'paymentsEnabled', 'true'::jsonb),
  'sbpTopupsEnabled', coalesce(settings->'sbpTopupsEnabled', 'false'::jsonb),
  'sbpMinimumSilarum', coalesce(settings->'sbpMinimumSilarum', '10'::jsonb),
  'sbpMaximumSilarum', coalesce(settings->'sbpMaximumSilarum', '1000'::jsonb),
  'sbpRoublesPerSilarum', coalesce(settings->'sbpRoublesPerSilarum', '0'::jsonb),
  'sbpRecipientName', coalesce(settings->'sbpRecipientName', '""'::jsonb),
  'sbpBankName', coalesce(settings->'sbpBankName', '""'::jsonb),
  'sbpPhone', coalesce(settings->'sbpPhone', '""'::jsonb),
  'sbpPaymentUrl', coalesce(settings->'sbpPaymentUrl', '""'::jsonb),
  'sbpQrImageUrl', coalesce(settings->'sbpQrImageUrl', '""'::jsonb),
  'sbpInstructions', coalesce(
    settings->'sbpInstructions',
    '"Переведите точную сумму и укажите код заявки в сообщении к платежу. Начисление выполняется после проверки администратором."'::jsonb
  )
)
where key = 'global';
