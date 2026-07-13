export default async function handler(req, res) {
    // GET — проверка работы
    if (req.method === 'GET') {
        return res.status(200).json({ status: 'Bot is running' });
    }

    // POST — обработка сообщений от Telegram
    try {
        const body = req.body;
        
        // Проверяем, есть ли сообщение
        if (!body || !body.message) {
            return res.status(200).json({ ok: true });
        }

        const msg = body.message;
        const chatId = msg.chat.id;
        const text = msg.text || '';

        const BOT_TOKEN = process.env.BOT_TOKEN;
        const ADMIN_ID = process.env.ADMIN_ID;

        // Проверка прав
        if (String(chatId) !== String(ADMIN_ID)) {
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: '⛔ Доступ запрещён.'
                })
            });
            return res.status(200).json({ ok: true });
        }

        // Ответ на /start
        if (text === '/start' || text === '/menu') {
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: '🔮 Nastardamus Admin\n\nДобро пожаловать в панель управления!\n\nКоманды:\n/start — меню',
                    reply_markup: JSON.stringify({
                        inline_keyboard: [
                            [{ text: '📊 Дашборд', callback_data: 'dashboard' }],
                            [{ text: '💳 Платежи', callback_data: 'payments' }],
                            [{ text: '🔄 Обмен', callback_data: 'exchanges' }],
                            [{ text: '🎫 Чеки', callback_data: 'vouchers' }]
                        ]
                    })
                })
            });
        }

        return res.status(200).json({ ok: true });
    } catch (error) {
        return res.status(200).json({ ok: true });
    }
}
