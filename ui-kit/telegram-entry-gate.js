const BOT_USERNAME = 'BelonTip_bot';
const GATE_ID = 'telegram-entry-gate';
const TELEGRAM_WAIT_MS = 1800;
const TELEGRAM_LATE_READY_MS = 12_000;
const BOOT_SLOW_MS = 7_000;
const BOOT_RETRY_MS = 20_000;

function announceTelegramReady() {
  const webApp = window.Telegram?.WebApp;
  if (!webApp) return false;
  webApp.ready?.();
  webApp.expand?.();
  return true;
}

function markSlowBoot() {
  const boot = document.getElementById('boot-screen');
  if (!boot || boot.classList.contains('is-hidden') || document.documentElement.dataset.appReady === 'true') return;
  boot.classList.add('is-slow');
  const status = boot.querySelector('[data-boot-status]');
  if (status) status.textContent = 'Связь медленная… продолжаем загружать пространство';
}

function offerBootRetry() {
  const boot = document.getElementById('boot-screen');
  if (!boot || boot.classList.contains('is-hidden') || document.documentElement.dataset.appReady === 'true') return;
  markSlowBoot();
  const retry = boot.querySelector('[data-boot-retry]');
  if (retry) retry.hidden = false;
}

if (!announceTelegramReady()) {
  document.getElementById('telegram-web-app-sdk')?.addEventListener('load', announceTelegramReady, { once: true });
}
window.setTimeout(markSlowBoot, BOOT_SLOW_MS);
window.setTimeout(offerBootRetry, BOOT_RETRY_MS);
document.querySelector('[data-boot-retry]')?.addEventListener('click', () => window.location.reload());

function hasSignedTelegramLaunch() {
  return Boolean(window.Telegram?.WebApp?.initData);
}

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

function openBot() {
  const url = `https://t.me/${BOT_USERNAME}?start=app`;
  if (window.Telegram?.WebApp?.openTelegramLink) {
    window.Telegram.WebApp.openTelegramLink(url);
    return;
  }
  window.location.assign(url);
}

function createGate() {
  const gate = makeElement('section', 'telegram-entry-gate');
  gate.id = GATE_ID;
  gate.setAttribute('role', 'dialog');
  gate.setAttribute('aria-live', 'polite');
  gate.style.cssText = [
    'position:fixed',
    'inset:0',
    'z-index:2000',
    'display:grid',
    'place-items:center',
    'padding:28px',
    'background:radial-gradient(circle at 50% 12%,rgba(105,40,145,.35),transparent 36%),#070913',
    'color:#f7dda0',
    'font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    'text-align:center'
  ].join(';');

  const card = makeElement('div', 'telegram-entry-gate__card');
  card.style.cssText = [
    'width:min(100%,390px)',
    'padding:30px 24px',
    'border:1px solid rgba(226,177,78,.52)',
    'border-radius:24px',
    'background:linear-gradient(160deg,rgba(30,20,45,.97),rgba(8,9,18,.98))',
    'box-shadow:0 22px 70px rgba(0,0,0,.55),0 0 38px rgba(130,57,174,.2)'
  ].join(';');

  const sigil = makeElement('div', 'telegram-entry-gate__sigil', '✦');
  sigil.style.cssText = 'font:34px/1 Georgia,serif;color:#efd078;text-shadow:0 0 22px #9c43c9';
  const title = makeElement('h1', 'telegram-entry-gate__title', 'Проверяем путь входа…');
  title.style.cssText = 'margin:17px 0 10px;font:600 25px/1.2 Georgia,serif';
  const copy = makeElement('p', 'telegram-entry-gate__copy', 'Nastardamus подтверждает защищённый запуск из Telegram.');
  copy.style.cssText = 'margin:0;color:#d3c7da;font-size:14px;line-height:1.65';
  const button = makeElement('button', 'telegram-entry-gate__button', 'Открыть бота Nastardamus');
  button.type = 'button';
  button.hidden = true;
  button.style.cssText = [
    'width:100%',
    'margin-top:22px',
    'padding:14px 18px',
    'border:1px solid #e5bd62',
    'border-radius:999px',
    'background:linear-gradient(135deg,#f0ce77,#a96f22)',
    'color:#17101d',
    'font-size:15px',
    'font-weight:800',
    'cursor:pointer'
  ].join(';');
  button.addEventListener('click', openBot);

  card.append(sigil, title, copy, button);
  gate.append(card);
  document.body.append(gate);
  return { gate, title, copy, button };
}

function allowEntry(gate) {
  document.documentElement.dataset.telegramEntry = 'allowed';
  gate.remove();
  announceTelegramReady();
}

function denyDirectEntry(parts) {
  document.documentElement.dataset.telegramEntry = 'denied';
  parts.title.textContent = 'Вход только через Telegram';
  parts.copy.textContent = 'Откройте чат @BelonTip_bot и нажмите кнопку «Войти в Nastardamus». Это защищает ваш профиль, баланс SILARUM и оплаченные услуги.';
  parts.button.hidden = false;
}

function startEntryGate() {
  if (hasSignedTelegramLaunch()) {
    document.documentElement.dataset.telegramEntry = 'allowed';
    announceTelegramReady();
    return;
  }

  const parts = createGate();
  const startedAt = Date.now();
  const timer = window.setInterval(() => {
    if (hasSignedTelegramLaunch()) {
      window.clearInterval(timer);
      allowEntry(parts.gate);
      return;
    }

    const elapsed = Date.now() - startedAt;
    if (elapsed >= TELEGRAM_WAIT_MS && parts.button.hidden) denyDirectEntry(parts);
    if (elapsed >= TELEGRAM_LATE_READY_MS) window.clearInterval(timer);
  }, 100);
}

startEntryGate();
