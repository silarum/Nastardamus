import "jsr:@supabase/functions-js/edge-runtime.d.ts";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
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
    const detail = await response.text().catch(() => "");
    throw new Error(`rest_${response.status}:${detail.slice(0, 180)}`);
  }
  return response;
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function encryptionKey() {
  const stableSecret = Deno.env.get("NASTARDAMUS_ENCRYPTION_SECRET")
    || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    || "";
  if (!stableSecret) throw new Error("payment_encryption_secret_missing");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(stableSecret));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["decrypt"]);
}

async function decryptSecret(ciphertext: string, iv: string) {
  const key = await encryptionKey();
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(iv) },
    key,
    base64ToBytes(ciphertext)
  );
  return new TextDecoder().decode(decrypted);
}

async function readProvider() {
  const response = await rest(
    "nastardamus_payment_providers?key=eq.sbp&enabled=eq.true&select=merchant_id,secret_ciphertext,secret_iv&limit=1"
  );
  const rows = await response.json();
  const row = rows?.[0];
  if (!row?.merchant_id || !row?.secret_ciphertext || !row?.secret_iv) {
    throw new Error("payment_provider_not_configured");
  }
  return {
    merchantId: String(row.merchant_id),
    secret: await decryptSecret(String(row.secret_ciphertext), String(row.secret_iv))
  };
}

async function fetchPayment(paymentId: string) {
  const provider = await readProvider();
  const response = await fetch(
    `https://api.yookassa.ru/v3/payments/${encodeURIComponent(paymentId)}`,
    {
      headers: {
        Authorization: `Basic ${btoa(`${provider.merchantId}:${provider.secret}`)}`,
        "Content-Type": "application/json"
      },
      signal: AbortSignal.timeout(15_000)
    }
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`payment_provider_${response.status}`);
  return data;
}

function rublesToKopecks(value: unknown) {
  const normalized = String(value || "");
  if (!/^\d{1,9}\.\d{2}$/.test(normalized)) return 0;
  const [rubles, kopecks] = normalized.split(".");
  const amount = Number(rubles) * 100 + Number(kopecks);
  return Number.isSafeInteger(amount) && amount > 0 ? amount : 0;
}

async function settle(payment: Record<string, unknown>) {
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
      p_ruble_kopecks: rublesToKopecks(amount.value),
      p_currency: String(amount.currency || ""),
      p_payment_method: String(method.type || "")
    })
  });
  return await response.json();
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  try {
    const body = await req.json().catch(() => null);
    if (!body || body.type !== "notification") return json(400, { error: "invalid_notification" });
    if (!["payment.succeeded", "payment.canceled"].includes(String(body.event || ""))) {
      return json(200, { ok: true, ignored: true });
    }
    const paymentId = String(body.object?.id || "");
    if (!/^[A-Za-z0-9-]{8,96}$/.test(paymentId)) {
      return json(400, { error: "invalid_payment_id" });
    }

    // The notification body is never trusted for settlement. The current
    // payment object is fetched from the provider with server credentials.
    const payment = await fetchPayment(paymentId);
    if (String(payment.id || "") !== paymentId) {
      return json(400, { error: "payment_identity_mismatch" });
    }
    const result = await settle(payment);
    return json(200, { ok: true, result });
  } catch (error) {
    console.error("SBP webhook failed", error instanceof Error ? error.message : error);
    return json(503, { error: "payment_verification_failed" });
  }
});
