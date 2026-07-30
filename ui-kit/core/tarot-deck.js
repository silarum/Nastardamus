const MAJOR_ARCANA = [
  ['Шут', 'fool.webp'], ['Маг', 'magician.webp'], ['Верховная Жрица', 'high-priestess.webp'],
  ['Императрица', 'empress.webp'], ['Император', 'emperor.webp'], ['Иерофант', 'hierophant.webp'],
  ['Влюблённые', 'lovers.webp'], ['Колесница', 'chariot.webp'], ['Сила', 'strength.webp'],
  ['Отшельник', 'hermit.webp'], ['Колесо Фортуны', 'wheel-of-fortune.webp'],
  ['Справедливость', 'justice.webp'], ['Повешенный', 'hanged-man.webp'], ['Смерть', 'death.webp'],
  ['Умеренность', 'temperance.webp'], ['Дьявол', 'devil.webp'], ['Башня', 'tower.webp'],
  ['Звезда', 'star.webp'], ['Луна', 'moon.webp'], ['Солнце', 'sun.webp'],
  ['Суд', 'judgement.webp'], ['Мир', 'world.webp']
];

const SUITS = [
  ['wands', 'Жезлов'], ['cups', 'Кубков'], ['swords', 'Мечей'], ['pentacles', 'Пентаклей']
];
const RANKS = [
  ['ace', 'Туз'], ['two', 'Двойка'], ['three', 'Тройка'], ['four', 'Четвёрка'],
  ['five', 'Пятёрка'], ['six', 'Шестёрка'], ['seven', 'Семёрка'], ['eight', 'Восьмёрка'],
  ['nine', 'Девятка'], ['ten', 'Десятка'], ['page', 'Паж'], ['knight', 'Рыцарь'],
  ['queen', 'Королева'], ['king', 'Король']
];

const MINOR_ARCANA = SUITS.flatMap(([suitId, suitName]) =>
  RANKS.map(([rankId, rankName]) => [
    `${rankName} ${suitName}`,
    `minor/${rankId}-of-${suitId}.svg`
  ])
);

export const TAROT_CARD_IMAGES = Object.freeze(Object.fromEntries([...MAJOR_ARCANA, ...MINOR_ARCANA]));
export const TAROT_CARD_NAMES = Object.freeze(Object.keys(TAROT_CARD_IMAGES));

export function tarotCardImage(name) {
  const file = TAROT_CARD_IMAGES[name] || 'high-priestess.webp';
  return `/images/cards/${file}`;
}
