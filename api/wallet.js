import { getRequestHeader, validateTelegramInitData } from '../lib/telegram.js';
import {
  enforceRateLimit,
  normalizeIdempotencyKey,
  setRateLimitHeaders,
  unauthenticatedPreviewAllowed
} from '../lib/request-security.js';

const USER_STORE_URL = process.env.USER_STORE_URL
  || 'https://hngfpdsnjgdpazmortix.supabase.co/functions/v1/nastardamus-user-store';

function sendJson(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.status(status).json(body);
}

async function userStore(botToken, action, payload = {}) {
  const response = await fetch(USER_STORE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-App-Bot-Token': botToken
    },
    body: JSON.stringify({ action, ...payload }),
    signal: AbortSignal.timeout(15_000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) {
    const error = new Error(data.error || `wallet_store_${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

function unitsToSilarum(value) {
  return Number(value || 0) / 100;
}

function serialize(data) {
  const wallet = data.wallet || {};
  return {
    wallet: {
      balance: unitsToSilarum(wallet.balance_units),
      locked: unitsToSilarum(wallet.locked_units),
      available: unitsToSilarum(Number(wallet.balance_units || 0) - Number(wallet.locked_units || 0)),
      freeSpins: Number(wallet.free_spins || 0),
      updatedAt: wallet.updated_at || null
    },
    ledger: (data.ledger || []).map((entry) => ({
      id: entry.id,
      type: entry.entry_type,
      amount: unitsToSilarum(entry.amount_units),
      balanceAfter: unitsToSilarum(entry.balance_after_units),
      lockedAfter: unitsToSilarum(entry.locked_after_units),
      metadata: entry.metadata || {},
      createdAt: entry.created_at
    })),
    withdrawals: (data.withdrawals || []).map((entry) => ({
      id: entry.id,
      gross: unitsToSilarum(entry.gross_units),
      fee: unitsToSilarum(entry.fee_units),
      net: unitsToSilarum(entry.net_units),
      destination: entry.destination,
      status: entry.status,
      createdAt: entry.created_at,
      updatedAt: entry.updated_at
    })),
    config: {
      withdrawalsEnabled: data.config?.withdrawalsEnabled === true,
      withdrawalFee: Number(data.config?.withdrawalFee ?? 25),
      minimumWithdrawal: Number(data.config?.minimumWithdrawal ?? 25)
    }
  };
}

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST');
    return sendJson(res, 405, { error: 'method_not_allowed' });
  }

  const botToken = process.env.BOT_TOKEN;
  if (!botToken) return sendJson(res, 503, { error: 'wallet_not_configured' });

  const initData = getRequestHeader(req, 'x-telegram-init-data') || '';
  const validation = validateTelegramInitData(initData, botToken);
  const previewAllowed = unauthenticatedPreviewAllowed();
  if (!validation.ok && (!previewAllowed || req.method === 'POST')) {
    return sendJson(res, 401, { error: 'telegram_auth_required' });
  }

  if (!validation.ok) {
    return sendJson(res, 200, {
      ok: true,
      preview: true,
      wallet: {
        balance: 0,
        locked: 0,
        available: 0,
        freeSpins: 0,
        updatedAt: null
      },
      ledger: [],
      withdrawals: [],
      config: {
        withdrawalsEnabled: false,
        withdrawalFee: 25,
        minimumWithdrawal: 25
      }
    });
  }

  const userId = Number(validation.user.id);

  try {
    if (req.method === 'GET') {
      const data = await userStore(botToken, 'get_wallet', { telegramId: userId });
      return sendJson(res, 200, { ok: true, ...serialize(data) });
    }

    const action = String(req.body?.action || '');
    if (action !== 'request_withdrawal') {
      return sendJson(res, 400, { error: 'unknown_action' });
    }

    const amount = Number(req.body?.amount);
    const destination = String(req.body?.destination || '').trim();
    const idempotencyKey = normalizeIdempotencyKey(
      getRequestHeader(req, 'x-idempotency-key') || req.body?.idempotencyKey
    );
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
      return sendJson(res, 400, { error: 'invalid_amount' });
    }
    if (!idempotencyKey) {
      return sendJson(res, 400, { error: 'invalid_idempotency_key' });
    }

    const rateLimit = await enforceRateLimit(req, {
      botToken,
      telegramId: userId,
      scope: 'wallet:withdrawal',
      limit: 3,
      windowSeconds: 60 * 60
    });
    setRateLimitHeaders(res, rateLimit);
    if (!rateLimit.allowed) {
      return sendJson(res, 429, { error: 'rate_limited' });
    }

    const amountUnits = Math.round(amount * 100);
    const result = await userStore(botToken, 'request_withdrawal', {
      telegramId: userId,
      amountUnits,
      destination,
      idempotencyKey
    });
    const refreshed = await userStore(botToken, 'get_wallet', { telegramId: userId });
    return sendJson(res, 200, {
      ok: true,
      withdrawal: result.withdrawal,
      ...serialize(refreshed)
    });
  } catch (error) {
    console.error('Wallet API failed:', error);
    const code = error?.message || 'wallet_backend_failed';
    if (['withdrawals_disabled', 'below_minimum', 'insufficient_funds', 'invalid_destination', 'invalid_idempotency_key'].includes(code)) {
      return sendJson(res, error.status || 400, { error: code });
    }
    if (code === 'rate_limit_backend_failed') {
      return sendJson(res, 503, { error: code });
    }
    return sendJson(res, 502, { error: 'wallet_backend_failed' });
  }
}
