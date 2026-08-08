export const DEFAULT_DEEPSEEK_MODEL = 'deepseek-v4-flash';

const DEFAULT_DEEPSEEK_BASE_URL = 'https://api.deepseek.com';

function resolveDeepSeekChatUrl(value) {
  let url;
  try {
    url = new URL(String(value || DEFAULT_DEEPSEEK_BASE_URL).trim());
  } catch {
    throw new Error('deepseek_base_url_invalid');
  }
  const localHost = ['127.0.0.1', 'localhost', '::1'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && localHost)) {
    throw new Error('deepseek_base_url_invalid');
  }
  if ((process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production') && url.protocol !== 'https:') {
    throw new Error('deepseek_base_url_insecure');
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('deepseek_base_url_invalid');
  }
  const base = url.toString().replace(/\/$/, '');
  return /\/chat\/completions$/i.test(base) ? base : `${base}/chat/completions`;
}

function wait(delayMs) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

function responseRequestId(response) {
  return response?.headers?.get?.('x-request-id')
    || response?.headers?.get?.('request-id')
    || null;
}

function providerError(message, { status = null, code = '', requestId = null } = {}) {
  const error = new Error(message);
  if (Number.isInteger(status)) error.status = status;
  if (code) error.code = code;
  if (requestId) error.requestId = requestId;
  return error;
}

function retryableStatus(status) {
  return [408, 409, 425, 429].includes(status) || status >= 500;
}

function extractAnswer(data) {
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content.trim();
  if (!Array.isArray(content)) return '';
  return content
    .map((part) => typeof part === 'string' ? part : part?.text || '')
    .join('')
    .trim();
}

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
  baseUrl = process.env.DEEPSEEK_BASE_URL || DEFAULT_DEEPSEEK_BASE_URL,
  messages,
  temperature = 0.65,
  maxTokens = 850,
  timeoutMs = 30_000,
  responseFormat = null,
  maxAttempts = 3,
  retryBaseMs = 250
}) {
  if (!apiKey) throw new Error('deepseek_not_configured');
  const endpoint = resolveDeepSeekChatUrl(baseUrl);
  const attempts = Math.max(1, Math.min(4, Number(maxAttempts) || 1));
  const normalizedMessages = normalizeMessages(messages);
  const normalizedResponseFormat = typeof responseFormat === 'string'
    ? { type: responseFormat }
    : responseFormat;
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: normalizedMessages,
          temperature,
          max_tokens: maxTokens,
          ...(normalizedResponseFormat ? { response_format: normalizedResponseFormat } : {})
        }),
        signal: AbortSignal.timeout(timeoutMs)
      });
      const data = await response.json().catch(() => null);
      const requestId = responseRequestId(response);
      if (!response.ok) {
        const error = providerError(data?.error?.message || `deepseek_${response.status}`, {
          status: response.status,
          code: data?.error?.code || data?.error?.type || '',
          requestId
        });
        if (attempt < attempts && retryableStatus(response.status)) {
          lastError = error;
          await wait(retryBaseMs * attempt);
          continue;
        }
        throw error;
      }

      const answer = extractAnswer(data);
      if (!answer) {
        const error = providerError('empty_deepseek_response', { requestId });
        if (attempt < attempts) {
          lastError = error;
          await wait(retryBaseMs * attempt);
          continue;
        }
        throw error;
      }
      return {
        answer,
        model: data?.model || model,
        requestId
      };
    } catch (error) {
      if (attempt >= attempts || Number.isInteger(error?.status)) throw error;
      lastError = error;
      await wait(retryBaseMs * attempt);
    }
  }

  throw lastError || new Error('deepseek_provider_unavailable');
}
