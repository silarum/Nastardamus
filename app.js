const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); }

// API-ключ по умолчанию (можно переопределить на экране приветствия)
let API_KEY = 'sk-c1ef1e8bb11a4563aae3cb3d6101976c';
const PROXY_URL = 'https://corsproxy.io/?' + encodeURIComponent('https://api.deepseek.com/v1/chat/completions');
const USE_PROXY = true; // если прямой запрос не работает, используем прокси

// Экраны
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
    screens[s].classList.add('active');
}

// Приветствие и установка ключа
document.getElementById('continue-btn').addEventListener('click', () => {
    const customKey = document.getElementById('api-key-input').value.trim();
    if (customKey) API_KEY = customKey;
    showScreen('menu');
});

// Навигация "Назад"
document.querySelectorAll('.back-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const target = btn.dataset.target;
        if (screens[target]) showScreen(target);
    });
});

// Меню
document.getElementById('tarot-btn').onclick = () => showScreen('tarotInput');
document.getElementById('natal-btn').onclick = () => showScreen('natalInput');
document.getElementById('compat-btn').onclick = () => showScreen('compatInput');

// ==================== ТАРО ====================
let freeUsed = false, paid = 0;
const deckData = [
    { name: 'Шут', emoji: '🃏' }, { name: 'Маг', emoji: '🎩' }, { name: 'Жрица', emoji: '🔮' },
    { name: 'Императрица', emoji: '👑' }, { name: 'Император', emoji: '🏰' }, { name: 'Иерофант', emoji: '📜' },
    { name: 'Влюблённые', emoji: '❤️' }, { name: 'Колесница', emoji: '🚗' }, { name: 'Сила', emoji: '🦁' },
    { name: 'Отшельник', emoji: '🏮' }, { name: 'Фортуна', emoji: '🎡' }, { name: 'Справедливость', emoji: '⚖️' },
    { name: 'Повешенный', emoji: '🪢' }, { name: 'Смерть', emoji: '💀' }, { name: 'Умеренность', emoji: '🌊' },
    { name: 'Дьявол', emoji: '👹' }, { name: 'Башня', emoji: '🗼' }, { name: 'Звезда', emoji: '⭐' },
    { name: 'Луна', emoji: '🌙' }, { name: 'Солнце', emoji: '☀️' }, { name: 'Суд', emoji: '📯' }, { name: 'Мир', emoji: '🌍' }
];

document.getElementById('start-tarot').onclick = () => {
    window.tarotQuestion = document.getElementById('tarot-question').value.trim() || 'Что меня ждёт?';
    if (!freeUsed) { freeUsed = true; startTarotDraw(); }
    else if (paid > 0) { paid--; startTarotDraw(); }
    else {
        if (confirm('Нет оплаченных вопросов. Добавить 1 тестовый?')) {
            paid++; startTarotDraw();
        }
    }
};

function startTarotDraw() {
    window.selectedCards = [];
    document.getElementById('selected-cards').innerHTML = '';
    document.getElementById('cards-left').textContent = 'Осталось карт: 3';
    showScreen('tarotCards');
}

// Обработка кликов по колоде с частицами
const deck = document.getElementById('deck');
const canvas = document.getElementById('spark-canvas');
let ctx = canvas?.getContext('2d');
let sparks = [];

function initCanvas() {
    canvas.width = deck.offsetWidth;
    canvas.height = deck.offsetHeight;
    canvas.style.position = 'absolute';
    canvas.style.top = deck.offsetTop + 'px';
    canvas.style.left = deck.offsetLeft + 'px';
}
window.addEventListener('resize', initCanvas);

deck.addEventListener('click', (e) => {
    if (window.selectedCards.length >= 3) return;
    const card = deckData[Math.floor(Math.random() * deckData.length)];
    window.selectedCards.push(card);
    // анимация переворота колоды
    deck.style.transform = 'rotateY(90deg)';
    setTimeout(() => { deck.style.transform = 'rotateY(0deg)'; }, 200);

    // золотые искры
    const rect = deck.getBoundingClientRect();
    for (let i = 0; i < 12; i++) {
        sparks.push({
            x: rect.width/2, y: rect.height/2,
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 1) * 4,
            life: 1, size: Math.random() * 3 + 1
        });
    }

    // отображаем выбранные карты
    const container = document.getElementById('selected-cards');
    const cardEl = document.createElement('div');
    cardEl.className = 'selected-card';
    cardEl.textContent = card.emoji;
    container.appendChild(cardEl);
    document.getElementById('cards-left').textContent = `Осталось карт: ${3 - window.selectedCards.length}`;

    if (window.selectedCards.length === 3) {
        deck.style.pointerEvents = 'none';
        setTimeout(getTarotPrediction, 600);
    }
});

// Анимация искр
function animateSparks() {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    sparks = sparks.filter(s => s.life > 0);
    sparks.forEach(s => {
        ctx.fillStyle = `rgba(255, 215, 0, ${s.life})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI*2);
        ctx.fill();
        s.x += s.vx;
        s.y += s.vy;
        s.life -= 0.02;
    });
    requestAnimationFrame(animateSparks);
}
initCanvas();
animateSparks();

// Запрос к API с промптом Мага Эзотериума
async function callDeepSeek(systemPrompt, userMessage) {
    const url = USE_PROXY ? PROXY_URL : 'https://api.deepseek.com/v1/chat/completions';
    const body = JSON.stringify({
        model: 'deepseek-chat',
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
        ],
        temperature: 0.9,
        max_tokens: 400
    });
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
            body
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        return data.choices[0].message.content;
    } catch (err) {
        console.error('Ошибка API:', err);
        // fallback – локальное предсказание
        return '✨ Маг Эзотериум временно недоступен. Но карты говорят: сегодня вас ждут неожиданные перемены.';
    }
}

async function getTarotPrediction() {
    showScreen('tarotResult');
    const resCards = document.getElementById('result-cards');
    resCards.innerHTML = window.selectedCards.map(c => c.emoji).join(' ');
    const textEl = document.getElementById('prediction-text');
    textEl.textContent = '🔮 Маг Эзотериум вглядывается в карты...';
    const cardsNames = window.selectedCards.map(c => c.name).join(', ');
    const system = 'Ты — Маг Эзотериум, великий таролог. Начинай ответ с фразы "Маг Эзотериум видит..."';
    const answer = await callDeepSeek(system, `Вопрос: "${window.tarotQuestion}". Выпали карты: ${cardsNames}. Дай предсказание.`);
    textEl.textContent = answer;
    deck.style.pointerEvents = 'auto';
}

// Натальная карта
document.getElementById('get-natal').onclick = async () => {
    const date = document.getElementById('natal-date').value;
    if (!date) return alert('Введите дату');
    showScreen('natalResult');
    document.getElementById('natal-text').textContent = 'Рассчитываем...';
    const system = 'Ты — Маг Эзотериум, астролог. Начинай со слов "Звёзды поведали..."';
    const answer = await callDeepSeek(system, `Натальная карта для рождения ${date} ${document.getElementById('natal-time').value}.`);
    document.getElementById('natal-text').textContent = answer;
};

// Совместимость
document.getElementById('get-compat').onclick = async () => {
    const n1 = document.getElementById('person1-name').value || 'А';
    const d1 = document.getElementById('person1-date').value;
    const n2 = document.getElementById('person2-name').value || 'Б';
    const d2 = document.getElementById('person2-date').value;
    if (!d1 || !d2) return alert('Введите даты');
    showScreen('compatResult');
    document.getElementById('compat-text').textContent = 'Анализируем...';
    const system = 'Ты — Маг Эзотериум, эксперт по отношениям. Начинай с "Маг Эзотериум раскрывает..."';
    const answer = await callDeepSeek(system, `Совместимость ${n1} (${d1}) и ${n2} (${d2}).`);
    document.getElementById('compat-text').textContent = answer;
};

// Старт
showScreen('welcome');
