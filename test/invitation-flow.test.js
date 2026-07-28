import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import proxyHandler from '../api/proxy.js';
import { buildBotReply } from '../lib/bot-replies.js';
import { buildReadingMessages } from '../lib/readings.js';

const INVITATION_TOKEN = 'a'.repeat(32);
const CHARGE_ID = '743a8d3f-7654-4d1e-aeed-1fc420fc1282';
const TINY_IMAGE = 'data:image/jpeg;base64,AA==';

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

function signedInitData(botToken, userId = 777001) {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: 'invitation-flow-test',
    user: JSON.stringify({ id: userId, first_name: 'Иван' })
  });
  const check = [...params.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  params.set('hash', createHmac('sha256', secret).update(check).digest('hex'));
  return params.toString();
}

test('personal Telegram deep link opens only its invitation token', () => {
  const reply = buildBotReply({
    message: {
      text: `/start join_${INVITATION_TOKEN}`,
      chat: { id: 881 },
      from: { id: 882 }
    }
  }, 'https://nastardamus.example');

  const url = new URL(reply.payload.reply_markup.inline_keyboard[0][0].web_app.url);
  assert.equal(url.searchParams.get('screen'), 'invitation');
  assert.equal(url.searchParams.get('invitation'), INVITATION_TOKEN);
  assert.match(reply.payload.text, /личное приглашение/i);
});

test('paired prompt respects participant-selected grammatical forms', () => {
  const messages = buildReadingMessages('photo_compatibility', {
    invitationToken: INVITATION_TOKEN,
    concern: 'Что важно понять?',
    firstName: 'Анна',
    secondName: 'Иван',
    firstGender: 'female',
    secondGender: 'male',
    firstImage: TINY_IMAGE,
    secondImage: TINY_IMAGE
  });

  assert.match(messages[0].content, /Анна выбрала женскую форму обращения/);
  assert.match(messages[0].content, /Иван выбрал мужскую форму обращения/);
  assert.match(messages[0].content, /не делай по ним выводов о характере/);
});

test('joint result charges one chosen participant and completes for both', async () => {
  const botToken = 'telegram-invitation-test-token-12345';
  const previousFetch = global.fetch;
  const previous = {
    BOT_TOKEN: process.env.BOT_TOKEN,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    ALLOW_UNAUTHENTICATED_PREVIEW: process.env.ALLOW_UNAUTHENTICATED_PREVIEW
  };
  const actions = [];
  process.env.BOT_TOKEN = botToken;
  process.env.OPENAI_API_KEY = 'openai-invitation-test-key';
  delete process.env.ALLOW_UNAUTHENTICATED_PREVIEW;

  global.fetch = async (url, options = {}) => {
    if (url.includes('nastardamus-user-store')) {
      const body = JSON.parse(options.body);
      actions.push(body.action);
      const data = {
        take_rate_limit: { ok: true, allowed: true, remaining: 8, retry_after_seconds: 0 },
        get_public_config: {
          ok: true,
          settings: {
            palmLinkEnabled: true,
            jointReadingsEnabled: true,
            paymentsEnabled: true,
            serviceCatalog: {
              palmlink: { id: 'palmlink', title: 'Путь двух судеб', enabled: true, price: 8.88 }
            }
          },
          moderation: { enabled: false }
        },
        claim_joint_invitation_processing: {
          ok: true,
          invitation: {
            token: INVITATION_TOKEN,
            flow: 'palm',
            goal: 'love',
            firstName: 'Анна',
            secondName: 'Иван',
            firstGender: 'female',
            secondGender: 'male',
            firstImage: TINY_IMAGE,
            secondImage: TINY_IMAGE,
            payerRole: 'participant'
          }
        },
        charge_service: {
          ok: true,
          charge: {
            charge_id: CHARGE_ID,
            price_units: 888,
            payment_source: 'wallet',
            status: 'charged'
          }
        },
        complete_joint_invitation: {
          ok: true,
          invitation: {
            token: INVITATION_TOKEN,
            inviteeName: 'Иван',
            status: 'completed',
            result: 'Общий результат Эзотериума'
          },
          chats: [
            { telegram_id: 777001, chat_id: 1001 },
            { telegram_id: 777002, chat_id: 1002 }
          ]
        }
      }[body.action];
      assert.ok(data, `Unexpected edge action: ${body.action}`);
      return { ok: true, status: 200, json: async () => data };
    }
    if (url === 'https://api.openai.com/v1/responses') {
      actions.push('provider');
      return {
        ok: true,
        status: 200,
        json: async () => ({
          output_text: 'Общий символический результат, который безопасно открывается обоим участникам.'
        })
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
        feature: 'photo_compatibility',
        idempotencyKey: 'joint-reading-1234567890',
        payload: {
          invitationToken: INVITATION_TOKEN,
          payerRole: 'participant'
        }
      }
    }, response);

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.invitation.status, 'completed');
    assert.equal(response.body.payment.amount, 8.88);
    assert.ok(actions.indexOf('claim_joint_invitation_processing') < actions.indexOf('charge_service'));
    assert.ok(actions.indexOf('charge_service') < actions.indexOf('provider'));
    assert.ok(actions.indexOf('provider') < actions.indexOf('complete_joint_invitation'));
    assert.equal(actions.filter((action) => action === 'charge_service').length, 1);
    assert.equal(actions.filter((action) => action === 'telegram_notification').length, 2);
    assert.equal(actions.includes('complete_service_charge'), false);
  } finally {
    global.fetch = previousFetch;
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('invitation schema keeps photos private and result delivery atomic', () => {
  const sql = readFileSync(
    new URL('../supabase/migrations/20260728152730_add_joint_invitation_flow.sql', import.meta.url),
    'utf8'
  );
  const client = readFileSync(new URL('../ui-kit/app.js', import.meta.url), 'utf8');
  const store = readFileSync(
    new URL('../supabase/functions/nastardamus-user-store/index.ts', import.meta.url),
    'utf8'
  );

  assert.match(sql, /public\.nastardamus_joint_invitations enable row level security/);
  assert.match(sql, /revoke all on table public\.nastardamus_joint_invitations from public, anon, authenticated/);
  assert.match(sql, /insert into storage\.buckets[\s\S]*\bpublic,[\s\S]*values[\s\S]*'nastardamus-joint-photos'[\s\S]*false/);
  assert.match(sql, /v_expected_service := case[\s\S]*'palmlink'[\s\S]*'photo_compatibility'/);
  assert.match(sql, /v_charge\.service_id <> v_expected_service/);
  assert.match(sql, /set\s+status = 'fulfilled',\s+fulfilled_at = now\(\)/);
  assert.match(client, /navigator\.canShare\?\.\(\{ files:/);
  assert.match(client, /await navigator\.share\(shareData\)/);
  assert.match(client, /Пусть оплатит инициатор/);
  assert.match(client, /по-джентльменски/);
  assert.match(store, /async function purgeExpiredJointInvitations\(\)/);
  assert.match(store, /await deleteJointImages\(\[\s*invitation\.initiator_image_path/);
});
