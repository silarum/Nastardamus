import { createHmac, timingSafeEqual } from 'node:crypto';

const DEFAULT_MAX_AGE_SECONDS = 60 * 60;
const FUTURE_TOLERANCE_SECONDS = 30;

function safeEqualHex(left, right) {
    if (!/^[a-f0-9]{64}$/i.test(left) || !/^[a-f0-9]{64}$/i.test(right)) {
        return false;
    }

    return timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}

export function validateTelegramInitData(
    initData,
    botToken,
    { nowSeconds = Math.floor(Date.now() / 1000), maxAgeSeconds = DEFAULT_MAX_AGE_SECONDS } = {}
) {
    if (typeof initData !== 'string' || initData.length === 0 || initData.length > 10_000) {
        return { ok: false, reason: 'missing_init_data' };
    }
    if (typeof botToken !== 'string' || botToken.length < 20) {
        return { ok: false, reason: 'missing_bot_token' };
    }

    const params = new URLSearchParams(initData);
    const receivedHash = params.get('hash') || '';
    params.delete('hash');

    const dataCheckString = [...params.entries()]
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');

    const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
    const calculatedHash = createHmac('sha256', secretKey)
        .update(dataCheckString)
        .digest('hex');

    if (!safeEqualHex(receivedHash, calculatedHash)) {
        return { ok: false, reason: 'invalid_hash' };
    }

    const authDate = Number.parseInt(params.get('auth_date') || '', 10);
    if (!Number.isSafeInteger(authDate)) {
        return { ok: false, reason: 'invalid_auth_date' };
    }
    if (authDate > nowSeconds + FUTURE_TOLERANCE_SECONDS) {
        return { ok: false, reason: 'future_auth_date' };
    }
    if (nowSeconds - authDate > maxAgeSeconds) {
        return { ok: false, reason: 'expired_auth_date' };
    }

    let user = null;
    try {
        user = JSON.parse(params.get('user') || 'null');
    } catch {
        return { ok: false, reason: 'invalid_user' };
    }

    if (!user || !Number.isSafeInteger(Number(user.id))) {
        return { ok: false, reason: 'invalid_user' };
    }

    return { ok: true, authDate, user };
}

export function getRequestHeader(req, name) {
    const value = req.headers?.[name.toLowerCase()] ?? req.headers?.[name];
    return Array.isArray(value) ? value[0] : value;
}
