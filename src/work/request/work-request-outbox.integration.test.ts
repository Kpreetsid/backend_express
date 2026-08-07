import mongoose, { Types } from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { queueConfig } from '../../configDB';
import '../../models/account.model';
import '../../models/asset.model';
import '../../models/location.model';
import { OutboxEventModel } from '../../models/outboxEvent.model';
import '../../models/user.model';
import '../../models/workOrder.model';
import { WorkRequestModel } from '../../models/workRequest.model';
import { notificationService } from '../../utils/notification.service';
import { withTransaction } from '../../utils/transaction.helper';
import { requestService } from './request.service';

let replicaSet: MongoMemoryReplSet;

describe('work-request and notification outbox transaction', () => {
  const originalOutboxEnabled = queueConfig.domainEventOutboxEnabled;
  const accountId = new Types.ObjectId();
  const foreignAccountId = new Types.ObjectId();
  const userId = new Types.ObjectId();
  const foreignUserId = new Types.ObjectId();
  const locationId = new Types.ObjectId();

  const user = {
    _id: userId,
    account_id: accountId
  };
  const foreignUser = {
    _id: foreignUserId,
    account_id: foreignAccountId
  };
  const requestBody = {
    title: 'Inspect pump',
    problemType: 'Inspection',
    priority: 'High',
    location_id: locationId,
    files: []
  };

  beforeAll(async () => {
    replicaSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: 'wiredTiger' }
    });
    await mongoose.connect(replicaSet.getUri(), { dbName: 'cmms_work_request_outbox_test' });
    await Promise.all([
      WorkRequestModel.init(),
      OutboxEventModel.init()
    ]);
    queueConfig.domainEventOutboxEnabled = true;
  }, 120_000);

  beforeEach(async () => {
    await Promise.all([
      WorkRequestModel.deleteMany({}),
      OutboxEventModel.deleteMany({})
    ]);
  });

  afterAll(async () => {
    queueConfig.domainEventOutboxEnabled = originalOutboxEnabled;
    await mongoose.disconnect();
    await replicaSet.stop();
  });

  it('commits the business mutation and tenant event together', async () => {
    const created = await withTransaction(async (session) => {
      const workRequest = await requestService.createRequest(requestBody, user, session);
      await notificationService.queueAccountNotification({
        accountId: String(accountId),
        module: 'Work Request',
        event: 'created',
        entityId: String(workRequest._id),
        entityName: workRequest.title,
        actionUrl: '/work-request',
        queryParams: { id: String(workRequest._id) },
        sourceUserId: String(userId)
      }, { session, correlationId: 'work-request-integration-success' });
      return workRequest;
    });

    expect(await WorkRequestModel.countDocuments({ account_id: accountId })).toBe(1);
    const event = await OutboxEventModel.findOne({
      tenantId: String(accountId),
      type: 'notification.account.requested'
    }).lean();
    expect(event).toMatchObject({
      correlationId: 'work-request-integration-success',
      entity: {
        type: 'work-request',
        id: String(created._id)
      },
      payload: {
        accountId: String(accountId),
        entityId: String(created._id)
      }
    });
  });

  it('rolls back the work request when outbox persistence cannot complete', async () => {
    await expect(withTransaction(async (session) => {
      const workRequest = await requestService.createRequest(requestBody, user, session);
      await notificationService.queueAccountNotification({
        accountId: String(accountId),
        module: 'Work Request',
        event: 'created',
        entityId: String(workRequest._id),
        actionUrl: '/work-request',
        sourceUserId: String(userId)
      }, { session, correlationId: 'work-request-integration-rollback' });
      throw new Error('force work-request rollback');
    })).rejects.toThrow('force work-request rollback');

    expect(await WorkRequestModel.countDocuments({ account_id: accountId })).toBe(0);
    expect(await OutboxEventModel.countDocuments({ tenantId: String(accountId) })).toBe(0);
  });

  it('enforces tenant ownership again inside every reusable read/write boundary', async () => {
    const ownRequest = await requestService.createRequest(requestBody, user);
    const foreignRequest = await requestService.createRequest(
      { ...requestBody, title: 'Foreign request' },
      foreignUser
    );

    expect(await requestService.countRequests(accountId, {
      account_id: foreignAccountId
    })).toBe(1);
    const tenantList = await requestService.getAllRequests(accountId, {
      account_id: foreignAccountId,
      visible: false
    });
    expect(tenantList).toHaveLength(1);
    expect(String(tenantList[0]?._id)).toBe(String(ownRequest._id));
    expect(await requestService.getRequestById(
      String(foreignRequest._id),
      accountId
    )).toBeNull();

    const foreignUpdate = await requestService.updateRequest(
      String(foreignRequest._id),
      accountId,
      { title: 'Cross-tenant overwrite' },
      userId
    );
    expect(foreignUpdate.matchedCount).toBe(0);

    const foreignDelete = await requestService.deleteRequestById(
      String(foreignRequest._id),
      accountId,
      userId
    );
    expect(foreignDelete).toBeNull();

    const storedForeign = await WorkRequestModel.findById(foreignRequest._id).lean();
    expect(storedForeign).toMatchObject({
      account_id: foreignAccountId,
      title: 'Foreign request',
      visible: true
    });
    expect(await requestService.getRequestById(String(ownRequest._id), accountId))
      .toMatchObject({ title: 'Inspect pump' });
  });

  it('fails closed when a reusable query is called without an authenticated tenant', async () => {
    await expect(requestService.countRequests(undefined, {})).rejects.toMatchObject({
      status: 401,
      message: 'Authenticated account is required'
    });
  });

  it('strips server-owned tenant, version, visibility, and lifecycle fields from updates', async () => {
    const created = await requestService.createRequest(requestBody, user);
    const forgedApprovalDate = new Date('2020-01-01T00:00:00.000Z');

    const result = await requestService.updateRequest(
      String(created._id),
      accountId,
      {
        title: 'Updated safely',
        priority: 'Urgent',
        account_id: foreignAccountId,
        visible: false,
        sync_version: 999,
        createdBy: foreignUserId,
        approvedBy: foreignUserId,
        approvedAt: forgedApprovalDate,
        convertedBy: foreignUserId,
        convertedAt: forgedApprovalDate,
        converted_work_order_id: new Types.ObjectId(),
        converted_order_no: 'WO-FORGED',
        review_due_at: forgedApprovalDate,
        order_due_at: forgedApprovalDate
      },
      userId
    );

    expect(result.modifiedCount).toBe(1);
    const stored = await WorkRequestModel.findById(created._id).lean();
    expect(stored).toMatchObject({
      account_id: accountId,
      title: 'Updated safely',
      priority: 'Urgent',
      visible: true,
      sync_version: 1,
      createdBy: userId,
      review_sla_hours: 2,
      order_sla_hours: 8
    });
    expect(stored?.approvedAt).toBeUndefined();
    expect(stored?.approvedBy).toBeUndefined();
    expect(stored?.convertedAt).toBeUndefined();
    expect(stored?.converted_work_order_id).toBeUndefined();
    expect(stored?.review_due_at?.getTime()).toBeGreaterThan(Date.now());
  });

  it('persists approval, rejection, and conversion governance only through trusted methods', async () => {
    const approvedRequest = await requestService.createRequest(requestBody, user);
    const rejectedRequest = await requestService.createRequest(
      { ...requestBody, title: 'Reject this request', priority: 'Medium' },
      user
    );

    const approval = await requestService.markApproved(
      String(approvedRequest._id),
      accountId,
      userId,
      'High'
    );
    expect(approval.modifiedCount).toBe(1);

    const workOrderId = new Types.ObjectId();
    const conversion = await requestService.markConverted(
      String(approvedRequest._id),
      accountId,
      {
        workOrderId,
        orderNo: 'WO-2026-0001',
        priority: 'High',
        approvedBy: userId,
        convertedBy: userId
      }
    );
    expect(conversion.modifiedCount).toBe(1);

    const rejection = await requestService.markRejected(
      String(rejectedRequest._id),
      accountId,
      userId,
      'Insufficient detail'
    );
    expect(rejection.modifiedCount).toBe(1);

    const [converted, rejected] = await Promise.all([
      WorkRequestModel.findById(approvedRequest._id).lean(),
      WorkRequestModel.findById(rejectedRequest._id).lean()
    ]);
    expect(converted).toMatchObject({
      status: 'Approved',
      approvedBy: userId,
      convertedBy: userId,
      converted_work_order_id: workOrderId,
      converted_order_no: 'WO-2026-0001'
    });
    expect(converted?.approvedAt).toBeInstanceOf(Date);
    expect(converted?.convertedAt).toBeInstanceOf(Date);
    expect(converted?.order_due_at).toBeInstanceOf(Date);
    expect(rejected).toMatchObject({
      status: 'Rejected',
      rejectedBy: userId,
      remarks: 'Insufficient detail'
    });
    expect(rejected?.rejectedAt).toBeInstanceOf(Date);
  });

  it('returns a synchronization conflict without exposing a foreign-tenant record', async () => {
    const ownRequest = await requestService.createRequest(requestBody, user);
    const foreignRequest = await requestService.createRequest(
      { ...requestBody, title: 'Foreign version' },
      foreignUser
    );

    await expect(requestService.updateRequest(
      String(ownRequest._id),
      accountId,
      { title: 'Stale update' },
      userId,
      undefined,
      99
    )).rejects.toMatchObject({
      status: 412,
      data: expect.objectContaining({ account_id: accountId })
    });

    await expect(requestService.updateRequest(
      String(foreignRequest._id),
      accountId,
      { title: 'Tenant escape' },
      userId,
      undefined,
      0
    )).rejects.toMatchObject({
      status: 412,
      data: null
    });
  });
});
