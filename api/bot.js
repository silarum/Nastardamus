export default async function handler(req, res) {
    if (req.method === 'GET') return res.json({ status: 'Bot is running' });

    const { message } = req.body;
    if (!message?.text) return res.json({ ok: true });

    const chatId = message.chat.id;
    const text = message.text;
    const ADMIN_ID = parseInt(process.env.ADMIN_ID || '7018304698');
    const BOT_TOKEN = process.env.BOT_TOKEN;

    if (chatId !== ADMIN_ID) {
        await sendTelegram(BOT_TOKEN, chatId, '⛔ Доступ запрещён.');
        return res.json({ ok: true });
    }

    if (text === '/start') {
        await sendTelegram(BOT_TOKEN, chatId, 
            '🔮 *Nastardamus Admin*\n\nДобро пожаловать!',
            { inline_keyboard: [
                [{ text: '📊 Дашборд', callback_data: 'dashboard' }],
                [{ text: '💳 Платежи', callback_data: 'payments' }],
                [{ text: '🔄 Обмен', callback_data: 'exchanges' }],
                [{ text: '🎫 Чеки', callback_data: 'vouchers' }]
            ]}
        );
    }

    return res.json({ ok: true });
}

async function sendTelegram(token, chatId, text, replyMarkup = null) {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown', reply_markup: replyMarkup })
    });
}
