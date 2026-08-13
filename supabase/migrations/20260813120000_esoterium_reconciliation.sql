-- Esoterium Reconciliation v1.
-- The public API never talks to these tables directly: all access is mediated by
-- a Telegram-authenticated Vercel function using the service role.

create extension if not exists pgcrypto;

create table if not exists public.nastardamus_reconciliation_cases (
  id uuid primary key default gen_random_uuid(),
  token text not null unique check (token ~ '^[a-f0-9]{32}$'),
  owner_telegram_id bigint not null check (owner_telegram_id > 0),
  create_idempotency_key text not null check (
    create_idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$'
  ),
  conflict_type text not null check (
    conflict_type in ('romantic', 'friendship', 'family', 'business', 'collective', 'other')
  ),
  participant_mode text not null check (participant_mode in ('pair', 'group')),
  participant_names jsonb not null default '[]'::jsonb check (
    jsonb_typeof(participant_names) = 'array'
    and jsonb_array_length(participant_names) between 2 and 10
    and octet_length(participant_names::text) <= 1200
  ),
  reason text not null check (
    reason in ('betrayal', 'misunderstanding', 'hurt', 'money', 'work', 'domestic', 'other')
  ),
  situation text not null default '' check (char_length(situation) <= 2000),
  goal text not null default 'understanding' check (
    goal in ('reconciliation', 'understanding', 'apology', 'forgiveness', 'shared_plan', 'other')
  ),
  payer_mode text not null check (payer_mode in ('initiator', 'second', 'each', 'group')),
  invitation_tone text not null default 'warm' check (
    invitation_tone in ('soft', 'serious', 'warm', 'energetic')
  ),
  status text not null default 'created' check (
    status in ('created', 'invited', 'waiting', 'active', 'analyzing', 'near_solution', 'resolved', 'rejected', 'expired', 'paused')
  ),
  stage text not null default 'opening' check (
    stage in ('opening', 'intake', 'analysis', 'tools', 'solution', 'agreement', 'completed')
  ),
  max_participants smallint not null check (max_participants between 2 and 10),
  next_sequence integer not null default 1 check (next_sequence >= 1),
  assistant_state text not null default 'idle' check (assistant_state in ('idle', 'thinking', 'error')),
  active_turn_id uuid,
  turn_started_at timestamptz,
  service_charge_id uuid,
  outcome_kind text check (
    outcome_kind is null or outcome_kind in ('reconciled', 'boundaries', 'respectful_closure')
  ),
  outcome_text text not null default '' check (char_length(outcome_text) <= 4000),
  invitation_expires_at timestamptz not null,
  last_message_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_telegram_id, create_idempotency_key),
  check (
    (participant_mode = 'pair' and max_participants = 2 and jsonb_array_length(participant_names) = 2)
    or (participant_mode = 'group' and max_participants between 3 and 10 and jsonb_array_length(participant_names) between 3 and 10)
  )
);

create table if not exists public.nastardamus_reconciliation_members (
  case_id uuid not null references public.nastardamus_reconciliation_cases(id) on delete cascade,
  telegram_id bigint not null check (telegram_id > 0),
  role text not null default 'participant' check (role in ('owner', 'participant', 'observer')),
  status text not null default 'invited' check (
    status in ('invited', 'active', 'later', 'rejected', 'left', 'removed')
  ),
  display_name text not null check (char_length(display_name) between 1 and 80),
  conflict_role text not null default '' check (char_length(conflict_role) <= 120),
  dialogue_consent_at timestamptz,
  private_answers jsonb not null default '{}'::jsonb check (
    jsonb_typeof(private_answers) = 'object' and octet_length(private_answers::text) <= 8000
  ),
  private_answered_at timestamptz,
  share_private_consent boolean not null default false,
  birth_date date,
  birth_time time,
  birth_place text not null default '' check (char_length(birth_place) <= 160),
  resolution_vote text check (
    resolution_vote is null or resolution_vote in ('reconciled', 'boundaries', 'respectful_closure')
  ),
  paid_charge_id uuid,
  joined_at timestamptz,
  last_read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (case_id, telegram_id),
  check (role <> 'observer' or resolution_vote is null)
);

create table if not exists public.nastardamus_reconciliation_messages (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.nastardamus_reconciliation_cases(id) on delete cascade,
  turn_id uuid,
  sender_telegram_id bigint check (sender_telegram_id is null or sender_telegram_id > 0),
  role text not null check (role in ('user', 'assistant', 'system')),
  sender_name text not null check (char_length(sender_name) between 1 and 80),
  visibility text not null default 'public' check (visibility in ('public', 'private')),
  recipient_telegram_id bigint,
  content text not null check (char_length(content) between 1 and 4000),
  sequence_no integer not null check (sequence_no >= 0),
  client_nonce text check (
    client_nonce is null or client_nonce ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$'
  ),
  metadata jsonb not null default '{}'::jsonb check (octet_length(metadata::text) <= 12000),
  created_at timestamptz not null default now(),
  unique (case_id, sequence_no),
  check (
    (visibility = 'public' and recipient_telegram_id is null)
    or (visibility = 'private' and recipient_telegram_id is not null)
  ),
  check (
    (role = 'user' and sender_telegram_id is not null)
    or (role in ('assistant', 'system') and sender_telegram_id is null)
  )
);

create table if not exists public.nastardamus_reconciliation_tools (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.nastardamus_reconciliation_cases(id) on delete cascade,
  tool_type text not null check (tool_type in ('runes', 'tarot', 'palmistry', 'astrology', 'combined')),
  requested_by bigint not null check (requested_by > 0),
  status text not null default 'proposed' check (status in ('proposed', 'ready', 'running', 'completed', 'cancelled', 'failed')),
  consents jsonb not null default '{}'::jsonb check (jsonb_typeof(consents) = 'object' and octet_length(consents::text) <= 4000),
  input jsonb not null default '{}'::jsonb check (jsonb_typeof(input) = 'object' and octet_length(input::text) <= 16000),
  result_text text not null default '' check (char_length(result_text) <= 4000),
  result_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(result_payload) = 'object' and octet_length(result_payload::text) <= 16000),
  service_charge_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create unique index if not exists nastardamus_reconciliation_message_nonce_idx
  on public.nastardamus_reconciliation_messages (case_id, sender_telegram_id, client_nonce)
  where sender_telegram_id is not null and client_nonce is not null;
create index if not exists nastardamus_reconciliation_owner_idx
  on public.nastardamus_reconciliation_cases (owner_telegram_id, updated_at desc);
create index if not exists nastardamus_reconciliation_status_idx
  on public.nastardamus_reconciliation_cases (status, updated_at desc);
create index if not exists nastardamus_reconciliation_member_idx
  on public.nastardamus_reconciliation_members (telegram_id, status, updated_at desc);
create index if not exists nastardamus_reconciliation_message_case_idx
  on public.nastardamus_reconciliation_messages (case_id, sequence_no desc);
create index if not exists nastardamus_reconciliation_tools_case_idx
  on public.nastardamus_reconciliation_tools (case_id, created_at desc);

alter table public.nastardamus_reconciliation_cases enable row level security;
alter table public.nastardamus_reconciliation_members enable row level security;
alter table public.nastardamus_reconciliation_messages enable row level security;
alter table public.nastardamus_reconciliation_tools enable row level security;

revoke all on public.nastardamus_reconciliation_cases from public, anon, authenticated;
revoke all on public.nastardamus_reconciliation_members from public, anon, authenticated;
revoke all on public.nastardamus_reconciliation_messages from public, anon, authenticated;
revoke all on public.nastardamus_reconciliation_tools from public, anon, authenticated;
grant select, insert, update, delete on public.nastardamus_reconciliation_cases to service_role;
grant select, insert, update, delete on public.nastardamus_reconciliation_members to service_role;
grant select, insert, update, delete on public.nastardamus_reconciliation_messages to service_role;
grant select, insert, update, delete on public.nastardamus_reconciliation_tools to service_role;

create or replace function public.nastardamus_create_reconciliation(
  p_owner_telegram_id bigint,
  p_owner_name text,
  p_idempotency_key text,
  p_conflict_type text,
  p_participant_mode text,
  p_participant_names jsonb,
  p_reason text,
  p_situation text,
  p_goal text,
  p_payer_mode text,
  p_invitation_tone text,
  p_invitation_hours integer,
  p_service_charge_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_case_id uuid := gen_random_uuid();
  v_token text := replace(gen_random_uuid()::text, '-', '');
  v_name text := left(regexp_replace(trim(coalesce(p_owner_name, '')), '\s+', ' ', 'g'), 80);
  v_names jsonb := coalesce(p_participant_names, '[]'::jsonb);
  v_count integer;
  v_existing public.nastardamus_reconciliation_cases%rowtype;
begin
  if p_owner_telegram_id is null or p_owner_telegram_id <= 0 then raise exception 'invalid_telegram_id'; end if;
  if char_length(v_name) < 1 then raise exception 'invalid_reconciliation_name'; end if;
  if p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$' then
    raise exception 'invalid_idempotency_key';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    p_owner_telegram_id::text || ':reconciliation:' || p_idempotency_key, 0
  ));
  select * into v_existing from public.nastardamus_reconciliation_cases
  where owner_telegram_id = p_owner_telegram_id and create_idempotency_key = p_idempotency_key limit 1;
  if found then
    return jsonb_build_object('case_id', v_existing.id, 'token', v_existing.token, 'replayed', true);
  end if;

  if jsonb_typeof(v_names) <> 'array' then raise exception 'invalid_reconciliation_participants'; end if;
  v_count := jsonb_array_length(v_names);
  if p_participant_mode = 'pair' and v_count <> 2 then raise exception 'invalid_reconciliation_participants'; end if;
  if p_participant_mode = 'group' and (v_count < 3 or v_count > 10) then raise exception 'invalid_reconciliation_participants'; end if;
  if exists (
    select 1 from jsonb_array_elements_text(v_names) as item(value)
    where char_length(trim(item.value)) not between 1 and 80
  ) or (
    select count(distinct lower(trim(item.value))) from jsonb_array_elements_text(v_names) as item(value)
  ) <> v_count then raise exception 'invalid_reconciliation_participants'; end if;
  if p_conflict_type not in ('romantic', 'friendship', 'family', 'business', 'collective', 'other')
    or p_reason not in ('betrayal', 'misunderstanding', 'hurt', 'money', 'work', 'domestic', 'other')
    or p_goal not in ('reconciliation', 'understanding', 'apology', 'forgiveness', 'shared_plan', 'other')
    or p_payer_mode not in ('initiator', 'second', 'each', 'group')
    or p_invitation_tone not in ('soft', 'serious', 'warm', 'energetic')
  then raise exception 'invalid_reconciliation_fields'; end if;

  insert into public.nastardamus_reconciliation_cases (
    id, token, owner_telegram_id, create_idempotency_key, conflict_type,
    participant_mode, participant_names, reason, situation, goal, payer_mode,
    invitation_tone, status, max_participants, service_charge_id, invitation_expires_at
  ) values (
    v_case_id, v_token, p_owner_telegram_id, p_idempotency_key, p_conflict_type,
    p_participant_mode, v_names, p_reason, left(trim(coalesce(p_situation, '')), 2000),
    p_goal, p_payer_mode, p_invitation_tone, 'invited', v_count, p_service_charge_id,
    now() + make_interval(hours => greatest(1, least(720, coalesce(p_invitation_hours, 72))))
  );

  insert into public.nastardamus_reconciliation_members (
    case_id, telegram_id, role, status, display_name, dialogue_consent_at, joined_at, last_read_at
  ) values (v_case_id, p_owner_telegram_id, 'owner', 'active', v_name, now(), now(), now());

  insert into public.nastardamus_reconciliation_messages (
    case_id, role, sender_name, visibility, content, sequence_no, metadata
  ) values (
    v_case_id, 'system', 'Эзотериум', 'public',
    'Комната примирения создана. Диалог начнётся после добровольного согласия приглашённых участников.',
    0, jsonb_build_object('kind', 'room_created')
  );

  return jsonb_build_object('case_id', v_case_id, 'token', v_token, 'replayed', false);
end;
$function$;

create or replace function public.nastardamus_join_reconciliation(
  p_token text,
  p_telegram_id bigint,
  p_display_name text,
  p_conflict_role text,
  p_decision text,
  p_as_observer boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_case public.nastardamus_reconciliation_cases%rowtype;
  v_name text := left(regexp_replace(trim(coalesce(p_display_name, '')), '\s+', ' ', 'g'), 80);
  v_count integer;
  v_status text;
begin
  if p_token is null or p_token !~ '^[a-f0-9]{32}$' then raise exception 'invalid_reconciliation_token'; end if;
  if p_telegram_id is null or p_telegram_id <= 0 then raise exception 'invalid_telegram_id'; end if;
  if char_length(v_name) < 1 then raise exception 'invalid_reconciliation_name'; end if;
  if p_decision not in ('accept', 'later', 'reject') then raise exception 'invalid_reconciliation_decision'; end if;

  select * into v_case from public.nastardamus_reconciliation_cases where token = p_token for update;
  if not found then raise exception 'reconciliation_not_found'; end if;
  if v_case.status in ('resolved', 'rejected', 'expired') then raise exception 'reconciliation_unavailable'; end if;
  if v_case.invitation_expires_at <= now() and v_case.status in ('created', 'invited', 'waiting') then
    update public.nastardamus_reconciliation_cases set status = 'expired', updated_at = now() where id = v_case.id;
    raise exception 'reconciliation_expired';
  end if;

  if p_decision = 'reject' then
    v_status := 'rejected';
  elsif p_decision = 'later' then
    v_status := 'later';
  else
    v_status := 'active';
  end if;

  select count(*) into v_count from public.nastardamus_reconciliation_members
  where case_id = v_case.id and status = 'active' and role <> 'observer';
  if p_decision = 'accept' and p_as_observer is not true and v_count >= v_case.max_participants then
    raise exception 'reconciliation_full';
  end if;

  insert into public.nastardamus_reconciliation_members (
    case_id, telegram_id, role, status, display_name, conflict_role,
    dialogue_consent_at, joined_at, last_read_at, updated_at
  ) values (
    v_case.id, p_telegram_id, case when p_as_observer then 'observer' else 'participant' end,
    v_status, v_name, left(trim(coalesce(p_conflict_role, '')), 120),
    case when p_decision = 'accept' then now() end,
    case when p_decision = 'accept' then now() end, now(), now()
  ) on conflict (case_id, telegram_id) do update set
    role = case when p_as_observer then 'observer' else public.nastardamus_reconciliation_members.role end,
    status = excluded.status,
    display_name = excluded.display_name,
    conflict_role = excluded.conflict_role,
    dialogue_consent_at = excluded.dialogue_consent_at,
    joined_at = coalesce(public.nastardamus_reconciliation_members.joined_at, excluded.joined_at),
    last_read_at = now(), updated_at = now();

  select count(*) into v_count from public.nastardamus_reconciliation_members
  where case_id = v_case.id and status = 'active' and role <> 'observer';

  update public.nastardamus_reconciliation_cases set
    status = case
      when p_decision = 'reject' and participant_mode = 'pair' then 'rejected'
      when p_decision = 'reject' then case when status = 'active' then 'active' else 'waiting' end
      when p_decision = 'later' then 'waiting'
      when p_decision = 'accept' and p_as_observer is not true and v_count >= max_participants then 'active'
      when p_decision = 'accept' and status in ('created', 'invited', 'waiting') then 'waiting'
      else status
    end,
    stage = case when p_decision = 'accept' and stage = 'opening' then 'intake' else stage end,
    updated_at = now()
  where id = v_case.id;

  return jsonb_build_object('case_id', v_case.id, 'token', v_case.token, 'decision', p_decision);
end;
$function$;

create or replace function public.nastardamus_begin_reconciliation_turn(
  p_token text,
  p_telegram_id bigint,
  p_content text,
  p_visibility text,
  p_client_nonce text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_case public.nastardamus_reconciliation_cases%rowtype;
  v_member public.nastardamus_reconciliation_members%rowtype;
  v_existing public.nastardamus_reconciliation_messages%rowtype;
  v_answer text;
  v_turn_id uuid := gen_random_uuid();
  v_content text := left(trim(coalesce(p_content, '')), 2000);
begin
  if p_token is null or p_token !~ '^[a-f0-9]{32}$' then raise exception 'invalid_reconciliation_token'; end if;
  if char_length(v_content) < 2 then raise exception 'invalid_reconciliation_message'; end if;
  if p_visibility not in ('public', 'private') then raise exception 'invalid_reconciliation_visibility'; end if;
  if p_client_nonce is null or p_client_nonce !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$' then raise exception 'invalid_idempotency_key'; end if;

  select * into v_case from public.nastardamus_reconciliation_cases where token = p_token for update;
  if not found then raise exception 'reconciliation_not_found'; end if;
  if v_case.status not in ('active', 'analyzing', 'near_solution') then raise exception 'reconciliation_not_active'; end if;
  select * into v_member from public.nastardamus_reconciliation_members
  where case_id = v_case.id and telegram_id = p_telegram_id and status = 'active';
  if not found or v_member.role = 'observer' then raise exception 'reconciliation_write_denied'; end if;

  select * into v_existing from public.nastardamus_reconciliation_messages
  where case_id = v_case.id and sender_telegram_id = p_telegram_id and client_nonce = p_client_nonce limit 1;
  if found then
    select content into v_answer from public.nastardamus_reconciliation_messages
    where case_id = v_case.id and turn_id = v_existing.turn_id and role = 'assistant' limit 1;
    return jsonb_build_object('case_id', v_case.id, 'turn_id', v_existing.turn_id, 'content', v_existing.content, 'answer', v_answer, 'replayed', true);
  end if;

  if v_case.assistant_state = 'thinking' and v_case.turn_started_at > now() - interval '2 minutes' then
    raise exception 'reconciliation_busy';
  end if;

  insert into public.nastardamus_reconciliation_messages (
    case_id, turn_id, sender_telegram_id, role, sender_name, visibility,
    recipient_telegram_id, content, sequence_no, client_nonce
  ) values (
    v_case.id, v_turn_id, p_telegram_id, 'user', v_member.display_name, p_visibility,
    case when p_visibility = 'private' then p_telegram_id end,
    v_content, v_case.next_sequence, p_client_nonce
  );
  update public.nastardamus_reconciliation_cases set
    next_sequence = next_sequence + 1, active_turn_id = v_turn_id,
    assistant_state = 'thinking', turn_started_at = now(), last_message_at = now(), updated_at = now()
  where id = v_case.id;
  return jsonb_build_object('case_id', v_case.id, 'turn_id', v_turn_id, 'content', v_content, 'replayed', false);
end;
$function$;

create or replace function public.nastardamus_complete_reconciliation_turn(
  p_token text,
  p_turn_id uuid,
  p_answer text,
  p_visibility text,
  p_recipient_telegram_id bigint default null,
  p_stage text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_case public.nastardamus_reconciliation_cases%rowtype;
  v_answer text := left(trim(coalesce(p_answer, '')), 4000);
begin
  if p_token is null or p_token !~ '^[a-f0-9]{32}$' then raise exception 'invalid_reconciliation_token'; end if;
  if char_length(v_answer) < 2 then raise exception 'invalid_reconciliation_answer'; end if;
  if p_visibility not in ('public', 'private') then raise exception 'invalid_reconciliation_visibility'; end if;
  if p_visibility = 'private' and (p_recipient_telegram_id is null or p_recipient_telegram_id <= 0) then
    raise exception 'invalid_reconciliation_recipient';
  end if;
  if p_stage is not null and p_stage not in ('opening', 'intake', 'analysis', 'tools', 'solution', 'agreement', 'completed') then
    raise exception 'invalid_reconciliation_stage';
  end if;

  select * into v_case from public.nastardamus_reconciliation_cases where token = p_token for update;
  if not found then raise exception 'reconciliation_not_found'; end if;
  if v_case.active_turn_id is distinct from p_turn_id then raise exception 'reconciliation_turn_changed'; end if;

  insert into public.nastardamus_reconciliation_messages (
    case_id, turn_id, role, sender_name, visibility, recipient_telegram_id,
    content, sequence_no, metadata
  ) values (
    v_case.id, p_turn_id, 'assistant', 'Эзотериум', p_visibility,
    case when p_visibility = 'private' then p_recipient_telegram_id end,
    v_answer, v_case.next_sequence, jsonb_build_object('kind', 'mediator_answer')
  );
  update public.nastardamus_reconciliation_cases set
    next_sequence = next_sequence + 1, active_turn_id = null, assistant_state = 'idle',
    turn_started_at = null, stage = coalesce(p_stage, stage),
    status = case
      when p_stage = 'tools' then 'analyzing'
      when p_stage in ('solution', 'agreement') then 'near_solution'
      else status
    end,
    last_message_at = now(), updated_at = now()
  where id = v_case.id;
  return jsonb_build_object('case_id', v_case.id, 'token', v_case.token);
end;
$function$;

create or replace function public.nastardamus_finalize_reconciliation(
  p_token text,
  p_outcome_kind text,
  p_outcome_text text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_case public.nastardamus_reconciliation_cases%rowtype;
  v_outcome text := left(trim(coalesce(p_outcome_text, '')), 4000);
  v_participant_count integer;
  v_matching_count integer;
begin
  if p_token is null or p_token !~ '^[a-f0-9]{32}$' then raise exception 'invalid_reconciliation_token'; end if;
  if p_outcome_kind not in ('reconciled', 'boundaries', 'respectful_closure') then raise exception 'invalid_reconciliation_vote'; end if;
  if char_length(v_outcome) < 2 then raise exception 'invalid_reconciliation_answer'; end if;

  select * into v_case from public.nastardamus_reconciliation_cases where token = p_token for update;
  if not found then raise exception 'reconciliation_not_found'; end if;
  if v_case.status = 'resolved' then
    return jsonb_build_object('case_id', v_case.id, 'token', v_case.token, 'replayed', true);
  end if;
  if v_case.status not in ('active', 'analyzing', 'near_solution') then raise exception 'reconciliation_not_active'; end if;

  select count(*), count(*) filter (where resolution_vote = p_outcome_kind)
    into v_participant_count, v_matching_count
  from public.nastardamus_reconciliation_members
  where case_id = v_case.id and status = 'active' and role <> 'observer';
  if v_participant_count < 2 or v_matching_count <> v_participant_count then
    raise exception 'reconciliation_resolution_consent_required';
  end if;

  insert into public.nastardamus_reconciliation_messages (
    case_id, role, sender_name, visibility, content, sequence_no, metadata
  ) values (
    v_case.id, 'assistant', 'Эзотериум', 'public', v_outcome, v_case.next_sequence,
    jsonb_build_object('kind', 'resolution', 'outcome', p_outcome_kind)
  );
  update public.nastardamus_reconciliation_cases set
    status = 'resolved', stage = 'completed', outcome_kind = p_outcome_kind,
    outcome_text = v_outcome, resolved_at = now(), next_sequence = next_sequence + 1,
    assistant_state = 'idle', active_turn_id = null, turn_started_at = null,
    last_message_at = now(), updated_at = now()
  where id = v_case.id;
  return jsonb_build_object('case_id', v_case.id, 'token', v_case.token, 'replayed', false);
end;
$function$;

revoke execute on function public.nastardamus_create_reconciliation(bigint,text,text,text,text,jsonb,text,text,text,text,text,integer,uuid) from public, anon, authenticated;
revoke execute on function public.nastardamus_join_reconciliation(text,bigint,text,text,text,boolean) from public, anon, authenticated;
revoke execute on function public.nastardamus_begin_reconciliation_turn(text,bigint,text,text,text) from public, anon, authenticated;
revoke execute on function public.nastardamus_complete_reconciliation_turn(text,uuid,text,text,bigint,text) from public, anon, authenticated;
revoke execute on function public.nastardamus_finalize_reconciliation(text,text,text) from public, anon, authenticated;
grant execute on function public.nastardamus_create_reconciliation(bigint,text,text,text,text,jsonb,text,text,text,text,text,integer,uuid) to service_role;
grant execute on function public.nastardamus_join_reconciliation(text,bigint,text,text,text,boolean) to service_role;
grant execute on function public.nastardamus_begin_reconciliation_turn(text,bigint,text,text,text) to service_role;
grant execute on function public.nastardamus_complete_reconciliation_turn(text,uuid,text,text,bigint,text) to service_role;
grant execute on function public.nastardamus_finalize_reconciliation(text,text,text) to service_role;
