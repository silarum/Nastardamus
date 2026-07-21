import assert from 'node:assert/strict';
import test from 'node:test';

import { buildBotReply } from '../lib/bot-replies.js';

test('returns the Mini App button for /start', () => {
    const reply = buildBotReply(
        { message: { text: '/start campaign', chat: { id: 77 } } },
        'https://nastardamus.vercel.app'
    );

    assert.equal(reply.method, 'sendMessage');
    assert.equal(reply.payload.chat_id, 77);
    assert.equal(
        reply.payload.reply_markup.inline_keyboard[0][0].web_app.url,
        'https://nastardamus.vercel.app'
    );
});

test('ignores updates without a text message', () => {
    assert.equal(buildBotReply({ callback_query: { id: '1' } }, 'https://example.com'), null);
});

test('recognizes a group /start command addressed to the bot', () => {
    const reply = buildBotReply(
        { message: { text: '/start@NastardamusBot', chat: { id: 12 } } },
        'https://nastardamus.vercel.app'
    );

    assert.ok(reply.payload.reply_markup);
});
