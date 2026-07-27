import { getRequestHeader, validateTelegramInitData } from '../lib/telegram.js';

const ADMIN_STORE_URL = process.env.ADMIN_STORE_URL
  || 'https://hngfpdsnjgdpazmortix.supabase.co/functions/v1/nastardamus-admin-store';

const ROLES = new Set(['owner', 'admin', 'manager', 'support', 'moderator', 'analyst']);
const PERMISSIONS = new Set([
  'admins.manage',
  'settings.manage',
  'finance.view',
  'finance.manage',
  'services.manage',
  'users.view',
  'users.manage',
  'content.manage',
  'palmlink.moderate',
  'support.view',
  'support.reply',
  'support.manage',
  'audit.view',
  'ai.view',
  'ai.manage'
]);

const ROLE_DEFAULTS = Object.freeze({
  owner: { '*': true },
  admin: {
    'settings.manage': true,
    'finance.view': true,
    'services.manage': true,
    'users.view': true,
    'users.manage': true,
    'content.manage': true,
    'palmlink.moderate': true,
    'support.view': true,
    'support.reply': true,
    'support.manage': true,
    'audit.view': true,
    'ai.view': true,
    'ai.manage': true
  },
  manager: {
    'services.manage': true,
    'users.view': true,
    'finance.view': true,
    'content.manage': true,
    'palmlink.moderate': true,
    'support.view': true,
    'support.reply': true,
    'ai.view': true
  },
  support: {
    'users.view': true,
    'support.view': true,
    'support.reply': true,
    'ai.view': true
  },
  moderator: {
    'users.view': true,
    'content.manage': true,
    'palmlink.moderate': true,
    'support.view': true,
    'ai.view': true
  },
  analyst: {
    'users.view': true,
    'finance.view': true,
    'audit.view': true,
    'ai.view': true
  }
});

function sendJson(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(status).json(body);
}

function parseAdminIds(value) {
  return new Set(
    String(value || '').split(/[\s,;]+/).map(Number).filter(Number.isSafeInteger)
  );
}

function cleanText(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength);
}

function sanitizePermissions(value, role) {
  if (role === 'owner') return { '*': true };
  const source = value && typeof value === 'object' ? value : ROLE_DEFAULTS[role] || {};
  const result = {};
  for (const [key, enabled] of Object.entries(source)) {
    if (PERMISSIONS.has(key) && enabled === true) result[key] = true;
  }
  return result;
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
    body: JSON.stringify({ action, ...payload }),
    signal: AbortSignal.timeout(12_000)
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
  if (!validation.ok) return { error: { status: 401, body: { error: 'telegram_auth_required' } } };

  const userId = Number(validation.user.id);
  let profile;

  if (parseAdminIds(process.env.ADMIN_TELEGRAM_IDS).has(userId)) {
    profile = {
      telegram_id: userId,
      role: 'owner',
      permissions: { '*': true },
      is_active: true,
      display_name: validation.user.first_name || null,
      username: validation.user.username || null
    };
  } else {
    profile = (await edgeStore(botToken, 'get_admin_profile', { telegramId: userId })).profile;
  }

  if (!profile?.is_active) {
    return { error: { status: 403, body: { error: 'admin_access_denied', userId } } };
  }

  await edgeStore(botToken, 'touch_admin', { telegramId: userId }).catch(() => {});
  return { botToken, userId, user: validation.user, profile };
}

function sanitizeSupport(input = {}) {
  const days = Array.isArray(input.workingHours?.days)
    ? input.workingHours.days.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    : [1, 2, 3, 4, 5];
  const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

  return {
    enabled: input.enabled !== false,
    supportUsername: cleanText(input.supportUsername, 64).replace(/^@/, ''),
    supportChatId: Number.isSafeInteger(Number(input.supportChatId)) ? Number(input.supportChatId) : null,
    welcomeMessage: cleanText(input.welcomeMessage, 1000),
    offlineMessage: cleanText(input.offlineMessage, 1000),
    responseSlaMinutes: Math.min(10080, Math.max(5, Number(input.responseSlaMinutes) || 240)),
    allowAttachments: input.allowAttachments !== false,
    autoAssign: input.autoAssign !== false,
    workingHours: {
      timezone: cleanText(input.workingHours?.timezone || 'Europe/Berlin', 80),
      days: [...new Set(days)],
      from: timePattern.test(String(input.workingHours?.from || ''))
        ? input.workingHours.from
        : '09:00',
      to: timePattern.test(String(input.workingHours?.to || ''))
        ? input.workingHours.to
        : '18:00'
    }
  };
}

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST');
    return sendJson(res, 405, { error: 'method_not_allowed' });
  }

  try {
    const auth = await authenticate(req);
    if (auth.error) return sendJson(res, auth.error.status, auth.error.body);

    const { botToken, userId, profile } = auth;
    const capabilities = {
      manageAdmins: hasPermission(profile, 'admins.manage'),
      viewSupport: hasPermission(profile, 'support.view') || hasPermission(profile, 'support.manage'),
      manageSupport: hasPermission(profile, 'support.manage'),
      manageSettings: hasPermission(profile, 'settings.manage'),
      viewAi: hasPermission(profile, 'ai.view') || hasPermission(profile, 'ai.manage'),
      manageAi: hasPermission(profile, 'ai.manage')
    };

    if (req.method === 'GET') {
      const [adminsData, supportData] = await Promise.all([
        capabilities.manageAdmins
          ? edgeStore(botToken, 'list_admins')
          : Promise.resolve({ admins: [] }),
        capabilities.viewSupport
          ? edgeStore(botToken, 'read_support')
          : Promise.resolve({ support: null })
      ]);

      return sendJson(res, 200, {
        ok: true,
        profile,
        capabilities,
        roleDefaults: ROLE_DEFAULTS,
        admins: adminsData.admins || [],
        support: supportData.support || null
      });
    }

    const action = String(req.body?.action || '');

    if (action === 'upsert_admin') {
      if (!capabilities.manageAdmins) return sendJson(res, 403, { error: 'permission_denied' });

      const input = req.body?.admin || {};
      const telegramId = Number(input.telegramId);
      const role = ROLES.has(String(input.role)) ? String(input.role) : 'support';
      if (!Number.isSafeInteger(telegramId)) return sendJson(res, 400, { error: 'invalid_telegram_id' });
      if (role === 'owner' && profile.role !== 'owner') {
        return sendJson(res, 403, { error: 'owner_role_requires_owner' });
      }

      const existing = (await edgeStore(botToken, 'list_admins')).admins
        .find((admin) => Number(admin.telegram_id) === telegramId);
      if (existing?.role === 'owner' && profile.role !== 'owner') {
        return sendJson(res, 403, { error: 'cannot_edit_owner' });
      }

      const permissions = sanitizePermissions(input.permissions, role);
      if (
        profile.role !== 'owner'
        && Object.keys(permissions).some((permission) => !hasPermission(profile, permission))
      ) {
        return sendJson(res, 403, { error: 'cannot_delegate_permission' });
      }

      const admin = {
        telegramId,
        role,
        displayName: cleanText(input.displayName, 80),
        username: cleanText(input.username, 64).replace(/^@/, ''),
        permissions,
        isActive: input.isActive !== false,
        createdBy: existing?.created_by || userId
      };

      await edgeStore(botToken, 'upsert_admin', { admin });
      await edgeStore(botToken, 'write_audit', {
        telegramId: userId,
        auditAction: existing ? 'admin_updated' : 'admin_created',
        payload: { targetTelegramId: telegramId, role, permissions: admin.permissions }
      });
      return sendJson(res, 200, { ok: true });
    }

    if (action === 'delete_admin') {
      if (!capabilities.manageAdmins) return sendJson(res, 403, { error: 'permission_denied' });
      const telegramId = Number(req.body?.telegramId);
      if (!Number.isSafeInteger(telegramId)) return sendJson(res, 400, { error: 'invalid_telegram_id' });
      if (telegramId === userId) return sendJson(res, 400, { error: 'cannot_delete_self' });

      const admins = (await edgeStore(botToken, 'list_admins')).admins || [];
      const target = admins.find((admin) => Number(admin.telegram_id) === telegramId);
      if (!target) return sendJson(res, 404, { error: 'admin_not_found' });
      if (target.role === 'owner') return sendJson(res, 403, { error: 'cannot_delete_owner' });

      await edgeStore(botToken, 'delete_admin', { telegramId });
      await edgeStore(botToken, 'write_audit', {
        telegramId: userId,
        auditAction: 'admin_deleted',
        payload: { targetTelegramId: telegramId }
      });
      return sendJson(res, 200, { ok: true });
    }

    if (action === 'save_support') {
      if (!capabilities.manageSupport) return sendJson(res, 403, { error: 'permission_denied' });
      const support = sanitizeSupport(req.body?.support);
      await edgeStore(botToken, 'write_support', { support: { ...support, updatedBy: userId } });
      await edgeStore(botToken, 'write_audit', {
        telegramId: userId,
        auditAction: 'support_settings_updated',
        payload: support
      });
      return sendJson(res, 200, { ok: true, support });
    }

    return sendJson(res, 400, { error: 'unknown_action' });
  } catch (error) {
    console.error('Admin team API failed:', error);
    return sendJson(res, 502, { error: 'admin_team_backend_failed' });
  }
}
