(() => {
    'use strict';

    const tg = window.Telegram?.WebApp;
    const STORAGE = {
        wallet: 'nastardamus-wallet-v4',
        support: 'nastardamus-support-v4',
        palm: 'nastardamus-palmlink-v4',
        photoDraft: 'nastardamus-photo-draft-v4'
    };

    const app = document.getElementById('app');
    const tabBar = document.getElementById('tab-bar');
    const toast = document.getElementById('toast');
    let toastTimer;
    let currentPhotoMode = 'energy';
    let photoOne = '';
    let photoTwo = '';
    let currentPhotoReading = null;
    let supportBusy = false;

    function readJSON(key, fallback) {
        try {
            const value = JSON.parse(localStorage.getItem(key));
            return value ?? fallback;
        } catch {
            return fallback;
        }
    }

    function writeJSON(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    }

    function notify(message) {
        if (typeof window.showToast === 'function') {
            window.showToast(message);
            return;
        }
        clearTimeout(toastTimer);
        toast.textContent = message;
        toast.classList.add('visible');
        toastTimer = setTimeout(() => toast.classList.remove('visible'), 2800);
    }

    function pulse(type = 'light') {
        tg?.HapticFeedback?.impactOccurred?.(type);
        if (!tg) navigator.vibrate?.(type === 'medium' ? 35 : 18);
    }

    function navigate(screenId) {
        const target = document.getElementById(screenId);
        if (!target) return;
        document.querySelectorAll('.screen').forEach((screen) => {
            const active = screen === target;
            screen.classList.toggle('active', active);
            screen.setAttribute('aria-hidden', active ? 'false' : 'true');
        });
        const hideTabs = screenId === 'welcome-screen' || screenId === 'video-screen';
        tabBar.hidden = hideTabs;
        document.body.classList.toggle('has-tab-bar', !hideTabs);
        document.querySelectorAll('[data-nav-target]').forEach((button) => {
            const direct = button.dataset.navTarget === screenId;
            const profile = screenId === 'wallet-screen' && button.dataset.navTarget === 'wallet-screen';
            button.classList.toggle('active', direct || profile);
        });
        if (screenId === 'wallet-screen') renderWallet();
        if (screenId === 'support-screen') renderSupport();
        if (screenId === 'palmlink-screen') renderPalmProfile();
        window.scrollTo({ top: 0, behavior: 'auto' });
    }

    function decorateWelcome() {
        const screen = document.getElementById('welcome-screen');
        screen.classList.add('welcome-screen--v4');
        screen.querySelector('.brand-mark')?.classList.add('brand-mark--portal');
        const eyebrow = screen.querySelector('.eyebrow');
        const copy = screen.querySelector('.welcome-copy');
        const signature = screen.querySelector('.welcome-signature');
        const fine = screen.querySelector('.fine-print');
        if (eyebrow) eyebrow.textContent = 'Пространство Эзотериума';
        if (copy) copy.textContent = 'Таро, звёзды, символы ладони и ответы на важные вопросы — в одном личном пространстве.';
        if (signature) signature.innerHTML = '<span>маг и провидец</span><i>✦</i><span>личный дневник</span>';
        if (fine) fine.textContent = 'Толкования созданы для размышления и развлечения и не заменяют профессиональную помощь.';
        if (!document.getElementById('welcome-video-btn')) {
            const button = document.createElement('button');
            button.id = 'welcome-video-btn';
            button.className = 'welcome-video-btn';
            button.type = 'button';
            button.innerHTML = '<span aria-hidden="true">▶</span> Посмотреть приветствие';
            screen.querySelector('#continue-btn')?.insertAdjacentElement('afterend', button);
            button.addEventListener('click', () => document.getElementById('watch-intro')?.click());
        }
    }

    function decorateHome() {
        const content = document.querySelector('#menu-screen .home-content');
        const header = content?.querySelector('.home-header');
        if (!content || !header || content.dataset.v4Ready) return;
        content.dataset.v4Ready = 'true';
        header.classList.add('home-header--v4');
        document.getElementById('home-title').innerHTML = '<span id="user-name">Искатель</span>, ваш знак рядом';
        document.getElementById('profile-btn')?.classList.add('avatar-btn--v4');

        header.insertAdjacentHTML('afterend', `
            <button id="home-wallet-card" class="balance-ribbon glass-card" type="button">
                <span class="balance-coin" aria-hidden="true">S</span>
                <span class="balance-copy"><small>Лицевой счёт</small><strong><span id="home-balance">0.00</span> SILARUM</strong></span>
                <span class="balance-extra"><small>Вращения</small><strong id="home-free-spins">0</strong></span>
                <span class="balance-arrow" aria-hidden="true">›</span>
            </button>
        `);

        content.querySelector('.daily-hero')?.classList.add('daily-hero--v4');
        const featureGrid = content.querySelector('.feature-grid');
        featureGrid?.classList.add('feature-grid--v4');
        const tarotSmall = document.querySelector('#go-tarot small');
        if (tarotSmall) tarotSmall.textContent = 'Семь раскладов для разных ситуаций';

        featureGrid?.insertAdjacentHTML('afterend', `
            <section class="v4-section">
                <div class="section-heading section-heading--compact">
                    <div><p class="eyebrow">Зеркало образа</p><h2>Что подскажет фотография?</h2></div>
                </div>
                <div class="ritual-grid">
                    <button id="go-photo-energy" class="ritual-tile ritual-tile--moon" type="button">
                        <span class="ritual-tile-icon" aria-hidden="true">◐</span>
                        <span><strong>Энергетический след</strong><small>Что беспокоит и где вернуть опору</small></span>
                    </button>
                    <button id="go-photo-compat" class="ritual-tile ritual-tile--rose" type="button">
                        <span class="ritual-tile-icon" aria-hidden="true">∞</span>
                        <span><strong>Совместимость по фото</strong><small>Символическая динамика двух образов</small></span>
                    </button>
                </div>
            </section>
            <section class="v4-section">
                <div class="section-heading section-heading--compact">
                    <div><p class="eyebrow">Глубже</p><h2>Другие пространства</h2></div>
                </div>
                <div class="service-list glass-card">
                    <button id="go-spreads" type="button"><span class="service-glyph">◈</span><span><strong>Каталог раскладов</strong><small>От одной карты до Кельтского креста</small></span><b>›</b></button>
                    <button id="go-palmlink" type="button"><span class="service-glyph">⌁</span><span><strong>PalmLink</strong><small>Профиль ладони и поиск близких по духу</small></span><b>›</b></button>
                    <button id="go-support" type="button"><span class="service-glyph">✧</span><span><strong>Спросить Эзотериума</strong><small>Помощь по приложению и услугам</small></span><b>›</b></button>
                </div>
            </section>
        `);

        const intro = document.getElementById('watch-intro');
        if (intro) {
            intro.querySelector('strong').textContent = 'Послание Эзотериума';
            intro.querySelector('small').textContent = 'Короткое приветствие мага перед ритуалом';
        }

        document.getElementById('home-wallet-card')?.addEventListener('click', () => navigate('wallet-screen'));
        document.getElementById('go-photo-energy')?.addEventListener('click', () => openPhotoLab('energy'));
        document.getElementById('go-photo-compat')?.addEventListener('click', () => openPhotoLab('compatibility'));
        document.getElementById('go-spreads')?.addEventListener('click', () => navigate('spreads-screen'));
        document.getElementById('go-palmlink')?.addEventListener('click', () => navigate('palmlink-screen'));
        document.getElementById('go-support')?.addEventListener('click', () => navigate('support-screen'));
    }

    function decorateTarot() {
        const inputScreen = document.querySelector('#tarot-input-screen .screen-content');
        if (!inputScreen || document.getElementById('tarot-spread-select')) return;
        const helper = inputScreen.querySelector('.helper-copy');
        helper?.insertAdjacentHTML('afterend', `
            <div class="spread-selector glass-card">
                <label for="tarot-spread-select"><span class="card-label">Вид расклада</span></label>
                <select id="tarot-spread-select">
                    <option value="three-paths" data-count="3">Три пути — прошлое, настоящее, следующий шаг</option>
                    <option value="one-sign" data-count="1">Один знак — краткий ответ</option>
                    <option value="decision" data-count="4">Перекрёсток — выбор между вариантами</option>
                    <option value="relationship" data-count="6">Два сердца — динамика отношений</option>
                    <option value="career" data-count="5">Путь предназначения — работа и развитие</option>
                    <option value="shadow" data-count="3">Тень и ресурс — скрытая тема ситуации</option>
                    <option value="celtic-cross" data-count="10">Кельтский крест — глубокий разбор</option>
                </select>
                <p id="spread-description">Три карты покажут истоки ситуации, её настоящее и наиболее полезное направление.</p>
            </div>
        `);
        const select = document.getElementById('tarot-spread-select');
        select.addEventListener('change', updateSpreadDescription);
        updateSpreadDescription();

        document.querySelector('#tarot-cards-screen .screen-content')?.insertAdjacentHTML('beforeend', '<div class="ritual-floor" aria-hidden="true"><i></i><i></i><i></i></div>');
    }

    function updateSpreadDescription() {
        const select = document.getElementById('tarot-spread-select');
        const description = document.getElementById('spread-description');
        if (!select || !description) return;
        const descriptions = {
            'one-sign': 'Одна карта даст ясный символический фокус без лишних деталей.',
            'three-paths': 'Три карты покажут истоки ситуации, её настоящее и наиболее полезное направление.',
            decision: 'Четыре карты сравнят варианты, риски и внутреннюю цену выбора.',
            relationship: 'Шесть карт раскроют вклад каждого, притяжение, напряжение и путь к диалогу.',
            career: 'Пять карт покажут ресурс, препятствие, талант, действие и перспективу развития.',
            shadow: 'Три карты помогут заметить скрытый страх, его ресурс и способ вернуть себе выбор.',
            'celtic-cross': 'Десять карт дадут глубокую картину влияний, надежд, препятствий и направления.'
        };
        description.textContent = descriptions[select.value] || descriptions['three-paths'];
    }

    function injectScreens() {
        if (document.getElementById('spreads-screen')) return;
        app.insertAdjacentHTML('beforeend', `
            <section id="spreads-screen" class="screen app-screen v4-screen" aria-labelledby="spreads-title">
                <div class="screen-content">
                    <header class="topbar"><button class="icon-btn v4-back" type="button">←</button><div><p class="eyebrow">Колода Эзотериума</p><h1 id="spreads-title" class="screen-title">Каталог раскладов</h1></div><span class="topbar-spacer"></span></header>
                    <div class="spread-catalog">
                        ${spreadCard('one-sign', '1', 'Один знак', 'Краткий фокус на вопросе', 'Быстро')}
                        ${spreadCard('three-paths', '3', 'Три пути', 'Истоки, настоящее и следующий шаг', 'Главный')}
                        ${spreadCard('decision', '4', 'Перекрёсток', 'Сравнение вариантов и цены выбора', 'Решение')}
                        ${spreadCard('career', '5', 'Путь предназначения', 'Работа, талант и развитие', 'Путь')}
                        ${spreadCard('relationship', '6', 'Два сердца', 'Глубокая динамика отношений', 'Союз')}
                        ${spreadCard('shadow', '3', 'Тень и ресурс', 'Скрытая тема и возвращение опоры', 'Глубина')}
                        ${spreadCard('celtic-cross', '10', 'Кельтский крест', 'Полная картина ситуации', 'Большой')}
                    </div>
                </div>
            </section>

            <section id="photo-lab-screen" class="screen app-screen v4-screen" aria-labelledby="photo-lab-title">
                <div class="screen-content">
                    <header class="topbar"><button class="icon-btn v4-back" type="button">←</button><div><p class="eyebrow">Зеркало образа</p><h1 id="photo-lab-title" class="screen-title">Чтение по фотографии</h1></div><span class="topbar-spacer"></span></header>
                    <div class="mode-switch glass-card" role="tablist">
                        <button type="button" class="active" data-photo-mode="energy">Энергетический след</button>
                        <button type="button" data-photo-mode="compatibility">Совместимость</button>
                    </div>
                    <div class="photo-intro glass-card"><span class="photo-intro-glyph">◐</span><p id="photo-intro-copy">Загрузите ясную фотографию и опишите, что вас беспокоит. Эзотериум даст символическое чтение, безопасный ритуал-настройку и совет, чего сейчас лучше избегать.</p></div>
                    <form id="photo-reading-form">
                        <div class="photo-upload-grid">
                            <label class="photo-upload" id="photo-upload-one"><input id="photo-input-one" type="file" accept="image/jpeg,image/png,image/webp" hidden><span class="photo-preview" id="photo-preview-one"><b>＋</b><small>Первое фото</small></span></label>
                            <label class="photo-upload" id="photo-upload-two" hidden><input id="photo-input-two" type="file" accept="image/jpeg,image/png,image/webp" hidden><span class="photo-preview" id="photo-preview-two"><b>＋</b><small>Второе фото</small></span></label>
                        </div>
                        <div id="photo-names" class="two-fields" hidden><label>Первый человек<input id="photo-name-one" maxlength="50" placeholder="Имя"></label><label>Второй человек<input id="photo-name-two" maxlength="50" placeholder="Имя"></label></div>
                        <label class="field-label" for="photo-concern">Что вас беспокоит или какой вопрос важен?</label>
                        <textarea id="photo-concern" maxlength="700" placeholder="Опишите ситуацию своими словами"></textarea>
                        <label class="consent-row glass-card"><input id="photo-consent" type="checkbox"><span><strong>У меня есть право использовать эти фотографии</strong><small>Не загружайте документы, интимные снимки и фотографии детей.</small></span></label>
                        <button id="photo-submit" class="primary-btn" type="submit"><span>Открыть чтение</span><span>✦</span></button>
                    </form>
                    <article id="photo-result-card" class="reading-card glass-card photo-result" hidden>
                        <p class="card-label">Послание Эзотериума</p><h2 id="photo-result-title">Символическое чтение</h2>
                        <div id="photo-result-text" class="reading-copy"></div>
                        <div class="action-row"><button id="save-photo-reading" class="secondary-btn" type="button">＋ В дневник</button><button id="share-photo-reading" class="icon-action" type="button">↗</button></div>
                    </article>
                    <p class="fine-print">Чтение не подтверждает наличие «порчи», болезни или скрытого воздействия. Это символический способ осмыслить переживания и вернуть ощущение опоры.</p>
                </div>
            </section>

            <section id="support-screen" class="screen app-screen v4-screen" aria-labelledby="support-title">
                <div class="screen-content support-layout">
                    <header class="topbar"><button class="icon-btn v4-back" type="button">←</button><div><p class="eyebrow">Круг Эзотериума</p><h1 id="support-title" class="screen-title">Спросить проводника</h1></div><span class="online-sigil" title="Доступен">✦</span></header>
                    <div class="guide-profile glass-card"><div class="guide-avatar">E</div><div><strong>Эзотериум</strong><small>Маг и проводник по Nastardamus</small></div></div>
                    <div id="support-messages" class="support-messages" aria-live="polite"></div>
                    <form id="support-form" class="support-composer glass-card"><textarea id="support-message" rows="1" maxlength="2000" placeholder="Напишите вопрос..."></textarea><button type="submit" aria-label="Отправить">↑</button></form>
                    <p class="support-disclosure">Ответы Эзотериума формируются автоматически. При необходимости к разговору подключается оператор, отмеченный отдельно.</p>
                </div>
            </section>

            <section id="palmlink-screen" class="screen app-screen v4-screen" aria-labelledby="palmlink-title">
                <div class="screen-content">
                    <header class="topbar"><button class="icon-btn v4-back" type="button">←</button><div><p class="eyebrow">Линии встречи</p><h1 id="palmlink-title" class="screen-title">PalmLink</h1></div><span class="topbar-spacer"></span></header>
                    <div class="palmlink-hero glass-card"><div class="palm-orbit" aria-hidden="true">⌁</div><h2>Найдите близкого по духу</h2><p>Создайте добровольный профиль ладони для дружбы, любви, общения или совместного дела. Точное местоположение скрыто.</p></div>
                    <form id="palmlink-form" class="palmlink-form">
                        <label class="photo-upload palm-upload"><input id="palm-photo" type="file" accept="image/jpeg,image/png,image/webp" hidden><span class="photo-preview" id="palm-preview"><b>⌁</b><small>Добавить фото ладони</small></span></label>
                        <div class="two-fields"><label>Возраст<input id="palm-age" type="number" min="18" max="99" placeholder="18+"></label><label>Город<input id="palm-city" maxlength="80" placeholder="Город"></label></div>
                        <label>Цель знакомства<select id="palm-intent"><option value="friendship">Дружба</option><option value="love">Любовь</option><option value="communication">Общение</option><option value="business">Деловой или творческий партнёр</option></select></label>
                        <label>О себе<textarea id="palm-bio" maxlength="600" placeholder="Интересы, ценности, кого вы хотите встретить"></textarea></label>
                        <label class="consent-row glass-card"><input id="palm-consent" type="checkbox"><span><strong>Мне исполнилось 18 лет, и я согласен на обработку профиля</strong><small>Фото ладони не используется для установления личности.</small></span></label>
                        <button class="primary-btn" type="submit">Сохранить профиль</button>
                    </form>
                    <article id="palm-profile-card" class="reading-card glass-card" hidden><p class="card-label">Профиль создан</p><h2>Ожидается проверка</h2><p id="palm-profile-copy" class="reading-copy"></p><button id="edit-palm-profile" class="secondary-btn" type="button">Изменить профиль</button></article>
                </div>
            </section>
        `);

        document.querySelectorAll('.v4-back').forEach((button) => button.addEventListener('click', () => navigate('menu-screen')));
        bindInjectedScreens();
    }

    function spreadCard(value, count, title, description, badge) {
        return `<button class="spread-catalog-card glass-card" type="button" data-spread-choice="${value}"><span class="spread-number">${count}</span><span><small>${badge}</small><strong>${title}</strong><p>${description}</p></span><b>›</b></button>`;
    }

    function bindInjectedScreens() {
        document.querySelectorAll('[data-spread-choice]').forEach((button) => {
            button.addEventListener('click', () => {
                const select = document.getElementById('tarot-spread-select');
                if (select) {
                    select.value = button.dataset.spreadChoice;
                    updateSpreadDescription();
                }
                pulse();
                navigate('tarot-input-screen');
            });
        });
        document.querySelectorAll('[data-photo-mode]').forEach((button) => button.addEventListener('click', () => setPhotoMode(button.dataset.photoMode)));
        document.getElementById('photo-input-one')?.addEventListener('change', (event) => loadPhoto(event.target.files?.[0], 1));
        document.getElementById('photo-input-two')?.addEventListener('change', (event) => loadPhoto(event.target.files?.[0], 2));
        document.getElementById('photo-reading-form')?.addEventListener('submit', submitPhotoReading);
        document.getElementById('save-photo-reading')?.addEventListener('click', savePhotoReading);
        document.getElementById('share-photo-reading')?.addEventListener('click', sharePhotoReading);
        document.getElementById('support-form')?.addEventListener('submit', submitSupportMessage);
        document.getElementById('palmlink-form')?.addEventListener('submit', savePalmProfile);
        document.getElementById('palm-photo')?.addEventListener('change', (event) => loadPalmPhoto(event.target.files?.[0]));
        document.getElementById('edit-palm-profile')?.addEventListener('click', () => {
            document.getElementById('palmlink-form').hidden = false;
            document.getElementById('palm-profile-card').hidden = true;
        });
    }

    function decorateWallet() {
        const screen = document.querySelector('#wallet-screen .screen-content');
        if (!screen || document.getElementById('wallet-balance-card')) return;
        const title = document.getElementById('profile-title');
        if (title) title.textContent = 'Профиль и счёт';
        const profile = screen.querySelector('.profile-hero');
        profile?.insertAdjacentHTML('afterend', `
            <section id="wallet-balance-card" class="wallet-balance-card glass-card">
                <div class="wallet-heading"><div><p class="card-label">Лицевой счёт SILARUM</p><strong><span id="wallet-balance">0.00</span> <small>SILARUM</small></strong></div><span class="wallet-coin">S</span></div>
                <div class="wallet-meta"><span><small>Доступно</small><b id="wallet-available">0.00</b></span><span><small>Вращения</small><b id="wallet-spins">0</b></span><span><small>Курс</small><b>1 = 1 USDT</b></span></div>
                <div class="wallet-actions"><button id="wallet-topup" type="button">Пополнить</button><button id="wallet-exchange" type="button">Обменять</button></div>
            </section>
            <section class="wallet-history glass-card"><div class="wallet-history-head"><div><p class="card-label">История</p><h2>Операции счёта</h2></div></div><div id="wallet-transactions" class="wallet-transactions"></div></section>
        `);
        const oldSettings = screen.querySelector('.settings-list');
        if (oldSettings) {
            oldSettings.innerHTML = `
                <div><span aria-hidden="true">◇</span><p><strong>Безопасный финансовый контур</strong><small>Начисления, покупки и вывод будут проводиться только сервером и записываться в журнал операций.</small></p></div>
                <div><span aria-hidden="true">♢</span><p><strong>Комиссия видна до подтверждения</strong><small>Сумма к получению и сетевые расходы показываются заранее.</small></p></div>`;
        }
        document.getElementById('wallet-topup')?.addEventListener('click', () => notify('Пополнение станет доступно после подключения платёжного провайдера'));
        document.getElementById('wallet-exchange')?.addEventListener('click', () => notify('Обмен пока закрыт до завершения безопасного платёжного контура'));
    }

    function renderWallet() {
        const wallet = readJSON(STORAGE.wallet, { balance: 0, available: 0, freeSpins: 0, transactions: [] });
        const value = Number(wallet.balance || 0).toFixed(2);
        const available = Number(wallet.available ?? wallet.balance ?? 0).toFixed(2);
        document.getElementById('home-balance')?.replaceChildren(document.createTextNode(value));
        document.getElementById('home-free-spins')?.replaceChildren(document.createTextNode(String(wallet.freeSpins || 0)));
        document.getElementById('wallet-balance')?.replaceChildren(document.createTextNode(value));
        document.getElementById('wallet-available')?.replaceChildren(document.createTextNode(available));
        document.getElementById('wallet-spins')?.replaceChildren(document.createTextNode(String(wallet.freeSpins || 0)));
        const list = document.getElementById('wallet-transactions');
        if (!list) return;
        list.replaceChildren();
        if (!Array.isArray(wallet.transactions) || wallet.transactions.length === 0) {
            list.innerHTML = '<div class="wallet-empty"><span>◇</span><p><strong>Операций пока нет</strong><small>Здесь появятся покупки услуг, призы и заявки на обмен.</small></p></div>';
            return;
        }
        wallet.transactions.slice(0, 20).forEach((entry) => {
            const row = document.createElement('div');
            row.className = 'wallet-transaction';
            row.innerHTML = `<span>${entry.icon || '◇'}</span><p><strong>${escapeHTML(entry.title || 'Операция')}</strong><small>${escapeHTML(entry.date || '')}</small></p><b class="${Number(entry.amount) >= 0 ? 'positive' : ''}">${Number(entry.amount) >= 0 ? '+' : ''}${Number(entry.amount).toFixed(2)}</b>`;
            list.appendChild(row);
        });
    }

    function setPhotoMode(mode) {
        currentPhotoMode = mode === 'compatibility' ? 'compatibility' : 'energy';
        document.querySelectorAll('[data-photo-mode]').forEach((button) => button.classList.toggle('active', button.dataset.photoMode === currentPhotoMode));
        const second = document.getElementById('photo-upload-two');
        const names = document.getElementById('photo-names');
        const copy = document.getElementById('photo-intro-copy');
        second.hidden = currentPhotoMode !== 'compatibility';
        names.hidden = currentPhotoMode !== 'compatibility';
        copy.textContent = currentPhotoMode === 'compatibility'
            ? 'Загрузите две фотографии. Эзотериум опишет символическую динамику образов, точки притяжения, напряжения и бережный путь к диалогу.'
            : 'Загрузите ясную фотографию и опишите, что вас беспокоит. Эзотериум даст символическое чтение, безопасный ритуал-настройку и совет, чего сейчас лучше избегать.';
        document.getElementById('photo-result-card').hidden = true;
    }

    function openPhotoLab(mode) {
        setPhotoMode(mode);
        navigate('photo-lab-screen');
    }

    async function loadPhoto(file, index) {
        if (!file) return;
        try {
            const dataUrl = await compressImage(file, 1024, 0.82);
            if (index === 1) photoOne = dataUrl;
            else photoTwo = dataUrl;
            const preview = document.getElementById(index === 1 ? 'photo-preview-one' : 'photo-preview-two');
            preview.style.backgroundImage = `url(${JSON.stringify(dataUrl)})`;
            preview.classList.add('has-image');
            preview.innerHTML = '<span class="photo-ready">✓</span><small>Фото загружено</small>';
            pulse('medium');
        } catch (error) {
            console.error(error);
            notify('Не удалось обработать фото. Используйте JPG, PNG или WEBP');
        }
    }

    async function compressImage(file, maxSide, quality) {
        if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) throw new Error('unsupported_image');
        if (file.size > 12 * 1024 * 1024) throw new Error('image_too_large');
        const source = await fileToDataURL(file);
        const image = await loadImage(source);
        const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
        const width = Math.max(1, Math.round(image.naturalWidth * scale));
        const height = Math.max(1, Math.round(image.naturalHeight * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d', { alpha: false });
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);
        return canvas.toDataURL('image/jpeg', quality);
    }

    function fileToDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    function loadImage(source) {
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = reject;
            image.src = source;
        });
    }

    async function submitPhotoReading(event) {
        event.preventDefault();
        const consent = document.getElementById('photo-consent').checked;
        if (!photoOne || (currentPhotoMode === 'compatibility' && !photoTwo)) {
            notify(currentPhotoMode === 'compatibility' ? 'Загрузите две фотографии' : 'Загрузите фотографию');
            return;
        }
        if (!consent) {
            notify('Подтвердите право использовать фотографии');
            return;
        }
        const concern = document.getElementById('photo-concern').value.trim() || 'Что сейчас важно понять и где вернуть опору?';
        const button = document.getElementById('photo-submit');
        const resultCard = document.getElementById('photo-result-card');
        const resultText = document.getElementById('photo-result-text');
        const title = document.getElementById('photo-result-title');
        button.disabled = true;
        button.querySelector('span').textContent = 'Эзотериум читает образ...';
        resultCard.hidden = false;
        resultText.classList.add('is-loading');
        resultText.textContent = 'Собираем символы, настроение и безопасные ориентиры...';
        title.textContent = currentPhotoMode === 'compatibility' ? 'Динамика двух образов' : 'Энергетический след';
        try {
            const payload = currentPhotoMode === 'compatibility'
                ? { concern, firstName: document.getElementById('photo-name-one').value.trim(), secondName: document.getElementById('photo-name-two').value.trim(), firstImage: photoOne, secondImage: photoTwo }
                : { concern, image: photoOne };
            const answer = await requestSymbolicReading(currentPhotoMode === 'compatibility' ? 'photo_compatibility' : 'photo_energy', payload);
            const body = answer || 'Связь с пространством прервалась. Повторите чтение немного позже.';
            resultText.textContent = body;
            currentPhotoReading = {
                id: uniqueId('photo'),
                type: currentPhotoMode === 'compatibility' ? 'Совместимость по фото' : 'Энергетический след',
                title: concern,
                body,
                cards: [],
                createdAt: new Date().toISOString(),
                favorite: false
            };
            pulse('medium');
            resultCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (error) {
            console.error(error);
            resultText.textContent = 'Не удалось завершить чтение. Проверьте соединение и попробуйте ещё раз.';
        } finally {
            resultText.classList.remove('is-loading');
            button.disabled = false;
            button.querySelector('span').textContent = 'Открыть чтение';
        }
    }

    async function requestSymbolicReading(feature, payload) {
        const response = await fetch('/api/proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': tg?.initData || '' },
            body: JSON.stringify({ feature, payload })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            if (response.status === 401) throw new Error('telegram_required');
            throw new Error(data.error || 'reading_failed');
        }
        return typeof data.answer === 'string' ? data.answer : '';
    }

    function savePhotoReading() {
        if (!currentPhotoReading) return notify('Сначала завершите чтение');
        if (typeof window.saveReading === 'function') window.saveReading(currentPhotoReading);
        else notify('Сохранено');
    }

    async function sharePhotoReading() {
        if (!currentPhotoReading) return notify('Сначала завершите чтение');
        if (typeof window.shareReading === 'function') return window.shareReading(currentPhotoReading);
        await navigator.clipboard?.writeText?.(`${currentPhotoReading.title}\n\n${currentPhotoReading.body}`);
        notify('Текст скопирован');
    }

    function getSupportHistory() {
        const stored = readJSON(STORAGE.support, []);
        if (Array.isArray(stored) && stored.length) return stored.slice(-30);
        return [{ role: 'assistant', content: 'Я Эзотериум. Помогу разобраться с разделами, раскладами, дневником и правилами сервиса. Ответы формируются автоматически; сложный вопрос я передам оператору.' }];
    }

    function renderSupport() {
        const list = document.getElementById('support-messages');
        if (!list) return;
        const history = getSupportHistory();
        list.replaceChildren();
        history.forEach((message) => {
            const bubble = document.createElement('div');
            bubble.className = `support-bubble support-bubble--${message.role === 'user' ? 'user' : 'guide'}`;
            const label = document.createElement('small');
            label.textContent = message.role === 'user' ? 'Вы' : message.operator ? 'Оператор' : 'Эзотериум';
            const text = document.createElement('p');
            text.textContent = message.content;
            bubble.append(label, text);
            list.appendChild(bubble);
        });
        requestAnimationFrame(() => { list.scrollTop = list.scrollHeight; });
    }

    async function submitSupportMessage(event) {
        event.preventDefault();
        if (supportBusy) return;
        const field = document.getElementById('support-message');
        const message = field.value.trim();
        if (!message) return;
        const history = getSupportHistory();
        history.push({ role: 'user', content: message });
        writeJSON(STORAGE.support, history.slice(-30));
        field.value = '';
        renderSupport();
        supportBusy = true;
        const waiting = { role: 'assistant', content: 'Смотрю ваш вопрос…', pending: true };
        history.push(waiting);
        renderTransientSupport(history);
        try {
            const response = await fetch('/api/assistant', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': tg?.initData || '' },
                body: JSON.stringify({ agent: 'support-guide', message, history: history.filter((item) => !item.pending).slice(-10) })
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || 'assistant_failed');
            const saved = getSupportHistory();
            saved.push({ role: 'assistant', content: data.answer || 'Я передал вопрос оператору.', handoff: Boolean(data.handoff) });
            if (data.handoff) saved.push({ role: 'assistant', content: 'Вопрос отмечен для оператора поддержки. Ответ сотрудника будет подписан как «Оператор».', system: true });
            writeJSON(STORAGE.support, saved.slice(-30));
            renderSupport();
            pulse();
        } catch (error) {
            console.error(error);
            const saved = getSupportHistory();
            saved.push({ role: 'assistant', content: 'Сейчас не удаётся получить ответ. Вопрос можно повторить позже или передать оператору поддержки.' });
            writeJSON(STORAGE.support, saved.slice(-30));
            renderSupport();
        } finally {
            supportBusy = false;
        }
    }

    function renderTransientSupport(history) {
        const list = document.getElementById('support-messages');
        if (!list) return;
        list.replaceChildren();
        history.forEach((message) => {
            const bubble = document.createElement('div');
            bubble.className = `support-bubble support-bubble--${message.role === 'user' ? 'user' : 'guide'}${message.pending ? ' pending' : ''}`;
            bubble.innerHTML = `<small>${message.role === 'user' ? 'Вы' : 'Эзотериум'}</small><p>${escapeHTML(message.content)}</p>`;
            list.appendChild(bubble);
        });
        list.scrollTop = list.scrollHeight;
    }

    async function loadPalmPhoto(file) {
        if (!file) return;
        try {
            const image = await compressImage(file, 1024, 0.82);
            const profile = readJSON(STORAGE.palm, {});
            profile.image = image;
            writeJSON(STORAGE.palm, profile);
            const preview = document.getElementById('palm-preview');
            preview.style.backgroundImage = `url(${JSON.stringify(image)})`;
            preview.classList.add('has-image');
            preview.innerHTML = '<span class="photo-ready">✓</span><small>Ладонь загружена</small>';
        } catch {
            notify('Не удалось обработать фото ладони');
        }
    }

    function savePalmProfile(event) {
        event.preventDefault();
        const current = readJSON(STORAGE.palm, {});
        const age = Number(document.getElementById('palm-age').value);
        const city = document.getElementById('palm-city').value.trim();
        const bio = document.getElementById('palm-bio').value.trim();
        const consent = document.getElementById('palm-consent').checked;
        if (!current.image) return notify('Добавьте фото ладони');
        if (!Number.isInteger(age) || age < 18) return notify('PalmLink доступен только с 18 лет');
        if (!city) return notify('Укажите город');
        if (!consent) return notify('Подтвердите согласие на создание профиля');
        const profile = { ...current, age, city, bio, intent: document.getElementById('palm-intent').value, status: 'review', updatedAt: new Date().toISOString() };
        writeJSON(STORAGE.palm, profile);
        pulse('medium');
        renderPalmProfile();
        notify('Профиль сохранён');
    }

    function renderPalmProfile() {
        const profile = readJSON(STORAGE.palm, null);
        const form = document.getElementById('palmlink-form');
        const card = document.getElementById('palm-profile-card');
        if (!form || !card) return;
        if (!profile?.status) {
            form.hidden = false;
            card.hidden = true;
            return;
        }
        form.hidden = true;
        card.hidden = false;
        document.getElementById('palm-profile-copy').textContent = `Цель: ${palmIntentLabel(profile.intent)}. Город: ${profile.city}. Профиль отправлен на проверку безопасности; точное местоположение и личные контакты другим пользователям не показываются.`;
    }

    function palmIntentLabel(value) {
        return ({ friendship: 'дружба', love: 'любовь', communication: 'общение', business: 'деловой или творческий партнёр' })[value] || 'общение';
    }

    function uniqueId(prefix) {
        return `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
    }

    function escapeHTML(value) {
        return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
    }

    function addWalletTab() {
        if (tabBar.querySelector('[data-nav-target="wallet-screen"]')) return;
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.navTarget = 'wallet-screen';
        button.innerHTML = '<span aria-hidden="true">S</span><small>Счёт</small>';
        button.addEventListener('click', (event) => {
            event.stopImmediatePropagation();
            pulse();
            navigate('wallet-screen');
        });
        tabBar.appendChild(button);
    }

    function improveVideo() {
        const video = document.getElementById('mage-video');
        if (!video) return;
        video.setAttribute('controls', '');
        video.removeAttribute('muted');
        const watch = document.getElementById('watch-intro');
        watch?.addEventListener('click', () => {
            setTimeout(() => {
                video.muted = false;
                video.volume = 1;
                video.play().catch(() => notify('Нажмите кнопку воспроизведения на видео'));
            }, 80);
        });
    }

    function init() {
        decorateWelcome();
        decorateHome();
        decorateTarot();
        injectScreens();
        decorateWallet();
        addWalletTab();
        improveVideo();
        renderWallet();
        document.body.classList.add('experience-v4');
    }

    init();
})();