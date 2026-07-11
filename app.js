const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); }

const PROXY_URL = 'https://nastardamus.vercel.app/api/proxy';

const CARD_IMAGES = {
    'Шут': 'fool.png',
    'Маг': 'magician.png',
    'Верховная Жрица': 'high-priestess.png',
    'Императрица': 'empress.png',
    'Император': 'emperor.png',
    'Иерофант': 'hierophant.png',
    'Влюблённые': 'lovers.png',
    'Колесница': 'chariot.png',
    'Сила': 'strength.png',
    'Отшельник': 'hermit.png',
    'Колесо Фортуны': 'wheel-of-fortune.png',
    'Справедливость': 'justice.png',
    'Повешенный': 'hanged-man.png',
    'Смерть': 'death.png',
    'Умеренность': 'temperance.png',
    'Дьявол': 'devil.png',
    'Башня': 'tower.png',
    'Звезда': 'star.png',
    'Луна': 'moon.png',
    'Солнце': 'sun.png',
    'Суд': 'judgement.png',
    'Мир': 'world.png'
};

const screens = {
    welcome: document.getElementById('welcome-screen'),
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
    const text = titleEl.textContent;
    titleEl.innerHTML = '';
    text.split('').forEach((letter, i) => {
        const span = document.createElement('span');
        span.textContent = letter;
        span.style.opacity = '0';
        span.style.display = 'inline-block';
        span.style.animation = `flyIn 0.5s ${i * 0.1}s forwards, glowLetter 2s ${i * 0.1}s infinite alternate`;
        titleEl.appendChild(span);
    });
    if (!document.getElementById('dynamic-keyframes')) {
        const styleSheet = document.createElement('style');
        styleSheet.id = 'dynamic-keyframes';
        styleSheet.textContent = `
            @keyframes flyIn { from { transform: translateY(-40px) rotateY(90deg); opacity: 0; } to { transform: translateY(0) rotateY(0); opacity: 1; } }
            @keyframes glowLetter { from { text-shadow: 0 0 10px var(--gold); } to { text-shadow: 0 0 25px var(--gold), 0 0 40px var(--glow); } }
        `;
        document.head.appendChild(styleSheet);
    }
}
animateTitle();

// Приветствие
document.getElementById('continue-btn').addEventListener('click', () => showScreen('menu'));

// Навигация
document.querySelectorAll('.back-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const target = btn.dataset.target;
        if (target && screens[target]) showScreen(target);
    });
});

// Меню
document.getElementById('go-tarot').addEventListener('click', () => showScreen('tarotInput'));
document.getElementById('go-natal').addEventListener('click', () => showScreen('natalInput'));
document.getElementById('go-compat').addEventListener('click', () => showScreen('compatInput'));

// ===== ФОНОВЫЕ ЧАСТИЦЫ =====
const pCanvas = document.getElementById('particles-canvas');
const pCtx = pCanvas.getContext('2d');
let bgParticles = [];
function resizeCanvas() {
    pCanvas.width = window.innerWidth;
    pCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Создаём фон из пылинок
for (let i = 0; i < 60; i++) {
    bgParticles.push({
        x: Math.random() * pCanvas.width,
        y: Math.random() * pCanvas.height,
        size: Math.random() * 2 + 0.5,
        speedX: (Math.random() - 0.5) * 0.3,
        speedY: (Math.random() - 0.5) * 0.3,
        opacity: Math.random() * 0.5 + 0.2
    });
}
function animateBgParticles() {
    pCtx.clearRect(0, 0, pCanvas.width, pCanvas.height);
    bgParticles.forEach(p => {
        p.x += p.speedX;
        p.y += p.speedY;
        if (p.x < 0) p.x = pCanvas.width;
        if (p.x > pCanvas.width) p.x = 0;
        if (p.y < 0) p.y = pCanvas.height;
        if (p.y > pCanvas.height) p.y = 0;
        pCtx.fillStyle = `rgba(255, 215, 0, ${p.opacity})`;
        pCtx.beginPath();
        pCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        pCtx.fill();
    });
    requestAnimationFrame(animateBgParticles);
}
animateBgParticles();

// ===== СВОБОДНАЯ КОЛОДА =====
let freeUsed = false, paid = 0;
const deckNames = Object.keys(CARD_IMAGES);
let selectedCards = [];
const cardsToSelect = 3;

document.getElementById('start-tarot').addEventListener('click', () => {
    window.tarotQuestion = document.getElementById('tarot-question').value.trim() || 'Что ждёт меня на пути?';
    if (!freeUsed) { freeUsed = true; buildFreeDeck(); }
    else if (paid > 0) { paid--; buildFreeDeck(); }
    else {
        if (confirm('Нет оплаченных вопросов. Добавить 1 тестовый?')) { paid++; buildFreeDeck(); }
    }
});

function buildFreeDeck() {
    selectedCards = [];
    document.getElementById('selected-cards-preview').innerHTML = '';
    document.getElementById('cards-left').textContent = 'Выбрано: 0 из 3';
    showScreen('tarotCards');

    const deck = document.getElementById('free-deck');
    deck.innerHTML = '';
    const container = document.getElementById('free-deck-container');
    const w = container.offsetWidth;
    const h = container.offsetHeight;

    // Разбрасываем карты случайно
    for (let i = 0; i < deckNames.length; i++) {
        const card = document.createElement('div');
        card.className = 'free-card';
        card.dataset.name = deckNames[i];
        card.dataset.index = i;

        // Случайная позиция
        card.style.left = (Math.random() * (w - 100)) + 'px';
        card.style.top = (Math.random() * (h - 150)) + 'px';
        card.style.transform = `rotate(${(Math.random() - 0.5) * 60}deg)`;

        // Двойное касание для выбора
        let tapTimer = null;
        card.addEventListener('click', (e) => {
            e.stopPropagation();
            if (tapTimer) {
                clearTimeout(tapTimer);
                tapTimer = null;
                selectFreeCard(card, e);
            } else {
                tapTimer = setTimeout(() => { tapTimer = null; }, 300);
            }
        });

        deck.appendChild(card);
    }

    // Добавляем возможность перетаскивать карты
    enableCardDrag(deck);
}

function enableCardDrag(deckEl) {
    let draggingCard = null;
    let offsetX, offsetY;

    deckEl.addEventListener('touchstart', (e) => {
        const card = e.target.closest('.free-card');
        if (!card || card.classList.contains('fly-out')) return;
        draggingCard = card;
        const rect = card.getBoundingClientRect();
        offsetX = e.touches[0].clientX - rect.left;
        offsetY = e.touches[0].clientY - rect.top;
        card.style.zIndex = 500;
        card.classList.add('highlight');
    }, { passive: false });

    deckEl.addEventListener('touchmove', (e) => {
        if (!draggingCard) return;
        e.preventDefault();
        const container = document.getElementById('free-deck-container');
        const containerRect = container.getBoundingClientRect();
        const x = e.touches[0].clientX - containerRect.left - offsetX;
        const y = e.touches[0].clientY - containerRect.top - offsetY;
        draggingCard.style.left = x + 'px';
        draggingCard.style.top = y + 'px';
    }, { passive: false });

    deckEl.addEventListener('touchend', () => {
        if (!draggingCard) return;
        draggingCard.classList.remove('highlight');
        draggingCard.style.zIndex = 1;
        draggingCard = null;
    });
}

function selectFreeCard(cardEl, event) {
    if (selectedCards.length >= cardsToSelect) return;

    const cardName = cardEl.dataset.name;
    selectedCards.push({ name: cardName });

    // Вибрация
    if (navigator.vibrate) navigator.vibrate(30);

    // Анимация вылета
    cardEl.classList.add('fly-out');
    setTimeout(() => {
        cardEl.style.display = 'none';
    }, 500);

    // Затемняем оставшиеся карты
    document.querySelectorAll('.free-card').forEach(c => {
        if (!c.classList.contains('fly-out')) c.classList.add('dimmed');
    });

    // Показываем выбранную карту (уже лицом)
    const preview = document.createElement('div');
    preview.className = 'selected-card-preview';
    preview.style.backgroundImage = `url('images/cards/${CARD_IMAGES[cardName]}')`;
    document.getElementById('selected-cards-preview').appendChild(preview);
    document.getElementById('cards-left').textContent = `Выбрано: ${selectedCards.length} из 3`;

    if (selectedCards.length === cardsToSelect) {
        setTimeout(getTarotPrediction, 800);
    }
}

// ===== ЗАПРОС К ПРОКСИ =====
async function callMage(systemPrompt, userMessage) {
    try {
        const response = await fetch(PROXY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userMessage }
                ]
            })
        });
        if (!response.ok) {
            console.error('Proxy error:', response.status);
            return null;
        }
        const data = await response.json();
        return data.choices[0].message.content;
    } catch (e) {
        console.error('Fetch error:', e);
        return null;
    }
}

const BASE_MAGE_PROMPT = `Ты — Маг Эзотериум, потомственный маг, астролог и таролог, живой человек. Ты никогда не упоминаешь технологии, ИИ, модели. Ты говоришь загадочно, образно, с психологической глубиной, как мудрый наставник.`;

async function getTarotPrediction() {
    showScreen('tarotResult');
    document.getElementById('result-cards').innerHTML = selectedCards.map(c =>
        `<img src="images/cards/${CARD_IMAGES[c.name]}" alt="${c.name}" onerror="this.style.display='none'">`
    ).join('');
    const textEl = document.getElementById('prediction-text');
    textEl.textContent = '🔮 Маг Эзотериум вглядывается в карты...';
    const cardsNames = selectedCards.map(c => c.name).join(', ');
    const system = BASE_MAGE_PROMPT + ' Начинай ответ с "Маг Эзотериум видит...".';
    const answer = await callMage(system, `Вопрос: "${window.tarotQuestion}". Выпали карты: ${cardsNames}. Дай предсказание.`);
    textEl.textContent = answer || '✨ Маг Эзотериум сегодня отдыхает, но звёзды говорят: вас ждёт удача.';
}

// Натальная карта
document.getElementById('get-natal').addEventListener('click', async () => {
    const date = document.getElementById('natal-date').value;
    if (!date) return alert('Введите дату');
    showScreen('natalResult');
    document.getElementById('natal-text').textContent = 'Рассчитываем...';
    const system = BASE_MAGE_PROMPT + ' Начинай ответ со слов "Звёзды поведали мне...".';
    const answer = await callMage(system, `Натальная карта для рождения ${date} ${document.getElementById('natal-time').value}.`);
    document.getElementById('natal-text').textContent = answer || 'Не удалось получить ответ от Мага.';
});

// Совместимость
document.getElementById('get-compat').addEventListener('click', async () => {
    const n1 = document.getElementById('person1-name').value.trim() || 'Первый партнёр';
    const d1 = document.getElementById('person1-date').value;
    const n2 = document.getElementById('person2-name').value.trim() || 'Второй партнёр';
    const d2 = document.getElementById('person2-date').value;
    if (!d1 || !d2) return alert('Введите обе даты');
    showScreen('compatResult');
    document.getElementById('compat-text').textContent = 'Анализируем...';
    const system = BASE_MAGE_PROMPT + ' Начинай ответ с "Маг Эзотериум раскрывает тайну вашей связи...".';
    const answer = await callMage(system, `Совместимость ${n1} (${d1}) и ${n2} (${d2}).`);
    document.getElementById('compat-text').textContent = answer || 'Маг не смог заглянуть в вашу связь.';
});

showScreen('welcome');
