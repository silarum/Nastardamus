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
    assert.ok(mount.textContent.includes('ПЕРВЫЙ ЗНАК ДНЯ'));
    assert.ok(mount.textContent.includes('мой проницательный Никита'));
    click(document, 'Войти без практики');
    assert.equal(mount.dataset.screen, 'home');
    assert.equal(mount.querySelectorAll('.n-app-shell').length, 1);
    assert.equal(mount.querySelectorAll('.n-balance-card').length, 0, 'Balance must not be shown on the home screen');
    assert.equal(document.body.textContent.includes('Посмотреть приветствие'), false);
    const homeText = mount.textContent;
    const jewelsText = mount.querySelector('.home-jewel-grid').textContent;
    assert.equal(mount.querySelectorAll('.home-jewel-card').length, 4);
    assert.equal(mount.querySelectorAll('.home-jewel svg').length, 5);
    assert.ok(homeText.includes('сегодня достаточно одного ясного шага'));
    assert.ok(homeText.includes('К чему прислушаетесь?'));
    assert.ok(jewelsText.indexOf('Скрытый смысл') < jewelsText.indexOf('Верный шаг'));
    assert.ok(jewelsText.indexOf('Верный шаг') < jewelsText.indexOf('Личное небо'));
    assert.ok(jewelsText.indexOf('Личное небо') < jewelsText.indexOf('Линии судьбы'));
    assert.equal(homeText.includes('78 арканов'), false);
    assert.equal(homeText.includes('Основа натального пути'), false);
    assert.equal(homeText.includes('Спортивные знамения'), false);

    click(document, 'Открыть личный знак дня');
    assert.equal(mount.dataset.screen, 'daily-choice');
    click(document, 'Назад');
    assert.equal(mount.dataset.screen, 'home');

    click(document, 'Практики');
    assert.equal(mount.dataset.screen, 'services');
    click(document, 'Знамения события');
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
    assert.equal(mount.dataset.screen, 'services');

    click(document, 'Мой путь');
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

    app.state.personalSpace.consultationAnswers = {
      desired: 'Ясно определить направление проекта',
      obstacle: 'Сомнение между скоростью и качеством',
      energy: 'Вдохновение и готовность действовать'
    };
    app.state.personalSpace.consultationResult = {
      id: 'path-reading-test',
      title: 'Проект обретает направление',
      body: [
        '§СУТЬ§ Ваш замысел уже собрал достаточно энергии, чтобы стать конкретным решением.',
        '§СКРЫТОЕ§ Главный узел — желание увидеть безупречный итог раньше первого черновика.',
        '§ОПОРА§ Ваш опыт подсказывает, где сохранить замысел, а где разрешить ему измениться.',
        '§ШАГИ§ Первый шаг — назовите главный след проекта. Второй шаг — покажите черновик одному союзнику. Третий шаг — зафиксируйте одно решение после разговора.',
        '§ВОПРОС§ Что можно отпустить сегодня, не теряя сути?'
      ].join('\n\n'),
      input: { desired: 'Ясно определить направление проекта' },
      createdAt: new Date().toISOString()
    };
    app.navigate('space-consultation');
    assert.equal(mount.querySelectorAll('.n-bottom-navigation').length, 0);
    assert.ok(mount.querySelector('.path-consultation-hero__art'));
    assert.equal(mount.querySelectorAll('.path-insight-card').length, 3);
    assert.equal(mount.querySelectorAll('.path-action-step').length, 3);
    assert.equal(mount.querySelectorAll('.path-gateway').length, 4);
    assert.ok(document.body.textContent.includes('Что можно отпустить сегодня'));
    click(document, 'Хиромантия');
    assert.equal(mount.dataset.screen, 'palm-reading');
    app.navigate('space-consultation');
    click(document, 'Натальная карта');
    assert.equal(mount.dataset.screen, 'natal');
    app.navigate('space');
    click(document, 'Назад');
    assert.equal(mount.dataset.screen, 'home');

    click(document, 'Практики');
    assert.equal(mount.dataset.screen, 'services');

    click(document, 'Ответ в картах');
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
    assert.equal(mount.querySelectorAll('.reading-live-dialogue .esoterium-chat').length, 1);
    assert.match(mount.querySelector('.esoterium-chat__bubble p').textContent, /Первый знак[\s\S]*Второй абзац/u);

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
    click(document, 'Образ вашей энергии');
    assert.equal(mount.dataset.screen, 'photo-energy');
    assert.equal(document.querySelectorAll('.n-info-banner').length, 0);

    click(document, 'Назад');
    assert.equal(mount.dataset.screen, 'services');
    click(document, 'Что тревожит вашу энергию');
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
    click(document, 'История вашей ладони');
    assert.equal(mount.dataset.screen, 'palm-reading');
    assert.ok(document.body.textContent.includes('Сначала — ладонь'));
    click(document, 'Назад');
    click(document, 'Разговор с Эзотериумом');
    assert.equal(mount.dataset.screen, 'support');
    assert.ok(document.querySelector('textarea'));

    click(document, 'История');
    assert.equal(mount.dataset.screen, 'history');
    assert.ok(document.body.textContent.includes('Разговор о новом проекте'));
    assert.ok(document.body.textContent.includes('Событие пути'));
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

    click(dom.window.document, 'Продолжить');
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
    assert.equal(mount.querySelectorAll('.home-jewel-card').length, 4);
    assert.equal(mount.querySelectorAll('.home-jewel svg').length, 5);
    assert.equal(mount.querySelectorAll('.n-bottom-nav-item').length, 5);
    assert.equal(mount.querySelectorAll('.n-center-magic-button').length, 0);

    await new Promise((resolve) => dom.window.setTimeout(resolve, 300));
    assert.equal(dom.window.document.getElementById('boot-screen'), null);
  } finally {
    dom.window.close();
  }
});

test('a repeat visitor receives a short continuation instead of repeating the introduction', async () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const bundle = readFileSync(new URL('../ui-kit/app.bundle.js', import.meta.url), 'utf8');
  const dom = new JSDOM(html, {
    url: 'https://nastardamus.example/',
    pretendToBeVisual: true,
    runScripts: 'outside-only'
  });

  try {
    dom.window.localStorage.setItem('nastardamus-profile-v1', JSON.stringify({
      name: 'Михаил',
      gender: 'male',
      age: 37,
      city: 'Москва',
      completed: true
    }));
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    dom.window.localStorage.setItem('nastardamus-daily-greeting-v1', JSON.stringify({ lastSeenDate: today }));
    dom.window.scrollTo = () => {};
    dom.window.eval(bundle);

    const mount = dom.window.document.getElementById('premium-app');
    assert.equal(mount.dataset.screen, 'welcome');
    assert.ok(mount.textContent.includes('ВЫ СНОВА В КРУГЕ'));
    assert.ok(mount.textContent.includes('А ты снова здесь, Михаил'));

    await new Promise((resolve) => dom.window.setTimeout(resolve, 0));
    assert.equal(mount.dataset.screen, 'welcome');

    click(dom.window.document, 'Продолжить');
    assert.equal(mount.dataset.screen, 'home');
  } finally {
    dom.window.close();
  }
});
