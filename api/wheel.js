import { getRequestHeader, validateTelegramInitData } from '../lib/telegram.js';
import { assertChannelMembership, checkChannelMembership } from '../lib/channel-access.js';

const USER_STORE_URL = process.env.USER_STORE_URL
  || 'https://hngfpdsnjgdpazmortix.supabase.co/functions/v1/nastardamus-user-store';

function sendJson(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.status(status).json(body);
}

async function userStore(botToken, action, payload = {}) {
  const response = await fetch(USER_STORE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-App-Bot-Token': botToken },
    body: JSON.stringify({ ...payload, action }),
    signal: AbortSignal.timeout(12_000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) throw new Error(data.error || 'wheel_unavailable');
  return data;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'method_not_allowed' });
  }
  const botToken = process.env.BOT_TOKEN;
  if (!botToken) return sendJson(res, 503, { error: 'wheel_unavailable' });
  const auth = validateTelegramInitData(getRequestHeader(req, 'x-telegram-init-data') || '', botToken);
  if (!auth.ok) return sendJson(res, 401, { error: 'telegram_auth_required' });
  const idempotencyKey = String(req.body?.idempotencyKey || '').trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/.test(idempotencyKey)) {
    return sendJson(res, 400, { error: 'invalid_idempotency_key' });
  }
  try {
    const telegramId = Number(auth.user.id);
    const config = await userStore(botToken, 'get_public_config', { telegramId });
    const subscription = await checkChannelMembership(botToken, telegramId, config.settings || {});
    assertChannelMembership(subscription);
    const data = await userStore(botToken, 'claim_wheel_reward', { telegramId, idempotencyKey });
    await userStore(botToken, 'record_service_event', {
      telegramId,
      serviceId: String(data.reward?.serviceId || 'wheel'),
      eventType: 'wheel',
      accessSource: 'wheel'
    }).catch(() => null);
    return sendJson(res, 200, { ok: true, reward: data.reward, replayed: data.replayed === true });
  } catch (error) {
    console.error('Wheel claim failed:', error);
    const code = error?.message || 'wheel_unavailable';
    return sendJson(res, error?.status || (code === 'channel_subscription_required' ? 403 : 503), { error: code });
  }
}
