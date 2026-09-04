import { usersService } from "../../modules/users/services/user.service";
import { IScheduleMaster, SchedulerModel } from "../../modules/maintenance/models/scheduleMaster.model";
import { orderService } from "../../modules/work-orders/services/order.service";
import crypto from "crypto";
import { WorkOrderModel } from '../../modules/work-orders/models/workOrder.model';
import {
    addCalendarDays,
    addCalendarMonths,
    calendarDateInTimeZone,
    dateKeyUtc,
    isScheduleDueOnDate,
    resolveSchedulerTimeZone
} from './schedule-cadence';

class SchedulerService {
    private readonly instanceId = `${process.pid}-${crypto.randomUUID()}`;
    private readonly lockTtlMs = Math.max(30_000, Number(process.env.SCHEDULER_LOCK_TTL_MS) || 10 * 60 * 1000);
    private readonly timeZone = resolveSchedulerTimeZone();

    private async acquireScheduleLock(scheduleId: any): Promise<IScheduleMaster | null> {
        const lockExpiresBefore = new Date(Date.now() - this.lockTtlMs);
        const locked = await (SchedulerModel as any).findOneAndUpdate(
            {
                _id: scheduleId,
                visible: true,
                "schedule.enabled": true,
                $or: [
                    { cron_lock_acquired_at: { $exists: false } },
                    { cron_lock_acquired_at: null },
                    { cron_lock_acquired_at: { $lt: lockExpiresBefore } }
                ]
            },
            {
                $set: {
                    cron_lock_acquired_at: new Date(),
                    cron_lock_instance_id: this.instanceId
                }
            },
            { new: true }
        );

        return locked as IScheduleMaster | null;
    }

    private async releaseScheduleLock(scheduleId: any): Promise<void> {
        await (SchedulerModel as any).updateOne(
            { _id: scheduleId, cron_lock_instance_id: this.instanceId },
            {
                $unset: {
                    cron_lock_acquired_at: "",
                    cron_lock_instance_id: ""
                }
            }
        );
    }

    private startLockHeartbeat(scheduleId: any): NodeJS.Timeout {
        const intervalMs = Math.max(10_000, Math.floor(this.lockTtlMs / 3));
        const heartbeat = setInterval(() => {
            void (SchedulerModel as any).updateOne(
                { _id: scheduleId, cron_lock_instance_id: this.instanceId },
                { $set: { cron_lock_acquired_at: new Date() } }
            ).catch((error: any) => {
                console.error(`Failed to refresh scheduler lock for ${scheduleId}:`, error);
            });
        }, intervalMs);
        heartbeat.unref?.();
        return heartbeat;
    }

    private async resolveExecutionUser(schedule: IScheduleMaster): Promise<any> {
        const accountMatch = { account_id: schedule.account_id, user_status: 'active' };
        const originalCreator = await usersService.getAllUsers({ _id: schedule.createdBy, ...accountMatch });
        if (originalCreator[0]) return originalCreator[0];

        const activeAdministrators = await usersService.getAllUsers({ ...accountMatch, user_role: 'admin' });
        if (activeAdministrators[0]) {
            console.warn(`Schedule ${schedule._id} creator is inactive or missing; using an active account administrator.`);
            return activeAdministrators[0];
        }
        throw Object.assign(new Error('No active account administrator is available to execute this schedule'), { status: 409 });
    }

    private async resolveActiveAssigneeIds(schedule: IScheduleMaster): Promise<string[]> {
        const requestedIds = Array.from(new Set((schedule.work_order.userIdList || []).map(String).filter(Boolean)));
        if (requestedIds.length === 0) return [];
        const activeUsers = await usersService.getAllUsers({
            _id: { $in: requestedIds },
            account_id: schedule.account_id,
            user_status: 'active'
        });
        return activeUsers.map((user: any) => String(user._id));
    }

    private async executeSchedule(schedule: IScheduleMaster, executionDate: Date): Promise<void> {
        const s = schedule.schedule;
        const executionDateKey = dateKeyUtc(executionDate);
        const executionKey = `${schedule._id}:${executionDateKey}`;
        const body: any = {
            title: schedule.work_order.title,
            description: schedule.work_order.description,
            estimated_time: schedule.work_order.estimated_time,
            priority: schedule.work_order.priority,
            status: schedule.work_order.status,
            type: schedule.work_order.type,
            sop_form_id: schedule.work_order.sop_form_id,
            created_by: schedule.createdBy,
            wo_asset_id: schedule.work_order.wo_asset_id,
            wo_location_id: schedule.work_order.wo_location_id,
            createdFrom: schedule.work_order.createdFrom,
            tasks: schedule.work_order.tasks,
            parts: schedule.work_order.parts,
            userIdList: await this.resolveActiveAssigneeIds(schedule)
        };
        switch (s.mode) {
            case "daily":
                body.start_date = executionDateKey;
                body.end_date = dateKeyUtc(addCalendarDays(executionDate, 1));
                break;
            case "weekly":
                body.start_date = executionDateKey;
                body.end_date = dateKeyUtc(addCalendarDays(executionDate, 7));
                break;
            case "monthly":
                body.start_date = executionDateKey;
                body.end_date = dateKeyUtc(addCalendarMonths(executionDate, 1));
                break;
        }
        const systemUser = await this.resolveExecutionUser(schedule);
        console.log(`▶️ Creating Work Order for schedule: ${schedule.title}`);
        let workOrder: any = await WorkOrderModel.findOne({
            account_id: schedule.account_id,
            schedule_execution_key: executionKey
        });
        if (!workOrder) {
            try {
                workOrder = await orderService.createWorkOrder(body, systemUser, {
                    scheduleId: schedule._id,
                    executionKey
                });
            } catch (error: any) {
                if (error?.code !== 11000) throw error;
                workOrder = await WorkOrderModel.findOne({
                    account_id: schedule.account_id,
                    schedule_execution_key: executionKey
                });
                if (!workOrder) throw error;
            }
        }
        if (!workOrder) {
            throw Object.assign(new Error(`Failed to create work order for schedule: ${schedule.title}`), { status: 500 });
        }
        console.log(`✅ Work Order created for schedule: ${schedule.title}`);
        s.no_of_execution = (s.no_of_execution ?? 0) + 1;
        s.last_execution_date = executionDate;
        if ((s.no_of_repetition && s.no_of_execution >= s.no_of_repetition) || (s.end_date && executionDateKey >= s.end_date)) {
            s.enabled = false;
            s.end_date = executionDateKey;
        }
        await schedule.save();
        console.log(`✅ Schedule updated for schedule: ${schedule.title}`);
    }

    public async runUnifiedScheduler(): Promise<void> {
        try {
            const today = calendarDateInTimeZone(new Date(), this.timeZone);
            const schedules = await SchedulerModel.find({ visible: true, "schedule.enabled": true });
            console.log(`🗓️ Scheduler started | ${schedules.length} active schedules`);
            for (const schedule of schedules) {
                try {
                    if (!isScheduleDueOnDate(schedule, today)) continue;
                    const lockedSchedule = await this.acquireScheduleLock(schedule._id);
                    if (!lockedSchedule) continue;
                    const heartbeat = this.startLockHeartbeat(schedule._id);
                    
                    try {
                        // Re-check the fresh document returned by the atomic lock. Another
                        // process may have completed this schedule after our initial read.
                        if (isScheduleDueOnDate(lockedSchedule, today)) {
                            await this.executeSchedule(lockedSchedule, today);
                        }
                    } finally {
                        clearInterval(heartbeat);
                        await this.releaseScheduleLock(schedule._id);
                    }
                } catch (indivError) {
                    console.error(`❌ Schedule execution failed for "${schedule.title}":`, indivError);
                }
            }
            console.log("✅ Scheduler completed successfully");
        } catch (error) {
            console.error("❌ Scheduler failed:", error);
        }
    }
}

export const schedulerService = new SchedulerService();
