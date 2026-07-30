import fs from 'node:fs';

const target = new URL('../api/admin.js', import.meta.url);
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

if (!files.page.body.includes('data-tab="content"')) {
  files.page.body = replaceOnce(
    files.page.body,
    '<button type="button" class="active" data-tab="overview">Настройки</button>',
    '<button type="button" class="active" data-tab="overview">Настройки</button>\n        <button type="button" data-tab="content">Таро и практики</button>',
    'content tab'
  );

  files.page.body = replaceOnce(
    files.page.body,
    '<span class="badge">1 SILARUM = 1 USDT</span>',
    '<span class="badge">1 SILARUM = 100 ₽</span>',
    'SILARUM badge'
  );

  files.page.body = replaceOnce(
    files.page.body,
    '<div class="service-price-row" data-service="palmlink"><label class="switch-row"><span><strong>Путь двух судеб</strong></span><input data-service-enabled type="checkbox" checked></label><label>Цена, SILARUM<input data-service-price type="number" min="0" step="0.01" placeholder="Не показывать"></label></div>',
    `<div class="service-price-row" data-service="palmlink"><label class="switch-row"><span><strong>Путь двух судеб</strong></span><input data-service-enabled type="checkbox" checked></label><label>Цена, SILARUM<input data-service-price type="number" min="0" step="0.01" placeholder="Не показывать"></label></div>
              <div class="service-price-row" data-service="compatibility"><label class="switch-row"><span><strong>Совместимость по данным</strong></span><input data-service-enabled type="checkbox" checked></label><label>Цена, SILARUM<input data-service-price type="number" min="0" step="0.01" placeholder="Не показывать"></label></div>
              <div class="service-price-row" data-service="palm_reading"><label class="switch-row"><span><strong>Чтение по ладони</strong></span><input data-service-enabled type="checkbox" checked></label><label>Цена, SILARUM<input data-service-price type="number" min="0" step="0.01" value="0"></label></div>
              <div class="service-price-row" data-service="rune_reading"><label class="switch-row"><span><strong>Руны</strong></span><input data-service-enabled type="checkbox" checked></label><label>Цена, SILARUM<input data-service-price type="number" min="0" step="0.01" value="0"></label></div>
              <div class="service-price-row" data-service="amur_compatibility"><label class="switch-row"><span><strong>Амур</strong></span><input data-service-enabled type="checkbox" checked></label><label>Цена, SILARUM<input data-service-price type="number" min="0" step="0.01" value="0"></label></div>`,
    'practice prices'
  );

  const contentPanel = `
      <section class="tab-panel" data-panel="content" hidden>
        <section class="card panel intro-panel">
          <p class="eyebrow">Каталог без изменений кода</p>
          <h2>Таро и совместимость</h2>
          <p>Меняйте названия, описания, позиции, порядок, бесплатные попытки, VIP-доступ и цену. После сохранения приложение получает новую конфигурацию с сервера.</p>
        </section>
        <form id="content-form">
          <section class="card panel">
            <div class="panel-head"><div><p class="eyebrow">12 раскладов</p><h2>Каталог Таро</h2></div><span class="badge violet">78 карт</span></div>
            <div id="tarot-editor-list" class="catalog-editor-list"></div>
          </section>
          <section class="card panel">
            <div class="panel-head"><div><p class="eyebrow">Амур</p><h2>Виды совместимости</h2></div><span class="badge rose">3 сценария</span></div>
            <div id="compatibility-editor-list" class="catalog-editor-list"></div>
          </section>
          <div class="save-bar">
            <div><strong>Публикация каталога</strong><small>Настройки применятся для новых запусков.</small></div>
            <button type="submit">Сохранить каталог</button>
          </div>
        </form>
      </section>

`;
  files.page.body = replaceOnce(
    files.page.body,
    '      <section class="tab-panel" data-panel="payments" hidden>',
    `${contentPanel}      <section class="tab-panel" data-panel="payments" hidden>`,
    'content panel'
  );
}

if (!files.css.body.includes('.catalog-editor-list')) {
  files.css.body += `.catalog-editor-list{display:grid;gap:12px}.catalog-editor{padding:16px;border:1px solid var(--line);border-radius:20px;background:rgba(7,5,15,.48)}.catalog-editor__head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}.catalog-editor__head strong{font-size:16px}.catalog-editor textarea{min-height:74px}.catalog-editor .three-cols{grid-template-columns:repeat(3,1fr)}@media(max-width:620px){.catalog-editor .three-cols{grid-template-columns:1fr}.catalog-editor__head{align-items:flex-start}}`;
}

if (!files.js.body.includes('const tarotContentDefinitions')) {
  const contentLogic = `
const tarotContentDefinitions = [
  ['card-of-day', 'Карта дня', 1],
  ['yes-no', 'Да или нет', 1],
  ['past-present-future', 'Прошлое · Настоящее · Будущее', 3],
  ['situation-obstacle-advice', 'Ситуация · Препятствие · Совет', 3],
  ['love-relationship', 'Любовь и отношения', 5],
  ['money-career', 'Деньги и карьера', 5],
  ['two-paths', 'Два пути', 5],
  ['pair-compatibility', 'Совместимость пары', 7],
  ['near-future', 'Ближайшее будущее', 7],
  ['shadow-side', 'Теневая сторона', 7],
  ['celtic-cross', 'Кельтский крест', 10],
  ['wheel-of-year', 'Колесо года', 12]
];
const compatibilityContentDefinitions = [
  ['data', 'По личным данным'],
  ['photo', 'По фотографиям'],
  ['palm', 'По ладоням']
];

function catalogAccessOptions(value) {
  const selectedValue = ({ public: 'optional', vip: 'included', vip_only: 'only' })[value] || value;
  return [
    ['optional', 'Для всех'],
    ['included', 'Включено в VIP'],
    ['only', 'Только VIP'],
    ['none', 'Без VIP-льгот']
  ].map(([id, title]) => \`<option value="\${id}"\${selectedValue === id ? ' selected' : ''}>\${title}</option>\`).join('');
}

function renderCatalogEditor(item, kind, fallbackTitle, fallbackCardCount = 1, index = 0) {
  const id = item?.id || '';
  const cardCount = Number(item?.cardCount || fallbackCardCount);
  const positions = Array.isArray(item?.positions) ? item.positions.join('\\n') : '';
  return \`<article class="catalog-editor" data-catalog-kind="\${kind}" data-catalog-id="\${escapeHtml(id)}">
    <div class="catalog-editor__head">
      <strong>\${escapeHtml(item?.title || fallbackTitle)}</strong>
      <label class="switch-row"><span><small>Показывать</small></span><input data-catalog-enabled type="checkbox"\${item?.enabled === false ? '' : ' checked'}></label>
    </div>
    <label>Название<input data-catalog-title maxlength="100" value="\${escapeHtml(item?.title || fallbackTitle)}"></label>
    <label>Короткое описание<textarea data-catalog-description maxlength="500">\${escapeHtml(item?.description || '')}</textarea></label>
    \${kind === 'tarot' ? \`<div class="two-cols"><label>Количество карт<input data-catalog-card-count type="number" min="1" max="12" value="\${cardCount}"></label><label>Позиции, по одной на строку<textarea data-catalog-positions maxlength="1000">\${escapeHtml(positions)}</textarea></label></div>\` : ''}
    <div class="three-cols">
      <label>Цена, SILARUM<input data-catalog-price type="number" min="0" step="0.01" value="\${item?.price ?? ''}"></label>
      <label>Бесплатных попыток<input data-catalog-free type="number" min="0" max="1000" value="\${Number(item?.freeChecks || 0)}"></label>
      <label>Доступ<select data-catalog-vip>\${catalogAccessOptions(item?.vipAccess || 'optional')}</select></label>
    </div>
    <label>Порядок<input data-catalog-order type="number" min="0" max="1000" value="\${Number(item?.displayOrder ?? index + 1)}"></label>
  </article>\`;
}

function renderContentSettings(settings = {}) {
  const tarotOverrides = new Map((settings.tarotCatalog || []).map((item) => [item.id, item]));
  const compatibilityOverrides = new Map((settings.compatibilityCatalog || []).map((item) => [item.id, item]));
  const tarotList = document.getElementById('tarot-editor-list');
  const compatibilityList = document.getElementById('compatibility-editor-list');
  if (tarotList) tarotList.innerHTML = tarotContentDefinitions.map(([id, title, count], index) => renderCatalogEditor({ id, ...tarotOverrides.get(id) }, 'tarot', title, count, index)).join('');
  if (compatibilityList) compatibilityList.innerHTML = compatibilityContentDefinitions.map(([id, title], index) => renderCatalogEditor({ id, ...compatibilityOverrides.get(id) }, 'compatibility', title, 1, index)).join('');
  disableForm(document.getElementById('content-form'), state.overview?.canManageSettings === false);
}

function collectContentCatalog(kind) {
  return [...document.querySelectorAll(\`[data-catalog-kind="\${kind}"]\`)].map((row) => {
    const rawPrice = row.querySelector('[data-catalog-price]').value.trim();
    const item = {
      id: row.dataset.catalogId,
      enabled: row.querySelector('[data-catalog-enabled]').checked,
      title: row.querySelector('[data-catalog-title]').value,
      description: row.querySelector('[data-catalog-description]').value,
      price: rawPrice === '' ? null : Number(rawPrice),
      freeChecks: Number(row.querySelector('[data-catalog-free]').value),
      vipAccess: row.querySelector('[data-catalog-vip]').value,
      displayOrder: Number(row.querySelector('[data-catalog-order]').value)
    };
    if (kind === 'tarot') {
      item.cardCount = Number(row.querySelector('[data-catalog-card-count]').value);
      item.positions = row.querySelector('[data-catalog-positions]').value.split('\\n').map((value) => value.trim()).filter(Boolean);
    }
    return item;
  });
}

document.getElementById('content-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    const result = await api('/api/admin', 'POST', {
      settings: {
        ...(state.overview?.settings || {}),
        tarotCatalog: collectContentCatalog('tarot'),
        compatibilityCatalog: collectContentCatalog('compatibility')
      }
    });
    if (!result.persisted) throw new Error('persistence_not_configured');
    state.overview.settings = result.settings;
    renderContentSettings(result.settings);
    notify('Каталог опубликован');
    tg?.HapticFeedback?.notificationOccurred?.('success');
  } catch (error) {
    notify(error.data?.error || 'Не удалось сохранить каталог');
    tg?.HapticFeedback?.notificationOccurred?.('error');
  } finally {
    button.disabled = false;
  }
});

`;
  files.js.body = replaceOnce(
    files.js.body,
    'async function boot() {',
    `${contentLogic}async function boot() {`,
    'content logic'
  );
  files.js.body = replaceOnce(
    files.js.body,
    '  values.wheelRewards = collectWheelRewards();',
    `  values.wheelRewards = collectWheelRewards();
  values.tarotCatalog = state.overview?.settings?.tarotCatalog || [];
  values.compatibilityCatalog = state.overview?.settings?.compatibilityCatalog || [];`,
    'catalog preservation'
  );
  files.js.body = replaceOnce(
    files.js.body,
    '    applySettings(state.overview.settings);',
    `    applySettings(state.overview.settings);
    renderContentSettings(state.overview.settings);`,
    'content boot'
  );
}

const oldAccessStart = files.js.body.indexOf('function catalogAccessOptions(value) {');
const oldAccessEnd = files.js.body.indexOf('\n\nfunction renderCatalogEditor', oldAccessStart);
if (oldAccessStart >= 0 && oldAccessEnd > oldAccessStart) {
  const accessFunction = `function catalogAccessOptions(value) {
  const selectedValue = ({ public: 'optional', vip: 'included', vip_only: 'only' })[value] || value;
  return [
    ['optional', 'Для всех'],
    ['included', 'Включено в VIP'],
    ['only', 'Только VIP'],
    ['none', 'Без VIP-льгот']
  ].map(([id, title]) => \`<option value="\${id}"\${selectedValue === id ? ' selected' : ''}>\${title}</option>\`).join('');
}`;
  files.js.body = `${files.js.body.slice(0, oldAccessStart)}${accessFunction}${files.js.body.slice(oldAccessEnd)}`;
}
files.js.body = files.js.body.replace(
  "catalogAccessOptions(item?.vipAccess || 'public')",
  "catalogAccessOptions(item?.vipAccess || 'optional')"
);

const replacement = `${prefix}${JSON.stringify(files, null, 2)}\n);`;
const updated = `${source.slice(0, source.indexOf(prefix))}${replacement}${source.slice(end + 3)}`;
fs.writeFileSync(target, updated);
