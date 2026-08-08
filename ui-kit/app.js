import {
  AppShell, ScreenContainer, BrandLogo, AppHeader,
  FortuneWheelCard, SectionTitle, QuickAccessGrid, BottomNavigation, UploadCard,
  GoalSelector, EnergyHandsScene, MysticButton, PriceLine,
  DataStatusCard, ActionGroup, CompatibilityHero, Tabs, MysticCard, ServiceCard,
  StatusBadge, GlowDivider, MetricsList, ForecastGrid, FinalScoreCard
} from './components/index.js';
import { h } from './core/dom.js';
import { Icon } from './core/icon.js';
import { premiumArtUrl } from './core/assets.js';
import {
  LANGUAGE_OPTIONS, dateTimeLocale, normalizeLocale,
  setLocale as applyDocumentLocale, translateText
} from './core/i18n.js';
import { TAROT_CARD_NAMES, TAROT_CARD_WHISPERS, tarotCardImage } from './core/tarot-deck.js';
import { ELDER_FUTHARK, RUNE_SPREADS, castRuneSpread, runeOfDay, searchRunes } from '../lib/rune-temple.js';
import { buildNatalChart, polarPoint } from '../lib/natal-chart.js';
import { AMUR_GAME_QUESTIONS, AMUR_QUESTIONS, buildAmurProfile } from '../lib/amur-profile.js';
import {
  PERSONAL_CATEGORIES, PERSONAL_PRIORITIES, analyzePersonalEvent, dailyEnergy,
  goalProgress, nextPersonalEvents, normalizePersonalEvent, normalizePersonalGoal,
  normalizePersonalTask, personalDateKey, personalGreeting, taskDueOn
} from '../lib/personal-space.js';
import {
  DAILY_GREETING_PRACTICES, dailyGreetingDateKey, dailyGreetingDayPart,
  fallbackDailyGreeting, selectDailyGreetingPractice
} from '../lib/daily-greeting.js';

let tg = null;
let telegramConfigured = false;

const mount = document.getElementById('premium-app');
const toast = document.getElementById('premium-toast');
const JOURNAL_KEY = 'nastardamus-journal-v2';
const SUPPORT_KEY = 'nastardamus-support-v4';
const HOROSCOPE_KEY = 'nastardamus-horoscope-v1';
const PROFILE_KEY = 'nastardamus-profile-v1';
const PERSONAL_SPACE_KEY = 'nastardamus-personal-space-v1';
const EXPERIENCE_SETTINGS_KEY = 'nastardamus-experience-settings-v1';
const LANGUAGE_KEY = 'nastardamus-language-v1';
const DAILY_GREETING_KEY = 'nastardamus-daily-greeting-v1';
const TAROT_REVEAL_MS = 2300;
const CURRENT_YEAR = new Date().getFullYear();
const storedProfile = readJSON(PROFILE_KEY, {});
const storedPersonalSpace = readJSON(PERSONAL_SPACE_KEY, {});
const storedDailyGreeting = readJSON(DAILY_GREETING_KEY, {});
const initialLocale = normalizeLocale(readJSON(LANGUAGE_KEY, 'ru'));
const initialGreetingDate = dailyGreetingDateKey();
const initialGreetingPractice = selectDailyGreetingPractice(
  initialGreetingDate,
  `${storedProfile.name || ''}:${storedProfile.gender || ''}`
);
applyDocumentLocale(initialLocale);

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

const INITIATION_INTERESTS = [
  ['relationships', 'Отношения'], ['business', 'Бизнес'], ['growth', 'Саморазвитие'],
  ['money', 'Деньги'], ['spirituality', 'Духовность'], ['travel', 'Путешествия'],
  ['health', 'Здоровье'], ['creativity', 'Творчество']
];

const INITIATION_GOALS = [
  ['love', 'Найти любовь'], ['income', 'Увеличить доход'], ['growth', 'Развиваться'],
  ['harmony', 'Гармония и покой'], ['horizons', 'Новые горизонты'], ['family', 'Укрепить дом и семью']
];

const INITIATION_PROGRESS = [0, 14, 28, 42, 57, 71, 85, 92, 98, 100];

const CLOCK_STYLES = Object.freeze([
  { id: 'classic', label: 'Классика' },
  { id: 'calligraphy', label: 'Каллиграфия' },
  { id: 'manuscript', label: 'Рукопись' },
  { id: 'modern', label: 'Современный' }
]);

const ESOTERIUM_CAPABILITIES = Object.freeze([
  { glyph: '✦', title: 'Таро', subtitle: 'Живой расклад', copy: 'Карты раскрываются в диалоге и соединяются в историю вашего выбора.' },
  { glyph: '⌁', title: 'Хиромантия', subtitle: 'Линии пути', copy: 'Я читаю различимые линии ладони и веду разговор о прошлом, настоящем и вероятном будущем.' },
  { glyph: 'ᛉ', title: 'Руны', subtitle: 'Знак и действие', copy: 'Руна становится не украшением, а ясным следующим шагом.' },
  { glyph: '☉', title: 'Астрология', subtitle: 'Личное небо', copy: 'Натальная карта, ритм дня и небесные циклы собираются вокруг вашей истории.' },
  { glyph: '∞', title: 'Совместимость', subtitle: 'Диалог двоих', copy: 'Я помогаю услышать силу связи, точку напряжения и направление общего пути.' },
  { glyph: '◇', title: 'Мой путь', subtitle: 'Знаки в жизни', copy: 'Предсказания соединяются с вашими целями, событиями и реальными решениями.' }
]);

const WORLD_META = Object.freeze({
  core: { background: '', themeColor: '#070913' },
  threshold: { background: '/images/worlds/threshold.webp', themeColor: '#080b0e' },
  'my-path': { background: '/images/worlds/my-path.webp', themeColor: '#130d09' },
  profile: { background: '/images/worlds/my-path.webp', themeColor: '#100c09' },
  runes: { background: '/images/worlds/runes.webp', themeColor: '#090d10' },
  palmistry: { background: '/images/worlds/palmistry.webp', themeColor: '#150b0d' },
  tarot: { background: '/images/worlds/tarot.webp', themeColor: '#100709' },
  natal: { background: '/images/worlds/natal.webp', themeColor: '#050c16' },
  sports: { background: '/images/worlds/sports.webp', themeColor: '#030a0d' },
  amur: { background: '/images/worlds/amur.webp', themeColor: '#160a10' }
});

function worldForScreen(screen = 'core') {
  if (screen === 'welcome') return 'threshold';
  if (screen === 'profile') return 'profile';
  if (screen.startsWith('space')) return 'my-path';
  if (screen.startsWith('runes')) return 'runes';
  if (screen.startsWith('tarot')) return 'tarot';
  if (screen === 'natal' || screen === 'natal-result' || screen === 'horoscope') return 'natal';
  if (screen === 'sports') return 'sports';
  if (screen.startsWith('amur') || screen.startsWith('compatibility') || screen.startsWith('invite') || screen === 'invitation' || screen === 'photo-compat') return 'amur';
  if (screen.startsWith('palm') || screen === 'ritual' || screen === 'photo-energy' || screen === 'photo-damage' || screen === 'photo-result') return 'palmistry';
  return 'core';
}

const params = new URLSearchParams(location.search);
const requestedScreen = params.get('screen');
const requestedInvitationToken = /^[a-f0-9]{32}$/.test(params.get('invitation') || '')
  ? params.get('invitation')
  : '';
const requestedOracleRoomToken = /^[a-f0-9]{32}$/.test(params.get('room') || '')
  ? params.get('room')
  : '';
const requestedInviteGoal = ['love', 'friendship', 'business', 'creative'].includes(params.get('invite'))
  ? params.get('invite')
  : 'love';
const initialScreen = requestedInvitationToken
  ? 'invitation'
  : requestedOracleRoomToken
    ? 'palm-room'
    : requestedScreen && !['home', 'welcome'].includes(requestedScreen)
      ? requestedScreen
      : 'welcome';
const state = {
  screen: initialScreen,
  locale: initialLocale,
  welcomePhase: 0,
  onboardingStep: 0,
  onboardingGenderTouched: false,
  initiationComplete: false,
  initiationConsents: {
    personalization: storedProfile.consents?.personalization === true,
    privacy: storedProfile.consents?.privacy === true
  },
  dailyGreeting: {
    date: initialGreetingDate,
    dayPart: dailyGreetingDayPart(),
    todayFirstLogin: storedDailyGreeting.lastSeenDate !== initialGreetingDate,
    practiceId: initialGreetingPractice,
    answer: fallbackDailyGreeting({
      userName: storedProfile.name,
      userGender: storedProfile.gender,
      locale: initialLocale,
      todayFirstLogin: storedDailyGreeting.lastSeenDate !== initialGreetingDate,
      dayPart: dailyGreetingDayPart(),
      practiceId: initialGreetingPractice,
      date: initialGreetingDate
    }),
    status: 'fallback',
    requestKey: '',
    visitMarked: false
  },
  wallet: null,
  walletStatus: 'loading',
  walletMessage: '',
  profileSection: 'wallet',
  profileOverlay: '',
  busy: false,
  spread: 'past-present-future',
  tarotCategory: 'all',
  tarotStage: 'catalog',
  tarotQuestion: '',
  tarotDeck: [],
  tarotCards: [],
  revealingCard: null,
  tarotDialogueMessages: [],
  tarotDialogueDraft: '',
  tarotDialogueSending: false,
  result: null,
  sportsEvent: '',
  sportsContext: '',
  sportsResult: '',
  natalStage: 'intro',
  natalDate: String(storedProfile.birthDate || ''),
  natalTime: String(storedProfile.birthTime || '12:00'),
  natalTimeKnown: storedProfile.birthTimeKnown !== false,
  natalPlace: String(storedProfile.city || ''),
  natalFocus: 'intuition',
  natalZoom: 1,
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
    everythingFree: false,
    sbpTopupsEnabled: false,
    botUsername: 'BelonTip_bot'
  },
  wheelStatus: null,
  wheelPrize: null,
  wheelRotation: 0,
  topupAmount: '',
  topupMethod: 'sbp',
  topupReturnScreen: 'services',
  userGender: normalizeGender(storedProfile.gender),
  profile: {
    name: String(storedProfile.name || ''),
    age: Number(storedProfile.age) || '',
    city: String(storedProfile.city || ''),
    birthDate: String(storedProfile.birthDate || ''),
    birthTime: String(storedProfile.birthTime || '12:00'),
    birthTimeKnown: storedProfile.birthTimeKnown !== false,
    interests: Array.isArray(storedProfile.interests) ? storedProfile.interests : [],
    goals: Array.isArray(storedProfile.goals) ? storedProfile.goals : [],
    avatarUrl: String(storedProfile.avatarUrl || ''),
    telegramAvatarUrl: String(storedProfile.telegramAvatarUrl || ''),
    consents: storedProfile.consents && typeof storedProfile.consents === 'object' ? storedProfile.consents : {},
    natalChart: storedProfile.natalChart && typeof storedProfile.natalChart === 'object' ? storedProfile.natalChart : null,
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
  oracleRoomToken: requestedOracleRoomToken,
  oracleRoom: null,
  oracleRooms: [],
  oracleRoomStatus: requestedOracleRoomToken ? 'idle' : 'empty',
  oracleRoomsStatus: 'idle',
  oracleRoomLoading: false,
  oracleRoomSending: false,
  oracleRoomInviteUrl: '',
  oracleRoomMode: 'solo',
  oracleRoomDraft: {
    title: '',
    focus: '',
    maxParticipants: 6,
    inviteeName: '',
    inviteeGender: 'unspecified',
    relationshipType: 'love',
    openingQuestion: '',
    relationshipConsent: false,
    adultConfirmed: false
  },
  oracleRoomJoinConsent: false,
  oracleRoomJoinAdult: false,
  oracleRoomMessageDraft: '',
  oracleRoomMessageNonce: '',
  oracleRoomInviteUsername: '',
  oracleRoomInviteFile: null,
  oracleRoomPalmImage: '',
  oracleRoomPalmDescription: '',
  oracleRoomPalmConsent: false,
  oracleRoomPreparationToken: '',
  oracleRoomPreparationEditing: false,
  oracleRoomPreparation: {
    dominantHand: 'right',
    palmSide: 'right',
    answers: { connection: '', tension: '', future: '', personalQuestion: '' }
  },
  oracleRoomError: '',
  runeQuestion: '',
  runeView: 'temple',
  runeSpread: 'three',
  runeSearch: '',
  runeFamily: 'all',
  runeFavorites: readJSON('nastardamus-rune-favorites-v1', []),
  runeDialogueMessages: [],
  runeDialogueDraft: '',
  runeDialogueSending: false,
  runeCount: 3,
  runeSelection: [],
  runeResult: null,
  amurMode: 'portal',
  amurDice: [],
  amurRolling: false,
  amurQuizStep: 0,
  amurAnswers: readJSON('nastardamus-amur-answers-v1', {}),
  amurProfile: null,
  amurDiscovery: false,
  amurAdultConfirmed: readJSON('nastardamus-amur-adult-v1', false) === true,
  amurCandidates: [],
  amurCandidatesStatus: 'idle',
  amurGameStep: 0,
  amurGameAnswers: [],
  horoscope: readJSON(HOROSCOPE_KEY, { sign: 'aries', enabled: false, reading: '', date: '' }),
  support: readJSON(SUPPORT_KEY, []),
  supportDraft: '',
  experience: {
    sound: false,
    atmosphere: true,
    motion: 'auto',
    quality: 'auto',
    clockStyle: 'calligraphy',
    ...readJSON(EXPERIENCE_SETTINGS_KEY, {})
  },
  personalSpace: {
    status: 'idle',
    view: 'today',
    events: Array.isArray(storedPersonalSpace.events) ? storedPersonalSpace.events : [],
    goals: Array.isArray(storedPersonalSpace.goals) ? storedPersonalSpace.goals : [],
    tasks: Array.isArray(storedPersonalSpace.tasks) ? storedPersonalSpace.tasks : [],
    projects: Array.isArray(storedPersonalSpace.projects) ? storedPersonalSpace.projects : [],
    habits: Array.isArray(storedPersonalSpace.habits) ? storedPersonalSpace.habits : [],
    consultations: Array.isArray(storedPersonalSpace.consultations) ? storedPersonalSpace.consultations : [],
    checkins: Array.isArray(storedPersonalSpace.checkins) ? storedPersonalSpace.checkins : [],
    settings: {
      memoryEnabled: storedPersonalSpace.settings?.memoryEnabled !== false,
      morningEnabled: storedPersonalSpace.settings?.morningEnabled !== false,
      eveningEnabled: storedPersonalSpace.settings?.eveningEnabled !== false,
      plan: String(storedPersonalSpace.settings?.plan || 'free')
    },
    selectedEventId: '',
    selectedGoalId: '',
    plannerHorizon: 'week',
    consultationStep: 0,
    consultationAnswers: {},
    consultationDraft: '',
    consultationResult: null,
    projectDraft: '',
    habitDraft: '',
    eventDraft: null,
    goalDraft: null,
    taskDraft: null
  }
};

if (!requestedScreen && requestedOracleRoomToken) state.screen = 'palm-room';

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
  if (!state.profile.name) {
    state.profile.name = String(tg?.initDataUnsafe?.user?.first_name || '').trim().slice(0, 50);
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
  const selectedQuality = ['lite', 'standard', 'high'].includes(state.experience.quality) ? state.experience.quality : quality;
  document.documentElement.dataset.visualQuality = selectedQuality;
  document.documentElement.dataset.motion = state.experience.motion === 'reduced' || reducedMotion ? 'reduced' : 'full';
  document.documentElement.dataset.atmosphere = state.experience.atmosphere === false ? 'off' : 'on';
  return selectedQuality;
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
  toast.textContent = translateText(message, state.locale);
  toast.classList.add('is-visible');
  toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2800);
}

function pulse(type = 'light') {
  tg?.HapticFeedback?.impactOccurred?.(type);
  if (!tg) navigator.vibrate?.(type === 'medium' ? 35 : 16);
  if (state.experience.sound) playInteractionTone(type);
}

function playInteractionTone(type = 'light') {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const context = playInteractionTone.context ||= new AudioContext();
    const oscillator = context.createOscillator(); const gain = context.createGain();
    oscillator.type = 'sine'; oscillator.frequency.value = type === 'medium' ? 392 : 523.25;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.025, context.currentTime + .012);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + .16);
    oscillator.connect(gain).connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + .18);
  } catch { /* Sound remains optional if the device blocks Web Audio. */ }
}

function firstName() {
  return String(state?.profile?.name || tg?.initDataUnsafe?.user?.first_name || '').trim().slice(0, 30) || 'Искатель';
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString(dateTimeLocale(state.locale), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function serviceConfig(id) {
  const service = state.publicConfig.serviceCatalog?.[id] || { enabled: true, price: null };
  return state.publicConfig.everythingFree === true ? { ...service, price: 0 } : service;
}

function serviceBadge(id, fallback = '') {
  if (state.publicConfig.everythingFree === true) return 'Бесплатно';
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
  if (state.publicConfig.everythingFree === true) return true;
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
  if (screen !== 'profile') state.profileOverlay = '';
  state.screen = screen;
  const url = new URL(location.href);
  url.searchParams.set('screen', screen);
  history[replace ? 'replaceState' : 'pushState']({}, '', url);
  render();
  window.scrollTo?.({ top: 0, behavior: 'auto' });
  if (screen === 'profile' || screen === 'topup') loadWallet({ force: true });
}

function activeTab(screen = state.screen) {
  if (screen === 'home' || screen === 'wheel' || screen === 'horoscope' || screen.startsWith('space')) return 'home';
  if (screen === 'history') return 'history';
  if (screen === 'profile' || screen === 'withdrawal' || screen === 'topup') return 'profile';
  if (screen === 'amur' || screen === 'compatibility' || screen.startsWith('compatibility-') || screen.startsWith('invite') || screen === 'invitation') return 'amur';
  return 'services';
}

function shell(content, { tabs = true, active = activeTab(), reading = false } = {}) {
  const world = worldForScreen(state.screen);
  const worldMeta = WORLD_META[world] || WORLD_META.core;
  const readingClass = reading ? ' premium-shell--reading' : '';
  const screenReadingClass = reading ? ' premium-screen--reading' : '';
  return AppShell({ className: `premium-shell world--${world}${readingClass}`, backgroundUrl: worldMeta.background, children: [
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

function languagePicker({ compact = false } = {}) {
  return h('div', {
    className: `language-picker ${compact ? 'language-picker--compact' : ''}`,
    attrs: { role: 'group', 'aria-label': 'Выбрать язык' }
  }, LANGUAGE_OPTIONS.map((option) => h('button', {
    className: state.locale === option.id ? 'is-active' : '',
    attrs: {
      type: 'button',
      lang: option.id === 'zh' ? 'zh-CN' : option.id,
      'aria-pressed': state.locale === option.id ? 'true' : 'false',
      title: option.label
    },
    on: { click: () => setAppLocale(option.id) }
  }, option.short)));
}

function setAppLocale(value) {
  const locale = normalizeLocale(value);
  if (locale === state.locale) return;
  state.locale = locale;
  applyDocumentLocale(locale);
  writeJSON(LANGUAGE_KEY, locale);
  state.dailyGreeting.answer = fallbackDailyGreeting(dailyGreetingContext());
  state.dailyGreeting.status = 'fallback';
  state.dailyGreeting.requestKey = '';
  pulse();
  render();
  notify('Язык изменён');
  loadDailyGreeting({ force: true });
}

function currentClockStyle() {
  return CLOCK_STYLES.some((style) => style.id === state.experience.clockStyle)
    ? state.experience.clockStyle
    : 'calligraphy';
}

function clockParts(date = new Date()) {
  const locale = dateTimeLocale(state.locale);
  return {
    time: new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hour12: false }).format(date),
    date: new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' }).format(date)
  };
}

function celestialClock({ large = false } = {}) {
  const parts = clockParts();
  const style = currentClockStyle();
  return h('button', {
    className: `celestial-clock celestial-clock--${style} ${large ? 'celestial-clock--large' : ''}`,
    attrs: { type: 'button', 'aria-label': 'Сменить почерк часов', title: CLOCK_STYLES.find((item) => item.id === style)?.label || '' },
    on: { click: cycleClockStyle }
  },
  h('span', { className: 'celestial-clock__orbit', attrs: { 'aria-hidden': 'true' } }, '✦'),
  h('span', {},
    h('strong', { text: parts.time, dataset: { celestialTime: 'true' } }),
    h('small', { text: parts.date, dataset: { celestialDate: 'true' } })
  ));
}

function cycleClockStyle() {
  const index = CLOCK_STYLES.findIndex((style) => style.id === currentClockStyle());
  state.experience.clockStyle = CLOCK_STYLES[(index + 1) % CLOCK_STYLES.length].id;
  writeJSON(EXPERIENCE_SETTINGS_KEY, state.experience);
  pulse();
  render();
  notify('Стиль часов сохранён');
}

function clockStylePicker() {
  return h('div', { className: 'clock-style-picker', attrs: { role: 'group', 'aria-label': 'Часы и почерк' } },
    CLOCK_STYLES.map((style) => h('button', {
      className: currentClockStyle() === style.id ? 'is-active' : '',
      attrs: { type: 'button', 'aria-pressed': currentClockStyle() === style.id ? 'true' : 'false' },
      on: { click: () => {
        state.experience.clockStyle = style.id;
        writeJSON(EXPERIENCE_SETTINGS_KEY, state.experience);
        pulse();
        render();
        notify('Стиль часов сохранён');
      } }
    }, h('span', { className: `clock-style-sample clock-style-sample--${style.id}`, text: '12:48' }), h('small', { text: style.label })))
  );
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
  const step = Math.max(0, Math.min(9, Number(state.onboardingStep) || 0));
  if (state.profile.completed && step === 0) return dailyGreetingScreen();
  if (step === 0) return initiationThresholdScreen();
  return shell([initiationStepScreen(step)], { tabs: false });
}

function dailyGreetingContext() {
  return {
    userName: firstName(),
    userGender: state.userGender,
    locale: state.locale,
    todayFirstLogin: state.dailyGreeting.todayFirstLogin,
    dayPart: state.dailyGreeting.dayPart,
    practiceId: state.dailyGreeting.practiceId,
    date: state.dailyGreeting.date
  };
}

function markDailyGreetingVisit() {
  if (state.dailyGreeting.visitMarked) return;
  state.dailyGreeting.visitMarked = true;
  writeJSON(DAILY_GREETING_KEY, {
    lastSeenDate: state.dailyGreeting.date,
    lastSeenAt: new Date().toISOString()
  });
}

function dailyGreetingScreen() {
  markDailyGreetingVisit();
  const greeting = state.dailyGreeting;
  const practice = DAILY_GREETING_PRACTICES[greeting.practiceId] || DAILY_GREETING_PRACTICES.tarot_day;
  const top = h('header', { className: 'oracle-welcome__top' }, BrandLogo(), languagePicker({ compact: true }));
  const firstVisit = greeting.todayFirstLogin === true;

  return shell([
    h('section', {
      className: `oracle-daily-greeting ${firstVisit ? 'is-first' : 'is-return'}`,
      attrs: { 'aria-label': 'Личное приветствие Эзотериума' }
    },
    top,
    h('div', { className: 'oracle-daily-greeting__stage', attrs: { 'aria-hidden': 'true' } },
      h('span', { className: 'oracle-daily-greeting__halo' }),
      h('span', { className: 'oracle-daily-greeting__seal', text: '✦' })
    ),
    h('article', { className: 'oracle-daily-greeting__panel' },
      h('p', {
        className: 'oracle-welcome__eyebrow',
        text: firstVisit ? 'ПЕРВЫЙ ЗНАК ДНЯ' : 'ВЫ СНОВА В КРУГЕ'
      }),
      h('p', {
        className: `oracle-daily-greeting__speech${greeting.status === 'loading' ? ' is-listening' : ''}`,
        attrs: { 'aria-live': 'polite' },
        text: greeting.answer
      }),
      h('span', { className: 'oracle-daily-greeting__signature', text: 'Эзотериум' }),
      h('div', { className: 'oracle-daily-greeting__actions' },
        firstVisit ? MysticButton({
          text: practice.cta[state.locale] || practice.cta.ru,
          icon: 'sparkle',
          variant: 'primary',
          onClick: openDailyGreetingPractice
        }) : null,
        MysticButton({
          text: firstVisit ? 'Войти без практики' : 'Продолжить',
          icon: firstVisit ? 'compass' : 'sparkle',
          variant: firstVisit ? 'outline' : 'primary',
          onClick: finishWelcome
        })
      )
    ))
  ], { tabs: false });
}

function openDailyGreetingPractice() {
  const practiceId = state.dailyGreeting.practiceId;
  pulse('medium');
  if (practiceId === 'tarot_day') {
    selectTarotSpread('card-of-day');
    return;
  }
  if (practiceId === 'resource') {
    state.personalSpace.consultationStep = 0;
    state.personalSpace.consultationResult = null;
    navigate('space-consultation');
    return;
  }
  if (practiceId === 'rune_flow') {
    state.runeSpread = 'one';
    state.runeCount = 1;
    state.runeQuestion = '';
    state.runeSelection = [];
    state.runeResult = null;
    state.runeView = 'spreads';
    navigate('runes');
    return;
  }
  navigate('horoscope');
}

async function loadDailyGreeting({ force = false } = {}) {
  if (!state.profile.completed) return;
  const context = dailyGreetingContext();
  const requestKey = JSON.stringify(context);
  if (!force && (state.dailyGreeting.status === 'loading' || state.dailyGreeting.requestKey === requestKey)) return;

  state.dailyGreeting.answer = fallbackDailyGreeting(context);
  state.dailyGreeting.requestKey = requestKey;
  if (!tg?.initData) {
    state.dailyGreeting.status = 'fallback';
    if (state.screen === 'welcome') render();
    return;
  }

  state.dailyGreeting.status = 'loading';
  if (state.screen === 'welcome') render();
  try {
    const data = await api('/api/assistant', {
      method: 'POST',
      body: { agent: 'daily-greeting', context }
    });
    if (state.dailyGreeting.requestKey !== requestKey) return;
    state.dailyGreeting.answer = String(data.answer || '').trim() || fallbackDailyGreeting(context);
    state.dailyGreeting.status = data.source === 'live' ? 'ready' : 'fallback';
  } catch {
    if (state.dailyGreeting.requestKey !== requestKey) return;
    state.dailyGreeting.answer = fallbackDailyGreeting(context);
    state.dailyGreeting.status = 'fallback';
  }
  if (state.screen === 'welcome') render();
}

function initiationThresholdScreen() {
  const phase = Math.max(0, Math.min(2, Number(state.welcomePhase) || 0));
  const top = h('header', { className: 'oracle-welcome__top' }, BrandLogo(), languagePicker({ compact: true }));

  if (phase === 0) {
    return shell([
      h('section', { className: 'oracle-welcome oracle-welcome--portrait' },
        top,
        h('div', { className: 'oracle-welcome__figure', attrs: { 'aria-hidden': 'true' } },
          h('span', { className: 'oracle-welcome__halo' }),
          h('span', { className: 'oracle-welcome__constellation' }, h('i'), h('i'), h('i'))
        ),
        h('div', { className: 'oracle-welcome__intro' },
          h('p', { className: 'oracle-welcome__eyebrow', text: 'ОРАКУЛ ЕДИНОЙ ИСТИНЫ' }),
          h('h1', { text: 'Я — Эзотериум' }),
          h('p', { className: 'oracle-welcome__signature', text: 'Я соединяю знаки не ради готового ответа — а чтобы вы увидели то, что уже меняет вашу дорогу.' }),
          h('div', { className: 'oracle-welcome__mini-seals', attrs: { 'aria-hidden': 'true' } },
            h('span', { text: '☉' }), h('span', { text: 'ᛉ' }), h('span', { text: '✦' })
          ),
          MysticButton({ text: 'Узнать, что я умею', icon: 'sparkle', variant: 'primary', onClick: () => { state.welcomePhase = 1; pulse('medium'); render(); } })
        )
      )
    ], { tabs: false });
  }

  if (phase === 1) {
    return shell([
      h('section', { className: 'oracle-welcome oracle-welcome--capabilities' },
        top,
        h('div', { className: 'oracle-welcome__capability-head' },
          h('p', { className: 'oracle-welcome__eyebrow', text: 'Эзотериум' }),
          h('h1', { text: 'Чем я могу быть вам полезен' }),
          h('p', { text: 'Каждая практика — отдельный путь. Вместе они складываются в один честный разговор о вас.' })
        ),
        h('div', { className: 'oracle-capability-grid' }, ESOTERIUM_CAPABILITIES.map((capability, index) =>
          h('article', { className: 'oracle-capability', style: { '--capability-index': index } },
            h('span', { className: 'oracle-capability__glyph', text: capability.glyph, attrs: { 'aria-hidden': 'true' } }),
            h('span', {}, h('small', { text: capability.subtitle }), h('strong', { text: capability.title })),
            h('p', { text: capability.copy })
          )
        )),
        h('div', { className: 'oracle-welcome__actions' },
          MysticButton({
            text: state.profile.completed ? 'Войти в Nastardamus' : 'Продолжить знакомство',
            icon: 'sparkle', variant: 'primary',
            onClick: state.profile.completed ? finishWelcome : () => { state.welcomePhase = 2; pulse(); render(); }
          })
        )
      )
    ], { tabs: false });
  }

  return shell([
    h('section', { className: 'oracle-welcome oracle-welcome--consent' },
      top,
      h('div', { className: 'oracle-welcome__consent-copy' },
        h('span', { className: 'oracle-welcome__consent-seal', text: '✦', attrs: { 'aria-hidden': 'true' } }),
        h('p', { className: 'oracle-welcome__eyebrow', text: 'Эзотериум' }),
        h('h1', { text: 'Первое знакомство' }),
        h('p', { text: 'Чтобы мои ответы стали личными, разрешите сохранить выбранные вами данные и настройки.' }),
        h('div', { className: 'initiation-consents' },
          initiationConsentRow('personalization', 'Разрешаю использовать мои ответы для персональных рекомендаций.'),
          initiationConsentRow('privacy', 'Понимаю, что дата, фото и личные ответы остаются приватными и ими можно управлять в профиле.')
        ),
        h('button', {
          className: 'initiation-threshold__seal',
          attrs: { type: 'button', 'aria-label': 'Начать личное знакомство', disabled: !state.initiationConsents.personalization || !state.initiationConsents.privacy },
          on: { click: () => { state.onboardingStep = 1; pulse('medium'); render(); } }
        },
        h('span', { attrs: { 'aria-hidden': 'true' }, text: '✦' }),
        h('strong', { text: 'Начать личное знакомство' }))
      )
    )
  ], { tabs: false });
}

function finishWelcome() {
  state.screen = 'home';
  state.welcomePhase = 0;
  const url = new URL(location.href);
  url.searchParams.set('screen', 'home');
  history.replaceState({}, '', url);
  pulse('medium');
  render();
}

function initiationConsentRow(key, label) {
  const input = h('input', { attrs: { type: 'checkbox' }, on: { change: (event) => { state.initiationConsents[key] = event.target.checked; render(); } } });
  input.checked = state.initiationConsents[key] === true;
  return h('label', {}, input, h('span', { text: label }));
}

function initiationStepScreen(step) {
  const progress = INITIATION_PROGRESS[step] ?? 0;
  const content = initiationStepContent(step);
  return h('section', { className: `initiation-step initiation-step--${step}` },
    h('header', { className: 'initiation-step__header' },
      h('button', {
        className: 'initiation-step__back', attrs: { type: 'button', 'aria-label': 'Вернуться на предыдущий шаг' },
        on: { click: () => { state.onboardingStep = Math.max(0, step - 1); state.initiationComplete = false; render(); } }
      }, Icon('arrow-left', { size: 21 })),
      h('div', { className: 'initiation-progress', attrs: { role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(progress) } },
        h('span', { style: { '--initiation-progress': `${progress}%` } }),
        h('small', { text: `${progress}%` })
      ),
      h('span', { className: 'initiation-step__number', text: `${String(step + 1).padStart(2, '0')}/10` })
    ),
    h('div', { className: 'initiation-step__body' }, content)
  );
}

function initiationStepContent(step) {
  if (step === 1) {
    return [
      initiationOracleLine('Имя — первый знак, который вы доверяете этому пространству.'),
      h('h1', { text: 'Как мне к вам обращаться?' }),
      field('Ваше имя', textInput({
        value: state.profile.name,
        placeholder: 'Ваше имя…',
        attrs: { autocomplete: 'name', maxlength: 50 },
        onInput: (value) => { state.profile.name = value; }
      })),
      initiationContinueButton('Продолжить', () => advanceInitiation(1))
    ];
  }
  if (step === 2) {
    return [
      initiationOracleLine(`Теперь я знаю ваше имя, ${state.profile.name.trim() || 'Искатель'}.`),
      h('h1', { text: 'Как звучит ваш голос в диалоге?' }),
      h('div', { className: 'initiation-gender-grid' }, Object.entries(GENDER_OPTIONS).map(([value, option]) =>
        h('button', {
          className: `initiation-choice-card ${state.onboardingGenderTouched && state.userGender === value ? 'is-active' : ''}`,
          attrs: { type: 'button', 'aria-pressed': state.onboardingGenderTouched && state.userGender === value ? 'true' : 'false' },
          on: { click: () => { state.userGender = value; state.onboardingGenderTouched = true; pulse(); render(); } }
        }, h('img', { attrs: { src: premiumArtUrl(option.art), alt: '' } }), h('strong', { text: option.label }))
      )),
      initiationContinueButton('Продолжить', () => advanceInitiation(2))
    ];
  }
  if (step === 3) {
    const birthDate = textInput({
      type: 'date', value: state.profile.birthDate,
      attrs: { max: personalDateKey(), autocomplete: 'bday' },
      onInput: (value) => { state.profile.birthDate = value; }
    });
    return [
      initiationOracleLine('Космос запоминает не возраст, а точный момент начала пути.'),
      h('h1', { text: 'Когда вы родились?' }),
      field('Дата рождения', birthDate),
      initiationContinueButton('Сохранить дату', () => advanceInitiation(3))
    ];
  }
  if (step === 4) {
    const time = textInput({
      type: 'time', value: state.profile.birthTime || '12:00',
      attrs: { disabled: state.profile.birthTimeKnown ? null : true },
      onInput: (value) => { state.profile.birthTime = value; state.profile.birthTimeKnown = true; }
    });
    return [
      initiationOracleLine('Время помогает увидеть восходящий знак и дома карты. Его можно уточнить позже.'),
      h('h1', { text: 'Помните время рождения?' }),
      field('Время рождения', time),
      h('button', {
        className: `initiation-unknown-time ${state.profile.birthTimeKnown ? '' : 'is-active'}`,
        attrs: { type: 'button', 'aria-pressed': state.profile.birthTimeKnown ? 'false' : 'true' },
        on: { click: () => { state.profile.birthTimeKnown = !state.profile.birthTimeKnown; render(); } }
      }, 'Не знаю точное время'),
      initiationContinueButton('Продолжить', () => advanceInitiation(4))
    ];
  }
  if (step === 5) {
    return [
      initiationOracleLine('Место рождения задаёт горизонт, над которым в тот момент поднималось небо.'),
      h('h1', { text: 'Где начался ваш путь?' }),
      field('Город рождения', textInput({
        value: state.profile.city,
        placeholder: 'Начните вводить город…',
        attrs: { autocomplete: 'address-level2', maxlength: 120 },
        onInput: (value) => { state.profile.city = value; }
      })),
      initiationContinueButton('Сохранить место', () => advanceInitiation(5))
    ];
  }
  if (step === 6) {
    return [
      initiationOracleLine('Фото помогает сделать пространство личным. Этот шаг можно пропустить.'),
      h('h1', { text: 'Какой образ будет вашим?' }),
      imageUpload({
        title: 'Добавить фотографию', image: state.profile.avatarUrl, capture: 'user',
        onImage: (image) => { state.profile.avatarUrl = image; render(); },
        onRemove: () => { state.profile.avatarUrl = ''; render(); }
      }),
      initiationContinueButton(state.profile.avatarUrl ? 'Использовать фото' : 'Пропустить', () => advanceInitiation(6), state.profile.avatarUrl ? 'primary' : 'gold')
    ];
  }
  if (step === 7) {
    return [
      initiationOracleLine('Выберите хотя бы три темы. Они помогут мне не предлагать вам чужой путь.'),
      h('h1', { text: 'Что сейчас вам действительно близко?' }),
      h('div', { className: 'initiation-interest-grid' }, INITIATION_INTERESTS.map(([value, label], index) =>
        initiationSelectionButton('interests', value, label, index)
      )),
      h('small', { className: 'initiation-selection-count', text: `Выбрано: ${state.profile.interests.length} · минимум 3` }),
      initiationContinueButton('Продолжить', () => advanceInitiation(7))
    ];
  }
  if (step === 8) {
    return [
      initiationOracleLine('Цель не определяет всю жизнь. Она лишь показывает, куда направить первый свет.'),
      h('h1', { text: 'С чего начнём?' }),
      h('div', { className: 'initiation-goal-grid' }, INITIATION_GOALS.map(([value, label], index) =>
        initiationSelectionButton('goals', value, label, index)
      )),
      initiationContinueButton('Создать мой профиль', () => advanceInitiation(8))
    ];
  }
  return [
    h('div', { className: `initiation-forge ${state.initiationComplete ? 'is-complete' : ''}` },
      h('span', { className: 'initiation-forge__orbit', attrs: { 'aria-hidden': 'true' } }, h('i'), h('i'), h('i')),
      h('span', { className: 'initiation-forge__portrait' }, h('img', { attrs: { src: profileAvatar(), alt: '' } })),
      h('p', { className: 'premium-kicker', text: state.initiationComplete ? 'ПОСВЯЩЕНИЕ ЗАВЕРШЕНО' : 'ЭЗОТЕРИУМ СОЕДИНЯЕТ ЗНАКИ' }),
      h('h1', { text: state.initiationComplete ? `${state.profile.name.trim()}, ваш путь открыт` : 'Создаю ваш личный круг…' }),
      h('p', { text: state.initiationComplete ? 'Имя, рождение, интересы и цели стали основой для Натальной карты, Амура и личных чтений.' : 'Имя становится голосом. Дата — небесным рисунком. Цели — первым направлением.' }),
      state.initiationComplete
        ? initiationContinueButton('Продолжить в Nastardamus', saveOnboardingProfile)
        : h('div', { className: 'initiation-forge__meter' }, h('span'))
    )
  ];
}

function initiationOracleLine(text) {
  return h('div', { className: 'initiation-oracle-line' },
    h('span', { text: '✦', attrs: { 'aria-hidden': 'true' } }),
    h('p', { text })
  );
}

function initiationContinueButton(text, onClick, variant = 'primary') {
  return MysticButton({ text, icon: 'sparkle', variant, disabled: state.busy, onClick });
}

function initiationSelectionButton(fieldName, value, label, index) {
  const selected = state.profile[fieldName].includes(value);
  return h('button', {
    className: `initiation-tile ${selected ? 'is-active' : ''}`,
    style: { '--choice-index': index },
    attrs: { type: 'button', 'aria-pressed': selected ? 'true' : 'false' },
    on: { click: () => {
      const values = new Set(state.profile[fieldName]);
      selected ? values.delete(value) : values.add(value);
      state.profile[fieldName] = [...values];
      pulse();
      render();
    } }
  }, h('span', { text: String(index + 1).padStart(2, '0') }), h('strong', { text: label }));
}

function ageFromBirthDate(value) {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return 0;
  const now = new Date();
  let age = now.getFullYear() - date.getFullYear();
  const beforeBirthday = now.getMonth() < date.getMonth() || (now.getMonth() === date.getMonth() && now.getDate() < date.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}

function zodiacFromBirthDate(value) {
  const match = /^(?:\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
  if (!match) return state.horoscope.sign || 'aries';
  const month = Number(match[1]);
  const day = Number(match[2]);
  const edge = [20, 19, 21, 20, 21, 21, 23, 23, 23, 23, 22, 22];
  const signs = ['capricorn', 'aquarius', 'pisces', 'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius'];
  return day < edge[month - 1] ? signs[month - 1] : signs[month % 12];
}

function advanceInitiation(step) {
  if (step === 1 && state.profile.name.trim().length < 2) return notify('Введите имя, которым к вам обращаться');
  if (step === 2 && !state.onboardingGenderTouched) return notify('Выберите форму обращения');
  if (step === 3) {
    const age = ageFromBirthDate(state.profile.birthDate);
    if (!age || age < 13 || age > 120) return notify('Укажите корректную дату рождения');
    state.profile.age = age;
    state.horoscope.sign = zodiacFromBirthDate(state.profile.birthDate);
  }
  if (step === 4 && state.profile.birthTimeKnown && !state.profile.birthTime) return notify('Укажите время или выберите «Не знаю»');
  if (step === 5 && state.profile.city.trim().length < 2) return notify('Укажите город рождения');
  if (step === 7 && state.profile.interests.length < 3) return notify('Выберите минимум три интереса');
  if (step === 8 && state.profile.goals.length < 1) return notify('Выберите хотя бы одну цель');
  if (step === 8) return beginInitiationCompletion();
  state.onboardingStep = Math.min(9, step + 1);
  pulse();
  render();
}

function beginInitiationCompletion() {
  if (state.busy) return;
  state.onboardingStep = 9;
  state.initiationComplete = false;
  state.busy = true;
  pulse('medium');
  render();
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
  window.setTimeout(() => {
    state.busy = false;
    state.initiationComplete = true;
    pulse('medium');
    render();
  }, reducedMotion ? 320 : 3200);
}

async function saveOnboardingProfile() {
  const age = ageFromBirthDate(state.profile.birthDate) || Number(state.profile.age);
  const city = state.profile.city.trim().replace(/\s+/g, ' ');
  if (!Number.isInteger(age) || age < 13 || age > 120) return notify('Укажите корректную дату рождения');
  if (city.length < 2) return notify('Укажите город рождения');
  state.busy = true;
  render();
  try {
    state.profile = {
      ...state.profile,
      name: state.profile.name.trim().replace(/\s+/g, ' '),
      age,
      city,
      telegramAvatarUrl: String(tg?.initDataUnsafe?.user?.photo_url || state.profile.telegramAvatarUrl || ''),
      completed: true
    };
    state.profile.consents = { ...state.initiationConsents, acceptedAt: new Date().toISOString() };
    writeJSON(PROFILE_KEY, { ...state.profile, gender: state.userGender, consents: { ...state.initiationConsents, acceptedAt: new Date().toISOString() } });
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
    locale: state.locale,
    zodiacSign: state.horoscope.sign,
    enabled: state.horoscope.enabled,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Berlin',
    gender: state.userGender,
    birthYear: state.profile.birthDate ? Number(state.profile.birthDate.slice(0, 4)) : CURRENT_YEAR - Number(state.profile.age || 18),
    birthDate: state.profile.birthDate,
    birthTime: state.profile.birthTimeKnown ? state.profile.birthTime : '',
    birthTimeKnown: state.profile.birthTimeKnown === true,
    city: state.profile.city.trim(),
    interests: state.profile.interests,
    goals: state.profile.goals,
    consents: state.profile.consents || state.initiationConsents,
    natalChart: state.profile.natalChart,
    ...extra
  };
}

function persistPersonalSpace() {
  writeJSON(PERSONAL_SPACE_KEY, {
    events: state.personalSpace.events,
    goals: state.personalSpace.goals,
    tasks: state.personalSpace.tasks,
    projects: state.personalSpace.projects,
    habits: state.personalSpace.habits,
    consultations: state.personalSpace.consultations,
    checkins: state.personalSpace.checkins,
    settings: state.personalSpace.settings
  });
}

async function personalStore(action, payload = {}) {
  if (!tg?.initData) return { ok: true, local: true };
  return api('/api/proxy', { method: 'POST', body: { ...payload, action } });
}

async function loadPersonalSpace({ force = false } = {}) {
  if (!tg?.initData || (state.personalSpace.status === 'loading' && !force)) return;
  if (state.personalSpace.status === 'ready' && !force) return;
  state.personalSpace.status = 'loading';
  if (state.screen === 'space') render();
  try {
    const data = await personalStore('get_personal_space');
    if (!data.local) {
      state.personalSpace.events = Array.isArray(data.events) ? data.events : [];
      state.personalSpace.goals = Array.isArray(data.goals) ? data.goals : [];
      state.personalSpace.tasks = Array.isArray(data.tasks) ? data.tasks : [];
      state.personalSpace.projects = Array.isArray(data.projects) ? data.projects : state.personalSpace.projects;
      state.personalSpace.habits = Array.isArray(data.habits) ? data.habits : state.personalSpace.habits;
      state.personalSpace.consultations = Array.isArray(data.consultations) ? data.consultations : state.personalSpace.consultations;
      state.personalSpace.checkins = Array.isArray(data.checkins) ? data.checkins : [];
      state.personalSpace.settings = { ...state.personalSpace.settings, ...(data.settings || {}) };
    }
    state.personalSpace.status = 'ready';
    persistPersonalSpace();
  } catch (error) {
    state.personalSpace.status = 'offline';
    if (state.screen === 'space') notify('Открыта сохранённая копия. Синхронизация повторится позже.');
  } finally {
    if (state.screen.startsWith('space')) render();
  }
}

function personalEnergyCard() {
  const energy = dailyEnergy();
  return h('button', {
    className: 'personal-energy-card',
    attrs: { type: 'button' },
    style: { '--energy-a': energy.colors[0], '--energy-b': energy.colors[1] },
    on: { click: () => { state.personalSpace.energyOpen = !state.personalSpace.energyOpen; render(); } }
  },
  h('span', { className: 'personal-energy-card__symbol', text: energy.symbol }),
  h('span', {},
    h('small', { text: `ЭНЕРГИЯ ДНЯ · ${energy.number}` }),
    h('strong', { text: energy.title }),
    h('span', { text: energy.short })
  ),
  h('b', { text: state.personalSpace.energyOpen ? 'Свернуть ↑' : 'Подробнее →' }));
}

function personalEventRow(event) {
  const category = PERSONAL_CATEGORIES[event.category] || PERSONAL_CATEGORIES.other;
  return h('button', {
    className: 'personal-list-row', attrs: { type: 'button' },
    on: { click: () => { state.personalSpace.selectedEventId = event.eventId; navigate('space-event'); } }
  },
  h('i', { style: { background: category.color } }),
  h('span', {}, h('strong', { text: event.title }), h('small', { text: `${formatPersonalDate(event.date)}${event.time ? ` · ${event.time}` : ''} · ${category.label}` })),
  h('b', { text: PERSONAL_PRIORITIES[event.priority]?.mark || '·' }));
}

function personalGoalRow(goal) {
  const progress = goalProgress(goal.goalId, state.personalSpace.tasks);
  return h('button', {
    className: 'personal-goal-row', attrs: { type: 'button' },
    on: { click: () => { state.personalSpace.selectedGoalId = goal.goalId; navigate('space-goal'); } }
  },
  h('span', {}, h('strong', { text: goal.title }), h('small', { text: goal.deadline ? `До ${formatPersonalDate(goal.deadline)}` : 'Без срока' })),
  h('span', { className: 'personal-progress' },
    h('i', {}, h('b', { style: { width: `${progress.percent}%` } })),
    h('small', { text: `${progress.completed}/${progress.total} · ${progress.percent}%` })
  ));
}

function formatPersonalDate(value) {
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? '' : new Intl.DateTimeFormat(dateTimeLocale(state.locale), { day: 'numeric', month: 'short' }).format(parsed);
}

function personalRitualCard() {
  const today = personalDateKey();
  const current = state.personalSpace.checkins.find((item) => item.date === today);
  const hour = new Date().getHours();
  if (hour >= 6 && state.personalSpace.settings.morningEnabled && !current?.morningTasks?.length) {
    const candidates = [
      ...state.personalSpace.tasks.filter((task) => taskDueOn(task)).map((task) => ({ id: task.taskId, title: task.title })),
      ...nextPersonalEvents(state.personalSpace.events).map((event) => ({ id: event.eventId, title: event.title }))
    ].slice(0, 8);
    return MysticCard({ className: 'personal-ritual-card', children: [
      h('small', { className: 'premium-kicker', text: 'УТРЕННИЙ НАСТРОЙ' }),
      h('h3', { text: 'Что сегодня действительно важно?' }),
      h('p', { text: 'Выберите от трёх до пяти дел, если они есть. Это не контроль, а ваша точка опоры.' }),
      candidates.length ? candidates.map((item) => {
        const input = h('input', { attrs: { type: 'checkbox' }, on: { change: (event) => {
          const selected = new Set(state.personalSpace.morningSelected || []);
          event.target.checked ? selected.add(item.id) : selected.delete(item.id);
          if (selected.size > 5) { event.target.checked = false; selected.delete(item.id); notify('На утро можно выбрать от трёх до пяти важных дел'); }
          state.personalSpace.morningSelected = [...selected];
        } } });
        return h('label', { className: 'personal-check-row' }, input, h('span', { text: item.title }));
      }) : h('p', { className: 'premium-info-note', text: 'Добавьте событие или задачу — и они появятся здесь.' }),
      MysticButton({ text: 'Сохранить настрой', icon: 'sparkle', variant: 'primary', onClick: saveMorningCheckin })
    ] });
  }
  if (hour >= 20 && state.personalSpace.settings.eveningEnabled && current?.morningTasks?.length && !current.eveningReflection) {
    return MysticCard({ className: 'personal-ritual-card', children: [
      h('small', { className: 'premium-kicker', text: 'ВЕЧЕРНЯЯ РЕФЛЕКСИЯ' }),
      h('h3', { text: 'Что этот день помог понять?' }),
      field('Короткий итог', textarea({ value: state.personalSpace.reflectionDraft || '', placeholder: 'Что получилось, что перенести, за что вы благодарны…', maxLength: 1000, onInput: (value) => { state.personalSpace.reflectionDraft = value; } })),
      MysticButton({ text: 'Завершить день', icon: 'sparkle', variant: 'primary', onClick: saveEveningReflection })
    ] });
  }
  return null;
}

async function saveMorningCheckin() {
  const selected = state.personalSpace.morningSelected || [];
  if (selected.length < Math.min(3, [...state.personalSpace.tasks.filter((task) => taskDueOn(task)), ...nextPersonalEvents(state.personalSpace.events)].length || 1)) return notify('Выберите три важных дела, если они уже есть в вашем плане');
  const entry = { date: personalDateKey(), morningTasks: selected, eveningReflection: null };
  state.personalSpace.checkins = [...state.personalSpace.checkins.filter((item) => item.date !== entry.date), entry];
  persistPersonalSpace(); render();
  try { await personalStore('save_personal_checkin', { checkin: entry }); } catch { notify('Настрой сохранён на устройстве'); }
}

async function saveEveningReflection() {
  const text = String(state.personalSpace.reflectionDraft || '').trim();
  if (text.length < 3) return notify('Добавьте хотя бы одну короткую мысль');
  const date = personalDateKey();
  const current = state.personalSpace.checkins.find((item) => item.date === date);
  const entry = { ...current, date, eveningReflection: { text, savedAt: new Date().toISOString() } };
  state.personalSpace.checkins = [...state.personalSpace.checkins.filter((item) => item.date !== date), entry];
  state.personalSpace.reflectionDraft = ''; persistPersonalSpace(); render();
  try { await personalStore('save_personal_checkin', { checkin: entry }); } catch { notify('Итог сохранён на устройстве'); }
}

function personalSpaceScreen() {
  const energy = dailyEnergy();
  const view = ['today', 'planner', 'goals', 'reflection'].includes(state.personalSpace.view)
    ? state.personalSpace.view
    : 'today';
  return shell([
    screenHeader('Мой путь', 'Сегодня, план, цели и тихий итог дня', 'home'),
    personalPathHero(view),
    personalPathTabs(view),
    view === 'today' ? personalTodayView(energy) : null,
    view === 'planner' ? personalPlannerView() : null,
    view === 'goals' ? personalGoalsView() : null,
    view === 'reflection' ? personalReflectionView() : null,
    h('button', { className: 'personal-privacy-link', attrs: { type: 'button' }, on: { click: () => navigate('space-settings') } }, Icon('profile', { size: 20 }), h('span', { text: 'Память, данные и приватность' }))
  ], { active: 'home' });
}

function personalPathHero(view) {
  const labels = {
    today: ['СЕГОДНЯ', personalGreeting(firstName())],
    planner: ['ПЛАНИРОВЩИК', 'Пусть будущее станет видимым, но не тяжёлым.'],
    goals: ['ДАЛЬНИЙ ОРИЕНТИР', 'Большой путь держится на малых повторяемых шагах.'],
    reflection: ['ТИХИЙ ИТОГ', 'День становится опытом, когда вы называете его смысл.']
  };
  const [kicker, copy] = labels[view] || labels.today;
  return h('section', { className: `personal-path-hero is-${view}` },
    h('span', { className: 'personal-path-hero__light', attrs: { 'aria-hidden': 'true' }, text: '✦' }),
    h('div', {},
      h('p', { className: 'premium-kicker', text: kicker }),
      h('h1', { text: copy }),
      state.personalSpace.status === 'offline' ? h('small', { text: 'Офлайн-копия · синхронизация продолжится позже' }) : null
    )
  );
}

function personalPathTabs(view) {
  const tabs = [['today', 'Сегодня'], ['planner', 'План'], ['goals', 'Цели'], ['reflection', 'Итог']];
  return h('nav', { className: 'personal-path-tabs', attrs: { 'aria-label': 'Разделы Моего пути' } },
    tabs.map(([value, label]) => h('button', {
      className: view === value ? 'is-active' : '',
      attrs: { type: 'button', 'aria-current': view === value ? 'page' : null },
      on: { click: () => { state.personalSpace.view = value; pulse(); render(); } }
    }, label))
  );
}

function personalTodayView(energy) {
  const events = nextPersonalEvents(state.personalSpace.events, new Date(), 5);
  const focusGoal = state.personalSpace.goals.find((goal) => goal.status === 'active');
  return h('div', { className: 'personal-path-view is-today' },
    personalEnergyCard(),
    state.personalSpace.energyOpen ? MysticCard({ className: 'personal-energy-detail', children: [
      h('p', { text: energy.full }),
      h('dl', {}, h('dt', { text: 'Благоприятно' }), h('dd', { text: energy.favorable }), h('dt', { text: 'Лучше избегать' }), h('dd', { text: energy.avoid })),
      h('strong', { text: energy.recommendation })
    ] }) : null,
    personalRitualCard(),
    h('div', { className: 'personal-guidance-strip' },
      h('span', {}, h('small', { text: 'СОВЕТ' }), h('strong', { text: energy.recommendation.replace(/^Рекомендация:\s*/i, '') })),
      h('span', {}, h('small', { text: 'ФОКУС' }), h('strong', { text: energy.archetype.quality }))
    ),
    SectionTitle({ text: 'Важное сегодня' }),
    h('div', { className: 'personal-list' }, events.length
      ? events.slice(0, 5).map(personalEventRow)
      : h('p', { className: 'personal-empty', text: 'Сегодня перед вами чистая страница. Добавьте одно событие, к которому важно подготовиться.' })),
    focusGoal ? h('div', { className: 'personal-today-focus' },
      h('small', { text: 'ЦЕЛЬ В ФОКУСЕ' }), personalGoalRow(focusGoal)
    ) : null,
    h('div', { className: 'personal-quick-actions' },
      h('button', { attrs: { type: 'button' }, on: { click: () => { state.personalSpace.eventDraft = null; navigate('space-event-form'); } } }, Icon('sparkle', { size: 20 }), h('span', {}, h('strong', { text: 'Событие' }), h('small', { text: 'Добавить в путь' }))),
      h('button', { attrs: { type: 'button' }, on: { click: () => { state.personalSpace.plannerHorizon = 'week'; state.personalSpace.view = 'planner'; render(); } } }, Icon('compass', { size: 20 }), h('span', {}, h('strong', { text: 'Неделя' }), h('small', { text: 'Собрать план' }))),
      h('button', { attrs: { type: 'button' }, on: { click: () => navigate('space-consultation') } }, Icon('send', { size: 20 }), h('span', {}, h('strong', { text: 'Эзотериум' }), h('small', { text: 'Разобрать вопрос' })))
    )
  );
}

function personalPlannerView() {
  const today = personalDateKey();
  const start = state.personalSpace.plannerHorizon === 'tomorrow' ? personalDateKey(new Date(Date.now() + 86_400_000)) : today;
  const end = personalHorizonEnd(state.personalSpace.plannerHorizon);
  const events = state.personalSpace.events
    .filter((event) => event.status === 'active' && event.date >= start && event.date <= end)
    .sort((a, b) => `${a.date}T${a.time || '23:59'}`.localeCompare(`${b.date}T${b.time || '23:59'}`));
  return h('div', { className: 'personal-path-view is-planner' },
    h('div', { className: 'personal-horizon-tabs' }, [['today', 'Сегодня'], ['tomorrow', 'Завтра'], ['week', 'Неделя'], ['month', 'Месяц'], ['quarter', 'Квартал'], ['year', 'Год']].map(([id, label]) => h('button', { className: state.personalSpace.plannerHorizon === id ? 'is-active' : '', attrs: { type: 'button' }, on: { click: () => { state.personalSpace.plannerHorizon = id; render(); } } }, label))),
    SectionTitle({ text: 'События горизонта' }),
    h('div', { className: 'personal-list' }, events.length
      ? events.map(personalEventRow)
      : h('p', { className: 'personal-empty', text: 'План пока пуст. Начните с одного события — даты, разговора или решения.' })),
    MysticButton({ text: 'Добавить событие', icon: 'sparkle', variant: 'primary', onClick: () => { state.personalSpace.eventDraft = null; navigate('space-event-form'); } })
  );
}

function personalHorizonEnd(horizon = 'week') {
  const date = new Date();
  const days = { today: 0, tomorrow: 1, week: 7, month: 31, quarter: 92, year: 366 }[horizon] ?? 7;
  if (horizon === 'tomorrow') {
    const key = personalDateKey(new Date(date.getTime() + 86_400_000));
    return key;
  }
  date.setDate(date.getDate() + days);
  return personalDateKey(date);
}

function personalGoalsView() {
  const goals = state.personalSpace.goals.filter((goal) => goal.status === 'active');
  return h('div', { className: 'personal-path-view is-goals' },
    SectionTitle({ text: 'Активные цели' }),
    h('div', { className: 'personal-list' }, goals.length
      ? goals.map(personalGoalRow)
      : h('p', { className: 'personal-empty', text: 'Сформулируйте один дальний ориентир. Затем мы разобьём его на шаги.' })),
    MysticButton({ text: 'Новая цель', icon: 'compass', variant: 'primary', onClick: () => { state.personalSpace.goalDraft = null; navigate('space-goal-form'); } }),
    SectionTitle({ text: 'Проекты' }),
    personalHierarchyEditor('project'),
    SectionTitle({ text: 'Привычки' }),
    personalHierarchyEditor('habit'),
    h('p', { className: 'premium-info-note', text: 'Иерархия пути: цель → проект → задача → событие → привычка. Каждый элемент можно связать с одной активной целью.' })
  );
}

function personalHierarchyEditor(kind) {
  const isProject = kind === 'project';
  const collection = isProject ? state.personalSpace.projects : state.personalSpace.habits;
  const key = isProject ? 'projectDraft' : 'habitDraft';
  return h('div', { className: 'personal-hierarchy-editor' },
    collection.length ? collection.map((item) => h('article', {}, h('span', { text: isProject ? '◇' : '↻' }), h('span', {}, h('strong', { text: item.title }), h('small', { text: state.personalSpace.goals.find((goal) => goal.goalId === item.goalId)?.title || 'Самостоятельный ориентир' })), h('button', { attrs: { type: 'button', 'aria-label': 'Завершить' }, on: { click: () => { item.status = 'completed'; persistPersonalSpace(); render(); } } }, '✓'))) : h('p', { className: 'personal-empty', text: isProject ? 'Проекты соединят большую цель с конкретными задачами.' : 'Привычки покажут ритм, который поддерживает цель.' }),
    h('div', { className: 'personal-hierarchy-compose' },
      textInput({ value: state.personalSpace[key], placeholder: isProject ? 'Новый проект' : 'Новая привычка', attrs: { maxlength: 100 }, onInput: (value) => { state.personalSpace[key] = value; } }),
      h('button', { attrs: { type: 'button', 'aria-label': 'Добавить' }, on: { click: () => addPersonalHierarchyItem(kind) } }, '+')
    )
  );
}

function addPersonalHierarchyItem(kind) {
  const key = kind === 'project' ? 'projectDraft' : 'habitDraft';
  const title = String(state.personalSpace[key] || '').trim().replace(/\s+/g, ' ');
  if (title.length < 3) return notify('Добавьте название хотя бы из трёх символов');
  const collection = kind === 'project' ? state.personalSpace.projects : state.personalSpace.habits;
  const item = { id: uniqueId(kind), title, goalId: state.personalSpace.goals.find((goal) => goal.status === 'active')?.goalId || '', status: 'active', createdAt: new Date().toISOString() };
  collection.push(item); state.personalSpace[key] = ''; persistPersonalSpace(); render();
  personalStore('upsert_path_item', { item: { ...item, kind } }).catch(() => notify('Сохранено на устройстве'));
}

function personalReflectionView() {
  const current = state.personalSpace.checkins.find((item) => item.date === personalDateKey());
  const ritual = personalRitualCard();
  const report = personalMonthlyReport();
  return h('div', { className: 'personal-path-view is-reflection' },
    ritual || MysticCard({ className: 'personal-reflection-summary', children: [
      h('p', { className: 'premium-kicker', text: current?.eveningReflection ? 'ИТОГ СОХРАНЁН' : 'ВЕЧЕРНИЙ РИТУАЛ' }),
      h('h3', { text: current?.eveningReflection ? 'Этот день уже стал частью вашей истории' : 'Рефлексия откроется после 20:00' }),
      h('p', { text: current?.eveningReflection?.text || 'До вечера просто замечайте: что дало силы, что отняло внимание и за что вы благодарны.' })
    ] }),
    state.personalSpace.checkins.length ? h('div', { className: 'personal-reflection-history' },
      state.personalSpace.checkins.slice(-5).reverse().map((entry) => h('article', {},
        h('time', { text: formatPersonalDate(entry.date) }),
        h('p', { text: entry.eveningReflection?.text || `Утренний фокус: ${entry.morningTasks?.length || 0}` })
      ))
    ) : null,
    SectionTitle({ text: 'Отчёт месяца' }),
    MysticCard({ className: 'personal-month-report', children: [
      h('div', { className: 'personal-month-report__metrics' },
        h('span', {}, h('strong', { text: String(report.completedEvents) }), h('small', { text: 'событий завершено' })),
        h('span', {}, h('strong', { text: String(report.habitMarks) }), h('small', { text: 'шагов выполнено' })),
        h('span', {}, h('strong', { text: String(report.reflections) }), h('small', { text: 'вечерних итогов' }))
      ),
      h('p', { text: report.insight }),
      state.personalSpace.consultations.length ? h('small', { text: `Сохранённых рекомендаций: ${state.personalSpace.consultations.length}` }) : null
    ] })
  );
}

function personalMonthlyReport(value = new Date()) {
  const month = personalDateKey(value).slice(0, 7);
  const completedEvents = state.personalSpace.events.filter((event) => event.status === 'completed' && String(event.date).startsWith(month)).length;
  const habitMarks = state.personalSpace.tasks.reduce((total, task) => total + (task.completedDates || []).filter((date) => String(date).startsWith(month)).length, 0);
  const reflections = state.personalSpace.checkins.filter((entry) => String(entry.date).startsWith(month) && entry.eveningReflection?.text).length;
  const insight = reflections >= 8
    ? 'Вы регулярно превращаете события в опыт. В следующем месяце полезно сохранить один повторяемый вечерний вопрос.'
    : habitMarks >= 8
      ? 'Ваш главный ресурс — повторяемость. Добавьте рефлексию, чтобы видеть не только объём, но и смысл движения.'
      : 'Месяц ещё собирается. Выберите одну привычку и один вечер в неделю для короткого итога.';
  return { completedEvents, habitMarks, reflections, insight };
}

function personalEventDraft() {
  if (!state.personalSpace.eventDraft) {
    const current = state.personalSpace.events.find((item) => item.eventId === state.personalSpace.selectedEventId);
    state.personalSpace.eventDraft = current ? { ...current } : {
      eventId: '', title: '', date: personalDateKey(), time: '', description: '',
      location: '', links: [], desiredResult: '', reflection: '',
      category: 'other', priority: 'medium', status: 'active', reminder: false, goalId: ''
    };
  }
  return state.personalSpace.eventDraft;
}

function personalEventFormScreen() {
  const draft = personalEventDraft();
  const reminder = h('input', { attrs: { type: 'checkbox' }, on: { change: (event) => { draft.reminder = event.target.checked; } } });
  reminder.checked = draft.reminder;
  return shell([
    screenHeader(draft.eventId ? 'Изменить событие' : 'Новое событие', 'Эзотериум поможет увидеть его яснее', 'space'),
    MysticCard({ className: 'premium-form-card', children: [
      field('Название *', textInput({ value: draft.title, placeholder: 'Например: важный разговор', attrs: { maxlength: 100 }, onInput: (value) => { draft.title = value; } })),
      h('div', { className: 'personal-form-grid' },
        field('Дата *', textInput({ value: draft.date, type: 'date', attrs: { min: personalDateKey() }, onInput: (value) => { draft.date = value; } })),
        field('Время', textInput({ value: draft.time, type: 'time', onInput: (value) => { draft.time = value; } }))
      ),
      field('Описание', textarea({ value: draft.description, placeholder: 'Контекст, ожидания, важные детали…', maxLength: 500, onInput: (value) => { draft.description = value; } })),
      field('Место', textInput({ value: draft.location || '', placeholder: 'Адрес, пространство или онлайн', attrs: { maxlength: 180 }, onInput: (value) => { draft.location = value; } })),
      field('Ссылки', textarea({ value: Array.isArray(draft.links) ? draft.links.join('\n') : draft.links || '', placeholder: 'По одной ссылке на строку', maxLength: 1000, onInput: (value) => { draft.links = value.split(/\n/).map((item) => item.trim()).filter(Boolean); } })),
      field('Желаемый результат', textarea({ value: draft.desiredResult || '', placeholder: 'Как вы поймёте, что событие прошло не зря?', maxLength: 500, onInput: (value) => { draft.desiredResult = value; } })),
      field('Категория', selectField(PERSONAL_CATEGORIES, draft.category, (value) => { draft.category = value; })),
      field('Приоритет', selectField(PERSONAL_PRIORITIES, draft.priority, (value) => { draft.priority = value; })),
      h('label', { className: 'personal-check-row' }, reminder, h('span', { text: draft.time ? 'Напомнить перед событием' : 'Укажите время, чтобы включить напоминание' }))
    ] }),
    h('div', { className: 'personal-space-actions' },
      MysticButton({ text: 'Сохранить', icon: 'history', variant: 'secondary', disabled: state.busy, onClick: () => savePersonalEvent({ askEsoterium: false }) }),
      MysticButton({ text: state.busy ? 'Эзотериум отвечает…' : 'Сохранить и спросить Эзотериума', icon: 'sparkle', variant: 'primary', disabled: state.busy, onClick: () => savePersonalEvent({ askEsoterium: true }) })
    )
  ], { active: 'home' });
}

async function analyzePersonalEventLive(event) {
  if (!tg?.initData) {
    return { analysis: analyzePersonalEvent(event), source: 'local' };
  }
  const data = await api('/api/proxy', { method: 'POST', body: { action: 'personal_analysis', event } });
  return { analysis: data.analysis, source: 'esoterium' };
}

function storePersonalEventLocally(event) {
  state.personalSpace.events = [
    ...state.personalSpace.events.filter((item) => item.eventId !== event.eventId),
    event
  ];
  state.personalSpace.selectedEventId = event.eventId;
  persistPersonalSpace();
}

async function savePersonalEvent({ askEsoterium = false } = {}) {
  if (state.busy) return;
  let event;
  try {
    event = normalizePersonalEvent(personalEventDraft());
  } catch (error) {
    const messages = { event_title_too_short: 'Название должно содержать хотя бы 3 символа', event_date_invalid: 'Выберите сегодняшнюю или будущую дату', event_time_invalid: 'Проверьте время события' };
    return notify(messages[error.message] || 'Проверьте обязательные поля');
  }
  event.eventId ||= globalThis.crypto?.randomUUID?.() || `${Date.now()}00000000-0000-4000-8000-000000000000`.slice(-36);
  state.busy = true; render();
  let analysisError = null;
  try {
    if (askEsoterium) {
      try {
        const generated = await analyzePersonalEventLive(event);
        event.analysis = generated.analysis;
        event.enrichments = {
          ...(event.enrichments || {}),
          analysisSource: generated.source,
          analyzedAt: new Date().toISOString()
        };
      } catch (error) {
        analysisError = error;
      }
    }
    storePersonalEventLocally(event);
    try {
      const data = await personalStore('upsert_personal_event', { event });
      if (data.event) storePersonalEventLocally(data.event);
    } catch {
      notify('Событие сохранено на устройстве. Синхронизация повторится позже.');
    }
    state.personalSpace.eventDraft = null;
    navigate('space-event', { replace: true });
    if (analysisError) notify(apiErrorMessage(analysisError));
  } finally { state.busy = false; render(); }
}

function personalEventScreen() {
  const event = state.personalSpace.events.find((item) => item.eventId === state.personalSpace.selectedEventId);
  if (!event) return shell([screenHeader('Событие', '', 'space'), h('p', { className: 'personal-empty', text: 'Событие не найдено.' })], { active: 'home' });
  const analysis = event.analysis;
  const parts = analysis ? [
    ['Энергия события', analysis.energy], ['Возможности', analysis.opportunities], ['Риски', analysis.risks],
    ['Рекомендация', analysis.recommendation], ['Вопрос Эзотериума', analysis.question]
  ] : [];
  return shell([
    screenHeader(event.title, `${formatPersonalDate(event.date)}${event.time ? ` · ${event.time}` : ''}`, 'space'),
    event.description || event.location || event.desiredResult ? MysticCard({ className: 'personal-event-context', children: [
      event.description ? h('p', { text: event.description }) : null,
      event.location ? h('p', {}, h('strong', { text: 'Место: ' }), event.location) : null,
      event.desiredResult ? h('p', {}, h('strong', { text: 'Желаемый результат: ' }), event.desiredResult) : null,
      event.links?.length ? h('div', { className: 'personal-event-links' }, event.links.map((link, index) => h('a', { attrs: { href: /^https?:\/\//i.test(link) ? link : `https://${link}`, target: '_blank', rel: 'noopener' }, text: `Ссылка ${index + 1}` }))) : null
    ] }) : null,
    analysis
      ? h('section', { className: 'personal-analysis' }, parts.map(([title, copy], index) => MysticCard({ className: index === 4 ? 'personal-analysis__question' : '', children: [h('small', { text: `0${index + 1}` }), h('h3', { text: title }), h('p', { text: copy })] })))
      : MysticCard({ className: 'personal-analysis__empty', children: [
          h('small', { className: 'premium-kicker', text: 'СОВЕТ НЕ ЗАПРАШИВАЛИ' }),
          h('h3', { text: 'Событие уже сохранено' }),
          h('p', { text: 'Можно оставить его в календаре или попросить Эзотериума связать детали события с вашим недавним путём.' })
        ] }),
    MysticButton({
      text: state.busy ? 'Эзотериум отвечает…' : analysis ? 'Обновить совет Эзотериума' : 'Спросить Эзотериума',
      icon: 'sparkle', variant: analysis ? 'secondary' : 'primary', disabled: state.busy,
      onClick: () => requestPersonalEventAdvice(event)
    }),
    h('div', { className: 'personal-space-actions' },
      MysticButton({ text: 'Изменить', icon: 'profile', variant: 'secondary', onClick: () => { state.personalSpace.eventDraft = { ...event }; navigate('space-event-form'); } }),
      MysticButton({ text: 'Завершить', icon: 'sparkle', variant: 'primary', onClick: () => updatePersonalEventStatus(event, 'completed') })
    ),
    event.status === 'completed' ? MysticCard({ className: 'premium-form-card', children: [
      field('Рефлексия после события', textarea({ value: event.reflection || '', placeholder: 'Что получилось, чему вы научились, что перенести дальше?', maxLength: 1000, onInput: (value) => { event.reflection = value; } })),
      MysticButton({ text: 'Сохранить итог', icon: 'save', variant: 'secondary', onClick: () => updatePersonalEventStatus(event, 'completed') })
    ] }) : null,
    h('button', { className: 'personal-danger-link', attrs: { type: 'button' }, on: { click: () => updatePersonalEventStatus(event, 'archived') }, text: 'Удалить событие' })
  ], { active: 'home' });
}

async function requestPersonalEventAdvice(event) {
  if (state.busy) return;
  state.busy = true; render();
  try {
    const generated = await analyzePersonalEventLive(event);
    const updated = {
      ...event,
      analysis: generated.analysis,
      enrichments: {
        ...(event.enrichments || {}),
        analysisSource: generated.source,
        analyzedAt: new Date().toISOString()
      }
    };
    storePersonalEventLocally(updated);
    try {
      const data = await personalStore('upsert_personal_event', { event: updated });
      if (data.event) storePersonalEventLocally(data.event);
    } catch {
      notify('Совет сохранён на устройстве. Синхронизация повторится позже.');
    }
    notify(generated.source === 'esoterium' ? 'Совет Эзотериума сохранён в «Моём пути»' : 'Сохранён локальный ориентир');
  } catch (error) {
    notify(apiErrorMessage(error));
  } finally { state.busy = false; render(); }
}

async function deletePersonalEvent(event) {
  if (!window.confirm('Удалить это событие и сохранённый совет без возможности восстановления?')) return;
  try {
    await personalStore('delete_personal_item', { itemType: 'event', itemId: event.eventId });
    state.personalSpace.events = state.personalSpace.events.filter((item) => item.eventId !== event.eventId);
    persistPersonalSpace();
    navigate('space', { replace: true });
    notify('Событие удалено');
  } catch (error) {
    notify(apiErrorMessage(error));
  }
}

async function updatePersonalEventStatus(event, status) {
  const updated = { ...event, status };
  state.personalSpace.events = state.personalSpace.events.map((item) => item.eventId === event.eventId ? updated : item);
  persistPersonalSpace(); navigate('space', { replace: true });
  try { await personalStore('upsert_personal_event', { event: updated }); } catch { notify('Изменение сохранено на устройстве'); }
}

function personalGoalDraft() {
  if (!state.personalSpace.goalDraft) {
    const current = state.personalSpace.goals.find((item) => item.goalId === state.personalSpace.selectedGoalId);
    state.personalSpace.goalDraft = current ? { ...current } : { goalId: '', title: '', description: '', category: 'growth', deadline: '', status: 'active' };
  }
  return state.personalSpace.goalDraft;
}

function personalGoalFormScreen() {
  const draft = personalGoalDraft();
  return shell([
    screenHeader(draft.goalId ? 'Изменить цель' : 'Новая цель', 'Движение начинается с ясной формулировки', 'space'),
    MysticCard({ className: 'premium-form-card', children: [
      field('Название *', textInput({ value: draft.title, placeholder: 'Чего вы хотите достичь?', attrs: { maxlength: 100 }, onInput: (value) => { draft.title = value; } })),
      field('Зачем это важно', textarea({ value: draft.description, placeholder: 'Ваш личный смысл и желаемый результат…', maxLength: 500, onInput: (value) => { draft.description = value; } })),
      field('Категория', selectField(PERSONAL_CATEGORIES, draft.category, (value) => { draft.category = value; })),
      field('Срок', textInput({ value: draft.deadline, type: 'date', attrs: { min: personalDateKey() }, onInput: (value) => { draft.deadline = value; } }))
    ] }),
    MysticButton({ text: state.busy ? 'Сохраняем…' : 'Сохранить цель', icon: 'sparkle', variant: 'primary', disabled: state.busy, onClick: savePersonalGoal })
  ], { active: 'home' });
}

async function savePersonalGoal() {
  let goal;
  try { goal = normalizePersonalGoal(personalGoalDraft()); } catch { return notify('Название цели должно содержать хотя бы 3 символа'); }
  goal.goalId ||= globalThis.crypto?.randomUUID?.() || `${Date.now()}00000000-0000-4000-8000-000000000000`.slice(-36);
  state.busy = true; render();
  try {
    const data = await personalStore('upsert_personal_goal', { goal });
    const saved = data.goal || goal;
    state.personalSpace.goals = [...state.personalSpace.goals.filter((item) => item.goalId !== saved.goalId), saved];
    state.personalSpace.selectedGoalId = saved.goalId;
    state.personalSpace.goalDraft = null; persistPersonalSpace(); navigate('space-goal', { replace: true });
  } catch (error) { notify(apiErrorMessage(error)); } finally { state.busy = false; render(); }
}

function personalGoalScreen() {
  const goal = state.personalSpace.goals.find((item) => item.goalId === state.personalSpace.selectedGoalId);
  if (!goal) return shell([screenHeader('Цель', '', 'space'), h('p', { className: 'personal-empty', text: 'Цель не найдена.' })], { active: 'home' });
  const tasks = state.personalSpace.tasks.filter((task) => task.goalId === goal.goalId);
  const progress = goalProgress(goal.goalId, state.personalSpace.tasks);
  const draft = state.personalSpace.taskDraft || { title: '', recurrence: 'none', scheduledDate: personalDateKey() };
  state.personalSpace.taskDraft = draft;
  return shell([
    screenHeader(goal.title, goal.deadline ? `Цель до ${formatPersonalDate(goal.deadline)}` : 'Без жёсткого срока', 'space'),
    MysticCard({ className: 'personal-goal-summary', children: [
      goal.description ? h('p', { text: goal.description }) : null,
      h('strong', { text: `${progress.percent}% пути на сегодня` }),
      h('span', { className: 'personal-progress personal-progress--wide' }, h('i', {}, h('b', { style: { width: `${progress.percent}%` } })))
    ] }),
    SectionTitle({ text: 'Шаги и привычки' }),
    h('div', { className: 'personal-list' }, tasks.length ? tasks.map((task) => personalTaskRow(task)) : h('p', { className: 'personal-empty', text: 'Добавьте первый выполнимый шаг.' })),
    MysticCard({ className: 'premium-form-card', children: [
      field('Новый шаг', textInput({ value: draft.title, placeholder: 'Например: 20 минут практики', attrs: { maxlength: 100 }, onInput: (value) => { draft.title = value; } })),
      field('Повторение', selectField({ none: { label: 'Один раз' }, daily: { label: 'Каждый день' }, weekly: { label: 'Каждую неделю' }, monthly: { label: 'Каждый месяц' } }, draft.recurrence, (value) => { draft.recurrence = value; })),
      MysticButton({ text: 'Добавить шаг', icon: 'sparkle', variant: 'secondary', onClick: () => savePersonalTask(goal) })
    ] }),
    h('div', { className: 'personal-space-actions' },
      MysticButton({ text: 'Изменить цель', icon: 'profile', variant: 'secondary', onClick: () => { state.personalSpace.goalDraft = { ...goal }; navigate('space-goal-form'); } }),
      MysticButton({ text: 'Завершить цель', icon: 'sparkle', variant: 'primary', onClick: () => updatePersonalGoalStatus(goal, 'completed') })
    )
  ], { active: 'home' });
}

function personalTaskRow(task) {
  const today = personalDateKey();
  const checked = task.completedDates?.includes(today);
  const input = h('input', { attrs: { type: 'checkbox' }, on: { change: () => togglePersonalTask(task) } });
  input.checked = checked;
  return h('label', { className: `personal-check-row${checked ? ' is-complete' : ''}` }, input, h('span', {}, h('strong', { text: task.title }), h('small', { text: { none: 'Один раз', daily: 'Каждый день', weekly: 'Раз в неделю', monthly: 'Раз в месяц' }[task.recurrence] } )));
}

async function savePersonalTask(goal) {
  let task;
  try { task = normalizePersonalTask({ ...state.personalSpace.taskDraft, taskId: globalThis.crypto?.randomUUID?.(), goalId: goal.goalId, completedDates: [] }); } catch { return notify('Название шага должно содержать хотя бы 3 символа'); }
  state.personalSpace.tasks.push(task); state.personalSpace.taskDraft = null; persistPersonalSpace(); render();
  try { const data = await personalStore('upsert_personal_task', { task }); if (data.task) state.personalSpace.tasks = state.personalSpace.tasks.map((item) => item.taskId === task.taskId ? data.task : item); } catch { notify('Шаг сохранён на устройстве'); }
}

async function togglePersonalTask(task) {
  const today = personalDateKey();
  const dates = new Set(task.completedDates || []);
  dates.has(today) ? dates.delete(today) : dates.add(today);
  task.completedDates = [...dates].sort(); persistPersonalSpace(); render();
  try { await personalStore('upsert_personal_task', { task }); } catch { notify('Прогресс сохранён на устройстве'); }
}

async function updatePersonalGoalStatus(goal, status) {
  const updated = { ...goal, status };
  state.personalSpace.goals = state.personalSpace.goals.map((item) => item.goalId === goal.goalId ? updated : item);
  persistPersonalSpace(); navigate('space', { replace: true });
  try { await personalStore('upsert_personal_goal', { goal: updated }); } catch { notify('Изменение сохранено на устройстве'); }
}

function personalSettingsScreen() {
  const toggle = (key, label, note) => {
    const input = h('input', { attrs: { type: 'checkbox' }, on: { change: (event) => updatePersonalSettings(key, event.target.checked) } });
    input.checked = state.personalSpace.settings[key] !== false;
    return h('label', { className: 'personal-setting-row' }, h('span', {}, h('strong', { text: label }), h('small', { text: note })), input);
  };
  return shell([
    screenHeader('Память и приватность', 'Вы управляете всеми сохранёнными данными', 'space'),
    MysticCard({ className: 'personal-settings-card', children: [
      toggle('memoryEnabled', 'Память Эзотериума', 'Связывает новые консультации с важными деталями прошлых бесед.'),
      toggle('morningEnabled', 'Утренний настрой', 'После 06:00 предлагает выбрать от трёх до пяти главных дел.'),
      toggle('eveningEnabled', 'Вечерняя рефлексия', 'После 20:00 появляется только при заполненном утре.')
    ] }),
    MysticCard({ className: 'personal-settings-card experience-settings-card', children: [
      experienceToggle('sound', 'Звуки прикосновений', 'Тихие короткие сигналы без фоновой музыки.'),
      experienceToggle('atmosphere', 'Визуальная атмосфера', 'Туман, частицы и мягкое свечение тематических миров.'),
      field('Движение', selectField({ auto: { label: 'Системное' }, full: { label: 'Полное' }, reduced: { label: 'Минимальное' } }, state.experience.motion, (value) => updateExperienceSetting('motion', value))),
      field('Качество графики', selectField({ auto: { label: 'Автоматически' }, high: { label: 'Высокое · 60 fps' }, standard: { label: 'Стандартное' }, lite: { label: 'Лёгкое · 30 fps' } }, state.experience.quality, (value) => updateExperienceSetting('quality', value)))
    ] }),
    MysticCard({ children: [h('small', { className: 'premium-kicker', text: 'ВАШ ТАРИФ' }), h('h3', { text: String(state.personalSpace.settings.plan || 'free').toLocaleUpperCase(state.locale) }), h('p', { text: 'События, цели, задачи и локальная энергия дня доступны уже сейчас.' })] }),
    MysticButton({ text: 'Экспортировать мои данные', icon: 'history', variant: 'secondary', onClick: exportPersonalSpace }),
    h('button', { className: 'personal-danger-link', attrs: { type: 'button' }, on: { click: clearPersonalSpace }, text: 'Удалить все данные «Моего пути»' }),
    h('p', { className: 'premium-info-note', text: 'После удаления серверные события, цели, задачи и ритуалы нельзя восстановить.' })
  ], { active: 'home' });
}

function experienceToggle(key, label, note) {
  const input = h('input', { attrs: { type: 'checkbox' }, on: { change: (event) => updateExperienceSetting(key, event.target.checked) } });
  input.checked = state.experience[key] !== false;
  return h('label', { className: 'personal-setting-row' }, h('span', {}, h('strong', { text: label }), h('small', { text: note })), input);
}

function updateExperienceSetting(key, value) {
  state.experience[key] = value;
  writeJSON(EXPERIENCE_SETTINGS_KEY, state.experience);
  configureVisualQuality();
  render();
}

const PATH_CONSULTATION_QUESTIONS = Object.freeze([
  ['focus', 'Что сейчас занимает больше всего внимания?', 'Назовите одну ситуацию, решение или внутреннее напряжение.'],
  ['facts', 'Какие факты уже точно известны?', 'Отделите наблюдаемое от предположений и ожиданий.'],
  ['feeling', 'Что вы чувствуете, когда думаете об этом?', 'Можно коротко: тревога, интерес, усталость, надежда, злость…'],
  ['desired', 'Какой результат был бы для вас живым и честным?', 'Не идеальный исход, а тот, с которым можно двигаться дальше.'],
  ['barrier', 'Что сейчас мешает сделать первый шаг?', 'Внешнее ограничение, страх, нехватка знания или конфликт ценностей.'],
  ['resource', 'На что вы уже можете опереться?', 'Люди, опыт, время, навык, деньги или внутренняя устойчивость.']
]);

function personalConsultationScreen() {
  const step = state.personalSpace.consultationStep;
  const result = state.personalSpace.consultationResult;
  if (result) {
    return shell([
      screenHeader('Рекомендация Эзотериума', 'Сохранена в вашем пути', 'space'),
      h('section', { className: 'path-consultation-result' }, h('span', { text: '✦' }), h('p', { className: 'premium-kicker', text: 'ЛИЧНЫЙ ОРИЕНТИР' }), h('h1', { text: result.title || 'Ваш следующий ясный шаг' }), formatReading(result.body)),
      h('div', { className: 'personal-quick-actions' },
        h('button', { attrs: { type: 'button' }, on: { click: () => { state.tarotQuestion = PATH_CONSULTATION_QUESTIONS.map(([id]) => state.personalSpace.consultationAnswers[id]).filter(Boolean).join('. '); navigate('tarot'); } } }, Icon('sparkle', { size: 20 }), h('span', {}, h('strong', { text: 'Таро' }), h('small', { text: 'Увидеть архетип' }))),
        h('button', { attrs: { type: 'button' }, on: { click: () => { state.runeQuestion = state.personalSpace.consultationAnswers.focus || ''; state.runeView = 'spreads'; navigate('runes'); } } }, h('b', { text: 'ᛉ' }), h('span', {}, h('strong', { text: 'Руны' }), h('small', { text: 'Найти действие' }))),
        h('button', { attrs: { type: 'button' }, on: { click: () => navigate('natal-result') } }, Icon('orbit', { size: 20 }), h('span', {}, h('strong', { text: 'Карта' }), h('small', { text: 'Сверить профиль' })))
      ),
      MysticButton({ text: 'Новая консультация', icon: 'send', variant: 'outline', onClick: resetPathConsultation })
    ], { active: 'home' });
  }
  if (step === 0) {
    return shell([
      screenHeader('Спросить Эзотериума', 'Шесть вопросов вместо общего совета', 'space'),
      h('section', { className: 'path-consultation-intro' }, h('span', { text: '✦' }), h('p', { className: 'premium-kicker', text: 'ТИХАЯ КОНСУЛЬТАЦИЯ' }), h('h1', { text: 'Сначала я помогу вам точно назвать ситуацию.' }), h('p', { text: 'Шесть коротких ответов соединятся с целями, ближайшими событиями, энергией дня и сохранённой памятью. После этого появится конкретная рекомендация.' })),
      MysticButton({ text: 'Начать разговор', icon: 'send', variant: 'primary', onClick: () => { state.personalSpace.consultationStep = 1; render(); } })
    ], { active: 'home' });
  }
  const question = PATH_CONSULTATION_QUESTIONS[step - 1];
  if (!question) return personalSpaceScreen();
  const [id, title, hint] = question;
  return shell([
    screenHeader('Спросить Эзотериума', `Вопрос ${step} из ${PATH_CONSULTATION_QUESTIONS.length}`, 'space'),
    h('section', { className: 'path-consultation-question' },
      h('div', { className: 'amur-quiz-progress' }, h('span', { style: { width: `${step / PATH_CONSULTATION_QUESTIONS.length * 100}%` } })),
      h('small', { text: `0${step}` }), h('h1', { text: title }), h('p', { text: hint }),
      field('Ваш ответ', textarea({ value: state.personalSpace.consultationAnswers[id] || '', placeholder: 'Можно ответить своими словами…', maxLength: 1000, onInput: (value) => { state.personalSpace.consultationAnswers[id] = value; } }))
    ),
    h('div', { className: 'personal-space-actions' },
      MysticButton({ text: 'Назад', icon: 'arrow-left', variant: 'outline', onClick: () => { state.personalSpace.consultationStep = Math.max(0, step - 1); render(); } }),
      MysticButton({ text: state.busy ? 'Собираю смысл…' : step === PATH_CONSULTATION_QUESTIONS.length ? 'Получить рекомендацию' : 'Продолжить', icon: 'sparkle', variant: 'primary', disabled: state.busy, onClick: submitPathConsultationStep })
    )
  ], { active: 'home' });
}

async function submitPathConsultationStep() {
  const step = state.personalSpace.consultationStep;
  const question = PATH_CONSULTATION_QUESTIONS[step - 1];
  if (!question || String(state.personalSpace.consultationAnswers[question[0]] || '').trim().length < 3) return notify('Добавьте хотя бы одну ясную мысль');
  if (step < PATH_CONSULTATION_QUESTIONS.length) { state.personalSpace.consultationStep += 1; pulse(); render(); return; }
  state.busy = true; render();
  try {
    const context = {
      answers: state.personalSpace.consultationAnswers,
      goals: state.personalSpace.goals.filter((goal) => goal.status === 'active').slice(0, 5),
      events: nextPersonalEvents(state.personalSpace.events, new Date(), 5),
      energy: dailyEnergy(),
      natal: state.profile.natalChart || null
    };
    const answer = await requestReading('path_consultation', context);
    const entry = { id: uniqueId('path'), kind: 'path', type: 'Мой путь', title: state.personalSpace.consultationAnswers.focus.slice(0, 100), body: String(answer), input: context, createdAt: new Date().toISOString(), favorite: false };
    state.personalSpace.consultationResult = entry;
    state.personalSpace.consultations.push(entry);
    persistPersonalSpace();
    await saveCloudReading(entry, { subtype: 'path-consultation', input: context });
    personalStore('upsert_path_consultation', { consultation: { ...entry, answers: state.personalSpace.consultationAnswers } }).catch(() => {});
    personalStore('save_esoterium_turn', { consultationId: entry.id, mode: 'planning', stage: 'recommendation', title: entry.title, summary: entry.body.slice(0, 1000), messages: [], memory: `Важный вопрос пути: ${entry.title}` }).catch(() => {});
  } catch (error) { notify(apiErrorMessage(error)); }
  finally { state.busy = false; render(); }
}

function resetPathConsultation() {
  state.personalSpace.consultationStep = 0;
  state.personalSpace.consultationAnswers = {};
  state.personalSpace.consultationResult = null;
  render();
}

async function updatePersonalSettings(key, value) {
  state.personalSpace.settings[key] = value; persistPersonalSpace();
  try { await personalStore('save_space_preferences', { settings: state.personalSpace.settings }); } catch { notify('Настройка сохранена на устройстве'); }
}

function exportPersonalSpace() {
  const data = JSON.stringify({ exportedAt: new Date().toISOString(), ...state.personalSpace, eventDraft: undefined, goalDraft: undefined, taskDraft: undefined }, null, 2);
  const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = `nastardamus-personal-space-${personalDateKey()}.json`; link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 500); notify('Экспорт подготовлен');
}

async function clearPersonalSpace() {
  if (!window.confirm('Удалить все события, цели, задачи и дневные итоги без возможности восстановления?')) return;
  try {
    await personalStore('clear_personal_space');
    state.personalSpace.events = []; state.personalSpace.goals = []; state.personalSpace.tasks = []; state.personalSpace.projects = []; state.personalSpace.habits = []; state.personalSpace.consultations = []; state.personalSpace.checkins = [];
    persistPersonalSpace(); navigate('space', { replace: true }); notify('Личное пространство очищено');
  } catch (error) { notify(apiErrorMessage(error)); }
}

function homeScreen() {
  const wallet = state.wallet?.wallet || { freeSpins: 0 };
  const header = h('header', { className: 'premium-home-header' }, BrandLogo(),
    h('div', { className: 'premium-home-header__tools' },
      celestialClock(),
      h('button', { className: 'premium-avatar-button', attrs: { type: 'button', 'aria-label': 'Открыть профиль' }, on: { click: () => navigate('profile') } },
        h('img', { attrs: { src: profileAvatar(), alt: '' } })
      )
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
      className: 'personal-space-entry', attrs: { type: 'button' },
      on: { click: () => { navigate('space'); loadPersonalSpace(); } }
    },
    h('span', { className: 'personal-space-entry__sigil', text: '✦' }),
    h('span', {},
      h('small', { text: 'ВАШЕ ЛИЧНОЕ ПРОСТРАНСТВО' }),
      h('strong', { text: 'Личное пространство Эзотериума' }),
      h('span', { text: 'Энергия дня, события, цели и ваш живой ритм.' })
    ),
    h('b', { text: 'Открыть →' })),
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
      homePracticeCard('tarot-deck', 'Таро', 'Полная колода · 78 арканов', 'tarot'),
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
      h('div', { className: 'sports-observatory', attrs: { 'aria-hidden': 'true' } },
        h('span', { className: 'sports-observatory__moon' }),
        h('span', { className: 'sports-observatory__pitch' }, h('i'), h('i'), h('i')),
        h('span', { className: 'sports-observatory__arc' })
      ),
      h('div', { className: 'sports-observatory__copy' },
        h('p', { className: 'premium-kicker', text: 'ОБСЕРВАТОРИЯ СОБЫТИЙ' }),
        h('h1', { text: 'Момент, когда рисунок матча меняется.' }),
        h('p', { text: 'Ритм, напряжение, точка перелома и честный уровень неопределённости.' })
      )
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
      serviceTile('rune-sanctum', 'Рунический храм', 'Руна дня, расклады до 12 знаков и полный каталог', () => navigate('runes'), serviceBadge('rune_reading', 'Бесплатно')),
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
      h('img', { attrs: { src: premiumArtUrl(artwork), alt: '', draggable: 'false' } }),
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
        h('h2', { text: 'Полная колода из 78 арканов' }),
        h('p', { text: '22 прежних Старших Аркана сохранены, а 56 Младших получили самостоятельные реалистичные сцены в едином тёмно-золотом мире.' })
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
  state.tarotDialogueMessages = [];
  state.tarotDialogueDraft = '';
  state.tarotDialogueSending = false;
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
  state.tarotDialogueMessages = [{
    role: 'assistant',
    content: 'Я удерживаю ваш вопрос рядом с колодой. Перемешайте её, когда почувствуете, что формулировка внутри стала тише и точнее.'
  }];
  state.tarotDialogueDraft = '';
  state.tarotDeck = Array.from(
    { length: Math.max(14, SPREADS[state.spread].count + 8) },
    (_, index) => `closed-${index}`
  );
  pulse('medium');
  navigate('tarot-draw');
  if (!tg?.initData) return;
  try {
    const data = await api('/api/proxy', {
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

async function beginTarotSelection() {
  if (state.tarotStage === 'shuffling') return;
  state.tarotStage = 'shuffling';
  pulse('medium');
  render();
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  await new Promise((resolve) => setTimeout(resolve, reducedMotion ? 260 : 1800));
  if (state.screen !== 'tarot-draw' || state.tarotStage !== 'shuffling') return;
  state.tarotStage = 'select';
  state.tarotDialogueMessages.push({
    role: 'assistant',
    content: 'Колода собрана. Выбирайте не самую красивую карту, а ту, возле которой взгляд задержался без причины.'
  });
  pulse();
  render();
}

function tarotDrawScreen() {
  const spread = SPREADS[state.spread] || SPREADS['past-present-future'];
  if (state.tarotStage === 'shuffle' || state.tarotStage === 'shuffling') {
    const shuffling = state.tarotStage === 'shuffling';
    return shell([
      screenHeader(spread.label, 'Подготовка колоды', 'tarot-question'),
      h('section', { className: `premium-shuffle-ritual ${shuffling ? 'is-shuffling' : ''}` },
        h('span', { className: 'premium-ritual-orbit', attrs: { 'aria-hidden': 'true' } }),
        h('div', { className: 'premium-deck-stack', attrs: { 'aria-label': 'Закрытая колода Таро' } },
          h('img', { attrs: { src: '/images/card-back.webp', alt: 'Рубашка колоды Таро' } }),
          h('img', { attrs: { src: '/images/card-back.webp', alt: '' } }),
          h('img', { attrs: { src: '/images/card-back.webp', alt: '' } })
        ),
        h('p', { text: shuffling ? 'Карты меняют порядок. Не торопите движение.' : 'Удерживайте вопрос в мыслях. Колода откроет карты только по одной.' })
      ),
      tarotDialoguePanel(spread, { compact: true }),
      MysticButton({ text: shuffling ? 'Колода в движении…' : 'Перемешать колоду', icon: 'sparkle', variant: 'primary', disabled: shuffling, onClick: beginTarotSelection })
    ], { tabs: false });
  }

  const cards = h('div', { className: 'premium-tarot-grid' }, state.tarotDeck.map((name, index) => {
    const selected = state.tarotCards.includes(name);
    const locked = Boolean(state.revealingCard) || state.tarotCards.length >= spread.count;
    return h('button', {
      className: `premium-tarot-card ${selected ? 'is-selected' : ''}`,
      style: { '--tarot-index': index },
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
    tarotDialoguePanel(spread),
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
      const data = await api('/api/proxy', {
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
    state.tarotDialogueMessages.push({
      role: 'assistant',
      content: tarotCardWhisper(name, spread.positions[index] || `Позиция ${index + 1}`, state.tarotCards.length >= spread.count)
    });
    render();
  }, duration);
}

function tarotCardWhisper(name, position, finalCard = false) {
  const meaning = TAROT_CARD_WHISPERS[name] || 'просит задержаться на первом честном впечатлении';
  const ending = finalCard
    ? 'Расклад собран. Если между картами возникло противоречие — спросите меня о нём до итогового толкования.'
    : 'Что в этой позиции задело вас раньше объяснения?';
  return `${position}: «${name}» ${meaning}. ${ending}`;
}

function tarotDialoguePanel(spread, { compact = false } = {}) {
  const messages = state.tarotDialogueMessages.slice(compact ? -1 : -8);
  const canWrite = !compact && state.tarotCards.length > 0;
  const composer = canWrite ? textarea({
    value: state.tarotDialogueDraft,
    placeholder: 'Спросите о карте или скажите, что откликнулось…',
    onInput: (value) => { state.tarotDialogueDraft = value; },
    maxLength: 700
  }) : null;
  return h('section', { className: `tarot-live-dialogue ${compact ? 'is-compact' : ''}`, attrs: { 'aria-label': 'Живой разговор с Эзотериумом' } },
    h('header', {},
      h('span', { className: 'tarot-live-dialogue__seal' }, Icon('sparkle', { size: 19 })),
      h('div', {}, h('strong', { text: 'Эзотериум рядом' }), h('small', { text: compact ? 'Ритуал уже начался' : `${state.tarotCards.length} из ${spread.count} знаков открыто` }))
    ),
    h('div', { className: 'tarot-live-dialogue__messages', attrs: { 'aria-live': 'polite' } },
      messages.map((message) => h('p', { className: `is-${message.role}`, text: message.content })),
      state.tarotDialogueSending ? h('p', { className: 'is-assistant is-thinking' }, h('i'), h('i'), h('i')) : null
    ),
    canWrite ? h('div', { className: 'tarot-live-dialogue__composer' },
      composer,
      h('button', {
        attrs: { type: 'button', 'aria-label': 'Спросить Эзотериума', disabled: state.tarotDialogueSending },
        on: { click: sendTarotDialogueMessage }
      }, Icon('send', { size: 20 }))
    ) : null
  );
}

async function sendTarotDialogueMessage() {
  const message = state.tarotDialogueDraft.trim().replace(/\s+/g, ' ');
  if (message.length < 2) return notify('Напишите вопрос о раскладе');
  if (!state.tarotCards.length || state.tarotDialogueSending) return;
  state.tarotDialogueDraft = '';
  state.tarotDialogueMessages.push({ role: 'user', content: message });
  state.tarotDialogueSending = true;
  render();
  try {
    let answer;
    if (tg?.initData && state.tarotSessionId) {
      const data = await api('/api/proxy', {
        method: 'POST',
        body: { action: 'tarot_dialogue_send', readingId: state.tarotSessionId, message }
      });
      answer = data.answer;
    } else {
      await new Promise((resolve) => setTimeout(resolve, 520));
      const lastCard = state.tarotCards.at(-1);
      answer = `Сейчас сильнее всего звучит «${lastCard}»: ${TAROT_CARD_WHISPERS[lastCard]}. Сопоставьте это не с желаемым исходом, а с тем фактом, который вы до сих пор обходили.`;
    }
    state.tarotDialogueMessages.push({ role: 'assistant', content: answer });
    pulse();
  } catch (error) {
    state.tarotDialogueMessages.push({ role: 'assistant', content: 'Связь на мгновение ослабла. Карты сохранены — повторите вопрос, не начиная расклад заново.' });
  } finally {
    state.tarotDialogueSending = false;
    render();
  }
}

async function submitTarot() {
  if (state.busy) return;
  const spread = SPREADS[state.spread];
  const serviceId = spread.serviceId || 'tarot';
  if (!confirmServicePayment(serviceId)) return;
  state.busy = true;
  render();
  try {
    const answer = await requestReading('tarot', {
      question: state.tarotQuestion.trim(), cards: state.tarotCards, spread: state.spread,
      positions: spread.positions, dialogue: state.tarotDialogueMessages
    }, serviceId);
    state.result = {
      id: uniqueId('tarot'), kind: 'tarot', spread: state.spread, positions: [...spread.positions],
      type: `Расклад «${spread.label}»`, title: state.tarotQuestion.trim(), body: answer,
      cards: [...state.tarotCards], dialogue: [...state.tarotDialogueMessages], createdAt: new Date().toISOString(), favorite: false
    };
    await saveCloudReading(state.result, {
      readingId: state.tarotSessionId,
      subtype: state.spread,
      input: { question: state.tarotQuestion.trim(), cards: state.tarotCards, positions: spread.positions, dialogue: state.tarotDialogueMessages }
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
  if (state.natalStage === 'intro') {
    return shell([
      screenHeader('Натальная карта', 'Ваш личный небесный механизм', 'services'),
      h('section', { className: 'natal-portal' },
        h('span', { className: 'natal-portal__orbit', attrs: { 'aria-hidden': 'true' } }, h('i'), h('i'), h('i')),
        h('div', {},
          h('p', { className: 'premium-kicker', text: 'КОСМИЧЕСКИЙ ОТПЕЧАТОК' }),
          h('h1', { text: 'Не прогноз. Карта вашего исходного неба.' }),
          h('p', { text: 'Она покажет, где вы действуете легко, где учитесь близости и какой путь требует зрелости.' })
        )
      ),
      MysticButton({ text: 'Открыть мою карту', icon: 'orbit', variant: 'primary', onClick: () => { state.natalStage = 'data'; pulse('medium'); render(); } })
    ]);
  }
  const date = textInput({ type: 'date', value: state.natalDate, onInput: (value) => { state.natalDate = value; } });
  const time = textInput({ type: 'time', value: state.natalTime, attrs: { disabled: state.natalTimeKnown ? null : true }, onInput: (value) => { state.natalTime = value; state.natalTimeKnown = true; } });
  const place = textInput({ value: state.natalPlace, placeholder: 'Город рождения', attrs: { maxlength: 120, autocomplete: 'address-level2' }, onInput: (value) => { state.natalPlace = value; } });
  return shell([
    screenHeader('Данные рождения', 'Один раз — для всех персональных модулей', 'natal'),
    state.busy ? natalBuildingStage() : MysticCard({ className: 'premium-form-card natal-data-form', children: [
      field('Дата рождения', date),
      field('Время рождения', time),
      h('button', { className: `initiation-unknown-time ${state.natalTimeKnown ? '' : 'is-active'}`, attrs: { type: 'button', 'aria-pressed': state.natalTimeKnown ? 'false' : 'true' }, on: { click: () => { state.natalTimeKnown = !state.natalTimeKnown; render(); } } }, 'Точное время неизвестно'),
      field('Место рождения', place, 'Если место неизвестно, карта будет частичной.')
    ] }),
    state.busy ? null : MysticButton({ text: 'Построить натальную карту', icon: 'orbit', variant: 'primary', onClick: submitNatal })
  ]);
}

function natalBuildingStage() {
  return h('section', { className: 'natal-building', attrs: { 'aria-live': 'polite' } },
    h('div', { className: 'natal-building__chart', attrs: { 'aria-hidden': 'true' } },
      h('span', { className: 'is-zodiac' }), h('span', { className: 'is-houses' }),
      h('span', { className: 'is-orbit' }), h('i'), h('i'), h('i'), h('i')
    ),
    h('p', { className: 'premium-kicker', text: 'КАРТА СОБИРАЕТСЯ' }),
    h('h2', { text: 'Круг · дома · орбиты · планеты' }),
    h('p', { text: 'Эзотериум соединяет момент и место рождения в один читаемый рисунок.' })
  );
}

async function submitNatal() {
  if (!state.natalDate) return notify('Укажите дату рождения');
  if (!state.natalPlace.trim()) return notify('Укажите место рождения или напишите «не знаю»');
  if (state.busy) return;
  if (!confirmServicePayment('natal')) return;
  state.busy = true; render();
  try {
    const input = {
      name: firstName(), date: state.natalDate,
      time: state.natalTimeKnown ? state.natalTime || '12:00' : 'unknown',
      place: state.natalPlace.trim(), gender: state.userGender,
      partial: !state.natalTimeKnown || state.natalPlace.trim().toLocaleLowerCase('ru-RU') === 'не знаю'
    };
    const chart = buildNatalChart({ date: input.date, time: state.natalTime, timeKnown: state.natalTimeKnown, place: input.place });
    const [answer] = await Promise.all([
      requestReading('natal', input, 'natal'),
      new Promise((resolve) => setTimeout(resolve, window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ? 320 : 5200))
    ]);
    state.result = { id: uniqueId('natal'), kind: 'natal', mode: 'natal', type: 'Натальная карта', title: state.natalDate, body: answer, natalInput: input, natalChart: chart, cards: [], createdAt: new Date().toISOString(), favorite: false };
    state.profile.birthDate = state.natalDate;
    state.profile.birthTime = state.natalTimeKnown ? state.natalTime : '';
    state.profile.birthTimeKnown = state.natalTimeKnown;
    state.profile.city = state.natalPlace.trim();
    state.profile.natalChart = chart;
    writeJSON(PROFILE_KEY, { ...state.profile, gender: state.userGender, natalChart: chart });
    if (tg?.initData) api('/api/preferences', { method: 'POST', body: profilePreferencePayload() }).catch(() => notify('Карта сохранена на устройстве; облачная синхронизация повторится позже'));
    await saveCloudReading(state.result, { subtype: 'natal', input });
    state.natalFocus = 'intuition';
    navigate('natal-result');
  } catch (error) { notify(apiErrorMessage(error)); }
  finally { state.busy = false; render(); }
}

function natalResultScreen() {
  if (!state.result || state.result.kind !== 'natal') return natalScreen();
  const areas = [
    ['intuition', 'Интуиция', 'Луна · Нептун'],
    ['love', 'Любовь', 'Венера · VII дом'],
    ['money', 'Деньги', 'II дом · Юпитер'],
    ['purpose', 'Предназначение', 'Солнце · X дом']
  ];
  const paragraphs = String(state.result.body || '').split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
  const activeIndex = Math.max(0, areas.findIndex(([id]) => id === state.natalFocus));
  const active = areas[activeIndex];
  const detail = paragraphs[activeIndex] || paragraphs[0] || 'Эзотериум ещё собирает подробный смысл этого сектора.';
  return shell([
    screenHeader('Ваша натальная карта', state.result.natalInput?.partial ? 'Частичная карта · данные можно уточнить' : 'Полная карта рождения', 'natal'),
    natalChartVisual(state.result.natalChart),
    natalPlacementsPanel(state.result.natalChart),
    h('section', { className: 'natal-profile-panel' },
      h('p', { className: 'premium-kicker', text: 'ВАШ ПРОФИЛЬ' }),
      h('div', { className: 'natal-area-grid' }, areas.map(([id, title, caption], index) => h('button', {
        className: state.natalFocus === id ? 'is-active' : '',
        attrs: { type: 'button', 'aria-pressed': state.natalFocus === id ? 'true' : 'false' },
        on: { click: () => { state.natalFocus = id; pulse(); render(); } }
      }, h('span', { text: String(index + 1).padStart(2, '0') }), h('strong', { text: title }), h('small', { text: caption })))
      )
    ),
    MysticCard({ className: 'natal-detail', children: [
      h('small', { text: active[2] }), h('h2', { text: active[1] }), h('p', { text: detail })
    ] }),
    MysticButton({ text: 'Сохранить карту', icon: 'save', variant: 'gold', onClick: () => saveResult(state.result) })
  ], { tabs: false });
}

function natalChartVisual(value) {
  const chart = value?.planets ? value : buildNatalChart({ date: state.natalDate, time: state.natalTime, timeKnown: state.natalTimeKnown, place: state.natalPlace });
  const svg = natalSvgMarkup(chart);
  return h('section', { className: 'natal-chart-shell' },
    h('div', { className: 'natal-chart-meta' },
      h('span', {}, h('small', { text: 'ТОЧНОСТЬ' }), h('strong', { text: chart.accuracy === 'partial' ? 'Частичная' : 'По времени рождения' })),
      h('span', {}, h('small', { text: 'АСЦЕНДЕНТ' }), h('strong', { text: `${Math.floor(chart.ascendant)}°` }))
    ),
    h('div', { className: 'natal-chart-visual', attrs: { 'aria-label': 'Натальная карта: знаки, дома, планеты и аспекты', role: 'img' }, style: { '--natal-zoom': state.natalZoom } },
      h('div', { className: 'natal-chart-visual__canvas', html: svg })
    ),
    h('label', { className: 'natal-zoom-control' }, h('span', { text: 'Масштаб карты' }), (() => {
      const input = h('input', { attrs: { type: 'range', min: .82, max: 1.35, step: .01, value: state.natalZoom, 'aria-label': 'Масштаб натальной карты' }, on: { input: (event) => { state.natalZoom = Number(event.target.value); document.querySelector('.natal-chart-visual')?.style.setProperty('--natal-zoom', state.natalZoom); } } });
      return input;
    })())
  );
}

function natalSvgMarkup(chart) {
  const lines = chart.houses.map((house) => {
    const point = polarPoint(house.cusp, 137);
    const label = polarPoint(house.cusp + 15, 117);
    return `<line class="house-line" x1="160" y1="160" x2="${point.x.toFixed(2)}" y2="${point.y.toFixed(2)}"/><text class="house-label" x="${label.x.toFixed(2)}" y="${label.y.toFixed(2)}">${house.number}</text>`;
  }).join('');
  const zodiac = chart.zodiac.map((sign) => {
    const point = polarPoint(sign.start + 15, 146);
    return `<text class="zodiac-label" x="${point.x.toFixed(2)}" y="${point.y.toFixed(2)}">${sign.glyph}</text>`;
  }).join('');
  const byName = Object.fromEntries(chart.planets.map((planet) => [planet.name, planet]));
  const aspects = chart.aspects.map((aspect) => {
    const first = polarPoint(byName[aspect.from].longitude, 82);
    const second = polarPoint(byName[aspect.to].longitude, 82);
    const tone = ['тригон', 'секстиль'].includes(aspect.type) ? 'is-soft' : ['квадрат', 'оппозиция'].includes(aspect.type) ? 'is-tense' : 'is-union';
    return `<line class="aspect-line ${tone}" x1="${first.x.toFixed(2)}" y1="${first.y.toFixed(2)}" x2="${second.x.toFixed(2)}" y2="${second.y.toFixed(2)}"/>`;
  }).join('');
  const planets = chart.planets.map((planet, index) => {
    const radius = 91 + (index % 2) * 9;
    const point = polarPoint(planet.longitude, radius);
    return `<g class="planet-mark" style="--planet-delay:${(index * .18 + 1.9).toFixed(2)}s"><circle cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="10"/><text x="${point.x.toFixed(2)}" y="${point.y.toFixed(2)}">${planet.glyph}</text></g>`;
  }).join('');
  return `<svg viewBox="0 0 320 320" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><radialGradient id="natalCore"><stop offset="0" stop-color="#6d477d" stop-opacity=".55"/><stop offset="1" stop-color="#080d18" stop-opacity="0"/></radialGradient></defs><circle class="natal-aura" cx="160" cy="160" r="157"/><circle class="natal-ring is-outer" cx="160" cy="160" r="137"/><circle class="natal-ring is-zodiac" cx="160" cy="160" r="121"/><circle class="natal-ring is-inner" cx="160" cy="160" r="82"/>${lines}${zodiac}<g class="aspect-web">${aspects}</g>${planets}<circle class="natal-core" cx="160" cy="160" r="45" fill="url(#natalCore)"/><text class="natal-core-glyph" x="160" y="160">✦</text></svg>`;
}

function natalPlacementsPanel(chart) {
  if (!chart?.planets?.length) return null;
  return h('details', { className: 'natal-placements' },
    h('summary', {}, h('span', {}, h('strong', { text: 'Положения планет' }), h('small', { text: `${chart.planets.length} планет · ${chart.aspects.length} аспектов` })), h('b', { text: '+' })),
    h('div', { className: 'natal-placement-grid' }, chart.planets.map((planet) => h('div', {}, h('b', { text: planet.glyph }), h('span', {}, h('strong', { text: planet.name }), h('small', { text: `${planet.sign} · ${planet.degree.toFixed(1)}°` }))))),
    chart.accuracy === 'partial' ? h('p', { className: 'premium-info-note', text: 'Без точного времени дома и асцендент показаны как ориентир. Положения можно пересчитать после уточнения данных.' }) : null
  );
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
    if (state.publicConfig.palmLinkEnabled !== true) return notify('Совместимость по ладоням временно отключена администратором');
    return openOracleRoomCreator('pair');
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

function drawCanvasImageCover(context, image, x, y, width, height) {
  const sourceWidth = Number(image.naturalWidth || image.width) || width;
  const sourceHeight = Number(image.naturalHeight || image.height) || height;
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const cropWidth = width / scale;
  const cropHeight = height / scale;
  const sourceX = Math.max(0, (sourceWidth - cropWidth) / 2);
  const sourceY = Math.max(0, (sourceHeight - cropHeight) / 2);
  context.drawImage(image, sourceX, sourceY, cropWidth, cropHeight, x, y, width, height);
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
    const generated = await requestReading(feature, payload, feature, { structured: true });
    const answer = generated.answer;
    const structured = generated.result;
    const visualProfiles = Array.isArray(structured?.visualProfiles) ? structured.visualProfiles : [];
    state.result = {
      id: uniqueId(feature), kind: pair ? 'compatibility' : 'photo', mode: pair ? 'photo' : damage ? 'damage' : 'energy',
      type: pair ? 'Совместимость по фото' : damage ? 'Разбор Эзотериума' : 'Энергетический след',
      title: pair
        ? `${state.photoNameOne || 'Первый человек'} и ${state.photoNameTwo || 'Второй человек'}`
        : state.photoConcern || 'Символическое фото-чтение',
      body: answer, result: structured || {}, visualProfile: structured?.visualProfile || null,
      cards: [], createdAt: new Date().toISOString(), favorite: false,
      score: pair ? structured.score : null,
      aspects: pair ? structured.aspects : [],
      participants: pair ? [
        { name: state.photoNameOne || 'Первый человек', gender: normalizeGender(visualProfiles[0]?.profile?.perceivedGender), note: 'Первый образ' },
        { name: state.photoNameTwo || 'Второй человек', gender: normalizeGender(visualProfiles[1]?.profile?.perceivedGender), note: 'Второй образ' }
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
    : resultScreen({
        title: state.result.type,
        subtitle: 'Личный ответ Эзотериума',
        back,
        result: state.result,
        contextCards: state.result.visualProfile ? [visualProfileCard(state.result.visualProfile)] : []
      });
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
    screenHeader('Кабинет хироманта', intro ? 'Личный, парный или групповой разговор' : 'Разговор с Эзотериумом', 'services'),
    intro ? palmRoomEntrySection() : null,
    intro ? GlowDivider() : null,
    intro ? SectionTitle({ text: 'Разовое чтение по одной ладони' }) : null,
    intro ? h('section', { className: 'palm-cabinet-intro' },
      h('div', { className: 'palm-cabinet-intro__hand', attrs: { 'aria-hidden': 'true' } },
        h('span', { className: 'is-life' }),
        h('span', { className: 'is-heart' }),
        h('span', { className: 'is-mind' }),
        h('i', { text: '✦' })
      ),
      h('div', {},
        h('p', { className: 'premium-kicker', text: 'КАБИНЕТ ХИРОМАНТА' }),
        h('h1', { text: 'Сначала — ладонь. Затем — честный разговор.' }),
        h('p', { text: 'Эзотериум сверит видимые линии с вашей ситуацией и прямо отметит то, чего на снимке не видно.' })
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
    const created = await api('/api/proxy', {
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
      await api('/api/proxy', {
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
    api('/api/proxy', {
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
      api('/api/proxy', {
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

const PALM_RELATIONSHIP_TYPES = {
  love: { label: 'Любовь', art: 'love.png', thought: 'Между нами есть то, что стоит услышать.' },
  friendship: { label: 'Дружба', art: 'friendship.png', thought: 'Настоящая близость выдерживает честный разговор.' },
  family: { label: 'Семья', art: 'family.webp', thought: 'Наши корни сильнее старых разногласий.' },
  business: { label: 'Деловой союз', art: 'business.png', thought: 'Общее дело начинается с ясности между нами.' },
  creative: { label: 'Творческий союз', art: 'creative.png', thought: 'Две искры способны зажечь один замысел.' },
  other: { label: 'Другая связь', art: 'other.webp', thought: 'Не каждой связи сразу нужно давать имя.' }
};

const INVITATION_GOALS = {
  love: PALM_RELATIONSHIP_TYPES.love,
  friendship: PALM_RELATIONSHIP_TYPES.friendship,
  business: PALM_RELATIONSHIP_TYPES.business,
  creative: PALM_RELATIONSHIP_TYPES.creative
};

function invitationArtworkUrl(category = 'love') {
  const item = PALM_RELATIONSHIP_TYPES[category]
    || (category === 'group' ? { art: 'group.webp' } : PALM_RELATIONSHIP_TYPES.other);
  return `/images/invites/${item.art}`;
}

function invitationThought(category = 'love') {
  return (PALM_RELATIONSHIP_TYPES[category] || PALM_RELATIONSHIP_TYPES.other).thought;
}

const PALM_PREPARATION_QUESTIONS = {
  connection: 'Что сильнее всего соединяет вас сейчас?',
  tension: 'Где между вами чаще возникает напряжение или недосказанность?',
  future: 'Какого будущего вы в глубине души хотите для этой связи?',
  personalQuestion: 'Какой личный вопрос вы хотите доверить Эзотериуму?'
};

const PALM_ROOM_MODES = {
  solo: {
    title: 'Личный разговор',
    short: 'Один на один',
    description: 'Постоянный чат с Эзотериумом о ладони, жизни и важных решениях.',
    defaultTitle: 'Мой разговор с Эзотериумом',
    icon: 'hand'
  },
  pair: {
    title: 'Разговор для двоих',
    short: 'Совместимость',
    description: 'Две ладони, общий чат и прямые вопросы об отношениях друг с другом.',
    defaultTitle: 'Путь двух судеб',
    icon: 'heart'
  },
  group: {
    title: 'Групповой круг',
    short: '3–6 человек',
    description: 'Общая практика для друзей, семьи или команды: отношения, характеры и поиск согласия.',
    defaultTitle: 'Круг взаимопонимания',
    icon: 'profile'
  }
};

function palmRoomEntrySection() {
  return h('section', { className: 'palm-room-entry' },
    h('div', { className: 'palm-room-entry__head' },
      h('p', { className: 'premium-kicker', text: 'ЖИВОЙ РАЗГОВОР С ЭЗОТЕРИУМОМ' }),
      h('h2', { text: 'Выберите, кто будет в комнате' }),
      h('p', { text: 'Сообщения сохраняются, а участники могут возвращаться к разговору в удобное время.' })
    ),
    h('div', { className: 'palm-room-mode-grid' },
      Object.entries(PALM_ROOM_MODES).map(([mode, item]) => h('button', {
        className: `palm-room-mode is-${mode}`,
        attrs: { type: 'button' },
        on: { click: () => openOracleRoomCreator(mode) }
      },
      h('span', { className: 'palm-room-mode__icon' }, Icon(item.icon, { size: 24 })),
      h('span', {}, h('strong', { text: item.title }), h('small', { text: item.description })),
      h('b', { text: item.short })
      ))
    ),
    h('button', {
      className: 'palm-room-history-link',
      attrs: { type: 'button' },
      on: { click: () => { navigate('palm-rooms'); loadOracleRooms({ force: true }); } }
    }, Icon('history', { size: 19 }), h('span', { text: 'Мои комнаты и приглашения' }))
  );
}

function openOracleRoomCreator(mode) {
  const normalized = PALM_ROOM_MODES[mode] ? mode : 'solo';
  if (normalized !== 'solo' && state.publicConfig.jointReadingsEnabled === false) {
    return notify('Совместные комнаты временно отключены');
  }
  state.oracleRoomMode = normalized;
  state.oracleRoomDraft = {
    title: PALM_ROOM_MODES[normalized].defaultTitle,
    focus: '',
    maxParticipants: normalized === 'group' ? 6 : normalized === 'pair' ? 2 : 1,
    inviteeName: '',
    inviteeGender: 'unspecified',
    relationshipType: 'love',
    openingQuestion: '',
    relationshipConsent: false,
    adultConfirmed: false
  };
  state.oracleRoomInviteFile = null;
  navigate('palm-room-create');
}

function palmChoiceChips(options, value, onChange, className = '') {
  return h('div', { className: `palm-choice-chips ${className}`.trim() },
    Object.entries(options).map(([key, option]) => h('button', {
      className: `palm-choice-chip ${value === key ? 'is-active' : ''}`,
      attrs: { type: 'button' },
      on: { click: () => { onChange(key); render(); } }
    }, option.label || option))
  );
}

function palmCompatibilityInviteCard(room, { preview = false } = {}) {
  const draft = state.oracleRoomDraft;
  const owner = room?.members?.find((member) => member.role === 'owner');
  const ownerName = owner?.displayName || firstName() || 'Искатель';
  const inviteeName = room?.inviteeName || draft.inviteeName.trim() || 'Второй участник';
  const relationshipType = room?.relationshipType || draft.relationshipType || 'love';
  const relationship = PALM_RELATIONSHIP_TYPES[relationshipType] || PALM_RELATIONSHIP_TYPES.other;
  const question = room?.openingQuestion || draft.openingQuestion.trim();
  return h('section', { className: `palm-live-invite is-${relationshipType} ${preview ? 'is-preview' : ''}` },
    h('img', { className: 'palm-live-invite__art', attrs: { src: invitationArtworkUrl(relationshipType), alt: '', draggable: 'false' } }),
    h('div', { className: 'palm-live-invite__stars', attrs: { 'aria-hidden': 'true' } }, h('i'), h('i'), h('i'), h('i')),
    h('div', { className: 'palm-live-invite__seal' }, Icon('sparkle', { size: 18 }), h('span', { text: 'ПРИГЛАШЕНИЕ ЭЗОТЕРИУМА' })),
    h('div', { className: 'palm-live-invite__hands', attrs: { 'aria-hidden': 'true' } },
      h('img', { className: 'is-left', attrs: { src: premiumArtUrl('palm-left'), alt: '' } }),
      h('span', {}, h('i'), h('b', { text: '✦' }), h('i')),
      h('img', { className: 'is-right', attrs: { src: premiumArtUrl('palm-left'), alt: '' } })
    ),
    h('p', { className: 'palm-live-invite__eyebrow', text: relationship.label }),
    h('h2', { text: `${ownerName} приглашает ${inviteeName}` }),
    h('p', { className: 'palm-live-invite__copy', text: question || relationship.thought }),
    h('small', { text: 'Путь двух судеб · 72 часа' })
  );
}

function oracleCircleInviteCard(room, { preview = false, unavailable = false } = {}) {
  const owner = room?.members?.find((member) => member.role === 'owner');
  const ownerName = owner?.displayName || firstName() || 'Искатель';
  return h('section', { className: `palm-live-invite is-group ${preview ? 'is-preview' : ''}` },
    h('img', { className: 'palm-live-invite__art', attrs: { src: invitationArtworkUrl('group'), alt: '', draggable: 'false' } }),
    h('div', { className: 'palm-live-invite__stars', attrs: { 'aria-hidden': 'true' } }, h('i'), h('i'), h('i'), h('i')),
    h('div', { className: 'palm-live-invite__seal' }, Icon('sparkle', { size: 18 }), h('span', { text: unavailable ? 'ПРИГЛАШЕНИЕ ЗАКРЫТО' : 'КРУГ ЭЗОТЕРИУМА' })),
    h('p', { className: 'palm-live-invite__eyebrow', text: `${room?.participantCount || 1} из ${room?.maxParticipants || 6}` }),
    h('h2', { text: unavailable ? room?.title || 'Круг завершён' : `${ownerName} открывает общий круг` }),
    h('p', { className: 'palm-live-invite__copy', text: unavailable ? 'Этот разговор уже завершён.' : 'Чтобы услышать друг друга, иногда нужен третий голос.' }),
    h('small', { text: unavailable ? 'Попросите новое приглашение' : 'Разговор · ладони · взаимопонимание' })
  );
}

function oracleRoomCreateScreen() {
  const mode = state.oracleRoomMode;
  const meta = PALM_ROOM_MODES[mode] || PALM_ROOM_MODES.solo;
  const draft = state.oracleRoomDraft;
  return shell([
    screenHeader(meta.title, 'Настройте пространство разговора', 'palm-reading'),
    h('section', { className: `palm-room-create-hero is-${mode}` },
      h('img', { attrs: { src: premiumArtUrl('palm-oracle'), alt: '' } }),
      h('div', {}, h('p', { className: 'premium-kicker', text: meta.short.toUpperCase() }), h('h1', { text: meta.title }), h('p', { text: meta.description }))
    ),
    mode === 'pair' ? palmCompatibilityInviteCard(null, { preview: true }) : null,
    MysticCard({ className: 'premium-form-card palm-room-create-form', children: [
      mode === 'pair' ? field('Имя второго участника', textInput({
        value: draft.inviteeName,
        placeholder: 'Кого вы приглашаете?',
        attrs: { maxlength: 80 },
        onInput: (value) => { draft.inviteeName = value; }
      }), 'Имя появится на живой открытке. Личные ответы останутся закрытыми.') : null,
      mode === 'pair' ? field('Пол приглашённого', palmChoiceChips({
        female: { label: 'Женщина' },
        male: { label: 'Мужчина' },
        unspecified: { label: 'Не указывать' }
      }, draft.inviteeGender, (value) => { draft.inviteeGender = value; })) : null,
      mode === 'pair' ? field('Что вас связывает', palmChoiceChips(PALM_RELATIONSHIP_TYPES, draft.relationshipType, (value) => {
        draft.relationshipType = value;
      }, 'is-relationship')) : null,
      field('Название комнаты', textInput({
        value: draft.title,
        placeholder: meta.defaultTitle,
        attrs: { maxlength: 100 },
        onInput: (value) => { draft.title = value; }
      })),
      field('О чём хотите поговорить', textarea({
        value: draft.focus,
        placeholder: mode === 'solo'
          ? 'Например: хочу понять, куда двигаться дальше'
          : 'Например: хотим лучше слышать друг друга и спокойно решить давний спор',
        maxLength: 500,
        onInput: (value) => { draft.focus = value; }
      }), 'Тему можно развивать и менять прямо по ходу разговора.'),
      mode === 'pair' ? field('Главный вопрос для совместного чтения', textarea({
        value: draft.openingQuestion,
        placeholder: 'Например: что ждёт наши отношения и как нам стать ближе?',
        maxLength: 400,
        onInput: (value) => { draft.openingQuestion = value; }
      }), 'Эзотериум начнёт перекрёстный разговор именно с этого вопроса.') : null,
      mode === 'group' ? field('Количество участников', textInput({
        value: draft.maxParticipants,
        type: 'number',
        attrs: { min: 3, max: 6, inputmode: 'numeric' },
        onInput: (value) => { draft.maxParticipants = value; }
      }), 'От 3 до 6 человек вместе с создателем.') : null,
      consentRow(
        mode === 'solo'
          ? 'Я согласен сохранять этот разговор и описание моей ладони в личной комнате.'
          : 'Я согласен участвовать в совместном разборе отношений. Эзотериум использует только то, чем участники поделились в комнате.',
        draft.relationshipConsent,
        (checked) => { draft.relationshipConsent = checked; }
      ),
      mode !== 'solo' ? consentRow(
        'Я подтверждаю совершеннолетие. Каждый приглашённый подтверждает участие отдельно.',
        draft.adultConfirmed,
        (checked) => { draft.adultConfirmed = checked; }
      ) : null
    ] }),
    MysticButton({
      text: state.busy ? 'Открываем комнату…' : 'Открыть комнату',
      icon: 'sparkle',
      variant: 'primary',
      disabled: state.busy,
      onClick: createOracleRoom
    })
  ], { active: 'services' });
}

async function createOracleRoom() {
  if (state.busy) return;
  const draft = state.oracleRoomDraft;
  const title = draft.title.trim().replace(/\s+/g, ' ');
  if (title.length < 3) return notify('Название комнаты должно быть немного подробнее');
  if (state.oracleRoomMode === 'pair' && draft.inviteeName.trim().length < 1) return notify('Укажите имя второго участника');
  if (state.oracleRoomMode === 'pair' && draft.openingQuestion.trim().length < 8) return notify('Добавьте главный вопрос для совместного чтения');
  if (!draft.relationshipConsent) return notify('Подтвердите согласие на участие в разговоре');
  if (state.oracleRoomMode !== 'solo' && !draft.adultConfirmed) return notify('Подтвердите совершеннолетие');
  state.busy = true;
  render();
  try {
    const data = await api('/api/proxy', {
      method: 'POST',
      body: {
        action: 'create_oracle_room',
        mode: state.oracleRoomMode,
        title,
        focus: draft.focus.trim(),
        maxParticipants: Number(draft.maxParticipants) || 6,
        inviteeName: draft.inviteeName.trim(),
        inviteeGender: draft.inviteeGender,
        relationshipType: draft.relationshipType,
        openingQuestion: draft.openingQuestion.trim(),
        relationshipConsent: true,
        adultConfirmed: state.oracleRoomMode === 'solo' ? false : true,
        gender: state.userGender
      }
    });
    state.oracleRoom = data.room;
    syncOracleRoomPreparation(data.room);
    state.oracleRoomToken = data.room?.token || '';
    state.oracleRoomInviteUrl = data.inviteUrl || '';
    state.oracleRoomStatus = 'ready';
    state.oracleRoomError = '';
    const url = new URL(location.href);
    url.searchParams.set('screen', 'palm-room');
    url.searchParams.set('room', state.oracleRoomToken);
    history.replaceState({}, '', url);
    state.screen = 'palm-room';
    pulse('medium');
  } catch (error) {
    state.oracleRoomError = apiErrorMessage(error);
    notify(state.oracleRoomError);
  } finally {
    state.busy = false;
    render();
  }
}

function oracleRoomSummaryCard(room) {
  const meta = PALM_ROOM_MODES[room.mode] || PALM_ROOM_MODES.solo;
  return h('button', {
    className: `oracle-room-summary is-${room.status} is-${room.mode}`,
    attrs: { type: 'button' },
    on: { click: () => openOracleRoom(room.token) }
  },
  h('span', { className: 'oracle-room-summary__icon' }, Icon(meta.icon, { size: 23 })),
  h('span', {},
    h('strong', { text: room.title }),
    h('small', { text: `${meta.short} · ${room.viewerStatus === 'invited' ? 'Вас пригласили' : room.status === 'closed' ? 'Завершена' : 'Открыта'}` })
  ),
  h('time', { text: formatDate(room.lastMessageAt || room.createdAt) })
  );
}

function oracleRoomsScreen() {
  if (state.oracleRoomsStatus === 'idle') queueMicrotask(() => loadOracleRooms());
  return shell([
    screenHeader('Мои комнаты', 'Личные и совместные разговоры', 'palm-reading'),
    h('section', { className: 'oracle-room-list-hero' },
      h('img', { attrs: { src: premiumArtUrl('palm-oracle'), alt: '' } }),
      h('div', {}, h('p', { className: 'premium-kicker', text: 'ПАМЯТЬ РАЗГОВОРОВ' }), h('h1', { text: 'Возвращайтесь с того же места' }))
    ),
    state.oracleRoomsStatus === 'loading' ? loadingCard('Открываем ваши комнаты…') : null,
    state.oracleRoomsStatus === 'error' ? MysticCard({ children: [h('p', { text: state.oracleRoomError || 'Не удалось загрузить комнаты.' })] }) : null,
    state.oracleRoomsStatus === 'ready' ? h('div', { className: 'oracle-room-list' },
      state.oracleRooms.length
        ? state.oracleRooms.map(oracleRoomSummaryCard)
        : h('p', { className: 'personal-empty', text: 'Комнат пока нет. Создайте личный разговор, встречу для двоих или групповой круг.' })
    ) : null,
    h('div', { className: 'oracle-room-new-actions' },
      MysticButton({ text: 'Личная комната', icon: 'hand', variant: 'secondary', onClick: () => openOracleRoomCreator('solo') }),
      MysticButton({ text: 'Для двоих', icon: 'heart', variant: 'secondary', onClick: () => openOracleRoomCreator('pair') }),
      MysticButton({ text: 'Групповой круг', icon: 'profile', variant: 'primary', onClick: () => openOracleRoomCreator('group') })
    )
  ], { active: 'services' });
}

async function loadOracleRooms({ force = false } = {}) {
  if (!tg?.initData || (state.oracleRoomsStatus === 'loading' && !force)) return;
  state.oracleRoomsStatus = 'loading';
  if (state.screen === 'palm-rooms') render();
  try {
    const data = await api('/api/proxy', { method: 'POST', body: { action: 'list_oracle_rooms' } });
    state.oracleRooms = Array.isArray(data.rooms) ? data.rooms : [];
    state.oracleRoomsStatus = 'ready';
  } catch (error) {
    state.oracleRoomsStatus = 'error';
    state.oracleRoomError = apiErrorMessage(error);
  }
  if (state.screen === 'palm-rooms') render();
}

function openOracleRoom(token) {
  if (!/^[a-f0-9]{32}$/.test(String(token || ''))) return notify('Ссылка на комнату повреждена');
  state.oracleRoomToken = token;
  state.oracleRoom = null;
  state.oracleRoomStatus = 'idle';
  state.oracleRoomError = '';
  state.oracleRoomJoinConsent = false;
  state.oracleRoomJoinAdult = false;
  state.oracleRoomMessageDraft = '';
  state.oracleRoomMessageNonce = '';
  state.oracleRoomInviteFile = null;
  state.oracleRoomPalmImage = '';
  state.oracleRoomPalmDescription = '';
  state.oracleRoomPalmConsent = false;
  state.oracleRoomPreparationToken = '';
  state.oracleRoomPreparationEditing = false;
  const url = new URL(location.href);
  url.searchParams.set('screen', 'palm-room');
  url.searchParams.set('room', token);
  history.pushState({}, '', url);
  state.screen = 'palm-room';
  render();
  loadOracleRoom();
}

function oracleRoomSignature(room) {
  const last = room?.messages?.[room.messages.length - 1];
  const preparation = (room?.members || []).map((member) => `${member.telegramId}:${member.preparationStatus}`).join(',');
  return [room?.updatedAt, room?.assistantState, room?.ritualState, room?.viewerStatus, room?.participantCount, preparation, last?.id, last?.content].join('|');
}

function syncOracleRoomPreparation(room) {
  const viewer = room?.viewer;
  if (!viewer || state.oracleRoomPreparationToken === room.token) return;
  state.oracleRoomPreparationToken = room.token;
  state.oracleRoomPalmDescription = viewer.palmDescription || '';
  state.oracleRoomPreparation = {
    dominantHand: viewer.dominantHand && viewer.dominantHand !== 'unspecified' ? viewer.dominantHand : 'right',
    palmSide: viewer.palmSide && viewer.palmSide !== 'unspecified' ? viewer.palmSide : 'right',
    answers: {
      connection: viewer.privateAnswers?.connection || '',
      tension: viewer.privateAnswers?.tension || '',
      future: viewer.privateAnswers?.future || '',
      personalQuestion: viewer.privateAnswers?.personalQuestion || ''
    }
  };
}

async function loadOracleRoom({ silent = false } = {}) {
  if (!tg?.initData || !state.oracleRoomToken || state.oracleRoomLoading) return;
  state.oracleRoomLoading = true;
  if (!silent) {
    state.oracleRoomStatus = 'loading';
    if (state.screen === 'palm-room') render();
  }
  const before = oracleRoomSignature(state.oracleRoom);
  try {
    const data = await api('/api/proxy', {
      method: 'POST',
      body: { action: 'get_oracle_room', roomToken: state.oracleRoomToken }
    });
    state.oracleRoom = data.room;
    syncOracleRoomPreparation(data.room);
    state.oracleRoomInviteUrl = data.inviteUrl || state.oracleRoomInviteUrl;
    state.oracleRoomStatus = 'ready';
    state.oracleRoomError = '';
    const after = oracleRoomSignature(state.oracleRoom);
    if (state.screen === 'palm-room' && (!silent || before !== after)) render();
  } catch (error) {
    state.oracleRoomStatus = 'error';
    state.oracleRoomError = apiErrorMessage(error);
    if (state.screen === 'palm-room' && !silent) render();
  } finally {
    state.oracleRoomLoading = false;
  }
}

function oracleRoomJoinView(room) {
  const meta = PALM_ROOM_MODES[room.mode] || PALM_ROOM_MODES.pair;
  const unavailable = room.status !== 'active' || Date.parse(room.inviteExpiresAt || '') <= Date.now();
  return shell([
    screenHeader('Приглашение', meta.title, 'palm-reading'),
    room.mode === 'pair'
      ? palmCompatibilityInviteCard(room)
      : oracleCircleInviteCard(room, { unavailable }),
    !unavailable ? h('div', { className: 'palm-invite-instruction' },
      h('strong', { text: 'Что произойдёт после входа' }),
      h('ol', {},
        h('li', {}, h('b', { text: '01' }), h('span', {}, h('strong', { text: 'Закрытая подготовка' }), h('small', { text: 'Вы выберете ведущую руку, добавите ладонь и ответите на личные вопросы.' }))),
        h('li', {}, h('b', { text: '02' }), h('span', {}, h('strong', { text: 'Ожидание второго участника' }), h('small', { text: 'Создатель увидит только ваш статус готовности — не ответы и не фотографию.' }))),
        h('li', {}, h('b', { text: '03' }), h('span', {}, h('strong', { text: 'Перекрёстный диалог' }), h('small', { text: 'Когда все готовы, Эзотериум откроет чтение совместимости и общий разговор.' })))
      )
    ) : null,
    unavailable ? MysticCard({ className: 'oracle-room-consent-card', children: [
      h('strong', { text: 'Войти в эту комнату уже нельзя' }),
      h('p', { text: 'Попросите создателя открыть новый круг и прислать свежее приглашение.' })
    ] }) : MysticCard({ className: 'oracle-room-consent-card', children: [
      h('strong', { text: 'Перед входом' }),
      h('p', { text: 'Личные ответы и фотография ладони остаются закрытыми. После готовности всех Эзотериум использует их бережно, не цитируя другому участнику дословно.' }),
      consentRow(
        'Я добровольно участвую в совместном разговоре и разрешаю обсуждать мои сообщения и описание моей ладони внутри этой комнаты.',
        state.oracleRoomJoinConsent,
        (checked) => { state.oracleRoomJoinConsent = checked; }
      ),
      consentRow(
        'Я подтверждаю совершеннолетие.',
        state.oracleRoomJoinAdult,
        (checked) => { state.oracleRoomJoinAdult = checked; }
      )
    ] }),
    MysticButton({
      text: unavailable ? 'К кабинету хироманта' : state.busy ? 'Входим…' : 'Принять приглашение',
      icon: unavailable ? 'arrow-left' : 'sparkle',
      variant: unavailable ? 'secondary' : 'primary',
      disabled: !unavailable && state.busy,
      onClick: unavailable ? () => navigate('palm-reading') : joinOracleRoom
    })
  ], { tabs: false });
}

function oracleRoomParticipants(room) {
  const memberStatus = (member) => {
    if (member.status === 'invited') return 'Приглашение отправлено';
    if (room.mode === 'solo') return member.palmReady ? 'Ладонь добавлена' : 'Ладонь ещё не добавлена';
    if (member.preparationStatus === 'ready') return 'Подготовка завершена';
    if (member.preparationStatus === 'in_progress') return 'Проходит закрытую подготовку';
    return 'Ожидает подготовку';
  };
  return h('section', { className: 'oracle-room-participants' },
    h('div', { className: 'oracle-room-section-head' },
      h('strong', { text: `Участники · ${room.participantCount}/${room.maxParticipants}` }),
      h('small', { text: room.mode === 'solo' ? 'Личный разговор' : 'Все дали отдельное согласие' })
    ),
    h('div', { className: 'oracle-room-member-list' }, (room.members || []).map((member) => h('div', {
      className: `oracle-room-member ${member.isViewer ? 'is-viewer' : ''} ${member.status === 'invited' ? 'is-invited' : ''}`
    },
    h('span', { className: 'oracle-room-member__avatar' }, member.displayName.slice(0, 1).toUpperCase()),
    h('span', {},
      h('strong', { text: `${member.displayName}${member.isViewer ? ' · вы' : ''}` }),
      h('small', { text: memberStatus(member) })
    ),
    member.preparationStatus === 'ready' || (room.mode === 'solo' && member.palmReady) ? h('b', { text: '✦' }) : null
    )))
  );
}

function oracleRoomInvitePanel(room) {
  if (room.viewerRole !== 'owner' || room.mode === 'solo' || room.status !== 'active') return null;
  const input = textInput({
    value: state.oracleRoomInviteUsername,
    placeholder: '@username',
    attrs: { maxlength: 33, autocapitalize: 'none', autocomplete: 'off' },
    onInput: (value) => { state.oracleRoomInviteUsername = value; }
  });
  return MysticCard({ className: 'oracle-room-invite-panel', children: [
    room.mode === 'pair' ? palmCompatibilityInviteCard(room, { preview: true }) : oracleCircleInviteCard(room, { preview: true }),
    h('div', {}, h('strong', { text: room.mode === 'pair' ? `Отправить открытку для ${room.inviteeName || 'второго участника'}` : 'Отправить открытку общего круга' }), h('p', { text: 'Поделиться ссылкой можно напрямую или через Telegram username человека, который уже открывал Nastardamus.' })),
    h('div', { className: 'oracle-room-invite-actions' },
      MysticButton({ text: 'Отправить живую открытку', icon: 'send', variant: 'gold', onClick: shareOracleRoom }),
      h('div', { className: 'oracle-room-username-row' }, input, h('button', { attrs: { type: 'button', 'aria-label': 'Отправить приглашение' }, on: { click: inviteOracleRoomUsername } }, Icon('send', { size: 20 })))
    )
  ] });
}

function oracleRoomPreparationPanel(room) {
  const viewer = room.viewer || {};
  const preparation = state.oracleRoomPreparation;
  const answers = preparation.answers;
  const ready = viewer.preparationStatus === 'ready';
  if (ready && !state.oracleRoomPreparationEditing) {
    return h('section', { className: 'palm-preparation-ready' },
      h('span', { className: 'palm-preparation-ready__seal' }, Icon('sparkle', { size: 25 })),
      h('div', {},
        h('strong', { text: 'Ваша закрытая подготовка завершена' }),
        h('small', { text: room.chatUnlocked ? 'Общий разговор открыт.' : 'Эзотериум ждёт готовности остальных. Ваши личные ответы им не видны.' })
      ),
      room.status === 'active' && !room.chatUnlocked ? h('button', {
        attrs: { type: 'button' },
        on: { click: () => { state.oracleRoomPreparationEditing = true; render(); } },
        text: 'Изменить'
      }) : null
    );
  }

  const upload = imageUpload({
    title: ready ? 'Добавить новый снимок ладони' : 'Загрузить чёткое фото ладони',
    image: state.oracleRoomPalmImage,
    capture: 'environment',
    onImage: (image) => { state.oracleRoomPalmImage = image; render(); },
    onRemove: () => { state.oracleRoomPalmImage = ''; render(); }
  });
  return MysticCard({ className: 'palm-preparation-card', children: [
    h('header', { className: 'palm-preparation-head' },
      h('span', { className: 'palm-preparation-head__icon' }, Icon('hand', { size: 26 })),
      h('div', {},
        h('p', { className: 'premium-kicker', text: 'ТОЛЬКО ДЛЯ ВАС И ЭЗОТЕРИУМА' }),
        h('h2', { text: ready ? 'Обновить подготовку' : 'Закрытая подготовка ладони' }),
        h('p', { text: 'Партнёр увидит только отметку «готово». Фото и ваши ответы не открываются другим участникам.' })
      )
    ),
    h('div', { className: 'palm-preparation-progress' },
      ['Рука', 'Ладонь', 'Ответы', 'Готово'].map((label, index) => h('span', { className: index === 0 ? 'is-active' : '' }, h('b', { text: String(index + 1) }), label))
    ),
    field('Какая рука у вас ведущая?', palmChoiceChips({
      right: { label: 'Правша' },
      left: { label: 'Левша' },
      ambidextrous: { label: 'Обе руки' }
    }, preparation.dominantHand, (value) => { preparation.dominantHand = value; })),
    field('Какую ладонь вы показываете?', palmChoiceChips({
      right: { label: 'Правую' },
      left: { label: 'Левую' }
    }, preparation.palmSide, (value) => { preparation.palmSide = value; }), 'Ладонь должна быть раскрыта, пальцы видны полностью, линии — в фокусе.'),
    upload,
    field('Что особенно заметно на ладони', textarea({
      value: state.oracleRoomPalmDescription || viewer.palmDescription || '',
      placeholder: 'Например: линия сердца длинная и поднимается к указательному пальцу; возле середины линии жизни есть развилка…',
      maxLength: 1000,
      onInput: (value) => { state.oracleRoomPalmDescription = value; }
    }), 'Это описание станет частью символического чтения; автоматического распознавания личности по фото нет.'),
    h('div', { className: 'palm-private-questions' },
      h('div', { className: 'palm-private-questions__head' }, h('strong', { text: 'Личные вопросы Эзотериума' }), h('small', { text: 'Ответьте честно и коротко. Дословно партнёру они не показываются.' })),
      Object.entries(PALM_PREPARATION_QUESTIONS).map(([key, question], index) => field(`${index + 1}. ${question}`, textarea({
        value: answers[key] || '',
        placeholder: index === 3 && room.openingQuestion ? `Ваш общий вопрос: ${room.openingQuestion}` : 'Ваш ответ…',
        maxLength: 500,
        onInput: (value) => { answers[key] = value; }
      })))
    ),
    consentRow(
      'Я добровольно передаю фотографию и ответы Эзотериуму для этого совместного чтения. Они остаются закрытыми от других участников.',
      state.oracleRoomPalmConsent,
      (checked) => { state.oracleRoomPalmConsent = checked; }
    ),
    h('div', { className: 'palm-preparation-actions' },
      ready ? MysticButton({ text: 'Отменить изменения', icon: 'arrow-left', variant: 'outline', onClick: () => {
        state.oracleRoomPreparationEditing = false;
        state.oracleRoomPalmImage = '';
        state.oracleRoomPalmConsent = false;
        render();
      } }) : null,
      MysticButton({
        text: state.busy ? 'Сохраняем подготовку…' : ready ? 'Сохранить новую подготовку' : 'Завершить подготовку',
        icon: 'sparkle',
        variant: 'primary',
        disabled: state.busy,
        onClick: uploadOracleRoomPalm
      })
    )
  ] });
}

function oracleRoomPalmPanel(room) {
  const viewer = room.viewer || {};
  const upload = imageUpload({
    title: viewer.palmReady ? 'Заменить фотографию ладони' : 'Добавить фотографию ладони',
    image: state.oracleRoomPalmImage,
    capture: 'environment',
    onImage: (image) => { state.oracleRoomPalmImage = image; render(); },
    onRemove: () => { state.oracleRoomPalmImage = ''; render(); }
  });
  const description = state.oracleRoomPalmDescription || viewer.palmDescription || '';
  return MysticCard({ className: `oracle-room-palm-panel ${viewer.palmReady ? 'is-ready' : ''}`, children: [
    h('div', { className: 'oracle-room-section-head' },
      h('div', {}, h('strong', { text: viewer.palmReady ? 'Ваша ладонь добавлена' : 'Расскажите о своей ладони' }), h('small', { text: 'Фото остаётся закрытым. В разговор передаётся только ваше описание линий.' })),
      viewer.palmReady ? h('span', { className: 'oracle-room-ready-mark', text: 'Готово' }) : null
    ),
    upload,
    field('Что вы видите на ладони', textarea({
      value: description,
      placeholder: 'Например: линия жизни длинная, возле середины есть развилка; линия сердца идёт к указательному пальцу…',
      maxLength: 1000,
      onInput: (value) => { state.oracleRoomPalmDescription = value; }
    }), 'Эзотериум сможет задать уточняющий вопрос прямо в общем чате.'),
    consentRow(
      'Я согласен сохранить фото как закрытый визуальный якорь этой комнаты и поделиться своим текстовым описанием с участниками.',
      state.oracleRoomPalmConsent,
      (checked) => { state.oracleRoomPalmConsent = checked; }
    ),
    MysticButton({
      text: viewer.palmReady ? 'Обновить ладонь' : 'Добавить ладонь',
      icon: 'hand',
      variant: 'secondary',
      onClick: uploadOracleRoomPalm
    })
  ] });
}

function oracleRoomMessageBubble(message, viewerId) {
  if (message.role === 'system') {
    return h('div', { className: 'oracle-room-system-message', text: message.content });
  }
  const own = Number(message.senderTelegramId) === Number(viewerId);
  return h('article', { className: `oracle-room-message is-${message.role}${own ? ' is-own' : ''}` },
    h('header', {}, h('strong', { text: message.role === 'assistant' ? 'Эзотериум' : message.senderName }), h('time', { text: new Date(message.createdAt).toLocaleTimeString(dateTimeLocale(state.locale), { hour: '2-digit', minute: '2-digit' }) })),
    h('p', { text: message.content })
  );
}

function oracleRoomWaitingStage(room) {
  const readyCount = (room.members || []).filter((member) => member.preparationStatus === 'ready').length;
  const minimum = room.mode === 'pair' ? 2 : 3;
  const activeCount = Number(room.participantCount) || 0;
  const waitingForPeople = activeCount < minimum;
  return h('section', { className: 'palm-waiting-ritual' },
    h('div', { className: 'palm-waiting-ritual__orbit', attrs: { 'aria-hidden': 'true' } },
      h('img', { className: 'is-first', attrs: { src: premiumArtUrl('palm-left'), alt: '' } }),
      h('i'),
      h('img', { className: 'is-second', attrs: { src: premiumArtUrl('palm-right'), alt: '' } })
    ),
    h('p', { className: 'premium-kicker', text: waitingForPeople ? 'ОЖИДАЕМ УЧАСТНИКОВ' : 'ЛАДОНИ ГОТОВЯТСЯ К ВСТРЕЧЕ' }),
    h('h2', { text: waitingForPeople ? 'Приглашение ждёт ответа' : `${readyCount} из ${activeCount} завершили подготовку` }),
    h('p', { text: waitingForPeople
      ? 'Общий разговор откроется, когда приглашённые войдут и каждый пройдёт свой закрытый этап.'
      : 'Пока остальные отвечают, ваши данные остаются запечатаны. Эзотериум откроет диалог автоматически после готовности всех.' }),
    h('div', { className: 'palm-waiting-ritual__meter' }, h('i', { attrs: { style: `width:${activeCount ? Math.round((readyCount / activeCount) * 100) : 0}%` } })),
    h('small', { text: 'Ни фотография, ни личные ответы не показываются участникам комнаты.' })
  );
}

function palmRoomScreen() {
  if (!state.oracleRoomToken) {
    return shell([screenHeader('Комната не выбрана', '', 'palm-reading'), MysticButton({ text: 'Открыть мои комнаты', icon: 'history', variant: 'primary', onClick: () => navigate('palm-rooms') })]);
  }
  if (state.oracleRoomStatus === 'idle') queueMicrotask(() => loadOracleRoom());
  if (state.oracleRoomStatus === 'idle' || state.oracleRoomStatus === 'loading') {
    return shell([screenHeader('Комната Эзотериума', 'Подключаем участников', 'palm-rooms'), loadingCard('Открываем защищённый разговор…')], { tabs: false });
  }
  if (state.oracleRoomStatus === 'error' || !state.oracleRoom) {
    return shell([
      screenHeader('Комната недоступна', '', 'palm-rooms'),
      MysticCard({ children: [h('p', { text: state.oracleRoomError || 'Не удалось открыть эту комнату.' })] }),
      MysticButton({ text: 'К моим комнатам', icon: 'history', variant: 'secondary', onClick: () => navigate('palm-rooms') })
    ], { tabs: false });
  }
  const room = state.oracleRoom;
  if (room.joinRequired) return oracleRoomJoinView(room);
  syncOracleRoomPreparation(room);
  queueMicrotask(() => document.querySelector('.oracle-room-message-list')?.scrollTo?.({ top: 100000, behavior: 'smooth' }));
  const composer = textarea({
    value: state.oracleRoomMessageDraft,
    placeholder: room.mode === 'solo' ? 'Спросите Эзотериума…' : 'Задайте вопрос о себе или участниках…',
    maxLength: 2000,
    onInput: (value) => {
      state.oracleRoomMessageDraft = value;
      state.oracleRoomMessageNonce = '';
    }
  });
  const hasOpeningReading = (room.messages || []).some((message) => message.role === 'assistant');
  return shell([
    screenHeader(room.title, `${PALM_ROOM_MODES[room.mode]?.short || 'Комната'} · ${room.participantCount} участник(а)`, 'palm-rooms'),
    h('section', { className: `oracle-room-live-head is-${room.mode}` },
      h('img', { attrs: { src: premiumArtUrl('palm-oracle'), alt: '' } }),
      h('div', {}, h('p', { className: 'premium-kicker', text: room.status === 'closed' ? 'РАЗГОВОР ЗАВЕРШЁН' : 'ЭЗОТЕРИУМ В КОМНАТЕ' }), h('h1', { text: room.title }), room.focus ? h('p', { text: room.focus }) : null)
    ),
    oracleRoomParticipants(room),
    oracleRoomInvitePanel(room),
    room.status === 'active' && room.mode !== 'solo' ? oracleRoomPreparationPanel(room) : null,
    room.status === 'active' && room.mode === 'solo' && !room.viewer?.palmReady ? oracleRoomPalmPanel(room) : null,
    room.mode !== 'solo' && !room.chatUnlocked ? oracleRoomWaitingStage(room) : null,
    room.chatUnlocked || room.mode === 'solo' ? h('section', { className: 'oracle-room-chat', attrs: { 'aria-live': 'polite' } },
      h('div', { className: 'oracle-room-section-head' }, h('strong', { text: 'Общий разговор' }), h('small', { text: 'Каждый участник может задать свой вопрос' })),
      room.mode !== 'solo' && !hasOpeningReading && room.status === 'active' ? h('div', { className: 'palm-opening-reading' },
        h('span', {}, Icon('sparkle', { size: 25 })),
        h('div', {}, h('strong', { text: 'Все готовы. Откройте первое совместное чтение' }), h('p', { text: room.openingQuestion || 'Эзотериум соединит наблюдения двух ладоней и обозначит главную тему вашей связи.' })),
        MysticButton({ text: 'Начать чтение совместимости', icon: 'sparkle', variant: 'gold', disabled: state.oracleRoomSending, onClick: () => sendOracleRoomMessage(
          `Проведи первое совместное чтение наших ладоней. Начни с совместимости характеров, сильной стороны связи, главного напряжения и вероятного направления будущего. Наш главный вопрос: ${room.openingQuestion || room.focus || 'что важно понять о нашей связи сейчас?'}`
        ) })
      ) : null,
      h('div', { className: 'oracle-room-message-list' },
        (room.messages || []).map((message) => oracleRoomMessageBubble(message, room.viewer?.telegramId)),
        room.assistantState === 'thinking' || state.oracleRoomSending
          ? h('article', { className: 'oracle-room-message is-assistant is-thinking' }, h('header', {}, h('strong', { text: 'Эзотериум' })), h('p', {}, h('i'), h('i'), h('i')))
          : null,
        room.assistantState === 'error' ? h('p', { className: 'oracle-room-answer-error', text: 'Ответ прервался. Повторите вопрос — предыдущие сообщения сохранены.' }) : null
      ),
      room.status === 'active' ? h('div', { className: 'oracle-room-composer' },
        composer,
        h('button', {
          attrs: { type: 'button', 'aria-label': 'Отправить вопрос', disabled: state.oracleRoomSending },
          on: { click: sendOracleRoomMessage }
        }, Icon('send', { size: 23 }))
      ) : null
    ) : null,
    room.status === 'active' && room.mode === 'solo' && room.viewer?.palmReady ? oracleRoomPalmPanel(room) : null,
    room.status === 'active' ? h('div', { className: 'oracle-room-footer-actions' },
      room.viewerRole === 'owner'
        ? h('button', { className: 'personal-danger-link', attrs: { type: 'button' }, on: { click: closeOracleRoom }, text: 'Завершить комнату для всех' })
        : h('button', { className: 'personal-danger-link', attrs: { type: 'button' }, on: { click: leaveOracleRoom }, text: 'Покинуть комнату' })
    ) : null
  ], { tabs: false, reading: true });
}

async function joinOracleRoom() {
  if (state.busy) return;
  if (!state.oracleRoomJoinConsent) return notify('Подтвердите добровольное участие');
  if (!state.oracleRoomJoinAdult) return notify('Подтвердите совершеннолетие');
  state.busy = true;
  render();
  try {
    const data = await api('/api/proxy', {
      method: 'POST',
      body: {
        action: 'join_oracle_room',
        roomToken: state.oracleRoomToken,
        relationshipConsent: true,
        adultConfirmed: true,
        gender: state.userGender
      }
    });
    state.oracleRoom = data.room;
    state.oracleRoomPreparationToken = '';
    syncOracleRoomPreparation(data.room);
    state.oracleRoomInviteUrl = data.inviteUrl || state.oracleRoomInviteUrl;
    state.oracleRoomStatus = 'ready';
    pulse('medium');
  } catch (error) {
    notify(apiErrorMessage(error));
  } finally {
    state.busy = false;
    render();
  }
}

async function inviteOracleRoomUsername() {
  const username = state.oracleRoomInviteUsername.trim();
  if (!/^@?[A-Za-z0-9_]{5,32}$/.test(username)) return notify('Введите Telegram username в формате @username');
  if (state.busy) return;
  state.busy = true;
  try {
    const data = await api('/api/proxy', {
      method: 'POST',
      body: { action: 'invite_oracle_room_username', roomToken: state.oracleRoomToken, username }
    });
    state.oracleRoom = data.room;
    state.oracleRoomInviteUrl = data.inviteUrl || state.oracleRoomInviteUrl;
    state.oracleRoomInviteUsername = '';
    notify(data.invited === false ? 'Этот человек уже приглашён' : `Приглашение для ${data.inviteeName || username} отправлено`);
    pulse();
  } catch (error) {
    notify(apiErrorMessage(error));
  } finally {
    state.busy = false;
    render();
  }
}

async function shareOracleRoom() {
  const url = state.oracleRoomInviteUrl || `https://t.me/${state.publicConfig.botUsername || 'BelonTip_bot'}?start=room_${state.oracleRoomToken}`;
  const room = state.oracleRoom;
  const inviteeName = room?.inviteeName || 'второго участника';
  const relationship = PALM_RELATIONSHIP_TYPES[room?.relationshipType] || PALM_RELATIONSHIP_TYPES.other;
  const shareData = {
    title: room?.title || 'Комната Эзотериума',
    text: room?.mode === 'pair'
      ? `${inviteeName}, ${relationship.thought} Присоединяйся к нашему разговору с Эзотериумом.`
      : 'Чтобы услышать друг друга, иногда нужен третий голос. Присоединяйся к нашему кругу с Эзотериумом.',
    url
  };
  try {
    if (room?.mode !== 'solo' && !state.oracleRoomInviteFile) {
      state.oracleRoomInviteFile = await buildOracleRoomInviteCardFile(room).catch(() => null);
    }
    if (state.oracleRoomInviteFile && navigator.canShare?.({ files: [state.oracleRoomInviteFile] })) {
      shareData.files = [state.oracleRoomInviteFile];
    }
    if (navigator.share) await navigator.share(shareData);
    else if (tg?.openTelegramLink) {
      const fallback = new URL('https://t.me/share/url');
      fallback.searchParams.set('url', url);
      fallback.searchParams.set('text', shareData.text);
      tg.openTelegramLink(fallback.toString());
    }
    else {
      await navigator.clipboard.writeText(`${shareData.text} ${url}`);
      notify('Ссылка скопирована');
    }
  } catch (error) {
    if (error?.name !== 'AbortError') notify('Не удалось поделиться ссылкой');
  }
}

async function buildOracleRoomInviteCardFile(room) {
  const owner = room?.members?.find((member) => member.role === 'owner');
  const ownerName = String(owner?.displayName || firstName() || 'Искатель').slice(0, 24);
  const inviteeName = String(room?.inviteeName || 'Тебя').slice(0, 24);
  const relationship = PALM_RELATIONSHIP_TYPES[room?.relationshipType] || PALM_RELATIONSHIP_TYPES.other;
  const group = room?.mode === 'group';
  const [background, palm] = await Promise.all([
    loadImage(group ? invitationArtworkUrl('group') : invitationArtworkUrl(room?.relationshipType)),
    group ? Promise.resolve(null) : loadImage(premiumArtUrl('palm-left'))
  ]);
  const canvas = document.createElement('canvas');
  canvas.width = 900;
  canvas.height = 1200;
  const context = canvas.getContext('2d');
  drawCanvasImageCover(context, background, 0, 0, 900, 1200);
  const veil = context.createLinearGradient(0, 0, 0, 1200);
  veil.addColorStop(0, 'rgba(7,7,18,.22)');
  veil.addColorStop(.45, 'rgba(11,8,22,.54)');
  veil.addColorStop(1, 'rgba(8,7,18,.96)');
  context.fillStyle = veil;
  context.fillRect(0, 0, 900, 1200);

  if (palm) {
    context.save();
    context.globalAlpha = .82;
    context.drawImage(palm, 25, 235, 330, 430);
    context.translate(900, 0);
    context.scale(-1, 1);
    context.drawImage(palm, 25, 235, 330, 430);
    context.restore();
  }

  const thread = context.createLinearGradient(320, 0, 580, 0);
  thread.addColorStop(0, 'rgba(214,151,57,0)');
  thread.addColorStop(.5, '#ffe7a7');
  thread.addColorStop(1, 'rgba(214,151,57,0)');
  context.strokeStyle = thread;
  context.lineWidth = 5;
  context.beginPath();
  context.moveTo(300, 520);
  context.bezierCurveTo(390, 420, 510, 620, 600, 520);
  context.stroke();
  context.fillStyle = '#ffe8a7';
  context.font = '700 34px system-ui, sans-serif';
  context.textAlign = 'center';
  context.fillText('✦', 450, 531);

  context.fillStyle = '#e9c36d';
  context.font = '700 24px system-ui, sans-serif';
  context.fillText(group ? 'КРУГ ЭЗОТЕРИУМА' : 'ПРИГЛАШЕНИЕ ЭЗОТЕРИУМА', 450, 120);
  context.fillStyle = '#fff1c6';
  context.font = '700 58px Georgia, serif';
  context.fillText(group ? `${ownerName} открывает круг` : `${ownerName} приглашает`, 450, 760);
  context.font = '700 62px Georgia, serif';
  context.fillText(group ? String(room?.title || 'Общий разговор').slice(0, 28) : inviteeName, 450, 840);
  context.fillStyle = '#e7d7d9';
  context.font = '500 30px system-ui, sans-serif';
  context.fillText(group ? 'Чтобы услышать друг друга.' : relationship.thought, 450, 905);
  context.fillStyle = '#bfb1c5';
  context.font = '500 23px system-ui, sans-serif';
  context.fillText(group ? 'Общий разговор · взаимопонимание' : 'Две ладони · один разговор', 450, 1030);
  context.fillStyle = '#e9c36d';
  context.fillText('Nastardamus · Путь двух судеб', 450, 1090);

  const blob = await new Promise((resolve, reject) =>
    canvas.toBlob((value) => value ? resolve(value) : reject(new Error('oracle_invite_card_failed')), 'image/png')
  );
  return new File([blob], `nastardamus-${group ? 'circle' : 'palm'}-${room.token}.png`, { type: 'image/png' });
}

async function uploadOracleRoomPalm() {
  const image = state.oracleRoomPalmImage;
  const description = (state.oracleRoomPalmDescription || state.oracleRoom?.viewer?.palmDescription || '').trim();
  if (!image) return notify('Добавьте новую фотографию ладони');
  if (description.length < 10) return notify('Опишите хотя бы одну заметную линию или особенность ладони');
  if (state.oracleRoom?.mode !== 'solo') {
    const answers = state.oracleRoomPreparation.answers;
    const incomplete = Object.keys(PALM_PREPARATION_QUESTIONS).find((key) => String(answers[key] || '').trim().length < 4);
    if (incomplete) return notify('Ответьте на все личные вопросы Эзотериума');
  }
  if (!state.oracleRoomPalmConsent) return notify('Подтвердите согласие на сохранение ладони');
  if (state.busy) return;
  state.busy = true;
  render();
  try {
    const data = await api('/api/proxy', {
      method: 'POST',
      body: {
        action: 'upload_oracle_room_palm',
        roomToken: state.oracleRoomToken,
        image,
        description,
        dominantHand: state.oracleRoomPreparation.dominantHand,
        palmSide: state.oracleRoomPreparation.palmSide,
        privateAnswers: state.oracleRoom?.mode === 'solo' ? {} : state.oracleRoomPreparation.answers,
        palmConsent: true
      }
    });
    state.oracleRoom = data.room;
    state.oracleRoomPreparationToken = '';
    syncOracleRoomPreparation(data.room);
    state.oracleRoomPreparationEditing = false;
    state.oracleRoomPalmImage = '';
    state.oracleRoomPalmDescription = '';
    state.oracleRoomPalmConsent = false;
    notify(data.newlyOpened ? 'Все готовы — общий разговор открыт' : state.oracleRoom?.mode === 'solo' ? 'Ладонь и описание добавлены в комнату' : 'Закрытая подготовка завершена');
    pulse('medium');
  } catch (error) {
    notify(apiErrorMessage(error));
  } finally {
    state.busy = false;
    render();
  }
}

async function sendOracleRoomMessage(presetMessage = '') {
  const message = String(presetMessage || state.oracleRoomMessageDraft).trim().replace(/\s+/g, ' ');
  if (message.length < 2) return notify('Напишите вопрос или мысль для разговора');
  if (state.oracleRoomSending) return;
  const clientNonce = state.oracleRoomMessageNonce || uniqueId('oracle-room-message');
  state.oracleRoomMessageNonce = clientNonce;
  state.oracleRoomSending = true;
  state.oracleRoomMessageDraft = '';
  render();
  try {
    const data = await api('/api/proxy', {
      method: 'POST',
      body: {
        action: 'oracle_room_send',
        roomToken: state.oracleRoomToken,
        message,
        clientNonce
      }
    });
    state.oracleRoom = data.room;
    state.oracleRoomStatus = 'ready';
    state.oracleRoomMessageNonce = '';
    pulse();
  } catch (error) {
    state.oracleRoomMessageDraft = message;
    notify(apiErrorMessage(error));
    await loadOracleRoom({ silent: true });
  } finally {
    state.oracleRoomSending = false;
    render();
  }
}

async function leaveOracleRoom() {
  if (!window.confirm('Покинуть эту комнату? Переписка останется у других участников.')) return;
  try {
    await api('/api/proxy', { method: 'POST', body: { action: 'leave_oracle_room', roomToken: state.oracleRoomToken } });
    state.oracleRoomToken = '';
    state.oracleRoom = null;
    const url = new URL(location.href);
    url.searchParams.delete('room');
    history.replaceState({}, '', url);
    navigate('palm-rooms', { replace: true });
    loadOracleRooms({ force: true });
  } catch (error) { notify(apiErrorMessage(error)); }
}

async function closeOracleRoom() {
  if (!window.confirm('Завершить комнату для всех участников? Новые сообщения станут недоступны.')) return;
  try {
    const data = await api('/api/proxy', { method: 'POST', body: { action: 'close_oracle_room', roomToken: state.oracleRoomToken } });
    state.oracleRoom = data.room;
    notify('Комната завершена, история сохранена');
    render();
  } catch (error) { notify(apiErrorMessage(error)); }
}

function runeScreen() {
  const dayRune = runeOfDay(`${state.profile.name}:${state.profile.birthDate}`);
  const tabs = [['temple', 'Храм'], ['spreads', 'Расклады'], ['catalog', 'Каталог'], ['history', 'История']];
  return shell([
    screenHeader('Рунический храм', 'Знак, смысл и действие', 'services'),
    h('section', { className: 'rune-temple-intro' },
      h('div', { className: 'rune-temple-intro__stone', attrs: { 'aria-hidden': 'true' } },
        h('span', { text: 'ᛉ' }), h('i'), h('i'), h('i')
      ),
      h('div', {},
        h('p', { className: 'premium-kicker', text: 'СТАРШИЙ ФУТАРК' }),
        h('h1', { text: 'Не просите знак решить за вас.' }),
        h('p', { text: 'Войдите с одним вопросом. Храм откроет тенденцию, границу и доступную силу.' })
      )
    ),
    h('nav', { className: 'rune-temple-tabs', attrs: { 'aria-label': 'Разделы рунического храма' } }, tabs.map(([id, label]) => h('button', {
      className: state.runeView === id ? 'is-active' : '', attrs: { type: 'button', 'aria-current': state.runeView === id ? 'page' : null },
      on: { click: () => { state.runeView = id; pulse(); render(); } }
    }, label))),
    state.runeView === 'temple' ? runeTempleHome(dayRune) : null,
    state.runeView === 'spreads' ? runeSpreadsView() : null,
    state.runeView === 'catalog' ? runeCatalogView() : null,
    state.runeView === 'history' ? runeHistoryView() : null
  ], { active: 'services', reading: state.busy || Boolean(state.runeResult) });
}

function runeTempleHome(dayRune) {
  return h('div', { className: 'rune-temple-view is-home' },
    h('button', {
      className: `rune-day-card${dayRune.reversed ? ' is-reversed' : ''}`, attrs: { type: 'button' },
      on: { click: () => { state.runeQuestion = 'Как знак дня проявляется в моём текущем пути?'; state.runeSpread = 'one'; state.runeView = 'spreads'; render(); } }
    },
    h('span', { className: 'rune-day-card__glyph', text: dayRune.glyph }),
    h('span', {}, h('small', { text: 'РУНА ДНЯ' }), h('strong', { text: `${dayRune.name}${dayRune.reversed ? ' · перевёрнутая' : ''}` }), h('p', { text: dayRune.meaning })),
    h('b', { text: 'Открыть чтение →' })),
    SectionTitle({ text: 'Войти с вопросом' }),
    h('div', { className: 'rune-home-grid' },
      RUNE_SPREADS.slice(0, 3).map((spread) => h('button', { className: 'rune-home-path', attrs: { type: 'button' }, on: { click: () => { state.runeSpread = spread.id; state.runeView = 'spreads'; render(); } } },
        h('span', { text: spread.count }), h('strong', { text: spread.label }), h('small', { text: `${spread.count} ${russianCount(spread.count, ['руна', 'руны', 'рун'])}` })
      ))
    ),
    MysticButton({ text: 'Все расклады', icon: 'sparkle', variant: 'outline', onClick: () => { state.runeView = 'spreads'; render(); } })
  );
}

function runeSpreadsView() {
  const selected = RUNE_SPREADS.find((spread) => spread.id === state.runeSpread) || RUNE_SPREADS[1];
  const result = state.runeResult;
  return h('div', { className: 'rune-temple-view is-spreads' },
    h('div', { className: 'rune-spread-catalog' }, RUNE_SPREADS.map((spread) => h('button', {
      className: selected.id === spread.id ? 'is-active' : '', attrs: { type: 'button', 'aria-pressed': selected.id === spread.id ? 'true' : 'false' },
      on: { click: () => { state.runeSpread = spread.id; state.runeCount = spread.count; state.runeSelection = []; state.runeResult = null; render(); } }
    }, h('b', { text: String(spread.count).padStart(2, '0') }), h('span', {}, h('strong', { text: spread.label }), h('small', { text: spread.positions.join(' · ') }))))),
    field('Ваш вопрос', textarea({ value: state.runeQuestion, placeholder: 'Что мне важно увидеть в этой ситуации?', onInput: (value) => { state.runeQuestion = value; }, maxLength: 500 })),
    state.runeSelection.length ? h('div', { className: `premium-rune-cast rune-count-${Math.min(6, state.runeSelection.length)}` },
      state.runeSelection.map((rune, index) => h('div', { className: `premium-rune-stone${rune.reversed ? ' is-reversed' : ''}`, style: `--delay:${index * 90}ms` },
        h('small', { text: rune.position }), h('b', { text: rune.glyph }), h('strong', { text: rune.name }), h('small', { text: rune.reversed ? 'Перевёрнутая' : rune.keywords.join(' · ') })
      ))
    ) : null,
    MysticButton({
      text: state.busy ? 'Знаки выходят из тьмы…' : state.runeSelection.length ? 'Повторить расклад' : `Открыть ${selected.count} ${russianCount(selected.count, ['руну', 'руны', 'рун'])}`,
      icon: 'sparkle', variant: 'primary', disabled: state.busy, onClick: castRunes
    }),
    state.busy ? loadingCard('Камень · золотой контур · смысл…') : null,
    result ? runeStructuredResult(result) : null
  );
}

function runeStructuredResult(result) {
  return h('section', { className: 'premium-structured-result rune-reading-result' },
    MysticCard({ className: 'premium-result-reading', children: [h('p', { className: 'premium-kicker', text: 'ГОЛОС ХРАМА' }), h('h2', { text: result.headline }), formatReading(result.narrative)] }),
    h('div', { className: 'premium-rune-result-grid' },
      MysticCard({ children: [h('small', { text: 'Тенденция' }), h('p', { text: result.tendency })] }),
      MysticCard({ children: [h('small', { text: 'Препятствие' }), h('p', { text: result.obstacle })] }),
      MysticCard({ children: [h('small', { text: 'Ресурс' }), h('p', { text: result.resource })] })
    ),
    MysticCard({ className: 'premium-rune-ritual', children: [h('strong', { text: 'Действие на 24 часа' }), h('p', { text: result.action24h }), h('strong', { text: 'Безопасная практика намерения' }), h('p', { text: result.safeRitual })] }),
    runeLiveDialogue()
  );
}

function runeLiveDialogue() {
  const used = state.runeDialogueMessages.filter((message) => message.role === 'user').length;
  return h('section', { className: 'tarot-live-dialogue rune-live-dialogue' },
    h('header', {}, h('span', { className: 'tarot-live-dialogue__seal', text: 'ᚨ' }), h('span', {}, h('strong', { text: 'Уточнить у Эзотериума' }), h('small', { text: used < 5 ? `${5 - used} уточнений в этом чтении` : 'Следующие уточнения — по тарифу' }))),
    state.runeDialogueMessages.length ? h('div', { className: 'tarot-live-dialogue__messages' }, state.runeDialogueMessages.map((message) => h('p', { className: message.role === 'user' ? 'is-user' : 'is-assistant', text: message.content })), state.runeDialogueSending ? h('p', { className: 'is-assistant is-thinking' }, h('i'), h('i'), h('i')) : null) : null,
    h('div', { className: 'tarot-live-dialogue__composer' },
      textarea({ value: state.runeDialogueDraft, placeholder: 'Как эта руна связана с моей ситуацией?', maxLength: 500, onInput: (value) => { state.runeDialogueDraft = value; } }),
      h('button', { attrs: { type: 'button', 'aria-label': 'Отправить уточнение', disabled: state.runeDialogueSending }, on: { click: sendRuneFollowup } }, Icon('send', { size: 19 }))
    )
  );
}

function runeCatalogView() {
  const runes = searchRunes(state.runeSearch, state.runeFamily);
  return h('div', { className: 'rune-temple-view is-catalog' },
    h('div', { className: 'rune-catalog-controls' },
      textInput({ value: state.runeSearch, placeholder: 'Поиск по имени или смыслу', attrs: { 'aria-label': 'Поиск рун' }, onInput: (value) => { state.runeSearch = value; render(); } }),
      selectField({ all: { label: 'Все атты' }, 'Фрейр': { label: 'Атт Фрейра' }, 'Хеймдалль': { label: 'Атт Хеймдалля' }, 'Тюр': { label: 'Атт Тюра' } }, state.runeFamily, (value) => { state.runeFamily = value; render(); })
    ),
    h('div', { className: 'rune-catalog-grid' }, runes.map((rune) => {
      const favorite = state.runeFavorites.includes(rune.name);
      return h('article', { className: `rune-catalog-card${favorite ? ' is-favorite' : ''}` },
        h('button', { className: 'rune-catalog-card__favorite', attrs: { type: 'button', 'aria-label': favorite ? 'Убрать из избранного' : 'Добавить в избранное' }, on: { click: () => toggleRuneFavorite(rune.name) } }, favorite ? '★' : '☆'),
        h('b', { text: rune.glyph }), h('strong', { text: rune.name }), h('small', { text: `${rune.family} · ${rune.keywords.join(' · ')}` }), h('p', { text: rune.upright }), h('details', {}, h('summary', { text: 'Перевёрнутое положение' }), h('p', { text: rune.reversed }))
      );
    })),
    !runes.length ? h('p', { className: 'personal-empty', text: 'По этому запросу руна не найдена.' }) : null
  );
}

function runeHistoryView() {
  const entries = readJSON(JOURNAL_KEY, []).filter((entry) => entry.kind === 'runes' && !entry.deletedAt).reverse();
  return h('div', { className: 'rune-temple-view is-history' },
    entries.length ? h('div', { className: 'personal-list' }, entries.map((entry) => h('button', { className: 'personal-list-row rune-history-row', attrs: { type: 'button' }, on: { click: () => { state.runeResult = entry.result; state.result = entry; state.runeQuestion = entry.title; state.runeView = 'spreads'; render(); } } }, h('i', { text: 'ᛟ' }), h('span', {}, h('strong', { text: entry.title }), h('small', { text: formatDate(entry.createdAt) })), h('b', { text: '→' })))) : h('p', { className: 'personal-empty', text: 'Первый сохранённый расклад появится здесь.' }),
    entries.length ? MysticButton({ text: 'Экспортировать историю', icon: 'history', variant: 'outline', onClick: exportRuneHistory }) : null
  );
}

function toggleRuneFavorite(name) {
  const values = new Set(state.runeFavorites);
  values.has(name) ? values.delete(name) : values.add(name);
  state.runeFavorites = [...values];
  writeJSON('nastardamus-rune-favorites-v1', state.runeFavorites);
  personalStore('save_rune_preferences', { favorites: state.runeFavorites, preferredSpread: state.runeSpread, reversedEnabled: true }).catch(() => {});
  pulse(); render();
}

function exportRuneHistory() {
  const data = readJSON(JOURNAL_KEY, []).filter((entry) => entry.kind === 'runes' && !entry.deletedAt);
  const url = URL.createObjectURL(new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), readings: data }, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = `nastardamus-runes-${personalDateKey()}.json`; link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}

function russianCount(value, forms) {
  const count = Math.abs(Number(value)) % 100;
  const last = count % 10;
  if (count > 10 && count < 20) return forms[2];
  if (last === 1) return forms[0];
  if (last >= 2 && last <= 4) return forms[1];
  return forms[2];
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
  if (!confirmServicePayment('rune_reading')) return;
  const spread = RUNE_SPREADS.find((item) => item.id === state.runeSpread) || RUNE_SPREADS[1];
  state.runeCount = spread.count;
  state.runeSelection = castRuneSpread(spread.id, () => cryptoIndex(1_000_000) / 1_000_000, 12);
  state.runeResult = null;
  state.runeDialogueMessages = [];
  state.busy = true;
  render();
  try {
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const reading = await requestReading('rune_reading', {
      question,
      runes: state.runeSelection.map((rune) => `${rune.position}: ${rune.name}${rune.reversed ? ' (перевёрнутая)' : ''}`)
    }, '', { structured: true });
    state.runeResult = reading.result;
    const saved = {
      id: uniqueId('runes'), kind: 'runes', type: 'Руны', title: question,
      body: reading.answer, result: reading.result, createdAt: new Date().toISOString(), favorite: false
    };
    state.result = saved;
    await saveCloudReading(saved, { subtype: `${state.runeCount}-runes`, input: { question, spread: state.runeSpread, runes: state.runeSelection.map((rune) => ({ name: rune.name, position: rune.position, reversed: rune.reversed })) } });
    pulse('medium');
  } catch (error) {
    notify(apiErrorMessage(error));
  } finally {
    state.busy = false;
    render();
  }
}

async function sendRuneFollowup() {
  const message = state.runeDialogueDraft.trim().replace(/\s+/g, ' ');
  if (message.length < 3 || !state.runeResult || state.runeDialogueSending) return;
  const used = state.runeDialogueMessages.filter((item) => item.role === 'user').length;
  if (used >= 5 && !confirmServicePayment('rune_reading')) return;
  state.runeDialogueDraft = '';
  state.runeDialogueMessages.push({ role: 'user', content: message });
  state.runeDialogueSending = true; render();
  try {
    const answer = await requestReading('rune_reading', {
      question: `${state.runeQuestion}. Уточнение после расклада: ${message}`,
      runes: state.runeSelection.map((rune) => `${rune.position}: ${rune.name}${rune.reversed ? ' (перевёрнутая)' : ''}`)
    });
    state.runeDialogueMessages.push({ role: 'assistant', content: String(answer) });
    personalStore('save_esoterium_turn', {
      consultationId: state.result?.id || uniqueId('rune-dialogue'), mode: 'runes', stage: 'clarifying',
      title: state.runeQuestion, messages: state.runeDialogueMessages, summary: state.runeResult.headline, memory: `Рунический вопрос: ${state.runeQuestion}`
    }).catch(() => {});
  } catch (error) { notify(apiErrorMessage(error)); }
  finally { state.runeDialogueSending = false; render(); }
}

function amurScreen() {
  if (!['portal', 'profile', 'game'].includes(state.amurMode)) state.amurMode = 'portal';
  state.amurProfile ||= buildAmurProfile({ interests: state.profile.interests, goals: state.profile.goals, answers: state.amurAnswers, zodiac: state.horoscope.sign });
  const tabs = [['portal', 'Амур'], ['profile', 'Профиль'], ['game', 'Игра']];
  return shell([
    screenHeader('Амур', 'Игра, совместимость и приглашения', 'home'),
    h('nav', { className: 'amur-tabs', attrs: { 'aria-label': 'Разделы Амура' } }, tabs.map(([id, label]) => h('button', {
      className: state.amurMode === id ? 'is-active' : '', attrs: { type: 'button' }, on: { click: () => { state.amurMode = id; pulse(); render(); } }
    }, label))),
    state.amurMode === 'portal' ? amurPortalView() : null,
    state.amurMode === 'profile' ? amurProfileView() : null,
    state.amurMode === 'game' ? amurGameView() : null
  ], { active: 'amur' });
}

function amurPortalView() {
  const diceText = state.amurDice.length ? amurDiceMeaning(state.amurDice) : 'Два броска создают игровой образ вашей пары — без ставок и скрытых правил.';
  return h('div', { className: 'amur-view is-portal' },
    h('section', { className: 'premium-amur-hero' },
      h('img', { attrs: { src: premiumArtUrl('amur-dice'), alt: '' } }),
      h('div', {},
        h('p', { className: 'premium-kicker', text: 'ЗАКРЫТОЕ ПРОСТРАНСТВО ЗНАКОМСТВА' }),
        h('h1', { text: state.amurProfile?.completeness === 100 ? 'Ваш рисунок совместимости готов.' : 'Сначала — семь честных ответов.' }),
        h('p', { text: 'AMUR показывает только совместимые намерения и общие темы. Дата рождения, ответы и личные данные другим людям не раскрываются.' })
      )
    ),
    state.amurProfile?.completeness < 100 ? MysticButton({ text: `Создать скрытый профиль · ${state.amurProfile?.completeness || 0}%`, icon: 'heart', variant: 'gold', onClick: () => { state.amurMode = 'profile'; render(); } }) : amurDiscoveryCard(),
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
        state.amurMode = 'portal';
        navigate('compatibility-data');
      }, 'Подробно'),
      serviceTile('two-photo-compatibility', 'По фотографиям', 'Два образа и визуальная атмосфера', () => {
        state.amurMode = 'portal';
        state.photoMode = 'compatibility';
        navigate('photo-compat');
      }, serviceBadge('photo_compatibility')),
      serviceTile('energy-hands', 'По ладоням', 'Совместный рисунок двух ладоней', () => {
        state.amurMode = 'portal';
        if (state.publicConfig.palmLinkEnabled !== true) return notify('Совместимость по ладоням временно отключена администратором');
        openOracleRoomCreator('pair');
      }, serviceBadge('palmlink')),
      serviceTile('partner-invite-emblem', 'Личное приглашение', 'Карточка, ссылка и автоматическое ожидание данных', () => navigate('invite-start'), 'Для двоих')
    )
  );
}

function amurProfileView() {
  const step = Math.max(0, Math.min(AMUR_QUESTIONS.length, state.amurQuizStep));
  if (step >= AMUR_QUESTIONS.length || state.amurProfile?.completeness === 100 && step === 0) {
    return h('div', { className: 'amur-view is-profile' },
      h('section', { className: 'amur-profile-complete' }, h('span', { text: '♡' }), h('p', { className: 'premium-kicker', text: 'СКРЫТЫЙ ПРОФИЛЬ' }), h('h1', { text: 'Семь ответов собраны в один рисунок.' }), h('p', { text: 'AMUR использует намерение, темп, стиль диалога, интересы и цели. Другим людям виден только итог совместимости и совпавшие темы.' })),
      amurProfileSummary(),
      amurDiscoveryCard(),
      MysticButton({ text: 'Пройти заново', icon: 'sparkle', variant: 'outline', onClick: () => { state.amurQuizStep = 0; state.amurAnswers = {}; state.amurProfile = buildAmurProfile({}); render(); } })
    );
  }
  const question = AMUR_QUESTIONS[step];
  const answer = state.amurAnswers[question.id];
  return h('div', { className: 'amur-view is-profile' },
    h('section', { className: 'amur-quiz-card' },
      h('div', { className: 'amur-quiz-progress' }, h('span', { style: { width: `${((step + 1) / AMUR_QUESTIONS.length) * 100}%` } })),
      h('small', { text: `${step + 1} / ${AMUR_QUESTIONS.length}` }),
      h('h1', { text: question.title }),
      h('div', { className: 'amur-answer-grid' }, question.options.map(([id, label]) => h('button', {
        className: answer === id ? 'is-active' : '', attrs: { type: 'button', 'aria-pressed': answer === id ? 'true' : 'false' },
        on: { click: () => { state.amurAnswers[question.id] = id; writeJSON('nastardamus-amur-answers-v1', state.amurAnswers); pulse(); render(); } }
      }, h('span', { text: '✦' }), h('strong', { text: label }))))
    ),
    h('div', { className: 'personal-space-actions' },
      MysticButton({ text: 'Назад', icon: 'arrow-left', variant: 'outline', disabled: step === 0, onClick: () => { state.amurQuizStep = Math.max(0, step - 1); render(); } }),
      MysticButton({ text: step === AMUR_QUESTIONS.length - 1 ? 'Создать профиль' : 'Продолжить', icon: 'heart', variant: 'gold', disabled: !answer, onClick: completeAmurQuizStep })
    )
  );
}

function completeAmurQuizStep() {
  const question = AMUR_QUESTIONS[state.amurQuizStep];
  if (!question || !state.amurAnswers[question.id]) return notify('Выберите один вариант');
  if (state.amurQuizStep < AMUR_QUESTIONS.length - 1) { state.amurQuizStep += 1; pulse(); render(); return; }
  state.amurProfile = buildAmurProfile({ interests: state.profile.interests, goals: state.profile.goals, answers: state.amurAnswers, zodiac: state.horoscope.sign });
  state.amurQuizStep = AMUR_QUESTIONS.length;
  personalStore('upsert_amur_profile', { profile: state.amurProfile }).catch(() => notify('Профиль сохранён на устройстве'));
  pulse('medium'); render();
}

function amurProfileSummary() {
  const labels = Object.fromEntries(AMUR_QUESTIONS.flatMap((question) => question.options.map(([id, label]) => [`${question.id}:${id}`, label])));
  return h('div', { className: 'amur-profile-summary' }, AMUR_QUESTIONS.map((question) => h('div', {}, h('small', { text: question.title }), h('strong', { text: labels[`${question.id}:${state.amurAnswers[question.id]}`] || 'Не указано' }))));
}

function amurDiscoveryCard() {
  return MysticCard({ className: 'amur-discovery-card', children: [
    h('span', { className: 'amur-discovery-card__seal', text: '♡' }),
    h('div', {}, h('strong', { text: state.amurDiscovery ? 'Поиск открыт' : 'Поиск скрыт' }), h('p', { text: state.amurDiscovery ? 'AMUR ищет совпадения без раскрытия личных ответов.' : 'Профиль не показывается, пока вы сами не откроете поиск.' })),
    h('button', { attrs: { type: 'button', 'aria-pressed': state.amurDiscovery ? 'true' : 'false' }, on: { click: toggleAmurDiscovery } }, state.amurDiscovery ? 'Закрыть' : 'Открыть поиск'),
    !state.amurDiscovery ? h('label', { className: 'amur-adult-consent' }, (() => { const input = h('input', { attrs: { type: 'checkbox' }, on: { change: (event) => { state.amurAdultConfirmed = event.target.checked; writeJSON('nastardamus-amur-adult-v1', state.amurAdultConfirmed); render(); } } }); input.checked = state.amurAdultConfirmed; return input; })(), h('span', { text: 'Мне исполнилось 18 лет; я принимаю правила приватности и безопасного общения.' })) : null,
    state.amurCandidates.length ? h('div', { className: 'amur-candidate-list' }, state.amurCandidates.map((candidate, index) => h('article', {}, h('span', { text: '♡' }), h('span', {}, h('strong', { text: `Созвучие ${index + 1}` }), h('small', { text: [...candidate.sharedInterests, ...candidate.sharedGoals].slice(0, 3).join(' · ') || 'Совпадение стиля общения' })), h('b', { text: `${candidate.score}%` })))) : null
  ] });
}

async function toggleAmurDiscovery() {
  if (!state.amurProfile?.discoverable) return notify('Сначала завершите семь вопросов');
  if (!state.amurDiscovery && !state.amurAdultConfirmed) return notify('Подтвердите возраст 18+ и правила приватности');
  if (!state.amurDiscovery && !window.confirm('Открыть обезличенный поиск совпадений? Имя, дата рождения и ответы останутся скрытыми.')) return;
  state.amurDiscovery = !state.amurDiscovery;
  render();
  try {
    const data = await personalStore('set_amur_discovery', { enabled: state.amurDiscovery, adultConfirmed: state.amurAdultConfirmed, profile: state.amurProfile });
    state.amurCandidates = Array.isArray(data.candidates) ? data.candidates : [];
  } catch { notify('Настройка действует на этом устройстве'); }
  render();
}

function amurGameView() {
  const step = Math.min(state.amurGameStep, AMUR_GAME_QUESTIONS.length);
  if (step >= AMUR_GAME_QUESTIONS.length) {
    return h('div', { className: 'amur-view is-game' },
      h('section', { className: 'amur-game-complete' }, h('span', { text: '♡' }), h('p', { className: 'premium-kicker', text: 'ПЯТЬ ВОПРОСОВ ПРОЙДЕНЫ' }), h('h1', { text: 'Теперь разговор можно открыть взаимно.' }), h('p', { text: 'Ответы остаются внутри защищённой игры. Обычный чат открывается только после явного согласия обоих участников.' })),
      MysticButton({ text: 'Пригласить человека в игру', icon: 'send', variant: 'gold', onClick: () => navigate('invite-start') }),
      MysticButton({ text: 'Пройти новую игру', icon: 'sparkle', variant: 'outline', onClick: () => { state.amurGameStep = 0; state.amurGameAnswers = []; render(); } })
    );
  }
  const draft = state.amurGameAnswers[step] || '';
  return h('div', { className: 'amur-view is-game' },
    h('section', { className: 'amur-game-card' }, h('small', { text: `ЗАЩИЩЁННЫЙ ВОПРОС ${step + 1} / ${AMUR_GAME_QUESTIONS.length}` }), h('h1', { text: AMUR_GAME_QUESTIONS[step] }), field('Ваш ответ', textarea({ value: draft, placeholder: 'Ответ виден только внутри этой игры…', maxLength: 700, onInput: (value) => { state.amurGameAnswers[step] = value; } }))),
    MysticButton({ text: step === AMUR_GAME_QUESTIONS.length - 1 ? 'Завершить игру' : 'Сохранить и продолжить', icon: 'heart', variant: 'gold', onClick: () => { if (String(state.amurGameAnswers[step] || '').trim().length < 3) return notify('Добавьте короткий честный ответ'); state.amurGameStep += 1; pulse(); render(); } }),
    h('p', { className: 'premium-info-note', text: 'AMUR не публикует ответы в профиле и не открывает обычный чат без взаимного согласия.' })
  );
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
  return shell([
    screenHeader('Путь двух судеб', 'Живая совместимость по ладоням', state.amurMode === 'palm' ? 'amur' : 'compatibility'),
    palmCompatibilityInviteCard(null, { preview: true }),
    MysticCard({ className: 'premium-form-card', children: [
      h('h2', { text: 'Теперь каждый показывает свою ладонь сам' }),
      h('p', { text: 'Создайте именное приглашение. Вы и второй участник отдельно пройдёте закрытую подготовку, а после готовности обоих Эзотериум откроет общий прогноз и прямой разговор.' })
    ] }),
    h('div', { className: 'premium-palm-actions' },
      MysticButton({ text: 'Создать живое приглашение', icon: 'send', variant: 'gold', onClick: () => openOracleRoomCreator('pair') }),
      MysticButton({ text: 'Мои комнаты', icon: 'history', variant: 'primary', onClick: () => { navigate('palm-rooms'); loadOracleRooms({ force: true }); } })
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
    ...Object.fromEntries(Object.entries(INVITATION_GOALS).map(([key, item]) => [key, item.thought]))
  }[goal];
  const flowName = flow === 'tarot' ? 'расклад на двоих' : flow === 'photo' ? 'чтение совместимости' : 'ритуал «Путь двух судеб»';
  const username = String(state.publicConfig.botUsername || 'BelonTip_bot').replace(/^@/, '');
  const inviteUrl = new URL(`https://t.me/${username}`);
  inviteUrl.searchParams.set('start', `invite_${flow}_${goal}`);
  const text = `${copy}\n\nПрисоединяйся к ${flowName} в Nastardamus — Эзотериум проведёт нас через знаки.`;
  try {
    const image = await fetch(invitationArtworkUrl(goal)).then((response) => response.ok ? response.blob() : null).catch(() => null);
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
    attrs: { src: invitationArtworkUrl(goal), alt: '', draggable: 'false' }
  }),
  h('div', { className: 'premium-invitation-preview__scrim' }),
  h('img', {
    className: 'premium-invitation-preview__portrait',
    attrs: { src: premiumArtUrl(portrait), alt: '', draggable: 'false' }
  }),
  h('div', { className: 'premium-invitation-preview__copy' },
    h('small', { text: 'ЛИЧНОЕ ПРИГЛАШЕНИЕ' }),
    h('strong', { text: name ? `Для ${name}` : 'Укажите имя' }),
    h('span', { text: invitationThought(goal) })
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
      if (state.publicConfig.palmLinkEnabled !== true) return notify('Совместимость по ладоням временно отключена администратором');
      openOracleRoomCreator('pair');
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
  return `${name}, ${invitationThought(goal)}\n\nОткрой личное приглашение — остальное Эзотериум проведёт по шагам.`;
}

async function buildInvitationCardFile({ name, gender, goal }) {
  const [background, portrait] = await Promise.all([
    loadImage(invitationArtworkUrl(goal)),
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
  context.font = '500 19px system-ui, sans-serif';
  context.fillText(invitationThought(goal), 44, 634, 454);
  context.fillStyle = '#f0c76e';
  context.font = '700 15px system-ui, sans-serif';
  context.fillText('NASTARDAMUS · ПУТЬ ДВУХ СУДЕБ', 44, 676);
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
    ...(Array.isArray(invitation.resultPayload?.visualProfiles)
      ? invitation.resultPayload.visualProfiles.map((item) => visualProfileCard(item.profile, item.name, { allowProfileSave: false }))
      : []),
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
    ...(Array.isArray(result.result?.visualProfiles)
      ? result.result.visualProfiles.map((item) => visualProfileCard(item.profile, item.name, { allowProfileSave: false }))
      : []),
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

function resultScreen({ title, subtitle, back, result, showCards = false, contextCards = [] }) {
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
    ...contextCards,
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

function visualProfileCard(profile, name = '', _options = {}) {
  const gender = profile?.perceivedGender === 'female'
    ? 'Предположительно женский образ'
    : profile?.perceivedGender === 'male'
      ? 'Предположительно мужской образ'
      : 'Пол по этому снимку неясен';
  const confidence = ({ high: 'высокая', medium: 'средняя', low: 'низкая' })[profile?.genderConfidence] || 'не указана';
  const evidence = Array.isArray(profile?.visibleEvidence) ? profile.visibleEvidence.slice(0, 4) : [];
  return MysticCard({ className: 'premium-visual-profile', children: [
    h('div', { className: 'premium-visual-profile__head' },
      h('span', {}, Icon('profile', { size: 24 })),
      h('div', {}, h('small', { text: name ? `ОБРАЗ · ${name.toUpperCase()}` : 'ОБРАЗ ПО ФОТО' }), h('strong', { text: gender }))
    ),
    h('p', { className: 'premium-visual-profile__confidence', text: `Уверенность: ${confidence}. Это описание относится только к текущему снимку и не меняет ваш профиль.` }),
    evidence.length ? h('div', { className: 'premium-visual-profile__evidence' }, evidence.map((item) => h('span', { text: item }))) : null,
    h('div', { className: 'premium-visual-profile__persona' },
      h('small', { text: 'ВПЕЧАТЛЕНИЕ О ХАРАКТЕРЕ ОБРАЗА' }),
      h('p', { text: profile?.personaImpression || 'Недостаточно видимых признаков для выразительного впечатления.' }),
      profile?.personaBasis ? h('em', { text: profile.personaBasis }) : null
    ),
    h('p', { className: 'premium-visual-profile__limitation', text: profile?.limitation || 'Внешний образ не доказывает гендерную идентичность или устойчивые черты личности.' })
  ] });
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
    const data = await api('/api/proxy', {
      method: 'POST',
      body: {
        action: 'save_reading',
        readingId: /^[0-9a-f-]{36}$/i.test(readingId) ? readingId : undefined,
        kind: result.kind || 'photo',
        subtype: subtype || result.mode || result.kind || 'reading',
        title: result.title || result.type || 'Символическое чтение',
        input,
        result: {
          ...(result.result || {}),
          ui: {
            type: result.type || '',
            mode: result.mode || '',
            spread: result.spread || '',
            cards: Array.isArray(result.cards) ? result.cards : [],
            positions: Array.isArray(result.positions) ? result.positions : [],
            participants: Array.isArray(result.participants) ? result.participants : [],
            score: Number.isFinite(Number(result.score)) ? Number(result.score) : null,
            aspects: Array.isArray(result.aspects) ? result.aspects : []
          }
        },
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
  const result = reading.result || {};
  const ui = result.ui && typeof result.ui === 'object' ? result.ui : {};
  return {
    id: reading.id,
    kind: reading.kind,
    mode: ui.mode || reading.subtype,
    type: ui.type || ({
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
    result,
    spread: ui.spread || reading.subtype,
    cards: Array.isArray(ui.cards) ? ui.cards : [],
    positions: Array.isArray(ui.positions) ? ui.positions : [],
    participants: Array.isArray(ui.participants) ? ui.participants : [],
    score: Number.isFinite(Number(ui.score ?? result.score)) ? Number(ui.score ?? result.score) : null,
    aspects: Array.isArray(ui.aspects) && ui.aspects.length
      ? ui.aspects
      : Array.isArray(result.aspects) ? result.aspects : [],
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
    const data = await api('/api/proxy', {
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
    api('/api/proxy', {
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
  if (['compatibility', 'amur'].includes(historyKind(entry))) return navigate('compatibility-data-result');
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
  const cloud = state.cloudReadings.find((item) => item.id === id);
  const target = cloud || entry;
  if (!target) return;
  const title = window.prompt('Новое название результата', target.title || '');
  if (title === null) return;
  const clean = title.trim().slice(0, 120);
  if (!clean) return notify('Название не может быть пустым');
  if (entry) entry.title = clean;
  if (state.result?.id === id) state.result.title = clean;
  writeJSON(JOURNAL_KEY, entries);
  if (cloud) {
    cloud.title = clean;
    api('/api/proxy', {
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
  const cloud = state.cloudReadings.find((item) => item.id === id);
  if (!entry && !cloud) return;
  if (entry) entry.deletedAt = new Date().toISOString();
  writeJSON(JOURNAL_KEY, entries);
  if (cloud) {
    state.cloudReadings = state.cloudReadings.filter((item) => item.id !== id);
    api('/api/proxy', {
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
  const vip = activeProfileVip();
  const giftCount = entitlements.reduce((total, item) => total + Math.max(0, Number(item.quantity) || 0), 0);
  return shell([
    screenHeader('Личный круг', 'Счёт · доступ · настройки', 'home'),
    profileCabinetHero(wallet, vip),
    profileSectionTabs({ wallet, vip, giftCount }),
    h('section', {
      className: `profile-cabinet-panel profile-cabinet-panel--${state.profileSection}`,
      attrs: { id: 'profile-cabinet-panel', role: 'tabpanel', tabindex: '-1' }
    }, profileSectionContent({ wallet, ledger, entitlements, vip })),
    profileOverlay({ ledger })
  ], { active: 'profile' });
}

function activeProfileVip() {
  const vip = state.wallet?.vip;
  if (!vip) return null;
  const expiry = Date.parse(vip.expiresAt || '');
  return Number.isFinite(expiry) && expiry <= Date.now() ? null : vip;
}

function profileCabinetHero(wallet, vip) {
  const ready = state.walletStatus === 'ready';
  const amount = ready ? formatMoney(wallet.available) : '—';
  const reserve = ready && Number(wallet.locked) > 0 ? `${formatMoney(wallet.locked)} SILARUM` : '';
  return h('section', { className: 'profile-cabinet-hero' },
    h('div', { className: 'profile-cabinet-hero__identity' },
      h('button', {
        className: 'profile-cabinet-avatar',
        attrs: { type: 'button', 'aria-label': 'Изменить фото профиля' },
        on: { click: () => openProfileOverlay('avatar') }
      }, h('img', { attrs: { src: profileAvatar(), alt: '' } }), h('span', { attrs: { 'aria-hidden': 'true' }, text: '✦' })),
      h('div', {},
        h('small', { className: 'premium-kicker', text: 'ЛИЧНЫЙ КРУГ' }),
        h('h1', { text: firstName() }),
        h('div', { className: 'profile-access-line' },
          vip ? h('span', { className: 'profile-vip-mark', text: 'VIP' }) : null,
          vip ? h('small', { text: 'Действует до' }) : h('small', { text: 'Базовый доступ' }),
          vip ? h('b', { text: formatDate(vip.expiresAt) }) : null
        )
      )
    ),
    h('div', { className: 'profile-cabinet-hero__balance' },
      h('span', {}, h('small', { text: 'SILARUM' }), h('strong', { text: amount })),
      availableTopupMethods(state.wallet?.config).length
        ? h('button', { attrs: { type: 'button' }, on: { click: () => navigate('topup') } }, h('span', { text: '+' }), h('b', { text: 'Пополнить' }))
        : null,
      reserve ? h('em', {}, h('span', { text: 'В резерве' }), h('b', { text: reserve })) : null
    )
  );
}

function profileSectionTabs({ wallet, vip, giftCount }) {
  const clockLabel = CLOCK_STYLES.find((item) => item.id === currentClockStyle())?.label || 'Каллиграфия';
  const ready = state.walletStatus === 'ready';
  const sections = [
    { id: 'wallet', icon: 'coin', label: 'SILARUM', value: ready ? formatMoney(wallet.available) : '—' },
    { id: 'access', icon: 'sparkle', label: 'Доступ', value: vip ? 'VIP' : 'Базовый' },
    { id: 'gifts', icon: 'wheel', label: 'Дары', value: String(giftCount) },
    { id: 'settings', icon: 'orbit', label: 'Среда', value: `${state.locale.toLocaleUpperCase('en')} · ${clockLabel}` }
  ];
  return h('nav', { className: 'profile-command-grid', attrs: { role: 'tablist', 'aria-label': 'Разделы личного круга' } },
    sections.map((section) => h('button', {
      className: state.profileSection === section.id ? 'is-active' : '',
      attrs: {
        type: 'button', role: 'tab', 'aria-selected': state.profileSection === section.id ? 'true' : 'false',
        'aria-controls': 'profile-cabinet-panel'
      },
      on: { click: () => selectProfileSection(section.id) }
    },
    h('span', { className: 'profile-command-grid__icon' }, Icon(section.icon, { size: 21 })),
    h('span', {}, h('small', { text: section.label }), h('strong', { text: section.value }))
    ))
  );
}

function selectProfileSection(section) {
  if (!['wallet', 'access', 'gifts', 'settings'].includes(section) || state.profileSection === section) return;
  state.profileSection = section;
  pulse();
  render();
}

function profileSectionContent(context) {
  if (state.profileSection === 'access') return profileAccessPanel(context.vip);
  if (state.profileSection === 'gifts') return profileGiftsPanel(context.entitlements);
  if (state.profileSection === 'settings') return profileSettingsPanel();
  return profileWalletPanel(context.wallet, context.ledger);
}

function profilePanelHead(kicker, title, action = null) {
  return h('header', { className: 'profile-panel-head' },
    h('div', {}, h('small', { text: kicker }), h('h2', { text: title })),
    action
  );
}

function profileWalletPanel(wallet, ledger) {
  if (state.walletStatus === 'loading') {
    return [
      profilePanelHead('SILARUM', 'Сверяем движение средств'),
      h('div', { className: 'profile-panel-body profile-wallet-skeleton', attrs: { 'aria-label': 'Счёт загружается' } },
        h('span'), h('span'), h('span')
      )
    ];
  }
  if (state.walletStatus === 'error') {
    return [
      profilePanelHead('SILARUM', 'Счёт не синхронизирован'),
      h('div', { className: 'profile-panel-body profile-state-message' },
        h('span', { className: 'profile-state-message__seal', attrs: { 'aria-hidden': 'true' }, text: '◇' }),
        h('p', { text: state.walletMessage || 'Счёт доступен внутри Telegram' }),
        MysticButton({ text: 'Повторить', icon: 'coin', variant: 'gold', onClick: () => loadWallet({ force: true }) })
      )
    ];
  }

  const actions = [];
  if (availableTopupMethods(state.wallet?.config).length) {
    actions.push(MysticButton({ text: 'Пополнить', icon: 'coin', variant: 'primary', onClick: () => navigate('topup') }));
  }
  if (state.wallet?.config?.withdrawalsEnabled) {
    actions.push(MysticButton({ text: 'Обменять', icon: 'payment', variant: 'gold', onClick: () => navigate('withdrawal') }));
  }
  actions.push(h('button', {
    className: 'profile-refresh-button', attrs: { type: 'button', 'aria-label': 'Обновить счёт', title: 'Обновить счёт' },
    on: { click: () => loadWallet({ force: true }) }
  }, Icon('orbit', { size: 21 })));

  return [
    profilePanelHead('SILARUM', 'Движение средств'),
    h('div', { className: 'profile-panel-body' },
      h('div', { className: 'profile-wallet-strip' },
        h('div', {}, h('small', { text: 'Свободно' }), h('strong', { text: formatMoney(wallet.available) })),
        Number(wallet.locked) > 0 ? h('div', {}, h('small', { text: 'В резерве' }), h('strong', { text: formatMoney(wallet.locked) })) : null,
        h('div', {}, h('small', { text: 'Колесо' }), h('strong', { text: String(wallet.freeSpins || 0) }))
      ),
      h('div', { className: 'profile-inline-actions' }, actions),
      ledger.length
        ? h('div', { className: 'profile-ledger-preview' }, ledger.slice(0, 3).map(profileLedgerLine))
        : h('div', { className: 'profile-quiet-empty' }, h('span', { text: '◇' }), h('p', { text: 'Здесь появятся начисления и списания.' })),
      ledger.length > 3 ? h('button', { className: 'profile-text-action', attrs: { type: 'button' }, on: { click: () => openProfileOverlay('ledger') }, text: 'Все операции' }) : null
    )
  ];
}

function profileLedgerLine(entry) {
  const labels = { purchase: 'Покупка SILARUM', service_charge: 'Оплата практики', wheel_prize: 'Дар Колеса', referral_commission: 'Партнёрское начисление', withdrawal_hold: 'Средства в резерве', withdrawal_paid: 'Обмен выполнен', withdrawal_release: 'Средства возвращены', adjustment: 'Корректировка' };
  const positive = Number(entry.amount) >= 0;
  return h('div', { className: 'profile-ledger-line' },
    h('span', { className: positive ? 'is-positive' : '' }, Icon(positive ? 'coin' : 'payment', { size: 18 })),
    h('span', {}, h('strong', { text: labels[entry.type] || 'Операция' }), h('small', { text: formatDate(entry.createdAt) })),
    h('b', { className: positive ? 'is-positive' : '', text: `${Number(entry.amount) > 0 ? '+' : ''}${formatMoney(entry.amount)}` })
  );
}

function profileAccessPanel(vip) {
  const plans = state.wallet?.config?.vipPlans || [];
  if (vip) {
    return [
      profilePanelHead('VIP-КРУГ', 'Ваш доступ открыт'),
      h('div', { className: 'profile-panel-body' },
        h('div', { className: 'profile-vip-pass' },
          h('span', { className: 'profile-vip-pass__seal', attrs: { 'aria-hidden': 'true' }, text: '✦' }),
          h('div', {},
            h('small', { text: 'VIP АКТИВЕН' }),
            h('strong', { text: plans.find((plan) => plan.id === vip.planId)?.title || 'Пространство VIP' }),
            h('p', {}, h('span', { text: 'Действует до' }), ' ', h('b', { text: formatDate(vip.expiresAt) }))
          )
        ),
        plans.length ? h('div', { className: 'profile-vip-plans' }, plans.map(profileVipPlanButton)) : null
      )
    ];
  }
  return [
    profilePanelHead('VIP-КРУГ', plans.length ? 'Выберите глубину доступа' : 'Базовый доступ'),
    h('div', { className: 'profile-panel-body' },
      plans.length
        ? h('div', { className: 'profile-vip-plans' }, plans.map(profileVipPlanButton))
        : h('div', { className: 'profile-quiet-empty' }, h('span', { text: '✦' }), h('p', { text: 'Новые варианты VIP появятся здесь.' }))
    )
  ];
}

function profileVipPlanButton(plan) {
  return h('button', {
    className: 'profile-vip-plan',
    attrs: { type: 'button', disabled: state.busy ? true : null },
    on: { click: () => purchaseVip(plan) }
  },
  h('span', {},
    h('strong', { text: plan.title }),
    h('small', { text: plan.description || (plan.includedReadings ? `${plan.includedReadings} чтений` : 'VIP') })
  ),
  h('b', { text: `${formatMoney(plan.price)} S` })
  );
}

function profileGiftsPanel(entitlements) {
  return [
    profilePanelHead('ДАРЫ', entitlements.length ? 'Доступно без списания' : 'Ваши дары'),
    h('div', { className: 'profile-panel-body' },
      entitlements.length
        ? h('div', { className: 'profile-gift-list' }, entitlements.map((item) => h('button', {
          className: 'profile-gift-row', attrs: { type: 'button' }, on: { click: () => navigate(rewardScreen(item.service_id)) }
        },
        h('span', { className: 'profile-gift-row__seal' }, Icon('sparkle', { size: 20 })),
        h('span', {}, h('strong', { text: serviceConfig(item.service_id).title || item.service_id }), h('small', { text: `Доступно: ${item.quantity}` })),
        h('b', { text: 'Открыть' })
        )))
        : h('div', { className: 'profile-quiet-empty' }, h('span', { text: '◇' }), h('p', { text: 'Дары Колеса и приглашений появятся здесь.' }))
    )
  ];
}

function profileSettingsPanel() {
  return [
    profilePanelHead('СРЕДА', 'Настройте ощущение пространства'),
    h('div', { className: 'profile-panel-body profile-settings-body' },
      h('section', { className: 'profile-setting-block' },
        h('div', {}, h('strong', { text: 'Язык' }), h('small', { text: 'Меняет интерфейс и ответы Эзотериума' })),
        languagePicker()
      ),
      h('section', { className: 'profile-setting-block' },
        h('div', { className: 'profile-setting-block__clock-head' }, h('div', {}, h('strong', { text: 'Почерк часов' }), h('small', { text: 'Сохраняется на этом устройстве' })), celestialClock()),
        clockStylePicker()
      ),
      h('div', { className: 'profile-setting-links' },
        profileSettingLink('profile', 'Образ профиля', 'Сменить фото', () => openProfileOverlay('avatar')),
        profileSettingLink('orbit', 'Гороскоп дня', state.horoscope.enabled ? 'Ежедневный ритм включён' : 'Выбрать знак и ритм', () => navigate('horoscope')),
        profileSettingLink('history', 'Память, звук и графика', 'Приватность и атмосфера', () => navigate('space-settings')),
        profileSettingLink('info', 'Связь с поддержкой', 'Вопросы по приложению и оплате', () => navigate('support'))
      )
    )
  ];
}

function profileSettingLink(icon, title, subtitle, onClick) {
  return h('button', { attrs: { type: 'button' }, on: { click: onClick } },
    h('span', {}, Icon(icon, { size: 20 })),
    h('span', {}, h('strong', { text: title }), h('small', { text: subtitle })),
    h('b', { attrs: { 'aria-hidden': 'true' }, text: '›' })
  );
}

function openProfileOverlay(kind) {
  if (!['avatar', 'ledger'].includes(kind)) return;
  state.profileOverlay = kind;
  pulse();
  render();
  window.setTimeout(() => document.querySelector('.profile-sheet__close')?.focus(), 0);
}

function closeProfileOverlay() {
  state.profileOverlay = '';
  render();
}

function profileOverlay({ ledger }) {
  if (!state.profileOverlay) return null;
  const isLedger = state.profileOverlay === 'ledger';
  const title = isLedger ? 'Все операции' : 'Образ профиля';
  return h('div', {
    className: 'profile-sheet-layer',
    attrs: { role: 'presentation' },
    on: { click: (event) => { if (event.target === event.currentTarget) closeProfileOverlay(); } }
  },
  h('section', { className: 'profile-sheet', attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': title } },
    h('header', {},
      h('div', {}, h('small', { text: 'ЛИЧНЫЙ КРУГ' }), h('h2', { text: title })),
      h('button', { className: 'profile-sheet__close', attrs: { type: 'button', 'aria-label': 'Закрыть' }, on: { click: closeProfileOverlay } }, '×')
    ),
    h('div', { className: 'profile-sheet__body' },
      isLedger
        ? (ledger.length ? h('div', { className: 'profile-ledger-full' }, ledger.map(profileLedgerLine)) : h('div', { className: 'profile-quiet-empty' }, h('p', { text: 'Операций пока нет.' })))
        : profileAvatarEditor()
    )
  ));
}

async function purchaseVip(plan) {
  if (state.busy) return;
  if (!window.confirm(`Подключить «${plan.title}» за ${formatMoney(plan.price)} SILARUM?`)) return;
  state.busy = true; render();
  try {
    const data = await api('/api/wallet', {
      method: 'POST',
      body: { action: 'purchase_vip', planId: plan.id, idempotencyKey: uniqueId('vip') }
    });
    state.wallet = data;
    state.walletStatus = 'ready';
    notify(`VIP подключён до ${formatDate(data.vip?.expiresAt || data.subscription?.expiresAt)}`);
  } catch (error) {
    if (error?.message === 'insufficient_funds') {
      state.topupAmount = String(Math.max(1, Number(plan.price || 0) - Number(state.wallet?.wallet?.available || 0)));
      state.topupReturnScreen = 'profile';
      navigate('topup');
    }
    notify(apiErrorMessage(error));
  } finally { state.busy = false; render(); }
}

function profileAvatarEditor() {
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
  return h('div', { className: 'profile-avatar-editor' },
    h('div', { className: 'profile-avatar-editor__portrait' },
      h('span', { attrs: { 'aria-hidden': 'true' } }),
      h('img', { attrs: { src: profileAvatar(), alt: 'Фото профиля' } })
    ),
    h('div', { className: 'profile-avatar-editor__copy' },
      h('h3', { text: firstName() }),
      h('p', { text: state.profile.avatarUrl ? 'Выбран ваш личный образ.' : state.profile.telegramAvatarUrl || tg?.initDataUnsafe?.user?.photo_url ? 'Используется фотография из Telegram.' : 'Используется знак Эзотериума.' })
    ),
    h('div', { className: 'profile-avatar-editor__actions' },
      input,
      MysticButton({ text: 'Выбрать фото', icon: 'upload-cloud', variant: 'primary', disabled: state.busy, onClick: () => input.click() }),
      state.profile.avatarUrl ? MysticButton({ text: 'Вернуть из Telegram', icon: 'profile', variant: 'outline', disabled: state.busy, onClick: removeProfileAvatar }) : null
    )
  );
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

function availableTopupMethods(config = {}) {
  const methods = [];
  if (config.sbpTopupsEnabled === true) methods.push({ id: 'sbp', provider: 'sbp', label: 'СБП' });
  if (config.paymentMethods?.stars?.enabled === true) methods.push({ id: 'stars', provider: 'telegram_stars', label: 'Telegram Stars' });
  return methods;
}

function externalProviderLabel(provider) {
  return ({ telegram_stars: 'Telegram Stars', ton: 'TON', usdt: 'USDT' })[provider] || provider;
}

function topupScreen() {
  const config = state.wallet?.config || {};
  const methods = availableTopupMethods(config);
  if (!methods.some((method) => method.id === state.topupMethod)) state.topupMethod = methods[0]?.id || 'sbp';
  const selectedMethod = methods.find((method) => method.id === state.topupMethod);
  const topups = state.wallet?.topups || [];
  const externalPayments = state.wallet?.externalPayments || [];
  const activeOrder = selectedMethod?.id === 'sbp'
    ? topups.find((order) => ['pending', 'awaiting_confirmation'].includes(order.status))
    : externalPayments.find((order) => order.provider === selectedMethod?.provider && order.status === 'pending' && order.paymentUrl);
  const minimum = selectedMethod?.id === 'sbp' ? Number(config.sbpMinimumSilarum || 10) : 1;
  const maximum = selectedMethod?.id === 'sbp' ? Number(config.sbpMaximumSilarum || 1000) : 1_000_000;
  const rate = selectedMethod?.id === 'sbp'
    ? Number(config.sbpRoublesPerSilarum || 0)
    : Number(config.paymentRates?.starsPerSilarum || 0);
  const amount = Number(state.topupAmount || minimum);
  const providerTotal = Number.isFinite(amount) && amount > 0 ? amount * rate : 0;

  if (!methods.length) {
    return shell([
      screenHeader('Покупка SILARUM', 'Доступные способы оплаты', state.topupReturnScreen || 'profile'),
      MysticCard({ className: 'premium-empty-state', children: [
        Icon('payment', { size: 44 }),
        h('h2', { text: 'Оплата пока не настроена' }),
        h('p', { text: 'Администратору нужно включить хотя бы один способ оплаты и указать курс. До этого заявки не создаются.' })
      ] })
    ], { active: 'profile' });
  }

  return shell([
    screenHeader('Купить SILARUM', `Оплата · ${selectedMethod?.label || ''}`, state.topupReturnScreen || 'profile'),
    methods.length > 1 ? h('div', { className: 'premium-filter-row' }, methods.map((method) => h('button', {
      className: `premium-filter-chip ${state.topupMethod === method.id ? 'is-active' : ''}`,
      attrs: { type: 'button' },
      on: { click: () => { state.topupMethod = method.id; render(); } },
      text: method.label
    }))) : null,
    MysticCard({ className: 'premium-wallet-summary', children: [
      h('small', { text: 'Ваш доступный баланс' }),
      h('strong', { text: `${formatMoney(state.wallet?.wallet?.available)} SILARUM` }),
      h('p', { text: selectedMethod?.id === 'sbp'
        ? `От ${formatMoney(minimum)} до ${formatMoney(maximum)} SILARUM · 1 SILARUM = ${formatMoney(rate)} ₽`
        : `1 SILARUM = ${formatMoney(rate)} Stars` })
    ] }),
    activeOrder
      ? selectedMethod?.id === 'sbp' ? topupOrderCard(activeOrder, config) : externalPaymentOrderCard(activeOrder)
      : MysticCard({ className: 'premium-form-card', children: [
      field('Количество SILARUM', textInput({
        type: 'number',
        value: state.topupAmount || String(minimum),
        attrs: { min: minimum, max: maximum, step: '0.01', inputmode: 'decimal' },
        onInput: (value) => { state.topupAmount = value; }
      })),
      h('div', { className: 'premium-topup-total' },
        h('small', { text: `К оплате · ${selectedMethod?.label}` }),
        h('strong', { text: `${formatMoney(providerTotal)} ${selectedMethod?.id === 'sbp' ? '₽' : 'Stars'}` })
      ),
      h('p', {
        className: 'premium-info-note',
        text: selectedMethod?.id === 'stars'
          ? 'Telegram откроет системное окно Stars. SILARUM зачислятся только после подтверждённой оплаты.'
          : config.sbpAutomatic
            ? 'После оплаты статус сверится автоматически, и SILARUM появятся на счёте без ручного подтверждения.'
            : 'Сначала создайте заявку. SILARUM зачислятся только после фактического поступления перевода и проверки.'
      })
    ] }),
    activeOrder
      ? MysticButton({ text: 'Обновить статус', icon: 'coin', variant: 'outline', onClick: () => loadWallet({ force: true }) })
      : MysticButton({ text: state.busy ? 'Создаём заявку…' : `Продолжить · ${selectedMethod?.label}`, icon: 'payment', variant: 'primary', disabled: state.busy, onClick: submitTopup }),
    topups.length ? SectionTitle({ text: 'Последние пополнения' }) : null,
    topups.length ? h('div', { className: 'premium-ledger' }, topups.slice(0, 5).map((order) =>
      MysticCard({ className: 'premium-ledger-row', children: [
        Icon(order.status === 'paid' ? 'coin' : 'payment', { size: 24 }),
        h('span', {}, h('strong', { text: topupStatusLabel(order.status, order.verificationState) }), h('small', { text: `${order.reference} · ${formatDate(order.createdAt)}` })),
        h('b', { className: order.status === 'paid' ? 'is-positive' : '', text: `${formatMoney(order.silarum)} S` })
      ] })
    )) : null,
    externalPayments.length ? SectionTitle({ text: 'Оплаты через Telegram' }) : null,
    externalPayments.length ? h('div', { className: 'premium-ledger' }, externalPayments.slice(0, 5).map((order) =>
      MysticCard({ className: 'premium-ledger-row', children: [
        Icon(order.status === 'paid' ? 'coin' : 'payment', { size: 24 }),
        h('span', {}, h('strong', { text: topupStatusLabel(order.status) }), h('small', { text: `${externalProviderLabel(order.provider)} · ${order.reference}` })),
        h('b', { className: order.status === 'paid' ? 'is-positive' : '', text: `${formatMoney(order.silarum)} S` })
      ] })
    )) : null
  ], { active: 'profile' });
}

function externalPaymentOrderCard(order) {
  return MysticCard({ className: 'premium-topup-order', children: [
    h('p', { className: 'premium-kicker', text: topupStatusLabel(order.status).toUpperCase() }),
    h('h2', { text: `${formatMoney(order.providerAmount)} ${order.providerCurrency}` }),
    h('dl', { className: 'premium-payment-details' },
      h('div', {}, h('dt', { text: 'Способ' }), h('dd', { text: externalProviderLabel(order.provider) })),
      h('div', {}, h('dt', { text: 'Код заявки' }), h('dd', { text: order.reference })),
      h('div', {}, h('dt', { text: 'Будет зачислено' }), h('dd', { text: `${formatMoney(order.silarum)} SILARUM` }))
    ),
    order.paymentUrl ? MysticButton({
      text: 'Открыть оплату в Telegram', icon: 'payment', variant: 'gold',
      onClick: () => tg?.openInvoice ? tg.openInvoice(order.paymentUrl, () => loadWallet({ force: true })) : tg?.openLink ? tg.openLink(order.paymentUrl) : window.open(order.paymentUrl, '_blank', 'noopener')
    }) : null
  ] });
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
  const amount = Number(state.topupAmount || (state.topupMethod === 'sbp' ? state.wallet?.config?.sbpMinimumSilarum : 1));
  state.busy = true; render();
  try {
    const data = await api('/api/wallet', {
      method: 'POST',
      body: state.topupMethod === 'stars'
        ? { action: 'create_external_payment_order', provider: 'telegram_stars', amount, idempotencyKey: uniqueId('stars') }
        : { action: 'create_sbp_topup', amount, idempotencyKey: uniqueId('topup') }
    });
    state.wallet = data;
    state.walletStatus = 'ready';
    notify(state.topupMethod === 'stars'
      ? 'Счёт Stars создан. Откройте системное окно оплаты.'
      : data.order?.paymentUrl || data.order?.confirmation_url
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
        payload: { ...payload, locale: state.locale, gender: normalizeGender(payload?.gender || state.userGender) },
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
  const localizedBody = body && typeof body === 'object' && !Array.isArray(body)
    ? { ...body, locale: body.locale || state.locale }
    : body;
  const response = await fetch(path, {
    method,
    headers: { ...(localizedBody ? { 'Content-Type': 'application/json' } : {}), 'X-Telegram-Init-Data': tg?.initData || '' },
    body: localizedBody ? JSON.stringify(localizedBody) : undefined
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
    deepseek_not_configured: 'Текстовые ответы Эзотериума временно не настроены.',
    openai_not_configured: 'Фото-чтение Эзотериума временно не настроено.',
    vision_not_configured: 'Vision-сервис для фото ещё не настроен.',
    deepseek_provider_unavailable: 'Эзотериум временно не отвечает. Попробуйте немного позже.',
    openai_provider_unavailable: 'Эзотериум временно не отвечает. Попробуйте немного позже.',
    vision_provider_unavailable: 'Фото-чтение временно недоступно.',
    vision_image_unreadable: 'Фото получилось недостаточно чётким. Загрузите другое изображение при хорошем освещении.',
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
    payment_method_disabled: 'Этот способ оплаты сейчас отключён.',
    payment_rate_not_configured: 'Курс для этого способа оплаты ещё не настроен.',
    telegram_invoice_unavailable: 'Не удалось открыть счёт Telegram Stars. Попробуйте немного позже.',
    invalid_payment_provider: 'Выберите доступный способ оплаты.',
    invalid_vip_plan: 'Выберите доступный тариф VIP.',
    vip_plan_not_found: 'Этот тариф VIP больше недоступен.',
    vip_required: 'Для этого чтения нужен активный VIP.',
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
    invitation_processing_not_found: 'Состояние приглашения изменилось. Обновите страницу.',
    invalid_oracle_room_token: 'Ссылка на комнату повреждена.',
    invalid_oracle_room_mode: 'Не удалось определить тип комнаты.',
    invalid_oracle_room_text: 'Проверьте название и тему комнаты.',
    invalid_oracle_pair_invitation: 'Укажите имя приглашённого и главный вопрос пары.',
    invalid_oracle_relationship_type: 'Выберите тип отношений.',
    invalid_oracle_hand_profile: 'Укажите ведущую руку и сфотографированную ладонь.',
    invalid_oracle_private_answers: 'Проверьте ответы закрытой подготовки.',
    invalid_oracle_room_message: 'Напишите вопрос немного подробнее.',
    invalid_oracle_username: 'Введите корректный Telegram username.',
    oracle_username_unavailable: 'Этот username пока не найден среди пользователей Nastardamus.',
    oracle_room_consent_required: 'Подтвердите добровольное участие в разговоре.',
    oracle_room_not_found: 'Комната не найдена или ссылка больше недействительна.',
    oracle_room_invite_expired: 'Срок приглашения истёк. Попросите создателя открыть новую комнату.',
    oracle_room_closed: 'Эта комната уже завершена.',
    oracle_room_full: 'В комнате уже заняты все места.',
    oracle_room_started: 'Совместное чтение уже началось — новые участники больше не добавляются.',
    oracle_room_preparation_required: 'Общий разговор откроется после закрытой подготовки всех участников.',
    oracle_room_preparation_incomplete: 'Завершите фото, профиль руки и все личные ответы.',
    oracle_room_busy: 'Эзотериум отвечает на предыдущий вопрос. Подождите несколько секунд.',
    oracle_room_access_denied: 'У вас нет доступа к этой комнате.',
    oracle_room_self_invite: 'Вы уже находитесь в этой комнате.',
    oracle_room_owner_must_close: 'Создатель может только завершить комнату для всех.',
    oracle_room_turn_changed: 'Разговор уже продолжился. Обновите комнату.',
    oracle_palm_unavailable: 'Не удалось сохранить ладонь. Попробуйте другой снимок.',
    oracle_room_unavailable: 'Комната временно недоступна. Попробуйте открыть её ещё раз.',
    oracle_room_answer_unavailable: 'Эзотериум временно не ответил. Сообщение сохранено — повторите вопрос.'
  };
  return messages[error?.message] || 'Не удалось выполнить действие. Повторите попытку немного позже.';
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
    const data = await api('/api/proxy', {
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
        access: state.publicConfig.everythingFree === true
          ? 'Бесплатно'
          : ['only', 'vip_only'].includes(spread.vip_access)
            ? 'VIP'
            : Number(spread.free_checks || 0) > 0
              ? `${Number(spread.free_checks)} бесплатно`
              : Number(spread.price_units || 0) > 0 ? 'SILARUM' : 'Доступно',
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
        birthDate: preferences.birth_date || state.profile.birthDate,
        birthTime: String(preferences.birth_time || '').slice(0, 5) || state.profile.birthTime,
        birthTimeKnown: preferences.birth_time_known === true,
        interests: Array.isArray(preferences.interests) ? preferences.interests : state.profile.interests,
        goals: Array.isArray(preferences.goals) ? preferences.goals : state.profile.goals,
        consents: preferences.profile_consents && typeof preferences.profile_consents === 'object' ? preferences.profile_consents : state.profile.consents,
        natalChart: preferences.natal_chart && typeof preferences.natal_chart === 'object' ? preferences.natal_chart : state.profile.natalChart,
        avatarUrl: preferences.profile_avatar_url || state.profile.avatarUrl,
        telegramAvatarUrl: preferences.telegram_avatar_url
          || tg?.initDataUnsafe?.user?.photo_url
          || state.profile.telegramAvatarUrl,
        completed: Boolean(preferences.profile_completed_at || (birthYear && preferences.city))
      };
      state.natalDate = state.profile.birthDate || state.natalDate;
      state.natalTime = state.profile.birthTime || state.natalTime;
      state.natalTimeKnown = state.profile.birthTimeKnown;
      state.natalPlace = state.profile.city || state.natalPlace;
      state.initiationConsents = { ...state.initiationConsents, ...(state.profile.consents || {}) };
      writeJSON(HOROSCOPE_KEY, state.horoscope);
      writeJSON(PROFILE_KEY, { ...state.profile, gender: state.userGender });
    }
  } catch {
    // Local preference remains available if the profile endpoint is temporarily unavailable.
  }
  if (state.screen === 'welcome' || state.screen === 'profile' || state.screen === 'horoscope') render();
}

function uniqueId(prefix) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat(dateTimeLocale(state.locale), { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
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
    'palm-reading': palmReadingScreen, 'palm-room-create': oracleRoomCreateScreen,
    'palm-rooms': oracleRoomsScreen, 'palm-room': palmRoomScreen, runes: runeScreen,
    palm: palmScreen, ritual: ritualScreen, 'compatibility-result': compatibilityResultScreen,
    'invite-start': inviteStartScreen, 'invite-compose': inviteComposerScreen, invitation: invitationScreen,
    space: personalSpaceScreen, 'space-event': personalEventScreen, 'space-event-form': personalEventFormScreen,
    'space-goal': personalGoalScreen, 'space-goal-form': personalGoalFormScreen, 'space-consultation': personalConsultationScreen, 'space-settings': personalSettingsScreen,
    history: historyScreen, profile: profileScreen, topup: topupScreen, withdrawal: withdrawalScreen, support: supportScreen
  };
  if (!routes[state.screen]) state.screen = 'home';
  mount.dataset.screen = state.screen;
  const world = worldForScreen(state.screen);
  mount.dataset.world = world;
  const hour = new Date().getHours();
  document.documentElement.dataset.daypart = hour < 11 ? 'morning' : hour >= 19 ? 'evening' : 'day';
  applyDocumentLocale(state.locale);
  const themeColor = WORLD_META[world]?.themeColor || WORLD_META.core.themeColor;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor);
  tg?.setHeaderColor?.(themeColor);
  tg?.setBackgroundColor?.(themeColor);
  mount.replaceChildren(routes[state.screen]());
}

window.addEventListener('popstate', () => {
  const nextParams = new URLSearchParams(location.search);
  state.profileOverlay = '';
  state.screen = nextParams.get('screen') || 'home';
  const roomToken = nextParams.get('room') || '';
  if (/^[a-f0-9]{32}$/.test(roomToken) && roomToken !== state.oracleRoomToken) {
    state.oracleRoomToken = roomToken;
    state.oracleRoom = null;
    state.oracleRoomStatus = 'idle';
  }
  render();
  if (state.screen === 'palm-room' && state.oracleRoomToken) loadOracleRoom();
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || !state.profileOverlay) return;
  event.preventDefault();
  closeProfileOverlay();
});

function hideBootScreen() {
  document.documentElement.dataset.appReady = 'true';
  const boot = document.getElementById('boot-screen');
  if (!boot) return;
  boot.classList.add('is-hidden');
  window.setTimeout(() => boot.remove(), 260);
}

function updateVisibleClocks() {
  const parts = clockParts();
  document.querySelectorAll('[data-celestial-time]').forEach((node) => { node.textContent = parts.time; });
  document.querySelectorAll('[data-celestial-date]').forEach((node) => { node.textContent = parts.date; });
}

function loadTelegramData({ force = false } = {}) {
  if (!configureTelegram()) return false;
  loadPublicConfig();
  loadWallet({ force });
  loadPreferences();
  loadDailyGreeting({ force });
  loadReadingCatalog();
  loadCloudReadings({ force });
  loadPersonalSpace({ force });
  if (state.invitationToken) loadActiveInvitation({ accept: true });
  if (state.oracleRoomToken) loadOracleRoom();
  if (state.screen === 'palm-rooms') loadOracleRooms({ force });
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

window.setInterval(() => {
  if (state.screen === 'palm-room' && state.oracleRoomToken && document.visibilityState !== 'hidden') {
    loadOracleRoom({ silent: true });
  }
}, 2500);

window.setInterval(updateVisibleClocks, 1000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'hidden') updateVisibleClocks();
});

export { navigate, render, state, suggestGenderFromName };
