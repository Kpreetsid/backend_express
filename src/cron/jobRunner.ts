import mongoose from "mongoose";
import { SchedulerModel } from "../models/scheduleMaster.model";
import { WorkOrderAssigneeModel } from "../models/mapUserWorkOrder.model";
import { WorkOrderModel } from "../models/workOrder.model";
import { WorkOrderTemplateEngine } from "./templates/WorkOrderTemplateEngine";

export const processJobsTick = async () => {
    try {
        const now = new Date();
        const schedules = await SchedulerModel.find({
            visible: true,
            'schedule.enabled': true,
            $or: [
                { next_execute_date: { $lte: now } },
                { next_execute_date: { $exists: false } }
            ]
        }).lean();
        console.log(`[JOB_RUN] Found ${schedules.length} active schedules eligible for execution`);
        let executedCount = 0;
        let errorCount = 0;
        for (const schedule of schedules) {
            try {
                console.log(`[JOB_RUN] Executing schedule: ${schedule.title}`);
                await executeSchedule(schedule, now);
                executedCount++;
            } catch (err) {
                console.error(`[JOB_RUN ERROR] Failed processing schedule ${schedule.title}:`, err);
                errorCount++;
            }
        }
        console.log(`[JOB_RUN] Job tick completed. Executed: ${executedCount}, Errors: ${errorCount}`);
    } catch (err) {
        console.error("[JOB_RUN ERROR] Failed during job tick:", err);
    }
}
const executeSchedule = async (schedule: any, executionDate: Date) => {
    try {
        console.log(`\n🚀 ===== EXECUTING SCHEDULE: ${schedule.title} =====`);
        const workOrderData = await WorkOrderTemplateEngine.generateWorkOrderData(schedule, executionDate);
        const workOrder = await WorkOrderModel.create(workOrderData);
        console.log(`✅ Created work order: ${workOrder.order_no}`);
        const userIdList = schedule.work_order?.userIdList || [];
        for (const userId of userIdList) {
            await WorkOrderAssigneeModel.create({
                woId: workOrder._id,
                userId: new mongoose.Types.ObjectId(userId)
            });
        }
        console.log(`✅ Assigned to ${userIdList.length} users`);
        const nextExecution = calculateNextExecution(schedule, executionDate);
        await SchedulerModel.findByIdAndUpdate(schedule._id, {
            last_execution_date: executionDate.toISOString(),
            next_execute_date: nextExecution?.toISOString() || null
        });
        console.log(`🎉 ===== COMPLETED =====\n`);
    } catch (error) {
        console.error(`❌ EXECUTION FAILED:`, error);
        throw error;
    }
}

function calculateNextExecution(schedule: any, currentDate: Date): Date | null {
    const mode = schedule.schedule?.mode?.toLowerCase() || 'daily';
    const nextDate = new Date(currentDate);
    if (mode === 'daily') {
        nextDate.setDate(nextDate.getDate() + 1);
    } else if (mode === 'weekly') {
        const interval = schedule.repeat?.weekly?.interval || 1;
        const selectedDays = schedule.repeat?.weekly?.days || {};
        // Get enabled days (0=Sunday, 1=Monday, ..., 6=Saturday)
        const enabledDays: number[] = [];
        if (selectedDays.sunday) enabledDays.push(0);
        if (selectedDays.monday) enabledDays.push(1);
        if (selectedDays.tuesday) enabledDays.push(2);
        if (selectedDays.wednesday) enabledDays.push(3);
        if (selectedDays.thursday) enabledDays.push(4);
        if (selectedDays.friday) enabledDays.push(5);
        if (selectedDays.saturday) enabledDays.push(6);
        if (enabledDays.length > 0) {
            let daysToAdd = 1;
            for (let i = 1; i <= 7 * interval; i++) {
                const testDate = new Date(currentDate);
                testDate.setDate(currentDate.getDate() + i);
                const dayOfWeek = testDate.getDay();
                if (enabledDays.includes(dayOfWeek)) {
                    daysToAdd = i;
                    break;
                }
            }
            nextDate.setDate(currentDate.getDate() + daysToAdd);
        } else {
            nextDate.setDate(nextDate.getDate() + (7 * interval));
        }
    } else if (mode === 'monthly') {
        const interval = schedule.repeat?.monthly?.interval || 1;
        const dayOfMonth = schedule.repeat?.monthly?.dayOfMonth;

        if (dayOfMonth) {

            nextDate.setMonth(nextDate.getMonth() + interval);
            nextDate.setDate(dayOfMonth);
        } else {

            nextDate.setMonth(nextDate.getMonth() + interval);
        }
    }

    // Check end date
    if (schedule.schedule?.end_date && nextDate > new Date(schedule.schedule.end_date)) {
        return null;
    }

    return nextDate;
}


export async function getScheduleStats() {
    try {
        const stats = await SchedulerModel.aggregate([
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    active: { $sum: { $cond: [{ $and: ["$visible", "$rescheduleEnabled"] }, 1, 0] } },
                    byMode: {
                        $push: {
                            mode: "$schedule_mode",
                            active: { $and: ["$visible", "$rescheduleEnabled"] }
                        }
                    }
                }
            }
        ]);

        return stats[0] || { total: 0, active: 0, byMode: [] };
    } catch (error) {
        console.error("[STATS ERROR] Failed to get schedule stats:", error);
        return { total: 0, active: 0, byMode: [] };
    }
}

export const updateNextRun = async (job: any) => {
    return Promise.resolve();
}

export const startScheduler = () => {
    console.log("[SCHEDULER] Legacy startScheduler called - using cron jobs instead");
}
