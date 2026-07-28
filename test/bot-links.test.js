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
  }, 'https://nastardamus.vercel.app', { botUsername: 'BelonTip_bot' });

  const openApp = reply.payload.reply_markup.inline_keyboard[0][0];
  assert.equal(openApp.web_app.url, 'https://nastardamus.vercel.app/?screen=photo-compat&invite=creative');
  const openBot = reply.payload.reply_markup.inline_keyboard.flat().find((button) => button.text.includes('чат бота'));
  assert.equal(openBot.url, 'https://t.me/BelonTip_bot?start=app');
});
