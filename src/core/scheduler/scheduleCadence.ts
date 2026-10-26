import { IScheduleMaster } from '../../modules/maintenance/models/scheduleMaster.model';

import { isScheduleDue } from './schedule-calendar';

export const resolveSchedulerTimeZone = (candidate = process.env.SCHEDULER_TIMEZONE): string => {
  const fallback = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const requested = String(candidate || fallback).trim() || fallback;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: requested }).format(new Date());
    return requested;
  } catch {
    console.warn(`Invalid SCHEDULER_TIMEZONE "${requested}". Falling back to UTC.`);
    return 'UTC';
  }
};

export const calendarDateInTimeZone = (value: Date, timeZone: string): Date => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(value);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)));
};

export const addCalendarDays = (value: Date, days: number): Date => {
  const result = new Date(value.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
};

export const addCalendarMonths = (value: Date, months: number): Date => {
  const result = new Date(value.getTime());
  const originalDay = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDayOfTargetMonth = new Date(Date.UTC(
    result.getUTCFullYear(),
    result.getUTCMonth() + 1,
    0
  )).getUTCDate();
  result.setUTCDate(Math.min(originalDay, lastDayOfTargetMonth));
  return result;
};

const dateOnlyUtc = (value: Date | string): Date | null => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};

export const dateKeyUtc = (value: Date | string): string => {
  const date = dateOnlyUtc(value);
  return date ? date.toISOString().slice(0, 10) : '';
};

export const isSameUtcDate = (left: Date | string, right: Date | string): boolean => {
  const leftKey = dateKeyUtc(left);
  return !!leftKey && leftKey === dateKeyUtc(right);
};

/** Evaluate the shared recurrence policy using the scheduler's resolved calendar day. */
export const isScheduleDueOnDate = (schedule: IScheduleMaster | any, now: Date = new Date()): boolean => {
  const config = schedule?.schedule;
  const today = dateOnlyUtc(now);
  if (!config || !today) return false;
  // The shared policy uses local calendar fields. Dates persisted by this scheduler
  // represent UTC calendar days; convert them to date-only strings before evaluation.
  const calendarValue = (value: Date | string | null | undefined) =>
    value instanceof Date ? dateKeyUtc(value) : value;
  const policySchedule = {
    ...config,
    start_date: calendarValue(config.start_date),
    end_date: calendarValue(config.end_date),
    last_execution_date: calendarValue(config.last_execution_date)
  };
  const localCalendarDay = new Date(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 12);
  return isScheduleDue(policySchedule, localCalendarDay);
};
