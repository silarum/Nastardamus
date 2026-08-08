create extension if not exists pgcrypto;

create table if not exists public.nastardamus_oracle_rooms (
  id uuid primary key default gen_random_uuid(),
  token text not null unique check (token ~ '^[a-f0-9]{32}$'),
  mode text not null check (mode in ('solo', 'pair', 'group')),
  owner_telegram_id bigint not null check (owner_telegram_id > 0),
  title text not null check (char_length(title) between 3 and 100),
  focus text not null default '' check (char_length(focus) <= 500),
  relationship_type text not null default 'other'
    check (relationship_type in ('love', 'friendship', 'family', 'business', 'creative', 'other')),
  invitee_name text not null default '' check (char_length(invitee_name) <= 80),
  invitee_gender text not null default 'unspecified'
    check (invitee_gender in ('female', 'male', 'unspecified')),
  opening_question text not null default '' check (char_length(opening_question) <= 400),
  ritual_state text not null default 'preparing'
    check (ritual_state in ('preparing', 'opened')),
  status text not null default 'active' check (status in ('active', 'closed')),
  max_participants smallint not null check (max_participants between 1 and 6),
  next_sequence integer not null default 1 check (next_sequence >= 0),
  active_turn_id uuid,
  assistant_state text not null default 'idle'
    check (assistant_state in ('idle', 'thinking', 'error')),
  turn_started_at timestamptz,
  invite_expires_at timestamptz not null default (now() + interval '72 hours'),
  last_message_at timestamptz not null default now(),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (mode = 'solo' and max_participants = 1)
    or (mode = 'pair' and max_participants = 2)
    or (mode = 'group' and max_participants between 3 and 6)
  )
);

create table if not exists public.nastardamus_oracle_room_members (
  room_id uuid not null references public.nastardamus_oracle_rooms(id) on delete cascade,
  telegram_id bigint not null check (telegram_id > 0),
  role text not null default 'member' check (role in ('owner', 'member')),
  status text not null default 'invited'
    check (status in ('invited', 'active', 'left', 'removed')),
  display_name text not null check (char_length(display_name) between 1 and 80),
  username text check (
    username is null or username ~ '^[A-Za-z0-9_]{5,32}$'
  ),
  gender text not null default 'unspecified'
    check (gender in ('female', 'male', 'unspecified')),
  relationship_consent_at timestamptz,
  adult_confirmed boolean not null default false,
  palm_image_path text check (
    palm_image_path is null or char_length(palm_image_path) between 10 and 220
  ),
  palm_description text not null default '' check (char_length(palm_description) <= 1000),
  palm_consent_at timestamptz,
  dominant_hand text not null default 'unspecified'
    check (dominant_hand in ('right', 'left', 'ambidextrous', 'unspecified')),
  palm_side text not null default 'unspecified'
    check (palm_side in ('right', 'left', 'unspecified')),
  private_answers jsonb not null default '{}'::jsonb
    check (jsonb_typeof(private_answers) = 'object' and octet_length(private_answers::text) <= 4000),
  preparation_status text not null default 'not_started'
    check (preparation_status in ('not_started', 'in_progress', 'ready')),
  prepared_at timestamptz,
  notifications_enabled boolean not null default true,
  joined_at timestamptz,
  last_read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (room_id, telegram_id)
);

create table if not exists public.nastardamus_oracle_room_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.nastardamus_oracle_rooms(id) on delete cascade,
  turn_id uuid,
  sender_telegram_id bigint check (sender_telegram_id is null or sender_telegram_id > 0),
  role text not null check (role in ('user', 'assistant', 'system')),
  sender_name text not null check (char_length(sender_name) between 1 and 80),
  content text not null check (char_length(content) between 1 and 4000),
  sequence_no integer not null check (sequence_no >= 0),
  client_nonce text check (
    client_nonce is null or client_nonce ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$'
  ),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (room_id, sequence_no),
  check (
    (role = 'user' and sender_telegram_id is not null)
    or (role in ('assistant', 'system') and sender_telegram_id is null)
  )
);

create index if not exists nastardamus_oracle_rooms_owner_idx
  on public.nastardamus_oracle_rooms (owner_telegram_id, updated_at desc);
create index if not exists nastardamus_oracle_rooms_activity_idx
  on public.nastardamus_oracle_rooms (status, last_message_at desc);
create index if not exists nastardamus_oracle_room_members_user_idx
  on public.nastardamus_oracle_room_members (telegram_id, status, updated_at desc);
create index if not exists nastardamus_oracle_room_messages_room_idx
  on public.nastardamus_oracle_room_messages (room_id, sequence_no desc);
create unique index if not exists nastardamus_oracle_room_messages_nonce_idx
  on public.nastardamus_oracle_room_messages (room_id, sender_telegram_id, client_nonce)
  where sender_telegram_id is not null and client_nonce is not null;
create index if not exists nastardamus_users_username_lookup_idx
  on public.nastardamus_users (lower(username))
  where username is not null;

alter table public.nastardamus_oracle_rooms enable row level security;
alter table public.nastardamus_oracle_room_members enable row level security;
alter table public.nastardamus_oracle_room_messages enable row level security;

revoke all on table public.nastardamus_oracle_rooms from public, anon, authenticated;
revoke all on table public.nastardamus_oracle_room_members from public, anon, authenticated;
revoke all on table public.nastardamus_oracle_room_messages from public, anon, authenticated;
grant select, insert, update, delete on table public.nastardamus_oracle_rooms to service_role;
grant select, insert, update, delete on table public.nastardamus_oracle_room_members to service_role;
grant select, insert, update, delete on table public.nastardamus_oracle_room_messages to service_role;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) values (
  'nastardamus-oracle-palms',
  'nastardamus-oracle-palms',
  false,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.nastardamus_create_oracle_room(
  p_owner_telegram_id bigint,
  p_owner_name text,
  p_owner_username text,
  p_owner_gender text,
  p_mode text,
  p_title text,
  p_focus text,
  p_max_participants integer,
  p_invitee_name text,
  p_invitee_gender text,
  p_relationship_type text,
  p_opening_question text,
  p_relationship_consent boolean,
  p_adult_confirmed boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_room_id uuid := gen_random_uuid();
  v_token text := replace(gen_random_uuid()::text, '-', '');
  v_mode text := lower(trim(coalesce(p_mode, '')));
  v_name text := left(regexp_replace(trim(coalesce(p_owner_name, '')), '\s+', ' ', 'g'), 80);
  v_username text := nullif(lower(regexp_replace(trim(coalesce(p_owner_username, '')), '^@', '')), '');
  v_gender text := lower(trim(coalesce(p_owner_gender, 'unspecified')));
  v_title text := left(regexp_replace(trim(coalesce(p_title, '')), '\s+', ' ', 'g'), 100);
  v_focus text := left(trim(coalesce(p_focus, '')), 500);
  v_invitee_name text := left(regexp_replace(trim(coalesce(p_invitee_name, '')), '\s+', ' ', 'g'), 80);
  v_invitee_gender text := lower(trim(coalesce(p_invitee_gender, 'unspecified')));
  v_relationship_type text := lower(trim(coalesce(p_relationship_type, 'other')));
  v_opening_question text := left(regexp_replace(trim(coalesce(p_opening_question, '')), '\s+', ' ', 'g'), 400);
  v_max integer;
begin
  if p_owner_telegram_id is null or p_owner_telegram_id <= 0 then
    raise exception 'invalid_telegram_id';
  end if;
  if v_mode not in ('solo', 'pair', 'group') then
    raise exception 'invalid_oracle_room_mode';
  end if;
  if char_length(v_name) < 1 then
    raise exception 'invalid_oracle_room_name';
  end if;
  if v_username is not null and v_username !~ '^[a-z0-9_]{5,32}$' then
    raise exception 'invalid_oracle_username';
  end if;
  if v_gender not in ('female', 'male', 'unspecified') then
    raise exception 'invalid_gender';
  end if;
  if char_length(v_title) < 3 then
    raise exception 'invalid_oracle_room_title';
  end if;
  if v_relationship_type not in ('love', 'friendship', 'family', 'business', 'creative', 'other') then
    raise exception 'invalid_oracle_relationship_type';
  end if;
  if v_invitee_gender not in ('female', 'male', 'unspecified') then
    raise exception 'invalid_gender';
  end if;
  if v_mode = 'pair' and (char_length(v_invitee_name) < 1 or char_length(v_opening_question) < 8) then
    raise exception 'invalid_oracle_pair_invitation';
  end if;
  if p_relationship_consent is not true then
    raise exception 'oracle_room_consent_required';
  end if;
  if v_mode <> 'solo' and p_adult_confirmed is not true then
    raise exception 'adult_confirmation_required';
  end if;

  v_max := case
    when v_mode = 'solo' then 1
    when v_mode = 'pair' then 2
    else greatest(3, least(6, coalesce(p_max_participants, 6)))
  end;

  insert into public.nastardamus_oracle_rooms (
    id, token, mode, owner_telegram_id, title, focus, relationship_type,
    invitee_name, invitee_gender, opening_question, ritual_state, max_participants,
    next_sequence, last_message_at, updated_at
  ) values (
    v_room_id, v_token, v_mode, p_owner_telegram_id, v_title, v_focus, v_relationship_type,
    case when v_mode = 'pair' then v_invitee_name else '' end,
    case when v_mode = 'pair' then v_invitee_gender else 'unspecified' end,
    case when v_mode = 'pair' then v_opening_question else '' end,
    case when v_mode = 'solo' then 'opened' else 'preparing' end,
    v_max,
    1, now(), now()
  );

  insert into public.nastardamus_oracle_room_members (
    room_id, telegram_id, role, status, display_name, username, gender,
    relationship_consent_at, adult_confirmed, preparation_status, joined_at, last_read_at
  ) values (
    v_room_id, p_owner_telegram_id, 'owner', 'active', v_name, v_username, v_gender,
    now(), coalesce(p_adult_confirmed, false),
    case when v_mode = 'solo' then 'in_progress' else 'not_started' end,
    now(), now()
  );

  insert into public.nastardamus_oracle_room_messages (
    room_id, role, sender_name, content, sequence_no
  ) values (
    v_room_id,
    'system',
    'Пространство',
    case
      when v_mode = 'solo' then 'Личная комната открыта. Эзотериум готов к спокойному разговору.'
      when v_mode = 'pair' then 'Комната для двоих открыта. Пригласите второго участника.'
      else 'Групповой круг открыт. Пригласите людей, которых хотите услышать.'
    end,
    0
  );

  return jsonb_build_object('room_id', v_room_id, 'token', v_token);
end;
$function$;

create or replace function public.nastardamus_join_oracle_room(
  p_token text,
  p_telegram_id bigint,
  p_display_name text,
  p_username text,
  p_gender text,
  p_relationship_consent boolean,
  p_adult_confirmed boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_room public.nastardamus_oracle_rooms%rowtype;
  v_member public.nastardamus_oracle_room_members%rowtype;
  v_had_member boolean := false;
  v_count integer;
  v_name text := left(regexp_replace(trim(coalesce(p_display_name, '')), '\s+', ' ', 'g'), 80);
  v_username text := nullif(lower(regexp_replace(trim(coalesce(p_username, '')), '^@', '')), '');
  v_gender text := lower(trim(coalesce(p_gender, 'unspecified')));
begin
  if p_token is null or p_token !~ '^[a-f0-9]{32}$' then
    raise exception 'invalid_oracle_room_token';
  end if;
  if p_telegram_id is null or p_telegram_id <= 0 then
    raise exception 'invalid_telegram_id';
  end if;
  if char_length(v_name) < 1 then
    raise exception 'invalid_oracle_room_name';
  end if;
  if v_username is not null and v_username !~ '^[a-z0-9_]{5,32}$' then
    raise exception 'invalid_oracle_username';
  end if;
  if v_gender not in ('female', 'male', 'unspecified') then
    raise exception 'invalid_gender';
  end if;
  if p_relationship_consent is not true then
    raise exception 'oracle_room_consent_required';
  end if;
  if p_adult_confirmed is not true then
    raise exception 'adult_confirmation_required';
  end if;

  select * into v_room
  from public.nastardamus_oracle_rooms
  where token = p_token
  for update;

  if not found then
    raise exception 'oracle_room_not_found';
  end if;
  if v_room.status <> 'active' then
    raise exception 'oracle_room_closed';
  end if;
  if v_room.mode = 'solo' then
    raise exception 'oracle_room_private';
  end if;
  if v_room.ritual_state = 'opened' then
    raise exception 'oracle_room_started';
  end if;

  select * into v_member
  from public.nastardamus_oracle_room_members
  where room_id = v_room.id and telegram_id = p_telegram_id;
  v_had_member := found;

  if v_had_member and v_member.status = 'active' then
    return jsonb_build_object('room_id', v_room.id, 'token', v_room.token, 'joined', false);
  end if;
  if v_had_member and v_member.status = 'removed' then
    raise exception 'oracle_room_access_denied';
  end if;
  if v_room.invite_expires_at <= now() then
    raise exception 'oracle_room_invite_expired';
  end if;

  select count(*) into v_count
  from public.nastardamus_oracle_room_members
  where room_id = v_room.id and status in ('active', 'invited');

  if (not v_had_member or v_member.status not in ('active', 'invited'))
    and v_count >= v_room.max_participants
  then
    raise exception 'oracle_room_full';
  end if;

  insert into public.nastardamus_oracle_room_members (
    room_id, telegram_id, role, status, display_name, username, gender,
    relationship_consent_at, adult_confirmed, joined_at, last_read_at, updated_at
  ) values (
    v_room.id, p_telegram_id, 'member', 'active', v_name, v_username, v_gender,
    now(), true, now(), now(), now()
  )
  on conflict (room_id, telegram_id) do update
  set
    status = 'active',
    display_name = excluded.display_name,
    username = excluded.username,
    gender = excluded.gender,
    relationship_consent_at = now(),
    adult_confirmed = true,
    preparation_status = case
      when public.nastardamus_oracle_room_members.preparation_status = 'ready' then 'ready'
      else 'not_started'
    end,
    joined_at = coalesce(public.nastardamus_oracle_room_members.joined_at, now()),
    last_read_at = now(),
    updated_at = now();

  insert into public.nastardamus_oracle_room_messages (
    room_id, role, sender_name, content, sequence_no
  ) values (
    v_room.id,
    'system',
    'Пространство',
    v_name || ' присоединяется к разговору.',
    v_room.next_sequence
  );

  update public.nastardamus_oracle_rooms
  set
    next_sequence = next_sequence + 1,
    last_message_at = now(),
    updated_at = now()
  where id = v_room.id;

  return jsonb_build_object('room_id', v_room.id, 'token', v_room.token, 'joined', true);
end;
$function$;

create or replace function public.nastardamus_invite_oracle_room_member(
  p_token text,
  p_owner_telegram_id bigint,
  p_target_telegram_id bigint,
  p_target_name text,
  p_target_username text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_room public.nastardamus_oracle_rooms%rowtype;
  v_count integer;
  v_name text := left(regexp_replace(trim(coalesce(p_target_name, '')), '\s+', ' ', 'g'), 80);
  v_username text := lower(regexp_replace(trim(coalesce(p_target_username, '')), '^@', ''));
  v_status text;
begin
  if p_token is null or p_token !~ '^[a-f0-9]{32}$' then
    raise exception 'invalid_oracle_room_token';
  end if;
  if p_owner_telegram_id is null or p_owner_telegram_id <= 0
    or p_target_telegram_id is null or p_target_telegram_id <= 0
  then
    raise exception 'invalid_telegram_id';
  end if;
  if p_owner_telegram_id = p_target_telegram_id then
    raise exception 'oracle_room_self_invite';
  end if;
  if char_length(v_name) < 1 or v_username !~ '^[a-z0-9_]{5,32}$' then
    raise exception 'invalid_oracle_username';
  end if;

  select * into v_room
  from public.nastardamus_oracle_rooms
  where token = p_token
  for update;

  if not found or v_room.owner_telegram_id <> p_owner_telegram_id then
    raise exception 'oracle_room_not_found';
  end if;
  if v_room.status <> 'active' then
    raise exception 'oracle_room_closed';
  end if;
  if v_room.mode = 'solo' then
    raise exception 'oracle_room_private';
  end if;
  if v_room.ritual_state = 'opened' then
    raise exception 'oracle_room_started';
  end if;
  if v_room.invite_expires_at <= now() then
    raise exception 'oracle_room_invite_expired';
  end if;

  select status into v_status
  from public.nastardamus_oracle_room_members
  where room_id = v_room.id and telegram_id = p_target_telegram_id;

  if found and v_status in ('active', 'invited') then
    return jsonb_build_object('room_id', v_room.id, 'token', v_room.token, 'invited', false);
  end if;

  select count(*) into v_count
  from public.nastardamus_oracle_room_members
  where room_id = v_room.id and status in ('active', 'invited');
  if v_count >= v_room.max_participants then
    raise exception 'oracle_room_full';
  end if;

  insert into public.nastardamus_oracle_room_members (
    room_id, telegram_id, role, status, display_name, username, gender, updated_at
  ) values (
    v_room.id, p_target_telegram_id, 'member', 'invited', v_name, v_username,
    'unspecified', now()
  )
  on conflict (room_id, telegram_id) do update
  set
    status = 'invited',
    display_name = excluded.display_name,
    username = excluded.username,
    updated_at = now();

  update public.nastardamus_oracle_rooms set updated_at = now() where id = v_room.id;
  return jsonb_build_object('room_id', v_room.id, 'token', v_room.token, 'invited', true);
end;
$function$;

create or replace function public.nastardamus_complete_oracle_room_preparation(
  p_token text,
  p_telegram_id bigint,
  p_palm_image_path text,
  p_palm_description text,
  p_dominant_hand text,
  p_palm_side text,
  p_private_answers jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_room public.nastardamus_oracle_rooms%rowtype;
  v_member public.nastardamus_oracle_room_members%rowtype;
  v_description text := left(trim(coalesce(p_palm_description, '')), 1000);
  v_dominant_hand text := lower(trim(coalesce(p_dominant_hand, 'unspecified')));
  v_palm_side text := lower(trim(coalesce(p_palm_side, 'unspecified')));
  v_answers jsonb := coalesce(p_private_answers, '{}'::jsonb);
  v_active_count integer := 0;
  v_ready_count integer := 0;
  v_newly_opened boolean := false;
begin
  if p_token is null or p_token !~ '^[a-f0-9]{32}$' then
    raise exception 'invalid_oracle_room_token';
  end if;
  if p_telegram_id is null or p_telegram_id <= 0 then
    raise exception 'invalid_telegram_id';
  end if;
  if p_palm_image_path is null or char_length(p_palm_image_path) not between 10 and 220 then
    raise exception 'invalid_oracle_palm_path';
  end if;
  if char_length(v_description) < 10 then
    raise exception 'invalid_oracle_palm_description';
  end if;
  if v_dominant_hand not in ('right', 'left', 'ambidextrous', 'unspecified')
    or v_palm_side not in ('right', 'left', 'unspecified')
  then
    raise exception 'invalid_oracle_hand_profile';
  end if;
  if jsonb_typeof(v_answers) <> 'object' or octet_length(v_answers::text) > 4000 then
    raise exception 'invalid_oracle_private_answers';
  end if;

  select * into v_room
  from public.nastardamus_oracle_rooms
  where token = p_token
  for update;
  if not found then raise exception 'oracle_room_not_found'; end if;
  if v_room.status <> 'active' then raise exception 'oracle_room_closed'; end if;

  select * into v_member
  from public.nastardamus_oracle_room_members
  where room_id = v_room.id and telegram_id = p_telegram_id and status = 'active';
  if not found then raise exception 'oracle_room_access_denied'; end if;

  if v_room.mode <> 'solo' then
    if v_dominant_hand = 'unspecified' or v_palm_side = 'unspecified'
      or char_length(trim(coalesce(v_answers ->> 'connection', ''))) < 4
      or char_length(trim(coalesce(v_answers ->> 'tension', ''))) < 4
      or char_length(trim(coalesce(v_answers ->> 'future', ''))) < 4
      or char_length(trim(coalesce(v_answers ->> 'personalQuestion', ''))) < 4
    then
      raise exception 'oracle_room_preparation_incomplete';
    end if;
  end if;

  update public.nastardamus_oracle_room_members
  set
    palm_image_path = p_palm_image_path,
    palm_description = v_description,
    palm_consent_at = now(),
    dominant_hand = v_dominant_hand,
    palm_side = v_palm_side,
    private_answers = v_answers,
    preparation_status = 'ready',
    prepared_at = now(),
    updated_at = now()
  where room_id = v_room.id and telegram_id = p_telegram_id;

  select
    count(*) filter (where status = 'active'),
    count(*) filter (where status = 'active' and preparation_status = 'ready')
  into v_active_count, v_ready_count
  from public.nastardamus_oracle_room_members
  where room_id = v_room.id;

  if v_room.ritual_state = 'preparing' and (
    (v_room.mode = 'pair' and v_active_count = 2 and v_ready_count = 2)
    or (v_room.mode = 'group' and v_active_count >= 3 and v_active_count = v_ready_count)
  ) then
    insert into public.nastardamus_oracle_room_messages (
      room_id, role, sender_name, content, sequence_no, metadata
    ) values (
      v_room.id, 'system', 'Пространство',
      case
        when v_room.mode = 'pair' then 'Обе закрытые подготовки завершены. Эзотериум открывает совместное чтение двух судеб.'
        else 'Все участники завершили закрытую подготовку. Эзотериум открывает общий круг.'
      end,
      v_room.next_sequence,
      jsonb_build_object('kind', 'preparation_complete')
    );
    update public.nastardamus_oracle_rooms
    set
      ritual_state = 'opened',
      next_sequence = next_sequence + 1,
      last_message_at = now(),
      updated_at = now()
    where id = v_room.id;
    v_newly_opened := true;
  else
    update public.nastardamus_oracle_rooms set updated_at = now() where id = v_room.id;
  end if;

  return jsonb_build_object(
    'room_id', v_room.id,
    'token', v_room.token,
    'ready_count', v_ready_count,
    'active_count', v_active_count,
    'newly_opened', v_newly_opened
  );
end;
$function$;

create or replace function public.nastardamus_begin_oracle_room_turn(
  p_token text,
  p_telegram_id bigint,
  p_content text,
  p_client_nonce text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_room public.nastardamus_oracle_rooms%rowtype;
  v_member public.nastardamus_oracle_room_members%rowtype;
  v_existing public.nastardamus_oracle_room_messages%rowtype;
  v_existing_answer text;
  v_turn_id uuid := gen_random_uuid();
  v_content text := left(trim(coalesce(p_content, '')), 2000);
begin
  if p_token is null or p_token !~ '^[a-f0-9]{32}$' then
    raise exception 'invalid_oracle_room_token';
  end if;
  if p_telegram_id is null or p_telegram_id <= 0 then
    raise exception 'invalid_telegram_id';
  end if;
  if char_length(v_content) < 2 then
    raise exception 'invalid_oracle_room_message';
  end if;
  if p_client_nonce is null or p_client_nonce !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$' then
    raise exception 'invalid_idempotency_key';
  end if;

  select * into v_room
  from public.nastardamus_oracle_rooms
  where token = p_token
  for update;

  if not found then
    raise exception 'oracle_room_not_found';
  end if;
  if v_room.status <> 'active' then
    raise exception 'oracle_room_closed';
  end if;
  if v_room.mode <> 'solo' and v_room.ritual_state <> 'opened' then
    raise exception 'oracle_room_preparation_required';
  end if;

  select * into v_member
  from public.nastardamus_oracle_room_members
  where room_id = v_room.id
    and telegram_id = p_telegram_id
    and status = 'active';
  if not found then
    raise exception 'oracle_room_access_denied';
  end if;

  select * into v_existing
  from public.nastardamus_oracle_room_messages
  where room_id = v_room.id
    and sender_telegram_id = p_telegram_id
    and client_nonce = p_client_nonce
  limit 1;

  if found then
    select content into v_existing_answer
    from public.nastardamus_oracle_room_messages
    where room_id = v_room.id
      and turn_id = v_existing.turn_id
      and role = 'assistant'
    limit 1;
    if v_existing_answer is not null then
      return jsonb_build_object(
        'room_id', v_room.id,
        'token', v_room.token,
        'turn_id', v_existing.turn_id,
        'replayed', true,
        'answer', v_existing_answer,
        'content', v_existing.content
      );
    end if;

    if v_room.assistant_state = 'thinking'
      and v_room.turn_started_at > now() - interval '2 minutes'
    then
      return jsonb_build_object(
        'room_id', v_room.id,
        'token', v_room.token,
        'turn_id', v_existing.turn_id,
        'replayed', true,
        'answer', null,
        'content', v_existing.content
      );
    end if;

    update public.nastardamus_oracle_rooms
    set
      active_turn_id = v_existing.turn_id,
      assistant_state = 'thinking',
      turn_started_at = now(),
      updated_at = now()
    where id = v_room.id;

    return jsonb_build_object(
      'room_id', v_room.id,
      'token', v_room.token,
      'turn_id', v_existing.turn_id,
      'replayed', false,
      'retried', true,
      'speaker_name', v_member.display_name,
      'content', v_existing.content
    );
  end if;

  if v_room.assistant_state = 'thinking'
    and v_room.turn_started_at > now() - interval '2 minutes'
  then
    raise exception 'oracle_room_busy';
  end if;

  insert into public.nastardamus_oracle_room_messages (
    room_id, turn_id, sender_telegram_id, role, sender_name, content,
    sequence_no, client_nonce
  ) values (
    v_room.id, v_turn_id, p_telegram_id, 'user', v_member.display_name, v_content,
    v_room.next_sequence, p_client_nonce
  );

  update public.nastardamus_oracle_rooms
  set
    next_sequence = next_sequence + 1,
    active_turn_id = v_turn_id,
    assistant_state = 'thinking',
    turn_started_at = now(),
    last_message_at = now(),
    updated_at = now()
  where id = v_room.id;

  return jsonb_build_object(
    'room_id', v_room.id,
    'token', v_room.token,
    'turn_id', v_turn_id,
    'replayed', false,
    'speaker_name', v_member.display_name,
    'content', v_content
  );
end;
$function$;

create or replace function public.nastardamus_complete_oracle_room_turn(
  p_token text,
  p_turn_id uuid,
  p_answer text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_room public.nastardamus_oracle_rooms%rowtype;
  v_answer text := left(trim(coalesce(p_answer, '')), 4000);
  v_message_id uuid;
begin
  if p_token is null or p_token !~ '^[a-f0-9]{32}$' then
    raise exception 'invalid_oracle_room_token';
  end if;
  if p_turn_id is null then
    raise exception 'invalid_oracle_room_turn';
  end if;
  if char_length(v_answer) < 2 then
    raise exception 'invalid_oracle_room_answer';
  end if;

  select * into v_room
  from public.nastardamus_oracle_rooms
  where token = p_token
  for update;

  if not found then
    raise exception 'oracle_room_not_found';
  end if;
  if v_room.active_turn_id is distinct from p_turn_id then
    raise exception 'oracle_room_turn_changed';
  end if;

  insert into public.nastardamus_oracle_room_messages (
    room_id, turn_id, role, sender_name, content, sequence_no
  ) values (
    v_room.id, p_turn_id, 'assistant', 'Эзотериум', v_answer, v_room.next_sequence
  )
  returning id into v_message_id;

  update public.nastardamus_oracle_rooms
  set
    next_sequence = next_sequence + 1,
    active_turn_id = null,
    assistant_state = 'idle',
    turn_started_at = null,
    last_message_at = now(),
    updated_at = now()
  where id = v_room.id;

  return jsonb_build_object(
    'room_id', v_room.id,
    'token', v_room.token,
    'turn_id', p_turn_id,
    'message_id', v_message_id
  );
end;
$function$;

create or replace function public.nastardamus_fail_oracle_room_turn(
  p_token text,
  p_turn_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_room_id uuid;
begin
  update public.nastardamus_oracle_rooms
  set
    active_turn_id = null,
    assistant_state = 'error',
    turn_started_at = null,
    updated_at = now()
  where token = p_token
    and active_turn_id = p_turn_id
  returning id into v_room_id;

  return jsonb_build_object('room_id', v_room_id, 'token', p_token);
end;
$function$;

create or replace function public.nastardamus_leave_oracle_room(
  p_token text,
  p_telegram_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_room public.nastardamus_oracle_rooms%rowtype;
  v_member public.nastardamus_oracle_room_members%rowtype;
begin
  select * into v_room
  from public.nastardamus_oracle_rooms
  where token = p_token
  for update;
  if not found then raise exception 'oracle_room_not_found'; end if;
  if v_room.owner_telegram_id = p_telegram_id then
    raise exception 'oracle_room_owner_must_close';
  end if;

  select * into v_member
  from public.nastardamus_oracle_room_members
  where room_id = v_room.id and telegram_id = p_telegram_id and status = 'active';
  if not found then raise exception 'oracle_room_access_denied'; end if;

  update public.nastardamus_oracle_room_members
  set status = 'left', palm_image_path = null, updated_at = now()
  where room_id = v_room.id and telegram_id = p_telegram_id;

  insert into public.nastardamus_oracle_room_messages (
    room_id, role, sender_name, content, sequence_no
  ) values (
    v_room.id, 'system', 'Пространство',
    v_member.display_name || ' покидает разговор.', v_room.next_sequence
  );

  update public.nastardamus_oracle_rooms
  set next_sequence = next_sequence + 1, last_message_at = now(), updated_at = now()
  where id = v_room.id;

  return jsonb_build_object('room_id', v_room.id, 'token', v_room.token);
end;
$function$;

create or replace function public.nastardamus_close_oracle_room(
  p_token text,
  p_owner_telegram_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_room_id uuid;
begin
  update public.nastardamus_oracle_rooms
  set
    status = 'closed',
    active_turn_id = null,
    assistant_state = 'idle',
    turn_started_at = null,
    closed_at = now(),
    updated_at = now()
  where token = p_token
    and owner_telegram_id = p_owner_telegram_id
    and status = 'active'
  returning id into v_room_id;

  if v_room_id is null then
    raise exception 'oracle_room_not_found';
  end if;

  update public.nastardamus_oracle_room_members
  set palm_image_path = null, updated_at = now()
  where room_id = v_room_id;

  return jsonb_build_object('room_id', v_room_id, 'token', p_token, 'status', 'closed');
end;
$function$;

create or replace function public.nastardamus_find_user_by_username(
  p_username text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_username text := lower(regexp_replace(trim(coalesce(p_username, '')), '^@', ''));
  v_user public.nastardamus_users%rowtype;
begin
  if v_username !~ '^[a-z0-9_]{5,32}$' then
    raise exception 'invalid_oracle_username';
  end if;

  select * into v_user
  from public.nastardamus_users
  where lower(username) = v_username
  limit 1;

  if not found then
    raise exception 'oracle_username_unavailable';
  end if;

  return jsonb_build_object(
    'telegram_id', v_user.telegram_id,
    'chat_id', v_user.chat_id,
    'username', v_user.username,
    'first_name', v_user.first_name
  );
end;
$function$;

revoke execute on function public.nastardamus_create_oracle_room(
  bigint, text, text, text, text, text, text, integer, text, text, text, text, boolean, boolean
) from public, anon, authenticated;
revoke execute on function public.nastardamus_join_oracle_room(
  text, bigint, text, text, text, boolean, boolean
) from public, anon, authenticated;
revoke execute on function public.nastardamus_invite_oracle_room_member(
  text, bigint, bigint, text, text
) from public, anon, authenticated;
revoke execute on function public.nastardamus_complete_oracle_room_preparation(
  text, bigint, text, text, text, text, jsonb
) from public, anon, authenticated;
revoke execute on function public.nastardamus_begin_oracle_room_turn(
  text, bigint, text, text
) from public, anon, authenticated;
revoke execute on function public.nastardamus_complete_oracle_room_turn(
  text, uuid, text
) from public, anon, authenticated;
revoke execute on function public.nastardamus_fail_oracle_room_turn(
  text, uuid
) from public, anon, authenticated;
revoke execute on function public.nastardamus_leave_oracle_room(
  text, bigint
) from public, anon, authenticated;
revoke execute on function public.nastardamus_close_oracle_room(
  text, bigint
) from public, anon, authenticated;
revoke execute on function public.nastardamus_find_user_by_username(
  text
) from public, anon, authenticated;

grant execute on function public.nastardamus_create_oracle_room(
  bigint, text, text, text, text, text, text, integer, text, text, text, text, boolean, boolean
) to service_role;
grant execute on function public.nastardamus_join_oracle_room(
  text, bigint, text, text, text, boolean, boolean
) to service_role;
grant execute on function public.nastardamus_invite_oracle_room_member(
  text, bigint, bigint, text, text
) to service_role;
grant execute on function public.nastardamus_complete_oracle_room_preparation(
  text, bigint, text, text, text, text, jsonb
) to service_role;
grant execute on function public.nastardamus_begin_oracle_room_turn(
  text, bigint, text, text
) to service_role;
grant execute on function public.nastardamus_complete_oracle_room_turn(
  text, uuid, text
) to service_role;
grant execute on function public.nastardamus_fail_oracle_room_turn(
  text, uuid
) to service_role;
grant execute on function public.nastardamus_leave_oracle_room(
  text, bigint
) to service_role;
grant execute on function public.nastardamus_close_oracle_room(
  text, bigint
) to service_role;
grant execute on function public.nastardamus_find_user_by_username(
  text
) to service_role;

comment on table public.nastardamus_oracle_rooms is
  'Private persistent solo, pair and group rooms for live dialogue with Esoterium.';
comment on table public.nastardamus_oracle_room_members is
  'Explicit room membership, relationship-analysis consent and palm-description state.';
comment on table public.nastardamus_oracle_room_messages is
  'Serialized multi-participant conversation transcript for an oracle room.';
