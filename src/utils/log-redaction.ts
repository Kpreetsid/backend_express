const redacted = '[REDACTED]';
const credentialKey = /password|passcode|token|auth|otp|secret|cookie|session|card|ssn|api[-_]?key|verificationCode|payloadCrypto|_encrypted|__cmms_crypto_fields|^(?:kid|iv|tag|ct)$/i;
const urlKey = /(?:url|uri|href|referer|referrer)$/i;
const jwt = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const publicUserActions = new Set([
  'login', 'authenticate', 'external_auth', 'refresh', 'updatePassword', 'logout', 'me', 'authorize-feature',
  'register', 'registration', 'verification', 'verify', 'resetPassword', 'forgotPassword', 'change-password', 'roles', 'logs', 'location'
]);

/** URL values are unnecessary in logs; retain only a sanitized path and origin. */
export function sanitizeLogUrl(value: unknown): string {
  if (typeof value !== 'string') return '';
  let raw = value.replace(/[\r\n\0]/g, '').split(/[?#]/, 1)[0];
  let origin = '';
  if (/^https?:\/\//i.test(raw)) {
    try { const parsed = new URL(raw); origin = parsed.origin; raw = parsed.pathname; }
    catch { return redacted; }
  }
  try {
    // Decode percent-encoded credential segments before deciding what may be logged.
    for (let i = 0; i < 2; i++) {
      const decoded = decodeURIComponent(raw);
      if (decoded === raw) break;
      raw = decoded;
    }
  } catch { return `${origin}/${redacted}`; }
  raw = raw.replace(/[\r\n\0]/g, '').split(/[?#]/, 1)[0];
  const segments = raw.split('/');
  for (let i = 0; i < segments.length; i++) {
    if (segments[i] === 'create_external_token' && i + 1 < segments.length) segments[i + 1] = redacted;
    if (segments[i] === 'users' && i + 1 < segments.length && segments[i - 1] !== 'master' &&
        !publicUserActions.has(segments[i + 1]) && segments[i + 1] !== 'create_external_token') {
      // /users/:token is a legacy public route. Never persist its bearer value.
      segments.splice(i + 1, segments.length - i - 1, redacted);
    }
    if (segments[i].includes('@')) segments[i] = redacted;
    segments[i] = segments[i].replace(jwt, redacted);
  }
  return origin + segments.join('/');
}

export function redactLogData(value: unknown, depth = 0, seen = new WeakSet<object>()): any {
  if (typeof value === 'string') return value.replace(jwt, redacted);
  if (!value || typeof value !== 'object') return value;
  if (value instanceof Date) return value;
  if (depth >= 20 || seen.has(value)) return redacted;
  seen.add(value);
  if (Array.isArray(value)) return value.map(item => redactLogData(item, depth + 1, seen));
  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    output[key] = credentialKey.test(key) ? redacted : urlKey.test(key) && typeof item === 'string'
      ? sanitizeLogUrl(item) : redactLogData(item, depth + 1, seen);
  }
  return output;
}
