import { IScheduleMaster, SchedulerModel } from "../models/scheduleMaster.model";
import { createWorkOrder } from "../work/order/order.service";

class SchedulerService {
    private isStartDateValid(startDate: Date): boolean {
        return new Date() >= new Date(startDate);
    }

    private getToday(): string {
        return new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(new Date()).toLowerCase();
    }

    private isTodayLastTrueDay(schedule: IScheduleMaster): boolean {
        const daysOfWeek = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
        const today = this.getToday();
        const activeDays = daysOfWeek.filter((day) => (schedule.schedule.weekly as any)?.days?.[day] === true);
        const lastTrueDay = activeDays[activeDays.length - 1];
        return today === lastTrueDay;
    }

    private shouldRun(schedule: IScheduleMaster): boolean {
        const today = new Date();
        if (schedule.schedule?.end_date) {
            if (today > new Date(schedule.schedule.end_date)) return false;
        }
        if (typeof schedule.schedule.no_of_repetition === "number" && schedule.schedule.no_of_repetition > 0 && schedule.schedule.no_of_execution >= schedule.schedule.no_of_repetition) {
            return false;
        }
        return true;
    }

    private async createWorkOrderFromSchedule(schedule: IScheduleMaster): Promise<void> {
        try {
            const body = {
                title : schedule.work_order.title,
                description : schedule.work_order.description,
                estimated_time : schedule.work_order.estimated_time,
                priority : schedule.work_order.priority,
                status : schedule.work_order.status,
                type : schedule.work_order.type,
                sop_form_id : schedule.work_order.sop_form_id,
                created_by : schedule.createdBy,
                wo_asset_id : schedule.work_order.wo_asset_id,
                wo_location_id : schedule.work_order.wo_location_id,
                start_date : schedule.work_order.start_date,
                end_date : schedule.work_order.start_date,
                workInstruction : schedule.work_order.workInstruction,
                createdFrom : schedule.work_order.createdFrom,
                tasks : schedule.work_order.tasks,
                parts : schedule.work_order.parts,
                task_submitted: false,
                userIdList : schedule.work_order.userIdList
            };

            const systemUser: any = {
                _id: schedule.createdBy,
                account_id: schedule.account_id
            };

            console.log(`▶️ Creating WO for schedule: ${schedule.id}, execution #${schedule.schedule.no_of_execution + 1}`);
            const createdWO = await createWorkOrder(body, systemUser);
            schedule.schedule.no_of_execution = (schedule.schedule.no_of_execution || 0) + 1;
            schedule.schedule.last_execution_date = new Date();
            await schedule.save();
            console.log(`✅ WO created: ${createdWO._id} (execution ${schedule.schedule.no_of_execution}/${schedule.schedule.no_of_repetition || "∞"})`);
        } catch (error) {
            console.error("❌ Error creating work order:", error);
        }
    }

    // ---------------- Daily ----------------
    public async runDailyScheduler(): Promise<void> {
        const schedules = await SchedulerModel.find({ visible: true, "schedule.enabled": true, "schedule.mode": "daily" });
        console.log(`Found ${schedules.length} daily schedules`);
        for (const schedule of schedules) {
            if (!this.isStartDateValid(schedule.schedule.start_date)) continue;
            if (!this.shouldRun(schedule)) continue;
            await this.createWorkOrderFromSchedule(schedule);
        }
        console.log("✅ Daily Scheduler executed");
    }

    // ---------------- Weekly ----------------
    public async runWeeklyScheduler(): Promise<void> {
        const today = this.getToday();
        const schedules = await SchedulerModel.find({ visible: true, "schedule.enabled": true, "schedule.mode": "weekly", [`schedule.weekly.days.${today}`]: true });
        for (const schedule of schedules) {
            if (!this.isStartDateValid(schedule.schedule.start_date)) continue;
            if (!this.shouldRun(schedule)) continue;
            const interval = schedule.schedule.weekly?.interval || 1;
            const calls = (schedule as any).no_of_time_call || 0;
            if (calls % interval === 0) {
                await this.createWorkOrderFromSchedule(schedule);
            }
            if (this.isTodayLastTrueDay(schedule)) {
                (schedule as any).no_of_time_call = calls + 1;
                await schedule.save();
            }
        }
        console.log("✅ Weekly Scheduler executed");
    }

    // ---------------- Monthly ----------------
    public async runMonthlyScheduler(): Promise<void> {
        const today = new Date().getDate();
        const schedules = await SchedulerModel.find({ visible: true, "schedule.enabled": true, "schedule.mode": "monthly" });
        for (const schedule of schedules) {
            if (!this.isStartDateValid(schedule.schedule.start_date)) continue;
            if (!this.shouldRun(schedule)) continue;
            const scheduledDay = schedule.schedule.monthly?.dayOfMonth || 1;
            if (today === scheduledDay) {
                await this.createWorkOrderFromSchedule(schedule);
            }
        }
        console.log("✅ Monthly Scheduler executed");
    }
}

export const schedulerService = new SchedulerService();
