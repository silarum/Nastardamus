import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import {
  buildBotReply,
  buildMarketingKeyboard,
  classifyBotQuestion,
  getMarketingRoute
} from '../lib/bot-replies.js';

const WEB_APP_URL = 'https://nastardamus.vercel.app';

function update(text, userId = 101) {
  return {
    message: {
      text,
      chat: { id: 202 },
      from: { id: userId }
    }
  };
}

test('/start shows only the welcome entry and never exposes admin panel', () => {
  const reply = buildBotReply(update('/start', 101), WEB_APP_URL, { adminIds: [101] });
  assert.equal(reply.method, 'sendMessage');
  assert.match(reply.payload.text, /Добро пожаловать/u);
  assert.equal(reply.payload.reply_markup.inline_keyboard.length, 1);
  assert.match(reply.payload.reply_markup.inline_keyboard[0][0].text, /Войти в Эзотериум/u);
  assert.equal(JSON.stringify(reply.payload.reply_markup).includes('Админ'), false);
});

test('/admin reveals panel only to an authorized administrator', () => {
  const denied = buildBotReply(update('/admin', 303), WEB_APP_URL, { adminIds: [101] });
  assert.match(denied.payload.text, /Добро пожаловать в Эзотериум/u);
  assert.match(denied.payload.reply_markup.inline_keyboard[0][0].text, /Войти в Эзотериум/u);
  assert.equal(JSON.stringify(denied).toLowerCase().includes('админ'), false);
  assert.equal(JSON.stringify(denied).includes('/admin'), false);

  const allowed = buildBotReply(update('/admin', 101), WEB_APP_URL, { adminIds: [101] });
  assert.match(allowed.payload.text, /Панель управления/u);
  assert.match(allowed.payload.reply_markup.inline_keyboard[0][0].web_app.url, /\/admin\/$/u);
});

test('topic policy accepts Nastardamus questions and rejects unrelated chat', () => {
  assert.equal(classifyBotQuestion('Как купить силарумы по СБП?').allowed, true);
  assert.equal(classifyBotQuestion('Какой расклад Таро выбрать?').allowed, true);
  assert.equal(classifyBotQuestion('Привет!').allowed, true);
  assert.deepEqual(classifyBotQuestion('Какая завтра погода в Берлине?'), {
    allowed: false,
    reason: 'outside_scope'
  });
});

test('marketing route opens the relevant Mini App section without admin links', () => {
  assert.equal(getMarketingRoute('Хочу проверить совместимость по двум фото').screen, 'photo-compat');
  assert.equal(getMarketingRoute('Где купить SILARUM по СБП?').screen, 'topup');
  assert.equal(getMarketingRoute('Покажи колесо фортуны').screen, 'wheel');

  const markup = buildMarketingKeyboard(WEB_APP_URL, 'Какой расклад Таро выбрать?');
  const serialized = JSON.stringify(markup);
  assert.match(markup.inline_keyboard[0][0].web_app.url, /screen=tarot/u);
  assert.equal(serialized.includes('/admin'), false);
});

test('direct web entry is gated before the application bundle starts', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const gate = readFileSync(new URL('../ui-kit/telegram-entry-gate.js', import.meta.url), 'utf8');
  assert.ok(html.indexOf('/ui-kit/telegram-entry-gate.js') < html.indexOf('/ui-kit/app.bundle.js'));
  assert.ok(html.indexOf('/ui-kit/app.bundle.js') < html.indexOf('telegram-web-app.js'));
  assert.match(gate, /WebApp\?\.initData/u);
  assert.match(gate, /Вход только через Telegram/u);
  assert.match(gate, /BelonTip_bot/u);
});

test('the obsolete GitHub Pages Telegram button redirects to the canonical app before assets load', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const redirect = readFileSync(new URL('../ui-kit/canonical-entry.js', import.meta.url), 'utf8');
  assert.ok(html.indexOf('./ui-kit/canonical-entry.js') < html.indexOf('/images/splash-v2.webp'));

  let redirectedTo = '';
  let stopped = false;
  const location = {
    href: 'https://silarum.github.io/Nastardamus/?screen=tarot#reading',
    replace(value) { redirectedTo = value; }
  };
  runInNewContext(redirect, {
    URL,
    window: {
      location,
      document: {
        currentScript: { src: 'https://silarum.github.io/Nastardamus/ui-kit/canonical-entry.js' },
        documentElement: { dataset: {} }
      },
      stop() { stopped = true; }
    }
  });

  assert.equal(stopped, true);
  assert.equal(redirectedTo, 'https://nastardamus.vercel.app/?screen=tarot#reading');
});
