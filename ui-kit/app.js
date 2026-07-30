import {
  AppShell, ScreenContainer, BrandLogo, AppHeader, GreetingCard,
  FortuneWheelCard, SectionTitle, QuickAccessGrid, BottomNavigation, UploadCard,
  GoalSelector, EnergyHandsScene, MysticButton, PriceLine,
  DataStatusCard, ActionGroup, CompatibilityHero, Tabs, MysticCard, ServiceCard,
  StatusBadge, GlowDivider, MetricsList, ForecastGrid, FinalScoreCard
} from './components/index.js';
import { h } from './core/dom.js';
import { Icon } from './core/icon.js';
import { premiumArtUrl } from './core/assets.js';
import { TAROT_CARD_NAMES, tarotCardImage } from './core/tarot-deck.js';

let tg = null;
let telegramConfigured = false;

const mount = document.getElementById('premium-app');
const toast = document.getElementById('premium-toast');
const JOURNAL_KEY = 'nastardamus-journal-v2';
const SUPPORT_KEY = 'nastardamus-support-v4';
const HOROSCOPE_KEY = 'nastardamus-horoscope-v1';
const PROFILE_KEY = 'nastardamus-profile-v1';
const TAROT_REVEAL_MS = 2300;
const CURRENT_YEAR = new Date().getFullYear();
const storedProfile = readJSON(PROFILE_KEY, {});

const ZODIAC_SIGNS = {
  aries: { label: 'Овен' }, taurus: { label: 'Телец' }, gemini: { label: 'Близнецы' },
  cancer: { label: 'Рак' }, leo: { label: 'Лев' }, virgo: { label: 'Дева' },
  libra: { label: 'Весы' }, scorpio: { label: 'Скорпион' }, sagittarius: { label: 'Стрелец' },
  capricorn: { label: 'Козерог' }, aquarius: { label: 'Водолей' }, pisces: { label: 'Рыбы' }
};

const GENDER_OPTIONS = {
  female: { label: 'Женщина', art: 'portrait-woman' },
  male: { label: 'Мужчина', art: 'portrait-man' },
  unspecified: { label: 'Не указывать', art: 'avatar-seeker' }
};

const SPREADS = {
  'card-of-day': {
    label: 'Карта дня', count: 1, category: 'insight', cover: 'high-priestess.webp',
    description: 'Энергия дня и один ясный ориентир', access: 'Ежедневный', serviceId: 'tarot',
    positions: ['Энергия дня']
  },
  'yes-no': {
    label: 'Да или нет', count: 1, category: 'future', cover: 'justice.webp',
    description: 'Ответ, условие и зона вашего выбора', access: 'Короткий', serviceId: 'tarot',
    positions: ['Ответ и условие']
  },
  'past-present-future': {
    label: 'Прошлое · настоящее · будущее', count: 3, category: 'future', cover: 'wheel-of-fortune.webp',
    description: 'Три времени одной ситуации', access: 'Бесплатная попытка', serviceId: 'tarot',
    positions: ['Прошлое', 'Настоящее', 'Будущее']
  },
  'situation-obstacle-advice': {
    label: 'Ситуация · препятствие · совет', count: 3, category: 'insight', cover: 'hermit.webp',
    description: 'Увидеть суть и практический выход', access: 'SILARUM', serviceId: 'tarot',
    positions: ['Ситуация', 'Препятствие', 'Совет']
  },
  'love-relationship': {
    label: 'Любовь и отношения', count: 5, category: 'love', cover: 'lovers.webp',
    description: 'Чувства, притяжение, напряжение и перспектива', access: 'VIP / SILARUM', serviceId: 'tarot_relationship',
    positions: ['Ваше чувство', 'Чувство другого', 'Притяжение', 'Напряжение', 'Перспектива']
  },
  'money-career': {
    label: 'Деньги и карьера', count: 5, category: 'work', cover: 'magician.webp',
    description: 'Ресурс, препятствие, возможность и действие', access: 'SILARUM', serviceId: 'tarot',
    positions: ['Ресурс', 'Текущая ситуация', 'Препятствие', 'Возможность', 'Действие']
  },
  'two-paths': {
    label: 'Выбор двух путей', count: 7, category: 'future', cover: 'justice.webp',
    description: 'Цена и итог каждого варианта', access: 'SILARUM', serviceId: 'tarot',
    positions: ['Суть выбора', 'Путь A', 'Цена пути A', 'Итог пути A', 'Путь B', 'Цена пути B', 'Итог пути B']
  },
  'pair-compatibility': {
    label: 'Совместимость пары', count: 8, category: 'love', cover: 'empress.webp',
    description: 'Притяжение, доверие, диалог и общий путь', access: 'VIP / SILARUM', serviceId: 'tarot_relationship',
    positions: ['Вы', 'Другой', 'Притяжение', 'Доверие', 'Диалог', 'Близость', 'Сложность', 'Общий путь']
  },
  'near-future': {
    label: 'Ближайшее будущее', count: 7, category: 'future', cover: 'star.webp',
    description: 'Что приходит, что уходит и ваш шаг', access: 'VIP / SILARUM', serviceId: 'tarot',
    positions: ['Фон', 'Что приходит', 'Что уходит', 'Возможность', 'Риск', 'Ваш шаг', 'Итоговый вектор']
  },
  'shadow-side': {
    label: 'Теневая сторона', count: 5, category: 'insight', cover: 'moon.webp',
    description: 'Триггер, защита, ресурс и интеграция', access: 'SILARUM', serviceId: 'tarot',
    positions: ['Тень', 'Триггер', 'Защита', 'Ресурс', 'Интеграция']
  },
  'celtic-cross': {
    label: 'Кельтский крест', count: 10, category: 'deep', cover: 'world.webp', serviceId: 'tarot',
    description: 'Глубокое чтение ситуации и её развития', access: 'VIP / SILARUM',
    positions: ['Суть', 'Пересечение', 'Основание', 'Прошлое', 'Возможность', 'Ближайший путь', 'Ваша позиция', 'Окружение', 'Надежда и страх', 'Направление']
  },
  'wheel-of-year': {
    label: 'Колесо года', count: 12, category: 'deep', cover: 'sun.webp', serviceId: 'tarot',
    description: 'Двенадцать месяцев большого цикла', access: 'VIP',
    positions: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
  }
};

const TAROT_CATEGORIES = {
  all: 'Все',
  love: 'Любовь',
  work: 'Дела и деньги',
  future: 'Будущее',
  insight: 'Самопознание',
  deep: 'Глубокие'
};

const params = new URLSearchParams(location.search);
const requestedScreen = params.get('screen');
const requestedInvitationToken = /^[a-f0-9]{32}$/.test(params.get('invitation') || '')
  ? params.get('invitation')
  : '';
const requestedInviteGoal = ['love', 'friendship', 'business', 'creative'].includes(params.get('invite'))
  ? params.get('invite')
  : 'love';
const state = {
  screen: requestedScreen || (requestedInvitationToken ? 'invitation' : (storedProfile.completed ? 'home' : 'welcome')),
  wallet: null,
  walletStatus: 'loading',
  walletMessage: '',
  busy: false,
  spread: 'past-present-future',
  tarotCategory: 'all',
  tarotStage: 'catalog',
  tarotQuestion: '',
  tarotDeck: [],
  tarotCards: [],
  revealingCard: null,
  result: null,
  sportsEvent: '',
  sportsContext: '',
  sportsResult: '',
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
  compatibilityData: {
    first: { name: '', gender: 'unspecified', date: '', time: '', place: '' },
    second: { name: '', gender: 'unspecified', date: '', time: '', place: '' },
    question: ''
  },
  historyFilter: 'all',
  palmOne: '',
  palmTwo: '',
  palmGoal: requestedInviteGoal,
  inviteGoal: requestedInviteGoal,
  inviteFlow: 'palm',
  inviteName: '',
  inviteGender: 'unspecified',
  inviteGenderTouched: false,
  preparedInvite: null,
  preparedInviteFile: null,
  invitationToken: requestedInvitationToken,
  invitation: null,
  invitationStatus: requestedInvitationToken ? 'idle' : 'empty',
  invitationError: '',
  invitationPhoto: '',
  invitationGender: 'unspecified',
  invitationConsentOwn: false,
  invitationAdultConfirmed: false,
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
  userGender: normalizeGender(storedProfile.gender),
  profile: {
    age: Number(storedProfile.age) || '',
    city: String(storedProfile.city || ''),
    avatarUrl: String(storedProfile.avatarUrl || ''),
    telegramAvatarUrl: String(storedProfile.telegramAvatarUrl || ''),
    completed: storedProfile.completed === true
  },
  cloudReadings: [],
  cloudReadingsStatus: 'idle',
  readingCatalogStatus: 'idle',
  compatibilityCatalog: [],
  tarotSessionId: '',
  palmDialogue: {
    sessionId: '',
    stage: 'intro',
    hand: 'right',
    question: '',
    image: '',
    draft: '',
    messages: [],
    answers: [],
    result: null
  },
  runeQuestion: '',
  runeCount: 3,
  runeSelection: [],
  runeResult: null,
  amurMode: 'dice',
  amurDice: [],
  amurRolling: false,
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
    tg.disableVerticalSwipes?.();
    tg.setHeaderColor?.('#070913');
    tg.setBackgroundColor?.('#070913');
    syncTelegramInsets();
    tg.onEvent?.('safeAreaChanged', syncTelegramInsets);
    tg.onEvent?.('contentSafeAreaChanged', syncTelegramInsets);
    telegramConfigured = true;
  }
  return true;
}

function syncTelegramInsets() {
  const root = document.documentElement;
  const safe = tg?.safeAreaInset || {};
  const content = tg?.contentSafeAreaInset || {};
  root.style.setProperty('--tg-safe-top', `${Math.max(Number(safe.top) || 0, Number(content.top) || 0)}px`);
  root.style.setProperty('--tg-safe-bottom', `${Math.max(Number(safe.bottom) || 0, Number(content.bottom) || 0)}px`);
}

function syncViewport() {
  const viewport = window.visualViewport;
  const height = viewport?.height || window.innerHeight;
  const keyboardOpen = window.innerHeight - height > 130;
  document.documentElement.style.setProperty('--app-height', `${Math.round(height)}px`);
  document.body.classList.toggle('is-keyboard-open', keyboardOpen);
}

function configureVisualQuality() {
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
  const memory = Number(navigator.deviceMemory || 4);
  const cores = Number(navigator.hardwareConcurrency || 4);
  const quality = reducedMotion || memory <= 2 || cores <= 2
    ? 'lite'
    : memory >= 8 && cores >= 8
      ? 'high'
      : 'standard';
  document.documentElement.dataset.visualQuality = quality;
  return quality;
}

window.visualViewport?.addEventListener('resize', syncViewport);
window.visualViewport?.addEventListener('scroll', syncViewport);
window.addEventListener('resize', syncViewport);
document.addEventListener('focusin', (event) => {
  if (!event.target?.matches?.('input, textarea, select')) return;
  window.setTimeout(() => event.target.scrollIntoView?.({ block: 'center', behavior: 'smooth' }), 180);
});
document.addEventListener('focusout', () => window.setTimeout(syncViewport, 120));
syncViewport();
configureVisualQuality();

function readJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}

function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage can be unavailable */ }
}

function normalizeGender(value) {
  return Object.prototype.hasOwnProperty.call(GENDER_OPTIONS, value) ? value : 'unspecified';
}

const FEMALE_NAME_HINTS = new Set([
  'александра', 'алёна', 'алена', 'алина', 'алла', 'альбина', 'анастасия', 'анна',
  'валентина', 'валерия', 'вера', 'виктория', 'галина', 'дарья', 'диана', 'евгения',
  'екатерина', 'елена', 'елизавета', 'жанна', 'инна', 'ирина', 'карина', 'кристина',
  'ксения', 'лариса', 'лидия', 'любовь', 'людмила', 'маргарита', 'марина', 'мария',
  'надежда', 'наталья', 'нина', 'оксана', 'ольга', 'полина', 'светлана', 'софия',
  'тамара', 'татьяна', 'юлия', 'яна'
]);
const MALE_NAME_HINTS = new Set([
  'александр', 'алексей', 'анатолий', 'андрей', 'антон', 'артём', 'артем', 'борис',
  'вадим', 'валентин', 'валерий', 'василий', 'виктор', 'виталий', 'владимир',
  'владислав', 'геннадий', 'георгий', 'глеб', 'даниил', 'денис', 'дмитрий', 'евгений',
  'егор', 'илья', 'иван', 'игорь', 'кирилл', 'константин', 'лев', 'леонид', 'максим',
  'михаил', 'никита', 'николай', 'олег', 'павел', 'пётр', 'петр', 'роман', 'руслан',
  'сергей', 'станислав', 'степан', 'тимур', 'фёдор', 'федор', 'юрий', 'ярослав'
]);
const AMBIGUOUS_NAME_HINTS = new Set([
  'саша', 'женя', 'валя', 'слава', 'шура'
]);

function suggestGenderFromName(value) {
  const name = String(value || '').trim().toLocaleLowerCase('ru-RU').split(/[\s-]+/)[0];
  if (!name) return 'unspecified';
  if (AMBIGUOUS_NAME_HINTS.has(name)) return 'unspecified';
  if (FEMALE_NAME_HINTS.has(name)) return 'female';
  if (MALE_NAME_HINTS.has(name)) return 'male';
  if (/[ая]$/u.test(name) && !/^(никита|илья|лука|кузьма|фома|савва)$/u.test(name)) return 'female';
  if (/[йбвгджзклмнпрстфхцчшщ]$/u.test(name)) return 'male';
  return 'unspecified';
}

function profileAvatar() {
  const uploaded = String(state.profile.avatarUrl || '');
  if (/^(?:https:|data:image\/)/.test(uploaded)) return uploaded;
  const telegramAvatar = String(
    state.profile.telegramAvatarUrl
    || tg?.initDataUnsafe?.user?.photo_url
    || ''
  );
  if (/^https:\/\//.test(telegramAvatar)) return telegramAvatar;
  return premiumArtUrl(GENDER_OPTIONS[state.userGender]?.art || 'avatar-seeker');
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
  if (screen === 'amur' || screen === 'compatibility' || screen.startsWith('compatibility-') || screen.startsWith('invite') || screen === 'invitation') return 'amur';
  return 'services';
}

function shell(content, { tabs = true, active = activeTab(), reading = false } = {}) {
  const readingClass = reading ? ' premium-shell--reading' : '';
  const screenReadingClass = reading ? ' premium-screen--reading' : '';
  return AppShell({ className: `premium-shell${readingClass}`, children: [
    ScreenContainer({
      className: `premium-screen premium-screen-transition${screenReadingClass}`,
      children: [h('div', { className: 'premium-stack' }, content)]
    }),
    tabs && !reading ? BottomNavigation({ active, onNavigate: handleBottomNavigation }) : null
  ] });
}

function handleBottomNavigation(target) {
  pulse();
  const routes = { home: 'home', services: 'services', amur: 'amur', history: 'history', profile: 'profile' };
  navigate(routes[target] || 'home');
}

function screenHeader(title, subtitle, back = 'home') {
  return AppHeader({ title, subtitle, onBack: () => navigate(back), rightIcon: 'info', onRight: () => navigate('support') });
}

function serviceTile(art, title, description, onClick, badge = '') {
  return h('button', { className: 'premium-service-tile', attrs: { type: 'button' }, on: { click: onClick } },
    h('span', { className: 'premium-service-icon' },
      h('img', { attrs: { src: premiumArtUrl(art), alt: '', draggable: 'false' } })
    ),
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
  const age = textInput({
    value: state.profile.age,
    type: 'number',
    placeholder: 'Например, 28',
    attrs: { min: 13, max: 120, inputmode: 'numeric', autocomplete: 'bday-year' },
    onInput: (value) => { state.profile.age = value; }
  });
  const city = textInput({
    value: state.profile.city,
    placeholder: 'Ваш город',
    attrs: { autocomplete: 'address-level2', maxlength: 120 },
    onInput: (value) => { state.profile.city = value; }
  });
  const sign = selectField(ZODIAC_SIGNS, state.horoscope.sign, (value) => {
    state.horoscope.sign = value;
  });
  return shell([
    h('section', { className: 'premium-onboarding' },
      h('div', { className: 'premium-onboarding__visual' },
        h('img', { attrs: { src: '/images/splash-v2.webp', alt: '' } }),
        h('div', { className: 'premium-onboarding__brand' },
          BrandLogo(),
          h('p', { className: 'premium-kicker', text: 'ВАШЕ ЛИЧНОЕ ПРОСТРАНСТВО' }),
          h('h1', { text: 'Настроим Эзотериум под вас' }),
          h('p', { text: 'Возраст и город помогают делать советы уместнее. Мы не используем их для рекламы.' })
        )
      ),
      MysticCard({ className: 'premium-onboarding__form', children: [
        h('div', { className: 'premium-onboarding__step' },
          h('span', { text: '01' }),
          h('div', {}, h('strong', { text: 'Немного о вас' }), h('small', { text: 'Займёт меньше минуты' }))
        ),
        field('Возраст', age, 'От 13 до 120 лет'),
        field('Город', city, 'Для ритма дня и коротких советов'),
        field('Знак зодиака', sign),
        MysticButton({
          text: state.busy ? 'Сохраняем профиль…' : 'Войти в Nastardamus',
          icon: 'sparkle',
          variant: 'primary',
          disabled: state.busy,
          onClick: saveOnboardingProfile
        }),
        h('small', { className: 'premium-onboarding__note', text: 'Толкования созданы для размышления и развлечения. Настройки можно изменить в профиле.' })
      ] })
    )
  ], { tabs: false });
}

async function saveOnboardingProfile() {
  const age = Number(state.profile.age);
  const city = state.profile.city.trim().replace(/\s+/g, ' ');
  if (!Number.isInteger(age) || age < 13 || age > 120) return notify('Укажите возраст от 13 до 120 лет');
  if (city.length < 2) return notify('Укажите ваш город');
  state.busy = true;
  render();
  try {
    state.profile = {
      ...state.profile,
      age,
      city,
      telegramAvatarUrl: String(tg?.initDataUnsafe?.user?.photo_url || state.profile.telegramAvatarUrl || ''),
      completed: true
    };
    writeJSON(PROFILE_KEY, { ...state.profile, gender: state.userGender });
    writeJSON(HOROSCOPE_KEY, state.horoscope);
    if (tg?.initData) {
      await api('/api/preferences', {
        method: 'POST',
        body: profilePreferencePayload()
      });
    }
    pulse('medium');
    state.screen = 'home';
    const url = new URL(location.href);
    url.searchParams.set('screen', 'home');
    history.replaceState({}, '', url);
  } catch (error) {
    state.profile.completed = false;
    notify(apiErrorMessage(error));
  } finally {
    state.busy = false;
    render();
  }
}

function profilePreferencePayload(extra = {}) {
  return {
    zodiacSign: state.horoscope.sign,
    enabled: state.horoscope.enabled,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Berlin',
    gender: state.userGender,
    birthYear: CURRENT_YEAR - Number(state.profile.age || 18),
    city: state.profile.city.trim(),
    ...extra
  };
}

function homeScreen() {
  const wallet = state.wallet?.wallet || { freeSpins: 0 };
  const header = h('header', { className: 'premium-home-header' }, BrandLogo(),
    h('button', { className: 'premium-avatar-button', attrs: { type: 'button', 'aria-label': 'Открыть профиль' }, on: { click: () => navigate('profile') } },
      h('img', { attrs: { src: profileAvatar(), alt: '' } })
    )
  );
  const wheelEnabled = state.publicConfig.wheelEnabled === true;
  const horoscopeReady = state.horoscope.reading && state.horoscope.date === new Intl.DateTimeFormat('en-CA').format(new Date());

  return shell([
    header,
    h('section', { className: 'premium-home-greeting' },
      h('p', { className: 'premium-kicker', text: 'СЕГОДНЯ ВАЖНО' }),
      h('h1', { text: `${firstName()}, найдите одну ясную точку опоры` }),
      h('p', { text: `${state.profile.city || 'Ваш город'} · ${ZODIAC_SIGNS[state.horoscope.sign]?.label || 'личный ритм'}` })
    ),
    h('button', {
      className: 'premium-daily-card',
      attrs: { type: 'button' },
      on: { click: () => navigate('horoscope') }
    },
    h('img', { attrs: { src: premiumArtUrl('astrology-forecast'), alt: '' } }),
    h('span', { className: 'premium-daily-card__copy' },
      h('small', { text: 'ЛИЧНЫЙ ОРИЕНТИР' }),
      h('strong', { text: horoscopeReady ? 'Ваш совет на сегодня готов' : 'Короткий гороскоп дня' }),
      h('span', { text: horoscopeReady ? String(state.horoscope.reading).split('\n')[0].slice(0, 110) : 'Фокус, отношения, дела и один конкретный шаг.' }),
      h('b', { text: horoscopeReady ? 'Открыть снова →' : 'Получить совет →' })
    )),
    SectionTitle({ text: 'Ваши практики' }),
    h('div', { className: 'premium-home-practices' },
      homePracticeCard('palm-oracle', 'Ладонь', 'Диалог и чтение линий', 'palm-reading'),
      homePracticeCard('rune-sanctum', 'Руны', 'Три знака и действие', 'runes'),
      homePracticeCard('tarot-deck', 'Таро', 'Полная колода 78 карт', 'tarot'),
      homePracticeCard('amur-dice', 'Амур', 'Кости и совместимость', 'amur')
    ),
    sportsForecastPanel(),
    h('div', { className: 'premium-home-footer-row' },
      h('button', {
        className: 'premium-mini-feature',
        attrs: { type: 'button' },
        on: { click: () => openEnabledFeature(wheelEnabled, 'wheel', 'Колесо отключено администратором') }
      },
      Icon('wheel', { size: 28 }),
      h('span', {}, h('strong', { text: 'Колесо Фортуны' }), h('small', { text: wallet.freeSpins ? `${wallet.freeSpins} вращение доступно` : 'Подарок дня' }))),
      h('button', {
        className: 'premium-mini-feature',
        attrs: { type: 'button' },
        on: { click: () => navigate('history') }
      },
      Icon('history', { size: 28 }),
      h('span', {}, h('strong', { text: 'Моя история' }), h('small', { text: 'Все сохранённые чтения' })))
    )
  ], { active: 'home' });
}

function homePracticeCard(art, title, description, screen) {
  return h('button', {
    className: 'premium-home-practice',
    attrs: { type: 'button' },
    on: { click: () => navigate(screen) }
  },
  h('img', { attrs: { src: premiumArtUrl(art), alt: '', loading: 'lazy' } }),
  h('span', {}, h('strong', { text: title }), h('small', { text: description })));
}

function sportsForecastPanel() {
  return h('button', {
    className: 'premium-sports-banner',
    attrs: { type: 'button', 'aria-label': 'Открыть спортивные знамения Эзотериума' },
    on: { click: () => navigate('sports') }
  },
  h('img', {
    attrs: {
      src: premiumArtUrl('sports-prophecy-banner'),
      alt: '',
      draggable: 'false'
    }
  }),
  h('span', { className: 'premium-sports-banner__scrim' }),
  h('span', { className: 'premium-sports-banner__copy' },
    h('small', { text: 'ПРЕДСКАЗАНИЯ СОБЫТИЙ' }),
    h('strong', { text: 'Спортивные знамения' }),
    h('span', { text: 'Назовите встречу — Эзотериум раскроет её символический рисунок.' }),
    h('b', { text: 'Открыть прогноз →' })
  ));
}

function sportsForecastScreen() {
  const reading = state.busy || Boolean(state.sportsResult);
  return shell([
    screenHeader('Прогноз события', 'Конкретный сценарий и уровень уверенности', 'home'),
    h('section', { className: 'premium-sports-hero' },
      h('img', {
        attrs: {
          src: premiumArtUrl('sports-prophecy-banner'),
          alt: '',
          draggable: 'false'
        }
      }),
      h('p', { text: 'У каждого состязания есть ритм, напряжение и миг, когда рисунок меняется.' })
    ),
    MysticCard({ className: 'premium-form-card', children: [
      field('Событие или команды', textInput({
        value: state.sportsEvent,
        placeholder: 'Например: финал, команда А — команда Б',
        attrs: { maxlength: 160 },
        onInput: (value) => { state.sportsEvent = value; }
      })),
      field('Что особенно интересно?', textarea({
        value: state.sportsContext,
        placeholder: 'Темп, возможный перелом, настроение встречи…',
        onInput: (value) => { state.sportsContext = value; },
        maxLength: 500
      }), 'Можно оставить пустым.')
    ] }),
    MysticButton({
      text: state.busy ? 'Собираем факторы…' : 'Получить конкретный прогноз',
      icon: 'sparkle',
      variant: 'primary',
      disabled: state.busy,
      onClick: submitSportsForecast
    }),
    state.busy ? loadingCard('Собираем знаки события…') : null,
    state.sportsResult
      ? MysticCard({
          className: 'premium-result-reading',
          children: [formatReading(state.sportsResult)]
        })
      : null,
    h('p', {
      className: 'premium-info-note',
      text: 'Прогноз показывает вероятный сценарий и неопределённость. Он не является гарантией и не предназначен для ставок.'
    })
  ], { active: 'home', reading });
}

async function submitSportsForecast() {
  const event = state.sportsEvent.trim().replace(/\s+/g, ' ');
  if (!event) return notify('Укажите спортивное событие или команды');
  if (state.busy) return;
  state.busy = true;
  render();
  try {
    const reading = await requestReading('sports_forecast', {
      event,
      context: state.sportsContext.trim()
    }, '', { structured: true });
    state.sportsResult = reading.answer;
    await saveCloudReading({
      id: uniqueId('sports'), kind: 'sports', mode: 'forecast',
      type: 'Прогноз события', title: event, body: reading.answer,
      result: reading.result, createdAt: new Date().toISOString(), favorite: false
    }, { subtype: 'sports-forecast', input: { event, context: state.sportsContext.trim() } });
    pulse('medium');
  } catch (error) {
    notify(apiErrorMessage(error));
  } finally {
    state.busy = false;
    render();
  }
}

function walletStatusText() {
  if (state.walletStatus === 'loading') return 'Обновляем лицевой счёт…';
  if (state.walletStatus === 'ready') return `Доступно ${formatMoney(state.wallet?.wallet?.available)} SILARUM`;
  return state.walletMessage || 'Счёт доступен внутри Telegram';
}

function servicesScreen() {
  return shell([
    screenHeader('Практики', 'Каждая практика — отдельный понятный путь', 'home'),
    MysticCard({ className: 'premium-practices-intro', children: [
      h('p', { className: 'premium-kicker', text: 'ЭЗОТЕРИУМ' }),
      h('h2', { text: 'Выберите один вопрос и один способ чтения' }),
      h('p', { text: 'Совместимость и приглашения собраны отдельно в «Амуре», чтобы здесь не было повторяющихся экранов.' })
    ] }),
    h('div', { className: 'premium-service-list' },
      serviceTile('tarot-deck', 'Двенадцать раскладов Таро', 'От одного знака до глубокого Кельтского креста', () => navigate('tarot'), serviceBadge('tarot')),
      serviceTile('palm-oracle', 'Чтение по ладони', 'Фото ладони, вопросы мастера и подробное толкование', () => navigate('palm-reading'), serviceBadge('palm_reading', 'Бесплатно')),
      serviceTile('rune-sanctum', 'Руны и намерение', 'Одна или три руны, прогноз и безопасная практика', () => navigate('runes'), serviceBadge('rune_reading', 'Бесплатно')),
      serviceTile('astrology-forecast', 'Натальная подсказка', 'Сильные стороны и текущий ориентир', () => navigate('natal'), serviceBadge('natal')),
      serviceTile('photo-energy-imprint', 'Энергетический след', 'Фото как личный символ и точка опоры', () => navigate('photo-energy'), serviceBadge('photo_energy')),
      serviceTile('result-magic-seal', 'Определение порчи', 'Фото, ваша история и совет Эзотериума', () => navigate('photo-damage'), serviceBadge('photo_damage')),
      serviceTile('shortcut-astro-orbit', 'Гороскоп дня', 'Личный знак и ежедневное послание', () => navigate('horoscope'), ''),
      serviceTile('brand-sun', 'Спросить Эзотериума', 'Помощник по функциям приложения', () => navigate('support'))
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
  const categoryTabs = h('div', { className: 'premium-filter-row', attrs: { role: 'tablist', 'aria-label': 'Категории раскладов' } },
    Object.entries(TAROT_CATEGORIES).map(([id, label]) => h('button', {
      className: `premium-filter-chip ${state.tarotCategory === id ? 'is-active' : ''}`,
      attrs: { type: 'button', role: 'tab', 'aria-selected': state.tarotCategory === id ? 'true' : 'false' },
      on: { click: () => { state.tarotCategory = id; render(); } }
    }, label))
  );
  const spreads = Object.entries(SPREADS)
    .filter(([, spread]) => state.tarotCategory === 'all' || spread.category === state.tarotCategory);
  return shell([
    screenHeader('Расклады Таро', 'Двенадцать самостоятельных ритуалов', 'services'),
    MysticCard({ className: 'premium-tarot-intro', children: [
      h('img', { attrs: { src: premiumArtUrl('tarot-deck'), alt: '', draggable: 'false' } }),
      h('div', {},
        h('p', { className: 'premium-kicker', text: 'КОЛОДА ЭЗОТЕРИУМА' }),
        h('h2', { text: 'Выберите путь, а карты сохранят прежний облик' }),
        h('p', { text: 'Новый каталог, ритуал и композиции построены вокруг уже утверждённого дизайна арканов.' })
      )
    ] }),
    categoryTabs,
    h('div', { className: 'premium-spread-catalog' }, spreads.map(([id, spread]) => tarotSpreadCard(id, spread)))
  ]);
}

function tarotSpreadCard(id, spread) {
  const serviceId = spread.serviceId || 'tarot';
  return h('button', {
    className: 'premium-spread-card',
    attrs: { type: 'button', 'aria-label': `Открыть расклад ${spread.label}` },
    on: { click: () => selectTarotSpread(id) }
  },
  h('span', { className: 'premium-spread-card__art' },
    h('img', { attrs: { src: `/images/cards/${spread.cover}`, alt: '', loading: 'lazy', draggable: 'false' } }),
    h('span', { className: 'premium-spread-card__veil' }),
    h('b', { text: `${spread.count} ${spread.count === 1 ? 'карта' : spread.count < 5 ? 'карты' : 'карт'}` })
  ),
  h('span', { className: 'premium-spread-card__copy' },
    h('small', { text: spread.access }),
    h('strong', { text: spread.label }),
    h('span', { text: spread.description }),
    h('em', { text: serviceBadge(serviceId, 'Открыть ритуал') })
  ));
}

function selectTarotSpread(id) {
  if (!SPREADS[id]) return;
  state.spread = id;
  state.tarotQuestion = '';
  state.tarotCards = [];
  state.tarotDeck = [];
  state.tarotStage = 'question';
  pulse();
  navigate('tarot-question');
}

function tarotQuestionScreen() {
  const spread = SPREADS[state.spread] || SPREADS['past-present-future'];
  const question = textarea({
    value: state.tarotQuestion,
    placeholder: 'Сформулируйте один вопрос, который действительно важен сейчас…',
    onInput: (value) => { state.tarotQuestion = value; },
    maxLength: 500
  });
  return shell([
    screenHeader(spread.label, `${spread.count} ${spread.count === 1 ? 'карта' : 'карт'} · ${spread.description}`, 'tarot'),
    MysticCard({ className: 'premium-spread-hero', children: [
      h('img', { attrs: { src: `/images/cards/${spread.cover}`, alt: '', draggable: 'false' } }),
      h('div', {},
        h('p', { className: 'premium-kicker', text: spread.access.toUpperCase() }),
        h('h2', { text: spread.label }),
        h('p', { text: spread.description })
      )
    ] }),
    MysticCard({ className: 'premium-form-card', children: [
      field('Ваш вопрос', question, 'Не вводите адреса, пароли и платёжные данные.')
    ] }),
    ['love-relationship', 'pair-compatibility'].includes(state.spread)
      ? h('div', { className: 'premium-invite-panel' },
          SectionTitle({ text: 'Кого вы приглашаете?' }),
          GoalSelector({ value: state.inviteGoal, onChange: (goal) => { state.inviteGoal = goal; render(); } }),
          MysticButton({ text: 'Пригласить второго человека', icon: 'send', variant: 'gold', onClick: () => shareInvite('tarot') })
        )
      : null,
    MysticButton({ text: 'Войти в ритуал', icon: 'tarot', variant: 'primary', onClick: startTarot })
  ]);
}

async function startTarot() {
  if (!state.tarotQuestion.trim()) return notify('Сформулируйте вопрос');
  state.tarotCards = [];
  state.revealingCard = null;
  state.tarotStage = 'shuffle';
  state.tarotSessionId = '';
  state.tarotDeck = Array.from(
    { length: Math.max(14, SPREADS[state.spread].count + 8) },
    (_, index) => `closed-${index}`
  );
  pulse('medium');
  navigate('tarot-draw');
  if (!tg?.initData) return;
  try {
    const data = await api('/api/readings', {
      method: 'POST',
      body: {
        action: 'create_tarot_session',
        spreadId: state.spread,
        question: state.tarotQuestion.trim()
      }
    });
    state.tarotSessionId = data.sessionId || '';
  } catch (error) {
    notify(apiErrorMessage(error));
  }
}

function beginTarotSelection() {
  state.tarotStage = 'select';
  pulse('medium');
  render();
}

function tarotDrawScreen() {
  const spread = SPREADS[state.spread] || SPREADS['past-present-future'];
  if (state.tarotStage === 'shuffle') {
    return shell([
      screenHeader(spread.label, 'Подготовка колоды', 'tarot-question'),
      h('section', { className: 'premium-shuffle-ritual' },
        h('span', { className: 'premium-ritual-orbit', attrs: { 'aria-hidden': 'true' } }),
        h('div', { className: 'premium-deck-stack', attrs: { 'aria-label': 'Закрытая колода Таро' } },
          h('img', { attrs: { src: '/images/card-back.webp', alt: 'Рубашка колоды Таро' } }),
          h('img', { attrs: { src: '/images/card-back.webp', alt: '' } }),
          h('img', { attrs: { src: '/images/card-back.webp', alt: '' } })
        ),
        h('p', { text: 'Удерживайте вопрос в мыслях. Колода откроет карты только по одной.' })
      ),
      MysticButton({ text: 'Перемешать колоду', icon: 'sparkle', variant: 'primary', onClick: beginTarotSelection })
    ], { tabs: false });
  }

  const cards = h('div', { className: 'premium-tarot-grid' }, state.tarotDeck.map((name, index) => {
    const selected = state.tarotCards.includes(name);
    const locked = Boolean(state.revealingCard) || state.tarotCards.length >= spread.count;
    return h('button', {
      className: `premium-tarot-card ${selected ? 'is-selected' : ''}`,
      attrs: { type: 'button', disabled: selected || locked, 'aria-label': selected ? name : `Выбрать закрытую карту ${index + 1}` },
      on: { click: () => selectTarotCard(index) }
    }, selected ? h('img', { attrs: { src: tarotCardImage(name), alt: name } }) : h('span', { text: '✦' }));
  }));

  return shell([
    screenHeader(spread.label, `Выбрано ${state.tarotCards.length} из ${spread.count}`, 'tarot-question'),
    h('div', { className: 'premium-ritual-progress' },
      h('span', { style: { '--progress': `${Math.round((state.tarotCards.length / spread.count) * 100)}%` } }),
      h('small', { text: state.tarotCards.length < spread.count ? 'Выбирайте карты по одной' : 'Композиция собрана' })
    ),
    state.tarotCards.length ? tarotComposition(spread) : null,
    h('p', {
      className: 'premium-centered-copy',
      text: state.tarotCards.length < spread.count
        ? 'Коснитесь закрытой карты. После раскрытия она займёт свою позицию.'
        : 'Все позиции открыты. Посмотрите на расклад целиком.'
    }),
    cards,
    state.tarotCards.length === spread.count && !state.revealingCard
      ? MysticButton({ text: state.busy ? 'Читаем знаки…' : 'Узнать толкование', icon: 'sparkle', variant: 'primary', disabled: state.busy, onClick: submitTarot })
      : null,
    state.revealingCard ? tarotRevealOverlay(state.revealingCard) : null,
    state.busy ? loadingCard('Эзотериум соединяет позиции и противоречия…') : null
  ], { tabs: false });
}

function tarotComposition(spread, cards = state.tarotCards) {
  return h('div', { className: `premium-tarot-composition premium-tarot-composition--${spread.count}`, attrs: { 'aria-label': 'Композиция расклада' } },
    cards.map((name, index) => h('figure', { className: 'premium-composition-card' },
      h('img', { attrs: { src: tarotCardImage(name), alt: name } }),
      h('figcaption', {},
        h('small', { text: spread.positions[index] || `Позиция ${index + 1}` }),
        h('strong', { text: name })
      )
    ))
  );
}

function tarotRevealOverlay(reveal) {
  return h('div', { className: 'premium-card-reveal', attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': `Открыта карта ${reveal.name}` } },
    h('span', { className: 'premium-card-reveal__mist', attrs: { 'aria-hidden': 'true' } }),
    h('div', { className: 'premium-card-reveal__card' },
      h('img', { attrs: { src: reveal.loading ? '/images/card-back.webp' : tarotCardImage(reveal.name), alt: reveal.loading ? 'Закрытая карта' : reveal.name } }),
      h('small', { text: reveal.position }),
      h('strong', { text: reveal.name })
    )
  );
}

async function selectTarotCard(slotIndex) {
  const spread = SPREADS[state.spread];
  if (state.revealingCard || state.tarotCards.length >= spread.count) return;
  if (!String(state.tarotDeck[slotIndex] || '').startsWith('closed-')) return;
  const index = state.tarotCards.length;
  state.revealingCard = { name: 'Карта открывается…', position: spread.positions[index] || `Позиция ${index + 1}`, loading: true };
  pulse('medium');
  render();
  let name = '';
  try {
    if (tg?.initData && state.tarotSessionId) {
      const data = await api('/api/readings', {
        method: 'POST',
        body: { action: 'draw_tarot_card', readingId: state.tarotSessionId }
      });
      name = data.card;
    } else {
      const available = TAROT_CARD_NAMES.filter((card) => !state.tarotCards.includes(card));
      name = available[cryptoIndex(available.length)];
    }
  } catch (error) {
    state.revealingCard = null;
    notify(apiErrorMessage(error));
    return render();
  }
  state.tarotDeck[slotIndex] = name;
  state.tarotCards.push(name);
  state.revealingCard = { name, position: spread.positions[index] || `Позиция ${index + 1}` };
  render();
  const duration = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ? 320 : TAROT_REVEAL_MS;
  window.setTimeout(() => {
    if (state.revealingCard?.name !== name) return;
    state.revealingCard = null;
    state.tarotStage = state.tarotCards.length >= spread.count ? 'complete' : 'select';
    render();
  }, duration);
}

async function submitTarot() {
  if (state.busy) return;
  const spread = SPREADS[state.spread];
  const serviceId = spread.serviceId || 'tarot';
  if (!confirmServicePayment(serviceId)) return;
  state.busy = true;
  render();
  try {
    const answer = await requestReading('tarot', { question: state.tarotQuestion.trim(), cards: state.tarotCards, spread: state.spread, positions: spread.positions }, serviceId);
    state.result = {
      id: uniqueId('tarot'), kind: 'tarot', spread: state.spread, positions: [...spread.positions],
      type: `Расклад «${spread.label}»`, title: state.tarotQuestion.trim(), body: answer,
      cards: [...state.tarotCards], createdAt: new Date().toISOString(), favorite: false
    };
    await saveCloudReading(state.result, {
      readingId: state.tarotSessionId,
      subtype: state.spread,
      input: { question: state.tarotQuestion.trim(), cards: state.tarotCards, positions: spread.positions }
    });
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
    state.result = { id: uniqueId('natal'), kind: 'natal', mode: 'natal', type: 'Натальная подсказка', title: state.natalDate, body: answer, cards: [], createdAt: new Date().toISOString(), favorite: false };
    await saveCloudReading(state.result, { subtype: 'natal', input: { date: state.natalDate, time: state.natalTime || '12:00' } });
    navigate('natal-result');
  } catch (error) { notify(apiErrorMessage(error)); }
  finally { state.busy = false; render(); }
}

function natalResultScreen() {
  return state.result ? resultScreen({ title: 'Натальная подсказка', subtitle: 'Ваши ориентиры', back: 'natal', result: state.result }) : natalScreen();
}

function compatibilityCatalogScreen() {
  const modes = [
    {
      id: 'photo', art: 'two-photo-compatibility', title: 'По фотографиям',
      copy: 'Два образа, визуальное созвучие и вопросы для честного диалога',
      badge: serviceBadge('photo_compatibility', 'Фото')
    },
    {
      id: 'palm', art: 'energy-hands', title: 'По ладоням',
      copy: 'Две ладони, линии и символический ритуал «Путь двух судеб»',
      badge: serviceBadge('palmlink', 'Ладони')
    },
    {
      id: 'data', art: 'shortcut-destiny-hearts', title: 'По персональным данным',
      copy: 'Имена, даты, время и место рождения обоих участников',
      badge: serviceBadge('photo_compatibility', 'Данные')
    }
  ];
  return shell([
    screenHeader('Совместимость', 'Три способа увидеть рисунок связи', 'services'),
    MysticCard({ className: 'premium-compatibility-intro', children: [
      h('img', { attrs: { src: premiumArtUrl('connection-heart'), alt: '', draggable: 'false' } }),
      h('div', {},
        h('p', { className: 'premium-kicker', text: 'ПРОСТРАНСТВО ДВУХ ЛЮДЕЙ' }),
        h('h2', { text: 'Выберите, какие знаки соединить' }),
        h('p', { text: 'Каждый способ ведёт к отдельному ритуалу и сохраняемому результату.' })
      )
    ] }),
    h('div', { className: 'premium-compatibility-modes' }, modes.map((mode) =>
      h('button', {
        className: `premium-compatibility-mode premium-compatibility-mode--${mode.id}`,
        attrs: { type: 'button' },
        on: { click: () => openCompatibilityMode(mode.id) }
      },
      h('img', { attrs: { src: premiumArtUrl(mode.art), alt: '', draggable: 'false' } }),
      h('span', {},
        h('small', { text: mode.badge }),
        h('strong', { text: mode.title }),
        h('span', { text: mode.copy })
      ),
      h('b', { text: 'Открыть →' }))
    ))
  ]);
}

function openCompatibilityMode(mode) {
  if (mode === 'photo') {
    return openEnabledFeature(state.publicConfig.jointReadingsEnabled, 'photo-compat', 'Совместные чтения временно отключены');
  }
  if (mode === 'palm') {
    return openEnabledFeature(state.publicConfig.palmLinkEnabled, 'palm', 'Совместимость по ладоням временно отключена администратором');
  }
  navigate('compatibility-data');
}

function updateCompatibilityPerson(side, key, value) {
  state.compatibilityData[side] = { ...state.compatibilityData[side], [key]: value };
}

function compatibilityPersonForm(side, title) {
  const person = state.compatibilityData[side];
  return MysticCard({ className: 'premium-form-card premium-person-form', children: [
    h('div', { className: 'premium-person-form__title' },
      h('img', { attrs: { src: premiumArtUrl(GENDER_OPTIONS[person.gender]?.art || 'avatar-seeker'), alt: '', draggable: 'false' } }),
      h('strong', { text: title })
    ),
    field('Имя', textInput({
      value: person.name,
      placeholder: 'Имя',
      attrs: { maxlength: 80, autocomplete: 'name' },
      onInput: (value) => updateCompatibilityPerson(side, 'name', value)
    })),
    field('Пол', selectField(GENDER_OPTIONS, person.gender, (value) => {
      updateCompatibilityPerson(side, 'gender', value);
      render();
    })),
    h('div', { className: 'premium-two-fields' },
      field('Дата рождения', textInput({ type: 'date', value: person.date, onInput: (value) => updateCompatibilityPerson(side, 'date', value) })),
      field('Время', textInput({ type: 'time', value: person.time, onInput: (value) => updateCompatibilityPerson(side, 'time', value) }))
    ),
    field('Место рождения', textInput({
      value: person.place,
      placeholder: 'Город, страна',
      attrs: { maxlength: 120, autocomplete: 'address-level2' },
      onInput: (value) => updateCompatibilityPerson(side, 'place', value)
    }), 'Если время или место неизвестны, поле можно оставить пустым.')
  ] });
}

function compatibilityDataScreen() {
  return shell([
    screenHeader('Совместимость по данным', 'Два человека — один понятный прогноз', state.amurMode === 'compatibility' ? 'amur' : 'compatibility'),
    h('div', { className: 'premium-person-forms' },
      compatibilityPersonForm('first', 'Первый участник'),
      compatibilityPersonForm('second', 'Второй участник')
    ),
    field('Что важно понять?', textarea({
      value: state.compatibilityData.question,
      placeholder: 'Например: как нам лучше слышать друг друга?',
      onInput: (value) => { state.compatibilityData.question = value; },
      maxLength: 500
    })),
    MysticButton({
      text: state.busy ? 'Соединяем два ритма…' : 'Начать ритуал совместимости',
      icon: 'heart',
      variant: 'primary',
      disabled: state.busy,
      onClick: submitDataCompatibility
    }),
    state.busy ? compatibilityLoadingRitual() : null,
    PriceLine({ price: serviceConfig('photo_compatibility').price })
  ], { tabs: false });
}

function compatibilityLoadingRitual() {
  return MysticCard({ className: 'premium-compatibility-loading', children: [
    h('div', { className: 'premium-compatibility-loading__orbits', attrs: { 'aria-hidden': 'true' } },
      h('i'), h('i'), h('span', { text: '✦' })
    ),
    h('ol', {},
      h('li', { className: 'is-active', text: 'Изучаем индивидуальные ритмы' }),
      h('li', { text: 'Соединяем точки притяжения' }),
      h('li', { text: 'Формируем практические ориентиры' })
    )
  ] });
}

async function submitDataCompatibility() {
  const { first, second, question } = state.compatibilityData;
  if (!first.name.trim() || !second.name.trim()) return notify('Укажите имена обоих участников');
  if (!first.date || !second.date) return notify('Укажите даты рождения обоих участников');
  if (state.busy) return;
  if (state.amurMode !== 'compatibility' && !confirmServicePayment('photo_compatibility')) return;
  state.busy = true;
  render();
  try {
    const reading = await requestReading(state.amurMode === 'compatibility' ? 'amur_compatibility' : 'compatibility', {
      first: { ...first, name: first.name.trim() },
      second: { ...second, name: second.name.trim() },
      question: question.trim() || 'Что помогает этим двум людям слышать друг друга?',
      relationship: goalLabel(state.inviteGoal),
      dice: state.amurDice
    }, state.amurMode === 'compatibility' ? '' : 'photo_compatibility', { structured: true });
    state.result = {
      id: uniqueId('compatibility-data'), kind: state.amurMode === 'compatibility' ? 'amur' : 'compatibility', mode: 'data',
      type: state.amurMode === 'compatibility' ? 'Амур · совместимость' : 'Совместимость по данным',
      title: `${first.name.trim()} и ${second.name.trim()}`,
      body: reading.answer, result: reading.result, cards: [], createdAt: new Date().toISOString(), favorite: false,
      score: reading.result.score, aspects: reading.result.aspects, participants: [
        { name: first.name.trim(), gender: first.gender, note: first.date },
        { name: second.name.trim(), gender: second.gender, note: second.date }
      ]
    };
    await saveCloudReading(state.result, {
      subtype: state.amurMode === 'compatibility' ? 'amur-data' : 'data',
      input: { first, second, question, dice: state.amurDice }
    });
    navigate('compatibility-data-result');
  } catch (error) {
    notify(apiErrorMessage(error));
  } finally {
    state.busy = false;
    render();
  }
}

function photoScreen(mode) {
  state.photoMode = mode;
  const isPair = mode === 'compatibility';
  const isDamage = mode === 'damage';
  const title = isPair ? 'Совместимость по фото' : isDamage ? 'Определение порчи' : 'Энергетический след';
  const subtitle = isPair ? 'Два образа и бережный диалог' : isDamage ? 'Фото, ваша история и личный совет' : 'Фото как символ вашего состояния';
  const firstUpload = imageUpload({
    title: isPair ? 'Первое фото' : 'Загрузите фотографию',
    image: state.photoOne,
    capture: 'user',
    onImage: (image) => { state.photoOne = image; render(); },
    onRemove: () => { state.photoOne = ''; render(); }
  });
  const secondUpload = isPair ? imageUpload({
    title: 'Второе фото',
    image: state.photoTwo,
    capture: 'user',
    onImage: (image) => { state.photoTwo = image; render(); },
    onRemove: () => { state.photoTwo = ''; render(); }
  }) : null;
  return shell([
    screenHeader(title, subtitle, isPair && ['photo', 'compatibility'].includes(state.amurMode) ? 'amur' : isPair ? 'compatibility' : 'services'),
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
    state.busy ? compatibilityLoadingRitual() : null
  ]);
}

function imageUpload({ title, image, onImage, onRemove, capture = 'environment' }) {
  const upload = UploadCard({
    title: image ? 'Фото готово' : title,
    subtitle: image ? 'Предпросмотр доступен здесь' : 'Выберите файл или сделайте снимок',
    status: image ? 'ready' : 'empty'
  });
  upload.type = 'button';
  upload.classList.add('premium-upload-card');
  const input = h('input', { attrs: { type: 'file', accept: 'image/jpeg,image/png,image/webp', hidden: true } });
  const cameraInput = h('input', {
    attrs: { type: 'file', accept: 'image/*', capture, hidden: true }
  });
  if (image) upload.prepend(h('img', { className: 'premium-upload-preview', attrs: { src: image, alt: '' } }));
  upload.addEventListener('click', () => input.click());
  const processInput = async (source) => {
    try { onImage(await prepareImage(source.files?.[0])); pulse('medium'); }
    catch (error) { notify(error.message || 'Не удалось обработать фото'); }
    finally { source.value = ''; }
  };
  input.addEventListener('change', () => processInput(input));
  cameraInput.addEventListener('change', async () => {
    try { onImage(await prepareImage(cameraInput.files?.[0])); pulse('medium'); }
    catch (error) { notify(error.message || 'Не удалось обработать фото'); }
    finally { cameraInput.value = ''; }
  });
  const actions = h('div', { className: 'premium-upload-actions' },
    h('button', { attrs: { type: 'button' }, on: { click: () => input.click() } }, image ? 'Заменить' : 'Выбрать'),
    h('button', { attrs: { type: 'button' }, on: { click: () => cameraInput.click() } }, image ? 'Переснять' : 'Снять'),
    image && onRemove
      ? h('button', { className: 'is-danger', attrs: { type: 'button' }, on: { click: onRemove } }, 'Удалить')
      : null
  );
  return h('div', { className: 'premium-upload-wrap' }, input, cameraInput, upload, actions);
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
    const generated = await requestReading(feature, payload, feature, { structured: pair });
    const answer = pair ? generated.answer : generated;
    const structured = pair ? generated.result : null;
    state.result = {
      id: uniqueId(feature), kind: pair ? 'compatibility' : 'photo', mode: pair ? 'photo' : damage ? 'damage' : 'energy',
      type: pair ? 'Совместимость по фото' : damage ? 'Разбор Эзотериума' : 'Энергетический след',
      title: pair
        ? `${state.photoNameOne || 'Первый человек'} и ${state.photoNameTwo || 'Второй человек'}`
        : state.photoConcern || 'Символическое фото-чтение',
      body: answer, result: structured || {}, cards: [], createdAt: new Date().toISOString(), favorite: false,
      score: pair ? structured.score : null,
      aspects: pair ? structured.aspects : [],
      participants: pair ? [
        { name: state.photoNameOne || 'Первый человек', gender: 'unspecified', note: 'Первый образ' },
        { name: state.photoNameTwo || 'Второй человек', gender: 'unspecified', note: 'Второй образ' }
      ] : []
    };
    await saveCloudReading(state.result, {
      subtype: state.result.mode,
      input: { concern: payload.concern, firstName: payload.firstName, secondName: payload.secondName },
      media: pair ? [state.photoOne, state.photoTwo] : [state.photoOne]
    });
    navigate('photo-result');
  } catch (error) { notify(apiErrorMessage(error)); }
  finally { state.busy = false; render(); }
}

function photoResultScreen() {
  const back = state.photoMode === 'compatibility' ? 'photo-compat' : state.photoMode === 'damage' ? 'photo-damage' : 'photo-energy';
  if (!state.result) return servicesScreen();
  return state.result.kind === 'compatibility'
    ? compatibilityResultScreen(back)
    : resultScreen({ title: state.result.type, subtitle: 'Личный ответ Эзотериума', back, result: state.result });
}

const PALM_QUESTIONS = [
  'Какой вопрос о настоящем для вас важнее всего?',
  'Где вы сейчас чувствуете выбор: отношения, работа, деньги, дом или внутреннее состояние?',
  'Что заметно изменилось в вашей жизни за последние три месяца?',
  'Какой ответ был бы для вас не просто приятным, а действительно полезным?'
];

function palmReadingScreen() {
  const dialogue = state.palmDialogue;
  const intro = dialogue.stage === 'intro';
  const completed = dialogue.stage === 'result' && dialogue.result;
  const upload = intro ? imageUpload({
    title: 'Сфотографируйте раскрытую ладонь при дневном свете',
    image: dialogue.image,
    capture: 'environment',
    onImage: (image) => { dialogue.image = image; render(); },
    onRemove: () => { dialogue.image = ''; render(); }
  }) : null;
  return shell([
    screenHeader('Чтение по ладони', intro ? 'Реальный диалог перед толкованием' : 'Разговор с Эзотериумом', 'services'),
    intro ? h('section', { className: 'premium-feature-hero premium-feature-hero--palm' },
      h('img', { attrs: { src: premiumArtUrl('palm-oracle'), alt: '' } }),
      h('div', {},
        h('p', { className: 'premium-kicker', text: 'ХИРОМАНТИЯ БЕЗ ДОГАДОК' }),
        h('h1', { text: 'Сначала ладонь. Затем — ваши ответы.' }),
        h('p', { text: 'Эзотериум сверит видимые линии с тем, что происходит в вашей жизни, и честно отметит неразличимые детали.' })
      )
    ) : null,
    intro ? upload : null,
    intro ? h('div', { className: 'premium-segmented-choice' },
      h('button', {
        className: dialogue.hand === 'left' ? 'is-active' : '',
        attrs: { type: 'button' },
        on: { click: () => { dialogue.hand = 'left'; render(); } }
      }, 'Левая ладонь'),
      h('button', {
        className: dialogue.hand === 'right' ? 'is-active' : '',
        attrs: { type: 'button' },
        on: { click: () => { dialogue.hand = 'right'; render(); } }
      }, 'Правая ладонь')
    ) : null,
    intro ? field('Главный вопрос', textarea({
      value: dialogue.question,
      placeholder: 'Например: что мешает мне решиться на перемены?',
      onInput: (value) => { dialogue.question = value; },
      maxLength: 500
    })) : null,
    intro ? MysticCard({ className: 'premium-palm-guide', children: [
      h('strong', { text: 'Как сделать хороший снимок' }),
      h('ol', {},
        h('li', { text: 'Разверните ладонь к камере и расслабьте пальцы.' }),
        h('li', { text: 'Избегайте теней, бликов и фильтров.' }),
        h('li', { text: 'В кадре должна быть вся ладонь от запястья до кончиков пальцев.' })
      )
    ] }) : null,
    intro ? MysticButton({
      text: 'Начать диалог',
      icon: 'hand',
      variant: 'primary',
      onClick: startPalmDialogue
    }) : null,
    !intro && !completed ? palmDialoguePanel() : null,
    completed ? palmReadingResult(dialogue.result) : null
  ], { active: 'services', reading: !intro });
}

function palmDialoguePanel() {
  const dialogue = state.palmDialogue;
  const currentQuestion = PALM_QUESTIONS[dialogue.answers.length];
  const input = textarea({
    value: dialogue.draft,
    placeholder: 'Ответьте своими словами…',
    onInput: (value) => { dialogue.draft = value; },
    maxLength: 700
  });
  return h('section', { className: 'premium-oracle-dialogue' },
    h('div', { className: 'premium-dialogue-progress' },
      h('span', {}, h('i', { style: `width:${Math.min(100, (dialogue.answers.length / PALM_QUESTIONS.length) * 100)}%` })),
      h('small', { text: `${Math.min(dialogue.answers.length + 1, PALM_QUESTIONS.length)} из ${PALM_QUESTIONS.length}` })
    ),
    h('div', { className: 'premium-dialogue-messages' },
      dialogue.messages.map((message) => h('div', {
        className: `premium-dialogue-bubble is-${message.role}`,
        text: message.content
      })),
      state.busy ? h('div', { className: 'premium-dialogue-bubble is-assistant is-thinking' }, h('i'), h('i'), h('i')) : null
    ),
    currentQuestion && !state.busy ? MysticCard({ className: 'premium-dialogue-composer', children: [
      input,
      MysticButton({
        text: dialogue.answers.length === PALM_QUESTIONS.length - 1 ? 'Завершить и истолковать' : 'Ответить',
        icon: 'send',
        variant: 'primary',
        onClick: submitPalmDialogueAnswer
      })
    ] }) : null,
    state.busy ? loadingCard('Сверяем ответы с линиями ладони…') : null
  );
}

async function startPalmDialogue() {
  const dialogue = state.palmDialogue;
  if (!dialogue.image) return notify('Сначала добавьте фотографию ладони');
  if (dialogue.question.trim().length < 5) return notify('Сформулируйте главный вопрос');
  dialogue.stage = 'dialogue';
  dialogue.messages = [{ role: 'assistant', content: PALM_QUESTIONS[0] }];
  dialogue.answers = [];
  dialogue.draft = '';
  render();
  if (!tg?.initData) return;
  try {
    const created = await api('/api/readings', {
      method: 'POST',
      body: {
        action: 'create_dialogue_session',
        kind: 'palm',
        subtype: dialogue.hand,
        title: dialogue.question.trim(),
        input: { hand: dialogue.hand, question: dialogue.question.trim() }
      }
    });
    dialogue.sessionId = created.sessionId || '';
    if (dialogue.sessionId) {
      await api('/api/readings', {
        method: 'POST',
        body: { action: 'append_dialogue_message', readingId: dialogue.sessionId, role: 'assistant', content: PALM_QUESTIONS[0] }
      });
    }
  } catch {
    notify('Диалог продолжится; синхронизация восстановится при сохранении');
  }
}

async function submitPalmDialogueAnswer() {
  const dialogue = state.palmDialogue;
  const answer = dialogue.draft.trim().replace(/\s+/g, ' ');
  if (answer.length < 3) return notify('Расскажите чуть подробнее');
  const index = dialogue.answers.length;
  dialogue.answers.push(answer);
  dialogue.messages.push({ role: 'user', content: answer });
  dialogue.draft = '';
  if (dialogue.sessionId) {
    api('/api/readings', {
      method: 'POST',
      body: { action: 'append_dialogue_message', readingId: dialogue.sessionId, role: 'user', content: answer }
    }).catch(() => {});
  }
  if (dialogue.answers.length < PALM_QUESTIONS.length) {
    const acknowledgement = index === 0
      ? 'Я понял направление вопроса. Теперь уточним, где именно сейчас находится напряжение.'
      : index === 1
        ? 'Эта область обозначена. Важно увидеть, что уже начало меняться.'
        : 'Контекст стал яснее. Осталось отделить полезный ответ от просто желаемого.';
    const nextQuestion = PALM_QUESTIONS[dialogue.answers.length];
    dialogue.messages.push({ role: 'assistant', content: `${acknowledgement} ${nextQuestion}` });
    if (dialogue.sessionId) {
      api('/api/readings', {
        method: 'POST',
        body: { action: 'append_dialogue_message', readingId: dialogue.sessionId, role: 'assistant', content: `${acknowledgement} ${nextQuestion}` }
      }).catch(() => {});
    }
    pulse();
    return render();
  }
  state.busy = true;
  dialogue.messages.push({ role: 'assistant', content: 'Спасибо. Теперь я сопоставляю ваши ответы с теми линиями, которые действительно различимы на снимке.' });
  render();
  try {
    const reading = await requestReading('palm_reading', {
      image: dialogue.image,
      hand: dialogue.hand === 'left' ? 'левой' : 'правой',
      question: dialogue.question.trim(),
      answers: dialogue.answers,
      consentOwn: true
    }, '', { structured: true });
    dialogue.result = reading.result;
    dialogue.stage = 'result';
    state.result = {
      id: dialogue.sessionId || uniqueId('palm-reading'),
      kind: 'palm',
      mode: 'palm-reading',
      type: 'Чтение по ладони',
      title: dialogue.question.trim(),
      body: reading.answer,
      result: reading.result,
      createdAt: new Date().toISOString(),
      favorite: false
    };
    await saveCloudReading(state.result, {
      readingId: dialogue.sessionId,
      subtype: dialogue.hand,
      input: { question: dialogue.question.trim(), hand: dialogue.hand, answers: dialogue.answers },
      media: [dialogue.image]
    });
    pulse('medium');
  } catch (error) {
    notify(apiErrorMessage(error));
  } finally {
    state.busy = false;
    render();
  }
}

function palmReadingResult(result) {
  return h('section', { className: 'premium-structured-result' },
    MysticCard({ className: `premium-quality-card is-${result.quality}`, children: [
      h('small', { text: result.quality === 'retake' ? 'СНИМОК ЛУЧШЕ ПЕРЕСНЯТЬ' : 'КАЧЕСТВО СНИМКА ПОДХОДИТ' }),
      h('h2', { text: result.summary }),
      h('p', { text: result.limitation })
    ] }),
    h('div', { className: 'premium-observation-list' },
      (result.observations || []).map((item) => MysticCard({ className: 'premium-observation-card', children: [
        h('strong', { text: item.line }),
        h('small', { text: item.visibleDetail }),
        h('p', { text: item.interpretation })
      ] }))
    ),
    MysticCard({ className: 'premium-result-reading', children: [formatReading(result.narrative)] }),
    SectionTitle({ text: 'Три шага' }),
    h('ol', { className: 'premium-action-list' }, (result.actions || []).map((action) => h('li', { text: action }))),
    MysticButton({
      text: 'Новое чтение',
      icon: 'hand',
      variant: 'outline',
      onClick: () => {
        state.palmDialogue = { sessionId: '', stage: 'intro', hand: 'right', question: '', image: '', draft: '', messages: [], answers: [], result: null };
        render();
      }
    })
  );
}

const RUNES = [
  ['ᚠ', 'Феху', 'ресурс и движение'], ['ᚢ', 'Уруз', 'сила и восстановление'],
  ['ᚦ', 'Турисаз', 'граница и проверка'], ['ᚨ', 'Ансуз', 'слово и понимание'],
  ['ᚱ', 'Райдо', 'путь и согласование'], ['ᚲ', 'Кеназ', 'ясность и мастерство'],
  ['ᚷ', 'Гебо', 'обмен и партнёрство'], ['ᚹ', 'Вуньо', 'радость и согласие'],
  ['ᚺ', 'Хагалаз', 'перестройка'], ['ᚾ', 'Наутиз', 'необходимость и терпение'],
  ['ᛁ', 'Иса', 'пауза и сосредоточение'], ['ᛃ', 'Йера', 'цикл и результат'],
  ['ᛇ', 'Эйваз', 'стойкость и переход'], ['ᛈ', 'Перт', 'тайна и вероятность'],
  ['ᛉ', 'Альгиз', 'защита и внимание'], ['ᛋ', 'Соулу', 'цель и жизненность'],
  ['ᛏ', 'Тейваз', 'решимость и справедливость'], ['ᛒ', 'Беркана', 'рост и забота'],
  ['ᛖ', 'Эваз', 'доверие и движение'], ['ᛗ', 'Манназ', 'человек и сообщество'],
  ['ᛚ', 'Лагуз', 'чувство и течение'], ['ᛜ', 'Ингуз', 'созревание'],
  ['ᛞ', 'Дагаз', 'перелом и ясность'], ['ᛟ', 'Отала', 'дом и наследие']
];

function runeScreen() {
  const result = state.runeResult;
  return shell([
    screenHeader('Руны', 'Знак, смысл и действие', 'services'),
    h('section', { className: 'premium-feature-hero premium-feature-hero--runes' },
      h('img', { attrs: { src: premiumArtUrl('rune-sanctum'), alt: '' } }),
      h('div', {},
        h('p', { className: 'premium-kicker', text: 'СТАРШИЙ ФУТАРК' }),
        h('h1', { text: 'Пусть знак станет конкретным шагом' }),
        h('p', { text: 'Руны не обещают чудо. Они помогают увидеть тенденцию, препятствие и доступный ресурс.' })
      )
    ),
    field('Ваш вопрос', textarea({
      value: state.runeQuestion,
      placeholder: 'Что мне важно сделать в ближайшее время?',
      onInput: (value) => { state.runeQuestion = value; },
      maxLength: 500
    })),
    h('div', { className: 'premium-segmented-choice' },
      h('button', { className: state.runeCount === 1 ? 'is-active' : '', attrs: { type: 'button' }, on: { click: () => { state.runeCount = 1; render(); } } }, 'Одна руна'),
      h('button', { className: state.runeCount === 3 ? 'is-active' : '', attrs: { type: 'button' }, on: { click: () => { state.runeCount = 3; render(); } } }, 'Три руны')
    ),
    state.runeSelection.length ? h('div', { className: 'premium-rune-cast' },
      state.runeSelection.map(([glyph, name, meaning], index) => h('div', {
        className: 'premium-rune-stone',
        style: `--delay:${index * 120}ms`
      }, h('b', { text: glyph }), h('strong', { text: name }), h('small', { text: meaning })))
    ) : null,
    MysticButton({
      text: state.busy ? 'Руны раскрываются…' : state.runeSelection.length ? 'Сделать новый бросок' : 'Бросить руны',
      icon: 'sparkle',
      variant: 'primary',
      disabled: state.busy,
      onClick: castRunes
    }),
    state.busy ? loadingCard('Соединяем три знака в один прогноз…') : null,
    result ? h('section', { className: 'premium-structured-result' },
      MysticCard({ className: 'premium-result-reading', children: [
        h('h2', { text: result.headline }),
        formatReading(result.narrative)
      ] }),
      h('div', { className: 'premium-rune-result-grid' },
        MysticCard({ children: [h('small', { text: 'Тенденция' }), h('p', { text: result.tendency })] }),
        MysticCard({ children: [h('small', { text: 'Препятствие' }), h('p', { text: result.obstacle })] }),
        MysticCard({ children: [h('small', { text: 'Ресурс' }), h('p', { text: result.resource })] })
      ),
      MysticCard({ className: 'premium-rune-ritual', children: [
        h('strong', { text: 'Действие на 24 часа' }), h('p', { text: result.action24h }),
        h('strong', { text: 'Безопасная практика намерения' }), h('p', { text: result.safeRitual })
      ] })
    ) : null
  ], { active: 'services', reading: state.busy || Boolean(result) });
}

function cryptoIndex(max) {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return value[0] % max;
}

async function castRunes() {
  const question = state.runeQuestion.trim();
  if (question.length < 5) return notify('Сформулируйте вопрос для рун');
  if (state.busy) return;
  const pool = [...RUNES];
  state.runeSelection = [];
  while (state.runeSelection.length < state.runeCount) {
    state.runeSelection.push(pool.splice(cryptoIndex(pool.length), 1)[0]);
  }
  state.runeResult = null;
  state.busy = true;
  render();
  try {
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const reading = await requestReading('rune_reading', {
      question,
      runes: state.runeSelection.map(([, name]) => name)
    }, '', { structured: true });
    state.runeResult = reading.result;
    const saved = {
      id: uniqueId('runes'), kind: 'runes', type: 'Руны', title: question,
      body: reading.answer, result: reading.result, createdAt: new Date().toISOString(), favorite: false
    };
    state.result = saved;
    await saveCloudReading(saved, { subtype: `${state.runeCount}-runes`, input: { question, runes: state.runeSelection.map(([, name]) => name) } });
    pulse('medium');
  } catch (error) {
    notify(apiErrorMessage(error));
  } finally {
    state.busy = false;
    render();
  }
}

function amurScreen() {
  const diceText = state.amurDice.length
    ? amurDiceMeaning(state.amurDice)
    : 'Два броска создают игровой образ вашей пары — без ставок и скрытых правил.';
  return shell([
    screenHeader('Амур', 'Игра, совместимость и приглашения', 'home'),
    h('section', { className: 'premium-amur-hero' },
      h('img', { attrs: { src: premiumArtUrl('amur-dice'), alt: '' } }),
      h('div', {},
        h('p', { className: 'premium-kicker', text: 'ИГРА ДВУХ СУДЕБ' }),
        h('h1', { text: 'Бросьте кости. Затем проверьте смысл.' }),
        h('p', { text: 'Лёгкая игровая механика приводит к настоящему анализу данных, фото или ладоней.' })
      )
    ),
    h('div', { className: 'premium-amur-dice-stage', attrs: { 'aria-live': 'polite' } },
      [0, 1].map((index) => h('div', {
        className: `premium-amur-die ${state.amurRolling ? 'is-rolling' : ''}`,
        text: state.amurDice[index] ? diceGlyph(state.amurDice[index]) : '✦'
      })),
      h('p', { text: diceText })
    ),
    MysticButton({
      text: state.amurRolling ? 'Кости в движении…' : 'Бросить кости Амура',
      icon: 'heart',
      variant: 'gold',
      disabled: state.amurRolling,
      onClick: rollAmurDice
    }),
    SectionTitle({ text: 'Проверить совместимость' }),
    h('div', { className: 'premium-amur-paths' },
      serviceTile('shortcut-destiny-hearts', 'По персональным данным', 'Имена, даты и конкретные рекомендации', () => {
        state.amurMode = 'compatibility';
        navigate('compatibility-data');
      }, 'Подробно'),
      serviceTile('two-photo-compatibility', 'По фотографиям', 'Два образа и визуальная атмосфера', () => {
        state.amurMode = 'photo';
        navigate('photo-compat');
      }, serviceBadge('photo_compatibility')),
      serviceTile('energy-hands', 'По ладоням', 'Совместный рисунок двух ладоней', () => {
        state.amurMode = 'palm';
        navigate('palm');
      }, serviceBadge('palmlink')),
      serviceTile('partner-invite-emblem', 'Личное приглашение', 'Карточка, ссылка и автоматическое ожидание данных', () => navigate('invite-start'), 'Для двоих')
    )
  ], { active: 'amur' });
}

function diceGlyph(value) {
  return ['','⚀','⚁','⚂','⚃','⚄','⚅'][value] || '✦';
}

function amurDiceMeaning(values) {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (values[0] === values[1]) return `Дубль ${values[0]}: сегодня важнее всего совпадение темпа и честное «мы».`;
  if (total <= 5) return 'Тихий бросок: не торопите связь — задайте один прямой вопрос.';
  if (total <= 8) return 'Ровный бросок: притяжение поддержит маленькое совместное действие.';
  return 'Сильный бросок: энергии много; договоритесь о границах, прежде чем ускоряться.';
}

async function rollAmurDice() {
  if (state.amurRolling) return;
  state.amurRolling = true;
  state.amurDice = [];
  render();
  pulse('medium');
  await new Promise((resolve) => setTimeout(resolve, 900));
  state.amurDice = [cryptoIndex(6) + 1, cryptoIndex(6) + 1];
  state.amurRolling = false;
  pulse('medium');
  render();
}

function palmScreen() {
  if (state.publicConfig.palmLinkEnabled !== true) {
    return shell([
      screenHeader('Путь двух судеб', 'Функция временно отключена', 'services'),
      MysticCard({ className: 'premium-empty-state', children: [h('p', { text: 'Эзотериум готовит это пространство.' })] })
    ]);
  }
  const upload = imageUpload({
    title: 'Загрузите фото своей ладони',
    image: state.palmOne,
    capture: 'environment',
    onImage: (image) => { state.palmOne = image; render(); },
    onRemove: () => { state.palmOne = ''; render(); }
  });
  const selector = GoalSelector({ value: state.palmGoal, onChange: (goal) => { state.palmGoal = goal; render(); } });
  return shell([
    screenHeader('Путь двух судеб', 'Найди связь через символы ладоней', state.amurMode === 'palm' ? 'amur' : 'services'),
    upload,
    consentRow(
      'Я согласен на закрытую обработку изображения своей ладони для совместного чтения.',
      state.palmConsentOwn,
      (checked) => { state.palmConsentOwn = checked; }
    ),
    state.publicConfig.adultOnly !== false ? consentRow(
      'Мне исполнилось 18 лет.',
      state.palmAdultConfirmed,
      (checked) => { state.palmAdultConfirmed = checked; }
    ) : null,
    SectionTitle({ text: 'Цель поиска' }), selector,
    EnergyHandsScene(),
    h('div', { className: 'premium-palm-actions' },
      MysticButton({ text: 'Пригласить человека', icon: 'send', variant: 'gold', onClick: () => shareInvite('palm') }),
      MysticButton({ text: 'Продолжить ритуал', icon: 'heart', variant: 'primary', onClick: () => state.palmOne ? navigate('ritual') : notify('Сначала загрузите фото ладони') })
    ),
    PriceLine({ price: serviceConfig('palmlink').price })
  ]);
}

function ritualScreen() {
  const partnerUpload = imageUpload({
    title: 'Добавьте ладонь партнёра',
    image: state.palmTwo,
    capture: 'environment',
    onImage: (image) => { state.palmTwo = image; render(); },
    onRemove: () => { state.palmTwo = ''; render(); }
  });
  const actions = ActionGroup({ actions: [
    { text: 'Отправить приглашение', icon: 'send', variant: 'gold', onClick: () => shareInvite('palm') },
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

function shareInvite(flow = 'palm') {
  if (flow === 'tarot') return shareLegacyInvite(flow);
  const ownImage = flow === 'photo' ? state.photoOne : state.palmOne;
  if (!ownImage) {
    return notify(flow === 'photo'
      ? 'Сначала загрузите своё фото'
      : 'Сначала загрузите фото своей ладони');
  }
  const consentOwn = flow === 'photo' ? state.photoConsentOwn : state.palmConsentOwn;
  const adultConfirmed = flow === 'photo' ? state.photoAdultConfirmed : state.palmAdultConfirmed;
  if (!consentOwn) return notify('Подтвердите согласие на обработку своей фотографии');
  if (state.publicConfig.adultOnly !== false && !adultConfirmed) {
    return notify('Подтвердите, что вам исполнилось 18 лет');
  }
  if (!tg?.initData) return notify('Откройте приложение внутри Telegram, чтобы создать личное приглашение');
  state.inviteFlow = flow;
  state.inviteGoal = flow === 'palm' ? state.palmGoal : state.inviteGoal;
  state.inviteName = '';
  state.inviteGender = 'unspecified';
  state.inviteGenderTouched = false;
  state.preparedInvite = null;
  state.preparedInviteFile = null;
  navigate('invite-compose');
}

async function shareLegacyInvite(flow = 'tarot') {
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

function invitationPreview({ name, gender, goal, compact = false }) {
  const selectedGender = gender === 'male' ? 'male' : gender === 'female' ? 'female' : 'unspecified';
  const portrait = selectedGender === 'male'
    ? 'portrait-man'
    : selectedGender === 'female'
      ? 'portrait-woman'
      : 'partner-invite-emblem';
  return h('div', {
    className: `premium-invitation-preview premium-invitation-preview--${selectedGender} ${compact ? 'is-compact' : ''}`
  },
  h('img', {
    className: 'premium-invitation-preview__background',
    attrs: { src: `/images/invites/${goal}.png`, alt: '', draggable: 'false' }
  }),
  h('div', { className: 'premium-invitation-preview__scrim' }),
  h('img', {
    className: 'premium-invitation-preview__portrait',
    attrs: { src: premiumArtUrl(portrait), alt: '', draggable: 'false' }
  }),
  h('div', { className: 'premium-invitation-preview__copy' },
    h('small', { text: 'ЛИЧНОЕ ПРИГЛАШЕНИЕ' }),
    h('strong', { text: name ? `Для ${name}` : 'Укажите имя' }),
    h('span', { text: goalLabel(goal) })
  ));
}

function inviteGenderOptions(value, onSelect) {
  return h('div', { className: 'premium-invite-genders' },
    ['female', 'male'].map((gender) =>
      h('button', {
        className: `premium-invite-gender ${value === gender ? 'is-active' : ''}`,
        attrs: { type: 'button', 'aria-pressed': value === gender ? 'true' : 'false' },
        on: { click: () => onSelect(gender) }
      },
      h('img', { attrs: { src: premiumArtUrl(GENDER_OPTIONS[gender].art), alt: '', draggable: 'false' } }),
      h('span', { text: gender === 'female' ? 'Для женщины' : 'Для мужчины' }))
    )
  );
}

function inviteComposerScreen() {
  const suggestion = suggestGenderFromName(state.inviteName);
  const hint = !state.inviteName.trim()
    ? 'Введите имя — приложение предложит подходящий вариант открытки.'
    : suggestion === 'unspecified'
      ? 'Имя неоднозначное. Выберите вариант открытки вручную.'
      : `По имени предложена открытка ${suggestion === 'female' ? 'для женщины' : 'для мужчины'}. Проверьте выбор перед отправкой.`;
  return shell([
    screenHeader('Личное приглашение', 'Имя, открытка и системное меню телефона', state.inviteFlow === 'photo' ? 'photo-compat' : 'palm'),
    invitationPreview({
      name: state.inviteName.trim(),
      gender: state.inviteGender,
      goal: state.inviteGoal
    }),
    MysticCard({ className: 'premium-form-card premium-invite-form', children: [
      field('Кого вы приглашаете?', textInput({
        value: state.inviteName,
        placeholder: 'Введите имя',
        attrs: { maxlength: 80, autocomplete: 'name' },
        onInput: (value) => {
          state.inviteName = value;
          if (!state.inviteGenderTouched) state.inviteGender = suggestGenderFromName(value);
          state.preparedInvite = null;
          state.preparedInviteFile = null;
          render();
        }
      }), hint),
      h('div', {},
        h('span', { className: 'premium-field-label', text: 'Какую открытку отправить?' }),
        inviteGenderOptions(state.inviteGender, (gender) => {
          state.inviteGender = gender;
          state.inviteGenderTouched = true;
          state.preparedInvite = null;
          state.preparedInviteFile = null;
          render();
        })
      )
    ] }),
    state.preparedInvite
      ? MysticCard({ className: 'premium-invite-ready', children: [
          Icon('share', { size: 27 }),
          h('div', {},
            h('strong', { text: state.preparedInvite.analysisRequested ? 'Проверка запущена' : 'Приглашение готово' }),
            h('small', { text: state.preparedInvite.analysisRequested
              ? `Ждём данные от ${state.inviteName.trim()}. После загрузки прогноз запустится автоматически и придёт обоим.`
              : 'Сначала отправьте карточку, затем запустите проверку — ждать на этом экране не нужно.' })
          )
        ] })
      : null,
    state.preparedInvite
      ? h('div', { className: 'premium-invite-steps' },
          h('div', {}, h('span', { text: '1' }), MysticButton({ text: 'Отправить приглашение', icon: 'share', variant: 'primary', onClick: nativeSharePreparedInvite })),
          h('div', {}, h('span', { text: '2' }), MysticButton({
            text: state.preparedInvite.analysisRequested ? 'Проверка уже ожидает данные' : 'Проверить совместимость',
            icon: 'heart',
            variant: 'gold',
            disabled: state.busy || state.preparedInvite.analysisRequested,
            onClick: startPreparedInvitation
          }))
        )
      : MysticButton({
          text: state.busy ? 'Создаём приглашение…' : 'Подготовить приглашение',
          icon: 'send',
          variant: 'primary',
          disabled: state.busy,
          onClick: preparePersonalInvitation
        }),
    h('p', {
      className: 'premium-info-note',
      text: 'Имя используется только как подсказка для открытки. Перед отправкой вариант всегда подтверждает инициатор.'
    })
  ], { tabs: false });
}

function inviteStartScreen() {
  return shell([
    screenHeader('Личное приглашение', 'Выберите данные для совместного прогноза', 'amur'),
    h('section', { className: 'premium-invite-start-hero' },
      h('img', { attrs: { src: premiumArtUrl('partner-invite-emblem'), alt: '' } }),
      h('div', {},
        h('p', { className: 'premium-kicker', text: 'КАРТОЧКА ДЛЯ ДВОИХ' }),
        h('h1', { text: 'Один отправляет. Второй дополняет. Результат получают оба.' }),
        h('p', { text: 'После отправки инициатор запускает проверку. Система ждёт данные приглашённого и сама завершает прогноз.' })
      )
    ),
    h('div', { className: 'premium-invite-flow-diagram' },
      ['Создать карточку', 'Получить данные', 'Сформировать прогноз', 'Отправить обоим'].map((label, index) =>
        h('div', {}, h('span', { text: String(index + 1) }), h('strong', { text: label }))
      )
    ),
    serviceTile('two-photo-compatibility', 'Приглашение по фото', 'Сначала добавьте своё фото, затем оформите карточку', () => {
      state.inviteFlow = 'photo';
      state.photoMode = 'compatibility';
      navigate('photo-compat');
    }, 'Фото'),
    serviceTile('energy-hands', 'Приглашение по ладони', 'Сначала добавьте свою ладонь, затем оформите карточку', () => {
      state.inviteFlow = 'palm';
      navigate('palm');
    }, 'Ладонь')
  ], { active: 'amur' });
}

async function startPreparedInvitation() {
  const token = state.preparedInvite?.token;
  if (!token || state.busy) return;
  const serviceId = state.preparedInvite.flow === 'palm' ? 'palmlink' : 'photo_compatibility';
  const price = Number(serviceConfig(serviceId).price || 0);
  const message = price > 0
    ? `Когда второй участник добавит данные, с вашего баланса будет списано ${formatMoney(price)} SILARUM и прогноз автоматически придёт обоим. Продолжить?`
    : 'Когда второй участник добавит данные, прогноз автоматически сформируется и придёт обоим. Продолжить?';
  if (!window.confirm(message)) return;
  state.busy = true;
  render();
  try {
    const data = await api('/api/proxy', {
      method: 'POST',
      body: { action: 'invitation_start', invitationToken: token }
    });
    state.preparedInvite = { ...state.preparedInvite, ...data.invitation, analysisRequested: true };
    notify(data.invitation?.status === 'completed'
      ? 'Прогноз уже готов'
      : 'Проверка запущена — можно закрыть экран');
    pulse('medium');
  } catch (error) {
    notify(apiErrorMessage(error));
  } finally {
    state.busy = false;
    render();
  }
}

async function preparePersonalInvitation() {
  const name = state.inviteName.trim().replace(/\s+/g, ' ');
  if (!name) return notify('Введите имя человека');
  if (!['female', 'male'].includes(state.inviteGender)) {
    return notify('Выберите открытку для женщины или мужчины');
  }
  if (state.busy) return;
  const ownImage = state.inviteFlow === 'photo' ? state.photoOne : state.palmOne;
  if (!ownImage) return notify('Ваше фото больше не доступно — вернитесь на предыдущий экран');
  state.busy = true;
  render();
  try {
    const data = await api('/api/proxy', {
      method: 'POST',
      body: {
        action: 'invitation_create',
        flow: state.inviteFlow,
        goal: state.inviteGoal,
        inviteeName: name,
        inviteeGender: state.inviteGender,
        initiatorGender: state.userGender,
        initiatorImage: ownImage,
        initiatorProfile: {
          age: Number(state.profile.age) || null,
          city: state.profile.city,
          zodiacSign: state.horoscope.sign
        },
        consentOwn: true,
        adultConfirmed: true
      }
    });
    state.preparedInvite = {
      ...data.invitation,
      inviteUrl: data.inviteUrl,
      text: invitationShareText(name, state.inviteGoal)
    };
    state.preparedInviteFile = await buildInvitationCardFile({
      name,
      gender: state.inviteGender,
      goal: state.inviteGoal
    }).catch(() => null);
    pulse('medium');
    render();
  } catch (error) {
    notify(apiErrorMessage(error));
  } finally {
    state.busy = false;
    render();
  }
}

function invitationShareText(name, goal) {
  const line = {
    love: 'Хочу бережно посмотреть на то, что соединяет наши сердца.',
    friendship: 'Давай узнаем, в чём сила нашей дружбы и как её беречь.',
    business: 'Предлагаю увидеть сильные стороны нашего делового союза.',
    creative: 'Давай раскроем энергию нашего творческого союза.'
  }[goal];
  return `${name}, ${line}\n\nОткрой личное приглашение в Nastardamus, добавь своё фото и выбери, кто завершит оплату общего результата.`;
}

async function buildInvitationCardFile({ name, gender, goal }) {
  const [background, portrait] = await Promise.all([
    loadImage(`/images/invites/${goal}.png`),
    loadImage(premiumArtUrl(gender === 'male' ? 'portrait-man' : 'portrait-woman'))
  ]);
  const canvas = document.createElement('canvas');
  canvas.width = 720;
  canvas.height = 720;
  const context = canvas.getContext('2d');
  context.drawImage(background, 0, 0, 720, 720);
  const gradient = context.createLinearGradient(0, 420, 0, 720);
  gradient.addColorStop(0, 'rgba(4, 5, 15, 0)');
  gradient.addColorStop(1, 'rgba(7, 5, 18, .96)');
  context.fillStyle = gradient;
  context.fillRect(0, 360, 720, 360);
  context.save();
  context.beginPath();
  context.arc(590, 568, 84, 0, Math.PI * 2);
  context.clip();
  context.fillStyle = gender === 'male' ? '#24134c' : '#4b173f';
  context.fillRect(506, 484, 168, 168);
  context.drawImage(portrait, 506, 484, 168, 168);
  context.restore();
  context.strokeStyle = gender === 'male' ? '#8e77ff' : '#f0a1d1';
  context.lineWidth = 5;
  context.beginPath();
  context.arc(590, 568, 86, 0, Math.PI * 2);
  context.stroke();
  context.fillStyle = '#f6cf72';
  context.font = '700 20px system-ui, sans-serif';
  context.fillText('ЛИЧНОЕ ПРИГЛАШЕНИЕ', 44, 545);
  context.fillStyle = '#fff8ea';
  context.font = '700 38px Georgia, serif';
  context.fillText(`Для ${name}`.slice(0, 30), 44, 594);
  context.fillStyle = '#d5c8e3';
  context.font = '500 22px system-ui, sans-serif';
  context.fillText('Nastardamus · Путь двух судеб', 44, 638);
  const blob = await new Promise((resolve, reject) =>
    canvas.toBlob((value) => value ? resolve(value) : reject(new Error('invite_card_failed')), 'image/png')
  );
  return new File([blob], `nastardamus-${gender}-${goal}.png`, { type: 'image/png' });
}

async function nativeSharePreparedInvite() {
  const invitation = state.preparedInvite;
  if (!invitation?.inviteUrl) return notify('Сначала подготовьте приглашение');
  const shareData = {
    title: `Приглашение для ${state.inviteName.trim()}`,
    text: invitation.text,
    url: invitation.inviteUrl
  };
  if (state.preparedInviteFile && navigator.canShare?.({ files: [state.preparedInviteFile] })) {
    shareData.files = [state.preparedInviteFile];
  }
  try {
    if (navigator.share) {
      await navigator.share(shareData);
    } else if (tg?.openTelegramLink) {
      const fallback = new URL('https://t.me/share/url');
      fallback.searchParams.set('url', invitation.inviteUrl);
      fallback.searchParams.set('text', invitation.text);
      tg.openTelegramLink(fallback.toString());
    } else {
      await navigator.clipboard.writeText(`${invitation.text}\n${invitation.inviteUrl}`);
      notify('Ссылка скопирована');
      return;
    }
    notify('Приглашение отправлено');
  } catch (error) {
    if (error?.name !== 'AbortError') notify('Не удалось открыть меню отправки');
  }
}

async function loadActiveInvitation({ accept = false } = {}) {
  if (!state.invitationToken || !tg?.initData || state.invitationStatus === 'loading') return;
  state.invitationStatus = 'loading';
  if (state.screen === 'invitation') render();
  try {
    const data = await api('/api/proxy', {
      method: 'POST',
      body: {
        action: accept ? 'invitation_accept' : 'invitation_refresh',
        invitationToken: state.invitationToken
      }
    });
    state.invitation = data.invitation;
    state.invitationGender = normalizeGender(
      data.invitation?.participantGender || data.invitation?.inviteeGender
    );
    state.invitationStatus = 'ready';
    state.invitationError = '';
  } catch (error) {
    state.invitationStatus = 'error';
    state.invitationError = apiErrorMessage(error);
  }
  if (state.screen === 'invitation') render();
}

function invitationServiceId(invitation = state.invitation) {
  return invitation?.flow === 'palm' ? 'palmlink' : 'photo_compatibility';
}

function invitationStatusCard(invitation) {
  const status = {
    awaiting_participant: {
      title: invitation.analysisRequested ? 'Проверка запущена' : 'Приглашение доставлено',
      copy: invitation.analysisRequested
        ? `Ждём данные от ${invitation.inviteeName}. После загрузки прогноз сформируется автоматически.`
        : `Ждём, когда ${invitation.inviteeName} откроет ссылку и добавит фото.`
    },
    ready: {
      title: 'Оба образа готовы',
      copy: 'Приглашённый участник выбирает: оплатить общий результат сейчас или передать оплату инициатору.'
    },
    awaiting_initiator_payment: {
      title: 'Оплата передана инициатору',
      copy: 'Фото уже загружены. После оплаты общий результат одновременно откроется обоим.'
    },
    processing: {
      title: 'Эзотериум соединяет образы',
      copy: 'Результат формируется. Не закрывайте приложение несколько секунд.'
    }
  }[invitation.status] || {
    title: 'Совместное пространство',
    copy: 'Обновите статус приглашения.'
  };
  return MysticCard({ className: 'premium-invitation-status', children: [
    h('img', { attrs: { src: premiumArtUrl('connection-heart'), alt: '', draggable: 'false' } }),
    h('div', {}, h('strong', { text: status.title }), h('small', { text: status.copy }))
  ] });
}

function invitationResult(invitation) {
  return [
    CompatibilityHero({
      left: {
        name: invitation.initiatorName,
        birthDate: 'Первый образ',
        gender: invitation.initiatorGender
      },
      right: {
        name: invitation.inviteeName,
        birthDate: 'Второй образ',
        gender: invitation.participantGender || invitation.inviteeGender
      }
    }),
    MysticCard({ className: 'premium-result-reading', children: [formatReading(invitation.result)] }),
    h('p', {
      className: 'premium-info-note',
      text: 'Этот общий результат доступен инициатору и приглашённому участнику по личной ссылке.'
    })
  ];
}

function invitationScreen() {
  if (!tg?.initData) {
    return shell([
      screenHeader('Личное приглашение', 'Откройте внутри Telegram', 'home'),
      MysticCard({ className: 'premium-empty-state', children: [
        h('img', { attrs: { src: premiumArtUrl('partner-invite-emblem'), alt: '', draggable: 'false' } }),
        h('p', { text: 'Личная ссылка открывается только внутри Telegram, чтобы результат получили именно два участника.' })
      ] })
    ], { tabs: false });
  }
  if (state.invitationStatus === 'idle') {
    queueMicrotask(() => loadActiveInvitation({ accept: true }));
  }
  if (state.invitationStatus === 'loading' || state.invitationStatus === 'idle') {
    return shell([
      screenHeader('Личное приглашение', 'Проверяем участников', 'home'),
      loadingCard('Открываем совместное пространство…')
    ], { tabs: false });
  }
  if (state.invitationStatus === 'error' || !state.invitation) {
    return shell([
      screenHeader('Личное приглашение', 'Ссылка недоступна', 'home'),
      MysticCard({ className: 'premium-empty-state', children: [
        h('img', { attrs: { src: premiumArtUrl('partner-invite-emblem'), alt: '', draggable: 'false' } }),
        h('p', { text: state.invitationError || 'Не удалось открыть приглашение.' })
      ] })
    ], { tabs: false });
  }

  const invitation = state.invitation;
  const base = [
    screenHeader('Путь двух судеб', 'Личное пространство двух участников', 'home'),
    invitationPreview({
      name: invitation.inviteeName,
      gender: invitation.inviteeGender,
      goal: invitation.goal,
      compact: true
    })
  ];
  if (invitation.status === 'completed' && invitation.result) {
    return shell([...base, ...invitationResult(invitation)], { tabs: false, reading: true });
  }

  if (invitation.viewerRole === 'participant' && !invitation.participantPhotoReady) {
    const upload = imageUpload({
      title: invitation.flow === 'palm' ? 'Загрузите фото своей ладони' : 'Загрузите свою фотографию',
      image: state.invitationPhoto,
      onImage: (image) => { state.invitationPhoto = image; render(); }
    });
    return shell([
      ...base,
      MysticCard({ className: 'premium-invitation-welcome', children: [
        h('strong', { text: `${invitation.inviteeName}, приглашение адресовано вам` }),
        h('p', { text: `${invitation.initiatorName} уже добавил свой образ. Теперь нужен ваш — он будет храниться закрыто и удалится после готовности результата.` })
      ] }),
      upload,
      h('div', {},
        h('span', { className: 'premium-field-label', text: 'Как Эзотериуму обращаться к вам?' }),
        inviteGenderOptions(state.invitationGender, (gender) => {
          state.invitationGender = gender;
          render();
        })
      ),
      consentRow(
        'Я согласен на обработку своего изображения для этого совместного чтения.',
        state.invitationConsentOwn,
        (checked) => { state.invitationConsentOwn = checked; }
      ),
      consentRow(
        'Я подтверждаю, что мне исполнилось 18 лет.',
        state.invitationAdultConfirmed,
        (checked) => { state.invitationAdultConfirmed = checked; }
      ),
      MysticButton({
        text: state.busy ? 'Сохраняем образ…' : 'Добавить фото и продолжить',
        icon: 'upload-cloud',
        variant: 'primary',
        disabled: state.busy,
        onClick: uploadInvitationPhoto
      })
    ], { tabs: false });
  }

  const content = [...base, invitationStatusCard(invitation)];
  if (invitation.status === 'processing') {
    content.push(loadingCard('Соединяем два образа…'));
  } else if (
    invitation.viewerRole === 'participant'
    && invitation.status === 'ready'
  ) {
    const gentleman = (invitation.participantGender || invitation.inviteeGender) === 'male';
    content.push(
      MysticCard({ className: 'premium-gentle-hint', children: [
        h('img', { attrs: { src: premiumArtUrl(gentleman ? 'portrait-man' : 'portrait-woman'), alt: '', draggable: 'false' } }),
        h('p', {
          text: gentleman
            ? 'Можно поступить по-джентльменски и оплатить общий ритуал за двоих. Если сейчас неудобно, инициатор спокойно завершит оплату.'
            : 'Можно сделать красивый жест и оплатить общий ритуал за двоих. Если сейчас неудобно, инициатор спокойно завершит оплату.'
        })
      ] }),
      MysticButton({
        text: state.busy ? 'Открываем результат…' : 'Оплатить общий результат',
        icon: 'heart',
        variant: 'primary',
        disabled: state.busy,
        onClick: () => completeJointInvitation('participant')
      }),
      MysticButton({
        text: 'Пусть оплатит инициатор',
        icon: 'send',
        variant: 'outline',
        disabled: state.busy,
        onClick: requestInitiatorPayment
      }),
      PriceLine({ label: 'Одна оплата за двоих:', price: serviceConfig(invitationServiceId(invitation)).price })
    );
  } else if (
    invitation.viewerRole === 'initiator'
    && invitation.status === 'awaiting_initiator_payment'
  ) {
    content.push(
      MysticButton({
        text: state.busy ? 'Открываем результат…' : 'Оплатить за двоих',
        icon: 'heart',
        variant: 'primary',
        disabled: state.busy,
        onClick: () => completeJointInvitation('initiator')
      }),
      PriceLine({ label: 'Одна оплата за двоих:', price: serviceConfig(invitationServiceId(invitation)).price })
    );
  } else {
    content.push(MysticButton({
      text: 'Обновить статус',
      icon: 'history',
      variant: 'outline',
      disabled: state.busy,
      onClick: () => loadActiveInvitation()
    }));
  }
  return shell(content, { tabs: false });
}

async function uploadInvitationPhoto() {
  if (!state.invitationPhoto) return notify('Загрузите фотографию');
  if (!state.invitationConsentOwn) return notify('Подтвердите согласие на обработку фотографии');
  if (!state.invitationAdultConfirmed) return notify('Подтвердите совершеннолетие');
  if (state.invitationGender === 'unspecified') return notify('Выберите форму обращения');
  if (state.busy) return;
  state.busy = true;
  render();
  try {
    const data = await api('/api/proxy', {
      method: 'POST',
      body: {
        action: 'invitation_upload',
        invitationToken: state.invitationToken,
        participantImage: state.invitationPhoto,
        participantGender: state.invitationGender,
        participantProfile: {
          age: Number(state.profile.age) || null,
          city: state.profile.city,
          zodiacSign: state.horoscope.sign
        },
        consentOwn: true,
        adultConfirmed: true
      }
    });
    state.invitation = data.invitation;
    state.invitationStatus = 'ready';
    pulse('medium');
  } catch (error) {
    notify(apiErrorMessage(error));
  } finally {
    state.busy = false;
    render();
  }
}

async function requestInitiatorPayment() {
  if (state.busy) return;
  state.busy = true;
  render();
  try {
    const data = await api('/api/proxy', {
      method: 'POST',
      body: {
        action: 'invitation_request_initiator_payment',
        invitationToken: state.invitationToken
      }
    });
    state.invitation = data.invitation;
    notify('Инициатор получил деликатное уведомление');
  } catch (error) {
    notify(apiErrorMessage(error));
  } finally {
    state.busy = false;
    render();
  }
}

async function completeJointInvitation(payerRole) {
  const serviceId = invitationServiceId();
  if (!confirmServicePayment(serviceId)) return;
  if (state.busy) return;
  state.busy = true;
  render();
  try {
    const reading = await requestReading('photo_compatibility', {
      invitationToken: state.invitationToken,
      payerRole
    }, serviceId, { structured: true });
    state.invitation = {
      ...state.invitation,
      status: 'completed',
      result: reading.answer,
      resultPayload: reading.result
    };
    pulse('medium');
  } catch (error) {
    notify(apiErrorMessage(error));
    await loadActiveInvitation();
  } finally {
    state.busy = false;
    render();
  }
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
    const reading = await requestReading('photo_compatibility', {
      concern: `Что важно понять о связи с целью «${goalLabel(state.palmGoal)}»?`,
      firstName: firstName(), secondName: state.partnerName || 'Партнёр',
      firstImage: state.palmOne, secondImage: state.palmTwo,
      consentOwn: true,
      consentPartner: true,
      adultConfirmed: state.palmAdultConfirmed,
      source: 'palmlink'
    }, 'palmlink', { structured: true });
    state.result = {
      id: uniqueId('palm'), kind: 'compatibility', mode: 'palm',
      type: 'Совместимость по ладоням', title: `${firstName()} и ${state.partnerName || 'Партнёр'}`,
      body: reading.answer, result: reading.result, cards: [], createdAt: new Date().toISOString(), favorite: false,
      score: reading.result.score, aspects: reading.result.aspects,
      participants: [
        { name: firstName(), gender: state.userGender, note: 'Ваша ладонь' },
        { name: state.partnerName || 'Партнёр', gender: 'unspecified', note: 'Вторая ладонь' }
      ]
    };
    await saveCloudReading(state.result, {
      subtype: 'palm-compatibility',
      input: { firstName: firstName(), secondName: state.partnerName || 'Партнёр', goal: state.palmGoal },
      media: [state.palmOne, state.palmTwo]
    });
    navigate('compatibility-result');
  } catch (error) { notify(apiErrorMessage(error)); }
  finally { state.busy = false; render(); }
}

function goalLabel(value) {
  return ({ love: 'любовь', friendship: 'дружба', business: 'деловой союз', creative: 'творческий союз' })[value] || 'общение';
}

function compatibilityResultScreen(backOverride = '') {
  if (!state.result) return compatibilityCatalogScreen();
  const result = state.result;
  const [left, right] = result.participants || [
    { name: firstName(), gender: state.userGender, note: 'Первый участник' },
    { name: state.partnerName || 'Партнёр', gender: 'unspecified', note: 'Второй участник' }
  ];
  const score = Number.isFinite(Number(result.score)) ? Number(result.score) : 0;
  const structuredAspects = Array.isArray(result.aspects) && result.aspects.length
    ? result.aspects
    : Array.isArray(result.result?.aspects) ? result.result.aspects : [];
  const artByKey = {
    closeness: 'metric-heart-seal',
    dialogue: 'metric-palm-seal',
    daily: 'metric-tarot-seal',
    growth: 'metric-heart-seal'
  };
  const iconByKey = { closeness: 'heart', dialogue: 'users', daily: 'briefcase', growth: 'sparkle' };
  const aspects = structuredAspects.map((aspect) => ({
    art: artByKey[aspect.key] || 'metric-tarot-seal',
    title: aspect.label,
    description: aspect.insight,
    score: Number(aspect.score) || 0
  }));
  const spheres = structuredAspects.map((aspect) => ({
    icon: iconByKey[aspect.key] || 'sparkle',
    label: aspect.label,
    score: Number(aspect.score) || 0
  }));
  const back = backOverride || (result.mode === 'data' ? 'compatibility-data' : result.mode === 'photo' ? 'photo-compat' : 'ritual');
  const panels = [
    MysticCard({ className: 'premium-result-reading', children: [formatReading(result.body)] }),
    MysticCard({ className: 'premium-recommendations', children: [
      ...(result.result?.actions || []).map((action) => h('p', { text: action })),
      h('p', { text: 'Сверяйте чтение с реальными поступками и добровольным диалогом обоих участников.' })
    ] })
  ];
  panels[1].hidden = true;
  const tabs = Tabs({ items: ['Чтение', 'Опора'], active: 0, onChange: (index) => {
    tabs.querySelectorAll('.n-tab').forEach((button, itemIndex) => button.classList.toggle('is-active', itemIndex === index));
    panels.forEach((panel, itemIndex) => { panel.hidden = itemIndex !== index; });
  } });
  return shell([
    screenHeader(result.type || 'Совместимость', 'Совместное символическое чтение', back),
    CompatibilityHero({
      left: { name: left.name, birthDate: left.note, gender: left.gender },
      right: { name: right.name, birthDate: right.note, gender: right.gender }
    }),
    tabs, ...panels,
    aspects.length ? SectionTitle({ text: 'Аспекты, рассчитанные в чтении' }) : null,
    aspects.length ? MetricsList({ items: aspects }) : null,
    spheres.length ? SectionTitle({ text: 'Карта связи' }) : null,
    spheres.length ? ForecastGrid({ items: spheres }) : null,
    FinalScoreCard({ score, message: `Уверенность: ${result.result?.confidence || 'не указана'} · символический ориентир` }),
    h('div', { className: 'n-share-actions' },
      MysticButton({
        text: result.favorite ? 'В избранном' : 'В избранное',
        icon: 'save',
        variant: 'primary',
        onClick: () => toggleFavorite(result.id)
      }),
      MysticButton({ text: 'Поделиться', icon: 'share', variant: 'gold', onClick: () => shareResult(result) })
    )
  ], { tabs: false, reading: true });
}

function resultScreen({ title, subtitle, back, result, showCards = false }) {
  const spread = showCards ? (SPREADS[result.spread] || {
    count: result.cards.length,
    positions: result.positions || result.cards.map((_, index) => `Позиция ${index + 1}`)
  }) : null;
  return shell([
    screenHeader(title, subtitle, back),
    MysticCard({ className: 'premium-result-meta', children: [
      h('div', {},
        h('small', { text: formatDate(result.createdAt) }),
        h('strong', { text: result.title || title })
      ),
      h('button', {
        className: `premium-favorite-button ${result.favorite ? 'is-active' : ''}`,
        attrs: { type: 'button', 'aria-pressed': result.favorite ? 'true' : 'false', 'aria-label': result.favorite ? 'Убрать из избранного' : 'Добавить в избранное' },
        on: { click: () => toggleFavorite(result.id) }
      }, result.favorite ? '★' : '☆')
    ] }),
    showCards ? tarotComposition(spread, result.cards) : null,
    MysticCard({ className: 'premium-result-reading', children: [formatReading(result.body)] }),
    h('div', { className: 'n-share-actions' },
      MysticButton({ text: result.favorite ? 'В избранном' : 'В избранное', icon: 'save', variant: 'primary', onClick: () => toggleFavorite(result.id) }),
      MysticButton({ text: 'Поделиться', icon: 'share', variant: 'gold', onClick: () => shareResult(result) })
    ),
    MysticButton({ text: 'Начать новый расклад', icon: 'tarot', variant: 'outline', onClick: () => navigate('tarot') }),
    state.revealingCard ? tarotRevealOverlay(state.revealingCard) : null
  ], { tabs: false, reading: true });
}

function formatReading(value) {
  const text = String(value || '').trim();
  if (!text) return h('p', { text: 'Ответ пока не получен.' });
  return h('div', { className: 'premium-reading-copy' }, text.split(/\n{2,}/).map((paragraph) => h('p', { text: paragraph })));
}

function saveResult(result, { silent = false } = {}) {
  if (!result) return notify('Сначала получите результат');
  const entries = readJSON(JOURNAL_KEY, []);
  const index = entries.findIndex((entry) => entry.id === result.id);
  if (index >= 0) entries[index] = { ...entries[index], ...result };
  else entries.unshift(result);
  writeJSON(JOURNAL_KEY, entries.slice(0, 50));
  if (!silent) notify(index >= 0 ? 'История обновлена' : 'Сохранено в историю');
}

async function saveCloudReading(result, {
  readingId = '',
  subtype = '',
  input = {},
  media = []
} = {}) {
  if (!result) return null;
  if (!tg?.initData) {
    saveResult(result, { silent: true });
    return result;
  }
  try {
    const data = await api('/api/readings', {
      method: 'POST',
      body: {
        action: 'save_reading',
        readingId: /^[0-9a-f-]{36}$/i.test(readingId) ? readingId : undefined,
        kind: result.kind || 'photo',
        subtype: subtype || result.mode || result.kind || 'reading',
        title: result.title || result.type || 'Символическое чтение',
        input,
        result: result.result || {},
        resultText: result.body,
        favorite: result.favorite === true,
        media
      }
    });
    if (data.reading) {
      const cloud = normalizeCloudReading(data.reading);
      Object.assign(result, cloud);
      state.cloudReadings = [
        cloud,
        ...state.cloudReadings.filter((entry) => entry.id !== cloud.id)
      ];
      state.cloudReadingsStatus = 'ready';
      return cloud;
    }
  } catch (error) {
    saveResult(result, { silent: true });
    notify('Результат сохранён на устройстве; облако синхронизируется позже');
  }
  return result;
}

function normalizeCloudReading(reading) {
  return {
    id: reading.id,
    kind: reading.kind,
    mode: reading.subtype,
    type: ({
      tarot: 'Таро',
      compatibility: 'Совместимость',
      palm: 'Чтение по ладони',
      runes: 'Руны',
      amur: 'Амур',
      natal: 'Натальная подсказка',
      horoscope: 'Гороскоп',
      sports: 'Прогноз события',
      photo: 'Фото-чтение'
    })[reading.kind] || 'Символическое чтение',
    title: reading.title,
    body: reading.body,
    result: reading.result || {},
    media: reading.media || [],
    favorite: reading.favorite === true,
    createdAt: reading.createdAt || reading.completedAt,
    updatedAt: reading.updatedAt
  };
}

async function loadCloudReadings({ force = false } = {}) {
  if (!tg?.initData) return;
  if (!force && ['loading', 'ready'].includes(state.cloudReadingsStatus)) return;
  state.cloudReadingsStatus = 'loading';
  if (state.screen === 'history') render();
  try {
    const data = await api('/api/readings', {
      method: 'POST',
      body: { action: 'list_readings' }
    });
    state.cloudReadings = (data.readings || []).map(normalizeCloudReading);
    state.cloudReadingsStatus = 'ready';
  } catch {
    state.cloudReadingsStatus = 'error';
  }
  if (state.screen === 'history') render();
}

function toggleFavorite(id) {
  const entries = readJSON(JOURNAL_KEY, []);
  const entry = entries.find((item) => item.id === id);
  const cloud = state.cloudReadings.find((item) => item.id === id);
  const next = !(cloud?.favorite ?? entry?.favorite ?? (state.result?.id === id && state.result.favorite));
  if (entry) entry.favorite = next;
  if (state.result?.id === id) state.result.favorite = next;
  writeJSON(JOURNAL_KEY, entries);
  if (cloud) {
    cloud.favorite = next;
    api('/api/readings', {
      method: 'POST',
      body: { action: 'update_reading', readingId: id, favorite: next }
    }).catch(() => notify('Не удалось синхронизировать избранное'));
  }
  notify(next ? 'Добавлено в избранное' : 'Убрано из избранного');
  render();
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
  const reading = state.busy || Boolean(state.horoscope.reading);
  return shell([
    screenHeader('Гороскоп дня', 'Личное послание от Эзотериума', 'home'),
    MysticCard({ className: 'premium-horoscope-hero', children: [
      h('img', { className: 'premium-horoscope-art', attrs: { src: premiumArtUrl('astrology-forecast'), alt: '', draggable: 'false' } }),
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
  ], { active: 'home', reading });
}

async function createDailyHoroscope() {
  if (state.busy) return;
  state.busy = true;
  render();
  try {
    const date = new Intl.DateTimeFormat('en-CA').format(new Date());
    const reading = await requestReading('daily_horoscope', {
      sign: ZODIAC_SIGNS[state.horoscope.sign]?.label || state.horoscope.sign,
      date,
      name: firstName(),
      gender: state.userGender,
      age: Number(state.profile.age) || 18,
      city: state.profile.city
    }, '', { structured: true });
    state.horoscope = { ...state.horoscope, reading: reading.answer, date };
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
      body: profilePreferencePayload({ enabled: checked })
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
  if (tg?.initData && state.cloudReadingsStatus === 'idle') queueMicrotask(() => loadCloudReadings());
  const localEntries = readJSON(JOURNAL_KEY, []).filter((entry) => !entry.deletedAt);
  const allEntries = state.cloudReadingsStatus === 'ready'
    ? state.cloudReadings
    : localEntries;
  const entries = allEntries.filter((entry) => {
    if (state.historyFilter === 'favorites') return entry.favorite === true;
    if (state.historyFilter === 'tarot') return historyKind(entry) === 'tarot';
    if (state.historyFilter === 'compatibility') return historyKind(entry) === 'compatibility';
    if (state.historyFilter === 'practice') return ['palm', 'runes', 'amur'].includes(historyKind(entry));
    return true;
  });
  const filters = {
    all: `Все · ${allEntries.length}`,
    favorites: 'Избранные',
    tarot: 'Таро',
    compatibility: 'Совместимость',
    practice: 'Ладонь и руны'
  };
  return shell([
    screenHeader('Мои расклады', 'Сохранённые знаки и результаты', 'home'),
    h('div', { className: 'premium-filter-row premium-history-filters' },
      Object.entries(filters).map(([id, label]) => h('button', {
        className: `premium-filter-chip ${state.historyFilter === id ? 'is-active' : ''}`,
        attrs: { type: 'button' },
        on: { click: () => { state.historyFilter = id; render(); } }
      }, label))
    ),
    state.cloudReadingsStatus === 'loading' ? loadingCard('Загружаем облачную историю…') : null,
    entries.length ? h('div', { className: 'premium-history-list' }, entries.map((entry) => MysticCard({ className: 'premium-history-card', children: [
      h('div', { className: 'premium-history-head' },
        h('strong', { text: entry.type || 'Символическое чтение' }),
        h('span', {},
          h('small', { text: formatDate(entry.createdAt) }),
          entry.favorite ? h('b', { text: '★' }) : null
        )
      ),
      h('h3', { text: entry.title || 'Без названия' }),
      h('p', { text: String(entry.body || '').slice(0, 240) }),
      h('div', { className: 'premium-history-actions' },
        h('button', { attrs: { type: 'button' }, on: { click: () => openHistoryEntry(entry) } }, 'Открыть'),
        h('button', { attrs: { type: 'button' }, on: { click: () => toggleFavorite(entry.id) } }, entry.favorite ? 'Убрать ★' : 'В избранное'),
        h('button', { attrs: { type: 'button' }, on: { click: () => renameHistoryEntry(entry.id) } }, 'Переименовать'),
        h('button', { className: 'is-danger', attrs: { type: 'button' }, on: { click: () => softDeleteHistoryEntry(entry.id) } }, 'Удалить')
      )
    ] }))) : MysticCard({ className: 'premium-empty-state', children: [
      Icon('history', { size: 44 }),
      h('h2', { text: allEntries.length ? 'В этом фильтре пока пусто' : 'История пока пуста' }),
      h('p', { text: 'Завершённые расклады и проверки совместимости сохраняются автоматически.' }),
      MysticButton({ text: 'Выбрать ритуал', icon: 'services', variant: 'primary', onClick: () => navigate('services') })
    ] })
  ], { active: 'history' });
}

function historyKind(entry) {
  if (entry.kind) return entry.kind;
  if (String(entry.id || '').startsWith('tarot') || /расклад|таро/iu.test(entry.type || '')) return 'tarot';
  if (/совместим|двух судеб/iu.test(entry.type || '')) return 'compatibility';
  if (/ладон/iu.test(entry.type || '')) return 'palm';
  if (/рун/iu.test(entry.type || '')) return 'runes';
  if (/амур/iu.test(entry.type || '')) return 'amur';
  return 'reading';
}

function openHistoryEntry(entry) {
  state.result = { ...entry };
  if (historyKind(entry) === 'tarot') return navigate('tarot-result');
  if (historyKind(entry) === 'compatibility') return navigate('compatibility-data-result');
  if (historyKind(entry) === 'palm') {
    state.palmDialogue.result = entry.result;
    state.palmDialogue.stage = 'result';
    return navigate('palm-reading');
  }
  if (historyKind(entry) === 'runes') {
    state.runeResult = entry.result;
    return navigate('runes');
  }
  navigate('photo-result');
}

function renameHistoryEntry(id) {
  const entries = readJSON(JOURNAL_KEY, []);
  const entry = entries.find((item) => item.id === id);
  if (!entry) return;
  const title = window.prompt('Новое название результата', entry.title || '');
  if (title === null) return;
  const clean = title.trim().slice(0, 120);
  if (!clean) return notify('Название не может быть пустым');
  entry.title = clean;
  if (state.result?.id === id) state.result.title = clean;
  writeJSON(JOURNAL_KEY, entries);
  const cloud = state.cloudReadings.find((item) => item.id === id);
  if (cloud) {
    cloud.title = clean;
    api('/api/readings', {
      method: 'POST',
      body: { action: 'update_reading', readingId: id, title: clean }
    }).catch(() => notify('Не удалось синхронизировать название'));
  }
  notify('Название сохранено');
  render();
}

function softDeleteHistoryEntry(id) {
  if (!window.confirm('Скрыть этот результат из истории? Финансовая операция останется сохранённой.')) return;
  const entries = readJSON(JOURNAL_KEY, []);
  const entry = entries.find((item) => item.id === id);
  if (!entry) return;
  entry.deletedAt = new Date().toISOString();
  writeJSON(JOURNAL_KEY, entries);
  if (state.cloudReadings.some((item) => item.id === id)) {
    state.cloudReadings = state.cloudReadings.filter((item) => item.id !== id);
    api('/api/readings', {
      method: 'POST',
      body: { action: 'delete_reading', readingId: id }
    }).catch(() => notify('Не удалось удалить запись из облака'));
  }
  notify('Результат скрыт из истории');
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
      balance: formatMoney(wallet.balance || 0),
      avatar: profileAvatar()
    }),
    profileIdentityCard(),
    genderPreferenceCard(),
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

function profileIdentityCard() {
  const input = h('input', {
    attrs: { type: 'file', accept: 'image/jpeg,image/png,image/webp', hidden: true }
  });
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const image = await prepareImage(file);
      await uploadProfileAvatar(image);
    } catch (error) {
      notify(apiErrorMessage(error));
    }
  });
  const age = textInput({
    value: state.profile.age,
    type: 'number',
    attrs: { min: 13, max: 120, inputmode: 'numeric' },
    onInput: (value) => { state.profile.age = value; }
  });
  const city = textInput({
    value: state.profile.city,
    attrs: { maxlength: 120, autocomplete: 'address-level2' },
    onInput: (value) => { state.profile.city = value; }
  });
  return MysticCard({ className: 'premium-profile-identity', children: [
    h('div', { className: 'premium-avatar-editor' },
      h('div', { className: 'premium-avatar-editor__image' },
        h('img', { attrs: { src: profileAvatar(), alt: 'Фото профиля' } }),
        h('span', { text: '✦' })
      ),
      h('div', {},
        h('strong', { text: 'Фото профиля' }),
        h('small', { text: state.profile.avatarUrl ? 'Используется загруженное фото' : state.profile.telegramAvatarUrl || tg?.initDataUnsafe?.user?.photo_url ? 'Загружено из Telegram' : 'Используется образ Эзотериума' }),
        h('div', { className: 'premium-avatar-editor__actions' },
          input,
          h('button', { attrs: { type: 'button' }, on: { click: () => input.click() } }, 'Загрузить своё'),
          state.profile.avatarUrl ? h('button', { attrs: { type: 'button' }, on: { click: removeProfileAvatar } }, 'Вернуть из TG') : null
        )
      )
    ),
    h('div', { className: 'premium-profile-grid' },
      field('Возраст', age),
      field('Город', city)
    ),
    MysticButton({
      text: 'Сохранить данные',
      icon: 'save',
      variant: 'outline',
      onClick: saveProfileDetails
    })
  ] });
}

async function saveProfileDetails() {
  const age = Number(state.profile.age);
  const city = state.profile.city.trim().replace(/\s+/g, ' ');
  if (!Number.isInteger(age) || age < 13 || age > 120) return notify('Укажите возраст от 13 до 120 лет');
  if (city.length < 2) return notify('Укажите город');
  state.profile.age = age;
  state.profile.city = city;
  state.profile.completed = true;
  writeJSON(PROFILE_KEY, { ...state.profile, gender: state.userGender });
  if (!tg?.initData) return notify('Профиль сохранён на этом устройстве');
  try {
    await api('/api/preferences', { method: 'POST', body: profilePreferencePayload() });
    notify('Профиль обновлён');
  } catch (error) {
    notify(apiErrorMessage(error));
  }
}

async function uploadProfileAvatar(image) {
  if (!tg?.initData) {
    state.profile.avatarUrl = image;
    writeJSON(PROFILE_KEY, { ...state.profile, gender: state.userGender });
    render();
    return notify('Фото сохранено на этом устройстве');
  }
  state.busy = true;
  render();
  try {
    const data = await api('/api/preferences', {
      method: 'POST',
      body: { action: 'upload_avatar', image }
    });
    state.profile.avatarUrl = data.preferences?.profile_avatar_url || image;
    writeJSON(PROFILE_KEY, { ...state.profile, gender: state.userGender });
    notify('Фото профиля обновлено');
  } finally {
    state.busy = false;
    render();
  }
}

async function removeProfileAvatar() {
  state.profile.avatarUrl = '';
  writeJSON(PROFILE_KEY, { ...state.profile, gender: state.userGender });
  render();
  if (!tg?.initData) return;
  try {
    await api('/api/preferences', { method: 'POST', body: { action: 'remove_avatar' } });
    notify('Возвращено фото из Telegram');
  } catch (error) {
    notify(apiErrorMessage(error));
  }
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

async function requestReading(feature, payload, serviceId = '', { structured = false } = {}) {
  try {
    const data = await api('/api/proxy', {
      method: 'POST',
      body: {
        feature,
        payload: { ...payload, gender: normalizeGender(payload?.gender || state.userGender) },
        idempotencyKey: uniqueId(`reading-${serviceId || feature}`)
      }
    });
    if (typeof data.answer !== 'string' || !data.answer.trim()) throw new Error('empty_response');
    if (structured && (!data.result || typeof data.result !== 'object')) throw new Error('invalid_structured_response');
    if (data.invitation) {
      state.invitation = data.invitation;
      state.invitationStatus = 'ready';
    }
    loadWallet({ force: true });
    return structured
      ? { answer: data.answer.trim(), result: data.result }
      : data.answer.trim();
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
    deepseek_provider_unavailable: 'Эзотериум временно не отвечает. Попробуйте немного позже.',
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
    topup_expired: 'Срок действия заявки истёк. Создайте новую.',
    invalid_invitee_name: 'Введите имя приглашённого человека.',
    invalid_gender: 'Выберите вариант обращения.',
    invalid_invitation_image: 'Не удалось подготовить изображение. Загрузите фото ещё раз.',
    invitation_not_found: 'Это приглашение не найдено.',
    invitation_expired: 'Срок действия приглашения истёк.',
    invitation_unavailable: 'Это приглашение больше недоступно.',
    invitation_not_ready: 'Для общего результата нужны фотографии обоих участников.',
    invitation_busy: 'Результат уже формируется. Обновите статус через несколько секунд.',
    invitation_already_completed: 'Общий результат уже готов.',
    invitation_payment_denied: 'Оплатить результат может только один из двух участников.',
    invitation_image_unavailable: 'Фото участника временно недоступно. Попробуйте открыть приглашение снова.',
    invitation_processing_not_found: 'Состояние приглашения изменилось. Обновите страницу.'
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

async function loadReadingCatalog() {
  if (!tg?.initData || state.readingCatalogStatus === 'loading') return;
  state.readingCatalogStatus = 'loading';
  try {
    const data = await api('/api/readings', {
      method: 'POST',
      body: { action: 'get_reading_catalog' }
    });
    for (const spread of data.tarot || []) {
      const current = SPREADS[spread.id] || {};
      SPREADS[spread.id] = {
        ...current,
        label: spread.title || current.label || spread.id,
        description: spread.description || current.description || '',
        count: Number(spread.card_count || current.count || 1),
        positions: Array.isArray(spread.positions) ? spread.positions : current.positions || [],
        category: spread.category || current.category || 'insight',
        serviceId: spread.service_id || current.serviceId || 'tarot',
        access: ['only', 'vip_only'].includes(spread.vip_access) ? 'VIP' : Number(spread.price_units || 0) > 0 ? 'SILARUM' : 'Доступно',
        cover: current.cover || 'high-priestess.webp'
      };
    }
    state.compatibilityCatalog = data.compatibility || [];
    state.readingCatalogStatus = 'ready';
  } catch {
    state.readingCatalogStatus = 'error';
  }
  if (['tarot', 'compatibility', 'amur'].includes(state.screen)) render();
}

async function loadPreferences() {
  if (!tg?.initData) return;
  try {
    const data = await api('/api/preferences');
    const preferences = data.preferences;
    if (preferences) {
      state.horoscope.sign = preferences.zodiac_sign || state.horoscope.sign;
      state.horoscope.enabled = preferences.daily_horoscope_enabled === true;
      state.userGender = normalizeGender(preferences.gender || state.userGender);
      const birthYear = Number(preferences.birth_year);
      state.profile = {
        ...state.profile,
        age: birthYear ? Math.max(13, CURRENT_YEAR - birthYear) : state.profile.age,
        city: preferences.city || state.profile.city,
        avatarUrl: preferences.profile_avatar_url || state.profile.avatarUrl,
        telegramAvatarUrl: preferences.telegram_avatar_url
          || tg?.initDataUnsafe?.user?.photo_url
          || state.profile.telegramAvatarUrl,
        completed: Boolean(preferences.profile_completed_at || (birthYear && preferences.city))
      };
      writeJSON(HOROSCOPE_KEY, state.horoscope);
      writeJSON(PROFILE_KEY, { ...state.profile, gender: state.userGender });
      if (state.screen === 'welcome' && state.profile.completed) {
        state.screen = 'home';
        const url = new URL(location.href);
        url.searchParams.set('screen', 'home');
        history.replaceState({}, '', url);
      }
    }
  } catch {
    // Local preference remains available if the profile endpoint is temporarily unavailable.
  }
  if (state.screen === 'profile' || state.screen === 'horoscope') render();
}

function genderPreferenceCard() {
  const description = state.userGender === 'female'
    ? 'Эзотериум обращается к вам в женском роде.'
    : state.userGender === 'male'
      ? 'Эзотериум обращается к вам в мужском роде.'
      : 'Эзотериум использует нейтральные формулировки.';
  return MysticCard({ className: 'premium-gender-card', children: [
    h('div', { className: 'premium-gender-card__head' },
      h('div', {},
        h('p', { className: 'premium-kicker', text: 'ЛИЧНЫЙ ГОЛОС ЭЗОТЕРИУМА' }),
        h('h2', { text: 'Как к вам обращаться?' })
      ),
      h('img', { attrs: { src: profileAvatar(), alt: '', draggable: 'false' } })
    ),
    h('div', { className: 'premium-gender-options' },
      Object.entries(GENDER_OPTIONS).map(([value, option]) =>
        h('button', {
          className: `premium-gender-option ${state.userGender === value ? 'is-active' : ''}`,
          attrs: { type: 'button', 'aria-pressed': state.userGender === value ? 'true' : 'false' },
          on: { click: () => saveGenderPreference(value) }
        },
        h('img', { attrs: { src: premiumArtUrl(option.art), alt: '', draggable: 'false' } }),
        h('span', { text: option.label }))
      )
    ),
    h('p', { className: 'premium-gender-card__copy', text: `${description} Мы не угадываем пол по имени или фотографии — выбор принадлежит только вам.` })
  ] });
}

async function saveGenderPreference(value) {
  state.userGender = normalizeGender(value);
  writeJSON(PROFILE_KEY, { ...state.profile, gender: state.userGender });
  render();
  if (!tg?.initData) {
    notify('Обращение сохранено на этом устройстве');
    return;
  }
  try {
    await api('/api/preferences', {
      method: 'POST',
      body: profilePreferencePayload()
    });
    notify('Эзотериум запомнил форму обращения');
  } catch (error) {
    notify(apiErrorMessage(error));
  }
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
    welcome: welcomeScreen, home: homeScreen, services: servicesScreen, amur: amurScreen,
    wheel: wheelScreen, tarot: tarotScreen, 'tarot-question': tarotQuestionScreen,
    'tarot-draw': tarotDrawScreen, 'tarot-result': tarotResultScreen,
    natal: natalScreen, 'natal-result': natalResultScreen,
    horoscope: horoscopeScreen,
    sports: sportsForecastScreen,
    compatibility: compatibilityCatalogScreen,
    'compatibility-data': compatibilityDataScreen,
    'compatibility-data-result': compatibilityResultScreen,
    'photo-energy': () => photoScreen('energy'), 'photo-damage': () => photoScreen('damage'), 'photo-compat': () => photoScreen('compatibility'), 'photo-result': photoResultScreen,
    'palm-reading': palmReadingScreen, runes: runeScreen,
    palm: palmScreen, ritual: ritualScreen, 'compatibility-result': compatibilityResultScreen,
    'invite-start': inviteStartScreen, 'invite-compose': inviteComposerScreen, invitation: invitationScreen,
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
  loadReadingCatalog();
  loadCloudReadings({ force });
  if (state.invitationToken) loadActiveInvitation({ accept: true });
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

export { navigate, render, state, suggestGenderFromName };
