import fs from 'node:fs';

const target = new URL('../api/admin.js', import.meta.url);
const modernJs = fs.readFileSync(new URL('../admin-src/modern.js', import.meta.url), 'utf8');
const modernCss = fs.readFileSync(new URL('../admin-src/modern.css', import.meta.url), 'utf8');
const source = fs.readFileSync(target, 'utf8');
const prefix = 'const CONTROL_FILES = Object.freeze(';
const start = source.indexOf(prefix) + prefix.length;
const end = source.indexOf('\n);', start);
if (start < prefix.length || end < start) throw new Error('CONTROL_FILES not found');

const files = JSON.parse(source.slice(start, end));

function replaceOnce(value, search, replacement, label) {
  if (!value.includes(search)) throw new Error(`${label} anchor not found`);
  return value.replace(search, replacement);
}

if (!files.page.body.includes('data-admin-version="2"')) {
  files.page.body = replaceOnce(files.page.body, '<body>', '<body data-admin-version="2">', 'body version');
  files.page.body = replaceOnce(
    files.page.body,
    `    <header class="hero">
      <div>
        <p class="eyebrow">Nastardamus Control</p>
        <h1>Админ-панель</h1>
        <p id="admin-subtitle">Проверяем защищённый доступ…</p>
      </div>
      <div class="sigil" aria-hidden="true">✦</div>
    </header>`,
    `    <header class="hero admin-topbar">
      <div class="brand-lockup">
        <div class="brand-mark" aria-hidden="true">✦</div>
        <div><p class="eyebrow">Nastardamus Control</p><h1>Центр управления</h1></div>
      </div>
      <div class="admin-identity"><span class="live-dot" aria-hidden="true"></span><p id="admin-subtitle">Проверяем защищённый доступ…</p></div>
    </header>`,
    'top bar'
  );
  files.page.body = replaceOnce(
    files.page.body,
    `      <nav class="admin-tabs" aria-label="Разделы админ-панели">
        <button type="button" class="active" data-tab="overview">Настройки</button>
        <button type="button" data-tab="content">Таро и практики</button>
        <button type="button" data-tab="payments">Платежи</button>
        <button type="button" data-tab="team">Команда</button>
        <button type="button" data-tab="support">Поддержка</button>
        <button type="button" data-tab="ai">Центр ответов</button>
      </nav>`,
    `      <nav class="admin-tabs admin-sidebar" aria-label="Разделы админ-панели">
        <div class="sidebar-caption"><span>НАВИГАЦИЯ</span></div>
        <button type="button" class="active" data-tab="overview"><b>◈</b><span>Обзор</span></button>
        <button type="button" data-tab="users"><b>♙</b><span>Пользователи</span></button>
        <button type="button" data-tab="content"><b>✦</b><span>Контент</span></button>
        <button type="button" data-tab="payments"><b>◇</b><span>Монетизация</span></button>
        <button type="button" data-tab="growth"><b>↗</b><span>Рост</span></button>
        <button type="button" data-tab="support"><b>◌</b><span>Поддержка</span></button>
        <button type="button" data-tab="team"><b>♜</b><span>Команда</span></button>
        <button type="button" data-tab="ai"><b>⌁</b><span>Центр ответов</span></button>
        <button type="button" data-tab="audit"><b>≋</b><span>Журнал</span></button>
        <div class="sidebar-foot"><span class="live-dot"></span><small>Защищённая сессия</small></div>
      </nav>`,
    'navigation'
  );

  const dashboardPanels = `      <section class="tab-panel active" data-panel="overview">
        <div class="section-heading"><div><p class="eyebrow">Состояние Nastardamus</p><h2>Обзор системы</h2><p>Ключевые показатели, очереди и быстрые действия в одном месте.</p></div><button type="button" class="mini-button" id="refresh-overview-button">Обновить</button></div>
        <section id="overview-metrics" class="metric-grid" aria-live="polite">
          <article class="metric-card is-loading"></article><article class="metric-card is-loading"></article><article class="metric-card is-loading"></article><article class="metric-card is-loading"></article>
        </section>
        <div class="overview-columns">
          <section class="card panel command-card"><div class="panel-head"><div><p class="eyebrow">Быстрый доступ</p><h2>Рабочие зоны</h2></div></div><div class="command-grid"><button type="button" data-quick-tab="users"><span>Пользователи</span><small>Профили, VIP и услуги</small></button><button type="button" data-quick-tab="payments"><span>Монетизация</span><small>Платежи и баланс</small></button><button type="button" data-quick-tab="content"><span>Контент</span><small>Каталог практик</small></button><button type="button" data-quick-tab="audit"><span>Журнал</span><small>Все действия команды</small></button></div></section>
          <section class="card panel pulse-card"><div class="panel-head"><div><p class="eyebrow">Контроль</p><h2>Что требует внимания</h2></div></div><div id="overview-attention" class="attention-list"><p class="empty-state">Собираем состояние очередей…</p></div></section>
        </div>
      </section>

      <section class="tab-panel" data-panel="users" hidden>
        <div class="section-heading"><div><p class="eyebrow">Аудитория</p><h2>Пользователи</h2><p>Поиск, профиль, баланс, VIP, права на услуги и история активности.</p></div><span class="section-count" id="users-total">—</span></div>
        <form id="users-filter-form" class="card filter-bar">
          <label class="search-field"><span class="sr-only">Поиск пользователя</span><input name="search" maxlength="80" placeholder="Имя, @username или Telegram ID"><b aria-hidden="true">⌕</b></label>
          <label><span class="sr-only">Фильтр</span><select name="filter"><option value="all">Все пользователи</option><option value="vip">Активный VIP</option><option value="horoscope">Гороскоп включён</option><option value="complete">Анкета заполнена</option><option value="incomplete">Анкета не завершена</option></select></label>
          <button type="submit">Найти</button>
        </form>
        <section class="card user-table-card"><div class="user-table-head"><span>Пользователь</span><span>Доступ</span><span>Активность</span><span>Баланс</span></div><div id="users-list" class="users-list"><p class="empty-state">Загрузка пользователей…</p></div><div class="pagination"><button type="button" id="users-prev">←</button><span id="users-page">1 / 1</span><button type="button" id="users-next">→</button></div></section>
      </section>

      <section class="tab-panel" data-panel="settings" hidden>
        <div class="section-heading settings-heading"><div><p class="eyebrow">Управление</p><h2 id="settings-title">Экономика и цены</h2><p id="settings-copy">Тарифы, способы оплаты и правила экономики приложения.</p></div><button type="button" class="mini-button" data-quick-tab="payments">К платежам</button></div>
`;
  files.page.body = replaceOnce(
    files.page.body,
    '      <section class="tab-panel active" data-panel="overview">\n        <form id="settings-form">',
    `${dashboardPanels}        <form id="settings-form" data-mode="monetization">`,
    'dashboard panels'
  );

  const domainMap = [
    ['Оплата', 'monetization'],
    ['Экономика', 'monetization'],
    ['Каталог', 'monetization'],
    ['Подарки', 'growth'],
    ['Каждый день', 'growth'],
    ['Рост', 'growth'],
    ['Социальный контур', 'growth'],
    ['Безопасность', 'growth']
  ];
  for (const [eyebrow, domain] of domainMap) {
    files.page.body = replaceOnce(
      files.page.body,
      `<section class="card panel">\n            <div class="panel-head"><div><p class="eyebrow">${eyebrow}</p>`,
      `<section class="card panel" data-settings-domain="${domain}">\n            <div class="panel-head"><div><p class="eyebrow">${eyebrow}</p>`,
      `settings domain ${eyebrow}`
    );
  }

  files.page.body = replaceOnce(
    files.page.body,
    '<section class="tab-panel" data-panel="payments" hidden>\n        <section class="card panel intro-panel">',
    '<section class="tab-panel" data-panel="payments" hidden>\n        <div class="section-heading"><div><p class="eyebrow">Экономика</p><h2>Монетизация</h2><p>Платёжные подключения, очередь операций и корректировки баланса.</p></div><button type="button" class="mini-button" data-open-settings="monetization">Цены и тарифы</button></div>\n        <section class="card panel intro-panel">',
    'payments heading'
  );

  const auditPanel = `
      <section class="tab-panel" data-panel="audit" hidden>
        <div class="section-heading"><div><p class="eyebrow">Прозрачность</p><h2>Журнал действий</h2><p>Кто, когда и что изменил в защищённом контуре управления.</p></div><button type="button" class="mini-button" id="refresh-audit-button">Обновить</button></div>
        <section class="card audit-card"><div class="audit-head"><span>Время</span><span>Администратор</span><span>Действие</span><span>Детали</span></div><div id="audit-list" class="audit-list"><p class="empty-state">Загрузка журнала…</p></div></section>
      </section>
`;
  const dashboardEnd = files.page.body.lastIndexOf('    </div>\n  </main>');
  if (dashboardEnd < 0) throw new Error('dashboard end anchor not found');
  files.page.body = `${files.page.body.slice(0, dashboardEnd)}${auditPanel}${files.page.body.slice(dashboardEnd)}`;

  files.page.body = replaceOnce(
    files.page.body,
    '  <div id="toast" class="toast" role="status" aria-live="polite"></div>',
    `  <div id="user-drawer-backdrop" class="drawer-backdrop" hidden></div>
  <aside id="user-drawer" class="user-drawer" aria-label="Карточка пользователя" aria-hidden="true">
    <div class="drawer-head"><div><p class="eyebrow">Карточка пользователя</p><h2 id="drawer-title">Пользователь</h2></div><button type="button" class="icon-button" id="close-user-drawer" aria-label="Закрыть">×</button></div>
    <div id="user-drawer-body" class="drawer-body"><p class="empty-state">Выберите пользователя.</p></div>
  </aside>
  <div id="toast" class="toast" role="status" aria-live="polite"></div>`,
    'user drawer'
  );
}

if (!files.page.body.includes('data-tab="reconciliation"')) {
  files.page.body = replaceOnce(
    files.page.body,
    '<div class="sidebar-caption"><span>НАВИГАЦИЯ</span></div>',
    '<div class="sidebar-caption"><span>НАВИГАЦИЯ</span></div><button type="button" class="admin-back-button" id="admin-section-back" disabled><b>←</b><span>Назад</span></button>',
    'admin previous section button'
  );
  files.page.body = replaceOnce(
    files.page.body,
    '<button type="button" data-tab="content"><b>✦</b><span>Контент</span></button>',
    '<button type="button" data-tab="content"><b>✦</b><span>Контент</span></button><button type="button" data-tab="reconciliation"><b>⌁</b><span>Примирение</span></button>',
    'reconciliation navigation'
  );
  const reconciliationPanel = `
      <section class="tab-panel" data-panel="reconciliation" hidden>
        <div class="section-heading"><div><p class="eyebrow">Миротворец</p><h2>Примирение Эзотериума</h2><p>Цены, приглашения, лимиты и доступные инструменты раздела.</p></div><span class="badge violet">До 10 участников</span></div>
        <form id="reconciliation-settings-form" class="card panel reconciliation-admin-form">
          <label class="switch-row"><span><strong>Раздел включён</strong><small>Скрывает вход и блокирует новые комнаты, но не удаляет историю.</small></span><input name="enabled" type="checkbox"></label>
          <div class="two-cols"><label>Срок приглашения, часы<input name="invitationHours" type="number" min="1" max="720" step="1"></label><label>Максимум участников<input name="maxParticipants" type="number" min="3" max="10" step="1"></label></div>
          <h3>Цены, SILARUM</h3>
          <div class="reconciliation-price-grid">
            <label>Создание<input name="priceCreate" type="number" min="0" step="0.01"></label><label>Участие<input name="priceParticipate" type="number" min="0" step="0.01"></label><label>Группа<input name="priceGroup" type="number" min="0" step="0.01"></label><label>Руны<input name="priceRunes" type="number" min="0" step="0.01"></label><label>Таро<input name="priceTarot" type="number" min="0" step="0.01"></label><label>Ладони<input name="pricePalmistry" type="number" min="0" step="0.01"></label><label>Астрология<input name="priceAstrology" type="number" min="0" step="0.01"></label><label>Комбинированный<input name="priceCombined" type="number" min="0" step="0.01"></label><label>Открытка итога<input name="priceOutcomeCard" type="number" min="0" step="0.01"></label>
          </div>
          <h3>Инструменты в комнате</h3>
          <div class="reconciliation-tool-switches"><label class="switch-row"><span><strong>Руны</strong></span><input name="toolRunes" type="checkbox"></label><label class="switch-row"><span><strong>Таро</strong></span><input name="toolTarot" type="checkbox"></label><label class="switch-row"><span><strong>Хиромантия</strong></span><input name="toolPalmistry" type="checkbox"></label><label class="switch-row"><span><strong>Астрология</strong></span><input name="toolAstrology" type="checkbox"></label><label class="switch-row"><span><strong>Комбинированный анализ</strong></span><input name="toolCombined" type="checkbox"></label></div>
          <h3>Типы конфликтов</h3>
          <div class="reconciliation-conflict-types"><label><input type="checkbox" name="conflictTypes" value="romantic"> Романтический</label><label><input type="checkbox" name="conflictTypes" value="friendship"> Дружеский</label><label><input type="checkbox" name="conflictTypes" value="family"> Семейный</label><label><input type="checkbox" name="conflictTypes" value="business"> Деловой</label><label><input type="checkbox" name="conflictTypes" value="collective"> Коллективный</label><label><input type="checkbox" name="conflictTypes" value="other"> Другой</label></div>
          <label>Текст приглашения<textarea name="invitationText" maxlength="700" rows="4"></textarea><small>Доступна переменная {initiator}. Не добавляйте описание конфликта — открытка может быть переслана.</small></label>
          <label>Текст открытки об итоге<textarea name="outcomeText" maxlength="400" rows="3"></textarea></label>
          <div class="form-actions"><button type="submit">Сохранить настройки примирения</button></div>
        </form>
      </section>
`;
  const auditAnchor = '      <section class="tab-panel" data-panel="audit" hidden>';
  files.page.body = replaceOnce(files.page.body, auditAnchor, `${reconciliationPanel}\n${auditAnchor}`, 'reconciliation panel');
}

const modernMarker = '\n/* ADMIN MODERN V2 */\n';
files.css.body = `${files.css.body.split(modernMarker)[0]}${modernMarker}${modernCss}`;
files.js.body = `${files.js.body.split(modernMarker)[0]}${modernMarker}${modernJs}`;

const replacement = `${prefix}${JSON.stringify(files, null, 2)}\n);`;
const updated = `${source.slice(0, source.indexOf(prefix))}${replacement}${source.slice(end + 3)}`;
fs.writeFileSync(target, updated);
