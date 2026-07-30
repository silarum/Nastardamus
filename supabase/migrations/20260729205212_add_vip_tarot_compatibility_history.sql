create table if not exists public.nastardamus_vip_plans (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9_-]{1,63}$'),
  title text not null check (char_length(title) between 1 and 120),
  description text not null default '',
  duration_days integer not null check (duration_days between 1 and 3660),
  price_units bigint not null check (price_units >= 0),
  benefits jsonb not null default '{}'::jsonb,
  display_order integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nastardamus_vip_subscriptions (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null check (telegram_id > 0),
  plan_id text not null references public.nastardamus_vip_plans(id),
  status text not null default 'active' check (status in ('active', 'expired', 'cancelled', 'refunded')),
  source text not null default 'silarum' check (source in ('silarum', 'stars', 'ton', 'usdt', 'sbp', 'admin')),
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  payment_ledger_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (telegram_id, id)
);

create table if not exists public.nastardamus_tarot_spreads (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9_-]{1,63}$'),
  title text not null check (char_length(title) between 1 and 120),
  description text not null default '',
  category text not null default 'general',
  card_count integer not null check (card_count between 1 and 12),
  positions jsonb not null default '[]'::jsonb,
  service_id text not null default 'tarot',
  price_units bigint,
  free_checks integer not null default 0 check (free_checks between 0 and 1000),
  vip_access text not null default 'optional' check (vip_access in ('none', 'optional', 'included', 'only')),
  duration_label text not null default '',
  depth_label text not null default '',
  badge text not null default '',
  artwork_key text not null default 'tarot-deck',
  display_order integer not null default 100,
  is_active boolean not null default true,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nastardamus_compatibility_types (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9_-]{1,63}$'),
  title text not null check (char_length(title) between 1 and 120),
  description text not null default '',
  service_id text not null,
  price_units bigint,
  free_checks integer not null default 0 check (free_checks between 0 and 1000),
  vip_access text not null default 'optional' check (vip_access in ('none', 'optional', 'included', 'only')),
  artwork_key text not null default 'two-photo-compatibility',
  display_order integer not null default 100,
  is_active boolean not null default true,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nastardamus_reading_sessions (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null check (telegram_id > 0),
  kind text not null check (kind in ('tarot', 'compatibility', 'photo', 'palm', 'natal', 'horoscope')),
  subtype text not null,
  title text not null check (char_length(title) between 1 and 160),
  state text not null default 'completed'
    check (state in ('created', 'paid', 'selecting', 'analyzing', 'completed', 'failed', 'refunded', 'abandoned')),
  is_favorite boolean not null default false,
  input_snapshot jsonb not null default '{}'::jsonb,
  result_payload jsonb not null default '{}'::jsonb,
  result_text text not null default '',
  media_paths jsonb not null default '[]'::jsonb,
  access_snapshot jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  deleted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nastardamus_free_usage (
  telegram_id bigint not null check (telegram_id > 0),
  service_id text not null,
  usage_date date not null default current_date,
  uses integer not null default 0 check (uses >= 0),
  updated_at timestamptz not null default now(),
  primary key (telegram_id, service_id, usage_date)
);

create index if not exists nastardamus_vip_active_idx
  on public.nastardamus_vip_subscriptions (telegram_id, expires_at desc)
  where status = 'active';
create index if not exists nastardamus_tarot_catalog_idx
  on public.nastardamus_tarot_spreads (is_active, display_order);
create index if not exists nastardamus_compatibility_catalog_idx
  on public.nastardamus_compatibility_types (is_active, display_order);
create index if not exists nastardamus_reading_history_idx
  on public.nastardamus_reading_sessions (telegram_id, created_at desc)
  where deleted_at is null;
create index if not exists nastardamus_reading_favorites_idx
  on public.nastardamus_reading_sessions (telegram_id, created_at desc)
  where is_favorite and deleted_at is null;

alter table public.nastardamus_vip_plans enable row level security;
alter table public.nastardamus_vip_subscriptions enable row level security;
alter table public.nastardamus_tarot_spreads enable row level security;
alter table public.nastardamus_compatibility_types enable row level security;
alter table public.nastardamus_reading_sessions enable row level security;
alter table public.nastardamus_free_usage enable row level security;

revoke all on table public.nastardamus_vip_plans from public, anon, authenticated;
revoke all on table public.nastardamus_vip_subscriptions from public, anon, authenticated;
revoke all on table public.nastardamus_tarot_spreads from public, anon, authenticated;
revoke all on table public.nastardamus_compatibility_types from public, anon, authenticated;
revoke all on table public.nastardamus_reading_sessions from public, anon, authenticated;
revoke all on table public.nastardamus_free_usage from public, anon, authenticated;

grant select, insert, update, delete on table public.nastardamus_vip_plans to service_role;
grant select, insert, update, delete on table public.nastardamus_vip_subscriptions to service_role;
grant select, insert, update, delete on table public.nastardamus_tarot_spreads to service_role;
grant select, insert, update, delete on table public.nastardamus_compatibility_types to service_role;
grant select, insert, update, delete on table public.nastardamus_reading_sessions to service_role;
grant select, insert, update, delete on table public.nastardamus_free_usage to service_role;

insert into public.nastardamus_vip_plans
  (id, title, description, duration_days, price_units, benefits, display_order)
values
  ('vip-month', 'VIP на месяц', 'Доступ к VIP-чтениям и специальным условиям', 30, 19900, '{"included_readings":2}', 10),
  ('vip-year', 'VIP на год', 'Годовой доступ к пространству VIP', 365, 179900, '{"included_readings":36}', 20)
on conflict (id) do nothing;

insert into public.nastardamus_tarot_spreads
  (id, title, description, category, card_count, positions, service_id, free_checks, vip_access, duration_label, depth_label, badge, display_order)
values
  ('card-of-day', 'Карта дня', 'Главная энергия дня и один ясный ориентир.', 'today', 1, '["Энергия дня"]', 'tarot', 1, 'optional', '1–2 мин', 'Краткий', 'Бесплатно', 10),
  ('yes-no', 'Да или нет', 'Ответ с объяснением скрытого условия выбора.', 'choice', 1, '["Ответ и условие"]', 'tarot', 0, 'optional', '1–2 мин', 'Краткий', '', 20),
  ('past-present-future', 'Прошлое — настоящее — будущее', 'Три точки одной развивающейся истории.', 'future', 3, '["Прошлое","Настоящее","Будущее"]', 'tarot', 0, 'optional', '3–4 мин', 'Средний', 'Популярное', 30),
  ('situation-obstacle-advice', 'Ситуация — препятствие — совет', 'Что происходит, что мешает и на что опереться.', 'choice', 3, '["Ситуация","Препятствие","Совет"]', 'tarot', 0, 'optional', '3–4 мин', 'Средний', '', 40),
  ('love-relationship', 'Любовь и отношения', 'Чувства, намерения, напряжение и перспектива диалога.', 'love', 5, '["Ваше чувство","Чувство другого","Притяжение","Напряжение","Перспектива"]', 'tarot_relationship', 0, 'optional', '5–7 мин', 'Глубокий', 'Популярное', 50),
  ('money-career', 'Деньги и карьера', 'Ресурсы, ограничения и ближайшая возможность.', 'career', 5, '["Ресурс","Текущая ситуация","Препятствие","Возможность","Действие"]', 'tarot', 0, 'optional', '5–7 мин', 'Глубокий', '', 60),
  ('two-paths', 'Выбор двух путей', 'Сравнение двух решений без обещания предрешённого исхода.', 'choice', 7, '["Суть выбора","Путь A","Цена пути A","Итог пути A","Путь B","Цена пути B","Итог пути B"]', 'tarot', 0, 'optional', '7–9 мин', 'Глубокий', '', 70),
  ('pair-compatibility', 'Совместимость пары', 'Общий ритм, различия и точка роста отношений.', 'love', 8, '["Вы","Другой","Притяжение","Доверие","Диалог","Близость","Сложность","Общий путь"]', 'tarot_relationship', 0, 'included', '8–10 мин', 'Глубокий', 'VIP', 80),
  ('near-future', 'Ближайшее будущее', 'Главные тенденции ближайшего периода.', 'future', 7, '["Фон","Что приходит","Что уходит","Возможность","Риск","Ваш шаг","Итоговый вектор"]', 'tarot', 0, 'optional', '7–9 мин', 'Глубокий', '', 90),
  ('shadow-side', 'Теневая сторона', 'Скрытая причина, защитный механизм и внутренний ресурс.', 'self', 5, '["Тень","Триггер","Защита","Ресурс","Интеграция"]', 'tarot', 0, 'only', '5–7 мин', 'Глубокий', 'VIP', 100),
  ('celtic-cross', 'Кельтский крест', 'Десять позиций для сложной многослойной ситуации.', 'deep', 10, '["Суть","Пересечение","Основание","Прошлое","Возможность","Ближайший путь","Ваша позиция","Окружение","Надежда и страх","Направление"]', 'tarot', 0, 'included', '10–14 мин', 'Максимальный', 'Глубокий', 110),
  ('wheel-of-year', 'Колесо года', 'Двенадцать месяцев и общий мотив года.', 'deep', 12, '["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"]', 'tarot', 0, 'only', '12–16 мин', 'Максимальный', 'VIP', 120)
on conflict (id) do nothing;

insert into public.nastardamus_compatibility_types
  (id, title, description, service_id, free_checks, vip_access, artwork_key, display_order)
values
  ('photo', 'По фотографиям', 'Два образа, их визуальное созвучие и точки для честного диалога.', 'photo_compatibility', 0, 'optional', 'two-photo-compatibility', 10),
  ('palm', 'По ладоням', 'Символическое чтение двух линий пути.', 'palmlink', 0, 'included', 'palm-reading', 20),
  ('data', 'По персональным данным', 'Имя, пол, дата, время и место рождения обоих участников.', 'photo_compatibility', 1, 'optional', 'compatibility-data', 30)
on conflict (id) do nothing;
