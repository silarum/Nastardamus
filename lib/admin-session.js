import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const ADMIN_SESSION_COOKIE = '__Host-nastardamus-control';
export const ADMIN_SESSION_TTL_SECONDS = 10 * 60;

function sessionSecret() {
  return process.env.ADMIN_SESSION_SECRET
    || process.env.ADMIN_BOT_TOKEN
    || process.env.BOT_TOKEN
    || '';
}

function signature(value, secret) {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function createAdminSessionToken(
  userId,
  {
    nowSeconds = Math.floor(Date.now() / 1000),
    nonce = randomBytes(16).toString('base64url'),
    secret = sessionSecret()
  } = {}
) {
  const telegramId = Number(userId);
  if (!Number.isSafeInteger(telegramId) || telegramId <= 0 || String(secret).length < 20) {
    throw new Error('admin_session_unavailable');
  }
  const payload = Buffer.from(JSON.stringify({
    sub: telegramId,
    iat: nowSeconds,
    exp: nowSeconds + ADMIN_SESSION_TTL_SECONDS,
    nonce
  })).toString('base64url');
  return `${payload}.${signature(payload, secret)}`;
}

export function verifyAdminSessionToken(
  token,
  {
    nowSeconds = Math.floor(Date.now() / 1000),
    secret = sessionSecret()
  } = {}
) {
  if (typeof token !== 'string' || token.length > 2048 || String(secret).length < 20) {
    return { ok: false, reason: 'missing_session' };
  }
  const [payload, receivedSignature, extra] = token.split('.');
  if (!payload || !receivedSignature || extra) return { ok: false, reason: 'invalid_session' };
  if (!safeEqual(receivedSignature, signature(payload, secret))) {
    return { ok: false, reason: 'invalid_signature' };
  }

  let data;
  try {
    data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return { ok: false, reason: 'invalid_payload' };
  }
  const userId = Number(data?.sub);
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    return { ok: false, reason: 'invalid_user' };
  }
  if (!Number.isSafeInteger(data?.iat) || !Number.isSafeInteger(data?.exp)) {
    return { ok: false, reason: 'invalid_expiry' };
  }
  if (data.iat > nowSeconds + 30 || data.exp <= nowSeconds) {
    return { ok: false, reason: 'expired_session' };
  }
  if (data.exp - data.iat !== ADMIN_SESSION_TTL_SECONDS) {
    return { ok: false, reason: 'invalid_lifetime' };
  }
  return { ok: true, userId, expiresAt: data.exp };
}

export function readAdminSession(req) {
  const cookieHeader = String(req.headers?.cookie || '');
  const cookies = new Map(cookieHeader.split(';').map((part) => {
    const separator = part.indexOf('=');
    if (separator < 0) return ['', ''];
    return [
      part.slice(0, separator).trim(),
      decodeURIComponent(part.slice(separator + 1).trim())
    ];
  }));
  return verifyAdminSessionToken(cookies.get(ADMIN_SESSION_COOKIE) || '');
}

export function adminSessionCookie(token) {
  return [
    `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    `Max-Age=${ADMIN_SESSION_TTL_SECONDS}`,
    'HttpOnly',
    'Secure',
    'SameSite=Strict'
  ].join('; ');
}

export function clearAdminSessionCookie() {
  return [
    `${ADMIN_SESSION_COOKIE}=`,
    'Path=/',
    'Max-Age=0',
    'HttpOnly',
    'Secure',
    'SameSite=Strict'
  ].join('; ');
}
