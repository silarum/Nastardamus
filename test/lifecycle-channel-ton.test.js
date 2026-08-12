import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { channelAccessPolicy, checkChannelMembership } from '../lib/channel-access.js';
import { DAILY_FREE_SERVICES, isDailyFreeService, recommendedDailyServices } from '../lib/daily-lifecycle.js';
import { ADMIN_SESSION_COOKIE, createAdminSessionToken } from '../lib/admin-session.js';
import adminHandler from '../api/admin.js';

const app = readFileSync(new URL('../ui-kit/app.js', import.meta.url), 'utf8');
const preferences = readFileSync(new URL('../api/preferences.js', import.meta.url), 'utf8');
const proxy = readFileSync(new URL('../api/proxy.js', import.meta.url), 'utf8');
const wheel = readFileSync(new URL('../api/wheel.js', import.meta.url), 'utf8');
const wallet = readFileSync(new URL('../api/wallet.js', import.meta.url), 'utf8');
const admin = readFileSync(new URL('../api/admin.js', import.meta.url), 'utf8');
const store = readFileSync(new URL('../supabase/functions/nastardamus-user-store/index.ts', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../supabase/migrations/20260808233000_add_lifecycle_popularity_and_daily_access.sql', import.meta.url), 'utf8');
const manifest = JSON.parse(readFileSync(new URL('../tonconnect-manifest.json', import.meta.url), 'utf8'));

test('daily choice includes palmistry and the natal foundation and adapts to user goals', () => {
  assert.equal(DAILY_FREE_SERVICES.length, 5);
  assert.equal(isDailyFreeService('palm_reading'), true);
  assert.equal(isDailyFreeService('natal'), true);
  const love = recommendedDailyServices({ interests: ['relationships'], goals: ['love'] }, '2026-08-08');
  assert.equal(love[0].id, 'tarot_relationship');
  assert.match(love[0].title, /Любовные/);
  const business = recommendedDailyServices({ interests: ['business', 'money'], goals: ['income'] }, '2026-08-09');
  assert.equal(business[0].id, 'tarot');
});

test('channel policy remains open until an actual channel is configured', async () => {
  assert.deepEqual(channelAccessPolicy({ subscriptionGateEnabled: true }), {
    configured: false, username: '', url: '', title: 'Канал Эзотериума'
  });
  const disabled = await checkChannelMembership('', 1, {});
  assert.equal(disabled.member, true);
  assert.equal(disabled.checkRequired, false);
});

test('Telegram membership status is checked server-side', async () => {
  const previousFetch = global.fetch;
  global.fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    assert.equal(body.chat_id, '@esoterium_test');
    assert.equal(body.user_id, 77);
    return { ok: true, json: async () => ({ ok: true, result: { status: 'member' } }) };
  };
  try {
    const access = await checkChannelMembership('bot-token', 77, {
      subscriptionGateEnabled: true,
      subscriptionChannelUsername: '@esoterium_test'
    });
    assert.equal(access.member, true);
    assert.equal(access.checkRequired, true);
  } finally {
    global.fetch = previousFetch;
  }
});

test('onboarding builds and persists the natal foundation before the first daily choice', () => {
  assert.match(app, /natalChart:\s*buildNatalChart\(/);
  assert.match(app, /state\.screen = tg\?\.initData \? 'daily-choice' : 'home'/);
  assert.match(app, /profileName: state\.profile\.name\.trim\(\)/);
  assert.match(preferences, /profileName: req\.body\?\.profileName/);
  assert.match(store, /payload\.profile_name = profileName \|\| null/);
});

test('daily access is atomic and channel-gated on readings, wheel and horoscope', () => {
  assert.match(proxy, /serviceId: 'daily-choice',[\s\S]*dailyLimit: 1/);
  assert.match(proxy, /daily_channel_choice/);
  assert.match(wheel, /assertChannelMembership\(subscription\)/);
  assert.match(proxy, /feature === 'daily_horoscope'[\s\S]*assertChannelMembership\(subscription\)/);
  assert.match(store, /action === "get_daily_access"/);
});

test('journey memory separates facts, observations, hypotheses and service affinity', () => {
  for (const field of ['facts', 'visual_observations', 'ai_hypotheses', 'confirmed_hypotheses', 'rejected_hypotheses', 'service_affinity']) {
    assert.match(migration, new RegExp(`\\b${field}\\b`));
  }
  assert.match(store, /action === "record_journey_insight"/);
  assert.match(proxy, /status: 'tentative'/);
});

test('Stars orders can be cancelled and changed while TON Connect only links a wallet', () => {
  assert.match(wallet, /'cancel_external_payment_order'/);
  assert.doesNotMatch(wallet, /provider_token:/);
  assert.match(app, /new TonConnectUI\(/);
  assert.match(app, /Изменить сумму/);
  assert.match(app, /Покупка SILARUM внутри Telegram выполняется Stars/);
  assert.equal(manifest.url, 'https://nastardamus.vercel.app');
  assert.match(migration, /ton_wallet_address text/);
  assert.match(store, /action === "set_ton_wallet"/);
});

test('admin has configurable subscription policy and popularity based on real service events', () => {
  assert.match(admin, /data-tab="popularity"/);
  assert.match(admin, /subscriptionChannelUsername/);
  assert.match(admin, /tonTreasuryAddress/);
  assert.match(admin, /readServicePopularity/);
  assert.match(migration, /nastardamus_service_popularity/);
  assert.match(migration, /event_type in \('started', 'completed', 'failed', 'free_used', 'paid_used', 'wheel'\)/);
  assert.match(migration, /enable row level security/);
  assert.doesNotMatch(migration, /grant .* to (?:anon|authenticated)/i);
});

test('protected admin assets render the popularity panel and valid JavaScript', async () => {
  const previousIds = process.env.ADMIN_TELEGRAM_IDS;
  const previousSecret = process.env.ADMIN_SESSION_SECRET;
  process.env.ADMIN_TELEGRAM_IDS = '9001';
  process.env.ADMIN_SESSION_SECRET = 'admin-lifecycle-test-secret-2026';
  const token = createAdminSessionToken(9001);
  const request = (control) => ({
    method: 'GET',
    query: { control },
    headers: { cookie: `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(token)}` }
  });
  const response = () => ({
    statusCode: 200, headers: {}, body: '',
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    status(code) { this.statusCode = code; return this; },
    send(body) { this.body = body; return this; }
  });
  try {
    const page = response();
    await adminHandler(request('page'), page);
    assert.equal(page.statusCode, 200);
    assert.match(page.body, /data-panel="popularity"/);
    assert.match(page.body, /name="subscriptionChannelUsername"/);

    const script = response();
    await adminHandler(request('js'), script);
    assert.equal(script.statusCode, 200);
    assert.doesNotThrow(() => new Function(script.body));
    assert.match(script.body, /loadPopularity\(\)/);
  } finally {
    if (previousIds === undefined) delete process.env.ADMIN_TELEGRAM_IDS;
    else process.env.ADMIN_TELEGRAM_IDS = previousIds;
    if (previousSecret === undefined) delete process.env.ADMIN_SESSION_SECRET;
    else process.env.ADMIN_SESSION_SECRET = previousSecret;
  }
});
