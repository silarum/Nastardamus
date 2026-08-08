create or replace function public.nastardamus_complete_joint_invitation_access(
  p_token text,
  p_telegram_id bigint,
  p_result_text text,
  p_access_source text,
  p_free_usage_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_invitation public.nastardamus_joint_invitations%rowtype;
  v_settings jsonb := '{}'::jsonb;
  v_expected_free_key text;
begin
  if p_result_text is null
    or char_length(trim(p_result_text)) < 40
    or char_length(p_result_text) > 12000
  then
    raise exception 'invalid_invitation_result';
  end if;

  if p_access_source not in ('global_free', 'vip', 'free_check') then
    raise exception 'invalid_reading_access';
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

  select coalesce(settings, '{}'::jsonb)
  into v_settings
  from public.nastardamus_settings
  where key = 'global';

  if p_access_source = 'global_free' then
    if coalesce((v_settings->>'everythingFree')::boolean, false) is not true then
      raise exception 'global_free_disabled';
    end if;
  elsif p_access_source = 'vip' then
    if not exists (
      select 1
      from public.nastardamus_vip_subscriptions
      where telegram_id = p_telegram_id
        and status = 'active'
        and expires_at > now()
    ) then
      raise exception 'vip_required';
    end if;
  else
    v_expected_free_key := 'compatibility:' || case
      when v_invitation.flow = 'palm' then 'palm'
      else 'photo'
    end;
    if p_free_usage_key is null
      or p_free_usage_key <> v_expected_free_key
      or not exists (
        select 1
        from public.nastardamus_free_usage
        where telegram_id = p_telegram_id
          and service_id = p_free_usage_key
          and usage_date = current_date
          and uses > 0
      )
    then
      raise exception 'free_usage_not_claimed';
    end if;
  end if;

  update public.nastardamus_joint_invitations
  set
    status = 'completed',
    result_text = trim(p_result_text),
    service_charge_id = null,
    completed_at = now(),
    last_error = null,
    updated_at = now()
  where id = v_invitation.id
  returning * into v_invitation;

  return jsonb_build_object(
    'token', v_invitation.token,
    'status', v_invitation.status,
    'access_source', p_access_source,
    'initiator_telegram_id', v_invitation.initiator_telegram_id,
    'participant_telegram_id', v_invitation.participant_telegram_id,
    'initiator_image_path', v_invitation.initiator_image_path,
    'participant_image_path', v_invitation.participant_image_path,
    'completed_at', v_invitation.completed_at
  );
end;
$function$;

revoke execute on function public.nastardamus_complete_joint_invitation_access(
  text, bigint, text, text, text
) from public, anon, authenticated;
grant execute on function public.nastardamus_complete_joint_invitation_access(
  text, bigint, text, text, text
) to service_role;
