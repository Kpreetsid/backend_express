import { IScheduleMaster } from '../models/scheduleMaster.model';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

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

const positiveInteger = (value: unknown, fallback = 1): number => {
  const numberValue = Number(value);
  return Number.isInteger(numberValue) && numberValue > 0 ? numberValue : fallback;
};

export const dateKeyUtc = (value: Date | string): string => {
  const date = dateOnlyUtc(value);
  return date ? date.toISOString().slice(0, 10) : '';
};

export const isSameUtcDate = (left: Date | string, right: Date | string): boolean => {
  const leftKey = dateKeyUtc(left);
  return !!leftKey && leftKey === dateKeyUtc(right);
};

export const isScheduleDueOnDate = (schedule: IScheduleMaster | any, now: Date = new Date()): boolean => {
  const config = schedule?.schedule;
  const today = dateOnlyUtc(now);
  const start = dateOnlyUtc(config?.start_date);
  if (!config || !today || !start || today < start || config.enabled === false) return false;

  const end = config.end_date ? dateOnlyUtc(config.end_date) : null;
  if (config.end_date && !end) return false;
  if (end && today > end) return false;
  if (config.no_of_repetition && Number(config.no_of_execution || 0) >= Number(config.no_of_repetition)) return false;
  if (config.last_execution_date && isSameUtcDate(config.last_execution_date, today)) return false;

  const todayKey = dateKeyUtc(today);
  if (Array.isArray(config.skipDates) && config.skipDates.includes(todayKey)) return false;
  if (config.skipWeekends) {
    const day = today.getUTCDay();
    if (day === 6 && config.skipWeekendSaturday) return false;
    if (day === 0 && config.skipWeekendSunday) return false;
  }

  const daysSinceStart = Math.floor((today.getTime() - start.getTime()) / DAY_MS);
  if (config.mode === 'daily') {
    return daysSinceStart % positiveInteger(config.daily?.everyNDays) === 0;
  }

  if (config.mode === 'weekly') {
    const weeksSinceStart = Math.floor(daysSinceStart / 7);
    const days = Array.isArray(config.weekly?.days)
      ? config.weekly.days.map((day: unknown) => String(day).trim().toLowerCase())
      : [];
    return weeksSinceStart % positiveInteger(config.weekly?.everyNWeeks) === 0
      && days.includes(WEEKDAYS[today.getUTCDay()]);
  }

  if (config.mode === 'monthly') {
    const monthsSinceStart = (today.getUTCFullYear() - start.getUTCFullYear()) * 12
      + today.getUTCMonth() - start.getUTCMonth();
    const monthDays = Array.isArray(config.monthly?.monthDays)
      ? config.monthly.monthDays.map(Number)
      : [];
    return monthsSinceStart % positiveInteger(config.monthly?.everyNMonths) === 0
      && monthDays.includes(today.getUTCDate());
  }

  return false;
};
