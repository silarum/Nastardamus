import { buildReadingMessages } from '../lib/readings.js';
import { requestDeepSeekChat } from '../lib/deepseek.js';

const USER_STORE_URL = process.env.USER_STORE_URL
  || 'https://hngfpdsnjgdpazmortix.supabase.co/functions/v1/nastardamus-user-store';
const SIGN_LABELS = {
  aries: 'Овен', taurus: 'Телец', gemini: 'Близнецы', cancer: 'Рак',
  leo: 'Лев', virgo: 'Дева', libra: 'Весы', scorpio: 'Скорпион',
  sagittarius: 'Стрелец', capricorn: 'Козерог', aquarius: 'Водолей', pisces: 'Рыбы'
};

export const config = { maxDuration: 60 };

function sendJson(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(status).json(body);
}

async function userStore(botToken, action, payload = {}) {
  const response = await fetch(USER_STORE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-App-Bot-Token': botToken },
    body: JSON.stringify({ action, ...payload }),
    signal: AbortSignal.timeout(12_000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) throw new Error(data.error || `user_store_${response.status}`);
  return data;
}

export async function createHoroscope(sign, date) {
  const messages = buildReadingMessages('daily_horoscope', {
    sign: SIGN_LABELS[sign] || sign,
    date,
    name: 'Искатель'
  });
  const result = await requestDeepSeekChat({
    messages,
    temperature: 0.72,
    maxTokens: 520
  });
  return result.answer;
}

async function sendTelegram(botToken, payload) {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15_000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) throw new Error(`telegram_${response.status}`);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, { error: 'method_not_allowed' });
  }
  const authorization = String(req.headers.authorization || '');
  const cronToken = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!cronToken) {
    return sendJson(res, 401, { error: 'cron_authorization_required' });
  }
  const botToken = process.env.BOT_TOKEN;
  const webAppUrl = process.env.WEB_APP_URL || 'https://nastardamus.vercel.app';
  if (!botToken) return sendJson(res, 503, { error: 'bot_not_configured' });
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date());
  try {
    await userStore(botToken, 'authorize_cron', { cronToken });
    const { recipients = [] } = await userStore(botToken, 'list_horoscope_recipients', { today: date, limit: 200 });
    const signs = [...new Set(recipients.map((person) => person.zodiac_sign))];
    const readings = new Map(await Promise.all(signs.map(async (sign) => [sign, await createHoroscope(sign, date)])));
    let sent = 0;
    for (const person of recipients) {
      try {
        const greeting = person.first_name ? `${person.first_name}, ваш знак на сегодня:` : 'Ваш знак на сегодня:';
        await sendTelegram(botToken, {
          chat_id: person.chat_id,
          text: `✦ ${greeting}\n\n${readings.get(person.zodiac_sign)}`,
          reply_markup: { inline_keyboard: [[{ text: 'Открыть гороскоп', web_app: { url: `${webAppUrl}?screen=horoscope` } }]] }
        });
        await userStore(botToken, 'mark_horoscope_sent', { telegramId: Number(person.telegram_id), sentOn: date });
        sent += 1;
      } catch (error) {
        console.error('Daily horoscope delivery failed:', person.telegram_id, error);
      }
    }
    return sendJson(res, 200, { ok: true, recipients: recipients.length, sent, date });
  } catch (error) {
    console.error('Daily horoscope cron failed:', error);
    return sendJson(res, 503, { error: 'daily_horoscope_failed' });
  }
}
