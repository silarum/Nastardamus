import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import proxyHandler from '../api/proxy.js';

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
    query_id: 'payment-test-query',
    user: JSON.stringify({ id: userId, first_name: 'Тест' })
  });
  const check = [...params.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  params.set('hash', createHmac('sha256', secret).update(check).digest('hex'));
  return params.toString();
}

function edgeResult(action) {
  if (action === 'take_rate_limit') {
    return { ok: true, allowed: true, remaining: 9, retry_after_seconds: 0 };
  }
  if (action === 'get_public_config') {
    return {
      ok: true,
      settings: {
        paymentsEnabled: true,
        sbpTopupsEnabled: true,
        serviceCatalog: {
          natal: { id: 'natal', title: 'Натальная подсказка', enabled: true, price: 7.77 }
        }
      },
      moderation: { enabled: false }
    };
  }
  if (action === 'charge_service') {
    return {
      ok: true,
      charge: {
        charge_id: '743a8d3f-7654-4d1e-aeed-1fc420fc1282',
        price_units: 777,
        payment_source: 'wallet',
        status: 'charged'
      }
    };
  }
  if (action === 'complete_service_charge' || action === 'refund_service_charge') {
    return { ok: true, charge: { status: action === 'complete_service_charge' ? 'fulfilled' : 'refunded' } };
  }
  throw new Error(`Unexpected edge action: ${action}`);
}

test('paid reading charges before reveal and completes after the provider answer', async () => {
  const botToken = 'telegram-payment-test-token-12345';
  const previousFetch = global.fetch;
  const previous = {
    BOT_TOKEN: process.env.BOT_TOKEN,
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
    ALLOW_UNAUTHENTICATED_PREVIEW: process.env.ALLOW_UNAUTHENTICATED_PREVIEW
  };
  const actions = [];
  process.env.BOT_TOKEN = botToken;
  process.env.DEEPSEEK_API_KEY = 'deepseek-payment-test-key';
  delete process.env.ALLOW_UNAUTHENTICATED_PREVIEW;
  global.fetch = async (url, options) => {
    const body = JSON.parse(options.body);
    if (url.includes('nastardamus-user-store')) {
      actions.push(body.action);
      return { ok: true, status: 200, json: async () => edgeResult(body.action) };
    }
    assert.equal(url, 'https://api.deepseek.com/chat/completions');
    actions.push('provider');
    return {
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: 'Ответ на пергаменте.' } }] })
    };
  };

  try {
    const response = createResponse();
    await proxyHandler({
      method: 'POST',
      headers: { 'x-telegram-init-data': signedInitData(botToken) },
      body: {
        feature: 'natal',
        idempotencyKey: 'reading-natal-1234567890',
        payload: { date: '1990-01-01', time: '12:00' }
      }
    }, response);
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body, {
      answer: 'Ответ на пергаменте.',
      payment: { source: 'wallet', amount: 7.77 }
    });
    assert.ok(actions.indexOf('charge_service') < actions.indexOf('provider'));
    assert.ok(actions.indexOf('provider') < actions.indexOf('complete_service_charge'));
  } finally {
    global.fetch = previousFetch;
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('provider failure automatically refunds a successful service charge', async () => {
  const botToken = 'telegram-refund-test-token-123456';
  const previousFetch = global.fetch;
  const previousBot = process.env.BOT_TOKEN;
  const previousDeepSeek = process.env.DEEPSEEK_API_KEY;
  const actions = [];
  process.env.BOT_TOKEN = botToken;
  process.env.DEEPSEEK_API_KEY = 'deepseek-refund-test-key';
  global.fetch = async (url, options) => {
    const body = JSON.parse(options.body);
    if (url.includes('nastardamus-user-store')) {
      actions.push(body.action);
      return { ok: true, status: 200, json: async () => edgeResult(body.action) };
    }
    actions.push('provider_failed');
    return { ok: false, status: 503, json: async () => ({ error: { message: 'offline' } }) };
  };

  try {
    const response = createResponse();
    await proxyHandler({
      method: 'POST',
      headers: { 'x-telegram-init-data': signedInitData(botToken, 777002) },
      body: {
        feature: 'natal',
        idempotencyKey: 'reading-refund-1234567890',
        payload: { date: '1990-01-01', time: '12:00' }
      }
    }, response);
    assert.equal(response.statusCode, 502);
    assert.equal(response.body.error, 'deepseek_provider_unavailable');
    assert.ok(actions.includes('refund_service_charge'));
    assert.equal(actions.includes('complete_service_charge'), false);
  } finally {
    global.fetch = previousFetch;
    if (previousBot === undefined) delete process.env.BOT_TOKEN;
    else process.env.BOT_TOKEN = previousBot;
    if (previousDeepSeek === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = previousDeepSeek;
  }
});

test('payment migration keeps tables private and mutations service-role only', () => {
  const sql = readFileSync(
    new URL('../supabase/migrations/20260728065724_add_sbp_payments_and_service_charges.sql', import.meta.url),
    'utf8'
  );
  assert.match(sql, /enable row level security/);
  assert.match(sql, /revoke all on table public\.nastardamus_sbp_topups from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public\.nastardamus_charge_service[\s\S]*to service_role/);
  assert.match(sql, /unique \(telegram_id, idempotency_key\)/);
  assert.match(sql, /nastardamus_refund_service_charge/);
});

test('automatic SBP migration verifies bank facts and keeps self-credit owner-only', () => {
  const sql = readFileSync(
    new URL('../supabase/migrations/20260728090515_add_automatic_sbp_and_admin_self_credit.sql', import.meta.url),
    'utf8'
  );

  assert.match(sql, /create table if not exists public\.nastardamus_payment_providers/);
  assert.match(sql, /alter table public\.nastardamus_payment_providers enable row level security/);
  assert.match(sql, /revoke all on table public\.nastardamus_payment_providers from public, anon, authenticated/);
  assert.match(sql, /p_ruble_kopecks = v_order\.ruble_kopecks/);
  assert.match(sql, /upper\(coalesce\(p_currency, ''\)\) = 'RUB'/);
  assert.match(sql, /lower\(coalesce\(p_payment_method, ''\)\) = 'sbp'/);
  assert.match(sql, /verification_state = 'manual_review'/);
  assert.match(sql, /'sbp-provider:' \|\| v_order\.provider_payment_id/);
  assert.match(sql, /create or replace function public\.nastardamus_credit_admin_self/);
  assert.match(sql, /where telegram_id = p_admin_id/);
  assert.match(sql, /grant execute on function public\.nastardamus_credit_admin_self[\s\S]*to service_role/);
  assert.doesNotMatch(
    sql,
    /grant execute on function public\.nastardamus_credit_admin_self[\s\S]{0,300}to (?:anon|authenticated)/
  );
});
