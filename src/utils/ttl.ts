const TTL_PATTERN = /^(\d+)\s*([smhd])?$/i;

export const parseTtlSeconds = (value: string | number | undefined, fallbackSeconds: number): number => {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }

  const match = String(value || '').trim().match(TTL_PATTERN);
  if (!match) {
    return fallbackSeconds;
  }

  const amount = Number(match[1]);
  const multiplier = {
    s: 1,
    m: 60,
    h: 60 * 60,
    d: 24 * 60 * 60
  }[String(match[2] || 's').toLowerCase()] || 1;
  return amount * multiplier;
};
export const parseTtlSeconds = (value: string | number | undefined, fallbackSeconds = 86400): number => {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }

  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) {
    return fallbackSeconds;
  }

  const match = /^(\d+)(s|m|h|d)?$/.exec(normalized);
  if (!match) {
    const parsed = Number.parseInt(normalized, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackSeconds;
  }

  const amount = Number(match[1]);
  switch (match[2]) {
    case 'm':
      return amount * 60;
    case 'h':
      return amount * 60 * 60;
    case 'd':
      return amount * 24 * 60 * 60;
    case 's':
    default:
      return amount;
  }
};
