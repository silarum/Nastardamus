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
const form = document.getElementById('settings-form');
const toast = document.getElementById('toast');
const saveState = document.getElementById('save-state');
let toastTimer;

function notify(text) {
  clearTimeout(toastTimer);
  toast.textContent = text;
  toast.classList.add('show');
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
}

function setAccess(type, title, copy) {
  accessCard.classList.remove('ok', 'error');
  if (type) accessCard.classList.add(type);
  accessTitle.textContent = title;
  accessCopy.textContent = copy;
}

function setStatus(id, ok, yes = 'Подключено', no = 'Нет') {
  const node = document.getElementById(id);
  node.textContent = ok ? yes : no;
  node.classList.toggle('good', Boolean(ok));
}

function applySettings(settings = {}) {
  for (const [key, value] of Object.entries(settings)) {
    const field = form.elements.namedItem(key);
    if (!field) continue;
    if (field.type === 'checkbox') field.checked = Boolean(value);
    else field.value = String(value);
  }
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

async function api(method = 'GET', body) {
  return requestJson('/api/admin', {
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

async function boot() {
  if (!tg?.initData) {
    setAccess(
      'error',
      'Откройте через Telegram',
      'Прямой вход закрыт. Запустите админ-бота и нажмите кнопку «Открыть админ-панель».'
    );
    await loadBotLink();
    return;
  }

  try {
    const data = await api();
    setAccess(
      'ok',
      'Доступ подтверждён',
      `Администратор: ${data.user?.first_name || data.user?.username || data.user?.id}`
    );
    document.getElementById('admin-subtitle').textContent = `Telegram ID ${data.user.id} · ${data.role}`;
    setStatus('status-bot', data.services.bot);
    setStatus('status-ai', data.services.readings);
    setStatus('status-app', data.services.webAppUrl);
    setStatus('status-access', data.accessConfigured, 'Защищён', 'Не настроен');
    applySettings(data.settings);
    dashboard.hidden = false;

    if (!data.persistenceConfigured) {
      saveState.textContent = 'Нет серверного хранилища';
      notify('Нужно подключить Supabase к Vercel');
    }
  } catch (error) {
    if (error.status === 403 && error.data?.userId) {
      setAccess(
        'error',
        'Ожидается подтверждение владельца',
        `Ваш Telegram ID: ${error.data.userId}. Запрос зарегистрирован — доступ будет выдан владельцу проекта.`
      );
      document.getElementById('admin-subtitle').textContent = `Telegram ID ${error.data.userId}`;
    } else if (error.status === 401) {
      setAccess('error', 'Сессия Telegram истекла', 'Закройте панель и снова откройте её кнопкой в админ-боте.');
    } else {
      setAccess('error', 'Ошибка подключения', 'Не удалось подтвердить доступ. Повторите запуск из Telegram.');
    }
  }
}

form.addEventListener('input', () => {
  saveState.textContent = 'Есть несохранённые изменения';
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = form.querySelector('button[type=submit]');
  const values = {};

  for (const [key, value] of new FormData(form).entries()) values[key] = value;
  for (const checkbox of form.querySelectorAll('input[type=checkbox]')) {
    values[checkbox.name] = checkbox.checked;
  }
  for (const number of form.querySelectorAll('input[type=number]')) {
    values[number.name] = Number(number.value);
  }

  button.disabled = true;
  saveState.textContent = 'Сохраняем…';
  try {
    const result = await api('POST', { settings: values });
    if (!result.persisted) throw new Error('persistence_not_configured');
    saveState.textContent = 'Настройки сохранены';
    notify('Изменения применены');
    tg?.HapticFeedback?.notificationOccurred?.('success');
  } catch {
    saveState.textContent = 'Не удалось сохранить';
    notify('Ошибка серверного сохранения');
    tg?.HapticFeedback?.notificationOccurred?.('error');
  } finally {
    button.disabled = false;
  }
});

boot();
