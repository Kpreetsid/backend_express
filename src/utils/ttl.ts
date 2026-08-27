const TTL_PATTERN = /^(\d+)\s*([smhd])?$/i;

export const parseTtlSeconds = (value: string | number | undefined, fallbackSeconds = 86400): number => {
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
