function normalizeAdminIds(values = []) {
    return new Set(values.map(Number).filter(Number.isSafeInteger));
}

export function buildBotReply(update, webAppUrl, { adminIds = [], botUsername = 'BelonTip_bot' } = {}) {
    const message = update?.message;
    if (!message?.text || !message.chat?.id) return null;

    const text = message.text.trim();
    const userId = Number(message.from?.id);
    const isAdmin = normalizeAdminIds(adminIds).has(userId);
    const adminUrl = new URL('/admin/', webAppUrl).toString();

    if (/^\/id(?:@[A-Za-z0-9_]+)?(?:\s|$)/.test(text)) {
        return {
            method: 'sendMessage',
            payload: {
                chat_id: message.chat.id,
                text: `Ваш Telegram ID: ${userId}`
            }
        };
    }

    if (/^\/admin(?:@[A-Za-z0-9_]+)?(?:\s|$)/.test(text)) {
        if (!isAdmin) {
            return {
                method: 'sendMessage',
                payload: {
                    chat_id: message.chat.id,
                    text: `Доступ к админ-панели не разрешён. Ваш Telegram ID: ${userId}`
                }
            };
        }
        return {
            method: 'sendMessage',
            payload: {
                chat_id: message.chat.id,
                text: 'Панель управления Nastardamus готова.',
                reply_markup: {
                    inline_keyboard: [[{
                        text: '⚙️ Открыть админ-панель',
                        web_app: { url: adminUrl }
                    }]]
                }
            }
        };
    }

    if (/^\/support(?:@[A-Za-z0-9_]+)?(?:\s|$)/.test(text)) {
        return {
            method: 'sendMessage',
            payload: {
                chat_id: message.chat.id,
                text: 'Напишите вопрос обычным сообщением. AI-помощник постарается помочь, а при необходимости передаст диалог оператору.'
            }
        };
    }

    if (/^\/start(?:@[A-Za-z0-9_]+)?(?:\s|$)/.test(text)) {
        const payload = text.replace(/^\/start(?:@[A-Za-z0-9_]+)?\s*/i, '').trim();
        const inviteMatch = payload.match(/^invite_(tarot|photo|palm)_(love|friendship|business|creative)$/);
        const appUrl = new URL(webAppUrl);
        if (inviteMatch) {
            appUrl.searchParams.set('screen', inviteMatch[1] === 'tarot' ? 'tarot' : inviteMatch[1] === 'photo' ? 'photo-compat' : 'palm');
            appUrl.searchParams.set('invite', inviteMatch[2]);
        }
        const rows = [[{
            text: '🔮 Открыть Nastardamus',
            web_app: { url: appUrl.toString() }
        }], [{
            text: '💬 Как пользоваться и поддержка',
            callback_data: 'support_help'
        }]];
        const username = String(botUsername || '').replace(/^@/, '');
        if (/^[A-Za-z0-9_]{5,32}$/.test(username)) {
            rows.push([{
                text: '↗️ Открыть чат бота',
                url: `https://t.me/${username}?start=app`
            }]);
        }
        if (isAdmin) {
            rows.push([{
                text: '⚙️ Админ-панель',
                web_app: { url: adminUrl }
            }]);
        }
        return {
            method: 'sendMessage',
            payload: {
                chat_id: message.chat.id,
                text: inviteMatch
                    ? 'Вас пригласили в совместное пространство Nastardamus. Откройте приложение — нужный раздел уже выбран.'
                    : 'Добро пожаловать в Nastardamus. Откройте приложение или напишите вопрос прямо в этот чат.',
                reply_markup: { inline_keyboard: rows }
            }
        };
    }

    if (text.startsWith('/')) {
        return {
            method: 'sendMessage',
            payload: {
                chat_id: message.chat.id,
                text: 'Команды: /start — открыть приложение, /support — помощь, /id — узнать Telegram ID, /admin — админ-панель.'
            }
        };
    }

    return null;
}
