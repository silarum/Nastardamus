// Telegram WebApp
const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); }

const DEEPSEEK_API_KEY = 'sk-c1ef1e8bb11a4563aae3cb3d6101976c';
let freeQuestionUsed = false, paidQuestions = 0, selectedCardIndex = null, isLoading = false;

const cardsContainer = document.getElementById('cards-container');
const drawButton = document.getElementById('draw-button');
const questionsCount = document.getElementById('questions-count');
const buyButton = document.getElementById('buy-button');
const resultScreen = document.getElementById('result-screen');
const cardsScreen = document.getElementById('cards-screen');
const predictionText = document.getElementById('prediction-text');
const cardEmoji = document.getElementById('card-emoji');
const backButton = document.getElementById('back-button');
const btnText = drawButton.querySelector('.btn-text');

const tarotDeck = [
    { name: 'Шут', emoji: '🃏' }, { name: 'Маг', emoji: '🎩' }, { name: 'Верховная Жрица', emoji: '🔮' },
    { name: 'Императрица', emoji: '👑' }, { name: 'Император', emoji: '🏰' }, { name: 'Иерофант', emoji: '📜' },
    { name: 'Влюблённые', emoji: '❤️' }, { name: 'Колесница', emoji: '🚗' }, { name: 'Сила', emoji: '🦁' },
    { name: 'Отшельник', emoji: '🏮' }, { name: 'Колесо Фортуны', emoji: '🎡' }, { name: 'Справедливость', emoji: '⚖️' },
    { name: 'Повешенный', emoji: '🪢' }, { name: 'Смерть', emoji: '💀' }, { name: 'Умеренность', emoji: '🌊' },
    { name: 'Дьявол', emoji: '👹' }, { name: 'Башня', emoji: '🗼' }, { name: 'Звезда', emoji: '⭐' },
    { name: 'Луна', emoji: '🌙' }, { name: 'Солнце', emoji: '☀️' }, { name: 'Суд', emoji: '📯' }, { name: 'Мир', emoji: '🌍' }
];

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
    if (isLoading) return;
    document.querySelectorAll('.card').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
    selectedCardIndex = index;
    drawButton.disabled = false;
    updateButtonText();
}
function updateButtonText() {
    btnText.textContent = freeQuestionUsed ? '🔮 Получить предсказание (платное)' : '✨ Получить бесплатное предсказание';
}
function updateUI() {
    questionsCount.textContent = paidQuestions;
    questionsCount.style.transform = 'scale(1.3)';
    setTimeout(() => questionsCount.style.transform = 'scale(1)', 200);
    buyButton.style.display = freeQuestionUsed ? 'block' : 'none';
    updateButtonText();
}
drawButton.addEventListener('click', async () => {
    if (isLoading || selectedCardIndex === null) return;
    if (!freeQuestionUsed) { freeQuestionUsed = true; updateUI(); await getPrediction(); }
    else if (paidQuestions > 0) { paidQuestions--; updateUI(); await getPrediction(); }
    else { alert('Нет оплаченных вопросов. Купите вопрос за 1 SILARUM.'); }
});
buyButton.addEventListener('click', () => {
    if (confirm('Добавить 1 оплаченный вопрос (тест)?')) {
        paidQuestions++; updateUI();
    }
});
async function getPrediction() {
    isLoading = true; drawButton.disabled = true; btnText.textContent = '⏳ Загрузка...';
    const card = tarotDeck[selectedCardIndex];
    try {
        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_API_KEY}` },
            body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: `Ты таролог. Истолкуй карту "${card.name}" ${card.emoji}. Дай предсказание на русском, 100 слов.` }], temperature: 1.0, max_tokens: 200 })
        });
        const data = await response.json();
        const prediction = data.choices?.[0]?.message?.content || 'Предсказание не получено.';
        showResult(card, prediction);
    } catch (e) {
        showResult(card, 'Ошибка связи с нейросетью. Попробуйте позже.');
    } finally {
        isLoading = false; drawButton.disabled = false; updateButtonText();
    }
}
function showResult(card, text) {
    cardsScreen.classList.remove('active');
    resultScreen.classList.add('active');
    cardEmoji.textContent = card.emoji;
    predictionText.textContent = text;
    document.querySelectorAll('.card').forEach(c => c.classList.remove('selected'));
    selectedCardIndex = null;
    drawButton.disabled = true;
}
backButton.addEventListener('click', () => {
    resultScreen.classList.remove('active');
    cardsScreen.classList.add('active');
    updateUI();
});
renderCards(); updateUI();
