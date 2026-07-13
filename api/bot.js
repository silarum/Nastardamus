export default async function handler(req, res) {
    if (req.method === 'GET') {
        return res.status(200).json({ status: 'Bot is running' });
    }

    const BOT_TOKEN = process.env.BOT_TOKEN;

    try {
        const body = req.body;

        if (body && body.message && body.message.text) {
            const chatId = body.message.chat.id;
            const text = body.message.text;

            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: 'Привет! Бот работает. Напиши /start'
                })
            });
        }

        return res.status(200).json({ ok: true });
    } catch (e) {
        return res.status(200).json({ ok: true });
    }
}
