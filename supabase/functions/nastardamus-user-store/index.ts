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

async function ensureUserContext(telegramId: number) {
  await rest("nastardamus_user_context?on_conflict=telegram_id", {
    method: "POST",
    headers: { "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify({ telegram_id: telegramId })
  });
}

async function readUserContext(telegramId: number) {
  await ensureUserContext(telegramId);
  const response = await rest(`nastardamus_user_context?telegram_id=eq.${telegramId}&select=memory_enabled,memories,updated_at&limit=1`);
  return (await response.json())?.[0] || { memory_enabled: true, memories: [] };
}

function cleanConversationMessages(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(-24).flatMap((item) => {
    const role = item?.role === "assistant" ? "assistant" : "user";
    const content = String(item?.content || "").trim().slice(0, 4000);
    return content ? [{ role, content }] : [];
  });
}

function mergeMemory(memories: unknown, value: unknown) {
  const content = String(value || "").trim().slice(0, 300);
  const current = Array.isArray(memories) ? memories : [];
  if (!content) return current.slice(-30);
  const normalized = content.toLocaleLowerCase("ru");
  const filtered = current.filter((item) => String(item?.content || item || "").trim().toLocaleLowerCase("ru") !== normalized);
  return [...filtered, { content, createdAt: new Date().toISOString() }].slice(-30);
}

const PERSONAL_CATEGORIES = new Set(["work", "love", "health", "growth", "finance", "home", "travel", "other"]);
const PERSONAL_STATUSES = new Set(["active", "completed", "archived"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cleanPersonalText(value: unknown, maxLength: number, required = false) {
  const text = String(value || "").trim().replace(/\s+/g, " ").slice(0, maxLength);
  if (required && text.length < 3) throw new Error("invalid_personal_title");
  return text;
}

function personalEventView(row: Record<string, unknown>) {
  return {
    eventId: row.event_id, title: row.title, date: row.event_date, time: String(row.event_time || "").slice(0, 5),
    description: row.description || "", category: row.category, priority: row.priority, status: row.status,
    reminder: row.reminder === true, goalId: row.goal_id || "", analysis: row.analysis || null, enrichments: row.enrichments || {},
    location: row.location || "", links: Array.isArray(row.links) ? row.links : [], desiredResult: row.desired_result || "", reflection: row.reflection || ""
  };
}

function personalGoalView(row: Record<string, unknown>) {
  return { goalId: row.goal_id, title: row.title, description: row.description || "", category: row.category, deadline: row.deadline || "", status: row.status };
}

function personalTaskView(row: Record<string, unknown>) {
  return { taskId: row.task_id, goalId: row.goal_id || "", title: row.title, description: row.description || "", recurrence: row.recurrence, scheduledDate: row.scheduled_date, completedDates: row.completed_dates || [] };
}

function pathItemView(row: Record<string, unknown>) {
  return { id: row.item_id, kind: row.kind, goalId: row.goal_id || "", title: row.title, status: row.status, metadata: row.metadata || {}, createdAt: row.created_at };
}

function pathConsultationView(row: Record<string, unknown>) {
  return { id: row.consultation_id, kind: "path", type: "Мой путь", title: row.title, body: row.result_text || "", input: row.context || {}, answers: row.answers || {}, createdAt: row.created_at, favorite: false };
}

async function assertOwnedId(table: string, idColumn: string, id: string, telegramId: number) {
  const response = await rest(`${table}?${idColumn}=eq.${encodeURIComponent(id)}&select=telegram_id&limit=1`);
  const row = (await response.json())?.[0];
  if (row && Number(row.telegram_id) !== telegramId) throw new Error("personal_item_forbidden");
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

const JOINT_PHOTO_BUCKET = "nastardamus-joint-photos";
const READING_MEDIA_BUCKET = "nastardamus-reading-media";
const PROFILE_PHOTO_BUCKET = "nastardamus-profile-photos";
const ORACLE_PALM_BUCKET = "nastardamus-oracle-palms";
const INVITATION_SELECT = [
  "token",
  "flow",
  "goal",
  "initiator_telegram_id",
  "initiator_name",
  "initiator_gender",
  "invitee_name",
  "invitee_gender",
  "participant_telegram_id",
  "participant_gender",
  "status",
  "payer_telegram_id",
  "payer_role",
  "initiator_image_path",
  "participant_image_path",
  "result_text",
  "result_payload",
  "analysis_requested_at",
  "notification_sent_at",
  "participant_joined_at",
  "completed_at",
  "expires_at",
  "created_at",
  "updated_at"
].join(",");

function cleanInvitationToken(value: unknown) {
  const token = String(value || "").trim().toLowerCase();
  return /^[a-f0-9]{32}$/.test(token) ? token : "";
}

function cleanOracleRoomToken(value: unknown) {
  const token = String(value || "").trim().toLowerCase();
  return /^[a-f0-9]{32}$/.test(token) ? token : "";
}

function cleanOracleUsername(value: unknown) {
  const username = String(value || "").trim().replace(/^@/, "").toLowerCase();
  if (!/^[a-z0-9_]{5,32}$/.test(username)) throw new Error("invalid_oracle_username");
  return username;
}

function cleanOracleText(value: unknown, maxLength: number, minLength = 0) {
  const text = String(value || "").trim().replace(/\s+/g, " ").slice(0, maxLength);
  if (text.length < minLength) throw new Error("invalid_oracle_room_text");
  return text;
}

function cleanOracleHand(value: unknown, kind: "dominant" | "palm") {
  const hand = String(value || "unspecified").toLowerCase();
  const allowed = kind === "dominant"
    ? ["right", "left", "ambidextrous", "unspecified"]
    : ["right", "left", "unspecified"];
  if (!allowed.includes(hand)) throw new Error("invalid_oracle_hand_profile");
  return hand;
}

function cleanOraclePrivateAnswers(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  const keys = ["connection", "tension", "future", "personalQuestion"];
  return Object.fromEntries(keys.map((key) => [key, cleanOracleText(source[key], 500)]));
}

function cleanInvitationName(value: unknown) {
  const name = String(value || "").trim().replace(/\s+/g, " ").slice(0, 80);
  if (name.length < 1) throw new Error("invalid_invitee_name");
  return name;
}

function cleanGender(value: unknown, allowUnspecified = true) {
  const gender = String(value || "unspecified");
  const allowed = allowUnspecified
    ? ["female", "male", "unspecified"]
    : ["female", "male"];
  if (!allowed.includes(gender)) throw new Error("invalid_gender");
  return gender;
}

function parseImageDataUrl(value: unknown) {
  const dataUrl = String(value || "");
  if (dataUrl.length < 30 || dataUrl.length > 1_800_000) {
    throw new Error("invalid_invitation_image");
  }
  const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match) throw new Error("invalid_invitation_image");
  const bytes = base64ToBytes(match[2].replace(/\s+/g, ""));
  if (bytes.length < 16 || bytes.length > 2_000_000) {
    throw new Error("invalid_invitation_image");
  }
  return { bytes, contentType: match[1] };
}

async function storageRequest(path: string, options: RequestInit = {}) {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("supabase_env_missing");
  return fetch(`${url}/storage/v1/${path.replace(/^\/+/, "")}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...(options.headers || {})
    },
    signal: AbortSignal.timeout(15_000)
  });
}

async function uploadJointImage(path: string, dataUrl: unknown) {
  const image = parseImageDataUrl(dataUrl);
  const response = await storageRequest(
    `object/${JOINT_PHOTO_BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}`,
    {
      method: "POST",
      headers: {
        "Content-Type": image.contentType,
        "x-upsert": "true",
        "Cache-Control": "no-store"
      },
      body: image.bytes
    }
  );
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`invitation_image_upload_${response.status}:${detail.slice(0, 120)}`);
  }
}

async function uploadOraclePalm(path: string, dataUrl: unknown) {
  const image = parseImageDataUrl(dataUrl);
  const response = await storageRequest(
    `object/${ORACLE_PALM_BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}`,
    {
      method: "POST",
      headers: {
        "Content-Type": image.contentType,
        "x-upsert": "true",
        "Cache-Control": "no-store"
      },
      body: image.bytes
    }
  );
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`oracle_palm_upload_${response.status}:${detail.slice(0, 120)}`);
  }
}

async function deleteOraclePalms(paths: unknown[]) {
  const objects = paths.filter((path): path is string => typeof path === "string" && path.length > 0);
  if (!objects.length) return;
  await storageRequest(`object/${ORACLE_PALM_BUCKET}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prefixes: objects })
  }).catch(() => null);
}

async function downloadJointImage(path: string) {
  const response = await storageRequest(
    `object/${JOINT_PHOTO_BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}`
  );
  if (!response.ok) throw new Error("invitation_image_unavailable");
  const contentType = response.headers.get("content-type") || "image/webp";
  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return `data:${contentType};base64,${btoa(binary)}`;
}

async function deleteJointImages(paths: unknown[]) {
  const objects = paths.filter((path): path is string => typeof path === "string" && path.length > 0);
  if (!objects.length) return;
  await storageRequest(`object/${JOINT_PHOTO_BUCKET}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prefixes: objects })
  }).catch(() => null);
}

function cleanReadingId(value: unknown) {
  const id = String(value || "").trim().toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id)
    ? id
    : "";
}

function cleanReadingTitle(value: unknown) {
  const title = String(value || "").trim().replace(/\s+/g, " ").slice(0, 160);
  if (!title) throw new Error("invalid_reading_title");
  return title;
}

function cleanJsonObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

async function uploadReadingImage(telegramId: number, readingId: string, index: number, value: unknown) {
  const image = parseImageDataUrl(value);
  const extension = image.contentType === "image/png" ? "png" : image.contentType === "image/jpeg" ? "jpg" : "webp";
  const path = `${telegramId}/${readingId}/${index + 1}.${extension}`;
  const response = await storageRequest(
    `object/${READING_MEDIA_BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}`,
    {
      method: "POST",
      headers: {
        "Content-Type": image.contentType,
        "x-upsert": "true",
        "Cache-Control": "private,max-age=31536000,immutable"
      },
      body: image.bytes
    }
  );
  if (!response.ok) throw new Error(`reading_image_upload_${response.status}`);
  return path;
}

async function signedReadingImage(path: unknown) {
  const cleanPath = String(path || "");
  if (!/^[0-9]+\/[0-9a-f-]{36}\/[1-4]\.(?:jpg|png|webp)$/.test(cleanPath)) return "";
  const response = await storageRequest(
    `object/sign/${READING_MEDIA_BUCKET}/${cleanPath.split("/").map(encodeURIComponent).join("/")}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn: 3600 })
    }
  );
  if (!response.ok) return "";
  const data = await response.json().catch(() => ({}));
  const signed = String(data?.signedURL || data?.signedUrl || "");
  if (!signed) return "";
  if (/^https:\/\//.test(signed)) return signed;
  const base = String(Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
  return `${base}/storage/v1${signed.startsWith("/") ? signed : `/${signed}`}`;
}

async function uploadProfileAvatar(telegramId: number, value: unknown) {
  const image = parseImageDataUrl(value);
  const extension = image.contentType === "image/png" ? "png" : image.contentType === "image/jpeg" ? "jpg" : "webp";
  const path = `${telegramId}/avatar.${extension}`;
  const response = await storageRequest(
    `object/${PROFILE_PHOTO_BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}`,
    {
      method: "POST",
      headers: {
        "Content-Type": image.contentType,
        "x-upsert": "true",
        "Cache-Control": "private,max-age=3600"
      },
      body: image.bytes
    }
  );
  if (!response.ok) throw new Error(`profile_avatar_upload_${response.status}`);
  return path;
}

async function signedProfileAvatar(path: unknown) {
  const cleanPath = String(path || "");
  if (!/^[0-9]+\/avatar\.(?:jpg|png|webp)$/.test(cleanPath)) return "";
  const response = await storageRequest(
    `object/sign/${PROFILE_PHOTO_BUCKET}/${cleanPath.split("/").map(encodeURIComponent).join("/")}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn: 3600 })
    }
  );
  if (!response.ok) return "";
  const data = await response.json().catch(() => ({}));
  const signed = String(data?.signedURL || data?.signedUrl || "");
  if (!signed) return "";
  if (/^https:\/\//.test(signed)) return signed;
  const base = String(Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
  return `${base}/storage/v1${signed.startsWith("/") ? signed : `/${signed}`}`;
}

async function readingView(row: Record<string, unknown>) {
  const mediaPaths = Array.isArray(row.media_paths) ? row.media_paths : [];
  const media = await Promise.all(mediaPaths.slice(0, 4).map(signedReadingImage));
  return {
    id: row.id,
    kind: row.kind,
    subtype: row.subtype,
    title: row.title,
    state: row.state,
    favorite: row.is_favorite === true,
    input: row.input_snapshot || {},
    result: row.result_payload || {},
    body: row.result_text || "",
    media: media.filter(Boolean),
    version: row.version,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function secureShuffle(values: string[]) {
  const result = [...values];
  const random = new Uint32Array(result.length);
  crypto.getRandomValues(random);
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = random[index] % (index + 1);
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

const TAROT_MAJOR_CARD_NAMES = [
  "Шут", "Маг", "Верховная Жрица", "Императрица", "Император", "Иерофант",
  "Влюблённые", "Колесница", "Сила", "Отшельник", "Колесо Фортуны",
  "Справедливость", "Повешенный", "Смерть", "Умеренность", "Дьявол",
  "Башня", "Звезда", "Луна", "Солнце", "Суд", "Мир"
];
const TAROT_MINOR_SUITS = ["Жезлов", "Кубков", "Мечей", "Пентаклей"];
const TAROT_MINOR_RANKS = ["Туз", "Двойка", "Тройка", "Четвёрка", "Пятёрка", "Шестёрка", "Семёрка", "Восьмёрка", "Девятка", "Десятка", "Паж", "Рыцарь", "Королева", "Король"];
const TAROT_CARD_NAMES = [
  ...TAROT_MAJOR_CARD_NAMES,
  ...TAROT_MINOR_SUITS.flatMap((suit) => TAROT_MINOR_RANKS.map((rank) => `${rank} ${suit}`))
];

async function purgeExpiredJointInvitations() {
  const cutoff = encodeURIComponent(new Date().toISOString());
  const response = await rest(
    "nastardamus_joint_invitations"
      + `?expires_at=lt.${cutoff}`
      + "&status=not.in.(completed,cancelled,expired)"
      + "&select=token,initiator_image_path,participant_image_path"
      + "&limit=50"
  );
  const rows = await response.json();
  if (!Array.isArray(rows) || rows.length === 0) return;
  const tokens = rows
    .map((row) => cleanInvitationToken(row?.token))
    .filter(Boolean);
  if (!tokens.length) return;
  await rest(
    `nastardamus_joint_invitations?token=in.(${tokens.join(",")})`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({
        status: "expired",
        updated_at: new Date().toISOString()
      })
    }
  );
  await deleteJointImages(rows.flatMap((row) => [
    row?.initiator_image_path,
    row?.participant_image_path
  ]));
}

function invitationView(row: Record<string, unknown>, telegramId: number) {
  const initiatorId = Number(row.initiator_telegram_id);
  const participantId = Number(row.participant_telegram_id || 0);
  const viewerRole = telegramId === initiatorId
    ? "initiator"
    : telegramId === participantId
      ? "participant"
      : "none";
  return {
    token: row.token,
    flow: row.flow,
    goal: row.goal,
    initiatorName: row.initiator_name,
    initiatorGender: row.initiator_gender,
    inviteeName: row.invitee_name,
    inviteeGender: row.invitee_gender,
    participantGender: row.participant_gender || row.invitee_gender,
    participantJoined: participantId > 0,
    participantPhotoReady: Boolean(row.participant_image_path),
    status: row.status,
    payerRole: row.payer_role || null,
    result: row.result_text || null,
    resultPayload: row.result_payload || {},
    analysisRequested: Boolean(row.analysis_requested_at),
    analysisRequestedAt: row.analysis_requested_at || null,
    viewerRole,
    expiresAt: row.expires_at,
    completedAt: row.completed_at || null
  };
}

async function readInvitation(token: string) {
  const response = await rest(
    `nastardamus_joint_invitations?token=eq.${encodeURIComponent(token)}`
      + `&select=${INVITATION_SELECT}&limit=1`
  );
  const rows = await response.json();
  return rows?.[0] || null;
}

async function invitationChatIds(row: Record<string, unknown>) {
  const ids = [row.initiator_telegram_id, row.participant_telegram_id]
    .map(Number)
    .filter((value) => Number.isSafeInteger(value) && value > 0);
  if (!ids.length) return [];
  const response = await rest(
    `nastardamus_users?telegram_id=in.(${ids.join(",")})&select=telegram_id,chat_id`
  );
  return await response.json();
}

async function readOracleRoom(token: string) {
  const response = await rest(
    `nastardamus_oracle_rooms?token=eq.${encodeURIComponent(token)}`
      + "&select=id,token,mode,reading_section,owner_telegram_id,title,focus,relationship_type,invitee_name,invitee_gender,opening_question,ritual_state,status,max_participants,assistant_state,invite_expires_at,last_message_at,closed_at,created_at,updated_at&limit=1"
  );
  return (await response.json())?.[0] || null;
}

async function readOracleRoomMembers(roomId: string) {
  const response = await rest(
    `nastardamus_oracle_room_members?room_id=eq.${encodeURIComponent(roomId)}`
      + "&select=telegram_id,role,status,display_name,username,gender,palm_image_path,palm_description,dominant_hand,palm_side,private_answers,preparation_status,prepared_at,notifications_enabled,joined_at,created_at,updated_at"
      + "&order=created_at.asc"
  );
  return await response.json();
}

async function readOracleRoomMessages(roomId: string) {
  const response = await rest(
    `nastardamus_oracle_room_messages?room_id=eq.${encodeURIComponent(roomId)}`
      + "&select=id,turn_id,sender_telegram_id,role,sender_name,content,sequence_no,metadata,created_at"
      + "&order=sequence_no.desc&limit=80"
  );
  const rows = await response.json();
  return Array.isArray(rows) ? rows.reverse() : [];
}

function oracleRoomMemberView(
  member: Record<string, unknown>,
  viewerTelegramId: number,
  includePrivate = false
) {
  const isViewer = Number(member.telegram_id) === viewerTelegramId;
  return {
    telegramId: Number(member.telegram_id),
    role: member.role,
    status: member.status,
    displayName: member.display_name,
    username: member.username || null,
    gender: member.gender || "unspecified",
    palmReady: Boolean(member.palm_image_path && member.palm_description),
    palmDescription: member.status === "active" ? member.palm_description || "" : "",
    dominantHand: isViewer || includePrivate ? member.dominant_hand || "unspecified" : "unspecified",
    palmSide: isViewer || includePrivate ? member.palm_side || "unspecified" : "unspecified",
    privateAnswers: isViewer || includePrivate ? member.private_answers || {} : undefined,
    preparationStatus: member.preparation_status || "not_started",
    preparedAt: member.prepared_at || null,
    notificationsEnabled: member.notifications_enabled !== false,
    isViewer,
    joinedAt: member.joined_at || null
  };
}

async function oracleRoomView(
  row: Record<string, unknown>,
  telegramId: number,
  { includePrivateForAgent = false } = {}
) {
  const members = await readOracleRoomMembers(String(row.id));
  const viewer = members.find((member: Record<string, unknown>) => Number(member.telegram_id) === telegramId);
  const viewerStatus = String(viewer?.status || "guest");
  const joined = viewerStatus === "active";
  const visibleMembers = joined
    ? members.filter((member: Record<string, unknown>) => (
        member.status === "active" || (viewer?.role === "owner" && member.status === "invited")
      ))
    : members.filter((member: Record<string, unknown>) => member.role === "owner");
  const [messages, questionUsage] = joined
    ? await Promise.all([
        readOracleRoomMessages(String(row.id)),
        rest("rpc/nastardamus_oracle_room_question_usage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ p_token: row.token, p_telegram_id: telegramId })
        }).then((response) => response.json()).catch(() => null)
      ])
    : [[], null];
  const activeCount = members.filter((member: Record<string, unknown>) => member.status === "active").length;
  const readyCount = members.filter((member: Record<string, unknown>) => (
    member.status === "active" && member.preparation_status === "ready"
  )).length;
  const reservedCount = members.filter((member: Record<string, unknown>) => (
    member.status === "active" || member.status === "invited"
  )).length;
  return {
    token: row.token,
    mode: row.mode,
    readingSection: row.reading_section || "palm",
    title: row.title,
    focus: joined ? row.focus || "" : "",
    relationshipType: row.relationship_type || "other",
    inviteeName: row.invitee_name || "",
    inviteeGender: row.invitee_gender || "unspecified",
    openingQuestion: row.opening_question || "",
    ritualState: row.ritual_state || (row.mode === "solo" ? "opened" : "preparing"),
    status: row.status,
    maxParticipants: Number(row.max_participants),
    participantCount: activeCount,
    readyCount,
    chatUnlocked: row.mode === "solo" || row.ritual_state === "opened" || row.status === "closed",
    reservedCount,
    assistantState: row.assistant_state,
    inviteExpiresAt: row.invite_expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastMessageAt: row.last_message_at,
    joinRequired: !joined,
    viewerStatus,
    viewerRole: viewer?.role || "guest",
    answeredQuestions: Number(questionUsage?.answered_questions || 0),
    viewer: viewer ? oracleRoomMemberView(viewer, telegramId, includePrivateForAgent) : null,
    members: visibleMembers.map((member: Record<string, unknown>) => (
      oracleRoomMemberView(member, telegramId, includePrivateForAgent)
    )),
    messages: messages.map((message: Record<string, unknown>) => ({
      id: message.id,
      turnId: message.turn_id || null,
      senderTelegramId: message.sender_telegram_id ? Number(message.sender_telegram_id) : null,
      role: message.role,
      senderName: message.sender_name,
      content: message.content,
      messageKind: message.metadata?.message_kind || (message.role === "user" ? "question" : null),
      sequenceNo: Number(message.sequence_no),
      createdAt: message.created_at
    }))
  };
}

async function oracleRoomViewByToken(
  token: string,
  telegramId: number,
  options: { includePrivateForAgent?: boolean } = {}
) {
  const room = await readOracleRoom(token);
  if (!room) return null;
  return oracleRoomView(room, telegramId, options);
}

async function oracleRoomChatIds(roomId: string, excludeTelegramId = 0) {
  const membersResponse = await rest(
    `nastardamus_oracle_room_members?room_id=eq.${encodeURIComponent(roomId)}`
      + "&status=eq.active&notifications_enabled=eq.true&select=telegram_id"
  );
  const memberRows = await membersResponse.json();
  const ids = (Array.isArray(memberRows) ? memberRows : [])
    .map((member: Record<string, unknown>) => Number(member.telegram_id))
    .filter((value: number) => Number.isSafeInteger(value) && value > 0 && value !== excludeTelegramId);
  if (!ids.length) return [];
  const usersResponse = await rest(
    `nastardamus_users?telegram_id=in.(${ids.join(",")})&select=telegram_id,chat_id`
  );
  return await usersResponse.json();
}

async function listOracleRooms(telegramId: number) {
  const membershipsResponse = await rest(
    `nastardamus_oracle_room_members?telegram_id=eq.${telegramId}`
      + "&status=in.(active,invited)&select=room_id,status,role&order=updated_at.desc&limit=50"
  );
  const memberships = await membershipsResponse.json();
  const ids = (Array.isArray(memberships) ? memberships : []).map((item) => item.room_id).filter(Boolean);
  if (!ids.length) return [];
  const roomsResponse = await rest(
    `nastardamus_oracle_rooms?id=in.(${ids.join(",")})`
      + "&select=id,token,mode,reading_section,owner_telegram_id,title,status,max_participants,assistant_state,last_message_at,created_at,updated_at"
      + "&order=last_message_at.desc&limit=50"
  );
  const rooms = await roomsResponse.json();
  const membershipMap = new Map(memberships.map((item) => [item.room_id, item]));
  return (Array.isArray(rooms) ? rooms : []).map((room) => ({
    token: room.token,
    mode: room.mode,
    readingSection: room.reading_section || "palm",
    title: room.title,
    status: room.status,
    maxParticipants: Number(room.max_participants),
    assistantState: room.assistant_state,
    viewerStatus: membershipMap.get(room.id)?.status || "guest",
    viewerRole: membershipMap.get(room.id)?.role || "member",
    lastMessageAt: room.last_message_at,
    createdAt: room.created_at,
    updatedAt: room.updated_at
  }));
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
    if (action === "create_oracle_room") {
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) {
        return json(400, { error: "invalid_telegram_id" });
      }
      const mode = String(body?.mode || "").toLowerCase();
      if (!["solo", "pair", "group"].includes(mode)) {
        return json(400, { error: "invalid_oracle_room_mode" });
      }
      const title = cleanOracleText(body?.title, 100, 3);
      const focus = cleanOracleText(body?.focus, 500);
      const displayName = cleanOracleText(body?.displayName || "Искатель", 80, 1);
      const rawUsername = String(body?.username || "").trim();
      const username = rawUsername ? cleanOracleUsername(rawUsername) : null;
      const gender = cleanGender(body?.gender);
      const readingSection = ["general", "path", "event", "amur", "tarot", "runes", "palm"].includes(String(body?.readingSection))
        ? String(body.readingSection)
        : "palm";
      const response = await rest("rpc/nastardamus_create_oracle_room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          p_owner_telegram_id: telegramId,
          p_owner_name: displayName,
          p_owner_username: username,
          p_owner_gender: gender,
          p_mode: mode,
          p_title: title,
          p_focus: focus,
          p_max_participants: Number(body?.maxParticipants || 6),
          p_invitee_name: mode === "pair" ? cleanInvitationName(body?.inviteeName) : "",
          p_invitee_gender: mode === "pair" ? cleanGender(body?.inviteeGender) : "unspecified",
          p_relationship_type: mode === "pair"
            ? cleanOracleText(body?.relationshipType || "other", 20, 2)
            : "other",
          p_opening_question: mode === "pair" ? cleanOracleText(body?.openingQuestion, 400, 8) : "",
          p_relationship_consent: body?.relationshipConsent === true,
          p_adult_confirmed: body?.adultConfirmed === true
        })
      });
      const created = await response.json();
      await rest(`nastardamus_oracle_rooms?id=eq.${created.room_id}&owner_telegram_id=eq.${telegramId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ reading_section: mode === "group" ? readingSection : "palm" })
      });
      const room = await oracleRoomViewByToken(String(created.token), telegramId);
      return json(200, { ok: true, room });
    }

    if (action === "list_oracle_rooms") {
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) {
        return json(400, { error: "invalid_telegram_id" });
      }
      return json(200, { ok: true, rooms: await listOracleRooms(telegramId) });
    }

    if (action === "get_oracle_room") {
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) {
        return json(400, { error: "invalid_telegram_id" });
      }
      const roomToken = cleanOracleRoomToken(body?.roomToken);
      if (!roomToken) return json(400, { error: "invalid_oracle_room_token" });
      const room = await oracleRoomViewByToken(roomToken, telegramId);
      if (!room) return json(404, { error: "oracle_room_not_found" });
      return json(200, { ok: true, room });
    }

    if (action === "join_oracle_room") {
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) {
        return json(400, { error: "invalid_telegram_id" });
      }
      const roomToken = cleanOracleRoomToken(body?.roomToken);
      if (!roomToken) return json(400, { error: "invalid_oracle_room_token" });
      const displayName = cleanOracleText(body?.displayName || "Искатель", 80, 1);
      const rawUsername = String(body?.username || "").trim();
      const username = rawUsername ? cleanOracleUsername(rawUsername) : null;
      const response = await rest("rpc/nastardamus_join_oracle_room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          p_token: roomToken,
          p_telegram_id: telegramId,
          p_display_name: displayName,
          p_username: username,
          p_gender: cleanGender(body?.gender),
          p_relationship_consent: body?.relationshipConsent === true,
          p_adult_confirmed: body?.adultConfirmed === true
        })
      });
      await response.json();
      const roomRow = await readOracleRoom(roomToken);
      const room = roomRow ? await oracleRoomView(roomRow, telegramId) : null;
      return json(200, {
        ok: true,
        room,
        chats: roomRow ? await oracleRoomChatIds(String(roomRow.id), telegramId) : []
      });
    }

    if (action === "invite_oracle_room_username") {
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) {
        return json(400, { error: "invalid_telegram_id" });
      }
      const roomToken = cleanOracleRoomToken(body?.roomToken);
      if (!roomToken) return json(400, { error: "invalid_oracle_room_token" });
      const username = cleanOracleUsername(body?.username);
      const userResponse = await rest("rpc/nastardamus_find_user_by_username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ p_username: username })
      });
      const target = await userResponse.json();
      const targetId = Number(target?.telegram_id);
      const displayName = cleanOracleText(target?.first_name || `@${username}`, 80, 1);
      const inviteResponse = await rest("rpc/nastardamus_invite_oracle_room_member", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          p_token: roomToken,
          p_owner_telegram_id: telegramId,
          p_target_telegram_id: targetId,
          p_target_name: displayName,
          p_target_username: username
        })
      });
      const invited = await inviteResponse.json();
      const room = await oracleRoomViewByToken(roomToken, telegramId);
      return json(200, {
        ok: true,
        room,
        invited: invited?.invited === true,
        inviteeName: displayName,
        targetChatId: Number(target?.chat_id) || null
      });
    }

    if (action === "upload_oracle_room_palm") {
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) {
        return json(400, { error: "invalid_telegram_id" });
      }
      if (body?.palmConsent !== true) return json(400, { error: "photo_consent_required" });
      const roomToken = cleanOracleRoomToken(body?.roomToken);
      if (!roomToken) return json(400, { error: "invalid_oracle_room_token" });
      const description = cleanOracleText(body?.description, 1000, 10);
      const dominantHand = cleanOracleHand(body?.dominantHand, "dominant");
      const palmSide = cleanOracleHand(body?.palmSide, "palm");
      const privateAnswers = cleanOraclePrivateAnswers(body?.privateAnswers);
      const roomRow = await readOracleRoom(roomToken);
      if (!roomRow) return json(404, { error: "oracle_room_not_found" });
      if (roomRow.status !== "active") return json(409, { error: "oracle_room_closed" });
      const members = await readOracleRoomMembers(String(roomRow.id));
      const member = members.find((item: Record<string, unknown>) => (
        Number(item.telegram_id) === telegramId && item.status === "active"
      ));
      if (!member) return json(403, { error: "oracle_room_access_denied" });
      const previousImagePath = typeof member.palm_image_path === "string" ? member.palm_image_path : "";
      const imagePath = `${roomRow.id}/${telegramId}/${crypto.randomUUID()}`;
      await uploadOraclePalm(imagePath, body?.image);
      try {
        const preparationResponse = await rest("rpc/nastardamus_complete_oracle_room_preparation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            p_token: roomToken,
            p_telegram_id: telegramId,
            p_palm_image_path: imagePath,
            p_palm_description: description,
            p_dominant_hand: dominantHand,
            p_palm_side: palmSide,
            p_private_answers: privateAnswers
          })
        });
        const preparation = await preparationResponse.json();
        if (previousImagePath && previousImagePath !== imagePath) {
          await deleteOraclePalms([previousImagePath]);
        }
        return json(200, {
          ok: true,
          room: await oracleRoomViewByToken(roomToken, telegramId),
          newlyOpened: preparation?.newly_opened === true,
          chats: preparation?.newly_opened === true
            ? await oracleRoomChatIds(String(roomRow.id), telegramId)
            : []
        });
      } catch (error) {
        await deleteOraclePalms([imagePath]);
        throw error;
      }
    }

    if (action === "complete_oracle_room_text_preparation") {
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) {
        return json(400, { error: "invalid_telegram_id" });
      }
      const roomToken = cleanOracleRoomToken(body?.roomToken);
      if (!roomToken) return json(400, { error: "invalid_oracle_room_token" });
      const privateAnswers = cleanOraclePrivateAnswers(body?.privateAnswers);
      const roomRow = await readOracleRoom(roomToken);
      if (!roomRow) return json(404, { error: "oracle_room_not_found" });
      const preparationResponse = await rest("rpc/nastardamus_complete_oracle_room_text_preparation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          p_token: roomToken,
          p_telegram_id: telegramId,
          p_private_answers: privateAnswers
        })
      });
      const preparation = await preparationResponse.json();
      return json(200, {
        ok: true,
        room: await oracleRoomViewByToken(roomToken, telegramId),
        newlyOpened: preparation?.newly_opened === true,
        chats: preparation?.newly_opened === true
          ? await oracleRoomChatIds(String(roomRow.id), telegramId)
          : []
      });
    }

    if (action === "get_oracle_room_question_usage") {
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) {
        return json(400, { error: "invalid_telegram_id" });
      }
      const roomToken = cleanOracleRoomToken(body?.roomToken);
      if (!roomToken) return json(400, { error: "invalid_oracle_room_token" });
      const response = await rest("rpc/nastardamus_oracle_room_question_usage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ p_token: roomToken, p_telegram_id: telegramId })
      });
      return json(200, { ok: true, usage: await response.json() });
    }

    if (action === "set_oracle_room_turn_kind") {
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) {
        return json(400, { error: "invalid_telegram_id" });
      }
      const roomToken = cleanOracleRoomToken(body?.roomToken);
      const turnId = cleanReadingId(body?.turnId);
      const messageKind = String(body?.messageKind || "question");
      if (!roomToken || !turnId || !["question", "answer", "guided"].includes(messageKind)) {
        return json(400, { error: "invalid_oracle_room_turn" });
      }
      const room = await readOracleRoom(roomToken);
      if (!room) return json(404, { error: "oracle_room_not_found" });
      const members = await readOracleRoomMembers(String(room.id));
      if (!members.some((member: Record<string, unknown>) => Number(member.telegram_id) === telegramId && member.status === "active")) {
        return json(403, { error: "oracle_room_access_denied" });
      }
      const response = await rest(
        `nastardamus_oracle_room_messages?room_id=eq.${room.id}&turn_id=eq.${turnId}&sender_telegram_id=eq.${telegramId}&role=eq.user`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Prefer: "return=representation" },
          body: JSON.stringify({ metadata: { message_kind: messageKind } })
        }
      );
      const updated = await response.json();
      if (!updated?.[0]) return json(404, { error: "oracle_room_turn_not_found" });
      return json(200, { ok: true });
    }

    if (action === "begin_oracle_room_turn") {
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) {
        return json(400, { error: "invalid_telegram_id" });
      }
      const roomToken = cleanOracleRoomToken(body?.roomToken);
      if (!roomToken) return json(400, { error: "invalid_oracle_room_token" });
      const content = cleanOracleText(body?.message, 2000, 2);
      const nonce = String(body?.clientNonce || "");
      const response = await rest("rpc/nastardamus_begin_oracle_room_turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          p_token: roomToken,
          p_telegram_id: telegramId,
          p_content: content,
          p_client_nonce: nonce
        })
      });
      const turn = await response.json();
      return json(200, {
        ok: true,
        turn,
        room: await oracleRoomViewByToken(roomToken, telegramId, { includePrivateForAgent: true })
      });
    }

    if (action === "complete_oracle_room_turn") {
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) {
        return json(400, { error: "invalid_telegram_id" });
      }
      const roomToken = cleanOracleRoomToken(body?.roomToken);
      const turnId = cleanReadingId(body?.turnId);
      if (!roomToken || !turnId) return json(400, { error: "invalid_oracle_room_turn" });
      const answer = cleanOracleText(body?.answer, 4000, 2);
      const response = await rest("rpc/nastardamus_complete_oracle_room_turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ p_token: roomToken, p_turn_id: turnId, p_answer: answer })
      });
      const completed = await response.json();
      const roomRow = await readOracleRoom(roomToken);
      return json(200, {
        ok: true,
        turn: completed,
        room: await oracleRoomViewByToken(roomToken, telegramId),
        chats: roomRow ? await oracleRoomChatIds(String(roomRow.id), telegramId) : []
      });
    }

    if (action === "fail_oracle_room_turn") {
      const roomToken = cleanOracleRoomToken(body?.roomToken);
      const turnId = cleanReadingId(body?.turnId);
      if (!roomToken || !turnId) return json(400, { error: "invalid_oracle_room_turn" });
      const response = await rest("rpc/nastardamus_fail_oracle_room_turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ p_token: roomToken, p_turn_id: turnId })
      });
      return json(200, { ok: true, turn: await response.json() });
    }

    if (action === "leave_oracle_room") {
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) {
        return json(400, { error: "invalid_telegram_id" });
      }
      const roomToken = cleanOracleRoomToken(body?.roomToken);
      if (!roomToken) return json(400, { error: "invalid_oracle_room_token" });
      const roomRow = await readOracleRoom(roomToken);
      if (!roomRow) return json(404, { error: "oracle_room_not_found" });
      const members = await readOracleRoomMembers(String(roomRow.id));
      const member = members.find((item: Record<string, unknown>) => Number(item.telegram_id) === telegramId);
      const response = await rest("rpc/nastardamus_leave_oracle_room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ p_token: roomToken, p_telegram_id: telegramId })
      });
      await response.json();
      await deleteOraclePalms([member?.palm_image_path]);
      return json(200, { ok: true });
    }

    if (action === "close_oracle_room") {
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) {
        return json(400, { error: "invalid_telegram_id" });
      }
      const roomToken = cleanOracleRoomToken(body?.roomToken);
      if (!roomToken) return json(400, { error: "invalid_oracle_room_token" });
      const roomRow = await readOracleRoom(roomToken);
      if (!roomRow) return json(404, { error: "oracle_room_not_found" });
      const members = await readOracleRoomMembers(String(roomRow.id));
      const response = await rest("rpc/nastardamus_close_oracle_room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ p_token: roomToken, p_owner_telegram_id: telegramId })
      });
      await response.json();
      await deleteOraclePalms(members.map((item: Record<string, unknown>) => item.palm_image_path));
      return json(200, { ok: true, room: await oracleRoomViewByToken(roomToken, telegramId) });
    }

    if (action === "create_joint_invitation") {
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) {
        return json(400, { error: "invalid_telegram_id" });
      }
      if (body?.consentOwn !== true) return json(400, { error: "photo_consent_required" });
      if (body?.adultConfirmed !== true) return json(400, { error: "adult_confirmation_required" });
      const flow = String(body?.flow || "");
      const goal = String(body?.goal || "");
      if (!["palm", "photo"].includes(flow)) {
        return json(400, { error: "invalid_invitation_flow" });
      }
      if (!["love", "friendship", "business", "creative"].includes(goal)) {
        return json(400, { error: "invalid_invitation_goal" });
      }
      const inviteeName = cleanInvitationName(body?.inviteeName);
      const inviteeGender = cleanGender(body?.inviteeGender, false);
      const initiatorName = cleanInvitationName(body?.initiatorName || "Искатель");
      const initiatorGender = cleanGender(body?.initiatorGender);
      const token = crypto.randomUUID().replaceAll("-", "");
      const imagePath = `${token}/initiator`;

      await purgeExpiredJointInvitations().catch((error) => {
        console.error(
          "Expired invitation cleanup failed",
          error instanceof Error ? error.message : error
        );
      });
      await uploadJointImage(imagePath, body?.initiatorImage);
      try {
        const response = await rest("nastardamus_joint_invitations", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Prefer: "return=representation"
          },
          body: JSON.stringify({
            token,
            flow,
            goal,
            initiator_telegram_id: telegramId,
            initiator_name: initiatorName,
            initiator_gender: initiatorGender,
            invitee_name: inviteeName,
            invitee_gender: inviteeGender,
            initiator_image_path: imagePath,
            initiator_profile: cleanJsonObject(body?.initiatorProfile)
          })
        });
        const rows = await response.json();
        return json(200, {
          ok: true,
          invitation: invitationView(rows[0], telegramId)
        });
      } catch (error) {
        await deleteJointImages([imagePath]);
        throw error;
      }
    }

    if (action === "accept_joint_invitation" || action === "get_joint_invitation") {
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) {
        return json(400, { error: "invalid_telegram_id" });
      }
      const invitationToken = cleanInvitationToken(body?.invitationToken);
      if (!invitationToken) return json(400, { error: "invalid_invitation_token" });
      let invitation = await readInvitation(invitationToken);
      if (!invitation) return json(404, { error: "invitation_not_found" });

      if (
        invitation.status !== "completed"
        && new Date(String(invitation.expires_at)).getTime() <= Date.now()
      ) {
        await rest(
          `nastardamus_joint_invitations?token=eq.${encodeURIComponent(invitationToken)}`
            + "&status=not.in.(completed,cancelled,expired)",
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
            body: JSON.stringify({ status: "expired", updated_at: new Date().toISOString() })
          }
        );
        await deleteJointImages([
          invitation.initiator_image_path,
          invitation.participant_image_path
        ]);
        return json(410, { error: "invitation_expired" });
      }

      const initiatorId = Number(invitation.initiator_telegram_id);
      const participantId = Number(invitation.participant_telegram_id || 0);
      if (
        action === "accept_joint_invitation"
        && telegramId !== initiatorId
        && participantId === 0
        && invitation.status === "awaiting_participant"
      ) {
        const response = await rest(
          `nastardamus_joint_invitations?token=eq.${encodeURIComponent(invitationToken)}`
            + "&participant_telegram_id=is.null&status=eq.awaiting_participant",
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Prefer: "return=representation"
            },
            body: JSON.stringify({
              participant_telegram_id: telegramId,
              participant_gender: invitation.invitee_gender,
              participant_joined_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
          }
        );
        const rows = await response.json();
        invitation = rows?.[0] || await readInvitation(invitationToken);
      }

      const view = invitationView(invitation, telegramId);
      if (view.viewerRole === "none") {
        return json(404, { error: "invitation_not_found" });
      }
      return json(200, { ok: true, invitation: view });
    }

    if (action === "upload_joint_participant_image") {
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) {
        return json(400, { error: "invalid_telegram_id" });
      }
      const invitationToken = cleanInvitationToken(body?.invitationToken);
      if (!invitationToken) return json(400, { error: "invalid_invitation_token" });
      if (body?.consentOwn !== true) return json(400, { error: "photo_consent_required" });
      if (body?.adultConfirmed !== true) return json(400, { error: "adult_confirmation_required" });
      const participantGender = cleanGender(body?.participantGender);
      const invitation = await readInvitation(invitationToken);
      if (!invitation || Number(invitation.participant_telegram_id) !== telegramId) {
        return json(404, { error: "invitation_not_found" });
      }
      if (["completed", "cancelled", "expired"].includes(String(invitation.status))) {
        return json(409, { error: "invitation_unavailable" });
      }
      const imagePath = `${invitationToken}/participant`;
      await uploadJointImage(imagePath, body?.participantImage);
      const response = await rest(
        `nastardamus_joint_invitations?token=eq.${encodeURIComponent(invitationToken)}`
          + `&participant_telegram_id=eq.${telegramId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Prefer: "return=representation"
          },
          body: JSON.stringify({
            participant_image_path: imagePath,
            participant_gender: participantGender,
            participant_profile: cleanJsonObject(body?.participantProfile),
            status: "ready",
            payer_telegram_id: null,
            payer_role: null,
            last_error: null,
            updated_at: new Date().toISOString()
          })
        }
      );
      const rows = await response.json();
      const updated = rows[0];
      return json(200, {
        ok: true,
        invitation: invitationView(updated, telegramId),
        autoProcess: Boolean(updated.analysis_requested_at),
        initiatorTelegramId: Number(updated.initiator_telegram_id),
        chats: await invitationChatIds(updated)
      });
    }

    if (action === "request_joint_analysis") {
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) {
        return json(400, { error: "invalid_telegram_id" });
      }
      const invitationToken = cleanInvitationToken(body?.invitationToken);
      if (!invitationToken) return json(400, { error: "invalid_invitation_token" });
      const invitation = await readInvitation(invitationToken);
      if (!invitation || Number(invitation.initiator_telegram_id) !== telegramId) {
        return json(404, { error: "invitation_not_found" });
      }
      if (["completed", "cancelled", "expired"].includes(String(invitation.status))) {
        return json(409, { error: "invitation_unavailable" });
      }
      const response = await rest(
        `nastardamus_joint_invitations?token=eq.${encodeURIComponent(invitationToken)}`
          + `&initiator_telegram_id=eq.${telegramId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Prefer: "return=representation" },
          body: JSON.stringify({
            analysis_requested_at: new Date().toISOString(),
            payer_telegram_id: telegramId,
            payer_role: "initiator",
            updated_at: new Date().toISOString()
          })
        }
      );
      const rows = await response.json();
      const updated = rows[0];
      return json(200, {
        ok: true,
        invitation: invitationView(updated, telegramId),
        chats: await invitationChatIds(updated)
      });
    }

    if (action === "request_joint_initiator_payment") {
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) {
        return json(400, { error: "invalid_telegram_id" });
      }
      const invitationToken = cleanInvitationToken(body?.invitationToken);
      if (!invitationToken) return json(400, { error: "invalid_invitation_token" });
      const invitation = await readInvitation(invitationToken);
      if (
        !invitation
        || Number(invitation.participant_telegram_id) !== telegramId
        || !invitation.participant_image_path
      ) {
        return json(404, { error: "invitation_not_found" });
      }
      if (!["ready", "awaiting_initiator_payment"].includes(String(invitation.status))) {
        return json(409, { error: "invitation_not_ready" });
      }
      const response = await rest(
        `nastardamus_joint_invitations?token=eq.${encodeURIComponent(invitationToken)}`
          + `&participant_telegram_id=eq.${telegramId}`
          + "&status=in.(ready,awaiting_initiator_payment)",
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Prefer: "return=representation"
          },
          body: JSON.stringify({
            status: "awaiting_initiator_payment",
            payer_telegram_id: invitation.initiator_telegram_id,
            payer_role: "initiator",
            updated_at: new Date().toISOString()
          })
        }
      );
      const rows = await response.json();
      const updated = rows[0];
      return json(200, {
        ok: true,
        invitation: invitationView(updated, telegramId),
        chats: await invitationChatIds(updated)
      });
    }

    if (action === "claim_joint_invitation_processing") {
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) {
        return json(400, { error: "invalid_telegram_id" });
      }
      const invitationToken = cleanInvitationToken(body?.invitationToken);
      if (!invitationToken) return json(400, { error: "invalid_invitation_token" });
      const payerRole = String(body?.payerRole || "");
      const response = await rest("rpc/nastardamus_claim_joint_invitation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          p_token: invitationToken,
          p_telegram_id: telegramId,
          p_payer_role: payerRole
        })
      });
      const invitation = await response.json();
      const [firstImage, secondImage] = await Promise.all([
        downloadJointImage(String(invitation.initiator_image_path)),
        downloadJointImage(String(invitation.participant_image_path))
      ]);
      return json(200, {
        ok: true,
        invitation: {
          token: invitation.token,
          flow: invitation.flow,
          goal: invitation.goal,
          firstName: invitation.initiator_name,
          secondName: invitation.invitee_name,
          firstGender: invitation.initiator_gender,
          secondGender: invitation.participant_gender,
          firstProfile: cleanJsonObject(invitation.initiator_profile),
          secondProfile: cleanJsonObject(invitation.participant_profile),
          firstImage,
          secondImage,
          payerRole: invitation.payer_role
        }
      });
    }

    if (action === "release_joint_invitation_processing") {
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) {
        return json(400, { error: "invalid_telegram_id" });
      }
      const invitationToken = cleanInvitationToken(body?.invitationToken);
      if (!invitationToken) return json(400, { error: "invalid_invitation_token" });
      const response = await rest("rpc/nastardamus_release_joint_invitation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          p_token: invitationToken,
          p_telegram_id: telegramId,
          p_reason: String(body?.reason || "reading_failed").slice(0, 160)
        })
      });
      return json(200, { ok: true, invitation: await response.json() });
    }

    if (action === "complete_joint_invitation") {
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) {
        return json(400, { error: "invalid_telegram_id" });
      }
      const invitationToken = cleanInvitationToken(body?.invitationToken);
      if (!invitationToken) return json(400, { error: "invalid_invitation_token" });
      const chargeId = String(body?.chargeId || "");
      const charged = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(chargeId);
      const accessSource = String(body?.accessSource || "");
      const freeUsageKey = String(body?.freeUsageKey || "");
      if (!charged && !["global_free", "vip", "free_check"].includes(accessSource)) {
        return json(400, { error: "invalid_reading_access" });
      }
      if (accessSource === "free_check" && !/^[a-z0-9:_-]{1,100}$/.test(freeUsageKey)) {
        return json(400, { error: "invalid_free_usage_key" });
      }
      const response = await rest(charged
        ? "rpc/nastardamus_complete_joint_invitation"
        : "rpc/nastardamus_complete_joint_invitation_access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(charged
          ? {
              p_token: invitationToken,
              p_telegram_id: telegramId,
              p_result_text: String(body?.result || ""),
              p_service_charge_id: chargeId
            }
          : {
              p_token: invitationToken,
              p_telegram_id: telegramId,
              p_result_text: String(body?.result || ""),
              p_access_source: accessSource,
              p_free_usage_key: accessSource === "free_check" ? freeUsageKey : null
            })
      });
      const completed = await response.json();
      await rest(
        `nastardamus_joint_invitations?token=eq.${encodeURIComponent(invitationToken)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({
            result_payload: cleanJsonObject(body?.resultPayload),
            notification_sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
        }
      );
      await deleteJointImages([
        completed.initiator_image_path,
        completed.participant_image_path
      ]);
      const invitation = await readInvitation(invitationToken);
      return json(200, {
        ok: true,
        invitation: invitationView(invitation, telegramId),
        chats: await invitationChatIds(invitation)
      });
    }

    if (action === "create_dialogue_session") {
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) {
        return json(400, { error: "invalid_telegram_id" });
      }
      const kind = String(body?.kind || "");
      if (!["palm"].includes(kind)) return json(400, { error: "invalid_dialogue_kind" });
      const title = cleanReadingTitle(body?.title || "Чтение по ладони");
      const response = await rest("nastardamus_reading_sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify({
          telegram_id: telegramId,
          kind,
          subtype: String(body?.subtype || kind).slice(0, 80),
          title,
          state: "dialogue",
          input_snapshot: cleanJsonObject(body?.input),
          updated_at: new Date().toISOString()
        })
      });
      const row = (await response.json())?.[0];
      return json(200, { ok: true, sessionId: row?.id });
    }

    if (action === "append_dialogue_message") {
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) {
        return json(400, { error: "invalid_telegram_id" });
      }
      const readingId = cleanReadingId(body?.readingId);
      if (!readingId) return json(400, { error: "invalid_reading_id" });
      const role = String(body?.role || "");
      if (!["assistant", "user"].includes(role)) return json(400, { error: "invalid_dialogue_role" });
      const content = String(body?.content || "").trim().slice(0, 2000);
      if (!content) return json(400, { error: "invalid_dialogue_content" });
      const sessionResponse = await rest(
        `nastardamus_reading_sessions?id=eq.${readingId}&telegram_id=eq.${telegramId}`
          + "&state=eq.dialogue&select=id&limit=1"
      );
      if (!(await sessionResponse.json())?.[0]) return json(404, { error: "dialogue_not_found" });
      const messagesResponse = await rest(
        `nastardamus_reading_messages?session_id=eq.${readingId}&select=sequence_no`
          + "&order=sequence_no.desc&limit=1"
      );
      const last = (await messagesResponse.json())?.[0];
      await rest("nastardamus_reading_messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({
          session_id: readingId,
          telegram_id: telegramId,
          role,
          content,
          sequence_no: Number(last?.sequence_no ?? -1) + 1
        })
      });
      return json(200, { ok: true });
    }

    if (action === "get_active_dialogue") {
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) {
        return json(400, { error: "invalid_telegram_id" });
      }
      const kind = String(body?.kind || "palm");
      const response = await rest(
        `nastardamus_reading_sessions?telegram_id=eq.${telegramId}&kind=eq.${encodeURIComponent(kind)}`
          + "&state=eq.dialogue&select=id,kind,subtype,title,input_snapshot,created_at,updated_at"
          + "&order=updated_at.desc&limit=1"
      );
      const session = (await response.json())?.[0] || null;
      if (!session) return json(200, { ok: true, session: null, messages: [] });
      const messagesResponse = await rest(
        `nastardamus_reading_messages?session_id=eq.${session.id}`
          + "&select=role,content,sequence_no,created_at&order=sequence_no.asc&limit=30"
      );
      return json(200, {
        ok: true,
        session,
        messages: await messagesResponse.json()
      });
    }

    if (action === "get_reading_catalog") {
      const [tarotResponse, compatibilityResponse, vipResponse, settings] = await Promise.all([
        rest("nastardamus_tarot_spreads?is_active=eq.true&select=id,title,description,category,card_count,positions,service_id,price_units,free_checks,vip_access,duration_label,depth_label,badge,artwork_key,display_order,version&order=display_order.asc"),
        rest("nastardamus_compatibility_types?is_active=eq.true&select=id,title,description,service_id,price_units,free_checks,vip_access,artwork_key,display_order,version&order=display_order.asc"),
        Number.isSafeInteger(telegramId) && telegramId > 0
          ? rest(`nastardamus_vip_subscriptions?telegram_id=eq.${telegramId}&status=eq.active&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=id,plan_id,starts_at,expires_at&order=expires_at.desc&limit=1`)
          : Promise.resolve(null),
        readSettings()
      ]);
      const vipRows = vipResponse ? await vipResponse.json() : [];
      const tarotRows = await tarotResponse.json();
      const compatibilityRows = await compatibilityResponse.json();
      const tarotOverrides = new Map(
        (Array.isArray(settings.tarotCatalog) ? settings.tarotCatalog : [])
          .map((item: Record<string, unknown>) => [item.id, item])
      );
      const compatibilityOverrides = new Map(
        (Array.isArray(settings.compatibilityCatalog) ? settings.compatibilityCatalog : [])
          .map((item: Record<string, unknown>) => [item.id, item])
      );
      const tarot = (tarotRows || []).flatMap((item: Record<string, unknown>) => {
        const override = tarotOverrides.get(item.id) as Record<string, unknown> | undefined;
        if (override?.enabled === false) return [];
        return [{
          ...item,
          ...(override ? {
            title: override.title || item.title,
            description: override.description || item.description,
            card_count: override.cardCount || item.card_count,
            positions: Array.isArray(override.positions) && override.positions.length
              ? override.positions
              : item.positions,
            price_units: override.price === null || override.price === undefined
              ? item.price_units
              : Math.round(Number(override.price) * 100),
            free_checks: override.freeChecks ?? item.free_checks,
            vip_access: override.vipAccess || item.vip_access,
            display_order: override.displayOrder ?? item.display_order
          } : {})
        }];
      }).sort((left: Record<string, unknown>, right: Record<string, unknown>) =>
        Number(left.display_order) - Number(right.display_order)
      );
      const compatibility = (compatibilityRows || []).flatMap((item: Record<string, unknown>) => {
        const override = compatibilityOverrides.get(item.id) as Record<string, unknown> | undefined;
        if (override?.enabled === false) return [];
        return [{
          ...item,
          ...(override ? {
            title: override.title || item.title,
            description: override.description || item.description,
            price_units: override.price === null || override.price === undefined
              ? item.price_units
              : Math.round(Number(override.price) * 100),
            free_checks: override.freeChecks ?? item.free_checks,
            vip_access: override.vipAccess || item.vip_access,
            display_order: override.displayOrder ?? item.display_order
          } : {})
        }];
      }).sort((left: Record<string, unknown>, right: Record<string, unknown>) =>
        Number(left.display_order) - Number(right.display_order)
      );
      return json(200, {
        ok: true,
        tarot,
        compatibility,
        vip: vipRows?.[0] || null
      });
    }

    if (action === "create_tarot_session") {
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) {
        return json(400, { error: "invalid_telegram_id" });
      }
      const spreadId = String(body?.spreadId || "").trim().toLowerCase();
      const [spreadResponse, settings] = await Promise.all([rest(
        `nastardamus_tarot_spreads?id=eq.${encodeURIComponent(spreadId)}&is_active=eq.true`
          + "&select=id,title,card_count,positions,service_id,version&limit=1"
      ), readSettings()]);
      const storedSpread = (await spreadResponse.json())?.[0];
      const override = Array.isArray(settings.tarotCatalog)
        ? settings.tarotCatalog.find((item: Record<string, unknown>) => item?.id === spreadId)
        : null;
      if (override?.enabled === false) return json(404, { error: "tarot_spread_not_found" });
      const spread = storedSpread ? {
        ...storedSpread,
        ...(override ? {
          title: override.title || storedSpread.title,
          card_count: override.cardCount || storedSpread.card_count,
          positions: Array.isArray(override.positions) && override.positions.length ? override.positions : storedSpread.positions,
          service_id: override.serviceId || storedSpread.service_id
        } : {})
      } : null;
      if (!spread) return json(404, { error: "tarot_spread_not_found" });
      const question = String(body?.question || "").trim().slice(0, 500);
      if (!question) return json(400, { error: "invalid_tarot_question" });
      const response = await rest("nastardamus_reading_sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify({
          telegram_id: telegramId,
          kind: "tarot",
          subtype: spread.id,
          title: question.slice(0, 160),
          state: "selecting",
          version: spread.version,
          input_snapshot: {
            question,
            spreadId: spread.id,
            spreadTitle: spread.title,
            count: spread.card_count,
            positions: spread.positions,
            serviceId: spread.service_id,
            deck: secureShuffle(TAROT_CARD_NAMES),
            selectedCards: []
          }
        })
      });
      const row = (await response.json())?.[0];
      return json(200, {
        ok: true,
        sessionId: row.id,
        spread: {
          id: spread.id,
          title: spread.title,
          count: spread.card_count,
          positions: spread.positions,
          serviceId: spread.service_id
        }
      });
    }

    if (action === "draw_tarot_card") {
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) {
        return json(400, { error: "invalid_telegram_id" });
      }
      const readingId = cleanReadingId(body?.readingId);
      if (!readingId) return json(400, { error: "invalid_reading_id" });
      const response = await rest(
        `nastardamus_reading_sessions?id=eq.${readingId}&telegram_id=eq.${telegramId}&state=eq.selecting&select=id,input_snapshot&limit=1`
      );
      const row = (await response.json())?.[0];
      if (!row) return json(404, { error: "tarot_session_not_found" });
      const snapshot = cleanJsonObject(row.input_snapshot);
      const deck = Array.isArray(snapshot.deck) ? snapshot.deck.map(String) : [];
      const selectedCards = Array.isArray(snapshot.selectedCards) ? snapshot.selectedCards.map(String) : [];
      const count = Math.max(1, Math.min(12, Number(snapshot.count || 1)));
      if (selectedCards.length >= count || !deck[selectedCards.length]) {
        return json(409, { error: "tarot_session_complete" });
      }
      selectedCards.push(deck[selectedCards.length]);
      const completed = selectedCards.length === count;
      snapshot.selectedCards = selectedCards;
      await rest(`nastardamus_reading_sessions?id=eq.${readingId}&telegram_id=eq.${telegramId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({
          input_snapshot: snapshot,
          state: completed ? "analyzing" : "selecting",
          updated_at: new Date().toISOString()
        })
      });
      return json(200, {
        ok: true,
        card: selectedCards.at(-1),
        position: Array.isArray(snapshot.positions) ? snapshot.positions[selectedCards.length - 1] : null,
        selected: selectedCards.length,
        total: count,
        completed
      });
    }

    if (action === "get_tarot_dialogue_context") {
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) {
        return json(400, { error: "invalid_telegram_id" });
      }
      const readingId = cleanReadingId(body?.readingId);
      if (!readingId) return json(400, { error: "invalid_reading_id" });
      const response = await rest(
        `nastardamus_reading_sessions?id=eq.${readingId}&telegram_id=eq.${telegramId}`
          + "&kind=eq.tarot&state=in.(selecting,analyzing)&select=id,subtype,title,input_snapshot&limit=1"
      );
      const session = (await response.json())?.[0];
      if (!session) return json(404, { error: "tarot_session_not_found" });
      const messagesResponse = await rest(
        `nastardamus_reading_messages?session_id=eq.${session.id}`
          + "&select=role,content,sequence_no,created_at&order=sequence_no.asc&limit=24"
      );
      return json(200, {
        ok: true,
        sessionId: session.id,
        subtype: session.subtype,
        title: session.title,
        snapshot: cleanJsonObject(session.input_snapshot),
        messages: await messagesResponse.json()
      });
    }

    if (action === "get_reading_dialogue_context") {
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) {
        return json(400, { error: "invalid_telegram_id" });
      }
      const readingId = cleanReadingId(body?.readingId);
      if (!readingId) return json(400, { error: "invalid_reading_id" });
      const response = await rest(
        `nastardamus_reading_sessions?id=eq.${readingId}&telegram_id=eq.${telegramId}`
          + "&deleted_at=is.null&state=in.(completed,dialogue,analyzing)"
          + "&select=id,kind,subtype,title,input_snapshot,result_payload,result_text,state,created_at,updated_at&limit=1"
      );
      const session = (await response.json())?.[0];
      if (!session) return json(404, { error: "reading_not_found" });
      const [messagesResponse, usageResponse] = await Promise.all([
        rest(`nastardamus_reading_messages?session_id=eq.${session.id}`
          + "&select=role,content,sequence_no,turn_id,message_kind,client_nonce,created_at&order=sequence_no.asc&limit=40"),
        rest("rpc/nastardamus_reading_dialogue_usage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ p_session_id: session.id, p_telegram_id: telegramId })
        })
      ]);
      const usage = await usageResponse.json();
      return json(200, {
        ok: true,
        session: {
          id: session.id,
          kind: session.kind,
          subtype: session.subtype,
          title: session.title,
          input: cleanJsonObject(session.input_snapshot),
          result: cleanJsonObject(session.result_payload),
          resultText: session.result_text || "",
          state: session.state
        },
        messages: await messagesResponse.json(),
        answeredQuestions: Number(usage?.answered_questions || 0)
      });
    }

    if (action === "append_reading_dialogue_turn") {
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) {
        return json(400, { error: "invalid_telegram_id" });
      }
      const readingId = cleanReadingId(body?.readingId);
      const messageKind = String(body?.messageKind || "question");
      const clientNonce = String(body?.clientNonce || "").trim();
      const message = String(body?.message || "").trim().slice(0, 2000);
      const answer = String(body?.answer || "").trim().slice(0, 2000);
      if (!readingId || !["question", "answer", "guided"].includes(messageKind)) {
        return json(400, { error: "invalid_reading_dialogue" });
      }
      if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/.test(clientNonce)) {
        return json(400, { error: "invalid_idempotency_key" });
      }
      const response = await rest("rpc/nastardamus_append_reading_dialogue_turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          p_session_id: readingId,
          p_telegram_id: telegramId,
          p_message: message,
          p_answer: answer,
          p_message_kind: messageKind,
          p_client_nonce: clientNonce
        })
      });
      return json(200, { ok: true, turn: await response.json() });
    }

    if (action === "append_tarot_dialogue_turn") {
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) {
        return json(400, { error: "invalid_telegram_id" });
      }
      const readingId = cleanReadingId(body?.readingId);
      if (!readingId) return json(400, { error: "invalid_reading_id" });
      const message = String(body?.message || "").trim().replace(/\s+/g, " ").slice(0, 700);
      const answer = String(body?.answer || "").trim().slice(0, 2000);
      if (message.length < 2 || !answer) return json(400, { error: "invalid_tarot_dialogue_message" });
      const sessionResponse = await rest(
        `nastardamus_reading_sessions?id=eq.${readingId}&telegram_id=eq.${telegramId}`
          + "&kind=eq.tarot&state=in.(selecting,analyzing)&select=id&limit=1"
      );
      if (!(await sessionResponse.json())?.[0]) return json(404, { error: "tarot_session_not_found" });
      const messagesResponse = await rest(
        `nastardamus_reading_messages?session_id=eq.${readingId}&select=sequence_no`
          + "&order=sequence_no.desc&limit=1"
      );
      const last = (await messagesResponse.json())?.[0];
      const firstSequence = Number(last?.sequence_no ?? -1) + 1;
      await rest("nastardamus_reading_messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify([
          { session_id: readingId, telegram_id: telegramId, role: "user", content: message, sequence_no: firstSequence },
          { session_id: readingId, telegram_id: telegramId, role: "assistant", content: answer, sequence_no: firstSequence + 1 }
        ])
      });
      return json(200, { ok: true });
    }

    if (action === "save_reading") {
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) {
        return json(400, { error: "invalid_telegram_id" });
      }
      const allowedKinds = new Set(["tarot", "compatibility", "photo", "palm", "runes", "amur", "natal", "horoscope", "sports", "path"]);
      const kind = String(body?.kind || "");
      if (!allowedKinds.has(kind)) return json(400, { error: "invalid_reading_kind" });
      const subtype = String(body?.subtype || kind).trim().slice(0, 80);
      const title = cleanReadingTitle(body?.title);
      const input = cleanJsonObject(body?.input);
      const resultPayload = cleanJsonObject(body?.result);
      const resultText = String(body?.resultText || "").trim().slice(0, 50_000);
      if (!resultText) return json(400, { error: "invalid_reading_result" });
      const requestedId = cleanReadingId(body?.readingId);
      let readingId = requestedId || crypto.randomUUID();
      const mediaValues = Array.isArray(body?.media) ? body.media.slice(0, 4) : [];
      const mediaPaths = await Promise.all(
        mediaValues.map((value, index) => uploadReadingImage(telegramId, readingId, index, value))
      );
      const record = {
        telegram_id: telegramId,
        kind,
        subtype,
        title,
        state: "completed",
        is_favorite: body?.favorite === true,
        input_snapshot: input,
        result_payload: resultPayload,
        result_text: resultText,
        media_paths: mediaPaths,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      let response;
      if (requestedId) {
        response = await rest(
          `nastardamus_reading_sessions?id=eq.${requestedId}&telegram_id=eq.${telegramId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Prefer: "return=representation" },
            body: JSON.stringify(record)
          }
        );
      } else {
        response = await rest("nastardamus_reading_sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Prefer: "return=representation" },
          body: JSON.stringify({ id: readingId, ...record })
        });
      }
      const row = (await response.json())?.[0];
      if (!row) return json(404, { error: "reading_not_found" });
      return json(200, { ok: true, reading: await readingView(row) });
    }

    if (action === "list_readings" || action === "get_reading") {
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) {
        return json(400, { error: "invalid_telegram_id" });
      }
      const readingId = action === "get_reading" ? cleanReadingId(body?.readingId) : "";
      if (action === "get_reading" && !readingId) return json(400, { error: "invalid_reading_id" });
      const favoriteFilter = body?.favorite === true ? "&is_favorite=eq.true" : "";
      const idFilter = readingId ? `&id=eq.${readingId}` : "";
      const response = await rest(
        `nastardamus_reading_sessions?telegram_id=eq.${telegramId}&deleted_at=is.null${favoriteFilter}${idFilter}`
          + "&state=eq.completed&select=id,kind,subtype,title,state,is_favorite,input_snapshot,result_payload,result_text,media_paths,version,completed_at,created_at,updated_at"
          + `&order=created_at.desc&limit=${readingId ? 1 : 100}`
      );
      const rows = await response.json();
      const readings = await Promise.all((rows || []).map(readingView));
      return json(200, {
        ok: true,
        ...(readingId ? { reading: readings[0] || null } : { readings })
      });
    }

    if (action === "update_reading" || action === "delete_reading") {
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) {
        return json(400, { error: "invalid_telegram_id" });
      }
      const readingId = cleanReadingId(body?.readingId);
      if (!readingId) return json(400, { error: "invalid_reading_id" });
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (action === "delete_reading") {
        patch.deleted_at = new Date().toISOString();
      } else {
        if (body?.title !== undefined) patch.title = cleanReadingTitle(body.title);
        if (body?.favorite !== undefined) patch.is_favorite = body.favorite === true;
      }
      const response = await rest(
        `nastardamus_reading_sessions?id=eq.${readingId}&telegram_id=eq.${telegramId}&deleted_at=is.null`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Prefer: "return=representation" },
          body: JSON.stringify(patch)
        }
      );
      const row = (await response.json())?.[0];
      if (!row) return json(404, { error: "reading_not_found" });
      return json(200, {
        ok: true,
        deleted: action === "delete_reading",
        reading: action === "delete_reading" ? null : await readingView(row)
      });
    }

    if (action === "get_wallet") {
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) {
        return json(400, { error: "invalid_telegram_id" });
      }
      await ensureWallet(telegramId);
      await reconcileLatestProviderPayment(telegramId).catch((error) => {
        console.error("SBP reconciliation failed", error instanceof Error ? error.message : error);
      });
      const [walletResponse, ledgerResponse, withdrawalResponse, entitlementResponse, topupResponse, externalPaymentResponse, settings, providerResponse, vipResponse, vipPlanResponse] = await Promise.all([
        rest(`nastardamus_wallets?telegram_id=eq.${telegramId}&select=telegram_id,balance_units,locked_units,free_spins,updated_at&limit=1`),
        rest(`nastardamus_wallet_ledger?telegram_id=eq.${telegramId}&select=id,entry_type,amount_units,balance_after_units,locked_after_units,metadata,created_at&order=created_at.desc&limit=30`),
        rest(`nastardamus_withdrawal_requests?telegram_id=eq.${telegramId}&select=id,gross_units,fee_units,net_units,destination,status,created_at,updated_at&order=created_at.desc&limit=20`),
        rest(`nastardamus_service_entitlements?telegram_id=eq.${telegramId}&quantity=gt.0&select=service_id,quantity,updated_at&order=updated_at.desc`),
        rest(`nastardamus_sbp_topups?telegram_id=eq.${telegramId}&select=id,silarum_units,ruble_kopecks,payment_reference,status,provider_type,provider_payment_id,provider_status,confirmation_url,verification_state,created_at,updated_at,paid_at,expires_at&order=created_at.desc&limit=20`),
        rest(`nastardamus_payment_orders?telegram_id=eq.${telegramId}&select=id,provider,provider_payment_id,silarum_units,provider_amount,provider_currency,payment_reference,payment_url,status,metadata,paid_at,expires_at,created_at,updated_at&order=created_at.desc&limit=20`),
        readSettings(),
        rest("nastardamus_payment_providers?key=eq.sbp&enabled=eq.true&select=merchant_id,secret_ciphertext,secret_iv&limit=1"),
        rest(`nastardamus_vip_subscriptions?telegram_id=eq.${telegramId}&status=eq.active&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=id,plan_id,starts_at,expires_at&order=expires_at.desc&limit=1`),
        rest("nastardamus_vip_plans?is_active=eq.true&select=id,title,description,duration_days,price_units,benefits,display_order&order=display_order.asc")
      ]);
      const wallets = await walletResponse.json();
      const ledger = await ledgerResponse.json();
      const withdrawals = await withdrawalResponse.json();
      const entitlements = await entitlementResponse.json();
      const topups = await topupResponse.json();
      const externalPayments = await externalPaymentResponse.json();
      const providers = await providerResponse.json();
      const vipRows = await vipResponse.json();
      const vipPlanRows = await vipPlanResponse.json();
      const vipPlans = Array.isArray(settings.vipPlans) && settings.vipPlans.length
        ? settings.vipPlans.filter((plan: Record<string, unknown>) => plan?.enabled !== false)
        : (vipPlanRows || []).map((plan: Record<string, unknown>) => {
            const benefits = plan.benefits && typeof plan.benefits === "object"
              ? plan.benefits as Record<string, unknown>
              : {};
            return {
              id: plan.id,
              title: plan.title,
              description: plan.description || "",
              durationDays: Number(plan.duration_days || 30),
              price: Number(plan.price_units || 0) / 100,
              includedReadings: Number(benefits.included_readings || 0),
              displayOrder: Number(plan.display_order || 100),
              enabled: true
            };
          });
      const automaticSbpReady = settings.sbpAutomationEnabled !== false
        && Boolean(providers?.[0]?.merchant_id && providers?.[0]?.secret_ciphertext && providers?.[0]?.secret_iv);
      return json(200, {
        ok: true,
        wallet: wallets?.[0] || null,
        ledger: ledger || [],
        withdrawals: withdrawals || [],
        entitlements: entitlements || [],
        topups: topups || [],
        externalPayments: externalPayments || [],
        vip: vipRows?.[0] || null,
        config: {
          paymentsEnabled: settings.paymentsEnabled !== false,
          everythingFree: settings.everythingFree === true,
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
          minimumWithdrawal: Number(settings.minimumWithdrawal ?? 25),
          paymentMethods: settings.paymentMethods && typeof settings.paymentMethods === "object"
            ? settings.paymentMethods
            : {
                stars: { enabled: true, miniApp: true },
                ton: { enabled: false, miniApp: false },
                usdt: { enabled: false, miniApp: false },
                sbp: { enabled: settings.sbpTopupsEnabled === true, miniApp: false }
              },
          paymentRates: settings.paymentRates && typeof settings.paymentRates === "object"
            ? settings.paymentRates
            : { starsPerSilarum: 50, tonPerSilarum: 0, usdtPerSilarum: 0 },
          vipPlans,
          vip: vipRows?.[0] || null
        }
      });
    }

    if (action === "create_external_payment_order") {
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) {
        return json(400, { error: "invalid_telegram_id" });
      }
      const provider = String(body?.provider || "");
      if (!["telegram_stars", "ton", "usdt"].includes(provider)) {
        return json(400, { error: "invalid_payment_provider" });
      }
      const amountUnits = Number(body?.amountUnits);
      const idempotencyKey = String(body?.idempotencyKey || "").trim();
      if (!Number.isSafeInteger(amountUnits) || amountUnits <= 0) return json(400, { error: "invalid_amount" });
      if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/.test(idempotencyKey)) {
        return json(400, { error: "invalid_idempotency_key" });
      }
      const settings = await readSettings();
      if (settings.paymentsEnabled === false) return json(403, { error: "payments_disabled" });
      const methodKey = provider === "telegram_stars" ? "stars" : provider;
      const defaultMethods: Record<string, Record<string, unknown>> = {
        stars: { enabled: true, miniApp: true },
        ton: { enabled: false, miniApp: false },
        usdt: { enabled: false, miniApp: false }
      };
      const method = settings.paymentMethods?.[methodKey] || defaultMethods[methodKey] || {};
      if (method.enabled !== true) return json(403, { error: "payment_method_disabled" });
      const rates = {
        starsPerSilarum: 50,
        tonPerSilarum: 0,
        usdtPerSilarum: 0,
        ...(settings.paymentRates || {})
      };
      const silarum = amountUnits / 100;
      const rate = provider === "telegram_stars"
        ? Number(rates.starsPerSilarum || 0)
        : provider === "ton"
          ? Number(rates.tonPerSilarum || 0)
          : Number(rates.usdtPerSilarum || 0);
      if (!Number.isFinite(rate) || rate <= 0) return json(503, { error: "payment_rate_not_configured" });
      const providerAmount = provider === "telegram_stars"
        ? Math.max(1, Math.ceil(silarum * rate))
        : Number((silarum * rate).toFixed(9));
      const currency = provider === "telegram_stars" ? "XTR" : provider.toUpperCase();
      const reference = `NS-${crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`;
      const response = await rest("nastardamus_payment_orders?on_conflict=telegram_id,idempotency_key", {
        method: "POST",
        headers: { "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates,return=representation" },
        body: JSON.stringify({
          telegram_id: telegramId,
          provider,
          idempotency_key: idempotencyKey,
          silarum_units: amountUnits,
          provider_amount: providerAmount,
          provider_currency: currency,
          payment_reference: reference,
          payment_url: String(method.paymentUrl || "") || null,
          metadata: {
            destination: String(method.destination || ""),
            network: String(method.network || "")
          }
        })
      });
      let rows = await response.json();
      if (!rows?.length) {
        const existing = await rest(
          `nastardamus_payment_orders?telegram_id=eq.${telegramId}&idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&select=*&limit=1`
        );
        rows = await existing.json();
      }
      return json(200, { ok: true, order: rows?.[0] });
    }

    if (action === "set_external_payment_url") {
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) {
        return json(400, { error: "invalid_telegram_id" });
      }
      const orderId = String(body?.orderId || "");
      const paymentUrl = String(body?.paymentUrl || "").trim();
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(paymentUrl);
      } catch {
        return json(400, { error: "invalid_payment_url" });
      }
      if (!UUID_PATTERN.test(orderId) || parsedUrl.protocol !== "https:" || !["t.me", "telegram.me"].includes(parsedUrl.hostname.toLowerCase())) {
        return json(400, { error: "invalid_payment_url" });
      }
      const response = await rest(
        `nastardamus_payment_orders?id=eq.${orderId}&telegram_id=eq.${telegramId}&provider=eq.telegram_stars&status=eq.pending`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Prefer: "return=representation" },
          body: JSON.stringify({ payment_url: parsedUrl.toString(), updated_at: new Date().toISOString() })
        }
      );
      const order = (await response.json())?.[0];
      if (!order) return json(404, { error: "payment_order_not_found" });
      return json(200, { ok: true, order });
    }

    if (action === "cancel_external_payment_order") {
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) {
        return json(400, { error: "invalid_telegram_id" });
      }
      const orderId = String(body?.orderId || "");
      if (!UUID_PATTERN.test(orderId)) return json(400, { error: "invalid_order_id" });
      const response = await rest(
        `nastardamus_payment_orders?id=eq.${orderId}&telegram_id=eq.${telegramId}&status=eq.pending`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Prefer: "return=representation" },
          body: JSON.stringify({ status: "cancelled", updated_at: new Date().toISOString() })
        }
      );
      const order = (await response.json())?.[0];
      if (!order) return json(409, { error: "payment_order_not_pending" });
      return json(200, { ok: true, order });
    }

    if (action === "purchase_vip") {
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) {
        return json(400, { error: "invalid_telegram_id" });
      }
      const planId = String(body?.planId || "").trim().toLowerCase();
      const idempotencyKey = String(body?.idempotencyKey || "").trim();
      if (!/^[a-z0-9][a-z0-9_-]{1,47}$/.test(planId)) return json(400, { error: "invalid_vip_plan" });
      if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/.test(idempotencyKey)) {
        return json(400, { error: "invalid_idempotency_key" });
      }
      const settings = await readSettings();
      let plan = Array.isArray(settings.vipPlans)
        ? settings.vipPlans.find((item: Record<string, unknown>) => item?.id === planId && item?.enabled !== false)
        : null;
      if (!plan) {
        const planResponse = await rest(
          `nastardamus_vip_plans?id=eq.${encodeURIComponent(planId)}&is_active=eq.true&select=id,title,description,duration_days,price_units,benefits,display_order&limit=1`
        );
        const row = (await planResponse.json())?.[0];
        if (row) plan = {
          id: row.id,
          title: row.title,
          description: row.description,
          durationDays: row.duration_days,
          price: Number(row.price_units) / 100,
          includedReadings: Number(row.benefits?.included_readings || 0),
          displayOrder: row.display_order,
          enabled: true
        };
      }
      if (!plan) return json(404, { error: "vip_plan_not_found" });
      const durationDays = Math.max(1, Math.min(3660, Number(plan.durationDays || 30)));
      const priceUnits = Math.max(0, Math.round(Number(plan.price || 0) * 100));
      await rest("nastardamus_vip_plans?on_conflict=id", {
        method: "POST",
        headers: { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({
          id: planId,
          title: String(plan.title || planId).slice(0, 100),
          description: String(plan.description || "").slice(0, 500),
          duration_days: durationDays,
          price_units: priceUnits,
          benefits: { included_readings: Math.max(0, Number(plan.includedReadings || 0)) },
          display_order: Number(plan.displayOrder || 100),
          is_active: true,
          updated_at: new Date().toISOString()
        })
      });
      const response = await rest("rpc/nastardamus_purchase_vip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          p_telegram_id: telegramId,
          p_plan_id: planId,
          p_duration_days: durationDays,
          p_price_units: priceUnits,
          p_idempotency_key: idempotencyKey
        })
      });
      return json(200, { ok: true, subscription: await response.json() });
    }

    if (action === "verify_external_payment") {
      const orderId = cleanReadingId(body?.orderId);
      const checkoutTelegramId = Number(body?.telegramId);
      const checkoutAmount = Number(body?.totalAmount);
      const checkoutCurrency = String(body?.currency || "");
      if (
        !orderId
        || !Number.isSafeInteger(checkoutTelegramId)
        || checkoutTelegramId <= 0
        || !Number.isSafeInteger(checkoutAmount)
        || checkoutAmount <= 0
      ) {
        return json(400, { error: "invalid_payment_checkout" });
      }
      const orderResponse = await rest(
        `nastardamus_payment_orders?id=eq.${orderId}&select=id,telegram_id,provider,provider_amount,provider_currency,status,expires_at&limit=1`
      );
      const order = (await orderResponse.json())?.[0];
      const expired = !order?.expires_at || Date.parse(String(order.expires_at)) <= Date.now();
      const valid = Boolean(
        order
        && Number(order.telegram_id) === checkoutTelegramId
        && order.provider === "telegram_stars"
        && order.provider_currency === checkoutCurrency
        && Math.round(Number(order.provider_amount)) === checkoutAmount
        && ["pending", "confirming"].includes(String(order.status))
        && !expired
      );
      if (!valid) return json(409, { error: "payment_checkout_mismatch" });
      return json(200, { ok: true, orderId: order.id });
    }

    if (action === "complete_external_payment") {
      const orderId = cleanReadingId(body?.orderId);
      const providerPaymentId = String(body?.providerPaymentId || "").trim().slice(0, 200);
      if (!orderId || !providerPaymentId) return json(400, { error: "invalid_payment_confirmation" });
      const providerPayload = cleanJsonObject(body?.providerPayload);
      const orderResponse = await rest(
        `nastardamus_payment_orders?id=eq.${orderId}&select=id,telegram_id,provider,provider_amount,provider_currency,status,expires_at&limit=1`
      );
      const order = (await orderResponse.json())?.[0];
      if (!order) return json(404, { error: "payment_order_not_found" });
      if (order.provider === "telegram_stars") {
        const matchesTelegram = Number(providerPayload.telegramId) === Number(order.telegram_id);
        const matchesCurrency = String(providerPayload.currency || "") === String(order.provider_currency);
        const matchesAmount = Number(providerPayload.totalAmount) === Math.round(Number(order.provider_amount));
        if (!matchesTelegram || !matchesCurrency || !matchesAmount) {
          return json(409, { error: "payment_confirmation_mismatch" });
        }
      }
      const response = await rest("rpc/nastardamus_complete_external_payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          p_order_id: orderId,
          p_provider_payment_id: providerPaymentId,
          p_provider_payload: providerPayload
        })
      });
      return json(200, { ok: true, payment: await response.json() });
    }

    if (action === "get_public_config") {
      const settings = await readSettings();
      const [moderationResponse, tarotResponse, compatibilityResponse, vipResponse] = await Promise.all([
        rest("nastardamus_ai_moderation_policy?key=eq.global&select=enabled,rules,thresholds,actions&limit=1"),
        rest("nastardamus_tarot_spreads?is_active=eq.true&select=id,title,description,category,card_count,positions,service_id,price_units,free_checks,vip_access,duration_label,depth_label,badge,artwork_key,display_order,version&order=display_order.asc"),
        rest("nastardamus_compatibility_types?is_active=eq.true&select=id,title,description,service_id,price_units,free_checks,vip_access,artwork_key,display_order,version&order=display_order.asc"),
        Number.isSafeInteger(telegramId) && telegramId > 0
          ? rest(`nastardamus_vip_subscriptions?telegram_id=eq.${telegramId}&status=eq.active&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=id,plan_id,starts_at,expires_at&order=expires_at.desc&limit=1`)
          : Promise.resolve(null)
      ]);
      const moderationRows = await moderationResponse.json();
      const vipRows = vipResponse ? await vipResponse.json() : [];
      const tarotRows = await tarotResponse.json();
      const compatibilityRows = await compatibilityResponse.json();
      const tarotOverrides = new Map(
        (Array.isArray(settings.tarotCatalog) ? settings.tarotCatalog : [])
          .map((item: Record<string, unknown>) => [item.id, item])
      );
      const compatibilityOverrides = new Map(
        (Array.isArray(settings.compatibilityCatalog) ? settings.compatibilityCatalog : [])
          .map((item: Record<string, unknown>) => [item.id, item])
      );
      const tarotCatalog = (tarotRows || []).flatMap((item: Record<string, unknown>) => {
        const override = tarotOverrides.get(item.id) as Record<string, unknown> | undefined;
        if (override?.enabled === false) return [];
        return [{
          ...item,
          ...(override ? {
            title: override.title || item.title,
            description: override.description || item.description,
            category: override.category || item.category,
            card_count: override.cardCount || item.card_count,
            positions: Array.isArray(override.positions) && override.positions.length ? override.positions : item.positions,
            service_id: override.serviceId || item.service_id,
            price_units: override.price === null || override.price === undefined ? item.price_units : Math.round(Number(override.price) * 100),
            free_checks: override.freeChecks ?? item.free_checks,
            vip_access: override.vipAccess || item.vip_access,
            duration_label: override.durationLabel || item.duration_label,
            depth_label: override.depthLabel || item.depth_label,
            badge: override.badge || item.badge,
            artwork_key: override.artworkKey || item.artwork_key,
            display_order: override.displayOrder ?? item.display_order
          } : {})
        }];
      }).sort((a: Record<string, unknown>, b: Record<string, unknown>) => Number(a.display_order) - Number(b.display_order));
      const compatibilityCatalog = (compatibilityRows || []).flatMap((item: Record<string, unknown>) => {
        const override = compatibilityOverrides.get(item.id) as Record<string, unknown> | undefined;
        if (override?.enabled === false) return [];
        return [{
          ...item,
          ...(override ? {
            title: override.title || item.title,
            description: override.description || item.description,
            service_id: override.serviceId || item.service_id,
            price_units: override.price === null || override.price === undefined ? item.price_units : Math.round(Number(override.price) * 100),
            free_checks: override.freeChecks ?? item.free_checks,
            vip_access: override.vipAccess || item.vip_access,
            artwork_key: override.artworkKey || item.artwork_key,
            display_order: override.displayOrder ?? item.display_order
          } : {})
        }];
      }).sort((a: Record<string, unknown>, b: Record<string, unknown>) => Number(a.display_order) - Number(b.display_order));
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
          serviceCatalog: {
            ...(settings.serviceCatalog && typeof settings.serviceCatalog === "object" ? settings.serviceCatalog : {}),
            compatibility: settings.serviceCatalog?.compatibility || {
              id: "compatibility",
              title: "Совместимость по данным",
              enabled: true,
              price: 5.55
            }
          },
          dialogueCatalog: settings.dialogueCatalog && typeof settings.dialogueCatalog === "object"
            ? settings.dialogueCatalog
            : {
                personal: { id: "personal", enabled: true, sectionFree: true, includedQuestions: 3, extraQuestionPrice: 0.1 },
                solo: { id: "solo", enabled: true, sectionFree: true, includedQuestions: 3, extraQuestionPrice: 0.1 },
                pair: { id: "pair", enabled: true, sectionFree: true, includedQuestions: 3, extraQuestionPrice: 0.1 },
                group: { id: "group", enabled: true, sectionFree: true, includedQuestions: 5, extraQuestionPrice: 0.1 }
              },
          dailyHoroscopeEnabled: settings.dailyHoroscopeEnabled !== false,
          subscriptionGateEnabled: settings.subscriptionGateEnabled === true,
          subscriptionChannelUsername: String(settings.subscriptionChannelUsername || ""),
          subscriptionChannelTitle: String(settings.subscriptionChannelTitle || "Канал Эзотериума"),
          dailyFreeServiceIds: Array.isArray(settings.dailyFreeServiceIds)
            ? settings.dailyFreeServiceIds
            : ["tarot", "tarot_relationship", "palm_reading", "natal", "rune_reading"],
          tonTreasuryAddress: String(settings.tonTreasuryAddress || ""),
          paymentsEnabled: settings.paymentsEnabled !== false,
          everythingFree: settings.everythingFree === true,
          sbpTopupsEnabled: settings.sbpTopupsEnabled === true,
          sbpMinimumSilarum: Number(settings.sbpMinimumSilarum ?? 10),
          sbpMaximumSilarum: Number(settings.sbpMaximumSilarum ?? 1000),
          sbpRoublesPerSilarum: Number(settings.sbpRoublesPerSilarum ?? 100),
          paymentMethods: settings.paymentMethods && typeof settings.paymentMethods === "object"
            ? settings.paymentMethods
            : {
                stars: { enabled: true, miniApp: true },
                ton: { enabled: false, miniApp: false },
                usdt: { enabled: false, miniApp: false },
                sbp: { enabled: settings.sbpTopupsEnabled === true, miniApp: false }
              },
          vip: vipRows?.[0] || null,
          tarotCatalog,
          compatibilityCatalog,
          vipPlans: Array.isArray(settings.vipPlans) ? settings.vipPlans : []
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

    if (action === "claim_free_usage" || action === "release_free_usage") {
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) {
        return json(400, { error: "invalid_telegram_id" });
      }
      const serviceId = String(body?.serviceId || "").trim().toLowerCase();
      if (!/^[a-z0-9:_-]{1,100}$/.test(serviceId)) {
        return json(400, { error: "invalid_service_id" });
      }
      const claim = action === "claim_free_usage";
      const dailyLimit = Number(body?.dailyLimit);
      if (claim && (!Number.isSafeInteger(dailyLimit) || dailyLimit < 1 || dailyLimit > 1000)) {
        return json(400, { error: "invalid_free_limit" });
      }
      const response = await rest(
        claim ? "rpc/nastardamus_claim_free_usage" : "rpc/nastardamus_release_free_usage",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            p_telegram_id: telegramId,
            p_service_id: serviceId,
            ...(claim ? { p_daily_limit: dailyLimit } : {})
          })
        }
      );
      const value = await response.json();
      return json(200, { ok: true, [claim ? "claimed" : "released"]: value === true });
    }

    if (action === "get_daily_access") {
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) {
        return json(400, { error: "invalid_telegram_id" });
      }
      const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date());
      const [usageResponse, eventResponse] = await Promise.all([
        rest(`nastardamus_free_usage?telegram_id=eq.${telegramId}&service_id=eq.daily-choice&usage_date=eq.${today}&select=uses&limit=1`),
        rest(`nastardamus_service_events?telegram_id=eq.${telegramId}&access_source=eq.daily_channel_choice&event_type=eq.completed&select=service_id,created_at&order=created_at.desc&limit=1`)
      ]);
      const usage = (await usageResponse.json())?.[0];
      const event = (await eventResponse.json())?.[0];
      return json(200, {
        ok: true,
        dailyChoice: {
          used: Number(usage?.uses || 0) > 0,
          serviceId: String(event?.service_id || ""),
          usedAt: event?.created_at || null,
          date: today
        }
      });
    }

    if (action === "record_service_event") {
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) {
        return json(400, { error: "invalid_telegram_id" });
      }
      const serviceId = String(body?.serviceId || "").trim().toLowerCase();
      const eventType = String(body?.eventType || "").trim().toLowerCase();
      const accessSource = cleanPersonalText(body?.accessSource, 80);
      if (!/^[a-z0-9:_-]{1,100}$/.test(serviceId)) return json(400, { error: "invalid_service_id" });
      if (!["started", "completed", "failed", "free_used", "paid_used", "wheel"].includes(eventType)) {
        return json(400, { error: "invalid_service_event_type" });
      }
      const response = await rest("rpc/nastardamus_record_service_event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          p_telegram_id: telegramId,
          p_service_id: serviceId,
          p_event_type: eventType,
          p_access_source: accessSource || null,
          p_metadata: cleanJsonObject(body?.metadata)
        })
      });
      return json(200, { ok: true, eventId: await response.json() });
    }

    if (action === "get_journey_context") {
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) {
        return json(400, { error: "invalid_telegram_id" });
      }
      const response = await rest(
        `nastardamus_user_journey?telegram_id=eq.${telegramId}&select=facts,visual_observations,ai_hypotheses,confirmed_hypotheses,rejected_hypotheses,service_affinity,last_guidance,updated_at&limit=1`
      );
      return json(200, { ok: true, journey: (await response.json())?.[0] || null });
    }

    if (action === "record_journey_insight") {
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) {
        return json(400, { error: "invalid_telegram_id" });
      }
      const currentResponse = await rest(
        `nastardamus_user_journey?telegram_id=eq.${telegramId}&select=visual_observations,ai_hypotheses&limit=1`
      );
      const current = (await currentResponse.json())?.[0] || {};
      const observations = Array.isArray(body?.visualObservations)
        ? body.visualObservations.slice(0, 12).map((item: unknown) => cleanJsonObject(item))
        : [];
      const hypotheses = Array.isArray(body?.aiHypotheses)
        ? body.aiHypotheses.slice(0, 12).map((item: unknown) => cleanJsonObject(item))
        : [];
      const nextObservations = [...(Array.isArray(current.visual_observations) ? current.visual_observations : []), ...observations].slice(-40);
      const nextHypotheses = [...(Array.isArray(current.ai_hypotheses) ? current.ai_hypotheses : []), ...hypotheses].slice(-40);
      await rest("nastardamus_user_journey?on_conflict=telegram_id", {
        method: "POST",
        headers: { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({
          telegram_id: telegramId,
          visual_observations: nextObservations,
          ai_hypotheses: nextHypotheses,
          updated_at: new Date().toISOString()
        })
      });
      return json(200, { ok: true });
    }

    if (action === "set_ton_wallet") {
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) {
        return json(400, { error: "invalid_telegram_id" });
      }
      const disconnect = body?.disconnect === true;
      const address = String(body?.address || "").trim();
      const validAddress = /^(?:-?\d+:[0-9a-fA-F]{64}|[A-Za-z0-9_-]{40,80})$/.test(address);
      if (!disconnect && !validAddress) return json(400, { error: "invalid_ton_wallet_address" });
      const payload = disconnect ? {
        ton_wallet_address: null,
        ton_wallet_chain: null,
        ton_wallet_app: null,
        ton_wallet_connected_at: null,
        updated_at: new Date().toISOString()
      } : {
        ton_wallet_address: address,
        ton_wallet_chain: cleanPersonalText(body?.chain, 20),
        ton_wallet_app: cleanPersonalText(body?.walletApp, 80),
        ton_wallet_connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      await rest("nastardamus_user_journey?on_conflict=telegram_id", {
        method: "POST",
        headers: { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ telegram_id: telegramId, ...payload })
      });
      return json(200, { ok: true, wallet: disconnect ? null : { address, chain: payload.ton_wallet_chain, walletApp: payload.ton_wallet_app } });
    }

    if (action === "get_ton_wallet") {
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) {
        return json(400, { error: "invalid_telegram_id" });
      }
      const response = await rest(
        `nastardamus_user_journey?telegram_id=eq.${telegramId}&select=ton_wallet_address,ton_wallet_chain,ton_wallet_app,ton_wallet_connected_at&limit=1`
      );
      const wallet = (await response.json())?.[0];
      return json(200, { ok: true, wallet: wallet?.ton_wallet_address ? {
        address: wallet.ton_wallet_address,
        chain: wallet.ton_wallet_chain,
        walletApp: wallet.ton_wallet_app,
        connectedAt: wallet.ton_wallet_connected_at
      } : null });
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
      const priceUnits = body?.priceUnits === undefined || body?.priceUnits === null
        ? null
        : Number(body.priceUnits);
      const customPrice = Number.isSafeInteger(priceUnits) && priceUnits > 0 && priceUnits <= 100000000;
      if (priceUnits !== null && !customPrice) {
        return json(400, { error: "invalid_service_price" });
      }
      const response = await rest(customPrice
        ? "rpc/nastardamus_charge_catalog_service"
        : "rpc/nastardamus_charge_service", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(customPrice ? {
          p_telegram_id: telegramId,
          p_service_id: serviceId,
          p_service_title: String(body?.serviceTitle || serviceId).trim().slice(0, 120),
          p_price_units: priceUnits,
          p_idempotency_key: idempotencyKey
        } : {
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
        const telegramAvatarUrl = String(body?.telegramAvatarUrl || "").trim().slice(0, 1000);
        if (telegramAvatarUrl && /^https:\/\//.test(telegramAvatarUrl)) {
          payload.telegram_avatar_url = telegramAvatarUrl;
        }
      } else {
        const currentYear = new Date().getUTCFullYear();
        const birthYear = Number(body?.birthYear);
        const city = String(body?.city || "").trim().replace(/\s+/g, " ").slice(0, 120);
        const profileName = String(body?.profileName || "").trim().replace(/\s+/g, " ").slice(0, 80);
        if (!Number.isInteger(birthYear) || birthYear < currentYear - 120 || birthYear > currentYear - 13) {
          return json(400, { error: "invalid_age" });
        }
        if (city.length < 2) return json(400, { error: "invalid_city" });
        payload.zodiac_sign = zodiacSign;
        payload.daily_horoscope_enabled = body?.enabled === true;
        payload.timezone = String(body?.timezone || "Europe/Berlin").slice(0, 80);
        payload.gender = gender;
        payload.profile_name = profileName || null;
        payload.birth_year = birthYear;
        const birthDate = String(body?.birthDate || "");
        const birthTime = String(body?.birthTime || "");
        if (birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return json(400, { error: "invalid_birth_date" });
        if (birthTime && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(birthTime)) return json(400, { error: "invalid_birth_time" });
        payload.birth_date = birthDate || null;
        payload.birth_time = body?.birthTimeKnown === true && birthTime ? birthTime : null;
        payload.birth_time_known = body?.birthTimeKnown === true && Boolean(birthTime);
        payload.city = city;
        payload.interests = Array.isArray(body?.interests) ? body.interests.map((item: unknown) => cleanPersonalText(item, 60)).filter(Boolean).slice(0, 12) : [];
        payload.goals = Array.isArray(body?.goals) ? body.goals.map((item: unknown) => cleanPersonalText(item, 60)).filter(Boolean).slice(0, 8) : [];
        payload.profile_consents = cleanJsonObject(body?.consents);
        payload.natal_chart = body?.natalChart && typeof body.natalChart === "object" && !Array.isArray(body.natalChart) ? body.natalChart : null;
        payload.profile_completed_at = new Date().toISOString();
      }
      await rest("nastardamus_users?on_conflict=telegram_id", {
        method: "POST",
        headers: { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(payload)
      });
      if (action === "update_user_preferences") {
        await rest("nastardamus_user_journey?on_conflict=telegram_id", {
          method: "POST",
          headers: { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify({
            telegram_id: telegramId,
            facts: {
              profileName,
              gender,
              birthDate: payload.birth_date,
              birthTime: payload.birth_time,
              birthTimeKnown: payload.birth_time_known,
              city: payload.city,
              interests: payload.interests,
              goals: payload.goals
            },
            updated_at: new Date().toISOString()
          })
        });
      }
      return json(200, { ok: true });
    }

    if (action === "upload_profile_avatar") {
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) {
        return json(400, { error: "invalid_telegram_id" });
      }
      const path = await uploadProfileAvatar(telegramId, body?.image);
      await rest(`nastardamus_users?telegram_id=eq.${telegramId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ profile_avatar_path: path, updated_at: new Date().toISOString() })
      });
      return json(200, { ok: true, avatarUrl: await signedProfileAvatar(path) });
    }

    if (action === "remove_profile_avatar") {
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) {
        return json(400, { error: "invalid_telegram_id" });
      }
      const response = await rest(
        `nastardamus_users?telegram_id=eq.${telegramId}&select=profile_avatar_path&limit=1`
      );
      const row = (await response.json())?.[0];
      if (row?.profile_avatar_path) {
        await storageRequest(`object/${PROFILE_PHOTO_BUCKET}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prefixes: [row.profile_avatar_path] })
        }).catch(() => null);
      }
      await rest(`nastardamus_users?telegram_id=eq.${telegramId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ profile_avatar_path: null, updated_at: new Date().toISOString() })
      });
      return json(200, { ok: true });
    }

    if (action === "get_user_preferences") {
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) {
        return json(400, { error: "invalid_telegram_id" });
      }
      const response = await rest(`nastardamus_users?telegram_id=eq.${telegramId}&select=profile_name,zodiac_sign,daily_horoscope_enabled,timezone,gender,birth_year,birth_date,birth_time,birth_time_known,city,interests,goals,profile_consents,natal_chart,telegram_avatar_url,profile_avatar_path,profile_completed_at,last_horoscope_sent_on&limit=1`);
      const rows = await response.json();
      const preferences = rows?.[0] || null;
      return json(200, {
        ok: true,
        preferences: preferences ? {
          ...preferences,
          profile_avatar_url: await signedProfileAvatar(preferences.profile_avatar_path)
        } : null
      });
    }

    if (action === "list_horoscope_recipients") {
      const settings = await readSettings();
      if (settings.dailyHoroscopeEnabled === false) {
        return json(200, { ok: true, recipients: [] });
      }
      const limit = Math.max(1, Math.min(500, Number(body?.limit || 200)));
      // Older API deployments pass a global date and expect the store to filter
      // already delivered rows. Keep that contract during rolling deployments;
      // the current API omits `today` and performs each recipient's local-date
      // check itself.
      const legacyToday = String(body?.today || "");
      const legacyDateFilter = /^\d{4}-\d{2}-\d{2}$/.test(legacyToday)
        ? `&or=(last_horoscope_sent_on.is.null,last_horoscope_sent_on.lt.${legacyToday})`
        : "";
      const response = await rest(
        "nastardamus_users?daily_horoscope_enabled=eq.true&zodiac_sign=not.is.null"
          + legacyDateFilter
          + "&select=telegram_id,chat_id,first_name,profile_name,zodiac_sign,gender,birth_year,birth_date,birth_time,birth_time_known,city,timezone,interests,goals,natal_chart,last_horoscope_sent_on"
          + `&order=telegram_id.asc&limit=${limit}`
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

    if (action === "get_esoterium_context") {
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) return json(400, { error: "invalid_telegram_id" });
      const [context, conversationsResponse] = await Promise.all([
        readUserContext(telegramId),
        rest(`nastardamus_esoterium_conversations?telegram_id=eq.${telegramId}&select=consultation_id,mode,title,stage,summary,updated_at&order=updated_at.desc&limit=20`)
      ]);
      return json(200, { ok: true, memoryEnabled: context.memory_enabled === true, memories: Array.isArray(context.memories) ? context.memories : [], consultations: await conversationsResponse.json() });
    }

    if (action === "set_esoterium_memory") {
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) return json(400, { error: "invalid_telegram_id" });
      if (typeof body?.enabled !== "boolean") return json(400, { error: "invalid_memory_setting" });
      await ensureUserContext(telegramId);
      await rest(`nastardamus_user_context?telegram_id=eq.${telegramId}`, { method: "PATCH", headers: { "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ memory_enabled: body.enabled, updated_at: new Date().toISOString() }) });
      return json(200, { ok: true, memoryEnabled: body.enabled });
    }

    if (action === "clear_esoterium_memory") {
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) return json(400, { error: "invalid_telegram_id" });
      const context = await readUserContext(telegramId);
      await Promise.all([
        rest(`nastardamus_user_context?telegram_id=eq.${telegramId}`, { method: "PATCH", headers: { "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ memories: [], updated_at: new Date().toISOString() }) }),
        rest(`nastardamus_esoterium_conversations?telegram_id=eq.${telegramId}`, { method: "DELETE", headers: { Prefer: "return=minimal" } })
      ]);
      return json(200, { ok: true, memoryEnabled: context.memory_enabled === true });
    }

    if (action === "save_esoterium_turn") {
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) return json(400, { error: "invalid_telegram_id" });
      const consultationId = String(body?.consultationId || "").trim();
      const mode = String(body?.mode || "general").trim();
      const stage = String(body?.stage || "clarifying").trim();
      if (!/^[A-Za-z0-9._:-]{8,160}$/.test(consultationId)) return json(400, { error: "invalid_consultation_id" });
      if (!["general", "tarot", "palmistry", "runes", "natal", "photo", "compatibility", "planning"].includes(mode) || !["opening", "clarifying", "symbols", "summary", "recommendation"].includes(stage)) return json(400, { error: "invalid_consultation_state" });
      const context = await readUserContext(telegramId);
      const now = new Date().toISOString();
      await rest("nastardamus_esoterium_conversations?on_conflict=telegram_id,consultation_id", {
        method: "POST", headers: { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ telegram_id: telegramId, consultation_id: consultationId, mode, title: cleanPersonalText(body?.title, 300), stage, summary: cleanPersonalText(body?.summary, 1000), messages: cleanConversationMessages(body?.messages), updated_at: now })
      });
      if (context.memory_enabled === true && String(body?.memory || "").trim()) {
        await rest(`nastardamus_user_context?telegram_id=eq.${telegramId}`, { method: "PATCH", headers: { "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ memories: mergeMemory(context.memories, body.memory), updated_at: now }) });
      }
      return json(200, { ok: true, memoryEnabled: context.memory_enabled === true });
    }

    if (action === "get_personal_space") {
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) return json(400, { error: "invalid_telegram_id" });
      const [eventsResponse, goalsResponse, tasksResponse, checkinsResponse, settingsResponse, pathItemsResponse, consultationsResponse] = await Promise.all([
        rest(`nastardamus_personal_events?telegram_id=eq.${telegramId}&status=neq.archived&select=*&order=event_date.asc,event_time.asc&limit=500`),
        rest(`nastardamus_personal_goals?telegram_id=eq.${telegramId}&status=neq.archived&select=*&order=created_at.desc&limit=200`),
        rest(`nastardamus_personal_tasks?telegram_id=eq.${telegramId}&select=*&order=created_at.asc&limit=1000`),
        rest(`nastardamus_daily_checkins?telegram_id=eq.${telegramId}&select=*&order=checkin_date.desc&limit=120`),
        rest(`nastardamus_space_preferences?telegram_id=eq.${telegramId}&select=*&limit=1`),
        rest(`nastardamus_path_items?telegram_id=eq.${telegramId}&status=neq.archived&select=*&order=created_at.asc&limit=500`),
        rest(`nastardamus_path_consultations?telegram_id=eq.${telegramId}&select=*&order=created_at.desc&limit=120`)
      ]);
      const [events, goals, tasks, checkins, settingsRows, pathItems, consultations] = await Promise.all([eventsResponse.json(), goalsResponse.json(), tasksResponse.json(), checkinsResponse.json(), settingsResponse.json(), pathItemsResponse.json(), consultationsResponse.json()]);
      const settings = settingsRows?.[0] || {};
      return json(200, {
        ok: true, events: events.map(personalEventView), goals: goals.map(personalGoalView), tasks: tasks.map(personalTaskView),
        projects: pathItems.filter((row: Record<string, unknown>) => row.kind === "project").map(pathItemView),
        habits: pathItems.filter((row: Record<string, unknown>) => row.kind === "habit").map(pathItemView),
        consultations: consultations.map(pathConsultationView),
        checkins: checkins.map((row: Record<string, unknown>) => ({ date: row.checkin_date, morningTasks: row.morning_tasks || [], morningNote: row.morning_note || "", eveningReflection: row.evening_reflection || null })),
        settings: { memoryEnabled: settings.memory_enabled !== false, morningEnabled: settings.morning_enabled !== false, eveningEnabled: settings.evening_enabled !== false, plan: settings.plan || "free" }
      });
    }

    if (action === "upsert_personal_event") {
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) return json(400, { error: "invalid_telegram_id" });
      const event = body?.event || {};
      const eventId = String(event.eventId || crypto.randomUUID());
      if (!UUID_PATTERN.test(eventId)) return json(400, { error: "invalid_event_id" });
      await assertOwnedId("nastardamus_personal_events", "event_id", eventId, telegramId);
      const date = String(event.date || ""); const time = String(event.time || ""); const goalId = String(event.goalId || "");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || (time && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time))) return json(400, { error: "invalid_event_date" });
      if (goalId && !UUID_PATTERN.test(goalId)) return json(400, { error: "invalid_goal_id" });
      if (goalId) await assertOwnedId("nastardamus_personal_goals", "goal_id", goalId, telegramId);
      const cleanAnalysis = cleanJsonObject(event.analysis);
      const links = Array.isArray(event.links) ? event.links.map((item: unknown) => cleanPersonalText(item, 500)).filter(Boolean).slice(0, 8) : [];
      const payload = { event_id: eventId, telegram_id: telegramId, title: cleanPersonalText(event.title, 100, true), event_date: date, event_time: time || null, description: cleanPersonalText(event.description, 500), location: cleanPersonalText(event.location, 180), links, desired_result: cleanPersonalText(event.desiredResult, 500), reflection: cleanPersonalText(event.reflection, 1000), category: PERSONAL_CATEGORIES.has(event.category) ? event.category : "other", priority: ["low", "medium", "high"].includes(event.priority) ? event.priority : "medium", status: PERSONAL_STATUSES.has(event.status) ? event.status : "active", reminder: event.reminder === true && Boolean(time), goal_id: goalId || null, analysis: Object.keys(cleanAnalysis).length ? cleanAnalysis : null, enrichments: cleanJsonObject(event.enrichments), updated_at: new Date().toISOString() };
      const response = await rest("nastardamus_personal_events?on_conflict=event_id", { method: "POST", headers: { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify(payload) });
      return json(200, { ok: true, event: personalEventView((await response.json())?.[0] || payload) });
    }

    if (action === "upsert_personal_goal") {
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) return json(400, { error: "invalid_telegram_id" });
      const goal = body?.goal || {}; const goalId = String(goal.goalId || crypto.randomUUID()); const deadline = String(goal.deadline || "");
      if (!UUID_PATTERN.test(goalId) || (deadline && !/^\d{4}-\d{2}-\d{2}$/.test(deadline))) return json(400, { error: "invalid_goal" });
      await assertOwnedId("nastardamus_personal_goals", "goal_id", goalId, telegramId);
      const payload = { goal_id: goalId, telegram_id: telegramId, title: cleanPersonalText(goal.title, 100, true), description: cleanPersonalText(goal.description, 500), category: PERSONAL_CATEGORIES.has(goal.category) ? goal.category : "other", deadline: deadline || null, status: PERSONAL_STATUSES.has(goal.status) ? goal.status : "active", updated_at: new Date().toISOString() };
      const response = await rest("nastardamus_personal_goals?on_conflict=goal_id", { method: "POST", headers: { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify(payload) });
      return json(200, { ok: true, goal: personalGoalView((await response.json())?.[0] || payload) });
    }

    if (action === "upsert_personal_task") {
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) return json(400, { error: "invalid_telegram_id" });
      const task = body?.task || {}; const taskId = String(task.taskId || crypto.randomUUID()); const goalId = String(task.goalId || ""); const scheduledDate = String(task.scheduledDate || "");
      if (!UUID_PATTERN.test(taskId) || (goalId && !UUID_PATTERN.test(goalId)) || !/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate)) return json(400, { error: "invalid_task" });
      await assertOwnedId("nastardamus_personal_tasks", "task_id", taskId, telegramId); if (goalId) await assertOwnedId("nastardamus_personal_goals", "goal_id", goalId, telegramId);
      const completedDates = Array.isArray(task.completedDates) ? [...new Set(task.completedDates.map(String).filter((date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date)))].slice(-400) : [];
      const payload = { task_id: taskId, telegram_id: telegramId, goal_id: goalId || null, title: cleanPersonalText(task.title, 100, true), description: cleanPersonalText(task.description, 500), recurrence: ["none", "daily", "weekly", "monthly"].includes(task.recurrence) ? task.recurrence : "none", scheduled_date: scheduledDate, completed_dates: completedDates, updated_at: new Date().toISOString() };
      const response = await rest("nastardamus_personal_tasks?on_conflict=task_id", { method: "POST", headers: { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify(payload) });
      return json(200, { ok: true, task: personalTaskView((await response.json())?.[0] || payload) });
    }

    if (action === "upsert_path_item") {
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) return json(400, { error: "invalid_telegram_id" });
      const item = body?.item || {}; const itemId = String(item.id || ""); const kind = String(item.kind || ""); const goalId = String(item.goalId || "");
      if (!/^[A-Za-z0-9._:-]{8,160}$/.test(itemId) || !["project", "habit"].includes(kind) || (goalId && !UUID_PATTERN.test(goalId))) return json(400, { error: "invalid_path_item" });
      await assertOwnedId("nastardamus_path_items", "item_id", itemId, telegramId);
      if (goalId) await assertOwnedId("nastardamus_personal_goals", "goal_id", goalId, telegramId);
      const payload = { item_id: itemId, telegram_id: telegramId, kind, goal_id: goalId || null, title: cleanPersonalText(item.title, 100, true), status: PERSONAL_STATUSES.has(item.status) ? item.status : "active", metadata: cleanJsonObject(item.metadata), updated_at: new Date().toISOString() };
      const response = await rest("nastardamus_path_items?on_conflict=item_id", { method: "POST", headers: { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify(payload) });
      return json(200, { ok: true, item: pathItemView((await response.json())?.[0] || payload) });
    }

    if (action === "upsert_path_consultation") {
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) return json(400, { error: "invalid_telegram_id" });
      const item = body?.consultation || {}; const consultationId = String(item.id || "");
      if (!/^[A-Za-z0-9._:-]{8,160}$/.test(consultationId)) return json(400, { error: "invalid_consultation_id" });
      await assertOwnedId("nastardamus_path_consultations", "consultation_id", consultationId, telegramId);
      const payload = { consultation_id: consultationId, telegram_id: telegramId, title: cleanPersonalText(item.title, 300, true), answers: cleanJsonObject(item.answers), context: cleanJsonObject(item.input), result_text: cleanPersonalText(item.body, 12_000), linked_reading_id: cleanPersonalText(item.linkedReadingId, 180), updated_at: new Date().toISOString() };
      const response = await rest("nastardamus_path_consultations?on_conflict=consultation_id", { method: "POST", headers: { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify(payload) });
      return json(200, { ok: true, consultation: pathConsultationView((await response.json())?.[0] || payload) });
    }

    if (action === "save_rune_preferences") {
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) return json(400, { error: "invalid_telegram_id" });
      const favorites = Array.isArray(body?.favorites) ? body.favorites.map((item: unknown) => cleanPersonalText(item, 80)).filter(Boolean).slice(0, 24) : [];
      await rest("nastardamus_rune_preferences?on_conflict=telegram_id", { method: "POST", headers: { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ telegram_id: telegramId, favorites, preferred_spread: cleanPersonalText(body?.preferredSpread || "three", 40), reversed_enabled: body?.reversedEnabled !== false, updated_at: new Date().toISOString() }) });
      return json(200, { ok: true });
    }

    if (action === "upsert_amur_profile" || action === "set_amur_discovery") {
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) return json(400, { error: "invalid_telegram_id" });
      const profile = body?.profile || {};
      const answers = cleanJsonObject(profile.answers); const interests = Array.isArray(profile.interests) ? profile.interests.map((item: unknown) => cleanPersonalText(item, 60)).filter(Boolean).slice(0, 12) : [];
      const goals = Array.isArray(profile.goals) ? profile.goals.map((item: unknown) => cleanPersonalText(item, 60)).filter(Boolean).slice(0, 8) : [];
      const completeness = Math.max(0, Math.min(100, Number(profile.completeness) || 0)); const discoverable = action === "set_amur_discovery" ? body?.enabled === true : false;
      const adultConfirmed = body?.adultConfirmed === true;
      if (discoverable && (completeness !== 100 || !adultConfirmed)) return json(400, { error: "amur_profile_not_ready" });
      const payload = { telegram_id: telegramId, answers, interests, goals, zodiac: cleanPersonalText(profile.zodiac, 30), intent: cleanPersonalText(profile.intent || "dialogue", 30), completeness, discoverable, adult_confirmed: adultConfirmed, updated_at: new Date().toISOString() };
      await rest("nastardamus_amur_profiles?on_conflict=telegram_id", { method: "POST", headers: { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(payload) });
      if (!discoverable) return json(200, { ok: true, candidates: [] });
      const response = await rest(`nastardamus_amur_profiles?telegram_id=neq.${telegramId}&discoverable=eq.true&adult_confirmed=eq.true&blocked_at=is.null&select=telegram_id,answers,interests,goals,intent&limit=40`);
      const rows = await response.json();
      const ownAnswers = answers as Record<string, unknown>;
      const candidates = await Promise.all(rows.map(async (row: Record<string, unknown>) => {
        const theirAnswers = cleanJsonObject(row.answers) as Record<string, unknown>;
        const keys = ["intent", "pace", "energy", "conflict", "affection", "horizon", "boundary"];
        const matches = keys.filter((key) => ownAnswers[key] && ownAnswers[key] === theirAnswers[key]).length;
        const sharedInterests = interests.filter((item: string) => Array.isArray(row.interests) && row.interests.includes(item));
        const sharedGoals = goals.filter((item: string) => Array.isArray(row.goals) && row.goals.includes(item));
        const score = Math.min(96, Math.max(32, Math.round(40 + matches * 6 + sharedInterests.length * 5 + sharedGoals.length * 4)));
        return { ref: (await sha256Hex(`amur:${row.telegram_id}`)).slice(0, 20), score, sharedInterests, sharedGoals, intent: row.intent || "dialogue" };
      }));
      return json(200, { ok: true, candidates: candidates.sort((left, right) => right.score - left.score).slice(0, 12) });
    }

    if (action === "save_personal_checkin") {
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) return json(400, { error: "invalid_telegram_id" });
      const checkin = body?.checkin || {}; const date = String(checkin.date || "");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json(400, { error: "invalid_date" });
      const morningTasks = Array.isArray(checkin.morningTasks) ? checkin.morningTasks.map(String).slice(0, 5) : [];
      await rest("nastardamus_daily_checkins?on_conflict=telegram_id,checkin_date", { method: "POST", headers: { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ telegram_id: telegramId, checkin_date: date, morning_tasks: morningTasks, morning_note: cleanPersonalText(checkin.morningNote, 1000), evening_reflection: checkin.eveningReflection && typeof checkin.eveningReflection === "object" ? checkin.eveningReflection : null, updated_at: new Date().toISOString() }) });
      return json(200, { ok: true });
    }

    if (action === "save_space_preferences") {
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) return json(400, { error: "invalid_telegram_id" });
      const settings = body?.settings || {}; const memoryEnabled = settings.memoryEnabled !== false;
      await Promise.all([
        rest("nastardamus_space_preferences?on_conflict=telegram_id", { method: "POST", headers: { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ telegram_id: telegramId, memory_enabled: memoryEnabled, morning_enabled: settings.morningEnabled !== false, evening_enabled: settings.eveningEnabled !== false, updated_at: new Date().toISOString() }) }),
        ensureUserContext(telegramId).then(() => rest(`nastardamus_user_context?telegram_id=eq.${telegramId}`, { method: "PATCH", headers: { "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ memory_enabled: memoryEnabled, updated_at: new Date().toISOString() }) }))
      ]);
      return json(200, { ok: true });
    }

    if (action === "delete_personal_item") {
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) {
        return json(400, { error: "invalid_telegram_id" });
      }
      const itemType = String(body?.itemType || "");
      const itemId = String(body?.itemId || "");
      const targets: Record<string, { table: string; column: string }> = {
        event: { table: "nastardamus_personal_events", column: "event_id" },
        goal: { table: "nastardamus_personal_goals", column: "goal_id" },
        task: { table: "nastardamus_personal_tasks", column: "task_id" }
      };
      const target = targets[itemType];
      if (!target || !UUID_PATTERN.test(itemId)) return json(400, { error: "invalid_personal_item" });
      const owned = await rest(`${target.table}?${target.column}=eq.${encodeURIComponent(itemId)}&telegram_id=eq.${telegramId}&select=${target.column}&limit=1`);
      if (!(await owned.json())?.[0]) return json(404, { error: "personal_item_not_found" });
      await rest(`${target.table}?${target.column}=eq.${encodeURIComponent(itemId)}&telegram_id=eq.${telegramId}`, {
        method: "DELETE",
        headers: { Prefer: "return=minimal" }
      });
      return json(200, { ok: true });
    }

    if (action === "clear_personal_space") {
      if (!Number.isSafeInteger(telegramId) || telegramId <= 0) return json(400, { error: "invalid_telegram_id" });
      await Promise.all([
        rest(`nastardamus_personal_events?telegram_id=eq.${telegramId}`, { method: "DELETE", headers: { Prefer: "return=minimal" } }),
        rest(`nastardamus_personal_tasks?telegram_id=eq.${telegramId}`, { method: "DELETE", headers: { Prefer: "return=minimal" } }),
        rest(`nastardamus_daily_checkins?telegram_id=eq.${telegramId}`, { method: "DELETE", headers: { Prefer: "return=minimal" } }),
        rest(`nastardamus_path_items?telegram_id=eq.${telegramId}`, { method: "DELETE", headers: { Prefer: "return=minimal" } }),
        rest(`nastardamus_path_consultations?telegram_id=eq.${telegramId}`, { method: "DELETE", headers: { Prefer: "return=minimal" } })
      ]);
      await rest(`nastardamus_personal_goals?telegram_id=eq.${telegramId}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
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

    if (action === "claim_telegram_update" || action === "release_telegram_update") {
      const updateId = Number(body?.updateId);
      const botScope = String(body?.botScope || "app");
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
    if (message.includes("invalid_invitation_token")) return json(400, { error: "invalid_invitation_token" });
    if (message.includes("photo_consent_required")) return json(400, { error: "photo_consent_required" });
    if (message.includes("adult_confirmation_required")) return json(400, { error: "adult_confirmation_required" });
    if (message.includes("invalid_invitee_name")) return json(400, { error: "invalid_invitee_name" });
    if (message.includes("invalid_invitation_image")) return json(400, { error: "invalid_invitation_image" });
    if (message.includes("invalid_invitation_flow")) return json(400, { error: "invalid_invitation_flow" });
    if (message.includes("invalid_invitation_goal")) return json(400, { error: "invalid_invitation_goal" });
    if (message.includes("invalid_gender")) return json(400, { error: "invalid_gender" });
    if (message.includes("invitation_not_found")) return json(404, { error: "invitation_not_found" });
    if (message.includes("invitation_expired")) return json(410, { error: "invitation_expired" });
    if (message.includes("invitation_unavailable")) return json(409, { error: "invitation_unavailable" });
    if (message.includes("invitation_not_ready")) return json(409, { error: "invitation_not_ready" });
    if (message.includes("invitation_busy")) return json(409, { error: "invitation_busy" });
    if (message.includes("invitation_already_completed")) return json(409, { error: "invitation_already_completed" });
    if (message.includes("invitation_payer_mismatch") || message.includes("initiator_payment_not_requested")) {
      return json(403, { error: "invitation_payment_denied" });
    }
    if (message.includes("invitation_processing_not_found")) {
      return json(409, { error: "invitation_processing_not_found" });
    }
    if (message.includes("invitation_image_unavailable") || message.includes("invitation_image_upload_")) {
      return json(503, { error: "invitation_image_unavailable" });
    }
    if (message.includes("invalid_personal_") || message.includes("invalid_event_") || message.includes("invalid_goal") || message.includes("invalid_task")) {
      return json(400, { error: "invalid_personal_data" });
    }
    if (message.includes("personal_item_forbidden")) return json(403, { error: "personal_item_forbidden" });
    if (message.includes("invalid_oracle_room_token")) return json(400, { error: "invalid_oracle_room_token" });
    if (message.includes("invalid_oracle_room_mode")) return json(400, { error: "invalid_oracle_room_mode" });
    if (message.includes("invalid_oracle_username")) return json(400, { error: "invalid_oracle_username" });
    if (message.includes("invalid_oracle_room_title") || message.includes("invalid_oracle_room_text")) {
      return json(400, { error: "invalid_oracle_room_text" });
    }
    if (message.includes("invalid_oracle_room_message")) return json(400, { error: "invalid_oracle_room_message" });
    if (message.includes("oracle_room_consent_required")) return json(400, { error: "oracle_room_consent_required" });
    if (message.includes("oracle_username_unavailable")) return json(404, { error: "oracle_username_unavailable" });
    if (message.includes("oracle_room_not_found")) return json(404, { error: "oracle_room_not_found" });
    if (message.includes("oracle_room_invite_expired")) return json(410, { error: "oracle_room_invite_expired" });
    if (message.includes("oracle_room_closed")) return json(409, { error: "oracle_room_closed" });
    if (message.includes("oracle_room_full")) return json(409, { error: "oracle_room_full" });
    if (message.includes("oracle_room_busy")) return json(409, { error: "oracle_room_busy" });
    if (message.includes("oracle_room_private") || message.includes("oracle_room_access_denied")) {
      return json(403, { error: "oracle_room_access_denied" });
    }
    if (message.includes("oracle_room_self_invite")) return json(400, { error: "oracle_room_self_invite" });
    if (message.includes("oracle_room_owner_must_close")) return json(409, { error: "oracle_room_owner_must_close" });
    if (message.includes("oracle_room_turn_changed")) return json(409, { error: "oracle_room_turn_changed" });
    if (message.includes("oracle_palm_upload_")) return json(503, { error: "oracle_palm_unavailable" });
    return json(502, { error: "wallet_store_failed" });
  }
});
