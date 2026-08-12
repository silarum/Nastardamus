import { getRequestHeader, validateTelegramInitData } from '../lib/telegram.js';
import { checkChannelMembership } from '../lib/channel-access.js';

const USER_STORE_URL = process.env.USER_STORE_URL
  || 'https://hngfpdsnjgdpazmortix.supabase.co/functions/v1/nastardamus-user-store';

export const config = {
  api: { bodyParser: { sizeLimit: '3mb' } }
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
    body: JSON.stringify({ ...payload, action }),
    signal: AbortSignal.timeout(10_000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) {
    const error = new Error(data.error || `preferences_store_${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST');
    return sendJson(res, 405, { error: 'method_not_allowed' });
  }
  const botToken = process.env.BOT_TOKEN;
  if (!botToken) return sendJson(res, 503, { error: 'preferences_unavailable' });
  const auth = validateTelegramInitData(getRequestHeader(req, 'x-telegram-init-data') || '', botToken);
  if (!auth.ok) return sendJson(res, 401, { error: 'telegram_auth_required' });
  const telegramId = Number(auth.user.id);
  try {
    await userStore(botToken, 'register_user', {
      telegramId,
      chatId: telegramId,
      username: auth.user.username,
      firstName: auth.user.first_name,
      telegramAvatarUrl: auth.user.photo_url
    });
    if (req.method === 'POST') {
      const action = String(req.body?.action || 'save');
      if (action === 'upload_avatar') {
        await userStore(botToken, 'upload_profile_avatar', {
          telegramId,
          image: req.body?.image
        });
      } else if (action === 'remove_avatar') {
        await userStore(botToken, 'remove_profile_avatar', { telegramId });
      } else if (action === 'set_ton_wallet') {
        await userStore(botToken, 'set_ton_wallet', {
          telegramId,
          address: req.body?.address,
          chain: req.body?.chain,
          walletApp: req.body?.walletApp,
          disconnect: req.body?.disconnect === true
        });
      } else {
        await userStore(botToken, 'update_user_preferences', {
          telegramId,
          chatId: telegramId,
          profileName: req.body?.profileName,
          zodiacSign: req.body?.zodiacSign,
          enabled: req.body?.enabled === true,
          timezone: req.body?.timezone || 'Europe/Berlin',
          gender: req.body?.gender,
          birthYear: req.body?.birthYear,
          birthDate: req.body?.birthDate,
          birthTime: req.body?.birthTime,
          birthTimeKnown: req.body?.birthTimeKnown === true,
          city: req.body?.city,
          interests: req.body?.interests,
          goals: req.body?.goals,
          consents: req.body?.consents,
          natalChart: req.body?.natalChart
        });
      }
    }
    const [data, config, daily, tonWallet] = await Promise.all([
      userStore(botToken, 'get_user_preferences', { telegramId }),
      userStore(botToken, 'get_public_config', { telegramId }),
      userStore(botToken, 'get_daily_access', { telegramId }).catch(() => ({ dailyChoice: { used: false, serviceId: '' } })),
      userStore(botToken, 'get_ton_wallet', { telegramId }).catch(() => ({ wallet: null }))
    ]);
    const subscription = await checkChannelMembership(botToken, telegramId, config.settings || {});
    return sendJson(res, 200, {
      ok: true,
      preferences: data.preferences || null,
      access: { subscription, dailyChoice: daily.dailyChoice },
      tonWallet: tonWallet.wallet
    });
  } catch (error) {
    console.error('Preferences API failed:', error);
    return sendJson(res, error.status || 503, { error: error.message || 'preferences_unavailable' });
  }
}
