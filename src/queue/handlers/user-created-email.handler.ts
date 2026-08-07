import { MailerService } from '../../_config/mailer';
import { UserModel } from '../../models/user.model';
import { QueueEventEnvelope } from '../event-envelope';
import { registerDomainEventHandler } from '../domain-event-consumer';

interface UserCreatedEmailPayload {
  userId: string;
}

const mailer = new MailerService();

const parsePayload = (value: unknown): UserCreatedEmailPayload => {
  if (!value || typeof value !== 'object' || !(value as Partial<UserCreatedEmailPayload>).userId) {
    throw new Error('email.user.created payload is malformed');
  }
  return value as UserCreatedEmailPayload;
};

const deterministicMessageId = (eventId: string, userId: string): string => {
  const safe = `${eventId}.${userId}`.replace(/[^A-Za-z0-9._-]+/g, '-');
  return `<${safe}@cmms.user-created>`;
};

export const handleUserCreatedEmail = async (
  envelope: QueueEventEnvelope<Record<string, unknown>>
): Promise<void> => {
  const payload = parsePayload(envelope.payload);
  const user = await UserModel.findOne({
    _id: payload.userId,
    account_id: envelope.tenantId,
    user_status: 'active'
  }).select('username email');

  if (!user?.email || !user.username) {
    throw new Error('Queued user-created email recipient is unavailable for this tenant');
  }

  await mailer.sendUserCreatedMail(
    { userName: user.username, userEmail: user.email },
    deterministicMessageId(envelope.eventId, payload.userId)
  );
};

export const registerUserCreatedEmailHandlers = (): void => {
  registerDomainEventHandler('email.user.created', 1, handleUserCreatedEmail);
};
