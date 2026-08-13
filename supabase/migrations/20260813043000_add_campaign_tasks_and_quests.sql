-- Admin-authored Tasks and Quests. The Telegram-authenticated Vercel API is
-- the only public entry point; tables and RPC stay service-role only.

create table if not exists public.nastardamus_campaigns (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('task','quest')),
  title text not null check (char_length(title) between 3 and 120),
  description text not null check (char_length(description) between 3 and 1200),
  action_url text,
  poster_url text,
  status text not null default 'draft' check (status in ('draft','active','paused','completed','archived')),
  total_slots integer not null default 1 check (total_slots between 1 and 1000000),
  remaining_slots integer not null default 1 check (remaining_slots between 0 and 1000000),
  reward_units bigint not null default 0 check (reward_units between 0 and 100000000),
  prize_units bigint not null default 0 check (prize_units between 0 and 100000000),
  answer_hash text,
  winner_telegram_id bigint,
  winner_entry_id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by bigint not null check (created_by > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  check (action_url is null or action_url ~ '^https://'),
  check (poster_url is null or poster_url ~ '^https://'),
  check (kind = 'task' or answer_hash ~ '^[a-f0-9]{64}$'),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create table if not exists public.nastardamus_campaign_entries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.nastardamus_campaigns(id) on delete cascade,
  telegram_id bigint not null check (telegram_id > 0),
  answer_preview text,
  answer_hash text,
  status text not null check (status in ('completed','incorrect','winner')),
  reward_units bigint not null default 0 check (reward_units >= 0),
  created_at timestamptz not null default now(),
  unique (campaign_id, telegram_id)
);

create index if not exists nastardamus_campaigns_active_idx
  on public.nastardamus_campaigns (kind, status, created_at desc);
create index if not exists nastardamus_campaign_entries_user_idx
  on public.nastardamus_campaign_entries (telegram_id, created_at desc);

alter table public.nastardamus_campaigns enable row level security;
alter table public.nastardamus_campaign_entries enable row level security;
revoke all on table public.nastardamus_campaigns from public, anon, authenticated;
revoke all on table public.nastardamus_campaign_entries from public, anon, authenticated;
grant select, insert, update, delete on table public.nastardamus_campaigns to service_role;
grant select, insert, update, delete on table public.nastardamus_campaign_entries to service_role;

create or replace function public.nastardamus_submit_campaign(
  p_campaign_id uuid,
  p_telegram_id bigint,
  p_answer_hash text default null,
  p_answer_preview text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_campaign public.nastardamus_campaigns%rowtype;
  v_existing public.nastardamus_campaign_entries%rowtype;
  v_entry public.nastardamus_campaign_entries%rowtype;
  v_status text;
  v_reward_units bigint := 0;
  v_wallet public.nastardamus_wallets%rowtype;
begin
  if p_telegram_id is null or p_telegram_id <= 0 then raise exception 'invalid_telegram_id'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_campaign_id::text, 0));

  select * into v_existing from public.nastardamus_campaign_entries
  where campaign_id = p_campaign_id and telegram_id = p_telegram_id limit 1;
  if found then
    return jsonb_build_object('entryId', v_existing.id, 'status', v_existing.status,
      'rewardUnits', v_existing.reward_units, 'replayed', true);
  end if;

  select * into v_campaign from public.nastardamus_campaigns
  where id = p_campaign_id for update;
  if not found then raise exception 'campaign_not_found'; end if;
  if v_campaign.status <> 'active' then raise exception 'campaign_not_active'; end if;
  if v_campaign.starts_at is not null and v_campaign.starts_at > now() then raise exception 'campaign_not_started'; end if;
  if v_campaign.ends_at is not null and v_campaign.ends_at <= now() then raise exception 'campaign_ended'; end if;
  if v_campaign.remaining_slots <= 0 then raise exception 'campaign_full'; end if;

  if v_campaign.kind = 'task' then
    v_status := 'completed';
    v_reward_units := v_campaign.reward_units;
  elsif v_campaign.winner_entry_id is null
    and p_answer_hash ~ '^[a-f0-9]{64}$'
    and p_answer_hash = v_campaign.answer_hash then
    v_status := 'winner';
    v_reward_units := v_campaign.prize_units;
  else
    v_status := 'incorrect';
  end if;

  insert into public.nastardamus_campaign_entries (
    campaign_id, telegram_id, answer_preview, answer_hash, status, reward_units
  ) values (
    p_campaign_id, p_telegram_id, left(nullif(trim(p_answer_preview), ''), 180),
    nullif(p_answer_hash, ''), v_status, v_reward_units
  ) returning * into v_entry;

  update public.nastardamus_campaigns
  set remaining_slots = remaining_slots - 1,
      winner_telegram_id = case when v_status = 'winner' then p_telegram_id else winner_telegram_id end,
      winner_entry_id = case when v_status = 'winner' then v_entry.id else winner_entry_id end,
      status = case when remaining_slots - 1 <= 0 or v_status = 'winner' then 'completed' else status end,
      completed_at = case when remaining_slots - 1 <= 0 or v_status = 'winner' then now() else completed_at end,
      updated_at = now()
  where id = p_campaign_id;

  if v_reward_units > 0 then
    insert into public.nastardamus_wallets (telegram_id) values (p_telegram_id)
      on conflict (telegram_id) do nothing;
    select * into v_wallet from public.nastardamus_wallets
      where telegram_id = p_telegram_id for update;
    update public.nastardamus_wallets
      set balance_units = balance_units + v_reward_units, updated_at = now()
      where telegram_id = p_telegram_id returning * into v_wallet;
    insert into public.nastardamus_wallet_ledger (
      telegram_id, entry_type, amount_units, balance_after_units, locked_after_units,
      idempotency_key, reference_type, reference_id, metadata
    ) values (
      p_telegram_id, 'campaign_reward', v_reward_units, v_wallet.balance_units,
      v_wallet.locked_units, 'campaign:' || v_entry.id::text, v_campaign.kind,
      v_campaign.id::text, jsonb_build_object('title', v_campaign.title, 'status', v_status)
    );
  end if;

  return jsonb_build_object('entryId', v_entry.id, 'status', v_status,
    'rewardUnits', v_reward_units, 'replayed', false);
end;
$function$;

revoke all on function public.nastardamus_submit_campaign(uuid, bigint, text, text)
  from public, anon, authenticated;
grant execute on function public.nastardamus_submit_campaign(uuid, bigint, text, text)
  to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('nastardamus-campaign-posters', 'nastardamus-campaign-posters', true, 2097152,
  array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Lucky Stone is deliberately non-wagering: it has no wallet or ledger
-- connection. This keeps the social dice game separate from purchased value.
create table if not exists public.nastardamus_lucky_matches (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'waiting' check (status in ('waiting','active','completed','cancelled')),
  player_a bigint not null check (player_a > 0),
  player_b bigint check (player_b > 0 and player_b <> player_a),
  score_a smallint not null default 0 check (score_a between 0 and 5),
  score_b smallint not null default 0 check (score_b between 0 and 5),
  chooser bigint,
  roller bigint,
  prediction text check (prediction in ('higher','lower')),
  last_roll jsonb,
  round_no smallint not null default 1 check (round_no between 1 and 99),
  winner bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.nastardamus_lucky_messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.nastardamus_lucky_matches(id) on delete cascade,
  sender_telegram_id bigint not null check (sender_telegram_id > 0),
  sender_name text not null check (char_length(sender_name) between 1 and 80),
  content text not null check (char_length(content) between 1 and 500),
  created_at timestamptz not null default now()
);

create unique index if not exists nastardamus_lucky_waiting_player_idx
  on public.nastardamus_lucky_matches (player_a) where status = 'waiting';
create index if not exists nastardamus_lucky_messages_match_idx
  on public.nastardamus_lucky_messages (match_id, created_at);
alter table public.nastardamus_lucky_matches enable row level security;
alter table public.nastardamus_lucky_messages enable row level security;
revoke all on table public.nastardamus_lucky_matches from public, anon, authenticated;
revoke all on table public.nastardamus_lucky_messages from public, anon, authenticated;
grant select, insert, update on table public.nastardamus_lucky_matches to service_role;
grant select, insert on table public.nastardamus_lucky_messages to service_role;

create or replace function public.nastardamus_join_lucky_match(p_telegram_id bigint)
returns uuid language plpgsql security definer set search_path = '' as $function$
declare v_match public.nastardamus_lucky_matches%rowtype;
begin
  if p_telegram_id is null or p_telegram_id <= 0 then raise exception 'invalid_telegram_id'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('lucky-matchmaking', 0));
  select * into v_match from public.nastardamus_lucky_matches
    where status in ('waiting','active') and (player_a = p_telegram_id or player_b = p_telegram_id)
    order by created_at desc limit 1 for update;
  if found then return v_match.id; end if;
  select * into v_match from public.nastardamus_lucky_matches
    where status = 'waiting' and player_a <> p_telegram_id order by created_at limit 1 for update skip locked;
  if found then
    update public.nastardamus_lucky_matches set player_b = p_telegram_id, status = 'active',
      chooser = player_a, roller = p_telegram_id, updated_at = now() where id = v_match.id;
    return v_match.id;
  end if;
  insert into public.nastardamus_lucky_matches(player_a) values (p_telegram_id) returning id into v_match.id;
  return v_match.id;
end;$function$;

create or replace function public.nastardamus_play_lucky_match(
  p_match_id uuid, p_telegram_id bigint, p_action text, p_prediction text default null
) returns jsonb language plpgsql security definer set search_path = '' as $function$
declare v_match public.nastardamus_lucky_matches%rowtype; v_d1 int; v_d2 int; v_sum int; v_point bigint;
begin
  select * into v_match from public.nastardamus_lucky_matches where id = p_match_id for update;
  if not found then raise exception 'lucky_match_not_found'; end if;
  if p_telegram_id not in (v_match.player_a, v_match.player_b) then raise exception 'lucky_match_forbidden'; end if;
  if v_match.status <> 'active' then raise exception 'lucky_match_not_active'; end if;
  if p_action = 'predict' then
    if v_match.chooser <> p_telegram_id then raise exception 'lucky_not_your_turn'; end if;
    if p_prediction not in ('higher','lower') then raise exception 'lucky_invalid_prediction'; end if;
    update public.nastardamus_lucky_matches set prediction = p_prediction, updated_at = now() where id = p_match_id;
    return jsonb_build_object('status','predicted');
  end if;
  if p_action <> 'roll' or v_match.roller <> p_telegram_id then raise exception 'lucky_not_your_turn'; end if;
  if v_match.prediction is null then raise exception 'lucky_prediction_required'; end if;
  v_d1 := floor(random() * 6)::int + 1; v_d2 := floor(random() * 6)::int + 1; v_sum := v_d1 + v_d2;
  if v_sum = 6 then
    update public.nastardamus_lucky_matches set last_roll = jsonb_build_object('dice',jsonb_build_array(v_d1,v_d2),'sum',v_sum,'neutral',true), updated_at = now() where id = p_match_id;
    return jsonb_build_object('dice',jsonb_build_array(v_d1,v_d2),'sum',v_sum,'neutral',true);
  end if;
  v_point := case when (v_match.prediction = 'higher' and v_sum > 6) or (v_match.prediction = 'lower' and v_sum < 6) then v_match.chooser else v_match.roller end;
  update public.nastardamus_lucky_matches set
    score_a = score_a + case when v_point = player_a then 1 else 0 end,
    score_b = score_b + case when v_point = player_b then 1 else 0 end,
    last_roll = jsonb_build_object('dice',jsonb_build_array(v_d1,v_d2),'sum',v_sum,'pointTo',v_point),
    chooser = v_match.roller, roller = v_match.chooser, prediction = null, round_no = round_no + 1,
    status = case when (score_a + case when v_point = player_a then 1 else 0 end) >= 5 or (score_b + case when v_point = player_b then 1 else 0 end) >= 5 then 'completed' else 'active' end,
    winner = case when (score_a + case when v_point = player_a then 1 else 0 end) >= 5 or (score_b + case when v_point = player_b then 1 else 0 end) >= 5 then v_point else null end,
    completed_at = case when (score_a + case when v_point = player_a then 1 else 0 end) >= 5 or (score_b + case when v_point = player_b then 1 else 0 end) >= 5 then now() else null end,
    updated_at = now() where id = p_match_id;
  return jsonb_build_object('dice',jsonb_build_array(v_d1,v_d2),'sum',v_sum,'pointTo',v_point,'neutral',false);
end;$function$;

revoke all on function public.nastardamus_join_lucky_match(bigint) from public, anon, authenticated;
revoke all on function public.nastardamus_play_lucky_match(uuid,bigint,text,text) from public, anon, authenticated;
grant execute on function public.nastardamus_join_lucky_match(bigint) to service_role;
grant execute on function public.nastardamus_play_lucky_match(uuid,bigint,text,text) to service_role;
