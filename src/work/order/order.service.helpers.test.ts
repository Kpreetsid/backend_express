import mongoose from 'mongoose';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../_config/mailer', () => ({
  MailerService: class MailerService {}
}));

import { orderService } from './order.service';

const service = orderService as any;
const actor = {
  _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'),
  account_id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439012'),
  firstName: 'Enterprise',
  lastName: 'User'
};

describe('work-order deterministic domain helpers', () => {
  beforeEach(() => vi.useFakeTimers().setSystemTime(new Date('2026-08-01T12:00:00.000Z')));
  afterEach(() => vi.useRealTimers());

  it('normalizes query, audit, labels, and nature-of-work values deterministically', () => {
    expect(service.escapeRegex('pump.*(1)')).toBe('pump\\.\\*\\(1\\)');
    expect(service.getQueryValues([' Open ', '', null, 'Closed'])).toEqual(['Open', 'Closed']);
    expect(service.getQueryValues(' Open, Closed ,,')).toEqual(['Open', 'Closed']);

    const objectId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439013');
    expect(service.normalizeAuditValue(undefined)).toBeNull();
    expect(service.normalizeAuditValue(new Date('2026-01-02T03:04:05.000Z')))
      .toBe('2026-01-02T03:04:05.000Z');
    expect(service.normalizeAuditValue({ z: objectId, a: [1, null] })).toEqual({
      a: [1, null],
      z: String(objectId)
    });
    expect(service.hasMeaningfulChange({ b: 2, a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(service.hasMeaningfulChange({ a: 1 }, { a: 2 })).toBe(true);

    expect(service.formatAuditList([])).toBe('');
    expect(service.formatAuditList([' title '])).toBe('title');
    expect(service.formatAuditList(['title', 'priority'])).toBe('title and priority');
    expect(service.formatAuditList(['title', 'priority', 'asset']))
      .toBe('title, priority, and asset');

    expect(service.canonicalizeNatureOfWork('')).toBe('General');
    expect(service.canonicalizeNatureOfWork('breakdwon job')).toBe('Breakdown');
    expect(service.canonicalizeNatureOfWork('MECHENICAL')).toBe('Mechanical');
    expect(service.canonicalizeNatureOfWork('Custom Work')).toBe('Custom Work');
    expect(service.normalizeNatureOfWorkPayload(null)).toBeNull();
    expect(service.normalizeNatureOfWorkPayload({ nature_of_work: 'preventive maintenance' }))
      .toEqual({ nature_of_work: 'Preventive', type: 'Preventive' });
    expect(service.normalizeNatureOfWorkPayload({ type: 'Quality' }))
      .toEqual({ type: 'Quality', nature_of_work: 'Quality' });
  });

  it('maintains completion/status audit ownership and summarizes changed execution data', () => {
    expect(service.buildCompletedByPayload(null)).toBeNull();
    expect(service.buildCompletedByPayload(actor)).toEqual({
      id: String(actor._id),
      firstName: 'Enterprise',
      lastName: 'User'
    });

    const completed = service.syncCompletionAuditFields({
      status: 'Completed',
      actual_end_date: '2026-07-31T10:00:00.000Z'
    }, 'In-Progress', actor);
    expect(completed.completed_at).toEqual(new Date('2026-07-31T10:00:00.000Z'));
    expect(completed.completed_by.id).toBe(String(actor._id));

    const alreadyCompleted = service.syncCompletionAuditFields({
      status: 'Completed',
      completed_at: '2026-07-30T10:00:00.000Z',
      completed_by: { id: 'original' }
    }, 'Completed', actor);
    expect(alreadyCompleted.completed_by).toEqual({ id: 'original' });
    expect(service.syncCompletionAuditFields({ status: 'Open' }, 'Completed', actor))
      .toMatchObject({ completed_at: null, completed_by: null });

    const status = service.syncStatusDetailAuditFields({
      createdBy: 'creator-1',
      status_details: [
        { status: 'Open' },
        { status: '', createdBy: 'user-x' },
        { status: 'Completed', createdBy: 'user-y' }
      ]
    }, actor);
    expect(status.status_details).toEqual([
      { status: 'Open', createdBy: actor._id },
      { status: 'Completed', createdBy: 'user-y' }
    ]);

    expect(service.getGeneralChangeLabels(
      { title: 'Old', priority: 'High' },
      { title: 'New', priority: 'High' },
      { title: 'New', priority: 'High', ignored: true }
    )).toEqual(['title']);
    expect(service.summarizePartsForAudit([
      { plannedQuantity: '2', actualQuantity: 1 },
      { estimatedQuantity: 3, actualQuantity: 'bad' }
    ])).toEqual({ lineCount: 2, plannedQuantity: 5, actualQuantity: 1 });
    expect(service.summarizeProcedureAudit([{ submitted: true }, { submitted: false }]))
      .toEqual({ total: 2, submitted: 1 });
    expect(service.summarizeExecutionAudit({ labor_entries: [{}, {}], actual_time: '1.5' }))
      .toEqual({ laborCount: 2, actualTime: 1.5, actualStartDate: null, actualEndDate: null });
    expect(service.summarizeExecutionAudit({ actual_time: 'bad' }).actualTime).toBeNull();
    expect(service.summarizeTaskAudit([
      { completed: true }, { status: 'Completed' }, { status: 'Open' }
    ])).toEqual({ total: 3, completed: 2 });
  });

  it('evaluates nested procedure visibility, required answers, scoring, and corrective actions', () => {
    const steps = [
      {
        id: 'mode', type: 'field', field_type: 'multiple-choice', required: true,
        options: ['Run', 'Stop'], scoring_enabled: true, option_scores: [5, 0]
      },
      {
        id: 'checks', type: 'field', field_type: 'checkbox', required: true,
        options: ['Oil', 'Guard'], scoring_enabled: true, option_scores: [2, 3],
        corrective_actions: [{
          id: 'action-1', title: 'Replace guard', trigger_values: ['Guard'], priority: 'High'
        }]
      },
      {
        type: 'section',
        items: [{
          id: 'temperature', type: 'field', field_type: 'number', required: true,
          visibility_condition: { step_id: 'mode', values: ['Run'] }
        }]
      },
      {
        id: 'hidden', type: 'field', field_type: 'text', required: true,
        visibility_condition: { step_id: 'mode', values: ['Never'] }
      }
    ];
    const responses = { mode: 'Run', checks: ['Oil', 'Guard'], temperature: '42' };

    expect(service.isProcedureFieldAnswered({ type: 'section' }, {})).toBe(true);
    expect(service.isProcedureFieldAnswered({ type: 'field', required: true, id: 'x', field_type: 'checklist' }, { x: [] })).toBe(false);
    expect(service.isProcedureFieldAnswered({ type: 'field', required: true, id: 'x', field_type: 'yes-no-na' }, { x: 'Yes' })).toBe(true);
    expect(service.isProcedureFieldAnswered({ type: 'field', required: true, id: 'x', field_type: 'number' }, { x: 'not-a-number' })).toBe(false);
    expect(service.isProcedureFieldAnswered({ type: 'field', required: true, id: 'x', field_type: 'date' }, { x: '2026-08-01' })).toBe(true);
    expect(service.isProcedureFieldAnswered({ type: 'field', required: true, id: 'x', field_type: 'text' }, { x: '  ' })).toBe(false);
    expect(service.isProcedureStepVisible({}, responses)).toBe(true);
    expect(service.isProcedureStepVisible({ visibility_condition: { step_id: 'checks', values: ['Guard'] } }, responses)).toBe(true);
    expect(service.isProcedureStepVisible({ visibility_condition: { step_id: 'checks', values: ['Missing'] } }, responses)).toBe(false);
    expect(service.areProcedureStepsComplete(steps, responses)).toBe(true);
    expect(service.areProcedureStepsComplete(steps, { ...responses, temperature: '' })).toBe(false);

    expect(service.collectProcedureScore(steps, responses)).toEqual({
      earned: 10,
      possible: 10,
      percentage: 100
    });
    expect(service.collectProcedureScore([{ type: 'field', scoring_enabled: false }], {}))
      .toEqual({ earned: 0, possible: 0, percentage: null });
    expect(service.collectTriggeredCorrectiveActions(steps, responses)).toEqual([
      expect.objectContaining({
        id: 'action-1',
        step_id: 'checks',
        title: 'Replace guard',
        trigger_values: ['Guard']
      })
    ]);
    expect(service.collectTriggeredCorrectiveActions(steps, { ...responses, checks: ['Oil'] }))
      .toEqual([]);

    const completeEntry = service.buildProcedureEntry({
      _id: 'procedure-1',
      name: 'Inspection',
      category: 'Safety',
      tags: ['critical'],
      steps
    }, { responses }, actor);
    expect(completeEntry).toMatchObject({
      procedure_id: 'procedure-1',
      submitted: true,
      submitted_by: { id: String(actor._id) },
      score_summary: { percentage: 100 }
    });
    expect(completeEntry.submitted_at).toEqual(new Date('2026-08-01T12:00:00.000Z'));
    expect(service.buildProcedureEntry({}, { responses: null }, actor))
      .toMatchObject({ name: 'Untitled Procedure', submitted: true });
  });

  it('sanitizes timing, execution-owned fields, object IDs, parts, tasks, and labor', () => {
    expect(service.normalizeTimingFields({
      actual_start_date: '2026-08-01T08:00:00.000Z',
      actual_end_date: '2026-08-01T10:30:00.000Z',
      actual_time: '',
      block_reason: '',
      labor_entries: [
        { user_id: 'user-1', hours: '1.5', notes: 'work' },
        { vendor_name: 'Vendor', hours: 2 },
        { user_id: 'user-2', hours: 'bad' },
        { hours: 1 }
      ]
    })).toMatchObject({
      actual_time: 2.5,
      block_reason: null,
      labor_entries: [
        expect.objectContaining({ user_id: 'user-1', hours: 1.5, notes: 'work' }),
        expect.objectContaining({ vendor_name: 'Vendor', hours: 2 })
      ]
    });
    expect(service.normalizeTimingFields({
      actual_start_date: '', actual_end_date: '', actual_time: 'bad'
    })).toMatchObject({ actual_start_date: null, actual_end_date: null, actual_time: null });

    expect(service.sanitizeWorkOrder({
      parts: [{ id: 'part-1' }, { _id: 'part-2', part_type: 'Spare' }],
      tasks: [{ assigned_user_id: '' }],
      labor_entries: [{ user_id: '' }],
      wo_asset_id: '',
      parentId: ''
    })).toMatchObject({
      parts: [
        expect.objectContaining({ part_id: 'part-1', part_type: 'N/A' }),
        expect.objectContaining({ part_id: 'part-2', part_type: 'Spare' })
      ],
      tasks: [{ assigned_user_id: null }],
      labor_entries: [{ user_id: null }],
      wo_asset_id: null,
      parentId: null
    });

    const validId = '507f1f77bcf86cd799439014';
    expect(() => service.validateIncomingParts([{ part_id: validId }])).not.toThrow();
    expect(() => service.validateIncomingParts([{ part_id: 'bad', part_name: 'Bearing' }]))
      .toThrow('Invalid part selection for "Bearing"');
    expect(service.normalizeObjectIdArray('not-array')).toEqual([]);
    expect(service.normalizeObjectIdArray([validId, 'bad', '', null]).map(String)).toEqual([validId]);
    expect(service.hasExecutionOwnedFieldChanges({ title: 'Only title' })).toBe(false);
    expect(service.hasExecutionOwnedFieldChanges({ labor_entries: [] })).toBe(true);
  });

  it('inherits parent planning data and produces deterministic hierarchy rollups', () => {
    const inherited = service.applyParentInheritance({
      title: 'Child',
      priority: '',
      userIdList: []
    }, {
      priority: 'High',
      type: 'Maintenance',
      nature_of_work: 'Preventive',
      description: 'Parent description',
      wo_location_id: 'location-1',
      wo_asset_id: 'asset-1',
      start_date: '2026-08-02',
      end_date: '2026-08-03'
    }, ['user-1']);
    expect(inherited.normalizedBody).toMatchObject({
      priority: 'High',
      type: 'Maintenance',
      nature_of_work: 'Preventive',
      description: 'Parent description'
    });
    expect(inherited.userIdList).toEqual(['user-1']);
    expect(service.applyParentInheritance({ userIdList: ['user-2'], priority: 'Low' }, { priority: 'High' }, ['user-1']))
      .toMatchObject({ normalizedBody: { priority: 'Low' }, userIdList: ['user-2'] });
    expect([undefined, null, '', []].every(value => service.shouldInheritValue(value))).toBe(true);
    expect(service.shouldInheritValue(['value'])).toBe(false);

    const childOrders = [
      {
        status: 'Completed', actual_time: 4,
        labor_entries: [{ user_id: 'u1', hours: 1.5 }, { vendor_name: 'V', hours: 2 }],
        parts: [{ plannedQuantity: 3, reservedQuantity: 2, issuedQuantity: 1, returnedQuantity: 1, shortQuantity: 1 }]
      },
      { status: 'In-Progress', actual_time: 2, labor_entries: [], parts: [] },
      { status: 'On-Hold' },
      { status: 'Waiting-on-Parts' },
      { status: 'Open' }
    ];
    expect(service.buildChildStatusSummary(childOrders)).toEqual({
      total: 5, open: 1, inProgress: 1, blocked: 1, onHold: 1,
      completed: 1, completionPercent: 20
    });
    expect(service.buildChildLaborRollup(childOrders)).toEqual({
      totalHours: 5.5,
      entryCount: 2,
      contributorCount: 2
    });
    expect(service.buildChildPartsRollup(childOrders)).toEqual({
      lineCount: 1,
      plannedQuantity: 3,
      reservedQuantity: 2,
      issuedQuantity: 1,
      returnedQuantity: 1,
      shortQuantity: 1,
      shortLineCount: 1
    });

    const decorated = service.decorateHierarchy({
      _id: 'parent-1',
      parentId: 'grandparent-1',
      childOrders,
      parentOrder: { _id: 'grandparent-1', order_no: 'WO-1', title: 'Parent', status: 'Open' }
    });
    expect(decorated.hierarchy).toMatchObject({
      isParentWorkOrder: true,
      isChildWorkOrder: true,
      executionOwnedByChildren: true,
      childProgressLabel: '1/5 complete',
      parentReference: { id: 'grandparent-1', order_no: 'WO-1' }
    });
    expect(service.decorateHierarchyCollection([{ childOrders: [] }])[0].hierarchy)
      .toMatchObject({ isParentWorkOrder: false, childProgressLabel: '', parentReference: null });
  });

  it('classifies report dates, lifecycle readiness, planner buckets, costs, and ranges', () => {
    const range = {
      fromDate: new Date('2026-07-01T00:00:00.000Z'),
      toDate: new Date('2026-08-31T23:59:59.000Z')
    };
    expect(service.normalizeDateRange()).toBeNull();
    expect(service.normalizeDateRange({ fromDate: 'bad', toDate: '2026-08-01' })).toBeNull();
    expect(service.normalizeDateRange({ fromDate: '2026-07-01', toDate: '2026-08-01' }))
      .toEqual({ fromDate: new Date('2026-07-01'), toDate: new Date('2026-08-01') });
    expect(service.getCompletionDateExpression().$let.vars.completedEntries.$filter.cond)
      .toEqual({ $eq: ['$$statusEntry.status', 'Completed'] });
    expect(service.getRangeBucketConfig(range)).toEqual({ format: '%Y-%m-%d', label: 'day' });
    expect(service.getRangeBucketConfig({
      fromDate: new Date('2025-01-01'), toDate: new Date('2026-01-01')
    })).toEqual({ format: '%Y-%m', label: 'month' });
    expect(service.parseReportDate(null)).toBeNull();
    expect(service.parseReportDate('bad')).toBeNull();
    expect(service.parseReportDate('2026-08-01')).toEqual(new Date('2026-08-01'));
    expect(service.isBlockedLikeStatus('Waiting-on-Permit')).toBe(true);
    expect(service.isBlockedLikeStatus('Open')).toBe(false);
    expect(service.getAssignedUserCount({ assignedUsers: [
      { user: { _id: 'u1' } }, { user: { id: 'u2' } }, { user: {} }
    ] })).toBe(2);
    expect(service.getAssignedUserCount({})).toBe(0);

    expect(service.getPartLifecycleState({ lifecycleStatus: 'issued' })).toBe('issued');
    expect(service.getPartLifecycleState({ lifecycle_status: 'returned' })).toBe('returned');
    expect(service.getPartLifecycleState({ reservationStatus: 'Short' })).toBe('short');
    expect(service.getPartLifecycleState({ reservationStatus: 'Issued / Returned' })).toBe('returned');
    expect(service.getPartLifecycleState({ reservationStatus: 'Issued' })).toBe('issued');
    expect(service.getPartLifecycleState({ reservationStatus: 'Reserved' })).toBe('reserved');
    expect(service.getPartLifecycleState({})).toBe('planned');

    expect(service.isProcedureReadyForExecution({ procedures: [] })).toBe(false);
    expect(service.isProcedureReadyForExecution({ procedures: [{ submitted: true }] })).toBe(true);
    expect(service.isProcedureReadyForExecution({ procedures: [{ submitted: false }] })).toBe(false);
    expect(service.isPartsReadyForExecution({ status: 'Waiting-on-Parts', parts: [] })).toBe(false);
    expect(service.isPartsReadyForExecution({ status: 'Open', parts: [{ estimatedQuantity: 1 }] })).toBe(false);
    expect(service.isPartsReadyForExecution({ status: 'Open', parts: [{ part_id: 'p1', estimatedQuantity: 1, availabilityStatus: 'Out of Stock' }] })).toBe(false);
    expect(service.isPartsReadyForExecution({ status: 'Open', parts: [{ part_id: 'p1', estimatedQuantity: 1, lifecycleStatus: 'short' }] })).toBe(false);
    expect(service.isPartsReadyForExecution({ status: 'Open', parts: [{ part_id: 'p1', estimatedQuantity: 1 }] })).toBe(true);

    const ready = {
      status: 'Open',
      start_date: '2026-08-01T00:00:00.000Z',
      end_date: '2026-08-02T00:00:00.000Z',
      assignedUsers: [{ user: { _id: 'u1' } }],
      parts: [{ part_id: 'p1', estimatedQuantity: 1 }],
      procedures: [{ submitted: true }]
    };
    expect(service.isScheduleReadyForExecution(ready)).toBe(true);
    expect(service.isScheduleReadyForExecution({ ...ready, status: 'Blocked' })).toBe(false);
    expect(service.isScheduleReadyForExecution({ ...ready, start_date: null })).toBe(false);
    expect(service.isScheduleReadyForExecution({ ...ready, end_date: '2026-07-01' })).toBe(false);
    expect(service.isExecutionReadyOrder(ready)).toBe(true);
    expect(service.isExecutionReadyOrder({ ...ready, status: 'Completed' })).toBe(false);
    expect(service.isExecutionReadyOrder({ ...ready, assignedUsers: [] })).toBe(false);
    expect(service.isOpenOrder(ready)).toBe(true);
    expect(service.isOpenOrder({ status: 'Completed' })).toBe(false);

    expect(service.isOrderWithinActiveExecutionRange({ end_date: '2026-08-02' }, range)).toBe(true);
    expect(service.isOrderWithinActiveExecutionRange({ start_date: '2026-07-02' }, range)).toBe(true);
    expect(service.isOrderWithinActiveExecutionRange({ createdAt: '2026-07-03' }, range)).toBe(true);
    expect(service.isOrderWithinActiveExecutionRange({ createdAt: '2025-01-01' }, range)).toBe(false);
    expect(service.getActualCompletionHours({
      actual_start_date: '2026-08-01T08:00:00Z', actual_end_date: '2026-08-01T10:30:00Z'
    })).toBe(2.5);
    expect(service.getActualCompletionHours({ actual_start_date: 'bad', actual_end_date: '2026-08-01' })).toBeNull();
    expect(service.getActualCompletionHours({ actual_start_date: '2026-08-02', actual_end_date: '2026-08-01' })).toBeNull();
    expect(service.hasSubmittedInspection({ procedure_entries: [{ submitted: false }, { submitted: true }] })).toBe(true);
    expect(service.getCompletedStatusEntry({ status_details: [
      { status: 'Completed', id: 1 }, { status: 'Open' }, { status: 'Completed', id: 2 }
    ] })).toMatchObject({ id: 2 });
    expect(service.getPartsSpend({ parts: [
      { cost: 10, actualQuantity: 2 }, { cost: 5, plannedQuantity: 3 }
    ] })).toBe(35);

    expect(service.getPlannerBucketId({ ...ready, status: 'Completed' })).toBe('ready');
    expect(service.getPlannerBucketId({ ...ready, end_date: '2026-07-31' })).toBe('overdue');
    expect(service.getPlannerBucketId({ ...ready, assignedUsers: [] })).toBe('backlog');
    expect(service.getPlannerBucketId({ ...ready, status: 'On-Hold' })).toBe('blocked');
    expect(service.getPlannerBucketId({ ...ready, start_date: null })).toBe('assigned');
    expect(service.getPlannerBucketId({ ...ready, procedures: [{ submitted: false }] })).toBe('blocked');
    expect(service.getPlannerBucketId(ready)).toBe('ready');

    expect(service.isScheduleOverlappingRange({ schedule: {} }, range)).toBe(false);
    expect(service.isScheduleOverlappingRange({
      schedule: { start_date: '2026-01-01', end_date: '2026-06-01' }
    }, range)).toBe(false);
    expect(service.isScheduleOverlappingRange({
      schedule: { start_date: '2026-08-15', end_date: '2026-09-01' }
    }, range)).toBe(true);
  });
});
