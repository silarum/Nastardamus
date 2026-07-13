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
