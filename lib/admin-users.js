import { getRequestHeader, validateTelegramInitData } from './telegram.js';
import { hasAdminPanelAccess, parseOwnerIds } from './admin-access.js';

const ADMIN_STORE_URL = process.env.ADMIN_STORE_URL
  || 'https://hngfpdsnjgdpazmortix.supabase.co/functions/v1/nastardamus-admin-store';

function sendJson(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(status).json(body);
}

function cleanText(value, maxLength = 120) {
  return String(value || '').trim().slice(0, maxLength);
}

function hasPermission(profile, permission) {
  if (!profile?.is_active) return false;
  if (profile.role === 'owner') return true;
  return profile.permissions?.[permission] === true;
}

async function edgeStore(botToken, action, payload = {}) {
  if (!botToken) throw new Error('admin_bot_token_missing');
  const response = await fetch(ADMIN_STORE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Bot-Token': botToken
    },
    body: JSON.stringify({ ...payload, action }),
    signal: AbortSignal.timeout(20_000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) {
    const error = new Error(data.error || `admin_store_${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

async function authenticate(req) {
  const botToken = process.env.ADMIN_BOT_TOKEN || process.env.BOT_TOKEN;
  const initData = getRequestHeader(req, 'x-telegram-init-data');
  const validation = validateTelegramInitData(initData, botToken, { maxAgeSeconds: 60 * 60 * 12 });
  if (!validation.ok) {
    return { error: { status: 401, body: { error: 'telegram_auth_required' } } };
  }

  const userId = Number(validation.user.id);
  let profile;
  if (parseOwnerIds().has(userId)) {
    profile = {
      telegram_id: userId,
      role: 'owner',
      permissions: { '*': true },
      is_active: true
    };
  } else {
    profile = (await edgeStore(botToken, 'get_admin_profile', { telegramId: userId })).profile;
  }
  if (!hasAdminPanelAccess(profile)) {
    return { error: { status: 403, body: { error: 'admin_access_denied' } } };
  }
  return { botToken, userId, profile };
}

async function audit(botToken, userId, auditAction, payload = {}) {
  await edgeStore(botToken, 'write_audit', {
    telegramId: userId,
    auditAction,
    payload
  }).catch(() => {});
}

function capabilitiesFor(profile) {
  return {
    viewUsers: hasPermission(profile, 'users.view') || hasPermission(profile, 'users.manage'),
    manageUsers: hasPermission(profile, 'users.manage'),
    viewFinance: hasPermission(profile, 'finance.view') || hasPermission(profile, 'finance.manage'),
    manageFinance: hasPermission(profile, 'finance.manage'),
    viewAudit: hasPermission(profile, 'audit.view')
  };
}

function validTelegramId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : 0;
}

export async function handleAdminUsersRequest(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST');
    return sendJson(res, 405, { error: 'method_not_allowed' });
  }

  try {
    const auth = await authenticate(req);
    if (auth.error) return sendJson(res, auth.error.status, auth.error.body);
    const { botToken, userId, profile } = auth;
    const capabilities = capabilitiesFor(profile);

    if (req.method === 'GET') {
      const view = cleanText(req.query?.adminUsers || req.query?.view || 'overview', 24);
      if (view === 'overview') {
        const data = await edgeStore(botToken, 'admin_overview');
        const metrics = { ...(data.metrics || {}) };
        if (!capabilities.viewFinance) {
          delete metrics.walletBalanceUnits;
          delete metrics.paidUnits30d;
          delete metrics.pendingPayments;
        }
        return sendJson(res, 200, { ok: true, capabilities, metrics });
      }

      if (view === 'list') {
        if (!capabilities.viewUsers) return sendJson(res, 403, { error: 'permission_denied' });
        const data = await edgeStore(botToken, 'list_users', {
          search: cleanText(req.query?.search, 80),
          filter: cleanText(req.query?.filter || 'all', 24),
          page: Math.max(1, Math.min(10_000, Number(req.query?.page) || 1)),
          limit: Math.max(10, Math.min(50, Number(req.query?.limit) || 20)),
          includeFinance: capabilities.viewFinance
        });
        return sendJson(res, 200, {
          ok: true,
          capabilities,
          users: data.users || [],
          pagination: data.pagination || { page: 1, limit: 20, total: 0, pages: 1 }
        });
      }

      if (view === 'detail') {
        if (!capabilities.viewUsers) return sendJson(res, 403, { error: 'permission_denied' });
        const telegramId = validTelegramId(req.query?.telegramId);
        if (!telegramId) return sendJson(res, 400, { error: 'invalid_telegram_id' });
        const data = await edgeStore(botToken, 'get_user_admin_view', {
          telegramId,
          includeFinance: capabilities.viewFinance
        });
        if (!data.user) return sendJson(res, 404, { error: 'user_not_found' });
        return sendJson(res, 200, { ok: true, capabilities, user: data.user });
      }

      if (view === 'audit') {
        if (!capabilities.viewAudit) return sendJson(res, 403, { error: 'permission_denied' });
        const data = await edgeStore(botToken, 'list_admin_audit', {
          limit: Math.max(20, Math.min(200, Number(req.query?.limit) || 100))
        });
        return sendJson(res, 200, { ok: true, capabilities, entries: data.entries || [] });
      }

      return sendJson(res, 400, { error: 'unknown_view' });
    }

    const action = cleanText(req.body?.action, 48);
    const telegramId = validTelegramId(req.body?.telegramId);
    if (!telegramId) return sendJson(res, 400, { error: 'invalid_telegram_id' });

    if (action === 'update_user_delivery') {
      if (!capabilities.manageUsers) return sendJson(res, 403, { error: 'permission_denied' });
      const result = await edgeStore(botToken, 'admin_update_user_delivery', {
        telegramId,
        enabled: req.body?.enabled === true,
        timezone: cleanText(req.body?.timezone || 'Europe/Berlin', 80)
      });
      await audit(botToken, userId, 'user_delivery_updated', {
        targetTelegramId: telegramId,
        enabled: req.body?.enabled === true,
        timezone: cleanText(req.body?.timezone || 'Europe/Berlin', 80)
      });
      return sendJson(res, 200, { ok: true, user: result.user || null });
    }

    if (action === 'set_user_vip') {
      if (!capabilities.manageUsers || !capabilities.manageFinance) {
        return sendJson(res, 403, { error: 'permission_denied' });
      }
      const active = req.body?.active === true;
      const expiresAt = cleanText(req.body?.expiresAt, 40);
      const planId = cleanText(req.body?.planId || 'vip-month', 64);
      const result = await edgeStore(botToken, 'admin_set_user_vip', {
        telegramId,
        active,
        expiresAt,
        planId,
        adminId: userId
      });
      await audit(botToken, userId, active ? 'user_vip_granted' : 'user_vip_cancelled', {
        targetTelegramId: telegramId,
        planId: active ? planId : null,
        expiresAt: active ? expiresAt : null
      });
      return sendJson(res, 200, { ok: true, vip: result.vip || null });
    }

    if (action === 'set_user_entitlement') {
      if (!capabilities.manageUsers) return sendJson(res, 403, { error: 'permission_denied' });
      const serviceId = cleanText(req.body?.serviceId, 100);
      const quantity = Number(req.body?.quantity);
      if (!/^[a-z0-9:_-]{1,100}$/.test(serviceId)) {
        return sendJson(res, 400, { error: 'invalid_service_id' });
      }
      if (!Number.isInteger(quantity) || quantity < 0 || quantity > 10_000) {
        return sendJson(res, 400, { error: 'invalid_quantity' });
      }
      await edgeStore(botToken, 'admin_set_user_entitlement', { telegramId, serviceId, quantity });
      await audit(botToken, userId, 'user_entitlement_updated', {
        targetTelegramId: telegramId,
        serviceId,
        quantity
      });
      return sendJson(res, 200, { ok: true });
    }

    if (action === 'reset_user_daily_usage') {
      if (!capabilities.manageUsers) return sendJson(res, 403, { error: 'permission_denied' });
      const serviceId = cleanText(req.body?.serviceId, 100);
      if (serviceId && !/^[a-z0-9:_-]{1,100}$/.test(serviceId)) {
        return sendJson(res, 400, { error: 'invalid_service_id' });
      }
      await edgeStore(botToken, 'admin_reset_user_daily_usage', { telegramId, serviceId });
      await audit(botToken, userId, 'user_daily_usage_reset', {
        targetTelegramId: telegramId,
        serviceId: serviceId || 'all'
      });
      return sendJson(res, 200, { ok: true });
    }

    return sendJson(res, 400, { error: 'unknown_action' });
  } catch (error) {
    console.error('Admin users API failed:', error);
    return sendJson(res, error.status === 404 ? 404 : 502, {
      error: error.message === 'user_not_found' ? 'user_not_found' : 'admin_users_backend_failed'
    });
  }
}
