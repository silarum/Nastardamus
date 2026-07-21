const ADMIN_STORE_URL = process.env.ADMIN_STORE_URL
  || 'https://hngfpdsnjgdpazmortix.supabase.co/functions/v1/nastardamus-admin-store';

const DEFAULT_OPENROUTER_MODEL = 'deepseek/deepseek-v4-flash:free';

function cleanBaseUrl(value, fallback) {
  const url = String(value || fallback || '').trim().replace(/\/$/, '');
  if (!/^https:\/\//i.test(url)) throw new Error('invalid_ai_base_url');
  return url;
}

function extractOpenAiResponsesText(data) {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) return data.output_text.trim();
  const parts = [];
  for (const item of data?.output || []) {
    for (const content of item?.content || []) {
      if (typeof content?.text === 'string') parts.push(content.text);
    }
  }
  return parts.join('\n').trim();
}

function extractGoogleText(data) {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) return data.output_text.trim();
  const parts = [];
  for (const step of data?.steps || []) {
    if (step?.type !== 'model_output') continue;
    for (const content of step?.content || []) {
      if (typeof content?.text === 'string') parts.push(content.text);
    }
  }
  for (const candidate of data?.candidates || []) {
    for (const part of candidate?.content?.parts || []) {
      if (typeof part?.text === 'string') parts.push(part.text);
    }
  }
  return parts.join('\n').trim();
}

async function edgeStore(botToken, action, payload = {}) {
  if (!botToken) throw new Error('bot_token_missing');
  const response = await fetch(ADMIN_STORE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Bot-Token': botToken
    },
    body: JSON.stringify({ action, ...payload }),
    signal: AbortSignal.timeout(15_000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) throw new Error(data.error || `ai_store_${response.status}`);
  return data;
}

async function loadAgent(botToken, slug) {
  const data = await edgeStore(botToken, 'list_ai_agents');
  return (data.agents || []).find((agent) => agent.slug === slug && agent.enabled) || null;
}

async function resolveProvider(botToken, id) {
  if (!id) return null;
  const data = await edgeStore(botToken, 'resolve_ai_provider', { id });
  return data.provider || null;
}

function normalizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history.slice(-12).flatMap((message) => {
    const role = message?.role === 'assistant' ? 'assistant' : 'user';
    const content = String(message?.content || '').trim().slice(0, 4000);
    return content ? [{ role, content }] : [];
  });
}

async function callOpenAiCompatible(provider, agent, message, history) {
  const base = cleanBaseUrl(provider.base_url, 'https://openrouter.ai/api/v1');
  const endpoint = /\/chat\/completions$/i.test(base) ? base : `${base}/chat/completions`;
  const model = agent.model_override || provider.text_model;
  if (!model) throw new Error('ai_model_missing');
  if (!provider.apiKey) throw new Error('ai_key_missing');

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${provider.apiKey}`,
      'HTTP-Referer': process.env.WEB_APP_URL || 'https://nastardamus.vercel.app',
      'X-Title': 'Nastardamus'
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: agent.instructions || 'Отвечай полезно и кратко.' },
        ...normalizeHistory(history),
        { role: 'user', content: message }
      ],
      temperature: Number(agent.temperature ?? 0.4),
      max_tokens: Number(agent.max_output_tokens || 1200)
    }),
    signal: AbortSignal.timeout(40_000)
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error?.message || `ai_provider_${response.status}`);
  const answer = data?.choices?.[0]?.message?.content;
  if (typeof answer !== 'string' || !answer.trim()) throw new Error('empty_ai_response');
  return { answer: answer.trim(), model: data?.model || model, provider: provider.name };
}

async function callOpenAi(provider, agent, message, history) {
  const base = cleanBaseUrl(provider.base_url, 'https://api.openai.com/v1');
  const endpoint = /\/responses$/i.test(base) ? base : `${base}/responses`;
  const model = agent.model_override || provider.text_model;
  if (!model) throw new Error('ai_model_missing');
  if (!provider.apiKey) throw new Error('ai_key_missing');

  const transcript = normalizeHistory(history)
    .map((item) => `${item.role === 'assistant' ? 'Помощник' : 'Пользователь'}: ${item.content}`)
    .join('\n');
  const input = `${transcript ? `${transcript}\n` : ''}Пользователь: ${message}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.apiKey}` },
    body: JSON.stringify({
      model,
      instructions: agent.instructions || 'Отвечай полезно и кратко.',
      input,
      temperature: Number(agent.temperature ?? 0.4),
      max_output_tokens: Number(agent.max_output_tokens || 1200),
      store: false
    }),
    signal: AbortSignal.timeout(40_000)
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error?.message || `ai_provider_${response.status}`);
  const answer = extractOpenAiResponsesText(data);
  if (!answer) throw new Error('empty_ai_response');
  return { answer, model: data?.model || model, provider: provider.name };
}

async function callAnthropic(provider, agent, message, history) {
  const base = cleanBaseUrl(provider.base_url, 'https://api.anthropic.com');
  const endpoint = /\/v1\/messages$/i.test(base) ? base : `${base}/v1/messages`;
  const model = agent.model_override || provider.text_model;
  if (!model) throw new Error('ai_model_missing');
  if (!provider.apiKey) throw new Error('ai_key_missing');

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': provider.apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model,
      system: agent.instructions || 'Отвечай полезно и кратко.',
      messages: [...normalizeHistory(history), { role: 'user', content: message }],
      temperature: Number(agent.temperature ?? 0.4),
      max_tokens: Number(agent.max_output_tokens || 1200)
    }),
    signal: AbortSignal.timeout(40_000)
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error?.message || `ai_provider_${response.status}`);
  const answer = (data?.content || []).map((part) => part?.text || '').join('\n').trim();
  if (!answer) throw new Error('empty_ai_response');
  return { answer, model: data?.model || model, provider: provider.name };
}

async function callGoogle(provider, agent, message, history) {
  const endpoint = cleanBaseUrl(provider.base_url, 'https://generativelanguage.googleapis.com/v1beta/interactions');
  const model = agent.model_override || provider.text_model;
  if (!model) throw new Error('ai_model_missing');
  if (!provider.apiKey) throw new Error('ai_key_missing');
  const transcript = normalizeHistory(history)
    .map((item) => `${item.role === 'assistant' ? 'Помощник' : 'Пользователь'}: ${item.content}`)
    .join('\n');

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': provider.apiKey },
    body: JSON.stringify({
      model,
      input: `${agent.instructions || 'Отвечай полезно и кратко.'}\n\n${transcript ? `${transcript}\n` : ''}Пользователь: ${message}`,
      generation_config: {
        temperature: Number(agent.temperature ?? 0.4),
        max_output_tokens: Number(agent.max_output_tokens || 1200)
      }
    }),
    signal: AbortSignal.timeout(40_000)
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error?.message || `ai_provider_${response.status}`);
  const answer = extractGoogleText(data);
  if (!answer) throw new Error('empty_ai_response');
  return { answer, model: data?.model || model, provider: provider.name };
}

async function callProvider(provider, agent, message, history) {
  switch (provider.provider_type) {
    case 'openai': return callOpenAi(provider, agent, message, history);
    case 'anthropic': return callAnthropic(provider, agent, message, history);
    case 'google': return callGoogle(provider, agent, message, history);
    default: return callOpenAiCompatible(provider, agent, message, history);
  }
}

async function callSystemOpenRouter(agent, message, history) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('system_ai_not_configured');
  const provider = {
    name: 'OpenRouter (Vercel)',
    provider_type: 'openai_compatible',
    base_url: 'https://openrouter.ai/api/v1',
    apiKey,
    text_model: process.env.OPENROUTER_MODEL || DEFAULT_OPENROUTER_MODEL
  };
  return callOpenAiCompatible(provider, agent, message, history);
}

export async function runAgent({ botToken, slug, message, history = [] }) {
  const cleanMessage = String(message || '').trim().slice(0, 6000);
  if (!cleanMessage) throw new Error('empty_message');
  const agent = await loadAgent(botToken, slug);
  if (!agent) throw new Error('ai_agent_not_found');

  const errors = [];
  for (const providerId of [agent.provider_id, agent.fallback_provider_id].filter(Boolean)) {
    try {
      const provider = await resolveProvider(botToken, providerId);
      if (!provider) continue;
      return { ...(await callProvider(provider, agent, cleanMessage, history)), agent: agent.slug };
    } catch (error) {
      errors.push(error?.message || 'provider_failed');
    }
  }

  try {
    return { ...(await callSystemOpenRouter(agent, cleanMessage, history)), agent: agent.slug };
  } catch (error) {
    errors.push(error?.message || 'system_provider_failed');
    const failure = new Error('all_ai_providers_failed');
    failure.causes = errors;
    throw failure;
  }
}
