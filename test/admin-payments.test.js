import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import adminHandler from '../api/admin.js';

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

function signedInitData(botToken, userId) {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: 'admin-payment-test-query',
    user: JSON.stringify({ id: userId, first_name: 'Владелец' })
  });
  const check = [...params.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  params.set('hash', createHmac('sha256', secret).update(check).digest('hex'));
  return params.toString();
}

function preserveEnvironment(names) {
  const values = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  return () => {
    for (const [name, value] of Object.entries(values)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  };
}

test('admin self-credit can target only the authenticated owner wallet', async () => {
  const ownerId = 880072800001;
  const botToken = 'telegram-admin-payment-test-token';
  const restore = preserveEnvironment([
    'BOT_TOKEN',
    'ADMIN_BOT_TOKEN',
    'ADMIN_TELEGRAM_IDS',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY'
  ]);
  const previousFetch = global.fetch;
  const calls = [];

  process.env.BOT_TOKEN = botToken;
  delete process.env.ADMIN_BOT_TOKEN;
  process.env.ADMIN_TELEGRAM_IDS = String(ownerId);
  process.env.SUPABASE_URL = 'https://project.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test-key';
  global.fetch = async (url, options) => {
    calls.push({ url, body: options.body ? JSON.parse(options.body) : null });
    if (url.includes('/rpc/nastardamus_credit_admin_self')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          telegram_id: ownerId,
          amount_units: 1250,
          balance_units: 1250,
          idempotent_replay: false
        })
      };
    }
    if (url.includes('/nastardamus_admin_audit')) {
      return { ok: true, status: 201, json: async () => ({}) };
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  try {
    const response = createResponse();
    await adminHandler({
      method: 'POST',
      headers: { 'x-telegram-init-data': signedInitData(botToken, ownerId) },
      body: {
        paymentAction: 'credit_self',
        amount: 12.5,
        idempotencyKey: 'admin-self-test-20260728-0001',
        note: 'Проверка'
      }
    }, response);

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.credit.telegram_id, ownerId);
    assert.equal(calls[0].body.p_admin_id, ownerId);
    assert.equal(calls[0].body.p_amount_units, 1250);
    assert.equal(calls[0].body.p_idempotency_key, 'admin-self-test-20260728-0001');
    assert.equal(calls.some(({ body }) => body?.p_admin_id !== undefined && body.p_admin_id !== ownerId), false);
  } finally {
    global.fetch = previousFetch;
    restore();
  }
});

test('admin self-credit rejects fractions smaller than one hundredth', async () => {
  const ownerId = 880072800002;
  const botToken = 'telegram-admin-precision-test-token';
  const restore = preserveEnvironment([
    'BOT_TOKEN',
    'ADMIN_BOT_TOKEN',
    'ADMIN_TELEGRAM_IDS',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY'
  ]);
  const previousFetch = global.fetch;

  process.env.BOT_TOKEN = botToken;
  delete process.env.ADMIN_BOT_TOKEN;
  process.env.ADMIN_TELEGRAM_IDS = String(ownerId);
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  global.fetch = async () => {
    throw new Error('No backend call expected');
  };

  try {
    const response = createResponse();
    await adminHandler({
      method: 'POST',
      headers: { 'x-telegram-init-data': signedInitData(botToken, ownerId) },
      body: {
        paymentAction: 'credit_self',
        amount: 1.001,
        idempotencyKey: 'admin-self-test-20260728-0002'
      }
    }, response);

    assert.equal(response.statusCode, 400);
    assert.equal(response.body.error, 'invalid_amount');
  } finally {
    global.fetch = previousFetch;
    restore();
  }
});

test('owner can debit a user resolved by Telegram username with an audited idempotent adjustment', async () => {
  const ownerId = 880072800003;
  const targetId = 990070010003;
  const botToken = 'telegram-admin-adjustment-test-token';
  const restore = preserveEnvironment([
    'BOT_TOKEN',
    'ADMIN_BOT_TOKEN',
    'ADMIN_TELEGRAM_IDS',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY'
  ]);
  const previousFetch = global.fetch;
  const calls = [];

  process.env.BOT_TOKEN = botToken;
  delete process.env.ADMIN_BOT_TOKEN;
  process.env.ADMIN_TELEGRAM_IDS = String(ownerId);
  process.env.SUPABASE_URL = 'https://project.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-adjustment-key';
  global.fetch = async (url, options) => {
    calls.push({ url: String(url), body: options.body ? JSON.parse(options.body) : null });
    if (String(url).includes('/nastardamus_users?username=ilike.test_user')) {
      return {
        ok: true,
        status: 200,
        json: async () => [{ telegram_id: targetId, username: 'test_user', first_name: 'Ирина' }]
      };
    }
    if (String(url).includes('/rpc/nastardamus_admin_adjust_wallet')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          telegram_id: targetId,
          amount_units: -2550,
          balance_units: 7450,
          idempotent_replay: false
        })
      };
    }
    if (String(url).includes('/nastardamus_admin_audit')) {
      return { ok: true, status: 201, json: async () => ({}) };
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  try {
    const response = createResponse();
    await adminHandler({
      method: 'POST',
      headers: { 'x-telegram-init-data': signedInitData(botToken, ownerId) },
      body: {
        paymentAction: 'adjust_user_wallet',
        target: '@test_user',
        amount: -25.5,
        idempotencyKey: 'admin-adjust-20260808-0001',
        note: 'Исправление ошибочного начисления'
      }
    }, response);

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.user.telegramId, targetId);
    assert.equal(response.body.adjustment.amount_units, -2550);
    const adjustmentCall = calls.find(({ url }) => url.includes('/rpc/nastardamus_admin_adjust_wallet'));
    assert.equal(adjustmentCall.body.p_admin_id, ownerId);
    assert.equal(adjustmentCall.body.p_telegram_id, targetId);
    assert.equal(adjustmentCall.body.p_amount_units, -2550);
    assert.equal(adjustmentCall.body.p_idempotency_key, 'admin-adjust-20260808-0001');
    assert.ok(calls.some(({ url }) => url.includes('/nastardamus_admin_audit')));
  } finally {
    global.fetch = previousFetch;
    restore();
  }
});

test('admin wallet adjustment migration protects the ledger mutation', () => {
  const sql = readFileSync(
    new URL('../supabase/migrations/20260808123000_add_admin_wallet_adjustment.sql', import.meta.url),
    'utf8'
  );
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /admin-adjust:/);
  assert.match(sql, /balance_units \+ p_amount_units/);
  assert.match(sql, /revoke all[\s\S]*from public, anon, authenticated/);
  assert.match(sql, /grant execute[\s\S]*to service_role/);
});
