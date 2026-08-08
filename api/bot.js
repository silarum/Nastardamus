import { runAgent } from '../lib/ai-runtime.js';
import {
    buildBotReply,
    buildMarketingKeyboard,
    classifyBotQuestion
} from '../lib/bot-replies.js';
import { getRequestHeader } from '../lib/telegram.js';
import { unauthenticatedPreviewAllowed } from '../lib/request-security.js';
import { hasAdminPanelAccess } from '../lib/admin-access.js';

const ADMIN_STORE_URL = process.env.ADMIN_STORE_URL
    || 'https://hngfpdsnjgdpazmortix.supabase.co/functions/v1/nastardamus-admin-store';
const USER_STORE_URL = process.env.USER_STORE_URL
    || 'https://hngfpdsnjgdpazmortix.supabase.co/functions/v1/nastardamus-user-store';

function sendJson(res, status, body) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(status).json(body);
}

function parseAdminIds(value) {
    return String(value || '').split(/[\s,;]+/).map(Number).filter(Number.isSafeInteger);
}

async function callTelegram(botToken, method, payload) {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15_000)
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) {
        throw new Error(`Telegram ${method} failed with status ${response.status}`);
    }
    return data.result;
}

async function edgeStore(botToken, action, payload = {}) {
    const response = await fetch(ADMIN_STORE_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Admin-Bot-Token': botToken
        },
        body: JSON.stringify({ ...payload, action }),
        signal: AbortSignal.timeout(12_000)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || `admin_store_${response.status}`);
    return data;
}

async function claimTelegramUpdate(botToken, updateId) {
    const response = await fetch(USER_STORE_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-App-Bot-Token': botToken
        },
        body: JSON.stringify({
            action: 'claim_telegram_update',
            botScope: 'app',
            updateId
        }),
        signal: AbortSignal.timeout(10_000)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || `update_store_${response.status}`);
    return data.claimed === true;
}

async function userStore(botToken, action, payload = {}) {
    const response = await fetch(USER_STORE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-App-Bot-Token': botToken },
        body: JSON.stringify({ ...payload, action }),
        signal: AbortSignal.timeout(12_000)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || `user_store_${response.status}`);
    return data;
}

async function releaseTelegramUpdate(botToken, updateId) {
    if (!Number.isSafeInteger(updateId)) return;
    await userStore(botToken, 'release_telegram_update', {
        botScope: 'app',
        updateId
    });
}

function paymentOrderId(payload) {
    const match = /^silarum:([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/iu
        .exec(String(payload || ''));
    return match?.[1] || '';
}

async function registerUser(botToken, message) {
    const telegramId = Number(message?.from?.id);
    const chatId = Number(message?.chat?.id);
    if (!Number.isSafeInteger(telegramId) || telegramId <= 0 || !Number.isSafeInteger(chatId) || chatId <= 0) return;
    const response = await fetch(USER_STORE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-App-Bot-Token': botToken },
        body: JSON.stringify({
            action: 'register_user',
            telegramId,
            chatId,
            username: message.from?.username,
            firstName: message.from?.first_name
        }),
        signal: AbortSignal.timeout(10_000)
    });
    if (!response.ok) throw new Error(`user_registration_${response.status}`);
}

async function isAdminUser(botToken, userId) {
    if (parseAdminIds(process.env.ADMIN_TELEGRAM_IDS).includes(userId)) return true;
    try {
        const data = await edgeStore(botToken, 'get_admin_profile', { telegramId: userId });
        return hasAdminPanelAccess(data.profile);
    } catch {
        return false;
    }
}

async function forwardToSupport(botToken, message, aiAnswer) {
    try {
        const data = await edgeStore(botToken, 'read_support');
        const support = data.support;
        if (!support?.enabled || !support.support_chat_id) return false;
        const user = message.from || {};
        const identity = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || user.id;
        const text = [
            '🆘 Новое обращение Nastardamus',
            `Пользователь: ${identity}`,
            user.username ? `Username: @${user.username}` : null,
            `Telegram ID: ${user.id}`,
            '',
            `Вопрос: ${message.text}`,
            '',
            `Ответ Эзотериума: ${aiAnswer || 'не сформирован'}`
        ].filter((line) => line !== null).join('\n');
        await callTelegram(botToken, 'sendMessage', {
            chat_id: support.support_chat_id,
            text: text.slice(0, 4000)
        });
        return true;
    } catch (error) {
        console.error('Support handoff failed:', error);
        return false;
    }
}

async function answerSupportMessage(botToken, message) {
    const webAppUrl = process.env.WEB_APP_URL || 'https://nastardamus.vercel.app';
    const topic = classifyBotQuestion(message.text);
    if (!topic.allowed) {
        await callTelegram(botToken, 'sendMessage', {
            chat_id: message.chat.id,
            text: topic.reason === 'empty'
                ? 'Знаки молчат без вопроса. Спросите меня о возможностях Nastardamus — Таро, фото-чтениях, гороскопе, Колесе Фортуны, SILARUM или оплате.'
                : 'Мой путь связан только с Nastardamus. Я не отвечаю на посторонние темы, но помогу выбрать услугу, объясню оплату и проведу в нужный раздел приложения.',
            reply_markup: buildMarketingKeyboard(webAppUrl, message.text)
        });
        return;
    }

    await callTelegram(botToken, 'sendChatAction', {
        chat_id: message.chat.id,
        action: 'typing'
    }).catch(() => {});

    try {
        const result = await runAgent({
            botToken,
            slug: 'support-guide',
            message: [
                'Ответь только в рамках приложения Nastardamus.',
                'Будь мистическим проводником-маркетологом: мягко объясни пользу подходящей функции, не дави на пользователя и не выдумывай возможностей.',
                'Не давай внешних советов и не уводи разговор от приложения.',
                `Вопрос пользователя: ${message.text}`
            ].join('\n'),
            history: []
        });
        const handoffRequested = /\[HANDOFF\]/i.test(result.answer);
        const answer = result.answer.replace(/\s*\[HANDOFF\]\s*/gi, '').trim();
        const forwarded = handoffRequested
            ? await forwardToSupport(botToken, message, answer)
            : false;
        const suffix = handoffRequested
            ? forwarded
                ? '\n\n👤 Вопрос отправлен оператору поддержки.'
                : '\n\n👤 Для ответа нужен оператор. Администратору необходимо указать группу поддержки в админ-панели.'
            : '';
        await callTelegram(botToken, 'sendMessage', {
            chat_id: message.chat.id,
            text: `${answer}${suffix}`.slice(0, 4000),
            reply_markup: buildMarketingKeyboard(webAppUrl, message.text)
        });
    } catch (error) {
        console.error('Telegram support guide failed:', error, error?.causes || null);
        const forwarded = await forwardToSupport(botToken, message, 'Эзотериум временно недоступен');
        await callTelegram(botToken, 'sendMessage', {
            chat_id: message.chat.id,
            text: forwarded
                ? 'Эзотериум временно не отвечает. Ваш вопрос отправлен оператору поддержки.'
                : 'Эзотериум временно не слышит знаки. Откройте нужный раздел приложения или попробуйте позже.',
            reply_markup: buildMarketingKeyboard(webAppUrl, message.text)
        });
    }
}

export default async function handler(req, res) {
    if (req.method === 'GET') {
        const botToken = process.env.BOT_TOKEN;
        const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
        const webAppUrl = process.env.WEB_APP_URL || 'https://nastardamus.vercel.app';

        if (req.query?.configure === 'webhook') {
            if (!botToken || !webhookSecret) return sendJson(res, 503, { error: 'bot_not_configured' });
            if (getRequestHeader(req, 'x-webhook-config-secret') !== webhookSecret) {
                return sendJson(res, 401, { error: 'webhook_configuration_denied' });
            }
            try {
                const webhookUrl = new URL('/api/bot', webAppUrl).toString();
                await callTelegram(botToken, 'setWebhook', {
                    url: webhookUrl,
                    secret_token: webhookSecret,
                    allowed_updates: ['message', 'callback_query', 'pre_checkout_query'],
                    drop_pending_updates: false
                });
                await callTelegram(botToken, 'setChatMenuButton', {
                    menu_button: {
                        type: 'web_app',
                        text: 'Открыть Nastardamus',
                        web_app: { url: webAppUrl }
                    }
                });
                return sendJson(res, 200, { status: 'ok', webhook: 'configured', menuButton: 'configured' });
            } catch (error) {
                console.error('Telegram webhook setup failed:', error);
                return sendJson(res, 502, { error: 'webhook_setup_failed' });
            }
        }

        if (req.query?.inspect === 'identity') {
            if (!botToken) return sendJson(res, 503, { error: 'bot_not_configured' });
            try {
                const identity = await callTelegram(botToken, 'getMe', {});
                return sendJson(res, 200, {
                    status: 'ok',
                    bot: {
                        id: identity.id,
                        username: identity.username,
                        first_name: identity.first_name,
                        has_main_web_app: identity.has_main_web_app === true
                    }
                });
            } catch (error) {
                console.error('Telegram identity check failed:', error);
                return sendJson(res, 502, { error: 'identity_check_failed' });
            }
        }

        return sendJson(res, 200, {
            status: 'ok',
            services: {
                bot: Boolean(botToken),
                webhookSecret: Boolean(webhookSecret),
                readings: Boolean(process.env.DEEPSEEK_API_KEY),
                supportGuide: Boolean(process.env.DEEPSEEK_API_KEY),
                textReadings: Boolean(process.env.DEEPSEEK_API_KEY),
                photoReadings: Boolean(
                    process.env.DEEPSEEK_API_KEY
                    && (
                        (
                            process.env.VISION_API_KEY
                            && process.env.VISION_BASE_URL
                            && process.env.VISION_MODEL
                        )
                        || process.env.OPENROUTER_API_KEY
                        || process.env.OPENAI_API_KEY
                    )
                ),
                fallbackReady: Boolean(process.env.OPENROUTER_API_KEY),
                webAppUrl: Boolean(process.env.WEB_APP_URL),
                authenticatedPreviewOnly: !unauthenticatedPreviewAllowed()
            }
        });
    }

    if (req.method !== 'POST') {
        res.setHeader('Allow', 'GET, POST');
        return sendJson(res, 405, { error: 'method_not_allowed' });
    }

    const botToken = process.env.BOT_TOKEN;
    const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    const receivedSecret = getRequestHeader(req, 'x-telegram-bot-api-secret-token');

    if (!botToken || !webhookSecret) return sendJson(res, 503, { error: 'bot_not_configured' });
    if (receivedSecret !== webhookSecret) return sendJson(res, 401, { error: 'invalid_webhook_secret' });
    if (!req.body || typeof req.body !== 'object') return sendJson(res, 400, { error: 'invalid_update' });

    let claimedUpdateId = null;
    try {
        const updateId = Number(req.body.update_id);
        if (Number.isSafeInteger(updateId)) {
            const claimed = await claimTelegramUpdate(botToken, updateId);
            if (!claimed) return sendJson(res, 200, { ok: true, duplicate: true });
            claimedUpdateId = updateId;
        }

        const checkout = req.body.pre_checkout_query;
        if (checkout?.id) {
            const orderId = paymentOrderId(checkout.invoice_payload);
            try {
                if (!orderId) throw new Error('invalid_payment_checkout');
                await userStore(botToken, 'verify_external_payment', {
                    orderId,
                    telegramId: Number(checkout.from?.id),
                    totalAmount: Number(checkout.total_amount),
                    currency: String(checkout.currency || '')
                });
                await callTelegram(botToken, 'answerPreCheckoutQuery', {
                    pre_checkout_query_id: checkout.id,
                    ok: true
                });
            } catch (error) {
                console.error('Telegram Stars checkout rejected:', error?.message || error);
                await callTelegram(botToken, 'answerPreCheckoutQuery', {
                    pre_checkout_query_id: checkout.id,
                    ok: false,
                    error_message: 'Не удалось подтвердить сумму. Вернитесь в Nastardamus и создайте новую заявку.'
                });
            }
            return sendJson(res, 200, { ok: true });
        }

        const callback = req.body.callback_query;
        if (callback?.id) {
            await callTelegram(botToken, 'answerCallbackQuery', { callback_query_id: callback.id });
            if (callback.data === 'support_help' && callback.message?.chat?.id) {
                const webAppUrl = process.env.WEB_APP_URL || 'https://nastardamus.vercel.app';
                await callTelegram(botToken, 'sendMessage', {
                    chat_id: callback.message.chat.id,
                    text: 'Напишите вопрос о Nastardamus обычным сообщением. Я объясню возможности приложения и предложу подходящий раздел.',
                    reply_markup: buildMarketingKeyboard(webAppUrl, 'поддержка')
                });
            }
            return sendJson(res, 200, { ok: true });
        }

        const message = req.body.message;
        const payment = message?.successful_payment;
        if (payment) {
            const orderId = paymentOrderId(payment.invoice_payload);
            if (!orderId) throw new Error('invalid_payment_confirmation');
            const completed = await userStore(botToken, 'complete_external_payment', {
                orderId,
                providerPaymentId: String(payment.telegram_payment_charge_id || ''),
                providerPayload: {
                    telegramId: Number(message.from?.id),
                    currency: String(payment.currency || ''),
                    totalAmount: Number(payment.total_amount),
                    providerChargeId: String(payment.provider_payment_charge_id || '')
                }
            });
            const credited = Number(completed.payment?.silarum_units || 0) / 100;
            await callTelegram(botToken, 'sendMessage', {
                chat_id: message.chat.id,
                text: `✦ Оплата получена. На счёт зачислено ${credited} SILARUM.`,
                reply_markup: {
                    inline_keyboard: [[{
                        text: 'Открыть Nastardamus',
                        web_app: { url: process.env.WEB_APP_URL || 'https://nastardamus.vercel.app' }
                    }]]
                }
            });
            return sendJson(res, 200, { ok: true });
        }
        if (!message?.text || !message.chat?.id) return sendJson(res, 200, { ok: true });
        if (/^\/start(?:@\w+)?(?:\s|$)/u.test(message.text)) {
            const webAppUrl = process.env.WEB_APP_URL || 'https://nastardamus.vercel.app';
            await callTelegram(botToken, 'setChatMenuButton', {
                menu_button: {
                    type: 'web_app',
                    text: 'Открыть Nastardamus',
                    web_app: { url: webAppUrl }
                }
            }).catch((error) => {
                console.error('Telegram menu button self-repair failed:', error);
            });
        }
        await registerUser(botToken, message).catch((error) => {
            console.error('Telegram user registration failed:', error);
        });
        const userId = Number(message.from?.id);
        const admin = await isAdminUser(botToken, userId);
        const reply = buildBotReply(
            req.body,
            process.env.WEB_APP_URL || 'https://nastardamus.vercel.app',
            {
                adminIds: admin ? [userId] : [],
                botUsername: process.env.BOT_USERNAME || 'BelonTip_bot'
            }
        );
        if (reply) {
            await callTelegram(botToken, reply.method, reply.payload);
        } else {
            await answerSupportMessage(botToken, message);
        }
        return sendJson(res, 200, { ok: true });
    } catch (error) {
        console.error('Telegram webhook failed:', error);
        if (claimedUpdateId !== null) {
            await releaseTelegramUpdate(botToken, claimedUpdateId).catch((releaseError) => {
                console.error('Telegram update release failed:', releaseError?.message || releaseError);
            });
        }
        return sendJson(res, 502, { error: 'telegram_request_failed' });
    }
}
