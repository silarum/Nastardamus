import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  INSPIRATION_PHRASES, analyzePersonalEvent, dailyEnergy, goalProgress,
  nextPersonalEvents, normalizePersonalEvent, normalizePersonalTask, numerologyNumber,
  personalDateKey, taskDueOn
} from '../lib/personal-space.js';

test('personal space has a stable daily energy and a broad inspiration pool', () => {
  const date = new Date('2026-08-01T12:00:00');
  assert.equal(personalDateKey(date), '2026-08-01');
  assert.equal(numerologyNumber(date), 1);
  assert.equal(dailyEnergy(date).number, 1);
  assert.ok(INSPIRATION_PHRASES.length >= 30);
});

test('events validate required fields and produce the five-part Esoterium analysis', () => {
  const event = normalizePersonalEvent({
    eventId: '027c5390-81e7-4cc7-8bbc-1b02d9d647ff', title: 'Важный разговор',
    date: '2026-08-03', time: '18:30', category: 'love', priority: 'high'
  }, { today: '2026-08-01' });
  const analysis = analyzePersonalEvent(event, dailyEnergy(new Date('2026-08-03T12:00:00')));
  assert.deepEqual(Object.keys(analysis), ['energy', 'opportunities', 'risks', 'recommendation', 'question']);
  assert.match(analysis.question, /Что ты чувствуешь/);
  assert.throws(() => normalizePersonalEvent({ title: 'x', date: '2026-08-03' }, { today: '2026-08-01' }), /event_title_too_short/);
});

test('recurring tasks and goal progress are calculated for the current day', () => {
  const today = new Date('2026-08-01T12:00:00');
  const task = normalizePersonalTask({ taskId: 'a', goalId: 'g', title: 'Двадцать минут практики', recurrence: 'daily', scheduledDate: '2026-07-30', completedDates: ['2026-08-01'] });
  assert.equal(taskDueOn(task, today), true);
  assert.deepEqual(goalProgress('g', [task], today), { completed: 1, total: 1, percent: 100 });
});

test('dashboard selects only three nearest active events', () => {
  const events = ['04', '01', '02', '03'].map((day) => ({ eventId: day, title: day, date: `2026-08-${day}`, time: '', status: 'active' }));
  assert.deepEqual(nextPersonalEvents(events, new Date('2026-08-01T12:00:00')).map((event) => event.eventId), ['01', '02', '03']);
});

test('Telegram boot stays visible until the application explicitly reports readiness', () => {
  const gate = readFileSync(new URL('../ui-kit/telegram-entry-gate.js', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../ui-kit/app.js', import.meta.url), 'utf8');
  assert.doesNotMatch(gate, /recoverBootScreen/);
  assert.match(gate, /BOOT_SLOW_MS/);
  assert.match(gate, /data-boot-retry/);
  assert.match(app, /dataset\.appReady = 'true'/);
});
