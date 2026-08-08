import { getRequestHeader } from '../lib/telegram.js';
import { hasAdminPanelAccess, readAdminProfile } from '../lib/admin-access.js';

const ADMIN_STORE_URL = process.env.ADMIN_STORE_URL
  || 'https://hngfpdsnjgdpazmortix.supabase.co/functions/v1/nastardamus-admin-store';

function sendJson(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(status).json(body);
}

async function callTelegram(token, method, payload) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10_000)
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.ok) {
    throw new Error(`telegram_${method}_${response.status}`);
  }
  return data.result;
}

async function claimTelegramUpdate(botToken, updateId) {
  const response = await fetch(ADMIN_STORE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Bot-Token': botToken
    },
    body: JSON.stringify({
      action: 'claim_telegram_update',
      botScope: 'admin',
      updateId
    }),
    signal: AbortSignal.timeout(10_000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) throw new Error(data.error || `update_store_${response.status}`);
  return data.claimed === true;
}

async function releaseTelegramUpdate(botToken, updateId) {
  const response = await fetch(ADMIN_STORE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Bot-Token': botToken
    },
    body: JSON.stringify({
      action: 'release_telegram_update',
      botScope: 'admin',
      updateId
    }),
    signal: AbortSignal.timeout(10_000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) throw new Error(data.error || `update_store_${response.status}`);
}

function adminPanelUrl() {
  const base = process.env.WEB_APP_URL || 'https://nastardamus.vercel.app';
  return new URL('/admin/', base).toString();
}

function ezoteriumReply(message) {
  const base = process.env.WEB_APP_URL || 'https://nastardamus.vercel.app';
  return {
    method: 'sendMessage',
    payload: {
      chat_id: message.chat.id,
      text: 'Добро пожаловать в Эзотериум. Откройте обычное пространство приложения кнопкой ниже.',
      reply_markup: {
        inline_keyboard: [[{
          text: '🔮 Войти в Эзотериум',
          web_app: { url: base }
        }]]
      }
    }
  };
}

export function adminReply(update, { authorized = false } = {}) {
  const message = update?.message;
  if (!message?.chat?.id || !message?.from?.id) return null;

  const text = String(message.text || '').trim();
  const requestsControl = /^\/admin(?:@[A-Za-z0-9_]+)?(?:\s|$)/i.test(text)
    || /^\/start(?:@[A-Za-z0-9_]+)?\s+admin(?:\s|$)/i.test(text);
  if (!authorized || !requestsControl) return ezoteriumReply(message);

  console.info('Nastardamus admin bot user', {
    telegramId: Number(message.from.id),
    username: message.from.username || null,
    firstName: message.from.first_name || null
  });

  return {
    method: 'sendMessage',
    payload: {
      chat_id: message.chat.id,
      text: `Nastardamus Control\n\nВаш Telegram ID: ${message.from.id}\nОткройте защищённую панель управления кнопкой ниже.`,
      reply_markup: {
        inline_keyboard: [[{
          text: '⚙️ Открыть админ-панель',
          web_app: { url: adminPanelUrl() }
        }]]
      }
    }
  };
}

export default async function handler(req, res) {
  const botToken = process.env.ADMIN_BOT_TOKEN || process.env.BOT_TOKEN;
  const webhookSecret = process.env.ADMIN_WEBHOOK_SECRET || process.env.TELEGRAM_WEBHOOK_SECRET;

  if (req.method === 'GET') {
    if (!botToken) return sendJson(res, 503, { error: 'admin_bot_not_configured' });

    try {
      if (req.query?.configure === 'webhook') {
        if (!webhookSecret) return sendJson(res, 503, { error: 'webhook_secret_missing' });
        if (getRequestHeader(req, 'x-webhook-config-secret') !== webhookSecret) {
          return sendJson(res, 401, { error: 'webhook_configuration_denied' });
        }
        const base = process.env.WEB_APP_URL || 'https://nastardamus.vercel.app';
        const webhookUrl = new URL('/api/admin-bot', base).toString();
        await callTelegram(botToken, 'setWebhook', {
          url: webhookUrl,
          secret_token: webhookSecret,
          allowed_updates: ['message', 'callback_query'],
          drop_pending_updates: false
        });
        return sendJson(res, 200, { ok: true, webhook: webhookUrl });
      }

      const bot = await callTelegram(botToken, 'getMe', {});
      return sendJson(res, 200, {
        ok: true,
        bot: {
          id: bot.id,
          username: bot.username,
          firstName: bot.first_name
        }
      });
    } catch (error) {
      console.error('Admin bot GET failed:', error);
      return sendJson(res, 502, { error: 'telegram_request_failed' });
    }
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return sendJson(res, 405, { error: 'method_not_allowed' });
  }

  if (!botToken || !webhookSecret) {
    return sendJson(res, 503, { error: 'admin_bot_not_configured' });
  }

  const receivedSecret = getRequestHeader(req, 'x-telegram-bot-api-secret-token');
  if (receivedSecret !== webhookSecret) {
    return sendJson(res, 401, { error: 'invalid_webhook_secret' });
  }

  let claimedUpdateId = null;
  try {
    const updateId = Number(req.body?.update_id);
    if (Number.isSafeInteger(updateId)) {
      const claimed = await claimTelegramUpdate(botToken, updateId);
      if (!claimed) return sendJson(res, 200, { ok: true, duplicate: true });
      claimedUpdateId = updateId;
    }

    if (req.body?.callback_query?.id) {
      await callTelegram(botToken, 'answerCallbackQuery', {
        callback_query_id: req.body.callback_query.id
      });
    }

    const userId = Number(req.body?.message?.from?.id);
    const profile = Number.isSafeInteger(userId)
      ? await readAdminProfile({
          userId,
          botToken,
          telegramUser: req.body?.message?.from
        }).catch(() => null)
      : null;
    const reply = adminReply(req.body, {
      authorized: hasAdminPanelAccess(profile)
    });
    if (reply) await callTelegram(botToken, reply.method, reply.payload);
    return sendJson(res, 200, { ok: true });
  } catch (error) {
    console.error('Admin bot webhook failed:', error);
    if (claimedUpdateId !== null) {
      await releaseTelegramUpdate(botToken, claimedUpdateId).catch((releaseError) => {
        console.error('Admin Telegram update release failed:', releaseError?.message || releaseError);
      });
    }
    return sendJson(res, 502, { error: 'telegram_request_failed' });
  }
}
