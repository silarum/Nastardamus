export const DEFAULT_DEEPSEEK_MODEL = 'deepseek-v4-flash';

const DEEPSEEK_CHAT_URL = 'https://api.deepseek.com/chat/completions';

function normalizeMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new TypeError('deepseek_messages_required');
  }

  return messages.map((message) => {
    const role = ['system', 'assistant', 'user'].includes(message?.role)
      ? message.role
      : 'user';
    if (typeof message?.content !== 'string' || !message.content.trim()) {
      throw new TypeError('deepseek_text_messages_only');
    }
    return { role, content: message.content.trim() };
  });
}

export async function requestDeepSeekChat({
  apiKey = process.env.DEEPSEEK_API_KEY,
  model = process.env.DEEPSEEK_MODEL || DEFAULT_DEEPSEEK_MODEL,
  messages,
  temperature = 0.65,
  maxTokens = 850,
  timeoutMs = 30_000
}) {
  if (!apiKey) throw new Error('deepseek_not_configured');

  const response = await fetch(DEEPSEEK_CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: normalizeMessages(messages),
      temperature,
      max_tokens: maxTokens
    }),
    signal: AbortSignal.timeout(timeoutMs)
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error?.message || `deepseek_${response.status}`);
  }

  const answer = data?.choices?.[0]?.message?.content;
  if (typeof answer !== 'string' || !answer.trim()) {
    throw new Error('empty_deepseek_response');
  }
  return {
    answer: answer.trim(),
    model: data?.model || model
  };
}
