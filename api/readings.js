import { getRequestHeader, validateTelegramInitData } from '../lib/telegram.js';

const USER_STORE_URL = process.env.USER_STORE_URL
  || 'https://hngfpdsnjgdpazmortix.supabase.co/functions/v1/nastardamus-user-store';
const ACTIONS = new Set([
  'get_reading_catalog',
  'create_tarot_session',
  'draw_tarot_card',
  'save_reading',
  'list_readings',
  'get_reading',
  'update_reading',
  'delete_reading',
  'create_dialogue_session',
  'append_dialogue_message',
  'get_active_dialogue'
]);

export const config = {
  api: { bodyParser: { sizeLimit: '8mb' } }
};

function sendJson(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.status(status).json(body);
}

async function userStore(botToken, action, payload) {
  const response = await fetch(USER_STORE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-App-Bot-Token': botToken },
    body: JSON.stringify({ action, ...payload }),
    signal: AbortSignal.timeout(25_000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) {
    const error = new Error(data.error || `reading_store_${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'method_not_allowed' });
  }
  const botToken = process.env.BOT_TOKEN;
  if (!botToken) return sendJson(res, 503, { error: 'reading_store_unavailable' });
  const auth = validateTelegramInitData(getRequestHeader(req, 'x-telegram-init-data') || '', botToken);
  if (!auth.ok) return sendJson(res, 401, { error: 'telegram_auth_required' });
  const action = String(req.body?.action || '');
  if (!ACTIONS.has(action)) return sendJson(res, 400, { error: 'unsupported_reading_action' });
  try {
    const data = await userStore(botToken, action, {
      ...req.body,
      action: undefined,
      telegramId: Number(auth.user.id)
    });
    return sendJson(res, 200, data);
  } catch (error) {
    console.error('Readings API failed:', error?.message || error);
    return sendJson(res, Number(error?.status) || 503, {
      error: error?.message || 'reading_store_unavailable'
    });
  }
}
