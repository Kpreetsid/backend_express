import mongoose from 'mongoose';
import { afterEach, describe, expect, it, vi } from 'vitest';

const transaction: { session: any } = vi.hoisted(() => ({ session: { id: 'equipment-session' } }));

vi.mock('../../utils/transaction.helper', () => ({
  withTransaction: async (callback: (session: any) => Promise<any>, existing?: any) =>
    callback(existing || transaction.session)
}));

import { AssetModel } from '../../models/asset.model';
import { LocationModel } from '../../models/location.model';
import { MapUserAssetLocationModel } from '../../models/mapUserLocation.model';
import { mapUserToAssetService } from '../../transaction/mapUserAsset/userAsset.service';
import { mapUserToLocationService } from '../../transaction/mapUserLocation/userLocation.service';
import { assetService } from '../asset/asset.service';
import { equipmentService } from './equipment.service';

const objectId = (suffix: string) => new mongoose.Types.ObjectId(`707f1f77bcf86cd7994390${suffix}`);
const sessionQuery = (value: any) => ({ session: vi.fn().mockResolvedValue(value) });
const sessionThenable = (value: any) => {
  const query: any = Promise.resolve(value);
  query.session = vi.fn().mockReturnValue(query);
  return query;
};

describe('equipment service behavior and tenant boundaries', () => {
  afterEach(() => vi.restoreAllMocks());

  it('builds user-enriched flat and hierarchical equipment contracts', async () => {
    const rootId = objectId('11');
    const childId = objectId('12');
    const user = { _id: objectId('13'), firstName: 'Assigned' };
    const assets = [
      {
        _id: rootId,
        locationId: { _id: objectId('14'), location_name: 'Plant' },
        toObject: () => ({ _id: rootId, locationId: { _id: objectId('14'), location_name: 'Plant' } })
      },
      {
        _id: childId,
        parent_id: { _id: rootId, asset_name: 'Pump' },
        toObject: () => ({ _id: childId, parent_id: { _id: rootId, asset_name: 'Pump' } })
      }
    ];
    vi.spyOn(AssetModel, 'find').mockReturnValueOnce({ populate: vi.fn().mockResolvedValue(assets) } as any);
    vi.spyOn(MapUserAssetLocationModel, 'find').mockReturnValueOnce({
      populate: vi.fn().mockResolvedValue([{ assetId: childId, userId: user }])
    } as any);

    const flat = await equipmentService.getAllEquipment({ account_id: objectId('15') });
    expect(flat).toEqual([
      expect.objectContaining({ id: String(rootId), locationId: expect.objectContaining({ id: objectId('14') }), userList: [] }),
      expect.objectContaining({ id: String(childId), parent_id: expect.objectContaining({ id: rootId }), userList: [user] })
    ]);

    const tree = await equipmentService.buildEquipmentTree([
      { _id: rootId, asset_name: 'Pump' },
      { _id: childId, parent_id: rootId, asset_name: 'Motor' }
    ], [{ assetId: childId, user }]);
    expect(tree).toEqual([
      expect.objectContaining({
        id: String(rootId),
        childs: [expect.objectContaining({ id: String(childId), userList: [user], childs: [] })]
      })
    ]);
  });

  it('recurses through child identifiers and rejects an empty equipment tree', async () => {
    const rootId = objectId('16');
    const childId = objectId('17');
    const grandchildId = objectId('18');
    const find = vi.spyOn(AssetModel, 'find');
    find
      .mockReturnValueOnce({ select: vi.fn().mockResolvedValue([{ _id: childId }]) } as any)
      .mockReturnValueOnce({ select: vi.fn().mockResolvedValue([{ _id: grandchildId }]) } as any)
      .mockReturnValueOnce({ select: vi.fn().mockResolvedValue([]) } as any);
    await expect(equipmentService.getAllChildEquipmentIDs(rootId))
      .resolves.toEqual([rootId, childId, grandchildId]);

    find.mockReturnValueOnce({ lean: vi.fn().mockResolvedValue([]) } as any);
    await expect(equipmentService.getEquipmentTreeData({ account_id: objectId('19') }))
      .rejects.toMatchObject({ message: 'No records found', status: 404 });
  });

  it('requires tenant-owned locations/assets and removes only nullish payload fields', async () => {
    expect(equipmentService.removeExtraFields({ keepZero: 0, keepFalse: false, keepEmpty: '', dropNull: null, dropUndefined: undefined }))
      .toEqual({ keepZero: 0, keepFalse: false, keepEmpty: '' });

    const locationCount = vi.spyOn(LocationModel, 'countDocuments');
    locationCount.mockReturnValueOnce(sessionThenable(1));
    await expect(equipmentService.requireTenantLocation(objectId('20'), objectId('21'), transaction.session))
      .resolves.toBeUndefined();
    locationCount.mockResolvedValueOnce(0 as any);
    await expect(equipmentService.requireTenantLocation(objectId('20'), objectId('22')))
      .rejects.toMatchObject({ message: 'Equipment location not found', status: 404 });

    const exists = vi.spyOn(AssetModel, 'exists');
    exists.mockReturnValueOnce(sessionThenable({ _id: objectId('23') }));
    await expect(equipmentService.requireTenantAssetForUpdate(objectId('23'), objectId('24'), transaction.session))
      .resolves.toBeUndefined();
    exists.mockResolvedValueOnce(null);
    await expect(equipmentService.requireTenantAssetForUpdate(objectId('23'), objectId('25')))
      .rejects.toMatchObject({ message: 'Equipment asset not found', status: 404 });
  });

  it('creates every supported equipment subtype with stable defaults and session ownership', async () => {
    const parentId = objectId('26');
    const accountId = objectId('27');
    const userId = objectId('28');
    const locationId = objectId('29');
    const save = vi.spyOn(AssetModel.prototype, 'save').mockImplementation(async function (this: any) { return this; });
    const parent = { _id: parentId, id: String(parentId), asset_id: 'EQ-1', asset_timezone: 'UTC', locationId };

    const created = await Promise.all([
      equipmentService.createEquipment({ asset_name: 'Equipment', locationId, nullable: null }, accountId, userId, transaction.session),
      equipmentService.createMotor({ asset_name: 'Motor' }, parent, accountId, userId, transaction.session),
      equipmentService.createFlexible({ asset_name: 'Coupling' }, parent, accountId, userId, transaction.session),
      equipmentService.createRigid({ asset_name: 'Shaft' }, parent, accountId, userId, transaction.session),
      equipmentService.createBeltPulley({ asset_name: 'Belt' }, parent, accountId, userId, transaction.session),
      equipmentService.createGearbox({ asset_name: 'Gearbox' }, parent, accountId, userId, transaction.session),
      equipmentService.createFanBlower({ asset_name: 'Fan' }, parent, accountId, userId, transaction.session),
      equipmentService.createPumps({ asset_name: 'Pump' }, parent, accountId, userId, transaction.session),
      equipmentService.createCompressor({ asset_name: 'Compressor' }, parent, accountId, userId, transaction.session)
    ]);

    expect(created.map((asset: any) => asset.asset_type)).toEqual([
      'Equipment', 'Motor', 'Flexible', 'Rigid', 'Belt_Pulley', 'Gearbox', 'Fan_Blower', 'Pumps', 'Compressor'
    ]);
    expect(created[0]).toMatchObject({ top_level: true, top_level_asset_id: created[0]._id, account_id: accountId, createdBy: userId });
    for (const asset of created.slice(1) as any[]) {
      expect(asset).toMatchObject({ parent_id: parentId, top_level: false, account_id: accountId, createdBy: userId });
    }
    expect(save).toHaveBeenCalledTimes(9);
    expect(save).toHaveBeenCalledWith({ session: transaction.session });
  });

  it('updates every supported subtype through tenant-pinned filters and mapping cleanup', async () => {
    const accountId = objectId('30');
    const userId = objectId('31');
    const locationId = objectId('32');
    const parentId = objectId('33');
    const parent = { id: String(parentId), _id: parentId, asset_id: 'EQ-1', asset_timezone: 'UTC', locationId };
    const requireTenant = vi.spyOn(equipmentService, 'requireTenantAssetForUpdate').mockResolvedValue(undefined);
    const removeMapping = vi.spyOn(mapUserToAssetService, 'removeAssetMapping').mockResolvedValue({} as any);
    const update = vi.spyOn(AssetModel, 'findOneAndUpdate').mockImplementation((filter: any, body: any) => ({
      lean: vi.fn().mockResolvedValue({ filter, body })
    }) as any);
    const payload = (id: number, asset_name: string) => ({ id: String(objectId(String(id))), asset_name, nullable: null });

    const results = await Promise.all([
      equipmentService.updateEquipment({ ...payload(34, 'Equipment'), locationId }, accountId, userId, transaction.session as any),
      equipmentService.updateMotor(payload(35, 'Motor'), parent, accountId, userId, transaction.session as any),
      equipmentService.updateFlexible(payload(36, 'Coupling'), parent, accountId, userId, transaction.session as any),
      equipmentService.updateRigid(payload(37, 'Shaft'), parent, accountId, userId, transaction.session as any),
      equipmentService.updateBeltPulley(payload(38, 'Belt'), parent, accountId, userId, transaction.session as any),
      equipmentService.updateGearbox(payload(39, 'Gearbox'), parent, accountId, userId, transaction.session as any),
      equipmentService.updateFanBlower(payload(40, 'Fan'), parent, accountId, userId, transaction.session as any),
      equipmentService.updatePumps(payload(41, 'Pump'), parent, accountId, userId, transaction.session as any),
      equipmentService.updateCompressor(payload(42, 'Compressor'), parent, accountId, userId, transaction.session as any)
    ]);

    expect(results).toHaveLength(9);
    expect(requireTenant).toHaveBeenCalledTimes(9);
    expect(removeMapping).toHaveBeenCalledTimes(9);
    expect(update).toHaveBeenCalledTimes(9);
    for (const [filter, body, options] of update.mock.calls) {
      expect(filter).toMatchObject({ account_id: accountId, visible: true });
      expect(body).toHaveProperty('$set.updatedBy', userId);
      expect(options).toEqual({ new: true, session: transaction.session });
    }
  });

  it('delegates image updates and recursive copy without changing their public contracts', async () => {
    const accountId = objectId('43');
    vi.spyOn(AssetModel, 'findOneAndUpdate').mockResolvedValue({ image_path: 'new.png' } as any);
    await expect(equipmentService.updateEquipmentImageById(
      String(objectId('44')), 'new.png', accountId, String(objectId('45')), transaction.session as any
    )).resolves.toMatchObject({ image_path: 'new.png' });

    const copy = vi.spyOn(assetService, 'makeAssetCopyRecursive').mockResolvedValue({ id: 'copy' } as any);
    await expect(equipmentService.makeAssetCopyRecursive(
      String(objectId('46')), objectId('47'), accountId, objectId('48'), transaction.session, 'correlation'
    )).resolves.toEqual({ id: 'copy' });
    expect(copy).toHaveBeenCalledWith(
      expect.any(String), expect.any(mongoose.Types.ObjectId), accountId,
      expect.any(mongoose.Types.ObjectId), transaction.session, 'correlation'
    );
  });

  it('builds tree responses from tenant-scoped aggregate data and rejects unknown roots', async () => {
    const rootId = objectId('49');
    const childId = objectId('50');
    vi.spyOn(AssetModel, 'aggregate')
      .mockResolvedValueOnce([{ _id: rootId }, { _id: childId, parent_id: rootId }] as any)
      .mockResolvedValueOnce([] as any);
    vi.spyOn(MapUserAssetLocationModel, 'aggregate').mockResolvedValue([
      { assetId: childId, user: { id: objectId('51'), firstName: 'Assigned' } }
    ] as any);
    await expect(equipmentService.getEquipmentTreeDataById({ _id: rootId }))
      .resolves.toEqual([
        expect.objectContaining({
          id: String(rootId),
          childs: [expect.objectContaining({ id: String(childId), userList: [expect.objectContaining({ firstName: 'Assigned' })] })]
        })
      ]);
    await expect(equipmentService.getEquipmentTreeDataById({ _id: objectId('52') }))
      .rejects.toMatchObject({ message: 'No records found', status: 404 });
  });

  it('soft-deletes and hard-deletes equipment with dependent mapping cleanup', async () => {
    const rootId = objectId('53');
    const childId = objectId('54');
    const find = vi.spyOn(AssetModel, 'find');
    find
      .mockReturnValueOnce(sessionQuery([{ _id: childId }]) as any)
      .mockReturnValueOnce(sessionQuery([{ _id: childId }]) as any);
    const updateMany = vi.spyOn(AssetModel, 'updateMany').mockResolvedValue({ modifiedCount: 1 } as any);
    const findOneAndUpdate = vi.spyOn(AssetModel, 'findOneAndUpdate').mockResolvedValue({ _id: rootId, visible: false } as any);
    const removeLocation = vi.spyOn(mapUserToLocationService, 'removeLocationMapping').mockResolvedValue({} as any);
    const removeAsset = vi.spyOn(mapUserToAssetService, 'removeAssetMapping').mockResolvedValue({} as any);
    const deleteMany = vi.spyOn(AssetModel, 'deleteMany').mockResolvedValue({ deletedCount: 1 } as any);
    const deleteOne = vi.spyOn(AssetModel, 'deleteOne').mockResolvedValue({ deletedCount: 1 } as any);

    await expect(equipmentService.removeEquipmentById({ _id: rootId }, objectId('55')))
      .resolves.toMatchObject({ visible: false });
    expect(updateMany).toHaveBeenCalledOnce();
    expect(removeLocation).toHaveBeenCalledWith(rootId, transaction.session);
    expect(findOneAndUpdate).toHaveBeenCalledOnce();

    await expect(equipmentService.deleteEquipment(String(rootId)))
      .resolves.toEqual({ deletedCount: 1 });
    expect(removeAsset).toHaveBeenCalledTimes(2);
    expect(deleteMany).toHaveBeenCalledOnce();
    expect(deleteOne).toHaveBeenCalledOnce();
  });

  it('deletes child asset sets and recursively enumerates tenant-owned descendants', async () => {
    const rootId = objectId('56');
    const childId = objectId('57');
    const grandchildId = objectId('58');
    const find = vi.spyOn(AssetModel, 'find');
    find
      .mockReturnValueOnce({ lean: vi.fn().mockResolvedValue([{ _id: childId }]) } as any)
      .mockReturnValueOnce({ lean: vi.fn().mockResolvedValue([{ _id: grandchildId }]) } as any)
      .mockReturnValueOnce({ lean: vi.fn().mockResolvedValue([]) } as any);
    await expect(equipmentService.getAllChildEquipmentRecursive(String(rootId), objectId('59')))
      .resolves.toEqual([{ _id: childId }, { _id: grandchildId }]);

    const deleteMany = vi.spyOn(AssetModel, 'deleteMany').mockResolvedValue({ deletedCount: 2 } as any);
    vi.spyOn(mapUserToAssetService, 'removeAssetMapping').mockResolvedValue({} as any);
    find.mockReturnValueOnce(sessionQuery([{ _id: childId }, { _id: grandchildId }]) as any);
    await equipmentService.deleteAssetsById(rootId);
    expect(deleteMany).toHaveBeenCalledTimes(2);

    await expect(equipmentService.deleteEquipmentAssetIds([String(childId), String(grandchildId)]))
      .resolves.toEqual({ deletedCount: 2 });
  });
});
