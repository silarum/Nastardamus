-- Automatic SBP reconciliation and owner self-credit for Nastardamus.
-- Payment credentials and financial objects remain service-role only.

create table if not exists public.nastardamus_payment_providers (
  key text primary key check (key = 'sbp'),
  provider_type text not null default 'yookassa'
    check (provider_type = 'yookassa'),
  enabled boolean not null default false,
  merchant_id text not null default '',
  secret_ciphertext text,
  secret_iv text,
  secret_hint text,
  updated_by bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.nastardamus_payment_providers enable row level security;
revoke all on table public.nastardamus_payment_providers from public, anon, authenticated;
grant select, insert, update on table public.nastardamus_payment_providers to service_role;

alter table public.nastardamus_sbp_topups
  add column if not exists provider_type text,
  add column if not exists provider_payment_id text,
  add column if not exists provider_status text,
  add column if not exists confirmation_url text,
  add column if not exists verification_state text not null default 'manual'
    check (verification_state in ('manual','automatic','manual_review')),
  add column if not exists provider_checked_at timestamptz;

create unique index if not exists nastardamus_sbp_topups_provider_payment_uidx
  on public.nastardamus_sbp_topups (provider_payment_id)
  where provider_payment_id is not null;

create index if not exists nastardamus_sbp_topups_provider_pending_idx
  on public.nastardamus_sbp_topups (provider_status, provider_checked_at)
  where provider_payment_id is not null
    and status in ('pending','awaiting_confirmation');

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
  v_automatic_ready boolean;
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
      'provider_type', v_existing.provider_type,
      'provider_payment_id', v_existing.provider_payment_id,
      'provider_status', v_existing.provider_status,
      'confirmation_url', v_existing.confirmation_url,
      'verification_state', v_existing.verification_state,
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

  select exists (
    select 1
    from public.nastardamus_payment_providers
    where key = 'sbp'
      and enabled is true
      and length(trim(merchant_id)) >= 3
      and secret_ciphertext is not null
      and secret_iv is not null
  ) and coalesce((v_settings->>'sbpAutomationEnabled')::boolean, true)
  into v_automatic_ready;

  if not v_automatic_ready then
    if length(trim(coalesce(v_settings->>'sbpRecipientName', ''))) < 2 then
      raise exception 'sbp_recipient_not_configured';
    end if;
    if length(trim(coalesce(v_settings->>'sbpPhone', ''))) < 5
      and length(trim(coalesce(v_settings->>'sbpPaymentUrl', ''))) < 12
    then
      raise exception 'sbp_destination_not_configured';
    end if;
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
    idempotency_key,
    verification_state
  ) values (
    v_order_id,
    p_telegram_id,
    p_silarum_units,
    v_ruble_kopecks,
    v_reference,
    p_idempotency_key,
    case when v_automatic_ready then 'automatic' else 'manual' end
  );

  return jsonb_build_object(
    'id', v_order_id,
    'silarum_units', p_silarum_units,
    'ruble_kopecks', v_ruble_kopecks,
    'payment_reference', v_reference,
    'status', 'pending',
    'verification_state', case when v_automatic_ready then 'automatic' else 'manual' end,
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

create or replace function public.nastardamus_attach_sbp_provider_payment(
  p_telegram_id bigint,
  p_order_id uuid,
  p_provider_type text,
  p_provider_payment_id text,
  p_confirmation_url text,
  p_provider_status text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_order public.nastardamus_sbp_topups%rowtype;
begin
  if p_telegram_id is null or p_telegram_id <= 0 then
    raise exception 'invalid_telegram_id';
  end if;
  if p_provider_type <> 'yookassa' then
    raise exception 'invalid_payment_provider';
  end if;
  if p_provider_payment_id is null
    or p_provider_payment_id !~ '^[A-Za-z0-9-]{8,96}$'
  then
    raise exception 'invalid_provider_payment_id';
  end if;
  if p_confirmation_url is null
    or length(p_confirmation_url) > 1200
    or p_confirmation_url !~ '^https://'
  then
    raise exception 'invalid_confirmation_url';
  end if;

  select *
  into v_order
  from public.nastardamus_sbp_topups
  where id = p_order_id and telegram_id = p_telegram_id
  for update;
  if not found then raise exception 'topup_not_found'; end if;
  if v_order.status not in ('pending','awaiting_confirmation') then
    raise exception 'topup_not_pending';
  end if;
  if v_order.provider_payment_id is not null
    and v_order.provider_payment_id <> p_provider_payment_id
  then
    raise exception 'provider_payment_already_attached';
  end if;

  update public.nastardamus_sbp_topups
  set provider_type = p_provider_type,
      provider_payment_id = p_provider_payment_id,
      provider_status = left(coalesce(p_provider_status, 'pending'), 40),
      confirmation_url = p_confirmation_url,
      verification_state = 'automatic',
      provider_checked_at = now(),
      expires_at = least(expires_at, now() + interval '1 hour'),
      updated_at = now()
  where id = v_order.id
  returning * into v_order;

  return jsonb_build_object(
    'id', v_order.id,
    'status', v_order.status,
    'provider_type', v_order.provider_type,
    'provider_payment_id', v_order.provider_payment_id,
    'provider_status', v_order.provider_status,
    'confirmation_url', v_order.confirmation_url,
    'verification_state', v_order.verification_state
  );
end;
$function$;

revoke execute on function public.nastardamus_attach_sbp_provider_payment(
  bigint, uuid, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.nastardamus_attach_sbp_provider_payment(
  bigint, uuid, text, text, text, text
) to service_role;

create or replace function public.nastardamus_settle_sbp_provider_payment(
  p_provider_payment_id text,
  p_provider_status text,
  p_ruble_kopecks bigint,
  p_currency text,
  p_payment_method text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_order public.nastardamus_sbp_topups%rowtype;
  v_wallet public.nastardamus_wallets%rowtype;
  v_verified boolean;
begin
  if p_provider_payment_id is null
    or p_provider_payment_id !~ '^[A-Za-z0-9-]{8,96}$'
  then
    raise exception 'invalid_provider_payment_id';
  end if;

  select *
  into v_order
  from public.nastardamus_sbp_topups
  where provider_payment_id = p_provider_payment_id
  for update;
  if not found then raise exception 'topup_not_found'; end if;

  if v_order.status = 'paid' then
    return jsonb_build_object(
      'id', v_order.id,
      'status', 'paid',
      'verification_state', v_order.verification_state,
      'idempotent_replay', true
    );
  end if;

  v_verified := p_provider_status = 'succeeded'
    and p_ruble_kopecks = v_order.ruble_kopecks
    and upper(coalesce(p_currency, '')) = 'RUB'
    and lower(coalesce(p_payment_method, '')) = 'sbp';

  if p_provider_status = 'canceled' then
    update public.nastardamus_sbp_topups
    set status = 'cancelled',
        provider_status = 'canceled',
        verification_state = 'automatic',
        provider_checked_at = now(),
        updated_at = now()
    where id = v_order.id;
    return jsonb_build_object(
      'id', v_order.id,
      'status', 'cancelled',
      'verification_state', 'automatic',
      'idempotent_replay', false
    );
  end if;

  if p_provider_status <> 'succeeded' then
    update public.nastardamus_sbp_topups
    set provider_status = left(coalesce(p_provider_status, 'unknown'), 40),
        provider_checked_at = now(),
        updated_at = now()
    where id = v_order.id;
    return jsonb_build_object(
      'id', v_order.id,
      'status', v_order.status,
      'verification_state', v_order.verification_state,
      'idempotent_replay', false
    );
  end if;

  if not v_verified then
    update public.nastardamus_sbp_topups
    set status = 'awaiting_confirmation',
        provider_status = left(coalesce(p_provider_status, 'unknown'), 40),
        verification_state = 'manual_review',
        review_note = 'Автоматическая сверка обнаружила расхождение',
        provider_checked_at = now(),
        updated_at = now()
    where id = v_order.id;
    return jsonb_build_object(
      'id', v_order.id,
      'status', 'awaiting_confirmation',
      'verification_state', 'manual_review',
      'idempotent_replay', false
    );
  end if;

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
    'sbp-provider:' || v_order.provider_payment_id,
    'sbp_topup',
    v_order.id::text,
    jsonb_build_object(
      'ruble_kopecks', v_order.ruble_kopecks,
      'payment_reference', v_order.payment_reference,
      'provider_type', v_order.provider_type,
      'provider_payment_id', v_order.provider_payment_id,
      'settlement', 'automatic'
    )
  ) on conflict (idempotency_key) do nothing;

  update public.nastardamus_sbp_topups
  set status = 'paid',
      provider_status = 'succeeded',
      verification_state = 'automatic',
      paid_at = coalesce(paid_at, now()),
      provider_checked_at = now(),
      updated_at = now()
  where id = v_order.id;

  return jsonb_build_object(
    'id', v_order.id,
    'telegram_id', v_order.telegram_id,
    'status', 'paid',
    'silarum_units', v_order.silarum_units,
    'verification_state', 'automatic',
    'idempotent_replay', false
  );
end;
$function$;

revoke execute on function public.nastardamus_settle_sbp_provider_payment(
  text, text, bigint, text, text
) from public, anon, authenticated;
grant execute on function public.nastardamus_settle_sbp_provider_payment(
  text, text, bigint, text, text
) to service_role;

create or replace function public.nastardamus_credit_admin_self(
  p_admin_id bigint,
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
  if p_admin_id is null or p_admin_id <= 0 then
    raise exception 'invalid_admin_id';
  end if;
  if p_amount_units is null or p_amount_units <= 0 or p_amount_units > 100000000 then
    raise exception 'invalid_amount';
  end if;
  if p_idempotency_key is null
    or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$'
  then
    raise exception 'invalid_idempotency_key';
  end if;

  v_ledger_key := 'admin-self:' || p_admin_id::text || ':' || p_idempotency_key;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_ledger_key, 0)
  );

  select *
  into v_existing
  from public.nastardamus_wallet_ledger
  where idempotency_key = v_ledger_key
  limit 1;
  if found then
    return jsonb_build_object(
      'telegram_id', p_admin_id,
      'balance_units', v_existing.balance_after_units,
      'amount_units', v_existing.amount_units,
      'idempotent_replay', true
    );
  end if;

  insert into public.nastardamus_wallets (telegram_id)
  values (p_admin_id)
  on conflict (telegram_id) do nothing;

  select *
  into v_wallet
  from public.nastardamus_wallets
  where telegram_id = p_admin_id
  for update;

  update public.nastardamus_wallets
  set balance_units = balance_units + p_amount_units,
      updated_at = now()
  where telegram_id = p_admin_id
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
    p_admin_id,
    'adjustment',
    p_amount_units,
    v_wallet.balance_units,
    v_wallet.locked_units,
    v_ledger_key,
    'admin_self_credit',
    p_admin_id::text,
    jsonb_build_object(
      'source', 'admin_self_credit',
      'admin_id', p_admin_id,
      'note', nullif(left(trim(coalesce(p_note, '')), 300), '')
    )
  );

  return jsonb_build_object(
    'telegram_id', p_admin_id,
    'balance_units', v_wallet.balance_units,
    'amount_units', p_amount_units,
    'idempotent_replay', false
  );
end;
$function$;

revoke execute on function public.nastardamus_credit_admin_self(
  bigint, bigint, text, text
) from public, anon, authenticated;
grant execute on function public.nastardamus_credit_admin_self(
  bigint, bigint, text, text
) to service_role;

update public.nastardamus_settings
set settings = coalesce(settings, '{}'::jsonb) || jsonb_build_object(
  'sbpAutomationEnabled', coalesce(settings->'sbpAutomationEnabled', 'true'::jsonb)
)
where key = 'global';
