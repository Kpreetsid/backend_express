import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requestController } from './request.controller';
import { requestService } from './request.service';
import { notificationService } from '../../utils/notification.service';
import { withTransaction } from '../../utils/transaction.helper';
import { applyRoleFilter } from '../../utils/roleFilter';

vi.mock('./request.service', () => ({
  requestService: {
    createRequest: vi.fn(),
    getAllRequests: vi.fn(),
    updateRequest: vi.fn(),
    markApproved: vi.fn(),
    markRejected: vi.fn(),
    getRequestById: vi.fn(),
    deleteRequestById: vi.fn()
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

vi.mock('../../utils/roleFilter', () => ({
  applyRoleFilter: vi.fn()
}));

describe('work-request durable notification boundary', () => {
  const accountId = '507f1f77bcf86cd799439011';
  const userId = '507f1f77bcf86cd799439012';
  const requestId = '507f1f77bcf86cd799439013';
  const session = { id: 'work-request-session' };

  const makeResponse = () => {
    const response: any = {
      locals: { correlationId: 'request-correlation-id' },
      status: vi.fn(),
      json: vi.fn(),
      setHeader: vi.fn()
    };
    response.status.mockReturnValue(response);
    response.json.mockReturnValue(response);
    return response;
  };

  const makeRequest = (overrides: Record<string, unknown> = {}) => ({
    user: {
      _id: userId,
      account_id: accountId,
      firstName: 'Pat',
      lastName: 'Operator',
      user_role: 'admin'
    },
    body: {},
    params: {},
    header: vi.fn().mockReturnValue(undefined),
    ...overrides
  } as any);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(withTransaction).mockImplementation(async (operation: any) => operation(session));
    vi.mocked(notificationService.queueAccountNotification).mockResolvedValue();
    vi.mocked(applyRoleFilter).mockImplementation(async ({ baseFilter }: any) => baseFilter);
  });

  it('creates the request and tenant notification in the same transaction', async () => {
    const created = {
      _id: requestId,
      title: 'Inspect pump',
      problemType: 'Inspection',
      sync_version: 0
    };
    vi.mocked(requestService.createRequest).mockResolvedValue(created);
    const response = makeResponse();
    const next = vi.fn();

    const detachedCreateHandler = requestController.create;
    await detachedCreateHandler(
      makeRequest({
        body: {
          title: 'Inspect pump',
          account_id: '507f1f77bcf86cd799439099'
        }
      }),
      response,
      next
    );

    expect(requestService.createRequest).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Inspect pump' }),
      expect.objectContaining({ account_id: accountId }),
      session
    );
    expect(notificationService.queueAccountNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId,
        entityId: requestId,
        module: 'Work Request',
        event: 'created'
      }),
      { session, correlationId: 'request-correlation-id' }
    );
    expect(notificationService.notifyAccountUsers).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({
      status: true,
      message: 'Work request created successfully.',
      data: created
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('does not return success when durable notification persistence fails', async () => {
    vi.mocked(requestService.createRequest).mockResolvedValue({
      _id: requestId,
      title: 'Inspect pump'
    });
    const failure = new Error('outbox unavailable');
    vi.mocked(notificationService.queueAccountNotification).mockRejectedValue(failure);
    const response = makeResponse();
    const next = vi.fn();

    await requestController.create(makeRequest(), response, next);

    expect(next).toHaveBeenCalledWith(failure);
    expect(response.status).not.toHaveBeenCalled();
    expect(response.json).not.toHaveBeenCalled();
  });

  it('does not allow query parameters to replace tenant detail scope', async () => {
    const record = {
      _id: requestId,
      account_id: accountId,
      sync_version: 0
    };
    vi.mocked(requestService.getAllRequests).mockResolvedValue([record] as never);
    const response = makeResponse();
    const next = vi.fn();

    await requestController.getById(
      makeRequest({
        params: { id: requestId },
        query: {
          _id: '507f1f77bcf86cd799439099',
          account_id: '507f1f77bcf86cd799439098',
          visible: false,
          status: 'Open'
        }
      }),
      response,
      next
    );

    expect(applyRoleFilter).toHaveBeenCalledWith(expect.objectContaining({
      baseFilter: {
        _id: expect.objectContaining({}),
        account_id: accountId,
        visible: true,
        status: 'Open'
      }
    }));
    expect(requestService.getAllRequests).toHaveBeenCalledWith(
      accountId,
      expect.objectContaining({
        account_id: accountId,
        visible: true,
        status: 'Open'
      })
    );
    expect(response.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });

  it('builds all supported list filters underneath the authenticated tenant', async () => {
    vi.mocked(requestService.getAllRequests).mockResolvedValue([
      { _id: requestId, account_id: accountId }
    ] as never);
    const response = makeResponse();
    const next = vi.fn();

    await requestController.getAll(
      makeRequest({
        query: {
          priority: 'High,Urgent',
          location: '507f1f77bcf86cd799439021',
          asset: '507f1f77bcf86cd799439026',
          status: 'Open,Pending',
          assignedTo: '507f1f77bcf86cd799439022',
          assignedBy: '507f1f77bcf86cd799439023',
          approvedBy: '507f1f77bcf86cd799439024',
          rejectedBy: '507f1f77bcf86cd799439025'
        }
      }),
      response,
      next
    );

    expect(applyRoleFilter).toHaveBeenCalledWith(expect.objectContaining({
      baseFilter: expect.objectContaining({
        account_id: accountId,
        visible: true,
        priority: ['High', 'Urgent'],
        status: ['Open', 'Pending'],
        location_id: { $in: expect.any(Array) },
        asset_id: { $in: expect.any(Array) },
        assigned_to: { $in: expect.any(Array) },
        createdBy: { $in: expect.any(Array) },
        approvedBy: { $in: expect.any(Array) },
        rejectedBy: { $in: expect.any(Array) }
      })
    }));
    expect(requestService.getAllRequests).toHaveBeenCalledWith(
      accountId,
      expect.objectContaining({ account_id: accountId, visible: true })
    );
    expect(response.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns the established not-found error when a tenant has no requests', async () => {
    vi.mocked(requestService.getAllRequests).mockResolvedValue([]);
    const response = makeResponse();
    const next = vi.fn();

    await requestController.getAll(makeRequest({ query: {} }), response, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      status: 404,
      message: 'Work request not found'
    }));
    expect(response.status).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: 'generic approval status',
      request: { params: { id: requestId, status: 'Approved' }, body: {} },
      message: 'Use the dedicated approval actions for this request'
    },
    {
      name: 'unsupported status',
      request: { params: { id: requestId, status: 'Archived' }, body: {} },
      message: 'Status is not editable'
    },
    {
      name: 'unsupported priority',
      request: { params: { id: requestId }, body: { priority: 'Emergency' } },
      message: 'Invalid priority value'
    }
  ])('rejects $name before loading or mutating a record', async ({ request, message }) => {
    const response = makeResponse();
    const next = vi.fn();

    await requestController.update(makeRequest(request), response, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message }));
    expect(requestService.getAllRequests).not.toHaveBeenCalled();
    expect(requestService.updateRequest).not.toHaveBeenCalled();
  });

  it.each([
    {
      action: 'approve',
      user: { user_role: 'technician' },
      body: {},
      message: 'Only administrators can approve work requests'
    },
    {
      action: 'reject',
      user: { user_role: 'technician' },
      body: { remarks: 'No access' },
      message: 'Only administrators can reject work requests'
    },
    {
      action: 'reject',
      user: { user_role: 'admin' },
      body: {},
      message: 'Remarks is required'
    }
  ])('enforces the $action authorization/validation boundary', async ({
    action,
    user,
    body,
    message
  }) => {
    const response = makeResponse();
    const next = vi.fn();
    const request = makeRequest({ params: { id: requestId }, body });
    request.user = { ...request.user, ...user };

    await (requestController as any)[action](request, response, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message }));
    expect(requestService.getAllRequests).not.toHaveBeenCalled();
  });

  it('soft-deletes only through the authenticated tenant service boundary', async () => {
    vi.mocked(requestService.getAllRequests).mockResolvedValue([
      { _id: requestId, account_id: accountId }
    ] as never);
    vi.mocked(requestService.deleteRequestById).mockResolvedValue({
      _id: requestId,
      visible: false
    } as never);
    const response = makeResponse();
    const next = vi.fn();

    await requestController.remove(
      makeRequest({ params: { id: requestId } }),
      response,
      next
    );

    expect(requestService.getAllRequests).toHaveBeenCalledWith(
      accountId,
      expect.objectContaining({ account_id: accountId })
    );
    expect(requestService.deleteRequestById).toHaveBeenCalledWith(
      requestId,
      accountId,
      userId
    );
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({
      status: true,
      message: 'Work request deleted successfully.'
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('does not append undefined remarks when an update omits remarks', async () => {
    const current = {
      _id: requestId,
      title: 'Inspect pump',
      problemType: 'Inspection',
      priority: 'High',
      remarks: 'Existing note',
      status: 'Open',
      sync_version: 0
    };
    const body = { title: 'Inspect pump bearing' };
    vi.mocked(requestService.getAllRequests).mockResolvedValue([current] as never);
    vi.mocked(requestService.updateRequest).mockResolvedValue({ modifiedCount: 1 } as never);
    vi.mocked(requestService.getRequestById).mockResolvedValue({
      ...current,
      ...body,
      sync_version: 1
    } as never);
    const response = makeResponse();
    const next = vi.fn();

    await requestController.update(
      makeRequest({ params: { id: requestId }, body }),
      response,
      next
    );

    expect(body).not.toHaveProperty('remarks');
    expect(requestService.updateRequest).toHaveBeenCalledWith(
      requestId,
      accountId,
      body,
      userId,
      session,
      undefined
    );
    expect(response.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });

  it.each([
    {
      action: 'update',
      params: { id: requestId },
      body: { title: 'Updated request', remarks: '' },
      serviceMethod: 'updateRequest'
    },
    {
      action: 'approve',
      params: { id: requestId },
      body: {},
      serviceMethod: 'markApproved'
    },
    {
      action: 'reject',
      params: { id: requestId },
      body: { remarks: 'Insufficient detail' },
      serviceMethod: 'markRejected'
    }
  ])('uses the transaction-aware queue for $action', async ({ action, params, body, serviceMethod }) => {
    const current = {
      _id: requestId,
      title: 'Inspect pump',
      problemType: 'Inspection',
      priority: 'High',
      remarks: '',
      status: 'Open',
      sync_version: 0
    };
    const updated = { ...current, title: body.title || current.title, sync_version: 1 };
    vi.mocked(requestService.getAllRequests).mockResolvedValue([current] as never);
    vi.mocked(requestService.getRequestById).mockResolvedValue(updated as never);
    vi.mocked((requestService as any)[serviceMethod]).mockResolvedValue({ modifiedCount: 1 });
    const response = makeResponse();
    const next = vi.fn();

    await (requestController as any)[action](
      makeRequest({ params, body }),
      response,
      next
    );

    if (serviceMethod === 'updateRequest') {
      expect(requestService.updateRequest).toHaveBeenCalledWith(
        requestId,
        accountId,
        body,
        userId,
        session,
        undefined
      );
    } else if (serviceMethod === 'markApproved') {
      expect(requestService.markApproved).toHaveBeenCalledWith(
        requestId,
        accountId,
        userId,
        'High',
        session,
        undefined
      );
    } else {
      expect(requestService.markRejected).toHaveBeenCalledWith(
        requestId,
        accountId,
        userId,
        expect.stringContaining('Insufficient detail'),
        session,
        undefined
      );
    }
    expect(notificationService.queueAccountNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId,
        entityId: requestId,
        module: 'Work Request',
        event: 'updated'
      }),
      { session, correlationId: 'request-correlation-id' }
    );
    expect(notificationService.notifyAccountUsers).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });
});
