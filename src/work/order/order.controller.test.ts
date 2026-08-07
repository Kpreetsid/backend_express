import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./order.service', () => ({
  orderService: {
    buildSearchMatch: vi.fn(),
    getAllOrders: vi.fn(),
    getPaginatedWorkOrders: vi.fn(),
    createWorkOrder: vi.fn(),
    updateById: vi.fn(),
    orderStatusChange: vi.fn(),
    removeOrder: vi.fn(),
    updateDataById: vi.fn(),
    orderStatus: vi.fn(),
    orderPriority: vi.fn(),
    monthlyCount: vi.fn(),
    plannedUnplanned: vi.fn(),
    summaryData: vi.fn(),
    overviewSummaryData: vi.fn(),
    createdVsCompleted: vi.fn(),
    executionSummaryData: vi.fn(),
    onTimeVsOverdue: vi.fn(),
    timeToComplete: vi.fn(),
    workOrdersByType: vi.fn(),
    workOrderSourceMix: vi.fn(),
    assetMaintenanceReport: vi.fn(),
    requestFunnelReport: vi.fn(),
    partsImpactReport: vi.fn(),
    completedWithInspectionReport: vi.fn(),
    completedByUserReport: vi.fn(),
    timeVsCostReport: vi.fn(),
    plannerReadinessReport: vi.fn(),
    repeatingWorkOrdersReport: vi.fn(),
    getHistory: vi.fn(),
    getActivity: vi.fn()
  }
}));

vi.mock('../../utils/helper', () => ({
  helperService: { validateObjectId: vi.fn((value: string) => `validated:${value}`) }
}));

vi.mock('../../utils/sync-concurrency', () => ({
  getExpectedSyncVersion: vi.fn(() => 7),
  setSyncVersionEtag: vi.fn()
}));

vi.mock('../../upload/upload.multer', () => ({
  uploadFilesService: { persistMultipartFiles: vi.fn() }
}));

vi.mock('../../_config/storage', () => ({
  storageProvider: {
    getSignedURL: vi.fn(),
    getURL: vi.fn()
  }
}));

import { orderController } from './order.controller';
import { orderService } from './order.service';
import { helperService } from '../../utils/helper';
import { getExpectedSyncVersion, setSyncVersionEtag } from '../../utils/sync-concurrency';
import { uploadFilesService } from '../../upload/upload.multer';
import { storageProvider } from '../../_config/storage';

describe('work-order controller contract', () => {
  const accountId = '507f1f77bcf86cd799439011';
  const userId = '507f1f77bcf86cd799439012';
  const user = { account_id: accountId, _id: userId, user_role: 'manager' };
  const match = { account_id: accountId, visible: true };
  const data = [{ id: 'order-1' }];

  const response = () => {
    const res: any = {
      locals: { correlationId: 'corr-1' },
      status: vi.fn(),
      json: vi.fn(),
      send: vi.fn()
    };
    res.status.mockReturnValue(res);
    return res;
  };

  const request = (overrides: Record<string, unknown> = {}) => ({
    user,
    query: {},
    body: {},
    params: {},
    ...overrides
  }) as any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(orderService.buildSearchMatch).mockResolvedValue({ ...match } as never);
    vi.mocked(orderService.getAllOrders).mockResolvedValue(data as never);
    vi.mocked(orderService.getPaginatedWorkOrders).mockResolvedValue({ data, totalItems: 250 } as never);
    vi.mocked(storageProvider.getSignedURL!).mockResolvedValue('signed-url');
  });

  it('lists all work orders using the authenticated tenant and user scope', async () => {
    const res = response();
    const next = vi.fn();
    await orderController.getAll(request({ query: { status: 'Open' } }), res, next);

    expect(orderService.buildSearchMatch).toHaveBeenCalledWith({
      account_id: accountId,
      user_id: userId,
      user_role: 'manager',
      query: { status: 'Open' }
    });
    expect(orderService.getAllOrders).toHaveBeenCalledWith(match);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: true, data }));
    expect(next).not.toHaveBeenCalled();
  });

  it('normalizes paginated list inputs and returns additive pagination metadata', async () => {
    const res = response();
    await orderController.getAllWorkOrders(
      request({ query: { page: '2', limit: '500', pageType: 'kanban', status: 'Open' } }),
      res,
      vi.fn()
    );

    expect(orderService.buildSearchMatch).toHaveBeenCalledWith(expect.objectContaining({
      account_id: accountId,
      query: expect.objectContaining({ pageTYPE: 'kanban', status: 'Open' })
    }));
    expect(orderService.getPaginatedWorkOrders).toHaveBeenCalledWith(
      match,
      expect.objectContaining({ pageTYPE: 'kanban' }),
      100,
      100
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      pagination: {
        page: 2,
        limit: 100,
        totalItems: 250,
        totalPages: 3,
        hasNextPage: true,
        hasPrevPage: true
      },
      data
    }));
  });

  it('uses safe pagination defaults when values are invalid and the result is empty', async () => {
    vi.mocked(orderService.getPaginatedWorkOrders).mockResolvedValue({ data: [], totalItems: 0 } as never);
    const res = response();
    await orderController.getAllWorkOrders(
      request({ query: { page: '-3', limit: 'invalid' } }),
      res,
      vi.fn()
    );

    expect(orderService.getPaginatedWorkOrders).toHaveBeenCalledWith(match, expect.any(Object), 0, 15);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      pagination: expect.objectContaining({ page: 1, limit: 15, totalPages: 0, hasNextPage: false, hasPrevPage: false })
    }));
  });

  it('fetches one tenant-scoped order and exposes its synchronization ETag', async () => {
    const res = response();
    await orderController.getOrderById(request({ params: { id: 'order-1' } }), res, vi.fn());

    expect(helperService.validateObjectId).toHaveBeenCalledWith('order-1');
    expect(orderService.getAllOrders).toHaveBeenCalledWith({
      _id: 'validated:order-1', account_id: accountId, visible: true
    });
    expect(setSyncVersionEtag).toHaveBeenCalledWith(res, data);
  });

  it('creates an order with authenticated actor and correlation context', async () => {
    const created = { id: 'order-1', sync_version: 1 };
    vi.mocked(orderService.createWorkOrder).mockResolvedValue(created as never);
    const res = response();
    await orderController.createOrder(request({ body: { title: 'Inspect pump' } }), res, vi.fn());

    expect(orderService.createWorkOrder).toHaveBeenCalledWith({ title: 'Inspect pump' }, user, 'corr-1');
    expect(setSyncVersionEtag).toHaveBeenCalledWith(res, created);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('uses an empty correlation fallback when request context is unavailable', async () => {
    vi.mocked(orderService.createWorkOrder).mockResolvedValue({ id: 'order-1' } as never);
    const res = response();
    res.locals = {};
    await orderController.createOrder(request({ body: { title: 'Inspect pump' } }), res, vi.fn());

    expect(orderService.createWorkOrder).toHaveBeenCalledWith({ title: 'Inspect pump' }, user, '');
  });

  it('updates an order with optimistic concurrency and correlation context', async () => {
    const updated = { id: 'order-1', sync_version: 8 };
    vi.mocked(orderService.updateById).mockResolvedValue(updated as never);
    const res = response();
    const req = request({ params: { id: 'order-1' }, body: { title: 'Updated' } });
    await orderController.updateOrder(req, res, vi.fn());

    expect(getExpectedSyncVersion).toHaveBeenCalledWith(req);
    expect(orderService.updateById).toHaveBeenCalledWith('order-1', { title: 'Updated' }, user, 7, 'corr-1');
    expect(setSyncVersionEtag).toHaveBeenCalledWith(res, updated);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('updates status with block reason and optimistic concurrency', async () => {
    const updated = { id: 'order-1', status: 'Blocked' };
    vi.mocked(orderService.orderStatusChange).mockResolvedValue(updated as never);
    const res = response();
    await orderController.statusUpdateOrder(
      request({ params: { id: 'order-1' }, body: { status: 'Blocked', block_reason: 'Permit' } }),
      res,
      vi.fn()
    );

    expect(orderService.orderStatusChange).toHaveBeenCalledWith(
      'order-1', 'Blocked', user, 'Permit', 7, 'corr-1'
    );
    expect(setSyncVersionEtag).toHaveBeenCalledWith(res, updated);
  });

  it('rejects an empty submission update before reaching the service', async () => {
    const next = vi.fn();
    await orderController.updateOrderSubmitData(
      request({ params: { id: 'order-1' }, body: {} }),
      response(),
      next
    );

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      message: 'No data provided for update', status: 400
    }));
    expect(orderService.updateById).not.toHaveBeenCalled();
  });

  it('validates the identifier for a non-empty submission update', async () => {
    vi.mocked(orderService.updateById).mockResolvedValue({ id: 'order-1' } as never);
    const res = response();
    await orderController.updateOrderSubmitData(
      request({ params: { id: 'order-1' }, body: { status: 'Open' } }),
      res,
      vi.fn()
    );

    expect(orderService.updateById).toHaveBeenCalledWith(
      'validated:order-1', { status: 'Open' }, user, 7, 'corr-1'
    );
    expect(setSyncVersionEtag).toHaveBeenCalled();
  });

  it('deletes only the validated work-order identifier', async () => {
    const res = response();
    await orderController.remove(request({ params: { id: 'order-1' } }), res, vi.fn());

    expect(orderService.removeOrder).toHaveBeenCalledWith('validated:order-1', user);
    expect(res.send).toHaveBeenCalledWith({ status: true, message: 'Work order deleted successfully.' });
  });

  it('rejects attachment requests without files', async () => {
    const next = vi.fn();
    await orderController.uploadAttachments(
      request({ params: { id: 'order-1', folderName: 'orders' }, files: [] }),
      response(),
      next
    );

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'No files uploaded', status: 400 }));
    expect(uploadFilesService.persistMultipartFiles).not.toHaveBeenCalled();
  });

  it('persists attachments under the authenticated tenant and stores signed metadata', async () => {
    const existing = { files: [{ fileName: 'old.pdf' }] };
    vi.mocked(orderService.getAllOrders).mockResolvedValue([existing] as never);
    vi.mocked(uploadFilesService.persistMultipartFiles).mockResolvedValue([{
      originalname: 'inspection.pdf',
      mimetype: 'application/pdf',
      destination: 'tmp',
      filename: 'stored.pdf',
      path: 'tmp/stored.pdf',
      size: 42
    }] as never);
    const res = response();
    await orderController.uploadAttachments(
      request({ params: { id: 'order-1', folderName: 'orders' }, files: [{ filename: 'upload.tmp' }] }),
      res,
      vi.fn()
    );

    expect(uploadFilesService.persistMultipartFiles).toHaveBeenCalledWith(
      [{ filename: 'upload.tmp' }], 'orders', accountId, userId
    );
    expect(storageProvider.getSignedURL).toHaveBeenCalledWith('stored.pdf', 'orders');
    expect(orderService.updateDataById).toHaveBeenCalledWith(
      'order-1',
      { files: [existing.files[0], expect.objectContaining({ fileName: 'stored.pdf', fileUrl: 'signed-url', size: 42 })] },
      user
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('falls back to the storage URL when signed URLs are unavailable', async () => {
    const signedUrl = storageProvider.getSignedURL;
    (storageProvider as any).getSignedURL = undefined;
    vi.mocked(storageProvider.getURL).mockReturnValue('public-url');
    vi.mocked(orderService.getAllOrders).mockResolvedValue([{ files: [] }] as never);
    vi.mocked(uploadFilesService.persistMultipartFiles).mockResolvedValue([{
      originalname: 'photo.jpg', mimetype: 'image/jpeg', destination: 'tmp',
      filename: 'stored.jpg', path: 'tmp/stored.jpg', size: 12
    }] as never);

    try {
      await orderController.uploadAttachments(
        request({ params: { id: 'order-1', folderName: 'orders' }, files: [{}] }),
        response(),
        vi.fn()
      );
      expect(storageProvider.getURL).toHaveBeenCalledWith('stored.jpg', 'orders');
      expect(orderService.updateDataById).toHaveBeenCalledWith(
        'order-1',
        { files: [expect.objectContaining({ fileUrl: 'public-url' })] },
        user
      );
    } finally {
      (storageProvider as any).getSignedURL = signedUrl;
    }
  });

  const simpleAnalytics: Array<[string, keyof typeof orderService]> = [
    ['getOrderStatus', 'orderStatus'],
    ['getOrderPriority', 'orderPriority'],
    ['getMonthlyCount', 'monthlyCount'],
    ['getPlannedUnplanned', 'plannedUnplanned'],
    ['getSummaryData', 'summaryData'],
    ['getByType', 'workOrdersByType'],
    ['getSourceMix', 'workOrderSourceMix'],
    ['getAssetMaintenance', 'assetMaintenanceReport']
  ];

  it.each(simpleAnalytics)('%s applies tenant/user search scope before aggregation', async (controllerMethod, serviceMethod) => {
    vi.mocked((orderService as any)[serviceMethod]).mockResolvedValue(data);
    const res = response();
    await (orderController as any)[controllerMethod](request({ body: { location_id: 'loc-1' } }), res, vi.fn());

    expect(orderService.buildSearchMatch).toHaveBeenCalledWith({
      account_id: accountId,
      user_id: userId,
      user_role: 'manager',
      query: { location_id: 'loc-1' }
    });
    expect((orderService as any)[serviceMethod]).toHaveBeenCalledWith(match);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  const rangedAnalytics: Array<[string, keyof typeof orderService]> = [
    ['getOverviewSummary', 'overviewSummaryData'],
    ['getCreatedVsCompleted', 'createdVsCompleted'],
    ['getExecutionSummary', 'executionSummaryData'],
    ['getOnTimeVsOverdue', 'onTimeVsOverdue'],
    ['getTimeToComplete', 'timeToComplete'],
    ['getRequestFunnel', 'requestFunnelReport'],
    ['getPartsImpact', 'partsImpactReport'],
    ['getCompletedWithInspection', 'completedWithInspectionReport'],
    ['getCompletedByUser', 'completedByUserReport'],
    ['getTimeVsCost', 'timeVsCostReport'],
    ['getPlannerReadiness', 'plannerReadinessReport'],
    ['getRepeatingWorkOrders', 'repeatingWorkOrdersReport']
  ];

  it.each(rangedAnalytics)('%s separates date range from tenant-scoped filters', async (controllerMethod, serviceMethod) => {
    vi.mocked((orderService as any)[serviceMethod]).mockResolvedValue(data);
    const res = response();
    await (orderController as any)[controllerMethod](request({
      body: { fromDate: '2026-01-01', toDate: '2026-01-31', asset_id: 'asset-1' }
    }), res, vi.fn());

    expect(orderService.buildSearchMatch).toHaveBeenCalledWith(expect.objectContaining({
      account_id: accountId,
      query: { asset_id: 'asset-1' }
    }));
    expect((orderService as any)[serviceMethod]).toHaveBeenCalledWith(
      match,
      { fromDate: '2026-01-01', toDate: '2026-01-31' }
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('pins pending work orders to the non-terminal status set', async () => {
    const res = response();
    await orderController.getPendingOrders(request({ body: { location_id: 'loc-1' } }), res, vi.fn());

    expect(orderService.getAllOrders).toHaveBeenCalledWith({
      ...match,
      status: { $in: ['Open', 'Blocked', 'Waiting-on-Parts', 'Waiting-on-Permit', 'In-Progress', 'On-Hold'] }
    });
  });

  it('returns work-order history and tenant-scoped activity', async () => {
    vi.mocked(orderService.getHistory).mockResolvedValue([{ action: 'created' }] as never);
    vi.mocked(orderService.getActivity).mockResolvedValue([{ action: 'updated' }] as never);
    const historyRes = response();
    const activityRes = response();

    await orderController.getHistory(request({ params: { id: 'order-1' } }), historyRes, vi.fn());
    await orderController.getActivity(request({ params: { id: 'order-1' } }), activityRes, vi.fn());

    expect(orderService.getHistory).toHaveBeenCalledWith('order-1');
    expect(orderService.getActivity).toHaveBeenCalledWith('order-1', accountId);
    expect(historyRes.status).toHaveBeenCalledWith(200);
    expect(activityRes.status).toHaveBeenCalledWith(200);
  });

  it('forwards service failures to the shared error handler', async () => {
    const failure = new Error('database unavailable');
    vi.mocked(orderService.getAllOrders).mockRejectedValue(failure);
    const res = response();
    const next = vi.fn();
    await orderController.getAll(request(), res, next);

    expect(next).toHaveBeenCalledWith(failure);
    expect(res.status).not.toHaveBeenCalled();
  });

  it.each([
    ['createOrder', 'createWorkOrder'],
    ['updateOrder', 'updateById'],
    ['getOrderStatus', 'orderStatus'],
    ['getOverviewSummary', 'overviewSummaryData']
  ])('%s forwards downstream failures without writing a response', async (controllerMethod, serviceMethod) => {
    const failure = new Error(`${serviceMethod} failed`);
    vi.mocked((orderService as any)[serviceMethod]).mockRejectedValue(failure);
    const res = response();
    const next = vi.fn();

    await (orderController as any)[controllerMethod](request(), res, next);

    expect(next).toHaveBeenCalledWith(failure);
    expect(res.status).not.toHaveBeenCalled();
  });
});
