export const DAILY_FREE_SERVICES = Object.freeze([
  Object.freeze({ id: 'tarot', title: 'Карты на успех', emoji: '🃏', screen: 'tarot', copy: 'Посмотрим, где сегодня твой шанс и какой шаг усилит результат.' }),
  Object.freeze({ id: 'tarot_relationship', title: 'Любовные похождения', emoji: '💞', screen: 'tarot', copy: 'Разберём притяжение, сомнения и ближайший поворот в отношениях.' }),
  Object.freeze({ id: 'palm_reading', title: 'Линии твоего пути', emoji: '🖐', screen: 'palm-reading', copy: 'Сначала реальная фотография ладони, затем живой разговор с Эзотериумом.' }),
  Object.freeze({ id: 'natal', title: 'Твоя начальная карта', emoji: '🌌', screen: 'natal', copy: 'Основа уже собрана из рождения — выбери тему для личной интерпретации.' }),
  Object.freeze({ id: 'rune_reading', title: 'Руна направления', emoji: 'ᚱ', screen: 'runes', copy: 'Один знак подскажет, на что опереться и чего сегодня не торопить.' })
]);

export function isDailyFreeService(serviceId) {
  return DAILY_FREE_SERVICES.some((service) => service.id === serviceId);
}

export function recommendedDailyServices(profile = {}, dateKey = '') {
  const interests = new Set(Array.isArray(profile.interests) ? profile.interests : []);
  const goals = new Set(Array.isArray(profile.goals) ? profile.goals : []);
  const score = new Map(DAILY_FREE_SERVICES.map((service, index) => [service.id, 20 - index]));
  const add = (id, points) => score.set(id, (score.get(id) || 0) + points);
  if (interests.has('business') || interests.has('money') || goals.has('income')) add('tarot', 18);
  if (interests.has('relationships') || goals.has('love') || goals.has('family')) add('tarot_relationship', 20);
  if (interests.has('spirituality') || interests.has('growth') || goals.has('growth')) {
    add('natal', 13);
    add('palm_reading', 10);
    add('rune_reading', 8);
  }
  const rotation = [...String(dateKey || '')].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return DAILY_FREE_SERVICES.map((service, index) => ({
    ...service,
    score: (score.get(service.id) || 0) + ((rotation + index * 7) % 5)
  })).sort((left, right) => right.score - left.score || left.id.localeCompare(right.id));
}

export function journeyFactsFromProfile(profile = {}) {
  return {
    gender: ['male', 'female', 'unspecified'].includes(profile.gender) ? profile.gender : 'unspecified',
    birthDate: /^\d{4}-\d{2}-\d{2}$/.test(String(profile.birthDate || '')) ? profile.birthDate : null,
    birthTime: /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(profile.birthTime || '')) && profile.birthTimeKnown === true ? profile.birthTime : null,
    birthTimeKnown: profile.birthTimeKnown === true,
    city: String(profile.city || '').trim().slice(0, 120),
    interests: Array.isArray(profile.interests) ? profile.interests.slice(0, 12) : [],
    goals: Array.isArray(profile.goals) ? profile.goals.slice(0, 8) : []
  };
}
