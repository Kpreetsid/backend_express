import { beforeEach, describe, expect, it, vi } from 'vitest';
import { observationController } from './observation.controller';
import { observationService } from './observation.service';
import { notificationService } from '../../utils/notification.service';
import { withTransaction } from '../../utils/transaction.helper';
import { queueObservationAssetHealthSync } from '../../queue/processor-events';
import { synchronizeObservationAssetHealth } from '../../queue/handlers/observation-asset-health.handler';

vi.mock('./observation.service', () => ({
  observationService: {
    getAllObservation: vi.fn(),
    requireTenantReferences: vi.fn(),
    insertObservation: vi.fn(),
    updateObservationById: vi.fn(),
    removeObservationById: vi.fn()
  }
}));
vi.mock('../../utils/notification.service', () => ({
  notificationService: {
    queueAccountNotification: vi.fn(),
    notifyAccountUsers: vi.fn()
  }
}));
vi.mock('../../utils/transaction.helper', () => ({ withTransaction: vi.fn() }));
vi.mock('../../queue/processor-events', () => ({
  queueObservationAssetHealthSync: vi.fn()
}));
vi.mock('../../queue/handlers/observation-asset-health.handler', () => ({
  synchronizeObservationAssetHealth: vi.fn()
}));

describe('observation tenant and processor outbox boundary', () => {
  const accountId = '507f1f77bcf86cd799439011';
  const foreignAccountId = '507f1f77bcf86cd799439099';
  const userId = '507f1f77bcf86cd799439012';
  const observationId = '507f1f77bcf86cd799439013';
  const assetId = '507f1f77bcf86cd799439014';
  const locationId = '507f1f77bcf86cd799439015';
  const session = { id: 'observation-session' };
  const body = {
    observation: 'Bearing noise',
    recommendation: 'Inspect bearing',
    assetId,
    top_level_asset_id: assetId,
    locationId,
    status: 'Warning'
  };

  const response = () => {
    const value: any = {
      locals: { correlationId: 'observation-correlation' },
      status: vi.fn(),
      json: vi.fn()
    };
    value.status.mockReturnValue(value);
    return value;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(withTransaction).mockImplementation(async (operation: any) => operation(session));
    vi.mocked(observationService.requireTenantReferences).mockResolvedValue();
    vi.mocked(notificationService.queueAccountNotification).mockResolvedValue();
    vi.mocked(queueObservationAssetHealthSync).mockResolvedValue(true);
  });

  it('creates the observation and both events in the same transaction', async () => {
    const created = { _id: observationId, assetId, status: 'Warning' };
    const responseData = [{ ...created, observation: body.observation }];
    vi.mocked(observationService.insertObservation).mockResolvedValue(created as never);
    vi.mocked(observationService.getAllObservation).mockResolvedValue(responseData as never);
    const res = response();
    const next = vi.fn();

    await observationController.createObservation({
      user: { account_id: accountId, _id: userId },
      body: {
        ...body,
        accountId: foreignAccountId,
        userId: '507f1f77bcf86cd799439098',
        visible: false
      }
    } as any, res, next);

    expect(observationService.requireTenantReferences)
      .toHaveBeenCalledWith(body, accountId, session);
    expect(observationService.insertObservation).toHaveBeenCalledWith(
      body,
      accountId,
      userId,
      session
    );
    expect(queueObservationAssetHealthSync).toHaveBeenCalledWith({
      observationId,
      tenantId: accountId,
      actorId: userId,
      correlationId: 'observation-correlation'
    }, session);
    expect(notificationService.queueAccountNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId,
        entityId: observationId,
        event: 'created'
      }),
      { session, correlationId: 'observation-correlation' }
    );
    expect(notificationService.notifyAccountUsers).not.toHaveBeenCalled();
    expect(synchronizeObservationAssetHealth).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(next).not.toHaveBeenCalled();
  });

  it('tenant-scopes the update write and protects server-owned fields', async () => {
    const updated = { _id: observationId, assetId, status: 'Healthy' };
    vi.mocked(observationService.getAllObservation)
      .mockResolvedValueOnce([{ _id: observationId, assetId }] as never)
      .mockResolvedValueOnce([updated] as never);
    vi.mocked(observationService.updateObservationById).mockResolvedValue(updated as never);
    const res = response();
    const next = vi.fn();

    await observationController.updateObservation({
      user: { account_id: accountId, _id: userId },
      params: { id: observationId },
      body: {
        ...body,
        status: 'Healthy',
        accountId: foreignAccountId,
        createdBy: '507f1f77bcf86cd799439098'
      }
    } as any, res, next);

    expect(observationService.updateObservationById).toHaveBeenCalledWith(
      expect.anything(),
      { ...body, status: 'Healthy' },
      accountId,
      userId,
      session
    );
    expect(queueObservationAssetHealthSync).toHaveBeenCalledWith(
      expect.objectContaining({ observationId, tenantId: accountId }),
      session
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });

  it('does not mutate or emit when a referenced asset is outside the tenant', async () => {
    const failure = Object.assign(new Error('Observation asset or location not found'), {
      status: 404
    });
    vi.mocked(observationService.requireTenantReferences).mockRejectedValue(failure);
    const res = response();
    const next = vi.fn();

    await observationController.createObservation({
      user: { account_id: accountId, _id: userId },
      body
    } as any, res, next);

    expect(next).toHaveBeenCalledWith(failure);
    expect(observationService.insertObservation).not.toHaveBeenCalled();
    expect(queueObservationAssetHealthSync).not.toHaveBeenCalled();
    expect(notificationService.queueAccountNotification).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('does not emit a response or fallback call when outbox persistence fails', async () => {
    const failure = new Error('outbox unavailable');
    vi.mocked(observationService.insertObservation).mockResolvedValue({
      _id: observationId,
      assetId
    } as never);
    vi.mocked(queueObservationAssetHealthSync).mockRejectedValue(failure);
    const res = response();
    const next = vi.fn();

    await observationController.createObservation({
      user: { account_id: accountId, _id: userId },
      body
    } as any, res, next);

    expect(next).toHaveBeenCalledWith(failure);
    expect(notificationService.queueAccountNotification).not.toHaveBeenCalled();
    expect(synchronizeObservationAssetHealth).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
