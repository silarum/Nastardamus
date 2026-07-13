const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); }

const PROXY_URL = 'https://nastardamus.vercel.app/api/proxy';

const CARD_IMAGES = {
    'Шут':'fool.png','Маг':'magician.png','Верховная Жрица':'high-priestess.png',
    'Императрица':'empress.png','Император':'emperor.png','Иерофант':'hierophant.png',
    'Влюблённые':'lovers.png','Колесница':'chariot.png','Сила':'strength.png',
    'Отшельник':'hermit.png','Колесо Фортуны':'wheel-of-fortune.png','Справедливость':'justice.png',
    'Повешенный':'hanged-man.png','Смерть':'death.png','Умеренность':'temperance.png',
    'Дьявол':'devil.png','Башня':'tower.png','Звезда':'star.png',
    'Луна':'moon.png','Солнце':'sun.png','Суд':'judgement.png','Мир':'world.png'
};

const screens = {
    welcome: document.getElementById('welcome-screen'),
    video: document.getElementById('video-screen'),
    menu: document.getElementById('menu-screen'),
    tarotInput: document.getElementById('tarot-input-screen'),
    tarotCards: document.getElementById('tarot-cards-screen'),
    tarotResult: document.getElementById('tarot-result-screen'),
    natalInput: document.getElementById('natal-input-screen'),
    natalResult: document.getElementById('natal-result-screen'),
    compatInput: document.getElementById('compat-input-screen'),
    compatResult: document.getElementById('compat-result-screen'),
    walletScreen: document.getElementById('wallet-screen'),
    buySilarumScreen: document.getElementById('buy-silarum-screen'),
    paymentInstructionScreen: document.getElementById('payment-instruction-screen'),
    exchangeScreen: document.getElementById('exchange-screen')
};

function showScreen(s) {
    Object.values(screens).forEach(el => el.classList.remove('active'));
    if (screens[s]) screens[s].classList.add('active');
}

// Анимация букв
function animateTitle() {
    const el = document.getElementById('title-animated');
    if (!el) return;
    const text = el.textContent; el.innerHTML = '';
    text.split('').forEach((l,i) => {
        const s = document.createElement('span'); s.textContent = l;
        s.style.opacity = '0'; s.style.display = 'inline-block';
        s.style.animation = `flyIn 0.5s ${i*0.1}s forwards`;
        el.appendChild(s);
    });
}
animateTitle();

// Приветствие
document.getElementById('continue-btn').addEventListener('click', () => { updateCreditsBadge(); showScreen('menu'); });

// Навигация
document.querySelectorAll('.back-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const t = btn.dataset.target;
        if (t && screens[t]) showScreen(t);
    });
});

// Меню
document.getElementById('go-tarot').addEventListener('click', () => playMageVideo());
document.getElementById('go-natal').addEventListener('click', () => showScreen('natalInput'));
document.getElementById('go-compat').addEventListener('click', () => showScreen('compatInput'));
document.getElementById('go-wallet').addEventListener('click', () => { updateWalletDisplay(); showScreen('walletScreen'); });

// Помощь
const helpTexts = {
    'tarot-question':'Задайте вопрос — мысленно или письменно.',
    'tarot-shuffle':'Сдвиньте карту — колода разлетится. Выберите двойным касанием.',
    'natal':'Введите дату и время рождения.',
    'compat':'Введите данные двух людей.',
    'welcome':'Nastardamus — ваш проводник в мир Таро и астрологии.'
};
function showHelp(k) {
    document.getElementById('help-title').textContent = 'Справка';
    document.getElementById('help-text').textContent = helpTexts[k] || '';
    document.getElementById('help-modal').classList.add('active');
}
document.getElementById('help-btn-welcome').addEventListener('click', () => showHelp('welcome'));
document.getElementById('help-btn-menu').addEventListener('click', () => showHelp('welcome'));
document.querySelectorAll('.help-icon-small').forEach(b => b.addEventListener('click', () => showHelp(b.dataset.help)));
document.getElementById('close-help').addEventListener('click', () => document.getElementById('help-modal').classList.remove('active'));

// Кредиты
let freeUsed = false, paid = 0;
function updateCreditsBadge() {
    document.getElementById('credit-count').textContent = freeUsed ? '0' : '1';
    document.getElementById('paid-count').textContent = paid;
}

// Видео
let videoPlayed = false;
function playMageVideo() {
    showScreen('video');
    const v = document.getElementById('mage-video');
    const l = document.getElementById('video-loader');
    const s = document.getElementById('skip-video-btn');
    v.classList.remove('ready'); l.classList.remove('hidden'); s.classList.remove('visible');
    v.currentTime = 0; videoPlayed = false;
    setTimeout(() => s.classList.add('visible'), 2000);
    const t = setTimeout(() => { if(!videoPlayed){videoPlayed=true;showScreen('tarotInput');} }, 5000);
    v.onloadeddata = () => { l.classList.add('hidden'); v.classList.add('ready'); v.play().catch(() => s.classList.add('visible')); };
    v.onended = () => { if(!videoPlayed){videoPlayed=true;clearTimeout(t);showScreen('tarotInput');} };
    v.onerror = () => { if(!videoPlayed){videoPlayed=true
