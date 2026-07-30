alter table public.nastardamus_users
  add column if not exists birth_year smallint
    check (birth_year is null or birth_year between 1900 and 2100),
  add column if not exists city text
    check (city is null or char_length(city) between 1 and 120),
  add column if not exists telegram_avatar_url text
    check (telegram_avatar_url is null or char_length(telegram_avatar_url) <= 1000),
  add column if not exists profile_avatar_path text
    check (profile_avatar_path is null or char_length(profile_avatar_path) <= 240),
  add column if not exists profile_completed_at timestamptz;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) values (
  'nastardamus-profile-photos',
  'nastardamus-profile-photos',
  false,
  3145728,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.nastardamus_reading_sessions
  drop constraint if exists nastardamus_reading_sessions_kind_check,
  drop constraint if exists nastardamus_reading_sessions_state_check;

alter table public.nastardamus_reading_sessions
  add constraint nastardamus_reading_sessions_kind_check
    check (kind in (
      'tarot',
      'compatibility',
      'photo',
      'palm',
      'runes',
      'amur',
      'natal',
      'horoscope',
      'sports'
    )),
  add constraint nastardamus_reading_sessions_state_check
    check (state in (
      'created',
      'paid',
      'selecting',
      'dialogue',
      'analyzing',
      'completed',
      'failed',
      'refunded',
      'abandoned'
    ));

create table if not exists public.nastardamus_reading_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.nastardamus_reading_sessions(id) on delete cascade,
  telegram_id bigint not null check (telegram_id > 0),
  role text not null check (role in ('assistant', 'user')),
  content text not null check (char_length(content) between 1 and 2000),
  sequence_no integer not null check (sequence_no >= 0),
  created_at timestamptz not null default now(),
  unique (session_id, sequence_no)
);

create index if not exists nastardamus_reading_messages_session_idx
  on public.nastardamus_reading_messages (session_id, sequence_no);

alter table public.nastardamus_reading_messages enable row level security;
revoke all on table public.nastardamus_reading_messages from public, anon, authenticated;
grant select, insert on table public.nastardamus_reading_messages to service_role;

alter table public.nastardamus_joint_invitations
  add column if not exists initiator_profile jsonb not null default '{}'::jsonb,
  add column if not exists participant_profile jsonb not null default '{}'::jsonb,
  add column if not exists result_payload jsonb not null default '{}'::jsonb,
  add column if not exists analysis_requested_at timestamptz,
  add column if not exists notification_sent_at timestamptz;

update public.nastardamus_settings
set
  settings = jsonb_set(
    jsonb_set(
      settings,
      '{serviceCatalog}',
      coalesce(settings -> 'serviceCatalog', '{}'::jsonb) || jsonb_build_object(
        'palm_reading', jsonb_build_object(
          'title', 'Чтение по ладони',
          'enabled', true,
          'price', 0
        ),
        'rune_reading', jsonb_build_object(
          'title', 'Руны',
          'enabled', true,
          'price', 0
        ),
        'amur_compatibility', jsonb_build_object(
          'title', 'Амур',
          'enabled', true,
          'price', 0
        )
      )
    ),
    '{sbpRoublesPerSilarum}',
    '100'::jsonb,
    true
  ),
  updated_at = now()
where key = 'global';

comment on table public.nastardamus_reading_messages is
  'Server-side dialogue transcript for palm and other guided readings.';
comment on column public.nastardamus_users.birth_year is
  'Birth year derived from the age explicitly entered by the user.';
