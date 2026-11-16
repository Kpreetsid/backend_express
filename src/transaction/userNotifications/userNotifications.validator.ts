export const channels = ['email', 'push', 'sms', 'whatsapp'] as const;
export const severities = ['alert', 'danger', 'critical'] as const;

export type Channel = typeof channels[number];
export type Severity = typeof severities[number];
export type Notifications = Record<Channel, Record<Severity, boolean>>;

export const failure = (message: string, status: number) =>
  Object.assign(new Error(message), { status });

export const record = (value: unknown): value is Record<string, any> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export function normalizeNotifications(value: any): Notifications {
  return Object.fromEntries(
    channels.map(channel => [
      channel,
      Object.fromEntries(
        severities.map(severity => [severity, value?.[channel]?.[severity] === true])
      )
    ])
  ) as Notifications;
}

export function notificationPatch(body: unknown): Record<string, boolean> {
  if (!record(body) || Object.keys(body).length !== 1 || !Object.hasOwn(body, 'notifications') ||
      !record(body.notifications) || !Object.keys(body.notifications).length) {
    throw failure('Provide a nonempty notifications object', 400);
  }
  const leaves: Record<string, boolean> = {};
  for (const [channel, levels] of Object.entries(body.notifications)) {
    if (!(channels as readonly string[]).includes(channel) || !record(levels) || !Object.keys(levels).length) {
      throw failure('Unknown or empty notification channel', 400);
    }
    for (const [severity, enabled] of Object.entries(levels)) {
      if (!(severities as readonly string[]).includes(severity) || typeof enabled !== 'boolean') {
        throw failure('Notification severities must be known boolean values', 400);
      }
      leaves[`notifications.${channel}.${severity}`] = enabled;
    }
  }
  return leaves;
}

export function validId(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^[a-fA-F0-9]{24}$/.test(value)) {
    throw failure(`Invalid ${label}`, 400);
  }
  return value;
}
