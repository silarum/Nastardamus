import assert from 'node:assert/strict';
import test from 'node:test';

import { buildReadingMessages } from '../lib/readings.js';

test('builds a three-card tarot request', () => {
    const messages = buildReadingMessages('tarot', {
        question: 'Что важно сегодня?',
        cards: ['Шут', 'Звезда', 'Мир']
    });

    assert.equal(messages.length, 2);
    assert.match(messages[1].content, /Позиция 1 — Шут/);
    assert.match(messages[1].content, /Позиция 3 — Мир/);
});

test('builds one-card and seven-card spread requests with named positions', () => {
    const oneCard = buildReadingMessages('tarot', {
        question: 'На чём сосредоточиться?',
        cards: ['Звезда'],
        spread: { title: 'Чёткий знак', positions: ['Главный ориентир'] }
    });
    assert.match(oneCard[1].content, /Главный ориентир — Звезда/);

    const sevenCards = ['Шут', 'Маг', 'Звезда', 'Мир', 'Солнце', 'Луна', 'Сила'];
    const positions = ['Старт', 'Уходит', 'Приходит', 'Ресурс', 'Испытание', 'Действие', 'Горизонт'];
    const deep = buildReadingMessages('tarot', {
        question: 'Как пройти перемены?',
        cards: sevenCards,
        spread: { title: 'Путь перемен', positions }
    });
    assert.match(deep[1].content, /Горизонт — Сила/);
});

test('builds multimodal photo compatibility without face-based claims', () => {
    const photo = 'data:image/jpeg;base64,AA==';
    const messages = buildReadingMessages('photo-compatibility', {
        first: { name: 'А', photo },
        second: { name: 'Б', photo },
        context: 'Как лучше поговорить?'
    });

    assert.ok(Array.isArray(messages[1].content));
    assert.equal(messages[1].content.filter((part) => part.type === 'image_url').length, 2);
    assert.match(messages[1].content[0].text, /фото не доказывают совместимость/i);
});

test('energy check explicitly rejects supernatural diagnosis and unsafe advice', () => {
    const messages = buildReadingMessages('energy-check', {
        concern: 'Мне тревожно из-за череды неприятных событий.',
        photo: 'data:image/webp;base64,AA=='
    });

    assert.match(messages[1].content[0].text, /нельзя определить порчу/i);
    assert.match(messages[1].content[0].text, /не платить запугивающим людям/i);
});

test('rejects malformed photo payloads', () => {
    assert.throws(
        () => buildReadingMessages('energy-check', { concern: 'Мне тревожно', photo: 'https://example.com/photo.jpg' }),
        /supported image data URL/
    );
});

test('rejects unsupported reading features', () => {
    assert.throws(
        () => buildReadingMessages('unknown', {}),
        /unsupported feature/
    );
});

test('rejects malformed natal dates', () => {
    assert.throws(
        () => buildReadingMessages('natal', { date: '14.07.2026', time: '12:00' }),
        /YYYY-MM-DD/
    );
});
