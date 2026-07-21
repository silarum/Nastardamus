import assert from 'node:assert/strict';
import test from 'node:test';

import botHandler from '../api/bot.js';
import proxyHandler from '../api/proxy.js';

function createResponse() {
    return {
        headers: new Map(),
        statusCode: 200,
        body: null,
        setHeader(name, value) {
            this.headers.set(name.toLowerCase(), value);
        },
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            this.body = body;
            return this;
        }
    };
}

test('bot health route is available', async () => {
    const response = createResponse();
    await botHandler({ method: 'GET', headers: {} }, response);

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.status, 'ok');
    assert.deepEqual(Object.keys(response.body.services), [
        'bot',
        'webhookSecret',
        'readings',
        'openAi',
        'openAiModel',
        'openRouterFallback',
        'openRouterModel',
        'webAppUrl',
        'authenticatedPreviewOnly'
    ]);
    assert.ok(Object.values(response.body.services).every((value) => typeof value === 'boolean'));
});

test('bot can configure its fixed production webhook without exposing secrets', async () => {
    const previousToken = process.env.BOT_TOKEN;
    const previousSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    const previousUrl = process.env.WEB_APP_URL;
    const previousFetch = global.fetch;
    let telegramRequest;
    process.env.BOT_TOKEN = 'test-token';
    process.env.TELEGRAM_WEBHOOK_SECRET = 'test-secret';
    process.env.WEB_APP_URL = 'https://nastardamus.vercel.app';
    global.fetch = async (url, options) => {
        telegramRequest = { url, body: JSON.parse(options.body) };
        return { ok: true, status: 200, json: async () => ({ ok: true, result: true }) };
    };

    try {
        const response = createResponse();
        await botHandler({ method: 'GET', headers: {}, query: { configure: 'webhook' } }, response);
        assert.equal(response.statusCode, 200);
        assert.equal(response.body.webhook, 'configured');
        assert.match(telegramRequest.url, /setWebhook$/);
        assert.equal(telegramRequest.body.url, 'https://nastardamus.vercel.app/api/bot');
        assert.equal(telegramRequest.body.secret_token, 'test-secret');
    } finally {
        if (previousToken === undefined) delete process.env.BOT_TOKEN; else process.env.BOT_TOKEN = previousToken;
        if (previousSecret === undefined) delete process.env.TELEGRAM_WEBHOOK_SECRET; else process.env.TELEGRAM_WEBHOOK_SECRET = previousSecret;
        if (previousUrl === undefined) delete process.env.WEB_APP_URL; else process.env.WEB_APP_URL = previousUrl;
        global.fetch = previousFetch;
    }
});

test('bot rejects unsupported HTTP methods', async () => {
    const response = createResponse();
    await botHandler({ method: 'DELETE', headers: {} }, response);

    assert.equal(response.statusCode, 405);
    assert.equal(response.headers.get('allow'), 'GET, POST');
});

test('reading proxy only accepts POST', async () => {
    const response = createResponse();
    await proxyHandler({ method: 'GET', headers: {} }, response);

    assert.equal(response.statusCode, 405);
    assert.deepEqual(response.body, { error: 'method_not_allowed' });
});

test('reading proxy prefers OpenAI and keeps the API key server-side', async () => {
    const previous = {
        token: process.env.BOT_TOKEN,
        openAiKey: process.env.OPENAI_API_KEY,
        openAiModel: process.env.OPENAI_MODEL,
        openRouterKey: process.env.OPENROUTER_API_KEY,
        preview: process.env.ALLOW_UNAUTHENTICATED_PREVIEW,
        fetch: global.fetch
    };
    let providerRequest;
    process.env.BOT_TOKEN = 'telegram-test-token';
    process.env.OPENAI_API_KEY = 'openai-test-key';
    process.env.OPENAI_MODEL = 'gpt-5-mini';
    process.env.OPENROUTER_API_KEY = 'openrouter-fallback-key';
    process.env.ALLOW_UNAUTHENTICATED_PREVIEW = 'true';
    global.fetch = async (url, options) => {
        providerRequest = { url, headers: options.headers, body: JSON.parse(options.body) };
        return {
            ok: true,
            status: 200,
            json: async () => ({
                output: [{ content: [{ type: 'output_text', text: '  Символический ответ.  ' }] }]
            })
        };
    };

    try {
        const response = createResponse();
        await proxyHandler({
            method: 'POST',
            headers: {},
            body: {
                feature: 'natal',
                payload: { date: '2026-07-19', time: '12:00' }
            }
        }, response);

        assert.equal(response.statusCode, 200);
        assert.deepEqual(response.body, { answer: 'Символический ответ.' });
        assert.equal(providerRequest.url, 'https://api.openai.com/v1/responses');
        assert.equal(providerRequest.headers.Authorization, 'Bearer openai-test-key');
        assert.equal(providerRequest.body.model, 'gpt-5-mini');
        assert.equal(providerRequest.body.store, false);
        assert.equal(providerRequest.body.input[0].content[0].type, 'input_text');
        assert.doesNotMatch(JSON.stringify(response.body), /openai-test-key/);
    } finally {
        for (const [name, value] of [
            ['BOT_TOKEN', previous.token],
            ['OPENAI_API_KEY', previous.openAiKey],
            ['OPENAI_MODEL', previous.openAiModel],
            ['OPENROUTER_API_KEY', previous.openRouterKey],
            ['ALLOW_UNAUTHENTICATED_PREVIEW', previous.preview]
        ]) {
            if (value === undefined) delete process.env[name]; else process.env[name] = value;
        }
        global.fetch = previous.fetch;
    }
});

test('photo readings are converted to OpenAI image inputs', async () => {
    const previous = {
        token: process.env.BOT_TOKEN,
        openAiKey: process.env.OPENAI_API_KEY,
        preview: process.env.ALLOW_UNAUTHENTICATED_PREVIEW,
        fetch: global.fetch
    };
    let requestBody;
    process.env.BOT_TOKEN = 'telegram-test-token';
    process.env.OPENAI_API_KEY = 'openai-test-key';
    process.env.ALLOW_UNAUTHENTICATED_PREVIEW = 'true';
    global.fetch = async (_url, options) => {
        requestBody = JSON.parse(options.body);
        return {
            ok: true,
            status: 200,
            json: async () => ({ output_text: 'Безопасный символический ответ.' })
        };
    };

    try {
        const response = createResponse();
        await proxyHandler({
            method: 'POST',
            headers: {},
            body: {
                feature: 'energy-check',
                payload: {
                    concern: 'Мне тревожно из-за последних событий.',
                    photo: 'data:image/webp;base64,AA=='
                }
            }
        }, response);

        assert.equal(response.statusCode, 200);
        const image = requestBody.input[1].content.find((part) => part.type === 'input_image');
        assert.equal(image.image_url, 'data:image/webp;base64,AA==');
        assert.equal(image.detail, 'low');
        assert.equal(requestBody.max_output_tokens, 750);
    } finally {
        for (const [name, value] of [
            ['BOT_TOKEN', previous.token],
            ['OPENAI_API_KEY', previous.openAiKey],
            ['ALLOW_UNAUTHENTICATED_PREVIEW', previous.preview]
        ]) {
            if (value === undefined) delete process.env[name]; else process.env[name] = value;
        }
        global.fetch = previous.fetch;
    }
});
