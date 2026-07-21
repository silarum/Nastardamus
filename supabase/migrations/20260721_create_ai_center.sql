create extension if not exists pgcrypto;

create table if not exists public.nastardamus_ai_providers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  provider_type text not null default 'openai_compatible' check (provider_type in ('openai_compatible','openai','anthropic','google','custom')),
  base_url text,
  api_key_ciphertext text,
  api_key_iv text,
  api_key_hint text,
  text_model text,
  vision_model text,
  enabled boolean not null default true,
  priority integer not null default 100 check (priority between 1 and 10000),
  capabilities jsonb not null default '{"text":true,"vision":false,"moderation":false}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  created_by bigint,
  updated_by bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nastardamus_ai_agents (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  purpose text not null,
  instructions text not null default '',
  provider_id uuid references public.nastardamus_ai_providers(id) on delete set null,
  fallback_provider_id uuid references public.nastardamus_ai_providers(id) on delete set null,
  model_override text,
  enabled boolean not null default true,
  temperature numeric(3,2) not null default 0.40 check (temperature between 0 and 2),
  max_output_tokens integer not null default 1200 check (max_output_tokens between 100 and 20000),
  channels jsonb not null default '{"app":true,"telegram":true}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  created_by bigint,
  updated_by bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nastardamus_ai_moderation_policy (
  key text primary key,
  enabled boolean not null default true,
  rules jsonb not null default '{}'::jsonb,
  thresholds jsonb not null default '{}'::jsonb,
  actions jsonb not null default '{}'::jsonb,
  updated_by bigint,
  updated_at timestamptz not null default now()
);

create index if not exists nastardamus_ai_providers_enabled_idx
  on public.nastardamus_ai_providers (enabled, priority, created_at);
create index if not exists nastardamus_ai_agents_enabled_idx
  on public.nastardamus_ai_agents (enabled, purpose, created_at);

alter table public.nastardamus_ai_providers enable row level security;
alter table public.nastardamus_ai_agents enable row level security;
alter table public.nastardamus_ai_moderation_policy enable row level security;
