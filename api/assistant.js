import { runAgent } from '../lib/ai-runtime.js';
import { parseEsoteriumResponse } from '../lib/esoterium.js';
import {
  buildDailyGreetingAgentMessage,
  cleanDailyGreetingAnswer,
  fallbackDailyGreeting,
  normalizeDailyGreetingInput
} from '../lib/daily-greeting.js';
import { getRequestHeader, validateTelegramInitData } from '../lib/telegram.js';
import {
  enforceRateLimit,
  setRateLimitHeaders,
  unauthenticatedPreviewAllowed
} from '../lib/request-security.js';

const PUBLIC_AGENTS = new Set(['support-guide', 'onboarding-guide', 'daily-greeting']);

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
  const previewAllowed = unauthenticatedPreviewAllowed();
  if (!auth.ok && !previewAllowed) {
    return sendJson(res, 401, { error: 'telegram_auth_required' });
  }

  const slug = String(req.body?.agent || 'support-guide');
  if (!PUBLIC_AGENTS.has(slug)) return sendJson(res, 403, { error: 'agent_not_public' });

  const greetingContext = slug === 'daily-greeting'
    ? normalizeDailyGreetingInput(req.body?.context)
    : null;
  const greetingFallback = greetingContext ? fallbackDailyGreeting(greetingContext) : '';
  const message = greetingContext
    ? buildDailyGreetingAgentMessage(greetingContext)
    : String(req.body?.message || '').trim().slice(0, 6000);
  if (!message) return sendJson(res, 400, { error: 'empty_message' });

  try {
    const rateLimit = await enforceRateLimit(req, {
      botToken,
      telegramId: auth.ok ? Number(auth.user.id) : null,
      scope: greetingContext ? 'ai:daily-greeting' : 'ai:assistant',
      limit: greetingContext ? 16 : 40,
      windowSeconds: 60 * 60,
      persistent: auth.ok
    });
    setRateLimitHeaders(res, rateLimit);
    if (!rateLimit.allowed) {
      if (greetingContext) {
        return sendJson(res, 200, { ok: true, answer: greetingFallback, source: 'fallback' });
      }
      return sendJson(res, 429, { error: 'rate_limited' });
    }

    const result = await runAgent({
      botToken,
      slug,
      message,
      history: cleanHistory(req.body?.history)
    });
    const handoff = /\[HANDOFF\]/i.test(result.answer);
    const parsed = parseEsoteriumResponse(result.answer.replace(/\s*\[HANDOFF\]\s*/gi, ''));
    const answer = greetingContext
      ? cleanDailyGreetingAnswer(parsed.answer, greetingFallback)
      : parsed.answer;
    if (greetingContext) {
      const locale = greetingContext.locale === 'ru' ? 'ru' : greetingContext.locale;
      const includesName = answer.toLocaleLowerCase(locale)
        .includes(greetingContext.userName.toLocaleLowerCase(locale));
      return sendJson(res, 200, {
        ok: true,
        answer: includesName ? answer : greetingFallback,
        source: includesName ? 'live' : 'fallback',
        agent: result.agent
      });
    }
    return sendJson(res, 200, {
      ok: true,
      answer,
      handoff,
      agent: result.agent
    });
  } catch (error) {
    console.error('Assistant request failed:', error, error?.causes || null);
    if (greetingContext) {
      return sendJson(res, 200, {
        ok: true,
        answer: greetingFallback,
        source: 'fallback',
        agent: 'daily-greeting'
      });
    }
    if (error?.message === 'rate_limit_backend_failed') {
      return sendJson(res, 503, { error: 'rate_limit_backend_failed' });
    }
    return sendJson(res, 502, {
      error: 'assistant_unavailable',
      handoff: true,
      answer: 'Сейчас Эзотериум не может ответить. Вопрос отмечен для оператора поддержки.'
    });
  }
}
