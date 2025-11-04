import { IScheduleMaster, SchedulerModel } from "../models/scheduleMaster.model";
import { createWorkOrder } from "../work/order/order.service";

class SchedulerService {
    private getTodayName(): string {
        return new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(new Date()).toLowerCase();
    }

    private shouldRun(schedule: IScheduleMaster): boolean {
        const today = new Date();
        const s = schedule.schedule;
        if (s.end_date && today > new Date(s.end_date)) return false;
        const exec = s.no_of_execution ?? 0;
        const rep = s.no_of_repetition ?? 0;
        if (rep > 0 && exec >= rep) return false;
        if (!s.enabled) return false;
        return true;
    }

    private async createWorkOrderFromSchedule(schedule: IScheduleMaster): Promise<void> {
        try {
            const s = schedule.schedule;
            s.no_of_execution ??= 0;
            s.no_of_repetition ??= 0;
            const body = {
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
                start_date: schedule.work_order.start_date,
                end_date: schedule.work_order.end_date,
                workInstruction: schedule.work_order.workInstruction,
                createdFrom: schedule.work_order.createdFrom,
                tasks: schedule.work_order.tasks,
                parts: schedule.work_order.parts,
                task_submitted: false,
                userIdList: schedule.work_order.userIdList,
            };
            const systemUser: any = { _id: schedule.createdBy, account_id: schedule.account_id };
            console.log(`▶️ Creating WO for: ${schedule.title}, execution #${s.no_of_execution + 1}`);
            const createdWO = await createWorkOrder(body, systemUser);
            s.no_of_execution += 1;
            s.last_execution_date = new Date();
            if ((s.no_of_repetition && s.no_of_execution >= s.no_of_repetition) || (s.end_date && new Date() >= new Date(s.end_date))) {
                s.enabled = false;
                s.status = "Completed";
                s.end_date = new Date();
            }
            await schedule.save();
            console.log(`✅ WO created: ${createdWO._id} (${s.mode}, exec ${s.no_of_execution}/${s.no_of_repetition || "∞"})`);
        } catch (error) {
            console.error("❌ Error creating work order:", error);
        }
    }

    // ---------------- UNIFIED DAILY JOB ----------------
    public async runUnifiedScheduler(): Promise<void> {
        try {
            const today = new Date();
            const todayDay = today.getDate();
            const todayStr = this.getTodayName();
            const schedules = await SchedulerModel.find({ visible: true, "schedule.enabled": true });
            console.log(`🗓️ Found ${schedules.length} active schedules`);
            for (const schedule of schedules) {
                const s = schedule.schedule;
                const mode = s.mode;
                const start = new Date(s.start_date);
                const end = s.end_date ? new Date(s.end_date) : null;
                if (today < start || (end && today > end)) continue;
                if (!this.shouldRun(schedule)) continue;
                const lastExec = s.last_execution_date ? new Date(s.last_execution_date) : null;
                if (lastExec && lastExec.toDateString() === today.toDateString()) continue;
                if (mode === "daily") {
                    console.log(`🗓️ Daily execution start to create Work Order: ${schedule.title}`);
                    await this.createWorkOrderFromSchedule(schedule);
                    continue;
                }
                if (mode === "weekly") {
                    if (s.weekly?.days?.[todayStr]) {
                        console.log(`🗓️ Weekly execution start to create Work Order: ${schedule.title}`);
                        await this.createWorkOrderFromSchedule(schedule);
                    }
                    continue;
                }
                if (mode === "monthly") {
                    const dayOfMonth = s.monthly?.everyNMonths ?? 1;
                    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
                    const validDay = Math.min(dayOfMonth, lastDayOfMonth);
                    if (todayDay === validDay) {
                        console.log(`🗓️ Monthly execution start to create Work Order: ${schedule.title}`);
                        await this.createWorkOrderFromSchedule(schedule);
                    }
                    continue;
                }
            }
            console.log("✅ Unified Scheduler executed successfully");
        } catch (error) {
            console.error("❌ Unified Scheduler error:", error);
        }
    }
}

export const schedulerService = new SchedulerService();