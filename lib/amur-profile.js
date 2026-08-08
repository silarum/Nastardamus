export const AMUR_QUESTIONS = Object.freeze([
  { id: 'intent', title: 'Что вы ищете сейчас?', options: [['love', 'Отношения'], ['friendship', 'Дружбу'], ['dialogue', 'Общение']] },
  { id: 'pace', title: 'Какой темп близости вам подходит?', options: [['slow', 'Медленный'], ['balanced', 'Постепенный'], ['spark', 'Быстрый отклик']] },
  { id: 'energy', title: 'Где вы восстанавливаете силы?', options: [['quiet', 'В тишине'], ['people', 'С людьми'], ['motion', 'В движении']] },
  { id: 'conflict', title: 'Что важно во время разногласия?', options: [['pause', 'Пауза'], ['talk', 'Разговор сразу'], ['facts', 'Факты и план']] },
  { id: 'affection', title: 'Как вы чаще проявляете тепло?', options: [['words', 'Словами'], ['care', 'Заботой'], ['time', 'Общим временем']] },
  { id: 'horizon', title: 'Как вы смотрите на будущее?', options: [['plan', 'Люблю план'], ['open', 'Оставляю открытым'], ['mix', 'Планирую гибко']] },
  { id: 'boundary', title: 'Какая граница особенно важна?', options: [['privacy', 'Личное пространство'], ['honesty', 'Прямота'], ['reliability', 'Надёжность']] }
]);

export const AMUR_GAME_QUESTIONS = Object.freeze([
  'Какой маленький жест помогает вам почувствовать внимание?',
  'Что для вас означает безопасный разговор?',
  'Как выглядит хороший совместный вечер без идеального сценария?',
  'О какой границе вы предпочитаете договариваться заранее?',
  'Что вы хотели бы узнать о человеке не из анкеты, а в живом разговоре?'
]);

function cleanAnswers(value = {}) {
  return Object.fromEntries(AMUR_QUESTIONS.flatMap((question) => {
    const answer = String(value[question.id] || '');
    return question.options.some(([id]) => id === answer) ? [[question.id, answer]] : [];
  }));
}

export function buildAmurProfile({ interests = [], goals = [], answers = {}, zodiac = '', intent = '' } = {}) {
  const clean = cleanAnswers(answers);
  const completeness = Math.round((Object.keys(clean).length / AMUR_QUESTIONS.length) * 100);
  return {
    answers: clean,
    interests: [...new Set(interests.map(String))].slice(0, 12),
    goals: [...new Set(goals.map(String))].slice(0, 8),
    zodiac: String(zodiac || '').slice(0, 30),
    intent: String(intent || clean.intent || 'dialogue').slice(0, 30),
    completeness,
    discoverable: completeness === 100
  };
}

export function amurCompatibility(first, second) {
  const left = buildAmurProfile(first);
  const right = buildAmurProfile(second);
  const questionScores = AMUR_QUESTIONS.map(({ id }) => {
    if (!left.answers[id] || !right.answers[id]) return null;
    return left.answers[id] === right.answers[id] ? 1 : ['pace', 'conflict', 'boundary'].includes(id) ? 0.35 : 0.55;
  }).filter((value) => value !== null);
  const sharedInterests = left.interests.filter((value) => right.interests.includes(value));
  const sharedGoals = left.goals.filter((value) => right.goals.includes(value));
  const base = questionScores.length ? questionScores.reduce((sum, value) => sum + value, 0) / questionScores.length : 0.5;
  const score = Math.round(Math.min(96, Math.max(24, base * 70 + sharedInterests.length * 5 + sharedGoals.length * 4)));
  return { score, sharedInterests, sharedGoals, protectedGame: AMUR_GAME_QUESTIONS };
}
