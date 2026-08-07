import { MailerService } from '../../_config/mailer';
import { UserModel } from '../../models/user.model';
import { orderService } from '../../work/order/order.service';
import { QueueEventEnvelope } from '../event-envelope';
import { registerDomainEventHandler } from '../domain-event-consumer';

interface WorkOrderAssignedEmailPayload {
  workOrderId: string;
  recipientUserId: string;
  createdByUserId: string;
}

const mailer = new MailerService();

const parsePayload = (value: unknown): WorkOrderAssignedEmailPayload => {
  if (!value || typeof value !== 'object') {
    throw new Error('email.work-order.assigned payload is malformed');
  }
  const payload = value as Partial<WorkOrderAssignedEmailPayload>;
  if (!payload.workOrderId || !payload.recipientUserId || !payload.createdByUserId) {
    throw new Error('email.work-order.assigned payload is malformed');
  }
  return payload as WorkOrderAssignedEmailPayload;
};

const deterministicMessageId = (eventId: string, recipientUserId: string): string => {
  const safe = `${eventId}.${recipientUserId}`.replace(/[^A-Za-z0-9._-]+/g, '-');
  return `<${safe}@cmms.work-order>`;
};

export const handleWorkOrderAssignedEmail = async (
  envelope: QueueEventEnvelope<Record<string, unknown>>
): Promise<void> => {
  const payload = parsePayload(envelope.payload);
  const [orders, recipient, createdBy] = await Promise.all([
    orderService.getAllOrders({
      _id: payload.workOrderId,
      account_id: envelope.tenantId,
      visible: true
    }),
    UserModel.findOne({
      _id: payload.recipientUserId,
      account_id: envelope.tenantId,
      user_status: 'active'
    }),
    UserModel.findOne({
      _id: payload.createdByUserId,
      account_id: envelope.tenantId
    })
  ]);

  const workOrder = orders[0];
  if (!workOrder) throw new Error('Queued work order no longer exists for this tenant');
  if (!recipient?.email) throw new Error('Queued email recipient is unavailable for this tenant');
  if (!createdBy) throw new Error('Queued email actor is unavailable for this tenant');

  await mailer.sendWorkOrderMail(
    workOrder,
    recipient,
    createdBy,
    deterministicMessageId(envelope.eventId, payload.recipientUserId)
  );
};

export const registerWorkOrderEmailHandlers = (): void => {
  registerDomainEventHandler(
    'email.work-order.assigned',
    1,
    handleWorkOrderAssignedEmail
  );
};
