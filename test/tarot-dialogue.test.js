import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { buildTarotDialogueAgentRequest } from '../lib/tarot-dialogue.js';

test('live Tarot dialogue is grounded in only the cards already opened', () => {
  const request = buildTarotDialogueAgentRequest({
    subtype: 'past-present-future',
    title: 'Что изменится?',
    snapshot: {
      question: 'Что изменится?',
      spreadTitle: 'Прошлое — настоящее — будущее',
      count: 3,
      positions: ['Прошлое', 'Настоящее', 'Будущее'],
      selectedCards: ['Отшельник', 'Звезда']
    },
    messages: [{ role: 'assistant', content: 'Не торопите ответ.' }]
  }, 'Почему эти карты спорят?');
  assert.match(request.message, /Открыто 2 из 3/);
  assert.match(request.message, /Прошлое — Отшельник/);
  assert.match(request.message, /Настоящее — Звезда/);
  assert.doesNotMatch(request.message, /Будущее —/);
  assert.equal(request.history.length, 1);
});

test('Tarot dialogue requires a protected server session and persists both turns', () => {
  const proxy = readFileSync(new URL('../api/proxy.js', import.meta.url), 'utf8');
  const store = readFileSync(new URL('../supabase/functions/nastardamus-user-store/index.ts', import.meta.url), 'utf8');
  assert.match(proxy, /action === 'tarot_dialogue_send'/);
  assert.match(proxy, /scope: 'tarot:dialogue'/);
  assert.match(store, /action === "get_tarot_dialogue_context"/);
  assert.match(store, /kind=eq\.tarot&state=in\.\(selecting,analyzing\)/);
  assert.match(store, /action === "append_tarot_dialogue_turn"/);
  assert.match(store, /role: "assistant"/);
});
