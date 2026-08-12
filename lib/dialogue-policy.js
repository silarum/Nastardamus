export const DIALOGUE_SECTION_TITLES = Object.freeze({
  personal: 'Общие вопросы к чтению',
  tarot: 'Таро',
  runes: 'Руны',
  palm: 'Хиромантия',
  natal: 'Натальная карта',
  horoscope: 'Гороскоп дня',
  sports: 'Спортивный аналитик',
  path: 'Мой путь',
  amur: 'Амур',
  compatibility: 'Совместимость',
  photo: 'Чтение по фотографии',
  solo: 'Личная комната',
  pair: 'Комната для двоих',
  group: 'Групповая комната'
});

export const DIALOGUE_DEFAULT_CATALOG = Object.freeze(Object.fromEntries(
  Object.entries(DIALOGUE_SECTION_TITLES).map(([id, title]) => [id, Object.freeze({
    id,
    title,
    enabled: true,
    sectionFree: true,
    includedQuestions: id === 'group' ? 5 : (id === 'sports' ? 2 : 3),
    extraQuestionPrice: id === 'sports' ? 5 : 0.1
  })])
));

const READING_KIND_TO_SECTION = Object.freeze({
  tarot: 'tarot',
  rune: 'runes',
  runes: 'runes',
  rune_reading: 'runes',
  palm: 'palm',
  palm_reading: 'palm',
  natal: 'natal',
  daily_horoscope: 'horoscope',
  horoscope: 'horoscope',
  sports: 'sports',
  sports_forecast: 'sports',
  path: 'path',
  path_consultation: 'path',
  amur: 'amur',
  amur_compatibility: 'amur',
  compatibility: 'compatibility',
  photo: 'photo',
  photo_energy: 'photo',
  photo_damage: 'photo',
  photo_compatibility: 'photo'
});

export function dialogueSectionForReading(source) {
  const kind = String(source?.session?.kind || source?.kind || source?.feature || '').trim().toLowerCase();
  return READING_KIND_TO_SECTION[kind] || 'personal';
}

export function normalizeDialogueCatalog(catalog) {
  const source = catalog && typeof catalog === 'object' ? catalog : {};
  return Object.fromEntries(Object.entries(DIALOGUE_DEFAULT_CATALOG).map(([id, fallback]) => {
    const item = source[id] && typeof source[id] === 'object' ? source[id] : {};
    return [id, {
      ...fallback,
      ...item,
      id,
      title: String(item.title || fallback.title).trim().slice(0, 100),
      includedQuestions: Math.max(0, Math.min(1000, Number.parseInt(item.includedQuestions, 10) || 0)),
      sectionFree: item.sectionFree !== false,
      extraQuestionPrice: Math.max(0, Math.round((Number(item.extraQuestionPrice) || 0) * 100) / 100),
      enabled: item.enabled !== false
    }];
  }));
}
