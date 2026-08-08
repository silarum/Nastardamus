import { buildReadingMessages, isVisionFeature, structuredSchemaForFeature } from '../lib/readings.js';
import { requestDeepSeekChat } from '../lib/deepseek.js';
import { analyzeVisionImages, injectVisionAnalysis } from '../lib/vision.js';
import { buildPersonalAnalysisMessages, parsePersonalAnalysis } from '../lib/personal-analysis.js';
import { normalizePersonalEvent } from '../lib/personal-space.js';
import { runAgent } from '../lib/ai-runtime.js';
import { buildOracleRoomAgentRequest } from '../lib/oracle-rooms.js';
import { buildTarotDialogueAgentRequest } from '../lib/tarot-dialogue.js';
import { getRequestHeader, validateTelegramInitData } from '../lib/telegram.js';
import {
    enforceRateLimit,
    normalizeIdempotencyKey,
    setRateLimitHeaders,
    unauthenticatedPreviewAllowed
} from '../lib/request-security.js';

const READING_FEATURES = new Set([
    'tarot',
    'natal',
    'daily_horoscope',
    'sports_forecast',
    'compatibility',
    'photo_energy',
    'photo_damage',
    'photo_compatibility',
    'palm_reading',
    'rune_reading',
    'path_consultation',
    'amur_compatibility'
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
    'get_active_dialogue',
    'get_esoterium_context',
    'set_esoterium_memory',
    'clear_esoterium_memory',
    'save_esoterium_turn',
    'get_personal_space',
    'upsert_personal_event',
    'upsert_personal_goal',
    'upsert_personal_task',
    'upsert_path_item',
    'upsert_path_consultation',
    'save_rune_preferences',
    'upsert_amur_profile',
    'set_amur_discovery',
    'save_personal_checkin',
    'save_space_preferences',
    'delete_personal_item',
    'clear_personal_space'
]);
const ORACLE_ROOM_ACTIONS = new Set([
    'create_oracle_room',
    'list_oracle_rooms',
    'get_oracle_room',
    'join_oracle_room',
    'invite_oracle_room_username',
    'upload_oracle_room_palm',
    'leave_oracle_room',
    'close_oracle_room'
]);
const USER_STORE_URL = process.env.USER_STORE_URL
    || 'https://hngfpdsnjgdpazmortix.supabase.co/functions/v1/nastardamus-user-store';
const DEFAULT_PUBLIC_POLICY = Object.freeze({
    settings: {
        palmLinkEnabled: false,
        jointReadingsEnabled: true,
        manualPhotoReview: true,
        adultOnly: true,
        everythingFree: false,
        tarotCatalog: [],
        compatibilityCatalog: [],
        vip: null
    },
    moderation: {
        enabled: true,
        rules: { consent_required: true },
        thresholds: { block: 0.85, manual_review: 0.55 },
        actions: { high_risk: 'block', medium_risk: 'review' }
    }
});

export const config = {
    maxDuration: 60,
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

async function userStore(botToken, action, payload = {}) {
    const response = await fetch(USER_STORE_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-App-Bot-Token': botToken
        },
        body: JSON.stringify({ ...payload, action }),
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

function oracleRoomAppUrl(token) {
    const url = new URL(process.env.WEB_APP_URL || 'https://nastardamus.vercel.app');
    url.searchParams.set('screen', 'palm-room');
    url.searchParams.set('room', token);
    return url.toString();
}

function oracleRoomInviteUrl(token) {
    const username = String(process.env.BOT_USERNAME || 'BelonTip_bot').replace(/^@/, '');
    return `https://t.me/${username}?start=room_${token}`;
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

async function notifyOracleRoomChat(botToken, chatId, text, token) {
    if (!Number.isSafeInteger(Number(chatId)) || Number(chatId) <= 0) return;
    await callTelegram(botToken, 'sendMessage', {
        chat_id: Number(chatId),
        text,
        reply_markup: {
            inline_keyboard: [[{
                text: '🖐 Открыть комнату Эзотериума',
                web_app: { url: oracleRoomAppUrl(token) }
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

async function moderateVisionInput(feature, payload, policy, requestId) {
    if (!isVisionFeature(feature) || policy.moderation?.enabled === false) return;
    if (!process.env.OPENAI_API_KEY) return;

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
    let response;
    let data;
    try {
        response = await fetch('https://api.openai.com/v1/moderations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({ model: 'omni-moderation-latest', input }),
            signal: AbortSignal.timeout(30_000)
        });
        data = await response.json().catch(() => null);
    } catch (error) {
        console.warn('Optional photo moderation unavailable; Vision safety remains active', {
            requestId,
            feature,
            code: error?.name === 'TimeoutError' ? 'timeout' : 'request_failed'
        });
        return;
    }
    if (!response.ok) {
        console.warn('Optional photo moderation unavailable; Vision safety remains active', {
            requestId,
            feature,
            status: response.status,
            code: data?.error?.code || data?.error?.type || 'provider_error',
            providerRequestId: response.headers?.get?.('x-request-id') || null
        });
        return;
    }

    const result = data?.results?.[0];
    if (!result) {
        console.warn('Optional photo moderation unavailable; Vision safety remains active', {
            requestId,
            feature,
            code: 'empty_response'
        });
        return;
    }
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

function parseJsonObject(value) {
    const source = String(value || '').trim();
    const unfenced = source
        .replace(/^```(?:json)?\s*/iu, '')
        .replace(/\s*```$/u, '')
        .trim();
    const candidates = [unfenced];
    const firstBrace = unfenced.indexOf('{');
    const lastBrace = unfenced.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
        candidates.push(unfenced.slice(firstBrace, lastBrace + 1));
    }
    for (const candidate of candidates) {
        try {
            const parsed = JSON.parse(candidate);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
        } catch {
            // Try the next safe JSON candidate.
        }
    }
    throw new Error('invalid_structured_response');
}

function matchesSchema(value, schema) {
    if (!schema || typeof schema !== 'object') return true;
    if (Array.isArray(schema.enum) && !schema.enum.includes(value)) return false;
    if (schema.type === 'string') return typeof value === 'string';
    if (schema.type === 'integer') {
        return Number.isInteger(value)
            && (schema.minimum === undefined || value >= schema.minimum)
            && (schema.maximum === undefined || value <= schema.maximum);
    }
    if (schema.type === 'array') {
        return Array.isArray(value)
            && (schema.minItems === undefined || value.length >= schema.minItems)
            && (schema.maxItems === undefined || value.length <= schema.maxItems)
            && value.every((item) => matchesSchema(item, schema.items));
    }
    if (schema.type === 'object') {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
        if ((schema.required || []).some((key) => !(key in value))) return false;
        if (schema.additionalProperties === false) {
            const allowed = new Set(Object.keys(schema.properties || {}));
            if (Object.keys(value).some((key) => !allowed.has(key))) return false;
        }
        return Object.entries(schema.properties || {})
            .every(([key, childSchema]) => !(key in value) || matchesSchema(value[key], childSchema));
    }
    return true;
}

async function requestDeepSeekReading(messages, feature, structured = null) {
    if (!structured) {
        const response = await requestDeepSeekChat({
            messages,
            temperature: 0.84,
            maxTokens: 1400
        });
        return { answer: response.answer, result: null };
    }
    const jsonInstruction = [
        '',
        '# Технический формат JSON',
        'Верни только один валидный JSON-объект: без Markdown, пояснений до или после объекта.',
        'Используй в точности поля и типы следующей JSON Schema:',
        JSON.stringify(structured.schema)
    ].join('\n');
    const jsonMessages = messages.map((message, index) => index === 0 && message.role === 'system'
        ? { ...message, content: `${message.content}${jsonInstruction}` }
        : message);
    const response = await requestDeepSeekChat({
        messages: jsonMessages,
        temperature: 0.45,
        maxTokens: 1800,
        responseFormat: 'json_object'
    });
    const result = parseJsonObject(response.answer);
    if (!matchesSchema(result, structured.schema)) {
        throw new Error('invalid_structured_response');
    }
    const answer = answerFromStructured(feature, result);
    if (!answer) throw new Error('invalid_structured_response');
    return { answer, result };
}

async function generateReading({ feature, messages, visionAnalysis, schema }) {
    const structured = schema ? { ...schema, feature } : null;
    const finalMessages = visionAnalysis
        ? injectVisionAnalysis(messages, visionAnalysis)
        : messages;
    return requestDeepSeekReading(finalMessages, feature, structured);
}

function providerForFeature(feature) {
    return READING_FEATURES.has(feature) ? 'deepseek' : null;
}

function readingRequestId(req) {
    const incoming = String(getRequestHeader(req, 'x-vercel-id') || getRequestHeader(req, 'x-request-id') || '');
    if (/^[a-z0-9._:-]{1,120}$/i.test(incoming)) return incoming;
    return globalThis.crypto?.randomUUID?.() || `reading-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function safeErrorCode(error) {
    if (typeof error?.code === 'string' && /^[a-z0-9_.:-]{1,100}$/i.test(error.code)) return error.code;
    if (typeof error?.message === 'string' && /^[a-z0-9_.:-]{1,100}$/i.test(error.message)) return error.message;
    return 'provider_error';
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

function catalogAccessForReading(policy, feature, payload) {
    const settings = policy?.settings || {};
    if (feature === 'tarot') {
        const id = String(payload?.spread || '');
        const item = Array.isArray(settings.tarotCatalog)
            ? settings.tarotCatalog.find((entry) => String(entry?.id) === id)
            : null;
        return item ? { kind: 'tarot', id, item } : null;
    }
    let id = '';
    if (feature === 'compatibility') id = 'data';
    if (feature === 'photo_compatibility') id = payload?.source === 'palmlink' ? 'palm' : 'photo';
    if (!id) return null;
    const item = Array.isArray(settings.compatibilityCatalog)
        ? settings.compatibilityCatalog.find((entry) => String(entry?.id) === id)
        : null;
    return item ? { kind: 'compatibility', id, item } : null;
}

function hasActiveVip(policy) {
    const vip = policy?.settings?.vip;
    if (!vip) return false;
    const expiresAt = Date.parse(String(vip.expires_at || ''));
    return !Number.isFinite(expiresAt) || expiresAt > Date.now();
}

async function resolveReadingAccess(botToken, telegramId, policy, feature, payload) {
    if (policy?.settings?.everythingFree === true) {
        return { source: 'global_free', amount: 0, freeUsageKey: null };
    }
    const catalog = catalogAccessForReading(policy, feature, payload);
    if (!catalog) return null;
    const vipAccess = ({ vip: 'included', vip_only: 'only', public: 'optional' })[
        String(catalog.item.vip_access || '')
    ] || String(catalog.item.vip_access || 'optional');
    const vip = hasActiveVip(policy);
    if (vip && ['included', 'only'].includes(vipAccess)) {
        return { source: 'vip', amount: 0, freeUsageKey: null };
    }
    if (!vip && vipAccess === 'only') {
        throw new Error('vip_required');
    }
    const dailyLimit = Math.max(0, Math.floor(Number(catalog.item.free_checks || 0)));
    if (dailyLimit > 0) {
        const freeUsageKey = `${catalog.kind}:${catalog.id}`;
        const claimed = await userStore(botToken, 'claim_free_usage', {
            telegramId,
            serviceId: freeUsageKey,
            dailyLimit
        });
        if (claimed.claimed === true) {
            return { source: 'free_check', amount: 0, freeUsageKey };
        }
    }
    return null;
}

async function releaseReadingAccess(botToken, telegramId, access) {
    if (access?.source !== 'free_check' || !access.freeUsageKey) return;
    await userStore(botToken, 'release_free_usage', {
        telegramId,
        serviceId: access.freeUsageKey
    }).catch((error) => {
        console.error('Free reading usage release failed:', error?.message || error);
    });
}

async function autoCompleteJointInvitation(botToken, {
    invitationToken,
    initiatorTelegramId
}) {
    const requestId = globalThis.crypto?.randomUUID?.()
        || `joint-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    let claimed = null;
    let charge = null;
    let access = null;
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
        if (!process.env.DEEPSEEK_API_KEY) throw new Error('deepseek_not_configured');
        await moderateVisionInput('photo_compatibility', payload, policy, requestId);
        const visionAnalysis = await analyzeVisionImages({
            feature: 'photo_compatibility',
            images: imageInputs('photo_compatibility', payload),
            requestId
        });
        if (visionAnalysis.status === 'reject') {
            throw new Error(visionAnalysis.safety.unreadable
                ? 'vision_image_unreadable'
                : 'photo_blocked');
        }
        access = await resolveReadingAccess(
            botToken,
            initiatorTelegramId,
            policy,
            'photo_compatibility',
            payload
        );
        if (!access) {
            const charged = await userStore(botToken, 'charge_service', {
                telegramId: initiatorTelegramId,
                serviceId,
                idempotencyKey: `joint-${invitationToken}`
            });
            charge = charged.charge;
            if (!charge?.charge_id || charge.status === 'refunded' || charge.status === 'fulfilled') {
                throw new Error('payment_retry_required');
            }
        }
        const messages = buildReadingMessages('photo_compatibility', payload);
        const schema = structuredSchemaForFeature('photo_compatibility');
        const generated = await generateReading({
            feature: 'photo_compatibility',
            messages,
            visionAnalysis,
            schema
        });
        const completed = await userStore(botToken, 'complete_joint_invitation', {
            telegramId: initiatorTelegramId,
            invitationToken,
            result: generated.answer,
            resultPayload: generated.result || {},
            ...(charge?.charge_id
                ? { chargeId: charge.charge_id }
                : { accessSource: access.source, freeUsageKey: access.freeUsageKey })
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
        await releaseReadingAccess(botToken, initiatorTelegramId, access);
        if (claimed) {
            await releaseInvitation(botToken, initiatorTelegramId, { token: invitationToken }, error?.message || 'automatic_invitation_failed');
        }
        throw error;
    }
}

async function answerOracleRoomTurn(botToken, telegramId, body) {
    const roomToken = String(body?.roomToken || '').trim().toLowerCase();
    const message = String(body?.message || '').trim().replace(/\s+/g, ' ').slice(0, 2000);
    const clientNonce = String(body?.clientNonce || '').trim();
    if (!/^[a-f0-9]{32}$/.test(roomToken)) throw new Error('invalid_oracle_room_token');
    if (message.length < 2) throw new Error('invalid_oracle_room_message');
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/.test(clientNonce)) {
        throw new Error('invalid_idempotency_key');
    }

    let turn = null;
    try {
        const begun = await userStore(botToken, 'begin_oracle_room_turn', {
            telegramId,
            roomToken,
            message,
            clientNonce
        });
        turn = begun.turn;
        if (turn?.replayed === true) {
            if (turn.answer) return { room: begun.room, answer: turn.answer, replayed: true };
            throw new Error('oracle_room_busy');
        }

        const agentRequest = buildOracleRoomAgentRequest(begun.room, {
            turnId: turn?.turn_id,
            message: String(turn?.content || message)
        });
        const generated = await runAgent({
            botToken,
            slug: 'oracle-room',
            message: agentRequest.message,
            history: agentRequest.history
        });
        const completed = await userStore(botToken, 'complete_oracle_room_turn', {
            telegramId,
            roomToken,
            turnId: turn?.turn_id,
            answer: generated.answer
        });
        await Promise.allSettled((completed.chats || []).map((chat) =>
            notifyOracleRoomChat(
                botToken,
                chat.chat_id,
                `Эзотериум ответил в комнате «${completed.room?.title || 'Разговор'}».`,
                roomToken
            )
        ));
        return { room: completed.room, answer: generated.answer, replayed: false };
    } catch (error) {
        if (turn?.turn_id && turn?.replayed !== true) {
            await userStore(botToken, 'fail_oracle_room_turn', {
                telegramId,
                roomToken,
                turnId: turn.turn_id
            }).catch(() => null);
        }
        throw error;
    }
}

async function answerTarotDialogueTurn(botToken, telegramId, body) {
    const readingId = String(body?.readingId || '').trim().toLowerCase();
    const message = String(body?.message || '').trim().replace(/\s+/g, ' ').slice(0, 700);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(readingId)) {
        throw new Error('invalid_reading_id');
    }
    if (message.length < 2) throw new Error('invalid_tarot_dialogue_message');
    const context = await userStore(botToken, 'get_tarot_dialogue_context', { telegramId, readingId });
    const agentRequest = buildTarotDialogueAgentRequest(context, message);
    const generated = await runAgent({
        botToken,
        slug: 'tarot-dialogue',
        message: agentRequest.message,
        history: agentRequest.history
    });
    await userStore(botToken, 'append_tarot_dialogue_turn', {
        telegramId,
        readingId,
        message,
        answer: generated.answer
    });
    return generated.answer;
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
    if (action === 'personal_analysis') {
        if (!auth.ok) return sendJson(res, 401, { error: 'telegram_auth_required' });
        if (!process.env.DEEPSEEK_API_KEY) {
            return sendJson(res, 503, { error: 'assistant_unavailable' });
        }
        let event;
        try {
            event = normalizePersonalEvent(req.body?.event, { allowPast: true });
            if (!event.eventId) throw new TypeError('event_id_required');
        } catch {
            return sendJson(res, 400, { error: 'invalid_personal_event' });
        }
        try {
            const rateLimit = await enforceRateLimit(req, {
                botToken,
                telegramId,
                scope: 'ai:personal-path',
                limit: 12,
                windowSeconds: 60 * 60,
                persistent: true
            });
            setRateLimitHeaders(res, rateLimit);
            if (!rateLimit.allowed) return sendJson(res, 429, { error: 'rate_limited' });
            const history = await userStore(botToken, 'get_personal_space', { telegramId })
                .catch(() => ({ events: [], goals: [], checkins: [] }));
            const response = await requestDeepSeekChat({
                messages: buildPersonalAnalysisMessages({
                    event,
                    name: auth.user.first_name || auth.user.username || 'Искатель',
                    history
                }),
                temperature: 0.55,
                maxTokens: 1100,
                responseFormat: 'json_object'
            });
            return sendJson(res, 200, { ok: true, analysis: parsePersonalAnalysis(response.answer) });
        } catch (error) {
            if (error?.message === 'rate_limit_backend_failed') {
                return sendJson(res, 503, { error: 'rate_limit_backend_failed' });
            }
            console.error('Personal path analysis failed:', {
                status: error?.status || null,
                code: error?.code || null,
                requestId: error?.requestId || null,
                type: error?.message === 'invalid_personal_analysis' ? 'invalid_response' : 'provider_error'
            });
            return sendJson(res, 502, { error: 'assistant_unavailable' });
        }
    }

    if (ORACLE_ROOM_ACTIONS.has(action)) {
        if (!auth.ok) return sendJson(res, 401, { error: 'telegram_auth_required' });
        try {
            const limits = {
                create_oracle_room: 6,
                invite_oracle_room_username: 20,
                upload_oracle_room_palm: 10,
                join_oracle_room: 20,
                leave_oracle_room: 20,
                close_oracle_room: 12,
                get_oracle_room: 1800,
                list_oracle_rooms: 240
            };
            const rateLimit = await enforceRateLimit(req, {
                botToken,
                telegramId,
                scope: `oracle-room:${action}`,
                limit: limits[action] || 60,
                windowSeconds: 60 * 60,
                persistent: true
            });
            setRateLimitHeaders(res, rateLimit);
            if (!rateLimit.allowed) return sendJson(res, 429, { error: 'rate_limited' });

            const payload = {
                ...req.body,
                action: undefined,
                telegramId,
                ...(action === 'create_oracle_room' || action === 'join_oracle_room'
                    ? {
                        displayName: auth.user.first_name || auth.user.username || 'Искатель',
                        username: auth.user.username || '',
                        gender: req.body?.gender
                    }
                    : {})
            };
            if ((action === 'create_oracle_room' && req.body?.mode !== 'solo') || action === 'join_oracle_room') {
                const config = await userStore(botToken, 'get_public_config', { telegramId });
                if (config.settings?.jointReadingsEnabled === false) {
                    return sendJson(res, 403, { error: 'joint_readings_disabled' });
                }
            }
            const data = await userStore(botToken, action, payload);
            const token = String(data.room?.token || req.body?.roomToken || '');
            if (action === 'invite_oracle_room_username' && data.invited === true) {
                await notifyOracleRoomChat(
                    botToken,
                    data.targetChatId,
                    `${auth.user.first_name || 'Участник'} приглашает вас в общую комнату с Эзотериумом.`,
                    token
                ).catch((error) => {
                    console.error('Oracle room username notification failed:', error?.message || error);
                });
            }
            if (action === 'join_oracle_room') {
                await Promise.allSettled((data.chats || []).map((chat) =>
                    notifyOracleRoomChat(
                        botToken,
                        chat.chat_id,
                        `${auth.user.first_name || 'Новый участник'} присоединился к комнате «${data.room?.title || 'Разговор'}».`,
                        token
                    )
                ));
            }
            if (action === 'upload_oracle_room_palm' && data.newlyOpened === true) {
                await Promise.allSettled((data.chats || []).map((chat) =>
                    notifyOracleRoomChat(
                        botToken,
                        chat.chat_id,
                        `Все участники завершили подготовку. Эзотериум открыл совместное чтение «${data.room?.title || 'Путь двух судеб'}».`,
                        token
                    )
                ));
            }
            return sendJson(res, 200, {
                ...data,
                ...(token ? { inviteUrl: oracleRoomInviteUrl(token) } : {})
            });
        } catch (error) {
            const code = error?.message || 'oracle_room_unavailable';
            const status = Number(error?.status) || (
                code === 'oracle_room_not_found' || code === 'oracle_username_unavailable' ? 404
                    : code === 'oracle_room_invite_expired' ? 410
                        : ['oracle_room_closed', 'oracle_room_full', 'oracle_room_busy', 'oracle_room_owner_must_close', 'oracle_room_started', 'oracle_room_preparation_required'].includes(code) ? 409
                            : code === 'oracle_room_access_denied' ? 403
                                : code === 'oracle_palm_unavailable' ? 503
                                    : 400
            );
            if (status >= 500) {
                console.error('Oracle room action failed:', code);
            }
            return sendJson(res, status, {
                error: status >= 500 ? 'oracle_room_unavailable' : code
            });
        }
    }

    if (action === 'oracle_room_send') {
        if (!auth.ok) return sendJson(res, 401, { error: 'telegram_auth_required' });
        try {
            const rateLimit = await enforceRateLimit(req, {
                botToken,
                telegramId,
                scope: 'oracle-room:message',
                limit: 80,
                windowSeconds: 60 * 60,
                persistent: true
            });
            setRateLimitHeaders(res, rateLimit);
            if (!rateLimit.allowed) return sendJson(res, 429, { error: 'rate_limited' });
            const result = await answerOracleRoomTurn(botToken, telegramId, req.body);
            return sendJson(res, 200, { ok: true, ...result });
        } catch (error) {
            const code = error?.message || 'oracle_room_answer_unavailable';
            const status = Number(error?.status) || (
                code === 'oracle_room_not_found' ? 404
                    : code === 'oracle_room_invite_expired' ? 410
                        : ['oracle_room_closed', 'oracle_room_full', 'oracle_room_busy', 'oracle_room_turn_changed', 'oracle_room_preparation_required'].includes(code) ? 409
                            : code === 'oracle_room_access_denied' ? 403
                                : ['invalid_oracle_room_token', 'invalid_oracle_room_message', 'invalid_idempotency_key'].includes(code) ? 400
                                    : 502
            );
            return sendJson(res, status, {
                error: status >= 500 ? 'oracle_room_answer_unavailable' : code
            });
        }
    }

    if (action === 'tarot_dialogue_send') {
        if (!auth.ok) return sendJson(res, 401, { error: 'telegram_auth_required' });
        try {
            const rateLimit = await enforceRateLimit(req, {
                botToken,
                telegramId,
                scope: 'tarot:dialogue',
                limit: 24,
                windowSeconds: 60 * 60,
                persistent: true
            });
            setRateLimitHeaders(res, rateLimit);
            if (!rateLimit.allowed) return sendJson(res, 429, { error: 'rate_limited' });
            const answer = await answerTarotDialogueTurn(botToken, telegramId, req.body);
            return sendJson(res, 200, { ok: true, answer });
        } catch (error) {
            const code = error?.message || 'tarot_dialogue_unavailable';
            const status = Number(error?.status) || (
                code === 'tarot_session_not_found' ? 404
                    : ['invalid_reading_id', 'invalid_tarot_dialogue_message', 'tarot_dialogue_requires_cards'].includes(code) ? 400
                        : 502
            );
            return sendJson(res, status, { error: status >= 500 ? 'tarot_dialogue_unavailable' : code });
        }
    }

    if (READING_STORE_ACTIONS.has(action)) {
        if (!auth.ok) return sendJson(res, 401, { error: 'telegram_auth_required' });
        try {
            const { action: _ignoredAction, ...payload } = req.body || {};
            const data = await userStore(botToken, action, { ...payload, telegramId });
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
    const requestId = readingRequestId(req);
    const idempotencyKey = normalizeIdempotencyKey(req.body?.idempotencyKey);
    if (!provider) return sendJson(res, 400, { error: 'unsupported_feature' });
    let requestPayload = req.body?.payload;
    let serviceId = paidServiceForFeature(feature, requestPayload);
    let invitationContext = null;
    let visionAnalysis = null;
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
        if (!process.env.DEEPSEEK_API_KEY) throw new Error('deepseek_not_configured');
        await moderateVisionInput(feature, requestPayload, policy, requestId);
        if (vision) {
            visionAnalysis = await analyzeVisionImages({
                feature,
                images: imageInputs(feature, requestPayload),
                requestId
            });
            if (visionAnalysis.status === 'reject') {
                throw new Error(visionAnalysis.safety.unreadable
                    ? 'vision_image_unreadable'
                    : 'photo_blocked');
            }
        }
    } catch (error) {
        const code = error?.message || 'invalid_request';
        await releaseInvitation(botToken, telegramId, invitationContext, code);
        if (error?.stage === 'vision') {
            const configurationError = [
                'vision_not_configured',
                'vision_base_url_invalid',
                'vision_base_url_insecure'
            ].includes(code);
            return sendJson(res, configurationError ? 503 : 502, {
                error: configurationError ? 'vision_not_configured' : 'vision_provider_unavailable',
                requestId
            });
        }
        if (code === 'deepseek_not_configured') {
            return sendJson(res, 503, { error: code });
        }
        if (code === 'rate_limit_backend_failed' || code === 'photo_moderation_unavailable') {
            return sendJson(res, 503, { error: code });
        }
        if (code === 'vision_image_unreadable') {
            return sendJson(res, 422, { error: code, requestId });
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

    let charge = null;
    let access = null;
    if (auth.ok && serviceId) {
        if (!idempotencyKey) {
            await releaseInvitation(botToken, telegramId, invitationContext, 'invalid_idempotency_key');
            return sendJson(res, 400, { error: 'invalid_idempotency_key' });
        }
        try {
            access = await resolveReadingAccess(botToken, telegramId, policy, feature, requestPayload);
            if (!access) {
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
            if (code === 'vip_required') {
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
        const generated = await generateReading({ feature, messages, visionAnalysis, schema });
        const answer = generated.answer;
        let completedInvitation = null;
        if (invitationContext && (charge?.charge_id || access)) {
            const completed = await userStore(botToken, 'complete_joint_invitation', {
                telegramId,
                invitationToken: invitationContext.token,
                result: answer,
                resultPayload: generated.result || {},
                ...(charge?.charge_id
                    ? { chargeId: charge.charge_id }
                    : { accessSource: access.source, freeUsageKey: access.freeUsageKey })
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
            ...(charge || access ? { payment: {
                source: charge?.payment_source || access.source,
                amount: charge ? Number(charge.price_units || 0) / 100 : 0
            } } : {}),
            ...(completedInvitation ? { invitation: completedInvitation } : {})
        });
    } catch (error) {
        console.error('Nastardamus reading pipeline failed', {
            requestId,
            feature,
            stage: error?.stage || 'deepseek',
            status: error?.status || null,
            code: safeErrorCode(error),
            providerRequestId: error?.requestId || null
        });
        if (charge?.charge_id) {
            await userStore(botToken, 'refund_service_charge', {
                telegramId,
                chargeId: charge.charge_id,
                reason: 'provider_or_delivery_error'
            }).catch((refundError) => {
                console.error('Automatic service refund failed:', refundError?.message || refundError);
            });
        }
        await releaseReadingAccess(botToken, telegramId, access);
        await releaseInvitation(botToken, telegramId, invitationContext, 'provider_or_delivery_error');
        return sendJson(res, 502, {
            error: error?.stage === 'vision'
                ? 'vision_provider_unavailable'
                : 'deepseek_provider_unavailable',
            requestId
        });
    }
}
