import { buildReadingMessages, isVisionFeature } from '../lib/readings.js';
import { getRequestHeader, validateTelegramInitData } from '../lib/telegram.js';

const DEFAULT_MODEL = 'deepseek/deepseek-v4-flash:free';
const DEFAULT_VISION_MODEL = 'openrouter/free';

function sendJson(res, status, body) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.status(status).json(body);
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return sendJson(res, 405, { error: 'method_not_allowed' });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    const botToken = process.env.BOT_TOKEN;
    if (!apiKey || !botToken) {
        console.error('OPENROUTER_API_KEY or BOT_TOKEN is not configured');
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
    const model = vision
        ? process.env.OPENROUTER_VISION_MODEL || DEFAULT_VISION_MODEL
        : process.env.OPENROUTER_MODEL || DEFAULT_MODEL;

    try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
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
            console.error('OpenRouter request failed:', response.status, data?.error?.message || 'unknown');
            return sendJson(res, 502, {
                error: vision ? 'vision_provider_failed' : 'reading_provider_failed'
            });
        }

        const answer = data?.choices?.[0]?.message?.content;
        if (typeof answer !== 'string' || answer.trim().length === 0) {
            return sendJson(res, 502, { error: 'empty_provider_response' });
        }

        return sendJson(res, 200, { answer: answer.trim() });
    } catch (error) {
        console.error('OpenRouter proxy failed:', error);
        return sendJson(res, 502, {
            error: vision ? 'vision_provider_unavailable' : 'reading_provider_unavailable'
        });
    }
}