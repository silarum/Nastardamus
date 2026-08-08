const DAY_MS = 86_400_000;

export const ELDER_FUTHARK = Object.freeze([
  { glyph: 'ᚠ', name: 'Феху', family: 'Фрейр', keywords: ['ресурс', 'движение'], upright: 'Ресурс просит движения: используйте то, что уже доступно.', reversed: 'Утечка сил предлагает пересмотреть цену желания.' },
  { glyph: 'ᚢ', name: 'Уруз', family: 'Фрейр', keywords: ['сила', 'восстановление'], upright: 'Живая сила возвращается через тело и честный темп.', reversed: 'Не тратьте волю на доказательство собственной силы.' },
  { glyph: 'ᚦ', name: 'Турисаз', family: 'Фрейр', keywords: ['граница', 'проверка'], upright: 'Остановитесь у порога и проверьте последствия шага.', reversed: 'Защита стала слишком жёсткой; различите опасность и привычную тревогу.' },
  { glyph: 'ᚨ', name: 'Ансуз', family: 'Фрейр', keywords: ['слово', 'понимание'], upright: 'Важный ответ приходит через точный вопрос и внимательное слушание.', reversed: 'Шум, недосказанность или чужое мнение искажают послание.' },
  { glyph: 'ᚱ', name: 'Райдо', family: 'Фрейр', keywords: ['путь', 'согласование'], upright: 'Движение станет верным, когда внутренний ритм совпадёт с маршрутом.', reversed: 'Маршрут требует пересмотра; не ускоряйтесь без направления.' },
  { glyph: 'ᚲ', name: 'Кеназ', family: 'Фрейр', keywords: ['ясность', 'мастерство'], upright: 'Свет падает на навык, который пора применить открыто.', reversed: 'Неясность просит обучения и более честного взгляда на ограничения.' },
  { glyph: 'ᚷ', name: 'Гебо', family: 'Фрейр', keywords: ['обмен', 'партнёрство'], upright: 'Равный обмен укрепляет связь и сохраняет свободу обоих.', reversed: 'Гебо не переворачивается: проверьте добровольность и равновесие обмена.' },
  { glyph: 'ᚹ', name: 'Вуньо', family: 'Фрейр', keywords: ['радость', 'согласие'], upright: 'Радость подтверждает согласованность выбранного пути.', reversed: 'Отложенная радость показывает, где вы живёте только ожиданиями.' },
  { glyph: 'ᚺ', name: 'Хагалаз', family: 'Хеймдалль', keywords: ['перестройка', 'свобода'], upright: 'Внешний сдвиг разрушает форму, которая уже не выдерживает правду.', reversed: 'Хагалаз не переворачивается: сохраняйте опору внутри неизбежной перемены.' },
  { glyph: 'ᚾ', name: 'Наутиз', family: 'Хеймдалль', keywords: ['необходимость', 'терпение'], upright: 'Ограничение показывает настоящую потребность и учит точности.', reversed: 'Сопротивление необходимости расходует больше сил, чем сама задача.' },
  { glyph: 'ᛁ', name: 'Иса', family: 'Хеймдалль', keywords: ['пауза', 'сосредоточение'], upright: 'Пауза сохраняет форму до момента, когда движение снова станет безопасным.', reversed: 'Иса не переворачивается: замедление само является ответом.' },
  { glyph: 'ᛃ', name: 'Йера', family: 'Хеймдалль', keywords: ['цикл', 'результат'], upright: 'Созревший результат приходит из повторяемых действий, а не рывка.', reversed: 'Йера не переворачивается: цикл нельзя ускорить, но можно поддержать.' },
  { glyph: 'ᛇ', name: 'Эйваз', family: 'Хеймдалль', keywords: ['стойкость', 'переход'], upright: 'Ось внутри помогает пройти переход без потери себя.', reversed: 'Эйваз не переворачивается: укрепляйте связь между прошлым и будущим.' },
  { glyph: 'ᛈ', name: 'Перт', family: 'Хеймдалль', keywords: ['тайна', 'вероятность'], upright: 'Неизвестное оставляет пространство случаю и новому знанию.', reversed: 'Скрытая деталь пока не готова открыться; не заполняйте пустоту догадкой.' },
  { glyph: 'ᛉ', name: 'Альгиз', family: 'Хеймдалль', keywords: ['защита', 'внимание'], upright: 'Чуткая граница защищает важное, не закрывая вас от мира.', reversed: 'Сигналы уязвимости требуют отдыха, поддержки и ясного «нет».' },
  { glyph: 'ᛋ', name: 'Соулу', family: 'Хеймдалль', keywords: ['цель', 'жизненность'], upright: 'Соберите силу вокруг одного ясного направления.', reversed: 'Соулу не переворачивается: свет есть, но его нельзя путать с всесилием.' },
  { glyph: 'ᛏ', name: 'Тейваз', family: 'Тюр', keywords: ['решимость', 'справедливость'], upright: 'Поступок должен совпасть с принципом, который вы готовы защищать.', reversed: 'Борьба без смысла истощает; уточните, за что именно вы стоите.' },
  { glyph: 'ᛒ', name: 'Беркана', family: 'Тюр', keywords: ['рост', 'забота'], upright: 'Новому нужна защищённая среда и терпеливая забота.', reversed: 'Рост тормозит там, где забота превратилась в контроль.' },
  { glyph: 'ᛖ', name: 'Эваз', family: 'Тюр', keywords: ['доверие', 'движение'], upright: 'Согласованный союз позволяет двигаться быстрее и мягче.', reversed: 'Разный темп участников требует разговора до следующего шага.' },
  { glyph: 'ᛗ', name: 'Манназ', family: 'Тюр', keywords: ['человек', 'сообщество'], upright: 'Ответ проявляется в зеркале отношений и общей ответственности.', reversed: 'Чужая оценка заслоняет собственный голос; верните себе меру.' },
  { glyph: 'ᛚ', name: 'Лагуз', family: 'Тюр', keywords: ['чувство', 'течение'], upright: 'Доверьтесь чувству, одновременно проверяя берега реальностью.', reversed: 'Эмоциональный поток мутен; отложите решение до возвращения ясности.' },
  { glyph: 'ᛜ', name: 'Ингуз', family: 'Тюр', keywords: ['созревание', 'завершение'], upright: 'Накопленная сила готова перейти в завершённую форму.', reversed: 'Ингуз не переворачивается: закончите цикл, прежде чем открывать новый.' },
  { glyph: 'ᛞ', name: 'Дагаз', family: 'Тюр', keywords: ['перелом', 'ясность'], upright: 'Точка перелома уже наступила; действуйте из нового понимания.', reversed: 'Дагаз не переворачивается: перемена требует времени, чтобы стать видимой.' },
  { glyph: 'ᛟ', name: 'Отала', family: 'Тюр', keywords: ['дом', 'наследие'], upright: 'Опора приходит из того, что вы выбираете сохранить и передать.', reversed: 'Унаследованное правило пора отделить от собственной ценности.' }
]);

export const RUNE_SPREADS = Object.freeze([
  { id: 'one', label: 'Один знак', count: 1, category: 'quick', positions: ['Суть'] },
  { id: 'three', label: 'Исток · сила · шаг', count: 3, category: 'quick', positions: ['Исток', 'Действующая сила', 'Следующий шаг'] },
  { id: 'crossroads', label: 'Перекрёсток', count: 5, category: 'choice', positions: ['Суть выбора', 'Путь A', 'Цена A', 'Путь B', 'Цена B'] },
  { id: 'relationship', label: 'Руны отношений', count: 6, category: 'love', positions: ['Вы', 'Другой', 'Притяжение', 'Граница', 'Диалог', 'Вектор'] },
  { id: 'nine-worlds', label: 'Девять миров', count: 9, category: 'deep', positions: ['Корень', 'Тело', 'Чувство', 'Мысль', 'Связь', 'Испытание', 'Ресурс', 'Переход', 'Итог'] },
  { id: 'year-wheel', label: 'Круг двенадцати', count: 12, category: 'deep', positions: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'] }
]);

function hash(value) {
  let result = 2166136261;
  for (const char of String(value)) {
    result ^= char.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

export function runeOfDay(profileSeed = '', value = new Date()) {
  const day = Math.floor(new Date(value).getTime() / DAY_MS);
  const seed = hash(`${profileSeed}:${day}`);
  const rune = ELDER_FUTHARK[seed % ELDER_FUTHARK.length];
  const reversed = seed % 7 !== 0 && (seed >>> 5) % 2 === 1;
  return { ...rune, reversed, meaning: reversed ? rune.reversed : rune.upright };
}

export function castRuneSpread(spreadId = 'three', random = Math.random, maxCount = 12) {
  const spread = RUNE_SPREADS.find((item) => item.id === spreadId) || RUNE_SPREADS[1];
  const count = Math.max(1, Math.min(maxCount, spread.count));
  const pool = [...ELDER_FUTHARK];
  return Array.from({ length: count }, (_, index) => {
    const raw = Number(random());
    const cursor = Math.max(0, Math.min(pool.length - 1, Math.floor((Number.isFinite(raw) ? raw : 0) * pool.length)));
    const rune = pool.splice(cursor, 1)[0];
    const reversible = !['Гебо', 'Хагалаз', 'Иса', 'Йера', 'Эйваз', 'Соулу', 'Ингуз', 'Дагаз'].includes(rune.name);
    const reversed = reversible && Number(random()) >= 0.5;
    return { ...rune, position: spread.positions[index] || `Позиция ${index + 1}`, reversed, meaning: reversed ? rune.reversed : rune.upright };
  });
}

export function searchRunes(query = '', family = 'all') {
  const needle = String(query).trim().toLocaleLowerCase('ru');
  return ELDER_FUTHARK.filter((rune) => {
    const familyMatch = family === 'all' || rune.family === family;
    const queryMatch = !needle || [rune.name, rune.glyph, rune.family, ...rune.keywords].join(' ').toLocaleLowerCase('ru').includes(needle);
    return familyMatch && queryMatch;
  });
}
