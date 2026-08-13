const ADMIN_ACTION_LABELS = {
  admin_opened: 'Открыта админ-панель',
  settings_updated: 'Изменены настройки',
  user_delivery_updated: 'Изменена рассылка пользователя',
  user_vip_granted: 'Выдан или продлён VIP',
  user_vip_cancelled: 'Отменён VIP',
  user_entitlement_updated: 'Изменено право на услугу',
  user_daily_usage_reset: 'Сброшен дневной лимит',
  user_wallet_adjusted: 'Скорректирован баланс',
  sbp_topup_reviewed: 'Проверен платёж СБП',
  admin_created: 'Добавлен администратор',
  admin_updated: 'Изменён администратор',
  admin_deleted: 'Удалён администратор',
  ai_provider_created: 'Добавлено подключение API',
  ai_provider_updated: 'Изменено подключение API',
  ai_provider_deleted: 'Удалено подключение API',
  ai_agent_created: 'Создан проводник',
  ai_agent_updated: 'Изменён проводник',
  ai_agent_deleted: 'Удалён проводник'
};

const ADMIN_ZODIAC_LABELS = {
  aries: 'Овен', taurus: 'Телец', gemini: 'Близнецы', cancer: 'Рак',
  leo: 'Лев', virgo: 'Дева', libra: 'Весы', scorpio: 'Скорпион',
  sagittarius: 'Стрелец', capricorn: 'Козерог', aquarius: 'Водолей', pisces: 'Рыбы'
};

const modernState = {
  overview: null,
  users: [],
  pagination: { page: 1, pages: 1, total: 0, limit: 20 },
  userCapabilities: {},
  selectedUser: null,
  auditLoaded: false,
  campaigns: [],
  campaignsLoaded: false,
  currentTab: 'overview',
  tabHistory: [],
  suppressHistory: false,
  reconciliationLoaded: false,
  reconciliationOverview: null
};

function updateAdminBackButton() {
  const button = document.getElementById('admin-section-back');
  if (!button) return;
  button.disabled = modernState.tabHistory.length === 0;
  const previous = modernState.tabHistory.at(-1);
  button.title = previous ? `Вернуться в раздел «${previous}»` : 'Предыдущего раздела пока нет';
}

function reconciliationAdminDefaults() {
  return {
    enabled: true, invitationHours: 72, maxParticipants: 10,
    prices: { create: 10, participate: 5, group: 30, runes: 10, tarot: 10, palmistry: 15, astrology: 15, combined: 25, outcomeCard: 5 },
    tools: { runes: true, tarot: true, palmistry: true, astrology: true, combined: true },
    conflictTypes: ['romantic', 'friendship', 'family', 'business', 'collective', 'other'],
    invitationText: '{initiator} приглашает вас в комнату примирения. Эзотериум поможет услышать друг друга.',
    outcomeText: 'Мы завершили важный разговор вместе с Эзотериумом.'
  };
}

function fillReconciliationSettings(settings) {
  const form = document.getElementById('reconciliation-settings-form');
  if (!form) return;
  const value = { ...reconciliationAdminDefaults(), ...(settings || {}) };
  value.prices = { ...reconciliationAdminDefaults().prices, ...(settings?.prices || {}) };
  value.tools = { ...reconciliationAdminDefaults().tools, ...(settings?.tools || {}) };
  form.elements.enabled.checked = value.enabled !== false;
  form.elements.invitationHours.value = value.invitationHours;
  form.elements.maxParticipants.value = value.maxParticipants;
  for (const [field, key] of [['priceCreate','create'],['priceParticipate','participate'],['priceGroup','group'],['priceRunes','runes'],['priceTarot','tarot'],['pricePalmistry','palmistry'],['priceAstrology','astrology'],['priceCombined','combined'],['priceOutcomeCard','outcomeCard']]) {
    form.elements[field].value = Number(value.prices[key] ?? 0).toFixed(2);
  }
  for (const [field, key] of [['toolRunes','runes'],['toolTarot','tarot'],['toolPalmistry','palmistry'],['toolAstrology','astrology'],['toolCombined','combined']]) {
    form.elements[field].checked = value.tools[key] !== false;
  }
  const allowed = new Set(value.conflictTypes || []);
  form.querySelectorAll('input[name="conflictTypes"]').forEach((input) => { input.checked = allowed.has(input.value); });
  form.elements.invitationText.value = value.invitationText || '';
  form.elements.outcomeText.value = value.outcomeText || '';
}

async function loadReconciliationSettings() {
  const form = document.getElementById('reconciliation-settings-form');
  if (!form) return;
  form.classList.add('is-loading');
  try {
    const data = await api('/api/admin');
    modernState.reconciliationOverview = data;
    modernState.reconciliationLoaded = true;
    fillReconciliationSettings(data.settings?.reconciliation);
    form.querySelector('button[type="submit"]').disabled = data.canManageSettings !== true;
  } catch {
    notify('Не удалось загрузить настройки примирения');
  } finally { form.classList.remove('is-loading'); }
}

function collectReconciliationSettings(form) {
  return {
    enabled: form.elements.enabled.checked,
    invitationHours: Number(form.elements.invitationHours.value),
    maxParticipants: Number(form.elements.maxParticipants.value),
    prices: {
      create: Number(form.elements.priceCreate.value), participate: Number(form.elements.priceParticipate.value),
      group: Number(form.elements.priceGroup.value), runes: Number(form.elements.priceRunes.value),
      tarot: Number(form.elements.priceTarot.value), palmistry: Number(form.elements.pricePalmistry.value),
      astrology: Number(form.elements.priceAstrology.value), combined: Number(form.elements.priceCombined.value),
      outcomeCard: Number(form.elements.priceOutcomeCard.value)
    },
    tools: {
      runes: form.elements.toolRunes.checked, tarot: form.elements.toolTarot.checked,
      palmistry: form.elements.toolPalmistry.checked, astrology: form.elements.toolAstrology.checked,
      combined: form.elements.toolCombined.checked
    },
    conflictTypes: [...form.querySelectorAll('input[name="conflictTypes"]:checked')].map((input) => input.value),
    invitationText: form.elements.invitationText.value.trim(),
    outcomeText: form.elements.outcomeText.value.trim()
  };
}

function adminDate(value, withTime = true) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return escapeHtml(value);
  return date.toLocaleString('ru-RU', withTime
    ? { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: 'short', year: 'numeric' });
}

function adminSilarum(units) {
  return `${formatPaymentMoney(Number(units || 0) / 100)} SILARUM`;
}

function profileGender(value) {
  return ({ female: 'Женский', male: 'Мужской', unspecified: 'Не указан' })[value] || 'Не указан';
}

function initials(value) {
  const parts = String(value || 'П').trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toLocaleUpperCase('ru-RU') || '').join('') || 'П';
}

async function loadAdminOverview() {
  const mount = document.getElementById('overview-metrics');
  try {
    const data = await api('/api/admin?adminUsers=overview');
    modernState.overview = data;
    modernState.userCapabilities = data.capabilities || {};
    const metrics = data.metrics || {};
    const cards = [
      ['Пользователи', metrics.users ?? 0, `+${metrics.newUsers7d || 0} за 7 дней`],
      ['Заполненные анкеты', metrics.completedProfiles ?? 0, `${metrics.horoscopeEnabled || 0} получают гороскоп`],
      ['Активный VIP', metrics.activeVip ?? 0, 'действующих подписок'],
      ['Чтения', metrics.readings ?? 0, 'в истории пользователей'],
      ['Поддержка', metrics.openSupport ?? 0, 'открытых обращений'],
      ['Платежи в очереди', metrics.pendingPayments ?? '—', 'ожидают решения'],
      ['Баланс системы', metrics.walletBalanceUnits === undefined ? '—' : adminSilarum(metrics.walletBalanceUnits), 'на кошельках'],
      ['Начислено за 30 дней', metrics.paidUnits30d === undefined ? '—' : adminSilarum(metrics.paidUnits30d), 'положительные операции']
    ];
    if (mount) mount.innerHTML = cards.map(([label, value, note]) => `<article class="metric-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(note)}</small></article>`).join('');
    const attention = document.getElementById('overview-attention');
    if (attention) {
      const items = [
        ['Платежи на проверке', Number(metrics.pendingPayments || 0)],
        ['Обращения поддержки', Number(metrics.openSupport || 0)],
        ['Незавершённые анкеты', Math.max(0, Number(metrics.users || 0) - Number(metrics.completedProfiles || 0))]
      ];
      attention.innerHTML = items.map(([label, count]) => `<div class="attention-item ${count ? '' : 'ok'}"><span>${escapeHtml(label)}</span><b>${count ? `${count} требует внимания` : 'Порядок'}</b></div>`).join('');
    }
  } catch (error) {
    if (mount) mount.innerHTML = '<article class="metric-card"><span>Состояние</span><strong>Недоступно</strong><small>Повторите обновление</small></article>';
  }
}

function renderUsers() {
  const list = document.getElementById('users-list');
  const total = document.getElementById('users-total');
  const pageNode = document.getElementById('users-page');
  if (total) total.textContent = String(modernState.pagination.total || 0);
  if (pageNode) pageNode.textContent = `${modernState.pagination.page || 1} / ${modernState.pagination.pages || 1}`;
  const previous = document.getElementById('users-prev');
  const next = document.getElementById('users-next');
  if (previous) previous.disabled = modernState.pagination.page <= 1;
  if (next) next.disabled = modernState.pagination.page >= modernState.pagination.pages;
  if (!list) return;
  if (!modernState.users.length) {
    list.innerHTML = '<p class="empty-state">По заданным условиям пользователей нет.</p>';
    return;
  }
  const canViewFinance = modernState.userCapabilities.viewFinance === true;
  list.innerHTML = modernState.users.map((user) => {
    const tags = [
      user.vip ? '<span class="mini-tag vip">VIP</span>' : '',
      user.horoscopeEnabled ? '<span class="mini-tag">Гороскоп</span>' : '',
      user.profileCompleted ? '' : '<span class="mini-tag off">Анкета не завершена</span>'
    ].filter(Boolean).join('');
    const username = user.username ? `@${user.username}` : `ID ${user.telegramId}`;
    const sign = ADMIN_ZODIAC_LABELS[user.zodiacSign] || 'Знак не указан';
    return `<button type="button" class="user-row" data-user-id="${Number(user.telegramId)}">
      <span class="user-primary"><i class="user-avatar">${escapeHtml(initials(user.name))}</i><span><strong>${escapeHtml(user.name)}</strong><small>${escapeHtml(username)}${user.city ? ` · ${escapeHtml(user.city)}` : ''}</small></span></span>
      <span class="user-cell"><span class="user-tags">${tags || '<span class="mini-tag off">Базовый</span>'}</span><small>${escapeHtml(sign)}</small></span>
      <span class="user-cell"><span>${Number(user.readingCount || 0)} чтений</span><small>${adminDate(user.updatedAt)}</small></span>
      <span class="user-cell"><span>${canViewFinance ? adminSilarum(user.balanceUnits) : 'Скрыт'}</span><small>${user.vip ? `до ${adminDate(user.vip.expiresAt, false)}` : 'без VIP'}</small></span>
    </button>`;
  }).join('');
}

async function loadUsers(page = modernState.pagination.page || 1) {
  const form = document.getElementById('users-filter-form');
  const list = document.getElementById('users-list');
  if (list) list.innerHTML = '<p class="empty-state">Загрузка пользователей…</p>';
  const params = new URLSearchParams({
    view: 'list',
    page: String(page),
    limit: '20',
    search: form?.elements.search?.value?.trim() || '',
    filter: form?.elements.filter?.value || 'all'
  });
  try {
    const data = await api(`/api/admin?adminUsers=list&${params}`);
    modernState.users = data.users || [];
    modernState.pagination = data.pagination || modernState.pagination;
    modernState.userCapabilities = data.capabilities || modernState.userCapabilities;
    renderUsers();
  } catch (error) {
    if (error.status === 403) document.querySelector('[data-tab="users"]').hidden = true;
    if (list) list.innerHTML = '<p class="empty-state">Раздел пользователей временно недоступен.</p>';
  }
}

function activeVip(user) {
  return (user.vip || []).find((item) => item.status === 'active' && Date.parse(item.expires_at) > Date.now()) || null;
}

function detailTimeline(items, renderer, emptyText) {
  return items?.length ? items.map(renderer).join('') : `<p class="empty-state">${escapeHtml(emptyText)}</p>`;
}

function renderUserDrawer(user) {
  const body = document.getElementById('user-drawer-body');
  const title = document.getElementById('drawer-title');
  if (!body) return;
  const profile = user.profile || {};
  const name = profile.profile_name || profile.first_name || 'Пользователь';
  if (title) title.textContent = name;
  const vip = activeVip(user);
  const capabilities = modernState.userCapabilities;
  const wallet = user.wallet || null;
  const interests = Array.isArray(profile.interests) ? profile.interests.join(', ') : '';
  const goals = Array.isArray(profile.goals) ? profile.goals.join(', ') : '';
  const entitlementRows = detailTimeline(user.entitlements, (item) => `<div class="timeline-item"><span><strong>${escapeHtml(item.service_id)}</strong><small>обновлено ${adminDate(item.updated_at)}</small></span><span>${Number(item.quantity)} шт.</span></div>`, 'Дополнительных услуг нет.');
  const readingRows = detailTimeline(user.readings, (item) => `<div class="timeline-item"><span><strong>${escapeHtml(item.title || item.subtype)}</strong><small>${escapeHtml(item.kind)} · ${adminDate(item.created_at)}</small></span><span>${escapeHtml(item.state)}</span></div>`, 'История чтений пуста.');
  const ledgerRows = detailTimeline(user.ledger, (item) => `<div class="timeline-item"><span><strong>${escapeHtml(item.entry_type)}</strong><small>${adminDate(item.created_at)}</small></span><span class="${Number(item.amount_units) < 0 ? 'danger-text' : ''}">${adminSilarum(item.amount_units)}</span></div>`, 'Финансовых операций нет.');
  body.innerHTML = `
    <section class="drawer-section"><div class="profile-facts">
      <div class="profile-fact"><span>Telegram</span><strong>${profile.username ? `@${escapeHtml(profile.username)}` : `ID ${Number(profile.telegram_id)}`}</strong></div>
      <div class="profile-fact"><span>Анкета</span><strong>${profile.profile_completed_at ? 'Заполнена' : 'Не завершена'}</strong></div>
      <div class="profile-fact"><span>Пол</span><strong>${escapeHtml(profileGender(profile.gender))}</strong></div>
      <div class="profile-fact"><span>Дата рождения</span><strong>${escapeHtml(profile.birth_date || profile.birth_year || 'Не указана')}</strong></div>
      <div class="profile-fact"><span>Знак</span><strong>${escapeHtml(ADMIN_ZODIAC_LABELS[profile.zodiac_sign] || 'Не указан')}</strong></div>
      <div class="profile-fact"><span>Город и зона</span><strong>${escapeHtml([profile.city, profile.timezone].filter(Boolean).join(' · ') || 'Не указаны')}</strong></div>
      <div class="profile-fact"><span>Интересы</span><strong>${escapeHtml(interests || 'Не указаны')}</strong></div>
      <div class="profile-fact"><span>Цели</span><strong>${escapeHtml(goals || 'Не указаны')}</strong></div>
    </div></section>
    <section class="drawer-section"><h3>Доступ и рассылка</h3>
      <form id="user-delivery-form" class="drawer-form"><label class="switch-row"><span><strong>Личный гороскоп</strong><small>Утром по часовому поясу пользователя</small></span><input name="enabled" type="checkbox" ${profile.daily_horoscope_enabled ? 'checked' : ''} ${capabilities.manageUsers ? '' : 'disabled'}></label><label>Часовой пояс<input name="timezone" value="${escapeHtml(profile.timezone || 'Europe/Berlin')}" ${capabilities.manageUsers ? '' : 'disabled'}></label>${capabilities.manageUsers ? '<button type="submit">Сохранить рассылку</button>' : ''}</form>
    </section>
    <section class="drawer-section"><h3>VIP</h3><div class="profile-facts"><div class="profile-fact"><span>Статус</span><strong>${vip ? 'Активен' : 'Не активен'}</strong></div><div class="profile-fact"><span>Срок</span><strong>${vip ? adminDate(vip.expires_at, false) : '—'}</strong></div></div>${capabilities.manageUsers && capabilities.manageFinance ? `<div class="drawer-actions"><button type="button" data-vip-days="30">+30 дней</button><button type="button" data-vip-days="365">+365 дней</button>${vip ? '<button type="button" class="danger" data-vip-cancel>Отменить VIP</button>' : ''}</div>` : ''}</section>
    ${wallet ? `<section class="drawer-section"><h3>Кошелёк</h3><div class="profile-facts"><div class="profile-fact"><span>Баланс</span><strong>${adminSilarum(wallet.balance_units)}</strong></div><div class="profile-fact"><span>Заблокировано</span><strong>${adminSilarum(wallet.locked_units)}</strong></div></div>${capabilities.manageFinance ? '<form id="drawer-wallet-form" class="drawer-form"><div class="two-cols"><label>Изменение<input name="amount" type="number" step="0.01" min="-1000000" max="1000000" required placeholder="100 или -25"></label><label>Причина<input name="note" maxlength="300" required></label></div><button type="submit">Изменить баланс</button></form>' : ''}</section>` : ''}
    <section class="drawer-section"><h3>Дополнительные услуги</h3><div class="timeline-list">${entitlementRows}</div>${capabilities.manageUsers ? '<form id="entitlement-form" class="drawer-form"><div class="two-cols"><label>Код услуги<input name="serviceId" pattern="[a-z0-9:_-]+" required placeholder="tarot"></label><label>Количество<input name="quantity" type="number" min="0" max="10000" required value="1"></label></div><button type="submit">Сохранить право</button></form><div class="drawer-actions"><button type="button" class="secondary-button" data-reset-usage>Сбросить дневные лимиты</button></div>' : ''}</section>
    <section class="drawer-section"><h3>Последние чтения</h3><div class="timeline-list">${readingRows}</div></section>
    ${wallet ? `<section class="drawer-section"><h3>Финансовый журнал</h3><div class="timeline-list">${ledgerRows}</div></section>` : ''}`;
}

async function openUserDrawer(telegramId) {
  const drawer = document.getElementById('user-drawer');
  const backdrop = document.getElementById('user-drawer-backdrop');
  const body = document.getElementById('user-drawer-body');
  if (body) body.innerHTML = '<p class="empty-state">Собираем карточку пользователя…</p>';
  backdrop.hidden = false;
  drawer.classList.add('is-open');
  drawer.setAttribute('aria-hidden', 'false');
  try {
    const data = await api(`/api/admin?adminUsers=detail&telegramId=${Number(telegramId)}`);
    modernState.selectedUser = data.user;
    modernState.userCapabilities = data.capabilities || modernState.userCapabilities;
    renderUserDrawer(data.user);
  } catch {
    if (body) body.innerHTML = '<p class="empty-state">Не удалось открыть карточку пользователя.</p>';
  }
}

function closeUserDrawer() {
  const drawer = document.getElementById('user-drawer');
  const backdrop = document.getElementById('user-drawer-backdrop');
  drawer.classList.remove('is-open');
  drawer.setAttribute('aria-hidden', 'true');
  setTimeout(() => { backdrop.hidden = true; }, 260);
}

async function refreshSelectedUser() {
  const id = Number(modernState.selectedUser?.profile?.telegram_id);
  if (id) await openUserDrawer(id);
  await Promise.all([loadUsers(), loadAdminOverview()]);
}

async function loadAudit() {
  const list = document.getElementById('audit-list');
  if (list) list.innerHTML = '<p class="empty-state">Загрузка журнала…</p>';
  try {
    const data = await api('/api/admin?adminUsers=audit&limit=120');
    modernState.auditLoaded = true;
    if (!list) return;
    list.innerHTML = data.entries?.length ? data.entries.map((entry) => {
      const details = JSON.stringify(entry.payload || {});
      return `<div class="audit-row"><time>${adminDate(entry.createdAt)}</time><span><strong>${escapeHtml(entry.adminName)}</strong><small>${escapeHtml(entry.role || '')}</small></span><span>${escapeHtml(ADMIN_ACTION_LABELS[entry.action] || entry.action)}</span><code>${escapeHtml(details === '{}' ? '—' : details)}</code></div>`;
    }).join('') : '<p class="empty-state">Журнал пока пуст.</p>';
  } catch (error) {
    if (error.status === 403) document.querySelector('[data-tab="audit"]').hidden = true;
    if (list) list.innerHTML = '<p class="empty-state">Журнал недоступен для вашей роли.</p>';
  }
}

function campaignForm() { return document.getElementById('campaign-form'); }

function syncCampaignKind() {
  const form = campaignForm();
  if (!form) return;
  const quest = form.elements.kind.value === 'quest';
  form.querySelectorAll('[data-campaign-quest]').forEach((node) => { node.hidden = !quest; });
  form.querySelectorAll('[data-campaign-task]').forEach((node) => { node.hidden = quest; });
}

function resetCampaignForm() {
  const form = campaignForm();
  if (!form) return;
  form.reset(); form.elements.id.value = '';
  form.elements.totalSlots.value = '1000'; form.elements.remainingSlots.value = '1000';
  form.elements.reward.value = '1'; form.elements.prize.value = '10';
  const preview = document.getElementById('campaign-poster-preview');
  if (preview) { preview.hidden = true; preview.removeAttribute('src'); }
  syncCampaignKind();
}

function renderCampaigns() {
  const list = document.getElementById('campaign-admin-list');
  if (!list) return;
  if (!modernState.campaigns.length) { list.innerHTML = '<p class="empty-state">Пока нет заданий и квестов. Создайте первую запись в форме выше.</p>'; return; }
  list.innerHTML = modernState.campaigns.map((item) => `<article class="campaign-admin-row" data-campaign-id="${escapeHtml(item.id)}">
    ${item.poster_url ? `<img src="${escapeHtml(item.poster_url)}" alt="">` : '<span class="campaign-admin-seal">✦</span>'}
    <span><small>${item.kind === 'quest' ? 'КВЕСТ' : 'ЗАДАНИЕ'} · ${escapeHtml(item.status)}</small><strong>${escapeHtml(item.title)}</strong><em>${Number(item.remaining_slots)} из ${Number(item.total_slots)} мест · ${adminSilarum(item.kind === 'quest' ? item.prize_units : item.reward_units)}</em></span>
    <span class="campaign-admin-actions"><button type="button" class="secondary-button" data-edit-campaign="${escapeHtml(item.id)}">Изменить</button><button type="button" class="danger" data-archive-campaign="${escapeHtml(item.id)}">В архив</button></span>
  </article>`).join('');
}

async function loadCampaigns() {
  const list = document.getElementById('campaign-admin-list');
  if (list) list.innerHTML = '<p class="empty-state">Загружаем задания и квесты…</p>';
  try { const data = await api('/api/admin?campaigns=1'); modernState.campaigns = data.campaigns || []; modernState.campaignsLoaded = true; renderCampaigns(); }
  catch { if (list) list.innerHTML = '<p class="empty-state">Не удалось загрузить активности.</p>'; }
}

function editCampaign(id) {
  const item = modernState.campaigns.find((campaign) => campaign.id === id); const form = campaignForm();
  if (!item || !form) return;
  form.elements.id.value = item.id; form.elements.kind.value = item.kind; form.elements.status.value = item.status;
  form.elements.title.value = item.title || ''; form.elements.description.value = item.description || '';
  form.elements.actionUrl.value = item.action_url || ''; form.elements.totalSlots.value = item.total_slots;
  form.elements.remainingSlots.value = item.remaining_slots; form.elements.reward.value = Number(item.reward_units || 0) / 100;
  form.elements.prize.value = Number(item.prize_units || 0) / 100; form.elements.answer.value = '';
  syncCampaignKind(); form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function fileDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve('');
    if (file.size > 2 * 1024 * 1024) return reject(new Error('poster_too_large'));
    const reader = new FileReader(); reader.onload = () => resolve(String(reader.result || '')); reader.onerror = reject; reader.readAsDataURL(file);
  });
}

const activateLegacyTab = activateTab;
activateTab = function activateModernTab(name) {
  if (modernState.currentTab !== name) {
    if (!modernState.suppressHistory && modernState.currentTab) {
      modernState.tabHistory.push(modernState.currentTab);
      modernState.tabHistory = modernState.tabHistory.slice(-20);
    }
    modernState.currentTab = name;
  }
  modernState.suppressHistory = false;
  updateAdminBackButton();
  const effective = ['growth', 'economy'].includes(name) ? 'settings' : name;
  const activeNavigation = name === 'economy' ? 'payments' : name;
  document.querySelectorAll('[data-tab]').forEach((button) => {
    button.classList.toggle('active', button.dataset.tab === activeNavigation);
  });
  document.querySelectorAll('[data-panel]').forEach((panel) => {
    const active = panel.dataset.panel === effective;
    panel.classList.toggle('active', active);
    panel.hidden = !active;
  });
  if (effective === 'settings') {
    const mode = name === 'growth' ? 'growth' : 'monetization';
    settingsForm.dataset.mode = mode;
    document.getElementById('settings-title').textContent = mode === 'growth' ? 'Рост и ежедневные механики' : 'Экономика и цены';
    document.getElementById('settings-copy').textContent = mode === 'growth'
      ? 'Колесо Фортуны, личный гороскоп, рефералы и совместные сценарии.'
      : 'Тарифы, способы оплаты и правила экономики приложения.';
  }
  if (name === 'users' && !modernState.users.length) loadUsers(1);
  if (name === 'audit' && !modernState.auditLoaded) loadAudit();
  if (name === 'payments') loadPayments();
  if (name === 'campaigns' && !modernState.campaignsLoaded) loadCampaigns();
  if (name === 'reconciliation' && !modernState.reconciliationLoaded) loadReconciliationSettings();
  try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch {}
};

document.addEventListener('click', async (event) => {
  const adminBack = event.target.closest('#admin-section-back');
  if (adminBack && modernState.tabHistory.length) {
    const previous = modernState.tabHistory.pop();
    modernState.suppressHistory = true;
    activateTab(previous);
    return;
  }
  const quick = event.target.closest('[data-quick-tab]');
  if (quick) activateTab(quick.dataset.quickTab);
  const settingsButton = event.target.closest('[data-open-settings]');
  if (settingsButton) activateTab('economy');
  const userRow = event.target.closest('[data-user-id]');
  if (userRow) openUserDrawer(Number(userRow.dataset.userId));
  if (event.target.closest('#close-user-drawer') || event.target.id === 'user-drawer-backdrop') closeUserDrawer();

  const vipButton = event.target.closest('[data-vip-days]');
  if (vipButton && modernState.selectedUser) {
    const days = Number(vipButton.dataset.vipDays);
    const current = activeVip(modernState.selectedUser);
    const base = Math.max(Date.now(), Date.parse(current?.expires_at || 0) || 0);
    const expiresAt = new Date(base + days * 86400000).toISOString();
    if (!window.confirm(`Выдать или продлить VIP на ${days} дней?`)) return;
    vipButton.disabled = true;
    try {
      await api('/api/admin?adminUsers=action', 'POST', { action: 'set_user_vip', telegramId: modernState.selectedUser.profile.telegram_id, active: true, planId: days >= 365 ? 'vip-year' : 'vip-month', expiresAt });
      notify('VIP обновлён');
      await refreshSelectedUser();
    } catch (error) { notify(error.data?.error || 'Не удалось обновить VIP'); }
    finally { vipButton.disabled = false; }
  }
  const vipCancel = event.target.closest('[data-vip-cancel]');
  if (vipCancel && modernState.selectedUser) {
    if (!window.confirm('Отменить активный VIP пользователя?')) return;
    vipCancel.disabled = true;
    try {
      await api('/api/admin?adminUsers=action', 'POST', { action: 'set_user_vip', telegramId: modernState.selectedUser.profile.telegram_id, active: false });
      notify('VIP отменён');
      await refreshSelectedUser();
    } catch { notify('Не удалось отменить VIP'); }
  }
  const resetUsage = event.target.closest('[data-reset-usage]');
  if (resetUsage && modernState.selectedUser) {
    if (!window.confirm('Сбросить дневные бесплатные лимиты пользователя?')) return;
    try {
      await api('/api/admin?adminUsers=action', 'POST', { action: 'reset_user_daily_usage', telegramId: modernState.selectedUser.profile.telegram_id });
      notify('Дневные лимиты сброшены');
      await refreshSelectedUser();
    } catch { notify('Не удалось сбросить лимиты'); }
  }
  const editButton = event.target.closest('[data-edit-campaign]');
  if (editButton) editCampaign(editButton.dataset.editCampaign);
  const archiveButton = event.target.closest('[data-archive-campaign]');
  if (archiveButton) {
    if (!window.confirm('Переместить активность в архив?')) return;
    archiveButton.disabled = true;
    try { await api('/api/admin', 'POST', { campaignAction: 'archive', campaignId: archiveButton.dataset.archiveCampaign }); notify('Активность перемещена в архив'); await loadCampaigns(); }
    catch { notify('Не удалось переместить в архив'); }
    finally { archiveButton.disabled = false; }
  }
});

document.getElementById('reconciliation-settings-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const conflictTypes = [...form.querySelectorAll('input[name="conflictTypes"]:checked')];
  if (!conflictTypes.length) return notify('Оставьте хотя бы один тип конфликта');
  button.disabled = true;
  try {
    const current = modernState.reconciliationOverview || await api('/api/admin');
    const settings = {
      ...(current.settings || {}),
      reconciliation: collectReconciliationSettings(form)
    };
    const result = await api('/api/admin', 'POST', { settings });
    modernState.reconciliationOverview = { ...current, settings: result.settings };
    fillReconciliationSettings(result.settings?.reconciliation);
    notify('Настройки примирения сохранены');
  } catch (error) {
    notify(error.data?.error || 'Не удалось сохранить настройки примирения');
  } finally { button.disabled = false; }
});

document.getElementById('users-filter-form')?.addEventListener('submit', (event) => { event.preventDefault(); loadUsers(1); });
document.getElementById('users-prev')?.addEventListener('click', () => loadUsers(Math.max(1, modernState.pagination.page - 1)));
document.getElementById('users-next')?.addEventListener('click', () => loadUsers(Math.min(modernState.pagination.pages, modernState.pagination.page + 1)));
document.getElementById('refresh-overview-button')?.addEventListener('click', loadAdminOverview);
document.getElementById('refresh-audit-button')?.addEventListener('click', loadAudit);
document.getElementById('refresh-campaigns')?.addEventListener('click', loadCampaigns);
document.getElementById('reset-campaign-form')?.addEventListener('click', resetCampaignForm);
document.getElementById('campaign-form')?.elements.kind?.addEventListener('change', syncCampaignKind);
document.getElementById('campaign-form')?.elements.totalSlots?.addEventListener('input', (event) => { const form = campaignForm(); if (!form.elements.id.value) form.elements.remainingSlots.value = event.currentTarget.value; });
document.getElementById('campaign-form')?.elements.poster?.addEventListener('change', async (event) => {
  const preview = document.getElementById('campaign-poster-preview');
  try { const data = await fileDataUrl(event.currentTarget.files?.[0]); if (data && preview) { preview.src = data; preview.hidden = false; } }
  catch { notify('Афиша должна быть изображением до 2 МБ'); event.currentTarget.value = ''; }
});
document.getElementById('campaign-form')?.addEventListener('submit', async (event) => {
  event.preventDefault(); const form = event.currentTarget; const button = form.querySelector('button[type="submit"]'); button.disabled = true;
  try {
    const posterDataUrl = await fileDataUrl(form.elements.poster.files?.[0]);
    const current = modernState.campaigns.find((item) => item.id === form.elements.id.value);
    const campaign = { id: form.elements.id.value || undefined, kind: form.elements.kind.value, status: form.elements.status.value,
      title: form.elements.title.value.trim(), description: form.elements.description.value.trim(), actionUrl: form.elements.actionUrl.value.trim(),
      totalSlots: Number(form.elements.totalSlots.value), remainingSlots: Number(form.elements.remainingSlots.value), reward: Number(form.elements.reward.value || 0),
      prize: Number(form.elements.prize.value || 0), answer: form.elements.answer.value.trim(), posterDataUrl, posterUrl: current?.poster_url || '' };
    if (campaign.kind === 'quest' && !campaign.id && !campaign.answer) throw new Error('answer_required');
    await api('/api/admin', 'POST', { campaignAction: 'save', campaign }); notify('Активность сохранена'); resetCampaignForm(); await loadCampaigns();
  } catch (error) { notify(error.message === 'answer_required' ? 'Для нового квеста укажите правильный ответ' : 'Не удалось сохранить активность'); }
  finally { button.disabled = false; }
});

document.getElementById('user-drawer')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.target;
  const telegramId = Number(modernState.selectedUser?.profile?.telegram_id);
  if (!telegramId) return;
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    if (form.id === 'user-delivery-form') {
      await api('/api/admin?adminUsers=action', 'POST', { action: 'update_user_delivery', telegramId, enabled: form.elements.enabled.checked, timezone: form.elements.timezone.value.trim() });
      notify('Настройки рассылки сохранены');
    }
    if (form.id === 'drawer-wallet-form') {
      const amount = Number(form.elements.amount.value);
      if (!amount) throw new Error('invalid_amount');
      if (!window.confirm(`${amount > 0 ? 'Начислить' : 'Списать'} ${formatPaymentMoney(Math.abs(amount))} SILARUM?`)) return;
      await api('/api/admin', 'POST', { paymentAction: 'adjust_user_wallet', target: String(telegramId), amount, note: form.elements.note.value.trim(), idempotencyKey: createActionKey('admin-adjust') });
      notify('Баланс изменён');
    }
    if (form.id === 'entitlement-form') {
      await api('/api/admin?adminUsers=action', 'POST', { action: 'set_user_entitlement', telegramId, serviceId: form.elements.serviceId.value.trim(), quantity: Number(form.elements.quantity.value) });
      notify('Право на услугу сохранено');
    }
    await refreshSelectedUser();
  } catch (error) {
    notify(error.data?.error || 'Не удалось выполнить действие');
  } finally {
    button.disabled = false;
  }
});

if (tg?.initData) loadAdminOverview();
