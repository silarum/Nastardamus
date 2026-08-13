import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { buildOracleRoomAgentRequest, ORACLE_ROOM_AGENT_INSTRUCTIONS } from '../lib/oracle-rooms.js';
import { buildReadingDialogueAgentRequest } from '../lib/reading-dialogue.js';
import { classifyDialogueTurn } from '../lib/dialogue-intelligence.js';

const proxy = readFileSync(new URL('../api/proxy.js', import.meta.url), 'utf8');
const admin = readFileSync(new URL('../api/admin.js', import.meta.url), 'utf8');
const client = readFileSync(new URL('../ui-kit/app.js', import.meta.url), 'utf8');
const store = readFileSync(new URL('../supabase/functions/nastardamus-user-store/index.ts', import.meta.url), 'utf8');
const migration = readFileSync(
  new URL('../supabase/migrations/20260809002705_add_dialogue_question_policy.sql', import.meta.url),
  'utf8'
);

test('admin controls included questions and clamps every extra question to at least 0.10 Silarum', () => {
  assert.match(admin, /const DIALOGUE_DEFINITIONS/u);
  assert.match(admin, /DIALOGUE_DEFAULT_CATALOG\[id\]\?\.includedQuestions/u);
  assert.match(admin, /extraQuestionPrice:\s*clampNumber\([\s\S]*item\.extraQuestionPrice,[\s\S]*0,[\s\S]*1_000_000/u);
  assert.match(admin, /data-tab="dialogues"/u);
  assert.match(admin, /Вход в чат бесплатный/u);
  assert.match(admin, /Ответы Эзотериума не расходуют лимит/u);
});

test('only a new answered user question consumes quota and may trigger payment', () => {
  assert.match(proxy, /const requiresPayment = messageKind === 'question'[\s\S]*answeredQuestions >= includedQuestions/u);
  assert.match(proxy, /priceUnits:\s*Math\.max\(10, Math\.round\(extraQuestionPrice \* 100\)\)/u);
  assert.match(proxy, /serviceId: `dialogue_\$\{mode\}`/u);
  assert.match(proxy, /const dialogueSection = dialogueSectionForReading\(context\)/u);
  assert.match(proxy, /serviceId: `dialogue_\$\{dialogueSection\}`/u);
  assert.doesNotMatch(client, /Ответ Эзотериуму · бесплатно/u);
  assert.match(client, /Напишите вопрос, ответ или поправку/u);
  assert.match(proxy, /classifyDialogueTurn/u);
  assert.match(client, /dialogueSectionForReading\(result\)/u);
});

test('dialogue usage counts only question turns that have a saved Esoterium answer', () => {
  assert.match(migration, /question\.message_kind = 'question'[\s\S]*exists \([\s\S]*answer\.role = 'assistant'/u);
  assert.match(migration, /coalesce\(question\.metadata->>'message_kind', 'question'\) = 'question'[\s\S]*answer\.role = 'assistant'/u);
  assert.match(migration, /pg_advisory_xact_lock/u);
  assert.match(migration, /reading_section in \('general', 'path', 'event', 'amur', 'tarot', 'runes', 'palm'\)/u);
  assert.match(migration, /nastardamus_complete_oracle_room_text_preparation/u);
  assert.match(migration, /revoke all on function public\.nastardamus_reading_dialogue_usage[\s\S]*from public, anon, authenticated/u);
  assert.match(migration, /grant execute on function public\.nastardamus_append_reading_dialogue_turn[\s\S]*to service_role/u);
  assert.match(store, /"sports", "path"/u);
});

test('personal dialogue remains grounded in the original section and understands a free answer', () => {
  const request = buildReadingDialogueAgentRequest({
    session: {
      kind: 'path',
      title: 'Важная встреча',
      resultText: 'Сначала сформулируйте желаемый исход.',
      input: { desiredResult: 'спокойно договориться' }
    },
    messages: [{ role: 'assistant', content: 'Что для вас будет хорошим исходом?' }]
  }, 'Я хочу выйти с ясным решением.', 'answer', 'Анна');

  assert.match(request.message, /Раздел: личный путь/u);
  assert.match(request.message, /clarification_answer/u);
  assert.match(request.message, /Имя пользователя: Анна/u);
  assert.equal(request.history.length, 1);
});

test('server separates a paid question from a free correction or dialogue repair', () => {
  const history = [{ role: 'assistant', content: 'Где именно вы чувствуете выбор?' }];
  assert.equal(classifyDialogueTurn({ message: 'В работе.', history }).messageKind, 'answer');
  assert.deepEqual(classifyDialogueTurn({ message: 'Ты вообще понимаешь, что я тебе говорю???', history }), {
    intent: 'repair',
    messageKind: 'answer',
    billable: false,
    hasPriorQuestion: true
  });
  assert.equal(classifyDialogueTurn({ message: 'Поменяю ли я работу в этом месяце?', history }).messageKind, 'question');
  assert.equal(classifyDialogueTurn({ message: 'С чего ты это взял?', history }).intent, 'repair');
  assert.equal(classifyDialogueTurn({ message: 'Почему ты так думаешь?', history }).billable, false);
  assert.equal(classifyDialogueTurn({ message: 'Нет, я говорил о работе, а не об отношениях.', history }).intent, 'correction');
});

test('dialogue repair keeps Esoterium confident and checks the exact point of disagreement', () => {
  const request = buildReadingDialogueAgentRequest({
    session: { kind: 'palm', title: 'Смена работы', resultText: 'В линии головы виден поворот.' },
    messages: [
      { role: 'user', content: 'Поменяю ли я работу без потерь?' },
      { role: 'assistant', content: 'Где вы чувствуете выбор?' }
    ]
  }, 'Ты вообще понимаешь, что я говорю?', 'question', 'Ник');

  assert.match(request.message, /Распознанная функция реплики: repair/u);
  assert.match(request.message, /Не извиняйся[\s\S]*две конкретные точки возможного расхождения/u);
});

test('palm reading starts from the photo and question without a canned four-step questionnaire', () => {
  assert.doesNotMatch(client, /PALM_QUESTIONS|Я понял направление вопроса|Эта область обозначена|Контекст стал яснее/u);
  assert.match(client, /Прочитать ладонь и открыть разговор/u);
  assert.match(client, /requestReading\('palm_reading'/u);
});

test('group facilitator sees every active participant and distinguishes answers from new questions', () => {
  const request = buildOracleRoomAgentRequest({
    mode: 'group',
    readingSection: 'path',
    title: 'Круг желаний',
    focus: 'Общее намерение',
    members: [
      { telegramId: 880001, displayName: 'Анна', role: 'owner', status: 'active', isViewer: true, palmDescription: 'Ясная линия сердца.' },
      { telegramId: 880002, displayName: 'Иван', role: 'member', status: 'active', palmDescription: 'Развилка линии жизни.' }
    ],
    messages: []
  }, {
    turnId: '743a8d3f-7654-4d1e-aeed-1fc420fc1282',
    message: 'Мне важнее спокойствие.',
    messageKind: 'answer'
  });

  assert.match(request.message, /Активные участники: Анна \(создатель\), Иван/u);
  assert.match(request.message, /Выбранный раздел группового расклада: желания и личный путь/u);
  assert.match(request.message, /clarification_answer[\s\S]*не новый платный вопрос/u);
  assert.match(ORACLE_ROOM_AGENT_INSTRUCTIONS, /по очереди обращайся к каждому активному участнику по имени/u);
});
