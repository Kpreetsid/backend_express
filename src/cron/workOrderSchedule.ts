

// src/cron/workOrderSchedule.ts
import mongoose from "mongoose";
import { WorkOrderModel } from "../models/workOrder.model";
import { WorkOrderTemplateEngine } from "./templates/WorkOrderTemplateEngine";


export async function createWorkOrderFromSchedule(schedule: any, executionDate?: Date): Promise<string | null> {
    try {
        console.log(`[WORK_ORDER] Creating work order from schedule: ${schedule.title}`);

        if (mongoose.connection.readyState !== 1) {
            throw new Error("MongoDB not connected!");
        }

        const workOrderData = await WorkOrderTemplateEngine.generateWorkOrderData(
            schedule,
            executionDate || new Date()
        );

        const workOrder = await WorkOrderModel.create(workOrderData);
        console.log(`[WORK_ORDER] Created work order: ${workOrder.order_no}`);

        return workOrder.order_no;
    } catch (error: any) {
        console.error(`[WORK_ORDER ERROR] Failed to create work order:`, error);
        return null;
    }
}


function mapPriority(priority: string): string {
    switch (priority?.toLowerCase()) {
        case "low": return "Low";
        case "medium": return "Medium";
        case "high": return "High";
        case "none": return "None";
        default: return "Medium";
    }
}

function mapStatus(status: string): string {
    switch (status?.toLowerCase()) {
        case "open": return "Open";
        case "on-hold": return "On-Hold";
        case "in-progress": return "In-Progress";
        case "completed": return "Completed";
        default: return "Open";
    }
}

export { mapPriority, mapStatus };