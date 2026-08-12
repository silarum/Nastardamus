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
    body: JSON.stringify({ ...payload, action }),
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

function serializeExternalPayment(entry = {}) {
  return {
    id: entry.id,
    provider: entry.provider,
    providerPaymentId: entry.provider_payment_id || entry.providerPaymentId || null,
    silarum: unitsToSilarum(entry.silarum_units ?? entry.silarumUnits),
    providerAmount: Number(entry.provider_amount ?? entry.providerAmount ?? 0),
    providerCurrency: String(entry.provider_currency || entry.providerCurrency || ''),
    reference: entry.payment_reference || entry.reference || '',
    paymentUrl: entry.payment_url || entry.paymentUrl || null,
    destination: String(entry.metadata?.destination || entry.destination || ''),
    network: String(entry.metadata?.network || entry.network || ''),
    status: String(entry.status || 'pending'),
    paidAt: entry.paid_at || entry.paidAt || null,
    expiresAt: entry.expires_at || entry.expiresAt || null,
    createdAt: entry.created_at || entry.createdAt || null,
    updatedAt: entry.updated_at || entry.updatedAt || null
  };
}

function serializeVip(entry) {
  if (!entry) return null;
  return {
    id: entry.id || null,
    planId: entry.plan_id || entry.planId || null,
    startsAt: entry.starts_at || entry.startsAt || null,
    expiresAt: entry.expires_at || entry.expiresAt || null
  };
}

function serializePaymentMethod(value = {}) {
  return {
    enabled: value?.enabled === true,
    miniApp: value?.miniApp === true,
    paymentUrl: String(value?.paymentUrl || ''),
    destination: String(value?.destination || ''),
    network: String(value?.network || '')
  };
}

async function createStarsInvoiceLink(botToken, order) {
  const amount = Math.round(Number(order?.provider_amount || 0));
  if (!order?.id || !Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error('invalid_payment_order');
  }
  const response = await fetch(`https://api.telegram.org/bot${botToken}/createInvoiceLink`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'SILARUM для Nastardamus',
      description: `Пополнение на ${unitsToSilarum(order.silarum_units)} SILARUM`,
      payload: `silarum:${order.id}`,
      currency: 'XTR',
      prices: [{ label: 'SILARUM', amount }]
    }),
    signal: AbortSignal.timeout(15_000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok || typeof data.result !== 'string') {
    throw new Error('telegram_invoice_unavailable');
  }
  return data.result;
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
      providerType: entry.provider_type || null,
      providerPaymentId: entry.provider_payment_id || null,
      providerStatus: entry.provider_status || null,
      paymentUrl: entry.confirmation_url || null,
      verificationState: entry.verification_state || 'manual',
      createdAt: entry.created_at,
      updatedAt: entry.updated_at,
      paidAt: entry.paid_at,
      expiresAt: entry.expires_at
    })),
    externalPayments: (data.externalPayments || []).map(serializeExternalPayment),
    vip: serializeVip(data.vip || data.config?.vip),
    config: {
      paymentsEnabled: data.config?.paymentsEnabled !== false,
      everythingFree: data.config?.everythingFree === true,
      sbpTopupsEnabled: data.config?.sbpTopupsEnabled === true,
      sbpAutomatic: data.config?.sbpAutomatic === true,
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
      minimumWithdrawal: Number(data.config?.minimumWithdrawal ?? 25),
      paymentMethods: {
        stars: serializePaymentMethod(data.config?.paymentMethods?.stars),
        ton: serializePaymentMethod(data.config?.paymentMethods?.ton),
        usdt: serializePaymentMethod(data.config?.paymentMethods?.usdt),
        sbp: serializePaymentMethod(data.config?.paymentMethods?.sbp)
      },
      paymentRates: {
        starsPerSilarum: Number(data.config?.paymentRates?.starsPerSilarum || 0),
        tonPerSilarum: Number(data.config?.paymentRates?.tonPerSilarum || 0),
        usdtPerSilarum: Number(data.config?.paymentRates?.usdtPerSilarum || 0)
      },
      vipPlans: (data.config?.vipPlans || []).filter((plan) => plan?.enabled !== false).map((plan) => ({
        id: String(plan.id || ''),
        title: String(plan.title || ''),
        description: String(plan.description || ''),
        durationDays: Number(plan.durationDays || 30),
        price: Number(plan.price || 0),
        includedReadings: Number(plan.includedReadings || 0),
        displayOrder: Number(plan.displayOrder || 100)
      }))
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
      externalPayments: [],
      vip: null,
      config: {
        paymentsEnabled: true,
        everythingFree: false,
        sbpTopupsEnabled: false,
        sbpAutomatic: false,
        sbpMinimumSilarum: 10,
        sbpMaximumSilarum: 1000,
        sbpRoublesPerSilarum: 0,
        withdrawalsEnabled: false,
        withdrawalFee: 25,
        minimumWithdrawal: 25,
        paymentMethods: {},
        paymentRates: {},
        vipPlans: []
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
    if (![
      'request_withdrawal',
      'create_sbp_topup',
      'mark_sbp_topup_sent',
      'create_external_payment_order',
      'cancel_external_payment_order',
      'purchase_vip'
    ].includes(action)) {
      return sendJson(res, 400, { error: 'unknown_action' });
    }

    const rateLimit = await enforceRateLimit(req, {
      botToken,
      telegramId: userId,
      scope: action === 'request_withdrawal'
        ? 'wallet:withdrawal'
        : action === 'purchase_vip'
          ? 'wallet:vip'
          : 'wallet:topup',
      limit: action === 'request_withdrawal' ? 3 : action === 'purchase_vip' ? 5 : 8,
      windowSeconds: 60 * 60
    });
    setRateLimitHeaders(res, rateLimit);
    if (!rateLimit.allowed) {
      return sendJson(res, 429, { error: 'rate_limited' });
    }

    let result;
    if (action === 'mark_sbp_topup_sent' || action === 'cancel_external_payment_order') {
      const orderId = String(req.body?.orderId || '');
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId)) {
        return sendJson(res, 400, { error: 'invalid_order_id' });
      }
      result = await userStore(botToken, action, { telegramId: userId, orderId });
    } else if (action === 'purchase_vip') {
      const planId = String(req.body?.planId || '').trim().toLowerCase();
      const idempotencyKey = normalizeIdempotencyKey(
        getRequestHeader(req, 'x-idempotency-key') || req.body?.idempotencyKey
      );
      if (!/^[a-z0-9][a-z0-9_-]{1,47}$/.test(planId)) {
        return sendJson(res, 400, { error: 'invalid_vip_plan' });
      }
      if (!idempotencyKey) return sendJson(res, 400, { error: 'invalid_idempotency_key' });
      result = await userStore(botToken, action, { telegramId: userId, planId, idempotencyKey });
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
      if (action === 'create_external_payment_order') {
        const provider = String(req.body?.provider || '');
        if (provider !== 'telegram_stars') {
          return sendJson(res, 400, { error: 'invalid_payment_provider' });
        }
        payload.provider = provider;
      }
      result = await userStore(botToken, action, payload);
      if (action === 'create_external_payment_order' && payload.provider === 'telegram_stars') {
        const paymentUrl = await createStarsInvoiceLink(botToken, result.order);
        const updated = await userStore(botToken, 'set_external_payment_url', {
          telegramId: userId,
          orderId: result.order.id,
          paymentUrl
        });
        result.order = updated.order;
      }
    }
    const refreshed = await userStore(botToken, 'get_wallet', { telegramId: userId });
    const serialized = serialize(refreshed);
    return sendJson(res, 200, {
      ok: true,
      ...(action === 'request_withdrawal'
        ? { withdrawal: result.withdrawal }
        : action === 'purchase_vip'
          ? { subscription: serializeVip(result.subscription) }
          : { order: ['create_external_payment_order', 'cancel_external_payment_order'].includes(action) ? serializeExternalPayment(result.order) : result.order }),
      ...serialized
    });
  } catch (error) {
    console.error('Wallet API failed:', error);
    const code = error?.message || 'wallet_backend_failed';
    if ([
      'withdrawals_disabled', 'below_minimum', 'insufficient_funds', 'invalid_destination',
      'invalid_idempotency_key', 'invalid_order_id', 'payments_disabled', 'sbp_topups_disabled',
      'below_topup_minimum', 'above_topup_maximum', 'topup_not_found', 'topup_not_pending', 'topup_expired',
      'invalid_payment_provider', 'payment_method_disabled', 'invalid_vip_plan', 'vip_plan_not_found',
      'payment_order_not_pending'
    ].includes(code)) {
      return sendJson(res, error.status || 400, { error: code });
    }
    if (['sbp_not_configured', 'payment_rate_not_configured', 'telegram_invoice_unavailable'].includes(code)) {
      return sendJson(res, 503, { error: code });
    }
    if (code === 'rate_limit_backend_failed') {
      return sendJson(res, 503, { error: code });
    }
    return sendJson(res, 502, { error: 'wallet_backend_failed' });
  }
}
