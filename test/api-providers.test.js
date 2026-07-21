import assert from 'node:assert/strict';
import test from 'node:test';

import botHandler from '../api/bot.js';
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

test('reading proxy prefers OpenAI and keeps its key on the server', async () => {
    const restore = preserveEnvironment(['BOT_TOKEN', 'OPENAI_API_KEY', 'OPENAI_MODEL', 'OPENROUTER_API_KEY', 'ALLOW_UNAUTHENTICATED_PREVIEW']);
    const previousFetch = global.fetch;
    let providerRequest;
    process.env.BOT_TOKEN = 'telegram-test-token';
    process.env.OPENAI_API_KEY = 'openai-test-key';
    process.env.OPENAI_MODEL = 'gpt-5-mini';
    process.env.OPENROUTER_API_KEY = 'openrouter-fallback-key';
    process.env.ALLOW_UNAUTHENTICATED_PREVIEW = 'true';
    global.fetch = async (url, options) => {
        providerRequest = { url, headers: options.headers, body: JSON.parse(options.body) };
        return { ok: true, status: 200, json: async () => ({ output_text: '  Символический ответ.  ' }) };
    };

    try {
        const response = createResponse();
        await proxyHandler({ method: 'POST', headers: {}, body: { feature: 'natal', payload: { date: '2026-07-21', time: '12:00' } } }, response);
        assert.equal(response.statusCode, 200);
        assert.deepEqual(response.body, { answer: 'Символический ответ.' });
        assert.equal(providerRequest.url, 'https://api.openai.com/v1/responses');
        assert.equal(providerRequest.headers.Authorization, 'Bearer openai-test-key');
        assert.equal(providerRequest.body.model, 'gpt-5-mini');
        assert.equal(providerRequest.body.store, false);
        assert.doesNotMatch(JSON.stringify(response.body), /openai-test-key/);
    } finally {
        restore();
        global.fetch = previousFetch;
    }
});

test('photo readings become OpenAI image inputs', async () => {
    const restore = preserveEnvironment(['BOT_TOKEN', 'OPENAI_API_KEY', 'OPENROUTER_API_KEY', 'ALLOW_UNAUTHENTICATED_PREVIEW']);
    const previousFetch = global.fetch;
    let requestBody;
    process.env.BOT_TOKEN = 'telegram-test-token';
    process.env.OPENAI_API_KEY = 'openai-test-key';
    delete process.env.OPENROUTER_API_KEY;
    process.env.ALLOW_UNAUTHENTICATED_PREVIEW = 'true';
    global.fetch = async (_url, options) => {
        requestBody = JSON.parse(options.body);
        return { ok: true, status: 200, json: async () => ({ output_text: 'Безопасный ответ.' }) };
    };

    try {
        const response = createResponse();
        await proxyHandler({ method: 'POST', headers: {}, body: { feature: 'photo_energy', payload: { concern: 'Мне тревожно.', image: 'data:image/webp;base64,AA==' } } }, response);
        assert.equal(response.statusCode, 200);
        const image = requestBody.input[1].content.find((part) => part.type === 'input_image');
        assert.equal(image.image_url, 'data:image/webp;base64,AA==');
        assert.equal(image.detail, 'low');
        assert.equal(requestBody.max_output_tokens, 900);
    } finally {
        restore();
        global.fetch = previousFetch;
    }
});

test('reading proxy falls back to OpenRouter after an OpenAI failure', async () => {
    const restore = preserveEnvironment(['BOT_TOKEN', 'OPENAI_API_KEY', 'OPENROUTER_API_KEY', 'ALLOW_UNAUTHENTICATED_PREVIEW']);
    const previousFetch = global.fetch;
    const calls = [];
    process.env.BOT_TOKEN = 'telegram-test-token';
    process.env.OPENAI_API_KEY = 'openai-test-key';
    process.env.OPENROUTER_API_KEY = 'openrouter-test-key';
    process.env.ALLOW_UNAUTHENTICATED_PREVIEW = 'true';
    global.fetch = async (url) => {
        calls.push(url);
        if (url.includes('api.openai.com')) {
            return { ok: false, status: 429, json: async () => ({ error: { message: 'rate limited' } }) };
        }
        return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: 'Резервный ответ.' } }] }) };
    };

    try {
        const response = createResponse();
        await proxyHandler({ method: 'POST', headers: {}, body: { feature: 'natal', payload: { date: '2026-07-21', time: '12:00' } } }, response);
        assert.equal(response.statusCode, 200);
        assert.deepEqual(response.body, { answer: 'Резервный ответ.' });
        assert.deepEqual(calls, ['https://api.openai.com/v1/responses', 'https://openrouter.ai/api/v1/chat/completions']);
    } finally {
        restore();
        global.fetch = previousFetch;
    }
});

test('built-in support agent uses the system OpenAI key', async () => {
    const restore = preserveEnvironment(['OPENAI_API_KEY', 'OPENAI_MODEL', 'OPENROUTER_API_KEY']);
    const previousFetch = global.fetch;
    const calls = [];
    process.env.OPENAI_API_KEY = 'openai-test-key';
    process.env.OPENAI_MODEL = 'gpt-5-mini';
    delete process.env.OPENROUTER_API_KEY;
    global.fetch = async (url, options) => {
        calls.push({ url, body: JSON.parse(options.body) });
        if (url.includes('supabase.co')) {
            return { ok: true, status: 200, json: async () => ({ ok: true, agents: [] }) };
        }
        return { ok: true, status: 200, json: async () => ({ output_text: 'Откройте раздел «Расклады».' }) };
    };

    try {
        const result = await runAgent({ botToken: 'telegram-test-token', slug: 'support-guide', message: 'Как начать расклад?' });
        assert.equal(result.answer, 'Откройте раздел «Расклады».');
        assert.equal(result.model, 'gpt-5-mini');
        assert.equal(calls[1].url, 'https://api.openai.com/v1/responses');
    } finally {
        restore();
        global.fetch = previousFetch;
    }
});

test('bot health reports both providers without exposing secrets', async () => {
    const restore = preserveEnvironment(['BOT_TOKEN', 'TELEGRAM_WEBHOOK_SECRET', 'OPENAI_API_KEY', 'OPENAI_MODEL', 'OPENROUTER_API_KEY']);
    process.env.BOT_TOKEN = 'telegram-test-token';
    process.env.TELEGRAM_WEBHOOK_SECRET = 'webhook-test-secret';
    process.env.OPENAI_API_KEY = 'openai-test-key';
    process.env.OPENAI_MODEL = 'gpt-5-mini';
    process.env.OPENROUTER_API_KEY = 'openrouter-test-key';
    try {
        const response = createResponse();
        await botHandler({ method: 'GET', headers: {}, query: {} }, response);
        assert.equal(response.statusCode, 200);
        assert.equal(response.body.services.readings, true);
        assert.equal(response.body.services.openAi, true);
        assert.equal(response.body.services.openRouterFallback, true);
        assert.doesNotMatch(JSON.stringify(response.body), /test-key|test-secret/);
    } finally {
        restore();
    }
});
