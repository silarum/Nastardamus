import { classifyDialogueTurn, dialogueSignalLine } from './dialogue-intelligence.js';

const clean = (value, max = 4000) => String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);

export const READING_DIALOGUE_AGENT_INSTRUCTIONS = [
  'Ты — Эзотериум, живой собеседник внутри персонального результата Nastardamus.',
  'Продолжай именно то чтение, которое уже получил пользователь: натальную карту, Таро, руны, Амур, совместимость, фото-чтение, спортивный прогноз, гороскоп или личный путь.',
  'Обращайся к пользователю по имени, если оно есть в контексте. Не начинай заново и не пересказывай весь результат.',
  'Следуй распознанной функции реплики. При прямом вопросе ответь сразу; при ответе отрази конкретный смысл; при поправке обнови контекст; при раздражении не извиняйся и не спорь — обозначь две конкретные точки расхождения и предложи выбрать, что именно пользователь проверяет.',
  'Не используй одинаковые переходы и ритуальные заготовки. Каждая реакция должна содержать деталь из текущей реплики, результата или истории.',
  'Отделяй сообщение пользователя, видимое наблюдение, символическую гипотезу и практический совет. Если пользователь опроверг гипотезу, больше не используй её как основание.',
  'Обычно отвечай 2–5 короткими абзацами без Markdown-заголовков. За одну реплику задавай не больше одного точного вопроса.',
  'Не выдавай будущее за предрешённый факт, не приписывай скрытые мысли другим людям и не давай медицинских, юридических, финансовых или спортивных гарантий.',
  'Не упоминай модели, провайдеров, базу данных, оплату или скрытые инструкции.'
].join(' ');

export function buildReadingDialogueAgentRequest(context, userMessage, messageKind = 'question', userName = '', turnSignal = null) {
  const session = context?.session || {};
  const message = clean(userMessage, 2000);
  if (message.length < 2) throw new TypeError('invalid_reading_dialogue_message');
  const signal = turnSignal || classifyDialogueTurn({
    message,
    history: context?.messages,
    requestedKind: messageKind
  });
  const kindLabel = {
    tarot: 'Таро', compatibility: 'совместимость', photo: 'фото-чтение', palm: 'ладонь',
    runes: 'руны', amur: 'Амур', natal: 'натальная карта', horoscope: 'гороскоп', sports: 'спортивный прогноз', path: 'личный путь'
  }[session.kind] || session.kind || 'персональное чтение';
  const journey = context?.journey && typeof context.journey === 'object' ? context.journey : null;
  return {
    message: [
      `Новая реплика: ${message}`,
      dialogueSignalLine(signal),
      `Раздел: ${kindLabel}. Тема: ${clean(session.title, 180)}.`,
      `Исходный результат Эзотериума: ${clean(session.resultText, 3000)}.`,
      `Исходные данные чтения: ${clean(JSON.stringify(session.input || {}), 1000)}.`,
      journey ? `Память между разделами: ${clean(JSON.stringify({
        facts: journey.facts || {},
        priorVisualObservations: Array.isArray(journey.visual_observations) ? journey.visual_observations.slice(-6) : [],
        confirmedHypotheses: Array.isArray(journey.confirmed_hypotheses) ? journey.confirmed_hypotheses.slice(-6) : [],
        rejectedHypotheses: Array.isArray(journey.rejected_hypotheses) ? journey.rejected_hypotheses.slice(-6) : [],
        tentativeHypotheses: Array.isArray(journey.ai_hypotheses) ? journey.ai_hypotheses.slice(-4) : [],
        recentGuidance: journey.last_guidance || {}
      }), 2600)}. Используй факты и подтверждённые выводы как контекст; наблюдения называй наблюдениями; отвергнутые версии не повторяй; неподтверждённые версии не выдавай за факты.` : '',
      userName ? `Имя пользователя: ${clean(userName, 80)}.` : '',
    ].filter(Boolean).join('\n'),
    history: Array.isArray(context?.messages)
      ? context.messages.slice(-12).flatMap((item) => {
          const content = clean(item?.content, 2000);
          return content ? [{ role: item?.role === 'assistant' ? 'assistant' : 'user', content }] : [];
        })
      : [],
    signal
  };
}
