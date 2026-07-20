import { buildBotReply } from '../lib/bot-replies.js';
import { getRequestHeader } from '../lib/telegram.js';

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
        signal: AbortSignal.timeout(10_000)
    });
    const data = await response.json().catch(() => null);

    if (!response.ok || !data?.ok) {
        throw new Error(`Telegram ${method} failed with status ${response.status}`);
    }

    return data.result;
}

export default async function handler(req, res) {
    if (req.method === 'GET') {
        const botToken = process.env.BOT_TOKEN;
        const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
        const webAppUrl = process.env.WEB_APP_URL || 'https://nastardamus.vercel.app';

        if (req.query?.configure === 'webhook') {
            if (!botToken || !webhookSecret) {
                return sendJson(res, 503, { error: 'bot_not_configured' });
            }

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
                openRouterModel: Boolean(process.env.OPENROUTER_MODEL),
                webAppUrl: Boolean(process.env.WEB_APP_URL),
                adminIds: parseAdminIds(process.env.ADMIN_TELEGRAM_IDS).length > 0,
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

    if (!botToken || !webhookSecret) {
        console.error('BOT_TOKEN or TELEGRAM_WEBHOOK_SECRET is not configured');
        return sendJson(res, 503, { error: 'bot_not_configured' });
    }
    if (receivedSecret !== webhookSecret) {
        return sendJson(res, 401, { error: 'invalid_webhook_secret' });
    }
    if (!req.body || typeof req.body !== 'object') {
        return sendJson(res, 400, { error: 'invalid_update' });
    }

    try {
        if (req.body.callback_query?.id) {
            await callTelegram(botToken, 'answerCallbackQuery', {
                callback_query_id: req.body.callback_query.id
            });
        }

        const reply = buildBotReply(
            req.body,
            process.env.WEB_APP_URL || 'https://nastardamus.vercel.app',
            { adminIds: parseAdminIds(process.env.ADMIN_TELEGRAM_IDS) }
        );
        if (reply) {
            await callTelegram(botToken, reply.method, reply.payload);
        }

        return sendJson(res, 200, { ok: true });
    } catch (error) {
        console.error('Telegram webhook failed:', error);
        return sendJson(res, 502, { error: 'telegram_request_failed' });
    }
}
