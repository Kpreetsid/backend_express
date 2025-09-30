const parser = require("cron-parser");
import { IJob } from "../models/Job.model";

/** Convert Date to another timezone */
function convertToTimeZone(date: Date, tz: string): Date {
    const fmt = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    });

    const parts = fmt.formatToParts(date).reduce((acc, p) => {
        if (p.type !== "literal") acc[p.type] = parseInt(p.value, 10);
        return acc;
    }, {} as Record<string, number>);

    return new Date(
        parts.year,
        (parts.month || 1) - 1,
        parts.day || 1,
        parts.hour || 0,
        parts.minute || 0,
        parts.second || 0,
        0
    );
}

/** Helpers for extracting day/hour/minute from a Date */
function getHour(date: Date, tz: string) {
    return parseInt(
        new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "2-digit", hour12: false }).format(date),
        10
    );
}
function getMinute(date: Date, tz: string) {
    return parseInt(
        new Intl.DateTimeFormat("en-US", { timeZone: tz, minute: "2-digit" }).format(date),
        10
    );
}
function getDayOfMonth(date: Date, tz: string) {
    return parseInt(
        new Intl.DateTimeFormat("en-US", { timeZone: tz, day: "2-digit" }).format(date),
        10
    );
}
function getWeekday0to6(date: Date, tz: string): number {
  // Convert to target timezone
  const dt = convertToTimeZone(date, tz);
  return dt.getDay(); // 0 = Sunday, 6 = Saturday
}

export function inRange(job: IJob, now: Date): boolean {
    if (job.startDate && now < job.startDate) return false;
    if (job.endDate && now > job.endDate) return false;
    return true;
}

export function matchesNow(job: IJob, now: Date): boolean {
    const zone = job.timezone || "Asia/Kolkata";
    const dt = convertToTimeZone(now, zone);

    if (job.paused || !job.isActive) return false;
    if (!inRange(job, now)) return false;

    switch (job.frequency) {
        case "hourly":
            return true;

        case "daily": {
            if (!job.time) return false;
            const [hh, mm] = job.time.split(":").map(Number);
            return getHour(dt, zone) === hh && getMinute(dt, zone) === mm;
        }

        case "weekly": {
            if (!job.time || !job.customDays?.length) return false;
            const [hh, mm] = job.time.split(":").map(Number);
            return (
                job.customDays.includes(getWeekday0to6(dt, zone)) &&
                getHour(dt, zone) === hh &&
                getMinute(dt, zone) === mm
            );
        }

        case "monthly": {
            if (!job.time || !job.customDays?.length) return false;
            const [hh, mm] = job.time.split(":").map(Number);
            return (
                job.customDays.includes(getDayOfMonth(dt, zone)) &&
                getHour(dt, zone) === hh &&
                getMinute(dt, zone) === mm
            );
        }

        case "custom-cron": {
            if (!job.cronExpression) return false;
            try {
                const interval = parser.parseExpression(job.cronExpression, {
                    tz: zone,
                    currentDate: dt,
                });
                const prev = interval.prev().toDate();
                return Math.abs(dt.getTime() - prev.getTime()) < 60_000;
            } catch {
                return false;
            }
        }

        default:
            return false;
    }
}

export function computeNextRuns(job: IJob, count = 10, from = new Date()): Date[] {
    const zone = job.timezone || "Asia/Kolkata";
    const results: Date[] = [];

    if (job.frequency === "custom-cron" && job.cronExpression) {
        try {
            const interval = parser.parseExpression(job.cronExpression, {
                tz: zone,
                currentDate: from,
            });
            for (let i = 0; i < count; i++) results.push(interval.next().toDate());
            return results;
        } catch {
            return results;
        }
    }

    let cursor = convertToTimeZone(from, zone);

    while (results.length < count) {
        switch (job.frequency) {
            case "hourly": {
                cursor = new Date(cursor.getTime() + 60 * 60 * 1000);
                cursor.setSeconds(0, 0);
                results.push(cursor);
                break;
            }

            case "daily": {
                if (!job.time) return results;
                const [hh, mm] = job.time.split(":").map(Number);
                let c = new Date(cursor);
                c.setHours(hh, mm, 0, 0);
                if (c <= cursor) c.setDate(c.getDate() + 1);
                results.push(c);
                cursor = c;
                break;
            }

            case "weekly": {
                if (!job.time || !job.customDays?.length) return results;
                const [hh, mm] = job.time.split(":").map(Number);
                const weekDays = [...job.customDays].sort((a, b) => a - b);
                let found: Date | null = null;
                for (let i = 0; i < 14 && !found; i++) {
                    const cand = new Date(cursor.getTime() + i * 24 * 60 * 60 * 1000);
                    const weekday = getWeekday0to6(cand, zone);
                    if (weekDays.includes(weekday)) {
                        cand.setHours(hh, mm, 0, 0);
                        if (cand > cursor) found = cand;
                    }
                }
                if (!found) return results;
                results.push(found);
                cursor = found;
                break;
            }

            case "monthly": {
                if (!job.time || !job.customDays?.length) return results;
                const [hh, mm] = job.time.split(":").map(Number);
                const days = [...job.customDays].sort((a, b) => a - b);
                let monthCursor = new Date(cursor);
                let placed = false;
                for (let m = 0; m < 24 && !placed; m++) {
                    for (const d of days) {
                        const c = new Date(monthCursor);
                        c.setDate(d);
                        c.setHours(hh, mm, 0, 0);
                        if (c > cursor) {
                            results.push(c);
                            cursor = c;
                            placed = true;
                            break;
                        }
                    }
                    if (!placed) {
                        monthCursor.setMonth(monthCursor.getMonth() + 1);
                        monthCursor.setDate(1);
                    }
                }
                break;
            }

            default:
                break;
        }

        if (results.length === 0 && count > 0) break;
    }

    return results;
}