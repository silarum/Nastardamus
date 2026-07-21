import { runAgent } from '../lib/ai-runtime.js';
import { buildBotReply } from '../lib/bot-replies.js';
import { getRequestHeader } from '../lib/telegram.js';

const ADMIN_STORE_URL = process.env.ADMIN_STORE_URL
    || 'https://hngfpdsnjgdpazmortix.supabase.co/functions/v1/nastardamus-admin-store';

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
        body: JSON.stringify({ action, ...payload }),
        signal: AbortSignal.timeout(12_000)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || `admin_store_${response.status}`);
    return data;
}

async function isAdminUser(botToken, userId) {
    if (parseAdminIds(process.env.ADMIN_TELEGRAM_IDS).includes(userId)) return true;
    try {
        const data = await edgeStore(botToken, 'get_admin_profile', { telegramId: userId });
        return Boolean(data.profile?.is_active);
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
            `Ответ AI: ${aiAnswer || 'не сформирован'}`
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
    await callTelegram(botToken, 'sendChatAction', {
        chat_id: message.chat.id,
        action: 'typing'
    }).catch(() => {});

    try {
        const result = await runAgent({
            botToken,
            slug: 'support-guide',
            message: message.text,
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
            text: `${answer}${suffix}`.slice(0, 4000)
        });
    } catch (error) {
        console.error('Telegram AI support failed:', error, error?.causes || null);
        const forwarded = await forwardToSupport(botToken, message, 'AI-помощник недоступен');
        await callTelegram(botToken, 'sendMessage', {
            chat_id: message.chat.id,
            text: forwarded
                ? 'AI-помощник временно недоступен. Ваш вопрос отправлен оператору поддержки.'
                : 'AI-помощник временно недоступен. Попробуйте позже или откройте приложение через /start.'
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
            try {
                const webhookUrl = new URL('/api/bot', webAppUrl).toString();
                await callTelegram(botToken, 'setWebhook', {
                    url: webhookUrl,
                    secret_token: webhookSecret,
                    allowed_updates: ['message', 'callback_query'],
                    drop_pending_updates: false
                });
                return sendJson(res, 200, { status: 'ok', webhook: 'configured' });
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
                    bot: { id: identity.id, username: identity.username, first_name: identity.first_name }
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
                readings: Boolean(process.env.OPENROUTER_API_KEY),
                aiSupport: Boolean(process.env.OPENROUTER_API_KEY || botToken),
                openRouterModel: Boolean(process.env.OPENROUTER_MODEL),
                webAppUrl: Boolean(process.env.WEB_APP_URL),
                authenticatedPreviewOnly: process.env.ALLOW_UNAUTHENTICATED_PREVIEW === 'false'
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

    try {
        const callback = req.body.callback_query;
        if (callback?.id) {
            await callTelegram(botToken, 'answerCallbackQuery', { callback_query_id: callback.id });
            if (callback.data === 'support_help' && callback.message?.chat?.id) {
                await callTelegram(botToken, 'sendMessage', {
                    chat_id: callback.message.chat.id,
                    text: 'Напишите вопрос обычным сообщением. AI-помощник объяснит, как пользоваться сервисом, а при необходимости передаст вопрос оператору.'
                });
            }
            return sendJson(res, 200, { ok: true });
        }

        const message = req.body.message;
        if (!message?.text || !message.chat?.id) return sendJson(res, 200, { ok: true });
        const userId = Number(message.from?.id);
        const admin = await isAdminUser(botToken, userId);
        const reply = buildBotReply(
            req.body,
            process.env.WEB_APP_URL || 'https://nastardamus.vercel.app',
            { adminIds: admin ? [userId] : [] }
        );
        if (reply) {
            await callTelegram(botToken, reply.method, reply.payload);
        } else {
            await answerSupportMessage(botToken, message);
        }
        return sendJson(res, 200, { ok: true });
    } catch (error) {
        console.error('Telegram webhook failed:', error);
        return sendJson(res, 502, { error: 'telegram_request_failed' });
    }
}
