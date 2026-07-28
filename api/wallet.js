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
    entitlements: (data.entitlements || []).map((entry) => ({
      service_id: entry.service_id,
      quantity: Number(entry.quantity || 0),
      updatedAt: entry.updated_at
    })),
    topups: (data.topups || []).map((entry) => ({
      id: entry.id,
      silarum: unitsToSilarum(entry.silarum_units),
      rubles: Number(entry.ruble_kopecks || 0) / 100,
      reference: entry.payment_reference,
      status: entry.status,
      createdAt: entry.created_at,
      updatedAt: entry.updated_at,
      paidAt: entry.paid_at,
      expiresAt: entry.expires_at
    })),
    config: {
      paymentsEnabled: data.config?.paymentsEnabled !== false,
      sbpTopupsEnabled: data.config?.sbpTopupsEnabled === true,
      sbpMinimumSilarum: Number(data.config?.sbpMinimumSilarum ?? 10),
      sbpMaximumSilarum: Number(data.config?.sbpMaximumSilarum ?? 1000),
      sbpRoublesPerSilarum: Number(data.config?.sbpRoublesPerSilarum ?? 0),
      sbpRecipientName: String(data.config?.sbpRecipientName || ''),
      sbpBankName: String(data.config?.sbpBankName || ''),
      sbpPhone: String(data.config?.sbpPhone || ''),
      sbpPaymentUrl: String(data.config?.sbpPaymentUrl || ''),
      sbpQrImageUrl: String(data.config?.sbpQrImageUrl || ''),
      sbpInstructions: String(data.config?.sbpInstructions || ''),
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
      entitlements: [],
      topups: [],
      config: {
        paymentsEnabled: true,
        sbpTopupsEnabled: false,
        sbpMinimumSilarum: 10,
        sbpMaximumSilarum: 1000,
        sbpRoublesPerSilarum: 0,
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
    if (!['request_withdrawal', 'create_sbp_topup', 'mark_sbp_topup_sent'].includes(action)) {
      return sendJson(res, 400, { error: 'unknown_action' });
    }

    const rateLimit = await enforceRateLimit(req, {
      botToken,
      telegramId: userId,
      scope: action === 'request_withdrawal' ? 'wallet:withdrawal' : 'wallet:topup',
      limit: action === 'request_withdrawal' ? 3 : 8,
      windowSeconds: 60 * 60
    });
    setRateLimitHeaders(res, rateLimit);
    if (!rateLimit.allowed) {
      return sendJson(res, 429, { error: 'rate_limited' });
    }

    let result;
    if (action === 'mark_sbp_topup_sent') {
      const orderId = String(req.body?.orderId || '');
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId)) {
        return sendJson(res, 400, { error: 'invalid_order_id' });
      }
      result = await userStore(botToken, action, { telegramId: userId, orderId });
    } else {
      const amount = Number(req.body?.amount);
      const idempotencyKey = normalizeIdempotencyKey(
        getRequestHeader(req, 'x-idempotency-key') || req.body?.idempotencyKey
      );
      if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
        return sendJson(res, 400, { error: 'invalid_amount' });
      }
      if (!idempotencyKey) {
        return sendJson(res, 400, { error: 'invalid_idempotency_key' });
      }
      const payload = {
        telegramId: userId,
        amountUnits: Math.round(amount * 100),
        idempotencyKey
      };
      if (action === 'request_withdrawal') {
        payload.destination = String(req.body?.destination || '').trim();
      }
      result = await userStore(botToken, action, payload);
    }
    const refreshed = await userStore(botToken, 'get_wallet', { telegramId: userId });
    return sendJson(res, 200, {
      ok: true,
      ...(action === 'request_withdrawal' ? { withdrawal: result.withdrawal } : { order: result.order }),
      ...serialize(refreshed)
    });
  } catch (error) {
    console.error('Wallet API failed:', error);
    const code = error?.message || 'wallet_backend_failed';
    if ([
      'withdrawals_disabled', 'below_minimum', 'insufficient_funds', 'invalid_destination',
      'invalid_idempotency_key', 'invalid_order_id', 'payments_disabled', 'sbp_topups_disabled',
      'below_topup_minimum', 'above_topup_maximum', 'topup_not_found', 'topup_not_pending', 'topup_expired'
    ].includes(code)) {
      return sendJson(res, error.status || 400, { error: code });
    }
    if (code === 'sbp_not_configured') return sendJson(res, 503, { error: code });
    if (code === 'rate_limit_backend_failed') {
      return sendJson(res, 503, { error: code });
    }
    return sendJson(res, 502, { error: 'wallet_backend_failed' });
  }
}
