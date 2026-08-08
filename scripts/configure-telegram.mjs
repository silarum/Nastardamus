import { readFile } from 'node:fs/promises';

const WEB_APP_URL = process.env.WEB_APP_URL || 'https://nastardamus.vercel.app';
const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;
const IS_PRODUCTION = process.env.VERCEL_ENV === 'production';
const BOT_NAME = 'Nastardamus • Таро и знаки';
const BOT_SHORT_DESCRIPTION = 'Когда нужен знак: Таро, фото-совместимость, натальные подсказки и личный дневник — в одном прикосновении.';
const BOT_DESCRIPTION = 'Nastardamus — тихий проводник в минуты, когда разум ищет ответ, а сердце — знак. Здесь Таро помогает увидеть скрытые смыслы, фото-совместимость — почувствовать связь, натальные подсказки — понять свой ритм, а дневник сохраняет важные откровения. Задайте вопрос, прикоснитесь к карте и взгляните на ситуацию по-новому. Не пророчество, а пространство для интуиции, размышления и осознанного выбора.';
const BOT_AVATAR_PATH = new URL('../images/bot-avatar.jpg', import.meta.url);

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
    for (let attempt = 1; attempt <= 3; attempt += 1) {
        const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(15_000)
        });
        const data = await response.json().catch(() => null);
        if (response.ok && data?.ok) return data.result;

        const retryAfter = Number(data?.parameters?.retry_after);
        if (response.status === 429 && attempt < 3 && Number.isFinite(retryAfter)) {
            await new Promise((resolve) => setTimeout(resolve, Math.min(Math.max(retryAfter, 1), 10) * 1000));
            continue;
        }
        throw new Error(`Telegram ${method} failed with status ${response.status}`);
    }
    throw new Error(`Telegram ${method} failed after retries`);
}

async function setTelegramAvatar() {
    const avatar = await readFile(BOT_AVATAR_PATH);

    for (let attempt = 1; attempt <= 3; attempt += 1) {
        const form = new FormData();
        form.append('photo', JSON.stringify({
            type: 'static',
            photo: 'attach://profile_photo'
        }));
        form.append(
            'profile_photo',
            new Blob([avatar], { type: 'image/jpeg' }),
            'nastardamus-avatar.jpg'
        );

        const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setMyProfilePhoto`, {
            method: 'POST',
            body: form,
            signal: AbortSignal.timeout(30_000)
        });
        const data = await response.json().catch(() => null);
        if (response.ok && data?.ok) return data.result;

        const retryAfter = Number(data?.parameters?.retry_after);
        if (response.status === 429 && attempt < 3 && Number.isFinite(retryAfter)) {
            await new Promise((resolve) => setTimeout(resolve, Math.min(Math.max(retryAfter, 1), 10) * 1000));
            continue;
        }
        throw new Error(`Telegram setMyProfilePhoto failed with status ${response.status}`);
    }
    throw new Error('Telegram setMyProfilePhoto failed after retries');
}

async function configureTelegram() {
    if (!IS_PRODUCTION) {
        console.log('Telegram setup skipped outside the Vercel production environment.');
        return;
    }

    const webAppUrl = assertProductionConfiguration();
    const webhookUrl = new URL('/api/bot', webAppUrl).toString();
    const expectedMenuButton = {
        type: 'web_app',
        text: 'Открыть Nastardamus',
        web_app: { url: webAppUrl.toString() }
    };
    const expectedCommands = [
        { command: 'start', description: 'Открыть Nastardamus' },
        { command: 'support', description: 'Помощь и поддержка' },
        { command: 'id', description: 'Показать мой Telegram ID' }
    ];
    const [
        currentWebhook,
        currentMenuButton,
        currentCommands,
        currentName,
        currentShortDescription,
        currentDescription
    ] = await Promise.all([
        callTelegram('getWebhookInfo'),
        callTelegram('getChatMenuButton'),
        callTelegram('getMyCommands'),
        callTelegram('getMyName'),
        callTelegram('getMyShortDescription'),
        callTelegram('getMyDescription')
    ]);

    if (currentWebhook?.url !== webhookUrl) {
        await callTelegram('setWebhook', {
            url: webhookUrl,
            secret_token: WEBHOOK_SECRET,
            allowed_updates: ['message', 'callback_query'],
            drop_pending_updates: false
        });
    }
    if (JSON.stringify(currentMenuButton) !== JSON.stringify(expectedMenuButton)) {
        await callTelegram('setChatMenuButton', { menu_button: expectedMenuButton });
    }
    if (JSON.stringify(currentCommands) !== JSON.stringify(expectedCommands)) {
        await callTelegram('setMyCommands', { commands: expectedCommands });
    }
    if (currentName?.name !== BOT_NAME) {
        await callTelegram('setMyName', { name: BOT_NAME });
    }
    if (currentShortDescription?.short_description !== BOT_SHORT_DESCRIPTION) {
        await setTelegramAvatar();
        await callTelegram('setMyShortDescription', {
            short_description: BOT_SHORT_DESCRIPTION
        });
    }
    if (currentDescription?.description !== BOT_DESCRIPTION) {
        await callTelegram('setMyDescription', { description: BOT_DESCRIPTION });
    }

    const webhook = currentWebhook?.url === webhookUrl
        ? currentWebhook
        : await callTelegram('getWebhookInfo');
    if (webhook?.url !== webhookUrl) {
        throw new Error('Telegram webhook verification failed');
    }

    console.log('Telegram webhook, Mini App menu, commands, profile text and avatar configured.');
}

await configureTelegram();
