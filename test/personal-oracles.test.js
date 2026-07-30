import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

import { structuredSchemaForFeature } from '../lib/readings.js';
import { TAROT_CARD_NAMES, tarotCardImage } from '../ui-kit/core/tarot-deck.js';

const app = readFileSync(new URL('../ui-kit/app.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../ui-kit/app.css', import.meta.url), 'utf8');
const migration = readFileSync(
  new URL('../supabase/migrations/20260730181044_add_personalized_oracle_and_amur.sql', import.meta.url),
  'utf8'
);
const store = readFileSync(
  new URL('../supabase/functions/nastardamus-user-store/index.ts', import.meta.url),
  'utf8'
);
const admin = readFileSync(new URL('../api/admin.js', import.meta.url), 'utf8');
const vercel = readFileSync(new URL('../vercel.json', import.meta.url), 'utf8');

test('Tarot uses one unique 78-card deck with a real asset for every card', () => {
  assert.equal(TAROT_CARD_NAMES.length, 78);
  assert.equal(new Set(TAROT_CARD_NAMES).size, 78);
  for (const card of TAROT_CARD_NAMES) {
    const asset = tarotCardImage(card);
    assert.ok(asset.startsWith('/images/cards/'));
    assert.ok(existsSync(new URL(`..${asset}`, import.meta.url)), `Missing card asset: ${card}`);
  }
  assert.doesNotMatch(app, /function compatibilityScore/);
  assert.match(app, /cryptoIndex\(available\.length\)/);
});

test('personal forecasts use strict structured results instead of decorative prose', () => {
  for (const feature of [
    'daily_horoscope',
    'sports_forecast',
    'palm_reading',
    'rune_reading',
    'amur_compatibility'
  ]) {
    const structured = structuredSchemaForFeature(feature);
    assert.ok(structured?.name, `${feature} schema is missing`);
    assert.equal(structured.schema.type, 'object');
    assert.equal(structured.schema.additionalProperties, false);
    assert.ok(structured.schema.required.length >= 5);
  }
});

test('registration, avatar and mobile keyboard journeys are wired end to end', () => {
  assert.match(app, /field\('Возраст'/);
  assert.match(app, /field\('Город'/);
  assert.match(app, /tg\?\.initDataUnsafe\?\.user\?\.photo_url/);
  assert.match(app, /action:\s*'upload_avatar'/);
  assert.match(app, /action:\s*'remove_avatar'/);
  assert.match(app, /window\.visualViewport\?\.addEventListener\('resize'/);
  assert.match(app, /scrollIntoView\?\.\(\{\s*block:\s*'center',\s*behavior:\s*'smooth'/);
  assert.match(app, /quality = reducedMotion \|\| memory <= 2 \|\| cores <= 2/);
  assert.match(css, /data-visual-quality="lite"/);
  assert.match(css, /body\.is-keyboard-open \.n-bottom-navigation/);
  assert.match(vercel, /img-src 'self' data: blob: https:/);
  assert.match(vercel, /camera=\(self\)/);
});

test('palm dialogue and Amur invitation state are stored privately on the server', () => {
  assert.match(migration, /nastardamus_reading_messages/);
  assert.match(migration, /revoke all on table public\.nastardamus_reading_messages from public, anon, authenticated/);
  assert.match(migration, /initiator_profile jsonb/);
  assert.match(migration, /participant_profile jsonb/);
  assert.match(migration, /analysis_requested_at timestamptz/);
  assert.match(store, /action === "create_dialogue_session"/);
  assert.match(store, /action === "append_dialogue_message"/);
  assert.match(store, /action === "request_joint_analysis"/);
  assert.match(app, /Проверить совместимость/);
  assert.match(app, /invitation_start/);
});

test('cloud history preserves complete results and supports cloud-only controls', () => {
  assert.match(app, /participants:\s*Array\.isArray\(result\.participants\)/);
  assert.match(app, /cards:\s*Array\.isArray\(ui\.cards\)/);
  assert.match(app, /const target = cloud \|\| entry/);
  assert.match(app, /if \(!entry && !cloud\) return/);
  assert.match(app, /\['compatibility', 'amur'\]\.includes\(historyKind\(entry\)\)/);
  assert.match(store, /action === "save_reading"/);
  assert.match(store, /action === "update_reading" \|\| action === "delete_reading"/);
});

test('administrators can manage every Tarot and compatibility catalog entry', () => {
  assert.match(admin, /data-tab=\\"content\\"/);
  assert.match(admin, /Таро и практики/);
  assert.match(admin, /tarotContentDefinitions/);
  assert.match(admin, /compatibilityContentDefinitions/);
  assert.match(admin, /sanitizeTarotCatalog/);
  assert.match(admin, /sanitizeCompatibilityCatalog/);
  assert.match(admin, /1 SILARUM = 100 ₽/);
});
