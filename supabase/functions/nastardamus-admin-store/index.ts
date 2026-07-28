import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ADMIN_BOT_ID = Number(Deno.env.get("NASTARDAMUS_ADMIN_BOT_ID") || 7213010066);
const TOKEN_CACHE_TTL_MS = 10 * 60 * 1000;
const verifiedTokens = new Map<string, number>();
const ALLOWED_ROLES = new Set(["owner", "admin", "manager", "support", "moderator", "analyst"]);
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

    if (action === "list_sbp_topups") {
      const response = await rest(
        "nastardamus_sbp_topups?select=id,telegram_id,silarum_units,ruble_kopecks,payment_reference,status,reviewed_by,review_note,created_at,updated_at,paid_at,expires_at&order=created_at.desc&limit=100"
      );
      return json(200, { ok: true, orders: await response.json() });
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
      const role = ALLOWED_ROLES.has(String(input.role)) ? String(input.role) : "support";
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

    if (action === "claim_telegram_update") {
      const updateId = Number(body.updateId);
      const botScope = String(body.botScope || "admin");
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

    return json(400, { error: "unknown_action" });
  } catch (error) {
    console.error("nastardamus-admin-store failed", error);
    return json(502, { error: "admin_store_failed" });
  }
});
