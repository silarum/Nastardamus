import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { JSDOM } from 'jsdom';

const root = fileURLToPath(new URL('..', import.meta.url));
const html = readFileSync(join(root, 'index.html'), 'utf8');
const app = readFileSync(join(root, 'app.js'), 'utf8');

function bootApp() {
    const dom = new JSDOM(html, {
        url: 'https://nastardamus.vercel.app',
        runScripts: 'outside-only',
        pretendToBeVisual: true
    });
    const { window } = dom;
    window.scrollTo = () => {};
    window.alert = () => {};
    window.confirm = () => true;
    window.HTMLMediaElement.prototype.play = () => Promise.resolve();
    window.HTMLMediaElement.prototype.pause = () => {};
    window.fetch = async () => ({
        ok: false,
        status: 401,
        json: async () => ({ error: 'telegram_auth_required' })
    });
    window.eval(app);
    return dom;
}

function enterMenu(document) {
    document.getElementById('continue-btn').click();
    assert.equal(document.querySelector('.screen.active')?.id, 'video-screen');
    document.getElementById('skip-video-btn').click();
    assert.equal(document.querySelector('.screen.active')?.id, 'menu-screen');
}

test('boots the app and navigates through the main product flows', () => {
    const dom = bootApp();
    const { window } = dom;
    const { document } = window;
    assert.equal(document.querySelector('.screen.active')?.id, 'welcome-screen');

    enterMenu(document);
    assert.equal(document.getElementById('tab-bar').hidden, false);

    document.getElementById('go-natal').click();
    assert.equal(document.querySelector('.screen.active')?.id, 'natal-input-screen');
    document.querySelector('#natal-input-screen .back-btn').click();
    assert.equal(document.querySelector('.screen.active')?.id, 'menu-screen');

    document.getElementById('go-tarot').click();
    assert.equal(document.querySelector('.screen.active')?.id, 'tarot-input-screen');
    document.querySelector('#tarot-input-screen .back-btn').click();

    document.getElementById('watch-intro').click();
    assert.equal(document.querySelector('.screen.active')?.id, 'video-screen');
    document.getElementById('skip-video-btn').click();
    assert.equal(document.querySelector('.screen.active')?.id, 'menu-screen');

    dom.window.close();
});

test('reveals the daily card once and saves it to the journal', () => {
    const dom = bootApp();
    const { document } = dom.window;
    enterMenu(document);
    document.getElementById('go-daily').click();

    const card = document.getElementById('daily-card-reveal');
    card.click();
    assert.equal(card.classList.contains('is-revealed'), true);
    assert.equal(document.getElementById('home-mini-card').classList.contains('is-revealed'), true);
    assert.equal(document.getElementById('daily-reading').hidden, false);
    assert.match(document.getElementById('daily-card-image').src, /images\/cards\/.+\.webp$/);
    assert.match(document.getElementById('home-daily-image').src, /images\/cards\/.+\.webp$/);

    document.getElementById('save-daily').click();
    document.querySelector('[data-nav-target="journal-screen"]').click();
    assert.equal(document.querySelectorAll('.journal-entry').length, 1);
    assert.equal(document.getElementById('journal-empty').hidden, true);

    document.querySelector('.favorite-btn').click();
    assert.equal(document.querySelector('.favorite-btn').classList.contains('active'), true);
    assert.equal(document.getElementById('favorite-count').textContent, '1');
    dom.window.close();
});

test('question suggestions populate the tarot form', () => {
    const dom = bootApp();
    const { document } = dom.window;
    enterMenu(document);
    document.getElementById('go-tarot').click();
    assert.equal(document.querySelectorAll('[data-spread-id]').length, 6);
    document.querySelector('[data-spread-id="sign"]').click();
    document.querySelector('[data-question]').click();
    assert.match(document.getElementById('tarot-question').value, /внимание/i);
    document.getElementById('start-tarot').click();
    assert.equal(document.getElementById('cards-left').textContent, '0 / 1');
    assert.match(document.getElementById('spread-progress-title').textContent, /Чёткий знак/);
    dom.window.close();
});

test('exposes safe photo flows and a non-operational Silarum account', () => {
    const dom = bootApp();
    const { document } = dom.window;
    enterMenu(document);

    document.getElementById('go-compat').click();
    assert.ok(document.getElementById('person1-photo'));
    assert.ok(document.getElementById('person2-photo'));
    document.querySelector('#compat-input-screen .back-btn').click();

    document.getElementById('go-energy-photo').click();
    assert.equal(document.querySelector('.screen.active')?.id, 'energy-input-screen');
    assert.match(document.querySelector('#energy-input-screen .helper-copy').textContent, /не может подтвердить/i);
    assert.ok(document.getElementById('energy-consent'));

    document.querySelector('[data-nav-target="wallet-screen"]').click();
    assert.equal(document.querySelector('.screen.active')?.id, 'wallet-screen');
    assert.equal(document.querySelector('.account-balance strong').textContent, '—');
    document.querySelector('[data-finance-action="exchange"]').click();
    assert.match(document.getElementById('toast').textContent, /защищённый backend/i);
    dom.window.close();
});
