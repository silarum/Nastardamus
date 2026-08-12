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
import { homeJewelSvg } from './home-jewels.js';
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
import { DAILY_FREE_SERVICES, isDailyFreeService, recommendedDailyServices } from '../lib/daily-lifecycle.js';
import { THEME, TonConnectUI } from '@tonconnect/ui';

let tg = null;
let telegramConfigured = false;
let tonConnectUI = null;
let lastTonWalletSynced = '';

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
  'my-path': { background: '/images/worlds/my-path-living-thread.webp', themeColor: '#06111c' },
  profile: { background: '/images/worlds/my-path-living-thread.webp', themeColor: '#071019' },
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
  dailyAccess: {
    subscription: { configured: false, member: true, url: '', username: '', title: 'Канал Эзотериума' },
    dailyChoice: { used: false, serviceId: '', usedAt: null },
    pendingScreen: ''
  },
  wallet: null,
  walletStatus: 'loading',
  walletMessage: '',
  tonWallet: { status: 'loading', address: '', chain: '', walletApp: '' },
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
  readingDialogueId: '',
  readingDialogueMessages: [],
  readingDialogueDraft: '',
  readingDialogueSending: false,
  readingDialogueLoading: false,
  readingDialogueKind: 'question',
  readingDialogueNonce: '',
  readingDialogueAnsweredQuestions: 0,
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
    dialogueCatalog: {
      personal: { enabled: true, sectionFree: true, includedQuestions: 3, extraQuestionPrice: 0.1 },
      solo: { enabled: true, sectionFree: true, includedQuestions: 3, extraQuestionPrice: 0.1 },
      pair: { enabled: true, sectionFree: true, includedQuestions: 3, extraQuestionPrice: 0.1 },
      group: { enabled: true, sectionFree: true, includedQuestions: 5, extraQuestionPrice: 0.1 }
    },
    wheelRewards: [],
    wheelDailySpins: 1,
    dailyHoroscopeEnabled: true,
    subscriptionGateEnabled: false,
    subscriptionChannelUsername: '',
    subscriptionChannelTitle: 'Канал Эзотериума',
    tonTreasuryAddress: 'UQAVyNXcWPUm-24n7JMqIIjMjYN1bVMPXbNww29NNh-l1CyO',
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
    readingSection: 'path',
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
  oracleRoomMessageKind: 'question',
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
  if (
    isDailyFreeService(serviceId)
    && state.dailyAccess.subscription?.configured === true
    && state.dailyAccess.subscription?.member === true
    && state.dailyAccess.dailyChoice?.used !== true
  ) return true;
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
  if (screen === 'home' || screen === 'wheel' || screen === 'horoscope' || screen === 'daily-choice' || screen.startsWith('space')) return 'home';
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

function dialogueInitial(name = '') {
  return String(name || '?').trim().slice(0, 1).toLocaleUpperCase(state.locale);
}

function liveDialogueMessage(message, { viewerId = null, group = false } = {}) {
  if (message.role === 'system') return h('div', { className: 'esoterium-chat__system', text: message.content });
  const own = message.own === true || (viewerId !== null
    ? Number(message.senderTelegramId) === Number(viewerId)
    : message.role === 'user');
  const assistant = message.role === 'assistant';
  const senderName = assistant ? 'Эзотериум' : own ? firstName() || 'Вы' : message.senderName || 'Участник';
  const time = message.createdAt
    ? new Date(message.createdAt).toLocaleTimeString(dateTimeLocale(state.locale), { hour: '2-digit', minute: '2-digit' })
    : '';
  return h('article', { className: `esoterium-chat__message${own ? ' is-own' : ''}${assistant ? ' is-oracle' : ''}` },
    !own ? h('span', { className: 'esoterium-chat__avatar' }, assistant
      ? h('img', { attrs: { src: '/images/my-path/oracle-living-thread.webp', alt: '' } })
      : h('b', { text: dialogueInitial(senderName) })) : null,
    h('div', { className: 'esoterium-chat__bubble' },
      group || assistant ? h('strong', { className: 'esoterium-chat__sender', text: senderName }) : null,
      h('p', { text: message.content }),
      h('small', { className: 'esoterium-chat__time' }, time ? h('time', { text: time }) : null, own ? h('b', { attrs: { 'aria-label': 'Доставлено' }, text: '✓✓' }) : null)
    )
  );
}

function liveDialogue({
  messages = [], draft = '', onInput, onSend, sending = false, placeholder = 'Напишите Эзотериуму…',
  title = 'Эзотериум', subtitle = 'рядом и помнит разговор', group = false, viewerId = null,
  progress = '', compact = false, canWrite = true, sendLabel = 'Отправить'
} = {}) {
  const input = canWrite ? h('textarea', {
    attrs: { rows: compact ? 1 : 2, maxlength: 2000, placeholder, 'aria-label': placeholder },
    on: {
      input: (event) => onInput?.(event.currentTarget.value),
      keydown: (event) => {
        if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
          event.preventDefault();
          if (!sending) onSend?.();
        }
      }
    }
  }) : null;
  if (input) input.value = draft;
  return h('section', { className: `esoterium-chat${compact ? ' is-compact' : ''}${group ? ' is-group' : ''}`, attrs: { 'aria-label': group ? 'Групповой диалог с Эзотериумом' : 'Живой диалог с Эзотериумом' } },
    h('header', { className: 'esoterium-chat__topbar' },
      h('span', { className: 'esoterium-chat__oracle-avatar' }, h('img', { attrs: { src: '/images/my-path/oracle-living-thread.webp', alt: '' } }), h('i')),
      h('span', {}, h('strong', { text: title }), h('small', { text: subtitle })),
      progress ? h('b', { className: 'esoterium-chat__progress', text: progress }) : null
    ),
    h('div', { className: 'esoterium-chat__stream', attrs: { 'aria-live': 'polite' } },
      messages.map((message) => liveDialogueMessage(message, { viewerId, group })),
      sending ? h('article', { className: 'esoterium-chat__message is-oracle is-typing' },
        h('span', { className: 'esoterium-chat__avatar' }, h('img', { attrs: { src: '/images/my-path/oracle-living-thread.webp', alt: '' } })),
        h('div', { className: 'esoterium-chat__bubble' }, h('strong', { className: 'esoterium-chat__sender', text: 'Эзотериум' }), h('p', {}, h('i'), h('i'), h('i')))
      ) : null
    ),
    canWrite ? h('div', { className: 'esoterium-chat__composer' },
      h('button', { className: 'esoterium-chat__attach', attrs: { type: 'button', 'aria-label': 'Добавить вложение', disabled: true } }, '+'),
      input,
      h('button', { className: 'esoterium-chat__send', attrs: { type: 'button', 'aria-label': sendLabel, disabled: sending }, on: { click: onSend } }, Icon('send', { size: 20 }))
    ) : null
  );
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
          text: 'Выбрать бесплатную практику',
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
  pulse('medium');
  navigate('daily-choice');
}

function subscriptionRequired() {
  const subscription = state.dailyAccess.subscription || {};
  return subscription.configured === true && subscription.member !== true;
}

function subscriptionGateCard(purpose = 'ежедневную практику') {
  const subscription = state.dailyAccess.subscription || {};
  return MysticCard({ className: 'premium-subscription-gate', children: [
    h('span', { className: 'premium-subscription-gate__seal', text: '✦', attrs: { 'aria-hidden': 'true' } }),
    h('p', { className: 'premium-kicker', text: 'КЛЮЧ К ЕЖЕДНЕВНОМУ КРУГУ' }),
    h('h2', { text: `Подпишись, чтобы открыть ${purpose}` }),
    h('p', { text: `Канал «${subscription.title || 'Эзотериума'}» даёт Колесо Фортуны, гороскоп дня и одну бесплатную практику ежедневно.` }),
    subscription.url ? MysticButton({ text: 'Подписаться на канал', icon: 'send', variant: 'gold', onClick: openSubscriptionChannel }) : null,
    MysticButton({ text: state.busy ? 'Проверяем…' : 'Я подписался — проверить', icon: 'sparkle', variant: 'primary', disabled: state.busy, onClick: refreshSubscription })
  ] });
}

function openSubscriptionChannel() {
  const url = String(state.dailyAccess.subscription?.url || '');
  if (!url) return notify('Администратору нужно указать канал');
  if (tg?.openTelegramLink) tg.openTelegramLink(url);
  else if (tg?.openLink) tg.openLink(url);
  else window.open(url, '_blank', 'noopener');
}

async function refreshSubscription() {
  if (!tg?.initData || state.busy) return notify('Откройте приложение внутри Telegram');
  state.busy = true;
  render();
  try {
    await loadPreferences({ forceRender: false });
    notify(subscriptionRequired() ? 'Подписка пока не подтверждена' : 'Подписка подтверждена — ежедневный круг открыт');
  } catch (error) {
    notify(apiErrorMessage(error));
  } finally {
    state.busy = false;
    render();
  }
}

function dailyChoiceScreen() {
  const choice = state.dailyAccess.dailyChoice || {};
  const services = recommendedDailyServices(state.profile, state.dailyGreeting.date);
  if (subscriptionRequired()) {
    return shell([
      screenHeader('Практика дня', 'Один бесплатный выбор ежедневно', 'home'),
      subscriptionGateCard('практику дня')
    ], { active: 'home' });
  }
  return shell([
    screenHeader('Что выберешь сегодня?', 'Один бесплатный расклад или гадание в день', 'home'),
    MysticCard({ className: 'premium-practices-intro', children: [
      h('p', { className: 'premium-kicker', text: choice.used ? 'СЕГОДНЯШНИЙ ВЫБОР СДЕЛАН' : 'ЭЗОТЕРИУМ РЕКОМЕНДУЕТ' }),
      h('h2', { text: choice.used ? 'Знак дня уже открыт' : `${services[0].emoji} ${services[0].title}` }),
      h('p', { text: choice.used ? 'Завтра бесплатный круг обновится. Другие практики остаются доступны по вашему тарифу.' : services[0].copy })
    ] }),
    h('div', { className: 'premium-service-list daily-choice-list' }, services.map((service, index) =>
      h('button', {
        className: `premium-service-tile${index === 0 ? ' is-recommended' : ''}`,
        attrs: { type: 'button', disabled: choice.used ? true : null },
        on: { click: () => openDailyService(service.id) }
      },
      h('span', { className: 'premium-service-icon daily-choice-emoji', text: service.emoji }),
      h('span', {}, h('strong', { text: service.title }), h('small', { text: service.copy })),
      h('b', { className: 'premium-service-badge', text: index === 0 ? 'Для тебя' : 'Бесплатно' }))
    )),
    MysticButton({ text: 'Открыть гороскоп дня', icon: 'orbit', variant: 'outline', onClick: () => navigate('horoscope') }),
    MysticButton({ text: 'Испытать Колесо Фортуны', icon: 'wheel', variant: 'outline', onClick: () => navigate('wheel') })
  ], { active: 'home' });
}

function openDailyService(serviceId) {
  if (state.dailyAccess.dailyChoice?.used) return notify('Бесплатный выбор на сегодня уже использован');
  if (subscriptionRequired()) return render();
  if (serviceId === 'tarot') return selectTarotSpread('money-career');
  if (serviceId === 'tarot_relationship') return selectTarotSpread('love-relationship');
  if (serviceId === 'natal') {
    state.natalStage = 'data';
    state.natalDate = state.profile.birthDate || state.natalDate;
    state.natalTime = state.profile.birthTime || state.natalTime;
    state.natalPlace = state.profile.city || state.natalPlace;
    return navigate('natal');
  }
  if (serviceId === 'rune_reading') {
    state.runeSpread = 'one';
    state.runeView = 'spreads';
    state.runeResult = null;
    return navigate('runes');
  }
  navigate('palm-reading');
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
          MysticButton({ text: 'Продолжить', icon: 'sparkle', variant: 'primary', onClick: () => { state.welcomePhase = 2; pulse('medium'); render(); } })
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
      natalChart: buildNatalChart({
        date: state.profile.birthDate,
        time: state.profile.birthTime || '12:00',
        timeKnown: state.profile.birthTimeKnown,
        place: city
      }),
      completed: true
    };
    state.profile.consents = { ...state.initiationConsents, acceptedAt: new Date().toISOString() };
    writeJSON(PROFILE_KEY, { ...state.profile, gender: state.userGender, consents: { ...state.initiationConsents, acceptedAt: new Date().toISOString() } });
    writeJSON(HOROSCOPE_KEY, state.horoscope);
    if (tg?.initData) {
      const saved = await api('/api/preferences', {
        method: 'POST',
        body: profilePreferencePayload()
      });
      if (saved.access) {
        state.dailyAccess.subscription = { ...state.dailyAccess.subscription, ...(saved.access.subscription || {}) };
        state.dailyAccess.dailyChoice = { ...state.dailyAccess.dailyChoice, ...(saved.access.dailyChoice || {}) };
      }
    }
    pulse('medium');
    state.screen = tg?.initData ? 'daily-choice' : 'home';
    const url = new URL(location.href);
    url.searchParams.set('screen', state.screen);
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
    profileName: state.profile.name.trim(),
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
  h('img', { attrs: { src: '/images/my-path/today-compass.webp', alt: '', draggable: 'false' } }),
  h('span', { className: 'personal-energy-card__veil', attrs: { 'aria-hidden': 'true' } }),
  h('span', { className: 'personal-energy-card__symbol', text: energy.symbol }),
  h('span', { className: 'personal-energy-card__copy' },
    h('small', { text: `ЭНЕРГИЯ ДНЯ · ${energy.number} · ${energy.archetype.name}` }),
    h('strong', { text: energy.title }),
    h('span', { text: energy.short }),
    h('b', { text: state.personalSpace.energyOpen ? 'Закрыть чтение ↑' : 'Раскрыть энергию →' })
  ));
}

function personalEventRow(event) {
  const category = PERSONAL_CATEGORIES[event.category] || PERSONAL_CATEGORIES.other;
  return h('button', {
    className: 'personal-list-row', attrs: { type: 'button' },
    on: { click: () => { state.personalSpace.selectedEventId = event.eventId; navigate('space-event'); } }
  },
  h('i', { className: 'personal-list-row__node', style: { '--event-color': category.color } }, h('b')),
  h('time', {}, h('strong', { text: event.time || '—' }), h('small', { text: formatPersonalDate(event.date) })),
  h('span', {}, h('strong', { text: event.title }), h('small', { text: category.label })),
  h('b', { className: 'personal-list-row__priority', text: PERSONAL_PRIORITIES[event.priority]?.mark || '·' }));
}

function personalGoalRow(goal) {
  const progress = goalProgress(goal.goalId, state.personalSpace.tasks);
  return h('button', {
    className: 'personal-goal-row', attrs: { type: 'button' },
    on: { click: () => { state.personalSpace.selectedGoalId = goal.goalId; navigate('space-goal'); } }
  },
  h('span', { className: 'personal-goal-orbit', style: { '--goal-progress': `${progress.percent * 3.6}deg` } }, h('i'), h('strong', { text: String(progress.percent) }), h('small', { text: '%' })),
  h('span', { className: 'personal-goal-copy' }, h('small', { text: goal.deadline ? `ОРИЕНТИР · ДО ${formatPersonalDate(goal.deadline)}` : 'ОРИЕНТИР · БЕЗ СРОКА' }), h('strong', { text: goal.title }), h('b', { text: `${progress.completed} из ${progress.total || 1} шагов зажжено` })),
  h('i', { className: 'personal-goal-row__arrow', text: '→' }));
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
    screenHeader('Мой путь', 'Ваша живая карта решений', 'home'),
    personalPathHero(view),
    personalPathTabs(view),
    view === 'today' ? personalTodayView(energy) : null,
    view === 'planner' ? personalPlannerView() : null,
    view === 'goals' ? personalGoalsView() : null,
    view === 'reflection' ? personalReflectionView() : null,
    h('button', { className: 'personal-privacy-link', attrs: { type: 'button' }, on: { click: () => navigate('space-settings') } },
      h('span', { className: 'personal-privacy-link__seal' }, Icon('profile', { size: 18 })),
      h('span', {}, h('strong', { text: 'Ваш след хранится здесь' }), h('small', { text: 'Память, данные и приватность' })),
      h('b', { attrs: { 'aria-hidden': 'true' }, text: '→' })
    )
  ], { active: 'home' });
}

function personalPathHero(view) {
  const labels = {
    today: {
      kicker: 'ГЛАВА I · СЕГОДНЯ', title: personalGreeting(firstName()),
      copy: 'Один день. Одна ясная нить. Выберите, что действительно поведёт вас дальше.',
      image: '/images/my-path/today-compass.webp', marker: 'Сейчас'
    },
    planner: {
      kicker: 'ГЛАВА II · ГОРИЗОНТ', title: 'Будущее видно по узлам, а не по тяжести списка.',
      copy: 'Разложите события по расстоянию и оставьте место для перемен.',
      image: '/images/my-path/planner-horizon.webp', marker: 'Вперёд'
    },
    goals: {
      kicker: 'ГЛАВА III · СОЗВЕЗДИЕ', title: 'Цель загорается, когда каждый шаг находит своё место.',
      copy: 'Проекты дают форму, привычки — ритм, выполненные шаги — свет.',
      image: '/images/my-path/goals-constellation.webp', marker: 'Выше'
    },
    reflection: {
      kicker: 'ГЛАВА IV · ОТРАЖЕНИЕ', title: 'Прожитый день становится знанием только в тишине.',
      copy: 'Сохраните смысл, отпустите лишнее и не несите вчерашний шум дальше.',
      image: '/images/my-path/reflection-basin.webp', marker: 'Внутрь'
    }
  };
  const chapter = labels[view] || labels.today;
  return h('section', { className: `personal-path-hero is-${view}` },
    h('img', { className: 'personal-path-hero__art', attrs: { src: chapter.image, alt: '', draggable: 'false' } }),
    h('span', { className: 'personal-path-hero__veil', attrs: { 'aria-hidden': 'true' } }),
    h('span', { className: 'personal-path-hero__thread', attrs: { 'aria-hidden': 'true' } }, h('i'), h('i'), h('i')),
    h('span', { className: 'personal-path-hero__marker', text: chapter.marker }),
    h('div', { className: 'personal-path-hero__copy' },
      h('p', { className: 'premium-kicker', text: chapter.kicker }),
      h('h1', { text: chapter.title }),
      h('p', { text: chapter.copy }),
      state.personalSpace.status === 'offline' ? h('small', { text: 'Офлайн-копия · синхронизация продолжится позже' }) : null
    )
  );
}

function personalPathTabs(view) {
  const tabs = [['today', '01', 'Сегодня'], ['planner', '02', 'Горизонт'], ['goals', '03', 'Цели'], ['reflection', '04', 'Итог']];
  return h('nav', { className: 'personal-path-tabs', attrs: { 'aria-label': 'Разделы Моего пути' } },
    tabs.map(([value, number, label]) => h('button', {
      className: view === value ? 'is-active' : '',
      attrs: { type: 'button', 'aria-current': view === value ? 'page' : null },
      on: { click: () => { state.personalSpace.view = value; pulse(); render(); } }
    }, h('span', { text: number }), h('strong', { text: label })))
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
      h('span', { className: 'is-guidance' }, h('small', { text: 'НИТЬ ДНЯ' }), h('strong', { text: energy.recommendation.replace(/^Рекомендация:\s*/i, '') })),
      h('span', { className: 'is-focus' }, h('small', { text: 'ВНУТРЕННИЙ ТОН' }), h('strong', { text: energy.archetype.quality }))
    ),
    h('div', { className: 'personal-section-heading' }, h('span', { text: 'БЛИЖАЙШИЕ УЗЛЫ' }), h('h2', { text: 'Важное сегодня' }), h('small', { text: `${events.length} на пути` })),
    h('div', { className: 'personal-list personal-route-list' }, events.length
      ? events.slice(0, 5).map(personalEventRow)
      : h('div', { className: 'personal-empty personal-empty--route' },
          h('span', { attrs: { 'aria-hidden': 'true' }, text: '◇' }),
          h('strong', { text: 'Нить дня пока свободна' }),
          h('p', { text: 'Добавьте одно событие, разговор или решение — первый узел появится здесь.' })
        )),
    focusGoal ? h('div', { className: 'personal-today-focus' },
      h('small', { text: 'ЦЕЛЬ В ФОКУСЕ' }), personalGoalRow(focusGoal)
    ) : null,
    h('div', { className: 'personal-quick-actions' },
      h('button', { className: 'is-event', attrs: { type: 'button', 'aria-label': 'Событие — добавить новый узел' }, on: { click: () => { state.personalSpace.eventDraft = null; navigate('space-event-form'); } } }, h('b', {}, Icon('sparkle', { size: 20 })), h('span', {}, h('strong', { text: 'Новый узел' }), h('small', { text: 'Добавить событие' }))),
      h('button', { className: 'is-plan', attrs: { type: 'button' }, on: { click: () => { state.personalSpace.plannerHorizon = 'week'; state.personalSpace.view = 'planner'; render(); } } }, h('b', {}, Icon('compass', { size: 20 })), h('span', {}, h('strong', { text: 'Горизонт' }), h('small', { text: 'Собрать неделю' }))),
      h('button', { className: 'is-oracle', attrs: { type: 'button' }, on: { click: () => navigate('space-consultation') } }, h('b', {}, Icon('send', { size: 20 })), h('span', {}, h('strong', { text: 'Эзотериум' }), h('small', { text: 'Увидеть скрытое' })))
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
    h('div', { className: 'personal-horizon-tabs', attrs: { 'aria-label': 'Горизонт планирования' } }, [['today', 'Сейчас'], ['tomorrow', 'Завтра'], ['week', 'Неделя'], ['month', 'Месяц'], ['quarter', 'Сезон'], ['year', 'Год']].map(([id, label], index) => h('button', { className: state.personalSpace.plannerHorizon === id ? 'is-active' : '', attrs: { type: 'button' }, on: { click: () => { state.personalSpace.plannerHorizon = id; render(); } } }, h('i'), h('span', { text: label }), index < 5 ? h('b') : null))),
    h('div', { className: 'personal-section-heading' }, h('span', { text: 'КАРТА ГОРИЗОНТА' }), h('h2', { text: 'События на выбранном расстоянии' }), h('small', { text: String(events.length) })),
    h('div', { className: 'personal-list personal-route-list' }, events.length
      ? events.map(personalEventRow)
      : h('div', { className: 'personal-empty personal-empty--route' }, h('span', { text: '◎' }), h('strong', { text: 'Горизонт свободен' }), h('p', { text: 'Не заполняйте его ради заполнения. Добавьте только то, к чему важно прийти подготовленным.' }))),
    h('button', { className: 'personal-thread-action', attrs: { type: 'button' }, on: { click: () => { state.personalSpace.eventDraft = null; navigate('space-event-form'); } } },
      h('span', {}, Icon('sparkle', { size: 21 })), h('strong', { text: 'Добавить узел на линию времени' }), h('b', { text: '→' })
    )
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
    h('div', { className: 'personal-section-heading' }, h('span', { text: 'ВАШЕ СОЗВЕЗДИЕ' }), h('h2', { text: 'Активные ориентиры' }), h('small', { text: String(goals.length) })),
    h('div', { className: 'personal-list personal-goal-constellation' }, goals.length
      ? goals.map(personalGoalRow)
      : h('div', { className: 'personal-empty personal-empty--constellation' }, h('span', { text: '✧' }), h('strong', { text: 'Первая звезда ещё не названа' }), h('p', { text: 'Сформулируйте один дальний ориентир — проекты и шаги выстроятся вокруг него.' }))),
    h('button', { className: 'personal-thread-action is-goal', attrs: { type: 'button' }, on: { click: () => { state.personalSpace.goalDraft = null; navigate('space-goal-form'); } } }, h('span', {}, Icon('compass', { size: 21 })), h('strong', { text: 'Зажечь новый ориентир' }), h('b', { text: '→' })),
    h('div', { className: 'personal-branch-title' }, h('span', { text: '01' }), h('div', {}, h('small', { text: 'ФОРМА ДВИЖЕНИЯ' }), h('h2', { text: 'Проекты' }))),
    personalHierarchyEditor('project'),
    h('div', { className: 'personal-branch-title' }, h('span', { text: '02' }), h('div', {}, h('small', { text: 'РИТМ ДВИЖЕНИЯ' }), h('h2', { text: 'Привычки' }))),
    personalHierarchyEditor('habit'),
    h('div', { className: 'personal-path-legend' }, h('span', { text: 'Цель' }), h('i'), h('span', { text: 'Проект' }), h('i'), h('span', { text: 'Шаг' }), h('i'), h('span', { text: 'Ритм' }))
  );
}

function personalHierarchyEditor(kind) {
  const isProject = kind === 'project';
  const collection = isProject ? state.personalSpace.projects : state.personalSpace.habits;
  const key = isProject ? 'projectDraft' : 'habitDraft';
  return h('div', { className: 'personal-hierarchy-editor' },
    collection.length ? collection.map((item, index) => h('article', {}, h('span', { text: String(index + 1).padStart(2, '0') }), h('span', {}, h('strong', { text: item.title }), h('small', { text: state.personalSpace.goals.find((goal) => goal.goalId === item.goalId)?.title || 'Самостоятельный ориентир' })), h('button', { attrs: { type: 'button', 'aria-label': 'Завершить' }, on: { click: () => { item.status = 'completed'; persistPersonalSpace(); render(); } } }, '✓'))) : h('p', { className: 'personal-empty personal-empty--branch', text: isProject ? 'Пока без проектов. Добавьте форму, которая приблизит ориентир.' : 'Пока без привычек. Добавьте ритм, который выдержит обычный день.' }),
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
    h('div', { className: 'personal-section-heading' }, h('span', { text: 'СЛЕД МЕСЯЦА' }), h('h2', { text: 'Что уже стало частью пути' }), h('small', { text: personalDateKey().slice(0, 7) })),
    h('section', { className: 'personal-month-report' },
      h('div', { className: 'personal-month-report__metrics' },
        h('span', {}, h('i'), h('strong', { text: String(report.completedEvents) }), h('small', { text: 'событий' })),
        h('span', {}, h('i'), h('strong', { text: String(report.habitMarks) }), h('small', { text: 'шагов' })),
        h('span', {}, h('i'), h('strong', { text: String(report.reflections) }), h('small', { text: 'итогов' }))
      ),
      h('div', { className: 'personal-month-report__insight' }, h('small', { text: 'НАБЛЮДЕНИЕ ЭЗОТЕРИУМА' }), h('p', { text: report.insight })),
      state.personalSpace.consultations.length ? h('span', { className: 'personal-month-report__saved', text: `✦ ${state.personalSpace.consultations.length} личных ориентиров сохранено` }) : null
    )
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

function personalEventAnalysisBody(event) {
  const analysis = event?.analysis || {};
  return [
    `Энергия события\n${analysis.energy || ''}`,
    `Возможности\n${analysis.opportunities || ''}`,
    `Риски\n${analysis.risks || ''}`,
    `Рекомендация\n${analysis.recommendation || ''}`,
    `Вопрос Эзотериума\n${analysis.question || ''}`
  ].filter((part) => part.split('\n').slice(1).join('\n').trim()).join('\n\n');
}

function personalEventDialogueMessages(event) {
  const analysis = event?.analysis || {};
  const context = [event.description, event.desiredResult ? `Желаемый результат: ${event.desiredResult}` : ''].filter(Boolean).join('\n');
  return [
    context ? { role: 'user', content: context } : null,
    analysis.energy ? { role: 'assistant', content: `Энергия события\n${analysis.energy}` } : null,
    analysis.opportunities ? { role: 'assistant', content: `Возможности\n${analysis.opportunities}` } : null,
    analysis.risks ? { role: 'assistant', content: `Риски\n${analysis.risks}` } : null,
    analysis.recommendation ? { role: 'assistant', content: `Рекомендация\n${analysis.recommendation}` } : null,
    analysis.question ? { role: 'assistant', content: `Вопрос Эзотериума\n${analysis.question}` } : null
  ].filter(Boolean);
}

async function savePersonalEventDialogue(event) {
  if (!event?.analysis) return event;
  const reading = {
    id: event.enrichments?.dialogueReadingId || uniqueId('path-event'),
    kind: 'path',
    mode: 'event',
    type: 'Событие пути',
    title: event.title,
    body: personalEventAnalysisBody(event),
    result: { analysis: event.analysis },
    input: {
      eventId: event.eventId,
      date: event.date,
      time: event.time,
      description: event.description,
      desiredResult: event.desiredResult,
      category: event.category
    },
    createdAt: event.enrichments?.analyzedAt || new Date().toISOString(),
    favorite: false
  };
  const existingId = /^[0-9a-f-]{36}$/i.test(String(event.enrichments?.dialogueReadingId || ''))
    ? event.enrichments.dialogueReadingId
    : '';
  const cloud = await saveCloudReading(reading, {
    readingId: existingId,
    subtype: 'path-event',
    input: reading.input
  });
  const dialogueReadingId = cloud?.id || reading.id;
  if (state.readingDialogueId === dialogueReadingId) state.readingDialogueId = '';
  return {
    ...event,
    enrichments: { ...(event.enrichments || {}), dialogueReadingId }
  };
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
        event = await savePersonalEventDialogue(event);
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
  const dialogueResult = analysis ? {
    id: event.enrichments?.dialogueReadingId || '',
    kind: 'path',
    type: 'Событие пути',
    title: event.title,
    body: personalEventAnalysisBody(event),
    dialogueMessages: personalEventDialogueMessages(event),
    createdAt: event.enrichments?.analyzedAt || new Date().toISOString()
  } : null;
  return shell([
    screenHeader(event.title, `${formatPersonalDate(event.date)}${event.time ? ` · ${event.time}` : ''}`, 'space'),
    h('section', { className: 'path-event-hero' },
      h('img', { attrs: { src: '/images/my-path/planner-horizon.webp', alt: '', draggable: 'false' } }),
      h('span', { className: 'path-event-hero__veil', attrs: { 'aria-hidden': 'true' } }),
      h('div', {},
        h('p', { className: 'premium-kicker', text: event.status === 'completed' ? 'СОБЫТИЕ СТАЛО ОПЫТОМ' : 'ТОЧКА НА ГОРИЗОНТЕ' }),
        h('h1', { text: event.title }),
        h('p', { text: `${formatPersonalDate(event.date)}${event.time ? ` · ${event.time}` : ''}${event.location ? ` · ${event.location}` : ''}` })
      )
    ),
    event.links?.length ? h('div', { className: 'personal-event-links path-event-links' }, event.links.map((link, index) => h('a', { attrs: { href: /^https?:\/\//i.test(link) ? link : `https://${link}`, target: '_blank', rel: 'noopener' }, text: `Материал ${index + 1}` }))) : null,
    analysis
      ? readingDialoguePanel(dialogueResult, 'Эзотериум · разбор события')
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
    const withDialogue = await savePersonalEventDialogue(updated);
    storePersonalEventLocally(withDialogue);
    try {
      const data = await personalStore('upsert_personal_event', { event: withDialogue });
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

const PATH_RESULT_MARKERS = Object.freeze({
  'СУТЬ': 'essence',
  'СКРЫТОЕ': 'tension',
  'ОПОРА': 'support',
  'ШАГИ': 'steps',
  'ВОПРОС': 'reflection'
});

function pathTextParagraphs(value) {
  return String(value || '')
    .replace(/\r/g, '')
    .split(/\n\s*\n+/)
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function pathConsultationSections(value) {
  const raw = String(value || '').replace(/\r/g, '').trim();
  const marked = {};
  const markerPattern = /§(СУТЬ|СКРЫТОЕ|ОПОРА|ШАГИ|ВОПРОС)§\s*([\s\S]*?)(?=\n*§(?:СУТЬ|СКРЫТОЕ|ОПОРА|ШАГИ|ВОПРОС)§|$)/g;
  for (const match of raw.matchAll(markerPattern)) {
    marked[PATH_RESULT_MARKERS[match[1]]] = match[2].replace(/\s+/g, ' ').trim();
  }
  if (marked.essence) {
    return {
      essence: marked.essence,
      tension: marked.tension || '',
      support: marked.support || '',
      steps: marked.steps || '',
      reflection: marked.reflection || ''
    };
  }
  const paragraphs = pathTextParagraphs(raw);
  const stepsIndex = paragraphs.findIndex((part) => /(?:первый|второй|третий)\s+шаг/i.test(part));
  const reflectionIndex = paragraphs.findIndex((part, index) => index > 0 && /(?:вечер|спросите себя|вопрос)/i.test(part));
  const reserved = new Set([stepsIndex, reflectionIndex].filter((index) => index >= 0));
  let narrative = paragraphs.filter((_, index) => !reserved.has(index));
  if (narrative.length < 3 && narrative.join(' ').length > 700) {
    const sentences = narrative.join(' ').split(/(?<=[.!?])\s+/).map((part) => part.trim()).filter(Boolean);
    const target = Math.max(1, Math.ceil(sentences.length / 3));
    narrative = [sentences.slice(0, target), sentences.slice(target, target * 2), sentences.slice(target * 2)]
      .map((parts) => parts.join(' ').trim())
      .filter(Boolean);
  }
  return {
    essence: narrative[0] || paragraphs[0] || 'Эзотериум ещё собирает нить этой истории.',
    tension: narrative[1] || '',
    support: narrative.slice(2).join(' ') || '',
    steps: stepsIndex >= 0 ? paragraphs[stepsIndex] : '',
    reflection: reflectionIndex >= 0 ? paragraphs[reflectionIndex] : paragraphs.at(-1) || ''
  };
}

function pathActionSteps(value) {
  const text = String(value || '').trim();
  const matches = [...text.matchAll(/(?:Первый|Второй|Третий)\s+шаг\s*[—–:-]\s*([\s\S]*?)(?=(?:Первый|Второй|Третий)\s+шаг\s*[—–:-]|$)/gi)]
    .map((match) => match[1].trim())
    .filter(Boolean);
  if (matches.length >= 2) return matches.slice(0, 3);
  const sentences = text.split(/(?<=[.!?])\s+/).map((part) => part.trim()).filter(Boolean);
  return sentences.slice(0, 3);
}

function pathKeyPhrase(sections, result) {
  const desired = String(result?.input?.answers?.desired || '').trim();
  if (desired) return desired.split(/(?<=[.!?])\s+/)[0].slice(0, 220);
  const source = sections.reflection || sections.support || sections.essence;
  const sentences = source.split(/(?<=[.!?])\s+/).map((part) => part.trim()).filter(Boolean);
  return (sentences.at(-1) || source).slice(0, 220);
}

function pathOracleParticles() {
  return h('span', { className: 'path-oracle-particles', attrs: { 'aria-hidden': 'true' } },
    ...Array.from({ length: 9 }, (_, index) => h('i', { style: {
      '--spark-x': `${10 + (index * 31) % 82}%`,
      '--spark-delay': `${(index % 5) * -.7}s`,
      '--spark-size': `${2 + index % 3}px`
    } }))
  );
}

function pathInsightCard(number, kicker, title, text, variant = '') {
  if (!text) return null;
  return h('article', { className: `path-insight-card ${variant}`.trim() },
    h('span', { className: 'path-insight-card__number', text: number }),
    h('div', {}, h('small', { text: kicker }), h('h2', { text: title }), h('p', { text }))
  );
}

function openPathGateway(service) {
  const question = PATH_CONSULTATION_QUESTIONS
    .map(([id]) => state.personalSpace.consultationAnswers[id])
    .filter(Boolean)
    .join('. ');
  pulse('medium');
  if (service === 'tarot') {
    state.tarotQuestion = question;
    return navigate('tarot');
  }
  if (service === 'runes') {
    state.runeQuestion = state.personalSpace.consultationAnswers.focus || '';
    state.runeView = 'spreads';
    return navigate('runes');
  }
  if (service === 'palmistry') return navigate('palm-reading');
  state.natalStage = 'data';
  state.natalDate = state.profile.birthDate || state.natalDate;
  state.natalTime = state.profile.birthTime || state.natalTime;
  state.natalTimeKnown = state.profile.birthTimeKnown;
  state.natalPlace = state.profile.city || state.natalPlace;
  return navigate('natal');
}

function pathGateway(service, title, copy, image) {
  return h('button', {
    className: `path-gateway path-gateway--${service}`,
    attrs: { type: 'button', 'aria-label': `${title}: ${copy}` },
    on: { click: () => openPathGateway(service) }
  },
  h('img', { attrs: { src: image, alt: '', loading: 'lazy', draggable: 'false' } }),
  h('span', {}, h('small', { text: 'ПРОДОЛЖИТЬ ПУТЬ' }), h('strong', { text: title }), h('b', { text: copy })),
  h('i', { attrs: { 'aria-hidden': 'true' }, text: '→' })
  );
}

function pathConsultationResult(result) {
  const sections = pathConsultationSections(result.body);
  const steps = pathActionSteps(sections.steps);
  const date = formatDate(result.createdAt);
  return [
    h('section', { className: 'path-oracle-hero' },
      h('img', { className: 'path-consultation-hero__art', attrs: { src: '/images/my-path/oracle-living-thread.webp', alt: 'Эзотериум соединяет световую нить личного пути', draggable: 'false' } }),
      h('span', { className: 'path-oracle-hero__mist', attrs: { 'aria-hidden': 'true' } }),
      pathOracleParticles(),
      h('div', { className: 'path-oracle-hero__copy' },
        h('p', { className: 'premium-kicker', text: 'ЛИЧНЫЙ ОРИЕНТИР ЭЗОТЕРИУМА' }),
        h('h1', { text: result.title || 'Ваш следующий ясный шаг' }),
        h('span', {}, Icon('save', { size: 18 }), h('small', { text: `Сохранено в «Моём пути» · ${date}` }))
      )
    ),
    h('blockquote', { className: 'path-oracle-key' },
      h('span', { attrs: { 'aria-hidden': 'true' }, text: '«' }),
      h('p', { text: pathKeyPhrase(sections, result) }),
      h('cite', { text: 'Ваш личный ключ' })
    ),
    h('section', { className: 'path-oracle-reading', attrs: { 'aria-label': 'Личная рекомендация Эзотериума' } },
      pathInsightCard('01', 'СУТЬ СИТУАЦИИ', 'Что происходит на самом деле', sections.essence, 'is-essence'),
      pathInsightCard('02', 'СКРЫТЫЙ УЗЕЛ', 'Где рождается напряжение', sections.tension, 'is-tension'),
      pathInsightCard('03', 'ВАША ОПОРА', 'Что уже работает на вас', sections.support, 'is-support')
    ),
    steps.length ? h('section', { className: 'path-step-ritual' },
      h('div', { className: 'path-section-heading' }, h('small', { text: 'ТРИ ДВИЖЕНИЯ' }), h('h2', { text: 'Путь от мысли к действию' })),
      h('div', { className: 'path-step-ritual__line', attrs: { 'aria-hidden': 'true' } }),
      h('div', { className: 'path-step-list' }, steps.map((step, index) => h('article', { className: 'path-action-step' },
        h('span', { text: String(index + 1).padStart(2, '0') }),
        h('div', {}, h('strong', { text: ['До события', 'В момент выбора', 'После шага'][index] || 'Следующий шаг' }), h('p', { text: step }))
      )))
    ) : pathInsightCard('04', 'СЛЕДУЮЩИЙ ШАГ', 'Одно движение, которое меняет путь', sections.steps, 'is-steps'),
    sections.reflection ? h('section', { className: 'path-evening-question' },
      h('span', { className: 'path-evening-question__moon', attrs: { 'aria-hidden': 'true' }, text: '☾' }),
      h('div', {}, h('small', { text: 'ВОПРОС ВЕЧЕРА' }), h('h2', { text: 'Когда вокруг станет тише…' }), h('p', { text: sections.reflection }))
    ) : null,
    readingDialoguePanel(result, 'Эзотериум · Ваш путь'),
    h('section', { className: 'path-gateways-section' },
      h('div', { className: 'path-section-heading' }, h('small', { text: 'ЭЗОТЕРИУМ ПРЕДЛАГАЕТ' }), h('h2', { text: 'Посмотреть на вопрос другим взглядом' }), h('p', { text: 'Выберите практику — ваш вопрос и уже сохранённый контекст останутся с вами.' })),
      h('div', { className: 'path-gateway-grid' },
        pathGateway('tarot', 'Таро', 'Увидеть архетип', '/images/worlds/tarot.webp'),
        pathGateway('runes', 'Руны', 'Найти действие', '/images/worlds/runes.webp'),
        pathGateway('palmistry', 'Хиромантия', 'Прочесть линии пути', '/images/worlds/palmistry.webp'),
        pathGateway('natal', 'Натальная карта', 'Сверить внутренний ритм', '/images/worlds/natal.webp')
      )
    ),
    MysticButton({ text: 'Начать новую консультацию', icon: 'send', variant: 'outline', onClick: resetPathConsultation }),
    h('p', { className: 'path-oracle-signature', text: 'ЭЗОТЕРИУМ · ПУТЬ ПРОДОЛЖАЕТСЯ' })
  ];
}

function personalConsultationScreen() {
  const step = state.personalSpace.consultationStep;
  const result = state.personalSpace.consultationResult;
  if (result) {
    return shell([
      screenHeader('Ваш личный ориентир', 'Эзотериум собрал нить ответа', 'space'),
      ...pathConsultationResult(result)
    ], { tabs: false, reading: true });
  }
  if (step === 0) {
    return shell([
      screenHeader('Спросить Эзотериума', 'Личный разговор вместо общего совета', 'space'),
      h('section', { className: 'path-consultation-intro' },
        h('img', { attrs: { src: '/images/my-path/oracle-living-thread.webp', alt: '', draggable: 'false' } }),
        h('span', { className: 'path-consultation-intro__veil', attrs: { 'aria-hidden': 'true' } }),
        pathOracleParticles(),
        h('div', {},
          h('p', { className: 'premium-kicker', text: 'ТИХАЯ КОНСУЛЬТАЦИЯ' }),
          h('h1', { text: 'Ваш вопрос уже изменил тишину комнаты.' }),
          h('p', { text: 'Шесть коротких ответов соединятся с целями, событиями, энергией дня и памятью вашего пути. Эзотериум отделит факты от тревог и вернёт вам ясный следующий шаг.' }),
          h('span', { className: 'path-consultation-intro__promise', text: '6 вопросов · 1 личный ориентир · сохранение в «Моём пути»' })
        )
      ),
      MysticButton({ text: 'Начать разговор', icon: 'send', variant: 'primary', onClick: () => { state.personalSpace.consultationStep = 1; render(); } })
    ], { active: 'home' });
  }
  const question = PATH_CONSULTATION_QUESTIONS[step - 1];
  if (!question) return personalSpaceScreen();
  const [id, title, hint] = question;
  const messages = [{ role: 'assistant', content: 'Я рядом. Здесь не нужно подбирать правильные слова — важнее говорить своими.' }];
  PATH_CONSULTATION_QUESTIONS.slice(0, step).forEach(([answerId, answerTitle, answerHint], index) => {
    messages.push({ role: 'assistant', content: `${answerTitle} ${answerHint}` });
    if (index < step - 1) {
      const content = String(state.personalSpace.consultationAnswers[answerId] || '').trim();
      if (content) messages.push({ role: 'user', content });
    }
  });
  return shell([
    screenHeader('Диалог с Эзотериумом', 'Личный разговор сохраняется в вашем пути', 'space'),
    liveDialogue({
      messages,
      draft: state.personalSpace.consultationAnswers[id] || '',
      onInput: (value) => { state.personalSpace.consultationAnswers[id] = value; },
      onSend: submitPathConsultationStep,
      sending: state.busy,
      placeholder: step === PATH_CONSULTATION_QUESTIONS.length ? 'Последний ответ — после него я соберу смысл…' : 'Ответьте своими словами…',
      subtitle: 'личный диалог · память включена',
      progress: `${step}/${PATH_CONSULTATION_QUESTIONS.length}`,
      sendLabel: step === PATH_CONSULTATION_QUESTIONS.length ? 'Получить личный ориентир' : 'Ответить'
    }),
    h('button', { className: 'esoterium-chat__backstep', attrs: { type: 'button', disabled: state.busy }, on: { click: () => { state.personalSpace.consultationStep = Math.max(0, step - 1); render(); } } }, '← Вернуться к предыдущему вопросу')
  ], { tabs: false, reading: true });
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
  const dailyChoiceUsed = Boolean(state.dailyAccess.dailyChoice?.used);
  const header = h('header', { className: 'premium-home-header home-sanctum__header' }, BrandLogo(),
    h('div', { className: 'premium-home-header__tools' },
      celestialClock(),
      h('button', { className: 'premium-avatar-button', attrs: { type: 'button', 'aria-label': 'Открыть профиль' }, on: { click: () => navigate('profile') } },
        h('img', { attrs: { src: profileAvatar(), alt: '' } })
      )
    )
  );

  return shell([
    header,
    h('section', { className: 'home-sanctum__greeting' },
      h('p', { className: 'premium-kicker', text: 'ВАШ МОМЕНТ' }),
      h('h1', { text: `${firstName()}, сегодня достаточно одного ясного шага` }),
      h('p', { text: `${state.profile.city || 'Ваш город'} · ${ZODIAC_SIGNS[state.horoscope.sign]?.label || 'ваш личный ритм'}` })
    ),
    h('button', {
      className: `home-daily-amulet ${dailyChoiceUsed ? 'is-opened' : ''}`,
      attrs: { type: 'button', 'aria-label': dailyChoiceUsed ? 'Вернуться к знаку дня' : 'Открыть личный знак дня' },
      on: { click: () => navigate('daily-choice') }
    },
    h('span', { className: 'home-daily-amulet__copy' },
      h('small', { text: 'ЛИЧНЫЙ ЗНАК ДНЯ' }),
      h('strong', { text: dailyChoiceUsed ? 'Ваш знак ждёт продолжения' : 'Что откроется вам сегодня?' }),
      h('span', { text: dailyChoiceUsed ? 'Вернитесь к смыслу, который выбрали.' : 'Один выбор — чтобы увидеть главное и сделать следующий шаг.' }),
      h('b', { text: dailyChoiceUsed ? 'Вернуться к знаку' : 'Открыть знак' })
    ),
    h('span', { className: 'home-daily-amulet__art' }, homeJewel('compass'))),
    h('h2', { className: 'home-sanctum__question', text: 'К чему прислушаетесь?' }),
    h('div', { className: 'home-jewel-grid' },
      homeJewelCard('tarot', 'ТАРО', 'Скрытый смысл', 'Увидеть ситуацию глубже', 'tarot'),
      homeJewelCard('runes', 'РУНЫ', 'Верный шаг', 'Получить знак для решения', 'runes'),
      homeJewelCard('astrology', 'АСТРОЛОГИЯ', 'Личное небо', 'Понять ритм своего дня', 'natal'),
      homeJewelCard('palm', 'ХИРОМАНТИЯ', 'Линии судьбы', 'Услышать историю ладони', 'palm-reading')
    )
  ], { active: 'home' });
}

function homeJewel(kind) {
  return h('span', {
    className: `home-jewel home-jewel--${kind}`,
    attrs: { 'aria-hidden': 'true' },
    html: homeJewelSvg(kind)
  });
}

function homeJewelCard(kind, eyebrow, title, description, screen) {
  return h('button', {
    className: `home-jewel-card home-jewel-card--${kind}`,
    attrs: { type: 'button', 'aria-label': `${eyebrow}. ${title}. ${description}` },
    on: { click: () => navigate(screen) }
  },
  h('span', { className: 'home-jewel-card__art' }, homeJewel(kind)),
  h('span', { className: 'home-jewel-card__copy' },
    h('small', { text: eyebrow }),
    h('strong', { text: title }),
    h('span', { text: description })
  ));
}

function sportsForecastScreen() {
  const reading = state.busy || Boolean(state.sportsResult);
  return shell([
    screenHeader('Прогноз события', 'Конкретный сценарий и уровень уверенности', 'services'),
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
      ? state.result?.kind === 'sports'
        ? readingDialoguePanel(state.result, 'Эзотериум · Прогноз события')
        : MysticCard({ className: 'premium-result-reading', children: [formatReading(state.sportsResult)] })
      : null,
    h('p', {
      className: 'premium-info-note',
      text: 'Прогноз показывает вероятный сценарий и неопределённость. Он не является гарантией и не предназначен для ставок.'
    })
  ], { active: 'services', reading });
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
    const saved = {
      id: uniqueId('sports'), kind: 'sports', mode: 'forecast',
      type: 'Прогноз события', title: event, body: reading.answer,
      result: reading.result, createdAt: new Date().toISOString(), favorite: false
    };
    state.result = saved;
    await saveCloudReading(saved, { subtype: 'sports-forecast', input: { event, context: state.sportsContext.trim() } });
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
  const wheelEnabled = state.publicConfig.wheelEnabled === true;
  return shell([
    screenHeader('Практики', 'Выберите то, что откликается именно сейчас', 'home'),
    MysticCard({ className: 'premium-practices-intro', children: [
      h('p', { className: 'premium-kicker', text: 'ВАШЕ ПРОСТРАНСТВО' }),
      h('h2', { text: 'Начните с вопроса, который не даёт покоя' }),
      h('p', { text: 'Здесь можно найти подсказку, лучше понять себя или сохранить важное для будущего.' })
    ] }),
    h('div', { className: 'premium-service-list' },
      serviceTile('path-oracle-hero', 'Мой путь', 'Соберите цели, события и внутренние открытия в одну живую историю', () => { navigate('space'); loadPersonalSpace(); }),
      serviceTile('tarot-deck', 'Ответ в картах', 'Посмотрите на важную ситуацию с неожиданной стороны', () => navigate('tarot'), serviceBadge('tarot')),
      serviceTile('palm-oracle', 'История вашей ладони', 'Откройте характер, поворотные моменты и линии будущего', () => navigate('palm-reading'), serviceBadge('palm_reading', 'Бесплатно')),
      serviceTile('rune-sanctum', 'Знак для решения', 'Получите короткий и ясный ориентир, когда трудно выбрать', () => navigate('runes'), serviceBadge('rune_reading', 'Бесплатно')),
      serviceTile('astrology-forecast', 'Карта вашего неба', 'Узнайте свои сильные стороны и подходящий ритм перемен', () => navigate('natal'), serviceBadge('natal')),
      serviceTile('shortcut-astro-orbit', 'Ваш день в звёздах', 'Начните утро с личного послания и одного полезного шага', () => navigate('horoscope')),
      serviceTile('sports-prophecy-banner', 'Знамения события', 'Почувствуйте ритм встречи, её напряжение и возможный перелом', () => navigate('sports')),
      serviceTile('fortune-wheel', 'Подарок судьбы', 'Откройте знак или приятный сюрприз, приготовленный на сегодня', () => openEnabledFeature(wheelEnabled, 'wheel', 'Сегодня подарок судьбы отдыхает')),
      serviceTile('photo-energy-imprint', 'Образ вашей энергии', 'Увидьте настроение и внутреннюю опору, которые передаёт ваш образ', () => navigate('photo-energy'), serviceBadge('photo_energy')),
      serviceTile('result-magic-seal', 'Что тревожит вашу энергию', 'Разберите смутное беспокойство и найдите способ вернуть спокойствие', () => navigate('photo-damage'), serviceBadge('photo_damage')),
      serviceTile('brand-sun', 'Разговор с Эзотериумом', 'Задайте свой вопрос и получите бережный ответ', () => navigate('support'))
    )
  ], { active: 'services' });
}

function wheelScreen() {
  if (subscriptionRequired()) {
    return shell([
      screenHeader('Колесо Фортуны', 'Подарок дня от Эзотериума', 'home'),
      subscriptionGateCard('Колесо Фортуны')
    ], { active: 'home' });
  }
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
  return liveDialogue({
    messages,
    draft: state.tarotDialogueDraft,
    onInput: (value) => { state.tarotDialogueDraft = value; },
    onSend: sendTarotDialogueMessage,
    sending: state.tarotDialogueSending,
    placeholder: 'Спросите о карте или скажите, что откликнулось…',
    title: 'Эзотериум · Таро',
    subtitle: compact ? 'расклад оживает в разговоре' : 'видит только открытые карты',
    progress: `${state.tarotCards.length}/${spread.count}`,
    compact,
    canWrite
  });
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
    readingDialoguePanel(state.result, 'Эзотериум · Натальная карта'),
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
  return liveDialogue({
    messages: dialogue.messages,
    draft: dialogue.draft,
    onInput: (value) => { dialogue.draft = value; },
    onSend: submitPalmDialogueAnswer,
    sending: state.busy,
    placeholder: 'Ответьте Эзотериуму своими словами…',
    title: 'Эзотериум · Хиромант',
    subtitle: 'сверяет слова только с видимыми линиями',
    progress: `${Math.min(dialogue.answers.length + 1, PALM_QUESTIONS.length)}/${PALM_QUESTIONS.length}`,
    sendLabel: dialogue.answers.length === PALM_QUESTIONS.length - 1 ? 'Завершить и истолковать' : 'Ответить'
  });
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
  if (dialogue.answers.length === PALM_QUESTIONS.length - 1 && !confirmServicePayment('palm_reading')) return;
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
    state.result ? readingDialoguePanel(state.result, 'Эзотериум · Чтение ладони') : null,
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

const ORACLE_ROOM_SECTIONS = {
  path: { label: 'Желание и путь', icon: 'compass', prompt: 'Выяви общее желание, скрытые препятствия и один личный шаг для каждого участника.' },
  event: { label: 'Событие', icon: 'history', prompt: 'Проведи разбор события: энергия, возможности, риски и подготовка каждого участника.' },
  amur: { label: 'Отношения', icon: 'heart', prompt: 'Проведи групповой расклад отношений: позиции, общая потребность, напряжение и новая договорённость.' },
  tarot: { label: 'Таро', icon: 'tarot', prompt: 'Проведи словесный групповой расклад Таро по ролям участников, не называя случайные карты реальными вытянутыми картами.' },
  runes: { label: 'Руны', icon: 'rune', prompt: 'Проведи рунический круг: назови общий вектор, препятствие и действие для каждого участника.' },
  palm: { label: 'Ладони', icon: 'hand', prompt: 'Соедини добровольные описания ладоней в символическое чтение характеров и динамики группы.' },
  general: { label: 'Свободный круг', icon: 'sparkle', prompt: 'Сначала выяви суть общего запроса, затем по очереди задай каждому один персональный вопрос.' }
};

const ORACLE_TEXT_PREPARATION_QUESTIONS = {
  connection: 'Какое желание или проблема привели вас в этот круг?',
  tension: 'Что сейчас сильнее всего мешает желаемому изменению?',
  future: 'Какой результат лично для вас будет честным и полезным?',
  personalQuestion: 'Что Эзотериуму важно спросить именно у вас?'
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
    readingSection: normalized === 'group' ? 'path' : 'palm',
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
      mode === 'group' ? field('Какой круг ведёт Эзотериум', palmChoiceChips(ORACLE_ROOM_SECTIONS, draft.readingSection, (value) => {
        draft.readingSection = value;
      }, 'is-reading-section'), 'От выбора зависит подготовка, вопросы по именам и структура группового расклада.') : null,
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
        readingSection: state.oracleRoomMode === 'group' ? draft.readingSection : 'palm',
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
  state.oracleRoomMessageKind = 'question';
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
        h('li', {}, h('b', { text: '01' }), h('span', {}, h('strong', { text: 'Закрытая подготовка' }), h('small', { text: room.readingSection === 'palm' ? 'Вы выберете ведущую руку, добавите ладонь и ответите на личные вопросы.' : 'Вы отдельно ответите на четыре вопроса. Другие участники увидят только отметку готовности.' }))),
        h('li', {}, h('b', { text: '02' }), h('span', {}, h('strong', { text: 'Ожидание второго участника' }), h('small', { text: 'Создатель увидит только ваш статус готовности — не ответы и не фотографию.' }))),
        h('li', {}, h('b', { text: '03' }), h('span', {}, h('strong', { text: 'Перекрёстный диалог' }), h('small', { text: 'Когда все готовы, Эзотериум откроет чтение совместимости и общий разговор.' })))
      )
    ) : null,
    unavailable ? MysticCard({ className: 'oracle-room-consent-card', children: [
      h('strong', { text: 'Войти в эту комнату уже нельзя' }),
      h('p', { text: 'Попросите создателя открыть новый круг и прислать свежее приглашение.' })
    ] }) : MysticCard({ className: 'oracle-room-consent-card', children: [
      h('strong', { text: 'Перед входом' }),
      h('p', { text: room.readingSection === 'palm' ? 'Личные ответы и фотография ладони остаются закрытыми. После готовности всех Эзотериум использует их бережно, не цитируя другому участнику дословно.' : 'Личные ответы остаются закрытыми. После готовности всех Эзотериум использует их только для группового расклада, не цитируя другим дословно.' }),
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

function oracleRoomTextPreparationPanel(room) {
  const viewer = room.viewer || {};
  const answers = state.oracleRoomPreparation.answers;
  const ready = viewer.preparationStatus === 'ready';
  const section = ORACLE_ROOM_SECTIONS[room.readingSection] || ORACLE_ROOM_SECTIONS.general;
  if (ready && !state.oracleRoomPreparationEditing) {
    return h('section', { className: 'palm-preparation-ready is-text-circle' },
      h('span', { className: 'palm-preparation-ready__seal' }, Icon('sparkle', { size: 25 })),
      h('div', {}, h('strong', { text: 'Ваши ответы запечатаны' }), h('small', { text: room.chatUnlocked ? 'Групповой расклад открыт.' : 'Эзотериум ждёт готовности остальных участников.' })),
      !room.chatUnlocked ? h('button', { attrs: { type: 'button' }, on: { click: () => { state.oracleRoomPreparationEditing = true; render(); } }, text: 'Изменить' }) : null
    );
  }
  return MysticCard({ className: 'palm-preparation-card oracle-text-preparation', children: [
    h('header', { className: 'palm-preparation-head' },
      h('span', { className: 'palm-preparation-head__icon' }, Icon(section.icon, { size: 25 })),
      h('div', {}, h('p', { className: 'premium-kicker', text: 'ТОЛЬКО ДЛЯ ВАС И ЭЗОТЕРИУМА' }), h('h2', { text: section.label }), h('p', { text: 'Эти ответы помогут обратиться к вам по имени и найти вашу часть общего запроса.' }))
    ),
    h('div', { className: 'palm-private-questions' }, Object.entries(ORACLE_TEXT_PREPARATION_QUESTIONS).map(([key, question], index) => field(`${index + 1}. ${question}`, textarea({
      value: answers[key] || '', placeholder: 'Ваш ответ…', maxLength: 500,
      onInput: (value) => { answers[key] = value; }
    })))),
    consentRow(
      'Я добровольно передаю эти ответы Эзотериуму для группового расклада. Другим участникам они дословно не показываются.',
      state.oracleRoomPalmConsent,
      (checked) => { state.oracleRoomPalmConsent = checked; }
    ),
    h('div', { className: 'palm-preparation-actions' },
      ready ? MysticButton({ text: 'Отменить изменения', icon: 'arrow-left', variant: 'outline', onClick: () => { state.oracleRoomPreparationEditing = false; state.oracleRoomPalmConsent = false; render(); } }) : null,
      MysticButton({ text: state.busy ? 'Запечатываем ответы…' : 'Я готов(а) к кругу', icon: 'sparkle', variant: 'primary', disabled: state.busy, onClick: completeOracleRoomTextPreparation })
    )
  ] });
}

async function completeOracleRoomTextPreparation() {
  if (state.busy) return;
  const answers = state.oracleRoomPreparation.answers;
  if (Object.keys(ORACLE_TEXT_PREPARATION_QUESTIONS).some((key) => String(answers[key] || '').trim().length < 4)) {
    return notify('Ответьте на все четыре личных вопроса');
  }
  if (!state.oracleRoomPalmConsent) return notify('Подтвердите согласие на закрытую подготовку');
  state.busy = true; render();
  try {
    const data = await api('/api/proxy', { method: 'POST', body: {
      action: 'complete_oracle_room_text_preparation', roomToken: state.oracleRoomToken, privateAnswers: answers
    } });
    state.oracleRoom = data.room;
    state.oracleRoomPreparationToken = '';
    syncOracleRoomPreparation(data.room);
    state.oracleRoomPreparationEditing = false;
    state.oracleRoomPalmConsent = false;
    notify(data.newlyOpened ? 'Все готовы — Эзотериум открыл групповой расклад' : 'Ответы запечатаны. Ждём остальных участников.');
    pulse('medium');
  } catch (error) { notify(apiErrorMessage(error)); }
  finally { state.busy = false; render(); }
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
    h('p', { className: 'premium-kicker', text: waitingForPeople ? 'ОЖИДАЕМ УЧАСТНИКОВ' : room.readingSection === 'palm' ? 'ЛАДОНИ ГОТОВЯТСЯ К ВСТРЕЧЕ' : 'ЛИЧНЫЕ ОТВЕТЫ ЗАПЕЧАТАНЫ' }),
    h('h2', { text: waitingForPeople ? 'Приглашение ждёт ответа' : `${readyCount} из ${activeCount} завершили подготовку` }),
    h('p', { text: waitingForPeople
      ? 'Общий разговор откроется, когда приглашённые войдут и каждый пройдёт свой закрытый этап.'
      : 'Пока остальные отвечают, ваши данные остаются запечатаны. Эзотериум откроет диалог автоматически после готовности всех.' }),
    h('div', { className: 'palm-waiting-ritual__meter' }, h('i', { attrs: { style: `width:${activeCount ? Math.round((readyCount / activeCount) * 100) : 0}%` } })),
    h('small', { text: 'Ни фотография, ни личные ответы не показываются участникам комнаты.' })
  );
}

function oracleRoomOpeningPrompt(room) {
  if (room?.mode === 'pair') {
    return `Проведи первое совместное чтение наших ладоней. Начни с совместимости характеров, сильной стороны связи, главного напряжения и вероятного направления будущего. Наш главный вопрос: ${room.openingQuestion || room.focus || 'что важно понять о нашей связи сейчас?'}`;
  }
  const section = ORACLE_ROOM_SECTIONS[room?.readingSection] || ORACLE_ROOM_SECTIONS.general;
  return `Открой групповой круг «${section.label}». ${section.prompt} Обращайся к каждому участнику по имени, задай за одну реплику только один вопрос и сначала дай высказаться всем. Общая тема: ${room?.focus || room?.openingQuestion || 'выяви её первым вопросом'}.`;
}

function oracleRoomQuestionPolicy(room) {
  const fallbackLimit = room?.mode === 'group' ? 5 : 3;
  const policy = state.publicConfig.dialogueCatalog?.[room?.mode]
    || state.publicConfig.dialogueCatalog?.personal
    || {};
  const included = Math.max(0, Math.floor(Number(policy.includedQuestions ?? fallbackLimit)));
  const used = Math.max(0, Number(room?.answeredQuestions || 0));
  const remaining = Math.max(0, included - used);
  const price = Math.max(0.1, Number(policy.extraQuestionPrice || 0.1));
  return { enabled: policy.enabled !== false, sectionFree: policy.sectionFree !== false, included, used, remaining, price };
}

function oracleRoomQuotaNotice(room, policy) {
  const paid = policy.remaining === 0;
  const questionWord = policy.remaining % 10 === 1 && policy.remaining % 100 !== 11
    ? 'вопрос'
    : [2, 3, 4].includes(policy.remaining % 10) && ![12, 13, 14].includes(policy.remaining % 100)
      ? 'вопроса'
      : 'вопросов';
  return h('aside', { className: `oracle-room-quota${paid ? ' is-paid' : ''}` },
    h('span', { attrs: { 'aria-hidden': 'true' }, text: paid ? '◈' : '✦' }),
    h('div', {},
      h('strong', { text: paid ? `Следующий вопрос · ${formatMoney(policy.price)} S` : `${policy.remaining} ${questionWord} включено` }),
      h('small', { text: paid
        ? 'Оплата только за вашу новую реплику. Ответ Эзотериума лимит не расходует.'
        : `Использовано ${policy.used} из ${policy.included}. Ответы Эзотериума не считаются.` })
    )
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
  const questionPolicy = oracleRoomQuestionPolicy(room);
  if (room.joinRequired) return oracleRoomJoinView(room);
  syncOracleRoomPreparation(room);
  queueMicrotask(() => document.querySelector('.oracle-room-message-list')?.scrollTo?.({ top: 100000, behavior: 'smooth' }));
  const hasOpeningReading = (room.messages || []).some((message) => message.role === 'assistant');
  return shell([
    screenHeader(room.title, `${ORACLE_ROOM_SECTIONS[room.readingSection]?.label || PALM_ROOM_MODES[room.mode]?.short || 'Комната'} · ${room.participantCount} участник(а)`, 'palm-rooms'),
    h('section', { className: `oracle-room-live-head is-${room.mode}` },
      h('img', { attrs: { src: premiumArtUrl('palm-oracle'), alt: '' } }),
      h('div', {}, h('p', { className: 'premium-kicker', text: room.status === 'closed' ? 'РАЗГОВОР ЗАВЕРШЁН' : 'ЭЗОТЕРИУМ В КОМНАТЕ' }), h('h1', { text: room.title }), room.focus ? h('p', { text: room.focus }) : null)
    ),
    oracleRoomParticipants(room),
    oracleRoomInvitePanel(room),
    room.status === 'active' && room.mode !== 'solo' ? (room.readingSection === 'palm' ? oracleRoomPreparationPanel(room) : oracleRoomTextPreparationPanel(room)) : null,
    room.status === 'active' && room.mode === 'solo' && !room.viewer?.palmReady ? oracleRoomPalmPanel(room) : null,
    room.mode !== 'solo' && !room.chatUnlocked ? oracleRoomWaitingStage(room) : null,
    room.chatUnlocked || room.mode === 'solo' ? h('section', { className: 'oracle-room-chat' },
      oracleRoomQuotaNotice(room, questionPolicy),
      room.mode !== 'solo' && !hasOpeningReading && room.status === 'active' ? h('div', { className: 'palm-opening-reading' },
        h('span', {}, Icon('sparkle', { size: 25 })),
        h('div', {}, h('strong', { text: room.mode === 'pair' ? 'Все готовы. Откройте первое совместное чтение' : 'Все готовы. Эзотериум может открыть круг' }), h('p', { text: room.mode === 'pair' ? room.openingQuestion || 'Эзотериум соединит наблюдения двух ладоней и обозначит главную тему вашей связи.' : ORACLE_ROOM_SECTIONS[room.readingSection]?.prompt || 'Эзотериум выявит общую тему и даст голос каждому участнику.' })),
        MysticButton({ text: room.mode === 'pair' ? 'Начать чтение совместимости' : 'Начать групповой расклад', icon: 'sparkle', variant: 'gold', disabled: state.oracleRoomSending, onClick: () => sendOracleRoomMessage(
          oracleRoomOpeningPrompt(room),
          'guided'
        ) })
      ) : null,
      h('div', { className: 'oracle-room-message-kind', attrs: { role: 'group', 'aria-label': 'Тип сообщения' } },
        h('button', { className: state.oracleRoomMessageKind === 'answer' ? 'is-active' : '', attrs: { type: 'button' }, on: { click: () => { state.oracleRoomMessageKind = 'answer'; state.oracleRoomMessageNonce = ''; render(); } }, text: 'Ответ Эзотериуму · бесплатно' }),
        h('button', { className: state.oracleRoomMessageKind === 'question' ? 'is-active' : '', attrs: { type: 'button' }, on: { click: () => { state.oracleRoomMessageKind = 'question'; state.oracleRoomMessageNonce = ''; render(); } }, text: questionPolicy.remaining > 0 ? 'Мой новый вопрос' : `Новый вопрос · ${formatMoney(questionPolicy.price)} S` })
      ),
      liveDialogue({
        messages: room.messages || [],
        draft: state.oracleRoomMessageDraft,
        onInput: (value) => { state.oracleRoomMessageDraft = value; state.oracleRoomMessageNonce = ''; },
        onSend: sendOracleRoomMessage,
        sending: room.assistantState === 'thinking' || state.oracleRoomSending,
        placeholder: state.oracleRoomMessageKind === 'answer' ? 'Ответьте на вопрос Эзотериума…' : room.mode === 'solo' ? 'Задайте новый вопрос…' : 'Задайте новый вопрос всем…',
        title: room.mode === 'solo' ? 'Эзотериум · личный диалог' : room.title,
        subtitle: room.mode === 'solo' ? 'закрытая комната' : `${room.participantCount} участников · Эзотериум обращается по имени`,
        progress: questionPolicy.remaining > 0 ? `${questionPolicy.remaining}/${questionPolicy.included}` : `${formatMoney(questionPolicy.price)} S`,
        group: room.mode !== 'solo',
        viewerId: room.viewer?.telegramId,
        canWrite: room.status === 'active' && questionPolicy.enabled
      }),
      room.assistantState === 'error' ? h('p', { className: 'oracle-room-answer-error', text: 'Ответ прервался. Повторите вопрос — предыдущие сообщения сохранены.' }) : null
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

async function sendOracleRoomMessage(presetMessage = '', presetKind = '') {
  const message = String(presetMessage || state.oracleRoomMessageDraft).trim().replace(/\s+/g, ' ');
  if (message.length < 2) return notify('Напишите вопрос или мысль для разговора');
  if (state.oracleRoomSending) return;
  const clientNonce = state.oracleRoomMessageNonce || uniqueId('oracle-room-message');
  const messageKind = ['question', 'answer', 'guided'].includes(presetKind)
    ? presetKind
    : state.oracleRoomMessageKind;
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
        clientNonce,
        messageKind
      }
    });
    state.oracleRoom = data.room;
    state.oracleRoomStatus = 'ready';
    state.oracleRoomMessageNonce = '';
    state.oracleRoomMessageKind = String(data.answer || '').includes('?') ? 'answer' : 'question';
    pulse();
  } catch (error) {
    state.oracleRoomMessageDraft = message;
    if (error?.status === 402) {
      const minimum = Number(state.wallet?.config?.sbpMinimumSilarum || 10);
      const shortage = Number(error.data?.payment?.shortage || error.data?.payment?.price || minimum);
      state.topupAmount = String(Math.max(minimum, Math.ceil(shortage * 100) / 100));
      state.topupReturnScreen = 'palm-room';
      navigate('topup');
    }
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
    state.result ? readingDialoguePanel(state.result, 'Эзотериум · Руны') : runeLiveDialogue()
  );
}

function runeLiveDialogue() {
  const used = state.runeDialogueMessages.filter((message) => message.role === 'user').length;
  return liveDialogue({
    messages: state.runeDialogueMessages,
    draft: state.runeDialogueDraft,
    onInput: (value) => { state.runeDialogueDraft = value; },
    onSend: sendRuneFollowup,
    sending: state.runeDialogueSending,
    placeholder: 'Как эти руны связаны с моей ситуацией?',
    title: 'Эзотериум · Руны',
    subtitle: used < 5 ? `${5 - used} уточнений осталось` : 'диалог продолжится по тарифу',
    progress: 'ᚨ'
  });
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
    readingDialoguePanel(result, `Эзотериум · ${result.type || 'Совместимость'}`),
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

function personalReadingQuestionPolicy() {
  const policy = state.publicConfig.dialogueCatalog?.personal || {};
  const included = Math.max(0, Math.floor(Number(policy.includedQuestions ?? 3)));
  const used = Math.max(0, Number(state.readingDialogueAnsweredQuestions || 0));
  return {
    enabled: policy.enabled !== false,
    sectionFree: policy.sectionFree !== false,
    included,
    used,
    remaining: Math.max(0, included - used),
    price: Math.max(0.1, Number(policy.extraQuestionPrice || 0.1))
  };
}

function prepareReadingDialogue(result) {
  const id = String(result?.id || '');
  if (!id || state.readingDialogueId === id) return;
  state.readingDialogueId = id;
  state.readingDialogueMessages = initialReadingDialogueMessages(result);
  state.readingDialogueDraft = '';
  state.readingDialogueKind = 'question';
  state.readingDialogueNonce = '';
  state.readingDialogueAnsweredQuestions = 0;
  if (tg?.initData && /^[0-9a-f-]{36}$/i.test(id)) {
    state.readingDialogueLoading = true;
    queueMicrotask(() => loadReadingDialogue(id, result));
  }
}

function initialReadingDialogueMessages(result) {
  if (Array.isArray(result?.dialogueMessages) && result.dialogueMessages.length) {
    return result.dialogueMessages.map((message) => ({
      role: message.role === 'user' ? 'user' : 'assistant',
      content: String(message.content || '').trim(),
      createdAt: message.createdAt || result.createdAt
    })).filter((message) => message.content);
  }
  return String(result?.body || '').trim()
    ? [{ role: 'assistant', content: String(result.body), createdAt: result.createdAt }]
    : [];
}

async function loadReadingDialogue(readingId, result) {
  try {
    const data = await api('/api/proxy', {
      method: 'POST',
      body: { action: 'get_reading_dialogue_context', readingId }
    });
    if (state.readingDialogueId !== readingId) return;
    const transcript = Array.isArray(data.messages) ? data.messages.map((message) => ({
      role: message.role,
      content: message.content,
      messageKind: message.message_kind,
      createdAt: message.created_at
    })) : [];
    state.readingDialogueMessages = [...initialReadingDialogueMessages(result), ...transcript];
    state.readingDialogueAnsweredQuestions = Number(data.answeredQuestions || 0);
    const last = state.readingDialogueMessages.at(-1);
    state.readingDialogueKind = last?.role === 'assistant' && String(last.content).includes('?') ? 'answer' : 'question';
  } catch (error) {
    if (error?.message !== 'reading_not_found') notify('История диалога временно недоступна');
  } finally {
    if (state.readingDialogueId === readingId) {
      state.readingDialogueLoading = false;
      render();
    }
  }
}

async function sendReadingDialogueMessage() {
  const readingId = state.readingDialogueId;
  const message = state.readingDialogueDraft.trim().replace(/\s+/g, ' ');
  if (message.length < 2 || state.readingDialogueSending || !/^[0-9a-f-]{36}$/i.test(readingId)) return;
  const messageKind = state.readingDialogueKind;
  const clientNonce = state.readingDialogueNonce || uniqueId('reading-dialogue');
  state.readingDialogueNonce = clientNonce;
  state.readingDialogueDraft = '';
  state.readingDialogueSending = true;
  state.readingDialogueMessages.push({ role: 'user', content: message, messageKind });
  render();
  try {
    const data = await api('/api/proxy', {
      method: 'POST',
      body: {
        action: 'reading_dialogue_send',
        readingId,
        message,
        messageKind,
        clientNonce,
        userName: firstName()
      }
    });
    if (state.readingDialogueId !== readingId) return;
    state.readingDialogueMessages.push({ role: 'assistant', content: data.answer, createdAt: new Date().toISOString() });
    state.readingDialogueAnsweredQuestions = Number(data.answeredQuestions || state.readingDialogueAnsweredQuestions);
    state.readingDialogueKind = String(data.answer || '').includes('?') ? 'answer' : 'question';
    state.readingDialogueNonce = '';
    loadWallet({ force: true });
    pulse();
  } catch (error) {
    if (state.readingDialogueId === readingId) {
      state.readingDialogueMessages.pop();
      state.readingDialogueDraft = message;
    }
    if (error?.status === 402) {
      const minimum = Number(state.wallet?.config?.sbpMinimumSilarum || 10);
      const shortage = Number(error.data?.payment?.shortage || error.data?.payment?.price || minimum);
      state.topupAmount = String(Math.max(minimum, Math.ceil(shortage * 100) / 100));
      state.topupReturnScreen = state.screen;
      navigate('topup');
    }
    notify(apiErrorMessage(error));
  } finally {
    state.readingDialogueSending = false;
    render();
  }
}

function readingDialoguePanel(result, title = '') {
  prepareReadingDialogue(result);
  const policy = personalReadingQuestionPolicy();
  const available = tg?.initData && /^[0-9a-f-]{36}$/i.test(String(result?.id || ''));
  return h('section', { className: 'reading-live-dialogue' },
    oracleRoomQuotaNotice(null, policy),
    h('div', { className: 'oracle-room-message-kind', attrs: { role: 'group', 'aria-label': 'Тип сообщения' } },
      h('button', { className: state.readingDialogueKind === 'answer' ? 'is-active' : '', attrs: { type: 'button' }, on: { click: () => { state.readingDialogueKind = 'answer'; state.readingDialogueNonce = ''; render(); } }, text: 'Ответ Эзотериуму · бесплатно' }),
      h('button', { className: state.readingDialogueKind === 'question' ? 'is-active' : '', attrs: { type: 'button' }, on: { click: () => { state.readingDialogueKind = 'question'; state.readingDialogueNonce = ''; render(); } }, text: policy.remaining > 0 ? 'Мой новый вопрос' : `Новый вопрос · ${formatMoney(policy.price)} S` })
    ),
    liveDialogue({
      messages: state.readingDialogueMessages,
      draft: state.readingDialogueDraft,
      onInput: (value) => { state.readingDialogueDraft = value; state.readingDialogueNonce = ''; },
      onSend: sendReadingDialogueMessage,
      sending: state.readingDialogueSending || state.readingDialogueLoading,
      placeholder: state.readingDialogueKind === 'answer' ? 'Ответьте Эзотериуму…' : 'Задайте вопрос по этому чтению…',
      title: title || `Эзотериум · ${result?.type || 'личный диалог'}`,
      subtitle: 'помнит исходное чтение и продолжает разговор',
      progress: policy.remaining > 0 ? `${policy.remaining}/${policy.included}` : `${formatMoney(policy.price)} S`,
      canWrite: available && policy.enabled
    }),
    !available ? h('p', { className: 'premium-info-note', text: 'Продолжение диалога доступно внутри Telegram после сохранения чтения.' }) : null
  );
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
    readingDialoguePanel(result, `Эзотериум · ${title}`),
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
      path: 'Мой путь',
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
  if (subscriptionRequired()) {
    return shell([
      screenHeader('Гороскоп дня', 'Личное послание от Эзотериума', 'home'),
      subscriptionGateCard('ежедневный гороскоп')
    ], { active: 'home' });
  }
  const sign = selectField(ZODIAC_SIGNS, state.horoscope.sign, (value) => {
    state.horoscope.sign = value;
    state.horoscope.reading = '';
    writeJSON(HOROSCOPE_KEY, state.horoscope);
  });
  const enabled = state.publicConfig.dailyHoroscopeEnabled !== false;
  const reading = state.busy || Boolean(state.horoscope.reading);
  const dialogueResult = state.horoscope.reading ? {
    id: state.horoscope.readingId || '',
    kind: 'horoscope',
    type: 'Гороскоп дня',
    title: `${ZODIAC_SIGNS[state.horoscope.sign]?.label || state.horoscope.sign} · ${state.horoscope.date || ''}`,
    body: state.horoscope.reading,
    createdAt: state.horoscope.createdAt || new Date().toISOString()
  } : null;
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
    dialogueResult ? readingDialoguePanel(dialogueResult, 'Эзотериум · Гороскоп дня') : null,
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
    const saved = {
      id: uniqueId('horoscope'), kind: 'horoscope', mode: 'daily', type: 'Гороскоп дня',
      title: `${ZODIAC_SIGNS[state.horoscope.sign]?.label || state.horoscope.sign} · ${date}`,
      body: reading.answer, result: reading.result, createdAt: new Date().toISOString(), favorite: false
    };
    await saveCloudReading(saved, {
      subtype: 'daily-horoscope',
      input: { sign: state.horoscope.sign, date, name: firstName(), city: state.profile.city }
    });
    state.horoscope = { ...state.horoscope, reading: reading.answer, readingId: saved.id, createdAt: saved.createdAt, date };
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
      tonWalletPanel(),
      h('div', { className: 'profile-setting-links' },
        profileSettingLink('profile', 'Образ профиля', 'Сменить фото', () => openProfileOverlay('avatar')),
        profileSettingLink('orbit', 'Гороскоп дня', state.horoscope.enabled ? 'Ежедневный ритм включён' : 'Выбрать знак и ритм', () => navigate('horoscope')),
        profileSettingLink('history', 'Память, звук и графика', 'Приватность и атмосфера', () => navigate('space-settings')),
        profileSettingLink('info', 'Связь с поддержкой', 'Вопросы по приложению и оплате', () => navigate('support'))
      )
    )
  ];
}

function shortTonAddress(value) {
  const address = String(value || '');
  return address.length > 18 ? `${address.slice(0, 8)}…${address.slice(-8)}` : address;
}

function tonWalletPanel() {
  const wallet = state.tonWallet || {};
  const connected = Boolean(wallet.address);
  const pending = wallet.status === 'loading' || wallet.status === 'connecting';
  return h('section', { className: 'profile-setting-block ton-wallet-block' },
    h('div', {},
      h('strong', { text: 'TON Wallet' }),
      h('small', { text: connected
        ? `${wallet.walletApp || 'TON Connect'} · ${shortTonAddress(wallet.address)}`
        : wallet.status === 'connecting'
          ? 'Выберите кошелёк и подтвердите соединение в его приложении'
          : 'Безопасная привязка через TON Connect без доступа к ключам' })
    ),
    MysticButton({
      text: connected ? 'Отключить кошелёк' : wallet.status === 'connecting' ? 'Ожидаем подтверждение…' : wallet.status === 'loading' ? 'Восстанавливаем связь…' : 'Подключить кошелёк',
      icon: 'payment',
      variant: connected ? 'outline' : 'gold',
      disabled: pending,
      onClick: connected ? disconnectTonWallet : connectTonWallet
    }),
    h('p', { className: 'premium-info-note', text: connected
      ? 'Связь подтверждена через TON Connect и сохранена в вашем профиле. Приложение никогда не получает секретную фразу или приватный ключ.'
      : 'Кошелёк привязывается к профилю. Покупка SILARUM внутри Telegram выполняется Stars по правилам платформы.' })
  );
}

async function connectTonWallet() {
  if (!tg?.initData) return notify('Откройте Nastardamus внутри Telegram, чтобы сохранить кошелёк в профиле');
  if (!tonConnectUI) return notify('TON Connect ещё загружается');
  state.tonWallet.status = 'connecting';
  render();
  try {
    await tonConnectUI.openModal();
  } catch {
    state.tonWallet.status = 'ready';
    notify('Не удалось открыть список TON-кошельков');
    render();
  }
}

async function disconnectTonWallet() {
  if (!tonConnectUI || !window.confirm('Отключить TON-кошелёк от профиля?')) return;
  state.tonWallet.status = 'loading';
  render();
  try {
    if (tonConnectUI.connected) await tonConnectUI.disconnect();
    lastTonWalletSynced = 'disconnected';
    if (tg?.initData) await api('/api/preferences', { method: 'POST', body: { action: 'set_ton_wallet', disconnect: true } });
    state.tonWallet = { status: 'ready', address: '', chain: '', walletApp: '' };
    notify('TON-кошелёк отключён от профиля');
  } catch {
    state.tonWallet.status = 'ready';
    notify('Не удалось отключить кошелёк');
  } finally {
    render();
  }
}

async function syncTonWallet(wallet) {
  const address = String(wallet?.account?.address || '');
  if (!address) return;
  const syncKey = address;
  if (syncKey === lastTonWalletSynced || !tg?.initData) return;
  lastTonWalletSynced = syncKey;
  await api('/api/preferences', {
    method: 'POST',
    body: address ? {
      action: 'set_ton_wallet',
      address,
      chain: String(wallet.account?.chain || ''),
      walletApp: String(wallet.device?.appName || wallet.device?.platform || 'TON Connect')
    } : { action: 'set_ton_wallet', disconnect: true }
  }).catch(() => { lastTonWalletSynced = ''; });
}

function initializeTonWallet() {
  if (tonConnectUI) return;
  if (typeof globalThis.requestAnimationFrame !== 'function' || typeof globalThis.fetch !== 'function') {
    state.tonWallet.status = 'ready';
    return;
  }
  try {
    tonConnectUI = new TonConnectUI({
      manifestUrl: `${location.origin}/tonconnect-manifest.json`,
      buttonRootId: null,
      language: state.locale === 'ru' ? 'ru' : 'en',
      uiPreferences: { theme: THEME.DARK }
    });
    tonConnectUI.onStatusChange((wallet) => {
      state.tonWallet = wallet?.account?.address ? {
        status: 'ready',
        address: String(wallet.account.address),
        chain: String(wallet.account.chain || ''),
        walletApp: String(wallet.device?.appName || wallet.device?.platform || 'TON Connect')
      } : { status: 'ready', address: '', chain: '', walletApp: '' };
      tonConnectUI.connectionRestored.then(() => syncTonWallet(wallet));
      if (state.screen === 'profile') render();
    }, () => {
      state.tonWallet.status = 'error';
      if (state.screen === 'profile') render();
    });
    tonConnectUI.onModalStateChange((modal) => {
      if (modal.status !== 'closed' || tonConnectUI.connected || state.tonWallet.status !== 'connecting') return;
      state.tonWallet.status = 'ready';
      if (state.screen === 'profile') render();
    });
    tonConnectUI.connectionRestored.finally(() => {
      if (state.tonWallet.status === 'loading') state.tonWallet.status = 'ready';
      if (state.screen === 'profile') render();
    });
  } catch {
    state.tonWallet.status = 'error';
  }
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
      onClick: () => tg?.openInvoice
        ? tg.openInvoice(order.paymentUrl, (status) => handleStarsInvoiceStatus(order, status))
        : tg?.openLink ? tg.openLink(order.paymentUrl) : window.open(order.paymentUrl, '_blank', 'noopener')
    }) : null,
    h('div', { className: 'premium-form-actions' },
      MysticButton({ text: 'Изменить сумму', icon: 'coin', variant: 'outline', disabled: state.busy, onClick: () => cancelExternalPaymentOrder(order, { edit: true }) }),
      MysticButton({ text: 'Отменить счёт', icon: 'arrow-left', variant: 'outline', disabled: state.busy, onClick: () => cancelExternalPaymentOrder(order) })
    )
  ] });
}

async function handleStarsInvoiceStatus(order, status) {
  if (status === 'paid') {
    await loadWallet({ force: true });
    return notify('Оплата подтверждена — SILARUM зачислены');
  }
  if (['cancelled', 'failed'].includes(status)) {
    await cancelExternalPaymentOrder(order, { silent: true });
    return notify(status === 'cancelled' ? 'Счёт закрыт. Сумму можно выбрать заново.' : 'Оплата не прошла. Создайте новый счёт с нужной суммой.');
  }
  await loadWallet({ force: true });
}

async function cancelExternalPaymentOrder(order, { edit = false, silent = false } = {}) {
  if (state.busy) return;
  if (!silent && !edit && !window.confirm('Отменить этот счёт Stars?')) return;
  state.busy = true;
  if (edit) state.topupAmount = String(order.silarum || 1);
  render();
  try {
    const data = await api('/api/wallet', {
      method: 'POST',
      body: { action: 'cancel_external_payment_order', orderId: order.id }
    });
    state.wallet = data;
    state.walletStatus = 'ready';
    if (!silent) notify(edit ? 'Введите новую сумму и создайте новый счёт' : 'Счёт отменён');
  } catch (error) {
    if (error?.message !== 'payment_order_not_pending') notify(apiErrorMessage(error));
    await loadWallet({ force: true });
  } finally {
    state.busy = false;
    render();
  }
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
    if (data.payment?.source === 'daily_channel_choice') {
      state.dailyAccess.dailyChoice = {
        used: true,
        serviceId: serviceId || ({ palm_reading: 'palm_reading', rune_reading: 'rune_reading', natal: 'natal', tarot: payload?.spread === 'love-relationship' ? 'tarot_relationship' : 'tarot' })[feature] || feature,
        usedAt: new Date().toISOString(),
        date: state.dailyGreeting.date
      };
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
    channel_subscription_required: 'Подпишитесь на канал и нажмите «Проверить подписку».',
    channel_subscription_check_unavailable: 'Не удалось проверить подписку. Убедитесь, что бот добавлен администратором канала, и повторите.',
    payment_order_not_pending: 'Счёт уже оплачен, отменён или истёк.',
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
    dialogue_disabled: 'Живой диалог в этом разделе временно закрыт администратором.',
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

async function loadPreferences({ forceRender = true } = {}) {
  if (!tg?.initData) return;
  try {
    const data = await api('/api/preferences');
    if (data.access) {
      state.dailyAccess = {
        ...state.dailyAccess,
        subscription: { ...state.dailyAccess.subscription, ...(data.access.subscription || {}) },
        dailyChoice: { ...state.dailyAccess.dailyChoice, ...(data.access.dailyChoice || {}) }
      };
    }
    if (data.tonWallet?.address && !state.tonWallet.address) {
      state.tonWallet = { status: 'ready', ...data.tonWallet };
    }
    const preferences = data.preferences;
    if (preferences) {
      state.horoscope.sign = preferences.zodiac_sign || state.horoscope.sign;
      state.horoscope.enabled = preferences.daily_horoscope_enabled === true;
      state.userGender = normalizeGender(preferences.gender || state.userGender);
      const birthYear = Number(preferences.birth_year);
      state.profile = {
        ...state.profile,
        name: preferences.profile_name || state.profile.name,
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
  if (forceRender && ['welcome', 'profile', 'horoscope', 'wheel', 'daily-choice', 'home'].includes(state.screen)) render();
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
    welcome: welcomeScreen, home: homeScreen, 'daily-choice': dailyChoiceScreen, services: servicesScreen, amur: amurScreen,
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
initializeTonWallet();
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
