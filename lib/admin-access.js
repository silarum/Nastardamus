export const ADMIN_PANEL_ROLES = Object.freeze(['owner', 'admin', 'operator']);

const ADMIN_PANEL_ROLE_SET = new Set(ADMIN_PANEL_ROLES);
const DEFAULT_ADMIN_STORE_URL =
  'https://hngfpdsnjgdpazmortix.supabase.co/functions/v1/nastardamus-admin-store';

export function parseOwnerIds(value = process.env.ADMIN_TELEGRAM_IDS) {
  return new Set(
    String(value || '')
      .split(/[\s,;]+/)
      .map(Number)
      .filter((id) => Number.isSafeInteger(id) && id > 0)
  );
}

export function hasAdminPanelAccess(profile) {
  return Boolean(
    profile?.is_active === true
    && ADMIN_PANEL_ROLE_SET.has(String(profile.role || ''))
  );
}

export async function readAdminProfile({
  userId,
  botToken,
  telegramUser,
  adminStoreUrl = process.env.ADMIN_STORE_URL || DEFAULT_ADMIN_STORE_URL
}) {
  const telegramId = Number(userId);
  if (!Number.isSafeInteger(telegramId) || telegramId <= 0) return null;

  if (parseOwnerIds().has(telegramId)) {
    return {
      telegram_id: telegramId,
      role: 'owner',
      display_name: telegramUser?.first_name || null,
      username: telegramUser?.username || null,
      permissions: { '*': true },
      is_active: true
    };
  }

  if (typeof botToken !== 'string' || botToken.length < 20) return null;
  const response = await fetch(adminStoreUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Bot-Token': botToken
    },
    body: JSON.stringify({
      action: 'get_admin_profile',
      telegramId
    }),
    signal: AbortSignal.timeout(10_000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok !== true) return null;
  return data.profile || null;
}
