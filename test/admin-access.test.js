import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { adminReply } from '../api/admin-bot.js';
import { hasAdminPanelAccess } from '../lib/admin-access.js';
import {
  ADMIN_SESSION_TTL_SECONDS,
  createAdminSessionToken,
  verifyAdminSessionToken
} from '../lib/admin-session.js';
import adminHandler from '../api/admin.js';

const TEST_SECRET = 'test-admin-session-secret-2026';

function update(text, userId = 101) {
  return {
    message: {
      text,
      chat: { id: 202 },
      from: { id: userId, first_name: 'Test' }
    }
  };
}

function responseRecorder() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    send(body) {
      this.body = body;
      return this;
    }
  };
}

test('only active owner, admin and operator roles can enter the control panel', () => {
  for (const role of ['owner', 'admin', 'operator']) {
    assert.equal(hasAdminPanelAccess({ role, is_active: true }), true);
  }
  for (const role of ['support', 'manager', 'moderator', 'analyst', '', null]) {
    assert.equal(hasAdminPanelAccess({ role, is_active: true }), false);
  }
  assert.equal(hasAdminPanelAccess({ role: 'admin', is_active: false }), false);
  assert.equal(hasAdminPanelAccess(null), false);
});

test('control session is signed, short-lived and rejects tampering', () => {
  const token = createAdminSessionToken(101, {
    nowSeconds: 1_000,
    nonce: 'fixed-test-nonce',
    secret: TEST_SECRET
  });
  assert.deepEqual(
    verifyAdminSessionToken(token, { nowSeconds: 1_001, secret: TEST_SECRET }),
    { ok: true, userId: 101, expiresAt: 1_000 + ADMIN_SESSION_TTL_SECONDS }
  );
  assert.equal(
    verifyAdminSessionToken(`${token}x`, { nowSeconds: 1_001, secret: TEST_SECRET }).ok,
    false
  );
  assert.equal(
    verifyAdminSessionToken(token, {
      nowSeconds: 1_001 + ADMIN_SESSION_TTL_SECONDS,
      secret: TEST_SECRET
    }).ok,
    false
  );
});

test('the admin bot gives ordinary users only the standard Ezoterium entry', () => {
  const denied = adminReply(update('/admin'), { authorized: false });
  const deniedText = JSON.stringify(denied).toLowerCase();
  assert.match(denied.payload.text, /Эзотериум/u);
  assert.match(denied.payload.reply_markup.inline_keyboard[0][0].web_app.url, /^https:\/\/nastardamus\.vercel\.app\/?$/u);
  assert.equal(deniedText.includes('админ'), false);
  assert.equal(deniedText.includes('/admin'), false);

  const allowed = adminReply(update('/admin'), { authorized: true });
  assert.match(allowed.payload.reply_markup.inline_keyboard[0][0].web_app.url, /\/admin\/$/u);
});

test('direct control route returns a neutral Ezoterium gate without a signed role session', async () => {
  const req = { method: 'GET', query: { control: 'page' }, headers: {} };
  const res = responseRecorder();
  await adminHandler(req, res);

  assert.equal(res.statusCode, 200);
  assert.match(res.body, /<title>Эзотериум<\/title>/u);
  assert.match(res.body, /control-entry-gate\.js/u);
  assert.equal(res.body.includes('Админ-панель'), false);
  assert.equal(res.body.includes('Nastardamus Control'), false);
});

test('all static control files are intercepted by protected server routes', () => {
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  const routes = new Map(config.rewrites.map((rewrite) => [rewrite.source, rewrite.destination]));
  assert.equal(routes.get('/admin'), '/api/admin?control=page');
  assert.equal(routes.get('/admin/'), '/api/admin?control=page');
  assert.equal(routes.get('/admin/index.html'), '/api/admin?control=page');
  assert.equal(routes.get('/admin/admin.css'), '/api/admin?control=css');
  assert.equal(routes.get('/admin/admin.js'), '/api/admin?control=js');
  for (const path of ['../admin/index.html', '../admin/admin.css', '../admin/admin.js']) {
    assert.equal(existsSync(new URL(path, import.meta.url)), false);
  }
});

test('database migration accepts only owner, admin and operator roles', () => {
  const sql = readFileSync(
    new URL('../supabase/migrations/20260728133309_restrict_admin_panel_roles.sql', import.meta.url),
    'utf8'
  );
  assert.match(sql, /role in \('owner', 'admin', 'operator'\)/u);
  assert.doesNotMatch(sql, /role in \([^)]*'support'/u);
});
