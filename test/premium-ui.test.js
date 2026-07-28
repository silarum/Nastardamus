import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

function findButton(document, text) {
  return [...document.querySelectorAll('button')].find((button) =>
    button.textContent.includes(text) || button.getAttribute('aria-label')?.includes(text)
  );
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
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    return {
      ok: false,
      status: 401,
      json: async () => ({ error: 'telegram_auth_required' })
    };
  };

  try {
    const app = await import(`../ui-kit/app.js?ui-test=${Date.now()}`);
    await new Promise((resolve) => setTimeout(resolve, 0));
    app.state.publicConfig = {
      ...app.state.publicConfig,
      wheelEnabled: true,
      palmLinkEnabled: true,
      jointReadingsEnabled: true
    };
    app.render();

    const mount = document.getElementById('premium-app');
    assert.equal(mount.dataset.screen, 'home');
    assert.equal(mount.querySelectorAll('.n-app-shell').length, 1);
    assert.equal(mount.querySelectorAll('.n-balance-card').length, 0, 'Balance must not be shown on the home screen');
    assert.equal(document.body.textContent.includes('Посмотреть приветствие'), false);
    const homeText = mount.textContent;
    assert.ok(homeText.indexOf('Быстрый доступ') < homeText.indexOf('Спортивные знамения'));
    assert.ok(homeText.indexOf('Спортивные знамения') < homeText.lastIndexOf('Колесо Фортуны'));
    assert.match(
      mount.querySelector('.premium-sports-banner > img').getAttribute('src'),
      /sports-prophecy-banner\.png$/
    );

    click(document, 'Спортивные знамения');
    assert.equal(mount.dataset.screen, 'sports');
    assert.ok(document.body.textContent.includes('Символический прогноз события'));
    click(document, 'Назад');
    assert.equal(mount.dataset.screen, 'home');

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
    click(document, 'Женщина');
    assert.equal(app.state.userGender, 'female');
    assert.equal(
      dom.window.localStorage.getItem('nastardamus-profile-v1'),
      JSON.stringify({ gender: 'female' })
    );

    click(document, 'Главная');
    assert.equal(mount.dataset.screen, 'home');

    click(document, 'Услуги');
    click(document, 'Энергетический след');
    assert.equal(mount.dataset.screen, 'photo-energy');
    assert.equal(document.querySelectorAll('.n-info-banner').length, 0);

    click(document, 'Назад');
    assert.equal(mount.dataset.screen, 'services');
    click(document, 'Определение порчи');
    assert.equal(mount.dataset.screen, 'photo-damage');
    assert.ok(document.body.textContent.includes('Опишите, что происходит'));

    click(document, 'Назад');
    click(document, 'Совместимость по фото');
    assert.equal(mount.dataset.screen, 'photo-compat');
    assert.equal(document.querySelectorAll('.n-upload-card').length, 2);

    click(document, 'Назад');
    click(document, 'Путь двух судеб');
    assert.equal(mount.dataset.screen, 'palm');
    assert.equal(document.querySelectorAll('.n-palm-graphic').length, 2);
    assert.match(document.querySelector('.n-palm-graphic--left').getAttribute('src'), /palm-left\.png$/);
    assert.match(document.querySelector('.n-palm-graphic--right').getAttribute('src'), /palm-right\.png$/);
    click(document, 'Творческий союз');
    assert.equal(app.state.palmGoal, 'creative');
    assert.equal(app.suggestGenderFromName('Анна'), 'female');
    assert.equal(app.suggestGenderFromName('Иван'), 'male');
    assert.equal(app.suggestGenderFromName('Саша'), 'unspecified');
    app.state.inviteFlow = 'palm';
    app.state.inviteName = 'Анна';
    app.state.inviteGender = 'female';
    app.state.inviteGoal = 'creative';
    app.navigate('invite-compose');
    assert.equal(mount.dataset.screen, 'invite-compose');
    assert.match(
      document.querySelector('.premium-invitation-preview__portrait').getAttribute('src'),
      /portrait-woman\.png$/
    );
    assert.equal(document.querySelectorAll('.premium-invite-gender').length, 2);
    assert.ok(findButton(document, 'Выбрать приложение для отправки') === undefined);
    app.navigate('palm');
    click(document, 'Продолжить ритуал');
    assert.equal(mount.dataset.screen, 'palm');
    assert.ok(document.getElementById('premium-toast').textContent.includes('Сначала загрузите фото ладони'));

    click(document, 'Услуги');
    click(document, 'Спросить Эзотериума');
    assert.equal(mount.dataset.screen, 'support');
    assert.ok(document.querySelector('textarea'));

    click(document, 'История');
    assert.equal(mount.dataset.screen, 'history');
    assert.ok(document.body.textContent.includes('История пока пуста'));
    assert.equal(fetchCalls, 0, 'Public preview must not call Telegram-protected APIs');
  } finally {
    globalThis.fetch = previousFetch;
    dom.window.close();
  }
});

test('bundled startup restores the elder splash and renders a fixed wheel pointer', async () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const bundle = readFileSync(new URL('../ui-kit/app.bundle.js', import.meta.url), 'utf8');
  const dom = new JSDOM(html, {
    url: 'https://nastardamus.example/',
    pretendToBeVisual: true,
    runScripts: 'outside-only'
  });

  try {
    dom.window.localStorage.setItem('nastardamus-onboarded-v2', 'true');
    dom.window.scrollTo = () => {};
    dom.window.eval(bundle);

    const mount = dom.window.document.getElementById('premium-app');
    const boot = dom.window.document.getElementById('boot-screen');
    assert.equal(mount.dataset.screen, 'welcome');
    assert.ok(mount.querySelector('img[src="/images/splash-v2.webp"]'));
    assert.ok(mount.textContent.includes('Nastardamus'));
    assert.ok(boot.classList.contains('is-hidden'));

    click(dom.window.document, 'Открыть пространство');
    assert.equal(mount.dataset.screen, 'home');
    assert.equal(dom.window.location.search, '');
    assert.equal(mount.querySelectorAll('.n-wheel-pointer').length, 1);

    await new Promise((resolve) => dom.window.setTimeout(resolve, 300));
    assert.equal(dom.window.document.getElementById('boot-screen'), null);
  } finally {
    dom.window.close();
  }
});
