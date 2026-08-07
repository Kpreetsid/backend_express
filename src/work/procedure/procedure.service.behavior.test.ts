import mongoose from 'mongoose';
import { afterEach, describe, expect, it, vi } from 'vitest';

const tenantReferences = vi.hoisted(() => ({ require: vi.fn().mockResolvedValue(undefined) }));

vi.mock('../../utils/tenant-references', () => ({
  requireTenantReferenceIds: tenantReferences.require
}));

import { AssetModel } from '../../models/asset.model';
import { LocationModel } from '../../models/location.model';
import { PartsModel } from '../../models/part.model';
import { ProcedureModel } from '../../models/procedure.model';
import { procedureService } from './procedure.service';

const service = procedureService as any;
const objectId = (suffix: string) => new mongoose.Types.ObjectId(`907f1f77bcf86cd7994390${suffix}`);
const leanQuery = (value: any) => ({ lean: vi.fn().mockResolvedValue(value) });
const sortedLeanQuery = (value: any) => ({
  sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(value) })
});

describe('procedure service behavior and tenant boundaries', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    tenantReferences.require.mockClear();
  });

  it('returns sorted current procedures by default and can include version history', async () => {
    const accountId = objectId('11');
    const find = vi.spyOn(ProcedureModel, 'find')
      .mockReturnValueOnce(sortedLeanQuery([{ _id: objectId('12') }]) as any)
      .mockReturnValueOnce(sortedLeanQuery([{ _id: objectId('13') }]) as any);
    const enrich = vi.spyOn(service, 'enrichProcedures')
      .mockResolvedValueOnce([{ id: 'current' }])
      .mockResolvedValueOnce([{ id: 'history' }]);

    await expect(procedureService.getAllProcedures({ account_id: accountId, category: 'Safety' }))
      .resolves.toEqual([{ id: 'current' }]);
    await expect(procedureService.getAllProcedures({ account_id: accountId }, { includeHistory: true }))
      .resolves.toEqual([{ id: 'history' }]);

    expect(find.mock.calls[0]![0]).toEqual({
      account_id: accountId,
      category: 'Safety',
      visible: true,
      is_latest: true
    });
    expect(find.mock.calls[1]![0]).toEqual({ account_id: accountId, visible: true });
    expect(enrich).toHaveBeenNthCalledWith(1, expect.any(Array), accountId, undefined);
    expect(enrich).toHaveBeenNthCalledWith(2, expect.any(Array), accountId, true);
  });

  it('returns null for an unknown tenant procedure and enriches a known procedure', async () => {
    const procedureId = objectId('14');
    const accountId = objectId('15');
    const findOne = vi.spyOn(ProcedureModel, 'findOne')
      .mockReturnValueOnce(leanQuery(null) as any)
      .mockReturnValueOnce(leanQuery({ _id: procedureId, name: 'Known' }) as any);
    const enrich = vi.spyOn(service, 'enrichProcedures')
      .mockResolvedValue([{ id: String(procedureId), name: 'Known' }]);

    await expect(procedureService.getProcedureById(String(procedureId), accountId)).resolves.toBeNull();
    await expect(procedureService.getProcedureById(String(procedureId), accountId))
      .resolves.toMatchObject({ id: String(procedureId), name: 'Known' });

    expect(findOne.mock.calls[0]![0]).toEqual({ _id: procedureId, account_id: accountId, visible: true });
    expect(enrich).toHaveBeenCalledOnce();
  });

  it('normalizes procedure inputs and validates references before creating version one', async () => {
    const accountId = objectId('16');
    const userId = objectId('17');
    const procedureId = objectId('18');
    const locationId = objectId('19');
    const assetId = objectId('20');
    const partId = objectId('21');
    const requireReferences = vi.spyOn(service, 'requireTenantReferences').mockResolvedValue(undefined);
    const create = vi.spyOn(ProcedureModel, 'create').mockResolvedValue({ _id: procedureId } as any);
    vi.spyOn(procedureService, 'getProcedureById').mockResolvedValue({ id: String(procedureId) });

    await expect(procedureService.createProcedure({
      name: 'Pump inspection',
      tags: [' Safety ', 'safety', '', 'PM'],
      location_ids: [locationId, String(locationId)],
      asset_ids: [assetId],
      required_parts: [
        { part_id: partId, part_name: ' Seal ', quantity: '2', unit: ' EA ' },
        { part_id: partId, part_name: 'Duplicate', quantity: 3 },
        { part_name: 'Invalid quantity', quantity: 0 }
      ],
      steps: 'invalid'
    }, accountId, userId)).resolves.toEqual({ id: String(procedureId) });

    expect(requireReferences).toHaveBeenCalledWith(expect.objectContaining({
      location_ids: [locationId],
      asset_ids: [assetId],
      required_parts: [expect.objectContaining({ part_id: partId, part_name: 'Seal', quantity: 2, unit: 'EA' })]
    }), accountId);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      account_id: accountId,
      name: 'Pump inspection',
      category: '',
      tags: ['Safety', 'PM'],
      description: '',
      steps: [],
      version: 1,
      is_latest: true,
      version_notes: '',
      createdBy: userId,
      updatedBy: userId
    }));
  });

  it('returns null when an update cannot find a visible procedure in the tenant', async () => {
    const procedureId = objectId('22');
    const accountId = objectId('23');
    vi.spyOn(ProcedureModel, 'findOne').mockReturnValue(leanQuery(null) as any);
    const create = vi.spyOn(ProcedureModel, 'create');

    await expect(procedureService.updateProcedure(String(procedureId), {}, accountId, objectId('24')))
      .resolves.toBeNull();
    expect(create).not.toHaveBeenCalled();
  });

  it('creates a new version and supersedes only visible versions in the same tenant group', async () => {
    const procedureId = objectId('25');
    const versionGroupId = objectId('26');
    const createdId = objectId('27');
    const accountId = objectId('28');
    const userId = objectId('29');
    const locationId = objectId('30');
    const assetId = objectId('31');
    const partId = objectId('32');
    vi.spyOn(ProcedureModel, 'findOne').mockReturnValue(leanQuery({
      _id: procedureId,
      version_group_id: versionGroupId,
      version: 2,
      name: 'Existing',
      category: 'PM',
      tags: ['old'],
      location_ids: [locationId],
      asset_ids: [assetId],
      description: 'Existing description',
      required_parts: [{ part_id: partId, part_name: 'Seal', quantity: 1 }],
      steps: [{ title: 'Step one' }]
    }) as any);
    vi.spyOn(service, 'requireTenantReferences').mockResolvedValue(undefined);
    const create = vi.spyOn(ProcedureModel, 'create').mockResolvedValue({ _id: createdId } as any);
    const updateMany = vi.spyOn(ProcedureModel, 'updateMany').mockResolvedValue({ modifiedCount: 2 } as any);
    vi.spyOn(procedureService, 'getProcedureById').mockResolvedValue({ id: String(createdId), version: 3 });

    await expect(procedureService.updateProcedure(String(procedureId), {
      name: 'Updated',
      category: '',
      tags: [' New ', 'new'],
      description: '',
      steps: 'invalid',
      version_notes: 'Revision'
    }, accountId, userId)).resolves.toMatchObject({ version: 3 });

    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      account_id: accountId,
      name: 'Updated',
      category: '',
      tags: ['New'],
      location_ids: [locationId],
      asset_ids: [assetId],
      description: '',
      steps: [],
      version_group_id: versionGroupId,
      version: 3,
      is_latest: true,
      version_notes: 'Revision',
      supersedes_id: procedureId,
      createdBy: userId,
      updatedBy: userId
    }));
    expect(updateMany).toHaveBeenCalledWith(
      {
        account_id: accountId,
        visible: true,
        version_group_id: versionGroupId,
        _id: { $ne: createdId }
      },
      { is_latest: false, updatedBy: userId }
    );
  });

  it('uses the prior record identifier as the version group when legacy data has no group', async () => {
    const procedureId = objectId('33');
    const createdId = objectId('34');
    const accountId = objectId('35');
    const userId = objectId('36');
    vi.spyOn(ProcedureModel, 'findOne').mockReturnValue(leanQuery({
      _id: procedureId,
      version: 0,
      name: 'Legacy',
      category: '',
      tags: null,
      location_ids: null,
      asset_ids: null,
      description: '',
      required_parts: null,
      steps: null
    }) as any);
    vi.spyOn(service, 'requireTenantReferences').mockResolvedValue(undefined);
    const create = vi.spyOn(ProcedureModel, 'create').mockResolvedValue({ _id: createdId } as any);
    const updateMany = vi.spyOn(ProcedureModel, 'updateMany').mockResolvedValue({ modifiedCount: 1 } as any);
    vi.spyOn(procedureService, 'getProcedureById').mockResolvedValue({ id: String(createdId) });

    await procedureService.updateProcedure(String(procedureId), {}, accountId, userId);

    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      version_group_id: procedureId,
      version: 2,
      tags: [],
      location_ids: [],
      asset_ids: [],
      required_parts: [],
      steps: []
    }));
    expect(updateMany.mock.calls[0]![0]).toMatchObject({ account_id: accountId, version_group_id: procedureId });
  });

  it('soft-deletes the complete tenant version group and leaves unknown records unchanged', async () => {
    const procedureId = objectId('37');
    const versionGroupId = objectId('38');
    const accountId = objectId('39');
    const userId = objectId('40');
    const findOne = vi.spyOn(ProcedureModel, 'findOne')
      .mockReturnValueOnce(leanQuery(null) as any)
      .mockReturnValueOnce(leanQuery({ _id: procedureId, version_group_id: versionGroupId }) as any);
    const updateMany = vi.spyOn(ProcedureModel, 'updateMany').mockResolvedValue({ modifiedCount: 2 } as any);

    await expect(procedureService.removeProcedure(String(procedureId), accountId, userId)).resolves.toBeNull();
    await expect(procedureService.removeProcedure(String(procedureId), accountId, userId))
      .resolves.toMatchObject({ modifiedCount: 2 });

    expect(findOne.mock.calls[0]![0]).toEqual({ _id: procedureId, account_id: accountId, visible: true });
    expect(updateMany).toHaveBeenCalledWith(
      { account_id: accountId, visible: true, version_group_id: versionGroupId },
      { visible: false, updatedBy: userId }
    );
  });

  it('enriches tenant-owned references, inventory, version statistics, and history', async () => {
    const accountId = objectId('41');
    const procedureId = objectId('42');
    const versionGroupId = objectId('43');
    const locationId = objectId('44');
    const assetId = objectId('45');
    const partId = objectId('46');
    vi.spyOn(LocationModel, 'find').mockReturnValue(leanQuery([{ _id: locationId, location_name: 'Plant' }]) as any);
    vi.spyOn(AssetModel, 'find').mockReturnValue(leanQuery([{
      _id: assetId,
      asset_name: 'Pump',
      locationId
    }]) as any);
    vi.spyOn(PartsModel, 'find').mockReturnValue(leanQuery([{
      _id: partId,
      part_name: 'Inventory Seal',
      part_number: 'S-1',
      barcode: 'BAR-1',
      unit: 'EA',
      quantity: 10,
      min_quantity: 2,
      reorder_point: 4,
      location_id: locationId
    }]) as any);
    vi.spyOn(ProcedureModel, 'aggregate').mockResolvedValue([{
      _id: versionGroupId,
      version_count: 3,
      latest_version: 3
    }] as any);
    vi.spyOn(ProcedureModel, 'find').mockReturnValue(sortedLeanQuery([{
      _id: procedureId,
      name: 'Pump inspection',
      version_group_id: versionGroupId,
      version: 3,
      version_notes: null,
      is_latest: 1
    }]) as any);

    const [result] = await service.enrichProcedures([{
      _id: procedureId,
      version_group_id: versionGroupId,
      version: 3,
      location_ids: [locationId],
      asset_ids: [assetId],
      required_parts: [{ part_id: partId, quantity: 2, notes: 'Use new stock' }]
    }], accountId, true);

    expect(result).toMatchObject({
      id: String(procedureId),
      location_ids: [String(locationId)],
      asset_ids: [String(assetId)],
      locations: [{ id: String(locationId), name: 'Plant' }],
      assets: [{ id: String(assetId), name: 'Pump', location_id: String(locationId) }],
      version_group_id: String(versionGroupId),
      version_count: 3,
      latest_version: 3,
      version_history: [expect.objectContaining({
        id: String(procedureId),
        version: 3,
        version_notes: '',
        is_latest: true
      })]
    });
    expect(result.required_parts[0]).toMatchObject({
      part_id: String(partId),
      part_name: 'Inventory Seal',
      part_number: 'S-1',
      barcode: 'BAR-1',
      quantity: 2,
      unit: 'EA',
      notes: 'Use new stock',
      inventory: {
        id: String(partId),
        quantity: 10,
        min_quantity: 2,
        reorder_point: 4,
        location_id: String(locationId)
      }
    });
  });

  it('keeps empty enrichment deterministic and validates each reference family', async () => {
    const accountId = objectId('47');
    await expect(service.enrichProcedures([], accountId)).resolves.toEqual([]);

    await service.requireTenantReferences({
      location_ids: [objectId('48')],
      asset_ids: [objectId('49')],
      required_parts: [{ part_id: objectId('50') }]
    }, accountId);

    expect(tenantReferences.require).toHaveBeenCalledTimes(3);
    expect(tenantReferences.require).toHaveBeenCalledWith(expect.objectContaining({
      accountId,
      label: 'Location',
      model: LocationModel
    }));
    expect(tenantReferences.require).toHaveBeenCalledWith(expect.objectContaining({ label: 'Asset', model: AssetModel }));
    expect(tenantReferences.require).toHaveBeenCalledWith(expect.objectContaining({ label: 'Part', model: PartsModel }));
  });

  it('normalizes manual parts and falls back safely when optional data is absent', async () => {
    const accountId = objectId('51');
    const procedureId = objectId('52');
    vi.spyOn(ProcedureModel, 'aggregate').mockResolvedValue([] as any);

    const parts = service.normalizeRequiredParts([
      { part_name: ' Manual ', part_number: ' M-1 ', estimatedQuantity: '3', notes: ' note ' },
      { part_name: ' Manual ', part_number: ' M-1 ', estimatedQuantity: 4 },
      null
    ]);
    expect(parts).toEqual([expect.objectContaining({
      part_id: undefined,
      part_name: 'Manual',
      part_number: 'M-1',
      quantity: 3,
      notes: 'note'
    })]);

    const [result] = await service.enrichProcedures([{
      _id: procedureId,
      version: 2,
      location_ids: [],
      asset_ids: [],
      required_parts: [{ part_name: 'Manual', quantity: '1' }]
    }], accountId, false);
    expect(result).toMatchObject({
      id: String(procedureId),
      locations: [],
      assets: [],
      version_group_id: String(procedureId),
      version_count: 1,
      latest_version: 2,
      required_parts: [expect.objectContaining({
        part_id: '',
        part_name: 'Manual',
        quantity: 1,
        inventory: null
      })]
    });
    expect(result.version_history).toBeUndefined();
  });
});
