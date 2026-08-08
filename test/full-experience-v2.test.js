import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { AMUR_GAME_QUESTIONS, AMUR_QUESTIONS, amurCompatibility, buildAmurProfile } from '../lib/amur-profile.js';
import { buildNatalChart } from '../lib/natal-chart.js';
import { ELDER_FUTHARK, RUNE_SPREADS, castRuneSpread, runeOfDay, searchRunes } from '../lib/rune-temple.js';

const app = readFileSync(new URL('../ui-kit/app.js', import.meta.url), 'utf8');
const store = readFileSync(new URL('../supabase/functions/nastardamus-user-store/index.ts', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../supabase/migrations/20260808194213_full_experience_v2.sql', import.meta.url), 'utf8');

test('Rune Temple exposes the complete Elder Futhark and large spreads', () => {
  assert.equal(ELDER_FUTHARK.length, 24);
  assert.deepEqual(RUNE_SPREADS.map((spread) => spread.count), [1, 3, 5, 6, 9, 12]);
  assert.equal(searchRunes('защита')[0].name, 'Альгиз');
  assert.deepEqual(runeOfDay('profile', new Date('2026-08-08T12:00:00Z')), runeOfDay('profile', new Date('2026-08-08T20:00:00Z')));
  let cursor = 0;
  const values = [.01, .8, .12, .2, .23, .9, .34, .1, .45, .7, .56, .3, .67, .8, .78, .2, .89, .6, .15, .2, .4, .9, .6, .1];
  const cast = castRuneSpread('year-wheel', () => values[cursor++ % values.length]);
  assert.equal(cast.length, 12);
  assert.equal(new Set(cast.map((rune) => rune.name)).size, 12);
  assert.ok(cast.every((rune) => rune.position && typeof rune.reversed === 'boolean'));
});

test('Natal map calculates a full visual chart and marks partial accuracy honestly', () => {
  const full = buildNatalChart({ date: '1991-04-12', time: '08:45', timeKnown: true, place: 'Москва' });
  assert.equal(full.planets.length, 10);
  assert.equal(full.houses.length, 12);
  assert.equal(full.zodiac.length, 12);
  assert.equal(full.accuracy, 'time-based');
  assert.ok(full.planets.every((planet) => planet.longitude >= 0 && planet.longitude < 360));
  const partial = buildNatalChart({ date: '1991-04-12', timeKnown: false, place: 'не знаю' });
  assert.equal(partial.accuracy, 'partial');
});

test('AMUR requires seven private answers and gates chat behind a five-question game', () => {
  assert.equal(AMUR_QUESTIONS.length, 7);
  assert.equal(AMUR_GAME_QUESTIONS.length, 5);
  const answers = Object.fromEntries(AMUR_QUESTIONS.map((question) => [question.id, question.options[0][0]]));
  const profile = buildAmurProfile({ answers, interests: ['growth', 'travel'], goals: ['love'] });
  assert.equal(profile.completeness, 100);
  assert.equal(profile.discoverable, true);
  const compatibility = amurCompatibility(profile, profile);
  assert.ok(compatibility.score >= 80);
  assert.equal(compatibility.protectedGame.length, 5);
});

test('Full experience is routed and private server tables are not client-readable', () => {
  assert.match(app, /'space-consultation': personalConsultationScreen/);
  assert.match(app, /runeOfDay/);
  assert.match(app, /natalSvgMarkup/);
  assert.match(app, /AMUR_QUESTIONS/);
  assert.match(store, /TAROT_MINOR_SUITS/);
  assert.match(store, /set_amur_discovery/);
  for (const table of ['nastardamus_path_items', 'nastardamus_path_consultations', 'nastardamus_rune_preferences', 'nastardamus_amur_profiles', 'nastardamus_amur_connections']) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
    assert.match(migration, new RegExp(`revoke all on public\\.${table} from anon, authenticated`));
  }
});
