(() => {
    'use strict';

    const ritualStyle = document.createElement('link');
    ritualStyle.rel = 'stylesheet';
    ritualStyle.href = 'ritual-v4.css';
    document.head.appendChild(ritualStyle);

    const tg = window.Telegram?.WebApp;
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

    const SPREADS = {
        'one-sign': { label: 'Один знак', count: 1, positions: ['Главный знак'] },
        'three-paths': { label: 'Три пути', count: 3, positions: ['Истоки', 'Настоящее', 'Следующий шаг'] },
        decision: { label: 'Перекрёсток', count: 4, positions: ['Суть выбора', 'Первый путь', 'Второй путь', 'Внутренняя цена'] },
        career: { label: 'Путь предназначения', count: 5, positions: ['Ваш ресурс', 'Препятствие', 'Скрытый талант', 'Действие', 'Перспектива'] },
        relationship: { label: 'Два сердца', count: 6, positions: ['Ваш вклад', 'Вклад другого', 'Притяжение', 'Напряжение', 'Что важно сказать', 'Общий путь'] },
        shadow: { label: 'Тень и ресурс', count: 3, positions: ['Скрытая тема', 'Сила внутри неё', 'Возвращение выбора'] },
        'celtic-cross': { label: 'Кельтский крест', count: 10, positions: ['Суть', 'Пересечение', 'Основание', 'Прошлое', 'Возможность', 'Ближайший путь', 'Ваша позиция', 'Окружение', 'Надежда и страх', 'Направление'] }
    };

    let selected = [];
    let available = [];
    let activeSpread = SPREADS['three-paths'];
    let activeSpreadKey = 'three-paths';
    let currentReading = null;
    let readingBusy = false;

    function pulse(type = 'light') {
        tg?.HapticFeedback?.impactOccurred?.(type);
        if (!tg) navigator.vibrate?.(type === 'medium' ? 35 : 18);
    }

    function notify(message) {
        if (typeof window.showToast === 'function') window.showToast(message);
    }

    function shuffle(values) {
        const result = [...values];
        for (let index = result.length - 1; index > 0; index -= 1) {
            const swap = Math.floor(Math.random() * (index + 1));
            [result[index], result[swap]] = [result[swap], result[index]];
        }
        return result;
    }

    function start(event) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (readingBusy) return;
        const select = document.getElementById('tarot-spread-select');
        activeSpreadKey = select?.value && SPREADS[select.value] ? select.value : 'three-paths';
        activeSpread = SPREADS[activeSpreadKey];
        selected = [];
        available = Object.keys(CARD_IMAGES);
        currentReading = null;
        document.getElementById('selected-cards-preview').replaceChildren();
        document.getElementById('spread-area').replaceChildren();
        document.getElementById('cards-left').textContent = `0 / ${activeSpread.count}`;
        document.getElementById('shuffle-instruction').textContent = activeSpread.count === 1 ? 'Коснитесь колоды' : `Выберите ${activeSpread.count} карт`;
        document.getElementById('deck-stack').hidden = false;
        document.querySelector('#tarot-cards-screen .eyebrow').textContent = activeSpread.label;
        pulse('medium');
        window.showScreen?.('tarot-cards-screen');
    }

    function deal(event) {
        event.preventDefault();
        event.stopImmediatePropagation();
        const area = document.getElementById('spread-area');
        if (!area || selected.length >= activeSpread.count || area.childElementCount > 0) return;
        area.replaceChildren();
        document.getElementById('deck-stack').hidden = true;
        document.getElementById('shuffle-instruction').textContent = `Выберите карту ${selected.length + 1}: ${activeSpread.positions[selected.length] || 'Знак'}`;
        pulse();
        const width = Math.max(area.offsetWidth, 340);
        const height = Math.max(area.offsetHeight, 400);
        shuffle(available).forEach((name, index) => {
            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'spread-card spread-card--v4';
            card.setAttribute('aria-label', `Выбрать карту для позиции ${activeSpread.positions[selected.length] || selected.length + 1}`);
            card.style.left = `${12 + Math.random() * Math.max(width - 108, 1)}px`;
            card.style.top = `${14 + Math.random() * Math.max(height - 164, 1)}px`;
            card.style.setProperty('--card-rotation', `${(Math.random() - 0.5) * 40}deg`);
            card.style.setProperty('--deal-delay', `${Math.min(index * 12, 230)}ms`);
            card.addEventListener('click', (clickEvent) => selectCard(clickEvent, card, name), { once: true });
            area.appendChild(card);
        });
    }

    function selectCard(event, card, name) {
        event.preventDefault();
        event.stopPropagation();
        if (selected.length >= activeSpread.count || !available.includes(name)) return;
        available = available.filter((item) => item !== name);
        selected.push(name);
        pulse('medium');
        card.classList.add('fly-out', 'chosen-v4');
        createSpark(card);
        const preview = document.createElement('figure');
        preview.className = 'selected-card-preview selected-card-preview--v4';
        preview.style.backgroundImage = `url('images/cards/${CARD_IMAGES[name]}')`;
        preview.setAttribute('aria-label', `${activeSpread.positions[selected.length - 1]}: ${name}`);
        const label = document.createElement('figcaption');
        label.textContent = activeSpread.positions[selected.length - 1] || `${selected.length}`;
        preview.appendChild(label);
        document.getElementById('selected-cards-preview').appendChild(preview);
        document.getElementById('cards-left').textContent = `${selected.length} / ${activeSpread.count}`;
        setTimeout(() => collect(selected.length >= activeSpread.count), 430);
    }

    function createSpark(card) {
        const burst = document.createElement('span');
        burst.className = 'card-magic-burst';
        for (let index = 0; index < 8; index += 1) {
            const spark = document.createElement('i');
            spark.style.setProperty('--spark-angle', `${index * 45}deg`);
            burst.appendChild(spark);
        }
        card.appendChild(burst);
    }

    function collect(complete) {
        const area = document.getElementById('spread-area');
        area.querySelectorAll('.spread-card').forEach((card) => card.classList.add('collecting'));
        setTimeout(() => {
            area.replaceChildren();
            if (complete) {
                document.getElementById('deck-stack').hidden = true;
                getReading();
            } else {
                document.getElementById('deck-stack').hidden = false;
                document.getElementById('shuffle-instruction').textContent = `Позиция ${selected.length + 1}: ${activeSpread.positions[selected.length] || 'следующий знак'}`;
            }
        }, 390);
    }

    async function getReading() {
        readingBusy = true;
        const question = document.getElementById('tarot-question').value.trim() || 'На что мне стоит обратить внимание сейчас?';
        const resultCards = document.getElementById('result-cards');
        const prediction = document.getElementById('prediction-text');
        const title = document.getElementById('tarot-result-title');
        title.textContent = activeSpread.label;
        resultCards.classList.toggle('result-cards--many', selected.length > 4);
        resultCards.replaceChildren(...selected.map((name, index) => {
            const figure = document.createElement('figure');
            figure.style.setProperty('--reveal-delay', `${Math.min(index * 90, 720)}ms`);
            const image = document.createElement('img');
            const caption = document.createElement('figcaption');
            image.src = `images/cards/${CARD_IMAGES[name]}`;
            image.alt = name;
            caption.innerHTML = `<small>${activeSpread.positions[index] || `Позиция ${index + 1}`}</small><strong>${name}</strong>`;
            figure.append(image, caption);
            return figure;
        }));
        prediction.textContent = 'Эзотериум соединяет значения карт...';
        prediction.classList.add('is-loading');
        document.getElementById('prediction-loader').hidden = false;
        window.showScreen?.('tarot-result-screen');
        try {
            const response = await fetch('/api/proxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': tg?.initData || '' },
                body: JSON.stringify({
                    feature: 'tarot',
                    payload: { question, cards: selected, spread: activeSpreadKey, positions: activeSpread.positions }
                })
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || 'reading_failed');
            const body = typeof data.answer === 'string' && data.answer.trim()
                ? data.answer.trim()
                : 'Связь со знаками прервалась. Попробуйте повторить расклад немного позже.';
            prediction.textContent = body;
            currentReading = {
                id: uniqueId('tarot-v4'),
                type: `Расклад «${activeSpread.label}»`,
                title: question,
                body,
                cards: [...selected],
                createdAt: new Date().toISOString(),
                favorite: false
            };
        } catch (error) {
            console.error(error);
            prediction.textContent = 'Не удалось получить толкование. Проверьте соединение и повторите расклад.';
        } finally {
            prediction.classList.remove('is-loading');
            document.getElementById('prediction-loader').hidden = true;
            readingBusy = false;
        }
    }

    function save(event) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!currentReading) return notify('Дождитесь толкования');
        if (typeof window.saveReading === 'function') window.saveReading(currentReading);
        else saveFallback(currentReading);
    }

    async function share(event) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!currentReading) return notify('Дождитесь толкования');
        if (typeof window.shareReading === 'function') return window.shareReading(currentReading);
        const text = `${currentReading.type}: ${currentReading.title}\nКарты: ${currentReading.cards.join(', ')}\n\n${currentReading.body}\n\nNastardamus`;
        try {
            if (navigator.share) await navigator.share({ title: 'Nastardamus', text });
            else await navigator.clipboard.writeText(text);
        } catch (error) {
            if (error?.name !== 'AbortError') notify('Не удалось поделиться');
        }
    }

    function saveFallback(reading) {
        const key = 'nastardamus-journal-v2';
        let entries = [];
        try { entries = JSON.parse(localStorage.getItem(key)) || []; } catch { entries = []; }
        if (entries.some((entry) => entry.id === reading.id)) return notify('Эта запись уже в дневнике');
        entries.unshift(reading);
        localStorage.setItem(key, JSON.stringify(entries.slice(0, 50)));
        notify('Сохранено в дневник');
    }

    function uniqueId(prefix) {
        return `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
    }

    function bindCapture(id, handler) {
        document.getElementById(id)?.addEventListener('click', handler, { capture: true });
    }

    bindCapture('start-tarot', start);
    bindCapture('deck-stack', deal);
    bindCapture('save-tarot', save);
    bindCapture('share-tarot', share);
})();