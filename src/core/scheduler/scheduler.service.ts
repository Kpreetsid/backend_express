import { usersService } from "../../modules/users/services/user.service";
import { IScheduleMaster, SchedulerModel } from "../../modules/maintenance/models/scheduleMaster.model";
import { orderService } from "../../modules/work-orders/services/order.service";
import crypto from "crypto";
import { isScheduleDue } from "./schedule-calendar";

class SchedulerService {
    private readonly instanceId = `${process.pid}-${crypto.randomUUID()}`;
    private readonly lockTtlMs = Number(process.env.SCHEDULER_LOCK_TTL_MS || 10 * 60 * 1000);

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

        return locked;
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

    private async executeSchedule(schedule: IScheduleMaster): Promise<void> {
        const s = schedule.schedule;
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
            createdFrom: schedule.work_order.createdFrom || "Preventive",
            tasks: schedule.work_order.tasks,
            parts: schedule.work_order.parts,
            userIdList: schedule.work_order.userIdList
        };
        switch (s.mode) {
            case "daily":
                body.start_date = new Date().toISOString().split("T")[0];
                body.end_date = new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().split("T")[0];
                break;
            case "weekly":
                body.start_date = new Date().toISOString().split("T")[0];
                body.end_date = new Date(new Date().setDate(new Date().getDate() + 7)).toISOString().split("T")[0];
                break;
            case "monthly":
                body.start_date = new Date().toISOString().split("T")[0];
                body.end_date = new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split("T")[0];
                break;
        }
        const systemUser: any = await usersService.getAllUsers({ _id: schedule.createdBy, account_id: schedule.account_id });
        if (!systemUser?.[0]) throw new Error("Schedule creator is unavailable in this account");
        console.log(`▶️ Creating Work Order for schedule: ${schedule.title}`);
        const workOrder = await orderService.createWorkOrder(body, systemUser[0]);
        if (!workOrder) {
            throw new Error("Scheduled work order creation failed; execution was not recorded");
        }
        console.log(`✅ Work Order created for schedule: ${schedule.title}`);
        s.no_of_execution = (s.no_of_execution ?? 0) + 1;
        s.last_execution_date = new Date();
        if ((s.no_of_repetition && s.no_of_execution >= s.no_of_repetition) || (s.end_date && new Date() >= new Date(s.end_date))) {
            s.enabled = false;
            s.end_date = new Date().toISOString().split("T")[0];
        }
        await schedule.save();
        console.log(`✅ Schedule updated for schedule: ${schedule.title}`);
    }

    public async runUnifiedScheduler(): Promise<void> {
        try {
            const schedules = await SchedulerModel.find({ visible: true, "schedule.enabled": true });
            for (const schedule of schedules) {
                try {
                    if (!isScheduleDue(schedule.schedule)) continue;
                    const claimed = await this.acquireScheduleLock(schedule._id);
                    if (!claimed) continue;
                    try {
                        // Another worker or an edit may have changed the plan after the initial scan.
                        if (isScheduleDue(claimed.schedule)) await this.executeSchedule(claimed);
                    } finally {
                        await this.releaseScheduleLock(schedule._id);
                    }
                } catch (error) {
                    console.error('Schedule execution failed', String(schedule._id), error);
                }
            }
        } catch (error) {
            console.error('Scheduler failed', error);
        }
    }

}

export const schedulerService = new SchedulerService();
