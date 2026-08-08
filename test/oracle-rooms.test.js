import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import proxyHandler from '../api/proxy.js';
import { buildBotReply } from '../lib/bot-replies.js';
import { buildOracleRoomAgentRequest } from '../lib/oracle-rooms.js';

const ROOM_TOKEN = 'b'.repeat(32);
const TURN_ID = '743a8d3f-7654-4d1e-aeed-1fc420fc1282';

function createResponse() {
  return {
    headers: new Map(),
    statusCode: 200,
    body: null,
    setHeader(name, value) { this.headers.set(name.toLowerCase(), value); },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

function signedInitData(botToken, userId = 880001) {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: 'oracle-room-test',
    user: JSON.stringify({ id: userId, first_name: 'Анна', username: 'anna_test' })
  });
  const check = [...params.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  params.set('hash', createHmac('sha256', secret).update(check).digest('hex'));
  return params.toString();
}

function roomView(messages = []) {
  return {
    token: ROOM_TOKEN,
    mode: 'group',
    title: 'Круг доверия',
    focus: 'Как слышать друг друга без ссор',
    status: 'active',
    maxParticipants: 6,
    participantCount: 2,
    assistantState: 'idle',
    joinRequired: false,
    viewerStatus: 'active',
    viewerRole: 'owner',
    viewer: {
      telegramId: 880001,
      displayName: 'Анна',
      status: 'active',
      isViewer: true,
      palmDescription: 'Линия сердца идёт к указательному пальцу.'
    },
    members: [
      {
        telegramId: 880001,
        displayName: 'Анна',
        role: 'owner',
        status: 'active',
        isViewer: true,
        palmReady: true,
        preparationStatus: 'ready',
        privateAnswers: {
          connection: 'Нам легко мечтать вместе.',
          tension: 'Мы перебиваем друг друга.',
          future: 'Хотим научиться договариваться.',
          personalQuestion: 'Как мне говорить мягче?'
        },
        palmDescription: 'Линия сердца идёт к указательному пальцу.'
      },
      {
        telegramId: 880002,
        displayName: 'Иван',
        role: 'member',
        status: 'active',
        isViewer: false,
        palmReady: true,
        preparationStatus: 'ready',
        privateAnswers: {
          connection: 'Общие цели.',
          tension: 'Трудно обсуждать обиды.',
          future: 'Спокойный общий путь.',
          personalQuestion: 'Как лучше слышать Анну?'
        },
        palmDescription: 'Линия жизни длинная, в середине есть развилка.'
      }
    ],
    messages
  };
}

test('Telegram room deep link opens the exact protected room', () => {
  const reply = buildBotReply({
    message: {
      text: `/start room_${ROOM_TOKEN}`,
      chat: { id: 91 },
      from: { id: 92 }
    }
  }, 'https://nastardamus.example');

  const url = new URL(reply.payload.reply_markup.inline_keyboard[0][0].web_app.url);
  assert.equal(url.searchParams.get('screen'), 'palm-room');
  assert.equal(url.searchParams.get('room'), ROOM_TOKEN);
  assert.match(reply.payload.text, /живую комнату Эзотериума/iu);
});

test('room prompt includes only active consenting participants and shared palm descriptions', () => {
  const room = roomView([
    { role: 'user', senderName: 'Иван', content: 'Мне трудно говорить спокойно.', turnId: 'older-turn' },
    { role: 'assistant', senderName: 'Эзотериум', content: 'Начните с общего намерения.', turnId: 'older-turn' },
    { role: 'user', senderName: 'Анна', content: 'Что нам попробовать?', turnId: TURN_ID }
  ]);
  room.members.push({
    telegramId: 880003,
    displayName: 'Ольга',
    role: 'member',
    status: 'invited',
    palmDescription: 'Скрытое описание приглашённого участника.'
  });

  const request = buildOracleRoomAgentRequest(room, {
    turnId: TURN_ID,
    message: 'Что нам попробовать?'
  });

  assert.match(request.message, /Активные участники: Анна \(создатель\), Иван/u);
  assert.match(request.message, /Анна: Линия сердца/u);
  assert.match(request.message, /Иван: Линия жизни/u);
  assert.match(request.message, /Закрытый контекст подготовки/u);
  assert.match(request.message, /Нам легко мечтать вместе/u);
  assert.doesNotMatch(request.message, /Ольга|Скрытое описание/u);
  assert.deepEqual(request.history, [
    { role: 'user', content: 'Иван: Мне трудно говорить спокойно.' },
    { role: 'assistant', content: 'Начните с общего намерения.' }
  ]);
});

test('shared room message is persisted before generation and completed atomically', async () => {
  const botToken = 'telegram-oracle-room-test-token-12345';
  const previousFetch = global.fetch;
  const previous = {
    BOT_TOKEN: process.env.BOT_TOKEN,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    ALLOW_UNAUTHENTICATED_PREVIEW: process.env.ALLOW_UNAUTHENTICATED_PREVIEW
  };
  const actions = [];
  let providerBody;
  process.env.BOT_TOKEN = botToken;
  process.env.OPENAI_API_KEY = 'oracle-room-provider-test-key';
  process.env.OPENAI_MODEL = 'gpt-5-mini';
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.ALLOW_UNAUTHENTICATED_PREVIEW;

  global.fetch = async (url, options = {}) => {
    if (url.includes('nastardamus-user-store')) {
      const body = JSON.parse(options.body);
      actions.push(body.action);
      const data = {
        take_rate_limit: { ok: true, allowed: true, limit: 80, remaining: 79, retry_after_seconds: 3600 },
        begin_oracle_room_turn: {
          ok: true,
          turn: { turn_id: TURN_ID, replayed: false },
          room: roomView([
            { role: 'user', senderName: 'Анна', content: 'Как нам перестать перебивать друг друга?', turnId: TURN_ID }
          ])
        },
        complete_oracle_room_turn: {
          ok: true,
          room: roomView([
            { role: 'user', senderName: 'Анна', content: 'Как нам перестать перебивать друг друга?', turnId: TURN_ID },
            { role: 'assistant', senderName: 'Эзотериум', content: 'Введите правило одной минуты.', turnId: TURN_ID }
          ]),
          chats: [{ telegram_id: 880002, chat_id: 990002 }]
        },
        fail_oracle_room_turn: { ok: true }
      }[body.action];
      assert.ok(data, `Unexpected room store action: ${body.action}`);
      return { ok: true, status: 200, json: async () => data };
    }
    if (url.includes('nastardamus-admin-store')) {
      const body = JSON.parse(options.body);
      actions.push(body.action);
      assert.equal(body.action, 'list_ai_agents');
      return { ok: true, status: 200, json: async () => ({ ok: true, agents: [] }) };
    }
    if (url === 'https://api.openai.com/v1/responses') {
      actions.push('provider');
      providerBody = JSON.parse(options.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({ output_text: 'Сначала договоритесь о правиле одной минуты без перебивания.' })
      };
    }
    if (url.startsWith('https://api.telegram.org/')) {
      actions.push('telegram_notification');
      return { ok: true, status: 200, json: async () => ({ ok: true, result: true }) };
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  try {
    const response = createResponse();
    await proxyHandler({
      method: 'POST',
      headers: { 'x-telegram-init-data': signedInitData(botToken) },
      body: {
        action: 'oracle_room_send',
        roomToken: ROOM_TOKEN,
        message: 'Как нам перестать перебивать друг друга?',
        clientNonce: 'oracle-room-message-1234567890'
      }
    }, response);

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.replayed, false);
    assert.match(response.body.answer, /правиле одной минуты/u);
    assert.ok(actions.indexOf('begin_oracle_room_turn') < actions.indexOf('provider'));
    assert.ok(actions.indexOf('provider') < actions.indexOf('complete_oracle_room_turn'));
    assert.equal(actions.includes('fail_oracle_room_turn'), false);
    assert.equal(actions.filter((action) => action === 'telegram_notification').length, 1);
    assert.match(providerBody.instructions, /не назначай виноватого/u);
    assert.match(providerBody.input, /Анна.*Иван/su);
    assert.doesNotMatch(JSON.stringify(providerBody), /data:image|palm_image_path/u);
  } finally {
    global.fetch = previousFetch;
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('room schema and client keep membership, photos and live access protected', () => {
  const sql = readFileSync(
    new URL('../supabase/migrations/20260802170000_oracle_palm_rooms.sql', import.meta.url),
    'utf8'
  );
  const client = readFileSync(new URL('../ui-kit/app.js', import.meta.url), 'utf8');
  const store = readFileSync(
    new URL('../supabase/functions/nastardamus-user-store/index.ts', import.meta.url),
    'utf8'
  );

  assert.match(sql, /mode text not null check \(mode in \('solo', 'pair', 'group'\)\)/u);
  assert.match(sql, /max_participants between 1 and 6/u);
  assert.match(sql, /mode = 'group' and max_participants between 3 and 6/u);
  assert.match(sql, /invite_expires_at timestamptz not null default \(now\(\) \+ interval '72 hours'\)/u);
  assert.match(sql, /enable row level security/u);
  assert.match(sql, /revoke all on table public\.nastardamus_oracle_rooms from public, anon, authenticated/u);
  assert.match(sql, /grant select, insert, update, delete on table public\.nastardamus_oracle_rooms to service_role/u);
  assert.match(sql, /'nastardamus-oracle-palms',[\s\S]*false/u);
  assert.match(sql, /nastardamus_begin_oracle_room_turn/u);
  assert.match(sql, /nastardamus_complete_oracle_room_preparation/u);
  assert.match(sql, /preparation_status text not null default 'not_started'/u);
  assert.match(sql, /v_room\.mode <> 'solo' and v_room\.ritual_state <> 'opened'/u);
  assert.match(sql, /private_answers jsonb not null default '\{\}'::jsonb/u);
  assert.match(sql, /active_turn_id/u);
  assert.match(sql, /'retried', true/u);
  assert.match(sql, /active_turn_id = v_existing\.turn_id/u);
  assert.match(sql, /nastardamus_find_user_by_username/u);
  assert.match(client, /invite_oracle_room_username/u);
  assert.match(client, /Поделиться ссылкой/u);
  assert.match(client, /window\.setInterval\(\(\) => \{[\s\S]*loadOracleRoom\(\{ silent: true \}\);[\s\S]*\}, 2500\);/u);
  assert.match(client, /Личные ответы и фотография ладони остаются закрытыми/u);
  assert.match(client, /Отправить живую открытку/u);
  assert.match(client, /Начать чтение совместимости/u);
  assert.match(store, /includePrivateForAgent/u);
  assert.match(store, /isViewer \|\| includePrivate \? member\.private_answers/u);
  assert.match(store, /status=in\.\(active,invited\)/u);
  assert.doesNotMatch(client, /createClient\(|supabase\.channel\(/u);
});
