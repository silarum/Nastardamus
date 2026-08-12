import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { dailyVariationKey, localMoment } from '../api/daily-horoscope.js';

const migration = readFileSync(
  new URL('../supabase/migrations/20260728131204_add_user_gender_preference.sql', import.meta.url),
  'utf8'
);
const store = readFileSync(
  new URL('../supabase/functions/nastardamus-user-store/index.ts', import.meta.url),
  'utf8'
);
const preferencesApi = readFileSync(new URL('../api/preferences.js', import.meta.url), 'utf8');
const horoscopeApi = readFileSync(new URL('../api/daily-horoscope.js', import.meta.url), 'utf8');

test('gender preference migration stays private and accepts only explicit values', () => {
  assert.match(migration, /add column if not exists gender text not null default 'unspecified'/);
  assert.match(migration, /check \(gender in \('female', 'male', 'unspecified'\)\)/);
  assert.match(migration, /revoke all on table public\.nastardamus_users from public, anon, authenticated/);
  assert.doesNotMatch(migration, /grant .* to (?:anon|authenticated)/);
});

test('preferences API and user store validate and persist gender', () => {
  assert.match(preferencesApi, /gender:\s*req\.body\?\.gender/);
  assert.match(store, /\["female", "male", "unspecified"\]\.includes\(gender\)/);
  assert.match(store, /payload\.gender = gender/);
  assert.match(store, /select=profile_name,zodiac_sign,daily_horoscope_enabled,timezone,gender/);
});

test('scheduled horoscopes are personal and delivered in the recipient local morning', () => {
  const now = new Date('2026-08-08T05:15:00.000Z');
  assert.deepEqual(localMoment({ timezone: 'Europe/Berlin' }, now), {
    timezone: 'Europe/Berlin', date: '2026-08-08', hour: 7
  });
  assert.equal(localMoment({ timezone: 'Invalid/Zone' }, now).timezone, 'UTC');
  assert.equal(dailyVariationKey(101, '2026-08-08'), dailyVariationKey(101, '2026-08-08'));
  assert.notEqual(dailyVariationKey(101, '2026-08-08'), dailyVariationKey(102, '2026-08-08'));
  assert.match(horoscopeApi, /createHoroscope\(\{[\s\S]*\.\.\.person/);
  assert.match(horoscopeApi, /person\.last_horoscope_sent_on/);
  assert.match(horoscopeApi, /local\.hour >= 7 && local\.hour <= 9/);
  assert.match(horoscopeApi, /const slot = Math\.floor\(now\.getTime\(\) \/ 600000\)/);
  assert.match(horoscopeApi, /attempted: due\.length/);
  assert.doesNotMatch(horoscopeApi, /const groups = new Map/);
});
