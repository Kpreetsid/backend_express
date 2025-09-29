
const parser = require("cron-parser");
import { DateTime } from "luxon";
import { IJob } from "../models/Job.model";

export function inRange(job: IJob, now: Date): boolean {
    if (job.startDate && now < job.startDate) return false;
    if (job.endDate && now > job.endDate) return false;
    return true;
}

export function matchesNow(job: IJob, now: Date): boolean {
    const zone = job.timezone || "Asia/Kolkata";
    const dt = DateTime.fromJSDate(now).setZone(zone);

    if (job.paused || !job.isActive) return false;
    if (!inRange(job, now)) return false;

    switch (job.frequency) {
        case "hourly": {
            // any minute match is allowed by outer cron (every 6h/5am), so we run once per processJobs tick
            return true;
        }
        case "daily": {
            if (!job.time) return false;
            const [hh, mm] = job.time.split(":").map(Number);
            return dt.hour === hh && dt.minute === mm;
        }
        case "weekly": {
            if (!job.time || !job.customDays?.length) return false;
            const [hh, mm] = job.time.split(":").map(Number);
            return job.customDays.includes(dt.weekday % 7) && dt.hour === hh && dt.minute === mm; // Luxon: 1=Mon..7=Sun
        }
        case "monthly": {
            if (!job.time || !job.customDays?.length) return false;
            const [hh, mm] = job.time.split(":").map(Number);
            return job.customDays.includes(dt.day) && dt.hour === hh && dt.minute === mm;
        }
        case "custom-cron": {
            if (!job.cronExpression) return false;
            try {
                const interval = parser.parseExpression(job.cronExpression, { tz: zone, currentDate: dt.toJSDate() });
                const prev = interval.prev().toDate();
                // if prev is within the last minute, we consider it a match for this tick
                return Math.abs(dt.toMillis() - prev.getTime()) < 60_000;
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
    const dt = DateTime.fromJSDate(from).setZone(zone);
    const results: Date[] = [];

    if (job.frequency === "custom-cron" && job.cronExpression) {
        try {
            const interval = parser.parseExpression(job.cronExpression, { tz: zone, currentDate: dt.toJSDate() });
            for (let i = 0; i < count; i++) results.push(interval.next().toDate());
            return results;
        } catch {
            return results;
        }
    }

    let cursor = dt;
    while (results.length < count) {
        switch (job.frequency) {
            case "hourly":
                cursor = cursor.plus({ hours: 1 }).set({ second: 0, millisecond: 0 });
                results.push(cursor.toJSDate());
                break;
            case "daily": {
                if (!job.time) return results;
                const [hh, mm] = job.time.split(":").map(Number);
                cursor = cursor.startOf("day").set({ hour: hh, minute: mm, second: 0, millisecond: 0 });
                if (cursor <= DateTime.fromJSDate(results.at(-1) || from).setZone(zone)) cursor = cursor.plus({ days: 1 });
                results.push(cursor.toJSDate());
                break;
            }
            case "weekly": {
                if (!job.time || !job.customDays?.length) return results;
                const [hh, mm] = job.time.split(":").map(Number);
                const weekDays = job.customDays.slice().sort((a, b) => a - b); // 0-6 Sun..Sat
                let found: DateTime | null = null;
                for (let i = 0; i < 14 && !found; i++) {
                    const cand = cursor.plus({ days: i });
                    const luxonWeekday0to6 = cand.weekday % 7; // 1..7 -> 0..6
                    if (weekDays.includes(luxonWeekday0to6)) {
                        const c = cand.set({ hour: hh, minute: mm, second: 0, millisecond: 0 });
                        if (c > cursor) found = c;
                    }
                }
                if (!found) return results;
                results.push(found.toJSDate());
                cursor = found;
                break;
            }
            case "monthly": {
                if (!job.time || !job.customDays?.length) return results;
                const [hh, mm] = job.time.split(":").map(Number);
                const days = job.customDays.slice().sort((a, b) => a - b);
                let monthCursor = cursor;
                let placed = false;
                for (let m = 0; m < 24 && !placed; m++) {
                    for (const d of days) {
                        const c = monthCursor.set({ day: d, hour: hh, minute: mm, second: 0, millisecond: 0 });
                        if (c > cursor && c.isValid) {
                            results.push(c.toJSDate());
                            cursor = c;
                            placed = true;
                            break;
                        }
                    }
                    if (!placed) monthCursor = monthCursor.plus({ months: 1 }).startOf("month");
                }
                break;
            }
            default:
                // If frequency is not recognized, break to avoid infinite loop
                break;
        }

        // Safety check to avoid infinite loops
        if (results.length === 0 && count > 0) {
            break;
        }
    }
    return results;
}