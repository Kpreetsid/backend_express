import mongoose from 'mongoose';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AssetModel } from '../../models/asset.model';
import { LocationModel } from '../../models/location.model';
import { PartsTypeModel } from '../../models/parts-types.model';
import { SchedulerModel } from '../../models/scheduleMaster.model';
import { UserModel } from '../../models/user.model';
import { scheduleService } from './schedule.service';

const objectId = (suffix: string) => new mongoose.Types.ObjectId(`907f1f77bcf86cd7994400${suffix}`);

const selectLean = (value: any) => ({
  select: vi.fn().mockReturnValue({
    lean: vi.fn().mockResolvedValue(value)
  })
});

describe('schedule service behavior and tenant boundaries', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('builds tenant-visible lookups and enriches assigned users and valid part types', async () => {
    const accountId = objectId('11');
    const userId = objectId('12');
    const partTypeId = objectId('13');
    const item: any = {
      _id: objectId('14'),
      work_order: {
        userIdList: [String(userId), '', null],
        parts: [
          { part_type: String(partTypeId), part_name: 'Bearing' },
          { part_type: 'manual-type', part_name: 'Oil' }
        ]
      }
    };
    const aggregate = vi.spyOn(SchedulerModel, 'aggregate').mockResolvedValue([item] as any);
    const findUsers = vi.spyOn(UserModel, 'find').mockReturnValue(selectLean([
      { _id: userId, firstName: 'Assigned' }
    ]) as any);
    const findPartType = vi.spyOn(PartsTypeModel, 'findOne').mockReturnValue(selectLean({
      _id: partTypeId,
      name: 'Mechanical'
    }) as any);
    const match: any = { account_id: accountId };

    const result = await scheduleService.getSchedules(match) as any[];

    expect(match.visible).toBe(true);
    const pipeline = aggregate.mock.calls[0]![0] as any[];
    expect(pipeline[0]).toEqual({ $match: match });
    expect(pipeline[1].$lookup.from).toBe(AssetModel.collection.name);
    expect(pipeline[3].$lookup.from).toBe(LocationModel.collection.name);
    expect(result[0].work_order.users).toEqual([{ _id: userId, firstName: 'Assigned' }]);
    expect(result[0].work_order.parts[0].partTypeData).toEqual({
      _id: partTypeId,
      name: 'Mechanical',
      id: String(partTypeId)
    });
    expect(result[0].work_order.parts[1].partTypeData).toBeUndefined();
    expect(findUsers).toHaveBeenCalledWith({ _id: { $in: [String(userId)] } });
    expect(findPartType).toHaveBeenCalledOnce();
  });

  it('returns empty enrichment collections without unnecessary queries', async () => {
    const item: any = { _id: objectId('15'), work_order: {} };
    vi.spyOn(SchedulerModel, 'aggregate').mockResolvedValue([item] as any);
    const findUsers = vi.spyOn(UserModel, 'find');
    const findPartType = vi.spyOn(PartsTypeModel, 'findOne');

    const result = await scheduleService.getSchedules({ account_id: objectId('16') }) as any[];

    expect(result[0].work_order.users).toEqual([]);
    expect(findUsers).not.toHaveBeenCalled();
    expect(findPartType).not.toHaveBeenCalled();
  });

  it('fails with the existing 404 contract when no visible schedules exist', async () => {
    vi.spyOn(SchedulerModel, 'aggregate').mockResolvedValue([] as any);

    await expect(scheduleService.getSchedules({ account_id: objectId('17') }))
      .rejects.toMatchObject({ message: 'No records found', status: 404 });
  });

  it('normalizes an empty asset reference and pins ownership when creating', async () => {
    const accountId = objectId('18');
    const actorId = objectId('19');
    const scheduleId = objectId('20');
    const save = vi.spyOn(SchedulerModel.prototype, 'save').mockResolvedValue({ _id: scheduleId } as any);
    const getSchedules = vi.spyOn(scheduleService, 'getSchedules').mockResolvedValue([
      { _id: scheduleId, title: 'Weekly PM' }
    ] as any);
    const body = {
      title: 'Weekly PM',
      work_order: { wo_asset_id: '', wo_location_id: objectId('21') }
    };

    const result = await scheduleService.createSchedules(body, accountId, actorId);

    const created = save.mock.instances[0] as any;
    expect(created.work_order.wo_asset_id).toBeNull();
    expect(created.account_id).toEqual(accountId);
    expect(created.createdBy).toEqual(actorId);
    expect(body.work_order.wo_asset_id).toBe('');
    expect(getSchedules).toHaveBeenCalledWith({ _id: scheduleId });
    expect(result).toMatchObject({ _id: scheduleId, title: 'Weekly PM' });
  });

  it('updates only a visible schedule owned by the authenticated tenant', async () => {
    const scheduleId = objectId('22');
    const accountId = objectId('23');
    const actorId = objectId('24');
    const update = vi.spyOn(SchedulerModel, 'findOneAndUpdate').mockResolvedValue({ _id: scheduleId } as any);
    const getSchedules = vi.spyOn(scheduleService, 'getSchedules').mockResolvedValue([
      { _id: scheduleId, title: 'Updated' }
    ] as any);

    const result = await scheduleService.updateSchedules(
      String(scheduleId),
      { title: 'Updated', work_order: { wo_asset_id: '' } },
      accountId,
      actorId
    );

    expect(update).toHaveBeenCalledWith(
      { _id: scheduleId, account_id: accountId, visible: true },
      { title: 'Updated', work_order: { wo_asset_id: null }, updatedBy: actorId },
      { returnDocument: 'after' }
    );
    expect(getSchedules).toHaveBeenCalledWith({ _id: scheduleId, account_id: accountId, visible: true });
    expect(result).toMatchObject({ title: 'Updated' });
  });

  it('fails closed when a tenant-pinned update finds no schedule', async () => {
    vi.spyOn(SchedulerModel, 'findOneAndUpdate').mockResolvedValue(null);
    const getSchedules = vi.spyOn(scheduleService, 'getSchedules');

    await expect(scheduleService.updateSchedules(
      String(objectId('25')),
      { title: 'Denied' },
      objectId('26'),
      objectId('27')
    )).rejects.toMatchObject({ message: 'Schedule not found', status: 404 });
    expect(getSchedules).not.toHaveBeenCalled();
  });

  it('soft-deletes only a visible schedule owned by the authenticated tenant', async () => {
    const scheduleId = objectId('28');
    const accountId = objectId('29');
    const actorId = objectId('30');
    const update = vi.spyOn(SchedulerModel, 'findOneAndUpdate').mockResolvedValue({
      _id: scheduleId,
      visible: false
    } as any);

    const result = await scheduleService.removeSchedules(String(scheduleId), accountId, actorId);

    expect(update).toHaveBeenCalledWith(
      { _id: scheduleId, account_id: accountId, visible: true },
      { updatedBy: actorId, visible: false },
      { returnDocument: 'after' }
    );
    expect(result).toMatchObject({ _id: scheduleId, visible: false });
  });
});
