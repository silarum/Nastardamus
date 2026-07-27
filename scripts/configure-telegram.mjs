const WEB_APP_URL = process.env.WEB_APP_URL || 'https://nastardamus.vercel.app';
const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;
const IS_PRODUCTION = process.env.VERCEL_ENV === 'production';

function assertProductionConfiguration() {
    if (!BOT_TOKEN) throw new Error('BOT_TOKEN is required for the production Telegram setup');
    if (!WEBHOOK_SECRET) {
        throw new Error('TELEGRAM_WEBHOOK_SECRET is required for the production Telegram setup');
    }

    const url = new URL(WEB_APP_URL);
    if (url.protocol !== 'https:') throw new Error('WEB_APP_URL must use HTTPS');
    return url;
}

async function callTelegram(method, payload = {}) {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
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

async function configureTelegram() {
    if (!IS_PRODUCTION) {
        console.log('Telegram setup skipped outside the Vercel production environment.');
        return;
    }

    const webAppUrl = assertProductionConfiguration();
    const webhookUrl = new URL('/api/bot', webAppUrl).toString();

    await callTelegram('setWebhook', {
        url: webhookUrl,
        secret_token: WEBHOOK_SECRET,
        allowed_updates: ['message', 'callback_query'],
        drop_pending_updates: false
    });
    await callTelegram('setChatMenuButton', {
        menu_button: {
            type: 'web_app',
            text: 'Открыть Nastardamus',
            web_app: { url: webAppUrl.toString() }
        }
    });
    await callTelegram('setMyCommands', {
        commands: [
            { command: 'start', description: 'Открыть Nastardamus' },
            { command: 'support', description: 'Помощь и поддержка' },
            { command: 'id', description: 'Показать мой Telegram ID' }
        ]
    });

    const webhook = await callTelegram('getWebhookInfo');
    if (webhook?.url !== webhookUrl) {
        throw new Error('Telegram webhook verification failed');
    }

    console.log('Telegram webhook, Mini App menu button and commands configured.');
}

await configureTelegram();
