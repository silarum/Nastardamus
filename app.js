// Telegram WebApp
const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); }

const DEEPSEEK_API_KEY = 'sk-c1ef1e8bb11a4563aae3cb3d6101976c';

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

function showScreen(screen) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screen.classList.add('active');
}

// ПРИВЕТСТВИЕ
document.getElementById('continue-btn').addEventListener('click', () => {
    showScreen(screens.menu);
});

// Кнопки "Назад" (универсальные)
document.querySelectorAll('.back-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const target = btn.dataset.target;
        if (screens[target]) showScreen(screens[target]);
    });
});

// МЕНЮ
document.getElementById('tarot-btn').addEventListener('click', () => showScreen(screens.tarotInput));
document.getElementById('natal-btn').addEventListener('click', () => showScreen(screens.natalInput));
document.getElementById('compat-btn').addEventListener('click', () => showScreen(screens.compatInput));

// === РАСКЛАД ТАРО ===
let freeQuestionUsed = false, paidQuestions = 0;
let tarotQuestion = '';
const tarotDeck = [
    { name: 'Шут', emoji: '🃏' }, { name: 'Маг', emoji: '🎩' }, { name: 'Верховная Жрица', emoji: '🔮' },
    { name: 'Императрица', emoji: '👑' }, { name: 'Император', emoji: '🏰' }, { name: 'Иерофант', emoji: '📜' },
    { name: 'Влюблённые', emoji: '❤️' }, { name: 'Колесница', emoji: '🚗' }, { name: 'Сила', emoji: '🦁' },
    { name: 'Отшельник', emoji: '🏮' }, { name: 'Колесо Фортуны', emoji: '🎡' }, { name: 'Справедливость', emoji: '⚖️' },
    { name: 'Повешенный', emoji: '🪢' }, { name: 'Смерть', emoji: '💀' }, { name: 'Умеренность', emoji: '🌊' },
    { name: 'Дьявол', emoji: '👹' }, { name: 'Башня', emoji: '🗼' }, { name: 'Звезда', emoji: '⭐' },
    { name: 'Луна', emoji: '🌙' }, { name: 'Солнце', emoji: '☀️' }, { name: 'Суд', emoji: '📯' }, { name: 'Мир', emoji: '🌍' }
];

document.getElementById('start-tarot').addEventListener('click', () => {
    tarotQuestion = document.getElementById('tarot-question').value.trim() || 'Что меня ждёт?';
    if (!freeQuestionUsed) {
        freeQuestionUsed = true;
        startCardSelection();
    } else if (paidQuestions > 0) {
        paidQuestions--;
        startCardSelection();
    } else {
        if (confirm('Нет оплаченных вопросов. Добавить 1 вопрос (тест)?')) {
            paidQuestions++;
            startCardSelection();
        }
    }
});

function startCardSelection() {
    selectedCards = [];
    updateCardsOpened();
    showScreen(screens.tarotCards);
    deckDiv.style.pointerEvents = 'auto';
}

let selectedCards = [];
const cardsToSelect = 3;
const selectedCardsDiv = document.getElementById('selected-cards');
const cardsOpenedSpan = document.getElementById('cards-opened');
const deckDiv = document.getElementById('deck');

function updateCardsOpened() {
    cardsOpenedSpan.textContent = `Осталось открыть: ${cardsToSelect - selectedCards.length}`;
    selectedCardsDiv.innerHTML = selectedCards.map(card => 
        `<div class="selected-card">${card.emoji}</div>`
    ).join('');
}

deckDiv.addEventListener('click', () => {
    if (selectedCards.length >= cardsToSelect) return;
    const randomCard = tarotDeck[Math.floor(Math.random() * tarotDeck.length)];
    selectedCards.push(randomCard);
    updateCardsOpened();
    deckDiv.style.transform = 'rotateY(90deg)';
    setTimeout(() => { deckDiv.style.transform = 'rotateY(0deg)'; }, 300);
    if (selectedCards.length === cardsToSelect) {
        deckDiv.style.pointerEvents = 'none';
        setTimeout(() => getTarotPrediction(), 500);
    }
});

async function getTarotPrediction() {
    showScreen(screens.tarotResult);
    const resultEmoji = document.getElementById('result-emoji');
    const predictionText = document.getElementById('prediction-text');
    resultEmoji.innerHTML = selectedCards.map(c => c.emoji).join(' ');
    predictionText.textContent = 'Анализируем...';
    const cardsNames = selectedCards.map(c => c.name).join(', ');
    const prompt = `Ты таролог. Пользователь спросил: "${tarotQuestion}". Выпали карты: ${cardsNames}. Дай развёрнутое предсказание на русском языке, примерно 150 слов.`;
    try {
        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_API_KEY}` },
            body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: prompt }], temperature: 1.0, max_tokens: 300 })
        });
        const data = await response.json();
        predictionText.textContent = data.choices?.[0]?.message?.content || 'Предсказание не получено.';
    } catch (e) {
        predictionText.textContent = 'Ошибка связи с нейросетью.';
    }
}

// === НАТАЛЬНАЯ КАРТА ===
document.getElementById('get-natal').addEventListener('click', async () => {
    const date = document.getElementById('natal-date').value;
    const time = document.getElementById('natal-time').value || '00:00';
    if (!date) return alert('Введите дату рождения');
    showScreen(screens.natalResult);
    document.getElementById('natal-text').textContent = 'Рассчитываем натальную карту...';
    const prompt = `Ты астролог. Составь натальную карту для человека, рождённого ${date} в ${time}. Опиши положение планет в знаках, асцендент, основные аспекты и их значение. Дай развёрнутый ответ на русском языке.`;
    try {
        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_API_KEY}` },
            body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: prompt }], temperature: 0.7, max_tokens: 500 })
        });
        const data = await response.json();
        document.getElementById('natal-text').textContent = data.choices?.[0]?.message?.content || 'Ошибка расчёта.';
    } catch (e) {
        document.getElementById('natal-text').textContent = 'Ошибка связи.';
    }
});

// === СОВМЕСТИМОСТЬ ===
document.getElementById('get-compat').addEventListener('click', async () => {
    const name1 = document.getElementById('person1-name').value.trim() || 'Партнёр 1';
    const date1 = document.getElementById('person1-date').value;
    const name2 = document.getElementById('person2-name').value.trim() || 'Партнёр 2';
    const date2 = document.getElementById('person2-date').value;
    if (!date1 || !date2) return alert('Введите даты рождения обоих людей');
    showScreen(screens.compatResult);
    document.getElementById('compat-text').textContent = 'Анализируем совместимость...';
    const prompt = `Ты астролог. Проанализируй совместимость двух людей: ${name1} (рождён ${date1}) и ${name2} (рождён ${date2}). Опиши сильные и слабые стороны, эмоциональную, интеллектуальную и физическую совместимость. Дай развёрнутый ответ на русском языке.`;
    try {
        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_API_KEY}` },
            body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: prompt }], temperature: 0.7, max_tokens: 500 })
        });
        const data = await response.json();
        document.getElementById('compat-text').textContent = data.choices?.[0]?.message?.content || 'Ошибка анализа.';
    } catch (e) {
        document.getElementById('compat-text').textContent = 'Ошибка связи.';
    }
});

// Инициализация: показываем приветствие
showScreen(screens.welcome);
