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
