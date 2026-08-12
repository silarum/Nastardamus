function normalizeChannelUsername(value) {
  const username = String(value || '').trim().replace(/^https?:\/\/(?:t\.me|telegram\.me)\//i, '').replace(/^@/, '').split(/[/?#]/)[0];
  return /^[A-Za-z0-9_]{5,32}$/.test(username) ? username : '';
}

export function channelAccessPolicy(settings = {}) {
  const username = normalizeChannelUsername(settings.subscriptionChannelUsername);
  const enabled = settings.subscriptionGateEnabled === true && Boolean(username);
  return {
    configured: enabled,
    username: username ? `@${username}` : '',
    url: username ? `https://t.me/${username}` : '',
    title: String(settings.subscriptionChannelTitle || 'Канал Эзотериума').trim().slice(0, 80) || 'Канал Эзотериума'
  };
}

export async function checkChannelMembership(botToken, telegramId, settings = {}) {
  const policy = channelAccessPolicy(settings);
  if (!policy.configured) return { ...policy, member: true, checkRequired: false };
  if (!botToken || !Number.isSafeInteger(Number(telegramId)) || Number(telegramId) <= 0) {
    return { ...policy, member: false, checkRequired: true, error: 'channel_subscription_check_unavailable' };
  }
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/getChatMember`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: policy.username, user_id: Number(telegramId) }),
      signal: AbortSignal.timeout(8_000)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) {
      return { ...policy, member: false, checkRequired: true, error: 'channel_subscription_check_unavailable' };
    }
    const status = String(data.result?.status || '');
    const member = ['creator', 'administrator', 'member'].includes(status)
      || (status === 'restricted' && data.result?.is_member === true);
    return { ...policy, member, checkRequired: true, status };
  } catch {
    return { ...policy, member: false, checkRequired: true, error: 'channel_subscription_check_unavailable' };
  }
}

export function assertChannelMembership(access) {
  if (access?.configured && access.member !== true) {
    const error = new Error(access.error || 'channel_subscription_required');
    error.status = access.error ? 503 : 403;
    throw error;
  }
}
