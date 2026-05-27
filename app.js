const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); }

// Ключ OpenRouter (жестко вшит)
const API_KEY = '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';
// Прокси для обхода CORS
const API_URL = 'https://corsproxy.io/?' + encodeURIComponent('https://openrouter.ai/api/v1/chat/completions');
const MODEL = 'deepseek/deepseek-v4-flash:free';

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
    if (screens[s]) screens[s].classList.add('active');
}

// --- АНИМАЦИЯ БУКВ В ЗАГОЛОВКЕ (без изменений) ---
function animateTitle() {
    const titleEl = document.getElementById('title-animated');
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
            @keyframes flyIn {
                from { transform: translateY(-40px) rotateY(90deg); opacity: 0; }
                to { transform: translateY(0) rotateY(0); opacity: 1; }
            }
            @keyframes glowLetter {
                from { text-shadow: 0 0 10px var(--gold); }
                to { text-shadow: 0 0 25px var(--gold), 0 0 40px var(--glow); }
            }
        `;
        document.head.appendChild(styleSheet);
    }
}
animateTitle();

// Приветствие -> меню
document.getElementById('continue-btn').addEventListener('click', () => {
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

// ===== ТАРО =====
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
    document.getElementById('cards-left').textContent = 'Осталось открыть: 3';
    showScreen('tarotCards');
    document.getElementById('deck').style.pointerEvents = 'auto';
}

// Холст для искр
const canvas = document.getElementById('spark-canvas');
const ctx = canvas.getContext('2d');
let sparks = [];
function resizeCanvas() {
    const container = document.getElementById('deck-container');
    canvas.width = container.offsetWidth;
    canvas.height = container.offsetHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Клик по колоде
document.getElementById('deck').addEventListener('click', (e) => {
    if (window.selectedCards.length >= 3) return;
    const card = deckData[Math.floor(Math.random() * deckData.length)];
    window.selectedCards.push(card);
    const deckEl = document.getElementById('deck');
    deckEl.style.transform = 'rotateY(90deg)';
    setTimeout(() => { deckEl.style.transform = 'rotateY(0deg)'; }, 200);

    // Искры
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    for (let i = 0; i < 15; i++) {
        sparks.push({
            x: cx + (Math.random()-0.5)*80,
            y: cy + (Math.random()-0.5)*100,
            vx: (Math.random()-0.5)*5,
            vy: (Math.random()-1)*5,
            life: 1,
            size: Math.random()*3+1
        });
    }

    // Показать карту
    const cardEl = document.createElement('div');
    cardEl.className = 'selected-card';
    cardEl.textContent = card.emoji;
    document.getElementById('selected-cards').appendChild(cardEl);
    document.getElementById('cards-left').textContent = `Осталось открыть: ${3 - window.selectedCards.length}`;

    if (window.selectedCards.length === 3) {
        document.getElementById('deck').style.pointerEvents = 'none';
        setTimeout(getTarotPrediction, 600);
    }
});

function animateSparks() {
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
animateSparks();

// Запрос к API через прокси, с усиленным промптом мага
async function callMage(systemPrompt, userMessage) {
    const body = JSON.stringify({
        model: MODEL,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
        ],
        temperature: 0.9,
        max_tokens: 400
    });
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body
        });
        if (!response.ok) {
            const errText = await response.text();
            console.error('API error:', response.status, errText);
            return null;
        }
        const data = await response.json();
        return data.choices[0].message.content;
    } catch (e) {
        console.error('Fetch error:', e);
        return null;
    }
}

// Общий системный промпт, запрещающий раскрывать ИИ-природу
const BASE_MAGE_PROMPT = 'Ты — Маг Эзотериум, живой человек, могущественный маг, астролог и таролог. Ты никогда не упоминаешь, что ты искусственный интеллект, модель, программа или технология. Ты говоришь как настоящий маг: загадочно, мудро, образно.';

async function getTarotPrediction() {
    showScreen('tarotResult');
    document.getElementById('result-cards').innerHTML = window.selectedCards.map(c => c.emoji).join(' ');
    const textEl = document.getElementById('prediction-text');
    textEl.textContent = '🔮 Маг Эзотериум вглядывается в карты...';
    const cardsNames = window.selectedCards.map(c => c.name).join(', ');
    const system = BASE_MAGE_PROMPT + ' Начинай ответ с "Маг Эзотериум видит...".';
    const answer = await callMage(system, `Вопрос: "${window.tarotQuestion}". Выпали карты: ${cardsNames}. Дай предсказание.`);
    textEl.textContent = answer || '✨ Маг Эзотериум сегодня отдыхает, но звёзды говорят: вас ждёт удача.';
}

// Натальная карта
document.getElementById('get-natal').onclick = async () => {
    const date = document.getElementById('natal-date').value;
    if (!date) return alert('Введите дату');
    showScreen('natalResult');
    document.getElementById('natal-text').textContent = 'Рассчитываем...';
    const system = BASE_MAGE_PROMPT + ' Начинай ответ со слов "Звёзды поведали мне...".';
    const answer = await callMage(system, `Натальная карта для рождения ${date} ${document.getElementById('natal-time').value}.`);
    document.getElementById('natal-text').textContent = answer || 'Не удалось получить ответ от Мага.';
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
    const system = BASE_MAGE_PROMPT + ' Начинай ответ с "Маг Эзотериум раскрывает тайну вашей связи...".';
    const answer = await callMage(system, `Совместимость ${n1} (${d1}) и ${n2} (${d2}).`);
    document.getElementById('compat-text').textContent = answer || 'Маг не смог заглянуть в вашу связь.';
};

showScreen('welcome');
