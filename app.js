// ===== НОВЫЕ ФУНКЦИИ =====

// Выбор количества карт
let cardsToSelect = 3;
document.querySelectorAll('.spread-option').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.spread-option').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        cardsToSelect = parseInt(btn.dataset.cards);
    });
});

// Карта дня (с кэшем на 24 часа)
document.getElementById('go-card-day').addEventListener('click', () => {
    const cached = localStorage.getItem('card-day');
    const cacheTime = localStorage.getItem('card-day-time');
    if (cached && cacheTime && Date.now() - parseInt(cacheTime) < 86400000) {
        showCardDay(JSON.parse(cached));
    } else {
        generateCardDay();
    }
});

async function generateCardDay() {
    showScreen('cardDay');
    document.getElementById('card-day-text').innerHTML = '<span class="loading-dots">Маг выбирает карту</span><span class="dots-anim">...</span>';
    const card = deckNames[Math.floor(Math.random() * deckNames.length)];
    const system = BASE_MAGE_PROMPT + ' Дай толкование карты дня.';
    const answer = await callMage(system, `Сегодня выпала карта "${card}". Дай толкование на день.`);
    const result = { card, text: answer || 'Сегодня день размышлений.' };
    localStorage.setItem('card-day', JSON.stringify(result));
    localStorage.setItem('card-day-time', Date.now().toString());
    showCardDay(result);
}

function showCardDay(result) {
    showScreen('cardDay');
    document.getElementById('card-day-image').innerHTML = `<img src="images/cards/${CARD_IMAGES[result.card]}" style="width:100px;border-radius:10px;border:2px solid var(--gold);box-shadow:0 0 20px var(--gold);">`;
    document.getElementById('card-day-text').textContent = result.text;
}

// Быстрый ответ
document.getElementById('get-quick-answer').addEventListener('click', async () => {
    const q = document.getElementById('quick-question').value.trim();
    if (!q) return alert('Задайте вопрос');
    document.getElementById('quick-answer-text').style.display = 'block';
    document.getElementById('quick-answer-text').innerHTML = '<span class="loading-dots">Маг думает</span><span class="dots-anim">...</span>';
    const answer = await callMage(BASE_MAGE_PROMPT + ' Дай краткий мудрый ответ на вопрос.', q);
    document.getElementById('quick-answer-text').textContent = answer || 'Ответ скрыт за завесой.';
});

// Гороскоп
document.getElementById('zodiac-select').addEventListener('change', async function() {
    const sign = this.value;
    if (!sign) return;
    document.getElementById('horoscope-text').style.display = 'block';
    document.getElementById('horoscope-text').innerHTML = '<span class="loading-dots">Маг читает звёзды</span><span class="dots-anim">...</span>';
    const answer = await callMage(BASE_MAGE_PROMPT + ' Составь гороскоп на сегодня.', `Гороскоп для знака "${sign}" на сегодня.`);
    document.getElementById('horoscope-text').textContent = answer || 'Звёзды сегодня молчат.';
});

// Лунный календарь
document.getElementById('go-moon').addEventListener('click', async () => {
    showScreen('moon');
    const phases = ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'];
    document.getElementById('moon-phase').textContent = phases[Math.floor(Math.random() * phases.length)];
    const answer = await callMage(BASE_MAGE_PROMPT + ' Расскажи о сегодняшнем лунном дне.', 'Какой сегодня лунный день и что он несёт?');
    document.getElementById('moon-text').textContent = answer || 'Луна сегодня загадочна.';
});

// Значения карт
document.getElementById('go-tarot-meanings').addEventListener('click', () => {
    showScreen('tarotMeanings');
    const grid = document.getElementById('meanings-grid');
    grid.innerHTML = deckNames.map(name => `
        <div class="meaning-card" style="background-image:url('images/cards/${CARD_IMAGES[name]}')" onclick="alert('${name}: значение загружается...')">
            <div class="card-label">${name}</div>
        </div>
    `).join('');
});

// Профиль
document.getElementById('go-profile').addEventListener('click', () => {
    showScreen('profile');
    updateProfile();
});

function updateProfile() {
    const history = JSON.parse(localStorage.getItem('nastardamus-history') || '[]');
    document.getElementById('stat-readings').textContent = history.filter(h => h.type === 'tarot').length;
    document.getElementById('stat-natal').textContent = history.filter(h => h.type === 'natal').length;
    document.getElementById('stat-compat').textContent = history.filter(h => h.type === 'compat').length;
    
    // Достижения
    const achievements = [
        { id: 'first', name: 'Первый шаг', desc: 'Первый расклад', earned: history.length >= 1 },
        { id: 'tarot5', name: 'Таролог', desc: '5 раскладов', earned: history.filter(h => h.type === 'tarot').length >= 5 },
        { id: 'natal3', name: 'Астролог', desc: '3 гороскопа', earned: history.filter(h => h.type === 'natal').length >= 3 },
        { id: 'compat3', name: 'Сваха', desc: '3 совместимости', earned: history.filter(h => h.type === 'compat').length >= 3 },
        { id: 'all', name: 'Магистр', desc: 'Все достижения', earned: false }
    ];
    
    const list = document.getElementById('achievements-list');
    list.innerHTML = achievements.map(a => `
        <div class="achievement ${a.earned ? 'earned' : ''}">${a.earned ? '✅' : '🔒'} ${a.name}<br><small>${a.desc}</small></div>
    `).join('');
    
    // История
    const histList = document.getElementById('history-list');
    histList.innerHTML = history.slice(-10).reverse().map(h => `
        <div class="history-item">${h.date} — ${h.preview}</div>
    `).join('') || '<p>Пока пусто</p>';
}

function saveToHistory(type, preview) {
    const history = JSON.parse(localStorage.getItem('nastardamus-history') || '[]');
    history.push({ type, preview: preview.substring(0, 50), date: new Date().toLocaleDateString() });
    localStorage.setItem('nastardamus-history', JSON.stringify(history));
}

// Сохранение результата
document.getElementById('save-result').addEventListener('click', () => {
    const text = document.getElementById('prediction-text').textContent;
    saveToHistory('tarot', text);
    alert('Предсказание сохранено в историю!');
});

// Очистка истории
document.getElementById('clear-history').addEventListener('click', () => {
    if (confirm('Очистить всю историю?')) {
        localStorage.removeItem('nastardamus-history');
        updateProfile();
    }
});

// Переключение темы
document.getElementById('toggle-theme').addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
    localStorage.setItem('theme', document.body.classList.contains('light-theme') ? 'light' : 'dark');
});

// Переключение звука
let soundEnabled = true;
document.getElementById('toggle-sound').addEventListener('click', function() {
    soundEnabled = !soundEnabled;
    this.textContent = soundEnabled ? '🔊' : '🔇';
    localStorage.setItem('sound', soundEnabled ? 'on' : 'off');
});

// Восстановление настроек
(function restoreSettings() {
    if (localStorage.getItem('theme') === 'light') document.body.classList.add('light-theme');
    soundEnabled = localStorage.getItem('sound') !== 'off';
    document.getElementById('toggle-sound').textContent = soundEnabled ? '🔊' : '🔇';
})();
