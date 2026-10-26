import type { IScheduleMaster } from '../../modules/maintenance/models/scheduleMaster.model';

type Schedule = IScheduleMaster['schedule'];
const DAY_MS = 86400000;
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/** Calendar dates use the same process timezone as the existing cron registration. */
export function scheduleDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year!, month! - 1, day!, 12);
    return date.getFullYear() === year && date.getMonth() === month! - 1 && date.getDate() === day ? date : null;
  }
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function scheduleDateKey(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function ordinal(value: Date): number {
  return Math.floor(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()) / DAY_MS);
}

function interval(value: unknown): number | null {
  if (value === undefined || value === null) return 1;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

/** Shared, side-effect-free recurrence policy; weekly intervals start on Monday. */
export function isScheduleDue(schedule: Schedule, now: Date = new Date()): boolean {
  const start = scheduleDate(schedule?.start_date);
  const end = scheduleDate(schedule?.end_date);
  if (!schedule?.enabled || !start || !Number.isFinite(now.getTime())) return false;
  if (schedule.end_date && !end) return false;
  const today = ordinal(now);
  const first = ordinal(start);
  if (today < first || (end && today > ordinal(end))) return false;
  const limit = Number(schedule.no_of_repetition || 0);
  if (limit > 0 && Number(schedule.no_of_execution || 0) >= limit) return false;
  const last = scheduleDate(schedule.last_execution_date);
  if (last && ordinal(last) === today) return false;
  if ((schedule.skipDates || []).includes(scheduleDateKey(now))) return false;
  if (schedule.skipWeekends && ((now.getDay() === 6 && schedule.skipWeekendSaturday) || (now.getDay() === 0 && schedule.skipWeekendSunday))) return false;

  if (schedule.mode === 'daily') {
    const every = interval(schedule.daily?.everyNDays);
    return every !== null && (today - first) % every === 0;
  }
  if (schedule.mode === 'weekly') {
    const every = interval(schedule.weekly?.everyNWeeks);
    const startMonday = first - ((start.getDay() + 6) % 7);
    const todayMonday = today - ((now.getDay() + 6) % 7);
    const weeks = (todayMonday - startMonday) / 7;
    return every !== null && weeks % every === 0
      && (schedule.weekly?.days || []).some(day => String(day).toLowerCase() === WEEKDAYS[now.getDay()]);
  }
  if (schedule.mode === 'monthly') {
    const every = interval(schedule.monthly?.everyNMonths);
    const months = (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth();
    return every !== null && months % every === 0
      && (schedule.monthly?.monthDays || []).some(day => Number(day) === now.getDate());
  }
  return false;
}
