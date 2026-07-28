import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const APP_BOT_ID = Number(Deno.env.get("NASTARDAMUS_APP_BOT_ID") || 7213010066);
const TOKEN_CACHE_TTL_MS = 10 * 60 * 1000;
const verifiedTokens = new Map<string, number>();
const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("NASTARDAMUS_ALLOWED_ORIGIN")
    || "https://nastardamus.vercel.app",
  "Access-Control-Allow-Headers": "content-type,x-app-bot-token",
  "Access-Control-Allow-Methods": "POST,OPTIONS"
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}

async function verifyBotToken(token: string) {
  if (!token || token.length < 20) return false;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  const cacheKey = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  const cachedUntil = verifiedTokens.get(cacheKey) || 0;
  if (cachedUntil > Date.now()) return true;

  const response = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}"
  });
  const data = await response.json().catch(() => null);
  const valid = Boolean(response.ok && data?.ok && Number(data.result?.id) === APP_BOT_ID);
  if (valid) verifiedTokens.set(cacheKey, Date.now() + TOKEN_CACHE_TTL_MS);
  return valid;
}

async function rest(path: string, options: RequestInit = {}) {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("supabase_env_missing");
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...(options.headers || {})
    }
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`rest_${response.status}:${text.slice(0, 180)}`);
  }
  return response;
}

async function ensureWallet(telegramId: number) {
  await rest("nastardamus_wallets?on_conflict=telegram_id", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal"
    },
    body: JSON.stringify({ telegram_id: telegramId })
  });
}

async function readSettings() {
  const response = await rest("nastardamus_settings?key=eq.global&select=settings&limit=1");
  const rows = await response.json();
  return rows?.[0]?.settings || {};
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function paymentEncryptionKey() {
  const stableSecret = Deno.env.get("NASTARDAMUS_ENCRYPTION_SECRET")
    || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    || "";
  if (!stableSecret) throw new Error("payment_encryption_secret_missing");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(stableSecret));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["decrypt"]);
}

async function decryptPaymentSecret(ciphertext: string, iv: string) {
  const key = await paymentEncryptionKey();
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(iv) },
    key,
    base64ToBytes(ciphertext)
  );
  return new TextDecoder().decode(decrypted);
}

type SbpProvider = {
  merchantId: string;
  secret: string;
};

async function readSbpProvider(): Promise<SbpProvider | null> {
  const response = await rest(
    "nastardamus_payment_providers?key=eq.sbp&enabled=eq.true&select=merchant_id,secret_ciphertext,secret_iv&limit=1"
  );
  const rows = await response.json();
  const row = rows?.[0];
  if (!row?.merchant_id || !row?.secret_ciphertext || !row?.secret_iv) return null;
  return {
    merchantId: String(row.merchant_id),
    secret: await decryptPaymentSecret(String(row.secret_ciphertext), String(row.secret_iv))
  };
}

function rublesToKopecks(value: unknown) {
  const normalized = String(value || "");
  if (!/^\d{1,9}\.\d{2}$/.test(normalized)) return null;
  const [rubles, kopecks] = normalized.split(".");
  const amount = Number(rubles) * 100 + Number(kopecks);
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}

async function yookassaRequest(
  provider: SbpProvider,
  path: string,
  options: { method?: string; idempotencyKey?: string; body?: unknown } = {}
) {
  const response = await fetch(`https://api.yookassa.ru/v3/${path.replace(/^\/+/, "")}`, {
    method: options.method || "GET",
    headers: {
      Authorization: `Basic ${btoa(`${provider.merchantId}:${provider.secret}`)}`,
      "Content-Type": "application/json",
      ...(options.idempotencyKey ? { "Idempotence-Key": options.idempotencyKey } : {})
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: AbortSignal.timeout(15_000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("SBP provider request failed", response.status, data?.type || data?.code || "unknown");
    throw new Error(`payment_provider_${response.status}`);
  }
  return data;
}

async function settleProviderPayment(payment: Record<string, unknown>) {
  const amount = payment.amount && typeof payment.amount === "object"
    ? payment.amount as Record<string, unknown>
    : {};
  const method = payment.payment_method && typeof payment.payment_method === "object"
    ? payment.payment_method as Record<string, unknown>
    : {};
  const response = await rest("rpc/nastardamus_settle_sbp_provider_payment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      p_provider_payment_id: String(payment.id || ""),
      p_provider_status: String(payment.status || ""),
      p_ruble_kopecks: rublesToKopecks(amount.value) || 0,
      p_currency: String(amount.currency || ""),
      p_payment_method: String(method.type || "")
    })
  });
  return await response.json();
}

async function createProviderPayment(
  telegramId: number,
  order: Record<string, unknown>,
  idempotencyKey: string
) {
  const provider = await readSbpProvider();
  if (!provider) return order;
  const rubleKopecks = Number(order.ruble_kopecks);
  const orderId = String(order.id || "");
  const reference = String(order.payment_reference || "");
  if (!Number.isSafeInteger(rubleKopecks) || rubleKopecks <= 0 || !orderId) return order;

  const origin = String(Deno.env.get("NASTARDAMUS_ALLOWED_ORIGIN") || "https://nastardamus.vercel.app")
    .replace(/\/$/, "");
  const payment = await yookassaRequest(provider, "payments", {
    method: "POST",
    idempotencyKey: `nastardamus-${idempotencyKey}`.slice(0, 64),
    body: {
      amount: { value: (rubleKopecks / 100).toFixed(2), currency: "RUB" },
      payment_method_data: { type: "sbp" },
      confirmation: { type: "redirect", return_url: `${origin}/?screen=topup` },
      capture: true,
      description: `Nastardamus ${reference}`.slice(0, 128),
      metadata: { order_id: orderId, reference }
    }
  });
  const paymentAmount = payment.amount && typeof payment.amount === "object"
    ? payment.amount as Record<string, unknown>
    : {};
  const paymentMethod = payment.payment_method && typeof payment.payment_method === "object"
    ? payment.payment_method as Record<string, unknown>
    : { type: "sbp" };
  const confirmation = payment.confirmation && typeof payment.confirmation === "object"
    ? payment.confirmation as Record<string, unknown>
    : {};
  if (
    !/^[A-Za-z0-9-]{8,96}$/.test(String(payment.id || ""))
    || rublesToKopecks(paymentAmount.value) !== rubleKopecks
    || String(paymentAmount.currency || "") !== "RUB"
    || String(paymentMethod.type || "sbp") !== "sbp"
    || !String(confirmation.confirmation_url || "").startsWith("https://")
  ) {
    throw new Error("invalid_payment_provider_response");
  }

  const attachedResponse = await rest("rpc/nastardamus_attach_sbp_provider_payment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      p_telegram_id: telegramId,
      p_order_id: orderId,
      p_provider_type: "yookassa",
      p_provider_payment_id: String(payment.id),
      p_confirmation_url: String(confirmation.confirmation_url),
      p_provider_status: String(payment.status || "pending")
    })
  });
  const attached = await attachedResponse.json();
  return { ...order, ...attached };
}

async function reconcileLatestProviderPayment(telegramId: number) {
  const settings = await readSettings();
  if (settings.sbpAutomationEnabled === false) return;
  const response = await rest(
    `nastardamus_sbp_topups?telegram_id=eq.${telegramId}`
      + "&provider_payment_id=not.is.null&status=in.(pending,awaiting_confirmation)"
      + "&select=provider_payment_id,provider_checked_at&order=created_at.desc&limit=1"
  );
  const rows = await response.json();
  const order = rows?.[0];
  if (!order?.provider_payment_id) return;
  const checkedAt = Date.parse(String(order.provider_checked_at || ""));
  if (Number.isFinite(checkedAt) && Date.now() - checkedAt < 5_000) return;
  const provider = await readSbpProvider();
  if (!provider) return;
  const payment = await yookassaRequest(provider, `payments/${encodeURIComponent(order.provider_payment_id)}`);
  await settleProviderPayment(payment);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const token = req.headers.get("x-app-bot-token") || "";
  if (!(await verifyBotToken(token))) return json(401, { error: "invalid_app_bot_token" });

  const body = await req.json().catch(() => ({}));
  const action = String(body?.action || "");
  const telegramId = Number(body?.telegramId);

  try {
    if (action === "get_wallet") {
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) {
        return json(400, { error: "invalid_telegram_id" });
      }
      await ensureWallet(telegramId);
      await reconcileLatestProviderPayment(telegramId).catch((error) => {
        console.error("SBP reconciliation failed", error instanceof Error ? error.message : error);
      });
      const [walletResponse, ledgerResponse, withdrawalResponse, entitlementResponse, topupResponse, settings, providerResponse] = await Promise.all([
        rest(`nastardamus_wallets?telegram_id=eq.${telegramId}&select=telegram_id,balance_units,locked_units,free_spins,updated_at&limit=1`),
        rest(`nastardamus_wallet_ledger?telegram_id=eq.${telegramId}&select=id,entry_type,amount_units,balance_after_units,locked_after_units,metadata,created_at&order=created_at.desc&limit=30`),
        rest(`nastardamus_withdrawal_requests?telegram_id=eq.${telegramId}&select=id,gross_units,fee_units,net_units,destination,status,created_at,updated_at&order=created_at.desc&limit=20`),
        rest(`nastardamus_service_entitlements?telegram_id=eq.${telegramId}&quantity=gt.0&select=service_id,quantity,updated_at&order=updated_at.desc`),
        rest(`nastardamus_sbp_topups?telegram_id=eq.${telegramId}&select=id,silarum_units,ruble_kopecks,payment_reference,status,provider_type,provider_payment_id,provider_status,confirmation_url,verification_state,created_at,updated_at,paid_at,expires_at&order=created_at.desc&limit=20`),
        readSettings(),
        rest("nastardamus_payment_providers?key=eq.sbp&enabled=eq.true&select=merchant_id,secret_ciphertext,secret_iv&limit=1")
      ]);
      const wallets = await walletResponse.json();
      const ledger = await ledgerResponse.json();
      const withdrawals = await withdrawalResponse.json();
      const entitlements = await entitlementResponse.json();
      const topups = await topupResponse.json();
      const providers = await providerResponse.json();
      const automaticSbpReady = settings.sbpAutomationEnabled !== false
        && Boolean(providers?.[0]?.merchant_id && providers?.[0]?.secret_ciphertext && providers?.[0]?.secret_iv);
      return json(200, {
        ok: true,
        wallet: wallets?.[0] || null,
        ledger: ledger || [],
        withdrawals: withdrawals || [],
        entitlements: entitlements || [],
        topups: topups || [],
        config: {
          paymentsEnabled: settings.paymentsEnabled !== false,
          sbpTopupsEnabled: settings.sbpTopupsEnabled === true,
          sbpAutomatic: automaticSbpReady,
          sbpMinimumSilarum: Number(settings.sbpMinimumSilarum ?? 10),
          sbpMaximumSilarum: Number(settings.sbpMaximumSilarum ?? 1000),
          sbpRoublesPerSilarum: Number(settings.sbpRoublesPerSilarum ?? 0),
          sbpRecipientName: String(settings.sbpRecipientName || ""),
          sbpBankName: String(settings.sbpBankName || ""),
          sbpPhone: String(settings.sbpPhone || ""),
          sbpPaymentUrl: String(settings.sbpPaymentUrl || ""),
          sbpQrImageUrl: String(settings.sbpQrImageUrl || ""),
          sbpInstructions: String(settings.sbpInstructions || ""),
          withdrawalsEnabled: settings.withdrawalsEnabled === true,
          withdrawalFee: Number(settings.withdrawalFee ?? 25),
          minimumWithdrawal: Number(settings.minimumWithdrawal ?? 25)
        }
      });
    }

    if (action === "get_public_config") {
      const settings = await readSettings();
      const moderationResponse = await rest(
        "nastardamus_ai_moderation_policy?key=eq.global&select=enabled,rules,thresholds,actions&limit=1"
      );
      const moderationRows = await moderationResponse.json();
      return json(200, {
        ok: true,
        settings: {
          wheelEnabled: settings.wheelEnabled === true,
          palmLinkEnabled: settings.palmLinkEnabled === true,
          jointReadingsEnabled: settings.jointReadingsEnabled === true,
          manualPhotoReview: settings.manualPhotoReview !== false,
          adultOnly: settings.adultOnly !== false,
          wheelDailySpins: Math.max(1, Math.min(10, Number(settings.wheelDailySpins || 1))),
          wheelRewards: Array.isArray(settings.wheelRewards) ? settings.wheelRewards : [],
          serviceCatalog: settings.serviceCatalog && typeof settings.serviceCatalog === "object" ? settings.serviceCatalog : {},
          dailyHoroscopeEnabled: settings.dailyHoroscopeEnabled !== false,
          paymentsEnabled: settings.paymentsEnabled !== false,
          sbpTopupsEnabled: settings.sbpTopupsEnabled === true,
          sbpMinimumSilarum: Number(settings.sbpMinimumSilarum ?? 10),
          sbpMaximumSilarum: Number(settings.sbpMaximumSilarum ?? 1000),
          sbpRoublesPerSilarum: Number(settings.sbpRoublesPerSilarum ?? 0)
        },
        moderation: moderationRows?.[0] || {
          enabled: true,
          rules: { consent_required: true },
          thresholds: { block: 0.85, manual_review: 0.55 },
          actions: { high_risk: "block", medium_risk: "review" }
        }
      });
    }

    if (action === "authorize_cron") {
      const cronToken = String(body?.cronToken || "");
      if (cronToken.length < 32 || cronToken.length > 256) {
        return json(401, { error: "invalid_cron_token" });
      }
      const settings = await readSettings();
      const expectedHash = String(settings.dailyHoroscopeCronHash || "");
      const actualHash = await sha256Hex(cronToken);
      if (!/^[a-f0-9]{64}$/.test(expectedHash) || actualHash !== expectedHash) {
        return json(401, { error: "invalid_cron_token" });
      }
      return json(200, { ok: true });
    }

    if (action === "claim_wheel_reward") {
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) {
        return json(400, { error: "invalid_telegram_id" });
      }
      const idempotencyKey = String(body?.idempotencyKey || "").trim();
      if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/.test(idempotencyKey)) {
        return json(400, { error: "invalid_idempotency_key" });
      }
      const response = await rest("rpc/nastardamus_claim_wheel_reward", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          p_telegram_id: telegramId,
          p_idempotency_key: idempotencyKey
        })
      });
      const result = await response.json();
      return json(200, { ok: true, ...result });
    }

    if (action === "create_sbp_topup") {
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) {
        return json(400, { error: "invalid_telegram_id" });
      }
      const amountUnits = Number(body?.amountUnits);
      const idempotencyKey = String(body?.idempotencyKey || "").trim();
      if (!Number.isSafeInteger(amountUnits) || amountUnits <= 0) {
        return json(400, { error: "invalid_amount" });
      }
      if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/.test(idempotencyKey)) {
        return json(400, { error: "invalid_idempotency_key" });
      }
      const response = await rest("rpc/nastardamus_create_sbp_topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          p_telegram_id: telegramId,
          p_silarum_units: amountUnits,
          p_idempotency_key: idempotencyKey
        })
      });
      let order = await response.json();
      const settings = await readSettings();
      if (settings.sbpAutomationEnabled !== false) {
        try {
          order = await createProviderPayment(telegramId, order, idempotencyKey);
        } catch (error) {
          console.error("Automatic SBP payment creation failed", error instanceof Error ? error.message : error);
          await rest(
            `nastardamus_sbp_topups?id=eq.${encodeURIComponent(String(order?.id || ""))}`
              + `&telegram_id=eq.${telegramId}&provider_payment_id=is.null&status=eq.pending`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
              body: JSON.stringify({
                status: "cancelled",
                provider_status: "creation_failed",
                updated_at: new Date().toISOString()
              })
            }
          ).catch(() => null);
          throw new Error("payment_provider_unavailable");
        }
      }
      return json(200, { ok: true, order });
    }

    if (action === "mark_sbp_topup_sent") {
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) {
        return json(400, { error: "invalid_telegram_id" });
      }
      const orderId = String(body?.orderId || "");
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId)) {
        return json(400, { error: "invalid_order_id" });
      }
      const response = await rest("rpc/nastardamus_mark_sbp_topup_sent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          p_telegram_id: telegramId,
          p_order_id: orderId
        })
      });
      return json(200, { ok: true, order: await response.json() });
    }

    if (action === "charge_service") {
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) {
        return json(400, { error: "invalid_telegram_id" });
      }
      const serviceId = String(body?.serviceId || "");
      const idempotencyKey = String(body?.idempotencyKey || "").trim();
      if (!/^[a-z0-9_-]{1,64}$/.test(serviceId)) {
        return json(400, { error: "invalid_service_id" });
      }
      if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/.test(idempotencyKey)) {
        return json(400, { error: "invalid_idempotency_key" });
      }
      const response = await rest("rpc/nastardamus_charge_service", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          p_telegram_id: telegramId,
          p_service_id: serviceId,
          p_idempotency_key: idempotencyKey
        })
      });
      return json(200, { ok: true, charge: await response.json() });
    }

    if (action === "complete_service_charge" || action === "refund_service_charge") {
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) {
        return json(400, { error: "invalid_telegram_id" });
      }
      const chargeId = String(body?.chargeId || "");
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(chargeId)) {
        return json(400, { error: "invalid_charge_id" });
      }
      const refund = action === "refund_service_charge";
      const response = await rest(
        refund ? "rpc/nastardamus_refund_service_charge" : "rpc/nastardamus_complete_service_charge",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(refund
            ? {
                p_telegram_id: telegramId,
                p_charge_id: chargeId,
                p_reason: String(body?.reason || "provider_error").slice(0, 200)
              }
            : {
                p_telegram_id: telegramId,
                p_charge_id: chargeId
              })
        }
      );
      return json(200, { ok: true, charge: await response.json() });
    }

    if (action === "register_user" || action === "update_user_preferences") {
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) {
        return json(400, { error: "invalid_telegram_id" });
      }
      const chatId = Number(body?.chatId || telegramId);
      if (!Number.isSafeInteger(chatId) || chatId <= 0) {
        return json(400, { error: "invalid_chat_id" });
      }
      const signs = new Set([
        "aries", "taurus", "gemini", "cancer", "leo", "virgo",
        "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces"
      ]);
      const zodiacSign = body?.zodiacSign ? String(body.zodiacSign) : null;
      if (zodiacSign && !signs.has(zodiacSign)) return json(400, { error: "invalid_zodiac_sign" });
      const gender = body?.gender ? String(body.gender) : "unspecified";
      if (!["female", "male", "unspecified"].includes(gender)) {
        return json(400, { error: "invalid_gender" });
      }
      const payload: Record<string, unknown> = {
        telegram_id: telegramId,
        chat_id: chatId,
        updated_at: new Date().toISOString()
      };
      if (action === "register_user") {
        payload.username = String(body?.username || "").replace(/^@/, "").slice(0, 64) || null;
        payload.first_name = String(body?.firstName || "").trim().slice(0, 80) || null;
      } else {
        payload.zodiac_sign = zodiacSign;
        payload.daily_horoscope_enabled = body?.enabled === true;
        payload.timezone = String(body?.timezone || "Europe/Berlin").slice(0, 80);
        payload.gender = gender;
      }
      await rest("nastardamus_users?on_conflict=telegram_id", {
        method: "POST",
        headers: { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(payload)
      });
      return json(200, { ok: true });
    }

    if (action === "get_user_preferences") {
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) {
        return json(400, { error: "invalid_telegram_id" });
      }
      const response = await rest(`nastardamus_users?telegram_id=eq.${telegramId}&select=zodiac_sign,daily_horoscope_enabled,timezone,gender,last_horoscope_sent_on&limit=1`);
      const rows = await response.json();
      return json(200, { ok: true, preferences: rows?.[0] || null });
    }

    if (action === "list_horoscope_recipients") {
      const today = String(body?.today || "");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) return json(400, { error: "invalid_date" });
      const settings = await readSettings();
      if (settings.dailyHoroscopeEnabled === false) {
        return json(200, { ok: true, recipients: [] });
      }
      const limit = Math.max(1, Math.min(500, Number(body?.limit || 200)));
      const response = await rest(
        `nastardamus_users?daily_horoscope_enabled=eq.true&zodiac_sign=not.is.null&or=(last_horoscope_sent_on.is.null,last_horoscope_sent_on.lt.${today})&select=telegram_id,chat_id,first_name,zodiac_sign,gender&order=telegram_id.asc&limit=${limit}`
      );
      return json(200, { ok: true, recipients: await response.json() });
    }

    if (action === "mark_horoscope_sent") {
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) {
        return json(400, { error: "invalid_telegram_id" });
      }
      const sentOn = String(body?.sentOn || "");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(sentOn)) return json(400, { error: "invalid_date" });
      await rest(`nastardamus_users?telegram_id=eq.${telegramId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ last_horoscope_sent_on: sentOn, updated_at: new Date().toISOString() })
      });
      return json(200, { ok: true });
    }

    if (action === "take_rate_limit") {
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) {
        return json(400, { error: "invalid_telegram_id" });
      }
      const scope = String(body?.scope || "");
      const limit = Number(body?.limit);
      const windowSeconds = Number(body?.windowSeconds);
      if (!/^[a-z0-9:_-]{1,80}$/.test(scope)) {
        return json(400, { error: "invalid_scope" });
      }
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000) {
        return json(400, { error: "invalid_limit" });
      }
      if (!Number.isSafeInteger(windowSeconds) || windowSeconds < 1 || windowSeconds > 86400) {
        return json(400, { error: "invalid_window" });
      }
      const response = await rest("rpc/nastardamus_take_rate_limit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          p_telegram_id: telegramId,
          p_scope: scope,
          p_limit: limit,
          p_window_seconds: windowSeconds
        })
      });
      const result = await response.json();
      return json(200, { ok: true, ...result });
    }

    if (action === "claim_telegram_update") {
      const updateId = Number(body?.updateId);
      const botScope = String(body?.botScope || "app");
      if (!Number.isSafeInteger(updateId) || updateId < 0) {
        return json(400, { error: "invalid_update_id" });
      }
      if (!/^[a-z0-9_-]{1,40}$/.test(botScope)) {
        return json(400, { error: "invalid_bot_scope" });
      }
      const response = await rest("rpc/nastardamus_claim_telegram_update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          p_bot_scope: botScope,
          p_update_id: updateId
        })
      });
      const claimed = await response.json();
      return json(200, { ok: true, claimed: claimed === true });
    }

    if (action === "request_withdrawal") {
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) {
        return json(400, { error: "invalid_telegram_id" });
      }
      await ensureWallet(telegramId);
      const settings = await readSettings();
      if (settings.withdrawalsEnabled !== true) {
        return json(403, { error: "withdrawals_disabled" });
      }
      const amountUnits = Number(body?.amountUnits);
      const destination = String(body?.destination || "").trim();
      const idempotencyKey = String(body?.idempotencyKey || "").trim();
      if (!Number.isSafeInteger(amountUnits) || amountUnits <= 0) {
        return json(400, { error: "invalid_amount" });
      }
      if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/.test(idempotencyKey)) {
        return json(400, { error: "invalid_idempotency_key" });
      }
      const fee = Math.min(100, Math.max(0, Number(settings.withdrawalFee ?? 25)));
      const minimumUnits = Math.max(0, Math.round(Number(settings.minimumWithdrawal ?? 25) * 100));
      const response = await rest("rpc/nastardamus_request_withdrawal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          p_telegram_id: telegramId,
          p_amount_units: amountUnits,
          p_fee_percent: fee,
          p_minimum_units: minimumUnits,
          p_destination: destination,
          p_idempotency_key: idempotencyKey
        })
      });
      const result = await response.json();
      return json(200, { ok: true, withdrawal: result });
    }

    return json(400, { error: "unknown_action" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "wallet_store_failed";
    console.error("nastardamus-user-store failed", message);
    if (message.includes("below_minimum")) return json(400, { error: "below_minimum" });
    if (message.includes("insufficient_funds")) return json(400, { error: "insufficient_funds" });
    if (message.includes("payments_disabled")) return json(403, { error: "payments_disabled" });
    if (message.includes("sbp_topups_disabled")) return json(403, { error: "sbp_topups_disabled" });
    if (message.includes("below_topup_minimum")) return json(400, { error: "below_topup_minimum" });
    if (message.includes("above_topup_maximum")) return json(400, { error: "above_topup_maximum" });
    if (message.includes("sbp_rate_not_configured") || message.includes("sbp_recipient_not_configured") || message.includes("sbp_destination_not_configured")) {
      return json(503, { error: "sbp_not_configured" });
    }
    if (message.includes("payment_provider_unavailable")) {
      return json(503, { error: "payment_provider_unavailable" });
    }
    if (message.includes("service_price_not_configured")) return json(503, { error: "service_price_not_configured" });
    if (message.includes("service_disabled")) return json(403, { error: "service_disabled" });
    if (message.includes("topup_not_found")) return json(404, { error: "topup_not_found" });
    if (message.includes("topup_not_pending") || message.includes("topup_already_reviewed")) return json(409, { error: "topup_not_pending" });
    if (message.includes("topup_expired")) return json(409, { error: "topup_expired" });
    if (message.includes("invalid_destination")) return json(400, { error: "invalid_destination" });
    if (message.includes("invalid_idempotency_key")) return json(400, { error: "invalid_idempotency_key" });
    if (message.includes("wheel_disabled")) return json(403, { error: "wheel_disabled" });
    if (message.includes("wheel_daily_limit")) return json(409, { error: "wheel_daily_limit" });
    if (message.includes("wheel_rewards_exhausted")) return json(409, { error: "wheel_rewards_exhausted" });
    return json(502, { error: "wallet_store_failed" });
  }
});
