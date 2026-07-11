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
    if (!document.getElementById('dynamic-keyframes')) {
        const s = document.createElement('style'); s.id = 'dynamic-keyframes';
        s.textContent = `@keyframes flyIn{from{transform:translateY(-40px) rotateY(90deg);opacity:0}to{transform:translateY(0) rotateY(0);opacity:1}}@keyframes glowLetter{from{text-shadow:0 0 10px var(--gold)}to{text-shadow:0 0 25px var(--gold),0 0 40px var(--glow)}}`;
        document.head.appendChild(s);
    }
}
animateTitle();

// Приветствие
document.getElementById('continue-btn').addEventListener('click', () => { updateCreditsBadge(); showScreen('menu'); });

// === ЕДИНЫЙ ОБРАБОТЧИК КНОПОК НАЗАД ===
document.querySelectorAll('.back-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        const target = btn.dataset.target;
        if (!target) return;

        // Если уходим с экрана выбора карт и карты уже выбраны — подтверждение
        if (target === 'menu-screen' && screens.tarotCards.classList.contains('active') && window._selectedCards?.length > 0) {
            if (!confirm('Вы уверены? Текущий выбор карт будет сброшен.')) return;
        }

        // Сброс состояния колоды при уходе
        if (screens.tarotCards.classList.contains('active')) {
            resetDeckState();
        }

        if (screens[target]) showScreen(target);
    });
});

// Меню
document.getElementById('go-tarot').addEventListener('click', () => playMageVideo());
document.getElementById('go-natal').addEventListener('click', () => showScreen('natalInput'));
document.getElementById('go-compat').addEventListener('click', () => showScreen('compatInput'));

// ===== ВИДЕО МАГА (с обработкой ошибок) =====
let videoPlayed = false;
function playMageVideo() {
    showScreen('video');
    const video = document.getElementById('mage-video');
    const loader = document.getElementById('video-loader');
    const skipBtn = document.getElementById('skip-video-btn');

    // Сброс
    video.classList.remove('ready');
    loader.classList.remove('hidden');
    skipBtn.classList.remove('visible');
    video.currentTime = 0;
    videoPlayed = false;

    // Показываем кнопку пропуска через 2 секунды
    setTimeout(() => { skipBtn.classList.add('visible'); }, 2000);

    // Если видео не загрузилось за 5 секунд — переход
    const timeout = setTimeout(() => {
        if (!videoPlayed) {
            videoPlayed = true;
            showScreen('tarotInput');
        }
    }, 5000);

    video.onloadeddata = () => {
        loader.classList.add('hidden');
        video.classList.add('ready');
        video.play().catch(() => {
            // Автовоспроизведение заблокировано — показываем кнопку сразу
            skipBtn.classList.add('visible');
        });
    };

    video.onended = () => {
        if (!videoPlayed) {
            videoPlayed = true;
            clearTimeout(timeout);
            showScreen('tarotInput');
        }
    };

    video.onerror = () => {
        if (!videoPlayed) {
            videoPlayed = true;
            clearTimeout(timeout);
            showScreen('tarotInput');
        }
    };

    // Кнопка пропуска
    skipBtn.onclick = () => {
        if (!videoPlayed) {
            videoPlayed = true;
            clearTimeout(timeout);
            video.pause();
            showScreen('tarotInput');
        }
    };

    // Касание видео тоже пропускает
    video.onclick = () => {
        if (!videoPlayed) {
            videoPlayed = true;
            clearTimeout(timeout);
            video.pause();
            showScreen('tarotInput');
        }
    };
}

// ===== СИСТЕМА ПОМОЩИ =====
const helpTexts = {
    'tarot-question': 'Задайте волнующий вас вопрос — мысленно или письменно. Чем точнее вопрос, тем яснее будет ответ карт. Оставьте поле пустым для общего предсказания.',
    'tarot-shuffle': 'Сдвиньте верхнюю карту пальцем — колода разлетится веером. Перетаскивайте карты, перемешивая их. Дважды коснитесь карты, чтобы выбрать. Нужно выбрать 3 карты.',
    'natal': 'Введите точную дату рождения. Если знаете время — укажите его. Маг Эзотериум составит вашу натальную карту и расскажет о влиянии звёзд.',
    'compat': 'Введите имена и даты рождения двух людей. Маг проанализирует астрологическую совместимость и расскажет о сильных сторонах вашего союза.',
    'welcome': 'Nastardamus — ваш проводник в мир Таро и астрологии. Вы можете получить расклад Таро (первый бесплатно), натальную карту или проверить совместимость.'
};
function showHelp(key) {
    document.getElementById('help-title').textContent = 'Справка';
    document.getElementById('help-text').textContent = helpTexts[key] || 'Следуйте инструкциям на экране.';
    document.getElementById('help-modal').classList.add('active');
}
document.getElementById('help-btn-welcome').addEventListener('click', () => showHelp('welcome'));
document.getElementById('help-btn-menu').addEventListener('click', () => showHelp('welcome'));
document.querySelectorAll('.help-icon-small').forEach(btn => {
    btn.addEventListener('click', () => showHelp(btn.dataset.help));
});
document.getElementById('close-help').addEventListener('click', () => {
    document.getElementById('help-modal').classList.remove('active');
});

// ===== СЧЁТЧИК КРЕДИТОВ =====
let freeUsed = false, paid = 0;
function updateCreditsBadge() {
    const creditEl = document.getElementById('credit-count');
    const paidEl = document.getElementById('paid-count');
    if (creditEl) creditEl.textContent = freeUsed ? '0' : '1';
    if (paidEl) paidEl.textContent = paid;
}

// ===== ФОНОВЫЕ ЧАСТИЦЫ =====
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
window._selectedCards = selectedCards;

function resetDeckState() {
    selectedCards = []; currentRound = 0; availableCards = [...deckNames];
    window._selectedCards = selectedCards;
    document.getElementById('selected-cards-preview').innerHTML = '';
    document.getElementById('cards-left').textContent = 'Выбрано: 0 из 3';
    document.getElementById('progress-fill').style.width = '0%';
    document.getElementById('spread-area').innerHTML = '';
    const stack = document.getElementById('deck-stack');
    if (stack) stack.style.display = 'block';
}

document.getElementById('start-tarot').addEventListener('click', () => {
    window.tarotQuestion = document.getElementById('tarot-question').value.trim() || 'Что ждёт меня на пути?';
    if (!freeUsed) { freeUsed = true; updateCreditsBadge(); startShuffleRitual(); }
    else if (paid > 0) { paid--; updateCreditsBadge(); startShuffleRitual(); }
    else {
        if (confirm('У вас закончились вопросы. Добавить 1 тестовый вопрос?')) { paid++; updateCreditsBadge(); startShuffleRitual(); }
    }
});

function startShuffleRitual() {
    resetDeckState();
    showScreen('tarotCards');
    document.getElementById('shuffle-instruction').textContent = 'Сдвиньте верхнюю карту';
}

document.getElementById('deck-stack').addEventListener('click', () => {
    if (currentRound >= cardsToSelect) return;
    if (document.querySelectorAll('.spread-card').length > 0) return;
    spreadCards();
});

function spreadCards() {
    const area = document.getElementById('spread-area');
    area.innerHTML = '';
    const w = area.offsetWidth || 350, h = area.offsetHeight || 400;
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
    let dragCard = null, offX, offY, wasDragged = false;
    area.addEventListener('touchstart', (e) => {
        const card = e.target.closest('.spread-card');
        if (!card || card.classList.contains('fly-out') || card.classList.contains('collecting')) return;
        dragCard = card; wasDragged = false;
        const r = card.getBoundingClientRect();
        offX = e.touches[0].clientX - r.left; offY = e.touches[0].clientY - r.top;
        card.style.zIndex = 50; card.classList.add('highlight');
    }, { passive: false });
    area.addEventListener('touchmove', (e) => {
        if (!dragCard) return;
        e.preventDefault();
        wasDragged = true;
        const areaRect = area.getBoundingClientRect();
        dragCard.style.left = (e.touches[0].clientX - areaRect.left - offX) + 'px';
        dragCard.style.top = (e.touches[0].clientY - areaRect.top - offY) + 'px';
    }, { passive: false });
    area.addEventListener('touchend', () => {
        if (!dragCard) return;
        dragCard.classList.remove('highlight');
        dragCard.style.zIndex = 5;
        dragCard = null;
    });
}

function selectCard(cardEl, name) {
    if (currentRound >= cardsToSelect) return;
    if (navigator.vibrate) navigator.vibrate(30);
    availableCards = availableCards.filter(n => n !== name);
    selectedCards.push({ name }); window._selectedCards = selectedCards;
    currentRound++;
    cardEl.classList.add('fly-out');
    setTimeout(() => { if (cardEl.parentNode) cardEl.remove(); }, 500);
    const preview = document.createElement('div');
    preview.className = 'selected-card-preview';
    preview.style.backgroundImage = `url('images/cards/${CARD_IMAGES[name]}')`;
    preview.onerror = function() { this.style.backgroundImage = 'none'; this.textContent = '🃏'; };
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
                document.getElementById('deck-stack').style.display = 'block';
            }, 500);
        }, 600);
    }
}

// ===== ЗАПРОС К ПРОКСИ (с таймаутом) =====
async function callMage(systemPrompt, userMessage) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
        const response = await fetch(PROXY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMessage }] }),
            signal: controller.signal
        });
        clearTimeout(timeout);
        if (!response.ok) return null;
        const data = await response.json();
        return data?.choices?.[0]?.message?.content || null;
    } catch (e) {
        clearTimeout(timeout);
        console.error('API error:', e.message);
        return null;
    }
}

const BASE_MAGE_PROMPT = `Ты — Маг Эзотериум, потомственный маг, астролог и таролог, живой человек. Ты НИКОГДА не упоминаешь ИИ, технологии, нейросети. Отвечаешь загадочно, мудро, с психологической глубиной.`;

async function getTarotPrediction() {
    showScreen('tarotResult'); updateCreditsBadge();
    document.getElementById('result-cards').innerHTML = selectedCards.map(c =>
        `<img src="images/cards/${CARD_IMAGES[c.name]}" alt="${c.name}" onerror="this.style.display='none'; this.insertAdjacentHTML('afterend','🃏')">`
    ).join('');
    const textEl = document.getElementById('prediction-text');
    textEl.innerHTML = '<span class="loading-dots">Маг советуется со звёздами</span><span class="dots-anim">...</span>';
    const cardsNames = selectedCards.map(c => c.name).join(', ');
    const system = BASE_MAGE_PROMPT + ' Начинай ответ с "Маг Эзотериум видит...".';
    const answer = await callMage(system, `Вопрос: "${window.tarotQuestion}". Выпали карты: ${cardsNames}. Дай предсказание.`);
    textEl.textContent = answer || '✨ Маг Эзотериум сегодня не может заглянуть за завесу. Попробуйте позже — звёзды переменчивы.';
}

document.getElementById('share-btn').addEventListener('click', () => {
    const text = document.getElementById('prediction-text').textContent;
    if (navigator.share) navigator.share({ title: 'Предсказание Nastardamus', text }).catch(() => {});
    else {
        navigator.clipboard?.writeText(text).then(() => alert('Предсказание скопировано!')).catch(() => alert('Скопируйте текст вручную.'));
    }
});

// Натальная карта
document.getElementById('get-natal').addEventListener('click', async () => {
    const date = document.getElementById('natal-date').value;
    if (!date) return alert('Пожалуйста, введите дату рождения.');
    showScreen('natalResult');
    document.getElementById('natal-text').innerHTML = '<span class="loading-dots">Рассчитываем</span><span class="dots-anim">...</span>';
    const system = BASE_MAGE_PROMPT + ' Начинай ответ со слов "Звёзды поведали мне...".';
    const answer = await callMage(system, `Натальная карта для рождения ${date} ${document.getElementById('natal-time').value}.`);
    document.getElementById('natal-text').textContent = answer || 'Не удалось рассчитать карту. Попробуйте позже.';
});

// Совместимость
document.getElementById('get-compat').addEventListener('click', async () => {
    const n1 = document.getElementById('person1-name').value.trim() || 'Первый партнёр';
    const d1 = document.getElementById('person1-date').value;
    const n2 = document.getElementById('person2-name').value.trim() || 'Второй партнёр';
    const d2 = document.getElementById('person2-date').value;
    if (!d1 || !d2) return alert('Пожалуйста, введите даты рождения обоих людей.');
    showScreen('compatResult');
    document.getElementById('compat-text').innerHTML = '<span class="loading-dots">Анализируем</span><span class="dots-anim">...</span>';
    const system = BASE_MAGE_PROMPT + ' Начинай ответ с "Маг Эзотериум раскрывает тайну вашей связи...".';
    const answer = await callMage(system, `Совместимость ${n1} (${d1}) и ${n2} (${d2}).`);
    document.getElementById('compat-text').textContent = answer || 'Не удалось проанализировать совместимость. Попробуйте позже.';
});

showScreen('welcome');
