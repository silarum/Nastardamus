import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';

import { validateTelegramInitData } from '../lib/telegram.js';

const BOT_TOKEN = '123456789:short_test_token_12345';
const NOW = 1_800_000_000;

function signInitData(values) {
    const params = new URLSearchParams(values);
    const dataCheckString = [...params.entries()]
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');
    const secret = createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
    params.set('hash', createHmac('sha256', secret).update(dataCheckString).digest('hex'));
    return params.toString();
}

test('accepts valid and fresh Telegram init data', () => {
    const initData = signInitData({
        auth_date: String(NOW - 60),
        query_id: 'query-1',
        user: JSON.stringify({ id: 42, first_name: 'Ada' })
    });

    const result = validateTelegramInitData(initData, BOT_TOKEN, { nowSeconds: NOW });
    assert.equal(result.ok, true);
    assert.equal(result.user.id, 42);
});

test('rejects tampered Telegram init data', () => {
    const signed = signInitData({
        auth_date: String(NOW - 60),
        user: JSON.stringify({ id: 42 })
    });
    const params = new URLSearchParams(signed);
    params.set('user', JSON.stringify({ id: 99 }));

    assert.equal(validateTelegramInitData(params.toString(), BOT_TOKEN, { nowSeconds: NOW }).ok, false);
});

test('rejects expired Telegram init data', () => {
    const initData = signInitData({
        auth_date: String(NOW - 7_200),
        user: JSON.stringify({ id: 42 })
    });

    const result = validateTelegramInitData(initData, BOT_TOKEN, { nowSeconds: NOW });
    assert.deepEqual(result, { ok: false, reason: 'expired_auth_date' });
});
