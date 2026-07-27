import { isIP } from 'node:net';

const USER_STORE_URL = process.env.USER_STORE_URL
  || 'https://hngfpdsnjgdpazmortix.supabase.co/functions/v1/nastardamus-user-store';
const LOCAL_BUCKETS = globalThis.__nastardamusRateLimitBuckets
  || new Map();

globalThis.__nastardamusRateLimitBuckets = LOCAL_BUCKETS;

const PROVIDER_HOSTS = Object.freeze({
  openai: new Set(['api.openai.com']),
  openai_compatible: new Set(['openrouter.ai', 'api.deepseek.com']),
  anthropic: new Set(['api.anthropic.com']),
  google: new Set(['generativelanguage.googleapis.com'])
});

export function unauthenticatedPreviewAllowed() {
  return process.env.ALLOW_UNAUTHENTICATED_PREVIEW === 'true'
    && process.env.VERCEL_ENV !== 'production'
    && process.env.NODE_ENV !== 'production';
}

export function requestIp(req) {
  const forwarded = req.headers?.['x-forwarded-for'];
  const value = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return String(value || req.headers?.['x-real-ip'] || 'preview')
    .split(',')[0]
    .trim()
    .slice(0, 80);
}

function takeLocalRateLimit(key, limit, windowSeconds) {
  const now = Date.now();
  const existing = LOCAL_BUCKETS.get(key);
  const windowMs = windowSeconds * 1000;
  const bucket = !existing || now - existing.startedAt >= windowMs
    ? { startedAt: now, count: 0 }
    : existing;
  bucket.count += 1;
  LOCAL_BUCKETS.set(key, bucket);

  if (LOCAL_BUCKETS.size > 5000) {
    for (const [bucketKey, value] of LOCAL_BUCKETS) {
      if (now - value.startedAt >= windowMs) LOCAL_BUCKETS.delete(bucketKey);
    }
  }

  return {
    allowed: bucket.count <= limit,
    limit,
    remaining: Math.max(0, limit - bucket.count),
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.startedAt + windowMs - now) / 1000))
  };
}

export async function enforceRateLimit(req, {
  botToken,
  telegramId,
  scope,
  limit,
  windowSeconds,
  persistent = true
}) {
  if (
    persistent
    && Number.isSafeInteger(Number(telegramId))
    && Number(telegramId) > 0
  ) {
    const response = await fetch(USER_STORE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Bot-Token': botToken
      },
      body: JSON.stringify({
        action: 'take_rate_limit',
        telegramId: Number(telegramId),
        scope,
        limit,
        windowSeconds
      }),
      signal: AbortSignal.timeout(10_000)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) {
      const error = new Error('rate_limit_backend_failed');
      error.status = 503;
      throw error;
    }
    return {
      allowed: data.allowed === true,
      limit: Number(data.limit || limit),
      remaining: Number(data.remaining || 0),
      retryAfterSeconds: Number(data.retry_after_seconds || windowSeconds)
    };
  }

  return takeLocalRateLimit(
    `${scope}:${requestIp(req)}`,
    limit,
    windowSeconds
  );
}

export function setRateLimitHeaders(res, result) {
  res.setHeader('X-RateLimit-Limit', String(result.limit));
  res.setHeader('X-RateLimit-Remaining', String(result.remaining));
  if (!result.allowed) {
    res.setHeader('Retry-After', String(result.retryAfterSeconds));
  }
}

export function normalizeIdempotencyKey(value) {
  const key = String(value || '').trim();
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/.test(key) ? key : '';
}

export function validateProviderBaseUrl(value, providerType, fallback) {
  const raw = String(value || fallback || '').trim();
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('invalid_ai_base_url');
  }
  if (
    url.protocol !== 'https:'
    || url.username
    || url.password
    || (url.port && url.port !== '443')
  ) {
    throw new Error('invalid_ai_base_url');
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  if (
    hostname === 'localhost'
    || hostname.endsWith('.localhost')
    || isIP(hostname) !== 0
  ) {
    throw new Error('untrusted_ai_provider_host');
  }

  const configuredHosts = new Set(
    String(process.env.AI_PROVIDER_ALLOWED_HOSTS || '')
      .split(/[\s,;]+/)
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean)
  );
  const allowed = PROVIDER_HOSTS[providerType] || configuredHosts;
  if (!allowed.has(hostname) && !configuredHosts.has(hostname)) {
    throw new Error('untrusted_ai_provider_host');
  }
  return url.toString().replace(/\/$/, '');
}
