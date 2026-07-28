import {
  AppShell, ScreenContainer, BrandLogo, AppHeader, GreetingCard,
  FortuneWheelCard, SectionTitle, QuickAccessGrid, BottomNavigation, UploadCard,
  GoalSelector, EnergyHandsScene, MysticButton, PriceLine,
  DataStatusCard, ActionGroup, CompatibilityHero, Tabs, MysticCard, ServiceCard,
  StatusBadge, GlowDivider, MetricsList, ForecastGrid, FinalScoreCard
} from './components/index.js';
import { h } from './core/dom.js';
import { Icon } from './core/icon.js';

let tg = null;
let telegramConfigured = false;

const mount = document.getElementById('premium-app');
const toast = document.getElementById('premium-toast');
const JOURNAL_KEY = 'nastardamus-journal-v2';
const SUPPORT_KEY = 'nastardamus-support-v4';
const HOROSCOPE_KEY = 'nastardamus-horoscope-v1';

const ZODIAC_SIGNS = {
  aries: { label: 'Овен' }, taurus: { label: 'Телец' }, gemini: { label: 'Близнецы' },
  cancer: { label: 'Рак' }, leo: { label: 'Лев' }, virgo: { label: 'Дева' },
  libra: { label: 'Весы' }, scorpio: { label: 'Скорпион' }, sagittarius: { label: 'Стрелец' },
  capricorn: { label: 'Козерог' }, aquarius: { label: 'Водолей' }, pisces: { label: 'Рыбы' }
};

const CARD_IMAGES = {
  'Шут': 'fool.webp', 'Маг': 'magician.webp', 'Верховная Жрица': 'high-priestess.webp',
  'Императрица': 'empress.webp', 'Император': 'emperor.webp', 'Иерофант': 'hierophant.webp',
  'Влюблённые': 'lovers.webp', 'Колесница': 'chariot.webp', 'Сила': 'strength.webp',
  'Отшельник': 'hermit.webp', 'Колесо Фортуны': 'wheel-of-fortune.webp',
  'Справедливость': 'justice.webp', 'Повешенный': 'hanged-man.webp', 'Смерть': 'death.webp',
  'Умеренность': 'temperance.webp', 'Дьявол': 'devil.webp', 'Башня': 'tower.webp',
  'Звезда': 'star.webp', 'Луна': 'moon.webp', 'Солнце': 'sun.webp',
  'Суд': 'judgement.webp', 'Мир': 'world.webp'
};

const SPREADS = {
  'one-sign': { label: 'Один знак', count: 1, positions: ['Главный знак'] },
  'three-paths': { label: 'Три пути', count: 3, positions: ['Истоки', 'Настоящее', 'Следующий шаг'] },
  decision: { label: 'Перекрёсток', count: 4, positions: ['Суть выбора', 'Первый путь', 'Второй путь', 'Внутренняя цена'] },
  career: { label: 'Путь предназначения', count: 5, positions: ['Ресурс', 'Препятствие', 'Талант', 'Действие', 'Перспектива'] },
  relationship: { label: 'Два сердца', count: 6, positions: ['Ваш вклад', 'Вклад другого', 'Притяжение', 'Напряжение', 'Разговор', 'Общий путь'] },
  shadow: { label: 'Тень и ресурс', count: 3, positions: ['Скрытая тема', 'Сила внутри', 'Возвращение выбора'] },
  'celtic-cross': { label: 'Кельтский крест', count: 10, positions: ['Суть', 'Пересечение', 'Основание', 'Прошлое', 'Возможность', 'Ближайший путь', 'Ваша позиция', 'Окружение', 'Надежда и страх', 'Направление'] }
};

const params = new URLSearchParams(location.search);
const requestedScreen = params.get('screen');
const requestedInviteGoal = ['love', 'friendship', 'business', 'creative'].includes(params.get('invite'))
  ? params.get('invite')
  : 'love';
const state = {
  screen: requestedScreen || 'welcome',
  wallet: null,
  walletStatus: 'loading',
  walletMessage: '',
  busy: false,
  spread: 'three-paths',
  tarotQuestion: '',
  tarotDeck: [],
  tarotCards: [],
  result: null,
  natalDate: '',
  natalTime: '12:00',
  photoMode: 'energy',
  photoOne: '',
  photoTwo: '',
  photoNameOne: '',
  photoNameTwo: '',
  photoConcern: '',
  photoConsentOwn: false,
  photoConsentPartner: false,
  photoAdultConfirmed: false,
  palmOne: '',
  palmTwo: '',
  palmGoal: requestedInviteGoal,
  inviteGoal: requestedInviteGoal,
  partnerName: '',
  palmConsentOwn: false,
  palmConsentPartner: false,
  palmAdultConfirmed: false,
  publicConfig: {
    wheelEnabled: false,
    palmLinkEnabled: false,
    jointReadingsEnabled: true,
    manualPhotoReview: true,
    adultOnly: true,
    serviceCatalog: {},
    wheelRewards: [],
    wheelDailySpins: 1,
    dailyHoroscopeEnabled: true,
    paymentsEnabled: true,
    sbpTopupsEnabled: false,
    botUsername: 'BelonTip_bot'
  },
  wheelStatus: null,
  wheelPrize: null,
  wheelRotation: 0,
  topupAmount: '',
  topupReturnScreen: 'services',
  horoscope: readJSON(HOROSCOPE_KEY, { sign: 'aries', enabled: false, reading: '', date: '' }),
  support: readJSON(SUPPORT_KEY, []),
  supportDraft: ''
};

let toastTimer;

function configureTelegram() {
  const webApp = window.Telegram?.WebApp;
  if (!webApp) return false;
  tg = webApp;
  if (!telegramConfigured) {
    tg.ready?.();
    tg.expand?.();
    tg.setHeaderColor?.('#070913');
    tg.setBackgroundColor?.('#070913');
    telegramConfigured = true;
  }
  return true;
}

function readJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}

function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage can be unavailable */ }
}

function notify(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add('is-visible');
  toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2800);
}

function pulse(type = 'light') {
  tg?.HapticFeedback?.impactOccurred?.(type);
  if (!tg) navigator.vibrate?.(type === 'medium' ? 35 : 16);
}

function firstName() {
  return String(tg?.initDataUnsafe?.user?.first_name || '').trim().slice(0, 30) || 'Искатель';
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function serviceConfig(id) {
  return state.publicConfig.serviceCatalog?.[id] || { enabled: true, price: null };
}

function serviceBadge(id, fallback = '') {
  const price = serviceConfig(id).price;
  return price === null || price === undefined || price === ''
    ? fallback
    : `${Number(price).toLocaleString('ru-RU')} S`;
}

function serviceEntitlement(id) {
  return (state.wallet?.entitlements || []).find((item) => item.service_id === id && Number(item.quantity) > 0);
}

function confirmServicePayment(serviceId) {
  if (!tg?.initData) return true;
  const service = serviceConfig(serviceId);
  const gift = serviceEntitlement(serviceId);
  if (gift) {
    return window.confirm(`Использовать подарок «${service.title || serviceId}»? Ответ откроется после подтверждения.`);
  }
  const price = Number(service.price);
  if (!Number.isFinite(price) || price <= 0) {
    notify('Администратор ещё не настроил цену этой услуги');
    return false;
  }
  const available = Number(state.wallet?.wallet?.available || 0);
  if (state.walletStatus === 'ready' && available < price) {
    const minimum = Number(state.wallet?.config?.sbpMinimumSilarum || 10);
    state.topupAmount = String(Math.max(minimum, Math.ceil((price - available) * 100) / 100));
    state.topupReturnScreen = state.screen;
    navigate('topup');
    notify('Для ответа нужно пополнить SILARUM');
    return false;
  }
  return window.confirm(`Оплатить ${formatMoney(price)} SILARUM за услугу «${service.title || serviceId}»? Ответ Эзотериума откроется только после успешного списания.`);
}

function navigate(screen, { replace = false } = {}) {
  state.screen = screen;
  const url = new URL(location.href);
  url.searchParams.set('screen', screen);
  history[replace ? 'replaceState' : 'pushState']({}, '', url);
  render();
  window.scrollTo?.({ top: 0, behavior: 'auto' });
  if (screen === 'profile' || screen === 'topup') loadWallet({ force: true });
}

function activeTab(screen = state.screen) {
  if (screen === 'home' || screen === 'wheel' || screen === 'horoscope') return 'home';
  if (screen === 'history') return 'history';
  if (screen === 'profile' || screen === 'withdrawal' || screen === 'topup') return 'profile';
  if (screen === 'services' || screen === 'support') return 'services';
  return 'magic';
}

function shell(content, { tabs = true, active = activeTab() } = {}) {
  return AppShell({ className: 'premium-shell', children: [
    ScreenContainer({ className: 'premium-screen premium-screen-transition', children: [h('div', { className: 'premium-stack' }, content)] }),
    tabs ? BottomNavigation({ active, onNavigate: handleBottomNavigation }) : null
  ] });
}

function handleBottomNavigation(target) {
  pulse();
  const routes = { home: 'home', services: 'services', magic: 'tarot', history: 'history', profile: 'profile' };
  navigate(routes[target] || 'home');
}

function screenHeader(title, subtitle, back = 'home') {
  return AppHeader({ title, subtitle, onBack: () => navigate(back), rightIcon: 'info', onRight: () => navigate('support') });
}

function serviceTile(icon, title, description, onClick, badge = '') {
  return h('button', { className: 'premium-service-tile', attrs: { type: 'button' }, on: { click: onClick } },
    h('span', { className: 'premium-service-icon' }, Icon(icon, { size: 30 })),
    h('span', {}, h('strong', { text: title }), h('small', { text: description })),
    badge ? h('b', { className: 'premium-service-badge', text: badge }) : null
  );
}

function field(label, control, hint = '') {
  return h('label', { className: 'premium-field' }, h('span', { text: label }), control, hint ? h('small', { text: hint }) : null);
}

function consentRow(text, checked, onChange) {
  const input = h('input', {
    attrs: { type: 'checkbox', checked },
    on: { change: (event) => onChange(event.target.checked) }
  });
  input.checked = checked;
  return h('label', { className: 'premium-consent' }, input, h('span', { text }));
}

function openEnabledFeature(enabled, screen, message) {
  if (!enabled) return notify(message);
  navigate(screen);
}

function textInput({ value = '', placeholder = '', type = 'text', onInput, attrs = {} } = {}) {
  return h('input', { attrs: { type, value, placeholder, ...attrs }, on: { input: (event) => onInput?.(event.target.value) } });
}

function textarea({ value = '', placeholder = '', onInput, maxLength = 700 } = {}) {
  const node = h('textarea', { attrs: { placeholder, maxlength: maxLength }, on: { input: (event) => onInput?.(event.target.value) } });
  node.value = value;
  return node;
}

function selectField(options, value, onChange) {
  const node = h('select', { on: { change: (event) => onChange(event.target.value) } },
    Object.entries(options).map(([key, option]) => h('option', { attrs: { value: key }, text: option.label }))
  );
  node.value = value;
  return node;
}

function loadingCard(message = 'Эзотериум соединяет знаки…') {
  return MysticCard({ className: 'premium-loading-card', children: [
    h('span', { className: 'premium-loader', attrs: { 'aria-hidden': 'true' } }, h('i'), h('i'), h('i')),
    h('strong', { text: message })
  ] });
}

function welcomeScreen() {
  const enter = MysticButton({ text: 'Открыть пространство', icon: 'sparkle', variant: 'primary', onClick: () => {
    pulse('medium');
    state.screen = 'home';
    const url = new URL(location.href);
    url.searchParams.delete('screen');
    history.replaceState({}, '', url);
    render();
  } });
  return shell([
    h('section', { className: 'premium-welcome' },
      h('img', { className: 'premium-welcome-art', attrs: { src: '/images/splash-v2.webp', alt: '' } }),
      h('div', { className: 'premium-welcome-scrim' }),
      h('div', { className: 'premium-welcome-content' },
        BrandLogo(), h('p', { className: 'premium-kicker', text: 'ПРОСТРАНСТВО ЭЗОТЕРИУМА' }),
        h('h1', { text: 'Услышьте свой знак' }),
        h('p', { text: 'Таро, звёзды, символические фото-чтения и личный дневник в одном пространстве.' }),
        enter,
        h('small', { text: 'Толкования созданы для размышления и развлечения.' })
      )
    )
  ], { tabs: false });
}

function homeScreen() {
  const wallet = state.wallet?.wallet || { freeSpins: 0 };
  const header = h('header', { className: 'premium-home-header' }, BrandLogo(),
    h('button', { className: 'premium-avatar-button', attrs: { type: 'button', 'aria-label': 'Открыть профиль' }, on: { click: () => navigate('profile') } }, Icon('profile', { size: 23 }))
  );
  const wheel = FortuneWheelCard({ caption: 'Одна из коробок хранит вашу услугу' });
  const wheelEnabled = state.publicConfig.wheelEnabled === true;
  const wheelWrap = h('div', { className: 'premium-wheel-wrap' }, wheel,
    h('button', { className: 'premium-wheel-action', attrs: { type: 'button', 'aria-label': 'Открыть Колесо Фортуны' }, on: { click: () => openEnabledFeature(wheelEnabled, 'wheel', 'Колесо отключено администратором') } }),
    h('div', { className: 'premium-wheel-result', text: wheelEnabled ? 'Коснитесь, чтобы открыть' : 'Временно отключено' })
  );

  return shell([
    header,
    GreetingCard({ username: firstName(), message: 'Слушай знаки. Доверься интуиции.' }),
    wheelWrap,
    SectionTitle({ text: 'Быстрый доступ' }),
    QuickAccessGrid({ items: [
      { art: 'shortcut-destiny-hearts', title: 'Путь двух судеб', onClick: () => openEnabledFeature(state.publicConfig.palmLinkEnabled, 'palm', 'PalmLink временно отключён') },
      { art: 'tarot-deck', title: 'Таро расклад', onClick: () => navigate('tarot') },
      { art: 'shortcut-astro-orbit', title: 'Гороскоп дня', onClick: () => navigate('horoscope') },
      { art: 'shortcut-fortune-compass', title: 'Колесо Фортуны', badge: wallet.freeSpins ? `+${wallet.freeSpins}` : '', onClick: () => openEnabledFeature(wheelEnabled, 'wheel', 'Колесо отключено администратором') }
    ] })
  ], { active: 'home' });
}

function walletStatusText() {
  if (state.walletStatus === 'loading') return 'Обновляем лицевой счёт…';
  if (state.walletStatus === 'ready') return `Доступно ${formatMoney(state.wallet?.wallet?.available)} SILARUM`;
  return state.walletMessage || 'Счёт доступен внутри Telegram';
}

function servicesScreen() {
  return shell([
    screenHeader('Услуги', 'Выберите пространство', 'home'),
    h('div', { className: 'premium-service-list' },
      serviceTile('tarot', 'Семь раскладов Таро', 'От одной карты до Кельтского креста', () => navigate('tarot'), serviceBadge('tarot')),
      serviceTile('orbit', 'Натальная подсказка', 'Сильные стороны и текущий ориентир', () => navigate('natal'), serviceBadge('natal')),
      serviceTile('sparkle', 'Энергетический след', 'Фото как личный символ и точка опоры', () => navigate('photo-energy'), serviceBadge('photo_energy')),
      serviceTile('sparkle', 'Определение порчи', 'Фото, ваша история и совет Эзотериума', () => navigate('photo-damage'), serviceBadge('photo_damage')),
      serviceTile('users', 'Совместимость по фото', 'Два образа, диалог и точки опоры', () => openEnabledFeature(state.publicConfig.jointReadingsEnabled, 'photo-compat', 'Совместные чтения временно отключены'), serviceBadge('photo_compatibility')),
      serviceTile('hand', 'Путь двух судеб', 'Ладони и совместный ритуал', () => openEnabledFeature(state.publicConfig.palmLinkEnabled, 'palm', 'PalmLink временно отключён'), serviceBadge('palmlink', '')),
      serviceTile('orbit', 'Гороскоп дня', 'Личный знак и ежедневное послание', () => navigate('horoscope'), ''),
      serviceTile('info', 'Спросить Эзотериума', 'Помощник по функциям приложения', () => navigate('support'))
    )
  ], { active: 'services' });
}

function wheelScreen() {
  if (state.publicConfig.wheelEnabled !== true) {
    return shell([
      screenHeader('Колесо Фортуны', 'Сегодня колесо отдыхает', 'home'),
      MysticCard({ className: 'premium-empty-state', children: [h('p', { text: 'Эзотериум готовит новые подарки.' })] })
    ], { active: 'home' });
  }
  const wrap = h('div', { className: 'premium-wheel-wrap premium-wheel-screen' }, FortuneWheelCard({ caption: 'Коробка раскроется после остановки' }),
    h('div', { className: 'premium-wheel-result', text: state.wheelPrize ? 'Подарок уже найден' : 'Коснитесь кнопки и доверьтесь знаку' })
  );
  wrap.style.setProperty('--wheel-rotation', `${state.wheelRotation}deg`);
  const spin = MysticButton({ text: state.busy ? 'Колесо вращается…' : 'Открыть коробку', icon: 'wheel', variant: 'gold', disabled: state.busy, onClick: () => spinWheel(wrap) });
  return shell([
    screenHeader('Колесо Фортуны', 'Подарок дня от Эзотериума', 'home'), wrap, spin,
    state.wheelPrize ? prizeReveal(state.wheelPrize) : null
  ], { active: 'home' });
}

async function spinWheel(wrap) {
  if (wrap.classList.contains('is-spinning') || state.busy) return;
  wrap.classList.add('is-spinning');
  state.busy = true;
  wrap.querySelector('.premium-wheel-result').textContent = 'Коробки выбирают ваш подарок…';
  pulse('medium');
  try {
    const [data] = await Promise.all([
      api('/api/wheel', { method: 'POST', body: { idempotencyKey: uniqueId('wheel') } }),
      new Promise((resolve) => setTimeout(resolve, 1800))
    ]);
    state.wheelPrize = data.reward;
    wrap.classList.remove('is-spinning');
    const rewardKey = String(data.reward?.id || data.reward?.serviceId || 'gift');
    const boxIndex = [...rewardKey].reduce((sum, symbol) => sum + symbol.charCodeAt(0), 0) % 10;
    state.wheelRotation = (5 * 360) + (boxIndex * 36);
    wrap.style.setProperty('--wheel-rotation', `${state.wheelRotation}deg`);
    wrap.classList.add('is-settling');
    wrap.querySelector('.premium-wheel-result').textContent = 'Стрелка выбрала вашу коробку…';
    await new Promise((resolve) => setTimeout(resolve, 1250));
    state.wheelRotation %= 360;
    state.busy = false;
    pulse('medium');
    render();
  } catch (error) {
    wrap.classList.remove('is-spinning');
    state.busy = false;
    notify(apiErrorMessage(error));
    render();
  }
}

function prizeReveal(reward) {
  const artwork = ({
    tarot: 'tarot-deck',
    tarot_relationship: 'tarot-deck',
    natal: 'astrology-forecast',
    photo_energy: 'photo-energy-imprint',
    photo_damage: 'result-magic-seal',
    photo_compatibility: 'two-photo-compatibility',
    palmlink: 'connection-heart'
  })[reward.serviceId] || 'cosmic-card';
  return MysticCard({ className: 'premium-prize-reveal', children: [
    h('div', { className: 'premium-prize-art', attrs: { 'aria-hidden': 'true' } },
      h('img', { attrs: { src: `/ui-kit/assets/art-v2/${artwork}.png`, alt: '', draggable: 'false' } }),
      h('span', { text: reward.quantity > 1 ? `×${reward.quantity}` : '✦' })
    ),
    h('p', { className: 'premium-kicker', text: 'КОРОБКА РАСКРЫТА' }),
    h('h2', { text: reward.title }),
    h('p', { text: reward.quantity > 1 ? `Вы выиграли ${reward.quantity} услуги` : 'Вы выиграли эту услугу — она уже добавлена в профиль' }),
    MysticButton({ text: 'Перейти к подарку', icon: 'sparkle', variant: 'primary', onClick: () => navigate(rewardScreen(reward.serviceId)) })
  ] });
}

function rewardScreen(serviceId) {
  return ({
    tarot: 'tarot', tarot_relationship: 'tarot', natal: 'natal',
    photo_energy: 'photo-energy', photo_damage: 'photo-damage',
    photo_compatibility: 'photo-compat', palmlink: 'palm'
  })[serviceId] || 'services';
}

function tarotScreen() {
  const spread = selectField(SPREADS, state.spread, (value) => { state.spread = value; render(); });
  const question = textarea({ value: state.tarotQuestion, placeholder: 'Например: что поможет мне принять решение?', onInput: (value) => { state.tarotQuestion = value; }, maxLength: 500 });
  return shell([
    screenHeader('Расклад Таро', 'Семь вариантов для разных вопросов', 'services'),
    MysticCard({ className: 'premium-form-card', children: [
      field('Вид расклада', spread),
      field('Ваш вопрос', question, 'Не вводите адреса, пароли и платёжные данные.')
    ] }),
    state.spread === 'relationship'
      ? h('div', { className: 'premium-invite-panel' },
          SectionTitle({ text: 'Кого вы приглашаете?' }),
          GoalSelector({ value: state.inviteGoal, onChange: (goal) => { state.inviteGoal = goal; render(); } }),
          MysticButton({ text: 'Пригласить второго человека', icon: 'send', variant: 'gold', onClick: () => shareInvite('tarot') })
        )
      : null,
    MysticButton({ text: 'Перейти к выбору карт', icon: 'tarot', variant: 'primary', onClick: startTarot })
  ]);
}

function startTarot() {
  if (!state.tarotQuestion.trim()) return notify('Сформулируйте вопрос');
  state.tarotCards = [];
  state.tarotDeck = shuffle(Object.keys(CARD_IMAGES)).slice(0, Math.max(12, SPREADS[state.spread].count + 6));
  pulse('medium');
  navigate('tarot-draw');
}

function tarotDrawScreen() {
  const spread = SPREADS[state.spread] || SPREADS['three-paths'];
  const cards = h('div', { className: 'premium-tarot-grid' }, state.tarotDeck.map((name, index) => {
    const selected = state.tarotCards.includes(name);
    return h('button', {
      className: `premium-tarot-card ${selected ? 'is-selected' : ''}`,
      attrs: { type: 'button', disabled: selected || state.tarotCards.length >= spread.count, 'aria-label': selected ? name : `Выбрать карту ${index + 1}` },
      on: { click: () => selectTarotCard(name) }
    }, selected ? h('img', { attrs: { src: `/images/cards/${CARD_IMAGES[name]}`, alt: name } }) : h('span', { text: '✦' }));
  }));
  return shell([
    screenHeader(spread.label, `Выбрано ${state.tarotCards.length} из ${spread.count}`, 'tarot'),
    h('p', { className: 'premium-centered-copy', text: state.tarotCards.length < spread.count ? 'Коснитесь карт, которые вас притягивают' : 'Карты выбраны. Попросите Эзотериума соединить их значения.' }),
    cards,
    state.tarotCards.length === spread.count
      ? MysticButton({ text: state.busy ? 'Читаем знаки…' : 'Получить толкование', icon: 'sparkle', variant: 'primary', disabled: state.busy, onClick: submitTarot })
      : null,
    state.busy ? loadingCard() : null
  ]);
}

function selectTarotCard(name) {
  const count = SPREADS[state.spread].count;
  if (state.tarotCards.includes(name) || state.tarotCards.length >= count) return;
  state.tarotCards.push(name);
  pulse('medium');
  render();
}

async function submitTarot() {
  if (state.busy) return;
  const spread = SPREADS[state.spread];
  const serviceId = state.spread === 'relationship' ? 'tarot_relationship' : 'tarot';
  if (!confirmServicePayment(serviceId)) return;
  state.busy = true;
  render();
  try {
    const answer = await requestReading('tarot', { question: state.tarotQuestion.trim(), cards: state.tarotCards, spread: state.spread, positions: spread.positions }, serviceId);
    state.result = { id: uniqueId('tarot'), type: `Расклад «${spread.label}»`, title: state.tarotQuestion.trim(), body: answer, cards: [...state.tarotCards], createdAt: new Date().toISOString(), favorite: false };
    navigate('tarot-result');
  } catch (error) {
    notify(apiErrorMessage(error));
  } finally {
    state.busy = false;
    render();
  }
}

function tarotResultScreen() {
  const result = state.result;
  if (!result) return tarotScreen();
  return resultScreen({ title: result.type, subtitle: 'Ваше персональное толкование', back: 'tarot', result, showCards: true });
}

function natalScreen() {
  const date = textInput({ type: 'date', value: state.natalDate, onInput: (value) => { state.natalDate = value; } });
  const time = textInput({ type: 'time', value: state.natalTime, onInput: (value) => { state.natalTime = value; } });
  return shell([
    screenHeader('Натальная подсказка', 'Ваш символический космический отпечаток', 'services'),
    MysticCard({ className: 'premium-form-card', children: [field('Дата рождения', date), field('Время рождения', time)] }),
    MysticButton({ text: state.busy ? 'Соединяем ориентиры…' : 'Открыть подсказку', icon: 'orbit', variant: 'primary', disabled: state.busy, onClick: submitNatal }),
    state.busy ? loadingCard('Смотрим на дату и время…') : null
  ]);
}

async function submitNatal() {
  if (!state.natalDate) return notify('Укажите дату рождения');
  if (state.busy) return;
  if (!confirmServicePayment('natal')) return;
  state.busy = true; render();
  try {
    const answer = await requestReading('natal', { date: state.natalDate, time: state.natalTime || '12:00' }, 'natal');
    state.result = { id: uniqueId('natal'), type: 'Натальная подсказка', title: state.natalDate, body: answer, cards: [], createdAt: new Date().toISOString(), favorite: false };
    navigate('natal-result');
  } catch (error) { notify(apiErrorMessage(error)); }
  finally { state.busy = false; render(); }
}

function natalResultScreen() {
  return state.result ? resultScreen({ title: 'Натальная подсказка', subtitle: 'Ваши ориентиры', back: 'natal', result: state.result }) : natalScreen();
}

function photoScreen(mode) {
  state.photoMode = mode;
  const isPair = mode === 'compatibility';
  const isDamage = mode === 'damage';
  const title = isPair ? 'Совместимость по фото' : isDamage ? 'Определение порчи' : 'Энергетический след';
  const subtitle = isPair ? 'Два образа и бережный диалог' : isDamage ? 'Фото, ваша история и личный совет' : 'Фото как символ вашего состояния';
  const firstUpload = imageUpload({ title: isPair ? 'Первое фото' : 'Загрузите фотографию', image: state.photoOne, onImage: (image) => { state.photoOne = image; render(); } });
  const secondUpload = isPair ? imageUpload({ title: 'Второе фото', image: state.photoTwo, onImage: (image) => { state.photoTwo = image; render(); } }) : null;
  return shell([
    screenHeader(title, subtitle, 'services'),
    h('div', { className: isPair ? 'premium-upload-grid' : '' }, firstUpload, secondUpload),
    isPair ? MysticCard({ className: 'premium-form-card', children: [
      field('Имя первого человека', textInput({ value: state.photoNameOne, placeholder: 'Имя', onInput: (value) => { state.photoNameOne = value; } })),
      field('Имя второго человека', textInput({ value: state.photoNameTwo, placeholder: 'Имя', onInput: (value) => { state.photoNameTwo = value; } }))
    ] }) : null,
    isPair ? h('div', { className: 'premium-invite-panel' },
      SectionTitle({ text: 'Сфера вашей связи' }),
      GoalSelector({ value: state.inviteGoal, onChange: (goal) => { state.inviteGoal = goal; render(); } }),
      MysticButton({ text: 'Пригласить человека', icon: 'send', variant: 'gold', onClick: () => shareInvite('photo') })
    ) : null,
    field(isDamage ? 'Опишите, что происходит' : 'Что важно понять?', textarea({
      value: state.photoConcern,
      placeholder: isPair ? 'Что важно проговорить в этих отношениях?' : isDamage ? 'Что изменилось, чего вы опасаетесь и когда это началось?' : 'Что сейчас беспокоит и где найти опору?',
      onInput: (value) => { state.photoConcern = value; },
      maxLength: 600
    })),
    consentRow(
      'Я согласен на обработку своей фотографии защищённым внешним сервисом для этого чтения.',
      state.photoConsentOwn,
      (checked) => { state.photoConsentOwn = checked; }
    ),
    isPair ? consentRow(
      'Второй человек дал согласие на использование своей фотографии для этого чтения.',
      state.photoConsentPartner,
      (checked) => { state.photoConsentPartner = checked; }
    ) : null,
    isPair && state.publicConfig.adultOnly !== false ? consentRow(
      'Оба участника совершеннолетние.',
      state.photoAdultConfirmed,
      (checked) => { state.photoAdultConfirmed = checked; }
    ) : null,
    MysticButton({ text: state.busy ? 'Эзотериум изучает образ…' : isDamage ? 'Получить разбор Эзотериума' : 'Получить символическое чтение', icon: 'sparkle', variant: 'primary', disabled: state.busy, onClick: () => submitPhoto(isPair, isDamage) }),
    state.busy ? loadingCard('Изучаем свет, композицию и вашу историю…') : null
  ]);
}

function imageUpload({ title, image, onImage }) {
  const upload = UploadCard({ title: image ? 'Фото загружено' : title, subtitle: image ? 'Коснитесь, чтобы заменить' : 'JPG, PNG или WEBP до 10 МБ', status: image ? 'ready' : 'empty' });
  upload.type = 'button';
  upload.classList.add('premium-upload-card');
  const input = h('input', { attrs: { type: 'file', accept: 'image/jpeg,image/png,image/webp', hidden: true } });
  if (image) upload.prepend(h('img', { className: 'premium-upload-preview', attrs: { src: image, alt: '' } }));
  upload.addEventListener('click', () => input.click());
  input.addEventListener('change', async () => {
    try { onImage(await prepareImage(input.files?.[0])); pulse('medium'); }
    catch (error) { notify(error.message || 'Не удалось обработать фото'); }
  });
  return h('div', { className: 'premium-upload-wrap' }, input, upload);
}

async function prepareImage(file) {
  if (!file) throw new Error('Выберите фотографию');
  if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) throw new Error('Используйте JPG, PNG или WEBP');
  if (file.size > 10 * 1024 * 1024) throw new Error('Файл больше 10 МБ');
  const original = await fileToDataUrl(file);
  if (original.length <= 1_650_000) return original;
  const image = await loadImage(original);
  const scale = Math.min(1, 1280 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
  let quality = 0.8;
  let data = canvas.toDataURL('image/webp', quality);
  while (data.length > 1_650_000 && quality > 0.45) { quality -= 0.08; data = canvas.toDataURL('image/webp', quality); }
  if (data.length > 1_750_000) throw new Error('Не удалось уменьшить фото — выберите другое');
  return data;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Не удалось открыть изображение'));
    image.src = src;
  });
}

async function submitPhoto(pair, damage = false) {
  if (!state.photoOne || (pair && !state.photoTwo)) return notify(pair ? 'Загрузите оба фото' : 'Загрузите фотографию');
  if (!state.photoConsentOwn) return notify('Подтвердите согласие на обработку своей фотографии');
  if (pair && !state.photoConsentPartner) return notify('Подтвердите согласие второго человека');
  if (pair && state.publicConfig.adultOnly !== false && !state.photoAdultConfirmed) {
    return notify('Подтвердите совершеннолетие обоих участников');
  }
  if (state.busy) return;
  const feature = pair ? 'photo_compatibility' : damage ? 'photo_damage' : 'photo_energy';
  if (!confirmServicePayment(feature)) return;
  state.busy = true; render();
  try {
    const payload = pair
      ? {
          concern: state.photoConcern || 'Что важно понять о динамике этих отношений?',
          firstName: state.photoNameOne || 'Первый человек',
          secondName: state.photoNameTwo || 'Второй человек',
          firstImage: state.photoOne,
          secondImage: state.photoTwo,
          consentOwn: true,
          consentPartner: true,
          adultConfirmed: state.photoAdultConfirmed
        }
      : {
          concern: state.photoConcern || (damage ? 'Почему я чувствую чужое негативное влияние и как вернуть опору?' : 'Что сейчас важно понять и где вернуть опору?'),
          image: state.photoOne,
          consentOwn: true
        };
    const answer = await requestReading(feature, payload, feature);
    state.result = { id: uniqueId(feature), type: pair ? 'Совместимость по фото' : damage ? 'Разбор Эзотериума' : 'Энергетический след', title: state.photoConcern || 'Символическое фото-чтение', body: answer, cards: [], createdAt: new Date().toISOString(), favorite: false };
    navigate('photo-result');
  } catch (error) { notify(apiErrorMessage(error)); }
  finally { state.busy = false; render(); }
}

function photoResultScreen() {
  const back = state.photoMode === 'compatibility' ? 'photo-compat' : state.photoMode === 'damage' ? 'photo-damage' : 'photo-energy';
  return state.result ? resultScreen({ title: state.result.type, subtitle: 'Личный ответ Эзотериума', back, result: state.result }) : servicesScreen();
}

function palmScreen() {
  if (state.publicConfig.palmLinkEnabled !== true) {
    return shell([
      screenHeader('Путь двух судеб', 'Функция временно отключена', 'services'),
      MysticCard({ className: 'premium-empty-state', children: [h('p', { text: 'Эзотериум готовит это пространство.' })] })
    ]);
  }
  const upload = imageUpload({ title: 'Загрузите фото своей ладони', image: state.palmOne, onImage: (image) => { state.palmOne = image; render(); } });
  const selector = GoalSelector({ value: state.palmGoal, onChange: (goal) => { state.palmGoal = goal; render(); } });
  return shell([
    screenHeader('Путь двух судеб', 'Найди связь через символы ладоней', 'services'),
    upload,
    SectionTitle({ text: 'Цель поиска' }), selector,
    EnergyHandsScene(),
    MysticButton({ text: 'Пригласить человека', icon: 'send', variant: 'gold', onClick: () => shareInvite('palm') }),
    MysticButton({ text: 'Продолжить ритуал', icon: 'heart', variant: 'primary', onClick: () => state.palmOne ? navigate('ritual') : notify('Сначала загрузите фото ладони') }),
    PriceLine({ price: serviceConfig('palmlink').price })
  ]);
}

function ritualScreen() {
  const partnerUpload = imageUpload({ title: 'Добавьте ладонь партнёра', image: state.palmTwo, onImage: (image) => { state.palmTwo = image; render(); } });
  const actions = ActionGroup({ actions: [
    { text: 'Отправить приглашение', icon: 'send', variant: 'gold', onClick: shareInvite },
    { text: 'Вернуться к своей ладони', icon: 'arrow-left', variant: 'outline', onClick: () => navigate('palm') }
  ] });
  return shell([
    screenHeader('Совместный ритуал', 'Две ладони — одно символическое чтение', 'palm'),
    ServiceCard({ title: 'Путь двух судеб', description: 'Бережный анализ образов, точек притяжения и тем для разговора.', price: serviceConfig('palmlink').price }),
    DataStatusCard({ title: 'Ваши данные', status: state.palmOne ? 'ready' : 'waiting', description: state.palmOne ? 'Ваша ладонь загружена' : 'Фото отсутствует', meta: state.palmOne ? 'Готово к чтению' : 'Вернитесь на шаг назад', empty: !state.palmOne }),
    SectionTitle({ text: 'Данные партнёра' }), partnerUpload,
    field('Имя партнёра', textInput({ value: state.partnerName, placeholder: 'Имя', onInput: (value) => { state.partnerName = value; } })),
    consentRow(
      'Я согласен на обработку изображения своей ладони защищённым внешним сервисом.',
      state.palmConsentOwn,
      (checked) => { state.palmConsentOwn = checked; }
    ),
    consentRow(
      'Партнёр дал согласие на использование изображения своей ладони.',
      state.palmConsentPartner,
      (checked) => { state.palmConsentPartner = checked; }
    ),
    state.publicConfig.adultOnly !== false ? consentRow(
      'Оба участника совершеннолетние.',
      state.palmAdultConfirmed,
      (checked) => { state.palmAdultConfirmed = checked; }
    ) : null,
    SectionTitle({ text: 'Что дальше?' }),
    actions,
    MysticButton({ text: state.busy ? 'Соединяем образы…' : 'Получить совместное чтение', icon: 'sparkle', variant: 'primary', disabled: state.busy, onClick: submitPalmCompatibility }),
    state.busy ? loadingCard() : null
  ]);
}

async function shareInvite(flow = 'palm') {
  const goal = flow === 'palm' ? state.palmGoal : state.inviteGoal;
  const copy = {
    love: 'Хочу бережно посмотреть на то, что соединяет наши сердца.',
    friendship: 'Давай узнаем, в чём сила нашей дружбы и как её беречь.',
    business: 'Предлагаю увидеть сильные стороны нашего делового союза.',
    creative: 'Давай раскроем энергию нашего творческого союза.'
  }[goal];
  const flowName = flow === 'tarot' ? 'расклад на двоих' : flow === 'photo' ? 'чтение совместимости' : 'ритуал «Путь двух судеб»';
  const username = String(state.publicConfig.botUsername || 'BelonTip_bot').replace(/^@/, '');
  const inviteUrl = new URL(`https://t.me/${username}`);
  inviteUrl.searchParams.set('start', `invite_${flow}_${goal}`);
  const text = `${copy}\n\nПрисоединяйся к ${flowName} в Nastardamus — Эзотериум проведёт нас через знаки.`;
  try {
    const image = await fetch(`/images/invites/${goal}.png`).then((response) => response.ok ? response.blob() : null).catch(() => null);
    const file = image && typeof File === 'function' ? new File([image], `nastardamus-${goal}.png`, { type: 'image/png' }) : null;
    const shareData = { title: 'Приглашение от Nastardamus', text, url: inviteUrl.toString() };
    if (file && navigator.canShare?.({ files: [file] })) shareData.files = [file];
    if (navigator.share) await navigator.share(shareData);
    else await navigator.clipboard.writeText(`${text}\n${inviteUrl}`);
    notify('Приглашение готово');
  } catch (error) { if (error?.name !== 'AbortError') notify('Не удалось поделиться'); }
}

async function submitPalmCompatibility() {
  if (!state.palmOne || !state.palmTwo) return notify('Добавьте обе ладони');
  if (!state.palmConsentOwn) return notify('Подтвердите согласие на обработку своей ладони');
  if (!state.palmConsentPartner) return notify('Подтвердите согласие партнёра');
  if (state.publicConfig.adultOnly !== false && !state.palmAdultConfirmed) {
    return notify('Подтвердите совершеннолетие обоих участников');
  }
  if (state.busy) return;
  if (!confirmServicePayment('palmlink')) return;
  state.busy = true; render();
  try {
    const answer = await requestReading('photo_compatibility', {
      concern: `Что важно понять о связи с целью «${goalLabel(state.palmGoal)}»?`,
      firstName: firstName(), secondName: state.partnerName || 'Партнёр',
      firstImage: state.palmOne, secondImage: state.palmTwo,
      consentOwn: true,
      consentPartner: true,
      adultConfirmed: state.palmAdultConfirmed,
      source: 'palmlink'
    }, 'palmlink');
    state.result = { id: uniqueId('palm'), type: 'Путь двух судеб', title: `${firstName()} и ${state.partnerName || 'Партнёр'}`, body: answer, cards: [], createdAt: new Date().toISOString(), favorite: false };
    navigate('compatibility-result');
  } catch (error) { notify(apiErrorMessage(error)); }
  finally { state.busy = false; render(); }
}

function goalLabel(value) {
  return ({ love: 'любовь', friendship: 'дружба', business: 'деловой союз', creative: 'творческий союз' })[value] || 'общение';
}

function compatibilityResultScreen() {
  if (!state.result) return ritualScreen();
  const panels = [
    MysticCard({ className: 'premium-result-reading', children: [formatReading(state.result.body)] }),
    MysticCard({ className: 'premium-recommendations', children: [
      h('p', { text: 'Говорите о потребностях прямо, не ожидая чтения мыслей.' }),
      h('p', { text: 'Сверяйте символическое чтение с реальными поступками и диалогом.' }),
      h('p', { text: 'Сохраняйте личные границы и отдельное пространство каждого.' })
    ] })
  ];
  panels[1].hidden = true;
  const tabs = Tabs({ items: ['Чтение', 'Опора'], active: 0, onChange: (index) => {
    tabs.querySelectorAll('.n-tab').forEach((button, itemIndex) => button.classList.toggle('is-active', itemIndex === index));
    panels.forEach((panel, itemIndex) => { panel.hidden = itemIndex !== index; });
  } });
  return shell([
    screenHeader('Путь двух судеб', 'Совместное символическое чтение', 'ritual'),
    CompatibilityHero({ left: { name: firstName(), birthDate: 'Ваша ладонь', gender: 'female' }, right: { name: state.partnerName || 'Партнёр', birthDate: 'Вторая ладонь', gender: 'male' } }),
    tabs, ...panels,
    SectionTitle({ text: 'Символические аспекты' }),
    MetricsList(),
    SectionTitle({ text: 'Прогноз по сферам' }),
    ForecastGrid(),
    FinalScoreCard({ score: null, message: 'Вывод раскрыт в тексте чтения' }),
    h('div', { className: 'n-share-actions' },
      MysticButton({ text: 'Сохранить', icon: 'save', variant: 'primary', onClick: () => saveResult(state.result) }),
      MysticButton({ text: 'Поделиться', icon: 'share', variant: 'gold', onClick: () => shareResult(state.result) })
    )
  ]);
}

function resultScreen({ title, subtitle, back, result, showCards = false }) {
  return shell([
    screenHeader(title, subtitle, back),
    showCards ? h('div', { className: 'premium-result-cards' }, result.cards.map((name) => h('figure', {}, h('img', { attrs: { src: `/images/cards/${CARD_IMAGES[name]}`, alt: name } }), h('figcaption', { text: name })))) : null,
    MysticCard({ className: 'premium-result-reading', children: [formatReading(result.body)] }),
    h('div', { className: 'n-share-actions' },
      MysticButton({ text: 'Сохранить', icon: 'save', variant: 'primary', onClick: () => saveResult(result) }),
      MysticButton({ text: 'Поделиться', icon: 'share', variant: 'gold', onClick: () => shareResult(result) })
    ),
    MysticButton({ text: 'Вернуться к услугам', icon: 'services', variant: 'outline', onClick: () => navigate('services') })
  ]);
}

function formatReading(value) {
  const text = String(value || '').trim();
  if (!text) return h('p', { text: 'Ответ пока не получен.' });
  return h('div', { className: 'premium-reading-copy' }, text.split(/\n{2,}/).map((paragraph) => h('p', { text: paragraph })));
}

function saveResult(result) {
  if (!result) return notify('Сначала получите результат');
  const entries = readJSON(JOURNAL_KEY, []);
  if (entries.some((entry) => entry.id === result.id)) return notify('Этот результат уже сохранён');
  entries.unshift(result);
  writeJSON(JOURNAL_KEY, entries.slice(0, 50));
  notify('Сохранено в историю');
}

async function shareResult(result) {
  const text = `${result.type}: ${result.title}\n\n${result.body}\n\nNastardamus`;
  try {
    if (navigator.share) await navigator.share({ title: result.type, text });
    else await navigator.clipboard.writeText(text);
    notify('Результат готов к отправке');
  } catch (error) { if (error?.name !== 'AbortError') notify('Не удалось поделиться'); }
}

function horoscopeScreen() {
  const sign = selectField(ZODIAC_SIGNS, state.horoscope.sign, (value) => {
    state.horoscope.sign = value;
    state.horoscope.reading = '';
    writeJSON(HOROSCOPE_KEY, state.horoscope);
  });
  const enabled = state.publicConfig.dailyHoroscopeEnabled !== false;
  return shell([
    screenHeader('Гороскоп дня', 'Личное послание от Эзотериума', 'home'),
    MysticCard({ className: 'premium-horoscope-hero', children: [
      Icon('orbit', { size: 44 }),
      h('p', { className: 'premium-kicker', text: 'ВАШ НЕБЕСНЫЙ ОРИЕНТИР' }),
      h('h2', { text: ZODIAC_SIGNS[state.horoscope.sign]?.label || 'Выберите знак' }),
      h('p', { text: 'Каждый день — новый образ, одна точка опоры и действие, которое можно сделать сегодня.' })
    ] }),
    field('Ваш знак зодиака', sign),
    MysticButton({ text: state.busy ? 'Слушаем звёзды…' : 'Открыть гороскоп сегодня', icon: 'sparkle', variant: 'primary', disabled: state.busy, onClick: createDailyHoroscope }),
    state.busy ? loadingCard('Эзотериум собирает послание дня…') : null,
    state.horoscope.reading ? MysticCard({ className: 'premium-result-reading', children: [formatReading(state.horoscope.reading)] }) : null,
    enabled ? consentRow(
      'Присылать мой гороскоп каждое утро в Telegram.',
      state.horoscope.enabled,
      (checked) => saveHoroscopePreference(checked)
    ) : null
  ], { active: 'home' });
}

async function createDailyHoroscope() {
  if (state.busy) return;
  state.busy = true;
  render();
  try {
    const date = new Intl.DateTimeFormat('en-CA').format(new Date());
    const answer = await requestReading('daily_horoscope', {
      sign: ZODIAC_SIGNS[state.horoscope.sign]?.label || state.horoscope.sign,
      date,
      name: firstName()
    });
    state.horoscope = { ...state.horoscope, reading: answer, date };
    writeJSON(HOROSCOPE_KEY, state.horoscope);
  } catch (error) {
    notify(apiErrorMessage(error));
  } finally {
    state.busy = false;
    render();
  }
}

async function saveHoroscopePreference(checked) {
  state.horoscope.enabled = checked;
  writeJSON(HOROSCOPE_KEY, state.horoscope);
  if (!tg?.initData) {
    notify('Откройте Nastardamus внутри Telegram, чтобы включить доставку');
    render();
    return;
  }
  try {
    await api('/api/preferences', {
      method: 'POST',
      body: {
        zodiacSign: state.horoscope.sign,
        enabled: checked,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Berlin'
      }
    });
    notify(checked ? 'Гороскоп будет приходить каждое утро' : 'Ежедневная доставка выключена');
  } catch (error) {
    state.horoscope.enabled = !checked;
    writeJSON(HOROSCOPE_KEY, state.horoscope);
    notify(apiErrorMessage(error));
  }
  render();
}

function historyScreen() {
  const entries = readJSON(JOURNAL_KEY, []);
  return shell([
    screenHeader('История', 'Сохранённые знаки и ответы', 'home'),
    entries.length ? h('div', { className: 'premium-history-list' }, entries.map((entry) => MysticCard({ className: 'premium-history-card', children: [
      h('div', { className: 'premium-history-head' }, h('strong', { text: entry.type || 'Символическое чтение' }), h('small', { text: formatDate(entry.createdAt) })),
      h('h3', { text: entry.title || 'Без названия' }),
      h('p', { text: String(entry.body || '').slice(0, 240) }),
      MysticButton({ text: 'Поделиться', icon: 'share', variant: 'outline', onClick: () => shareResult(entry) })
    ] }))) : MysticCard({ className: 'premium-empty-state', children: [Icon('history', { size: 44 }), h('h2', { text: 'История пока пуста' }), h('p', { text: 'Сохраните расклад или фото-чтение — оно появится здесь.' }), MysticButton({ text: 'Выбрать услугу', icon: 'services', variant: 'primary', onClick: () => navigate('services') })] }),
    entries.length ? MysticButton({ text: 'Удалить всю историю', icon: 'history', variant: 'outline', onClick: clearHistory }) : null
  ], { active: 'history' });
}

function clearHistory() {
  if (!window.confirm('Удалить все сохранённые чтения на этом устройстве?')) return;
  localStorage.removeItem(JOURNAL_KEY);
  notify('История удалена');
  render();
}

function profileScreen() {
  const wallet = state.wallet?.wallet || { balance: 0, available: 0, locked: 0, freeSpins: 0 };
  const ledger = state.wallet?.ledger || [];
  const entitlements = state.wallet?.entitlements || [];
  return shell([
    screenHeader('Профиль', 'Личное пространство и счёт', 'home'),
    GreetingCard({
      username: firstName(),
      message: state.walletStatus === 'error' ? state.walletMessage : 'Ваш счёт и личные настройки',
      balance: formatMoney(wallet.balance || 0)
    }),
    h('div', { className: 'premium-wallet-metrics' },
      MysticCard({ children: [h('small', { text: 'Доступно' }), h('strong', { text: formatMoney(wallet.available) })] }),
      MysticCard({ children: [h('small', { text: 'Заблокировано' }), h('strong', { text: formatMoney(wallet.locked) })] }),
      MysticCard({ children: [h('small', { text: 'Вращения' }), h('strong', { text: String(wallet.freeSpins || 0) })] })
    ),
    h('div', { className: 'premium-profile-actions' },
      MysticButton({
        text: state.wallet?.config?.sbpTopupsEnabled ? 'Купить SILARUM по СБП' : 'Покупка SILARUM настраивается',
        icon: 'coin',
        variant: 'primary',
        disabled: !state.wallet?.config?.sbpTopupsEnabled,
        onClick: () => navigate('topup')
      }),
      MysticButton({ text: state.horoscope.enabled ? 'Гороскоп приходит ежедневно' : 'Настроить ежедневный гороскоп', icon: 'orbit', variant: 'gold', onClick: () => navigate('horoscope') }),
      MysticButton({ text: 'Обновить счёт', icon: 'coin', variant: 'outline', onClick: () => loadWallet({ force: true }) }),
      MysticButton({ text: state.wallet?.config?.withdrawalsEnabled ? 'Обменять SILARUM' : 'Обмен закрыт', icon: 'payment', variant: 'gold', disabled: !state.wallet?.config?.withdrawalsEnabled, onClick: () => navigate('withdrawal') }),
      MysticButton({ text: 'Спросить поддержку', icon: 'info', variant: 'primary', onClick: () => navigate('support') })
    ),
    entitlements.length ? SectionTitle({ text: 'Мои подарки' }) : null,
    entitlements.length ? h('div', { className: 'premium-entitlements' }, entitlements.map((item) =>
      MysticCard({ className: 'premium-entitlement', children: [
        Icon('sparkle', { size: 24 }),
        h('span', {},
          h('strong', { text: serviceConfig(item.service_id).title || item.service_id }),
          h('small', { text: `Доступно: ${item.quantity}` })
        ),
        MysticButton({ text: 'Открыть', icon: 'arrow-left', variant: 'outline', onClick: () => navigate(rewardScreen(item.service_id)) })
      ] })
    )) : null,
    SectionTitle({ text: 'Последние операции' }),
    ledger.length ? h('div', { className: 'premium-ledger' }, ledger.slice(0, 20).map(ledgerRow)) : MysticCard({ className: 'premium-empty-state premium-empty-state--small', children: [h('p', { text: 'Операций пока нет.' })] })
  ], { active: 'profile' });
}

function topupStatusLabel(status, verificationState = 'manual') {
  return ({
    pending: 'Ожидает оплаты',
    awaiting_confirmation: verificationState === 'manual_review' ? 'Требует внимания' : 'Проверяется',
    paid: 'Зачислено',
    rejected: 'Отклонено',
    expired: 'Истекло',
    cancelled: 'Отменено'
  })[status] || 'Создано';
}

function topupScreen() {
  const config = state.wallet?.config || {};
  const topups = state.wallet?.topups || [];
  const activeOrder = topups.find((order) => ['pending', 'awaiting_confirmation'].includes(order.status));
  const minimum = Number(config.sbpMinimumSilarum || 10);
  const maximum = Number(config.sbpMaximumSilarum || 1000);
  const rate = Number(config.sbpRoublesPerSilarum || 0);
  const amount = Number(state.topupAmount || minimum);
  const rubles = Number.isFinite(amount) && amount > 0 ? amount * rate : 0;

  if (config.sbpTopupsEnabled !== true) {
    return shell([
      screenHeader('Покупка SILARUM', 'Оплата по СБП', state.topupReturnScreen || 'profile'),
      MysticCard({ className: 'premium-empty-state', children: [
        Icon('payment', { size: 44 }),
        h('h2', { text: 'СБП пока не настроена' }),
        h('p', { text: 'Администратору нужно включить покупки и указать курс, получателя, банк и реквизиты. До этого заявки не создаются.' })
      ] })
    ], { active: 'profile' });
  }

  return shell([
    screenHeader('Купить SILARUM', 'Безопасная заявка на оплату по СБП', state.topupReturnScreen || 'profile'),
    MysticCard({ className: 'premium-wallet-summary', children: [
      h('small', { text: 'Ваш доступный баланс' }),
      h('strong', { text: `${formatMoney(state.wallet?.wallet?.available)} SILARUM` }),
      h('p', { text: `От ${formatMoney(minimum)} до ${formatMoney(maximum)} SILARUM · 1 SILARUM = ${formatMoney(rate)} ₽` })
    ] }),
    activeOrder ? topupOrderCard(activeOrder, config) : MysticCard({ className: 'premium-form-card', children: [
      field('Количество SILARUM', textInput({
        type: 'number',
        value: state.topupAmount || String(minimum),
        attrs: { min: minimum, max: maximum, step: '0.01', inputmode: 'decimal' },
        onInput: (value) => { state.topupAmount = value; }
      })),
      h('div', { className: 'premium-topup-total' },
        h('small', { text: 'К оплате по СБП' }),
        h('strong', { text: `${formatMoney(rubles)} ₽` })
      ),
      h('p', {
        className: 'premium-info-note',
        text: config.sbpAutomatic
          ? 'После оплаты статус сверится автоматически, и SILARUM появятся на счёте без ручного подтверждения.'
          : 'Сначала создайте заявку. SILARUM зачислятся только после фактического поступления перевода и проверки.'
      })
    ] }),
    activeOrder
      ? MysticButton({ text: 'Обновить статус', icon: 'coin', variant: 'outline', onClick: () => loadWallet({ force: true }) })
      : MysticButton({ text: state.busy ? 'Создаём заявку…' : 'Создать заявку СБП', icon: 'payment', variant: 'primary', disabled: state.busy, onClick: submitTopup }),
    topups.length ? SectionTitle({ text: 'Последние пополнения' }) : null,
    topups.length ? h('div', { className: 'premium-ledger' }, topups.slice(0, 5).map((order) =>
      MysticCard({ className: 'premium-ledger-row', children: [
        Icon(order.status === 'paid' ? 'coin' : 'payment', { size: 24 }),
        h('span', {}, h('strong', { text: topupStatusLabel(order.status, order.verificationState) }), h('small', { text: `${order.reference} · ${formatDate(order.createdAt)}` })),
        h('b', { className: order.status === 'paid' ? 'is-positive' : '', text: `${formatMoney(order.silarum)} S` })
      ] })
    )) : null
  ], { active: 'profile' });
}

function topupOrderCard(order, config) {
  const paymentLink = String(order.paymentUrl || config.sbpPaymentUrl || '');
  const automatic = Boolean(order.providerPaymentId);
  return MysticCard({ className: 'premium-topup-order', children: [
    !automatic && config.sbpQrImageUrl ? h('img', { className: 'premium-sbp-qr', attrs: { src: config.sbpQrImageUrl, alt: 'QR-код для оплаты по СБП' } }) : null,
    h('p', { className: 'premium-kicker', text: topupStatusLabel(order.status, order.verificationState).toUpperCase() }),
    h('h2', { text: `${formatMoney(order.rubles)} ₽` }),
    h('dl', { className: 'premium-payment-details' },
      automatic ? h('div', {}, h('dt', { text: 'Способ' }), h('dd', { text: 'СБП · автоматическая сверка' })) : null,
      !automatic ? h('div', {}, h('dt', { text: 'Получатель' }), h('dd', { text: config.sbpRecipientName })) : null,
      !automatic && config.sbpBankName ? h('div', {}, h('dt', { text: 'Банк' }), h('dd', { text: config.sbpBankName })) : null,
      !automatic && config.sbpPhone ? h('div', {}, h('dt', { text: 'Телефон' }), h('dd', { text: config.sbpPhone })) : null,
      h('div', {}, h('dt', { text: 'Код заявки' }), h('dd', { text: order.reference })),
      h('div', {}, h('dt', { text: 'Будет зачислено' }), h('dd', { text: `${formatMoney(order.silarum)} SILARUM` }))
    ),
    h('p', {
      className: 'premium-info-note',
      text: automatic
        ? 'Оплатите на защищённой странице. После возврата нажмите «Обновить статус», если зачисление ещё не появилось.'
        : config.sbpInstructions || 'Переведите точную сумму и укажите код заявки.'
    }),
    paymentLink && order.status === 'pending'
      ? MysticButton({
          text: 'Открыть оплату СБП',
          icon: 'payment',
          variant: 'gold',
          onClick: () => {
            if (tg?.openLink) tg.openLink(paymentLink);
            else window.open(paymentLink, '_blank', 'noopener');
          }
        })
      : null,
    order.status === 'pending' && !automatic
      ? MysticButton({ text: 'Я оплатил — отправить на проверку', icon: 'coin', variant: 'primary', onClick: () => markTopupSent(order.id) })
      : null
  ] });
}

async function submitTopup() {
  const amount = Number(state.topupAmount || state.wallet?.config?.sbpMinimumSilarum);
  state.busy = true; render();
  try {
    const data = await api('/api/wallet', {
      method: 'POST',
      body: { action: 'create_sbp_topup', amount, idempotencyKey: uniqueId('topup') }
    });
    state.wallet = data;
    state.walletStatus = 'ready';
    notify(data.order?.paymentUrl || data.order?.confirmation_url
      ? 'Заявка создана. Откройте оплату СБП.'
      : 'Заявка создана. Переведите точную сумму по реквизитам.');
  } catch (error) {
    notify(apiErrorMessage(error));
  } finally {
    state.busy = false;
    render();
  }
}

async function markTopupSent(orderId) {
  state.busy = true; render();
  try {
    const data = await api('/api/wallet', {
      method: 'POST',
      body: { action: 'mark_sbp_topup_sent', orderId }
    });
    state.wallet = data;
    state.walletStatus = 'ready';
    notify('Платёж отправлен администратору на проверку');
  } catch (error) {
    notify(apiErrorMessage(error));
  } finally {
    state.busy = false;
    render();
  }
}

function ledgerRow(entry) {
  const labels = { purchase: 'Покупка SILARUM', service_charge: 'Оплата услуги', wheel_prize: 'Приз Колеса', referral_commission: 'Партнёрское начисление', withdrawal_hold: 'Заявка на обмен', withdrawal_paid: 'Обмен выполнен', withdrawal_release: 'Средства возвращены', adjustment: 'Корректировка' };
  return MysticCard({ className: 'premium-ledger-row', children: [
    Icon(Number(entry.amount) >= 0 ? 'coin' : 'payment', { size: 24 }),
    h('span', {}, h('strong', { text: labels[entry.type] || 'Операция' }), h('small', { text: formatDate(entry.createdAt) })),
    h('b', { className: Number(entry.amount) >= 0 ? 'is-positive' : '', text: `${Number(entry.amount) > 0 ? '+' : ''}${formatMoney(entry.amount)}` })
  ] });
}

function withdrawalScreen() {
  const config = state.wallet?.config || {};
  let amount = '';
  let destination = '';
  let confirmed = false;
  return shell([
    screenHeader('Обмен SILARUM', 'Защищённая заявка на вывод', 'profile'),
    MysticCard({ className: 'premium-wallet-summary', children: [
      h('small', { text: 'Доступно для обмена' }),
      h('strong', { text: `${formatMoney(state.wallet?.wallet?.available)} SILARUM` }),
      h('p', { text: `Минимум ${formatMoney(config.minimumWithdrawal || 25)} · комиссия ${Number(config.withdrawalFee || 25)}%` })
    ] }),
    MysticCard({ className: 'premium-form-card', children: [
      field('Сумма SILARUM', textInput({ type: 'number', placeholder: String(config.minimumWithdrawal || 25), attrs: { min: config.minimumWithdrawal || 25, step: '0.01', inputmode: 'decimal' }, onInput: (value) => { amount = value; } })),
      field('USDT-адрес сети TON', textInput({ placeholder: 'Введите адрес кошелька', attrs: { maxlength: 200, autocomplete: 'off' }, onInput: (value) => { destination = value; } })),
      h('label', { className: 'premium-consent' }, h('input', { attrs: { type: 'checkbox' }, on: { change: (event) => { confirmed = event.target.checked; } } }), h('span', { text: 'Я проверил адрес и понимаю, что ошибочный перевод нельзя отменить.' }))
    ] }),
    MysticButton({ text: state.busy ? 'Создаём заявку…' : 'Создать заявку', icon: 'payment', variant: 'primary', disabled: state.busy, onClick: () => submitWithdrawal({ amount, destination, confirmed }) })
  ], { active: 'profile' });
}

async function submitWithdrawal({ amount, destination, confirmed }) {
  if (!confirmed) return notify('Подтвердите проверку адреса');
  state.busy = true; render();
  try {
    const idempotencyKey = uniqueId('withdrawal');
    const data = await api('/api/wallet', {
      method: 'POST',
      body: {
        action: 'request_withdrawal',
        amount: Number(amount),
        destination,
        idempotencyKey
      }
    });
    state.wallet = data;
    state.walletStatus = 'ready';
    notify('Заявка создана');
    navigate('profile');
  } catch (error) { notify(apiErrorMessage(error)); }
  finally { state.busy = false; render(); }
}

function supportScreen() {
  const messages = state.support;
  const input = textarea({ value: state.supportDraft, placeholder: 'Например: как выбрать расклад?', onInput: (value) => { state.supportDraft = value; }, maxLength: 3000 });
  return shell([
    screenHeader('Спросить Эзотериума', 'Помощник по приложению и услугам', 'services'),
    h('div', { className: 'premium-chat' },
      messages.length ? messages.map((message) => h('div', { className: `premium-chat-message premium-chat-message--${message.role}`, text: message.content })) : h('div', { className: 'premium-chat-welcome' }, Icon('sparkle', { size: 36 }), h('p', { text: 'Спросите, как пользоваться раскладами, фото-чтениями, историей или лицевым счётом.' }))
    ),
    field('Ваш вопрос', input),
    MysticButton({ text: state.busy ? 'Отвечаем…' : 'Отправить', icon: 'send', variant: 'primary', disabled: state.busy, onClick: submitSupport }),
    state.busy ? loadingCard('Формируем ответ…') : null
  ], { active: 'services' });
}

async function submitSupport() {
  const message = state.supportDraft.trim();
  if (!message || state.busy) return notify('Напишите вопрос');
  state.support.push({ role: 'user', content: message });
  state.supportDraft = '';
  state.busy = true; render();
  try {
    const data = await api('/api/assistant', { method: 'POST', body: { agent: 'support-guide', message, history: state.support.slice(-10) } });
    state.support.push({ role: 'assistant', content: data.answer || 'Ответ не получен.' });
    writeJSON(SUPPORT_KEY, state.support.slice(-30));
  } catch (error) {
    state.support.push({ role: 'assistant', content: apiErrorMessage(error) });
  } finally { state.busy = false; render(); }
}

async function requestReading(feature, payload, serviceId = '') {
  try {
    const data = await api('/api/proxy', {
      method: 'POST',
      body: { feature, payload, idempotencyKey: uniqueId(`reading-${serviceId || feature}`) }
    });
    if (typeof data.answer !== 'string' || !data.answer.trim()) throw new Error('empty_response');
    loadWallet({ force: true });
    return data.answer.trim();
  } catch (error) {
    if (error?.status === 402) {
      const minimum = Number(state.wallet?.config?.sbpMinimumSilarum || 10);
      const shortage = Number(error.data?.payment?.shortage || minimum);
      state.topupAmount = String(Math.max(minimum, Math.ceil(shortage * 100) / 100));
      state.topupReturnScreen = state.screen;
      navigate('topup');
    }
    throw error;
  }
}

async function api(path, { method = 'GET', body } = {}) {
  const response = await fetch(path, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), 'X-Telegram-Init-Data': tg?.initData || '' },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || `http_${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

function apiErrorMessage(error) {
  if (error?.status === 401 || error?.message === 'telegram_auth_required') return 'Откройте приложение внутри Telegram и повторите действие.';
  const messages = {
    service_not_configured: 'Сервис ответов ещё не настроен.',
    assistant_unavailable: 'Помощник временно недоступен.',
    vision_provider_unavailable: 'Фото-чтение временно недоступно.',
    reading_provider_unavailable: 'Толкование временно недоступно.',
    photo_consent_required: 'Подтвердите согласие на обработку фотографии.',
    partner_consent_required: 'Нужно согласие второго человека.',
    adult_confirmation_required: 'Подтвердите совершеннолетие участников.',
    photo_moderation_unavailable: 'Проверка безопасности фото временно недоступна.',
    photo_blocked: 'Фото не прошло проверку безопасности.',
    photo_requires_review: 'Фото направлено на дополнительную проверку.',
    palmlink_disabled: 'PalmLink временно отключён.',
    joint_readings_disabled: 'Совместные чтения временно отключены.',
    rate_limited: 'Слишком много запросов. Попробуйте позже.',
    rate_limit_backend_failed: 'Защита запросов временно недоступна.',
    invalid_idempotency_key: 'Не удалось защитить заявку от повтора.',
    wheel_disabled: 'Колесо сегодня закрыто.',
    wheel_daily_limit: 'Сегодняшняя коробка уже открыта. Возвращайтесь завтра.',
    wheel_rewards_exhausted: 'Подарки на сегодня разобраны. Новые коробки появятся завтра.',
    wheel_unavailable: 'Колесо временно не отвечает. Попробуйте позже.',
    withdrawals_disabled: 'Обмен сейчас закрыт.', below_minimum: 'Сумма ниже минимума.',
    insufficient_funds: 'Недостаточно SILARUM. Открыта безопасная форма пополнения.',
    invalid_destination: 'Проверьте адрес кошелька.',
    payments_disabled: 'Оплата услуг временно отключена администратором.',
    service_disabled: 'Эта услуга временно отключена.',
    service_price_not_configured: 'Администратор ещё не настроил цену услуги.',
    payment_backend_failed: 'Платёжный контур временно недоступен. Списание не выполнено.',
    payment_retry_required: 'Повторите оплату новым запросом.',
    sbp_topups_disabled: 'Пополнение по СБП сейчас закрыто.',
    sbp_not_configured: 'Реквизиты СБП ещё не настроены.',
    below_topup_minimum: 'Сумма ниже минимального порога СБП.',
    above_topup_maximum: 'Сумма выше максимального порога СБП.',
    topup_not_found: 'Заявка на пополнение не найдена.',
    topup_not_pending: 'Эта заявка уже обработана.',
    topup_expired: 'Срок действия заявки истёк. Создайте новую.'
  };
  return messages[error?.message] || 'Не удалось выполнить действие. Проверьте соединение и повторите.';
}

async function loadWallet({ force = false } = {}) {
  if (!tg?.initData) {
    state.walletStatus = 'error';
    state.walletMessage = 'Откройте приложение внутри Telegram, чтобы увидеть лицевой счёт.';
    if (state.screen === 'home' || state.screen === 'profile' || state.screen === 'topup') render();
    return;
  }
  if (state.walletStatus === 'loading' && !force && state.wallet) return;
  state.walletStatus = 'loading';
  if (state.screen === 'home' || state.screen === 'profile' || state.screen === 'topup') render();
  try {
    state.wallet = await api('/api/wallet');
    state.walletStatus = 'ready';
    state.walletMessage = '';
  } catch (error) {
    state.walletStatus = 'error';
    state.walletMessage = apiErrorMessage(error);
  }
  if (state.screen === 'home' || state.screen === 'profile' || state.screen === 'topup') render();
}

async function loadPublicConfig() {
  if (!tg?.initData) return;
  try {
    const data = await api('/api/config');
    state.publicConfig = { ...state.publicConfig, ...(data.settings || {}) };
  } catch {
    // Secure defaults remain active when configuration is unavailable.
  }
  if (['home', 'services', 'wheel', 'palm', 'ritual', 'profile', 'topup'].includes(state.screen)) render();
}

async function loadPreferences() {
  if (!tg?.initData) return;
  try {
    const data = await api('/api/preferences');
    const preferences = data.preferences;
    if (preferences) {
      state.horoscope.sign = preferences.zodiac_sign || state.horoscope.sign;
      state.horoscope.enabled = preferences.daily_horoscope_enabled === true;
      writeJSON(HOROSCOPE_KEY, state.horoscope);
    }
  } catch {
    // Local preference remains available if the profile endpoint is temporarily unavailable.
  }
  if (state.screen === 'profile' || state.screen === 'horoscope') render();
}

function shuffle(values) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function uniqueId(prefix) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

function render() {
  const routes = {
    welcome: welcomeScreen, home: homeScreen, services: servicesScreen,
    wheel: wheelScreen, tarot: tarotScreen, 'tarot-draw': tarotDrawScreen, 'tarot-result': tarotResultScreen,
    natal: natalScreen, 'natal-result': natalResultScreen,
    horoscope: horoscopeScreen,
    'photo-energy': () => photoScreen('energy'), 'photo-damage': () => photoScreen('damage'), 'photo-compat': () => photoScreen('compatibility'), 'photo-result': photoResultScreen,
    palm: palmScreen, ritual: ritualScreen, 'compatibility-result': compatibilityResultScreen,
    history: historyScreen, profile: profileScreen, topup: topupScreen, withdrawal: withdrawalScreen, support: supportScreen
  };
  if (!routes[state.screen]) state.screen = 'home';
  mount.dataset.screen = state.screen;
  mount.replaceChildren(routes[state.screen]());
}

window.addEventListener('popstate', () => {
  state.screen = new URLSearchParams(location.search).get('screen') || 'home';
  render();
});

function hideBootScreen() {
  const boot = document.getElementById('boot-screen');
  if (!boot) return;
  boot.classList.add('is-hidden');
  window.setTimeout(() => boot.remove(), 260);
}

function loadTelegramData({ force = false } = {}) {
  if (!configureTelegram()) return false;
  loadPublicConfig();
  loadWallet({ force });
  loadPreferences();
  return true;
}

render();
hideBootScreen();
if (!loadTelegramData()) {
  document.getElementById('telegram-web-app-sdk')?.addEventListener(
    'load',
    () => loadTelegramData({ force: true }),
    { once: true }
  );
}

export { navigate, render, state };
