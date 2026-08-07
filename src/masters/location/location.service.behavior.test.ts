import mongoose from 'mongoose';
import { afterEach, describe, expect, it, vi } from 'vitest';

const dependencies = vi.hoisted(() => ({
  session: { id: 'location-session' },
  updateLocationAssetMapping: vi.fn().mockResolvedValue(undefined),
  getAssetsMappedData: vi.fn().mockResolvedValue([]),
  removeAssetListMapping: vi.fn().mockResolvedValue(undefined),
  getLocationsMappedData: vi.fn().mockResolvedValue([]),
  removeLocationListMapping: vi.fn().mockResolvedValue(undefined),
  getDataByLocationId: vi.fn().mockResolvedValue([]),
  mapUserLocationData: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../../utils/transaction.helper', () => ({
  withTransaction: async (callback: (session: any) => Promise<any>, existing?: any) =>
    callback(existing || dependencies.session)
}));

vi.mock('../../transaction/mapUserAsset/userAsset.service', () => ({
  updateLocationAssetMapping: dependencies.updateLocationAssetMapping,
  mapUserToAssetService: {
    getAssetsMappedData: dependencies.getAssetsMappedData,
    removeAssetListMapping: dependencies.removeAssetListMapping
  }
}));

vi.mock('../../transaction/mapUserLocation/userLocation.service', () => ({
  mapUserToLocationService: {
    getLocationsMappedData: dependencies.getLocationsMappedData,
    removeLocationListMapping: dependencies.removeLocationListMapping,
    getDataByLocationId: dependencies.getDataByLocationId,
    mapUserLocationData: dependencies.mapUserLocationData
  }
}));

import { AssetModel } from '../../models/asset.model';
import { InspectionModel } from '../../models/inspection.model';
import { LocationModel } from '../../models/location.model';
import { MapUserAssetLocationModel } from '../../models/mapUserLocation.model';
import { ObservationModel } from '../../models/observation.model';
import { PartsModel } from '../../models/part.model';
import { SchedulerModel } from '../../models/scheduleMaster.model';
import { SOPsModel } from '../../models/sops.model';
import { WorkOrderModel } from '../../models/workOrder.model';
import { WorkRequestModel } from '../../models/workRequest.model';
import { locationService } from './location.service';

const objectId = (suffix: string) => new mongoose.Types.ObjectId(`907f1f77bcf86cd7994390${suffix}`);
const leanQuery = (value: any) => ({ lean: vi.fn().mockResolvedValue(value) });
const sessionQuery = (value: any) => ({ session: vi.fn().mockResolvedValue(value) });

describe('location service hierarchy and tenant behavior', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    Object.values(dependencies).forEach(value => {
      if (typeof value === 'function' && 'mockClear' in value) {
        (value as any).mockClear();
      }
    });
  });

  it('returns lean location lists and user-enriched location contracts', async () => {
    const locationId = objectId('11');
    const user = { _id: objectId('12'), firstName: 'Assigned' };
    const find = vi.spyOn(LocationModel, 'find')
      .mockReturnValueOnce(leanQuery([{ _id: locationId }]) as any)
      .mockReturnValueOnce({
        populate: vi.fn().mockResolvedValue([{
          _id: locationId,
          location_name: 'Plant',
          toObject: () => ({ _id: locationId, location_name: 'Plant' })
        }])
      } as any);
    vi.spyOn(MapUserAssetLocationModel, 'find').mockReturnValue({
      populate: vi.fn().mockResolvedValue([
        { locationId, userId: user },
        { locationId, userId: null }
      ])
    } as any);

    await expect(locationService.getLocationsList({ account_id: objectId('13') }))
      .resolves.toEqual([{ _id: locationId }]);
    await expect(locationService.getAllLocations({ account_id: objectId('13') }))
      .resolves.toEqual([{ id: locationId, location_name: 'Plant', userList: [user] }]);
    expect(find).toHaveBeenCalledTimes(2);
  });

  it('builds role-filtered trees and recursively enumerates child identifiers', async () => {
    const rootId = objectId('14');
    const childId = objectId('15');
    const hiddenId = objectId('16');
    const find = vi.spyOn(LocationModel, 'find');
    find
      .mockReturnValueOnce(leanQuery([{ _id: childId }, { _id: hiddenId }]) as any)
      .mockReturnValueOnce(leanQuery([]) as any);

    await expect(locationService.buildLocationTree(
      String(rootId), objectId('17'), [String(childId)], 'technician'
    )).resolves.toEqual([{ _id: childId, childs: [] }]);

    find.mockReset();
    find
      .mockReturnValueOnce(leanQuery([{ _id: childId }]) as any)
      .mockReturnValueOnce(leanQuery([{ _id: hiddenId }]) as any)
      .mockReturnValueOnce(leanQuery([]) as any);
    await expect(locationService.getAllChildLocationIds(String(rootId)))
      .resolves.toEqual([String(rootId), String(childId), String(hiddenId)]);
  });

  it('rejects empty or unauthorized roots and returns authorized trees', async () => {
    const rootId = objectId('18');
    const accountId = objectId('19');
    vi.spyOn(LocationModel, 'find')
      .mockReturnValueOnce(leanQuery([]) as any)
      .mockReturnValueOnce(leanQuery([{ _id: rootId, id: String(rootId), location_name: 'Plant' }]) as any)
      .mockReturnValueOnce(leanQuery([{ _id: rootId, id: String(rootId), location_name: 'Plant' }]) as any);

    await expect(locationService.getTree({ account_id: accountId }, null, [], 'admin'))
      .rejects.toMatchObject({ message: 'No records found', status: 404 });
    await expect(locationService.getTree({ account_id: accountId }, String(rootId), [], 'technician'))
      .rejects.toMatchObject({ message: 'No access to this location', status: 403 });

    const build = vi.spyOn(locationService, 'buildLocationTree').mockResolvedValue([{ id: 'child' }]);
    await expect(locationService.getTree(
      { account_id: accountId }, String(rootId), [String(rootId)], 'technician'
    )).resolves.toEqual([expect.objectContaining({ _id: rootId, childs: [{ id: 'child' }] })]);
    expect(build).toHaveBeenCalledWith(String(rootId), accountId, [String(rootId)], 'technician');
  });

  it('groups KPI locations by hierarchy level and fails closed for missing mappings', async () => {
    const rootId = objectId('20');
    const childId = objectId('21');
    const grandchildId = objectId('22');
    vi.spyOn(LocationModel, 'find').mockReturnValue(leanQuery([
      { _id: rootId, location_name: 'Plant' },
      { _id: childId, parent_id: rootId, location_name: 'Floor' },
      { _id: grandchildId, parent_id: childId, location_name: 'Line' }
    ]) as any);

    await expect(locationService.kpiFilterLocations(objectId('23'), objectId('24'), 'admin'))
      .resolves.toEqual({
        levelOneLocations: [{ id: String(rootId), location_name: 'Plant' }],
        levelTwoLocations: [{ id: String(childId), location_name: 'Floor' }],
        levelThreeLocations: [{ id: String(grandchildId), location_name: 'Line' }]
      });

    dependencies.getLocationsMappedData.mockResolvedValueOnce([]);
    await expect(locationService.kpiFilterLocations(objectId('23'), objectId('24'), 'technician'))
      .resolves.toBeNull();
  });

  it('returns tenant assets and locations for selected hierarchy with user scope', async () => {
    const locationId = objectId('25');
    const childId = objectId('26');
    const assetId = objectId('27');
    vi.spyOn(locationService, 'getAllChildLocationsRecursive').mockResolvedValue([String(locationId), String(childId)]);
    dependencies.getAssetsMappedData.mockResolvedValueOnce([{ assetId }]);
    const assetFind = vi.spyOn(AssetModel, 'find').mockReturnValue({
      select: vi.fn().mockResolvedValue([{ _id: assetId, asset_name: 'Pump' }])
    } as any);
    vi.spyOn(LocationModel, 'aggregate').mockResolvedValue([{ _id: locationId, name: 'Plant' }] as any);

    const result = await locationService.childAssetsAgainstLocation(
      [String(locationId)], [String(childId)], objectId('28'), objectId('29'), 'technician'
    );

    expect(result).toEqual({
      assetList: [{ _id: assetId, asset_name: 'Pump' }],
      locationList: [{ _id: locationId, name: 'Plant' }]
    });
    expect(assetFind.mock.calls[0]![0]).toMatchObject({
      visible: true,
      _id: { $in: [assetId] }
    });
  });

  it('contains hierarchy lookup failures and deduplicates recursive descendants', async () => {
    const rootId = objectId('30');
    const childId = objectId('31');
    const grandchildId = objectId('32');
    vi.spyOn(LocationModel, 'findById')
      .mockResolvedValueOnce({ _id: rootId } as any)
      .mockResolvedValueOnce({ _id: childId } as any)
      .mockResolvedValueOnce({ _id: grandchildId } as any);
    vi.spyOn(LocationModel, 'find')
      .mockResolvedValueOnce([{ _id: childId }] as any)
      .mockResolvedValueOnce([{ _id: grandchildId }] as any)
      .mockResolvedValueOnce([] as any);

    await expect(locationService.getAllChildLocationsRecursive([String(rootId)]))
      .resolves.toEqual([String(rootId), String(childId), String(grandchildId)]);

    vi.restoreAllMocks();
    vi.spyOn(LocationModel, 'findById').mockRejectedValue(new Error('database unavailable'));
    await expect(locationService.getAllChildLocationsRecursive([String(rootId)])).resolves.toEqual([]);
  });

  it('creates top-level locations and updates tenant-pinned records with session ownership', async () => {
    const accountId = objectId('33');
    const userId = objectId('34');
    const parentId = objectId('35');
    const save = vi.spyOn(LocationModel.prototype, 'save').mockImplementation(async function (this: any) { return this; });

    const created: any = await locationService.insertLocation({
      location_name: 'Plant',
      top_level: true,
      account_id: accountId,
      createdBy: userId
    }, dependencies.session as any);
    expect(created.top_level_location_id).toEqual(created._id);
    expect(save).toHaveBeenCalledWith({ session: dependencies.session });

    vi.spyOn(LocationModel, 'updateOne').mockResolvedValue({ modifiedCount: 1 } as any);
    vi.spyOn(LocationModel, 'findOne').mockReturnValue(sessionQuery({ _id: parentId, location_name: 'Updated' }) as any);
    await expect(locationService.updateById(String(parentId), {
      location_name: 'Updated',
      userIdList: [userId]
    }, accountId, dependencies.session as any)).resolves.toMatchObject({ location_name: 'Updated' });
    expect(dependencies.updateLocationAssetMapping).toHaveBeenCalledWith(
      String(parentId), [userId], [], [], dependencies.session
    );
  });

  it('soft-deletes a location hierarchy and every dependent resource in one transaction', async () => {
    const rootId = objectId('36');
    const childId = objectId('37');
    const assetId = objectId('38');
    const userId = objectId('39');
    vi.spyOn(locationService, 'getAllChildLocationsRecursive').mockResolvedValue([String(rootId), String(childId)]);
    vi.spyOn(AssetModel, 'find').mockReturnValue(sessionQuery([{ _id: assetId }]) as any);
    const models = [
      AssetModel, WorkOrderModel, ObservationModel, PartsModel, WorkRequestModel,
      InspectionModel, SOPsModel, SchedulerModel, LocationModel
    ];
    const updateSpies = models.map(model => vi.spyOn(model, 'updateMany').mockResolvedValue({ modifiedCount: 1 } as any));

    await expect(locationService.removeLocationById(rootId, userId)).resolves.toBe(true);

    expect(dependencies.removeLocationListMapping).toHaveBeenCalledWith(
      [rootId, String(rootId), String(childId)], dependencies.session
    );
    expect(dependencies.removeAssetListMapping).toHaveBeenCalledWith([assetId], dependencies.session);
    updateSpies.forEach(spy => expect(spy).toHaveBeenCalledOnce());
  });

  it('maps sensor locations and preserves tenant-scoped image/detail contracts', async () => {
    const accountId = objectId('40');
    const locationId = objectId('41');
    const userId = objectId('42');
    const find = vi.spyOn(LocationModel, 'find').mockReturnValue({
      populate: vi.fn().mockResolvedValue([{
        _id: locationId,
        location_name: 'Plant',
        account_id: { account_name: 'CMMS' },
        top_level_location_id: { _id: locationId, location_name: 'Plant' }
      }])
    } as any);

    await expect(locationService.getLocationSensor(accountId, userId, 'admin')).resolves.toEqual([{
      company_name: 'CMMS',
      location_id: locationId,
      location_name: 'Plant',
      top_level_location_id: locationId,
      top_level_location_name: 'Plant'
    }]);
    expect(find).toHaveBeenCalledWith({ account_id: accountId, visible: true });

    const update = vi.spyOn(LocationModel, 'updateOne').mockResolvedValue({ modifiedCount: 1 } as any);
    await locationService.updateFloorMapImage(String(locationId), accountId, userId, 'floor.png');
    expect(update).toHaveBeenCalledWith(
      { _id: String(locationId), account_id: accountId },
      { $set: { top_level_location_image: 'floor.png', updatedBy: userId } }
    );

    const findOne = vi.spyOn(LocationModel, 'findOne').mockReturnValue({ _id: locationId } as any);
    expect(locationService.getLocationById(locationId, accountId)).toEqual({ _id: locationId });
    expect(findOne).toHaveBeenCalledWith({ _id: locationId, account_id: accountId, visible: true });
  });

  it('recursively enumerates tenant hierarchy and clones a mapped top-level node', async () => {
    const sourceId = objectId('43');
    const childId = objectId('44');
    const accountId = objectId('45');
    const userId = objectId('46');
    vi.spyOn(LocationModel, 'find')
      .mockReturnValueOnce(leanQuery([{ _id: childId }]) as any)
      .mockReturnValueOnce(leanQuery([]) as any);
    await expect(locationService.getAllChildHierarchy(sourceId, accountId))
      .resolves.toEqual([{ _id: childId }]);

    dependencies.getDataByLocationId.mockResolvedValueOnce([{ userId }]);
    vi.spyOn(LocationModel, 'countDocuments').mockReturnValue({
      session: vi.fn().mockResolvedValue(1)
    } as any);
    const save = vi.spyOn(LocationModel.prototype, 'save').mockImplementation(async function (this: any) { return this; });
    const clonedId = await locationService.cloneLocationNode({
      _id: sourceId,
      location_name: 'Plant - copy',
      top_level: true,
      account_id: accountId
    }, userId, accountId, undefined, {}, undefined, dependencies.session);

    expect(clonedId).toEqual(expect.any(mongoose.Types.ObjectId));
    expect(save).toHaveBeenCalledTimes(2);
    expect(dependencies.mapUserLocationData).toHaveBeenCalledWith(
      clonedId, [userId], accountId, dependencies.session
    );
  });
});
