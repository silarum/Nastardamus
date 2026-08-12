create index if not exists nastardamus_oracle_room_messages_turn_idx
  on public.nastardamus_oracle_room_messages (room_id, turn_id)
  where turn_id is not null;

alter table public.nastardamus_oracle_rooms
  add column if not exists reading_section text not null default 'palm'
    check (reading_section in ('general', 'path', 'event', 'amur', 'tarot', 'runes', 'palm'));

alter table public.nastardamus_reading_sessions
  drop constraint if exists nastardamus_reading_sessions_kind_check;

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
      'sports',
      'path'
    ));

create index if not exists nastardamus_oracle_room_messages_user_questions_idx
  on public.nastardamus_oracle_room_messages (room_id, sender_telegram_id, turn_id)
  where role = 'user' and sender_telegram_id is not null;

create or replace function public.nastardamus_oracle_room_question_usage(
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
  v_answered_questions integer := 0;
begin
  if p_token is null or p_token !~ '^[a-f0-9]{32}$' then
    raise exception 'invalid_oracle_room_token';
  end if;
  if p_telegram_id is null or p_telegram_id <= 0 then
    raise exception 'invalid_telegram_id';
  end if;

  select * into v_room
  from public.nastardamus_oracle_rooms
  where token = p_token;
  if not found then raise exception 'oracle_room_not_found'; end if;

  select * into v_member
  from public.nastardamus_oracle_room_members
  where room_id = v_room.id
    and telegram_id = p_telegram_id
    and status = 'active';
  if not found then raise exception 'oracle_room_access_denied'; end if;

  select count(*)::integer into v_answered_questions
  from public.nastardamus_oracle_room_messages as question
  where question.room_id = v_room.id
    and question.sender_telegram_id = p_telegram_id
    and question.role = 'user'
    and coalesce(question.metadata->>'message_kind', 'question') = 'question'
    and exists (
      select 1
      from public.nastardamus_oracle_room_messages as answer
      where answer.room_id = question.room_id
        and answer.turn_id = question.turn_id
        and answer.role = 'assistant'
    );

  return jsonb_build_object(
    'room_id', v_room.id,
    'mode', v_room.mode,
    'answered_questions', v_answered_questions
  );
end;
$function$;

revoke all on function public.nastardamus_oracle_room_question_usage(text, bigint)
  from public, anon, authenticated;
grant execute on function public.nastardamus_oracle_room_question_usage(text, bigint)
  to service_role;

alter table public.nastardamus_reading_messages
  add column if not exists turn_id uuid,
  add column if not exists message_kind text not null default 'question'
    check (message_kind in ('question', 'answer', 'guided')),
  add column if not exists client_nonce text
    check (client_nonce is null or client_nonce ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$');

create index if not exists nastardamus_reading_messages_turn_idx
  on public.nastardamus_reading_messages (session_id, turn_id)
  where turn_id is not null;

create unique index if not exists nastardamus_reading_messages_nonce_idx
  on public.nastardamus_reading_messages (session_id, telegram_id, client_nonce)
  where client_nonce is not null;

create or replace function public.nastardamus_reading_dialogue_usage(
  p_session_id uuid,
  p_telegram_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_session public.nastardamus_reading_sessions%rowtype;
  v_questions integer := 0;
begin
  if p_session_id is null or p_telegram_id is null or p_telegram_id <= 0 then
    raise exception 'invalid_reading_dialogue';
  end if;
  select * into v_session
  from public.nastardamus_reading_sessions
  where id = p_session_id
    and telegram_id = p_telegram_id
    and deleted_at is null;
  if not found then raise exception 'reading_not_found'; end if;

  select count(*)::integer into v_questions
  from public.nastardamus_reading_messages as question
  where question.session_id = v_session.id
    and question.telegram_id = p_telegram_id
    and question.role = 'user'
    and question.message_kind = 'question'
    and exists (
      select 1
      from public.nastardamus_reading_messages as answer
      where answer.session_id = question.session_id
        and answer.turn_id = question.turn_id
        and answer.role = 'assistant'
    );
  return jsonb_build_object('reading_id', v_session.id, 'answered_questions', v_questions);
end;
$function$;

create or replace function public.nastardamus_append_reading_dialogue_turn(
  p_session_id uuid,
  p_telegram_id bigint,
  p_message text,
  p_answer text,
  p_message_kind text,
  p_client_nonce text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_session public.nastardamus_reading_sessions%rowtype;
  v_existing public.nastardamus_reading_messages%rowtype;
  v_answer public.nastardamus_reading_messages%rowtype;
  v_turn_id uuid := gen_random_uuid();
  v_sequence integer;
  v_kind text := lower(trim(coalesce(p_message_kind, 'question')));
  v_message text := left(trim(coalesce(p_message, '')), 2000);
  v_answer_text text := left(trim(coalesce(p_answer, '')), 2000);
begin
  if p_session_id is null or p_telegram_id is null or p_telegram_id <= 0 then
    raise exception 'invalid_reading_dialogue';
  end if;
  if v_kind not in ('question', 'answer', 'guided') then raise exception 'invalid_dialogue_message_kind'; end if;
  if char_length(v_message) < 2 or char_length(v_answer_text) < 2 then raise exception 'invalid_reading_dialogue_message'; end if;
  if p_client_nonce is null or p_client_nonce !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$' then
    raise exception 'invalid_idempotency_key';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('reading-dialogue:' || p_session_id::text, 0)
  );
  select * into v_session
  from public.nastardamus_reading_sessions
  where id = p_session_id
    and telegram_id = p_telegram_id
    and deleted_at is null
    and state in ('completed', 'dialogue', 'analyzing');
  if not found then raise exception 'reading_not_found'; end if;

  select * into v_existing
  from public.nastardamus_reading_messages
  where session_id = p_session_id
    and telegram_id = p_telegram_id
    and client_nonce = p_client_nonce
  limit 1;
  if found then
    select * into v_answer
    from public.nastardamus_reading_messages
    where session_id = p_session_id
      and turn_id = v_existing.turn_id
      and role = 'assistant'
    limit 1;
    return jsonb_build_object(
      'reading_id', p_session_id,
      'turn_id', v_existing.turn_id,
      'answer', v_answer.content,
      'replayed', true
    );
  end if;

  select coalesce(max(sequence_no), -1) + 1 into v_sequence
  from public.nastardamus_reading_messages
  where session_id = p_session_id;

  insert into public.nastardamus_reading_messages (
    session_id, telegram_id, role, content, sequence_no, turn_id, message_kind, client_nonce
  ) values (
    p_session_id, p_telegram_id, 'user', v_message, v_sequence, v_turn_id, v_kind, p_client_nonce
  );
  insert into public.nastardamus_reading_messages (
    session_id, telegram_id, role, content, sequence_no, turn_id, message_kind
  ) values (
    p_session_id, p_telegram_id, 'assistant', v_answer_text, v_sequence + 1, v_turn_id, v_kind
  );
  update public.nastardamus_reading_sessions
  set updated_at = now()
  where id = p_session_id;

  return jsonb_build_object(
    'reading_id', p_session_id,
    'turn_id', v_turn_id,
    'answer', v_answer_text,
    'replayed', false
  );
end;
$function$;

revoke all on function public.nastardamus_reading_dialogue_usage(uuid, bigint)
  from public, anon, authenticated;
revoke all on function public.nastardamus_append_reading_dialogue_turn(uuid, bigint, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.nastardamus_reading_dialogue_usage(uuid, bigint)
  to service_role;
grant execute on function public.nastardamus_append_reading_dialogue_turn(uuid, bigint, text, text, text, text)
  to service_role;

create or replace function public.nastardamus_complete_oracle_room_text_preparation(
  p_token text,
  p_telegram_id bigint,
  p_private_answers jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_room public.nastardamus_oracle_rooms%rowtype;
  v_answers jsonb := coalesce(p_private_answers, '{}'::jsonb);
  v_active_count integer := 0;
  v_ready_count integer := 0;
  v_newly_opened boolean := false;
begin
  if p_token is null or p_token !~ '^[a-f0-9]{32}$' then raise exception 'invalid_oracle_room_token'; end if;
  if p_telegram_id is null or p_telegram_id <= 0 then raise exception 'invalid_telegram_id'; end if;
  if jsonb_typeof(v_answers) <> 'object' or octet_length(v_answers::text) > 4000 then
    raise exception 'invalid_oracle_private_answers';
  end if;
  if char_length(trim(coalesce(v_answers ->> 'connection', ''))) < 4
    or char_length(trim(coalesce(v_answers ->> 'tension', ''))) < 4
    or char_length(trim(coalesce(v_answers ->> 'future', ''))) < 4
    or char_length(trim(coalesce(v_answers ->> 'personalQuestion', ''))) < 4
  then
    raise exception 'oracle_room_preparation_incomplete';
  end if;

  select * into v_room
  from public.nastardamus_oracle_rooms
  where token = p_token
  for update;
  if not found then raise exception 'oracle_room_not_found'; end if;
  if v_room.status <> 'active' then raise exception 'oracle_room_closed'; end if;
  if v_room.mode <> 'group' or v_room.reading_section = 'palm' then
    raise exception 'oracle_room_text_preparation_unavailable';
  end if;
  if not exists (
    select 1 from public.nastardamus_oracle_room_members
    where room_id = v_room.id and telegram_id = p_telegram_id and status = 'active'
  ) then
    raise exception 'oracle_room_access_denied';
  end if;

  update public.nastardamus_oracle_room_members
  set
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

  if v_room.ritual_state = 'preparing'
    and v_active_count >= 3
    and v_active_count = v_ready_count
  then
    insert into public.nastardamus_oracle_room_messages (
      room_id, role, sender_name, content, sequence_no, metadata
    ) values (
      v_room.id, 'system', 'Пространство',
      'Все участники завершили закрытую подготовку. Эзотериум открывает групповой расклад.',
      v_room.next_sequence,
      jsonb_build_object('kind', 'preparation_complete', 'section', v_room.reading_section)
    );
    update public.nastardamus_oracle_rooms
    set ritual_state = 'opened', next_sequence = next_sequence + 1,
      last_message_at = now(), updated_at = now()
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

revoke all on function public.nastardamus_complete_oracle_room_text_preparation(text, bigint, jsonb)
  from public, anon, authenticated;
grant execute on function public.nastardamus_complete_oracle_room_text_preparation(text, bigint, jsonb)
  to service_role;
