import { buildReadingMessages } from '../lib/readings.js';
import { requestDeepSeekChat } from '../lib/deepseek.js';
import { checkChannelMembership } from '../lib/channel-access.js';

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
    body: JSON.stringify({ ...payload, action }),
    signal: AbortSignal.timeout(12_000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) throw new Error(data.error || `user_store_${response.status}`);
  return data;
}

function normalizeGender(value) {
  return ['female', 'male', 'unspecified'].includes(value) ? value : 'unspecified';
}

export async function createHoroscope(sign, date, gender = 'unspecified', age = 18, city = '') {
  const normalizedGender = normalizeGender(gender);
  const messages = buildReadingMessages('daily_horoscope', {
    sign: SIGN_LABELS[sign] || sign,
    date,
    name: normalizedGender === 'female' ? 'Искательница' : normalizedGender === 'male' ? 'Искатель' : 'Ищущий человек',
    gender: normalizedGender,
    age,
    city
  });
  const result = await requestDeepSeekChat({
    messages,
    temperature: 0.86,
    maxTokens: 700
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
    const publicConfig = await userStore(botToken, 'get_public_config', { telegramId: Number(recipients[0]?.telegram_id || 1) });
    const eligibleRecipients = [];
    for (let index = 0; index < recipients.length; index += 20) {
      const batch = recipients.slice(index, index + 20);
      const checks = await Promise.all(batch.map(async (person) => ({
        person,
        subscription: await checkChannelMembership(botToken, Number(person.telegram_id), publicConfig.settings || {})
      })));
      eligibleRecipients.push(...checks.filter(({ subscription }) => !subscription.configured || subscription.member).map(({ person }) => person));
    }
    const currentYear = Number(date.slice(0, 4));
    const groupKey = (person) => [
      person.zodiac_sign,
      normalizeGender(person.gender),
      Math.max(13, Math.min(120, currentYear - Number(person.birth_year || currentYear - 18))),
      String(person.city || '').trim().toLocaleLowerCase('ru-RU')
    ].join(':');
    const horoscopeGroups = [...new Set(eligibleRecipients.map(groupKey))];
    const readings = new Map(await Promise.all(horoscopeGroups.map(async (group) => {
      const [sign, gender, age, ...cityParts] = group.split(':');
      return [group, await createHoroscope(sign, date, gender, Number(age), cityParts.join(':'))];
    })));
    let sent = 0;
    for (const person of eligibleRecipients) {
      try {
        const greeting = person.first_name ? `${person.first_name}, ваш знак на сегодня:` : 'Ваш знак на сегодня:';
        await sendTelegram(botToken, {
          chat_id: person.chat_id,
          text: `✦ ${greeting}\n\n${readings.get(groupKey(person))}`,
          reply_markup: { inline_keyboard: [[{ text: 'Открыть гороскоп', web_app: { url: `${webAppUrl}?screen=horoscope` } }]] }
        });
        await userStore(botToken, 'mark_horoscope_sent', { telegramId: Number(person.telegram_id), sentOn: date });
        sent += 1;
      } catch (error) {
        console.error('Daily horoscope delivery failed:', person.telegram_id, error);
      }
    }
    return sendJson(res, 200, { ok: true, recipients: recipients.length, eligible: eligibleRecipients.length, sent, date });
  } catch (error) {
    console.error('Daily horoscope cron failed:', error);
    return sendJson(res, 503, { error: 'daily_horoscope_failed' });
  }
}
