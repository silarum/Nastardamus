import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  buildReconciliationAgentRequest,
  buildReconciliationToolPrompt,
  nextReconciliationStage
} from '../lib/reconciliation.js';
import { creationChargeUnits, joiningChargeUnits } from '../lib/reconciliation-api.js';

function room() {
  return {
    title: 'Примирение: Анна и Алексей',
    conflictType: 'friendship',
    reason: 'misunderstanding',
    goal: 'understanding',
    status: 'active',
    stage: 'intake',
    members: [
      { telegramId: 11, role: 'owner', status: 'active', displayName: 'Анна', privateAnswers: { pain: 'секрет Анны' }, sharePrivateConsent: false },
      { telegramId: 22, role: 'participant', status: 'active', displayName: 'Алексей', privateAnswers: { pain: 'секрет Алексея' }, sharePrivateConsent: true },
      { telegramId: 33, role: 'observer', status: 'active', displayName: 'Наблюдатель', privateAnswers: {} }
    ],
    messages: [
      { role: 'user', senderName: 'Анна', visibility: 'public', content: 'Мне важно быть услышанной' },
      { role: 'user', senderName: 'Алексей', visibility: 'private', recipientTelegramId: 22, content: 'закрытая реплика' }
    ]
  };
}

test('public mediation only uses private intake with explicit sharing consent', () => {
  const request = buildReconciliationAgentRequest(room(), { viewerId: 11, message: 'Я готова говорить', visibility: 'public' });
  assert.doesNotMatch(request.message, /секрет Анны/u);
  assert.match(request.message, /секрет Алексея/u);
  assert.doesNotMatch(JSON.stringify(request.history), /закрытая реплика/u);
});

test('private mediation receives only the speaking participant private intake', () => {
  const request = buildReconciliationAgentRequest(room(), { viewerId: 11, message: 'Отвечу закрыто', visibility: 'private' });
  assert.match(request.message, /секрет Анны/u);
  assert.doesNotMatch(request.message, /секрет Алексея/u);
});

test('observer cannot invoke the mediator', () => {
  assert.throws(
    () => buildReconciliationAgentRequest(room(), { viewerId: 33, message: 'Хочу вмешаться' }),
    /reconciliation_viewer_invalid/u
  );
});

test('symbolic tool prompt carries safeguards and stages can progress', () => {
  const prompt = buildReconciliationToolPrompt(room(), 'tarot', { question: 'Как слышать друг друга?' });
  assert.match(prompt, /символическ/u);
  assert.match(prompt, /без обвинения/u);
  assert.equal(nextReconciliationStage('analysis', 'Мы готовы к договорённости'), 'solution');
});

test('database migration keeps room data service-only and finalizes atomically', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20260813120000_esoterium_reconciliation.sql', import.meta.url), 'utf8');
  assert.match(sql, /enable row level security/iu);
  assert.match(sql, /revoke all on public\.nastardamus_reconciliation_messages from public, anon, authenticated/iu);
  assert.match(sql, /nastardamus_finalize_reconciliation/iu);
  assert.match(sql, /v_matching_count <> v_participant_count/iu);
});

test('payer choices preserve exact pair and group totals in hundredths of SILARUM', () => {
  const prices = { create: 10, participate: 5, group: 30 };
  assert.equal(creationChargeUnits('pair', 'initiator', 2, prices), 1500);
  assert.equal(creationChargeUnits('pair', 'each', 2, prices), 1000);
  assert.equal(joiningChargeUnits({ participant_mode: 'pair', payer_mode: 'each' }, 1, prices), 500);
  assert.equal(joiningChargeUnits({ participant_mode: 'pair', payer_mode: 'second' }, 1, prices), 1500);

  const ownerShare = creationChargeUnits('group', 'group', 7, prices);
  const invitedShare = joiningChargeUnits({ participant_mode: 'group', payer_mode: 'group', max_participants: 7 }, 1, prices);
  assert.equal(ownerShare, 432);
  assert.equal(invitedShare, 428);
  assert.equal(ownerShare + invitedShare * 6, 3000);
});
