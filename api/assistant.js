import { runAgent } from '../lib/ai-runtime.js';
import { getRequestHeader, validateTelegramInitData } from '../lib/telegram.js';

const PUBLIC_AGENTS = new Set(['support-guide', 'onboarding-guide']);

function sendJson(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.status(status).json(body);
}

function cleanHistory(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(-12).flatMap((item) => {
    const role = item?.role === 'assistant' ? 'assistant' : 'user';
    const content = String(item?.content || '').trim().slice(0, 4000);
    return content ? [{ role, content }] : [];
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'method_not_allowed' });
  }

  const botToken = process.env.BOT_TOKEN;
  if (!botToken) return sendJson(res, 503, { error: 'assistant_not_configured' });

  const initData = getRequestHeader(req, 'x-telegram-init-data') || '';
  const auth = validateTelegramInitData(initData, botToken);
  const previewAllowed = process.env.ALLOW_UNAUTHENTICATED_PREVIEW === 'true';
  if (!auth.ok && !previewAllowed) {
    return sendJson(res, 401, { error: 'telegram_auth_required' });
  }

  const slug = String(req.body?.agent || 'support-guide');
  if (!PUBLIC_AGENTS.has(slug)) return sendJson(res, 403, { error: 'agent_not_public' });

  const message = String(req.body?.message || '').trim().slice(0, 6000);
  if (!message) return sendJson(res, 400, { error: 'empty_message' });

  try {
    const result = await runAgent({
      botToken,
      slug,
      message,
      history: cleanHistory(req.body?.history)
    });
    const handoff = /\[HANDOFF\]/i.test(result.answer);
    const answer = result.answer.replace(/\s*\[HANDOFF\]\s*/gi, '').trim();
    return sendJson(res, 200, {
      ok: true,
      answer,
      handoff,
      agent: result.agent,
      provider: result.provider,
      model: result.model
    });
  } catch (error) {
    console.error('Assistant request failed:', error, error?.causes || null);
    return sendJson(res, 502, {
      error: 'assistant_unavailable',
      handoff: true,
      answer: 'Сейчас AI-помощник недоступен. Передаю вопрос оператору поддержки.'
    });
  }
}
