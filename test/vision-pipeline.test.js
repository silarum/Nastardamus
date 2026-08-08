import assert from 'node:assert/strict';
import test from 'node:test';

import {
  analyzeVisionImages,
  injectVisionAnalysis,
  VISION_ANALYSIS_SCHEMA
} from '../lib/vision.js';

const TINY_IMAGE = 'data:image/webp;base64,AA==';

function validAnalysis(overrides = {}) {
  return {
    feature: 'photo_energy',
    status: 'ok',
    imageCount: 1,
    images: [{
      index: 1,
      subject: 'portrait',
      quality: 'good',
      composition: 'Портрет расположен в центре кадра.',
      lighting: 'Мягкий боковой свет.',
      poseOrGesture: 'Плечи развёрнуты к камере.',
      facialExpression: 'Губы сомкнуты, взгляд направлен в камеру.',
      palmDetails: [],
      visibleDetails: ['Светлый однотонный фон'],
      uncertainty: 'Часть одежды вне кадра.'
    }],
    safety: {
      apparentMinor: false,
      intimateContent: false,
      graphicViolence: false,
      identityDocument: false,
      unreadable: false
    },
    limitations: ['Наблюдения ограничены ракурсом изображения.'],
    safeDisclaimer: 'Это описание видимых признаков, а не вывод о личности, здоровье, чувствах, судьбе или магическом воздействии.',
    ...overrides
  };
}

test('Vision uses an OpenAI-compatible endpoint and returns validated JSON', async () => {
  const previousFetch = global.fetch;
  let request;
  global.fetch = async (url, options) => {
    request = { url, headers: options.headers, body: JSON.parse(options.body) };
    return {
      ok: true,
      status: 200,
      headers: { get: (name) => name === 'request-id' ? 'vision-provider-id' : null },
      json: async () => ({
        choices: [{ message: { content: JSON.stringify(validAnalysis()) } }]
      })
    };
  };

  try {
    const result = await analyzeVisionImages({
      feature: 'photo_energy',
      images: [TINY_IMAGE],
      requestId: 'app-request-id',
      apiKey: 'vision-secret',
      baseUrl: 'https://vision.example/v1',
      model: 'glm-4v-flash'
    });
    assert.equal(result.status, 'ok');
    assert.equal(result.images[0].lighting, 'Мягкий боковой свет.');
    assert.equal(request.url, 'https://vision.example/v1/chat/completions');
    assert.equal(request.headers.Authorization, 'Bearer vision-secret');
    assert.equal(request.body.model, 'glm-4v-flash');
    assert.deepEqual(request.body.response_format, { type: 'json_object' });
    assert.equal(request.body.messages[1].content[1].image_url.url, TINY_IMAGE);
    assert.match(request.body.messages[1].content[0].text, /JSON Schema/u);
    assert.equal(VISION_ANALYSIS_SCHEMA.additionalProperties, false);
  } finally {
    global.fetch = previousFetch;
  }
});

test('Vision retries once when a provider returns malformed JSON', async () => {
  const previousFetch = global.fetch;
  let calls = 0;
  global.fetch = async () => {
    calls += 1;
    return {
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({
        choices: [{ message: { content: calls === 1 ? 'not-json' : JSON.stringify(validAnalysis()) } }]
      })
    };
  };

  try {
    const result = await analyzeVisionImages({
      feature: 'photo_energy',
      images: [TINY_IMAGE],
      requestId: 'retry-request-id',
      apiKey: 'vision-secret',
      baseUrl: 'https://vision.example/v1',
      model: 'qwen-vl-flash'
    });
    assert.equal(result.status, 'ok');
    assert.equal(calls, 2);
  } finally {
    global.fetch = previousFetch;
  }
});

test('existing OpenRouter key enables the default multimodal Vision router', async () => {
  const previousFetch = global.fetch;
  const previous = {
    VISION_API_KEY: process.env.VISION_API_KEY,
    VISION_BASE_URL: process.env.VISION_BASE_URL,
    VISION_MODEL: process.env.VISION_MODEL,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    OPENROUTER_VISION_MODEL: process.env.OPENROUTER_VISION_MODEL,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY
  };
  let request;
  delete process.env.VISION_API_KEY;
  delete process.env.VISION_BASE_URL;
  delete process.env.VISION_MODEL;
  process.env.OPENROUTER_API_KEY = 'existing-openrouter-key';
  delete process.env.OPENROUTER_VISION_MODEL;
  process.env.OPENAI_API_KEY = 'legacy-openai-key';
  global.fetch = async (url, options) => {
    request = { url, headers: options.headers, body: JSON.parse(options.body) };
    return {
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({
        choices: [{ message: { content: JSON.stringify(validAnalysis()) } }]
      })
    };
  };

  try {
    const result = await analyzeVisionImages({
      feature: 'photo_energy',
      images: [TINY_IMAGE],
      requestId: 'openrouter-default-test'
    });
    assert.equal(result.status, 'ok');
    assert.equal(request.url, 'https://openrouter.ai/api/v1/chat/completions');
    assert.equal(request.headers.Authorization, 'Bearer existing-openrouter-key');
    assert.equal(request.body.model, 'openrouter/free');
  } finally {
    global.fetch = previousFetch;
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

test('Vision JSON replaces image data before DeepSeek receives the prompt', () => {
  const messages = [
    { role: 'system', content: 'Существующий системный промпт.' },
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Существующий пользовательский промпт.' },
        { type: 'image_url', image_url: { url: TINY_IMAGE } }
      ]
    }
  ];
  const prepared = injectVisionAnalysis(messages, validAnalysis());

  assert.equal(prepared[0].content, 'Существующий системный промпт.');
  assert.match(prepared[1].content, /Существующий пользовательский промпт/u);
  assert.match(prepared[1].content, /# Данные шага Vision/u);
  assert.match(prepared[1].content, /Мягкий боковой свет/u);
  assert.doesNotMatch(JSON.stringify(prepared), /data:image|AA==/u);
  assert.ok(prepared.every((message) => typeof message.content === 'string'));
});

test('unsafe Vision flags force reject status even if the provider says ok', async () => {
  const previousFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    status: 200,
    headers: { get: () => null },
    json: async () => ({
      choices: [{
        message: {
          content: JSON.stringify(validAnalysis({
            safety: {
              apparentMinor: false,
              intimateContent: false,
              graphicViolence: false,
              identityDocument: true,
              unreadable: false
            }
          }))
        }
      }]
    })
  });

  try {
    const result = await analyzeVisionImages({
      feature: 'photo_energy',
      images: [TINY_IMAGE],
      requestId: 'unsafe-request-id',
      apiKey: 'vision-secret',
      baseUrl: 'https://vision.example/v1',
      model: 'glm-4v-flash'
    });
    assert.equal(result.status, 'reject');
    assert.equal(result.safety.identityDocument, true);
  } finally {
    global.fetch = previousFetch;
  }
});
