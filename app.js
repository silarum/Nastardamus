const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); }

const PROXY_URL = 'https://nastardamus.vercel.app/api/proxy';

const CARD_IMAGES = {
    'Шут': 'fool.png', 'Маг': 'magician.png', 'Верховная Жрица': 'high-priestess.png',
    'Императрица': 'empress.png', 'Император': 'emperor.png', 'Иерофант': 'hierophant.png',
    'Влюблённые': 'lovers.png', 'Колесница': 'chariot.png', 'Сила': 'strength.png',
    'Отшельник': 'hermit.png', 'Колесо Фортуны': 'wheel-of-fortune.png', 'Справедливость': 'justice.png',
    'Повешенный': 'hanged-man.png', 'Смерть': 'death.png', 'Умеренность': 'temperance.png',
    'Дьявол': 'devil.png', 'Башня': 'tower.png', 'Звезда': 'star.png',
    'Луна': 'moon.png', 'Солнце': 'sun.png', 'Суд': 'judgement.png', 'Мир': 'world.png'
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
    compatResult: document.getElementById('compat-result-screen')
};

function showScreen(s) {
    Object.values(screens).forEach(el => el.classList.remove('active'));
    if (screens[s]) screens[s].classList.add('active');
}

// Анимация букв
function animateTitle() {
    const titleEl = document.getElementById('title-animated');
    if (!titleEl) return;
    const text = titleEl.textContent; titleEl.innerHTML = '';
    text.split('').forEach((letter, i) => {
        const span = document.createElement('span'); span.textContent = letter;
        span.style.opacity = '0'; span.style.display = 'inline-block';
        span.style.animation = `flyIn 0.5s ${i * 0.1}s forwards, glowLetter 2s ${i * 0.1}s infinite alternate`;
        titleEl.appendChild(span);
    });
}
animateTitle();

// Приветствие
document.getElementById('continue-btn').addEventListener('click', () => { updateCreditsBadge(); showScreen('menu'); });

// Навигация
document.querySelectorAll('.back-btn').forEach(btn => {
    btn.addEventListener('click', () => { const t = btn.dataset.target; if (t && screens[t]) showScreen(t); });
});

// Меню
document.getElementById('go-tarot').addEventListener('click', () => playMageVideo());
document.getElementById('go-natal').addEventListener('click', () => showScreen('natalInput'));
document.getElementById('go-compat').addEventListener('click', () => showScreen('compatInput'));

// ===== ВИДЕО МАГА =====
function playMageVideo() {
    showScreen('video');
    const video = document.getElementById('mage-video');
    video.currentTime = 0;
    video.play().catch(() => {
        // Если автовоспроизведение заблокировано — показываем кнопку
    });
    // После окончания видео переходим к вопросу Таро
    video.onended = () => {
        showScreen('tarotInput');
    };
    // Если видео не загрузилось — сразу переходим
    video.onerror = () => {
        showScreen('tarotInput');
    };
    // Можно пропустить видео касанием
    video.addEventListener('click', () => {
        video.pause();
        showScreen('tarotInput');
    });
}

// Помощь
const helpTexts = {
    'tarot-question': 'Задайте волнующий вас вопрос. Чем точнее вопрос, тем яснее ответ карт.',
    'tarot-shuffle': 'Сдвиньте верхнюю карту — колода разлетится. Выберите одну карту двойным касанием. Повторите 3 раза.',
    'natal': 'Введите дату и время рождения для расчёта натальной карты.',
    'compat': 'Введите имена и даты рождения двух людей для анализа совместимости.',
    'welcome': 'Nastardamus — ваш проводник в мир Таро и астрологии. Первый расклад бесплатный.'
};
function showHelp(key) {
    document.getElementById('help-title').textContent = 'Справка';
    document.getElementById('help-text').textContent = helpTexts[key] || 'Следуйте инструкциям.';
    document.getElementById('help-modal').classList.add('active');
}
document.getElementById('help-btn-welcome').addEventListener('click', () => showHelp('welcome'));
document.getElementById('help-btn-menu').addEventListener('click', () => showHelp('welcome'));
document.querySelectorAll('.help-icon-small').forEach(btn => btn.addEventListener('click', () => showHelp(btn.dataset.help)));
document.getElementById('close-help').addEventListener('click', () => document.getElementById('help-modal').classList.remove('active'));

// Счётчик
let freeUsed = false, paid = 0;
function updateCreditsBadge() {
    document.getElementById('credit-count').textContent = freeUsed ? '0' : '1';
    document.getElementById('paid-count').textContent = paid;
}

// Фоновые частицы
const pCanvas = document.getElementById('particles-canvas'), pCtx = pCanvas.getContext('2d');
let bgParticles = [];
function resizeCanvas() { pCanvas.width = window.innerWidth; pCanvas.height = window.innerHeight; }
window.addEventListener('resize', resizeCanvas); resizeCanvas();
for (let i = 0; i < 60; i++) bgParticles.push({ x: Math.random()*pCanvas.width, y: Math.random()*pCanvas.height, size: Math.random()*2+0.5, speedX: (Math.random()-0.5)*0.3, speedY: (Math.random()-0.5)*0.3, opacity: Math.random()*0.5+0.2 });
function animateBgParticles() {
    pCtx.clearRect(0,0,pCanvas.width,pCanvas.height);
    bgParticles.forEach(p => { p.x+=p.speedX; p.y+=p.speedY; if(p.x<0)p.x=pCanvas.width; if(p.x>pCanvas.width)p.x=0; if(p.y<0)p.y=pCanvas.height; if(p.y>pCanvas.height)p.y=0; pCtx.fillStyle=`rgba(255,215,0,${p.opacity})`; pCtx.beginPath(); pCtx.arc(p.x,p.y,p.size,0,Math.PI*2); pCtx.fill(); });
    requestAnimationFrame(animateBgParticles);
}
animateBgParticles();

// ===== ТАСОВКА КОЛОДЫ =====
const deckNames = Object.keys(CARD_IMAGES);
let selectedCards = [], cardsToSelect = 3, currentRound = 0, availableCards = [];

document.getElementById('start-tarot').addEventListener('click', () => {
    window.tarotQuestion = document.getElementById('tarot-question').value.trim() || 'Что ждёт меня на пути?';
    if (!freeUsed) { freeUsed = true; startShuffleRitual(); }
    else if (paid > 0) { paid--; startShuffleRitual(); }
    else { if (confirm('Нет оплаченных вопросов. Добавить 1 тестовый?')) { paid++; startShuffleRitual(); } }
});

function startShuffleRitual() {
    selectedCards = []; currentRound = 0;
    availableCards = [...deckNames];
    document.getElementById('selected-cards-preview').innerHTML = '';
    document.getElementById('cards-left').textContent = 'Выбрано: 0 из 3';
    document.getElementById('progress-fill').style.width = '0%';
    showScreen('tarotCards');
    resetDeckStack();
}

function resetDeckStack() {
    const stack = document.getElementById('deck-stack');
    stack.style.display = 'block';
    document.getElementById('spread-area').innerHTML = '';
    document.getElementById('shuffle-instruction').textContent = currentRound === 0 ? 'Сдвиньте верхнюю карту' : `Выберите ${3 - currentRound} карту`;
}

document.getElementById('deck-stack').addEventListener('click', () => {
    if (currentRound >= cardsToSelect) return;
    if (document.querySelectorAll('.spread-card').length > 0) return;
    spreadCards();
});

function spreadCards() {
    const area = document.getElementById('spread-area');
    area.innerHTML = '';
    const w = area.offsetWidth, h = area.offsetHeight;
    const shuffled = [...availableCards].sort(() => Math.random() - 0.5);
    shuffled.forEach(name => {
        const card = document.createElement('div');
        card.className = 'spread-card';
        card.dataset.name = name;
        card.style.left = (20 + Math.random() * (w - 120)) + 'px';
        card.style.top = (20 + Math.random() * (h - 170)) + 'px';
        card.style.transform = `rotate(${(Math.random() - 0.5) * 50}deg)`;
        let tapTimer = null;
        card.addEventListener('click', (ev) => {
            ev.stopPropagation();
            if (tapTimer) { clearTimeout(tapTimer); tapTimer = null; selectCard(card, name); }
            else { tapTimer = setTimeout(() => { tapTimer = null; }, 300); }
        });
        area.appendChild(card);
    });
    enableSpreadDrag(area);
}

function enableSpreadDrag(area) {
    let dragCard = null, offX, offY;
    area.addEventListener('touchstart', (e) => {
        const card = e.target.closest('.spread-card');
        if (!card || card.classList.contains('fly-out')) return;
        dragCard = card; const r = card.getBoundingClientRect();
        offX = e.touches[0].clientX - r.left; offY = e.touches[0].clientY - r.top;
        card.style.zIndex = 50; card.classList.add('highlight');
    }, { passive: false });
    area.addEventListener('touchmove', (e) => {
        if (!dragCard) return; e.preventDefault();
        const areaRect = area.getBoundingClientRect();
        dragCard.style.left = (e.touches[0].clientX - areaRect.left - offX) + 'px';
        dragCard.style.top = (e.touches[0].clientY - areaRect.top - offY) + 'px';
    }, { passive: false });
    area.addEventListener('touchend', () => {
        if (!dragCard) return;
        dragCard.classList.remove('highlight'); dragCard.style.zIndex = 5; dragCard = null;
    });
}

function selectCard(cardEl, name) {
    if (currentRound >= cardsToSelect) return;
    if (navigator.vibrate) navigator.vibrate(30);
    availableCards = availableCards.filter(n => n !== name);
    selectedCards.push({ name });
    currentRound++;
    cardEl.classList.add('fly-out');
    setTimeout(() => { cardEl.remove(); }, 500);
    const preview = document.createElement('div');
    preview.className = 'selected-card-preview';
    preview.style.backgroundImage = `url('images/cards/${CARD_IMAGES[name]}')`;
    document.getElementById('selected-cards-preview').appendChild(preview);
    document.getElementById('cards-left').textContent = `Выбрано: ${selectedCards.length} из 3`;
    document.getElementById('progress-fill').style.width = (currentRound / cardsToSelect * 100) + '%';
    if (currentRound >= cardsToSelect) {
        setTimeout(() => {
            document.querySelectorAll('.spread-card').forEach(c => c.classList.add('collecting'));
            setTimeout(() => {
                document.getElementById('spread-area').innerHTML = '';
                document.getElementById('deck-stack').style.display = 'none';
                getTarotPrediction();
            }, 500);
        }, 600);
    } else {
        setTimeout(() => {
            document.querySelectorAll('.spread-card').forEach(c => c.classList.add('collecting'));
            setTimeout(() => {
                document.getElementById('spread-area').innerHTML = '';
                document.getElementById('shuffle-instruction').textContent = `Выберите ${3 - currentRound} карту`;
                resetDeckStack();
            }, 500);
        }, 600);
    }
}

// ===== ЗАПРОС К ПРОКСИ =====
async function callMage(systemPrompt, userMessage) {
    try {
        const response = await fetch(PROXY_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMessage }] }) });
        if (!response.ok) return null;
        const data = await response.json();
        return data.choices[0].message.content;
    } catch (e) { return null; }
}

const BASE_MAGE_PROMPT = `Ты — Маг Эзотериум, потомственный маг, астролог и таролог, живой человек. Ты никогда не упоминаешь технологии, ИИ, модели. Ты говоришь загадочно, образно, с психологической глубиной.`;

async function getTarotPrediction() {
    showScreen('tarotResult'); updateCreditsBadge();
    document.getElementById('result-cards').innerHTML = selectedCards.map(c => `<img src="images/cards/${CARD_IMAGES[c.name]}" alt="${c.name}" onerror="this.style.display='none'">`).join('');
    const textEl = document.getElementById('prediction-text');
    textEl.textContent = '🔮 Маг Эзотериум вглядывается в карты...';
    const cardsNames = selectedCards.map(c => c.name).join(', ');
    const answer = await callMage(BASE_MAGE_PROMPT + ' Начинай ответ с "Маг Эзотериум видит...".', `Вопрос: "${window.tarotQuestion}". Выпали карты: ${cardsNames}.`);
    textEl.textContent = answer || '✨ Маг Эзотериум сегодня отдыхает.';
}

document.getElementById('share-btn').addEventListener('click', () => {
    const text = document.getElementById('prediction-text').textContent;
    if (navigator.share) navigator.share({ title: 'Предсказание Nastardamus', text });
    else alert('Скопируйте текст предсказания.');
});

// Натальная
document.getElementById('get-natal').addEventListener('click', async () => {
    const date = document.getElementById('natal-date').value; if (!date) return alert('Введите дату');
    showScreen('natalResult'); document.getElementById('natal-text').textContent = 'Рассчитываем...';
    const answer = await callMage(BASE_MAGE_PROMPT + ' Начинай со слов "Звёзды поведали мне...".', `Натальная карта для рождения ${date} ${document.getElementById('natal-time').value}.`);
    document.getElementById('natal-text').textContent = answer || 'Не удалось получить ответ.';
});

// Совместимость
document.getElementById('get-compat').addEventListener('click', async () => {
    const n1 = document.getElementById('person1-name').value.trim() || 'Первый', d1 = document.getElementById('person1-date').value;
    const n2 = document.getElementById('person2-name').value.trim() || 'Второй', d2 = document.getElementById('person2-date').value;
    if (!d1 || !d2) return alert('Введите даты');
    showScreen('compatResult'); document.getElementById('compat-text').textContent = 'Анализируем...';
    const answer = await callMage(BASE_MAGE_PROMPT + ' Начинай с "Маг Эзотериум раскрывает тайну...".', `Совместимость ${n1} (${d1}) и ${n2} (${d2}).`);
    document.getElementById('compat-text').textContent = answer || 'Не удалось получить ответ.';
});

showScreen('welcome');
