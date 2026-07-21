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
