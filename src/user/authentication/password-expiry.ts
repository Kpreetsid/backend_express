const INDIA_OFFSET_MS = 330 * 60_000;
const MESSAGE = 'Your password is too old. Please update your password.';

// Calendar days in the application's India timezone; a later time today is expired too.
export function passwordExpiryNotice(value: unknown, now = new Date()) {
  const expiry = value ? new Date(value as string | Date) : null;
  const passwordExpired = !!expiry && Number.isFinite(expiry.getTime()) &&
    new Date(expiry.getTime() + INDIA_OFFSET_MS).toISOString().slice(0, 10) <=
    new Date(now.getTime() + INDIA_OFFSET_MS).toISOString().slice(0, 10);
  return { passwordExpired, passwordExpiryMessage: passwordExpired ? MESSAGE : '' };
}

export function nextPasswordExpiry(now = new Date()): Date {
  const local = new Date(now.getTime() + INDIA_OFFSET_MS);
  const day = local.getUTCDate();
  local.setUTCDate(1);
  local.setUTCMonth(local.getUTCMonth() + 3);
  const lastDay = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 0)).getUTCDate();
  local.setUTCDate(Math.min(day, lastDay));
  return new Date(local.getTime() - INDIA_OFFSET_MS);
}
