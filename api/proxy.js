import { buildReadingMessages, isVisionFeature, structuredSchemaForFeature } from '../lib/readings.js';
import { requestDeepSeekChat } from '../lib/deepseek.js';
import { getRequestHeader, validateTelegramInitData } from '../lib/telegram.js';
import {
    enforceRateLimit,
    normalizeIdempotencyKey,
    setRateLimitHeaders,
    unauthenticatedPreviewAllowed
} from '../lib/request-security.js';

const DEFAULT_OPENAI_MODEL = 'gpt-5.6';
const DEEPSEEK_READING_FEATURES = new Set([
    'tarot',
    'natal'
]);
const OPENAI_READING_FEATURES = new Set([
    'compatibility',
    'photo_energy',
    'photo_damage',
    'photo_compatibility',
    'palm_reading',
    'rune_reading',
    'amur_compatibility',
    'daily_horoscope',
    'sports_forecast'
]);
const READING_STORE_ACTIONS = new Set([
    'get_reading_catalog',
    'create_tarot_session',
    'draw_tarot_card',
    'save_reading',
    'list_readings',
    'get_reading',
    'update_reading',
    'delete_reading',
    'create_dialogue_session',
    'append_dialogue_message',
    'get_active_dialogue'
]);
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
    api: { bodyParser: { sizeLimit: '8mb' } }
};

function sendJson(res, status, body) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.status(status).json(body);
}

async function callTelegram(botToken, method, payload) {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(12_000)
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) throw new Error(`telegram_${method}_${response.status}`);
    return data.result;
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
                        detail: 'high'
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
    if (!response.ok || !data.ok) {
        const error = new Error(data.error || `user_store_${response.status}`);
        error.status = response.status;
        throw error;
    }
    return data;
}

function invitationAppUrl(token) {
    const url = new URL(process.env.WEB_APP_URL || 'https://nastardamus.vercel.app');
    url.searchParams.set('screen', 'invitation');
    url.searchParams.set('invitation', token);
    return url.toString();
}

async function notifyInvitationChat(botToken, chatId, text, token) {
    if (!Number.isSafeInteger(Number(chatId)) || Number(chatId) <= 0) return;
    await callTelegram(botToken, 'sendMessage', {
        chat_id: Number(chatId),
        text,
        reply_markup: {
            inline_keyboard: [[{
                text: '✨ Открыть совместный ритуал',
                web_app: { url: invitationAppUrl(token) }
            }]]
        }
    });
}

function invitationStoreAction(action) {
    return ({
        invitation_create: 'create_joint_invitation',
        invitation_accept: 'accept_joint_invitation',
        invitation_refresh: 'get_joint_invitation',
        invitation_upload: 'upload_joint_participant_image',
        invitation_request_initiator_payment: 'request_joint_initiator_payment',
        invitation_start: 'request_joint_analysis'
    })[action] || '';
}

async function releaseInvitation(botToken, telegramId, context, reason) {
    if (!context?.token || !telegramId) return;
    await userStore(botToken, 'release_joint_invitation_processing', {
        telegramId,
        invitationToken: context.token,
        reason
    }).catch((error) => {
        console.error('Joint invitation release failed:', error?.message || error);
    });
}

function imageInputs(feature, payload) {
    if (feature === 'photo_energy' || feature === 'photo_damage') return [payload?.image];
    if (feature === 'palm_reading') return [payload?.image];
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

function answerFromStructured(feature, result) {
    if (!result || typeof result !== 'object') return '';
    if (feature === 'daily_horoscope') {
        return [
            result.headline,
            result.focus,
            `Отношения: ${result.relationships}`,
            `Дела и деньги: ${result.workMoney}`,
            `Самочувствие: ${result.wellbeing}`,
            `Совет: ${result.advice}`,
            `Сегодня лучше не: ${result.avoid}`,
            result.mantra
        ].filter(Boolean).join('\n\n');
    }
    if (feature === 'sports_forecast') {
        const probabilities = Array.isArray(result.probabilities)
            ? result.probabilities.map((item) => `${item.outcome} — ${item.percent}%`).join('; ')
            : '';
        return [
            `Основной прогноз: ${result.prediction}`,
            `Альтернативный сценарий: ${result.alternative}`,
            probabilities ? `Вероятности: ${probabilities}` : '',
            `Уверенность: ${result.confidence}. Ключевой фактор: ${result.keyFactor}`,
            result.missingData ? `Чего не хватает для точности: ${result.missingData}` : '',
            result.advice
        ].filter(Boolean).join('\n\n');
    }
    return String(result.narrative || result.summary || result.headline || '').trim();
}

async function requestOpenAI(messages, vision, structured = null) {
    const body = {
        model: process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL,
        input: toOpenAIInput(messages),
        max_output_tokens: vision ? 1800 : 1500,
        store: false
    };
    if (structured) {
        body.text = {
            format: {
                type: 'json_schema',
                name: structured.name,
                strict: true,
                schema: structured.schema
            }
        };
    }
    const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(vision ? 45_000 : 30_000)
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
        throw new Error(data?.error?.message || `openai_${response.status}`);
    }
    const answer = extractOpenAIText(data);
    if (!answer) throw new Error('empty_openai_response');
    if (!structured) return { answer, result: null };
    let result;
    try {
        result = JSON.parse(answer);
    } catch {
        throw new Error('invalid_structured_response');
    }
    return { answer: answerFromStructured(structured.feature, result), result };
}

function providerForFeature(feature) {
    if (DEEPSEEK_READING_FEATURES.has(feature)) return 'deepseek';
    if (OPENAI_READING_FEATURES.has(feature)) return 'openai';
    return null;
}

function paidServiceForFeature(feature, payload) {
    if (feature === 'tarot') {
        return payload?.spread === 'relationship' ? 'tarot_relationship' : 'tarot';
    }
    if (feature === 'compatibility') return 'photo_compatibility';
    if (feature === 'natal') return 'natal';
    if (feature === 'photo_energy') return 'photo_energy';
    if (feature === 'photo_damage') return 'photo_damage';
    if (feature === 'photo_compatibility') {
        return payload?.source === 'palmlink' ? 'palmlink' : 'photo_compatibility';
    }
    return null;
}

function paymentDetails(policy, walletData, serviceId) {
    const service = policy?.settings?.serviceCatalog?.[serviceId] || {};
    const price = Number(service.price || 0);
    const available = Number(walletData?.wallet?.balance_units || 0)
        - Number(walletData?.wallet?.locked_units || 0);
    const priceUnits = Math.max(0, Math.round(price * 100));
    return {
        serviceId,
        serviceTitle: String(service.title || serviceId),
        price,
        available: available / 100,
        shortage: Math.max(0, priceUnits - available) / 100,
        sbpTopupsEnabled: policy?.settings?.sbpTopupsEnabled === true
    };
}

async function autoCompleteJointInvitation(botToken, {
    invitationToken,
    initiatorTelegramId
}) {
    let claimed = null;
    let charge = null;
    try {
        const claim = await userStore(botToken, 'claim_joint_invitation_processing', {
            telegramId: initiatorTelegramId,
            invitationToken,
            payerRole: 'initiator'
        });
        claimed = claim.invitation;
        const payload = {
            invitationToken: claimed.token,
            concern: `Что важно понять о связи с целью «${claimed.goal}»?`,
            firstName: claimed.firstName,
            secondName: claimed.secondName,
            firstGender: claimed.firstGender,
            secondGender: claimed.secondGender,
            firstProfile: claimed.firstProfile,
            secondProfile: claimed.secondProfile,
            firstImage: claimed.firstImage,
            secondImage: claimed.secondImage,
            consentOwn: true,
            consentPartner: true,
            adultConfirmed: true,
            source: claimed.flow === 'palm' ? 'palmlink' : 'joint_invitation'
        };
        const serviceId = paidServiceForFeature('photo_compatibility', payload);
        const policy = await userStore(botToken, 'get_public_config', { telegramId: initiatorTelegramId });
        validateVisionConsent('photo_compatibility', payload, policy);
        await moderateVisionInput('photo_compatibility', payload, policy);
        const charged = await userStore(botToken, 'charge_service', {
            telegramId: initiatorTelegramId,
            serviceId,
            idempotencyKey: `joint-${invitationToken}`
        });
        charge = charged.charge;
        if (!charge?.charge_id || charge.status === 'refunded' || charge.status === 'fulfilled') {
            throw new Error('payment_retry_required');
        }
        const messages = buildReadingMessages('photo_compatibility', payload);
        const schema = structuredSchemaForFeature('photo_compatibility');
        const generated = await requestOpenAI(messages, true, { ...schema, feature: 'photo_compatibility' });
        const completed = await userStore(botToken, 'complete_joint_invitation', {
            telegramId: initiatorTelegramId,
            invitationToken,
            result: generated.answer,
            resultPayload: generated.result || {},
            chargeId: charge.charge_id
        });
        await Promise.allSettled((completed.chats || []).map((chat) =>
            notifyInvitationChat(
                botToken,
                chat.chat_id,
                `Совместный прогноз для ${completed.invitation?.inviteeName || 'двух участников'} готов и открыт обоим.`,
                invitationToken
            )
        ));
        return completed.invitation;
    } catch (error) {
        if (charge?.charge_id) {
            await userStore(botToken, 'refund_service_charge', {
                telegramId: initiatorTelegramId,
                chargeId: charge.charge_id,
                reason: 'automatic_invitation_delivery_error'
            }).catch(() => null);
        }
        if (claimed) {
            await releaseInvitation(botToken, initiatorTelegramId, { token: invitationToken }, error?.message || 'automatic_invitation_failed');
        }
        throw error;
    }
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return sendJson(res, 405, { error: 'method_not_allowed' });
    }

    const botToken = process.env.BOT_TOKEN;
    if (!botToken) return sendJson(res, 503, { error: 'service_not_configured' });

    const initData = getRequestHeader(req, 'x-telegram-init-data') || '';
    const auth = validateTelegramInitData(initData, botToken);
    const previewAllowed = unauthenticatedPreviewAllowed();
    if (!auth.ok && !previewAllowed) {
        return sendJson(res, 401, { error: 'telegram_auth_required' });
    }

    const telegramId = auth.ok ? Number(auth.user.id) : null;
    const action = String(req.body?.action || '');
    if (READING_STORE_ACTIONS.has(action)) {
        if (!auth.ok) return sendJson(res, 401, { error: 'telegram_auth_required' });
        try {
            const data = await userStore(botToken, action, {
                ...req.body,
                action: undefined,
                telegramId
            });
            return sendJson(res, 200, data);
        } catch (error) {
            console.error('Reading store action failed:', error?.message || error);
            return sendJson(res, Number(error?.status) || 503, {
                error: error?.message || 'reading_store_unavailable'
            });
        }
    }

    const storeAction = invitationStoreAction(action);
    if (storeAction) {
        if (!auth.ok) return sendJson(res, 401, { error: 'telegram_auth_required' });
        try {
            const rateLimit = await enforceRateLimit(req, {
                botToken,
                telegramId,
                scope: `invitation:${String(req.body.action).replace('invitation_', '')}`,
                limit: req.body.action === 'invitation_create' ? 8 : 20,
                windowSeconds: 60 * 60,
                persistent: true
            });
            setRateLimitHeaders(res, rateLimit);
            if (!rateLimit.allowed) return sendJson(res, 429, { error: 'rate_limited' });

            const payload = req.body.action === 'invitation_create'
                ? {
                    telegramId,
                    flow: req.body?.flow,
                    goal: req.body?.goal,
                    inviteeName: req.body?.inviteeName,
                    inviteeGender: req.body?.inviteeGender,
                    initiatorName: auth.user.first_name || 'Искатель',
                    initiatorGender: req.body?.initiatorGender,
                    initiatorImage: req.body?.initiatorImage,
                    initiatorProfile: req.body?.initiatorProfile,
                    consentOwn: req.body?.consentOwn === true,
                    adultConfirmed: req.body?.adultConfirmed === true
                }
                : req.body.action === 'invitation_upload'
                    ? {
                        telegramId,
                        invitationToken: req.body?.invitationToken,
                        participantImage: req.body?.participantImage,
                        participantGender: req.body?.participantGender,
                        participantProfile: req.body?.participantProfile,
                        consentOwn: req.body?.consentOwn === true,
                        adultConfirmed: req.body?.adultConfirmed === true
                    }
                    : {
                        telegramId,
                        invitationToken: req.body?.invitationToken
                    };
            const data = await userStore(botToken, storeAction, payload);
            const token = String(data.invitation?.token || '');
            if (
                (req.body.action === 'invitation_upload' && data.autoProcess === true)
                || (req.body.action === 'invitation_start' && data.invitation?.status === 'ready')
            ) {
                const initiatorTelegramId = req.body.action === 'invitation_start'
                    ? telegramId
                    : Number(data.initiatorTelegramId);
                try {
                    const completedInvitation = await autoCompleteJointInvitation(botToken, {
                        invitationToken: token,
                        initiatorTelegramId
                    });
                    return sendJson(res, 200, { ok: true, invitation: completedInvitation });
                } catch (error) {
                    const initiatorChat = (data.chats || []).find(
                        (chat) => Number(chat.telegram_id) === initiatorTelegramId
                    );
                    await notifyInvitationChat(
                        botToken,
                        initiatorChat?.chat_id,
                        error?.message === 'insufficient_funds'
                            ? 'Данные приглашённого получены. Для запуска прогноза пополните баланс и откройте приглашение.'
                            : 'Данные приглашённого получены, но прогноз временно не завершён. Откройте приглашение и повторите.',
                        token
                    ).catch(() => null);
                }
            }
            if (req.body.action === 'invitation_request_initiator_payment') {
                const initiatorChat = (data.chats || []).find(
                    (chat) => Number(chat.telegram_id) !== telegramId
                );
                await notifyInvitationChat(
                    botToken,
                    initiatorChat?.chat_id,
                    `${data.invitation?.inviteeName || 'Приглашённый человек'} уже добавил фото. Теперь инициатор может мягко завершить оплату общего результата.`,
                    token
                ).catch((error) => {
                    console.error('Invitation payment notification failed:', error?.message || error);
                });
            }
            if (req.body.action === 'invitation_create') {
                const username = String(process.env.BOT_USERNAME || 'BelonTip_bot').replace(/^@/, '');
                return sendJson(res, 200, {
                    ok: true,
                    invitation: data.invitation,
                    inviteUrl: `https://t.me/${username}?start=join_${token}`
                });
            }
            return sendJson(res, 200, { ok: true, invitation: data.invitation });
        } catch (error) {
            const code = error?.message || 'invitation_unavailable';
            const status = Number(error?.status) || (
                code === 'invitation_not_found' ? 404
                    : code === 'invitation_expired' ? 410
                        : code === 'rate_limit_backend_failed' || code === 'invitation_image_unavailable' ? 503
                            : code === 'invitation_unavailable' || code === 'invitation_not_ready' ? 409
                                : 400
            );
            return sendJson(res, status, { error: code });
        }
    }

    const feature = String(req.body?.feature || '');
    const vision = isVisionFeature(feature);
    const provider = providerForFeature(feature);
    const idempotencyKey = normalizeIdempotencyKey(req.body?.idempotencyKey);
    let requestPayload = req.body?.payload;
    let serviceId = paidServiceForFeature(feature, requestPayload);
    let invitationContext = null;
    let messages;
    let policy = DEFAULT_PUBLIC_POLICY;
    try {
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

        policy = auth.ok
            ? await userStore(botToken, 'get_public_config', { telegramId })
            : DEFAULT_PUBLIC_POLICY;
        const invitationToken = String(requestPayload?.invitationToken || '');
        if (invitationToken) {
            if (!auth.ok || feature !== 'photo_compatibility') {
                return sendJson(res, 401, { error: 'telegram_auth_required' });
            }
            const claimed = await userStore(botToken, 'claim_joint_invitation_processing', {
                telegramId,
                invitationToken,
                payerRole: requestPayload?.payerRole
            });
            invitationContext = claimed.invitation;
            requestPayload = {
                invitationToken: invitationContext.token,
                concern: `Что важно понять о связи с целью «${invitationContext.goal}»?`,
                firstName: invitationContext.firstName,
                secondName: invitationContext.secondName,
                firstGender: invitationContext.firstGender,
                secondGender: invitationContext.secondGender,
                firstProfile: invitationContext.firstProfile,
                secondProfile: invitationContext.secondProfile,
                firstImage: invitationContext.firstImage,
                secondImage: invitationContext.secondImage,
                consentOwn: true,
                consentPartner: true,
                adultConfirmed: true,
                source: invitationContext.flow === 'palm' ? 'palmlink' : 'joint_invitation'
            };
            serviceId = paidServiceForFeature(feature, requestPayload);
        }
        validateVisionConsent(feature, requestPayload, policy);
        messages = buildReadingMessages(feature, requestPayload);
        await moderateVisionInput(feature, requestPayload, policy);
    } catch (error) {
        const code = error?.message || 'invalid_request';
        await releaseInvitation(botToken, telegramId, invitationContext, code);
        if (code === 'rate_limit_backend_failed' || code === 'photo_moderation_unavailable') {
            return sendJson(res, 503, { error: code });
        }
        if (code === 'photo_requires_review') return sendJson(res, 422, { error: code });
        if (code === 'photo_blocked') return sendJson(res, 400, { error: code });
        if (code === 'invitation_not_found') return sendJson(res, 404, { error: code });
        if (code === 'invitation_expired') return sendJson(res, 410, { error: code });
        if (['invitation_busy', 'invitation_not_ready', 'invitation_already_completed'].includes(code)) {
            return sendJson(res, 409, { error: code });
        }
        if (code === 'invitation_payment_denied') return sendJson(res, 403, { error: code });
        return sendJson(res, 400, { error: code });
    }

    if (!provider) {
        await releaseInvitation(botToken, telegramId, invitationContext, 'unsupported_feature');
        return sendJson(res, 400, { error: 'unsupported_feature' });
    }
    if (provider === 'deepseek' && !process.env.DEEPSEEK_API_KEY) {
        await releaseInvitation(botToken, telegramId, invitationContext, 'deepseek_not_configured');
        return sendJson(res, 503, { error: 'deepseek_not_configured' });
    }
    if (provider === 'openai' && !process.env.OPENAI_API_KEY) {
        await releaseInvitation(botToken, telegramId, invitationContext, 'openai_not_configured');
        return sendJson(res, 503, { error: 'openai_not_configured' });
    }

    let charge = null;
    if (auth.ok && serviceId) {
        if (!idempotencyKey) {
            await releaseInvitation(botToken, telegramId, invitationContext, 'invalid_idempotency_key');
            return sendJson(res, 400, { error: 'invalid_idempotency_key' });
        }
        try {
            const charged = await userStore(botToken, 'charge_service', {
                telegramId,
                serviceId,
                idempotencyKey
            });
            charge = charged.charge;
            if (!charge?.charge_id || charge.status === 'refunded' || charge.status === 'fulfilled') {
                await releaseInvitation(botToken, telegramId, invitationContext, 'payment_retry_required');
                return sendJson(res, 409, { error: 'payment_retry_required' });
            }
        } catch (error) {
            const code = error?.message || 'payment_backend_failed';
            await releaseInvitation(botToken, telegramId, invitationContext, code);
            if (code === 'insufficient_funds') {
                const wallet = await userStore(botToken, 'get_wallet', { telegramId }).catch(() => null);
                return sendJson(res, 402, {
                    error: code,
                    payment: paymentDetails(policy, wallet, serviceId)
                });
            }
            if (['payments_disabled', 'service_disabled'].includes(code)) {
                return sendJson(res, 403, { error: code });
            }
            if (code === 'service_price_not_configured') {
                return sendJson(res, 503, { error: code });
            }
            console.error('Service charge failed:', code);
            return sendJson(res, 502, { error: 'payment_backend_failed' });
        }
    }

    try {
        const schema = structuredSchemaForFeature(feature);
        const generated = provider === 'deepseek'
            ? { answer: (await requestDeepSeekChat({
                messages,
                temperature: 0.84,
                maxTokens: 1400
            })).answer, result: null }
            : await requestOpenAI(
                messages,
                vision,
                schema ? { ...schema, feature } : null
            );
        const answer = generated.answer;
        let completedInvitation = null;
        if (invitationContext && charge?.charge_id) {
            const completed = await userStore(botToken, 'complete_joint_invitation', {
                telegramId,
                invitationToken: invitationContext.token,
                result: answer,
                resultPayload: generated.result || {},
                chargeId: charge.charge_id
            });
            completedInvitation = completed.invitation;
            await Promise.allSettled((completed.chats || []).map((chat) =>
                notifyInvitationChat(
                    botToken,
                    chat.chat_id,
                    `Совместный результат для ${completedInvitation?.inviteeName || 'двух участников'} готов. Он открыт обоим участникам.`,
                    invitationContext.token
                )
            ));
        } else if (charge?.charge_id) {
            await userStore(botToken, 'complete_service_charge', {
                telegramId,
                chargeId: charge.charge_id
            });
        }
        return sendJson(res, 200, {
            answer,
            ...(generated.result ? { result: generated.result } : {}),
            ...(charge ? { payment: {
                source: charge.payment_source,
                amount: Number(charge.price_units || 0) / 100
            } } : {}),
            ...(completedInvitation ? { invitation: completedInvitation } : {})
        });
    } catch (error) {
        console.error(`${provider} reading request failed:`, error?.message || error);
        if (charge?.charge_id) {
            await userStore(botToken, 'refund_service_charge', {
                telegramId,
                chargeId: charge.charge_id,
                reason: 'provider_or_delivery_error'
            }).catch((refundError) => {
                console.error('Automatic service refund failed:', refundError?.message || refundError);
            });
        }
        await releaseInvitation(botToken, telegramId, invitationContext, 'provider_or_delivery_error');
        return sendJson(res, 502, {
            error: provider === 'deepseek'
                ? 'deepseek_provider_unavailable'
                : vision
                    ? 'vision_provider_unavailable'
                    : 'openai_provider_unavailable'
        });
    }
}
