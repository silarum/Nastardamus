import assert from 'node:assert/strict';
import test from 'node:test';

import { buildBotReply } from '../lib/bot-replies.js';

test('shared bot invitation opens the requested Nastardamus section', () => {
  const reply = buildBotReply({
    message: {
      text: '/start invite_photo_creative',
      chat: { id: 42 },
      from: { id: 42 }
    }
  }, 'https://nastardamus.vercel.app');

  const buttons = reply.payload.reply_markup.inline_keyboard.flat();
  assert.equal(buttons.length, 1);
  assert.equal(buttons[0].web_app.url, 'https://nastardamus.vercel.app/?screen=photo-compat&invite=creative');
  assert.match(buttons[0].text, /Принять приглашение/u);
  assert.equal(buttons.some((button) => button.text.includes('Админ')), false);
  assert.equal(buttons.some((button) => button.url?.includes('t.me/')), false);
});

test('reconciliation invitation opens a voluntary consent screen', () => {
  const token = 'a'.repeat(32);
  const reply = buildBotReply({
    message: {
      text: `/start reconcile_${token}`,
      chat: { id: 42 },
      from: { id: 42 }
    }
  }, 'https://nastardamus.vercel.app');

  const button = reply.payload.reply_markup.inline_keyboard[0][0];
  const url = new URL(button.web_app.url);
  assert.equal(url.searchParams.get('screen'), 'reconciliation-room');
  assert.equal(url.searchParams.get('reconciliation'), token);
  assert.match(reply.payload.text, /добровольно/u);
});
