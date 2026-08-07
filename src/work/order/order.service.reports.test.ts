import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../_config/mailer', () => ({
  MailerService: class MailerService {}
}));

import { SchedulerModel } from '../../models/scheduleMaster.model';
import { UserModel } from '../../models/user.model';
import { WorkOrderModel } from '../../models/workOrder.model';
import { WorkRequestModel } from '../../models/workRequest.model';
import { orderService } from './order.service';

const service = orderService as any;
const range = { fromDate: '2026-08-01', toDate: '2026-08-31' };
const readyOrder = {
  _id: 'order-ready',
  status: 'Open',
  createdAt: '2026-08-02T00:00:00.000Z',
  start_date: '2026-08-02T00:00:00.000Z',
  end_date: '2026-08-20T00:00:00.000Z',
  estimated_time: 2,
  assignedUsers: [{ user: { _id: 'user-1' } }],
  parts: [{ part_id: 'part-1', part_name: 'Bearing', estimatedQuantity: 2, actualQuantity: 1, cost: 10 }],
  procedures: [{ submitted: true }]
};

const queryResult = (value: any) => ({
  select: vi.fn().mockReturnThis(),
  lean: vi.fn().mockResolvedValue(value)
});

describe('work-order enterprise report contracts', () => {
  beforeEach(() => {
    vi.useFakeTimers().setSystemTime(new Date('2026-08-10T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('rejects missing or invalid date ranges before accessing persistence', async () => {
    const rangeMethods = [
      'createdVsCompleted',
      'overviewSummaryData',
      'executionSummaryData',
      'onTimeVsOverdue',
      'timeToComplete',
      'requestFunnelReport',
      'partsImpactReport',
      'completedWithInspectionReport',
      'completedByUserReport',
      'timeVsCostReport',
      'plannerReadinessReport',
      'repeatingWorkOrdersReport'
    ];

    for (const method of rangeMethods) {
      await expect(service[method]({}, { fromDate: 'invalid', toDate: '2026-08-31' }))
        .rejects.toMatchObject({ message: 'Valid fromDate and toDate are required', status: 400 });
    }
  });

  it('merges created and completed time buckets and rejects an empty result', async () => {
    const aggregate = vi.spyOn(WorkOrderModel as any, 'aggregate')
      .mockResolvedValueOnce([{ bucket: '2026-08-01', count: 2 }])
      .mockResolvedValueOnce([
        { bucket: '2026-08-01', count: 1 },
        { bucket: '2026-08-02', count: 3 }
      ]);

    await expect(service.createdVsCompleted({ account_id: 'account-1' }, range)).resolves.toEqual({
      granularity: 'day',
      date: ['2026-08-01', '2026-08-02'],
      created: [2, 0],
      completed: [1, 3]
    });

    aggregate.mockReset().mockResolvedValue([]);
    await expect(service.createdVsCompleted({}, range))
      .rejects.toMatchObject({ message: 'No data found', status: 404 });
  });

  it('combines overview counts with readiness and repeating schedule metrics', async () => {
    vi.spyOn(WorkOrderModel as any, 'aggregate').mockResolvedValue([{
      created: [{ count: 7 }],
      completed: [{ count: 4 }],
      completedOnTime: [{ count: 3 }],
      overdueOpen: [{ count: 2 }]
    }]);
    vi.spyOn(service, 'getExecutionScopedOrders').mockResolvedValue([
      readyOrder,
      { ...readyOrder, _id: 'waiting', status: 'Waiting-on-Parts' },
      { ...readyOrder, _id: 'blocked', status: 'Blocked' },
      { ...readyOrder, _id: 'outside', createdAt: '2025-01-01', start_date: null, end_date: null }
    ]);
    const scheduleFind = vi.spyOn(SchedulerModel as any, 'find').mockReturnValue(queryResult([
      { schedule: { start_date: '2026-08-05', end_date: '2026-09-01' } },
      { schedule: { start_date: '2026-01-01', end_date: '2026-02-01' } }
    ]));

    const result = await service.overviewSummaryData({
      account_id: 'account-1',
      wo_asset_id: { $in: ['asset-1'] },
      wo_location_id: { $in: ['location-1'] }
    }, range);

    expect(result).toMatchObject({
      created_count: 7,
      completed_count: 4,
      completed_on_time_count: 3,
      completed_late_count: 1,
      on_time_completion_rate: 75,
      overdue_open_count: 2,
      total_open_count: 3,
      ready_for_execution_count: 1,
      waiting_on_parts_count: 1,
      blocked_work_count: 1,
      total_repeating: 1
    });
    expect(scheduleFind).toHaveBeenCalledWith(expect.objectContaining({
      'work_order.wo_asset_id': { $in: ['asset-1'] },
      'work_order.wo_location_id': { $in: ['location-1'] }
    }));
  });

  it('summarizes completed execution, overdue, blocked, waiting, and ready orders', async () => {
    vi.spyOn(WorkOrderModel as any, 'find').mockReturnValue(queryResult([
      {
        actual_start_date: '2026-08-01T08:00:00.000Z',
        actual_end_date: '2026-08-01T10:00:00.000Z',
        end_date: '2026-08-01T11:00:00.000Z'
      },
      {
        actual_start_date: '2026-08-02T08:00:00.000Z',
        actual_end_date: '2026-08-02T12:00:00.000Z',
        end_date: '2026-08-02T10:00:00.000Z'
      },
      { actual_start_date: null, actual_end_date: '2026-08-03T12:00:00.000Z', end_date: null }
    ]));
    vi.spyOn(service, 'getExecutionScopedOrders').mockResolvedValue([
      readyOrder,
      { ...readyOrder, _id: 'overdue', end_date: '2026-08-05T00:00:00.000Z' },
      { ...readyOrder, _id: 'waiting', status: 'Waiting-on-Parts' },
      { ...readyOrder, _id: 'blocked', status: 'On-Hold' }
    ]);

    await expect(service.executionSummaryData({ account_id: 'account-1' }, range)).resolves.toMatchObject({
      completed_count: 3,
      on_time_completed_count: 1,
      on_time_completion_rate: 33.33,
      overdue_open_count: 1,
      waiting_on_parts_count: 1,
      blocked_work_count: 1,
      ready_for_execution_count: 1,
      avg_time_to_complete_hours: 3
    });
  });

  it('returns on-time, completed-late, and open-overdue percentages including an empty population', async () => {
    const find = vi.spyOn(WorkOrderModel as any, 'find').mockReturnValue(queryResult([
      { actual_end_date: '2026-08-02', end_date: '2026-08-03' },
      { actual_end_date: '2026-08-04', end_date: '2026-08-03' }
    ]));
    const scoped = vi.spyOn(service, 'getExecutionScopedOrders').mockResolvedValue([
      { ...readyOrder, end_date: '2026-08-05' }
    ]);

    const result = await service.onTimeVsOverdue({}, range);
    expect(result).toEqual({
      total: 3,
      data: [
        { key: 'On Time', value: 1, percentage: 33.33 },
        { key: 'Completed Late', value: 1, percentage: 33.33 },
        { key: 'Open Overdue', value: 1, percentage: 33.33 }
      ]
    });

    find.mockReturnValue(queryResult([]));
    scoped.mockResolvedValue([]);
    expect(await service.onTimeVsOverdue({}, range)).toEqual({
      total: 0,
      data: [
        { key: 'On Time', value: 0, percentage: 0 },
        { key: 'Completed Late', value: 0, percentage: 0 },
        { key: 'Open Overdue', value: 0, percentage: 0 }
      ]
    });
  });

  it('formats time-to-complete buckets and rejects missing aggregation data', async () => {
    const aggregate = vi.spyOn(WorkOrderModel as any, 'aggregate').mockResolvedValue([
      { bucket: '2026-08-01', avg_hours: 2.25, count: 2 },
      { bucket: '2026-08-02', avg_hours: 3.75, count: 1 }
    ]);

    await expect(service.timeToComplete({}, range)).resolves.toEqual({
      granularity: 'day',
      date: ['2026-08-01', '2026-08-02'],
      avg_hours: [2.25, 3.75],
      count: [2, 1],
      overall_avg_hours: 3
    });

    aggregate.mockResolvedValue([]);
    await expect(service.timeToComplete({}, range))
      .rejects.toMatchObject({ message: 'No data found', status: 404 });
  });

  it('canonicalizes and sorts work-order types and rejects an empty collection', async () => {
    const find = vi.spyOn(WorkOrderModel as any, 'find').mockReturnValue(queryResult([
      { nature_of_work: 'mechanical' },
      { type: 'MECHENICAL' },
      { nature_of_work: 'Safety' }
    ]));

    await expect(service.workOrdersByType({})).resolves.toEqual([
      { key: 'Mechanical', value: 2 },
      { key: 'Safety', value: 1 }
    ]);

    find.mockReturnValue(queryResult([]));
    await expect(service.workOrdersByType({}))
      .rejects.toMatchObject({ message: 'No data found', status: 404 });
  });

  it('builds the source-mix compatibility shape with zero-filled categories', async () => {
    const aggregate = vi.spyOn(WorkOrderModel as any, 'aggregate').mockResolvedValue([
      { createdFrom: 'Preventive', bucket: '2026-08-01', count: 2 },
      { createdFrom: 'Work Order', bucket: '2026-08-02', count: 1 },
      { createdFrom: 'Asset Report', bucket: '2026-08-02', count: 3 }
    ]);

    await expect(service.workOrderSourceMix({
      createdAt: { $gte: new Date(range.fromDate), $lte: new Date(range.toDate) }
    })).resolves.toEqual({
      date: ['2026-08-01', '2026-08-02'],
      granularity: 'day',
      Preventive: [2, 0],
      'Work Request': [0, 0],
      'Work Order': [0, 1],
      'Asset Report': [0, 3]
    });

    aggregate.mockResolvedValue([]);
    await expect(service.workOrderSourceMix({}))
      .rejects.toMatchObject({ message: 'No data found', status: 404 });
  });

  it('rolls up asset maintenance while excluding unresolved asset references', async () => {
    const scoped = vi.spyOn(service, 'getExecutionScopedOrders').mockResolvedValue([
      {
        ...readyOrder,
        asset: { id: 'asset-1', asset_name: 'Pump A' },
        location: { location_name: 'Plant' },
        status: 'Completed',
        actual_time: 2,
        actual_end_date: '2026-08-03',
        end_date: '2026-08-04'
      },
      {
        ...readyOrder,
        _id: 'blocked',
        asset: { id: 'asset-1', asset_name: 'Pump A' },
        status: 'Waiting-on-Parts',
        actual_time: 1,
        parts: [{ cost: 4, estimatedQuantity: 3 }]
      },
      { ...readyOrder, _id: 'unresolved', asset: null, wo_asset_id: '' }
    ]);

    await expect(service.assetMaintenanceReport({})).resolves.toEqual([
      expect.objectContaining({
        id: 'asset-1',
        asset_name: 'Pump A',
        wo_count: 2,
        open_wo_count: 1,
        blocked_wo_count: 1,
        completed_count: 1,
        on_time_count: 1,
        on_time_percentage: 100,
        parts_spend: 22,
        actual_hours: 3
      })
    ]);

    scoped.mockResolvedValue([]);
    await expect(service.assetMaintenanceReport({}))
      .rejects.toMatchObject({ message: 'No data found', status: 404 });
    scoped.mockResolvedValue([{ asset: null }]);
    await expect(service.assetMaintenanceReport({}))
      .rejects.toMatchObject({ message: 'No data found', status: 404 });
  });

  it('summarizes the tenant-scoped work-request funnel and empty state', async () => {
    const aggregate = vi.spyOn(WorkRequestModel as any, 'aggregate').mockResolvedValue([{
      totals: [{ created: 10, approved: 6, rejected: 2, converted: 4, still_open: 2 }],
      createdTrend: [{ bucket: '2026-08-01', count: 3 }]
    }]);

    await expect(service.requestFunnelReport({
      account_id: 'account-1',
      wo_asset_id: { $in: ['asset-1'] },
      wo_location_id: { $in: ['location-1'] }
    }, range)).resolves.toMatchObject({
      created: 10,
      approved: 6,
      rejected: 2,
      converted: 4,
      still_open: 2,
      conversion_rate: 40,
      trend: { date: ['2026-08-01'], created: [3] }
    });
    expect(aggregate.mock.calls[0][0][0].$match).toMatchObject({
      account_id: 'account-1',
      asset_id: { $in: ['asset-1'] },
      location_id: { $in: ['location-1'] }
    });

    aggregate.mockResolvedValue([{}]);
    await expect(service.requestFunnelReport({ account_id: 'account-1' }, range))
      .rejects.toMatchObject({ message: 'No data found', status: 404 });
  });

  it('calculates parts impact totals, blockers, low stock, trend, and empty state', async () => {
    const scoped = vi.spyOn(service, 'getExecutionScopedOrders').mockResolvedValue([
      {
        ...readyOrder,
        status: 'Waiting-on-Parts',
        parts: [
          { part_id: 'part-1', part_name: 'Bearing', plannedQuantity: 2, actualQuantity: 1, cost: 5, availabilityStatus: 'Low Stock' },
          { part_name: 'Seal', estimatedQuantity: 3, actualQuantity: 0, cost: 2, shortQuantity: 1 }
        ]
      },
      { ...readyOrder, _id: 'empty-parts', createdAt: '2026-08-03', parts: [] },
      { ...readyOrder, _id: 'outside', createdAt: '2025-01-01' }
    ]);

    await expect(service.partsImpactReport({}, range)).resolves.toMatchObject({
      blocked_work_orders: 1,
      total_parts_spend: 11,
      low_stock_linked_parts: 1,
      planned_qty: 5,
      actual_qty: 1,
      actual_vs_planned_percentage: 20,
      trend: {
        granularity: 'day',
        date: ['2026-08-02'],
        planned_qty: [5],
        actual_qty: [1]
      }
    });

    scoped.mockResolvedValue([{ ...readyOrder, createdAt: '2025-01-01' }]);
    await expect(service.partsImpactReport({}, range))
      .rejects.toMatchObject({ message: 'No data found', status: 404 });
  });

  it('reports completed work with and without submitted inspections', async () => {
    const find = vi.spyOn(WorkOrderModel as any, 'find').mockReturnValue(queryResult([
      { actual_end_date: '2026-08-02', procedure_entries: [{ submitted: true }] },
      { actual_end_date: '2026-08-02', procedure_entries: [{ submitted: false }] },
      { actual_end_date: 'invalid', procedure_entries: [{ submitted: true }] }
    ]));

    await expect(service.completedWithInspectionReport({}, range)).resolves.toMatchObject({
      completed_count: 3,
      with_inspection_count: 1,
      without_inspection_count: 2,
      inspection_completion_rate: 33.33,
      trend: {
        date: ['2026-08-02'],
        with_inspection: [1],
        without_inspection: [1]
      }
    });

    find.mockReturnValue(queryResult([]));
    await expect(service.completedWithInspectionReport({}, range))
      .rejects.toMatchObject({ message: 'No data found', status: 404 });
  });

  it('attributes completed work to users and retains unattributed work', async () => {
    const userId = '507f1f77bcf86cd799439011';
    const secondUserId = '507f1f77bcf86cd799439012';
    vi.spyOn(WorkOrderModel as any, 'find').mockReturnValue(queryResult([
      { order_no: 'WO-1', completed_by: { id: userId } },
      { order_no: 'WO-2', status_details: [{ status: 'Completed', createdBy: secondUserId }] },
      { order_no: 'WO-3' }
    ]));
    vi.spyOn(UserModel as any, 'find').mockReturnValue(queryResult([
      { _id: userId, firstName: 'Ada', lastName: 'Lovelace' }
    ]));

    const result = await service.completedByUserReport({}, range);
    expect(result).toMatchObject({
      completed_count: 3,
      attributed_count: 2,
      unattributed_count: 1,
      chart: { labels: ['Ada Lovelace', 'Unknown User'], counts: [1, 1] }
    });
    expect(result.details).toEqual([
      expect.objectContaining({ user_id: userId, user_name: 'Ada Lovelace', recent_work_orders: ['WO-1'] }),
      expect.objectContaining({ user_id: secondUserId, user_name: 'Unknown User', recent_work_orders: ['WO-2'] })
    ]);
  });

  it('calculates time-versus-cost details and sorted daily trends', async () => {
    const find = vi.spyOn(WorkOrderModel as any, 'find').mockReturnValue(queryResult([
      {
        order_no: 'WO-1', title: 'Pump',
        actual_start_date: '2026-08-02T08:00:00.000Z',
        actual_end_date: '2026-08-02T10:00:00.000Z',
        parts: [{ cost: 5, actualQuantity: 2 }]
      },
      {
        order_no: 'WO-2', title: 'Motor',
        actual_start_date: '2026-08-02T09:00:00.000Z',
        actual_end_date: '2026-08-02T13:00:00.000Z',
        parts: [{ cost: 2, plannedQuantity: 3 }]
      },
      { order_no: 'WO-invalid', actual_end_date: 'invalid', parts: [] }
    ]));

    await expect(service.timeVsCostReport({}, range)).resolves.toMatchObject({
      completed_count: 3,
      total_parts_spend: 16,
      avg_actual_hours: 2,
      avg_parts_spend: 5.33,
      trend: {
        date: ['2026-08-02'],
        avg_hours: [3],
        avg_parts_cost: [8]
      },
      details: expect.arrayContaining([
        expect.objectContaining({ order_no: 'WO-1', actual_hours: 2, parts_cost: 10 }),
        expect.objectContaining({ order_no: 'WO-2', actual_hours: 4, parts_cost: 6 })
      ])
    });

    find.mockReturnValue(queryResult([]));
    await expect(service.timeVsCostReport({}, range))
      .rejects.toMatchObject({ message: 'No data found', status: 404 });
  });

  it('classifies planner readiness counters and schedule cadence', async () => {
    const scoped = vi.spyOn(service, 'getExecutionScopedOrders').mockResolvedValue([
      readyOrder,
      { ...readyOrder, _id: 'backlog', assignedUsers: [], end_date: '2026-08-10', estimated_time: 0 },
      { ...readyOrder, _id: 'blocked', status: 'Waiting-on-Parts', parentId: 'parent-1' },
      { ...readyOrder, _id: 'assigned', start_date: null },
      { ...readyOrder, _id: 'overdue', end_date: '2026-08-05' },
      { ...readyOrder, _id: 'outside', createdAt: '2025-01-01', start_date: null, end_date: null }
    ]);

    await expect(service.plannerReadinessReport({}, range)).resolves.toMatchObject({
      total_open: 5,
      ready_for_execution_count: 1,
      blocked_work_count: 1,
      overdue_open_count: 1,
      unassigned_count: 1,
      due_today_count: 1,
      on_hold_count: 1,
      blocked_by_parts_count: 1,
      missing_estimate_count: 1,
      follow_ups_count: 1
    });

    scoped.mockResolvedValue([]);
    await expect(service.plannerReadinessReport({}, range))
      .rejects.toMatchObject({ message: 'No data found', status: 404 });

    const scheduleAggregate = vi.spyOn(SchedulerModel as any, 'aggregate').mockResolvedValue([
      { _id: 's1', title: 'Weekly', schedule: { mode: 'weekly', enabled: true, start_date: '2026-08-01', end_date: '2026-09-01', no_of_execution: 3 }, asset: { asset_name: 'Pump' } },
      { _id: 's2', work_order: { title: 'Monthly fallback' }, schedule: { mode: 'monthly', enabled: false, start_date: '2026-08-05', no_of_execution: 1 }, location: { location_name: 'Plant' } },
      { _id: 's3', schedule: { mode: 'unexpected', enabled: true, start_date: '2025-01-01', end_date: '2025-02-01' } }
    ]);

    await expect(service.repeatingWorkOrdersReport({
      account_id: 'account-1',
      wo_asset_id: { $in: ['asset-1'] },
      wo_location_id: { $in: ['location-1'] }
    }, range)).resolves.toMatchObject({
      total_repeating: 2,
      enabled_repeating: 1,
      disabled_repeating: 1,
      total_executions: 4,
      cadence_mix: [
        { key: 'Daily', value: 0 },
        { key: 'Weekly', value: 1 },
        { key: 'Monthly', value: 1 }
      ]
    });
    expect(scheduleAggregate.mock.calls[0][0][0].$match).toMatchObject({
      'work_order.wo_asset_id': { $in: ['asset-1'] },
      'work_order.wo_location_id': { $in: ['location-1'] }
    });

    scheduleAggregate.mockResolvedValue([]);
    await expect(service.repeatingWorkOrdersReport({ account_id: 'account-1' }, range))
      .rejects.toMatchObject({ message: 'No data found', status: 404 });
  });
});
