import test from 'node:test';
import assert from 'node:assert/strict';

import {
  dateTimeLocale,
  normalizeLocale,
  setLocale,
  translateText
} from '../ui-kit/core/i18n.js';

test('Nastardamus exposes Russian, English and Chinese locale normalization', () => {
  assert.equal(normalizeLocale('ru-RU'), 'ru');
  assert.equal(normalizeLocale('en-US'), 'en');
  assert.equal(normalizeLocale('zh-CN'), 'zh');
  assert.equal(dateTimeLocale('zh'), 'zh-CN');
});

test('the opening Esoterium introduction is translated without changing the Russian source', () => {
  setLocale('en');
  assert.equal(translateText('Я — Эзотериум'), 'I am Esoterium');
  assert.equal(translateText('Узнать, что я умею'), 'Discover what I can do');

  setLocale('zh');
  assert.equal(translateText('Я — Эзотериум'), '我是秘境先知');
  assert.equal(translateText('Продолжить знакомство'), '继续了解');

  setLocale('ru');
  assert.equal(translateText('Я — Эзотериум'), 'Я — Эзотериум');
});

test('dynamic home and onboarding phrases preserve personalized values', () => {
  assert.equal(translateText('Никита, найдите одну ясную точку опоры', 'en'), 'Никита, find one clear point of support');
  assert.equal(translateText('Выбрано: 4 · минимум 3', 'zh'), '已选择：4 · 至少 3 项');
});
