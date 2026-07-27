import { getRequestHeader, validateTelegramInitData } from '../lib/telegram.js';

const ADMIN_STORE_URL = process.env.ADMIN_STORE_URL
  || 'https://hngfpdsnjgdpazmortix.supabase.co/functions/v1/nastardamus-admin-store';

const SERVICE_DEFINITIONS = Object.freeze({
  tarot: 'Расклад Таро',
  tarot_relationship: 'Расклад Таро на двоих',
  natal: 'Натальная подсказка',
  photo_energy: 'Энергетический след',
  photo_damage: 'Определение порчи',
  photo_compatibility: 'Совместимость по фото',
  palmlink: 'Путь двух судеб'
});

const DEFAULT_SERVICE_CATALOG = Object.freeze(
  Object.fromEntries(Object.entries(SERVICE_DEFINITIONS).map(([id, title]) => [
    id,
    { id, title, enabled: true, price: null }
  ]))
);

const DEFAULT_WHEEL_REWARDS = Object.freeze([
  { id: 'pair-tarot', serviceId: 'tarot_relationship', title: 'Бесплатный расклад на двоих', enabled: true, quantity: 1, dailyLimit: 5, weight: 4 },
  { id: 'photo-pair', serviceId: 'photo_compatibility', title: 'Совместимость по фото', enabled: true, quantity: 1, dailyLimit: 5, weight: 3 },
  { id: 'destiny-pair', serviceId: 'palmlink', title: 'Путь двух судеб', enabled: false, quantity: 1, dailyLimit: 3, weight: 2 }
]);

const DEFAULT_SETTINGS = Object.freeze({
  withdrawalFee: 25,
  minimumWithdrawal: 25,
  withdrawalsEnabled: false,
  wheelEnabled: true,
  wheelPrizeShare: 50,
  wheelMaxPrize: 1000,
  wheelDailySpins: 1,
  wheelRewards: DEFAULT_WHEEL_REWARDS,
  serviceCatalog: DEFAULT_SERVICE_CATALOG,
  dailyHoroscopeEnabled: true,
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

function sanitizeServiceCatalog(input) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  return Object.fromEntries(Object.entries(SERVICE_DEFINITIONS).map(([id, title]) => {
    const item = source[id] && typeof source[id] === 'object' ? source[id] : {};
    const numericPrice = item.price === '' || item.price === null || item.price === undefined
      ? null
      : clampNumber(item.price, 0, 1_000_000, null);
    return [id, {
      id,
      title,
      enabled: item.enabled !== false,
      price: numericPrice
    }];
  }));
}

function sanitizeWheelRewards(input) {
  const source = Array.isArray(input) ? input : DEFAULT_WHEEL_REWARDS;
  const seen = new Set();
  return source.slice(0, 24).flatMap((item, index) => {
    if (!item || typeof item !== 'object') return [];
    const serviceId = String(item.serviceId || '');
    if (!SERVICE_DEFINITIONS[serviceId]) return [];
    const rawId = String(item.id || `reward-${index + 1}`).toLowerCase();
    const id = rawId.replace(/[^a-z0-9_-]/g, '').slice(0, 48);
    if (!id || seen.has(id)) return [];
    seen.add(id);
    return [{
      id,
      serviceId,
      title: String(item.title || SERVICE_DEFINITIONS[serviceId]).trim().slice(0, 100),
      enabled: item.enabled === true,
      quantity: Math.round(clampNumber(item.quantity, 1, 20, 1)),
      dailyLimit: Math.round(clampNumber(item.dailyLimit, 0, 100_000, 0)),
      weight: Math.round(clampNumber(item.weight, 1, 10_000, 1))
    }];
  });
}

function sanitizeSettings(input = {}) {
  return {
    withdrawalFee: clampNumber(input.withdrawalFee, 0, 100, 25),
    minimumWithdrawal: clampNumber(input.minimumWithdrawal, 0, 1_000_000, 25),
    withdrawalsEnabled: Boolean(input.withdrawalsEnabled),
    wheelEnabled: Boolean(input.wheelEnabled),
    wheelPrizeShare: clampNumber(input.wheelPrizeShare, 0, 100, 50),
    wheelMaxPrize: clampNumber(input.wheelMaxPrize, 1, 1_000_000, 1000),
    wheelDailySpins: Math.round(clampNumber(input.wheelDailySpins, 1, 10, 1)),
    wheelRewards: sanitizeWheelRewards(input.wheelRewards),
    serviceCatalog: sanitizeServiceCatalog(input.serviceCatalog),
    dailyHoroscopeEnabled: input.dailyHoroscopeEnabled !== false,
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

function hasPermission(profile, permission) {
  if (!profile?.is_active) return false;
  if (profile.role === 'owner') return true;
  return profile.permissions?.[permission] === true;
}

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url: url.replace(/\/$/, ''), key } : null;
}

async function directSupabaseRequest(path, options = {}) {
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
  if (!response.ok) throw new Error(`supabase_${response.status}`);
  return response;
}

async function edgeStore(botToken, action, payload = {}) {
  if (!botToken) throw new Error('admin_bot_token_missing');
  const response = await fetch(ADMIN_STORE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Bot-Token': botToken
    },
    body: JSON.stringify({ action, ...payload }),
    signal: AbortSignal.timeout(12_000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) throw new Error(data.error || `admin_store_${response.status}`);
  return data;
}

async function readSettings(botToken) {
  const direct = await directSupabaseRequest('nastardamus_settings?key=eq.global&select=settings&limit=1');
  if (direct) {
    const rows = await direct.json();
    return { settings: sanitizeSettings(rows?.[0]?.settings || DEFAULT_SETTINGS), persisted: true };
  }
  const data = await edgeStore(botToken, 'read_settings');
  return { settings: sanitizeSettings(data.settings || DEFAULT_SETTINGS), persisted: true };
}

async function writeSettings(settings, botToken) {
  const direct = await directSupabaseRequest('nastardamus_settings?on_conflict=key', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal'
    },
    body: JSON.stringify({ key: 'global', settings, updated_at: new Date().toISOString() })
  });
  if (direct) return true;
  await edgeStore(botToken, 'write_settings', { settings });
  return true;
}

async function getAdminProfile(userId, botToken, telegramUser) {
  if (parseAdminIds(process.env.ADMIN_TELEGRAM_IDS).has(userId)) {
    return {
      telegram_id: userId,
      role: 'owner',
      display_name: telegramUser?.first_name || null,
      username: telegramUser?.username || null,
      permissions: { '*': true },
      is_active: true
    };
  }

  const direct = await directSupabaseRequest(
    `nastardamus_admins?telegram_id=eq.${encodeURIComponent(userId)}&select=telegram_id,role,display_name,username,permissions,is_active&limit=1`
  );
  if (direct) {
    const rows = await direct.json();
    return rows?.[0] || null;
  }
  return (await edgeStore(botToken, 'get_admin_profile', { telegramId: userId })).profile || null;
}

async function writeAudit(userId, action, payload, botToken) {
  const direct = await directSupabaseRequest('nastardamus_admin_audit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ telegram_id: userId, action, payload })
  });
  if (direct) return true;
  await edgeStore(botToken, 'write_audit', {
    telegramId: userId,
    auditAction: action,
    payload
  });
  return true;
}

async function checkPersistence(botToken) {
  if (getSupabaseConfig()) return true;
  try {
    await edgeStore(botToken, 'read_settings');
    return true;
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST');
    return sendJson(res, 405, { error: 'method_not_allowed' });
  }

  const botToken = process.env.ADMIN_BOT_TOKEN || process.env.BOT_TOKEN;

  if (req.method === 'GET' && req.query?.health === '1') {
    return sendJson(res, 200, {
      ok: true,
      services: {
        adminBot: Boolean(botToken),
        telegramSecret: Boolean(process.env.TELEGRAM_WEBHOOK_SECRET),
        readings: Boolean(process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY),
        webAppUrl: Boolean(process.env.WEB_APP_URL),
        persistence: await checkPersistence(botToken)
      }
    });
  }

  const initData = getRequestHeader(req, 'x-telegram-init-data');
  const validation = validateTelegramInitData(initData, botToken, { maxAgeSeconds: 60 * 60 * 12 });
  if (!validation.ok) {
    return sendJson(res, 401, {
      error: 'telegram_auth_required',
      reason: validation.reason
    });
  }

  const userId = Number(validation.user.id);
  const profile = await getAdminProfile(userId, botToken, validation.user);
  if (!profile?.is_active) {
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
      const current = await readSettings(botToken);
      await Promise.all([
        writeAudit(userId, 'admin_opened', { role: profile.role }, botToken),
        edgeStore(botToken, 'touch_admin', { telegramId: userId }).catch(() => null)
      ]);
      return sendJson(res, 200, {
        ok: true,
        user: validation.user,
        role: profile.role,
        permissions: profile.permissions || {},
        accessConfigured: true,
        persistenceConfigured: current.persisted,
        canManageSettings: hasPermission(profile, 'settings.manage'),
        services: {
          bot: Boolean(botToken),
          readings: Boolean(process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY),
          webAppUrl: Boolean(process.env.WEB_APP_URL)
        },
        settings: current.settings
      });
    }

    if (!hasPermission(profile, 'settings.manage')) {
      return sendJson(res, 403, { error: 'permission_denied' });
    }

    const settings = sanitizeSettings(req.body?.settings);
    const persisted = await writeSettings(settings, botToken);
    await writeAudit(userId, 'settings_updated', settings, botToken);
    return sendJson(res, 200, { ok: true, persisted, settings });
  } catch (error) {
    console.error('Admin API failed:', error);
    return sendJson(res, 502, { error: 'admin_backend_failed' });
  }
}
