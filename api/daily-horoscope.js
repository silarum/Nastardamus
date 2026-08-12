import { createHash, randomUUID } from 'node:crypto';
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

function dateNumber(date) {
  let value = String(date || '').replace(/\D/g, '').split('').reduce((sum, digit) => sum + Number(digit), 0);
  while (value > 9) value = String(value).split('').reduce((sum, digit) => sum + Number(digit), 0);
  return Math.max(1, value || 1);
}

function cleanList(value, limit) {
  return Array.isArray(value)
    ? value.map((item) => String(item || '').trim().slice(0, 60)).filter(Boolean).slice(0, limit)
    : [];
}

function profileForHoroscope(input, date, gender, age, city) {
  if (typeof input === 'string') {
    const normalizedGender = normalizeGender(gender);
    return {
      sign: input,
      name: normalizedGender === 'female' ? 'Искательница' : normalizedGender === 'male' ? 'Искатель' : 'Ищущий человек',
      gender: normalizedGender,
      age: Math.max(13, Math.min(120, Number(age) || 18)),
      city: String(city || '').trim().slice(0, 120),
      timezone: '',
      birthDate: '',
      birthTime: '',
      birthTimeKnown: false,
      interests: [],
      goals: [],
      natalChart: null,
      variationKey: ''
    };
  }
  const profile = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const birthYear = Number(profile.birth_year || String(profile.birth_date || '').slice(0, 4));
  const currentYear = Number(String(date).slice(0, 4));
  const calculatedAge = Number.isInteger(birthYear) && birthYear >= 1900 && birthYear <= currentYear
    ? currentYear - birthYear
    : 18;
  return {
    sign: String(profile.zodiac_sign || profile.sign || '').slice(0, 40),
    name: String(profile.profile_name || profile.first_name || profile.name || 'Искатель').trim().slice(0, 80),
    gender: normalizeGender(profile.gender),
    age: Math.max(13, Math.min(120, calculatedAge)),
    city: String(profile.city || '').trim().slice(0, 120),
    timezone: String(profile.timezone || '').trim().slice(0, 80),
    birthDate: String(profile.birth_date || '').slice(0, 10),
    birthTime: String(profile.birth_time || '').slice(0, 5),
    birthTimeKnown: profile.birth_time_known === true,
    interests: cleanList(profile.interests, 8),
    goals: cleanList(profile.goals, 6),
    natalChart: profile.natal_chart && typeof profile.natal_chart === 'object' ? profile.natal_chart : null,
    variationKey: String(profile.variationKey || '').slice(0, 40)
  };
}

export async function createHoroscope(profileOrSign, date, gender = 'unspecified', age = 18, city = '') {
  const profile = profileForHoroscope(profileOrSign, date, gender, age, city);
  if (!profile.sign) throw new TypeError('horoscope_sign_required');
  const messages = buildReadingMessages('daily_horoscope', {
    sign: SIGN_LABELS[profile.sign] || profile.sign,
    date,
    name: profile.name,
    gender: profile.gender,
    age: profile.age,
    city: profile.city,
    timezone: profile.timezone,
    birthDate: profile.birthDate,
    birthTime: profile.birthTime,
    birthTimeKnown: profile.birthTimeKnown,
    interests: profile.interests,
    goals: profile.goals,
    natalChart: profile.natalChart,
    variationKey: profile.variationKey,
    dayNumber: dateNumber(date)
  });
  const result = await requestDeepSeekChat({
    messages,
    temperature: 0.82,
    maxTokens: 900
  });
  return result.answer;
}

export function localMoment(person, now = new Date()) {
  const requestedTimezone = String(person?.timezone || 'Europe/Berlin').slice(0, 80);
  const partsFor = (timeZone) => Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23'
    }).formatToParts(now).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value])
  );
  let parts;
  let timezone = requestedTimezone;
  try {
    parts = partsFor(timezone);
  } catch {
    timezone = 'UTC';
    parts = partsFor(timezone);
  }
  return {
    timezone,
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour)
  };
}

export function dailyVariationKey(telegramId, date) {
  return createHash('sha256').update(`nastardamus:${date}:${telegramId}`).digest('hex').slice(0, 16);
}

async function mapLimit(items, limit, worker) {
  const results = [];
  let index = 0;
  async function run() {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await worker(items[current], current);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()));
  return results;
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
  const requestId = String(req.headers['x-vercel-id'] || randomUUID()).slice(0, 100);
  const now = new Date();
  try {
    await userStore(botToken, 'authorize_cron', { cronToken });
    const { recipients = [] } = await userStore(botToken, 'list_horoscope_recipients', { limit: 500 });
    const slot = Math.floor(now.getTime() / 600000);
    const dueCandidates = recipients.flatMap((person) => {
      const local = localMoment(person, now);
      const alreadySent = String(person.last_horoscope_sent_on || '') === local.date;
      return !alreadySent && local.hour >= 7 && local.hour <= 9 ? [{ person, local }] : [];
    });
    const publicConfig = dueCandidates.length > 0
      ? await userStore(botToken, 'get_public_config', {
        telegramId: Number(dueCandidates[0].person.telegram_id)
      })
      : { settings: {} };
    const eligibleDue = [];
    for (let index = 0; index < dueCandidates.length; index += 20) {
      const batch = dueCandidates.slice(index, index + 20);
      const checks = await Promise.all(batch.map(async (candidate) => ({
        candidate,
        subscription: await checkChannelMembership(
          botToken,
          Number(candidate.person.telegram_id),
          publicConfig.settings || {}
        )
      })));
      eligibleDue.push(...checks
        .filter(({ subscription }) => !subscription.configured || subscription.member)
        .map(({ candidate }) => candidate));
    }
    const due = eligibleDue.sort((left, right) => (
      dailyVariationKey(left.person.telegram_id, `${left.local.date}:${slot}`)
        .localeCompare(dailyVariationKey(right.person.telegram_id, `${right.local.date}:${slot}`))
    )).slice(0, 30);
    const outcomes = await mapLimit(due, 5, async ({ person, local }) => {
      try {
        const answer = await createHoroscope({
          ...person,
          timezone: local.timezone,
          variationKey: dailyVariationKey(person.telegram_id, local.date)
        }, local.date);
        await sendTelegram(botToken, {
          chat_id: person.chat_id,
          text: answer,
          reply_markup: { inline_keyboard: [[{ text: 'Открыть гороскоп', web_app: { url: `${webAppUrl}?screen=horoscope` } }]] }
        });
        await userStore(botToken, 'mark_horoscope_sent', {
          telegramId: Number(person.telegram_id),
          sentOn: local.date
        });
        return true;
      } catch (error) {
        console.error('Daily horoscope recipient failed', {
          requestId,
          stage: 'personal_delivery',
          code: String(error?.message || 'unknown_error').slice(0, 120)
        });
        return false;
      }
    });
    const sent = outcomes.filter(Boolean).length;
    return sendJson(res, 200, {
      ok: true,
      requestId,
      recipients: recipients.length,
      due: dueCandidates.length,
      eligible: eligibleDue.length,
      blocked: dueCandidates.length - eligibleDue.length,
      attempted: due.length,
      sent,
      failed: due.length - sent,
      checkedAt: now.toISOString()
    });
  } catch (error) {
    console.error('Daily horoscope cron failed', {
      requestId,
      stage: 'scheduler',
      code: String(error?.message || 'unknown_error').slice(0, 120)
    });
    return sendJson(res, 503, { error: 'daily_horoscope_failed', requestId });
  }
}
