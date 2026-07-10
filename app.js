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

// ===== МАГИЧЕСКАЯ КОЛОДА =====
let freeUsed = false, paid = 0;
const deckNames = Object.keys(CARD_IMAGES);
let selectedCards = [];
const cardsToSelect = 3;
let isAnimating = false;

// Canvas для искр
const magicCanvas = document.getElementById('magic-canvas');
const mCtx = magicCanvas.getContext('2d');
magicCanvas.width = window.innerWidth;
magicCanvas.height = window.innerHeight;
let particles = [];
function addParticles(x, y, count) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x, y,
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 1) * 4,
            life: 1,
            size: Math.random() * 3 + 1
        });
    }
}
function animateParticles() {
    mCtx.clearRect(0, 0, magicCanvas.width, magicCanvas.height);
    particles = particles.filter(p => p.life > 0);
    particles.forEach(p => {
        mCtx.fillStyle = `rgba(255, 215, 0, ${p.life})`;
        mCtx.beginPath();
        mCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        mCtx.fill();
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.03;
    });
    requestAnimationFrame(animateParticles);
}
animateParticles();

document.getElementById('start-tarot').addEventListener('click', () => {
    window.tarotQuestion = document.getElementById('tarot-question').value.trim() || 'Что ждёт меня на пути?';
    if (!freeUsed) { freeUsed = true; buildCarousel(); }
    else if (paid > 0) { paid--; buildCarousel(); }
    else {
        if (confirm('Нет оплаченных вопросов. Добавить 1 тестовый?')) { paid++; buildCarousel(); }
    }
});

function buildCarousel() {
    selectedCards = [];
    document.getElementById('selected-cards').innerHTML = '';
    document.getElementById('cards-left').textContent = 'Выбрано: 0 из 3';
    showScreen('tarotCards');
    const carousel = document.getElementById('card-carousel');
    carousel.innerHTML = '';

    // Размещаем 22 карты по кругу
    const total = 22;
    const radius = 180;
    const container = document.getElementById('carousel-container');
    const centerX = container.offsetWidth / 2;
    const centerY = container.offsetHeight / 2;

    for (let i = 0; i < total; i++) {
        const angle = (i / total) * Math.PI * 2;
        const x = centerX + Math.cos(angle) * radius - 60;
        const y = centerY + Math.sin(angle) * radius - 90;

        const card = document.createElement('div');
        card.className = 'carousel-card';
        card.style.left = x + 'px';
        card.style.top = y + 'px';
        card.style.transform = `rotate(${angle * 180 / Math.PI - 90}deg)`;
        card.style.zIndex = Math.floor(Math.sin(angle) * 10) + 10;
        card.style.opacity = '0.9';
        card.dataset.name = deckNames[i];
        card.dataset.angle = angle;
        card.dataset.origX = x;
        card.dataset.origY = y;

        // Двойное касание
        let tapTimer = null;
        card.addEventListener('click', (e) => {
            e.stopPropagation();
            if (isAnimating) return;
            if (tapTimer) {
                clearTimeout(tapTimer);
                tapTimer = null;
                selectCard(card, e);
            } else {
                tapTimer = setTimeout(() => { tapTimer = null; }, 300);
            }
        });
        carousel.appendChild(card);
    }

    // Жест прокрутки колоды
    let isDragging = false;
    let startX = 0;
    let currentRotation = 0;
    carousel.addEventListener('touchstart', (e) => {
        if (isAnimating) return;
        isDragging = true;
        startX = e.touches[0].clientX;
    });
    carousel.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        const dx = e.touches[0].clientX - startX;
        currentRotation += dx * 0.005;
        rotateCarousel(currentRotation);
        startX = e.touches[0].clientX;
    });
    carousel.addEventListener('touchend', () => {
        isDragging = false;
    });
}

function rotateCarousel(rotation) {
    const cards = document.querySelectorAll('.carousel-card');
    const total = cards.length;
    const radius = 180;
    const container = document.getElementById('carousel-container');
    const centerX = container.offsetWidth / 2;
    const centerY = container.offsetHeight / 2;

    cards.forEach((card, i) => {
        const originalAngle = parseFloat(card.dataset.angle);
        const newAngle = originalAngle + rotation;
        const x = centerX + Math.cos(newAngle) * radius - 60;
        const y = centerY + Math.sin(newAngle) * radius - 90;
        card.style.left = x + 'px';
        card.style.top = y + 'px';
        card.style.transform = `rotate(${newAngle * 180 / Math.PI - 90}deg)`;
        card.style.zIndex = Math.floor(Math.sin(newAngle) * 10) + 10;
        card.style.opacity = 0.6 + Math.abs(Math.sin(newAngle)) * 0.4;
    });
}

function selectCard(cardEl, event) {
    if (selectedCards.length >= cardsToSelect) return;
    isAnimating = true;

    const cardName = cardEl.dataset.name;
    selectedCards.push({ name: cardName });

    // Искры
    addParticles(event.clientX, event.clientY, 20);

    // Анимация вылета
    cardEl.classList.add('selected');
    setTimeout(() => {
        cardEl.style.display = 'none';
        isAnimating = false;
    }, 600);

    // Показать выбранную карту
    const img = document.createElement('div');
    img.className = 'selected-card';
    img.style.backgroundImage = `url('images/cards/${CARD_IMAGES[cardName]}')`;
    document.getElementById('selected-cards').appendChild(img);
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

// Натальная карта и Совместимость (без изменений)
document.getElementById('get-natal').addEventListener('click', async () => {
    const date = document.getElementById('natal-date').value;
    if (!date) return alert('Введите дату');
    showScreen('natalResult');
    document.getElementById('natal-text').textContent = 'Рассчитываем...';
    const system = BASE_MAGE_PROMPT + ' Начинай ответ со слов "Звёзды поведали мне...".';
    const answer = await callMage(system, `Натальная карта для рождения ${date} ${document.getElementById('natal-time').value}.`);
    document.getElementById('natal-text').textContent = answer || 'Не удалось получить ответ от Мага.';
});

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
