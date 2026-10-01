const TTL_PATTERN = /^(\d+)\s*(ms|s|m|h|d)?$/i;

export const parseTtlSeconds = (value: string | number | undefined, fallbackSeconds = 86400): number => {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }

  const match = String(value || '').trim().match(TTL_PATTERN);
  if (!match) {
    return fallbackSeconds;
  }

  const amount = Number(match[1]);
  const unit = match[2]?.toLowerCase();

  // Match jsonwebtoken/ms semantics: a number value means seconds, while a
  // numeric string (for example an environment value of "300000") means
  // milliseconds. This keeps JWT expiry, MongoDB expiry, cookies, and Redis
  // session TTLs in sync.
  if (!unit) {
    return Math.floor(amount / 1000);
  }

  switch (unit) {
    case 'ms': return Math.floor(amount / 1000);
    case 's': return amount;
    case 'm': return amount * 60;
    case 'h': return amount * 60 * 60;
    case 'd': return amount * 24 * 60 * 60;
    default: return fallbackSeconds;
  }
};
