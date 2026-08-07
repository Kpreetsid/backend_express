import { AccountNotificationPayload, notificationService } from '../../utils/notification.service';
import { QueueEventEnvelope } from '../event-envelope';
import { registerDomainEventHandler } from '../domain-event-consumer';

const isAccountNotificationPayload = (value: unknown): value is AccountNotificationPayload => {
  if (!value || typeof value !== 'object') return false;
  const payload = value as Partial<AccountNotificationPayload>;
  return Boolean(
    payload.accountId
    && payload.module
    && ['created', 'updated'].includes(String(payload.event))
    && payload.entityId
    && payload.actionUrl
  );
};

export const handleAccountNotification = async (
  envelope: QueueEventEnvelope<Record<string, unknown>>
): Promise<void> => {
  if (!isAccountNotificationPayload(envelope.payload)) {
    throw new Error('notification.account.requested payload is malformed');
  }
  if (envelope.payload.accountId !== envelope.tenantId) {
    throw new Error('Notification tenant does not match the domain event tenant');
  }
  await notificationService.notifyAccountUsers(envelope.payload, envelope.eventId);
};

export const registerNotificationHandlers = (): void => {
  registerDomainEventHandler(
    'notification.account.requested',
    1,
    handleAccountNotification
  );
};
