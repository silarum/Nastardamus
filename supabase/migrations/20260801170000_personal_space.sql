create extension if not exists pgcrypto;

create table if not exists public.nastardamus_personal_events (
  event_id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null,
  title text not null check (char_length(title) between 3 and 100),
  event_date date not null,
  event_time time,
  description text not null default '' check (char_length(description) <= 500),
  category text not null default 'other' check (category in ('work','love','health','growth','finance','home','travel','other')),
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  status text not null default 'active' check (status in ('active','completed','archived')),
  reminder boolean not null default false,
  goal_id uuid,
  analysis jsonb,
  enrichments jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nastardamus_personal_goals (
  goal_id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null,
  title text not null check (char_length(title) between 3 and 100),
  description text not null default '' check (char_length(description) <= 500),
  category text not null default 'other' check (category in ('work','love','health','growth','finance','home','travel','other')),
  deadline date,
  status text not null default 'active' check (status in ('active','completed','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.nastardamus_personal_events
  drop constraint if exists nastardamus_personal_events_goal_id_fkey;
alter table public.nastardamus_personal_events
  add constraint nastardamus_personal_events_goal_id_fkey
  foreign key (goal_id) references public.nastardamus_personal_goals(goal_id) on delete set null;

create table if not exists public.nastardamus_personal_tasks (
  task_id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null,
  goal_id uuid references public.nastardamus_personal_goals(goal_id) on delete cascade,
  title text not null check (char_length(title) between 3 and 100),
  description text not null default '' check (char_length(description) <= 500),
  recurrence text not null default 'none' check (recurrence in ('none','daily','weekly','monthly')),
  scheduled_date date not null default current_date,
  completed_dates date[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nastardamus_daily_checkins (
  telegram_id bigint not null,
  checkin_date date not null,
  morning_tasks jsonb not null default '[]'::jsonb,
  morning_note text not null default '' check (char_length(morning_note) <= 1000),
  evening_reflection jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (telegram_id, checkin_date)
);

create table if not exists public.nastardamus_space_preferences (
  telegram_id bigint primary key,
  memory_enabled boolean not null default true,
  morning_enabled boolean not null default true,
  evening_enabled boolean not null default true,
  timezone text not null default 'Europe/Berlin' check (char_length(timezone) <= 80),
  plan text not null default 'free' check (plan in ('free','basic','pro','premium')),
  updated_at timestamptz not null default now()
);

create index if not exists nastardamus_personal_events_owner_date_idx
  on public.nastardamus_personal_events (telegram_id, status, event_date, event_time);
create index if not exists nastardamus_personal_goals_owner_status_idx
  on public.nastardamus_personal_goals (telegram_id, status, created_at desc);
create index if not exists nastardamus_personal_tasks_owner_goal_idx
  on public.nastardamus_personal_tasks (telegram_id, goal_id, scheduled_date);

alter table public.nastardamus_personal_events enable row level security;
alter table public.nastardamus_personal_goals enable row level security;
alter table public.nastardamus_personal_tasks enable row level security;
alter table public.nastardamus_daily_checkins enable row level security;
alter table public.nastardamus_space_preferences enable row level security;

revoke all on public.nastardamus_personal_events from anon, authenticated;
revoke all on public.nastardamus_personal_goals from anon, authenticated;
revoke all on public.nastardamus_personal_tasks from anon, authenticated;
revoke all on public.nastardamus_daily_checkins from anon, authenticated;
revoke all on public.nastardamus_space_preferences from anon, authenticated;
grant all on public.nastardamus_personal_events to service_role;
grant all on public.nastardamus_personal_goals to service_role;
grant all on public.nastardamus_personal_tasks to service_role;
grant all on public.nastardamus_daily_checkins to service_role;
grant all on public.nastardamus_space_preferences to service_role;
