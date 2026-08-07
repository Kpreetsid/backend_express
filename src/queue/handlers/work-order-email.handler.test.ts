import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserModel } from '../../models/user.model';
import { orderService } from '../../work/order/order.service';
import { registerDomainEventHandler } from '../domain-event-consumer';
import {
  handleWorkOrderAssignedEmail,
  registerWorkOrderEmailHandlers
} from './work-order-email.handler';

const mailHarness = vi.hoisted(() => ({
  sendWorkOrderMail: vi.fn()
}));

vi.mock('../../_config/mailer', () => ({
  MailerService: vi.fn(function () {
    return mailHarness;
  })
}));

vi.mock('../../models/user.model', () => ({
  UserModel: { findOne: vi.fn() }
}));

vi.mock('../../work/order/order.service', () => ({
  orderService: { getAllOrders: vi.fn() }
}));

vi.mock('../domain-event-consumer', () => ({
  registerDomainEventHandler: vi.fn()
}));

const envelope = {
  eventId: 'event-1',
  type: 'email.work-order.assigned',
  version: 1,
  tenantId: 'tenant-1',
  actorId: 'creator-1',
  correlationId: 'request-1',
  entity: { type: 'work-order', id: 'wo-1' },
  timestamp: '2026-07-28T00:00:00.000Z',
  payload: {
    workOrderId: 'wo-1',
    recipientUserId: 'recipient-1',
    createdByUserId: 'creator-1'
  }
};

describe('work-order email domain-event handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(orderService.getAllOrders).mockResolvedValue([{
      _id: 'wo-1',
      order_no: 'WO-1',
      title: 'Inspect pump'
    }]);
    vi.mocked(UserModel.findOne)
      .mockResolvedValueOnce({
        _id: 'recipient-1',
        account_id: 'tenant-1',
        email: 'recipient@example.test'
      } as never)
      .mockResolvedValueOnce({
        _id: 'creator-1',
        account_id: 'tenant-1',
        email: 'creator@example.test'
      } as never);
    mailHarness.sendWorkOrderMail.mockResolvedValue(undefined);
  });

  it('loads every entity through the envelope tenant and uses a deterministic message id', async () => {
    await handleWorkOrderAssignedEmail(envelope);

    expect(orderService.getAllOrders).toHaveBeenCalledWith({
      _id: 'wo-1',
      account_id: 'tenant-1',
      visible: true
    });
    expect(UserModel.findOne).toHaveBeenNthCalledWith(1, {
      _id: 'recipient-1',
      account_id: 'tenant-1',
      user_status: 'active'
    });
    expect(mailHarness.sendWorkOrderMail).toHaveBeenCalledWith(
      expect.objectContaining({ _id: 'wo-1' }),
      expect.objectContaining({ _id: 'recipient-1' }),
      expect.objectContaining({ _id: 'creator-1' }),
      '<event-1.recipient-1@cmms.work-order>'
    );
  });

  it('fails safely when a tenant-scoped recipient cannot be resolved', async () => {
    vi.mocked(UserModel.findOne).mockReset()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ _id: 'creator-1' } as never);

    await expect(handleWorkOrderAssignedEmail(envelope))
      .rejects.toThrow('recipient is unavailable');
    expect(mailHarness.sendWorkOrderMail).not.toHaveBeenCalled();
  });

  it('rejects malformed payloads before querying domain data', async () => {
    await expect(handleWorkOrderAssignedEmail({
      ...envelope,
      payload: { workOrderId: 'wo-1' }
    })).rejects.toThrow('malformed');
    expect(orderService.getAllOrders).not.toHaveBeenCalled();
  });

  it('registers the exact work-order email event contract', () => {
    registerWorkOrderEmailHandlers();
    expect(registerDomainEventHandler).toHaveBeenCalledWith(
      'email.work-order.assigned',
      1,
      handleWorkOrderAssignedEmail
    );
  });
});
