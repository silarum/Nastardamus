import { getRequestHeader, validateTelegramInitData } from '../lib/telegram.js';

const DEFAULT_SETTINGS = Object.freeze({
  withdrawalFee: 25,
  minimumWithdrawal: 25,
  withdrawalsEnabled: false,
  wheelEnabled: true,
  wheelPrizeShare: 50,
  wheelMaxPrize: 1000,
  referralsEnabled: true,
  firstReferralRate: 50,
  repeatReferralRate: 13,
  palmLinkEnabled: false,
  jointReadingsEnabled: true,
  partnerPaymentEnabled: true,
  manualPhotoReview: true,
  adultOnly: true
});

function sendJson(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(status).json(body);
}

function parseAdminIds(value) {
  return new Set(
    String(value || '')
      .split(/[\s,;]+/)
      .map(Number)
      .filter(Number.isSafeInteger)
  );
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function sanitizeSettings(input = {}) {
  return {
    withdrawalFee: clampNumber(input.withdrawalFee, 0, 100, 25),
    minimumWithdrawal: clampNumber(input.minimumWithdrawal, 0, 1_000_000, 25),
    withdrawalsEnabled: Boolean(input.withdrawalsEnabled),
    wheelEnabled: Boolean(input.wheelEnabled),
    wheelPrizeShare: clampNumber(input.wheelPrizeShare, 0, 100, 50),
    wheelMaxPrize: clampNumber(input.wheelMaxPrize, 1, 1_000_000, 1000),
    referralsEnabled: Boolean(input.referralsEnabled),
    firstReferralRate: clampNumber(input.firstReferralRate, 0, 100, 50),
    repeatReferralRate: clampNumber(input.repeatReferralRate, 0, 100, 13),
    palmLinkEnabled: Boolean(input.palmLinkEnabled),
    jointReadingsEnabled: Boolean(input.jointReadingsEnabled),
    partnerPaymentEnabled: Boolean(input.partnerPaymentEnabled),
    manualPhotoReview: Boolean(input.manualPhotoReview),
    adultOnly: Boolean(input.adultOnly)
  };
}

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url: url.replace(/\/$/, ''), key } : null;
}

async function supabaseRequest(path, options = {}) {
  const config = getSupabaseConfig();
  if (!config) return null;

  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      ...(options.headers || {})
    },
    signal: AbortSignal.timeout(8_000)
  });

  if (!response.ok) {
    throw new Error(`supabase_${response.status}`);
  }
  return response;
}

async function readSettings() {
  const response = await supabaseRequest('nastardamus_settings?key=eq.global&select=settings&limit=1');
  if (!response) return { settings: DEFAULT_SETTINGS, persisted: false };
  const rows = await response.json();
  return {
    settings: sanitizeSettings(rows?.[0]?.settings || DEFAULT_SETTINGS),
    persisted: true
  };
}

async function writeSettings(settings) {
  const response = await supabaseRequest('nastardamus_settings?on_conflict=key', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal'
    },
    body: JSON.stringify({ key: 'global', settings, updated_at: new Date().toISOString() })
  });
  return Boolean(response);
}

async function getDatabaseRole(userId) {
  const response = await supabaseRequest(
    `nastardamus_admins?telegram_id=eq.${encodeURIComponent(userId)}&select=role&limit=1`
  );
  if (!response) return null;
  const rows = await response.json();
  return typeof rows?.[0]?.role === 'string' ? rows[0].role : null;
}

async function writeAudit(userId, action, payload = {}) {
  const response = await supabaseRequest('nastardamus_admin_audit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ telegram_id: userId, action, payload })
  });
  return Boolean(response);
}

async function resolveAdminRole(userId) {
  if (parseAdminIds(process.env.ADMIN_TELEGRAM_IDS).has(userId)) return 'owner';
  return getDatabaseRole(userId);
}

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST');
    return sendJson(res, 405, { error: 'method_not_allowed' });
  }

  if (req.method === 'GET' && req.query?.health === '1') {
    return sendJson(res, 200, {
      ok: true,
      services: {
        adminBot: Boolean(process.env.ADMIN_BOT_TOKEN || process.env.BOT_TOKEN),
        telegramSecret: Boolean(process.env.TELEGRAM_WEBHOOK_SECRET),
        readings: Boolean(process.env.OPENROUTER_API_KEY),
        webAppUrl: Boolean(process.env.WEB_APP_URL),
        persistence: Boolean(getSupabaseConfig())
      }
    });
  }

  const botToken = process.env.ADMIN_BOT_TOKEN || process.env.BOT_TOKEN;
  const initData = getRequestHeader(req, 'x-telegram-init-data');
  const validation = validateTelegramInitData(initData, botToken, { maxAgeSeconds: 60 * 60 * 12 });
  if (!validation.ok) {
    return sendJson(res, 401, {
      error: 'telegram_auth_required',
      reason: validation.reason
    });
  }

  const userId = Number(validation.user.id);
  const role = await resolveAdminRole(userId);
  if (!role) {
    console.info('Nastardamus admin access requested', {
      telegramId: userId,
      username: validation.user.username || null,
      firstName: validation.user.first_name || null
    });
    return sendJson(res, 403, {
      error: 'admin_access_denied',
      userId,
      registrationRequired: true
    });
  }

  try {
    if (req.method === 'GET') {
      const current = await readSettings();
      await writeAudit(userId, 'admin_opened', { role });
      return sendJson(res, 200, {
        ok: true,
        user: validation.user,
        role,
        accessConfigured: true,
        persistenceConfigured: current.persisted,
        services: {
          bot: Boolean(process.env.ADMIN_BOT_TOKEN || process.env.BOT_TOKEN),
          readings: Boolean(process.env.OPENROUTER_API_KEY),
          webAppUrl: Boolean(process.env.WEB_APP_URL)
        },
        settings: current.settings
      });
    }

    const settings = sanitizeSettings(req.body?.settings);
    const persisted = await writeSettings(settings);
    await writeAudit(userId, 'settings_updated', settings);
    return sendJson(res, 200, { ok: true, persisted, settings });
  } catch (error) {
    console.error('Admin API failed:', error);
    return sendJson(res, 502, { error: 'admin_backend_failed' });
  }
}
