import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

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

test('scheduled horoscopes are grouped by sign, gender, age and city', () => {
  assert.match(horoscopeApi, /person\.zodiac_sign,[\s\S]*normalizeGender\(person\.gender\)/);
  assert.match(horoscopeApi, /person\.birth_year/);
  assert.match(horoscopeApi, /person\.city/);
  assert.match(horoscopeApi, /createHoroscope\(sign, date, gender, Number\(age\), cityParts\.join\(':'\)\)/);
});
