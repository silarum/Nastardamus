const tg = window.Telegram?.WebApp;
tg?.ready();
tg?.expand();
tg?.setHeaderColor?.('#090713');
tg?.setBackgroundColor?.('#090713');

const accessCard = document.getElementById('access-card');
const accessTitle = document.getElementById('access-title');
const accessCopy = document.getElementById('access-copy');
const adminBotLink = document.getElementById('admin-bot-link');
const dashboard = document.getElementById('dashboard');
const settingsForm = document.getElementById('settings-form');
const adminForm = document.getElementById('admin-form');
const supportForm = document.getElementById('support-form');
const providerForm = document.getElementById('provider-form');
const agentForm = document.getElementById('agent-form');
const moderationForm = document.getElementById('moderation-form');
const toast = document.getElementById('toast');
const saveState = document.getElementById('save-state');

const state = {
  overview: null,
  payments: null,
  team: null,
  ai: null
};

const roleLabels = {
  owner: 'Владелец',
  admin: 'Администратор',
  manager: 'Менеджер',
  support: 'Поддержка',
  moderator: 'Модератор',
  analyst: 'Аналитик'
};

const purposeLabels = {
  support: 'Поддержка',
  onboarding: 'Обучение',
  tarot: 'Таро',
  astrology: 'Астрология',
  compatibility: 'Совместимость',
  photo_moderation: 'Фото-модерация',
  palmlink_moderation: 'PalmLink',
  custom: 'Другое'
};

let toastTimer;

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function notify(text) {
  clearTimeout(toastTimer);
  toast.textContent = text;
  toast.classList.add('show');
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}

function setAccess(type, title, copy) {
  accessCard.classList.remove('ok', 'error');
  if (type) accessCard.classList.add(type);
  accessTitle.textContent = title;
  accessCopy.textContent = copy;
}

function setStatus(id, text, ok = true) {
  const node = document.getElementById(id);
  node.textContent = text;
  node.classList.toggle('good', Boolean(ok));
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || `HTTP ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

async function api(path, method = 'GET', body) {
  return requestJson(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Init-Data': tg?.initData || ''
    },
    body: body ? JSON.stringify(body) : undefined
  });
}

async function loadBotLink() {
  try {
    const data = await requestJson('/api/admin-bot');
    if (!data.bot?.username) return;
    adminBotLink.href = `https://t.me/${data.bot.username}?start=admin`;
    adminBotLink.textContent = `Открыть @${data.bot.username}`;
    adminBotLink.hidden = false;
  } catch {
    adminBotLink.hidden = true;
  }
}

function applySettings(settings = {}) {
  for (const [key, value] of Object.entries(settings)) {
    const field = settingsForm.elements.namedItem(key);
    if (!field) continue;
    if (field.type === 'checkbox') field.checked = Boolean(value);
    else field.value = String(value);
  }
  document.querySelectorAll('[data-service]').forEach((row) => {
    const service = settings.serviceCatalog?.[row.dataset.service] || {};
    row.querySelector('[data-service-enabled]').checked = service.enabled !== false;
    row.querySelector('[data-service-price]').value = service.price !== null
      && service.price !== undefined
      && Number.isFinite(Number(service.price))
      ? String(service.price)
      : '';
  });
  const rewards = new Map((settings.wheelRewards || []).map((reward) => [reward.id, reward]));
  document.querySelectorAll('[data-reward]').forEach((row) => {
    const reward = rewards.get(row.dataset.reward);
    if (!reward) return;
    row.querySelector('[data-reward-enabled]').checked = reward.enabled === true;
    row.querySelector('[data-reward-title]').value = reward.title || '';
    row.querySelector('[data-reward-service]').value = reward.serviceId || 'tarot_relationship';
    row.querySelector('[data-reward-quantity]').value = reward.quantity ?? 1;
    row.querySelector('[data-reward-daily]').value = reward.dailyLimit ?? 0;
    row.querySelector('[data-reward-weight]').value = reward.weight ?? 1;
  });
}

function collectServiceCatalog() {
  return Object.fromEntries([...document.querySelectorAll('[data-service]')].map((row) => {
    const rawPrice = row.querySelector('[data-service-price]').value.trim();
    return [row.dataset.service, {
      enabled: row.querySelector('[data-service-enabled]').checked,
      price: rawPrice === '' ? null : Number(rawPrice)
    }];
  }));
}

function collectWheelRewards() {
  return [...document.querySelectorAll('[data-reward]')].map((row) => ({
    id: row.dataset.reward,
    enabled: row.querySelector('[data-reward-enabled]').checked,
    title: row.querySelector('[data-reward-title]').value,
    serviceId: row.querySelector('[data-reward-service]').value,
    quantity: Number(row.querySelector('[data-reward-quantity]').value),
    dailyLimit: Number(row.querySelector('[data-reward-daily]').value),
    weight: Number(row.querySelector('[data-reward-weight]').value)
  }));
}

function formatPaymentMoney(value, fraction = 2) {
  return Number(value || 0).toLocaleString('ru-RU', {
    minimumFractionDigits: fraction,
    maximumFractionDigits: fraction
  });
}

function paymentStatusLabel(status) {
  return ({
    pending: 'Создана',
    awaiting_confirmation: 'Ожидает проверки',
    paid: 'Подтверждена',
    rejected: 'Отклонена',
    cancelled: 'Отменена',
    expired: 'Истекла'
  })[status] || status;
}

function renderPayments() {
  const list = document.getElementById('payments-list');
  if (!list) return;
  const orders = state.payments?.orders || [];
  if (!orders.length) {
    list.innerHTML = '<p class="empty-state">Заявок на пополнение пока нет.</p>';
    return;
  }
  list.innerHTML = orders.map((order) => {
    const status = escapeHtml(paymentStatusLabel(order.status));
    const pending = ['pending', 'awaiting_confirmation'].includes(order.status);
    const canManage = state.payments?.canManage === true;
    return `<article class="entity-card" data-payment-id="${escapeHtml(order.id)}">
      <div class="entity-main">
        <div>
          <div class="entity-title"><strong>${escapeHtml(order.payment_reference)}</strong><span class="chip ${order.status === 'paid' ? 'ok' : pending ? '' : 'off'}">${status}</span></div>
          <p>Telegram ID ${Number(order.telegram_id)} · ${formatPaymentMoney(Number(order.silarum_units) / 100)} SILARUM · ${formatPaymentMoney(Number(order.ruble_kopecks) / 100)} ₽</p>
          <p>${new Date(order.created_at).toLocaleString('ru-RU')}</p>
        </div>
        ${pending && canManage ? `<div class="entity-actions">
          <button type="button" data-payment-decision="paid">Подтвердить</button>
          <button type="button" class="danger" data-payment-decision="rejected">Отклонить</button>
        </div>` : ''}
      </div>
    </article>`;
  }).join('');
}

async function loadPayments() {
  try {
    state.payments = await api('/api/admin?payments=1');
    renderPayments();
  } catch (error) {
    state.payments = null;
    const tab = document.querySelector('[data-tab="payments"]');
    if (error.status === 403 && tab) tab.hidden = true;
    const list = document.getElementById('payments-list');
    if (list) list.innerHTML = '<p class="empty-state">Платежи временно недоступны.</p>';
  }
}

document.getElementById('refresh-payments-button')?.addEventListener('click', loadPayments);
document.getElementById('payments-list')?.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-payment-decision]');
  const card = event.target.closest('[data-payment-id]');
  if (!button || !card) return;
  const decision = button.dataset.paymentDecision;
  const message = decision === 'paid'
    ? 'Подтвердить фактическое поступление перевода и начислить SILARUM?'
    : 'Отклонить эту заявку?';
  if (!window.confirm(message)) return;
  button.disabled = true;
  try {
    await api('/api/admin', 'POST', {
      paymentAction: 'review_sbp_topup',
      orderId: card.dataset.paymentId,
      decision,
      note: ''
    });
    notify(decision === 'paid' ? 'Платёж подтверждён, SILARUM начислены' : 'Заявка отклонена');
    await loadPayments();
  } catch (error) {
    notify(error.data?.error || 'Не удалось обработать платёж');
    button.disabled = false;
  }
});

function disableForm(form, disabled) {
  if (!form) return;
  for (const field of form.elements) field.disabled = Boolean(disabled);
}

function activateTab(name) {
  document.querySelectorAll('[data-tab]').forEach((button) => {
    button.classList.toggle('active', button.dataset.tab === name);
  });
  document.querySelectorAll('[data-panel]').forEach((panel) => {
    const active = panel.dataset.panel === name;
    panel.classList.toggle('active', active);
    panel.hidden = !active;
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.querySelector('.admin-tabs')?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-tab]');
  if (button) activateTab(button.dataset.tab);
});

function renderAdmins() {
  const list = document.getElementById('admins-list');
  const admins = state.team?.admins || [];
  const canManage = Boolean(state.team?.capabilities?.manageAdmins);
  const currentId = Number(state.team?.profile?.telegram_id);

  if (!canManage) {
    list.innerHTML = '<p class="empty-state">У вас нет права управлять администраторами.</p>';
    document.getElementById('new-admin-button').hidden = true;
    return;
  }

  document.getElementById('new-admin-button').hidden = false;
  if (!admins.length) {
    list.innerHTML = '<p class="empty-state">Пока назначен только системный владелец.</p>';
    return;
  }

  list.innerHTML = admins.map((admin) => {
    const id = Number(admin.telegram_id);
    const title = admin.display_name || (admin.username ? `@${admin.username}` : `ID ${id}`);
    const permissions = admin.role === 'owner'
      ? ['Полный доступ']
      : Object.keys(admin.permissions || {}).filter((key) => admin.permissions[key]);
    return `
      <article class="entity-card">
        <div class="entity-main">
          <div>
            <div class="entity-title">
              <strong>${escapeHtml(title)}</strong>
              <span class="chip">${escapeHtml(roleLabels[admin.role] || admin.role)}</span>
              <span class="chip ${admin.is_active ? 'ok' : 'off'}">${admin.is_active ? 'Активен' : 'Отключён'}</span>
            </div>
            <p>Telegram ID ${id}${admin.username ? ` · @${escapeHtml(admin.username)}` : ''}</p>
            <div class="entity-meta">${permissions.slice(0, 5).map((permission) => `<span class="chip">${escapeHtml(permission)}</span>`).join('')}${permissions.length > 5 ? `<span class="chip">+${permissions.length - 5}</span>` : ''}</div>
          </div>
          <div class="entity-actions">
            <button type="button" data-admin-edit="${id}">Изменить</button>
            ${admin.role !== 'owner' && id !== currentId ? `<button type="button" class="danger" data-admin-delete="${id}">Удалить</button>` : ''}
          </div>
        </div>
      </article>`;
  }).join('');
}

function applyRoleDefaults(role) {
  const defaults = state.team?.roleDefaults?.[role] || {};
  adminForm.querySelectorAll('input[name="permission"]').forEach((field) => {
    field.checked = role === 'owner' || defaults[field.value] === true;
    field.disabled = role === 'owner';
  });
}

function openAdminEditor(admin = null) {
  adminForm.reset();
  adminForm.hidden = false;
  const editing = Boolean(admin);
  adminForm.elements.editingTelegramId.value = editing ? admin.telegram_id : '';
  adminForm.elements.telegramId.value = editing ? admin.telegram_id : '';
  adminForm.elements.telegramId.readOnly = editing;
  adminForm.elements.displayName.value = admin?.display_name || '';
  adminForm.elements.username.value = admin?.username ? `@${admin.username}` : '';
  adminForm.elements.role.value = admin?.role || 'admin';
  adminForm.elements.isActive.checked = admin?.is_active !== false;
  document.getElementById('admin-form-title').textContent = editing ? 'Изменить администратора' : 'Новый администратор';
  applyRoleDefaults(admin?.role || 'admin');
  if (admin && admin.role !== 'owner') {
    adminForm.querySelectorAll('input[name="permission"]').forEach((field) => {
      field.checked = admin.permissions?.[field.value] === true;
    });
  }
  adminForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeEditor(type) {
  const form = type === 'admin' ? adminForm : type === 'provider' ? providerForm : agentForm;
  form.hidden = true;
}

document.querySelectorAll('[data-close-editor]').forEach((button) => {
  button.addEventListener('click', () => closeEditor(button.dataset.closeEditor));
});

document.getElementById('new-admin-button')?.addEventListener('click', () => openAdminEditor());
adminForm?.elements.role?.addEventListener('change', () => applyRoleDefaults(adminForm.elements.role.value));

document.getElementById('admins-list')?.addEventListener('click', async (event) => {
  const editButton = event.target.closest('[data-admin-edit]');
  const deleteButton = event.target.closest('[data-admin-delete]');
  if (editButton) {
    const admin = state.team.admins.find((item) => Number(item.telegram_id) === Number(editButton.dataset.adminEdit));
    if (admin) openAdminEditor(admin);
  }
  if (deleteButton) {
    const id = Number(deleteButton.dataset.adminDelete);
    if (!confirm(`Удалить администратора с Telegram ID ${id}?`)) return;
    try {
      await api('/api/admin-team', 'POST', { action: 'delete_admin', telegramId: id });
      await loadTeam();
      notify('Администратор удалён');
    } catch (error) {
      notify(error.data?.error || 'Не удалось удалить администратора');
    }
  }
});

adminForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = adminForm.querySelector('button[type="submit"]');
  const permissions = {};
  adminForm.querySelectorAll('input[name="permission"]:checked').forEach((field) => {
    permissions[field.value] = true;
  });
  const admin = {
    telegramId: Number(adminForm.elements.telegramId.value),
    displayName: adminForm.elements.displayName.value,
    username: adminForm.elements.username.value,
    role: adminForm.elements.role.value,
    isActive: adminForm.elements.isActive.checked,
    permissions
  };
  button.disabled = true;
  try {
    await api('/api/admin-team', 'POST', { action: 'upsert_admin', admin });
    closeEditor('admin');
    await loadTeam();
    notify('Права администратора сохранены');
  } catch (error) {
    notify(error.data?.error || 'Не удалось сохранить администратора');
  } finally {
    button.disabled = false;
  }
});

function populateSupport() {
  const support = state.team?.support;
  const canView = Boolean(state.team?.capabilities?.viewSupport);
  const canManage = Boolean(state.team?.capabilities?.manageSupport);
  const tabButton = document.querySelector('[data-tab="support"]');
  if (!canView) {
    tabButton.hidden = true;
    return;
  }
  tabButton.hidden = false;
  if (!support) return;
  supportForm.elements.enabled.checked = support.enabled !== false;
  supportForm.elements.supportUsername.value = support.support_username ? `@${support.support_username}` : '';
  supportForm.elements.supportChatId.value = support.support_chat_id || '';
  supportForm.elements.welcomeMessage.value = support.welcome_message || '';
  supportForm.elements.offlineMessage.value = support.offline_message || '';
  supportForm.elements.responseSlaMinutes.value = support.response_sla_minutes || 240;
  supportForm.elements.allowAttachments.checked = support.allow_attachments !== false;
  supportForm.elements.autoAssign.checked = support.auto_assign !== false;
  supportForm.elements.timezone.value = support.working_hours?.timezone || 'Europe/Berlin';
  supportForm.elements.workFrom.value = support.working_hours?.from || '09:00';
  supportForm.elements.workTo.value = support.working_hours?.to || '18:00';
  const days = new Set((support.working_hours?.days || [1, 2, 3, 4, 5]).map(Number));
  supportForm.querySelectorAll('input[name="workDay"]').forEach((field) => {
    field.checked = days.has(Number(field.value));
  });
  disableForm(supportForm, !canManage);
}

supportForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = supportForm.querySelector('button[type="submit"]');
  const support = {
    enabled: supportForm.elements.enabled.checked,
    supportUsername: supportForm.elements.supportUsername.value,
    supportChatId: supportForm.elements.supportChatId.value,
    welcomeMessage: supportForm.elements.welcomeMessage.value,
    offlineMessage: supportForm.elements.offlineMessage.value,
    responseSlaMinutes: Number(supportForm.elements.responseSlaMinutes.value),
    allowAttachments: supportForm.elements.allowAttachments.checked,
    autoAssign: supportForm.elements.autoAssign.checked,
    workingHours: {
      timezone: supportForm.elements.timezone.value,
      from: supportForm.elements.workFrom.value,
      to: supportForm.elements.workTo.value,
      days: [...supportForm.querySelectorAll('input[name="workDay"]:checked')].map((field) => Number(field.value))
    }
  };
  button.disabled = true;
  try {
    await api('/api/admin-team', 'POST', { action: 'save_support', support });
    await loadTeam();
    notify('Настройки поддержки сохранены');
  } catch (error) {
    notify(error.data?.error || 'Не удалось сохранить поддержку');
  } finally {
    button.disabled = false;
  }
});

function providerName(id) {
  return state.ai?.providers?.find((provider) => provider.id === id)?.name || 'Не назначена';
}

function renderProviders() {
  const list = document.getElementById('providers-list');
  const providers = state.ai?.providers || [];
  const canManage = Boolean(state.ai?.canManage);
  document.getElementById('new-provider-button').hidden = !canManage;
  if (!providers.length) {
    list.innerHTML = '<p class="empty-state">Добавьте первый API. Текущий системный ключ Vercel продолжит работать отдельно.</p>';
    refreshProviderSelects();
    return;
  }
  list.innerHTML = providers.map((provider) => {
    const caps = Object.entries(provider.capabilities || {}).filter(([, enabled]) => enabled).map(([key]) => key);
    return `
      <article class="entity-card">
        <div class="entity-main">
          <div>
            <div class="entity-title"><strong>${escapeHtml(provider.name)}</strong><span class="chip">${escapeHtml(provider.provider_type)}</span><span class="chip ${provider.enabled ? 'ok' : 'off'}">${provider.enabled ? 'Активен' : 'Отключён'}</span></div>
            <p>${escapeHtml(provider.text_model || 'текстовая модель не задана')}${provider.vision_model ? ` · vision: ${escapeHtml(provider.vision_model)}` : ''} · ключ ${escapeHtml(provider.api_key_hint || 'не задан')}</p>
            <div class="entity-meta">${caps.map((cap) => `<span class="chip">${escapeHtml(cap)}</span>`).join('')}</div>
          </div>
          ${canManage ? `<div class="entity-actions"><button type="button" data-provider-edit="${provider.id}">Изменить</button><button type="button" class="danger" data-provider-delete="${provider.id}">Удалить</button></div>` : ''}
        </div>
      </article>`;
  }).join('');
  refreshProviderSelects();
}

function refreshProviderSelects() {
  const providers = state.ai?.providers || [];
  for (const field of [agentForm?.elements.providerId, agentForm?.elements.fallbackProviderId]) {
    if (!field) continue;
    const current = field.value;
    const firstLabel = field.name === 'fallbackProviderId' ? 'Нет' : 'Не назначена';
    field.innerHTML = `<option value="">${firstLabel}</option>${providers.map((provider) => `<option value="${provider.id}">${escapeHtml(provider.name)}${provider.enabled ? '' : ' (выключена)'}</option>`).join('')}`;
    field.value = current;
  }
}

function openProviderEditor(provider = null) {
  providerForm.reset();
  providerForm.hidden = false;
  providerForm.elements.id.value = provider?.id || '';
  providerForm.elements.name.value = provider?.name || '';
  providerForm.elements.providerType.value = provider?.provider_type || 'openai_compatible';
  providerForm.elements.baseUrl.value = provider?.base_url || '';
  providerForm.elements.apiKey.value = '';
  providerForm.elements.textModel.value = provider?.text_model || '';
  providerForm.elements.visionModel.value = provider?.vision_model || '';
  providerForm.elements.priority.value = provider?.priority || 100;
  providerForm.elements.enabled.checked = provider?.enabled !== false;
  providerForm.querySelectorAll('input[name="providerCapability"]').forEach((field) => {
    field.checked = provider ? provider.capabilities?.[field.value] === true : field.value === 'text';
  });
  document.getElementById('provider-form-title').textContent = provider ? 'Изменить нейросеть' : 'Новая нейросеть';
  providerForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

document.getElementById('new-provider-button')?.addEventListener('click', () => openProviderEditor());
document.getElementById('providers-list')?.addEventListener('click', async (event) => {
  const editButton = event.target.closest('[data-provider-edit]');
  const deleteButton = event.target.closest('[data-provider-delete]');
  if (editButton) {
    const provider = state.ai.providers.find((item) => item.id === editButton.dataset.providerEdit);
    if (provider) openProviderEditor(provider);
  }
  if (deleteButton) {
    const id = deleteButton.dataset.providerDelete;
    if (!confirm('Удалить подключение нейросети? Назначенные помощники останутся без этой модели.')) return;
    try {
      await api('/api/admin-ai', 'POST', { action: 'delete_provider', id });
      await loadAi();
      notify('Подключение удалено');
    } catch (error) {
      notify(error.data?.error || 'Не удалось удалить подключение');
    }
  }
});

providerForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = providerForm.querySelector('button[type="submit"]');
  const capabilities = {};
  providerForm.querySelectorAll('input[name="providerCapability"]').forEach((field) => {
    capabilities[field.value] = field.checked;
  });
  const provider = {
    id: providerForm.elements.id.value || undefined,
    name: providerForm.elements.name.value,
    providerType: providerForm.elements.providerType.value,
    baseUrl: providerForm.elements.baseUrl.value,
    apiKey: providerForm.elements.apiKey.value,
    textModel: providerForm.elements.textModel.value,
    visionModel: providerForm.elements.visionModel.value,
    priority: Number(providerForm.elements.priority.value),
    enabled: providerForm.elements.enabled.checked,
    capabilities
  };
  button.disabled = true;
  try {
    await api('/api/admin-ai', 'POST', { action: 'upsert_provider', provider });
    closeEditor('provider');
    await loadAi();
    notify('API нейросети сохранён и зашифрован');
  } catch (error) {
    notify(error.data?.error || 'Не удалось сохранить API');
  } finally {
    button.disabled = false;
  }
});

function renderAgents() {
  const list = document.getElementById('agents-list');
  const agents = state.ai?.agents || [];
  const canManage = Boolean(state.ai?.canManage);
  document.getElementById('new-agent-button').hidden = !canManage;
  if (!agents.length) {
    list.innerHTML = '<p class="empty-state">Помощники ещё не созданы.</p>';
    return;
  }
  list.innerHTML = agents.map((agent) => `
    <article class="entity-card">
      <div class="entity-main">
        <div>
          <div class="entity-title"><strong>${escapeHtml(agent.name)}</strong><span class="chip">${escapeHtml(purposeLabels[agent.purpose] || agent.purpose)}</span><span class="chip ${agent.enabled ? 'ok' : 'off'}">${agent.enabled ? 'Активен' : 'Отключён'}</span></div>
          <p>Основная: ${escapeHtml(providerName(agent.provider_id))} · резерв: ${escapeHtml(providerName(agent.fallback_provider_id))}</p>
          <div class="entity-meta">${Object.entries(agent.channels || {}).filter(([, enabled]) => enabled).map(([channel]) => `<span class="chip">${escapeHtml(channel)}</span>`).join('')}<span class="chip">${escapeHtml(agent.model_override || 'модель провайдера')}</span></div>
        </div>
        ${canManage ? `<div class="entity-actions"><button type="button" data-agent-edit="${agent.id}">Изменить</button><button type="button" class="danger" data-agent-delete="${agent.id}">Удалить</button></div>` : ''}
      </div>
    </article>`).join('');
}

function openAgentEditor(agent = null) {
  agentForm.reset();
  refreshProviderSelects();
  agentForm.hidden = false;
  agentForm.elements.id.value = agent?.id || '';
  agentForm.elements.name.value = agent?.name || '';
  agentForm.elements.slug.value = agent?.slug || '';
  agentForm.elements.purpose.value = agent?.purpose || 'custom';
  agentForm.elements.providerId.value = agent?.provider_id || '';
  agentForm.elements.fallbackProviderId.value = agent?.fallback_provider_id || '';
  agentForm.elements.modelOverride.value = agent?.model_override || '';
  agentForm.elements.instructions.value = agent?.instructions || '';
  agentForm.elements.temperature.value = agent?.temperature ?? 0.4;
  agentForm.elements.maxOutputTokens.value = agent?.max_output_tokens || 1200;
  agentForm.elements.enabled.checked = agent?.enabled !== false;
  agentForm.querySelectorAll('input[name="agentChannel"]').forEach((field) => {
    field.checked = agent ? agent.channels?.[field.value] === true : field.value === 'app';
  });
  document.getElementById('agent-form-title').textContent = agent ? 'Изменить помощника' : 'Новый помощник';
  agentForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

document.getElementById('new-agent-button')?.addEventListener('click', () => openAgentEditor());
document.getElementById('agents-list')?.addEventListener('click', async (event) => {
  const editButton = event.target.closest('[data-agent-edit]');
  const deleteButton = event.target.closest('[data-agent-delete]');
  if (editButton) {
    const agent = state.ai.agents.find((item) => item.id === editButton.dataset.agentEdit);
    if (agent) openAgentEditor(agent);
  }
  if (deleteButton) {
    const id = deleteButton.dataset.agentDelete;
    if (!confirm('Удалить AI-помощника?')) return;
    try {
      await api('/api/admin-ai', 'POST', { action: 'delete_agent', id });
      await loadAi();
      notify('Помощник удалён');
    } catch (error) {
      notify(error.data?.error || 'Не удалось удалить помощника');
    }
  }
});

agentForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = agentForm.querySelector('button[type="submit"]');
  const channels = {};
  agentForm.querySelectorAll('input[name="agentChannel"]').forEach((field) => {
    channels[field.value] = field.checked;
  });
  const agent = {
    id: agentForm.elements.id.value || undefined,
    name: agentForm.elements.name.value,
    slug: agentForm.elements.slug.value,
    purpose: agentForm.elements.purpose.value,
    providerId: agentForm.elements.providerId.value || null,
    fallbackProviderId: agentForm.elements.fallbackProviderId.value || null,
    modelOverride: agentForm.elements.modelOverride.value,
    instructions: agentForm.elements.instructions.value,
    temperature: Number(agentForm.elements.temperature.value),
    maxOutputTokens: Number(agentForm.elements.maxOutputTokens.value),
    enabled: agentForm.elements.enabled.checked,
    channels
  };
  button.disabled = true;
  try {
    await api('/api/admin-ai', 'POST', { action: 'upsert_agent', agent });
    closeEditor('agent');
    await loadAi();
    notify('Настройки помощника сохранены');
  } catch (error) {
    notify(error.data?.error || 'Не удалось сохранить помощника');
  } finally {
    button.disabled = false;
  }
});

function populateModeration() {
  const moderation = state.ai?.moderation;
  if (!moderation) return;
  moderationForm.elements.enabled.checked = moderation.enabled !== false;
  moderationForm.querySelectorAll('input[name="moderationRule"]').forEach((field) => {
    field.checked = moderation.rules?.[field.value] !== false;
  });
  moderationForm.elements.blockThreshold.value = moderation.thresholds?.block ?? 0.85;
  moderationForm.elements.reviewThreshold.value = moderation.thresholds?.manual_review ?? 0.55;
  moderationForm.elements.qualityThreshold.value = moderation.thresholds?.minimum_quality ?? 0.45;
  moderationForm.elements.maximumFaces.value = moderation.thresholds?.maximum_faces ?? 2;
  moderationForm.elements.highRiskAction.value = moderation.actions?.high_risk || 'block';
  moderationForm.elements.mediumRiskAction.value = moderation.actions?.medium_risk || 'review';
  moderationForm.elements.retainFlaggedDays.value = moderation.actions?.retain_flagged_days ?? 30;
  moderationForm.elements.notifyAdmin.checked = moderation.actions?.notify_admin !== false;
  disableForm(moderationForm, !state.ai?.canManage);
}

moderationForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = moderationForm.querySelector('button[type="submit"]');
  const rules = {};
  moderationForm.querySelectorAll('input[name="moderationRule"]').forEach((field) => {
    rules[field.value] = field.checked;
  });
  const moderation = {
    enabled: moderationForm.elements.enabled.checked,
    rules,
    thresholds: {
      block: Number(moderationForm.elements.blockThreshold.value),
      manual_review: Number(moderationForm.elements.reviewThreshold.value),
      minimum_quality: Number(moderationForm.elements.qualityThreshold.value),
      maximum_faces: Number(moderationForm.elements.maximumFaces.value)
    },
    actions: {
      high_risk: moderationForm.elements.highRiskAction.value,
      medium_risk: moderationForm.elements.mediumRiskAction.value,
      low_risk: 'allow',
      retain_flagged_days: Number(moderationForm.elements.retainFlaggedDays.value),
      notify_admin: moderationForm.elements.notifyAdmin.checked
    }
  };
  button.disabled = true;
  try {
    await api('/api/admin-ai', 'POST', { action: 'save_moderation', moderation });
    await loadAi();
    notify('Правила фото-модерации сохранены');
  } catch (error) {
    notify(error.data?.error || 'Не удалось сохранить модерацию');
  } finally {
    button.disabled = false;
  }
});

async function loadTeam() {
  try {
    state.team = await api('/api/admin-team');
    renderAdmins();
    populateSupport();
  } catch (error) {
    state.team = null;
    document.getElementById('admins-list').innerHTML = '<p class="empty-state">Раздел команды временно недоступен.</p>';
    if (error.status === 403) {
      document.querySelector('[data-tab="team"]').hidden = true;
      document.querySelector('[data-tab="support"]').hidden = true;
    }
  }
}

async function loadAi() {
  try {
    state.ai = await api('/api/admin-ai');
    renderProviders();
    renderAgents();
    populateModeration();
    const enabled = state.ai.providers.filter((provider) => provider.enabled).length;
    const total = state.ai.providers.length;
    if (total) setStatus('status-ai', `${enabled}/${total} API`, enabled > 0);
    else if (state.overview?.services?.readings) setStatus('status-ai', 'Системный ключ', true);
    else setStatus('status-ai', 'Не настроен', false);
  } catch (error) {
    state.ai = null;
    document.querySelector('[data-tab="ai"]').hidden = error.status === 403;
    if (state.overview?.services?.readings) setStatus('status-ai', 'Системный ключ', true);
    else setStatus('status-ai', 'Недоступен', false);
  }
}

settingsForm?.addEventListener('input', () => {
  saveState.textContent = 'Есть несохранённые изменения';
});

settingsForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = settingsForm.querySelector('button[type="submit"]');
  const values = {};
  for (const [key, value] of new FormData(settingsForm).entries()) {
    if (key) values[key] = value;
  }
  for (const checkbox of settingsForm.querySelectorAll('input[type="checkbox"]')) values[checkbox.name] = checkbox.checked;
  for (const number of settingsForm.querySelectorAll('input[type="number"]')) values[number.name] = Number(number.value);
  values.serviceCatalog = collectServiceCatalog();
  values.wheelRewards = collectWheelRewards();
  button.disabled = true;
  saveState.textContent = 'Сохраняем…';
  try {
    const result = await api('/api/admin', 'POST', { settings: values });
    if (!result.persisted) throw new Error('persistence_not_configured');
    saveState.textContent = 'Настройки сохранены';
    notify('Изменения применены');
    tg?.HapticFeedback?.notificationOccurred?.('success');
  } catch (error) {
    saveState.textContent = 'Не удалось сохранить';
    notify(error.data?.error || 'Ошибка серверного сохранения');
    tg?.HapticFeedback?.notificationOccurred?.('error');
  } finally {
    button.disabled = false;
  }
});

async function boot() {
  if (!tg?.initData) {
    setAccess('error', 'Откройте через Telegram', 'Прямой вход закрыт. Запустите бота и нажмите кнопку «Админ-панель».');
    await loadBotLink();
    return;
  }

  try {
    state.overview = await api('/api/admin');
    setAccess('ok', 'Доступ подтверждён', `Администратор: ${state.overview.user?.first_name || state.overview.user?.username || state.overview.user?.id}`);
    document.getElementById('admin-subtitle').textContent = `Telegram ID ${state.overview.user.id} · ${roleLabels[state.overview.role] || state.overview.role}`;
    setStatus('status-bot', state.overview.services.bot ? 'Подключён' : 'Нет', state.overview.services.bot);
    setStatus('status-app', state.overview.services.webAppUrl ? 'Онлайн' : 'Нет адреса', state.overview.services.webAppUrl);
    setStatus('status-access', roleLabels[state.overview.role] || state.overview.role, true);
    applySettings(state.overview.settings);
    disableForm(settingsForm, state.overview.canManageSettings === false);
    dashboard.hidden = false;
    await Promise.all([loadPayments(), loadTeam(), loadAi()]);
  } catch (error) {
    if (error.status === 403 && error.data?.userId) {
      setAccess('error', 'Ожидается подтверждение владельца', `Ваш Telegram ID: ${error.data.userId}. Доступ должен назначить владелец.`);
      document.getElementById('admin-subtitle').textContent = `Telegram ID ${error.data.userId}`;
    } else if (error.status === 401) {
      setAccess('error', 'Сессия Telegram истекла', 'Закройте панель и снова откройте её кнопкой в боте.');
    } else {
      setAccess('error', 'Ошибка подключения', 'Не удалось подтвердить доступ. Повторите запуск из Telegram.');
    }
  }
}

boot();
