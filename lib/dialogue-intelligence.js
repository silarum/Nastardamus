const clean = (value, max = 2000) => String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);

const REPAIR_PATTERN = /(?:не\s+(?:понял|поняла|понимаешь|понимает|услышал|услышала)|ты\s+(?:вообще\s+)?(?:не\s+)?понимаешь|я\s+не\s+об\s+этом|ответь\s+(?:на\s+)?вопрос|опять\s+(?:шаблон|не\s+то)|не\s+туда|мимо|бред|чушь|туп(?:ой|ая|о)?|идиот|бот\b|говн|дерьм|халуп)/iu;
const CORRECTION_PATTERN = /(?:^|[.!?]\s*)(?:нет(?:[,.!?\s]|$)|неверно(?:[,.!?\s]|$)|не\s+так(?:[,.!?\s]|$))|(?:я\s+(?:имел|имела)\s+в\s+виду|поправ(?:ка|лю)|уточню|точнее)/iu;
const CLOSING_PATTERN = /(?:хватит|останов(?:ись|и)|закончим|завершим|до\s+свидания|пока\b|не\s+хочу\s+продолжать)/iu;
const GRATITUDE_PATTERN = /(?:спасибо|благодар|теперь\s+понятно|теперь\s+ясно|понял(?:а)?\b|хорошо\b|ладно\b|ок(?:ей)?\b)/iu;
const GREETING_PATTERN = /^(?:привет|здравствуй(?:те)?|доброе\s+(?:утро|день|вечер)|салют)[!. ]*$/iu;
const QUESTION_WORD_PATTERN = /(?:^|[.!?]\s*)(?:что|кто|где|когда|куда|откуда|почему|зачем|как|какой|какая|какие|сколько|можно\s+ли|стоит\s+ли|будет\s+ли|получится\s+ли|смогу\s+ли|поменяю\s+ли|скаж(?:и|ите)|подскаж(?:и|ите)|объясн(?:и|ите)|покаж(?:и|ите)|разбер(?:и|ите)|посмотр(?:и|ите)|истолкуй(?:те)?|сравн(?:и|ите))/iu;

function lastAssistantMessage(history) {
  if (!Array.isArray(history)) return '';
  for (let index = history.length - 1; index >= 0; index -= 1) {
    if (history[index]?.role === 'assistant') return clean(history[index]?.content, 2000);
  }
  return '';
}

/**
 * Classifies the conversational function of a turn before quota and prompt logic.
 * The client hint is deliberately not trusted: a correction or recovery turn must
 * never become paid merely because a toggle was left in the wrong state.
 */
export function classifyDialogueTurn({ message, history = [], requestedKind = '', guided = false } = {}) {
  const text = clean(message);
  if (text.length < 2) throw new TypeError('invalid_dialogue_message');
  if (guided || requestedKind === 'guided') {
    return { intent: 'guided', messageKind: 'guided', billable: false, hasPriorQuestion: false };
  }

  const priorAssistant = lastAssistantMessage(history);
  const hasPriorQuestion = /\?/u.test(priorAssistant);
  let intent = 'statement';
  let messageKind = 'answer';

  if (REPAIR_PATTERN.test(text)) intent = 'repair';
  else if (CORRECTION_PATTERN.test(text)) intent = 'correction';
  else if (CLOSING_PATTERN.test(text)) intent = 'closing';
  else if (GREETING_PATTERN.test(text)) intent = 'greeting';
  else if (GRATITUDE_PATTERN.test(text) && text.length < 140 && !/\?/u.test(text)) intent = 'gratitude';
  else if (/\?/u.test(text) || QUESTION_WORD_PATTERN.test(text)) {
    intent = 'direct_question';
    messageKind = 'question';
  } else if (hasPriorQuestion || requestedKind === 'answer') intent = 'clarification_answer';

  return {
    intent,
    messageKind,
    billable: messageKind === 'question',
    hasPriorQuestion
  };
}

export function dialogueTurnGuidance(signal = {}) {
  const guidance = {
    guided: 'Это служебное открытие разговора. Начни содержательно по теме и передай слово конкретному человеку одним вопросом.',
    repair: 'Пользователь проверяет, насколько точно его услышали, или сопротивляется направлению ответа. Не извиняйся, не соглашайся механически и не комментируй тон. Спокойно перехвати разговор: назови две конкретные точки возможного расхождения из истории и спроси, какая из них вызвала реакцию. Если исходный вопрос уже однозначен, сначала дай на него короткий прямой ответ, а затем проверь точность одним острым вопросом. Не продолжай прежнюю анкету.',
    correction: 'Пользователь исправляет контекст. Новая формулировка важнее старой: явно учти поправку и перестрой ответ. Не защищай прежнее толкование.',
    closing: 'Уважай желание остановиться. Ответь кратко, подведи один полезный итог и не задавай новый вопрос.',
    greeting: 'Ответь естественно и коротко, затем предложи назвать тему без списка услуг.',
    gratitude: 'Отреагируй по-человечески и кратко. Не запускай новый опрос; продолжение предложи только если оно уместно.',
    direct_question: 'Это самостоятельный вопрос. Ответь на него уже в первой смысловой фразе, затем объясни связь с доступными наблюдениями и контекстом. Уточняй только если без уточнения ответ действительно невозможен.',
    clarification_answer: 'Это ответ на предыдущий вопрос. Покажи, какую конкретную деталь ты понял, свяжи её с текущим чтением и продвинь разговор. Не задавай тот же вопрос другими словами.',
    statement: 'Это мысль или сообщение пользователя. Отреагируй на её конкретный смысл; не превращай реплику в анкету. Один вопрос допустим только если он естественно двигает разговор.'
  };
  return guidance[signal.intent] || guidance.statement;
}

export function dialogueSignalLine(signal = {}) {
  return [
    `Распознанная функция реплики: ${signal.intent || 'statement'}.`,
    `Учёт лимита: ${signal.billable ? 'самостоятельный вопрос' : 'продолжение разговора; не новый платный вопрос'}.`,
    dialogueTurnGuidance(signal)
  ].join(' ');
}
