import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const migration = readFileSync(new URL('../supabase/migrations/20260813043000_add_campaign_tasks_and_quests.sql', import.meta.url), 'utf8');
const edge = readFileSync(new URL('../supabase/functions/nastardamus-user-store/index.ts', import.meta.url), 'utf8');
const proxy = readFileSync(new URL('../api/proxy.js', import.meta.url), 'utf8');
const client = readFileSync(new URL('../ui-kit/app.js', import.meta.url), 'utf8');
const admin = readFileSync(new URL('../api/admin.js', import.meta.url), 'utf8');

test('tasks and quests enforce capacity and first-winner rewards atomically', () => {
  assert.match(migration, /pg_advisory_xact_lock/u);
  assert.match(migration, /remaining_slots\s*=\s*remaining_slots\s*-\s*1/u);
  assert.match(migration, /winner_entry_id is null/u);
  assert.match(migration, /idempotency_key[\s\S]*'campaign:' \|\| v_entry\.id/u);
  assert.match(migration, /revoke all on table public\.nastardamus_campaigns from public, anon, authenticated/u);
  assert.match(edge, /action === "list_campaigns"/u);
  assert.match(edge, /action === "submit_campaign"/u);
  assert.match(proxy, /'list_campaigns', 'submit_campaign'/u);
});

test('admin and profile expose illustrated campaigns without manual result controls', () => {
  assert.match(admin, /Задания и квесты/u);
  assert.match(admin, /Количество мест/u);
  assert.match(admin, /Правильный ответ/u);
  assert.match(client, /profileMissionsPanel/u);
  assert.match(client, /Количество мест и победитель проверяются сервером/u);
  assert.doesNotMatch(client, /async function shareResult/u);
  for (const asset of ['task.webp', 'quest.webp', 'lucky-stone.webp']) {
    assert.equal(existsSync(new URL(`../ui-kit/assets/campaigns/${asset}`, import.meta.url)), true);
  }
});

test('Lucky Stone is server-rolled, private and disconnected from wallet stakes', () => {
  assert.match(migration, /random\(\) \* 6/u);
  assert.match(migration, /score_a[\s\S]*score_b[\s\S]*winner/u);
  assert.match(migration, /nastardamus_lucky_messages/u);
  const luckySql = migration.slice(migration.indexOf('-- Lucky Stone'));
  assert.doesNotMatch(luckySql, /nastardamus_wallet_ledger|balance_units|locked_units/u);
  assert.match(client, /Свободная игра без ставок/u);
  assert.match(client, /SILARUM не списываются и не передаются/u);
  assert.match(edge, /send_lucky_message/u);
});
