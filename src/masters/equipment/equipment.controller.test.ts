import { beforeEach, describe, expect, it, vi } from 'vitest';
import { equipmentController } from './equipment.controller';
import { equipmentService } from './equipment.service';
import { mapUserToAssetService } from '../../transaction/mapUserAsset/userAsset.service';
import { uploadFilesService } from '../../upload/upload.multer';
import { notificationService } from '../../utils/notification.service';
import { requireActiveTenantUsers } from '../../utils/tenant-users';
import { withTransaction } from '../../utils/transaction.helper';
import {
  queueAssetHealthInitialization,
  queueEquipmentEndpointSync
} from '../../queue/processor-events';
import { synchronizeAssetHealthInitialization } from '../../queue/handlers/asset-health-initialization.handler';
import { synchronizeEquipmentEndpoints } from '../../queue/handlers/equipment-endpoint-sync.handler';
import { mapUserToLocationService } from '../../transaction/mapUserLocation/userLocation.service';
import { locationService } from '../location/location.service';
import { applyRoleFilter } from '../../utils/roleFilter';

vi.mock('./equipment.service', () => ({
  equipmentService: {
    getAllEquipment: vi.fn(),
    getAllChildEquipmentIDs: vi.fn(),
    getEquipmentTreeData: vi.fn(),
    checkEquipment: vi.fn(),
    getEquipmentTreeDataById: vi.fn(),
    requireTenantLocation: vi.fn(),
    createEquipment: vi.fn(),
    createMotor: vi.fn(),
    createFlexible: vi.fn(),
    createRigid: vi.fn(),
    createBeltPulley: vi.fn(),
    createGearbox: vi.fn(),
    createFanBlower: vi.fn(),
    createPumps: vi.fn(),
    createCompressor: vi.fn(),
    updateEquipment: vi.fn(),
    updateMotor: vi.fn(),
    updateFlexible: vi.fn(),
    updateRigid: vi.fn(),
    updateBeltPulley: vi.fn(),
    updateGearbox: vi.fn(),
    updateFanBlower: vi.fn(),
    updatePumps: vi.fn(),
    updateCompressor: vi.fn(),
    updateEquipmentImageById: vi.fn(),
    removeEquipmentById: vi.fn(),
    makeAssetCopyRecursive: vi.fn()
  }
}));
vi.mock('../../transaction/mapUserAsset/userAsset.service', () => ({
  mapUserToAssetService: {
    createMapUserAssets: vi.fn(),
    getAssetsMappedData: vi.fn()
  }
}));
vi.mock('../../transaction/mapUserLocation/userLocation.service', () => ({
  mapUserToLocationService: {
    getDataByLocationIds: vi.fn(),
    removeLocationMapping: vi.fn()
  }
}));
vi.mock('../location/location.service', () => ({
  locationService: { getAllChildLocationIds: vi.fn() }
}));
vi.mock('../../utils/roleFilter', () => ({
  applyRoleFilter: vi.fn(async ({ baseFilter }: any) => baseFilter)
}));
vi.mock('../../utils/helper', () => ({
  helperService: {
    validateObjectId: vi.fn((value: string) => value),
    validateObjectIds: vi.fn((value: string) => value.split(',').filter(Boolean))
  }
}));
vi.mock('../../upload/upload.multer', () => ({
  uploadFilesService: {
    uploadBase64Image: vi.fn(),
    deleteBase64Image: vi.fn()
  }
}));
vi.mock('../../utils/notification.service', () => ({
  notificationService: {
    queueAccountNotification: vi.fn(),
    notifyAccountUsers: vi.fn()
  }
}));
vi.mock('../../utils/tenant-users', () => ({ requireActiveTenantUsers: vi.fn() }));
vi.mock('../../utils/transaction.helper', () => ({ withTransaction: vi.fn() }));
vi.mock('../../queue/processor-events', () => ({
  queueAssetHealthInitialization: vi.fn(),
  queueEquipmentEndpointSync: vi.fn()
}));
vi.mock('../../queue/handlers/asset-health-initialization.handler', () => ({
  synchronizeAssetHealthInitialization: vi.fn()
}));
vi.mock('../../queue/handlers/equipment-endpoint-sync.handler', () => ({
  synchronizeEquipmentEndpoints: vi.fn()
}));

describe('equipment tenant and processor outbox boundary', () => {
  const accountId = '507f1f77bcf86cd799439011';
  const userId = '507f1f77bcf86cd799439012';
  const assigneeId = '507f1f77bcf86cd799439013';
  const equipmentId = '507f1f77bcf86cd799439014';
  const locationId = '507f1f77bcf86cd799439015';
  const session = { id: 'equipment-session' };

  const requestBody = (overrides: Record<string, unknown> = {}) => ({
    Equipment: {
      id: equipmentId,
      asset_name: 'Pump train',
      asset_type: 'Equipment',
      locationId,
      userList: [assigneeId],
      ...overrides
    },
    Motor: null,
    Flexible: null,
    Rigid: null,
    Belt_Pulley: [],
    Gearbox: [],
    Fan_Blower: null,
    Pumps: null,
    Compressor: null
  });

  const response = () => {
    const value: any = {
      locals: { correlationId: 'equipment-correlation' },
      status: vi.fn(),
      json: vi.fn()
    };
    value.status.mockReturnValue(value);
    return value;
  };

  const request = (overrides: Record<string, unknown> = {}) => ({
    user: { account_id: accountId, _id: userId, user_role: 'manager' },
    query: {},
    params: {},
    body: {},
    ...overrides
  }) as any;

  const assetDocument = (id: string, fields: Record<string, unknown> = {}) => ({
    _id: id,
    id,
    ...fields,
    toObject: () => ({ _id: id, id, ...fields })
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(withTransaction).mockImplementation(async (operation: any) => operation(session));
    vi.mocked(requireActiveTenantUsers).mockResolvedValue([assigneeId] as never);
    vi.mocked(equipmentService.requireTenantLocation).mockResolvedValue();
    vi.mocked(notificationService.queueAccountNotification).mockResolvedValue();
    vi.mocked(queueAssetHealthInitialization).mockResolvedValue(true);
    vi.mocked(queueEquipmentEndpointSync).mockResolvedValue(true);
    vi.mocked(locationService.getAllChildLocationIds).mockResolvedValue([] as never);
    vi.mocked(mapUserToLocationService.getDataByLocationIds).mockResolvedValue([] as never);
    vi.mocked(applyRoleFilter).mockImplementation(async ({ baseFilter }: any) => baseFilter);
  });

  it('lists equipment using validated hierarchy, location, and role filters', async () => {
    vi.mocked(locationService.getAllChildLocationIds).mockResolvedValue(['child-location'] as never);
    vi.mocked(mapUserToLocationService.getDataByLocationIds).mockResolvedValue([
      { locationId }, { locationId: 'child-location' }
    ] as never);
    vi.mocked(equipmentService.getAllEquipment).mockResolvedValue([{ _id: equipmentId }] as never);
    const res = response();

    await equipmentController.getAssets(request({ query: {
      top_level_asset_id: `${equipmentId},asset-2`,
      parent_id: equipmentId,
      top_level: 'false',
      locationId
    } }), res, vi.fn());

    expect(applyRoleFilter).toHaveBeenCalledWith(expect.objectContaining({
      user: expect.objectContaining({ account_id: accountId }),
      baseFilter: {
        account_id: accountId,
        visible: true,
        top_level_asset_id: { $in: [equipmentId, 'asset-2'] },
        _id: { $in: [equipmentId] },
        parent_id: { $in: [equipmentId] },
        top_level: false,
        locationId: { $in: [locationId, 'child-location'] }
      },
      mapping: 'asset'
    }));
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('rejects an empty equipment list as not found', async () => {
    vi.mocked(equipmentService.getAllEquipment).mockResolvedValue([] as never);
    const next = vi.fn();
    await equipmentController.getAssets(request(), response(), next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'No equipment found', status: 404 }));
  });

  it('fetches one validated tenant-scoped equipment record', async () => {
    vi.mocked(equipmentService.getAllEquipment).mockResolvedValue([{ _id: equipmentId }] as never);
    const res = response();
    await equipmentController.getAsset(request({
      params: { id: equipmentId },
      query: { top_level_asset_id: 'root-1,root-2', top_level: 'true', locationId }
    }), res, vi.fn());

    expect(applyRoleFilter).toHaveBeenCalledWith(expect.objectContaining({
      baseFilter: {
        _id: equipmentId,
        account_id: accountId,
        visible: true,
        top_level_asset_id: ['root-1', 'root-2'],
        top_level: true,
        locationId
      }
    }));
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('loads child equipment only inside the tenant boundary', async () => {
    vi.mocked(equipmentService.getAllChildEquipmentIDs).mockResolvedValue(['child-1'] as never);
    vi.mocked(equipmentService.getAllEquipment).mockResolvedValue([{ _id: 'child-1' }] as never);
    const res = response();
    await equipmentController.getChildAsset(request({ params: { id: equipmentId } }), res, vi.fn());

    expect(equipmentService.getAllEquipment).toHaveBeenCalledWith({
      _id: { $in: ['child-1'] }, account_id: accountId, visible: true
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns not found when an equipment hierarchy has no children', async () => {
    vi.mocked(equipmentService.getAllChildEquipmentIDs).mockResolvedValue([] as never);
    const next = vi.fn();
    await equipmentController.getChildAsset(request({ params: { id: equipmentId } }), response(), next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'Equipment not found', status: 404 }));
  });

  it('intersects the equipment tree with non-admin mappings and requested filters', async () => {
    vi.mocked(mapUserToAssetService.getAssetsMappedData).mockResolvedValue([
      { assetId: equipmentId }, { assetId: null }
    ] as never);
    vi.mocked(equipmentService.getEquipmentTreeData).mockResolvedValue([{ id: equipmentId }] as never);
    const res = response();
    await equipmentController.getAssetTree(request({
      query: { id: `${equipmentId},asset-2`, location_id: `${locationId},location-2` }
    }), res, vi.fn());

    expect(equipmentService.getEquipmentTreeData).toHaveBeenCalledWith({
      account_id: accountId,
      visible: true,
      $or: [
        { _id: { $in: [equipmentId, 'asset-2'] } },
        { parent_id: { $in: [equipmentId, 'asset-2'] } }
      ],
      locationId: { $in: [locationId, 'location-2'] }
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('checks tree existence before fetching a tree by id', async () => {
    vi.mocked(mapUserToAssetService.getAssetsMappedData).mockResolvedValue([{ assetId: equipmentId }] as never);
    vi.mocked(equipmentService.checkEquipment).mockResolvedValue([{ _id: equipmentId }] as never);
    vi.mocked(equipmentService.getEquipmentTreeDataById).mockResolvedValue([{ id: equipmentId }] as never);
    const res = response();
    await equipmentController.getAssetTreeById(request({ params: { id: equipmentId } }), res, vi.fn());

    expect(equipmentService.checkEquipment).toHaveBeenCalledWith({
      account_id: accountId,
      visible: true,
      $or: [
        { _id: { $in: [equipmentId] } },
        { parent_id: { $in: [equipmentId] } }
      ]
    });
    expect(equipmentService.getEquipmentTreeDataById).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('creates equipment, mapping, processor events, and notification atomically', async () => {
    const created = {
      _id: equipmentId,
      asset_name: 'Pump train',
      asset_timezone: 'Asia/Kolkata'
    };
    vi.mocked(equipmentService.createEquipment).mockResolvedValue(created as never);
    const res = response();
    const next = vi.fn();

    await equipmentController.create({
      user: { account_id: accountId, _id: userId },
      body: requestBody()
    } as any, res, next);

    expect(equipmentService.createEquipment).toHaveBeenCalledWith(
      expect.objectContaining({ userList: [assigneeId] }),
      accountId,
      userId,
      session
    );
    expect(mapUserToAssetService.createMapUserAssets).toHaveBeenCalledWith([
      { userId: assigneeId, assetId: equipmentId, account_id: accountId }
    ], session);
    expect(queueAssetHealthInitialization).toHaveBeenCalledWith(
      expect.objectContaining({ assetIds: [equipmentId], tenantId: accountId }),
      session
    );
    expect(queueEquipmentEndpointSync).toHaveBeenCalledWith(
      expect.objectContaining({ equipmentId, tenantId: accountId }),
      session
    );
    expect(notificationService.queueAccountNotification).toHaveBeenCalledWith(
      expect.objectContaining({ accountId, entityId: equipmentId, event: 'created' }),
      { session, correlationId: 'equipment-correlation' }
    );
    expect(notificationService.notifyAccountUsers).not.toHaveBeenCalled();
    expect(synchronizeAssetHealthInitialization).not.toHaveBeenCalled();
    expect(synchronizeEquipmentEndpoints).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });

  it('creates every supported child asset and executes queue-disabled fallbacks', async () => {
    const root = assetDocument(equipmentId, { asset_timezone: 'Asia/Kolkata' });
    const children = {
      motor: assetDocument('motor-1'),
      flexible: assetDocument('flexible-1'),
      rigid: assetDocument('rigid-1'),
      belt: assetDocument('belt-1'),
      gearbox: assetDocument('gearbox-1'),
      fan: assetDocument('fan-1'),
      pump: assetDocument('pump-1'),
      compressor: assetDocument('compressor-1')
    };
    vi.mocked(equipmentService.createEquipment).mockResolvedValue(root as never);
    vi.mocked(equipmentService.createMotor).mockResolvedValue(children.motor as never);
    vi.mocked(equipmentService.createFlexible).mockResolvedValue(children.flexible as never);
    vi.mocked(equipmentService.createRigid).mockResolvedValue(children.rigid as never);
    vi.mocked(equipmentService.createBeltPulley).mockResolvedValue(children.belt as never);
    vi.mocked(equipmentService.createGearbox).mockResolvedValue(children.gearbox as never);
    vi.mocked(equipmentService.createFanBlower).mockResolvedValue(children.fan as never);
    vi.mocked(equipmentService.createPumps).mockResolvedValue(children.pump as never);
    vi.mocked(equipmentService.createCompressor).mockResolvedValue(children.compressor as never);
    vi.mocked(queueAssetHealthInitialization).mockResolvedValue(false);
    vi.mocked(queueEquipmentEndpointSync).mockResolvedValue(false);
    const body = requestBody({ image_path: 'data:image/png;base64,AAAA' });
    body.Motor = { power: 5 } as any;
    body.Flexible = { type: 'coupling' } as any;
    body.Rigid = { type: 'shaft' } as any;
    body.Belt_Pulley = [{ type: 'belt' }] as any;
    body.Gearbox = [{ ratio: 4 }] as any;
    body.Fan_Blower = { type: 'fan' } as any;
    body.Pumps = { type: 'pump' } as any;
    body.Compressor = { type: 'compressor' } as any;
    vi.mocked(uploadFilesService.uploadBase64Image).mockResolvedValue({ fileName: 'asset.png' } as never);
    const res = response();

    await equipmentController.create(request({ body }), res, vi.fn());

    expect(uploadFilesService.uploadBase64Image).toHaveBeenCalledWith(
      'data:image/png;base64,AAAA', 'assets', accountId, userId
    );
    expect(equipmentService.createMotor).toHaveBeenCalled();
    expect(equipmentService.createFlexible).toHaveBeenCalled();
    expect(equipmentService.createRigid).toHaveBeenCalled();
    expect(equipmentService.createBeltPulley).toHaveBeenCalled();
    expect(equipmentService.createGearbox).toHaveBeenCalled();
    expect(equipmentService.createFanBlower).toHaveBeenCalled();
    expect(equipmentService.createPumps).toHaveBeenCalled();
    expect(equipmentService.createCompressor).toHaveBeenCalled();
    expect(mapUserToAssetService.createMapUserAssets).toHaveBeenCalledWith(
      expect.arrayContaining([
        { userId: assigneeId, assetId: equipmentId, account_id: accountId },
        { userId: assigneeId, assetId: 'motor-1', account_id: accountId },
        { userId: assigneeId, assetId: 'compressor-1', account_id: accountId }
      ]),
      session
    );
    expect(synchronizeAssetHealthInitialization).toHaveBeenCalledWith(
      [equipmentId, 'motor-1', 'flexible-1', 'rigid-1', 'belt-1', 'gearbox-1', 'fan-1', 'pump-1', 'compressor-1'],
      accountId,
      userId
    );
    expect(synchronizeEquipmentEndpoints).toHaveBeenCalledWith(
      equipmentId, accountId, userId, `equipment-correlation:${equipmentId}`
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('requires at least one tenant user before starting equipment creation', async () => {
    const body = requestBody();
    body.Equipment.userList = [];
    const next = vi.fn();
    await equipmentController.create(request({ body }), response(), next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      message: 'User selection is required for equipment mapping', status: 400
    }));
    expect(withTransaction).not.toHaveBeenCalled();
  });

  it('rejects a foreign assignee before any equipment write', async () => {
    const failure = Object.assign(new Error('foreign user'), { status: 404 });
    vi.mocked(requireActiveTenantUsers).mockRejectedValue(failure);
    const res = response();
    const next = vi.fn();

    await equipmentController.create({
      user: { account_id: accountId, _id: userId },
      body: requestBody()
    } as any, res, next);

    expect(next).toHaveBeenCalledWith(failure);
    expect(equipmentService.createEquipment).not.toHaveBeenCalled();
    expect(queueEquipmentEndpointSync).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('updates the equipment and queues current-state endpoint synchronization', async () => {
    vi.mocked(equipmentService.getAllEquipment)
      .mockResolvedValueOnce([{ _id: equipmentId, asset_name: 'Pump train' }] as never)
      .mockResolvedValueOnce([{ _id: equipmentId, asset_name: 'Pump train B' }] as never);
    vi.mocked(equipmentService.updateEquipment).mockResolvedValue({ _id: equipmentId } as never);
    const res = response();
    const next = vi.fn();

    await equipmentController.update({
      user: { account_id: accountId, _id: userId },
      params: { id: equipmentId },
      body: requestBody({ asset_name: 'Pump train B' })
    } as any, res, next);

    expect(equipmentService.updateEquipment).toHaveBeenCalledWith(
      expect.objectContaining({ id: equipmentId, userList: [assigneeId] }),
      accountId,
      userId,
      session
    );
    expect(queueEquipmentEndpointSync).toHaveBeenCalledWith(
      expect.objectContaining({ equipmentId, tenantId: accountId }),
      session
    );
    expect(queueAssetHealthInitialization).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });

  it('updates and creates mixed child assets while synchronizing queue-disabled work', async () => {
    const updatedDoc = (id: string) => ({ _id: id, id, asset_name: id });
    const createdDoc = (id: string) => assetDocument(id);
    vi.mocked(equipmentService.getAllEquipment)
      .mockResolvedValueOnce([{ _id: equipmentId, asset_name: 'Pump train' }] as never)
      .mockResolvedValueOnce([{ _id: equipmentId, asset_name: 'Pump train B' }] as never);
    vi.mocked(equipmentService.updateEquipment).mockResolvedValue(updatedDoc(equipmentId) as never);
    vi.mocked(equipmentService.updateMotor).mockResolvedValue(updatedDoc('motor-existing') as never);
    vi.mocked(equipmentService.createFlexible).mockResolvedValue(createdDoc('flexible-new') as never);
    vi.mocked(equipmentService.updateRigid).mockResolvedValue(updatedDoc('rigid-existing') as never);
    vi.mocked(equipmentService.updateBeltPulley).mockResolvedValue(updatedDoc('belt-existing') as never);
    vi.mocked(equipmentService.createBeltPulley).mockResolvedValue(createdDoc('belt-new') as never);
    vi.mocked(equipmentService.updateGearbox).mockResolvedValue(updatedDoc('gear-existing') as never);
    vi.mocked(equipmentService.createGearbox).mockResolvedValue(createdDoc('gear-new') as never);
    vi.mocked(equipmentService.updateFanBlower).mockResolvedValue(updatedDoc('fan-existing') as never);
    vi.mocked(equipmentService.createPumps).mockResolvedValue(createdDoc('pump-new') as never);
    vi.mocked(equipmentService.updateCompressor).mockResolvedValue(updatedDoc('compressor-existing') as never);
    vi.mocked(queueAssetHealthInitialization).mockResolvedValue(false);
    vi.mocked(queueEquipmentEndpointSync).mockResolvedValue(false);
    const body: any = requestBody({ asset_name: 'Pump train B' });
    body.Motor = { id: 'motor-existing' };
    body.Flexible = { type: 'coupling' };
    body.Rigid = { id: 'rigid-existing' };
    body.Belt_Pulley = [{ id: 'belt-existing' }, { type: 'belt' }];
    body.Gearbox = [{ id: 'gear-existing' }, { ratio: 4 }];
    body.Fan_Blower = { id: 'fan-existing' };
    body.Pumps = { type: 'pump' };
    body.Compressor = { id: 'compressor-existing' };
    const res = response();

    await equipmentController.update(request({ params: { id: equipmentId }, body }), res, vi.fn());

    expect(equipmentService.updateMotor).toHaveBeenCalled();
    expect(equipmentService.createFlexible).toHaveBeenCalled();
    expect(equipmentService.updateRigid).toHaveBeenCalled();
    expect(equipmentService.updateBeltPulley).toHaveBeenCalled();
    expect(equipmentService.createBeltPulley).toHaveBeenCalled();
    expect(equipmentService.updateGearbox).toHaveBeenCalled();
    expect(equipmentService.createGearbox).toHaveBeenCalled();
    expect(equipmentService.updateFanBlower).toHaveBeenCalled();
    expect(equipmentService.createPumps).toHaveBeenCalled();
    expect(equipmentService.updateCompressor).toHaveBeenCalled();
    expect(queueAssetHealthInitialization).toHaveBeenCalledWith(expect.objectContaining({
      assetIds: ['flexible-new', 'belt-new', 'gear-new', 'pump-new']
    }), session);
    expect(synchronizeAssetHealthInitialization).toHaveBeenCalledWith(
      ['flexible-new', 'belt-new', 'gear-new', 'pump-new'], accountId, userId
    );
    expect(synchronizeEquipmentEndpoints).toHaveBeenCalledWith(
      equipmentId, accountId, userId, `equipment-correlation:${equipmentId}`
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it.each([
    [{}, 'Invalid request: Equipment ID is required'],
    [{ id: 'different', userList: [assigneeId] }, 'Invalid request: Equipment ID mismatch'],
    [{ id: equipmentId, userList: [] }, 'Please select at least one user']
  ])('rejects invalid update payloads before querying equipment', async (Equipment, message) => {
    const next = vi.fn();
    await equipmentController.update(request({
      params: { id: equipmentId },
      body: { ...requestBody(), Equipment }
    }), response(), next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message, status: 400 }));
    expect(equipmentService.getAllEquipment).not.toHaveBeenCalled();
  });

  it('rejects an update when the tenant-scoped equipment record does not exist', async () => {
    vi.mocked(equipmentService.getAllEquipment).mockResolvedValue([] as never);
    const next = vi.fn();
    await equipmentController.update(request({
      params: { id: equipmentId }, body: requestBody()
    }), response(), next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'Equipment not found', status: 404 }));
    expect(equipmentService.updateEquipment).not.toHaveBeenCalled();
  });

  it('uploads a changed equipment image exactly once', async () => {
    vi.mocked(equipmentService.getAllEquipment)
      .mockResolvedValueOnce([{
        _id: equipmentId,
        image_path: { fileName: 'old-image.png' }
      }] as never)
      .mockResolvedValueOnce([{ _id: equipmentId }] as never);
    vi.mocked(uploadFilesService.uploadBase64Image).mockResolvedValue({
      fileName: 'new-image.png'
    } as never);
    vi.mocked(equipmentService.updateEquipment).mockResolvedValue({ _id: equipmentId } as never);

    await equipmentController.update({
      user: { account_id: accountId, _id: userId },
      params: { id: equipmentId },
      body: requestBody({ image_path: 'data:image/png;base64,AAAA' })
    } as any, response(), vi.fn());

    expect(uploadFilesService.deleteBase64Image).toHaveBeenCalledTimes(1);
    expect(uploadFilesService.uploadBase64Image).toHaveBeenCalledTimes(1);
    expect(uploadFilesService.uploadBase64Image).toHaveBeenCalledWith(
      'data:image/png;base64,AAAA',
      'assets',
      accountId,
      userId
    );
  });

  it('updates an existing equipment image atomically and emits an audit notification', async () => {
    vi.mocked(equipmentService.getAllEquipment).mockResolvedValue([{ _id: equipmentId, asset_name: 'Pump train' }] as never);
    vi.mocked(equipmentService.updateEquipmentImageById).mockResolvedValue({ _id: equipmentId } as never);
    const res = response();
    await equipmentController.updateAssetImage(request({
      params: { id: equipmentId }, body: { image_path: 'asset.png' }
    }), res, vi.fn());

    expect(equipmentService.updateEquipmentImageById).toHaveBeenCalledWith(
      equipmentId, 'asset.png', accountId, userId, session
    );
    expect(notificationService.queueAccountNotification).toHaveBeenCalledWith(
      expect.objectContaining({ accountId, entityId: equipmentId, event: 'updated' }),
      { session, correlationId: 'equipment-correlation' }
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('rejects missing image content and missing tenant equipment', async () => {
    const missingPath = vi.fn();
    await equipmentController.updateAssetImage(request({
      params: { id: equipmentId }, body: {}
    }), response(), missingPath);
    expect(missingPath).toHaveBeenCalledWith(expect.objectContaining({ message: 'Image path is required', status: 400 }));

    vi.mocked(equipmentService.getAllEquipment).mockResolvedValue([] as never);
    const missingEquipment = vi.fn();
    await equipmentController.updateAssetImage(request({
      params: { id: equipmentId }, body: { image_path: 'asset.png' }
    }), response(), missingEquipment);
    expect(missingEquipment).toHaveBeenCalledWith(expect.objectContaining({ message: 'Equipment not found', status: 404 }));
  });

  it('removes mappings and equipment only after tenant-scoped existence verification', async () => {
    vi.mocked(equipmentService.getAllEquipment).mockResolvedValue([{ _id: equipmentId }] as never);
    const res = response();
    await equipmentController.removeAsset(request({ params: { id: equipmentId } }), res, vi.fn());

    expect(mapUserToLocationService.removeLocationMapping).toHaveBeenCalledWith(equipmentId);
    expect(equipmentService.removeEquipmentById).toHaveBeenCalledWith({
      _id: equipmentId, account_id: accountId, visible: true
    }, userId);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('does not forward a request bearer token when copying equipment', async () => {
    vi.mocked(equipmentService.makeAssetCopyRecursive).mockResolvedValue(equipmentId as never);
    vi.mocked(equipmentService.getAllEquipment).mockResolvedValue([{ _id: equipmentId }] as never);
    const res = response();

    await equipmentController.makeAssetCopy({
      user: { account_id: accountId, _id: userId },
      userToken: 'must-not-be-forwarded',
      params: { id: equipmentId }
    } as any, res, vi.fn());

    expect(equipmentService.makeAssetCopyRecursive).toHaveBeenCalledWith(
      equipmentId,
      userId,
      accountId,
      undefined,
      session,
      'equipment-correlation'
    );
    expect(JSON.stringify(vi.mocked(equipmentService.makeAssetCopyRecursive).mock.calls))
      .not.toContain('must-not-be-forwarded');
  });
});
