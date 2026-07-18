const telegram = window.Telegram?.WebApp;

if (telegram) {
    telegram.ready();
    telegram.expand();
    telegram.setHeaderColor?.('#090713');
    telegram.setBackgroundColor?.('#090713');
}

const CARD_IMAGES = {
    'Шут': 'fool.webp',
    'Маг': 'magician.webp',
    'Верховная Жрица': 'high-priestess.webp',
    'Императрица': 'empress.webp',
    'Император': 'emperor.webp',
    'Иерофант': 'hierophant.webp',
    'Влюблённые': 'lovers.webp',
    'Колесница': 'chariot.webp',
    'Сила': 'strength.webp',
    'Отшельник': 'hermit.webp',
    'Колесо Фортуны': 'wheel-of-fortune.webp',
    'Справедливость': 'justice.webp',
    'Повешенный': 'hanged-man.webp',
    'Смерть': 'death.webp',
    'Умеренность': 'temperance.webp',
    'Дьявол': 'devil.webp',
    'Башня': 'tower.webp',
    'Звезда': 'star.webp',
    'Луна': 'moon.webp',
    'Солнце': 'sun.webp',
    'Суд': 'judgement.webp',
    'Мир': 'world.webp'
};

const DAILY_GUIDES = [
    { name: 'Шут', meaning: 'Сегодня полезно позволить себе первый шаг без требования знать весь маршрут.', reflection: 'Где любопытство может оказаться мудрее привычной осторожности?' },
    { name: 'Маг', meaning: 'У вас уже есть главный ресурс для движения. День просит не ждать идеальных условий, а применить то, что доступно.', reflection: 'Какой навык стоит использовать прямо сегодня?' },
    { name: 'Верховная Жрица', meaning: 'Не каждый ответ нужно торопить. Прислушайтесь к тихой реакции внутри, прежде чем искать подтверждение снаружи.', reflection: 'Что вы уже знаете, но пока не решаетесь признать?' },
    { name: 'Императрица', meaning: 'Дайте внимание тому, что хотите вырастить: идее, отношениям, телу или дому. Забота сегодня — это действие.', reflection: 'Что расцветёт, если вы добавите немного тепла?' },
    { name: 'Император', meaning: 'Ясная граница или простой план вернут ощущение опоры. Структура нужна не для контроля, а для свободы.', reflection: 'Какое одно правило упростит ваш день?' },
    { name: 'Иерофант', meaning: 'Проверьте, какая традиция поддерживает вас, а какая давно стала автоматической. Мудрость можно уважать и переосмысливать.', reflection: 'Чей опыт поможет вам увидеть ситуацию шире?' },
    { name: 'Влюблённые', meaning: 'Сегодняшний выбор лучше сверять с ценностями, а не только с выгодой. Важна честность перед собой и другим.', reflection: 'Какой выбор приблизит вас к тому, кем вы хотите быть?' },
    { name: 'Колесница', meaning: 'Разные импульсы можно направить в одну сторону. Выберите курс и уберите одно отвлечение.', reflection: 'Куда вы направите энергию, если перестанете метаться?' },
    { name: 'Сила', meaning: 'Мягкая устойчивость окажется эффективнее давления. Сначала успокойте внутреннее напряжение, затем действуйте.', reflection: 'Где доброта к себе даст больше силы, чем критика?' },
    { name: 'Отшельник', meaning: 'Небольшая пауза прояснит то, что теряется в шуме. Это день для точного вопроса, а не быстрого ответа.', reflection: 'От какого шума стоит отойти хотя бы на час?' },
    { name: 'Колесо Фортуны', meaning: 'Условия меняются, и в этом есть окно возможностей. Заметьте новый ритм вместо попытки вернуть прежний.', reflection: 'Какую перемену можно не контролировать, а использовать?' },
    { name: 'Справедливость', meaning: 'Факты и последствия сегодня важнее красивой версии событий. Честный взгляд поможет принять ровное решение.', reflection: 'Что изменится, если отделить наблюдение от интерпретации?' },
    { name: 'Повешенный', meaning: 'Задержка может быть приглашением изменить угол зрения. Не всякое бездействие означает потерю времени.', reflection: 'Что станет видно, если перестать продавливать ситуацию?' },
    { name: 'Смерть', meaning: 'Один этап просит завершения, чтобы освободить место новому. Речь не о предсказании, а о естественной трансформации.', reflection: 'С чем вы готовы попрощаться без обесценивания прошлого?' },
    { name: 'Умеренность', meaning: 'Найдите рабочую пропорцию между усилием и восстановлением. Малые корректировки сегодня важнее резких рывков.', reflection: 'Что можно сделать спокойнее, но регулярнее?' },
    { name: 'Дьявол', meaning: 'Обратите внимание на привычку, которая обещает облегчение, но сужает выбор. Осознанность уже возвращает часть свободы.', reflection: 'Какой автоматический сценарий вы хотите заметить раньше?' },
    { name: 'Башня', meaning: 'Если шаткая конструкция трещит, это шанс перестроить её честнее. Сосредоточьтесь на том, что действительно остаётся.', reflection: 'Какая правда освобождает энергию, даже если сначала неудобна?' },
    { name: 'Звезда', meaning: 'Верните в поле зрения надежду, которую можно поддержать маленьким реальным действием. Ориентир уже виден.', reflection: 'Какой шаг подтвердит вашу веру в лучшее?' },
    { name: 'Луна', meaning: 'Неясность усиливает фантазии. Дайте чувствам место, но проверяйте выводы и не спешите заполнять пробелы.', reflection: 'Какой факт поможет отличить интуицию от тревоги?' },
    { name: 'Солнце', meaning: 'То, что приносит ясность и живость, заслуживает вашего внимания. Позвольте себе быть заметнее и проще.', reflection: 'Чем вы можете поделиться без лишней скромности?' },
    { name: 'Суд', meaning: 'Настало время услышать собственный вывод из пройденного опыта. Прошлое не требует повторения, если урок назван.', reflection: 'Какое решение уже созрело внутри вас?' },
    { name: 'Мир', meaning: 'Отметьте завершённый цикл, прежде чем открывать следующий. Целостность рождается из признания всего пути.', reflection: 'Как вы можете отпраздновать то, что уже удалось?' }
];

const STORAGE = {
    onboarded: 'nastardamus-onboarded-v2',
    streak: 'nastardamus-streak-v2',
    dailyReveal: 'nastardamus-daily-reveal-v2',
    journal: 'nastardamus-journal-v2'
};

const screens = new Map([...document.querySelectorAll('.screen')].map((screen) => [screen.id, screen]));
const tabBar = document.getElementById('tab-bar');
const toast = document.getElementById('toast');
const telegramBackButton = telegram?.BackButton;
const user = telegram?.initDataUnsafe?.user;
const firstName = cleanName(user?.first_name) || 'Искатель';
const journalFilterButtons = [...document.querySelectorAll('[data-journal-filter]')];
const deckNames = Object.keys(CARD_IMAGES);

let toastTimer;
let videoFinished = false;
let videoTimer;
let selectedCards = [];
let availableCards = [];
let cardsToSelect = 3;
let journalFilter = 'all';
let currentTarotReading = null;
let currentNatalReading = null;
let currentCompatReading = null;
let currentScreenId = 'welcome-screen';

const BACK_TARGETS = {
    'daily-screen': 'menu-screen',
    'video-screen': 'menu-screen',
    'tarot-input-screen': 'menu-screen',
    'tarot-cards-screen': 'tarot-input-screen',
    'tarot-result-screen': 'menu-screen',
    'natal-input-screen': 'menu-screen',
    'natal-result-screen': 'natal-input-screen',
    'compat-input-screen': 'menu-screen',
    'compat-result-screen': 'compat-input-screen',
    'journal-screen': 'menu-screen',
    'wallet-screen': 'menu-screen'
};

function cleanName(value) {
    return typeof value === 'string' ? value.trim().slice(0, 30) : '';
}

function bindClick(id, handler) {
    const element = document.getElementById(id);
    if (!element) {
        console.warn(`Missing element #${id}`);
        return;
    }
    element.addEventListener('click', handler);
}

function showScreen(screenId) {
    const target = screens.get(screenId);
    if (!target) return;

    for (const screen of screens.values()) {
        const isTarget = screen === target;
        screen.classList.toggle('active', isTarget);
        screen.setAttribute('aria-hidden', isTarget ? 'false' : 'true');
    }

    tabBar.hidden = screenId === 'welcome-screen' || screenId === 'video-screen';
    document.body.classList.toggle('has-tab-bar', !tabBar.hidden);
    currentScreenId = screenId;
    if (BACK_TARGETS[screenId]) telegramBackButton?.show?.();
    else telegramBackButton?.hide?.();
    updateActiveTab(screenId);

    if (screenId === 'daily-screen') renderDailyCard();
    if (screenId === 'journal-screen') renderJournal();
    if (screenId === 'wallet-screen') updateProfile();

    window.scrollTo({ top: 0, behavior: 'auto' });
}

telegramBackButton?.onClick?.(() => {
    const target = BACK_TARGETS[currentScreenId];
    if (target) showScreen(target);
});

function updateActiveTab(screenId) {
    const sectionByScreen = {
        'menu-screen': 'menu-screen',
        'daily-screen': 'daily-screen',
        'tarot-input-screen': 'tarot-input-screen',
        'tarot-cards-screen': 'tarot-input-screen',
        'tarot-result-screen': 'tarot-input-screen',
        'journal-screen': 'journal-screen'
    };
    const activeTarget = sectionByScreen[screenId];

    document.querySelectorAll('[data-nav-target]').forEach((button) => {
        const isActive = button.dataset.navTarget === activeTarget;
        button.classList.toggle('active', isActive);
        if (isActive) button.setAttribute('aria-current', 'page');
        else button.removeAttribute('aria-current');
    });
}

function showToast(message) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add('visible');
    toastTimer = setTimeout(() => toast.classList.remove('visible'), 2800);
}

function haptic(type = 'light') {
    telegram?.HapticFeedback?.impactOccurred?.(type);
    if (!telegram) navigator.vibrate?.(type === 'medium' ? 35 : 18);
}

document.querySelectorAll('[data-target]').forEach((button) => {
    button.addEventListener('click', () => showScreen(button.dataset.target));
});

document.querySelectorAll('[data-nav-target]').forEach((button) => {
    button.addEventListener('click', () => {
        haptic();
        showScreen(button.dataset.navTarget);
    });
});

bindClick('continue-btn', () => {
    localStorage.setItem(STORAGE.onboarded, 'true');
    haptic('medium');
    showScreen('menu-screen');
});
bindClick('go-daily', () => { haptic(); showScreen('daily-screen'); });
bindClick('go-tarot', () => { haptic(); showScreen('tarot-input-screen'); });
bindClick('go-natal', () => { haptic(); showScreen('natal-input-screen'); });
bindClick('go-compat', () => { haptic(); showScreen('compat-input-screen'); });
bindClick('profile-btn', () => { haptic(); showScreen('wallet-screen'); });
bindClick('watch-intro', playMageVideo);

function localDateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function dayDistance(first, second) {
    const firstTime = new Date(`${first}T12:00:00`).getTime();
    const secondTime = new Date(`${second}T12:00:00`).getTime();
    return Math.round((secondTime - firstTime) / 86_400_000);
}

function readJSON(key, fallback) {
    try {
        const value = JSON.parse(localStorage.getItem(key));
        return value ?? fallback;
    } catch {
        return fallback;
    }
}

function updateStreak() {
    const today = localDateKey();
    const stored = readJSON(STORAGE.streak, { lastDate: '', count: 0 });
    let count = Number.isSafeInteger(stored.count) ? stored.count : 0;

    if (stored.lastDate !== today) {
        count = stored.lastDate && dayDistance(stored.lastDate, today) === 1 ? count + 1 : 1;
        localStorage.setItem(STORAGE.streak, JSON.stringify({ lastDate: today, count }));
    }

    const safeCount = Math.max(1, count);
    document.querySelectorAll('[data-streak]').forEach((element) => {
        element.textContent = String(safeCount);
    });
    return safeCount;
}

function stableHash(value) {
    let hash = 2166136261;
    for (const character of value) {
        hash ^= character.charCodeAt(0);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

function getDailyGuide() {
    const identity = user?.id ? String(user.id) : 'guest';
    return DAILY_GUIDES[stableHash(`${localDateKey()}:${identity}`) % DAILY_GUIDES.length];
}

function isDailyRevealed() {
    return localStorage.getItem(STORAGE.dailyReveal) === localDateKey();
}

function renderDailyCard() {
    const guide = getDailyGuide();
    const revealed = isDailyRevealed();
    const card = document.getElementById('daily-card-reveal');
    const reading = document.getElementById('daily-reading');
    const prompt = document.getElementById('daily-prompt');
    const image = document.getElementById('daily-card-image');
    const homeImage = document.getElementById('home-daily-image');
    const homeMiniCard = document.getElementById('home-mini-card');
    const imagePath = `images/cards/${CARD_IMAGES[guide.name]}`;

    image.src = imagePath;
    image.alt = `Карта дня: ${guide.name}`;
    homeImage.src = imagePath;
    homeMiniCard.classList.toggle('is-revealed', revealed);
    card.classList.toggle('is-revealed', revealed);
    card.setAttribute('aria-label', revealed ? `Карта дня: ${guide.name}` : 'Открыть карту дня');
    reading.hidden = !revealed;
    prompt.hidden = revealed;
    document.getElementById('daily-date').textContent = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(new Date());
    document.getElementById('daily-card-name').textContent = guide.name;
    document.getElementById('daily-card-meaning').textContent = guide.meaning;
    document.getElementById('daily-reflection').textContent = guide.reflection;
    document.getElementById('home-daily-title').textContent = revealed ? guide.name : 'Ваш знак уже выбран';
    document.getElementById('home-daily-caption').textContent = revealed ? 'Вернуться к посланию' : 'Откройте послание на сегодня';
    document.getElementById('home-daily-date').textContent = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(new Date());
}

bindClick('daily-card-reveal', () => {
    if (isDailyRevealed()) return;
    localStorage.setItem(STORAGE.dailyReveal, localDateKey());
    haptic('medium');
    renderDailyCard();
});

function dailyReadingRecord() {
    const guide = getDailyGuide();
    return {
        id: `daily-${localDateKey()}`,
        type: 'Карта дня',
        title: guide.name,
        body: `${guide.meaning}\n\nВопрос дня: ${guide.reflection}`,
        cards: [guide.name],
        createdAt: new Date().toISOString(),
        favorite: false
    };
}

bindClick('save-daily', () => saveReading(dailyReadingRecord()));
bindClick('share-daily', () => shareReading(dailyReadingRecord()));

function playMageVideo() {
    const video = document.getElementById('mage-video');
    videoFinished = false;
    clearTimeout(videoTimer);
    video.src = 'video/welcome-v2.mp4';
    video.currentTime = 0;
    video.onended = finishVideo;
    video.onerror = finishVideo;
    video.onclick = finishVideo;
    showScreen('video-screen');
    video.play().catch(() => {});
    videoTimer = setTimeout(finishVideo, 10_000);
}

function finishVideo() {
    if (videoFinished) return;
    videoFinished = true;
    clearTimeout(videoTimer);
    document.getElementById('mage-video').pause();
    showScreen('tarot-input-screen');
}

bindClick('skip-video-btn', finishVideo);

document.querySelectorAll('[data-question]').forEach((button) => {
    button.addEventListener('click', () => {
        const field = document.getElementById('tarot-question');
        field.value = button.dataset.question;
        field.focus();
        haptic();
    });
});

bindClick('start-tarot', startRitual);
bindClick('deck-stack', spreadCards);

function startRitual() {
    selectedCards = [];
    availableCards = [...deckNames];
    cardsToSelect = 3;
    currentTarotReading = null;
    document.getElementById('selected-cards-preview').replaceChildren();
    document.getElementById('spread-area').replaceChildren();
    document.getElementById('cards-left').textContent = `0 / ${cardsToSelect}`;
    document.getElementById('shuffle-instruction').textContent = 'Коснитесь колоды';
    document.getElementById('deck-stack').hidden = false;
    haptic('medium');
    showScreen('tarot-cards-screen');
}

function shuffled(values) {
    const result = [...values];
    for (let index = result.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
    }
    return result;
}

function spreadCards() {
    const area = document.getElementById('spread-area');
    if (selectedCards.length >= cardsToSelect || area.childElementCount > 0) return;

    area.replaceChildren();
    document.getElementById('deck-stack').hidden = true;
    document.getElementById('shuffle-instruction').textContent = 'Выберите одну карту';
    haptic();

    const width = Math.max(area.offsetWidth, 340);
    const height = Math.max(area.offsetHeight, 400);

    shuffled(availableCards).forEach((name, index) => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'spread-card';
        card.setAttribute('aria-label', 'Выбрать карту');
        card.style.left = `${14 + Math.random() * Math.max(width - 112, 1)}px`;
        card.style.top = `${16 + Math.random() * Math.max(height - 168, 1)}px`;
        card.style.setProperty('--card-rotation', `${(Math.random() - 0.5) * 38}deg`);
        card.style.setProperty('--deal-delay', `${Math.min(index * 12, 240)}ms`);
        card.addEventListener('click', (event) => {
            event.stopPropagation();
            selectCard(card, name);
        }, { once: true });
        area.appendChild(card);
    });
}

function selectCard(card, name) {
    if (selectedCards.length >= cardsToSelect || !availableCards.includes(name)) return;

    haptic('medium');
    availableCards = availableCards.filter((cardName) => cardName !== name);
    selectedCards.push(name);
    card.classList.add('fly-out');

    const preview = document.createElement('div');
    preview.className = 'selected-card-preview';
    preview.style.backgroundImage = `url('images/cards/${CARD_IMAGES[name]}')`;
    preview.setAttribute('aria-label', name);
    document.getElementById('selected-cards-preview').appendChild(preview);
    document.getElementById('cards-left').textContent = `${selectedCards.length} / ${cardsToSelect}`;
    setTimeout(() => collectCards(selectedCards.length >= cardsToSelect), 430);
}

function collectCards(isComplete) {
    const area = document.getElementById('spread-area');
    area.querySelectorAll('.spread-card').forEach((card) => card.classList.add('collecting'));
    setTimeout(() => {
        area.replaceChildren();
        if (isComplete) {
            document.getElementById('deck-stack').hidden = true;
            getTarotPrediction();
        } else {
            document.getElementById('deck-stack').hidden = false;
            document.getElementById('shuffle-instruction').textContent = 'Снова коснитесь колоды';
        }
    }, 380);
}

async function requestReading(feature, payload) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);

    try {
        const response = await fetch('/api/proxy', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Telegram-Init-Data': telegram?.initData || ''
            },
            body: JSON.stringify({ feature, payload }),
            signal: controller.signal
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            if (response.status === 401) return 'Откройте Nastardamus внутри Telegram, чтобы получить персональное толкование.';
            throw new Error(data.error || 'Reading request failed');
        }
        return typeof data.answer === 'string' ? data.answer : null;
    } catch (error) {
        console.error('Reading request failed:', error);
        return null;
    } finally {
        clearTimeout(timeout);
    }
}

function setReadingLoading(resultId, loaderId, loading) {
    const result = document.getElementById(resultId);
    const loader = loaderId ? document.getElementById(loaderId) : null;
    result.classList.toggle('is-loading', loading);
    if (loader) loader.hidden = !loading;
}

async function getTarotPrediction() {
    const question = document.getElementById('tarot-question').value.trim() || 'На что мне стоит обратить внимание сейчас?';
    const resultCards = document.getElementById('result-cards');
    const prediction = document.getElementById('prediction-text');

    resultCards.replaceChildren(...selectedCards.map((name, index) => {
        const figure = document.createElement('figure');
        figure.style.setProperty('--reveal-delay', `${index * 120}ms`);
        const image = document.createElement('img');
        const caption = document.createElement('figcaption');
        image.src = `images/cards/${CARD_IMAGES[name]}`;
        image.alt = name;
        caption.textContent = name;
        figure.append(image, caption);
        return figure;
    }));
    prediction.textContent = 'Маг советуется со звёздами...';
    setReadingLoading('prediction-text', 'prediction-loader', true);
    showScreen('tarot-result-screen');

    const answer = await requestReading('tarot', { question, cards: selectedCards });
    const body = answer || 'Связь со звёздами прервалась. Попробуйте получить толкование немного позже.';
    prediction.textContent = body;
    setReadingLoading('prediction-text', 'prediction-loader', false);
    currentTarotReading = {
        id: uniqueId('tarot'),
        type: 'Расклад Таро',
        title: question,
        body,
        cards: [...selectedCards],
        createdAt: new Date().toISOString(),
        favorite: false
    };
}

function uniqueId(prefix) {
    const randomPart = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return `${prefix}-${randomPart}`;
}

bindClick('save-tarot', () => currentTarotReading ? saveReading(currentTarotReading) : showToast('Дождитесь толкования'));
bindClick('share-tarot', () => currentTarotReading ? shareReading(currentTarotReading) : showToast('Дождитесь толкования'));

bindClick('get-natal', async () => {
    const date = document.getElementById('natal-date').value;
    const time = document.getElementById('natal-time').value;
    if (!date) {
        showToast('Укажите дату рождения');
        document.getElementById('natal-date').focus();
        return;
    }

    const result = document.getElementById('natal-text');
    result.textContent = 'Сверяем символы и циклы...';
    result.classList.add('is-loading');
    showScreen('natal-result-screen');
    const answer = await requestReading('natal', { date, time });
    const body = answer || 'Не удалось получить подсказку. Попробуйте немного позже.';
    result.textContent = body;
    result.classList.remove('is-loading');
    currentNatalReading = { id: uniqueId('natal'), type: 'Натальная подсказка', title: `Рождение ${formatDate(date)}`, body, cards: [], createdAt: new Date().toISOString(), favorite: false };
});

bindClick('save-natal', () => currentNatalReading ? saveReading(currentNatalReading) : showToast('Дождитесь подсказки'));
bindClick('share-natal', () => currentNatalReading ? shareReading(currentNatalReading) : showToast('Дождитесь подсказки'));

bindClick('get-compat', async () => {
    const first = { name: cleanName(document.getElementById('person1-name').value) || 'Первый человек', date: document.getElementById('person1-date').value };
    const second = { name: cleanName(document.getElementById('person2-name').value) || 'Второй человек', date: document.getElementById('person2-date').value };

    if (!first.date || !second.date) {
        showToast('Укажите обе даты рождения');
        (!first.date ? document.getElementById('person1-date') : document.getElementById('person2-date')).focus();
        return;
    }

    const result = document.getElementById('compat-text');
    result.textContent = 'Ищем точки притяжения и роста...';
    result.classList.add('is-loading');
    showScreen('compat-result-screen');
    const answer = await requestReading('compatibility', { first, second });
    const body = answer || 'Не удалось получить результат. Попробуйте немного позже.';
    result.textContent = body;
    result.classList.remove('is-loading');
    currentCompatReading = { id: uniqueId('compat'), type: 'Совместимость', title: `${first.name} и ${second.name}`, body, cards: [], createdAt: new Date().toISOString(), favorite: false };
});

bindClick('save-compat', () => currentCompatReading ? saveReading(currentCompatReading) : showToast('Дождитесь результата'));
bindClick('share-compat', () => currentCompatReading ? shareReading(currentCompatReading) : showToast('Дождитесь результата'));

function formatDate(value) {
    const date = new Date(`${value}T12:00:00`);
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

function getJournal() {
    const journal = readJSON(STORAGE.journal, []);
    return Array.isArray(journal) ? journal.filter((entry) => entry && typeof entry.id === 'string') : [];
}

function writeJournal(entries) {
    localStorage.setItem(STORAGE.journal, JSON.stringify(entries.slice(0, 50)));
    updateProfile();
}

function saveReading(reading) {
    const entries = getJournal();
    const existingIndex = entries.findIndex((entry) => entry.id === reading.id);
    if (existingIndex >= 0) {
        showToast('Эта запись уже в дневнике');
        return;
    }
    entries.unshift({ ...reading, favorite: Boolean(reading.favorite) });
    writeJournal(entries);
    haptic('medium');
    showToast('Сохранено в дневник');
}

async function shareReading(reading) {
    const cards = reading.cards?.length ? `\nКарты: ${reading.cards.join(', ')}.` : '';
    const text = `${reading.type}: ${reading.title}${cards}\n\n${reading.body}\n\nNastardamus`;
    try {
        if (navigator.share) {
            await navigator.share({ title: 'Nastardamus', text });
            return;
        }
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            showToast('Текст скопирован');
            return;
        }
        showToast('Поделиться можно из меню Telegram');
    } catch (error) {
        if (error?.name !== 'AbortError') showToast('Не удалось поделиться');
    }
}

function renderJournal() {
    const allEntries = getJournal();
    const entries = journalFilter === 'favorite' ? allEntries.filter((entry) => entry.favorite) : allEntries;
    const list = document.getElementById('journal-list');
    const empty = document.getElementById('journal-empty');
    list.replaceChildren();
    empty.hidden = entries.length > 0;

    for (const entry of entries) {
        const article = document.createElement('article');
        article.className = 'journal-entry glass-card';

        const header = document.createElement('div');
        header.className = 'journal-entry-header';
        const meta = document.createElement('div');
        const type = document.createElement('span');
        const title = document.createElement('h2');
        const favorite = document.createElement('button');
        type.className = 'card-label';
        type.textContent = `${entry.type} · ${formatJournalDate(entry.createdAt)}`;
        title.textContent = entry.title;
        meta.append(type, title);
        favorite.type = 'button';
        favorite.className = `favorite-btn${entry.favorite ? ' active' : ''}`;
        favorite.textContent = entry.favorite ? '★' : '☆';
        favorite.setAttribute('aria-label', entry.favorite ? 'Убрать из избранного' : 'Добавить в избранное');
        favorite.addEventListener('click', () => toggleFavorite(entry.id));
        header.append(meta, favorite);

        const body = document.createElement('p');
        body.className = 'journal-entry-copy';
        body.textContent = entry.body;
        article.append(header, body);

        if (entry.cards?.length) {
            const cards = document.createElement('div');
            cards.className = 'journal-card-row';
            entry.cards.forEach((name) => {
                if (!CARD_IMAGES[name]) return;
                const image = document.createElement('img');
                image.src = `images/cards/${CARD_IMAGES[name]}`;
                image.alt = name;
                cards.appendChild(image);
            });
            article.appendChild(cards);
        }

        list.appendChild(article);
    }
}

function formatJournalDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(date);
}

function toggleFavorite(id) {
    const entries = getJournal().map((entry) => entry.id === id ? { ...entry, favorite: !entry.favorite } : entry);
    writeJournal(entries);
    haptic();
    renderJournal();
}

journalFilterButtons.forEach((button) => {
    button.addEventListener('click', () => {
        journalFilter = button.dataset.journalFilter;
        journalFilterButtons.forEach((candidate) => {
            const active = candidate === button;
            candidate.classList.toggle('active', active);
            candidate.setAttribute('aria-selected', String(active));
        });
        renderJournal();
    });
});

bindClick('clear-journal', () => {
    if (getJournal().length === 0) {
        showToast('Дневник уже пуст');
        return;
    }
    if (window.confirm('Удалить все записи из дневника? Это действие нельзя отменить.')) {
        writeJournal([]);
        renderJournal();
        showToast('Дневник очищен');
    }
});

function updateProfile() {
    const entries = getJournal();
    document.getElementById('reading-count').textContent = String(entries.length);
    document.getElementById('favorite-count').textContent = String(entries.filter((entry) => entry.favorite).length);
}

function updateIdentity() {
    document.getElementById('user-name').textContent = firstName;
    document.getElementById('profile-name').textContent = firstName;
    const hour = new Date().getHours();
    document.getElementById('greeting').textContent = hour < 6 ? 'Доброй ночи' : hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер';
}

updateIdentity();
updateStreak();
renderDailyCard();
updateProfile();
showScreen(localStorage.getItem(STORAGE.onboarded) ? 'menu-screen' : 'welcome-screen');
