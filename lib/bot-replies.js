function normalizeAdminIds(values = []) {
    return new Set(values.map(Number).filter(Number.isSafeInteger));
}

const APP_TOPIC_PATTERN = new RegExp([
    'nastardamus', 'настардамус', 'нострадамус', 'эзотериум',
    'приложен', 'сервис', 'раздел', 'функци', 'возможност', 'как пользоваться',
    'таро', 'карт', 'расклад', 'предсказ', 'оракул',
    'гороскоп', 'зодиак', 'наталь', 'астролог', 'нумеролог',
    'фото', 'совместим', 'энергет', 'порч', 'ритуал',
    'ладон', 'хироман', 'путь двух судеб',
    'колес', 'фортун', 'подар', 'выигр', 'приз',
    'silarum', 'силарум', 'сбп', 'баланс', 'кошел', 'оплат', 'платеж', 'платёж',
    'стоимост', 'пополн',
    'профил', 'истори', 'дневник', 'поддерж', 'помощ', 'админ',
    'войти', 'вход', 'открыть', 'кнопк', 'ссылк'
].join('|'), 'iu');

const GREETING_PATTERN = /^(?:привет|здравствуй(?:те)?|добрый\s+(?:день|вечер|утро)|что\s+ты\s+умеешь|как\s+ты\s+можешь\s+помочь)[!,.?\s]*$/iu;

const MARKETING_ROUTES = [
    { pattern: /(?:сбп|пополн|купить|покупк).*(?:silarum|силарум)|(?:silarum|силарум).*(?:сбп|пополн|купить|покупк)/iu, screen: 'topup', text: '🪙 Купить SILARUM' },
    { pattern: /(?:баланс|кошел|профил|лицев(?:ой|ого)\s+сч)/iu, screen: 'profile', text: '👤 Открыть профиль' },
    { pattern: /(?:колес|фортун|подар|выигр|приз)/iu, screen: 'wheel', text: '🎁 Открыть Колесо Фортуны' },
    { pattern: /(?:порч|негативн.*воздейств|энергетическ.*след)/iu, screen: 'photo-damage', text: '🕯 Проверить энергетический след' },
    { pattern: /(?:совместим|отношен|пара|два\s+фото)/iu, screen: 'photo-compat', text: '💞 Проверить совместимость' },
    { pattern: /(?:фото|энергет)/iu, screen: 'photo-energy', text: '📷 Открыть чтение по фото' },
    { pattern: /(?:ладон|хироман|путь двух судеб)/iu, screen: 'palm', text: '🖐 Открыть чтение по ладони' },
    { pattern: /(?:гороскоп|зодиак)/iu, screen: 'horoscope', text: '♈ Открыть гороскоп' },
    { pattern: /(?:наталь|астролог|дата рождения)/iu, screen: 'natal', text: '✨ Открыть натальную подсказку' },
    { pattern: /(?:таро|карт|расклад|оракул|предсказ)/iu, screen: 'tarot', text: '🔮 Выбрать расклад Таро' },
    { pattern: /(?:ритуал)/iu, screen: 'ritual', text: '🕯 Открыть ритуал' },
    { pattern: /(?:истори|дневник|сохран)/iu, screen: 'history', text: '📜 Открыть дневник' },
    { pattern: /(?:поддерж|помощ|не\s+работ|ошиб|проблем)/iu, screen: 'support', text: '💬 Открыть поддержку' }
];

export function classifyBotQuestion(text) {
    const cleanText = String(text || '').trim().slice(0, 2000);
    if (!cleanText) return { allowed: false, reason: 'empty' };
    if (GREETING_PATTERN.test(cleanText)) return { allowed: true, reason: 'greeting' };
    const allowed = APP_TOPIC_PATTERN.test(cleanText);
    return { allowed, reason: allowed ? 'app_topic' : 'outside_scope' };
}

export function getMarketingRoute(text) {
    const cleanText = String(text || '').trim();
    return MARKETING_ROUTES.find((route) => route.pattern.test(cleanText))
        || { screen: 'services', text: '✨ Посмотреть возможности Nastardamus' };
}

function appUrlForScreen(webAppUrl, screen) {
    const url = new URL(webAppUrl);
    url.searchParams.set('screen', screen);
    return url.toString();
}

export function buildMarketingKeyboard(webAppUrl, text) {
    const route = getMarketingRoute(text);
    const rows = [[{
        text: route.text,
        web_app: { url: appUrlForScreen(webAppUrl, route.screen) }
    }]];
    if (route.screen !== 'services') {
        rows.push([{
            text: '✨ Все возможности',
            web_app: { url: appUrlForScreen(webAppUrl, 'services') }
        }]);
    }
    return { inline_keyboard: rows };
}

export function buildBotReply(update, webAppUrl, { adminIds = [] } = {}) {
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
                    text: 'Добро пожаловать в Эзотериум. Откройте приложение и выберите путь, который откликается вам сегодня.',
                    reply_markup: {
                        inline_keyboard: [[{
                            text: '🔮 Войти в Эзотериум',
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
                text: 'Внемлю вашему вопросу. Напишите, что хотите узнать о Nastardamus: я объясню возможности приложения и открою нужный раздел.',
                reply_markup: buildMarketingKeyboard(webAppUrl, 'поддержка')
            }
        };
    }

    if (/^\/paysupport(?:@[A-Za-z0-9_]+)?(?:\s|$)/.test(text)) {
        return {
            method: 'sendMessage',
            payload: {
                chat_id: message.chat.id,
                text: 'Поддержка оплат Stars: напишите код заявки, примерное время платежа и что произошло. Не отправляйте пароли, seed-фразу или приватные ключи. Оператор проверит платёж и при подтверждённой ошибке поможет с возвратом.',
                reply_markup: buildMarketingKeyboard(webAppUrl, 'поддержка оплаты')
            }
        };
    }

    if (/^\/start(?:@[A-Za-z0-9_]+)?(?:\s|$)/.test(text)) {
        const payload = text.replace(/^\/start(?:@[A-Za-z0-9_]+)?\s*/i, '').trim();
        const inviteMatch = payload.match(/^invite_(tarot|photo|palm)_(love|friendship|business|creative)$/);
        const jointInviteMatch = payload.match(/^join_([a-f0-9]{32})$/);
        const oracleRoomMatch = payload.match(/^room_([a-f0-9]{32})$/);
        const appUrl = new URL(webAppUrl);
        if (oracleRoomMatch) {
            appUrl.searchParams.set('screen', 'palm-room');
            appUrl.searchParams.set('room', oracleRoomMatch[1]);
        } else if (jointInviteMatch) {
            appUrl.searchParams.set('screen', 'invitation');
            appUrl.searchParams.set('invitation', jointInviteMatch[1]);
        } else if (inviteMatch) {
            appUrl.searchParams.set('screen', inviteMatch[1] === 'tarot' ? 'tarot' : inviteMatch[1] === 'photo' ? 'photo-compat' : 'palm');
            appUrl.searchParams.set('invite', inviteMatch[2]);
        }
        const hasInvitation = Boolean(oracleRoomMatch || jointInviteMatch || inviteMatch);
        const rows = [[{
            text: hasInvitation ? '🔮 Принять приглашение' : '🔮 Войти в Эзотериум',
            web_app: { url: appUrl.toString() }
        }]];
        return {
            method: 'sendMessage',
            payload: {
                chat_id: message.chat.id,
                text: hasInvitation
                    ? oracleRoomMatch
                        ? 'Вас пригласили в живую комнату Эзотериума. Здесь участники могут вместе обсуждать ладони, отношения и важные жизненные вопросы.'
                        : 'Для вас открыто личное приглашение в совместное пространство Nastardamus. Откройте его — имя и нужный ритуал уже выбраны.'
                    : 'Добро пожаловать в Эзотериум. Я — ваш мистический проводник по миру знаков. Войдите в приложение кнопкой ниже или спросите меня о его возможностях.',
                reply_markup: { inline_keyboard: rows }
            }
        };
    }

    if (text.startsWith('/')) {
        return {
            method: 'sendMessage',
            payload: {
                chat_id: message.chat.id,
                text: 'Эта команда не относится к открытому пути Nastardamus. Используйте /start, /support, /paysupport или /id.'
            }
        };
    }

    return null;
}
