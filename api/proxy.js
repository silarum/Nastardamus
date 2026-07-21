import { buildReadingMessages } from '../lib/readings.js';
import { getRequestHeader, validateTelegramInitData } from '../lib/telegram.js';

const DEFAULT_OPENAI_MODEL = 'gpt-5-mini';
const DEFAULT_OPENROUTER_MODEL = 'deepseek/deepseek-v4-flash:free';
const DEFAULT_OPENROUTER_VISION_MODEL = 'openrouter/free';
const PHOTO_FEATURES = new Set(['photo-compatibility', 'energy-check']);

export const config = {
    api: { bodyParser: { sizeLimit: '3mb' } }
};

function sendJson(res, status, body) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.status(status).json(body);
}

function toOpenAIInput(messages) {
    return messages.map((message) => ({
        role: message.role,
        content: (typeof message.content === 'string'
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
            }))
    }));
}

function extractOpenAIText(data) {
    if (typeof data?.output_text === 'string') return data.output_text;
    if (!Array.isArray(data?.output)) return '';

    return data.output
        .flatMap((item) => Array.isArray(item?.content) ? item.content : [])
        .filter((part) => part?.type === 'output_text' && typeof part.text === 'string')
        .map((part) => part.text)
        .join('\n');
}

async function requestOpenAI(messages, isPhotoFeature) {
    const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
            model: process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL,
            input: toOpenAIInput(messages),
            max_output_tokens: isPhotoFeature ? 750 : 650,
            store: false
        }),
        signal: AbortSignal.timeout(25_000)
    });
    const data = await response.json().catch(() => null);

    if (!response.ok) {
        console.error('OpenAI request failed:', response.status, data?.error?.message || 'unknown');
        throw new Error('provider_request_failed');
    }

    return extractOpenAIText(data);
}

async function requestOpenRouter(messages, isPhotoFeature) {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            'HTTP-Referer': process.env.WEB_APP_URL || 'https://nastardamus.vercel.app',
            'X-Title': 'Nastardamus'
        },
        body: JSON.stringify({
            model: isPhotoFeature
                ? process.env.OPENROUTER_VISION_MODEL || DEFAULT_OPENROUTER_VISION_MODEL
                : process.env.OPENROUTER_MODEL || DEFAULT_OPENROUTER_MODEL,
            messages,
            temperature: 0.8,
            max_tokens: isPhotoFeature ? 750 : 650
        }),
        signal: AbortSignal.timeout(25_000)
    });
    const data = await response.json().catch(() => null);

    if (!response.ok) {
        console.error('OpenRouter request failed:', response.status, data?.error?.message || 'unknown');
        throw new Error('provider_request_failed');
    }

    return data?.choices?.[0]?.message?.content || '';
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return sendJson(res, 405, { error: 'method_not_allowed' });
    }

    const hasReadingProvider = Boolean(process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY);
    const botToken = process.env.BOT_TOKEN;
    if (!hasReadingProvider || !botToken) {
        console.error('OPENAI_API_KEY/OPENROUTER_API_KEY or BOT_TOKEN is not configured');
        return sendJson(res, 503, { error: 'service_not_configured' });
    }

    const initData = getRequestHeader(req, 'x-telegram-init-data') || '';
    const auth = validateTelegramInitData(initData, botToken);
    const previewAllowed = process.env.ALLOW_UNAUTHENTICATED_PREVIEW === 'true';
    if (!auth.ok && !previewAllowed) {
        return sendJson(res, 401, { error: 'telegram_auth_required' });
    }

    const feature = req.body?.feature;
    let messages;
    try {
        messages = buildReadingMessages(feature, req.body?.payload);
    } catch (error) {
        return sendJson(res, 400, { error: error.message });
    }

    try {
        const isPhotoFeature = PHOTO_FEATURES.has(feature);
        const answer = process.env.OPENAI_API_KEY
            ? await requestOpenAI(messages, isPhotoFeature)
            : await requestOpenRouter(messages, isPhotoFeature);
        if (typeof answer !== 'string' || answer.trim().length === 0) {
            return sendJson(res, 502, { error: 'empty_provider_response' });
        }

        return sendJson(res, 200, { answer: answer.trim() });
    } catch (error) {
        console.error('Reading proxy failed:', error);
        return sendJson(res, 502, { error: 'reading_provider_unavailable' });
    }
}
