import { getRequestHeader, validateTelegramInitData } from '../lib/telegram.js';

const ADMIN_STORE_URL = process.env.ADMIN_STORE_URL
  || 'https://hngfpdsnjgdpazmortix.supabase.co/functions/v1/nastardamus-admin-store';

function sendJson(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(status).json(body);
}

function parseAdminIds(value) {
  return new Set(
    String(value || '').split(/[\s,;]+/).map(Number).filter(Number.isSafeInteger)
  );
}

function hasPermission(profile, permission) {
  if (!profile?.is_active) return false;
  if (profile.role === 'owner') return true;
  return profile.permissions?.['*'] === true || profile.permissions?.[permission] === true;
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
    signal: AbortSignal.timeout(15_000)
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
      is_active: true
    };
  } else {
    profile = (await edgeStore(botToken, 'get_admin_profile', { telegramId: userId })).profile;
  }

  if (!profile?.is_active) {
    return { error: { status: 403, body: { error: 'admin_access_denied', userId } } };
  }
  return { botToken, userId, profile };
}

async function audit(botToken, userId, action, payload = {}) {
  await edgeStore(botToken, 'write_audit', {
    telegramId: userId,
    auditAction: action,
    payload
  }).catch(() => {});
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
    const canView = hasPermission(profile, 'ai.view') || hasPermission(profile, 'ai.manage');
    const canManage = hasPermission(profile, 'ai.manage');
    if (!canView) return sendJson(res, 403, { error: 'permission_denied' });

    if (req.method === 'GET') {
      const [providersData, agentsData, moderationData] = await Promise.all([
        edgeStore(botToken, 'list_ai_providers'),
        edgeStore(botToken, 'list_ai_agents'),
        edgeStore(botToken, 'read_ai_moderation')
      ]);

      return sendJson(res, 200, {
        ok: true,
        canManage,
        providers: providersData.providers || [],
        agents: agentsData.agents || [],
        moderation: moderationData.moderation || null
      });
    }

    if (!canManage) return sendJson(res, 403, { error: 'permission_denied' });

    const action = String(req.body?.action || '');

    if (action === 'upsert_provider') {
      const provider = req.body?.provider || {};
      const result = await edgeStore(botToken, 'upsert_ai_provider', {
        provider: { ...provider, updatedBy: userId }
      });
      await audit(botToken, userId, provider.id ? 'ai_provider_updated' : 'ai_provider_created', {
        providerId: result.provider?.id || provider.id || null,
        name: provider.name || null,
        providerType: provider.providerType || null,
        apiKeyChanged: Boolean(provider.apiKey)
      });
      return sendJson(res, 200, { ok: true, provider: result.provider });
    }

    if (action === 'delete_provider') {
      await edgeStore(botToken, 'delete_ai_provider', { id: req.body?.id });
      await audit(botToken, userId, 'ai_provider_deleted', { providerId: req.body?.id || null });
      return sendJson(res, 200, { ok: true });
    }

    if (action === 'upsert_agent') {
      const agent = req.body?.agent || {};
      const result = await edgeStore(botToken, 'upsert_ai_agent', {
        agent: { ...agent, updatedBy: userId }
      });
      await audit(botToken, userId, agent.id ? 'ai_agent_updated' : 'ai_agent_created', {
        agentId: result.agent?.id || agent.id || null,
        slug: agent.slug || null,
        purpose: agent.purpose || null
      });
      return sendJson(res, 200, { ok: true, agent: result.agent });
    }

    if (action === 'delete_agent') {
      await edgeStore(botToken, 'delete_ai_agent', { id: req.body?.id });
      await audit(botToken, userId, 'ai_agent_deleted', { agentId: req.body?.id || null });
      return sendJson(res, 200, { ok: true });
    }

    if (action === 'save_moderation') {
      await edgeStore(botToken, 'write_ai_moderation', {
        moderation: { ...(req.body?.moderation || {}), updatedBy: userId }
      });
      await audit(botToken, userId, 'ai_moderation_updated', req.body?.moderation || {});
      return sendJson(res, 200, { ok: true });
    }

    return sendJson(res, 400, { error: 'unknown_action' });
  } catch (error) {
    console.error('Admin AI API failed:', error);
    return sendJson(res, 502, { error: 'admin_ai_backend_failed' });
  }
}
