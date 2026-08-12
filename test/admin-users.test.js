import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';

import adminHandler from '../api/admin.js';

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    headers: new Map(),
    setHeader(name, value) { this.headers.set(String(name).toLowerCase(), value); },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

function signedInitData(botToken, userId) {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: 'admin-users-test-query',
    user: JSON.stringify({ id: userId, first_name: 'Администратор' })
  });
  const check = [...params.entries()].sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  params.set('hash', createHmac('sha256', secret).update(check).digest('hex'));
  return params.toString();
}

function preserveEnvironment(names) {
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  return () => {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  };
}

test('owner can view user metrics and grant an exact audited VIP expiry', async () => {
  const ownerId = 880072811111;
  const targetId = 990072811111;
  const botToken = 'telegram-admin-users-owner-test-token';
  const restore = preserveEnvironment(['BOT_TOKEN', 'ADMIN_BOT_TOKEN', 'ADMIN_TELEGRAM_IDS']);
  const previousFetch = global.fetch;
  const calls = [];
  process.env.BOT_TOKEN = botToken;
  delete process.env.ADMIN_BOT_TOKEN;
  process.env.ADMIN_TELEGRAM_IDS = String(ownerId);
  global.fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    calls.push(body);
    const payload = body.action === 'admin_overview'
      ? { ok: true, metrics: { users: 25, horoscopeEnabled: 8, walletBalanceUnits: 10000 } }
      : body.action === 'admin_set_user_vip'
        ? { ok: true, vip: { telegram_id: targetId, plan_id: body.planId, expires_at: body.expiresAt } }
        : { ok: true };
    return { ok: true, status: 200, json: async () => payload };
  };

  try {
    const headers = { 'x-telegram-init-data': signedInitData(botToken, ownerId) };
    const overview = responseRecorder();
    await adminHandler({ method: 'GET', headers, query: { adminUsers: 'overview' } }, overview);
    assert.equal(overview.statusCode, 200);
    assert.equal(overview.body.metrics.users, 25);
    assert.equal(overview.body.capabilities.manageUsers, true);
    assert.equal(overview.body.capabilities.manageFinance, true);

    const expiresAt = new Date(Date.now() + 30 * 86400000).toISOString();
    const vip = responseRecorder();
    await adminHandler({
      method: 'POST',
      headers,
      query: { adminUsers: 'action' },
      body: { action: 'set_user_vip', telegramId: targetId, active: true, planId: 'vip-month', expiresAt }
    }, vip);
    assert.equal(vip.statusCode, 200);
    assert.equal(vip.body.vip.expires_at, expiresAt);
    assert.ok(calls.some((call) => call.action === 'admin_set_user_vip' && call.adminId === ownerId));
    assert.ok(calls.some((call) => call.action === 'write_audit' && call.auditAction === 'user_vip_granted'));
  } finally {
    global.fetch = previousFetch;
    restore();
  }
});

test('read-only operator cannot mutate a user or finance state', async () => {
  const operatorId = 880072822222;
  const botToken = 'telegram-admin-users-operator-token';
  const restore = preserveEnvironment(['BOT_TOKEN', 'ADMIN_BOT_TOKEN', 'ADMIN_TELEGRAM_IDS']);
  const previousFetch = global.fetch;
  const calls = [];
  process.env.BOT_TOKEN = botToken;
  delete process.env.ADMIN_BOT_TOKEN;
  delete process.env.ADMIN_TELEGRAM_IDS;
  global.fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    calls.push(body);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        profile: { telegram_id: operatorId, role: 'operator', is_active: true, permissions: { 'users.view': true } }
      })
    };
  };

  try {
    const response = responseRecorder();
    await adminHandler({
      method: 'POST',
      headers: { 'x-telegram-init-data': signedInitData(botToken, operatorId) },
      query: { adminUsers: 'action' },
      body: { action: 'set_user_vip', telegramId: 990072822222, active: false }
    }, response);
    assert.equal(response.statusCode, 403);
    assert.equal(response.body.error, 'permission_denied');
    assert.equal(calls.some((call) => call.action === 'admin_set_user_vip'), false);
  } finally {
    global.fetch = previousFetch;
    restore();
  }
});
