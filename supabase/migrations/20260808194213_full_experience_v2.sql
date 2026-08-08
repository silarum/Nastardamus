-- Full experience v2: My Path hierarchy, Rune Temple preferences and private AMUR profiles.
-- All access is server-mediated through the verified Telegram edge function.

alter table public.nastardamus_users
  add column if not exists birth_date date,
  add column if not exists birth_time time,
  add column if not exists birth_time_known boolean not null default false,
  add column if not exists interests jsonb not null default '[]'::jsonb,
  add column if not exists goals jsonb not null default '[]'::jsonb,
  add column if not exists profile_consents jsonb not null default '{}'::jsonb,
  add column if not exists natal_chart jsonb;

alter table public.nastardamus_personal_events
  add column if not exists location text not null default '',
  add column if not exists links jsonb not null default '[]'::jsonb,
  add column if not exists desired_result text not null default '',
  add column if not exists reflection text not null default '';

create table if not exists public.nastardamus_path_items (
  item_id text primary key,
  telegram_id bigint not null,
  kind text not null check (kind in ('project', 'habit')),
  goal_id uuid references public.nastardamus_personal_goals(goal_id) on delete set null,
  title text not null check (char_length(title) between 3 and 100),
  status text not null default 'active' check (status in ('active', 'completed', 'archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists nastardamus_path_items_owner_kind_idx
  on public.nastardamus_path_items (telegram_id, kind, status, created_at desc);

create table if not exists public.nastardamus_path_consultations (
  consultation_id text primary key,
  telegram_id bigint not null,
  title text not null,
  answers jsonb not null default '{}'::jsonb,
  context jsonb not null default '{}'::jsonb,
  result_text text not null default '',
  linked_reading_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists nastardamus_path_consultations_owner_idx
  on public.nastardamus_path_consultations (telegram_id, created_at desc);

create table if not exists public.nastardamus_rune_preferences (
  telegram_id bigint primary key,
  favorites jsonb not null default '[]'::jsonb,
  preferred_spread text not null default 'three',
  reversed_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.nastardamus_amur_profiles (
  telegram_id bigint primary key,
  answers jsonb not null default '{}'::jsonb,
  interests jsonb not null default '[]'::jsonb,
  goals jsonb not null default '[]'::jsonb,
  zodiac text not null default '',
  intent text not null default 'dialogue',
  completeness smallint not null default 0 check (completeness between 0 and 100),
  discoverable boolean not null default false,
  adult_confirmed boolean not null default false,
  blocked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists nastardamus_amur_discovery_idx
  on public.nastardamus_amur_profiles (intent, discoverable, updated_at desc)
  where discoverable = true and adult_confirmed = true and blocked_at is null;

create table if not exists public.nastardamus_amur_connections (
  connection_id uuid primary key default gen_random_uuid(),
  first_telegram_id bigint not null,
  second_telegram_id bigint not null,
  status text not null default 'game' check (status in ('game', 'consent_pending', 'chat', 'ended', 'blocked')),
  compatibility_score smallint check (compatibility_score between 0 and 100),
  shared_topics jsonb not null default '[]'::jsonb,
  private_answers jsonb not null default '{}'::jsonb,
  first_chat_consent boolean not null default false,
  second_chat_consent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ended_at timestamptz,
  check (first_telegram_id <> second_telegram_id),
  unique (first_telegram_id, second_telegram_id)
);

create index if not exists nastardamus_amur_connections_first_idx
  on public.nastardamus_amur_connections (first_telegram_id, status, updated_at desc);
create index if not exists nastardamus_amur_connections_second_idx
  on public.nastardamus_amur_connections (second_telegram_id, status, updated_at desc);

alter table public.nastardamus_path_items enable row level security;
alter table public.nastardamus_path_consultations enable row level security;
alter table public.nastardamus_rune_preferences enable row level security;
alter table public.nastardamus_amur_profiles enable row level security;
alter table public.nastardamus_amur_connections enable row level security;

revoke all on public.nastardamus_path_items from anon, authenticated;
revoke all on public.nastardamus_path_consultations from anon, authenticated;
revoke all on public.nastardamus_rune_preferences from anon, authenticated;
revoke all on public.nastardamus_amur_profiles from anon, authenticated;
revoke all on public.nastardamus_amur_connections from anon, authenticated;

grant select, insert, update, delete on public.nastardamus_path_items to service_role;
grant select, insert, update, delete on public.nastardamus_path_consultations to service_role;
grant select, insert, update, delete on public.nastardamus_rune_preferences to service_role;
grant select, insert, update, delete on public.nastardamus_amur_profiles to service_role;
grant select, insert, update, delete on public.nastardamus_amur_connections to service_role;
