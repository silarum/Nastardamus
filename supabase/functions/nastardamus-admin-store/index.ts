import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ADMIN_BOT_ID = Number(Deno.env.get("NASTARDAMUS_ADMIN_BOT_ID") || 7213010066);
const TOKEN_CACHE_TTL_MS = 10 * 60 * 1000;
const verifiedTokens = new Map<string, number>();
const ALLOWED_ROLES = new Set(["owner", "admin", "operator"]);
const ALLOWED_PERMISSIONS = new Set([
  "admins.manage", "settings.manage", "finance.view", "finance.manage",
  "services.manage", "users.view", "users.manage", "content.manage",
  "palmlink.moderate", "support.view", "support.reply", "support.manage",
  "audit.view", "ai.view", "ai.manage"
]);
const PROVIDER_TYPES = new Set(["openai_compatible", "openai", "anthropic", "google", "custom"]);
const OFFICIAL_PROVIDER_HOSTS: Record<string, Set<string>> = {
  openai: new Set(["api.openai.com"]),
  openai_compatible: new Set(["openrouter.ai"]),
  anthropic: new Set(["api.anthropic.com"]),
  google: new Set(["generativelanguage.googleapis.com"])
};

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("NASTARDAMUS_ALLOWED_ORIGIN")
    || "https://nastardamus.vercel.app",
  "Access-Control-Allow-Headers": "content-type,x-admin-bot-token",
  "Access-Control-Allow-Methods": "POST,OPTIONS"
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}

function cleanText(value: unknown, maxLength: number) {
  return String(value || "").trim().slice(0, maxLength);
}

function cleanPermissions(value: unknown) {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const result: Record<string, boolean> = {};
  for (const [key, enabled] of Object.entries(source)) {
    if (ALLOWED_PERMISSIONS.has(key) && enabled === true) result[key] = true;
  }
  return result;
}

function cleanWorkingHours(value: unknown) {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const days = Array.isArray(source.days)
    ? source.days.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    : [1, 2, 3, 4, 5];
  const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
  return {
    timezone: cleanText(source.timezone || "Europe/Berlin", 80) || "Europe/Berlin",
    days: [...new Set(days)],
    from: timePattern.test(String(source.from || "")) ? String(source.from) : "09:00",
    to: timePattern.test(String(source.to || "")) ? String(source.to) : "18:00"
  };
}

function cleanCapabilities(value: unknown) {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    text: source.text !== false,
    vision: source.vision === true,
    moderation: source.moderation === true,
    embeddings: source.embeddings === true,
    audio: source.audio === true
  };
}

function cleanChannels(value: unknown) {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    app: source.app !== false,
    telegram: source.telegram === true,
    admin: source.admin === true
  };
}

function isUuid(value: unknown) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function encryptionKey(token: string) {
  const stableSecret = Deno.env.get("NASTARDAMUS_ENCRYPTION_SECRET")
    || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    || token;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(stableSecret));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function encryptSecret(secret: string, token: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await encryptionKey(token);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(secret)
  );
  return {
    ciphertext: bytesToBase64(new Uint8Array(encrypted)),
    iv: bytesToBase64(iv),
    hint: secret.length <= 4 ? "••••" : `••••${secret.slice(-4)}`
  };
}

async function decryptSecret(ciphertext: string, iv: string, token: string) {
  const key = await encryptionKey(token);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(iv) },
    key,
    base64ToBytes(ciphertext)
  );
  return new TextDecoder().decode(decrypted);
}

async function verifyAdminBotToken(token: string) {
  if (!token || token.length < 20) return false;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  const cacheKey = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  const cachedUntil = verifiedTokens.get(cacheKey) || 0;
  if (cachedUntil > Date.now()) return true;

  const response = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: "{}"
  });
  const data = await response.json().catch(() => null);
  const valid = Boolean(response.ok && data?.ok && Number(data.result?.id) === ADMIN_BOT_ID);
  if (valid) verifiedTokens.set(cacheKey, Date.now() + TOKEN_CACHE_TTL_MS);
  return valid;
}

function validateProviderBaseUrl(value: unknown, providerType: string) {
  const raw = cleanText(value, 500);
  if (!raw) return null;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("invalid_ai_base_url");
  }

  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) {
    throw new Error("invalid_ai_base_url");
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (
    hostname === "localhost"
    || hostname.endsWith(".localhost")
    || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)
    || hostname.includes(":")
  ) {
    throw new Error("untrusted_ai_provider_host");
  }

  const configuredHosts = new Set(
    String(Deno.env.get("NASTARDAMUS_AI_PROVIDER_HOSTS") || "")
      .split(/[\s,;]+/)
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean)
  );
  const allowed = OFFICIAL_PROVIDER_HOSTS[providerType] || configuredHosts;
  if (!allowed.has(hostname) && !configuredHosts.has(hostname)) {
    throw new Error("untrusted_ai_provider_host");
  }
  return url.toString().replace(/\/$/, "");
}

async function rest(path: string, options: RequestInit = {}) {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("supabase_env_missing");
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: { apikey: key, Authorization: `Bearer ${key}`, ...(options.headers || {}) }
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("Supabase REST failed", response.status, detail.slice(0, 500));
    throw new Error(`rest_${response.status}`);
  }
  return response;
}

async function writeRow(path: string, payload: unknown, method = "POST") {
  const response = await rest(path, {
    method,
    headers: { "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify(payload)
  });
  const rows = await response.json().catch(() => []);
  return rows?.[0] || null;
}

async function countRows(path: string) {
  const response = await rest(path, {
    headers: { Prefer: "count=exact", Range: "0-0" }
  });
  const total = Number(String(response.headers.get("content-range") || "").split("/").pop());
  return Number.isSafeInteger(total) && total >= 0 ? total : 0;
}

async function userExists(telegramId: number) {
  const response = await rest(`nastardamus_users?telegram_id=eq.${telegramId}&select=telegram_id&limit=1`);
  return Boolean((await response.json())?.[0]);
}

function validTimezone(value: unknown) {
  const timezone = cleanText(value || "Europe/Berlin", 80) || "Europe/Berlin";
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone }).format(new Date());
    return timezone;
  } catch {
    return "";
  }
}

function safeDate(value: unknown) {
  const text = cleanText(value, 40);
  const timestamp = Date.parse(text);
  return Number.isFinite(timestamp) ? new Date(timestamp) : null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const token = req.headers.get("x-admin-bot-token") || "";
  if (!(await verifyAdminBotToken(token))) return json(401, { error: "invalid_admin_bot_token" });

  const body = await req.json().catch(() => ({}));
  const action = String(body?.action || "");

  try {
    if (action === "read_settings") {
      const response = await rest("nastardamus_settings?key=eq.global&select=settings&limit=1");
      const rows = await response.json();
      return json(200, { ok: true, settings: rows?.[0]?.settings || null });
    }

    if (action === "write_settings") {
      const currentResponse = await rest("nastardamus_settings?key=eq.global&select=settings&limit=1");
      const currentRows = await currentResponse.json();
      const current = currentRows?.[0]?.settings && typeof currentRows[0].settings === "object"
        ? currentRows[0].settings
        : {};
      const incoming = body.settings && typeof body.settings === "object" ? body.settings : {};
      await rest("nastardamus_settings?on_conflict=key", {
        method: "POST",
        headers: { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ key: "global", settings: { ...current, ...incoming }, updated_at: new Date().toISOString() })
      });
      return json(200, { ok: true });
    }

    if (action === "admin_overview") {
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString();
      const [
        users,
        completedProfiles,
        newUsers7d,
        horoscopeEnabled,
        activeVip,
        readings,
        openSupport,
        pendingPayments,
        walletResponse,
        paidLedgerResponse
      ] = await Promise.all([
        countRows("nastardamus_users?select=telegram_id"),
        countRows("nastardamus_users?profile_completed_at=not.is.null&select=telegram_id"),
        countRows(`nastardamus_users?created_at=gte.${encodeURIComponent(sevenDaysAgo)}&select=telegram_id`),
        countRows("nastardamus_users?daily_horoscope_enabled=eq.true&select=telegram_id"),
        countRows(`nastardamus_vip_subscriptions?status=eq.active&expires_at=gt.${encodeURIComponent(now.toISOString())}&select=id`),
        countRows("nastardamus_reading_sessions?deleted_at=is.null&select=id"),
        countRows("nastardamus_support_tickets?status=in.(open,pending)&select=id"),
        countRows("nastardamus_sbp_topups?status=in.(pending,awaiting_confirmation)&select=id"),
        rest("nastardamus_wallets?select=balance_units,locked_units&limit=5000"),
        rest(`nastardamus_wallet_ledger?amount_units=gt.0&created_at=gte.${encodeURIComponent(thirtyDaysAgo)}&select=amount_units&limit=5000`)
      ]);
      const wallets = await walletResponse.json();
      const paidLedger = await paidLedgerResponse.json();
      return json(200, {
        ok: true,
        metrics: {
          users,
          completedProfiles,
          newUsers7d,
          horoscopeEnabled,
          activeVip,
          readings,
          openSupport,
          pendingPayments,
          walletBalanceUnits: wallets.reduce((sum: number, row: Record<string, unknown>) => sum + Number(row.balance_units || 0), 0),
          walletLockedUnits: wallets.reduce((sum: number, row: Record<string, unknown>) => sum + Number(row.locked_units || 0), 0),
          paidUnits30d: paidLedger.reduce((sum: number, row: Record<string, unknown>) => sum + Number(row.amount_units || 0), 0),
          generatedAt: now.toISOString()
        }
      });
    }

    if (action === "list_users") {
      const search = cleanText(body.search, 80).toLocaleLowerCase("ru-RU");
      const filter = ["all", "vip", "horoscope", "complete", "incomplete"].includes(String(body.filter))
        ? String(body.filter)
        : "all";
      const page = Math.max(1, Math.min(10000, Number(body.page) || 1));
      const limit = Math.max(10, Math.min(50, Number(body.limit) || 20));
      const includeFinance = body.includeFinance === true;
      const usersResponse = await rest(
        "nastardamus_users?select=telegram_id,username,first_name,profile_name,timezone,zodiac_sign,daily_horoscope_enabled,last_horoscope_sent_on,gender,birth_year,city,profile_completed_at,created_at,updated_at&order=updated_at.desc&limit=2000"
      );
      const userRows = await usersResponse.json();
      if (!userRows.length) {
        return json(200, { ok: true, users: [], pagination: { page, limit, total: 0, pages: 1 } });
      }
      const [walletResponse, vipResponse, readingResponse] = await Promise.all([
        includeFinance
          ? rest("nastardamus_wallets?select=telegram_id,balance_units,locked_units&limit=5000")
          : Promise.resolve(null),
        rest(`nastardamus_vip_subscriptions?status=eq.active&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=telegram_id,plan_id,expires_at&order=expires_at.desc&limit=5000`),
        rest("nastardamus_reading_sessions?deleted_at=is.null&select=telegram_id&limit=10000")
      ]);
      const wallets = walletResponse ? await walletResponse.json() : [];
      const vipRows = await vipResponse.json();
      const readingRows = await readingResponse.json();
      const walletByUser = new Map(wallets.map((row: Record<string, unknown>) => [Number(row.telegram_id), row]));
      const vipByUser = new Map<number, Record<string, unknown>>();
      for (const row of vipRows) {
        const id = Number(row.telegram_id);
        if (!vipByUser.has(id)) vipByUser.set(id, row);
      }
      const readingsByUser = new Map<number, number>();
      for (const row of readingRows) {
        const id = Number(row.telegram_id);
        readingsByUser.set(id, (readingsByUser.get(id) || 0) + 1);
      }
      const summaries = userRows.map((row: Record<string, unknown>) => {
        const telegramId = Number(row.telegram_id);
        const wallet = walletByUser.get(telegramId) as Record<string, unknown> | undefined;
        const vip = vipByUser.get(telegramId);
        return {
          telegramId,
          username: row.username || null,
          name: row.profile_name || row.first_name || "Пользователь",
          city: row.city || null,
          gender: row.gender || "unspecified",
          zodiacSign: row.zodiac_sign || null,
          horoscopeEnabled: row.daily_horoscope_enabled === true,
          lastHoroscopeSentOn: row.last_horoscope_sent_on || null,
          profileCompleted: Boolean(row.profile_completed_at),
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          readingCount: readingsByUser.get(telegramId) || 0,
          vip: vip ? { planId: vip.plan_id, expiresAt: vip.expires_at } : null,
          ...(includeFinance ? {
            balanceUnits: Number(wallet?.balance_units || 0),
            lockedUnits: Number(wallet?.locked_units || 0)
          } : {})
        };
      }).filter((row: Record<string, unknown>) => {
        const haystack = [row.telegramId, row.username, row.name, row.city, row.zodiacSign]
          .join(" ").toLocaleLowerCase("ru-RU");
        if (search && !haystack.includes(search)) return false;
        if (filter === "vip" && !row.vip) return false;
        if (filter === "horoscope" && row.horoscopeEnabled !== true) return false;
        if (filter === "complete" && row.profileCompleted !== true) return false;
        if (filter === "incomplete" && row.profileCompleted === true) return false;
        return true;
      });
      const total = summaries.length;
      const pages = Math.max(1, Math.ceil(total / limit));
      const safePage = Math.min(page, pages);
      const start = (safePage - 1) * limit;
      return json(200, {
        ok: true,
        users: summaries.slice(start, start + limit),
        pagination: { page: safePage, limit, total, pages }
      });
    }

    if (action === "get_user_admin_view") {
      const telegramId = Number(body.telegramId);
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) return json(400, { error: "invalid_telegram_id" });
      const includeFinance = body.includeFinance === true;
      const userResponse = await rest(
        `nastardamus_users?telegram_id=eq.${telegramId}&select=telegram_id,username,first_name,profile_name,timezone,zodiac_sign,daily_horoscope_enabled,last_horoscope_sent_on,gender,birth_year,birth_date,birth_time,birth_time_known,city,interests,goals,natal_chart,profile_completed_at,created_at,updated_at&limit=1`
      );
      const profile = (await userResponse.json())?.[0];
      if (!profile) return json(200, { ok: true, user: null });
      const financePromise = includeFinance
        ? Promise.all([
            rest(`nastardamus_wallets?telegram_id=eq.${telegramId}&select=balance_units,locked_units,free_spins,created_at,updated_at&limit=1`),
            rest(`nastardamus_wallet_ledger?telegram_id=eq.${telegramId}&select=id,entry_type,amount_units,balance_after_units,locked_after_units,reference_type,reference_id,created_at&order=created_at.desc&limit=30`),
            rest(`nastardamus_payment_orders?telegram_id=eq.${telegramId}&select=id,provider,silarum_units,provider_amount,provider_currency,status,created_at,paid_at&order=created_at.desc&limit=20`)
          ])
        : Promise.resolve([]);
      const [vipResponse, entitlementResponse, readingResponse, usageResponse, financeResponses] = await Promise.all([
        rest(`nastardamus_vip_subscriptions?telegram_id=eq.${telegramId}&select=id,plan_id,status,source,starts_at,expires_at,created_at,updated_at&order=expires_at.desc&limit=10`),
        rest(`nastardamus_service_entitlements?telegram_id=eq.${telegramId}&select=service_id,quantity,updated_at&order=service_id.asc`),
        rest(`nastardamus_reading_sessions?telegram_id=eq.${telegramId}&deleted_at=is.null&select=id,kind,subtype,title,state,is_favorite,completed_at,created_at,updated_at&order=created_at.desc&limit=25`),
        rest(`nastardamus_free_usage?telegram_id=eq.${telegramId}&select=service_id,usage_date,uses,updated_at&order=usage_date.desc&limit=30`),
        financePromise
      ]);
      const [walletResponse, ledgerResponse, paymentResponse] = financeResponses as Response[];
      return json(200, {
        ok: true,
        user: {
          profile,
          vip: await vipResponse.json(),
          entitlements: await entitlementResponse.json(),
          readings: await readingResponse.json(),
          freeUsage: await usageResponse.json(),
          ...(includeFinance ? {
            wallet: (await walletResponse.json())?.[0] || { balance_units: 0, locked_units: 0, free_spins: 0 },
            ledger: await ledgerResponse.json(),
            payments: await paymentResponse.json()
          } : {})
        }
      });
    }

    if (action === "admin_update_user_delivery") {
      const telegramId = Number(body.telegramId);
      const timezone = validTimezone(body.timezone);
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) return json(400, { error: "invalid_telegram_id" });
      if (!timezone) return json(400, { error: "invalid_timezone" });
      if (!(await userExists(telegramId))) return json(404, { error: "user_not_found" });
      const row = await writeRow(
        `nastardamus_users?telegram_id=eq.${telegramId}`,
        {
          daily_horoscope_enabled: body.enabled === true,
          timezone,
          updated_at: new Date().toISOString()
        },
        "PATCH"
      );
      return json(200, { ok: true, user: row });
    }

    if (action === "admin_set_user_vip") {
      const telegramId = Number(body.telegramId);
      const adminId = Number(body.adminId);
      const active = body.active === true;
      const planId = cleanText(body.planId || "vip-month", 64);
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) return json(400, { error: "invalid_telegram_id" });
      if (!Number.isSafeInteger(adminId) || adminId <= 0) return json(400, { error: "invalid_admin_id" });
      if (!/^[a-z0-9][a-z0-9_-]{1,63}$/.test(planId)) return json(400, { error: "invalid_plan_id" });
      if (!(await userExists(telegramId))) return json(404, { error: "user_not_found" });
      if (!active) {
        await rest(`nastardamus_vip_subscriptions?telegram_id=eq.${telegramId}&status=eq.active`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ status: "cancelled", updated_at: new Date().toISOString() })
        });
        return json(200, { ok: true, vip: null });
      }
      const expiry = safeDate(body.expiresAt);
      const now = Date.now();
      if (!expiry || expiry.getTime() < now + 3600000 || expiry.getTime() > now + 3660 * 86400000) {
        return json(400, { error: "invalid_vip_expiry" });
      }
      const [planResponse, existingResponse] = await Promise.all([
        rest(`nastardamus_vip_plans?id=eq.${encodeURIComponent(planId)}&is_active=eq.true&select=id&limit=1`),
        rest(`nastardamus_vip_subscriptions?telegram_id=eq.${telegramId}&status=eq.active&select=id,plan_id,expires_at&order=expires_at.desc&limit=10`)
      ]);
      if (!(await planResponse.json())?.[0]) return json(400, { error: "vip_plan_not_found" });
      const existing = await existingResponse.json();
      const primary = existing?.[0];
      const payload = {
        telegram_id: telegramId,
        plan_id: planId,
        status: "active",
        source: "admin",
        starts_at: new Date().toISOString(),
        expires_at: expiry.toISOString(),
        metadata: { admin_id: adminId },
        updated_at: new Date().toISOString()
      };
      const vip = primary
        ? await writeRow(`nastardamus_vip_subscriptions?id=eq.${primary.id}`, payload, "PATCH")
        : await writeRow("nastardamus_vip_subscriptions", payload);
      if (existing.length > 1) {
        const otherIds = existing.slice(1).map((row: Record<string, unknown>) => row.id).filter(Boolean);
        if (otherIds.length) {
          await rest(`nastardamus_vip_subscriptions?id=in.(${otherIds.join(",")})`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
            body: JSON.stringify({ status: "cancelled", updated_at: new Date().toISOString() })
          });
        }
      }
      return json(200, { ok: true, vip });
    }

    if (action === "admin_set_user_entitlement") {
      const telegramId = Number(body.telegramId);
      const serviceId = cleanText(body.serviceId, 100);
      const quantity = Number(body.quantity);
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) return json(400, { error: "invalid_telegram_id" });
      if (!/^[a-z0-9:_-]{1,100}$/.test(serviceId)) return json(400, { error: "invalid_service_id" });
      if (!Number.isInteger(quantity) || quantity < 0 || quantity > 10000) return json(400, { error: "invalid_quantity" });
      if (!(await userExists(telegramId))) return json(404, { error: "user_not_found" });
      await rest("nastardamus_service_entitlements?on_conflict=telegram_id,service_id", {
        method: "POST",
        headers: { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ telegram_id: telegramId, service_id: serviceId, quantity, updated_at: new Date().toISOString() })
      });
      return json(200, { ok: true });
    }

    if (action === "admin_reset_user_daily_usage") {
      const telegramId = Number(body.telegramId);
      const serviceId = cleanText(body.serviceId, 100);
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) return json(400, { error: "invalid_telegram_id" });
      if (serviceId && !/^[a-z0-9:_-]{1,100}$/.test(serviceId)) return json(400, { error: "invalid_service_id" });
      if (!(await userExists(telegramId))) return json(404, { error: "user_not_found" });
      const serviceFilter = serviceId ? `&service_id=eq.${encodeURIComponent(serviceId)}` : "";
      await rest(`nastardamus_free_usage?telegram_id=eq.${telegramId}${serviceFilter}`, {
        method: "DELETE",
        headers: { Prefer: "return=minimal" }
      });
      return json(200, { ok: true });
    }

    if (action === "list_admin_audit") {
      const limit = Math.max(20, Math.min(200, Number(body.limit) || 100));
      const [auditResponse, adminsResponse] = await Promise.all([
        rest(`nastardamus_admin_audit?select=id,telegram_id,action,payload,created_at&order=created_at.desc&limit=${limit}`),
        rest("nastardamus_admins?select=telegram_id,display_name,username,role")
      ]);
      const admins = new Map((await adminsResponse.json()).map((row: Record<string, unknown>) => [Number(row.telegram_id), row]));
      const entries = (await auditResponse.json()).map((row: Record<string, unknown>) => {
        const admin = admins.get(Number(row.telegram_id)) as Record<string, unknown> | undefined;
        return {
          id: row.id,
          telegramId: Number(row.telegram_id),
          adminName: admin?.display_name || admin?.username || `ID ${row.telegram_id}`,
          role: admin?.role || null,
          action: row.action,
          payload: row.payload && typeof row.payload === "object" ? row.payload : {},
          createdAt: row.created_at
        };
      });
      return json(200, { ok: true, entries });
    }

    if (action === "read_payment_provider") {
      const response = await rest(
        "nastardamus_payment_providers?key=eq.sbp&select=provider_type,enabled,merchant_id,secret_hint,updated_by,updated_at&limit=1"
      );
      const rows = await response.json();
      return json(200, {
        ok: true,
        provider: rows?.[0] || {
          provider_type: "yookassa",
          enabled: false,
          merchant_id: "",
          secret_hint: null,
          updated_by: null,
          updated_at: null
        }
      });
    }

    if (action === "write_payment_provider") {
      const provider = body.provider && typeof body.provider === "object"
        ? body.provider as Record<string, unknown>
        : {};
      const adminId = Number(provider.updatedBy);
      const merchantId = cleanText(provider.merchantId, 40);
      const secret = cleanText(provider.secret, 300);
      const enabled = provider.enabled === true;
      if (!Number.isSafeInteger(adminId) || adminId <= 0) {
        return json(400, { error: "invalid_admin_id" });
      }
      if (merchantId && !/^\d{3,32}$/.test(merchantId)) {
        return json(400, { error: "invalid_payment_merchant_id" });
      }
      if (secret && secret.length < 16) {
        return json(400, { error: "invalid_payment_secret" });
      }

      const existingResponse = await rest(
        "nastardamus_payment_providers?key=eq.sbp&select=secret_ciphertext,secret_iv,secret_hint&limit=1"
      );
      const existingRows = await existingResponse.json();
      const existing = existingRows?.[0] || {};
      let encrypted = {
        ciphertext: String(existing.secret_ciphertext || ""),
        iv: String(existing.secret_iv || ""),
        hint: String(existing.secret_hint || "")
      };
      if (secret) encrypted = await encryptSecret(secret, token);
      if (enabled && (!merchantId || !encrypted.ciphertext || !encrypted.iv)) {
        return json(400, { error: "payment_provider_credentials_required" });
      }

      await rest("nastardamus_payment_providers?on_conflict=key", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal"
        },
        body: JSON.stringify({
          key: "sbp",
          provider_type: "yookassa",
          enabled,
          merchant_id: merchantId,
          secret_ciphertext: encrypted.ciphertext || null,
          secret_iv: encrypted.iv || null,
          secret_hint: encrypted.hint || null,
          updated_by: adminId,
          updated_at: new Date().toISOString()
        })
      });
      return json(200, {
        ok: true,
        provider: {
          provider_type: "yookassa",
          enabled,
          merchant_id: merchantId,
          secret_hint: encrypted.hint || null,
          updated_by: adminId
        }
      });
    }

    if (action === "list_sbp_topups") {
      const response = await rest(
        "nastardamus_sbp_topups?select=id,telegram_id,silarum_units,ruble_kopecks,payment_reference,status,provider_type,provider_payment_id,provider_status,verification_state,reviewed_by,review_note,created_at,updated_at,paid_at,expires_at&order=created_at.desc&limit=100"
      );
      return json(200, { ok: true, orders: await response.json() });
    }

    if (action === "credit_admin_self") {
      const adminId = Number(body.adminId);
      const amountUnits = Number(body.amountUnits);
      const idempotencyKey = cleanText(body.idempotencyKey, 128);
      if (!Number.isSafeInteger(adminId) || adminId <= 0) {
        return json(400, { error: "invalid_admin_id" });
      }
      if (!Number.isSafeInteger(amountUnits) || amountUnits <= 0 || amountUnits > 100000000) {
        return json(400, { error: "invalid_amount" });
      }
      if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/.test(idempotencyKey)) {
        return json(400, { error: "invalid_idempotency_key" });
      }
      const response = await rest("rpc/nastardamus_credit_admin_self", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          p_admin_id: adminId,
          p_amount_units: amountUnits,
          p_idempotency_key: idempotencyKey,
          p_note: cleanText(body.note, 300) || null
        })
      });
      return json(200, { ok: true, credit: await response.json() });
    }

    if (action === "resolve_wallet_target") {
      const target = cleanText(body.target, 80).replace(/^@/, "");
      let response: Response;
      if (/^\d{1,20}$/.test(target) && Number.isSafeInteger(Number(target)) && Number(target) > 0) {
        response = await rest(
          `nastardamus_users?telegram_id=eq.${Number(target)}`
            + "&select=telegram_id,username,first_name&limit=1"
        );
        const row = (await response.json())?.[0];
        return json(200, {
          ok: true,
          user: row ? {
            telegramId: Number(row.telegram_id),
            username: row.username || null,
            firstName: row.first_name || null
          } : { telegramId: Number(target), username: null, firstName: null }
        });
      }
      if (!/^[A-Za-z0-9_]{3,64}$/.test(target)) {
        return json(400, { error: "invalid_wallet_target" });
      }
      response = await rest(
        `nastardamus_users?username=ilike.${encodeURIComponent(target)}`
          + "&select=telegram_id,username,first_name&limit=1"
      );
      const row = (await response.json())?.[0];
      return json(200, {
        ok: true,
        user: row ? {
          telegramId: Number(row.telegram_id),
          username: row.username || null,
          firstName: row.first_name || null
        } : null
      });
    }

    if (action === "adjust_user_wallet") {
      const adminId = Number(body.adminId);
      const telegramId = Number(body.telegramId);
      const amountUnits = Number(body.amountUnits);
      const idempotencyKey = cleanText(body.idempotencyKey, 128);
      if (!Number.isSafeInteger(adminId) || adminId <= 0) {
        return json(400, { error: "invalid_admin_id" });
      }
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) {
        return json(400, { error: "invalid_telegram_id" });
      }
      if (
        !Number.isSafeInteger(amountUnits)
        || amountUnits === 0
        || amountUnits > 100000000
        || amountUnits < -100000000
      ) {
        return json(400, { error: "invalid_amount" });
      }
      if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/.test(idempotencyKey)) {
        return json(400, { error: "invalid_idempotency_key" });
      }
      const response = await rest("rpc/nastardamus_admin_adjust_wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          p_admin_id: adminId,
          p_telegram_id: telegramId,
          p_amount_units: amountUnits,
          p_idempotency_key: idempotencyKey,
          p_note: cleanText(body.note, 300) || null
        })
      });
      return json(200, { ok: true, adjustment: await response.json() });
    }

    if (action === "finance_report") {
      const [ledgerResponse, withdrawalResponse, sbpResponse, externalResponse] = await Promise.all([
        rest("nastardamus_wallet_ledger?select=telegram_id,entry_type,amount_units,reference_type,reference_id,metadata,created_at&order=created_at.desc&limit=5000"),
        rest("nastardamus_withdrawal_requests?select=telegram_id,gross_units,fee_units,net_units,destination,status,created_at,updated_at&order=created_at.desc&limit=2000"),
        rest("nastardamus_sbp_topups?select=telegram_id,silarum_units,ruble_kopecks,payment_reference,status,provider_type,created_at,paid_at&order=created_at.desc&limit=2000"),
        rest("nastardamus_payment_orders?select=telegram_id,provider,silarum_units,provider_amount,provider_currency,payment_reference,status,created_at,paid_at&order=created_at.desc&limit=2000")
      ]);
      return json(200, {
        ok: true,
        report: {
          ledger: await ledgerResponse.json(),
          withdrawals: await withdrawalResponse.json(),
          sbp: await sbpResponse.json(),
          external: await externalResponse.json(),
          generatedAt: new Date().toISOString()
        }
      });
    }

    if (action === "service_popularity") {
      const days = Math.max(1, Math.min(365, Math.round(Number(body?.days || 30))));
      const response = await rest("rpc/nastardamus_service_popularity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ p_days: days })
      });
      return json(200, { ok: true, days, services: await response.json() });
    }

    if (action === "review_sbp_topup") {
      const orderId = String(body.orderId || "");
      const decision = String(body.decision || "");
      const adminId = Number(body.adminId);
      if (!isUuid(orderId)) return json(400, { error: "invalid_order_id" });
      if (!["paid", "rejected"].includes(decision)) {
        return json(400, { error: "invalid_topup_decision" });
      }
      if (!Number.isSafeInteger(adminId) || adminId <= 0) {
        return json(400, { error: "invalid_admin_id" });
      }
      const response = await rest("rpc/nastardamus_review_sbp_topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          p_order_id: orderId,
          p_decision: decision,
          p_admin_id: adminId,
          p_note: cleanText(body.note, 500) || null
        })
      });
      return json(200, { ok: true, order: await response.json() });
    }

    if (action === "get_admin_role") {
      const telegramId = Number(body.telegramId);
      if (!Number.isSafeInteger(telegramId)) return json(400, { error: "invalid_telegram_id" });
      const response = await rest(`nastardamus_admins?telegram_id=eq.${telegramId}&is_active=eq.true&select=role&limit=1`);
      const rows = await response.json();
      return json(200, { ok: true, role: rows?.[0]?.role || null });
    }

    if (action === "get_admin_profile") {
      const telegramId = Number(body.telegramId);
      if (!Number.isSafeInteger(telegramId)) return json(400, { error: "invalid_telegram_id" });
      const response = await rest(`nastardamus_admins?telegram_id=eq.${telegramId}&select=telegram_id,role,display_name,username,permissions,is_active,created_at,updated_at,last_seen_at&limit=1`);
      const rows = await response.json();
      return json(200, { ok: true, profile: rows?.[0] || null });
    }

    if (action === "touch_admin") {
      const telegramId = Number(body.telegramId);
      if (!Number.isSafeInteger(telegramId)) return json(400, { error: "invalid_telegram_id" });
      await rest(`nastardamus_admins?telegram_id=eq.${telegramId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ last_seen_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      });
      return json(200, { ok: true });
    }

    if (action === "list_admins") {
      const response = await rest("nastardamus_admins?select=telegram_id,role,display_name,username,permissions,is_active,created_by,created_at,updated_at,last_seen_at&order=created_at.asc");
      return json(200, { ok: true, admins: await response.json() });
    }

    if (action === "upsert_admin") {
      const input = body.admin && typeof body.admin === "object" ? body.admin : {};
      const telegramId = Number(input.telegramId);
      const role = ALLOWED_ROLES.has(String(input.role)) ? String(input.role) : "operator";
      if (!Number.isSafeInteger(telegramId)) return json(400, { error: "invalid_telegram_id" });
      await rest("nastardamus_admins?on_conflict=telegram_id", {
        method: "POST",
        headers: { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({
          telegram_id: telegramId,
          role,
          display_name: cleanText(input.displayName, 80) || null,
          username: cleanText(input.username, 64).replace(/^@/, "") || null,
          permissions: role === "owner" ? { "*": true } : cleanPermissions(input.permissions),
          is_active: input.isActive !== false,
          created_by: Number.isSafeInteger(Number(input.createdBy)) ? Number(input.createdBy) : null,
          updated_at: new Date().toISOString()
        })
      });
      return json(200, { ok: true });
    }

    if (action === "delete_admin") {
      const telegramId = Number(body.telegramId);
      if (!Number.isSafeInteger(telegramId)) return json(400, { error: "invalid_telegram_id" });
      await rest(`nastardamus_admins?telegram_id=eq.${telegramId}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
      return json(200, { ok: true });
    }

    if (action === "read_support") {
      const response = await rest("nastardamus_support_settings?key=eq.global&select=enabled,support_username,support_chat_id,welcome_message,offline_message,working_hours,response_sla_minutes,allow_attachments,auto_assign,updated_by,updated_at&limit=1");
      const rows = await response.json();
      return json(200, { ok: true, support: rows?.[0] || null });
    }

    if (action === "write_support") {
      const input = body.support && typeof body.support === "object" ? body.support : {};
      const chatId = Number(input.supportChatId);
      const sla = Math.min(10080, Math.max(5, Number(input.responseSlaMinutes) || 240));
      await rest("nastardamus_support_settings?on_conflict=key", {
        method: "POST",
        headers: { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({
          key: "global",
          enabled: input.enabled !== false,
          support_username: cleanText(input.supportUsername, 64).replace(/^@/, "") || null,
          support_chat_id: Number.isSafeInteger(chatId) ? chatId : null,
          welcome_message: cleanText(input.welcomeMessage, 1000) || "Здравствуйте! Опишите вопрос, и команда поддержки ответит вам.",
          offline_message: cleanText(input.offlineMessage, 1000) || "Сейчас операторы не в сети. Мы ответим в рабочее время.",
          working_hours: cleanWorkingHours(input.workingHours),
          response_sla_minutes: Math.round(sla),
          allow_attachments: input.allowAttachments !== false,
          auto_assign: input.autoAssign !== false,
          updated_by: Number.isSafeInteger(Number(input.updatedBy)) ? Number(input.updatedBy) : null,
          updated_at: new Date().toISOString()
        })
      });
      return json(200, { ok: true });
    }

    if (action === "list_ai_providers") {
      const response = await rest("nastardamus_ai_providers?select=id,name,provider_type,base_url,api_key_hint,text_model,vision_model,enabled,priority,capabilities,settings,created_by,updated_by,created_at,updated_at&order=priority.asc,created_at.asc");
      return json(200, { ok: true, providers: await response.json() });
    }

    if (action === "upsert_ai_provider") {
      const input = body.provider && typeof body.provider === "object" ? body.provider : {};
      const id = isUuid(input.id) ? String(input.id) : null;
      const providerType = PROVIDER_TYPES.has(String(input.providerType)) ? String(input.providerType) : "openai_compatible";
      const baseUrl = validateProviderBaseUrl(input.baseUrl, providerType);
      const payload: Record<string, unknown> = {
        name: cleanText(input.name, 100) || "AI Provider",
        provider_type: providerType,
        base_url: baseUrl,
        text_model: cleanText(input.textModel, 160) || null,
        vision_model: cleanText(input.visionModel, 160) || null,
        enabled: input.enabled !== false,
        priority: Math.min(10000, Math.max(1, Math.round(Number(input.priority) || 100))),
        capabilities: cleanCapabilities(input.capabilities),
        settings: input.settings && typeof input.settings === "object" ? input.settings : {},
        updated_by: Number.isSafeInteger(Number(input.updatedBy)) ? Number(input.updatedBy) : null,
        updated_at: new Date().toISOString()
      };
      const apiKey = cleanText(input.apiKey, 1000);
      if (apiKey) {
        const encrypted = await encryptSecret(apiKey, token);
        payload.api_key_ciphertext = encrypted.ciphertext;
        payload.api_key_iv = encrypted.iv;
        payload.api_key_hint = encrypted.hint;
      }
      let provider;
      if (id) {
        provider = await writeRow(`nastardamus_ai_providers?id=eq.${id}`, payload, "PATCH");
      } else {
        payload.created_by = payload.updated_by;
        provider = await writeRow("nastardamus_ai_providers", payload, "POST");
      }
      return json(200, { ok: true, provider });
    }

    if (action === "delete_ai_provider") {
      const id = isUuid(body.id) ? String(body.id) : "";
      if (!id) return json(400, { error: "invalid_provider_id" });
      await rest(`nastardamus_ai_providers?id=eq.${id}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
      return json(200, { ok: true });
    }

    if (action === "resolve_ai_provider") {
      const id = isUuid(body.id) ? String(body.id) : "";
      if (!id) return json(400, { error: "invalid_provider_id" });
      const response = await rest(`nastardamus_ai_providers?id=eq.${id}&enabled=eq.true&select=*&limit=1`);
      const rows = await response.json();
      const provider = rows?.[0];
      if (!provider) return json(404, { error: "provider_not_found" });
      provider.base_url = validateProviderBaseUrl(provider.base_url, provider.provider_type);
      let apiKey = null;
      if (provider.api_key_ciphertext && provider.api_key_iv) {
        apiKey = await decryptSecret(provider.api_key_ciphertext, provider.api_key_iv, token);
      }
      return json(200, { ok: true, provider: { ...provider, api_key_ciphertext: undefined, api_key_iv: undefined, apiKey } });
    }

    if (action === "list_ai_agents") {
      const response = await rest("nastardamus_ai_agents?select=id,slug,name,purpose,instructions,provider_id,fallback_provider_id,model_override,enabled,temperature,max_output_tokens,channels,settings,created_by,updated_by,created_at,updated_at&order=created_at.asc");
      return json(200, { ok: true, agents: await response.json() });
    }

    if (action === "upsert_ai_agent") {
      const input = body.agent && typeof body.agent === "object" ? body.agent : {};
      const id = isUuid(input.id) ? String(input.id) : null;
      const slug = cleanText(input.slug, 80).toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
      if (!slug) return json(400, { error: "invalid_agent_slug" });
      const payload: Record<string, unknown> = {
        slug,
        name: cleanText(input.name, 120) || slug,
        purpose: cleanText(input.purpose, 100) || "custom",
        instructions: cleanText(input.instructions, 12000),
        provider_id: isUuid(input.providerId) ? String(input.providerId) : null,
        fallback_provider_id: isUuid(input.fallbackProviderId) ? String(input.fallbackProviderId) : null,
        model_override: cleanText(input.modelOverride, 160) || null,
        enabled: input.enabled !== false,
        temperature: Math.min(2, Math.max(0, Number(input.temperature) || 0.4)),
        max_output_tokens: Math.min(20000, Math.max(100, Math.round(Number(input.maxOutputTokens) || 1200))),
        channels: cleanChannels(input.channels),
        settings: input.settings && typeof input.settings === "object" ? input.settings : {},
        updated_by: Number.isSafeInteger(Number(input.updatedBy)) ? Number(input.updatedBy) : null,
        updated_at: new Date().toISOString()
      };
      let agent;
      if (id) agent = await writeRow(`nastardamus_ai_agents?id=eq.${id}`, payload, "PATCH");
      else {
        payload.created_by = payload.updated_by;
        agent = await writeRow("nastardamus_ai_agents", payload, "POST");
      }
      return json(200, { ok: true, agent });
    }

    if (action === "delete_ai_agent") {
      const id = isUuid(body.id) ? String(body.id) : "";
      if (!id) return json(400, { error: "invalid_agent_id" });
      await rest(`nastardamus_ai_agents?id=eq.${id}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
      return json(200, { ok: true });
    }

    if (action === "read_ai_moderation") {
      const response = await rest("nastardamus_ai_moderation_policy?key=eq.global&select=enabled,rules,thresholds,actions,updated_by,updated_at&limit=1");
      const rows = await response.json();
      return json(200, { ok: true, moderation: rows?.[0] || null });
    }

    if (action === "write_ai_moderation") {
      const input = body.moderation && typeof body.moderation === "object" ? body.moderation : {};
      const rulesSource = input.rules && typeof input.rules === "object" ? input.rules as Record<string, unknown> : {};
      const rules: Record<string, boolean> = {};
      for (const key of ["nudity","sexual_content","minors","violence","self_harm","hate_extremism","illegal_goods","personal_data","spam_duplicates","low_quality","face_count","consent_required","palmlink_profile_safety"]) {
        rules[key] = rulesSource[key] !== false;
      }
      const thresholdsSource = input.thresholds && typeof input.thresholds === "object" ? input.thresholds as Record<string, unknown> : {};
      const thresholds = {
        block: Math.min(1, Math.max(0, Number(thresholdsSource.block) || 0.85)),
        manual_review: Math.min(1, Math.max(0, Number(thresholdsSource.manual_review) || 0.55)),
        minimum_quality: Math.min(1, Math.max(0, Number(thresholdsSource.minimum_quality) || 0.45)),
        maximum_faces: Math.min(20, Math.max(1, Math.round(Number(thresholdsSource.maximum_faces) || 2)))
      };
      const actionsSource = input.actions && typeof input.actions === "object" ? input.actions as Record<string, unknown> : {};
      const actions = {
        high_risk: ["block","review","allow"].includes(String(actionsSource.high_risk)) ? String(actionsSource.high_risk) : "block",
        medium_risk: ["block","review","allow"].includes(String(actionsSource.medium_risk)) ? String(actionsSource.medium_risk) : "review",
        low_risk: ["block","review","allow"].includes(String(actionsSource.low_risk)) ? String(actionsSource.low_risk) : "allow",
        notify_admin: actionsSource.notify_admin !== false,
        retain_flagged_days: Math.min(365, Math.max(0, Math.round(Number(actionsSource.retain_flagged_days) || 30)))
      };
      await rest("nastardamus_ai_moderation_policy?on_conflict=key", {
        method: "POST",
        headers: { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({
          key: "global",
          enabled: input.enabled !== false,
          rules,
          thresholds,
          actions,
          updated_by: Number.isSafeInteger(Number(input.updatedBy)) ? Number(input.updatedBy) : null,
          updated_at: new Date().toISOString()
        })
      });
      return json(200, { ok: true });
    }

    if (action === "write_audit") {
      const telegramId = Number(body.telegramId);
      if (!Number.isSafeInteger(telegramId)) return json(400, { error: "invalid_telegram_id" });
      await rest("nastardamus_admin_audit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ telegram_id: telegramId, action: cleanText(body.auditAction || "unknown", 100), payload: body.payload || {} })
      });
      return json(200, { ok: true });
    }

    if (action === "claim_telegram_update" || action === "release_telegram_update") {
      const updateId = Number(body.updateId);
      const botScope = String(body.botScope || "admin");
      if (!Number.isSafeInteger(updateId) || updateId < 0) {
        return json(400, { error: "invalid_update_id" });
      }
      if (!/^[a-z0-9_-]{1,40}$/.test(botScope)) {
        return json(400, { error: "invalid_bot_scope" });
      }
      const release = action === "release_telegram_update";
      const response = await rest(release ? "rpc/nastardamus_release_telegram_update" : "rpc/nastardamus_claim_telegram_update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          p_bot_scope: botScope,
          p_update_id: updateId
        })
      });
      const value = await response.json();
      return json(200, { ok: true, [release ? "released" : "claimed"]: value === true });
    }

    return json(400, { error: "unknown_action" });
  } catch (error) {
    console.error("nastardamus-admin-store failed", error);
    return json(502, { error: "admin_store_failed" });
  }
});
