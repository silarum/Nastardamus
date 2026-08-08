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
  dom.window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    return {
      ok: false,
      status: 401,
      json: async () => ({ error: 'telegram_auth_required' })
    };
  };
  dom.window.localStorage.setItem('nastardamus-profile-v1', JSON.stringify({
    completed: true,
    name: 'Никита',
    city: 'Казань',
    birthDate: '1994-05-17',
    birthTime: '12:00',
    birthTimeKnown: true,
    interests: ['relationships', 'business', 'growth'],
    goals: ['harmony'],
    gender: 'male'
  }));

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
    assert.equal(mount.dataset.screen, 'welcome');
    assert.ok(mount.textContent.includes('Я — Эзотериум'));
    click(document, 'Узнать, что я умею');
    assert.ok(mount.textContent.includes('Чем я могу быть вам полезен'));
    click(document, 'Войти в Nastardamus');
    assert.equal(mount.dataset.screen, 'home');
    assert.equal(mount.querySelectorAll('.n-app-shell').length, 1);
    assert.equal(mount.querySelectorAll('.n-balance-card').length, 0, 'Balance must not be shown on the home screen');
    assert.equal(document.body.textContent.includes('Посмотреть приветствие'), false);
    const homeText = mount.textContent;
    assert.ok(homeText.indexOf('Ваши практики') < homeText.indexOf('Спортивные знамения'));
    assert.ok(homeText.indexOf('Ладонь') < homeText.indexOf('Руны'));
    assert.ok(homeText.indexOf('Руны') < homeText.indexOf('Таро'));
    assert.ok(homeText.indexOf('Таро') < homeText.indexOf('Амур'));
    assert.ok(homeText.indexOf('Спортивные знамения') < homeText.lastIndexOf('Колесо Фортуны'));
    assert.ok(homeText.includes('Личное пространство Эзотериума'));
    assert.match(
      mount.querySelector('.premium-sports-banner > img').getAttribute('src'),
      /sports-prophecy-banner\.webp$/
    );

    click(document, 'Спортивные знамения');
    assert.equal(mount.dataset.screen, 'sports');
    assert.ok(document.body.textContent.includes('Конкретный сценарий и уровень уверенности'));
    assert.equal(mount.querySelectorAll('.n-bottom-navigation').length, 1);
    app.state.sportsResult = 'Арена на мгновение замирает.\n\nРисунок встречи меняется в самой тишине.';
    app.render();
    assert.equal(mount.querySelectorAll('.n-bottom-navigation').length, 0);
    assert.ok(mount.querySelector('.premium-shell--reading'));
    assert.ok(mount.querySelector('.premium-screen--reading'));
    app.state.sportsResult = '';
    app.render();
    click(document, 'Назад');
    assert.equal(mount.dataset.screen, 'home');

    click(document, 'Личное пространство Эзотериума');
    assert.equal(mount.dataset.screen, 'space');
    assert.ok(document.body.textContent.toLocaleLowerCase('ru').includes('энергия дня'));
    assert.ok(document.body.textContent.includes('Важное сегодня'));
    click(document, 'Событие');
    assert.equal(mount.dataset.screen, 'space-event-form');
    const eventTitle = document.querySelector('input[placeholder="Например: важный разговор"]');
    eventTitle.value = 'Разговор о новом проекте';
    eventTitle.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    click(document, 'Сохранить и спросить Эзотериума');
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(mount.dataset.screen, 'space-event');
    assert.ok(document.body.textContent.includes('Энергия события'));
    assert.ok(document.body.textContent.includes('Вопрос Эзотериума'));
    click(document, 'Назад');
    assert.equal(mount.dataset.screen, 'space');
    assert.ok(document.body.textContent.includes('Разговор о новом проекте'));
    click(document, 'Назад');
    assert.equal(mount.dataset.screen, 'home');

    click(document, 'Практики');
    assert.equal(mount.dataset.screen, 'services');

    click(document, 'Двенадцать раскладов Таро');
    assert.equal(mount.dataset.screen, 'tarot');
    assert.equal(document.querySelectorAll('.premium-spread-card').length, 12);
    click(document, 'Прошлое · настоящее · будущее');
    assert.equal(mount.dataset.screen, 'tarot-question');

    const question = document.querySelector('textarea');
    question.value = 'Что поможет мне сделать следующий шаг?';
    question.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    click(document, 'Войти в ритуал');
    assert.equal(mount.dataset.screen, 'tarot-draw');
    click(document, 'Перемешать колоду');
    await new Promise((resolve) => setTimeout(resolve, 280));

    for (let index = 0; index < 3; index += 1) {
      const card = document.querySelector('.premium-tarot-card:not(:disabled)');
      assert.ok(card, `Selectable card ${index + 1} is missing`);
      card.click();
      assert.ok(document.querySelector('.premium-card-reveal'));
      await new Promise((resolve) => setTimeout(resolve, 340));
    }
    assert.ok(findButton(document, 'Узнать толкование'));

    app.state.result = {
      id: 'reading-test',
      type: 'Расклад «Прошлое · настоящее · будущее»',
      title: 'Что поможет сделать следующий шаг?',
      body: 'Первый знак возникает сразу.\n\nВторой абзац раскрывает движение.',
      cards: ['Шут', 'Маг', 'Сила'],
      createdAt: new Date().toISOString(),
      favorite: false
    };
    app.navigate('tarot-result');
    assert.equal(mount.dataset.screen, 'tarot-result');
    assert.equal(mount.querySelectorAll('.n-bottom-navigation').length, 0);
    assert.ok(mount.querySelector('.premium-shell--reading'));
    assert.equal(mount.querySelectorAll('.premium-reading-copy p').length, 2);

    app.navigate('profile');
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(mount.dataset.screen, 'profile');
    assert.ok(document.body.textContent.includes('Откройте приложение внутри Telegram'));
    assert.equal(mount.querySelectorAll('.profile-command-grid > button').length, 4);
    assert.equal(document.body.textContent.includes('Возраст'), false);
    assert.equal(document.body.textContent.includes('Город'), false);
    assert.equal(document.body.textContent.includes('Как к вам обращаться?'), false);
    assert.equal(app.state.userGender, 'male');
    app.state.walletStatus = 'ready';
    app.state.wallet = {
      wallet: { balance: 18.5, available: 16, locked: 2.5, freeSpins: 1 },
      vip: { planId: 'vip-month', expiresAt: '2030-08-08T12:00:00.000Z' },
      config: {
        paymentMethods: { stars: { enabled: true } }, withdrawalsEnabled: true,
        vipPlans: [{ id: 'vip-month', title: 'VIP на месяц', description: 'Полный круг практик', price: 33 }]
      },
      entitlements: [{ service_id: 'tarot', quantity: 2 }],
      ledger: [
        { type: 'purchase', amount: 10, createdAt: '2026-08-08T10:00:00.000Z' },
        { type: 'service_charge', amount: -2, createdAt: '2026-08-08T09:00:00.000Z' },
        { type: 'wheel_prize', amount: 1, createdAt: '2026-08-07T09:00:00.000Z' },
        { type: 'adjustment', amount: 5, createdAt: '2026-08-06T09:00:00.000Z' }
      ]
    };
    app.render();
    assert.ok(document.body.textContent.includes('16,00'));
    click(document, 'Все операции');
    assert.equal(mount.querySelectorAll('.profile-ledger-full .profile-ledger-line').length, 4);
    click(document, 'Закрыть');
    click(document, 'Доступ');
    assert.ok(document.body.textContent.includes('VIP АКТИВЕН'));
    click(document, 'Дары');
    assert.ok(document.body.textContent.includes('Доступно без списания'));
    click(document, 'Среда');
    assert.ok(document.body.textContent.includes('Образ профиля'));
    click(document, 'Образ профиля');
    assert.equal(mount.querySelectorAll('.profile-sheet[role="dialog"]').length, 1);
    assert.ok(document.body.textContent.includes('Выбрать фото'));
    click(document, 'Закрыть');
    assert.equal(mount.querySelectorAll('.profile-sheet').length, 0);

    click(document, 'Главная');
    assert.equal(mount.dataset.screen, 'home');

    click(document, 'Практики');
    click(document, 'Энергетический след');
    assert.equal(mount.dataset.screen, 'photo-energy');
    assert.equal(document.querySelectorAll('.n-info-banner').length, 0);

    click(document, 'Назад');
    assert.equal(mount.dataset.screen, 'services');
    click(document, 'Определение порчи');
    assert.equal(mount.dataset.screen, 'photo-damage');
    assert.ok(document.body.textContent.includes('Опишите, что происходит'));

    click(document, 'Назад');
    click(document, 'Амур');
    assert.equal(mount.dataset.screen, 'amur');
    assert.ok(document.body.textContent.includes('Бросить кости Амура'));
    assert.equal(document.querySelectorAll('.premium-amur-die').length, 2);
    click(document, 'По фотографиям');
    assert.equal(mount.dataset.screen, 'photo-compat');
    assert.equal(document.querySelectorAll('.n-upload-card').length, 2);

    click(document, 'Назад');
    click(document, 'По ладоням');
    assert.equal(mount.dataset.screen, 'palm-room-create');
    assert.equal(document.querySelectorAll('.palm-live-invite__hands img').length, 2);
    assert.ok(document.body.textContent.includes('Имя второго участника'));
    assert.ok(document.body.textContent.includes('Главный вопрос для совместного чтения'));
    click(document, 'Творческий союз');
    assert.equal(app.state.oracleRoomDraft.relationshipType, 'creative');
    assert.equal(app.suggestGenderFromName('Анна'), 'female');
    assert.equal(app.suggestGenderFromName('Иван'), 'male');
    assert.equal(app.suggestGenderFromName('Саша'), 'unspecified');

    click(document, 'Практики');
    click(document, 'Чтение по ладони');
    assert.equal(mount.dataset.screen, 'palm-reading');
    assert.ok(document.body.textContent.includes('Сначала — ладонь'));
    click(document, 'Назад');
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

test('bundled startup shows registration and enters the redesigned home', async () => {
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
    dom.window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
    dom.window.eval(bundle);

    const mount = dom.window.document.getElementById('premium-app');
    const boot = dom.window.document.getElementById('boot-screen');
    assert.equal(mount.dataset.screen, 'welcome');
    assert.equal(mount.dataset.world, 'threshold');
    assert.ok(mount.textContent.includes('Nastardamus'));
    assert.ok(mount.textContent.includes('Я — Эзотериум'));
    assert.ok(boot.classList.contains('is-hidden'));

    click(dom.window.document, 'Узнать, что я умею');
    assert.ok(mount.textContent.includes('Чем я могу быть вам полезен'));
    assert.equal(mount.querySelectorAll('.oracle-capability').length, 6);
    click(dom.window.document, 'Продолжить знакомство');
    assert.ok(mount.textContent.includes('Первое знакомство'));

    for (const consent of [...mount.querySelectorAll('.initiation-consents input')]) {
      consent.checked = true;
      consent.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    }
    click(dom.window.document, 'Начать личное знакомство');
    const name = mount.querySelector('input[autocomplete="name"]');
    name.value = 'Никита';
    name.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    click(dom.window.document, 'Продолжить');
    click(dom.window.document, 'Мужчина');
    click(dom.window.document, 'Продолжить');

    const birthDate = mount.querySelector('input[type="date"]');
    birthDate.value = '1994-05-17';
    birthDate.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    click(dom.window.document, 'Сохранить дату');
    click(dom.window.document, 'Продолжить');

    const city = mount.querySelector('input[autocomplete="address-level2"]');
    city.value = 'Казань';
    city.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    click(dom.window.document, 'Сохранить место');
    click(dom.window.document, 'Пропустить');
    click(dom.window.document, 'Отношения');
    click(dom.window.document, 'Бизнес');
    click(dom.window.document, 'Саморазвитие');
    click(dom.window.document, 'Продолжить');
    click(dom.window.document, 'Гармония и покой');
    click(dom.window.document, 'Создать мой профиль');
    await new Promise((resolve) => dom.window.setTimeout(resolve, 360));
    click(dom.window.document, 'Продолжить в Nastardamus');
    await new Promise((resolve) => dom.window.setTimeout(resolve, 0));
    assert.equal(mount.dataset.screen, 'home');
    assert.equal(new URL(dom.window.location.href).searchParams.get('screen'), 'home');
    assert.equal(mount.querySelectorAll('.premium-home-practice').length, 4);
    assert.equal(mount.querySelectorAll('.n-bottom-nav-item').length, 5);
    assert.equal(mount.querySelectorAll('.n-center-magic-button').length, 0);

    await new Promise((resolve) => dom.window.setTimeout(resolve, 300));
    assert.equal(dom.window.document.getElementById('boot-screen'), null);
  } finally {
    dom.window.close();
  }
});

test('a returning user completes the Esoterium introduction before entering Nastardamus', async () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const bundle = readFileSync(new URL('../ui-kit/app.bundle.js', import.meta.url), 'utf8');
  const dom = new JSDOM(html, {
    url: 'https://nastardamus.example/',
    pretendToBeVisual: true,
    runScripts: 'outside-only'
  });

  try {
    dom.window.localStorage.setItem('nastardamus-profile-v1', JSON.stringify({
      age: 37,
      city: 'Москва',
      completed: true
    }));
    dom.window.scrollTo = () => {};
    dom.window.eval(bundle);

    const mount = dom.window.document.getElementById('premium-app');
    assert.equal(mount.dataset.screen, 'welcome');
    assert.ok(mount.textContent.includes('Я — Эзотериум'));

    await new Promise((resolve) => dom.window.setTimeout(resolve, 0));
    assert.equal(mount.dataset.screen, 'welcome');

    click(dom.window.document, 'Узнать, что я умею');
    assert.ok(mount.textContent.includes('Чем я могу быть вам полезен'));
    click(dom.window.document, 'Войти в Nastardamus');
    assert.equal(mount.dataset.screen, 'home');
  } finally {
    dom.window.close();
  }
});
