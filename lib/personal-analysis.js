import { ESOTERIUM_SYSTEM_PROMPT } from './esoterium.js';
import { PERSONAL_CATEGORIES, PERSONAL_PRIORITIES, dailyEnergy } from './personal-space.js';

export const PERSONAL_ANALYSIS_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['energy', 'opportunities', 'risks', 'recommendation', 'question'],
  properties: {
    energy: { type: 'string' },
    opportunities: { type: 'string' },
    risks: { type: 'string' },
    recommendation: { type: 'string' },
    question: { type: 'string' }
  }
});

function cleanText(value, maxLength) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function recentContext(history, eventId) {
  const events = Array.isArray(history?.events)
    ? history.events
      .filter((item) => item?.eventId !== eventId)
      .slice(0, 6)
      .map((item) => ({
        title: cleanText(item?.title, 100),
        date: cleanText(item?.date, 10),
        category: cleanText(item?.category, 24),
        status: cleanText(item?.status, 24),
        priorRecommendation: cleanText(item?.analysis?.recommendation, 240)
      }))
    : [];
  const goals = Array.isArray(history?.goals)
    ? history.goals
      .filter((item) => item?.status === 'active')
      .slice(0, 5)
      .map((item) => ({ title: cleanText(item?.title, 100), category: cleanText(item?.category, 24) }))
    : [];
  const reflections = Array.isArray(history?.checkins)
    ? history.checkins
      .filter((item) => item?.eveningReflection?.text)
      .slice(0, 3)
      .map((item) => ({
        date: cleanText(item?.date, 10),
        text: cleanText(item?.eveningReflection?.text, 300)
      }))
    : [];
  return { events, goals, reflections };
}

export function buildPersonalAnalysisMessages({ event, name = 'Искатель', history = {} }) {
  const category = PERSONAL_CATEGORIES[event.category] || PERSONAL_CATEGORIES.other;
  const priority = PERSONAL_PRIORITIES[event.priority] || PERSONAL_PRIORITIES.medium;
  const energy = dailyEnergy(`${event.date}T12:00:00`);
  const context = recentContext(history, event.eventId);
  return [
    {
      role: 'system',
      content: [
        ESOTERIUM_SYSTEM_PROMPT,
        '',
        '# Режим «Мой путь»',
        'Дай цельный, практичный разбор одного календарного события. Факты календаря отделяй от символического фона.',
        'Историю используй только для аккуратного продолжения уже заметных тем. Не объявляй закономерность, если данных недостаточно, и не повторяй прежнюю рекомендацию механически.',
        'В каждом поле 1–3 коротких предложения. Рекомендация должна быть выполнима до события или в течение суток. Заверши одним живым вопросом, на который человек может ответить себе.',
        'Верни только валидный JSON-объект без Markdown и текста снаружи. Используй в точности эту JSON Schema:',
        JSON.stringify(PERSONAL_ANALYSIS_SCHEMA)
      ].join('\n')
    },
    {
      role: 'user',
      content: [
        `Имя: ${cleanText(name, 80) || 'Искатель'}.`,
        `Событие: ${event.title}. Дата: ${event.date}${event.time ? `, время: ${event.time}` : ''}.`,
        `Категория: ${category.label}. Приоритет: ${priority.label}.`,
        event.description ? `Описание пользователя: ${event.description}.` : 'Описание не добавлено.',
        `Символический фон даты: число ${energy.number}, тема «${energy.title}», ${energy.archetype.name}, ${energy.moon.label}.`,
        `Недавний контекст «Моего пути»: ${JSON.stringify(context)}.`
      ].join(' ')
    }
  ];
}

export function parsePersonalAnalysis(value) {
  const source = String(value || '')
    .trim()
    .replace(/^```(?:json)?\s*/iu, '')
    .replace(/\s*```$/u, '')
    .trim();
  let parsed;
  try {
    parsed = JSON.parse(source);
  } catch {
    throw new TypeError('invalid_personal_analysis');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new TypeError('invalid_personal_analysis');
  }
  const keys = PERSONAL_ANALYSIS_SCHEMA.required;
  if (Object.keys(parsed).some((key) => !keys.includes(key))) {
    throw new TypeError('invalid_personal_analysis');
  }
  const analysis = Object.fromEntries(keys.map((key) => [key, cleanText(parsed[key], 900)]));
  if (keys.some((key) => analysis[key].length < 3)) {
    throw new TypeError('invalid_personal_analysis');
  }
  return analysis;
}
