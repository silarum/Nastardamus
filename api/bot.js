const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;

export default async function handler(req, res) {
    if (req.method === 'GET') {
        return res.status(200).json({ status: 'Bot is running' });
    }

    try {
        const body = req.body;
        console.log('Received:', JSON.stringify(body));

        // Ответ на callback_query (кнопки)
        if (body.callback_query) {
            const cb = body.callback_query;
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ callback_query_id: cb.id })
            });
            return res.status(200).json({ ok: true });
        }

        // Ответ на сообщение
        if (body.message && body.message.text) {
            const msg = body.message;
            const chatId = msg.chat.id;
            const text = msg.text;

            // Отвечаем ВСЕГДА, не только админу (для теста)
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: `Вы написали: "${text}"\n\n/start — меню`,
                    reply_markup: JSON.stringify({
                        inline_keyboard: [
                            [{ text: '📊 Дашборд', callback_data: 'dashboard' }],
                            [{ text: '💳 Платежи', callback_data: 'payments' }]
                        ]
                    })
                })
            });

            return res.status(200).json({ ok: true });
        }

        return res.status(200).json({ ok: true });
    } catch (error) {
        console.error('Error:', error);
        return res.status(200).json({ ok: true });
    }
}
