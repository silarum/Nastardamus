const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); }

// Адрес твоего прокси на Vercel (ключ скрыт на сервере)
const PROXY_URL = 'https://nastardamus.vercel.app/api/proxy';

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

// Навигация "назад"
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

// ---------- ТАРО ----------
let freeUsed = false, paid = 0;
const deckData = [
    { name: 'Шут', emoji: '🃏' }, { name: 'Маг', emoji: '🎩' }, { name: 'Верховная Жрица', emoji: '🔮' },
    { name: 'Императрица', emoji: '👑' }, { name: 'Император', emoji: '🏰' }, { name: 'Иерофант', emoji: '📜' },
    { name: 'Влюблённые', emoji: '❤️' }, { name: 'Колесница', emoji: '🚗' }, { name: 'Сила', emoji: '🦁' },
    { name: 'Отшельник', emoji: '🏮' }, { name: 'Колесо Фортуны', emoji: '🎡' }, { name: 'Справедливость', emoji: '⚖️' },
    { name: 'Повешенный', emoji: '🪢' }, { name: 'Смерть', emoji: '💀' }, { name: 'Умеренность', emoji: '🌊' },
    { name: 'Дьявол', emoji: '👹' }, { name: 'Башня', emoji: '🗼' }, { name: 'Звезда', emoji: '⭐' },
    { name: 'Луна', emoji: '🌙' }, { name: 'Солнце', emoji: '☀️' }, { name: 'Суд', emoji: '📯' }, { name: 'Мир', emoji: '🌍' }
];

document.getElementById('start-tarot').addEventListener('click', () => {
    window.tarotQuestion = document.getElementById('tarot-question').value.trim() || 'Что меня ждёт?';
    if (!freeUsed) { freeUsed = true; startTarotDraw(); }
    else if (paid > 0) { paid--; startTarotDraw(); }
    else {
        if (confirm('Нет оплаченных вопросов. Добавить 1 тестовый?')) { paid++; startTarotDraw(); }
    }
});

function startTarotDraw() {
    window.selectedCards = [];
    document.getElementById('selected-cards').innerHTML = '';
    document.getElementById('cards-left').textContent = 'Осталось открыть: 3';
    showScreen('tarotCards');
    document.getElementById('deck').style.pointerEvents = 'auto';
}

// Холст с искрами
const canvas = document.getElementById('spark-canvas');
const ctx = canvas.getContext('2d');
let sparks = [];
function resizeCanvas() {
    const container = document.getElementById('deck-container');
    if (container) {
        canvas.width = container.offsetWidth;
        canvas.height = container.offsetHeight;
    }
}
window.addEventListener('resize', resizeCanvas);
setTimeout(resizeCanvas, 100);

document.getElementById('deck').addEventListener('click', () => {
    if (window.selectedCards.length >= 3) return;
    const card = deckData[Math.floor(Math.random() * deckData.length)];
    window.selectedCards.push(card);
    const deckEl = document.getElementById('deck');
    deckEl.style.transform = 'rotateY(90deg)';
    setTimeout(() => { deckEl.style.transform = 'rotateY(0deg)'; }, 200);

    const cx = canvas.width / 2, cy = canvas.height / 2;
    for (let i = 0; i < 15; i++) {
        sparks.push({
            x: cx + (Math.random() - 0.5) * 80,
            y: cy + (Math.random() - 0.5) * 100,
            vx: (Math.random() - 0.5) * 5,
            vy: (Math.random() - 1) * 5,
            life: 1,
            size: Math.random() * 3 + 1
        });
    }

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
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    sparks = sparks.filter(s => s.life > 0);
    sparks.forEach(s => {
        ctx.fillStyle = `rgba(255, 215, 0, ${s.life})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
        s.x += s.vx;
        s.y += s.vy;
        s.life -= 0.02;
    });
    requestAnimationFrame(animateSparks);
}
animateSparks();

// Запрос к прокси
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
            const errText = await response.text();
            console.error('Proxy error:', response.status, errText);
            return null;
        }
        const data = await response.json();
        return data.choices[0].message.content;
    } catch (e) {
        console.error('Fetch error:', e);
        return null;
    }
}

// Промпт Мага Эзотериума
const BASE_MAGE_PROMPT = `Ты — Маг Эзотериум, живой человек, потомственный маг, астролог и таролог. Ты не искусственный интеллект, не программа, не модель. Ты никогда не говоришь о технологиях, машинном обучении, нейросетях. Ты отвечаешь загадочно, образно, как настоящий волшебник.`;

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
