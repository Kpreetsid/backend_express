import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import { schedulerService } from './scheduler.service';
import { SchedulerModel } from '@modules/maintenance/models/scheduleMaster.model';
import { isScheduleDue } from './schedule-calendar';
const service = schedulerService as any;
afterEach(() => { mock.restoreAll(); mock.timers.reset(); });
function plan(overrides: Record<string, unknown> = {}): any {
  return { enabled: true, mode: 'daily', start_date: '2026-10-01', end_date: null,
    no_of_execution: 0, skipDates: [], skipWeekends: false,
    daily: { everyNDays: 1 }, weekly: { everyNWeeks: 1, days: ['monday'] },
    monthly: { everyNMonths: 1, monthDays: [1] }, ...overrides };
}
async function runFor(now: string, overrides: Record<string, unknown>, freshOverrides?: Record<string, unknown>): Promise<number> {
  mock.timers.enable({ apis: ['Date'], now: new Date(now) });
  const schedule: any = { _id: '111111111111111111111111', title: 'Test plan', visible: true, schedule: plan(overrides) };
  mock.method(SchedulerModel, 'find', async () => [schedule] as any);
  mock.method(SchedulerModel, 'findOneAndUpdate', async () => freshOverrides ? { ...schedule, schedule: { ...schedule.schedule, ...freshOverrides } } : schedule);
  mock.method(SchedulerModel, 'updateOne', async () => ({ modifiedCount: 1 }) as any);
  mock.method(service, 'executeSchedule', async () => undefined);
  await schedulerService.runUnifiedScheduler();
  return service.executeSchedule.mock.callCount();
}
test('every three days does not generate on the intervening day', async () => assert.equal(await runFor('2026-10-03T12:15:00Z', { daily: { everyNDays: 3 } }), 0));
test('every three days generates on its anchored due date', async () => assert.equal(await runFor('2026-10-04T12:15:00Z', { daily: { everyNDays: 3 } }), 1));
test('every two weeks skips the intervening selected weekday', async () => assert.equal(await runFor('2026-10-12T12:15:00Z', { start_date: '2026-10-05', mode: 'weekly', weekly: { everyNWeeks: 2, days: ['monday'] } }), 0));
test('every two months skips the intervening month', async () => assert.equal(await runFor('2026-02-01T12:15:00Z', { start_date: '2026-01-01', mode: 'monthly', monthly: { everyNMonths: 2, monthDays: [1] } }), 0));
test('end date is inclusive later on the final calendar day', async () => assert.equal(await runFor('2026-10-01T12:15:00Z', { end_date: '2026-10-01' }), 1));
test('claimed document is rechecked after another worker completed it', async () => assert.equal(await runFor('2026-10-01T12:15:00Z', {}, { last_execution_date: new Date('2026-10-01T12:00:00Z') }), 0));
test('claimed document is rechecked after the plan is paused', async () => assert.equal(await runFor('2026-10-01T12:15:00Z', {}, { enabled: false }), 0));
test('invalid interval fails closed', () => {
  for (const everyNDays of [0, -1, 1.5, 'bad']) assert.equal(isScheduleDue(plan({ daily: { everyNDays } }), new Date('2026-10-01T12:00:00Z')), false);
});
test('calendar policy respects exceptions, limits and invalid dates', () => {
  const now = new Date('2026-10-03T12:00:00Z');
  assert.equal(isScheduleDue(plan({ skipDates: ['2026-10-03'] }), now), false);
  assert.equal(isScheduleDue(plan({ skipWeekends: true, skipWeekendSaturday: true }), now), false);
  assert.equal(isScheduleDue(plan({ no_of_repetition: 2, no_of_execution: 2 }), now), false);
  assert.equal(isScheduleDue(plan({ start_date: '2026-02-30' }), now), false);
});
test('calendar policy handles leap days and year boundaries', () => {
  assert.equal(isScheduleDue(plan({ start_date: '2028-02-28', daily: { everyNDays: 2 } }), new Date('2028-03-01T12:00:00Z')), true);
  assert.equal(isScheduleDue(plan({ start_date: '2026-12-01', mode: 'monthly', monthly: { everyNMonths: 2, monthDays: [1] } }), new Date('2027-02-01T12:00:00Z')), true);
});
