import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { JSDOM } from 'jsdom';

test('reconciliation journey renders its designed states without exposing private controls', async () => {
  const dom = new JSDOM('<!doctype html><div id="premium-app"></div><div id="premium-toast"></div>', {
    url: 'https://nastardamus.example/?screen=reconciliation',
    pretendToBeVisual: true
  });
  const previousFetch = globalThis.fetch;
  const browserGlobals = {
    window: dom.window,
    document: dom.window.document,
    Node: dom.window.Node,
    navigator: dom.window.navigator,
    history: dom.window.history,
    location: dom.window.location,
    localStorage: dom.window.localStorage,
    FileReader: dom.window.FileReader,
    Image: dom.window.Image
  };
  for (const [key, value] of Object.entries(browserGlobals)) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  dom.window.scrollTo = () => {};
  dom.window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
  globalThis.fetch = async () => ({ ok: false, status: 401, json: async () => ({ error: 'telegram_auth_required' }) });

  try {
    const app = await import(`../ui-kit/app.js?reconciliation-ui=${Date.now()}`);
    app.state.reconciliationPolicy = {
      enabled: true,
      maxParticipants: 8,
      prices: { create: 10, participate: 5, group: 30 },
      conflictTypes: ['friendship', 'family'],
      tools: { runes: true, tarot: true, palmistry: false, astrology: true, combined: false }
    };
    app.navigate('reconciliation');
    const mount = document.getElementById('premium-app');
    assert.equal(mount.dataset.screen, 'reconciliation');
    assert.ok(mount.querySelector('.world--reconciliation'));
    assert.ok(mount.querySelector('.reconciliation-hero'));
    assert.match(mount.textContent, /До 8 участников/u);

    [...document.querySelectorAll('button')].find((button) => button.textContent.includes('Создать запрос')).click();
    assert.equal(mount.dataset.screen, 'reconciliation-create');
    assert.match(mount.textContent, /Группа до 8/u);
    assert.equal([...document.querySelectorAll('select')][0].textContent.includes('Романтический'), false);

    app.state.reconciliationToken = 'a'.repeat(32);
    app.state.reconciliationStatus = 'ready';
    app.state.reconciliation = {
      token: app.state.reconciliationToken,
      preview: true,
      initiatorName: 'Анна',
      participantMode: 'pair',
      participantNames: ['Анна', 'Алексей'],
      goal: 'understanding', invitationTone: 'warm', status: 'invited',
      expiresAt: new Date(Date.now() + 3_600_000).toISOString()
    };
    app.navigate('reconciliation-room');
    assert.ok(mount.querySelector('.reconciliation-invite'));
    assert.ok(document.querySelector('input[placeholder="Как к вам обращаться"]'));
    assert.match(mount.textContent, /наблюдателем/u);

    app.state.reconciliation = {
      id: 'case-1', token: app.state.reconciliationToken, preview: false,
      title: 'Примирение: Анна и Алексей', initiatorName: 'Анна',
      participantMode: 'pair', participantNames: ['Анна', 'Алексей'],
      conflictType: 'friendship', reason: 'misunderstanding', goal: 'understanding',
      status: 'waiting', stage: 'intake', maxParticipants: 2,
      viewer: { own: true, role: 'owner', status: 'active', displayName: 'Анна', ready: true, resolutionVote: '' },
      members: [{ own: true, role: 'owner', status: 'active', displayName: 'Анна', ready: true }],
      messages: [{ id: 'm1', role: 'system', senderName: 'Эзотериум', visibility: 'public', content: 'Комната создана' }],
      tools: [], outcomeKind: '', outcomeText: ''
    };
    app.render();
    assert.match(mount.textContent, /Ждём согласия всех/u);
    assert.equal(mount.querySelector('.esoterium-chat__composer'), null);
  } finally {
    globalThis.fetch = previousFetch;
    dom.window.close();
  }
});

test('admin bundle contains reconciliation controls and in-panel back navigation', () => {
  const admin = readFileSync(new URL('../api/admin.js', import.meta.url), 'utf8');
  assert.match(admin, /data-tab=\\"reconciliation\\"/u);
  assert.match(admin, /reconciliation-settings-form/u);
  assert.match(admin, /admin-section-back/u);
  assert.match(admin, /tabHistory/u);
});
