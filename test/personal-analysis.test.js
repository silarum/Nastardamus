import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';

import personalAnalysisHandler from '../api/proxy.js';
import {
  buildPersonalAnalysisMessages,
  parsePersonalAnalysis
} from '../lib/personal-analysis.js';

function createResponse() {
  return {
    headers: new Map(),
    statusCode: 200,
    body: null,
    setHeader(name, value) { this.headers.set(name.toLowerCase(), value); },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

function signedInitData(botToken, userId = 884422) {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: 'personal-analysis-query',
    user: JSON.stringify({ id: userId, first_name: 'Анна' })
  });
  const check = [...params.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  params.set('hash', createHmac('sha256', secret).update(check).digest('hex'));
  return params.toString();
}

const event = {
  eventId: 'd90190c6-5ef8-4777-87d7-41561b9c70d4',
  title: 'Важный разговор',
  date: '2026-08-12',
  time: '18:30',
  description: 'Хочу спокойно согласовать следующий шаг.',
  category: 'love',
  priority: 'high',
  status: 'active',
  reminder: true,
  goalId: '',
  analysis: null,
  enrichments: {}
};

const analysis = {
  energy: 'День поддерживает ясный и спокойный разговор.',
  opportunities: 'Можно превратить ожидания в конкретную договорённость.',
  risks: 'Не пытайтесь получить все ответы за одну встречу.',
  recommendation: 'До разговора запишите одну просьбу и одну границу.',
  question: 'Какой ответ вы готовы услышать без попытки его изменить?'
};

test('personal analysis prompt uses bounded history and requires exact JSON', () => {
  const messages = buildPersonalAnalysisMessages({
    event,
    name: 'Анна',
    history: {
      events: [{ eventId: 'other', title: 'Прошлая встреча', date: '2026-08-01', status: 'completed', analysis: { recommendation: 'Назвать ожидание.' } }],
      goals: [{ title: 'Беречь диалог', status: 'active', category: 'love' }],
      checkins: [{ date: '2026-08-02', eveningReflection: { text: 'Помогла пауза перед ответом.' } }]
    }
  });

  assert.match(messages[0].content, /только валидный JSON-объект/iu);
  assert.match(messages[1].content, /Прошлая встреча/u);
  assert.match(messages[1].content, /Беречь диалог/u);
  assert.match(messages[1].content, /Помогла пауза/u);
  assert.deepEqual(parsePersonalAnalysis(JSON.stringify(analysis)), analysis);
  assert.throws(() => parsePersonalAnalysis('{"energy":"только одно поле"}'), /invalid_personal_analysis/);
});

test('personal analysis endpoint authenticates, reads history and returns saved-card fields', async () => {
  const previousFetch = global.fetch;
  const previous = {
    BOT_TOKEN: process.env.BOT_TOKEN,
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY
  };
  const botToken = 'telegram-personal-analysis-test-token';
  const actions = [];
  let providerBody;
  process.env.BOT_TOKEN = botToken;
  process.env.DEEPSEEK_API_KEY = 'deepseek-personal-test-key';
  global.fetch = async (url, options) => {
    const body = JSON.parse(options.body);
    if (url.includes('nastardamus-user-store')) {
      actions.push(body.action);
      if (body.action === 'take_rate_limit') {
        return { ok: true, status: 200, json: async () => ({ ok: true, allowed: true, limit: 12, remaining: 11, retry_after_seconds: 3600 }) };
      }
      if (body.action === 'get_personal_space') {
        return { ok: true, status: 200, json: async () => ({ ok: true, events: [], goals: [], checkins: [] }) };
      }
      throw new Error(`unexpected action ${body.action}`);
    }
    assert.equal(url, 'https://api.deepseek.com/chat/completions');
    providerBody = body;
    return {
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: JSON.stringify(analysis) } }] })
    };
  };

  try {
    const response = createResponse();
    await personalAnalysisHandler({
      method: 'POST',
      headers: { 'x-telegram-init-data': signedInitData(botToken) },
      body: { action: 'personal_analysis', event }
    }, response);
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body, { ok: true, analysis });
    assert.deepEqual(actions, ['take_rate_limit', 'get_personal_space']);
    assert.deepEqual(providerBody.response_format, { type: 'json_object' });
    assert.equal(providerBody.max_tokens, 1100);
  } finally {
    global.fetch = previousFetch;
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
