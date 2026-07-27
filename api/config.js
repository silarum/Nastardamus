import { getRequestHeader, validateTelegramInitData } from '../lib/telegram.js';
import { unauthenticatedPreviewAllowed } from '../lib/request-security.js';

const USER_STORE_URL = process.env.USER_STORE_URL
  || 'https://hngfpdsnjgdpazmortix.supabase.co/functions/v1/nastardamus-user-store';

function sendJson(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.status(status).json(body);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, { error: 'method_not_allowed' });
  }

  const botToken = process.env.BOT_TOKEN;
  if (!botToken) return sendJson(res, 503, { error: 'config_not_available' });

  const initData = getRequestHeader(req, 'x-telegram-init-data') || '';
  const auth = validateTelegramInitData(initData, botToken);
  if (!auth.ok && !unauthenticatedPreviewAllowed()) {
    return sendJson(res, 401, { error: 'telegram_auth_required' });
  }

  try {
    const response = await fetch(USER_STORE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Bot-Token': botToken
      },
      body: JSON.stringify({
        action: 'get_public_config',
        telegramId: auth.ok ? Number(auth.user.id) : 1
      }),
      signal: AbortSignal.timeout(10_000)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || `config_store_${response.status}`);
    return sendJson(res, 200, {
      ok: true,
      settings: data.settings || {},
      moderation: data.moderation || null
    });
  } catch (error) {
    console.error('Public config failed:', error);
    return sendJson(res, 503, { error: 'config_not_available' });
  }
}
