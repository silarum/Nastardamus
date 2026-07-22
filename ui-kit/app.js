import {
  AppShell, ScreenContainer, BrandLogo, AppHeader, GreetingCard, BalanceCard,
  FortuneWheelCard, SectionTitle, QuickAccessGrid, BottomNavigation, UploadCard,
  GoalSelector, EnergyHandsScene, InfoBanner, MysticButton, PriceLine,
  DataStatusCard, ActionGroup, CompatibilityHero, Tabs, MysticCard, ServiceCard,
  StatusBadge, GlowDivider
} from './components/index.js';
import { h } from './core/dom.js';
import { Icon } from './core/icon.js';

const tg = window.Telegram?.WebApp;
tg?.ready?.();
tg?.expand?.();
tg?.setHeaderColor?.('#070913');
tg?.setBackgroundColor?.('#070913');

const mount = document.getElementById('premium-app');
const toast = document.getElementById('premium-toast');
const ONBOARDED_KEY = 'nastardamus-onboarded-v2';
const JOURNAL_KEY = 'nastardamus-journal-v2';
const SUPPORT_KEY = 'nastardamus-support-v4';

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
const state = {
  screen: requestedScreen || (localStorage.getItem(ONBOARDED_KEY) ? 'home' : 'welcome'),
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
  palmOne: '',
  palmTwo: '',
  palmGoal: 'love',
  partnerName: '',
  support: readJSON(SUPPORT_KEY, []),
  supportDraft: ''
};

let toastTimer;

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

function navigate(screen, { replace = false } = {}) {
  state.screen = screen;
  const url = new URL(location.href);
  url.searchParams.set('screen', screen);
  history[replace ? 'replaceState' : 'pushState']({}, '', url);
  render();
  window.scrollTo?.({ top: 0, behavior: 'auto' });
  if (screen === 'profile') loadWallet({ force: true });
}

function activeTab(screen = state.screen) {
  if (screen === 'home' || screen === 'wheel' || screen === 'video') return 'home';
  if (screen === 'history') return 'history';
  if (screen === 'profile' || screen === 'withdrawal') return 'profile';
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
    localStorage.setItem(ONBOARDED_KEY, 'true');
    pulse('medium');
    navigate('home', { replace: true });
  } });
  const watch = MysticButton({ text: 'Посмотреть приветствие', icon: 'orbit', variant: 'gold', onClick: () => navigate('video') });
  return shell([
    h('section', { className: 'premium-welcome' },
      h('img', { className: 'premium-welcome-art', attrs: { src: '/images/splash-v2.webp', alt: '' } }),
      h('div', { className: 'premium-welcome-scrim' }),
      h('div', { className: 'premium-welcome-content' },
        BrandLogo(), h('p', { className: 'premium-kicker', text: 'ПРОСТРАНСТВО ЭЗОТЕРИУМА' }),
        h('h1', { text: 'Услышьте свой знак' }),
        h('p', { text: 'Таро, звёзды, символические фото-чтения и личный дневник в одном пространстве.' }),
        enter, watch,
        h('small', { text: 'Толкования созданы для размышления и развлечения.' })
      )
    )
  ], { tabs: false });
}

function videoScreen() {
  const video = h('video', { className: 'premium-video', attrs: { src: '/video/welcome-v2.mp4', poster: '/images/splash-v2.webp', controls: true, playsinline: true, preload: 'metadata' } });
  return shell([
    screenHeader('Послание Эзотериума', '8 секунд перед началом', 'home'),
    MysticCard({ className: 'premium-video-card', children: [video] }),
    MysticButton({ text: 'Перейти в приложение', icon: 'sparkle', variant: 'primary', onClick: () => navigate('home') })
  ], { active: 'home' });
}

function homeScreen() {
  const wallet = state.wallet?.wallet || { balance: 0, available: 0, freeSpins: 0 };
  const header = h('header', { className: 'premium-home-header' }, BrandLogo(),
    h('button', { className: 'premium-avatar-button', attrs: { type: 'button', 'aria-label': 'Открыть профиль' }, on: { click: () => navigate('profile') } }, Icon('profile', { size: 23 }))
  );
  const balance = BalanceCard({ amount: Number(wallet.balance || 0), currency: 'SILARUM' });
  balance.classList.add('premium-balance');
  balance.setAttribute('role', 'button');
  balance.tabIndex = 0;
  balance.addEventListener('click', () => navigate('profile'));
  balance.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') navigate('profile'); });
  balance.append(h('div', { className: `premium-wallet-state premium-wallet-state--${state.walletStatus}`, text: walletStatusText() }));

  const wheel = FortuneWheelCard({ caption: `Доступно вращений: ${Number(wallet.freeSpins || 0)}` });
  const wheelWrap = h('div', { className: 'premium-wheel-wrap' }, wheel,
    h('button', { className: 'premium-wheel-action', attrs: { type: 'button', 'aria-label': 'Открыть Колесо Фортуны' }, on: { click: () => navigate('wheel') } }),
    h('div', { className: 'premium-wheel-result', text: 'Коснитесь, чтобы открыть' })
  );

  return shell([
    header,
    GreetingCard({ username: firstName(), message: 'Слушай знаки. Доверься интуиции.' }),
    balance,
    wheelWrap,
    SectionTitle({ text: 'Быстрый доступ' }),
    QuickAccessGrid({ items: [
      { icon: 'heart', title: 'Путь двух судеб', onClick: () => navigate('palm') },
      { icon: 'tarot', title: 'Таро расклад', onClick: () => navigate('tarot') },
      { icon: 'orbit', title: 'Астро прогноз', onClick: () => navigate('natal') },
      { icon: 'wheel', title: 'Колесо Фортуны', badge: wallet.freeSpins ? `+${wallet.freeSpins}` : '', onClick: () => navigate('wheel') }
    ] }),
    h('div', { className: 'premium-secondary-grid' },
      serviceTile('sparkle', 'Энергетический след', 'Символическое чтение по фотографии', () => navigate('photo-energy')),
      serviceTile('users', 'Совместимость по фото', 'Бережный анализ двух образов', () => navigate('photo-compat')),
      serviceTile('services', 'Все услуги', 'Расклады, фото и поддержка', () => navigate('services')),
      serviceTile('orbit', 'Послание мага', 'Рабочее приветственное видео', () => navigate('video'))
    )
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
      serviceTile('tarot', 'Семь раскладов Таро', 'От одной карты до Кельтского креста', () => navigate('tarot'), 'AI'),
      serviceTile('orbit', 'Натальная подсказка', 'Сильные стороны и текущий ориентир', () => navigate('natal'), 'AI'),
      serviceTile('sparkle', 'Энергетический след', 'Одно фото и безопасное символическое чтение', () => navigate('photo-energy'), 'AI'),
      serviceTile('users', 'Совместимость по фото', 'Два образа, диалог и точки опоры', () => navigate('photo-compat'), 'AI'),
      serviceTile('hand', 'Путь двух судеб', 'Ладони и совместный ритуал', () => navigate('palm')),
      serviceTile('info', 'Спросить Эзотериума', 'Помощник по функциям приложения', () => navigate('support'))
    ),
    InfoBanner({ text: 'Фото-чтения и прогнозы являются символическими и не заменяют профессиональную помощь.' })
  ], { active: 'services' });
}

function wheelScreen() {
  const wrap = h('div', { className: 'premium-wheel-wrap premium-wheel-screen' }, FortuneWheelCard({ caption: 'Демо-вращение не меняет баланс' }),
    h('div', { className: 'premium-wheel-result', text: 'Нажмите кнопку, чтобы увидеть анимацию' })
  );
  const spin = MysticButton({ text: 'Демо-вращение', icon: 'wheel', variant: 'gold', onClick: () => spinWheel(wrap) });
  return shell([
    screenHeader('Колесо Фортуны', 'Без начислений в Preview', 'home'), wrap, spin,
    InfoBanner({ text: 'Настоящие начисления появятся только после подключения защищённой серверной операции. Демо не списывает и не добавляет SILARUM.' })
  ], { active: 'home' });
}

function spinWheel(wrap) {
  if (wrap.classList.contains('is-spinning')) return;
  wrap.classList.add('is-spinning');
  wrap.querySelector('.premium-wheel-result').textContent = 'Колесо читает знак…';
  pulse('medium');
  setTimeout(() => {
    const values = [5, 10, 50, 75, 100, 250, 500, 1000];
    const value = values[Math.floor(Math.random() * values.length)];
    wrap.classList.remove('is-spinning');
    wrap.querySelector('.premium-wheel-result').textContent = `Демо-сектор: ${value} SILARUM`;
    notify('Баланс не изменён — это демонстрация');
  }, 3400);
}

function tarotScreen() {
  const spread = selectField(SPREADS, state.spread, (value) => { state.spread = value; });
  const question = textarea({ value: state.tarotQuestion, placeholder: 'Например: что поможет мне принять решение?', onInput: (value) => { state.tarotQuestion = value; }, maxLength: 500 });
  return shell([
    screenHeader('Расклад Таро', 'Семь вариантов для разных вопросов', 'services'),
    MysticCard({ className: 'premium-form-card', children: [
      field('Вид расклада', spread),
      field('Ваш вопрос', question, 'Не вводите адреса, пароли и платёжные данные.')
    ] }),
    MysticButton({ text: 'Перейти к выбору карт', icon: 'tarot', variant: 'primary', onClick: startTarot }),
    InfoBanner({ text: 'Карты не предрешают будущее — они помогают увидеть ситуацию с другого угла.' })
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
  state.busy = true;
  render();
  try {
    const answer = await requestReading('tarot', { question: state.tarotQuestion.trim(), cards: state.tarotCards, spread: state.spread, positions: spread.positions });
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
    state.busy ? loadingCard('Смотрим на дату и время…') : null,
    InfoBanner({ text: 'Без места рождения результат ограничен и носит символический характер.' })
  ]);
}

async function submitNatal() {
  if (!state.natalDate) return notify('Укажите дату рождения');
  if (state.busy) return;
  state.busy = true; render();
  try {
    const answer = await requestReading('natal', { date: state.natalDate, time: state.natalTime || '12:00' });
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
  const firstUpload = imageUpload({ title: isPair ? 'Первое фото' : 'Загрузите фотографию', image: state.photoOne, onImage: (image) => { state.photoOne = image; render(); } });
  const secondUpload = isPair ? imageUpload({ title: 'Второе фото', image: state.photoTwo, onImage: (image) => { state.photoTwo = image; render(); } }) : null;
  return shell([
    screenHeader(isPair ? 'Совместимость по фото' : 'Энергетический след', isPair ? 'Два образа и бережный диалог' : 'Без диагнозов и утверждений о порче', 'services'),
    h('div', { className: isPair ? 'premium-upload-grid' : '' }, firstUpload, secondUpload),
    isPair ? MysticCard({ className: 'premium-form-card', children: [
      field('Имя первого человека', textInput({ value: state.photoNameOne, placeholder: 'Имя', onInput: (value) => { state.photoNameOne = value; } })),
      field('Имя второго человека', textInput({ value: state.photoNameTwo, placeholder: 'Имя', onInput: (value) => { state.photoNameTwo = value; } }))
    ] }) : null,
    field('Что важно понять?', textarea({ value: state.photoConcern, placeholder: isPair ? 'Что важно проговорить в этих отношениях?' : 'Что сейчас беспокоит и где найти опору?', onInput: (value) => { state.photoConcern = value; }, maxLength: 600 })),
    MysticButton({ text: state.busy ? 'Читаем образ…' : 'Получить символическое чтение', icon: 'sparkle', variant: 'primary', disabled: state.busy, onClick: () => submitPhoto(isPair) }),
    state.busy ? loadingCard('Изучаем свет, композицию и настроение…') : null,
    InfoBanner({ text: 'Nastardamus не определяет здоровье, характер, верность, магическое воздействие или будущее по фотографии.' })
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

async function submitPhoto(pair) {
  if (!state.photoOne || (pair && !state.photoTwo)) return notify(pair ? 'Загрузите оба фото' : 'Загрузите фотографию');
  if (state.busy) return;
  state.busy = true; render();
  try {
    const feature = pair ? 'photo_compatibility' : 'photo_energy';
    const payload = pair
      ? { concern: state.photoConcern || 'Что важно понять о динамике этих отношений?', firstName: state.photoNameOne || 'Первый человек', secondName: state.photoNameTwo || 'Второй человек', firstImage: state.photoOne, secondImage: state.photoTwo }
      : { concern: state.photoConcern || 'Что сейчас важно понять и где вернуть опору?', image: state.photoOne };
    const answer = await requestReading(feature, payload);
    state.result = { id: uniqueId(feature), type: pair ? 'Совместимость по фото' : 'Энергетический след', title: state.photoConcern || 'Символическое фото-чтение', body: answer, cards: [], createdAt: new Date().toISOString(), favorite: false };
    navigate('photo-result');
  } catch (error) { notify(apiErrorMessage(error)); }
  finally { state.busy = false; render(); }
}

function photoResultScreen() {
  return state.result ? resultScreen({ title: state.result.type, subtitle: 'Безопасное символическое чтение', back: state.photoMode === 'compatibility' ? 'photo-compat' : 'photo-energy', result: state.result }) : servicesScreen();
}

function palmScreen() {
  const upload = imageUpload({ title: 'Загрузите фото своей ладони', image: state.palmOne, onImage: (image) => { state.palmOne = image; render(); } });
  const selector = GoalSelector({ value: state.palmGoal, onChange: (goal) => { state.palmGoal = goal; render(); } });
  return shell([
    screenHeader('Путь двух судеб', 'Найди связь через символы ладоней', 'services'),
    upload,
    SectionTitle({ text: 'Цель поиска' }), selector,
    EnergyHandsScene(),
    InfoBanner({ text: 'Чтение сравнивает видимые образы и служит поводом для диалога, а не измерением судьбы.' }),
    MysticButton({ text: 'Продолжить ритуал', icon: 'heart', variant: 'primary', onClick: () => state.palmOne ? navigate('ritual') : notify('Сначала загрузите фото ладони') }),
    PriceLine({ price: 250 })
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
    ServiceCard({ title: 'Путь двух судеб', description: 'Бережный анализ образов, точек притяжения и тем для разговора.', price: 250 }),
    DataStatusCard({ title: 'Ваши данные', status: state.palmOne ? 'ready' : 'waiting', description: state.palmOne ? 'Ваша ладонь загружена' : 'Фото отсутствует', meta: state.palmOne ? 'Готово к чтению' : 'Вернитесь на шаг назад', empty: !state.palmOne }),
    SectionTitle({ text: 'Данные партнёра' }), partnerUpload,
    field('Имя партнёра', textInput({ value: state.partnerName, placeholder: 'Имя', onInput: (value) => { state.partnerName = value; } })),
    actions,
    MysticButton({ text: state.busy ? 'Соединяем образы…' : 'Получить совместное чтение', icon: 'sparkle', variant: 'primary', disabled: state.busy, onClick: submitPalmCompatibility }),
    state.busy ? loadingCard() : null,
    h('p', { className: 'premium-info-note', text: 'Списание SILARUM не выполняется: платёжный контур пока отключён.' })
  ]);
}

async function shareInvite() {
  const text = 'Nastardamus: присоединитесь к символическому ритуалу «Путь двух судеб».';
  try {
    if (navigator.share) await navigator.share({ title: 'Nastardamus', text, url: location.origin });
    else await navigator.clipboard.writeText(`${text} ${location.origin}`);
    notify('Приглашение готово');
  } catch (error) { if (error?.name !== 'AbortError') notify('Не удалось поделиться'); }
}

async function submitPalmCompatibility() {
  if (!state.palmOne || !state.palmTwo) return notify('Добавьте обе ладони');
  if (state.busy) return;
  state.busy = true; render();
  try {
    const answer = await requestReading('photo_compatibility', {
      concern: `Что важно понять о связи с целью «${goalLabel(state.palmGoal)}»?`,
      firstName: firstName(), secondName: state.partnerName || 'Партнёр',
      firstImage: state.palmOne, secondImage: state.palmTwo
    });
    state.result = { id: uniqueId('palm'), type: 'Путь двух судеб', title: `${firstName()} и ${state.partnerName || 'Партнёр'}`, body: answer, cards: [], createdAt: new Date().toISOString(), favorite: false };
    navigate('compatibility-result');
  } catch (error) { notify(apiErrorMessage(error)); }
  finally { state.busy = false; render(); }
}

function goalLabel(value) {
  return ({ love: 'любовь', friendship: 'дружба', communication: 'общение', business: 'деловой союз' })[value] || 'общение';
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

function historyScreen() {
  const entries = readJSON(JOURNAL_KEY, []);
  return shell([
    screenHeader('История', 'Сохранённые знаки и ответы', 'home'),
    entries.length ? h('div', { className: 'premium-history-list' }, entries.map((entry) => MysticCard({ className: 'premium-history-card', children: [
      h('div', { className: 'premium-history-head' }, h('strong', { text: entry.type || 'Символическое чтение' }), h('small', { text: formatDate(entry.createdAt) })),
      h('h3', { text: entry.title || 'Без названия' }),
      h('p', { text: String(entry.body || '').slice(0, 240) }),
      MysticButton({ text: 'Поделиться', icon: 'share', variant: 'outline', onClick: () => shareResult(entry) })
    ] }))) : MysticCard({ className: 'premium-empty-state', children: [Icon('history', { size: 44 }), h('h2', { text: 'История пока пуста' }), h('p', { text: 'Сохраните расклад или фото-чтение — оно появится здесь.' }), MysticButton({ text: 'Выбрать услугу', icon: 'services', variant: 'primary', onClick: () => navigate('services') })] })
  ], { active: 'history' });
}

function profileScreen() {
  const wallet = state.wallet?.wallet || { balance: 0, available: 0, locked: 0, freeSpins: 0 };
  const balance = BalanceCard({ amount: wallet.balance || 0, currency: 'SILARUM' });
  const ledger = state.wallet?.ledger || [];
  return shell([
    screenHeader('Профиль', 'Личное пространство и счёт', 'home'),
    GreetingCard({ username: firstName(), message: 'Ваши данные из Telegram не показываются другим пользователям.' }),
    balance,
    h('div', { className: 'premium-wallet-metrics' },
      MysticCard({ children: [h('small', { text: 'Доступно' }), h('strong', { text: formatMoney(wallet.available) })] }),
      MysticCard({ children: [h('small', { text: 'Заблокировано' }), h('strong', { text: formatMoney(wallet.locked) })] }),
      MysticCard({ children: [h('small', { text: 'Вращения' }), h('strong', { text: String(wallet.freeSpins || 0) })] })
    ),
    state.walletStatus === 'error' ? InfoBanner({ text: state.walletMessage || 'Счёт доступен внутри Telegram.' }) : null,
    h('div', { className: 'premium-profile-actions' },
      MysticButton({ text: 'Обновить счёт', icon: 'coin', variant: 'outline', onClick: () => loadWallet({ force: true }) }),
      MysticButton({ text: state.wallet?.config?.withdrawalsEnabled ? 'Обменять SILARUM' : 'Обмен закрыт', icon: 'payment', variant: 'gold', disabled: !state.wallet?.config?.withdrawalsEnabled, onClick: () => navigate('withdrawal') }),
      MysticButton({ text: 'Спросить поддержку', icon: 'info', variant: 'primary', onClick: () => navigate('support') })
    ),
    SectionTitle({ text: 'Последние операции' }),
    ledger.length ? h('div', { className: 'premium-ledger' }, ledger.slice(0, 20).map(ledgerRow)) : MysticCard({ className: 'premium-empty-state premium-empty-state--small', children: [h('p', { text: 'Операций пока нет.' })] })
  ], { active: 'profile' });
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
    InfoBanner({ text: `Доступно ${formatMoney(state.wallet?.wallet?.available)} SILARUM. Минимум ${formatMoney(config.minimumWithdrawal || 25)}. Комиссия ${Number(config.withdrawalFee || 25)}%.` }),
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
    const data = await api('/api/wallet', { method: 'POST', body: { action: 'request_withdrawal', amount: Number(amount), destination } });
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

async function requestReading(feature, payload) {
  const data = await api('/api/proxy', { method: 'POST', body: { feature, payload } });
  if (typeof data.answer !== 'string' || !data.answer.trim()) throw new Error('empty_response');
  return data.answer.trim();
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
    withdrawals_disabled: 'Обмен сейчас закрыт.', below_minimum: 'Сумма ниже минимума.',
    insufficient_funds: 'Недостаточно доступных SILARUM.', invalid_destination: 'Проверьте адрес кошелька.'
  };
  return messages[error?.message] || 'Не удалось выполнить действие. Проверьте соединение и повторите.';
}

async function loadWallet({ force = false } = {}) {
  if (state.walletStatus === 'loading' && !force && state.wallet) return;
  state.walletStatus = 'loading';
  if (state.screen === 'home' || state.screen === 'profile') render();
  try {
    state.wallet = await api('/api/wallet');
    state.walletStatus = 'ready';
    state.walletMessage = '';
  } catch (error) {
    state.walletStatus = 'error';
    state.walletMessage = apiErrorMessage(error);
  }
  if (state.screen === 'home' || state.screen === 'profile') render();
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
    welcome: welcomeScreen, video: videoScreen, home: homeScreen, services: servicesScreen,
    wheel: wheelScreen, tarot: tarotScreen, 'tarot-draw': tarotDrawScreen, 'tarot-result': tarotResultScreen,
    natal: natalScreen, 'natal-result': natalResultScreen,
    'photo-energy': () => photoScreen('energy'), 'photo-compat': () => photoScreen('compatibility'), 'photo-result': photoResultScreen,
    palm: palmScreen, ritual: ritualScreen, 'compatibility-result': compatibilityResultScreen,
    history: historyScreen, profile: profileScreen, withdrawal: withdrawalScreen, support: supportScreen
  };
  if (!routes[state.screen]) state.screen = 'home';
  mount.dataset.screen = state.screen;
  mount.replaceChildren(routes[state.screen]());
}

window.addEventListener('popstate', () => {
  state.screen = new URLSearchParams(location.search).get('screen') || 'home';
  render();
});

render();
loadWallet();

export { navigate, render, state };
