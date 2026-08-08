import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';

import botHandler from '../api/bot.js';
import { createHoroscope } from '../api/daily-horoscope.js';
import proxyHandler from '../api/proxy.js';
import { runAgent } from '../lib/ai-runtime.js';

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

function preserveEnvironment(names) {
    const values = Object.fromEntries(names.map((name) => [name, process.env[name]]));
    return () => {
        for (const [name, value] of Object.entries(values)) {
            if (value === undefined) delete process.env[name];
            else process.env[name] = value;
        }
    };
}

function signedInitData(botToken, userId = 991001) {
    const params = new URLSearchParams({
        auth_date: String(Math.floor(Date.now() / 1000)),
        query_id: 'provider-test-query',
        user: JSON.stringify({ id: userId, first_name: 'Тест' })
    });
    const check = [...params.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');
    const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
    params.set('hash', createHmac('sha256', secret).update(check).digest('hex'));
    return params.toString();
}

test('text readings use DeepSeek and keep its key on the server', async () => {
    const restore = preserveEnvironment(['BOT_TOKEN', 'DEEPSEEK_API_KEY', 'DEEPSEEK_MODEL', 'OPENAI_API_KEY', 'ALLOW_UNAUTHENTICATED_PREVIEW']);
    const previousFetch = global.fetch;
    let providerRequest;
    process.env.BOT_TOKEN = 'telegram-test-token';
    process.env.DEEPSEEK_API_KEY = 'deepseek-test-key';
    process.env.DEEPSEEK_MODEL = 'deepseek-v4-flash';
    process.env.OPENAI_API_KEY = 'openai-vision-key';
    process.env.ALLOW_UNAUTHENTICATED_PREVIEW = 'true';
    global.fetch = async (url, options) => {
        providerRequest = { url, headers: options.headers, body: JSON.parse(options.body) };
        return {
            ok: true,
            status: 200,
            json: async () => ({
                model: 'deepseek-v4-flash',
                choices: [{ message: { content: '  Символический ответ.  ' } }]
            })
        };
    };

    try {
        const response = createResponse();
        await proxyHandler({ method: 'POST', headers: {}, body: { feature: 'natal', payload: { date: '2026-07-21', time: '12:00' } } }, response);
        assert.equal(response.statusCode, 200);
        assert.deepEqual(response.body, { answer: 'Символический ответ.' });
        assert.equal(providerRequest.url, 'https://api.deepseek.com/chat/completions');
        assert.equal(providerRequest.headers.Authorization, 'Bearer deepseek-test-key');
        assert.equal(providerRequest.body.model, 'deepseek-v4-flash');
        assert.equal(providerRequest.body.max_tokens, 1400);
        assert.doesNotMatch(JSON.stringify(response.body), /deepseek-test-key|openai-vision-key/);
    } finally {
        restore();
        global.fetch = previousFetch;
    }
});

test('photo readings use only OpenAI image inputs', async () => {
    const restore = preserveEnvironment(['BOT_TOKEN', 'DEEPSEEK_API_KEY', 'OPENAI_API_KEY', 'ALLOW_UNAUTHENTICATED_PREVIEW']);
    const previousFetch = global.fetch;
    let requestBody;
    const calls = [];
    process.env.BOT_TOKEN = 'telegram-test-token';
    process.env.DEEPSEEK_API_KEY = 'deepseek-text-key';
    process.env.OPENAI_API_KEY = 'openai-test-key';
    process.env.ALLOW_UNAUTHENTICATED_PREVIEW = 'true';
    global.fetch = async (url, options) => {
        calls.push(url);
        const body = JSON.parse(options.body);
        if (url === 'https://api.openai.com/v1/moderations') {
            return {
                ok: true,
                status: 200,
                json: async () => ({
                    results: [{ flagged: false, category_scores: { violence: 0.01 } }]
                })
            };
        }
        requestBody = body;
        return { ok: true, status: 200, json: async () => ({ output_text: 'Безопасный ответ.' }) };
    };

    try {
        const response = createResponse();
        await proxyHandler({
            method: 'POST',
            headers: {},
            body: {
                feature: 'photo_energy',
                payload: {
                    concern: 'Мне тревожно.',
                    image: 'data:image/webp;base64,AA==',
                    consentOwn: true
                }
            }
        }, response);
        assert.equal(response.statusCode, 200);
        assert.deepEqual(calls, [
            'https://api.openai.com/v1/moderations',
            'https://api.openai.com/v1/responses'
        ]);
        const image = requestBody.input[1].content.find((part) => part.type === 'input_image');
        assert.equal(image.image_url, 'data:image/webp;base64,AA==');
        assert.equal(image.detail, 'high');
        assert.equal(requestBody.max_output_tokens, 1800);
    } finally {
        restore();
        global.fetch = previousFetch;
    }
});

test('two-person compatibility remains on OpenAI', async () => {
    const restore = preserveEnvironment(['BOT_TOKEN', 'DEEPSEEK_API_KEY', 'OPENAI_API_KEY', 'ALLOW_UNAUTHENTICATED_PREVIEW']);
    const previousFetch = global.fetch;
    const calls = [];
    process.env.BOT_TOKEN = 'telegram-test-token';
    process.env.DEEPSEEK_API_KEY = 'deepseek-text-key';
    process.env.OPENAI_API_KEY = 'openai-test-key';
    process.env.ALLOW_UNAUTHENTICATED_PREVIEW = 'true';
    global.fetch = async (url, options) => {
        calls.push(url);
        const body = JSON.parse(options.body);
        assert.equal(body.model, 'gpt-5.6');
        assert.equal(body.text.format.type, 'json_schema');
        return {
            ok: true,
            status: 200,
            json: async () => ({
                output_text: JSON.stringify({
                    score: 78,
                    confidence: 'medium',
                    summary: 'Связь держится на честном диалоге.',
                    narrative: 'У пары есть ресурс для сближения.',
                    strengths: ['Умение слушать'],
                    frictions: ['Разный темп решений'],
                    actions: ['Назвать ожидания', 'Согласовать границы', 'Выбрать общий шаг'],
                    aspects: [
                        { key: 'closeness', label: 'Близость', score: 82, insight: 'Тепло поддерживается вниманием.' },
                        { key: 'dialogue', label: 'Диалог', score: 76, insight: 'Нужна конкретика.' },
                        { key: 'daily', label: 'Быт', score: 70, insight: 'Темп стоит согласовать.' },
                        { key: 'growth', label: 'Рост', score: 84, insight: 'Общие цели сближают.' }
                    ]
                })
            })
        };
    };

    try {
        const response = createResponse();
        await proxyHandler({
            method: 'POST',
            headers: {},
            body: {
                feature: 'compatibility',
                payload: {
                    first: { name: 'Анна', date: '1990-01-01' },
                    second: { name: 'Иван', date: '1991-02-02' }
                }
            }
        }, response);
        assert.equal(response.statusCode, 200);
        assert.equal(response.body.result.score, 78);
        assert.match(response.body.answer, /ресурс для сближения/i);
        assert.deepEqual(calls, ['https://api.openai.com/v1/responses']);
    } finally {
        restore();
        global.fetch = previousFetch;
    }
});

test('reading store forwards the selected action even when the client body contains action', async () => {
    const restore = preserveEnvironment(['BOT_TOKEN', 'ALLOW_UNAUTHENTICATED_PREVIEW']);
    const previousFetch = global.fetch;
    const botToken = 'telegram-store-action-test-token';
    let forwardedBody;
    process.env.BOT_TOKEN = botToken;
    delete process.env.ALLOW_UNAUTHENTICATED_PREVIEW;
    global.fetch = async (url, options) => {
        assert.match(url, /nastardamus-user-store/);
        forwardedBody = JSON.parse(options.body);
        return { ok: true, status: 200, json: async () => ({ ok: true, readings: [] }) };
    };

    try {
        const response = createResponse();
        await proxyHandler({
            method: 'POST',
            headers: { 'x-telegram-init-data': signedInitData(botToken) },
            body: { action: 'list_readings', limit: 20 }
        }, response);
        assert.equal(response.statusCode, 200);
        assert.equal(forwardedBody.action, 'list_readings');
        assert.equal(forwardedBody.telegramId, 991001);
        assert.equal(forwardedBody.limit, 20);
    } finally {
        restore();
        global.fetch = previousFetch;
    }
});

test('sports forecast uses DeepSeek JSON mode and returns the structured result', async () => {
    const restore = preserveEnvironment(['BOT_TOKEN', 'DEEPSEEK_API_KEY', 'OPENAI_API_KEY', 'ALLOW_UNAUTHENTICATED_PREVIEW']);
    const previousFetch = global.fetch;
    let providerRequest;
    process.env.BOT_TOKEN = 'telegram-sports-test-token';
    process.env.DEEPSEEK_API_KEY = 'deepseek-sports-test-key';
    process.env.OPENAI_API_KEY = 'openai-test-key';
    process.env.ALLOW_UNAUTHENTICATED_PREVIEW = 'true';
    const result = {
        prediction: 'Команда А удержит преимущество во втором тайме.',
        alternative: 'Ранний гол команды Б изменит темп встречи.',
        confidence: 'medium',
        keyFactor: 'Контроль центра поля',
        missingData: 'Нет подтверждённых составов',
        probabilities: [
            { outcome: 'Победа А', percent: 48 },
            { outcome: 'Ничья', percent: 29 },
            { outcome: 'Победа Б', percent: 23 }
        ],
        advice: 'Воспринимайте прогноз как сценарий, а не основание для ставки.'
    };
    global.fetch = async (url, options) => {
        providerRequest = { url, body: JSON.parse(options.body) };
        return {
            ok: true,
            status: 200,
            json: async () => ({ choices: [{ message: { content: JSON.stringify(result) } }] })
        };
    };

    try {
        const response = createResponse();
        await proxyHandler({
            method: 'POST',
            headers: {},
            body: {
                feature: 'sports_forecast',
                payload: { event: 'Команда А — команда Б', context: 'Финальный матч' }
            }
        }, response);
        assert.equal(response.statusCode, 200);
        assert.deepEqual(response.body.result, result);
        assert.match(response.body.answer, /Основной прогноз/u);
        assert.equal(providerRequest.url, 'https://api.deepseek.com/chat/completions');
        assert.deepEqual(providerRequest.body.response_format, { type: 'json_object' });
        assert.match(providerRequest.body.messages[0].content, /JSON Schema/u);
    } finally {
        restore();
        global.fetch = previousFetch;
    }
});

test('OpenAI quota failure falls back to DeepSeek for text without losing structured data', async () => {
    const restore = preserveEnvironment(['BOT_TOKEN', 'DEEPSEEK_API_KEY', 'OPENAI_API_KEY', 'ALLOW_UNAUTHENTICATED_PREVIEW']);
    const previousFetch = global.fetch;
    const calls = [];
    process.env.BOT_TOKEN = 'telegram-fallback-test-token';
    process.env.DEEPSEEK_API_KEY = 'deepseek-fallback-test-key';
    process.env.OPENAI_API_KEY = 'openai-empty-quota-key';
    process.env.ALLOW_UNAUTHENTICATED_PREVIEW = 'true';
    const result = {
        score: 74,
        confidence: 'medium',
        summary: 'Связь поддерживает честность.',
        narrative: 'У пары есть пространство для согласования темпа.',
        strengths: ['Внимание друг к другу', 'Общие ценности'],
        frictions: ['Разный темп решений', 'Невысказанные ожидания'],
        actions: ['Назвать ожидания', 'Согласовать границы', 'Выбрать общий шаг'],
        aspects: [
            { key: 'closeness', label: 'Близость', score: 78, insight: 'Тепло поддерживается вниманием.' },
            { key: 'dialogue', label: 'Диалог', score: 72, insight: 'Полезна конкретика.' },
            { key: 'daily', label: 'Быт', score: 69, insight: 'Темп стоит согласовать.' },
            { key: 'growth', label: 'Рост', score: 77, insight: 'Общие цели сближают.' }
        ]
    };
    global.fetch = async (url, options) => {
        calls.push(url);
        if (url === 'https://api.openai.com/v1/responses') {
            return {
                ok: false,
                status: 429,
                headers: { get: (name) => name === 'x-request-id' ? 'req_quota_test' : null },
                json: async () => ({ error: { message: 'quota exceeded', code: 'insufficient_quota' } })
            };
        }
        assert.equal(url, 'https://api.deepseek.com/chat/completions');
        assert.deepEqual(JSON.parse(options.body).response_format, { type: 'json_object' });
        return {
            ok: true,
            status: 200,
            json: async () => ({ choices: [{ message: { content: JSON.stringify(result) } }] })
        };
    };

    try {
        const response = createResponse();
        await proxyHandler({
            method: 'POST',
            headers: {},
            body: {
                feature: 'compatibility',
                payload: {
                    first: { name: 'Анна', date: '1990-01-01' },
                    second: { name: 'Иван', date: '1991-02-02' }
                }
            }
        }, response);
        assert.equal(response.statusCode, 200);
        assert.equal(response.body.result.score, 74);
        assert.deepEqual(calls, [
            'https://api.openai.com/v1/responses',
            'https://api.deepseek.com/chat/completions'
        ]);
    } finally {
        restore();
        global.fetch = previousFetch;
    }
});

test('built-in support agent uses the system DeepSeek key', async () => {
    const restore = preserveEnvironment(['DEEPSEEK_API_KEY', 'DEEPSEEK_MODEL', 'OPENAI_API_KEY']);
    const previousFetch = global.fetch;
    const calls = [];
    process.env.DEEPSEEK_API_KEY = 'deepseek-test-key';
    process.env.DEEPSEEK_MODEL = 'deepseek-v4-flash';
    process.env.OPENAI_API_KEY = 'openai-vision-key';
    global.fetch = async (url, options) => {
        calls.push({ url, body: JSON.parse(options.body) });
        if (url.includes('supabase.co')) {
            return { ok: true, status: 200, json: async () => ({ ok: true, agents: [] }) };
        }
        return {
            ok: true,
            status: 200,
            json: async () => ({
                model: 'deepseek-v4-flash',
                choices: [{ message: { content: 'Откройте раздел «Расклады».' } }]
            })
        };
    };

    try {
        const result = await runAgent({ botToken: 'telegram-test-token', slug: 'support-guide', message: 'Как начать расклад?' });
        assert.equal(result.answer, 'Откройте раздел «Расклады».');
        assert.equal(result.model, 'deepseek-v4-flash');
        assert.equal(calls[1].url, 'https://api.deepseek.com/chat/completions');
    } finally {
        restore();
        global.fetch = previousFetch;
    }
});

test('daily horoscope uses DeepSeek', async () => {
    const restore = preserveEnvironment(['DEEPSEEK_API_KEY', 'DEEPSEEK_MODEL', 'OPENAI_API_KEY']);
    const previousFetch = global.fetch;
    let request;
    process.env.DEEPSEEK_API_KEY = 'deepseek-test-key';
    process.env.DEEPSEEK_MODEL = 'deepseek-v4-flash';
    process.env.OPENAI_API_KEY = 'openai-vision-key';
    global.fetch = async (url, options) => {
        request = { url, body: JSON.parse(options.body) };
        return {
            ok: true,
            status: 200,
            json: async () => ({
                choices: [{ message: { content: 'Сегодня берегите внутренний ритм.' } }]
            })
        };
    };

    try {
        const answer = await createHoroscope('aries', '2026-07-27', 'female', 34, 'Казань');
        assert.equal(answer, 'Сегодня берегите внутренний ритм.');
        assert.equal(request.url, 'https://api.deepseek.com/chat/completions');
        assert.equal(request.body.max_tokens, 700);
        assert.match(request.body.messages[0].content, /короткий и ясный ориентир/i);
        assert.match(request.body.messages[0].content, /конкретный фокус/i);
        assert.match(request.body.messages[0].content, /женском роде/i);
        assert.match(request.body.messages[1].content, /Искательница/i);
        assert.match(request.body.messages[1].content, /34/);
        assert.match(request.body.messages[1].content, /Казань/);
        assert.match(request.body.messages[1].content, /80–130 слов/i);
    } finally {
        restore();
        global.fetch = previousFetch;
    }
});

test('bot health uses neutral public service labels without exposing secrets', async () => {
    const restore = preserveEnvironment(['BOT_TOKEN', 'TELEGRAM_WEBHOOK_SECRET', 'DEEPSEEK_API_KEY', 'DEEPSEEK_MODEL', 'OPENAI_API_KEY', 'OPENAI_MODEL', 'OPENROUTER_API_KEY']);
    process.env.BOT_TOKEN = 'telegram-test-token';
    process.env.TELEGRAM_WEBHOOK_SECRET = 'webhook-test-secret';
    process.env.DEEPSEEK_API_KEY = 'deepseek-test-key';
    process.env.DEEPSEEK_MODEL = 'deepseek-v4-flash';
    process.env.OPENAI_API_KEY = 'openai-test-key';
    process.env.OPENAI_MODEL = 'gpt-5-mini';
    process.env.OPENROUTER_API_KEY = 'openrouter-test-key';
    try {
        const response = createResponse();
        await botHandler({ method: 'GET', headers: {}, query: {} }, response);
        assert.equal(response.statusCode, 200);
        assert.equal(response.body.services.readings, true);
        assert.equal(response.body.services.supportGuide, true);
        assert.equal(response.body.services.textReadings, true);
        assert.equal(response.body.services.photoReadings, true);
        assert.equal(response.body.services.fallbackReady, true);
        assert.doesNotMatch(
          JSON.stringify(response.body),
          /test-key|test-secret|OpenAI|DeepSeek|нейросет|\bAI\b/i
        );
    } finally {
        restore();
    }
});
