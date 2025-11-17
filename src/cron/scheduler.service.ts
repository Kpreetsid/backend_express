import { getAllUsers } from "../masters/user/user.service";
import { IScheduleMaster, SchedulerModel } from "../models/scheduleMaster.model";
import { createWorkOrder } from "../work/order/order.service";

class SchedulerService {
    private getTodayDateStr(): string {
        return new Date().toISOString().split("T")[0];
    }

    private getTodayName(): string {
        return new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(new Date()).toLowerCase();
    }

    private isSameDate(d1: Date | string, d2: Date | string): boolean {
        return new Date(d1).toDateString() === new Date(d2).toDateString();
    }

    private shouldRun(schedule: IScheduleMaster): boolean {
        const s = schedule.schedule;
        const today = new Date();
        const startDate = new Date(s.start_date);
        const endDate = s.end_date ? new Date(s.end_date) : null;
        if (today < startDate) return false;
        if (endDate && today > endDate) return false;
        if (!s.enabled) return false;
        if (s.no_of_repetition && s.no_of_execution >= s.no_of_repetition) {
            return false;
        }
        return true;
    }

    private shouldSkipToday(schedule: IScheduleMaster): boolean {
        const s = schedule.schedule;
        const today = new Date();
        const todayStr = this.getTodayDateStr();
        const dayIndex = today.getDay();
        if (s.skipDates.includes(todayStr)) return true;
        if (s.skipWeekends) {
            if (dayIndex === 6 && s.skipWeekendSaturday) return true; // Saturday
            if (dayIndex === 0 && s.skipWeekendSunday) return true;   // Sunday
        }
        return false;
    }

    private alreadyExecutedToday(schedule: IScheduleMaster): boolean {
        const last = schedule.schedule.last_execution_date;
        if (!last) return false;
        return this.isSameDate(last, new Date());
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
            createdFrom: schedule.work_order.createdFrom,
            tasks: schedule.work_order.tasks,
            parts: schedule.work_order.parts,
            task_submitted: false,
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
        const systemUser: any = await getAllUsers({ _id: schedule.createdBy });
        console.log(`▶️ Creating Work Order for schedule: ${schedule.title}`);
        const workOrder = await createWorkOrder(body, systemUser[0]);
        if (!workOrder) {
            console.error(`❌ Failed to create work order for schedule: ${schedule.title}`);
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
            const today = new Date();
            const todayName = this.getTodayName();
            const todayDate = today.getDate();
            const schedules = await SchedulerModel.find({ visible: true, "schedule.enabled": true });
            console.log(`🗓️ Scheduler started | ${schedules.length} active schedules`);
            for (const schedule of schedules) {
                const s = schedule.schedule;
                if (!this.shouldRun(schedule)) continue;
                if (this.shouldSkipToday(schedule)) continue;
                if (this.alreadyExecutedToday(schedule)) continue;
                if (s.mode === "daily") {
                    await this.executeSchedule(schedule);
                    continue;
                }
                if (s.mode === "weekly") {
                    if (s.weekly.days.includes(todayName)) {
                        await this.executeSchedule(schedule);
                    }
                    continue;
                }
                if (s.mode === "monthly") {
                    if (s.monthly.monthDays.includes(todayDate)) {
                        await this.executeSchedule(schedule);
                    }
                    continue;
                }
            }
            console.log("✅ Scheduler completed successfully");
        } catch (error) {
            console.error("❌ Scheduler failed:", error);
        }
    }
}

export const schedulerService = new SchedulerService();