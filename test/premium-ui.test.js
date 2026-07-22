import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

function findButton(document, text) {
  return [...document.querySelectorAll('button')].find((button) => button.textContent.includes(text));
}

function click(document, text) {
  const button = findButton(document, text);
  assert.ok(button, `Button not found: ${text}`);
  assert.equal(button.disabled, false, `Button is disabled: ${text}`);
  button.click();
  return button;
}

test('premium mobile navigation and tarot card selection respond to real clicks', async () => {
  const dom = new JSDOM('<!doctype html><div id="premium-app"></div><div id="premium-toast"></div>', {
    url: 'https://nastardamus.example/?screen=home',
    pretendToBeVisual: true
  });

  const previousFetch = globalThis.fetch;
  const browserGlobals = {
    window: dom.window,
    document: dom.window.document,
    Node: dom.window.Node,
    navigator: dom.window.navigator,
    history: dom.window.history,
    location: dom.window.location,
    localStorage: dom.window.localStorage,
    FileReader: dom.window.FileReader,
    Image: dom.window.Image
  };
  for (const [key, value] of Object.entries(browserGlobals)) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  dom.window.scrollTo = () => {};
  globalThis.fetch = async () => ({
    ok: false,
    status: 401,
    json: async () => ({ error: 'telegram_auth_required' })
  });

  try {
    await import(`../ui-kit/app.js?ui-test=${Date.now()}`);
    await new Promise((resolve) => setTimeout(resolve, 0));

    const mount = document.getElementById('premium-app');
    assert.equal(mount.dataset.screen, 'home');
    assert.equal(mount.querySelectorAll('.n-app-shell').length, 1);

    click(document, 'Услуги');
    assert.equal(mount.dataset.screen, 'services');

    click(document, 'Семь раскладов Таро');
    assert.equal(mount.dataset.screen, 'tarot');

    const question = document.querySelector('textarea');
    question.value = 'Что поможет мне сделать следующий шаг?';
    question.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    click(document, 'Перейти к выбору карт');
    assert.equal(mount.dataset.screen, 'tarot-draw');

    for (let index = 0; index < 3; index += 1) {
      const card = document.querySelector('.premium-tarot-card:not(:disabled)');
      assert.ok(card, `Selectable card ${index + 1} is missing`);
      card.click();
    }
    assert.ok(findButton(document, 'Получить толкование'));

    click(document, 'Профиль');
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(mount.dataset.screen, 'profile');
    assert.ok(document.body.textContent.includes('Откройте приложение внутри Telegram'));
  } finally {
    globalThis.fetch = previousFetch;
    dom.window.close();
  }
});
