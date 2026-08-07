import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const dependencies = vi.hoisted(() => ({
  getUsers: vi.fn(),
  createWorkOrder: vi.fn(),
  info: vi.fn(),
  error: vi.fn()
}));

vi.mock('../observability/logger', () => ({
  applicationLogger: {
    info: dependencies.info,
    error: dependencies.error
  }
}));

vi.mock('../masters/user/user.service', () => ({
  usersService: { getAllUsers: dependencies.getUsers }
}));

vi.mock('../work/order/order.service', () => ({
  orderService: { createWorkOrder: dependencies.createWorkOrder }
}));

vi.mock('../configDB', () => ({
  schedulerConfig: { lockTtlMs: 60_000 }
}));

import { SchedulerModel } from '../models/scheduleMaster.model';
import { schedulerService } from './scheduler.service';

const service = schedulerService as any;
const now = new Date('2026-08-03T10:00:00.000Z');

function scheduleFixture(overrides: Record<string, any> = {}): any {
  const scheduleOverrides = overrides['schedule'] || {};
  const workOrderOverrides = overrides['work_order'] || {};
  return {
    _id: overrides['_id'] || 'schedule-1',
    title: overrides['title'] || 'Pump inspection',
    createdBy: overrides['createdBy'] || 'user-1',
    schedule: {
      mode: 'daily',
      enabled: true,
      start_date: '2026-08-01',
      end_date: null,
      no_of_repetition: null,
      no_of_execution: 0,
      skipWeekends: false,
      skipWeekendSaturday: false,
      skipWeekendSunday: false,
      skipDates: [],
      daily: { everyNDays: 1 },
      weekly: { everyNWeeks: 1, days: [] },
      monthly: { everyNMonths: 1, monthDays: [] },
      last_execution_date: null,
      ...scheduleOverrides
    },
    work_order: {
      title: 'Generated work order',
      description: 'Inspect the pump',
      estimated_time: 2,
      priority: 'Medium',
      status: 'Open',
      type: 'Preventive',
      sop_form_id: 'sop-1',
      wo_asset_id: 'asset-1',
      wo_location_id: 'location-1',
      createdFrom: 'Schedule',
      tasks: [{ title: 'Inspect' }],
      parts: [{ part_name: 'Seal' }],
      userIdList: ['user-2'],
      ...workOrderOverrides
    },
    save: overrides['save'] || vi.fn().mockResolvedValue(undefined)
  };
}

describe('unified scheduler behavior and distributed execution safety', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    dependencies.getUsers.mockResolvedValue([{ _id: 'user-1' }]);
    dependencies.createWorkOrder.mockResolvedValue({ _id: 'work-order-1' });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    Object.values(dependencies).forEach((mock) => mock.mockReset());
  });

  it('runs only active schedules inside their date and repetition boundaries', () => {
    expect(service.shouldRun(scheduleFixture())).toBe(true);
    expect(service.shouldRun(scheduleFixture({ schedule: { enabled: false } }))).toBe(false);
    expect(service.shouldRun(scheduleFixture({ schedule: { start_date: '2026-08-04' } }))).toBe(false);
    expect(service.shouldRun(scheduleFixture({ schedule: { end_date: '2026-08-02' } }))).toBe(false);
    expect(service.shouldRun(scheduleFixture({
      schedule: { no_of_repetition: 3, no_of_execution: 3 }
    }))).toBe(false);
    expect(service.shouldRun(scheduleFixture({
      schedule: { no_of_repetition: 3, no_of_execution: 2 }
    }))).toBe(true);
  });

  it('honors explicit skip dates, configured weekend days, and once-per-day execution', () => {
    expect(service.shouldSkipToday(scheduleFixture({ schedule: { skipDates: ['2026-08-03'] } }))).toBe(true);
    expect(service.shouldSkipToday(scheduleFixture())).toBe(false);
    expect(service.alreadyExecutedToday(scheduleFixture())).toBe(false);
    expect(service.alreadyExecutedToday(scheduleFixture({
      schedule: { last_execution_date: new Date('2026-08-03T00:01:00.000Z') }
    }))).toBe(true);
    expect(service.alreadyExecutedToday(scheduleFixture({
      schedule: { last_execution_date: new Date('2026-08-02T10:00:00.000Z') }
    }))).toBe(false);

    vi.setSystemTime(new Date('2026-08-08T10:00:00.000Z'));
    expect(service.shouldSkipToday(scheduleFixture({
      schedule: { skipWeekends: true, skipWeekendSaturday: true }
    }))).toBe(true);
    expect(service.shouldSkipToday(scheduleFixture({
      schedule: { skipWeekends: true, skipWeekendSaturday: false }
    }))).toBe(false);

    vi.setSystemTime(new Date('2026-08-09T10:00:00.000Z'));
    expect(service.shouldSkipToday(scheduleFixture({
      schedule: { skipWeekends: true, skipWeekendSunday: true }
    }))).toBe(true);
    expect(service.shouldSkipToday(scheduleFixture({
      schedule: { skipWeekends: true, skipWeekendSunday: false }
    }))).toBe(false);
  });

  it('acquires only missing or expired locks and releases only its own lock', async () => {
    const findOneAndUpdate = vi.spyOn(SchedulerModel as any, 'findOneAndUpdate')
      .mockResolvedValueOnce({ _id: 'schedule-1' })
      .mockResolvedValueOnce(null);
    const updateOne = vi.spyOn(SchedulerModel as any, 'updateOne').mockResolvedValue({ modifiedCount: 1 });

    await expect(service.acquireScheduleLock('schedule-1')).resolves.toBe(true);
    await expect(service.acquireScheduleLock('schedule-2')).resolves.toBe(false);
    await service.releaseScheduleLock('schedule-1');

    expect(findOneAndUpdate.mock.calls[0]![0]).toMatchObject({
      _id: 'schedule-1',
      visible: true,
      'schedule.enabled': true,
      $or: [
        { cron_lock_acquired_at: { $exists: false } },
        { cron_lock_acquired_at: null },
        { cron_lock_acquired_at: { $lt: new Date(now.getTime() - 60_000) } }
      ]
    });
    const lockUpdate = findOneAndUpdate.mock.calls[0]![1] as any;
    expect(lockUpdate.$set.cron_lock_instance_id).toContain(`${process.pid}-`);
    expect(updateOne).toHaveBeenCalledWith(
      { _id: 'schedule-1', cron_lock_instance_id: expect.stringContaining(`${process.pid}-`) },
      { $unset: { cron_lock_acquired_at: '', cron_lock_instance_id: '' } }
    );
  });

  it.each([
    ['daily', '2026-08-03', '2026-08-04'],
    ['weekly', '2026-08-03', '2026-08-10'],
    ['monthly', '2026-08-03', '2026-09-03']
  ])('creates %s work orders with the expected date range', async (mode, startDate, endDate) => {
    const schedule = scheduleFixture({ schedule: { mode } });

    await service.executeSchedule(schedule);

    expect(dependencies.getUsers).toHaveBeenCalledWith({ _id: 'user-1' });
    expect(dependencies.createWorkOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Generated work order',
        wo_asset_id: 'asset-1',
        wo_location_id: 'location-1',
        start_date: startDate,
        end_date: endDate
      }),
      { _id: 'user-1' }
    );
    expect(schedule.schedule.no_of_execution).toBe(1);
    expect(schedule.schedule.last_execution_date).toEqual(now);
    expect(schedule.save).toHaveBeenCalledOnce();
  });

  it('disables a schedule when its repetition limit or end date is reached', async () => {
    const repetitionSchedule = scheduleFixture({
      schedule: { no_of_repetition: 1, no_of_execution: 0 }
    });
    const endedSchedule = scheduleFixture({
      _id: 'schedule-2',
      schedule: { end_date: '2026-08-03' }
    });

    await service.executeSchedule(repetitionSchedule);
    await service.executeSchedule(endedSchedule);

    expect(repetitionSchedule.schedule.enabled).toBe(false);
    expect(repetitionSchedule.schedule.end_date).toBe('2026-08-03');
    expect(endedSchedule.schedule.enabled).toBe(false);
    expect(endedSchedule.schedule.end_date).toBe('2026-08-03');
  });

  it('does not advance or save a schedule when work-order creation returns no record', async () => {
    const schedule = scheduleFixture();
    dependencies.createWorkOrder.mockResolvedValue(null);

    await expect(service.executeSchedule(schedule))
      .rejects.toThrow('Work order creation failed for schedule: Pump inspection');

    expect(schedule.schedule.no_of_execution).toBe(0);
    expect(schedule.schedule.last_execution_date).toBeNull();
    expect(schedule.save).not.toHaveBeenCalled();
    expect(dependencies.error).toHaveBeenCalledOnce();
  });

  it('selects due daily, weekly, and monthly schedules while isolating lock and execution failures', async () => {
    const schedules = [
      scheduleFixture({ _id: 'future', schedule: { start_date: '2026-08-04' } }),
      scheduleFixture({ _id: 'skipped', schedule: { skipDates: ['2026-08-03'] } }),
      scheduleFixture({ _id: 'executed', schedule: { last_execution_date: now } }),
      scheduleFixture({ _id: 'locked' }),
      scheduleFixture({ _id: 'daily' }),
      scheduleFixture({ _id: 'weekly-match', schedule: { mode: 'weekly', weekly: { days: ['monday'] } } }),
      scheduleFixture({ _id: 'weekly-miss', schedule: { mode: 'weekly', weekly: { days: ['tuesday'] } } }),
      scheduleFixture({ _id: 'monthly-match', schedule: { mode: 'monthly', monthly: { monthDays: [3] } } }),
      scheduleFixture({ _id: 'monthly-miss', schedule: { mode: 'monthly', monthly: { monthDays: [4] } } }),
      scheduleFixture({ _id: 'failing', title: 'Failing schedule' })
    ];
    vi.spyOn(SchedulerModel, 'find').mockResolvedValue(schedules as any);
    const acquire = vi.spyOn(service, 'acquireScheduleLock')
      .mockImplementation(async (...args: unknown[]) => args[0] !== 'locked');
    const release = vi.spyOn(service, 'releaseScheduleLock').mockResolvedValue(undefined);
    const execute = vi.spyOn(service, 'executeSchedule').mockImplementation(async (schedule: any) => {
      if (schedule._id === 'failing') {
        throw new Error('worker failure');
      }
    });

    await schedulerService.runUnifiedScheduler();

    expect(acquire).toHaveBeenCalledTimes(7);
    expect(execute.mock.calls.map(([schedule]) => (schedule as any)._id))
      .toEqual(['daily', 'weekly-match', 'monthly-match', 'failing']);
    expect(release).toHaveBeenCalledTimes(6);
    expect(dependencies.error).toHaveBeenCalledWith(
      { err: expect.any(Error) },
      expect.stringContaining('Failing schedule')
    );
  });

  it('logs a top-level query failure without escaping the scheduler boundary', async () => {
    const failure = new Error('database unavailable');
    vi.spyOn(SchedulerModel, 'find').mockRejectedValue(failure);

    await expect(schedulerService.runUnifiedScheduler()).resolves.toBeUndefined();

    expect(dependencies.error).toHaveBeenCalledWith(
      { err: failure },
      expect.stringContaining('Scheduler failed')
    );
  });
});
