const DAY_ARCHETYPES = [
  { name: 'Солнце', quality: 'свет и вдохновение', symbol: '☉' },
  { name: 'Луна', quality: 'интуиция и начало', symbol: '☽' },
  { name: 'Марс', quality: 'действие и решительность', symbol: '♂' },
  { name: 'Меркурий', quality: 'общение и обмен', symbol: '☿' },
  { name: 'Юпитер', quality: 'рост и расширение', symbol: '♃' },
  { name: 'Венера', quality: 'любовь и красота', symbol: '♀' },
  { name: 'Сатурн', quality: 'структура и дисциплина', symbol: '♄' }
];

const NUMBER_ENERGIES = {
  1: { title: 'Начало', focus: 'инициатива и первый шаг', color: ['#56238a', '#b85a42'], favorable: 'начинать, выбирать направление, действовать самостоятельно', avoid: 'ждать идеального момента и распыляться' },
  2: { title: 'Равновесие', focus: 'партнёрство и внимательный диалог', color: ['#233b83', '#8c4e96'], favorable: 'слушать, договариваться, уточнять ожидания', avoid: 'давить, торопить ответ и замалчивать обиду' },
  3: { title: 'Выражение', focus: 'творчество и ясные слова', color: ['#75427b', '#c47b3b'], favorable: 'создавать, выступать, делиться идеями', avoid: 'обещать больше, чем можно выполнить' },
  4: { title: 'Основа', focus: 'порядок и надёжная система', color: ['#29475f', '#6f6240'], favorable: 'планировать, завершать, укреплять привычки', avoid: 'цепляться за порядок, который уже не помогает' },
  5: { title: 'Движение', focus: 'перемены и гибкость', color: ['#175d72', '#7451a0'], favorable: 'пробовать, менять маршрут, вести переговоры', avoid: 'рисковать без проверки фактов' },
  6: { title: 'Гармония', focus: 'забота и ответственность', color: ['#7b365e', '#ad713a'], favorable: 'завершать старое, говорить с близкими, творить', avoid: 'брать на себя чужие обязательства' },
  7: { title: 'Глубина', focus: 'наблюдение и внутреннее исследование', color: ['#28336f', '#603a80'], favorable: 'анализировать, учиться, оставлять место тишине', avoid: 'уходить в изоляцию и бесконечные сомнения' },
  8: { title: 'Сила', focus: 'результат и материальная ясность', color: ['#563c24', '#8d4e38'], favorable: 'считать ресурсы, принимать деловые решения, держать границы', avoid: 'путать контроль с уверенностью' },
  9: { title: 'Завершение', focus: 'освобождение и широкий взгляд', color: ['#51326f', '#9b4b67'], favorable: 'подводить итоги, отпускать лишнее, помогать осознанно', avoid: 'начинать новое из чувства вины' }
};

export const PERSONAL_CATEGORIES = {
  work: { label: 'Работа', color: '#768de8' },
  love: { label: 'Любовь', color: '#e879a5' },
  health: { label: 'Здоровье', color: '#63bf9d' },
  growth: { label: 'Личное развитие', color: '#b17ce4' },
  finance: { label: 'Финансы', color: '#d8ad58' },
  home: { label: 'Дом', color: '#c58465' },
  travel: { label: 'Путешествия', color: '#5fb9ca' },
  other: { label: 'Другое', color: '#9a92a5' }
};

export const PERSONAL_PRIORITIES = {
  low: { label: 'Низкий', mark: '·' },
  medium: { label: 'Средний', mark: '~' },
  high: { label: 'Высокий', mark: '!' }
};

export const INSPIRATION_PHRASES = [
  'Один честный шаг сегодня важнее десяти безупречных планов.',
  'Сначала выбери главное — остальное найдёт своё место.',
  'Тишина утра помогает услышать собственное решение.',
  'Не спеши заполнять день: оставь пространство для живого.',
  'То, что названо словами, уже становится понятнее.',
  'Маленькое завершение возвращает больше силы, чем новый список дел.',
  'Сегодня полезно идти не быстрее, а точнее.',
  'Порядок начинается с одного предмета и одного решения.',
  'Обрати внимание на то, после чего становится легче дышать.',
  'Выбери действие, которое поддержит тебя и завтра.',
  'Не всё требует ответа немедленно.',
  'Уверенность растёт там, где появляется ясная граница.',
  'Сделай место для разговора, который давно откладывался.',
  'Сегодня можно быть бережным и при этом решительным.',
  'Начни с того, что зависит только от тебя.',
  'Ритм дня складывается из простых повторяемых действий.',
  'Один приоритет освобождает внимание от лишнего шума.',
  'Проверь не только план, но и цену, которую ты за него платишь.',
  'Иногда лучший шаг — уточнить, а не додумывать.',
  'Сохрани силы для действительно важного разговора.',
  'Завершённое дело освобождает место для нового смысла.',
  'Сегодня прислушайся к тому, что возвращает устойчивость.',
  'Не сравнивай свой темп с чужим календарём.',
  'Ясное «нет» может защитить важное «да».',
  'Пусть план помогает жить, а не превращается в ещё одно давление.',
  'То, что повторяется, заслуживает отдельного внимания.',
  'Сначала восстанови опору, затем принимай решение.',
  'Заметь, какое дело ты откладываешь из-за чужих ожиданий.',
  'Сегодня достаточно сделать главное хорошо.',
  'Оставь вечером минуту, чтобы увидеть пройденный путь.',
  'Не бойся упростить задачу до первого выполнимого шага.',
  'Внимание — это ресурс. Отдай его тому, что хочешь укрепить.',
  'Пауза перед ответом тоже может быть действием.',
  'Самое важное редко требует суеты.',
  'Проверь, совпадает ли твой план с твоими настоящими ценностями.',
  'День становится яснее, когда у него есть один внутренний ориентир.',
  'Позволь себе изменить решение, если появились новые факты.',
  'Сделай сегодня что-то, за что завтра скажешь себе спасибо.',
  'Вечерний итог нужен не для оценки, а для понимания.',
  'Пусть сегодняшняя дисциплина будет формой заботы о себе.'
];

function localDate(value = new Date()) {
  if (value instanceof Date) return new Date(value.getTime());
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError('invalid_date');
  return date;
}

export function personalDateKey(value = new Date()) {
  const date = localDate(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function numerologyNumber(value = new Date()) {
  let total = personalDateKey(value).replace(/\D/g, '').split('').reduce((sum, digit) => sum + Number(digit), 0);
  while (total > 9) total = String(total).split('').reduce((sum, digit) => sum + Number(digit), 0);
  return total || 9;
}

export function approximateMoonPhase(value = new Date()) {
  const date = localDate(value);
  const reference = Date.UTC(2000, 0, 6, 18, 14);
  const lunarDays = ((date.getTime() - reference) / 86_400_000) % 29.53058867;
  const age = lunarDays < 0 ? lunarDays + 29.53058867 : lunarDays;
  if (age < 1.85 || age >= 27.68) return { label: 'Новолуние', symbol: '●', note: 'тихое начало цикла' };
  if (age < 7.38) return { label: 'Растущий серп', symbol: '◔', note: 'набор движения' };
  if (age < 9.23) return { label: 'Первая четверть', symbol: '◐', note: 'проверка намерения действием' };
  if (age < 14.77) return { label: 'Растущая Луна', symbol: '◕', note: 'развитие начатого' };
  if (age < 16.61) return { label: 'Полнолуние', symbol: '○', note: 'ясность и кульминация' };
  if (age < 22.15) return { label: 'Убывающая Луна', symbol: '◕', note: 'осмысление результата' };
  if (age < 24) return { label: 'Последняя четверть', symbol: '◑', note: 'завершение лишнего' };
  return { label: 'Убывающий серп', symbol: '◔', note: 'отдых и освобождение' };
}

export function dailyEnergy(value = new Date()) {
  const date = localDate(value);
  const number = numerologyNumber(date);
  const numberEnergy = NUMBER_ENERGIES[number];
  const archetype = DAY_ARCHETYPES[date.getDay()];
  const moon = approximateMoonPhase(date);
  return {
    date: personalDateKey(date),
    number,
    title: numberEnergy.title,
    symbol: archetype.symbol,
    archetype,
    moon,
    colors: numberEnergy.color,
    short: `Сегодня — число ${number}. ${numberEnergy.title}: ${numberEnergy.focus}.`,
    full: `Число ${number} настраивает день на ${numberEnergy.focus}. ${archetype.name} добавляет тему «${archetype.quality}». ${moon.label} — символический фон про ${moon.note}. Сохрани равновесие между планом и живым откликом: выбери одно главное действие и оставь место для уточнений.`,
    favorable: numberEnergy.favorable,
    avoid: numberEnergy.avoid,
    recommendation: `Рекомендация: выбери один выполнимый шаг в теме «${numberEnergy.title.toLocaleLowerCase('ru')}» и заверши его до вечера.`
  };
}

export function timeGreeting(value = new Date()) {
  const hour = localDate(value).getHours();
  if (hour >= 6 && hour < 12) return 'Доброе утро';
  if (hour >= 12 && hour < 18) return 'Добрый день';
  if (hour >= 18) return 'Добрый вечер';
  return 'Добрая ночь';
}

export function personalGreeting(name, value = new Date()) {
  const date = localDate(value);
  const dateKey = personalDateKey(date);
  const seed = [...dateKey].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const phrase = INSPIRATION_PHRASES[seed % INSPIRATION_PHRASES.length];
  const day = new Intl.DateTimeFormat('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }).format(date);
  return `${timeGreeting(date)}, ${String(name || 'Искатель').trim() || 'Искатель'}. Сегодня ${day}. ${phrase}`;
}

function cleanText(value, maxLength) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function validDateKey(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

export function normalizePersonalEvent(value = {}, { allowPast = false, today = personalDateKey() } = {}) {
  const title = cleanText(value.title, 100);
  const date = String(value.date || '');
  const time = String(value.time || '');
  const category = PERSONAL_CATEGORIES[value.category] ? value.category : 'other';
  const priority = PERSONAL_PRIORITIES[value.priority] ? value.priority : 'medium';
  if (title.length < 3) throw new TypeError('event_title_too_short');
  if (!validDateKey(date) || (!allowPast && date < today)) throw new TypeError('event_date_invalid');
  if (time && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new TypeError('event_time_invalid');
  return {
    eventId: String(value.eventId || ''),
    title,
    date,
    time,
    description: cleanText(value.description, 500),
    category,
    priority,
    status: ['active', 'completed', 'archived'].includes(value.status) ? value.status : 'active',
    reminder: Boolean(value.reminder && time),
    goalId: String(value.goalId || ''),
    analysis: value.analysis && typeof value.analysis === 'object' ? value.analysis : null,
    enrichments: value.enrichments && typeof value.enrichments === 'object' ? value.enrichments : {}
  };
}

export function normalizePersonalGoal(value = {}) {
  const title = cleanText(value.title, 100);
  const category = PERSONAL_CATEGORIES[value.category] ? value.category : 'other';
  const deadline = String(value.deadline || '');
  if (title.length < 3) throw new TypeError('goal_title_too_short');
  if (deadline && !validDateKey(deadline)) throw new TypeError('goal_deadline_invalid');
  return {
    goalId: String(value.goalId || ''),
    title,
    description: cleanText(value.description, 500),
    category,
    deadline,
    status: ['active', 'completed', 'archived'].includes(value.status) ? value.status : 'active'
  };
}

export function normalizePersonalTask(value = {}) {
  const title = cleanText(value.title, 100);
  if (title.length < 3) throw new TypeError('task_title_too_short');
  return {
    taskId: String(value.taskId || ''),
    goalId: String(value.goalId || ''),
    title,
    description: cleanText(value.description, 500),
    recurrence: ['none', 'daily', 'weekly', 'monthly'].includes(value.recurrence) ? value.recurrence : 'none',
    scheduledDate: validDateKey(value.scheduledDate) ? String(value.scheduledDate) : personalDateKey(),
    completedDates: Array.isArray(value.completedDates)
      ? [...new Set(value.completedDates.map(String).filter(validDateKey))].slice(-400)
      : []
  };
}

export function taskDueOn(task, value = new Date()) {
  const date = localDate(value);
  const key = personalDateKey(date);
  const scheduled = String(task?.scheduledDate || key);
  if (scheduled > key) return false;
  if (task?.recurrence === 'daily') return true;
  const origin = new Date(`${scheduled}T12:00:00`);
  if (Number.isNaN(origin.getTime())) return true;
  if (task?.recurrence === 'weekly') return origin.getDay() === date.getDay();
  if (task?.recurrence === 'monthly') return origin.getDate() === date.getDate();
  return scheduled === key;
}

export function goalProgress(goalId, tasks = [], value = new Date()) {
  const dateKey = personalDateKey(value);
  const relevant = tasks.filter((task) => task.goalId === goalId && taskDueOn(task, value));
  const completed = relevant.filter((task) => task.completedDates?.includes(dateKey)).length;
  return {
    completed,
    total: relevant.length,
    percent: relevant.length ? Math.round((completed / relevant.length) * 100) : 0
  };
}

export function analyzePersonalEvent(event, energy = dailyEnergy(event?.date || new Date())) {
  const category = PERSONAL_CATEGORIES[event?.category] || PERSONAL_CATEGORIES.other;
  const priority = PERSONAL_PRIORITIES[event?.priority] || PERSONAL_PRIORITIES.medium;
  const intensity = event?.priority === 'high'
    ? 'Здесь особенно важно заранее определить границы и желаемый результат.'
    : event?.priority === 'low'
      ? 'Событию полезно оставить лёгкость и не перегружать его ожиданиями.'
      : 'Достаточно ясного плана и небольшого запаса времени.';
  return {
    energy: `Число ${energy.number} и ${energy.archetype.name} создают для темы «${category.label}» фон про ${energy.title.toLocaleLowerCase('ru')} и ${energy.archetype.quality}.`,
    opportunities: `Событие может помочь перевести намерение в конкретную договорённость или следующий шаг. ${intensity}`,
    risks: `Риск дня — ${energy.avoid}. Приоритет «${priority.label.toLocaleLowerCase('ru')}» не должен превращаться в внутреннее давление.`,
    recommendation: `Перед событием запиши один желаемый результат и одно условие, которым не готов поступиться.`,
    question: 'Что ты чувствуешь, когда слышишь такое толкование?'
  };
}

export function nextPersonalEvents(events = [], value = new Date(), limit = 3) {
  const today = personalDateKey(value);
  return [...events]
    .filter((event) => event.status === 'active' && event.date >= today)
    .sort((a, b) => `${a.date}T${a.time || '23:59'}`.localeCompare(`${b.date}T${b.time || '23:59'}`))
    .slice(0, limit);
}
