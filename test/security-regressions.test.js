import assert from 'node:assert/strict';
import test from 'node:test';

import proxyHandler from '../api/proxy.js';
import walletHandler from '../api/wallet.js';
import wheelHandler from '../api/wheel.js';
import dailyHoroscopeHandler from '../api/daily-horoscope.js';
import {
  normalizeIdempotencyKey,
  unauthenticatedPreviewAllowed,
  validateProviderBaseUrl
} from '../lib/request-security.js';

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

function preserveEnvironment(names) {
  const values = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  return () => {
    for (const [name, value] of Object.entries(values)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  };
}

test('unauthenticated preview can never activate in production', () => {
  const restore = preserveEnvironment(['ALLOW_UNAUTHENTICATED_PREVIEW', 'VERCEL_ENV', 'NODE_ENV']);
  try {
    process.env.ALLOW_UNAUTHENTICATED_PREVIEW = 'true';
    process.env.VERCEL_ENV = 'production';
    delete process.env.NODE_ENV;
    assert.equal(unauthenticatedPreviewAllowed(), false);
  } finally {
    restore();
  }
});

test('wallet writes reject unauthenticated preview requests', async () => {
  const restore = preserveEnvironment(['BOT_TOKEN', 'ALLOW_UNAUTHENTICATED_PREVIEW', 'VERCEL_ENV', 'NODE_ENV']);
  try {
    process.env.BOT_TOKEN = 'telegram-test-token-long-enough';
    process.env.ALLOW_UNAUTHENTICATED_PREVIEW = 'true';
    delete process.env.VERCEL_ENV;
    delete process.env.NODE_ENV;
    const response = createResponse();
    await walletHandler({
      method: 'POST',
      headers: {},
      body: {
        action: 'request_withdrawal',
        amount: 25,
        destination: 'test-destination',
        idempotencyKey: 'withdrawal-1234567890'
      }
    }, response);
    assert.equal(response.statusCode, 401);
    assert.equal(response.body.error, 'telegram_auth_required');
  } finally {
    restore();
  }
});

test('wheel claims always require a signed Telegram session', async () => {
  const restore = preserveEnvironment(['BOT_TOKEN', 'ALLOW_UNAUTHENTICATED_PREVIEW']);
  try {
    process.env.BOT_TOKEN = 'telegram-test-token-long-enough';
    process.env.ALLOW_UNAUTHENTICATED_PREVIEW = 'true';
    const response = createResponse();
    await wheelHandler({
      method: 'POST',
      headers: {},
      body: { idempotencyKey: 'wheel-1234567890-abcdef' }
    }, response);
    assert.equal(response.statusCode, 401);
    assert.equal(response.body.error, 'telegram_auth_required');
  } finally {
    restore();
  }
});

test('daily horoscope delivery requires the private scheduler token', async () => {
  const response = createResponse();
  await dailyHoroscopeHandler({ method: 'GET', headers: {} }, response);
  assert.equal(response.statusCode, 401);
  assert.equal(response.body.error, 'cron_authorization_required');
});

test('photo reading requires explicit consent before provider calls', async () => {
  const restore = preserveEnvironment([
    'BOT_TOKEN',
    'OPENAI_API_KEY',
    'ALLOW_UNAUTHENTICATED_PREVIEW',
    'VERCEL_ENV',
    'NODE_ENV'
  ]);
  const previousFetch = global.fetch;
  let called = false;
  try {
    process.env.BOT_TOKEN = 'telegram-test-token-long-enough';
    process.env.OPENAI_API_KEY = 'openai-test-key';
    process.env.ALLOW_UNAUTHENTICATED_PREVIEW = 'true';
    delete process.env.VERCEL_ENV;
    delete process.env.NODE_ENV;
    global.fetch = async () => {
      called = true;
      throw new Error('provider must not be called');
    };
    const response = createResponse();
    await proxyHandler({
      method: 'POST',
      headers: {},
      body: {
        feature: 'photo_energy',
        payload: {
          concern: 'Тест',
          image: 'data:image/webp;base64,AA=='
        }
      }
    }, response);
    assert.equal(response.statusCode, 400);
    assert.equal(response.body.error, 'photo_consent_required');
    assert.equal(called, false);
  } finally {
    global.fetch = previousFetch;
    restore();
  }
});

test('AI provider URLs are restricted to trusted hosts', () => {
  assert.equal(
    validateProviderBaseUrl('https://api.openai.com/v1', 'openai'),
    'https://api.openai.com/v1'
  );
  assert.throws(
    () => validateProviderBaseUrl('https://127.0.0.1/internal', 'openai'),
    /untrusted_ai_provider_host/
  );
  assert.throws(
    () => validateProviderBaseUrl('https://example.com/collect', 'openai'),
    /untrusted_ai_provider_host/
  );
});

test('financial idempotency keys require sufficient entropy-shaped input', () => {
  assert.equal(normalizeIdempotencyKey('short'), '');
  assert.equal(
    normalizeIdempotencyKey('withdrawal-1234567890'),
    'withdrawal-1234567890'
  );
});
