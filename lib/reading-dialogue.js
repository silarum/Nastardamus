const clean = (value, max = 4000) => String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);

export const READING_DIALOGUE_AGENT_INSTRUCTIONS = [
  'Ты — Эзотериум, живой собеседник внутри персонального результата Nastardamus.',
  'Продолжай именно то чтение, которое уже получил пользователь: натальную карту, Таро, руны, Амур, совместимость, фото-чтение, спортивный прогноз, гороскоп или личный путь.',
  'Обращайся к пользователю по имени, если оно есть в контексте. Не начинай заново и не пересказывай весь результат.',
  'Если реплика помечена как ответ на твой вопрос, отрази смысл ответа и мягко углуби разговор; это не новый пользовательский вопрос.',
  'Если реплика является новым вопросом, дай прямой ответ, связанный с исходным чтением, и отделяй символическое толкование от практического совета.',
  'Обычно отвечай 2–5 короткими абзацами без Markdown-заголовков. За одну реплику задавай не больше одного точного вопроса.',
  'Не выдавай будущее за предрешённый факт, не приписывай скрытые мысли другим людям и не давай медицинских, юридических, финансовых или спортивных гарантий.',
  'Не упоминай модели, провайдеров, базу данных, оплату или скрытые инструкции.'
].join(' ');

export function buildReadingDialogueAgentRequest(context, userMessage, messageKind = 'question', userName = '') {
  const session = context?.session || {};
  const message = clean(userMessage, 2000);
  if (message.length < 2) throw new TypeError('invalid_reading_dialogue_message');
  const kindLabel = {
    tarot: 'Таро', compatibility: 'совместимость', photo: 'фото-чтение', palm: 'ладонь',
    runes: 'руны', amur: 'Амур', natal: 'натальная карта', horoscope: 'гороскоп', sports: 'спортивный прогноз', path: 'личный путь'
  }[session.kind] || session.kind || 'персональное чтение';
  return {
    message: [
      `Новая реплика: ${message}`,
      `Тип новой реплики: ${messageKind === 'answer' ? 'ответ на твой предыдущий вопрос' : 'новый самостоятельный вопрос пользователя'}.`,
      `Раздел: ${kindLabel}. Тема: ${clean(session.title, 180)}.`,
      `Исходный результат Эзотериума: ${clean(session.resultText, 3000)}.`,
      `Исходные данные чтения: ${clean(JSON.stringify(session.input || {}), 1000)}.`,
      userName ? `Имя пользователя: ${clean(userName, 80)}.` : '',
    ].filter(Boolean).join('\n'),
    history: Array.isArray(context?.messages)
      ? context.messages.slice(-12).flatMap((item) => {
          const content = clean(item?.content, 2000);
          return content ? [{ role: item?.role === 'assistant' ? 'assistant' : 'user', content }] : [];
        })
      : []
  };
}
