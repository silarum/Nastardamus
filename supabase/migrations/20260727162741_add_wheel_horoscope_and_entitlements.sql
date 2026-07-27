create table if not exists public.nastardamus_users (
  telegram_id bigint primary key check (telegram_id > 0),
  chat_id bigint not null check (chat_id > 0),
  username text,
  first_name text,
  timezone text not null default 'Europe/Berlin',
  zodiac_sign text check (zodiac_sign in (
    'aries','taurus','gemini','cancer','leo','virgo',
    'libra','scorpio','sagittarius','capricorn','aquarius','pisces'
  )),
  daily_horoscope_enabled boolean not null default false,
  last_horoscope_sent_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nastardamus_wheel_claims (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null check (telegram_id > 0),
  claim_date date not null default (now() at time zone 'Europe/Berlin')::date,
  sequence smallint not null check (sequence > 0),
  idempotency_key text not null,
  reward_id text not null,
  reward_title text not null,
  service_id text not null,
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now(),
  unique (telegram_id, claim_date, sequence),
  unique (telegram_id, idempotency_key)
);

create table if not exists public.nastardamus_service_entitlements (
  telegram_id bigint not null check (telegram_id > 0),
  service_id text not null,
  quantity integer not null default 0 check (quantity >= 0),
  updated_at timestamptz not null default now(),
  primary key (telegram_id, service_id)
);

create index if not exists nastardamus_users_horoscope_due_idx
  on public.nastardamus_users (daily_horoscope_enabled, last_horoscope_sent_on)
  where daily_horoscope_enabled = true;

create index if not exists nastardamus_wheel_claims_daily_reward_idx
  on public.nastardamus_wheel_claims (claim_date, reward_id);

alter table public.nastardamus_users enable row level security;
alter table public.nastardamus_wheel_claims enable row level security;
alter table public.nastardamus_service_entitlements enable row level security;

revoke all on table public.nastardamus_users from public, anon, authenticated;
revoke all on table public.nastardamus_wheel_claims from public, anon, authenticated;
revoke all on table public.nastardamus_service_entitlements from public, anon, authenticated;
grant select, insert, update on table public.nastardamus_users to service_role;
grant select, insert on table public.nastardamus_wheel_claims to service_role;
grant select, insert, update on table public.nastardamus_service_entitlements to service_role;

create or replace function public.nastardamus_claim_wheel_reward(
  p_telegram_id bigint,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Europe/Berlin')::date;
  v_settings jsonb;
  v_existing public.nastardamus_wheel_claims%rowtype;
  v_claims integer;
  v_daily_spins integer;
  v_free_spins integer;
  v_use_bonus boolean := false;
  v_reward jsonb;
  v_sequence integer;
begin
  if p_telegram_id is null or p_telegram_id <= 0 then
    raise exception 'invalid_telegram_id';
  end if;
  if p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$' then
    raise exception 'invalid_idempotency_key';
  end if;

  perform pg_advisory_xact_lock(p_telegram_id);

  select * into v_existing
  from public.nastardamus_wheel_claims
  where telegram_id = p_telegram_id and idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object(
      'reward', jsonb_build_object(
        'id', v_existing.reward_id,
        'title', v_existing.reward_title,
        'serviceId', v_existing.service_id,
        'quantity', v_existing.quantity
      ),
      'replayed', true
    );
  end if;

  select coalesce(settings, '{}'::jsonb) into v_settings
  from public.nastardamus_settings where key = 'global';
  if coalesce((v_settings->>'wheelEnabled')::boolean, false) is not true then
    raise exception 'wheel_disabled';
  end if;

  insert into public.nastardamus_wallets (telegram_id)
  values (p_telegram_id)
  on conflict (telegram_id) do nothing;

  select count(*) into v_claims
  from public.nastardamus_wheel_claims
  where telegram_id = p_telegram_id and claim_date = v_today;
  v_daily_spins := greatest(1, least(10, coalesce((v_settings->>'wheelDailySpins')::integer, 1)));

  if v_claims >= v_daily_spins then
    select free_spins into v_free_spins
    from public.nastardamus_wallets
    where telegram_id = p_telegram_id
    for update;
    if coalesce(v_free_spins, 0) <= 0 then
      raise exception 'wheel_daily_limit';
    end if;
    update public.nastardamus_wallets
    set free_spins = free_spins - 1, updated_at = now()
    where telegram_id = p_telegram_id;
    v_use_bonus := true;
  end if;

  with candidates as (
    select
      reward,
      greatest(1, least(10000, coalesce((reward->>'weight')::integer, 1))) as weight
    from jsonb_array_elements(coalesce(v_settings->'wheelRewards', '[]'::jsonb)) reward
    where coalesce((reward->>'enabled')::boolean, false) = true
      and coalesce((reward->>'quantity')::integer, 0) > 0
      and (
        coalesce((reward->>'dailyLimit')::integer, 0) = 0
        or (
          select count(*)
          from public.nastardamus_wheel_claims c
          where c.claim_date = v_today and c.reward_id = reward->>'id'
        ) < (reward->>'dailyLimit')::integer
      )
  ),
  seed as materialized (
    select random() as value
  ),
  weighted as (
    select reward, weight,
      sum(weight) over (order by reward->>'id') as cumulative,
      sum(weight) over () * seed.value as target
    from candidates
    cross join seed
  )
  select reward into v_reward
  from weighted
  where cumulative >= target
  order by cumulative
  limit 1;

  if v_reward is null then
    if v_use_bonus then
      update public.nastardamus_wallets
      set free_spins = free_spins + 1, updated_at = now()
      where telegram_id = p_telegram_id;
    end if;
    raise exception 'wheel_rewards_exhausted';
  end if;

  v_sequence := v_claims + 1;
  insert into public.nastardamus_wheel_claims (
    telegram_id, claim_date, sequence, idempotency_key,
    reward_id, reward_title, service_id, quantity
  ) values (
    p_telegram_id, v_today, v_sequence, p_idempotency_key,
    v_reward->>'id', v_reward->>'title', v_reward->>'serviceId',
    greatest(1, least(20, (v_reward->>'quantity')::integer))
  );

  insert into public.nastardamus_service_entitlements (telegram_id, service_id, quantity)
  values (
    p_telegram_id,
    v_reward->>'serviceId',
    greatest(1, least(20, (v_reward->>'quantity')::integer))
  )
  on conflict (telegram_id, service_id) do update
  set quantity = public.nastardamus_service_entitlements.quantity + excluded.quantity,
      updated_at = now();

  return jsonb_build_object(
    'reward', jsonb_build_object(
      'id', v_reward->>'id',
      'title', v_reward->>'title',
      'serviceId', v_reward->>'serviceId',
      'quantity', greatest(1, least(20, (v_reward->>'quantity')::integer))
    ),
    'replayed', false
  );
end;
$$;

revoke all on function public.nastardamus_claim_wheel_reward(bigint, text) from public, anon, authenticated;
grant execute on function public.nastardamus_claim_wheel_reward(bigint, text) to service_role;

update public.nastardamus_settings
set settings = settings || jsonb_build_object(
  'wheelDailySpins', coalesce(settings->'wheelDailySpins', '1'::jsonb),
  'dailyHoroscopeEnabled', coalesce(settings->'dailyHoroscopeEnabled', 'true'::jsonb),
  'serviceCatalog', coalesce(settings->'serviceCatalog', '{
    "tarot":{"id":"tarot","title":"Расклад Таро","enabled":true,"price":null},
    "tarot_relationship":{"id":"tarot_relationship","title":"Расклад Таро на двоих","enabled":true,"price":null},
    "natal":{"id":"natal","title":"Натальная подсказка","enabled":true,"price":null},
    "photo_energy":{"id":"photo_energy","title":"Энергетический след","enabled":true,"price":null},
    "photo_damage":{"id":"photo_damage","title":"Определение порчи","enabled":true,"price":null},
    "photo_compatibility":{"id":"photo_compatibility","title":"Совместимость по фото","enabled":true,"price":null},
    "palmlink":{"id":"palmlink","title":"Путь двух судеб","enabled":true,"price":null}
  }'::jsonb),
  'wheelRewards', coalesce(settings->'wheelRewards', '[
    {"id":"pair-tarot","serviceId":"tarot_relationship","title":"Бесплатный расклад на двоих","enabled":true,"quantity":1,"dailyLimit":5,"weight":4},
    {"id":"photo-pair","serviceId":"photo_compatibility","title":"Совместимость по фото","enabled":true,"quantity":1,"dailyLimit":5,"weight":3},
    {"id":"destiny-pair","serviceId":"palmlink","title":"Путь двух судеб","enabled":false,"quantity":1,"dailyLimit":3,"weight":2}
  ]'::jsonb)
)
where key = 'global';
