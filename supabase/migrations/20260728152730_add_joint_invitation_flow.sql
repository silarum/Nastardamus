create table if not exists public.nastardamus_joint_invitations (
  id uuid primary key default gen_random_uuid(),
  token text not null unique
    check (token ~ '^[a-f0-9]{32}$'),
  flow text not null
    check (flow in ('palm', 'photo')),
  goal text not null
    check (goal in ('love', 'friendship', 'business', 'creative')),
  initiator_telegram_id bigint not null
    check (initiator_telegram_id > 0),
  initiator_name text not null
    check (char_length(initiator_name) between 1 and 80),
  initiator_gender text not null default 'unspecified'
    check (initiator_gender in ('female', 'male', 'unspecified')),
  invitee_name text not null
    check (char_length(invitee_name) between 1 and 80),
  invitee_gender text not null
    check (invitee_gender in ('female', 'male')),
  participant_telegram_id bigint
    check (participant_telegram_id is null or participant_telegram_id > 0),
  participant_gender text
    check (participant_gender is null or participant_gender in ('female', 'male', 'unspecified')),
  status text not null default 'awaiting_participant'
    check (status in (
      'awaiting_participant',
      'ready',
      'awaiting_initiator_payment',
      'processing',
      'completed',
      'cancelled',
      'expired'
    )),
  payer_telegram_id bigint
    check (payer_telegram_id is null or payer_telegram_id > 0),
  payer_role text
    check (payer_role is null or payer_role in ('initiator', 'participant')),
  initiator_image_path text not null
    check (char_length(initiator_image_path) between 10 and 220),
  participant_image_path text
    check (participant_image_path is null or char_length(participant_image_path) between 10 and 220),
  result_text text,
  service_charge_id uuid,
  last_error text,
  participant_joined_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    participant_telegram_id is null
    or participant_telegram_id <> initiator_telegram_id
  )
);

create index if not exists nastardamus_joint_invitations_initiator_idx
  on public.nastardamus_joint_invitations (initiator_telegram_id, created_at desc);

create index if not exists nastardamus_joint_invitations_participant_idx
  on public.nastardamus_joint_invitations (participant_telegram_id, created_at desc)
  where participant_telegram_id is not null;

create index if not exists nastardamus_joint_invitations_expiry_idx
  on public.nastardamus_joint_invitations (expires_at)
  where status not in ('completed', 'cancelled', 'expired');

alter table public.nastardamus_joint_invitations enable row level security;
revoke all on table public.nastardamus_joint_invitations from public, anon, authenticated;
grant select, insert, update on table public.nastardamus_joint_invitations to service_role;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) values (
  'nastardamus-joint-photos',
  'nastardamus-joint-photos',
  false,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.nastardamus_claim_joint_invitation(
  p_token text,
  p_telegram_id bigint,
  p_payer_role text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_invitation public.nastardamus_joint_invitations%rowtype;
  v_expected_id bigint;
begin
  if p_token is null or p_token !~ '^[a-f0-9]{32}$' then
    raise exception 'invalid_invitation_token';
  end if;
  if p_telegram_id is null or p_telegram_id <= 0 then
    raise exception 'invalid_telegram_id';
  end if;
  if p_payer_role not in ('initiator', 'participant') then
    raise exception 'invalid_payer_role';
  end if;

  select *
  into v_invitation
  from public.nastardamus_joint_invitations
  where token = p_token
  for update;

  if not found then
    raise exception 'invitation_not_found';
  end if;
  if v_invitation.expires_at <= now() then
    update public.nastardamus_joint_invitations
    set status = 'expired', updated_at = now()
    where id = v_invitation.id;
    raise exception 'invitation_expired';
  end if;
  if v_invitation.status = 'completed' then
    raise exception 'invitation_already_completed';
  end if;
  if v_invitation.status = 'processing' then
    raise exception 'invitation_busy';
  end if;
  if v_invitation.status in ('cancelled', 'expired') then
    raise exception 'invitation_unavailable';
  end if;
  if v_invitation.participant_telegram_id is null
    or v_invitation.participant_image_path is null
  then
    raise exception 'invitation_not_ready';
  end if;

  v_expected_id := case p_payer_role
    when 'initiator' then v_invitation.initiator_telegram_id
    else v_invitation.participant_telegram_id
  end;

  if p_telegram_id <> v_expected_id then
    raise exception 'invitation_payer_mismatch';
  end if;
  if p_payer_role = 'initiator'
    and v_invitation.status not in ('ready', 'awaiting_initiator_payment')
  then
    raise exception 'initiator_payment_not_requested';
  end if;

  update public.nastardamus_joint_invitations
  set
    status = 'processing',
    payer_telegram_id = p_telegram_id,
    payer_role = p_payer_role,
    last_error = null,
    updated_at = now()
  where id = v_invitation.id
  returning * into v_invitation;

  return jsonb_build_object(
    'token', v_invitation.token,
    'flow', v_invitation.flow,
    'goal', v_invitation.goal,
    'initiator_telegram_id', v_invitation.initiator_telegram_id,
    'participant_telegram_id', v_invitation.participant_telegram_id,
    'initiator_name', v_invitation.initiator_name,
    'invitee_name', v_invitation.invitee_name,
    'initiator_gender', v_invitation.initiator_gender,
    'participant_gender', coalesce(v_invitation.participant_gender, v_invitation.invitee_gender),
    'initiator_image_path', v_invitation.initiator_image_path,
    'participant_image_path', v_invitation.participant_image_path,
    'payer_role', v_invitation.payer_role
  );
end;
$function$;

revoke execute on function public.nastardamus_claim_joint_invitation(
  text, bigint, text
) from public, anon, authenticated;
grant execute on function public.nastardamus_claim_joint_invitation(
  text, bigint, text
) to service_role;

create or replace function public.nastardamus_release_joint_invitation(
  p_token text,
  p_telegram_id bigint,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_invitation public.nastardamus_joint_invitations%rowtype;
begin
  update public.nastardamus_joint_invitations
  set
    status = case
      when payer_role = 'initiator' then 'awaiting_initiator_payment'
      else 'ready'
    end,
    last_error = left(coalesce(p_reason, 'reading_failed'), 160),
    updated_at = now()
  where token = p_token
    and payer_telegram_id = p_telegram_id
    and status = 'processing'
  returning * into v_invitation;

  if not found then
    raise exception 'invitation_processing_not_found';
  end if;

  return jsonb_build_object(
    'token', v_invitation.token,
    'status', v_invitation.status
  );
end;
$function$;

revoke execute on function public.nastardamus_release_joint_invitation(
  text, bigint, text
) from public, anon, authenticated;
grant execute on function public.nastardamus_release_joint_invitation(
  text, bigint, text
) to service_role;

create or replace function public.nastardamus_complete_joint_invitation(
  p_token text,
  p_telegram_id bigint,
  p_result_text text,
  p_service_charge_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_invitation public.nastardamus_joint_invitations%rowtype;
  v_charge public.nastardamus_service_orders%rowtype;
  v_expected_service text;
begin
  if p_result_text is null
    or char_length(trim(p_result_text)) < 40
    or char_length(p_result_text) > 12000
  then
    raise exception 'invalid_invitation_result';
  end if;

  select *
  into v_invitation
  from public.nastardamus_joint_invitations
  where token = p_token
    and payer_telegram_id = p_telegram_id
    and status = 'processing'
  for update;

  if not found then
    raise exception 'invitation_processing_not_found';
  end if;

  select *
  into v_charge
  from public.nastardamus_service_orders
  where id = p_service_charge_id
    and telegram_id = p_telegram_id
  for update;

  if not found then
    raise exception 'service_charge_not_found';
  end if;
  if v_charge.status = 'refunded' then
    raise exception 'service_charge_refunded';
  end if;
  if v_charge.status <> 'charged' then
    raise exception 'service_charge_not_ready';
  end if;
  v_expected_service := case
    when v_invitation.flow = 'palm' then 'palmlink'
    else 'photo_compatibility'
  end;
  if v_charge.service_id <> v_expected_service then
    raise exception 'service_charge_mismatch';
  end if;

  update public.nastardamus_joint_invitations
  set
    status = 'completed',
    result_text = trim(p_result_text),
    service_charge_id = p_service_charge_id,
    completed_at = now(),
    last_error = null,
    updated_at = now()
  where id = v_invitation.id
  returning * into v_invitation;

  update public.nastardamus_service_orders
  set
    status = 'fulfilled',
    fulfilled_at = now()
  where id = v_charge.id;

  return jsonb_build_object(
    'token', v_invitation.token,
    'status', v_invitation.status,
    'initiator_telegram_id', v_invitation.initiator_telegram_id,
    'participant_telegram_id', v_invitation.participant_telegram_id,
    'initiator_image_path', v_invitation.initiator_image_path,
    'participant_image_path', v_invitation.participant_image_path,
    'completed_at', v_invitation.completed_at
  );
end;
$function$;

revoke execute on function public.nastardamus_complete_joint_invitation(
  text, bigint, text, uuid
) from public, anon, authenticated;
grant execute on function public.nastardamus_complete_joint_invitation(
  text, bigint, text, uuid
) to service_role;
