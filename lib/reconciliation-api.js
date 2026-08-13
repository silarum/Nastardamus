import { runAgent } from '../lib/ai-runtime.js';
import {
  RECONCILIATION_CONFLICT_TYPES,
  RECONCILIATION_GOALS,
  RECONCILIATION_REASONS,
  RECONCILIATION_TOOLS,
  buildReconciliationAgentRequest,
  buildReconciliationToolPrompt,
  nextReconciliationStage
} from '../lib/reconciliation.js';
import { analyzeVisionImages } from '../lib/vision.js';
import { getRequestHeader, validateTelegramInitData } from '../lib/telegram.js';
import { enforceRateLimit, setRateLimitHeaders, unauthenticatedPreviewAllowed } from '../lib/request-security.js';

const USER_STORE_URL = process.env.USER_STORE_URL
  || 'https://hngfpdsnjgdpazmortix.supabase.co/functions/v1/nastardamus-user-store';

const DEFAULT_RECONCILIATION_SETTINGS = Object.freeze({
  enabled: true,
  invitationHours: 72,
  maxParticipants: 10,
  prices: {
    create: 10,
    participate: 5,
    group: 30,
    runes: 10,
    tarot: 10,
    palmistry: 15,
    astrology: 15,
    combined: 25,
    outcomeCard: 5
  },
  tools: { runes: true, tarot: true, palmistry: true, astrology: true, combined: true },
  conflictTypes: Object.keys(RECONCILIATION_CONFLICT_TYPES),
  invitationText: '{initiator} приглашает вас в комнату примирения. Эзотериум поможет услышать друг друга.',
  outcomeText: 'Мы завершили важный разговор вместе с Эзотериумом.'
});

export const config = {
  maxDuration: 60,
  api: { bodyParser: { sizeLimit: '12mb' } }
};

function sendJson(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.status(status).json(body);
}

function cleanText(value, maxLength = 1000) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function cleanToken(value) {
  const token = String(value || '').trim().toLowerCase();
  return /^[a-f0-9]{32}$/.test(token) ? token : '';
}

function cleanNonce(value) {
  const nonce = String(value || '').trim();
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/.test(nonce) ? nonce : '';
}

function cleanNames(value, mode) {
  const limit = mode === 'pair' ? 2 : 10;
  const names = (Array.isArray(value) ? value : String(value || '').split(','))
    .map((name) => cleanText(name, 80))
    .filter(Boolean)
    .slice(0, limit);
  const expected = mode === 'pair' ? names.length === 2 : names.length >= 3 && names.length <= 10;
  if (!expected || new Set(names.map((name) => name.toLocaleLowerCase('ru-RU'))).size !== names.length) {
    throw new Error('invalid_reconciliation_participants');
  }
  return names;
}

function supabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('reconciliation_store_not_configured');
  return { url: url.replace(/\/$/, ''), key };
}

async function database(path, options = {}) {
  const config = supabaseConfig();
  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      ...(options.headers || {})
    },
    signal: AbortSignal.timeout(12_000)
  });
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const code = cleanText(data?.message || data?.details || `reconciliation_store_${response.status}`, 180);
    const error = new Error(code);
    error.status = response.status;
    throw error;
  }
  return data;
}

async function userStore(botToken, action, payload = {}) {
  const response = await fetch(USER_STORE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-App-Bot-Token': botToken },
    body: JSON.stringify({ ...payload, action }),
    signal: AbortSignal.timeout(12_000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) {
    const error = new Error(data.error || `reconciliation_user_store_${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

async function readGlobalSettings() {
  const rows = await database('nastardamus_settings?key=eq.global&select=settings&limit=1');
  return rows?.[0]?.settings || {};
}

export function reconciliationSettings(settings) {
  const source = settings?.reconciliation && typeof settings.reconciliation === 'object'
    ? settings.reconciliation
    : {};
  return {
    ...DEFAULT_RECONCILIATION_SETTINGS,
    ...source,
    prices: { ...DEFAULT_RECONCILIATION_SETTINGS.prices, ...(source.prices || {}) },
    tools: { ...DEFAULT_RECONCILIATION_SETTINGS.tools, ...(source.tools || {}) },
    conflictTypes: Array.isArray(source.conflictTypes) && source.conflictTypes.length
      ? source.conflictTypes.filter((type) => RECONCILIATION_CONFLICT_TYPES[type])
      : DEFAULT_RECONCILIATION_SETTINGS.conflictTypes
  };
}

async function charge(botToken, telegramId, { serviceId, title, price, nonce, free }) {
  if (free || Number(price) <= 0) return null;
  const priceUnits = Math.max(1, Math.round(Number(price) * 100));
  let result;
  try {
    result = await userStore(botToken, 'charge_service', {
      telegramId,
      serviceId,
      serviceTitle: title,
      priceUnits,
      idempotencyKey: nonce
    });
  } catch (error) {
    if (error?.message === 'insufficient_funds') {
      const wallet = await userStore(botToken, 'get_wallet', { telegramId }).catch(() => null);
      const availableUnits = Number(wallet?.wallet?.balance_units || 0) - Number(wallet?.wallet?.locked_units || 0);
      error.payment = {
        serviceId,
        serviceTitle: title,
        price: priceUnits / 100,
        available: availableUnits / 100,
        shortage: Math.max(0, priceUnits - availableUnits) / 100,
        sbpTopupsEnabled: wallet?.config?.sbpTopupsEnabled === true
      };
    }
    throw error;
  }
  if (!result.charge?.charge_id || result.charge.status === 'refunded') throw new Error('payment_retry_required');
  return result.charge;
}

async function completeCharge(botToken, telegramId, value) {
  if (!value?.charge_id || value.status === 'fulfilled') return;
  await userStore(botToken, 'complete_service_charge', { telegramId, chargeId: value.charge_id });
}

async function refundCharge(botToken, telegramId, value, reason) {
  if (!value?.charge_id || value.status === 'fulfilled' || value.status === 'refunded') return;
  await userStore(botToken, 'refund_service_charge', {
    telegramId,
    chargeId: value.charge_id,
    reason: cleanText(reason || 'reconciliation_failed', 180)
  }).catch(() => null);
}

function policyPriceUnits(value) {
  return Math.max(0, Math.round((Number(value) || 0) * 100));
}

export function creationChargeUnits(mode, payerMode, participantCount, prices) {
  if (mode === 'pair') {
    const creation = policyPriceUnits(prices.create);
    const participation = policyPriceUnits(prices.participate);
    if (payerMode === 'initiator') return creation + participation;
    if (payerMode === 'each') return creation;
    return 0;
  }
  const total = policyPriceUnits(prices.group);
  if (payerMode === 'initiator') return total;
  if (payerMode === 'each' || payerMode === 'group') {
    const invitedShare = Math.floor(total / participantCount);
    return total - invitedShare * (participantCount - 1);
  }
  return 0;
}

export function joiningChargeUnits(value, activeParticipantCount, prices) {
  if (value.participant_mode === 'pair') {
    if (value.payer_mode === 'second' && activeParticipantCount === 1) {
      return policyPriceUnits(prices.create) + policyPriceUnits(prices.participate);
    }
    return value.payer_mode === 'each' ? policyPriceUnits(prices.participate) : 0;
  }
  if (value.payer_mode === 'second' && activeParticipantCount === 1) return policyPriceUnits(prices.group);
  if (value.payer_mode === 'each' || value.payer_mode === 'group') {
    return Math.floor(policyPriceUnits(prices.group) / Number(value.max_participants));
  }
  return 0;
}

async function rawCase(token) {
  const rows = await database(`nastardamus_reconciliation_cases?token=eq.${encodeURIComponent(token)}&select=*&limit=1`);
  return rows?.[0] || null;
}

async function rawMembers(caseId) {
  return await database(`nastardamus_reconciliation_members?case_id=eq.${caseId}&select=*&order=created_at.asc`) || [];
}

async function rawMessages(caseId) {
  return await database(`nastardamus_reconciliation_messages?case_id=eq.${caseId}&select=*&order=sequence_no.asc&limit=300`) || [];
}

async function rawTools(caseId) {
  return await database(`nastardamus_reconciliation_tools?case_id=eq.${caseId}&select=*&order=created_at.asc`) || [];
}

function memberView(member, viewerId) {
  const own = Number(member.telegram_id) === Number(viewerId);
  return {
    own,
    role: member.role,
    status: member.status,
    displayName: member.display_name,
    conflictRole: member.conflict_role || '',
    ready: Boolean(member.private_answered_at),
    sharePrivateConsent: own ? member.share_private_consent === true : undefined,
    privateAnswers: own ? member.private_answers || {} : undefined,
    birthDate: own ? member.birth_date || '' : undefined,
    birthTime: own ? String(member.birth_time || '').slice(0, 5) : undefined,
    birthPlace: own ? member.birth_place || '' : undefined,
    resolutionVote: own ? member.resolution_vote || '' : undefined,
    joinedAt: member.joined_at
  };
}

function messageView(message, viewerId) {
  if (message.visibility === 'private' && Number(message.recipient_telegram_id) !== Number(viewerId)) return null;
  return {
    id: message.id,
    turnId: message.turn_id,
    own: Number(message.sender_telegram_id) === Number(viewerId),
    role: message.role,
    senderName: message.sender_name,
    visibility: message.visibility,
    content: message.content,
    metadata: message.metadata || {},
    createdAt: message.created_at
  };
}

function previewView(value, owner, decisionStatus = '') {
  return {
    token: value.token,
    preview: true,
    decisionStatus,
    title: caseTitle(value),
    initiatorName: owner?.display_name || 'Участник',
    conflictType: value.conflict_type,
    participantMode: value.participant_mode,
    participantNames: value.participant_names,
    goal: value.goal,
    invitationTone: value.invitation_tone,
    status: value.status,
    expiresAt: value.invitation_expires_at
  };
}

async function internalCaseView(token) {
  const value = await rawCase(token);
  if (!value) return null;
  const [members, messages] = await Promise.all([rawMembers(value.id), rawMessages(value.id)]);
  return {
    id: value.id,
    token: value.token,
    title: caseTitle(value),
    conflictType: value.conflict_type,
    reason: value.reason,
    goal: value.goal,
    status: value.status,
    stage: value.stage,
    members: members.map((member) => ({
      telegramId: Number(member.telegram_id),
      role: member.role,
      status: member.status,
      displayName: member.display_name,
      privateAnswers: member.private_answers || {},
      sharePrivateConsent: member.share_private_consent === true
    })),
    messages: messages.map((message) => ({
      role: message.role,
      senderName: message.sender_name,
      visibility: message.visibility,
      recipientTelegramId: message.recipient_telegram_id,
      content: message.content
    }))
  };
}

function caseTitle(value) {
  const names = Array.isArray(value.participant_names) ? value.participant_names : [];
  return value.participant_mode === 'group'
    ? `Примирение в группе «${names.slice(0, 3).join(', ')}${names.length > 3 ? '…' : ''}»`
    : `Примирение: ${names.slice(0, 2).join(' и ')}`;
}

async function caseView(token, viewerId, { allowPreview = true } = {}) {
  const value = await rawCase(token);
  if (!value) return null;
  const members = await rawMembers(value.id);
  const viewer = members.find((member) => Number(member.telegram_id) === Number(viewerId));
  const owner = members.find((member) => member.role === 'owner');
  if (!viewer && allowPreview) return previewView(value, owner);
  if (!viewer) throw new Error('reconciliation_access_denied');
  if (viewer.status !== 'active') return previewView(value, owner, viewer.status);
  const [messages, tools] = await Promise.all([rawMessages(value.id), rawTools(value.id)]);
  const activeParticipantIds = members
    .filter((member) => member.status === 'active' && member.role !== 'observer')
    .map((member) => String(member.telegram_id));
  return {
    id: value.id,
    token: value.token,
    preview: false,
    title: caseTitle(value),
    initiatorName: owner?.display_name || 'Участник',
    conflictType: value.conflict_type,
    participantMode: value.participant_mode,
    participantNames: value.participant_names,
    reason: value.reason,
    situation: Number(value.owner_telegram_id) === Number(viewerId) ? value.situation : '',
    goal: value.goal,
    payerMode: value.payer_mode,
    invitationTone: value.invitation_tone,
    status: value.status,
    stage: value.stage,
    maxParticipants: Number(value.max_participants),
    outcomeKind: value.outcome_kind || '',
    outcomeText: value.outcome_text || '',
    expiresAt: value.invitation_expires_at,
    createdAt: value.created_at,
    updatedAt: value.updated_at,
    viewer: memberView(viewer, viewerId),
    members: members.map((member) => memberView(member, viewerId)),
    messages: messages.map((message) => messageView(message, viewerId)).filter(Boolean),
    tools: tools.map((tool) => ({
      id: tool.id,
      type: tool.tool_type,
      status: tool.status,
      consentCount: activeParticipantIds.filter((id) => tool.consents?.[id] === true).length,
      consentRequired: activeParticipantIds.length,
      ownConsent: tool.consents?.[String(viewerId)] === true,
      resultText: tool.result_text || '',
      createdAt: tool.created_at
    }))
  };
}

function invitationUrl(token) {
  const username = String(process.env.BOT_USERNAME || 'BelonTip_bot').replace(/^@/, '');
  return `https://t.me/${username}?start=reconcile_${token}`;
}

async function createReconciliation({ req, botToken, telegramId, user }) {
  const settings = await readGlobalSettings();
  const policy = reconciliationSettings(settings);
  if (policy.enabled === false) throw new Error('reconciliation_disabled');
  const mode = req.body?.participantMode === 'group' ? 'group' : 'pair';
  const names = cleanNames(req.body?.participantNames, mode);
  const conflictType = String(req.body?.conflictType || 'other');
  const reason = String(req.body?.reason || 'other');
  const goal = String(req.body?.goal || 'understanding');
  const payerMode = String(req.body?.payerMode || 'initiator');
  const tone = String(req.body?.invitationTone || 'warm');
  const nonce = cleanNonce(req.body?.idempotencyKey);
  if (!nonce) throw new Error('invalid_idempotency_key');
  if (!policy.conflictTypes.includes(conflictType) || !RECONCILIATION_REASONS[reason] || !RECONCILIATION_GOALS[goal]) {
    throw new Error('invalid_reconciliation_fields');
  }
  if (mode === 'group' && names.length > Math.max(3, Math.min(10, Number(policy.maxParticipants) || 10))) {
    throw new Error('reconciliation_full');
  }
  if (!['initiator', 'second', 'each', 'group'].includes(payerMode)
    || (mode === 'pair' && payerMode === 'group')) throw new Error('invalid_reconciliation_fields');
  if (!['soft', 'serious', 'warm', 'energetic'].includes(tone)) throw new Error('invalid_reconciliation_fields');
  const chargeUnits = creationChargeUnits(mode, payerMode, names.length, policy.prices);
  let payment = null;
  try {
    payment = await charge(botToken, telegramId, {
      serviceId: mode === 'group' ? 'reconciliation_group' : 'reconciliation_create',
      title: mode === 'group' ? 'Групповое примирение Эзотериума' : 'Создание комнаты примирения',
      price: chargeUnits / 100,
      nonce: `reconciliation-create-${nonce}`.slice(0, 127),
      free: settings.everythingFree === true
    });
    const created = await database('rpc/nastardamus_create_reconciliation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_owner_telegram_id: telegramId,
        p_owner_name: cleanText(req.body?.initiatorName || user.first_name || user.username || 'Искатель', 80),
        p_idempotency_key: nonce,
        p_conflict_type: conflictType,
        p_participant_mode: mode,
        p_participant_names: names,
        p_reason: reason,
        p_situation: cleanText(req.body?.situation, 2000),
        p_goal: goal,
        p_payer_mode: payerMode,
        p_invitation_tone: tone,
        p_invitation_hours: Math.max(1, Math.min(720, Number(policy.invitationHours) || 72)),
        p_service_charge_id: payment?.charge_id || null
      })
    });
    await completeCharge(botToken, telegramId, payment);
    return { room: await caseView(created.token, telegramId), inviteUrl: invitationUrl(created.token), policy };
  } catch (error) {
    await refundCharge(botToken, telegramId, payment, error.message);
    throw error;
  }
}

async function joinReconciliation({ req, botToken, telegramId, user }) {
  const token = cleanToken(req.body?.token);
  const decision = String(req.body?.decision || 'accept');
  if (!token || !['accept', 'later', 'reject'].includes(decision)) throw new Error('invalid_reconciliation_decision');
  const value = await rawCase(token);
  if (!value) throw new Error('reconciliation_not_found');
  const settings = await readGlobalSettings();
  const policy = reconciliationSettings(settings);
  const observer = req.body?.observer === true;
  const nonce = cleanNonce(req.body?.idempotencyKey) || `join-${token}-${telegramId}`;
  const members = await rawMembers(value.id);
  const activeParticipantCount = members.filter((member) => member.status === 'active' && member.role !== 'observer').length;
  const chargeUnits = decision === 'accept' && !observer
    ? joiningChargeUnits(value, activeParticipantCount, policy.prices)
    : 0;
  let payment = null;
  try {
    payment = chargeUnits > 0 ? await charge(botToken, telegramId, {
      serviceId: 'reconciliation_participation',
      title: 'Участие в примирении Эзотериума',
      price: chargeUnits / 100,
      nonce: `reconciliation-join-${nonce}`.slice(0, 127),
      free: settings.everythingFree === true
    }) : null;
    await database('rpc/nastardamus_join_reconciliation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_token: token,
        p_telegram_id: telegramId,
        p_display_name: cleanText(req.body?.displayName || user.first_name || user.username || 'Участник', 80),
        p_conflict_role: cleanText(req.body?.conflictRole, 120),
        p_decision: decision,
        p_as_observer: observer
      })
    });
    if (payment?.charge_id) {
      await database(`nastardamus_reconciliation_members?case_id=eq.${value.id}&telegram_id=eq.${telegramId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paid_charge_id: payment.charge_id, updated_at: new Date().toISOString() })
      });
      await completeCharge(botToken, telegramId, payment);
    }
    return { room: await caseView(token, telegramId), inviteUrl: invitationUrl(token) };
  } catch (error) {
    await refundCharge(botToken, telegramId, payment, error.message);
    throw error;
  }
}

async function savePrivateIntake(req, telegramId) {
  const token = cleanToken(req.body?.token);
  const value = await rawCase(token);
  if (!value) throw new Error('reconciliation_not_found');
  const members = await rawMembers(value.id);
  const viewer = members.find((member) => Number(member.telegram_id) === telegramId && member.status === 'active');
  if (!viewer || viewer.role === 'observer') throw new Error('reconciliation_write_denied');
  const answers = req.body?.answers && typeof req.body.answers === 'object' && !Array.isArray(req.body.answers)
    ? Object.fromEntries(Object.entries(req.body.answers).slice(0, 8).map(([key, answer]) => [cleanText(key, 40), cleanText(answer, 800)]).filter(([, answer]) => answer))
    : {};
  if (Object.keys(answers).length < 2) throw new Error('invalid_reconciliation_private_answers');
  await database(`nastardamus_reconciliation_members?case_id=eq.${value.id}&telegram_id=eq.${telegramId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      private_answers: answers,
      private_answered_at: new Date().toISOString(),
      share_private_consent: req.body?.sharePrivateConsent === true,
      birth_date: /^\d{4}-\d{2}-\d{2}$/.test(String(req.body?.birthDate || '')) ? req.body.birthDate : null,
      birth_time: /^\d{2}:\d{2}$/.test(String(req.body?.birthTime || '')) ? req.body.birthTime : null,
      birth_place: cleanText(req.body?.birthPlace, 160),
      updated_at: new Date().toISOString()
    })
  });
  return { room: await caseView(token, telegramId) };
}

async function sendMessage({ req, botToken, telegramId }) {
  const token = cleanToken(req.body?.token);
  const message = cleanText(req.body?.message, 2000);
  const visibility = req.body?.visibility === 'private' ? 'private' : 'public';
  const nonce = cleanNonce(req.body?.clientNonce);
  if (!token || message.length < 2 || !nonce) throw new Error('invalid_reconciliation_message');
  let begun = null;
  try {
    begun = await database('rpc/nastardamus_begin_reconciliation_turn', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_token: token, p_telegram_id: telegramId, p_content: message, p_visibility: visibility, p_client_nonce: nonce })
    });
    if (begun.replayed === true && begun.answer) return { room: await caseView(token, telegramId), answer: begun.answer, replayed: true };
    if (begun.replayed === true) throw new Error('reconciliation_busy');
    const room = await internalCaseView(token);
    const request = buildReconciliationAgentRequest(room, { viewerId: telegramId, message, visibility });
    const generated = await runAgent({ botToken, slug: 'reconciliation', message: request.message, history: request.history });
    const stage = nextReconciliationStage(room.stage, `${message} ${generated.answer}`);
    await database('rpc/nastardamus_complete_reconciliation_turn', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_token: token,
        p_turn_id: begun.turn_id,
        p_answer: generated.answer,
        p_visibility: visibility,
        p_recipient_telegram_id: visibility === 'private' ? telegramId : null,
        p_stage: stage
      })
    });
    return { room: await caseView(token, telegramId), answer: generated.answer, replayed: false };
  } catch (error) {
    if (begun?.turn_id && begun.replayed !== true) {
      const value = await rawCase(token).catch(() => null);
      if (value) await database(`nastardamus_reconciliation_cases?id=eq.${value.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assistant_state: 'error', active_turn_id: null, turn_started_at: null, updated_at: new Date().toISOString() })
      }).catch(() => null);
    }
    throw error;
  }
}

async function requestTool(req, telegramId) {
  const token = cleanToken(req.body?.token);
  const type = String(req.body?.toolType || '');
  const tool = RECONCILIATION_TOOLS[type];
  if (!token || !tool) throw new Error('invalid_reconciliation_tool');
  const value = await rawCase(token);
  if (!value) throw new Error('reconciliation_not_found');
  if (!['active', 'analyzing', 'near_solution'].includes(value.status)) throw new Error('reconciliation_not_active');
  const [settings, members] = await Promise.all([readGlobalSettings(), rawMembers(value.id)]);
  const viewer = members.find((member) => Number(member.telegram_id) === telegramId && member.status === 'active');
  if (!viewer || viewer.role === 'observer') throw new Error('reconciliation_write_denied');
  const policy = reconciliationSettings(settings);
  if (policy.enabled === false || policy.tools[type] === false) throw new Error('reconciliation_tool_disabled');
  const rows = await database('nastardamus_reconciliation_tools', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({
      case_id: value.id,
      tool_type: type,
      requested_by: telegramId,
      consents: { [String(telegramId)]: true }
    })
  });
  return { room: await caseView(token, telegramId), tool: rows?.[0] };
}

async function consentTool(req, telegramId) {
  const token = cleanToken(req.body?.token);
  const toolId = String(req.body?.toolId || '');
  if (!token || !/^[0-9a-f-]{36}$/i.test(toolId)) throw new Error('invalid_reconciliation_tool');
  const value = await rawCase(token);
  if (!value) throw new Error('reconciliation_not_found');
  const [members, tools] = await Promise.all([
    rawMembers(value.id),
    database(`nastardamus_reconciliation_tools?id=eq.${toolId}&case_id=eq.${value.id}&select=*&limit=1`)
  ]);
  const viewer = members.find((member) => Number(member.telegram_id) === telegramId && member.status === 'active');
  if (!viewer || viewer.role === 'observer') throw new Error('reconciliation_write_denied');
  const tool = tools?.[0];
  if (!tool || !['proposed', 'ready'].includes(tool.status)) throw new Error('reconciliation_tool_unavailable');
  const consents = { ...(tool.consents || {}), [String(telegramId)]: req.body?.consent === true };
  const activeIds = members.filter((member) => member.status === 'active' && member.role !== 'observer').map((member) => String(member.telegram_id));
  const ready = activeIds.length >= 2 && activeIds.every((id) => consents[id] === true);
  await database(`nastardamus_reconciliation_tools?id=eq.${toolId}&case_id=eq.${value.id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ consents, status: ready ? 'ready' : 'proposed', updated_at: new Date().toISOString() })
  });
  return { room: await caseView(token, telegramId), ready };
}

async function runTool({ req, botToken, telegramId }) {
  const token = cleanToken(req.body?.token);
  const toolId = String(req.body?.toolId || '');
  const nonce = cleanNonce(req.body?.clientNonce);
  if (!token || !nonce || !/^[0-9a-f-]{36}$/i.test(toolId)) throw new Error('invalid_reconciliation_tool');
  const value = await rawCase(token);
  if (!value) throw new Error('reconciliation_not_found');
  const [settings, tools] = await Promise.all([
    readGlobalSettings(),
    database(`nastardamus_reconciliation_tools?id=eq.${toolId}&case_id=eq.${value.id}&select=*&limit=1`)
  ]);
  const toolRow = tools?.[0];
  if (!toolRow || toolRow.status !== 'ready') throw new Error('reconciliation_tool_consent_required');
  const policy = reconciliationSettings(settings);
  if (policy.tools[toolRow.tool_type] === false) throw new Error('reconciliation_tool_disabled');
  let toolInput = req.body?.input && typeof req.body.input === 'object' && !Array.isArray(req.body.input)
    ? { ...req.body.input }
    : {};
  if (toolRow.tool_type === 'palmistry') {
    const images = Array.isArray(req.body?.images) ? req.body.images.filter((image) => typeof image === 'string').slice(0, 2) : [];
    if (images.length < 2) throw new Error('reconciliation_palms_required');
    const vision = await analyzeVisionImages({ feature: 'palm_reading', images, requestId: `reconciliation-${toolId}` });
    if (vision.status === 'reject') throw new Error('photo_blocked');
    toolInput = { ...toolInput, visiblePalmAnalysis: vision, imagesProvided: images.length };
  }
  delete toolInput.images;
  let payment = null;
  let begun = null;
  try {
    const tool = RECONCILIATION_TOOLS[toolRow.tool_type];
    payment = await charge(botToken, telegramId, {
      serviceId: tool.serviceId,
      title: tool.title,
      price: Number(policy.prices[toolRow.tool_type] ?? tool.defaultPrice),
      nonce: `reconciliation-tool-${nonce}`.slice(0, 127),
      free: settings.everythingFree === true
    });
    begun = await database('rpc/nastardamus_begin_reconciliation_turn', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_token: token,
        p_telegram_id: telegramId,
        p_content: `Запускаю согласованный инструмент: ${tool.title}.`,
        p_visibility: 'public',
        p_client_nonce: `tool-${nonce}`.slice(0, 127)
      })
    });
    const room = await caseView(token, telegramId, { allowPreview: false });
    const generated = await runAgent({
      botToken,
      slug: 'reconciliation',
      message: buildReconciliationToolPrompt(room, toolRow.tool_type, toolInput),
      history: []
    });
    await database('rpc/nastardamus_complete_reconciliation_turn', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_token: token,
        p_turn_id: begun.turn_id,
        p_answer: generated.answer,
        p_visibility: 'public',
        p_recipient_telegram_id: null,
        p_stage: 'solution'
      })
    });
    await database(`nastardamus_reconciliation_tools?id=eq.${toolId}&case_id=eq.${value.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'completed', input: toolInput, result_text: generated.answer,
        service_charge_id: payment?.charge_id || null, completed_at: new Date().toISOString(), updated_at: new Date().toISOString()
      })
    });
    await completeCharge(botToken, telegramId, payment);
    return { room: await caseView(token, telegramId), answer: generated.answer };
  } catch (error) {
    await refundCharge(botToken, telegramId, payment, error.message);
    await database(`nastardamus_reconciliation_tools?id=eq.${toolId}&case_id=eq.${value.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'failed', updated_at: new Date().toISOString() })
    }).catch(() => null);
    if (begun?.turn_id) await database(`nastardamus_reconciliation_cases?id=eq.${value.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assistant_state: 'error', active_turn_id: null, turn_started_at: null, updated_at: new Date().toISOString() })
    }).catch(() => null);
    throw error;
  }
}

async function voteResolution({ req, botToken, telegramId }) {
  const token = cleanToken(req.body?.token);
  const vote = String(req.body?.vote || '');
  if (!token || !['reconciled', 'boundaries', 'respectful_closure'].includes(vote)) throw new Error('invalid_reconciliation_vote');
  const value = await rawCase(token);
  if (!value) throw new Error('reconciliation_not_found');
  const members = await rawMembers(value.id);
  const viewer = members.find((member) => Number(member.telegram_id) === telegramId && member.status === 'active');
  if (!viewer || viewer.role === 'observer') throw new Error('reconciliation_write_denied');
  await database(`nastardamus_reconciliation_members?case_id=eq.${value.id}&telegram_id=eq.${telegramId}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resolution_vote: vote, updated_at: new Date().toISOString() })
  });
  const refreshed = await rawMembers(value.id);
  const participants = refreshed.filter((member) => member.status === 'active' && member.role !== 'observer');
  const agreed = participants.length >= 2 && participants.every((member) => member.resolution_vote === vote);
  if (!agreed) return { room: await caseView(token, telegramId), resolved: false };

  const room = await caseView(token, telegramId, { allowPreview: false });
  const outcomeLabel = {
    reconciled: 'примирение', boundaries: 'договорённость о границах', respectful_closure: 'уважительное завершение'
  }[vote];
  const generated = await runAgent({
    botToken,
    slug: 'reconciliation',
    message: `Все активные участники добровольно выбрали итог «${outcomeLabel}». Составь нейтральный итог из 3–5 предложений: что удалось услышать, какая договорённость зафиксирована и какой один шаг сделать дальше. Не раскрывай закрытые ответы. Контекст общей комнаты: ${JSON.stringify(room.messages.filter((message) => message.visibility === 'public').slice(-20)).slice(0, 10000)}`,
    history: []
  });
  const now = new Date().toISOString();
  await database('rpc/nastardamus_finalize_reconciliation', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_token: token, p_outcome_kind: vote, p_outcome_text: generated.answer })
  });
  await Promise.allSettled(participants.map((member) => database('nastardamus_path_consultations?on_conflict=consultation_id', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      consultation_id: `reconciliation-${value.id}-${member.telegram_id}`,
      telegram_id: Number(member.telegram_id),
      title: room.title,
      answers: { outcome: vote },
      context: { reconciliationToken: token, conflictType: value.conflict_type, goal: value.goal },
      result_text: generated.answer,
      updated_at: now
    })
  })));
  return { room: await caseView(token, telegramId), resolved: true };
}

async function changePause(req, telegramId) {
  const token = cleanToken(req.body?.token);
  const paused = req.body?.paused === true;
  const value = await rawCase(token);
  if (!value) throw new Error('reconciliation_not_found');
  const members = await rawMembers(value.id);
  const viewer = members.find((member) => Number(member.telegram_id) === telegramId && member.status === 'active');
  if (!viewer || (!paused && viewer.role !== 'owner')) throw new Error('reconciliation_write_denied');
  await database(`nastardamus_reconciliation_cases?id=eq.${value.id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: paused ? 'paused' : 'active', updated_at: new Date().toISOString() })
  });
  return { room: await caseView(token, telegramId) };
}

async function listCases(telegramId) {
  const memberships = await database(`nastardamus_reconciliation_members?telegram_id=eq.${telegramId}&select=case_id,role,status&order=updated_at.desc&limit=60`) || [];
  if (!memberships.length) return [];
  const ids = memberships.map((item) => item.case_id).filter(Boolean);
  const rows = await database(`nastardamus_reconciliation_cases?id=in.(${ids.join(',')})&select=id,token,participant_mode,participant_names,status,stage,outcome_kind,invitation_expires_at,updated_at&order=updated_at.desc`);
  const membershipMap = new Map(memberships.map((item) => [item.case_id, item]));
  return (rows || []).map((item) => ({
    token: item.token,
    title: caseTitle(item),
    participantMode: item.participant_mode,
    status: item.status,
    stage: item.stage,
    outcomeKind: item.outcome_kind || '',
    viewerRole: membershipMap.get(item.id)?.role,
    viewerStatus: membershipMap.get(item.id)?.status,
    expiresAt: item.invitation_expires_at,
    updatedAt: item.updated_at
  }));
}

async function createOutcomeCard({ req, botToken, telegramId }) {
  const token = cleanToken(req.body?.token);
  const nonce = cleanNonce(req.body?.idempotencyKey);
  const room = await caseView(token, telegramId, { allowPreview: false });
  if (!room || room.status !== 'resolved' || !nonce) throw new Error('reconciliation_not_resolved');
  const settings = await readGlobalSettings();
  const policy = reconciliationSettings(settings);
  const payment = await charge(botToken, telegramId, {
    serviceId: 'reconciliation_outcome_card',
    title: 'Открытка о примирении',
    price: Number(policy.prices.outcomeCard),
    nonce: `reconciliation-card-${nonce}`.slice(0, 127),
    free: settings.everythingFree === true
  });
  await completeCharge(botToken, telegramId, payment);
  return {
    room,
    card: {
      title: room.outcomeKind === 'reconciled' ? 'Мы пришли к примирению' : 'Мы завершили важный разговор',
      text: cleanText(policy.outcomeText, 240),
      names: room.participantNames,
      token: room.token
    }
  };
}

function errorStatus(error) {
  const code = String(error?.message || 'reconciliation_unavailable');
  if (code === 'insufficient_funds') return 402;
  if (code.includes('not_found')) return 404;
  if (code.includes('access_denied') || code.includes('write_denied') || code.includes('disabled')) return 403;
  if (code.includes('expired')) return 410;
  if (code.includes('busy') || code.includes('not_active') || code.includes('unavailable') || code.includes('consent_required') || code.includes('not_resolved')) return 409;
  if (code.startsWith('invalid_') || code.includes('required') || code.includes('full')) return 400;
  return Number(error?.status) >= 400 && Number(error?.status) < 500 ? Number(error.status) : 502;
}

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST');
    return sendJson(res, 405, { error: 'method_not_allowed' });
  }
  const botToken = process.env.BOT_TOKEN;
  if (!botToken) return sendJson(res, 503, { error: 'service_not_configured' });
  const initData = getRequestHeader(req, 'x-telegram-init-data') || '';
  const auth = validateTelegramInitData(initData, botToken);
  if (!auth.ok && !unauthenticatedPreviewAllowed()) return sendJson(res, 401, { error: 'telegram_auth_required' });
  const telegramId = auth.ok ? Number(auth.user.id) : 1;
  const user = auth.ok ? auth.user : { first_name: 'Искатель' };
  try {
    const action = req.method === 'GET' ? String(req.query?.action || 'list') : String(req.body?.action || '');
    const rateLimit = await enforceRateLimit(req, {
      botToken,
      telegramId,
      scope: `reconciliation:${action}`,
      limit: action === 'send' ? 80 : action === 'get' ? 1200 : 40,
      windowSeconds: 60 * 60,
      persistent: auth.ok
    });
    setRateLimitHeaders(res, rateLimit);
    if (!rateLimit.allowed) return sendJson(res, 429, { error: 'rate_limited' });

    if (req.method === 'GET') {
      if (action === 'policy') {
        const settings = await readGlobalSettings();
        return sendJson(res, 200, { ok: true, policy: reconciliationSettings(settings), everythingFree: settings.everythingFree === true });
      }
      if (action === 'get') {
        const token = cleanToken(req.query?.token);
        if (!token) return sendJson(res, 400, { error: 'invalid_reconciliation_token' });
        const room = await caseView(token, telegramId);
        if (!room) return sendJson(res, 404, { error: 'reconciliation_not_found' });
        return sendJson(res, 200, { ok: true, room, inviteUrl: invitationUrl(token) });
      }
      return sendJson(res, 200, { ok: true, rooms: await listCases(telegramId) });
    }

    let result;
    if (action === 'create') result = await createReconciliation({ req, botToken, telegramId, user });
    else if (action === 'join') result = await joinReconciliation({ req, botToken, telegramId, user });
    else if (action === 'private_intake') result = await savePrivateIntake(req, telegramId);
    else if (action === 'send') result = await sendMessage({ req, botToken, telegramId });
    else if (action === 'request_tool') result = await requestTool(req, telegramId);
    else if (action === 'consent_tool') result = await consentTool(req, telegramId);
    else if (action === 'run_tool') result = await runTool({ req, botToken, telegramId });
    else if (action === 'vote_resolution') result = await voteResolution({ req, botToken, telegramId });
    else if (action === 'pause') result = await changePause(req, telegramId);
    else if (action === 'outcome_card') result = await createOutcomeCard({ req, botToken, telegramId });
    else return sendJson(res, 400, { error: 'invalid_reconciliation_action' });
    return sendJson(res, 200, { ok: true, ...result });
  } catch (error) {
    const status = errorStatus(error);
    if (status >= 500) console.error('Reconciliation API failed:', error?.message || error);
    return sendJson(res, status, {
      error: status >= 500 ? 'reconciliation_unavailable' : String(error?.message || 'reconciliation_unavailable'),
      ...(error?.payment ? { payment: error.payment } : {})
    });
  }
}
