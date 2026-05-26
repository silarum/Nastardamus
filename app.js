
// Telegram WebApp
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// Твой ключ DeepSeek
const DEEPSEEK_API_KEY = 'sk-c1ef1e8bb11a4563aae3cb3d6101976c';

// Состояние
let freeQuestionUsed = false;
let paidQuestions = 0;
let selectedCardIndex = null;

// Элементы
const cardsContainer = document.getElementById('cards-container');
const drawButton = document.getElementById('draw-button');
const questionsLeftSpan = document.getElementById('questions-left');
const buyButton = document.getElementById('buy-button');
const resultScreen = document.getElementById('result-screen');
const cardsScreen = document.getElementById('cards-screen');
const predictionText = document.getElementById('prediction-text');
const cardEmoji = document.getElementById('card-emoji');
const backButton = document.getElementById('back-button');

// Колода Таро
const tarotDeck = [
    { name: 'Шут', emoji: '🃏' },
    { name: 'Маг', emoji: '🎩' },
    { name: 'Верховная Жрица', emoji: '🔮' },
    { name: 'Императрица', emoji: '👑' },
    { name: 'Император', emoji: '🏰' },
    { name: 'Иерофант', emoji: '📜' },
    { name: 'Влюблённые', emoji: '❤️' },
    { name: 'Колесница', emoji: '🚗' },
    { name: 'Сила', emoji: '🦁' },
    { name: 'Отшельник', emoji: '🏮' },
    { name: 'Колесо Фортуны', emoji: '🎡' },
    { name: 'Справедливость', emoji: '⚖️' },
    { name: 'Повешенный', emoji: '🪢' },
    { name: 'Смерть', emoji: '💀' },
    { name: 'Умеренность', emoji: '🌊' },
    { name: 'Дьявол', emoji: '👹' },
    { name: 'Башня', emoji: '🗼' },
    { name: 'Звезда', emoji: '⭐' },
    { name: 'Луна', emoji: '🌙' },
    { name: 'Солнце', emoji: '☀️' },
    { name: 'Суд', emoji: '📯' },
    { name: 'Мир', emoji: '🌍' }
];

// Отрисовка карт
function renderCards() {
    cardsContainer.innerHTML = '';
    tarotDeck.forEach((card, index) => {
        const div = document.createElement('div');
        div.className = 'card';
        div.textContent = card.emoji;
        div.addEventListener('click', () => selectCard(index, div));
        cardsContainer.appendChild(div);
    });
}

function selectCard(index, el) {
    document.querySelectorAll('.card').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
    selectedCardIndex = index;
    drawButton.disabled = false;
    drawButton.textContent = 'Получить предсказание';
}

function updateUI() {
    questionsLeftSpan.textContent = `Оплачено вопросов: ${paidQuestions}`;
    buyButton.style.display = freeQuestionUsed ? 'block' : 'none';
    if (!freeQuestionUsed) {
        drawButton.textContent = 'Выбрать карту (бесплатный вопрос)';
    } else {
        drawButton.textContent = selectedCardIndex !== null ? 'Получить предсказание (платный)' : 'Выберите карту';
    }
}

drawButton.addEventListener('click', async () => {
    if (selectedCardIndex === null) return;
    if (!freeQuestionUsed) {
        freeQuestionUsed = true;
        updateUI();
        await getPrediction();
    } else {
        if (paidQuestions > 0) {
            paidQuestions--;
            updateUI();
            await getPrediction();
        } else {
            tg.showAlert('У вас нет оплаченных вопросов. Нажмите «Купить вопрос».');
        }
    }
});

buyButton.addEventListener('click', () => {
    tg.showPopup({
        title: 'Покупка вопроса (тест)',
        message: 'Пока просто добавим 1 оплаченный вопрос для проверки.',
        buttons: [
            { id: 'fake_buy', type: 'default', text: 'Добавить 1 вопрос (тест)' },
            { type: 'cancel' }
        ]
    }, (btnId) => {
        if (btnId === 'fake_buy') {
            paidQuestions++;
            updateUI();
            tg.showAlert('Оплаченный вопрос добавлен!');
        }
    });
});

async function getPrediction() {
    const card = tarotDeck[selectedCardIndex];
    drawButton.disabled = true;
    drawButton.textContent = 'Загрузка...';
    try {
        const prompt = `Ты — опытный таролог. Истолкуй карту Таро "${card.name}" (${card.emoji}) в ответ на вопрос "Что меня ждёт?". Дай развёрнутое, мистическое предсказание на русском языке, примерно 100 слов.`;
        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [{ role: 'user', content: prompt }],
                temperature: 1.0,
                max_tokens: 200
            })
        });
        const data = await response.json();
        const prediction = data.choices?.[0]?.message?.content || 'Предсказание не получено.';
        showResult(card, prediction);
    } catch (e) {
        console.error(e);
        tg.showAlert('Ошибка при запросе к DeepSeek. Проверь интернет или ключ.');
        drawButton.disabled = false;
        updateUI();
    }
}

function showResult(card, text) {
    cardsScreen.classList.remove('active');
    resultScreen.classList.add('active');
    cardEmoji.textContent = card.emoji;
    predictionText.textContent = text;
}

backButton.addEventListener('click', () => {
    resultScreen.classList.remove('active');
    cardsScreen.classList.add('active');
    drawButton.disabled = true;
    selectedCardIndex = null;
    document.querySelectorAll('.card').forEach(c => c.classList.remove('selected'));
    updateUI();
});

// Старт
renderCards();
updateUI();
