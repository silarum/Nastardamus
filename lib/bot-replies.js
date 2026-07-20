export function buildBotReply(update, webAppUrl) {
    const message = update?.message;
    if (!message?.text || !message.chat?.id) return null;

    const text = message.text.trim();
    if (/^\/start(?:@[A-Za-z0-9_]+)?(?:\s|$)/.test(text)) {
        return {
            method: 'sendMessage',
            payload: {
                chat_id: message.chat.id,
                text: 'Добро пожаловать в Nastardamus. Откройте приложение, чтобы получить расклад.',
                reply_markup: {
                    inline_keyboard: [[{
                        text: '🔮 Открыть Nastardamus',
                        web_app: { url: webAppUrl }
                    }]]
                }
            }
        };
    }

    return {
        method: 'sendMessage',
        payload: {
            chat_id: message.chat.id,
            text: 'Напишите /start, чтобы открыть Nastardamus.'
        }
    };
}
