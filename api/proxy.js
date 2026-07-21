import { buildReadingMessages, isVisionFeature } from '../lib/readings.js';
import { getRequestHeader, validateTelegramInitData } from '../lib/telegram.js';

const DEFAULT_OPENAI_MODEL = 'gpt-5-mini';
const DEFAULT_OPENROUTER_MODEL = 'deepseek/deepseek-v4-flash:free';
const DEFAULT_OPENROUTER_VISION_MODEL = 'openrouter/free';

export const config = {
    api: { bodyParser: { sizeLimit: '4mb' } }
};

function sendJson(res, status, body) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.status(status).json(body);
}

function toOpenAIInput(messages) {
    return messages.map((message) => ({
        role: message.role,
        content: typeof message.content === 'string'
            ? [{ type: 'input_text', text: message.content }]
            : message.content.map((part) => {
                if (part.type === 'text') {
                    return { type: 'input_text', text: part.text };
                }
                if (part.type === 'image_url') {
                    return {
                        type: 'input_image',
                        image_url: part.image_url.url,
                        detail: 'low'
                    };
                }
                throw new TypeError('unsupported message content');
            })
    }));
}

function extractOpenAIText(data) {
    if (typeof data?.output_text === 'string' && data.output_text.trim()) {
        return data.output_text.trim();
    }
    return (data?.output || [])
        .flatMap((item) => Array.isArray(item?.content) ? item.content : [])
        .filter((part) => typeof part?.text === 'string')
        .map((part) => part.text)
        .join('\n')
        .trim();
}

async function requestOpenAI(messages, vision) {
    const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
            model: process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL,
            input: toOpenAIInput(messages),
            max_output_tokens: vision ? 900 : 850,
            store: false
        }),
        signal: AbortSignal.timeout(vision ? 45_000 : 30_000)
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
        throw new Error(data?.error?.message || `openai_${response.status}`);
    }
    const answer = extractOpenAIText(data);
    if (!answer) throw new Error('empty_openai_response');
    return answer;
}

async function requestOpenRouter(messages, vision) {
    const model = vision
        ? process.env.OPENROUTER_VISION_MODEL || DEFAULT_OPENROUTER_VISION_MODEL
        : process.env.OPENROUTER_MODEL || DEFAULT_OPENROUTER_MODEL;
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            'HTTP-Referer': process.env.WEB_APP_URL || 'https://nastardamus.vercel.app',
            'X-Title': 'Nastardamus'
        },
        body: JSON.stringify({
            model,
            messages,
            temperature: vision ? 0.55 : 0.76,
            max_tokens: vision ? 900 : 850
        }),
        signal: AbortSignal.timeout(vision ? 45_000 : 30_000)
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
        throw new Error(data?.error?.message || `openrouter_${response.status}`);
    }
    const answer = data?.choices?.[0]?.message?.content;
    if (typeof answer !== 'string' || !answer.trim()) {
        throw new Error('empty_openrouter_response');
    }
    return answer.trim();
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return sendJson(res, 405, { error: 'method_not_allowed' });
    }

    const botToken = process.env.BOT_TOKEN;
    const providers = [
        process.env.OPENAI_API_KEY ? { name: 'openai', request: requestOpenAI } : null,
        process.env.OPENROUTER_API_KEY ? { name: 'openrouter', request: requestOpenRouter } : null
    ].filter(Boolean);
    if (!botToken || providers.length === 0) {
        console.error('OPENAI_API_KEY/OPENROUTER_API_KEY or BOT_TOKEN is not configured');
        return sendJson(res, 503, { error: 'service_not_configured' });
    }

    const initData = getRequestHeader(req, 'x-telegram-init-data') || '';
    const auth = validateTelegramInitData(initData, botToken);
    const previewAllowed = process.env.ALLOW_UNAUTHENTICATED_PREVIEW === 'true';
    if (!auth.ok && !previewAllowed) {
        return sendJson(res, 401, { error: 'telegram_auth_required' });
    }

    const feature = String(req.body?.feature || '');
    let messages;
    try {
        messages = buildReadingMessages(feature, req.body?.payload);
    } catch (error) {
        return sendJson(res, 400, { error: error.message });
    }

    const vision = isVisionFeature(feature);
    const failures = [];
    for (const provider of providers) {
        try {
            const answer = await provider.request(messages, vision);
            return sendJson(res, 200, { answer });
        } catch (error) {
            failures.push(provider.name);
            console.error(`${provider.name} reading request failed:`, error?.message || error);
        }
    }

    console.error('All reading providers failed:', failures.join(', '));
    return sendJson(res, 502, {
        error: vision ? 'vision_provider_unavailable' : 'reading_provider_unavailable'
    });
}
