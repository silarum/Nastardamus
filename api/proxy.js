import { buildReadingMessages, isVisionFeature } from '../lib/readings.js';
import { getRequestHeader, validateTelegramInitData } from '../lib/telegram.js';
import {
    enforceRateLimit,
    setRateLimitHeaders,
    unauthenticatedPreviewAllowed
} from '../lib/request-security.js';

const DEFAULT_OPENAI_MODEL = 'gpt-5-mini';
const DEFAULT_OPENROUTER_MODEL = 'deepseek/deepseek-v4-flash:free';
const DEFAULT_OPENROUTER_VISION_MODEL = 'openrouter/free';
const USER_STORE_URL = process.env.USER_STORE_URL
    || 'https://hngfpdsnjgdpazmortix.supabase.co/functions/v1/nastardamus-user-store';
const DEFAULT_PUBLIC_POLICY = Object.freeze({
    settings: {
        palmLinkEnabled: false,
        jointReadingsEnabled: true,
        manualPhotoReview: true,
        adultOnly: true
    },
    moderation: {
        enabled: true,
        rules: { consent_required: true },
        thresholds: { block: 0.85, manual_review: 0.55 },
        actions: { high_risk: 'block', medium_risk: 'review' }
    }
});

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

async function userStore(botToken, action, payload = {}) {
    const response = await fetch(USER_STORE_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-App-Bot-Token': botToken
        },
        body: JSON.stringify({ action, ...payload }),
        signal: AbortSignal.timeout(10_000)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || `user_store_${response.status}`);
    return data;
}

function imageInputs(feature, payload) {
    if (feature === 'photo_energy' || feature === 'photo_damage') return [payload?.image];
    if (feature === 'photo_compatibility') return [payload?.firstImage, payload?.secondImage];
    return [];
}

function validateVisionConsent(feature, payload, policy) {
    if (!isVisionFeature(feature)) return;
    if (payload?.consentOwn !== true) throw new Error('photo_consent_required');
    if (feature === 'photo_compatibility' && payload?.consentPartner !== true) {
        throw new Error('partner_consent_required');
    }
    if (
        feature === 'photo_compatibility'
        && policy.settings?.adultOnly !== false
        && payload?.adultConfirmed !== true
    ) {
        throw new Error('adult_confirmation_required');
    }
    if (feature === 'photo_compatibility' && policy.settings?.jointReadingsEnabled === false) {
        throw new Error('joint_readings_disabled');
    }
    if (payload?.source === 'palmlink' && policy.settings?.palmLinkEnabled !== true) {
        throw new Error('palmlink_disabled');
    }
}

async function moderateVisionInput(feature, payload, policy) {
    if (!isVisionFeature(feature) || policy.moderation?.enabled === false) return;
    if (!process.env.OPENAI_API_KEY) throw new Error('photo_moderation_unavailable');

    const input = [
        {
            type: 'text',
            text: 'Проверьте изображения пользователя до символического фото-чтения.'
        },
        ...imageInputs(feature, payload).map((image) => ({
            type: 'image_url',
            image_url: { url: image }
        }))
    ];
    const response = await fetch('https://api.openai.com/v1/moderations', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({ model: 'omni-moderation-latest', input }),
        signal: AbortSignal.timeout(30_000)
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error('photo_moderation_unavailable');

    const result = data?.results?.[0];
    if (!result) throw new Error('photo_moderation_unavailable');
    const scores = Object.values(result.category_scores || {})
        .map(Number)
        .filter(Number.isFinite);
    const highestScore = scores.length ? Math.max(...scores) : 0;
    const blockThreshold = Number(policy.moderation?.thresholds?.block ?? 0.85);
    const reviewThreshold = Number(policy.moderation?.thresholds?.manual_review ?? 0.55);
    if (result.flagged === true || highestScore >= blockThreshold) {
        throw new Error('photo_blocked');
    }
    if (
        policy.settings?.manualPhotoReview !== false
        && highestScore >= reviewThreshold
    ) {
        throw new Error('photo_requires_review');
    }
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
    const previewAllowed = unauthenticatedPreviewAllowed();
    if (!auth.ok && !previewAllowed) {
        return sendJson(res, 401, { error: 'telegram_auth_required' });
    }

    const feature = String(req.body?.feature || '');
    const vision = isVisionFeature(feature);
    let messages;
    try {
        const telegramId = auth.ok ? Number(auth.user.id) : null;
        const rateLimit = await enforceRateLimit(req, {
            botToken,
            telegramId,
            scope: vision ? 'ai:vision' : 'ai:text',
            limit: vision ? 8 : 30,
            windowSeconds: 60 * 60,
            persistent: auth.ok
        });
        setRateLimitHeaders(res, rateLimit);
        if (!rateLimit.allowed) return sendJson(res, 429, { error: 'rate_limited' });

        const policy = auth.ok
            ? await userStore(botToken, 'get_public_config', { telegramId })
            : DEFAULT_PUBLIC_POLICY;
        validateVisionConsent(feature, req.body?.payload, policy);
        messages = buildReadingMessages(feature, req.body?.payload);
        await moderateVisionInput(feature, req.body?.payload, policy);
    } catch (error) {
        const code = error?.message || 'invalid_request';
        if (code === 'rate_limit_backend_failed' || code === 'photo_moderation_unavailable') {
            return sendJson(res, 503, { error: code });
        }
        if (code === 'photo_requires_review') return sendJson(res, 422, { error: code });
        if (code === 'photo_blocked') return sendJson(res, 400, { error: code });
        return sendJson(res, 400, { error: code });
    }

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
