import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import botHandler from '../api/bot.js';
import walletHandler from '../api/wallet.js';

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

function signedInitData(botToken, userId = 881001) {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: 'wallet-stars-test-query',
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

function preserveEnvironment(names) {
  const values = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  return () => {
    for (const [name, value] of Object.entries(values)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  };
}

function emptyWallet(overrides = {}) {
  return {
    ok: true,
    wallet: { balance_units: 50000, locked_units: 0, free_spins: 0 },
    ledger: [],
    withdrawals: [],
    entitlements: [],
    topups: [],
    externalPayments: [],
    vip: null,
    config: {
      paymentsEnabled: true,
      everythingFree: false,
      paymentMethods: { stars: { enabled: true, miniApp: true } },
      paymentRates: { starsPerSilarum: 50 },
      vipPlans: [],
      ...overrides
    }
  };
}

test('wallet creates a Telegram Stars invoice and returns its persisted link', async () => {
  const botToken = 'telegram-wallet-stars-test-token';
  const orderId = '5aacb8aa-d94f-4c31-9818-3c3ac128b9b1';
  const invoiceUrl = 'https://t.me/$invoice-test';
  const restore = preserveEnvironment(['BOT_TOKEN']);
  const previousFetch = global.fetch;
  const actions = [];
  let invoiceBody;
  process.env.BOT_TOKEN = botToken;

  global.fetch = async (url, options) => {
    if (String(url).includes('/nastardamus-user-store')) {
      const body = JSON.parse(options.body);
      actions.push(body.action);
      if (body.action === 'take_rate_limit') {
        return { ok: true, status: 200, json: async () => ({ ok: true, allowed: true, remaining: 7 }) };
      }
      if (body.action === 'create_external_payment_order') {
        assert.equal(body.provider, 'telegram_stars');
        assert.equal(body.amountUnits, 250);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            order: {
              id: orderId,
              provider: 'telegram_stars',
              silarum_units: 250,
              provider_amount: 125,
              provider_currency: 'XTR',
              payment_reference: 'NS-STARS',
              status: 'pending'
            }
          })
        };
      }
      if (body.action === 'set_external_payment_url') {
        assert.equal(body.orderId, orderId);
        assert.equal(body.paymentUrl, invoiceUrl);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            order: {
              id: orderId,
              provider: 'telegram_stars',
              silarum_units: 250,
              provider_amount: 125,
              provider_currency: 'XTR',
              payment_reference: 'NS-STARS',
              payment_url: invoiceUrl,
              status: 'pending'
            }
          })
        };
      }
      if (body.action === 'get_wallet') {
        return { ok: true, status: 200, json: async () => emptyWallet() };
      }
      throw new Error(`Unexpected wallet action ${body.action}`);
    }
    assert.match(String(url), /\/createInvoiceLink$/);
    invoiceBody = JSON.parse(options.body);
    return { ok: true, status: 200, json: async () => ({ ok: true, result: invoiceUrl }) };
  };

  try {
    const response = createResponse();
    await walletHandler({
      method: 'POST',
      headers: { 'x-telegram-init-data': signedInitData(botToken) },
      body: {
        action: 'create_external_payment_order',
        provider: 'telegram_stars',
        amount: 2.5,
        idempotencyKey: 'stars-order-1234567890'
      }
    }, response);

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.order.paymentUrl, invoiceUrl);
    assert.equal(response.body.order.providerCurrency, 'XTR');
    assert.equal(invoiceBody.currency, 'XTR');
    assert.equal(Object.hasOwn(invoiceBody, 'provider_token'), false);
    assert.deepEqual(invoiceBody.prices, [{ label: 'SILARUM', amount: 125 }]);
    assert.equal(invoiceBody.payload, `silarum:${orderId}`);
    assert.deepEqual(actions, [
      'take_rate_limit',
      'create_external_payment_order',
      'set_external_payment_url',
      'get_wallet'
    ]);
  } finally {
    global.fetch = previousFetch;
    restore();
  }
});

test('wallet purchases VIP idempotently and returns the refreshed active plan', async () => {
  const botToken = 'telegram-wallet-vip-test-token';
  const restore = preserveEnvironment(['BOT_TOKEN']);
  const previousFetch = global.fetch;
  const actions = [];
  process.env.BOT_TOKEN = botToken;
  const subscription = {
    id: 'f87aaea1-bc81-4ceb-b843-f66de618ff28',
    plan_id: 'vip-month',
    starts_at: '2026-08-08T12:00:00Z',
    expires_at: '2026-09-07T12:00:00Z'
  };

  global.fetch = async (url, options) => {
    assert.ok(String(url).includes('/nastardamus-user-store'));
    const body = JSON.parse(options.body);
    actions.push(body.action);
    if (body.action === 'take_rate_limit') {
      return { ok: true, status: 200, json: async () => ({ ok: true, allowed: true, remaining: 4 }) };
    }
    if (body.action === 'purchase_vip') {
      assert.equal(body.planId, 'vip-month');
      assert.equal(body.idempotencyKey, 'vip-order-1234567890');
      return { ok: true, status: 200, json: async () => ({ ok: true, subscription }) };
    }
    if (body.action === 'get_wallet') {
      return {
        ok: true,
        status: 200,
        json: async () => emptyWallet({
          vip: subscription,
          vipPlans: [{
            id: 'vip-month', title: 'VIP на месяц', durationDays: 30,
            price: 199, includedReadings: 2, displayOrder: 10, enabled: true
          }]
        })
      };
    }
    throw new Error(`Unexpected wallet action ${body.action}`);
  };

  try {
    const response = createResponse();
    await walletHandler({
      method: 'POST',
      headers: { 'x-telegram-init-data': signedInitData(botToken, 881002) },
      body: {
        action: 'purchase_vip',
        planId: 'vip-month',
        idempotencyKey: 'vip-order-1234567890'
      }
    }, response);

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.subscription.planId, 'vip-month');
    assert.equal(response.body.vip.planId, 'vip-month');
    assert.equal(response.body.config.vipPlans[0].price, 199);
    assert.deepEqual(actions, ['take_rate_limit', 'purchase_vip', 'get_wallet']);
  } finally {
    global.fetch = previousFetch;
    restore();
  }
});

test('Telegram Stars checkout is verified before Telegram receives approval', async () => {
  const botToken = 'telegram-stars-bot-test-token';
  const webhookSecret = 'telegram-stars-webhook-secret';
  const orderId = '1c7b3b88-7104-4dc2-895c-f9cc81d8a42b';
  const restore = preserveEnvironment(['BOT_TOKEN', 'TELEGRAM_WEBHOOK_SECRET']);
  const previousFetch = global.fetch;
  const sequence = [];
  process.env.BOT_TOKEN = botToken;
  process.env.TELEGRAM_WEBHOOK_SECRET = webhookSecret;

  global.fetch = async (url, options) => {
    if (String(url).includes('/nastardamus-user-store')) {
      const body = JSON.parse(options.body);
      sequence.push(body.action);
      if (body.action === 'claim_telegram_update') {
        return { ok: true, status: 200, json: async () => ({ ok: true, claimed: true }) };
      }
      assert.equal(body.action, 'verify_external_payment');
      assert.equal(body.orderId, orderId);
      assert.equal(body.totalAmount, 150);
      assert.equal(body.currency, 'XTR');
      return { ok: true, status: 200, json: async () => ({ ok: true, orderId }) };
    }
    assert.match(String(url), /\/answerPreCheckoutQuery$/);
    const body = JSON.parse(options.body);
    sequence.push('answerPreCheckoutQuery');
    assert.equal(body.ok, true);
    return { ok: true, status: 200, json: async () => ({ ok: true, result: true }) };
  };

  try {
    const response = createResponse();
    await botHandler({
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': webhookSecret },
      body: {
        update_id: 88001,
        pre_checkout_query: {
          id: 'checkout-1',
          from: { id: 881003 },
          invoice_payload: `silarum:${orderId}`,
          currency: 'XTR',
          total_amount: 150
        }
      }
    }, response);
    assert.equal(response.statusCode, 200);
    assert.deepEqual(sequence, [
      'claim_telegram_update',
      'verify_external_payment',
      'answerPreCheckoutQuery'
    ]);
  } finally {
    global.fetch = previousFetch;
    restore();
  }
});

test('failed Stars receipt delivery releases the claimed update for a safe retry', async () => {
  const botToken = 'telegram-stars-retry-test-token';
  const webhookSecret = 'telegram-stars-retry-webhook';
  const orderId = '132b12fa-5436-480a-a55e-9b31eaad9d23';
  const restore = preserveEnvironment(['BOT_TOKEN', 'TELEGRAM_WEBHOOK_SECRET']);
  const previousFetch = global.fetch;
  const actions = [];
  process.env.BOT_TOKEN = botToken;
  process.env.TELEGRAM_WEBHOOK_SECRET = webhookSecret;

  global.fetch = async (url, options) => {
    if (String(url).includes('/nastardamus-user-store')) {
      const body = JSON.parse(options.body);
      actions.push(body.action);
      if (body.action === 'claim_telegram_update') {
        return { ok: true, status: 200, json: async () => ({ ok: true, claimed: true }) };
      }
      if (body.action === 'complete_external_payment') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true, payment: { silarum_units: 300 } })
        };
      }
      if (body.action === 'release_telegram_update') {
        assert.equal(body.updateId, 88002);
        return { ok: true, status: 200, json: async () => ({ ok: true, released: true }) };
      }
      throw new Error(`Unexpected bot action ${body.action}`);
    }
    assert.match(String(url), /\/sendMessage$/);
    return { ok: false, status: 503, json: async () => ({ ok: false }) };
  };

  try {
    const response = createResponse();
    await botHandler({
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': webhookSecret },
      body: {
        update_id: 88002,
        message: {
          from: { id: 881004 },
          chat: { id: 881004 },
          successful_payment: {
            invoice_payload: `silarum:${orderId}`,
            telegram_payment_charge_id: 'tg-charge-1',
            provider_payment_charge_id: 'provider-charge-1',
            currency: 'XTR',
            total_amount: 150
          }
        }
      }
    }, response);
    assert.equal(response.statusCode, 502);
    assert.deepEqual(actions, [
      'claim_telegram_update',
      'complete_external_payment',
      'release_telegram_update'
    ]);
  } finally {
    global.fetch = previousFetch;
    restore();
  }
});

test('retry and free-access migrations remain service-role only', () => {
  const retrySql = readFileSync(
    new URL('../supabase/migrations/20260808120000_release_failed_telegram_updates.sql', import.meta.url),
    'utf8'
  );
  const freeSql = readFileSync(
    new URL('../supabase/migrations/20260808121500_add_free_joint_invitation_completion.sql', import.meta.url),
    'utf8'
  );
  assert.match(retrySql, /revoke (?:all|execute)[\s\S]*from public, anon, authenticated/);
  assert.match(retrySql, /grant execute[\s\S]*to service_role/);
  assert.match(freeSql, /everythingFree/);
  assert.match(freeSql, /revoke execute[\s\S]*from public, anon, authenticated/);
  assert.match(freeSql, /grant execute[\s\S]*to service_role/);
});
