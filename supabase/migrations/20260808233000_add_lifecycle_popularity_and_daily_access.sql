alter table public.nastardamus_users
  add column if not exists profile_name text;

create table if not exists public.nastardamus_service_events (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null,
  service_id text not null check (service_id ~ '^[a-z0-9:_-]{1,100}$'),
  event_type text not null check (event_type in ('started', 'completed', 'failed', 'free_used', 'paid_used', 'wheel')),
  access_source text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists nastardamus_service_events_service_created_idx
  on public.nastardamus_service_events (service_id, created_at desc);
create index if not exists nastardamus_service_events_user_created_idx
  on public.nastardamus_service_events (telegram_id, created_at desc);

create table if not exists public.nastardamus_user_journey (
  telegram_id bigint primary key,
  facts jsonb not null default '{}'::jsonb,
  visual_observations jsonb not null default '[]'::jsonb,
  ai_hypotheses jsonb not null default '[]'::jsonb,
  confirmed_hypotheses jsonb not null default '[]'::jsonb,
  rejected_hypotheses jsonb not null default '[]'::jsonb,
  service_affinity jsonb not null default '{}'::jsonb,
  last_guidance jsonb not null default '{}'::jsonb,
  ton_wallet_address text,
  ton_wallet_chain text,
  ton_wallet_app text,
  ton_wallet_connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.nastardamus_service_events enable row level security;
alter table public.nastardamus_user_journey enable row level security;
revoke all on table public.nastardamus_service_events from public, anon, authenticated;
revoke all on table public.nastardamus_user_journey from public, anon, authenticated;
grant select, insert on table public.nastardamus_service_events to service_role;
grant select, insert, update on table public.nastardamus_user_journey to service_role;

create or replace function public.nastardamus_record_service_event(
  p_telegram_id bigint,
  p_service_id text,
  p_event_type text,
  p_access_source text default null,
  p_metadata jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_affinity jsonb;
begin
  if p_telegram_id <= 0 or p_service_id !~ '^[a-z0-9:_-]{1,100}$' then
    raise exception 'invalid_service_event';
  end if;
  if p_event_type not in ('started', 'completed', 'failed', 'free_used', 'paid_used', 'wheel') then
    raise exception 'invalid_service_event_type';
  end if;

  insert into public.nastardamus_service_events (telegram_id, service_id, event_type, access_source, metadata)
  values (p_telegram_id, p_service_id, p_event_type, nullif(left(p_access_source, 80), ''), coalesce(p_metadata, '{}'::jsonb))
  returning id into v_id;

  if p_event_type in ('completed', 'free_used', 'paid_used', 'wheel') then
    insert into public.nastardamus_user_journey (telegram_id)
    values (p_telegram_id)
    on conflict (telegram_id) do nothing;

    select service_affinity into v_affinity
      from public.nastardamus_user_journey
      where telegram_id = p_telegram_id
      for update;

    update public.nastardamus_user_journey
      set service_affinity = jsonb_set(
            coalesce(v_affinity, '{}'::jsonb),
            array[p_service_id],
            to_jsonb(coalesce((v_affinity ->> p_service_id)::integer, 0) + 1),
            true
          ),
          last_guidance = case
            when p_event_type = 'completed' then jsonb_build_object(
              'serviceId', p_service_id,
              'completedAt', now(),
              'summary', left(coalesce(p_metadata ->> 'summary', ''), 500)
            )
            else last_guidance
          end,
          updated_at = now()
      where telegram_id = p_telegram_id;
  end if;
  return v_id;
end;
$$;

revoke all on function public.nastardamus_record_service_event(bigint, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.nastardamus_record_service_event(bigint, text, text, text, jsonb) to service_role;

create or replace function public.nastardamus_service_popularity(p_days integer default 30)
returns table (
  service_id text,
  started bigint,
  completed bigint,
  failed bigint,
  free_used bigint,
  paid_used bigint,
  unique_users bigint,
  last_used_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  select
    event.service_id,
    count(*) filter (where event.event_type = 'started') as started,
    count(*) filter (where event.event_type = 'completed') as completed,
    count(*) filter (where event.event_type = 'failed') as failed,
    count(*) filter (where event.event_type = 'free_used') as free_used,
    count(*) filter (where event.event_type = 'paid_used') as paid_used,
    count(distinct event.telegram_id) as unique_users,
    max(event.created_at) as last_used_at
  from public.nastardamus_service_events event
  where event.created_at >= now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365)))
  group by event.service_id
  order by completed desc, unique_users desc, started desc, event.service_id;
$$;

revoke all on function public.nastardamus_service_popularity(integer) from public, anon, authenticated;
grant execute on function public.nastardamus_service_popularity(integer) to service_role;

update public.nastardamus_settings
set settings = jsonb_build_object(
  'subscriptionGateEnabled', false,
  'subscriptionChannelUsername', '',
  'subscriptionChannelTitle', 'Канал Эзотериума',
  'dailyFreeServiceIds', jsonb_build_array('tarot', 'tarot_relationship', 'palm_reading', 'natal', 'rune_reading'),
  'tonTreasuryAddress', 'UQAVyNXcWPUm-24n7JMqIIjMjYN1bVMPXbNww29NNh-l1CyO'
) || settings,
updated_at = now()
where key = 'global';
