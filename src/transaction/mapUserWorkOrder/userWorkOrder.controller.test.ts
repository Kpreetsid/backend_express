import { beforeEach, describe, expect, it, vi } from 'vitest';
import { userWorkOrderController } from './userWorkOrder.controller';
import { userWorkOrderService } from './userWorkOrder.service';
import { orderService } from '../../work/order/order.service';
import { notificationService } from '../../utils/notification.service';
import { withTransaction } from '../../utils/transaction.helper';
import { UserModel } from '../../models/user.model';

vi.mock('./userWorkOrder.service', () => ({
  userWorkOrderService: {
    mapUsersWorkOrder: vi.fn(),
    updateMappedUsers: vi.fn(),
    removeMappedUsers: vi.fn(),
    mappedData: vi.fn(),
    getAll: vi.fn()
  }
}));

vi.mock('../../work/order/order.service', () => ({
  orderService: {
    getAllOrders: vi.fn()
  }
}));

vi.mock('../../utils/notification.service', () => ({
  notificationService: {
    queueAccountNotification: vi.fn(),
    notifyAccountUsers: vi.fn()
  }
}));

vi.mock('../../utils/transaction.helper', () => ({
  withTransaction: vi.fn()
}));

vi.mock('../../models/user.model', () => ({
  UserModel: {
    countDocuments: vi.fn()
  }
}));

describe('work-order assignee tenant and outbox boundary', () => {
  const accountId = '507f1f77bcf86cd799439011';
  const foreignAccountId = '507f1f77bcf86cd799439099';
  const actorId = '507f1f77bcf86cd799439012';
  const workOrderId = '507f1f77bcf86cd799439013';
  const assigneeId = '507f1f77bcf86cd799439014';
  const session = { id: 'assignee-session' };

  const makeRequest = (overrides: Record<string, unknown> = {}) => ({
    user: {
      _id: actorId,
      account_id: accountId,
      user_role: 'admin'
    },
    body: {},
    params: {},
    query: {},
    ...overrides
  } as any);

  const makeResponse = () => {
    const response: any = {
      locals: { correlationId: 'assignee-correlation-id' },
      status: vi.fn(),
      json: vi.fn()
    };
    response.status.mockReturnValue(response);
    response.json.mockReturnValue(response);
    return response;
  };

  const mockTenantUserCount = (count: number) => {
    const query: any = {
      session: vi.fn(),
      then: (resolve: (value: number) => unknown) => Promise.resolve(count).then(resolve)
    };
    query.session.mockReturnValue(query);
    vi.mocked(UserModel.countDocuments).mockReturnValue(query);
    return query;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(withTransaction).mockImplementation(async (operation: any) => operation(session));
    vi.mocked(orderService.getAllOrders).mockResolvedValue([{
      _id: workOrderId,
      title: 'Repair pump',
      order_no: 'WO-100'
    }] as never);
    vi.mocked(notificationService.queueAccountNotification).mockResolvedValue();
    mockTenantUserCount(1);
  });

  it('uses the validator payload shape and authenticated tenant for create', async () => {
    const mappings = [{ woId: workOrderId, userId: assigneeId }];
    vi.mocked(userWorkOrderService.mapUsersWorkOrder).mockResolvedValue(mappings as never);
    const response = makeResponse();
    const next = vi.fn();
    const detachedCreateHandler = userWorkOrderController.create;

    await detachedCreateHandler(
      makeRequest({
        body: {
          workOrderId,
          userIdList: [assigneeId],
          account_id: foreignAccountId
        }
      }),
      response,
      next
    );

    expect(orderService.getAllOrders).toHaveBeenCalledWith({
      _id: expect.objectContaining({}),
      account_id: accountId,
      visible: true
    }, session);
    expect(UserModel.countDocuments).toHaveBeenCalledWith({
      _id: { $in: [expect.objectContaining({})] },
      account_id: accountId,
      user_status: 'active'
    });
    expect(userWorkOrderService.mapUsersWorkOrder).toHaveBeenCalledWith([
      {
        woId: expect.objectContaining({}),
        userId: expect.objectContaining({})
      }
    ], session);
    expect(notificationService.queueAccountNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId,
        entityId: workOrderId,
        module: 'Work Order',
        event: 'updated'
      }),
      { session, correlationId: 'assignee-correlation-id' }
    );
    expect(notificationService.notifyAccountUsers).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({
      status: true,
      message: 'Users mapped to work order successfully',
      data: mappings
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('denies a work order outside the authenticated tenant before writing', async () => {
    vi.mocked(orderService.getAllOrders).mockResolvedValue([]);
    const response = makeResponse();
    const next = vi.fn();

    await userWorkOrderController.create(
      makeRequest({ body: { workOrderId, userIdList: [assigneeId] } }),
      response,
      next
    );

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Work order not found',
      status: 404
    }));
    expect(UserModel.countDocuments).not.toHaveBeenCalled();
    expect(userWorkOrderService.mapUsersWorkOrder).not.toHaveBeenCalled();
    expect(notificationService.queueAccountNotification).not.toHaveBeenCalled();
    expect(response.status).not.toHaveBeenCalled();
  });

  it('denies foreign or inactive assignees before writing', async () => {
    mockTenantUserCount(0);
    const response = makeResponse();
    const next = vi.fn();

    await userWorkOrderController.create(
      makeRequest({ body: { workOrderId, userIdList: [assigneeId] } }),
      response,
      next
    );

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      message: 'One or more users were not found in this account',
      status: 404
    }));
    expect(userWorkOrderService.mapUsersWorkOrder).not.toHaveBeenCalled();
    expect(notificationService.queueAccountNotification).not.toHaveBeenCalled();
  });

  it('updates mappings and the notification event in one transaction', async () => {
    const updatedMappings = [{ woId: workOrderId, userId: assigneeId }];
    vi.mocked(userWorkOrderService.updateMappedUsers).mockResolvedValue(updatedMappings);
    const response = makeResponse();
    const next = vi.fn();

    await userWorkOrderController.update(
      makeRequest({
        params: { workOrderId },
        body: { userIdList: [assigneeId] }
      }),
      response,
      next
    );

    expect(userWorkOrderService.updateMappedUsers).toHaveBeenCalledWith(
      expect.objectContaining({}),
      [expect.objectContaining({})],
      session
    );
    expect(notificationService.queueAccountNotification).toHaveBeenCalledWith(
      expect.objectContaining({ accountId, entityId: workOrderId }),
      { session, correlationId: 'assignee-correlation-id' }
    );
    expect(response.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });

  it('tenant-scopes the administrator mapping list to visible work orders', async () => {
    const mappings = [{ woId: workOrderId, userId: assigneeId }];
    vi.mocked(userWorkOrderService.getAll).mockResolvedValue(mappings as never);
    const response = makeResponse();
    const next = vi.fn();

    await userWorkOrderController.getUserWorkOrders(
      makeRequest(),
      response,
      next
    );

    expect(orderService.getAllOrders).toHaveBeenCalledWith({
      account_id: accountId,
      visible: true
    });
    expect(userWorkOrderService.getAll).toHaveBeenCalledWith({
      woId: { $in: [workOrderId] }
    });
    expect(response.json).toHaveBeenCalledWith({
      status: true,
      message: 'User work order mappings fetched successfully',
      data: mappings
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('limits non-admin mapping reads to the authenticated user and requested tenant order', async () => {
    const mappings = [{ woId: workOrderId, userId: actorId }];
    vi.mocked(userWorkOrderService.getAll).mockResolvedValue(mappings as never);
    const response = makeResponse();
    const next = vi.fn();

    await userWorkOrderController.getUserWorkOrders(
      makeRequest({
        user: {
          _id: actorId,
          account_id: accountId,
          user_role: 'technician'
        },
        query: { workOrderId }
      }),
      response,
      next
    );

    expect(orderService.getAllOrders).toHaveBeenCalledWith({
      _id: expect.objectContaining({}),
      account_id: accountId,
      visible: true
    });
    expect(userWorkOrderService.getAll).toHaveBeenCalledWith({
      userId: actorId,
      woId: expect.objectContaining({})
    });
    expect(response.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns not found when no tenant mapping can be listed', async () => {
    vi.mocked(userWorkOrderService.getAll).mockResolvedValue([]);
    const response = makeResponse();
    const next = vi.fn();

    await userWorkOrderController.getUserWorkOrders(makeRequest(), response, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      status: 404,
      message: 'User work order mapping not found'
    }));
    expect(response.status).not.toHaveBeenCalled();
  });

  it('returns mapped data only after rechecking work-order ownership', async () => {
    const mapped = [{ woId: workOrderId, userId: assigneeId }];
    vi.mocked(userWorkOrderService.mappedData).mockResolvedValue(mapped as never);
    const response = makeResponse();
    const next = vi.fn();

    await userWorkOrderController.getMappedData(
      makeRequest({ params: { workOrderId } }),
      response,
      next
    );

    expect(orderService.getAllOrders).toHaveBeenCalledWith({
      _id: expect.objectContaining({}),
      account_id: accountId,
      visible: true
    }, undefined);
    expect(userWorkOrderService.mappedData).toHaveBeenCalledWith({
      woId: expect.objectContaining({})
    });
    expect(response.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects an update payload that does not contain a user list', async () => {
    const response = makeResponse();
    const next = vi.fn();

    await userWorkOrderController.update(
      makeRequest({ params: { workOrderId }, body: { userIdList: 'invalid' } }),
      response,
      next
    );

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      status: 400,
      message: 'Invalid request data'
    }));
    expect(withTransaction).not.toHaveBeenCalled();
  });

  it('removes tenant-owned mappings after the ownership check', async () => {
    vi.mocked(userWorkOrderService.removeMappedUsers).mockResolvedValue({
      deletedCount: 1
    } as never);
    const response = makeResponse();
    const next = vi.fn();

    await userWorkOrderController.remove(
      makeRequest({ params: { workOrderId } }),
      response,
      next
    );

    expect(userWorkOrderService.removeMappedUsers)
      .toHaveBeenCalledWith(expect.objectContaining({}));
    expect(response.json).toHaveBeenCalledWith({
      status: true,
      message: 'User work order mapping removed successfully',
      data: { deletedCount: 1 }
    });
    expect(next).not.toHaveBeenCalled();
  });

  it.each([
    ['getMappedData', 'mappedData'],
    ['remove', 'removeMappedUsers']
  ])('prevents %s from crossing the tenant boundary', async (handlerName, serviceMethod) => {
    vi.mocked(orderService.getAllOrders).mockResolvedValue([]);
    const response = makeResponse();
    const next = vi.fn();

    await (userWorkOrderController as any)[handlerName](
      makeRequest({ params: { workOrderId } }),
      response,
      next
    );

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 404 }));
    expect((userWorkOrderService as any)[serviceMethod]).not.toHaveBeenCalled();
    expect(response.status).not.toHaveBeenCalled();
  });

  it('does not return success if durable notification persistence fails', async () => {
    vi.mocked(userWorkOrderService.mapUsersWorkOrder).mockResolvedValue([] as never);
    const failure = new Error('outbox unavailable');
    vi.mocked(notificationService.queueAccountNotification).mockRejectedValue(failure);
    const response = makeResponse();
    const next = vi.fn();

    await userWorkOrderController.create(
      makeRequest({ body: { workOrderId, userIdList: [assigneeId] } }),
      response,
      next
    );

    expect(next).toHaveBeenCalledWith(failure);
    expect(response.status).not.toHaveBeenCalled();
  });
});
