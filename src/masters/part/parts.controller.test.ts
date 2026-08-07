import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./parts.service', () => ({
  partsService: {
    getAllParts: vi.fn(),
    getCycleCounts: vi.fn(),
    createCycleCount: vi.fn(),
    approveCycleCount: vi.fn(),
    getReplenishmentSuggestions: vi.fn(),
    getPartHistory: vi.fn(),
    insert: vi.fn(),
    importParts: vi.fn(),
    updatePartById: vi.fn(),
    updatePartStock: vi.fn(),
    removeById: vi.fn()
  }
}));
vi.mock('../../utils/helper', () => ({
  helperService: {
    validateObjectId: vi.fn((value: string) => `validated:${value}`),
    validateObjectIds: vi.fn((value: string) => value.split(',').filter(Boolean).map((id) => `validated:${id}`))
  }
}));
vi.mock('../../utils/roleFilter', () => ({
  applyRoleFilter: vi.fn(async ({ baseFilter }: any) => baseFilter)
}));
vi.mock('../../utils/sync-concurrency', () => ({
  assertSyncVersion: vi.fn(),
  getExpectedSyncVersion: vi.fn(() => 4),
  setSyncVersionEtag: vi.fn()
}));

import { partsController } from './parts.controller';
import { partsService } from './parts.service';
import { applyRoleFilter } from '../../utils/roleFilter';
import { assertSyncVersion, getExpectedSyncVersion, setSyncVersionEtag } from '../../utils/sync-concurrency';

describe('parts controller contract', () => {
  const accountId = '507f1f77bcf86cd799439011';
  const userId = '507f1f77bcf86cd799439012';
  const user = { account_id: accountId, _id: userId, user_role: 'manager' };
  const part = { _id: 'part-1', part_name: 'Bearing', sync_version: 4 };

  const request = (overrides: Record<string, unknown> = {}) => ({
    user, query: {}, params: {}, body: {}, ...overrides
  }) as any;
  const response = () => {
    const res: any = { status: vi.fn(), json: vi.fn() };
    res.status.mockReturnValue(res);
    return res;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(applyRoleFilter).mockImplementation(async ({ baseFilter }: any) => baseFilter);
    vi.mocked(partsService.getAllParts).mockResolvedValue([part] as never);
  });

  it('lists parts with validated tenant, identifier, location, and role scope', async () => {
    const res = response();
    await partsController.getParts(request({
      query: { id: 'part-1,part-2', location_id: 'loc-1,loc-2' }
    }), res, vi.fn());

    expect(applyRoleFilter).toHaveBeenCalledWith(expect.objectContaining({
      baseFilter: {
        account_id: accountId,
        visible: true,
        _id: { $in: ['validated:part-1', 'validated:part-2'] },
        location_id: { $in: ['validated:loc-1', 'validated:loc-2'] }
      },
      mapping: 'location'
    }));
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns not found when no tenant-scoped parts exist', async () => {
    vi.mocked(partsService.getAllParts).mockResolvedValue([] as never);
    const next = vi.fn();
    await partsController.getParts(request(), response(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'No parts found', status: 404 }));
  });

  it('normalizes cycle-count filters and delegates mutations to the authenticated tenant', async () => {
    vi.mocked(partsService.getCycleCounts).mockResolvedValue([{ id: 'count-1' }] as never);
    vi.mocked(partsService.createCycleCount).mockResolvedValue({ id: 'count-1' } as never);
    vi.mocked(partsService.approveCycleCount).mockResolvedValue({ id: 'count-1', status: 'rejected' } as never);
    const listRes = response();
    const createRes = response();
    const approveRes = response();

    await partsController.getCycleCounts(request({ query: {
      status: 'pending, approved,', part_id: 'part-1', location_id: 'loc-1'
    } }), listRes, vi.fn());
    await partsController.createCycleCount(request({ body: { part_id: 'part-1', counted_quantity: 5 } }), createRes, vi.fn());
    await partsController.approveCycleCount(request({
      params: { id: 'count-1' }, body: { decision: 'rejected', approval_notes: 'Mismatch' }
    }), approveRes, vi.fn());

    expect(partsService.getCycleCounts).toHaveBeenCalledWith({
      account_id: accountId,
      visible: true,
      status: { $in: ['pending', 'approved'] },
      part_id: { $in: ['validated:part-1'] },
      location_id: { $in: ['validated:loc-1'] }
    });
    expect(partsService.createCycleCount).toHaveBeenCalledWith(
      { part_id: 'part-1', counted_quantity: 5 }, accountId, user
    );
    expect(partsService.approveCycleCount).toHaveBeenCalledWith(
      'count-1', 'rejected', accountId, user, 'Mismatch'
    );
    expect(createRes.status).toHaveBeenCalledWith(201);
  });

  it('defaults cycle-count decisions to approved and returns replenishment suggestions', async () => {
    vi.mocked(partsService.approveCycleCount).mockResolvedValue({ status: 'approved' } as never);
    vi.mocked(partsService.getReplenishmentSuggestions).mockResolvedValue([{ part_id: 'part-1' }] as never);
    const approveRes = response();
    const suggestionsRes = response();
    await partsController.approveCycleCount(request({ params: { id: 'count-1' }, body: {} }), approveRes, vi.fn());
    await partsController.getReplenishmentSuggestions(request(), suggestionsRes, vi.fn());

    expect(partsService.approveCycleCount).toHaveBeenCalledWith('count-1', 'approved', accountId, user, undefined);
    expect(partsService.getReplenishmentSuggestions).toHaveBeenCalledWith(accountId);
  });

  it('fetches one role-scoped part, its ETag, and tenant history', async () => {
    vi.mocked(partsService.getPartHistory).mockResolvedValue([{ action: 'created' }] as never);
    const partRes = response();
    const historyRes = response();
    await partsController.getPart(request({ params: { id: 'part-1' } }), partRes, vi.fn());
    await partsController.getPartHistory(request({ params: { id: 'part-1' } }), historyRes, vi.fn());

    expect(applyRoleFilter).toHaveBeenCalledWith(expect.objectContaining({
      baseFilter: { _id: 'validated:part-1', account_id: accountId, visible: true }
    }));
    expect(setSyncVersionEtag).toHaveBeenCalledWith(partRes, part);
    expect(partsService.getPartHistory).toHaveBeenCalledWith('part-1', accountId);
  });

  it('creates a part and returns populated data when available', async () => {
    vi.mocked(partsService.insert).mockResolvedValue({ _id: 'part-1' } as never);
    const res = response();
    await partsController.createPart(request({ body: { part_name: 'Bearing' } }), res, vi.fn());

    expect(partsService.insert).toHaveBeenCalledWith({ part_name: 'Bearing' }, accountId, user);
    expect(partsService.getAllParts).toHaveBeenCalledWith({ _id: 'part-1' });
    expect(setSyncVersionEtag).toHaveBeenCalledWith(res, part);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it.each([
    ['[{"part_name":"Bearing"}]', [{ part_name: 'Bearing' }]],
    [[{ part_name: 'Seal' }], [{ part_name: 'Seal' }]]
  ])('imports normalized part data and returns uploaded-file evidence', async (rawParts, normalized) => {
    vi.mocked(partsService.importParts).mockResolvedValue({ imported: 1, failed: 0, total: 1 } as never);
    const res = response();
    await partsController.importParts(request({
      body: { parts: rawParts },
      file: { originalname: 'parts.csv', filename: 'stored.csv', path: 'tmp/stored.csv', size: 10, mimetype: 'text/csv' }
    }), res, vi.fn());

    expect(partsService.importParts).toHaveBeenCalledWith(normalized, accountId, userId);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      status: true,
      message: 'Successfully imported 1 parts.',
      file: expect.objectContaining({ originalName: 'parts.csv', fileName: 'stored.csv' })
    }));
  });

  it('rejects an import without valid rows', async () => {
    const next = vi.fn();
    await partsController.importParts(request({ body: { parts: [] } }), response(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Import file contains no valid parts data', status: 400
    }));
  });

  it('updates a part only after tenant existence and optimistic-concurrency checks', async () => {
    vi.mocked(partsService.updatePartById).mockResolvedValue({ _id: 'part-1' } as never);
    const res = response();
    const req = request({ params: { id: 'part-1' }, body: { part_name: 'Bearing B' } });
    await partsController.updatePart(req, res, vi.fn());

    expect(getExpectedSyncVersion).toHaveBeenCalledWith(req);
    expect(assertSyncVersion).toHaveBeenCalledWith(part, 4);
    expect(partsService.updatePartById).toHaveBeenCalledWith(
      'part-1', { part_name: 'Bearing B' }, user, accountId, 4
    );
    expect(setSyncVersionEtag).toHaveBeenCalledWith(res, part);
  });

  it('updates stock after validating the source part', async () => {
    vi.mocked(partsService.updatePartStock).mockResolvedValue(part as never);
    const res = response();
    await partsController.updateStock(request({
      params: { id: 'part-1' }, body: { mode: 'add', quantity: 2 }
    }), res, vi.fn());

    expect(partsService.updatePartStock).toHaveBeenCalledWith(
      'part-1', { mode: 'add', quantity: 2 }, user, accountId
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('transfers stock and returns fresh source and destination records', async () => {
    vi.mocked(partsService.updatePartStock).mockResolvedValue(part as never);
    vi.mocked(partsService.getAllParts)
      .mockResolvedValueOnce([part] as never)
      .mockResolvedValueOnce([part] as never)
      .mockResolvedValueOnce([{ _id: 'part-2' }] as never);
    const res = response();
    await partsController.transferStock(request({
      params: { id: 'part-1' },
      body: { destination_part_id: 'part-2', quantity: 3, note: 'Rebalance' }
    }), res, vi.fn());

    expect(partsService.updatePartStock).toHaveBeenCalledWith('part-1', {
      mode: 'transfer', quantity: 3, note: 'Rebalance', destination_part_id: 'part-2'
    }, user, accountId);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      data: { source: part, destination: { _id: 'part-2' } }
    }));
  });

  it('removes only an existing tenant-scoped part', async () => {
    vi.mocked(partsService.removeById).mockResolvedValue(part as never);
    const res = response();
    await partsController.removePart(request({ params: { id: 'part-1' } }), res, vi.fn());

    expect(partsService.removeById).toHaveBeenCalledWith('part-1', userId);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('forwards service errors without writing a partial response', async () => {
    const failure = new Error('database unavailable');
    vi.mocked(partsService.getAllParts).mockRejectedValue(failure);
    const res = response();
    const next = vi.fn();
    await partsController.getParts(request(), res, next);

    expect(next).toHaveBeenCalledWith(failure);
    expect(res.status).not.toHaveBeenCalled();
  });
});
