// api/bot.js — Админ-бот Nastardamus
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    if (req.method === 'GET') {
        return res.json({ status: 'Bot is running' });
    }

    const { message, callback_query } = req.body;
    
    if (callback_query) {
        await handleCallback(callback_query);
        return res.json({ ok: true });
    }
    
    if (message?.text) {
        await handleMessage(message);
        return res.json({ ok: true });
    }

    return res.json({ ok: true });
}

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = parseInt(process.env.ADMIN_ID);

async function sendMessage(chatId, text, replyMarkup = null) {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: 'HTML',
            reply_markup: replyMarkup ? replyMarkup : undefined
        })
    });
}

async function editMessage(chatId, messageId, text, replyMarkup = null) {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            message_id: messageId,
            text,
            parse_mode: 'HTML',
            reply_markup: replyMarkup ? replyMarkup : undefined
        })
    });
}

const MAIN_MENU = {
    inline_keyboard: [
        [{ text: '📊 Дашборд', callback_data: 'dashboard' }],
        [{ text: '💳 Платежи', callback_data: 'payments' }],
        [{ text: '🔄 Обмен', callback_data: 'exchanges' }],
        [{ text: '🎫 Чеки', callback_data: 'vouchers' }],
        [{ text: '⚙️ Настройки', callback_data: 'settings' }],
        [{ text: '📈 Статистика', callback_data: 'stats' }],
        [{ text: '❓ Помощь', callback_data: 'help' }]
    ]
};

const BACK_BUTTON = {
    inline_keyboard: [[{ text: '◀️ Назад в меню', callback_data: 'menu' }]]
};

async function handleMessage(msg) {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (chatId !== ADMIN_ID) {
        return sendMessage(chatId, '⛔ Доступ запрещён.');
    }

    if (text === '/start' || text === '/menu') {
        return sendMessage(chatId, 
            '🔮 <b>Nastardamus Admin</b>\n\nДобро пожаловать в панель управления!',
            MAIN_MENU
        );
    }
}

async function handleCallback(callback) {
    const chatId = callback.message.chat.id;
    const messageId = callback.message.message_id;
    const data = callback.data;

    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: callback.id })
    });

    if (chatId !== ADMIN_ID) {
        return sendMessage(chatId, '⛔ Доступ запрещён.');
    }

    // Дашборд
    if (data === 'dashboard' || data === 'menu') {
        const stats = await getStats();
        return editMessage(chatId, messageId,
            `<b>📊 Дашборд</b>\n\n` +
            `💰 Продано силарумов: <b>${stats.totalSold}</b>\n` +
            `🔄 Обменяно: <b>${stats.totalExchanged}</b>\n` +
            `⏳ Ожидают платежи: <b>${stats.pendingPayments}</b>\n` +
            `📋 Ожидают обмен: <b>${stats.pendingExchanges}</b>\n` +
            `🎫 Ожидают выплаты: <b>${stats.pendingPayouts}</b>`,
            BACK_BUTTON
        );
    }

    // Платежи
    else if (data === 'payments') {
        const payments = await getPayments('pending');
        if (payments.length === 0) {
            return editMessage(chatId, messageId, '<b>💳 Платежи</b>\n\n✅ Нет ожидающих платежей.', BACK_BUTTON);
        }
        
        const keyboard = payments.slice(0, 10).map(p => ([
            { text: `💳 ${p.rubAmount}₽ → ${p.silurumAmount} SIL`, callback_data: `payment_${p.id}` },
            { text: '✅', callback_data: `approve_${p.id}` },
            { text: '❌', callback_data: `reject_${p.id}` }
        ]));
        keyboard.push([{ text: '◀️ Назад', callback_data: 'menu' }]);
        
        return editMessage(chatId, messageId,
            `<b>💳 Ожидающие платежи (${payments.length})</b>`,
            { inline_keyboard: keyboard }
        );
    }

    // Подтвердить платёж
    else if (data.startsWith('approve_')) {
        const id = data.replace('approve_', '');
        await updatePayment(id, 'completed');
        return editMessage(chatId, messageId, `✅ Платёж <b>#${id}</b> подтверждён!`, BACK_BUTTON);
    }

    // Отклонить платёж
    else if (data.startsWith('reject_')) {
        const id = data.replace('reject_', '');
        await updatePayment(id, 'rejected');
        return editMessage(chatId, messageId, `❌ Платёж <b>#${id}</b> отклонён.`, BACK_BUTTON);
    }

    // Детали платежа
    else if (data.startsWith('payment_')) {
        const id = data.replace('payment_', '');
        const p = await getPaymentById(id);
        if (!p) return editMessage(chatId, messageId, 'Платёж не найден.', BACK_BUTTON);
        
        return editMessage(chatId, messageId,
            `<b>💳 Платёж #${p.id}</b>\n\n` +
            `💰 Сумма: <b>${p.rubAmount} ₽</b>\n` +
            `🎯 Силарумов: <b>${p.silurumAmount}</b>\n` +
            `📅 Дата: ${new Date(p.createdAt).toLocaleString('ru')}\n` +
            `📌 Статус: ${p.status}`,
            {
                inline_keyboard: [
                    [{ text: '✅ Подтвердить', callback_data: `approve_${p.id}` }, { text: '❌ Отклонить', callback_data: `reject_${p.id}` }],
                    [{ text: '◀️ Назад', callback_data: 'payments' }]
                ]
            }
        );
    }

    // Обмен
    else if (data === 'exchanges') {
        const exchanges = await getExchanges('pending');
        if (exchanges.length === 0) {
            return editMessage(chatId, messageId, '<b>🔄 Обмен</b>\n\n✅ Нет ожидающих заявок.', BACK_BUTTON);
        }
        
        const keyboard = exchanges.slice(0, 10).map(e => ([
            { text: `🔄 ${e.amount} SIL → ${e.currency}`, callback_data: `exchange_${e.id}` }
        ]));
        keyboard.push([{ text: '◀️ Назад', callback_data: 'menu' }]);
        
        return editMessage(chatId, messageId,
            `<b>🔄 Заявки на обмен (${exchanges.length})</b>`,
            { inline_keyboard: keyboard }
        );
    }

    // Детали обмена
    else if (data.startsWith('exchange_')) {
        const id = data.replace('exchange_', '');
        const e = await getExchangeById(id);
        if (!e) return editMessage(chatId, messageId, 'Заявка не найдена.', BACK_BUTTON);
        
        return editMessage(chatId, messageId,
            `<b>🔄 Заявка #${e.id}</b>\n\n` +
            `💰 Силарумов: <b>${e.amount}</b>\n` +
            `🎯 В крипту: <b>${e.currency}</b>\n` +
            `👛 Кошелёк: <code>${e.wallet}</code>\n` +
            `📅 Дата: ${new Date(e.createdAt).toLocaleString('ru')}\n` +
            `📌 Статус: ${e.status}`,
            {
                inline_keyboard: [
                    [{ text: '✅ Обработать', callback_data: `process_exchange_${e.id}` }],
                    [{ text: '◀️ Назад', callback_data: 'exchanges' }]
                ]
            }
        );
    }

    // Обработать обмен
    else if (data.startsWith('process_exchange_')) {
        const id = data.replace('process_exchange_', '');
        await updateExchange(id, 'completed');
        return editMessage(chatId, messageId, `✅ Обмен <b>#${id}</b> обработан!`, BACK_BUTTON);
    }

    // Чеки
    else if (data === 'vouchers') {
        const payouts = await getPayouts('pending');
        if (payouts.length === 0) {
            return editMessage(chatId, messageId, '<b>🎫 Чеки</b>\n\n✅ Нет ожидающих выплат.', BACK_BUTTON);
        }
        
        const keyboard = payouts.slice(0, 10).map(p => ([
            { text: `🎫 ${p.amount} ${p.currency}`, callback_data: `payout_${p.id}` },
            { text: '✅', callback_data: `complete_payout_${p.id}` }
        ]));
        keyboard.push([{ text: '◀️ Назад', callback_data: 'menu' }]);
        
        return editMessage(chatId, messageId,
            `<b>🎫 Ожидают выплаты (${payouts.length})</b>`,
            { inline_keyboard: keyboard }
        );
    }

    // Детали чека
    else if (data.startsWith('payout_')) {
        const id = data.replace('payout_', '');
        const p = await getPayoutById(id);
        if (!p) return editMessage(chatId, messageId, 'Чек не найден.', BACK_BUTTON);
        
        return editMessage(chatId, messageId,
            `<b>🎫 Чек #${p.id}</b>\n\n` +
            `💰 Сумма: <b>${p.amount} ${p.currency}</b>\n` +
            `👛 Кошелёк: <code>${p.toWallet}</code>\n` +
            `📅 Активирован: ${new Date(p.createdAt).toLocaleString('ru')}\n` +
            `📌 Статус: ${p.status}`,
            {
                inline_keyboard: [
                    [{ text: '✅ Выплатил', callback_data: `complete_payout_${p.id}` }],
                    [{ text: '◀️ Назад', callback_data: 'vouchers' }]
                ]
            }
        );
    }

    // Выполнить выплату
    else if (data.startsWith('complete_payout_')) {
        const id = data.replace('complete_payout_', '');
        await updatePayout(id, 'completed');
        return editMessage(chatId, messageId, `✅ Выплата <b>#${id}</b> выполнена!`, BACK_BUTTON);
    }

    // Настройки
    else if (data === 'settings') {
        const s = await getSettings();
        return editMessage(chatId, messageId,
            `<b>⚙️ Настройки</b>\n\n` +
            `Комиссия обмена: <b>${s.serviceFee}%</b>\n` +
            `Мин. обмен: <b>${s.minExchange} SIL</b>\n` +
            `Срок обмена: <b>${s.maxExchangeAge} дн.</b>`,
            {
                inline_keyboard: [
                    [{ text: '−1%', callback_data: 'fee_dec' }, { text: 'Комиссия', callback_data: 'noop' }, { text: '+1%', callback_data: 'fee_inc' }],
                    [{ text: '−10', callback_data: 'min_dec' }, { text: 'Мин. обмен', callback_data: 'noop' }, { text: '+10', callback_data: 'min_inc' }],
                    [{ text: '−1', callback_data: 'age_dec' }, { text: 'Срок', callback_data: 'noop' }, { text: '+1', callback_data: 'age_inc' }],
                    [{ text: '◀️ Назад', callback_data: 'menu' }]
                ]
            }
        );
    }

    else if (data === 'fee_inc') { await updateSetting('serviceFee', 1); return handleCallback({ ...callback, data: 'settings' }); }
    else if (data === 'fee_dec') { await updateSetting('serviceFee', -1); return handleCallback({ ...callback, data: 'settings' }); }
    else if (data === 'min_inc') { await updateSetting('minExchange', 10); return handleCallback({ ...callback, data: 'settings' }); }
    else if (data === 'min_dec') { await updateSetting('minExchange', -10); return handleCallback({ ...callback, data: 'settings' }); }
    else if (data === 'age_inc') { await updateSetting('maxExchangeAge', 1); return handleCallback({ ...callback, data: 'settings' }); }
    else if (data === 'age_dec') { await updateSetting('maxExchangeAge', -1); return handleCallback({ ...callback, data: 'settings' }); }

    // Статистика
    else if (data === 'stats') {
        const stats = await getDetailedStats();
        return editMessage(chatId, messageId,
            `<b>📈 Статистика</b>\n\n` +
            `<b>Сегодня:</b>\n💰 ${stats.today.sold} SIL (${stats.today.rub} ₽)\n\n` +
            `<b>Неделя:</b>\n💰 ${stats.week.sold} SIL (${stats.week.rub} ₽)\n\n` +
            `<b>Месяц:</b>\n💰 ${stats.month.sold} SIL (${stats.month.rub} ₽)`,
            BACK_BUTTON
        );
    }

    // Помощь
    else if (data === 'help') {
        return editMessage(chatId, messageId,
            `<b>❓ Помощь</b>\n\n` +
            `<b>Как работать:</b>\n` +
            `1. Приходит уведомление о платеже\n` +
            `2. Проверяете поступление в банке\n` +
            `3. Нажимаете «Подтвердить»\n\n` +
            `<b>Команды:</b>\n` +
            `/start — Главное меню\n` +
            `/menu — Меню`,
            BACK_BUTTON
        );
    }
}

// ===== ФУНКЦИИ ДАННЫХ =====

async function getStats() {
    const p = JSON.parse(process.env.PAYMENTS_JSON || '[]');
    const e = JSON.parse(process.env.EXCHANGES_JSON || '[]');
    const v = JSON.parse(process.env.PAYOUTS_JSON || '[]');
    return {
        totalSold: p.filter(x => x.status === 'completed').reduce((s, x) => s + (x.silurumAmount || 0), 0),
        totalExchanged: e.filter(x => x.status === 'completed').reduce((s, x) => s + (x.amount || 0), 0),
        pendingPayments: p.filter(x => x.status === 'pending').length,
        pendingExchanges: e.filter(x => x.status === 'pending').length,
        pendingPayouts: v.filter(x => x.status === 'pending').length
    };
}

async function getPayments(status) {
    const p = JSON.parse(process.env.PAYMENTS_JSON || '[]');
    return status === 'all' ? p : p.filter(x => x.status === status);
}

async function getPaymentById(id) {
    return JSON.parse(process.env.PAYMENTS_JSON || '[]').find(x => x.id === id);
}

async function updatePayment(id, status) {
    const p = JSON.parse(process.env.PAYMENTS_JSON || '[]');
    const i = p.findIndex(x => x.id === id);
    if (i !== -1) { p[i].status = status; process.env.PAYMENTS_JSON = JSON.stringify(p); }
}

async function getExchanges(status) {
    const e = JSON.parse(process.env.EXCHANGES_JSON || '[]');
    return status === 'all' ? e : e.filter(x => x.status === status);
}

async function getExchangeById(id) {
    return JSON.parse(process.env.EXCHANGES_JSON || '[]').find(x => x.id === id);
}

async function updateExchange(id, status) {
    const e = JSON.parse(process.env.EXCHANGES_JSON || '[]');
    const i = e.findIndex(x => x.id === id);
    if (i !== -1) { e[i].status = status; process.env.EXCHANGES_JSON = JSON.stringify(e); }
}

async function getPayouts(status) {
    const v = JSON.parse(process.env.PAYOUTS_JSON || '[]');
    return status === 'all' ? v : v.filter(x => x.status === status);
}

async function getPayoutById(id) {
    return JSON.parse(process.env.PAYOUTS_JSON || '[]').find(x => x.id === id);
}

async function updatePayout(id, status) {
    const v = JSON.parse(process.env.PAYOUTS_JSON || '[]');
    const i = v.findIndex(x => x.id === id);
    if (i !== -1) { v[i].status = status; process.env.PAYOUTS_JSON = JSON.stringify(v); }
}

async function getSettings() {
    return JSON.parse(process.env.EXCHANGE_SETTINGS || '{"serviceFee":10,"minExchange":50,"maxExchangeAge":14}');
}

async function updateSetting(key, delta) {
    const s = await getSettings();
    s[key] = Math.max(0, (s[key] || 0) + delta);
    process.env.EXCHANGE_SETTINGS = JSON.stringify(s);
}

async function getDetailedStats() {
    const p = JSON.parse(process.env.PAYMENTS_JSON || '[]').filter(x => x.status === 'completed');
    const now = Date.now();
    const day = 86400000;
    const today = p.filter(x => now - new Date(x.createdAt).getTime() < day);
    const week = p.filter(x => now - new Date(x.createdAt).getTime() < 7 * day);
    const month = p.filter(x => now - new Date(x.createdAt).getTime() < 30 * day);
    return {
        today: { sold: today.reduce((s,x) => s + (x.silurumAmount||0), 0), rub: today.reduce((s,x) => s + (x.rubAmount||0), 0) },
        week: { sold: week.reduce((s,x) => s + (x.silurumAmount||0), 0), rub: week.reduce((s,x) => s + (x.rubAmount||0), 0) },
        month: { sold: month.reduce((s,x) => s + (x.silurumAmount||0), 0), rub: month.reduce((s,x) => s + (x.rubAmount||0), 0) }
    };
}

export async function notifyAdmin(text) {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: ADMIN_ID, text, parse_mode: 'HTML' })
    });
}
