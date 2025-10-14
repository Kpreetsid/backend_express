import { IScheduleMaster, SchedulerModel } from "../models/scheduleMaster.model";
import { createWorkOrder } from "../work/order/order.service";

class SchedulerService {
    private hasStarted(startDate: Date): boolean {
        return new Date() >= new Date(startDate);
    }

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

    private getNextExecutionDate(schedule: IScheduleMaster): Date | null {
        const s = schedule.schedule;
        const lastExec = s.last_execution_date ? new Date(s.last_execution_date) : new Date(s.start_date);
        if (s.mode === "daily") {
            const next = new Date(lastExec);
            const interval = s.daily?.interval ?? 0;
            next.setDate(next.getDate() + interval);
            return next;
        }

        if (s.mode === "weekly") {
            const next = new Date(lastExec);
            const interval = s.weekly?.interval ?? 0;
            next.setDate(next.getDate() + 7 * interval);
            return next;
        }

        if (s.mode === "monthly") {
            const next = new Date(lastExec);
            const interval = s.monthly?.interval ?? 0;
            next.setMonth(next.getMonth() + interval);
            return next;
        }
        return null;
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
                end_date: schedule.work_order.start_date,
                workInstruction: schedule.work_order.workInstruction,
                createdFrom: schedule.work_order.createdFrom,
                tasks: schedule.work_order.tasks,
                parts: schedule.work_order.parts,
                task_submitted: false,
                userIdList: schedule.work_order.userIdList,
            };
            const systemUser: any = {
                _id: schedule.createdBy,
                account_id: schedule.account_id,
            };
            console.log(`▶️ Creating WO for schedule: ${schedule.id}, execution #${s.no_of_execution + 1}`);
            const createdWO = await createWorkOrder(body, systemUser);
            s.no_of_execution += 1;
            s.last_execution_date = new Date();
            if ((s.no_of_repetition && s.no_of_execution >= s.no_of_repetition) ||
                (s.end_date && new Date().getTime() >= new Date(s.end_date).getTime())) {
                s.enabled = false;
                s.status = "Completed";
                s.end_date = new Date();
            }
            await schedule.save();
            console.log(`✅ WO created: ${createdWO._id} (execution ${s.no_of_execution}/${s.no_of_repetition || "∞"})`);
        } catch (error) {
            console.error("❌ Error creating work order:", error);
        }
    }

    // ---------------- DAILY ----------------
    public async runDailyScheduler(): Promise<void> {
        const today = new Date();
        const schedules = await SchedulerModel.find({ visible: true, "schedule.enabled": true, "schedule.mode": "daily" });
        console.log(`Found ${schedules.length} daily schedules`);
        for (const schedule of schedules) {
            const s = schedule.schedule;
            if (!this.hasStarted(s.start_date)) continue;
            if (!this.shouldRun(schedule)) continue;
            const nextExecution = this.getNextExecutionDate(schedule);
            if (!nextExecution || today < nextExecution) continue;
            await this.createWorkOrderFromSchedule(schedule);
        }
        console.log("✅ Daily Scheduler executed");
    }

    // ---------------- WEEKLY ----------------
    public async runWeeklyScheduler(): Promise<void> {
        const today = new Date();
        const todayStr = this.getTodayName();
        const schedules = await SchedulerModel.find({ visible: true, "schedule.enabled": true, "schedule.mode": "weekly", [`schedule.weekly.days.${todayStr}`]: true });
        console.log(`Found ${schedules.length} weekly schedules`);
        for (const schedule of schedules) {
            const s = schedule.schedule;
            if (!this.hasStarted(s.start_date)) continue;
            if (!this.shouldRun(schedule)) continue;
            const nextExecution = this.getNextExecutionDate(schedule);
            if (!nextExecution || today < nextExecution) continue;
            await this.createWorkOrderFromSchedule(schedule);
        }
        console.log("✅ Weekly Scheduler executed");
    }

    // ---------------- MONTHLY ----------------
    public async runMonthlyScheduler(): Promise<void> {
        const today = new Date();
        const schedules = await SchedulerModel.find({ visible: true, "schedule.enabled": true, "schedule.mode": "monthly" });
        console.log(`Found ${schedules.length} monthly schedules`);
        for (const schedule of schedules) {
            const s = schedule.schedule;
            if (!this.hasStarted(s.start_date)) continue;
            if (!this.shouldRun(schedule)) continue;
            const nextExecution = this.getNextExecutionDate(schedule);
            const scheduledDay = s.monthly?.dayOfMonth ?? 1;
            if (!nextExecution || today < nextExecution) continue;
            if (today.getDate() !== scheduledDay) continue;
            await this.createWorkOrderFromSchedule(schedule);
        }
        console.log("✅ Monthly Scheduler executed");
    }
}

export const schedulerService = new SchedulerService();
