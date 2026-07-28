import test from 'node:test';
import assert from 'node:assert/strict';

import { buildReadingMessages, isVisionFeature } from '../lib/readings.js';

const cards = [
  'Шут',
  'Маг',
  'Верховная Жрица',
  'Императрица',
  'Император',
  'Иерофант',
  'Влюблённые',
  'Колесница',
  'Сила',
  'Отшельник'
];

const tinyImage = 'data:image/jpeg;base64,AA==';

test('accepts a one-card spread', () => {
  const messages = buildReadingMessages('tarot', {
    question: 'Что важно заметить?',
    cards: cards.slice(0, 1),
    spread: 'one-sign',
    positions: ['Главный знак']
  });

  assert.equal(messages.length, 2);
  assert.match(messages[1].content, /Один знак/);
  assert.match(messages[1].content, /Главный знак — Шут/);
  assert.match(messages[0].content, /Закон живого узора/);
  assert.match(messages[0].content, /цифровой Оракул/);
  assert.match(messages[0].content, /Не используй Markdown/);
});

test('accepts a ten-card Celtic Cross', () => {
  const messages = buildReadingMessages('tarot', {
    question: 'Как увидеть ситуацию целиком?',
    cards,
    spread: 'celtic-cross',
    positions: cards.map((_, index) => `Позиция ${index + 1}`)
  });

  assert.match(messages[1].content, /Кельтский крест/);
  assert.match(messages[1].content, /Позиция 10 — Отшельник/);
});

test('rejects a tarot spread with more than ten cards', () => {
  assert.throws(
    () => buildReadingMessages('tarot', {
      question: 'Слишком большой расклад',
      cards: [...cards, 'Колесо Фортуны']
    }),
    /between one and ten cards/
  );
});

test('builds a safe symbolic single-photo reading', () => {
  const messages = buildReadingMessages('photo_energy', {
    concern: 'Где сейчас моя опора?',
    image: tinyImage
  });

  assert.equal(isVisionFeature('photo_energy'), true);
  assert.ok(Array.isArray(messages[1].content));
  assert.equal(messages[1].content[1].type, 'image_url');
  assert.match(messages[1].content[0].text, /не доказательство внешнего воздействия/i);
});

test('damage reading addresses the concern without validating magical harm', () => {
  const messages = buildReadingMessages('photo_damage', {
    concern: 'Мне кажется, что всё резко стало идти плохо.',
    image: tinyImage
  });

  assert.equal(isVisionFeature('photo_damage'), true);
  assert.match(messages[1].content[0].text, /Не подтверждай существование порчи/i);
  assert.match(messages[1].content[0].text, /Что находится в вашей власти/i);
});

test('daily horoscope is personalized by name, sign and date', () => {
  const messages = buildReadingMessages('daily_horoscope', {
    name: 'Анна',
    sign: 'Весы',
    date: '2026-07-27',
    gender: 'female'
  });

  assert.match(messages[1].content, /Анна/);
  assert.match(messages[1].content, /Весы/);
  assert.match(messages[1].content, /2026-07-27/);
  assert.match(messages[0].content, /поэтическ/i);
  assert.match(messages[0].content, /добрый юмор/i);
  assert.match(messages[0].content, /женском роде/i);
  assert.match(messages[1].content, /новую метафору, архетип, бытовой образ и ритм/i);
});

test('does not infer gender when the user did not specify it', () => {
  const messages = buildReadingMessages('natal', {
    date: '1990-01-01',
    time: '12:00',
    gender: 'unspecified'
  });

  assert.match(messages[0].content, /Не угадывай его по имени, фотографии или вопросу/i);
  assert.match(messages[0].content, /нейтральные формулировки/i);
});

test('sports forecast stays symbolic and never becomes betting advice', () => {
  const messages = buildReadingMessages('sports_forecast', {
    event: 'Финал: команда А — команда Б',
    context: 'Интересен возможный перелом темпа.',
    gender: 'unspecified'
  });

  assert.match(messages[0].content, /не подталкивай к ставкам/i);
  assert.match(messages[1].content, /не выдумывай текущую статистику/i);
  assert.match(messages[1].content, /не основа для ставки/i);
});

test('builds a two-photo compatibility reading', () => {
  const messages = buildReadingMessages('photo_compatibility', {
    concern: 'Что важно проговорить?',
    firstName: 'Анна',
    secondName: 'Иван',
    firstImage: tinyImage,
    secondImage: tinyImage
  });

  assert.equal(isVisionFeature('photo_compatibility'), true);
  assert.equal(messages[1].content.filter((part) => part.type === 'image_url').length, 2);
  assert.match(messages[1].content[0].text, /совместимость определяется поступками и диалогом/i);
});

test('rejects unsupported image data', () => {
  assert.throws(
    () => buildReadingMessages('photo_energy', {
      concern: 'Проверка',
      image: 'https://example.com/photo.jpg'
    }),
    /supported image data URL/
  );
});
