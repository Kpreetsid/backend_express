


// src/services/workOrderService.ts
import { WorkOrderModel } from "../models/workOrder.model";
import mongoose from "mongoose";
import { CRON_CONSTANTS, getObjectId } from "./../_config/cronConstants";

export async function generateOrderNumber(): Promise<string> {
    try {
        // Get the latest work order to determine next number
        const latestWorkOrder = await WorkOrderModel
            .findOne()
            .sort({ createdAt: -1 })
            .select('order_no');

        let nextNumber = 1;

        if (latestWorkOrder && latestWorkOrder.order_no) {
            const match = latestWorkOrder.order_no.match(/WO-(\d+)$/);
            if (match) {
                nextNumber = parseInt(match[1]) + 1;
            }
        }

        // Pad with zeros to make it 8 digits
        const paddedNumber = nextNumber.toString().padStart(8, '0');
        return `WO-${paddedNumber}`;

    } catch (error) {
        console.error("Error generating order number:", error);
        // Fallback to timestamp-based number
        const timestamp = Date.now().toString().slice(-8);
        return `WO-${timestamp}`;
    }
}

export async function createWorkOrderFromSchedule(schedule: any): Promise<any> {
    try {
        console.log(`[WORK_ORDER_CREATION] Creating work order from schedule: ${schedule.title}`);

        // Generate unique order number
        const orderNo = await generateOrderNumber();

        // Calculate start and end dates
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(startDate.getDate() + (schedule.days_to_complete || 3));

        const workOrderData = {
            account_id: schedule.account_id,
            order_no: orderNo,
            title: schedule.work_order?.title || schedule.title,
            description: schedule.work_order?.description || schedule.description,
            estimated_time: schedule.work_order?.estimated_time || CRON_CONSTANTS.DEFAULT_ESTIMATED_TIME,
            priority: mapPriority(schedule.work_order?.priority || CRON_CONSTANTS.DEFAULT_PRIORITY),
            status: mapStatus(schedule.work_order?.status || CRON_CONSTANTS.DEFAULT_STATUS),
            type: schedule.work_order?.type || CRON_CONSTANTS.DEFAULT_TYPE,
            wo_asset_id: schedule.default_asset_id || getObjectId(CRON_CONSTANTS.DEFAULT_ASSET_ID),
            wo_location_id: schedule.default_location_id || getObjectId(CRON_CONSTANTS.DEFAULT_LOCATION_ID),
            start_date: startDate,
            end_date: endDate,
            sop_form_id: schedule.work_order?.sop_form_id || null,
            work_instruction: schedule.work_order?.work_instruction || null,
            tasks: schedule.work_order?.tasks || [],
            parts: schedule.work_order?.parts || [],
            work_request_id: null,
            files: [],
            visible: true,
            createdBy: schedule.default_created_by || getObjectId(CRON_CONSTANTS.DEFAULT_CREATED_BY)
        };

        // Create the work order
        const workOrder = await WorkOrderModel.create(workOrderData);

        console.log(`[WORK_ORDER_CREATED] Order: ${workOrder.order_no}`);
        console.log(`[WORK_ORDER_CREATED] Title: ${workOrder.title}`);
        console.log(`[WORK_ORDER_CREATED] Priority: ${workOrder.priority}, Status: ${workOrder.status}`);
        console.log(`[WORK_ORDER_CREATED] Start: ${workOrder.start_date.toISOString()}`);
        console.log(`[WORK_ORDER_CREATED] End: ${workOrder.end_date.toISOString()}`);
        console.log(`[WORK_ORDER_CREATED] ID: ${workOrder._id}`);

        // 🔥 FIXED: Return the complete work order object instead of just order_no
        return {
            _id: workOrder._id,
            order_no: workOrder.order_no,
            title: workOrder.title,
            account_id: workOrder.account_id,
            status: workOrder.status,
            priority: workOrder.priority
        };

    } catch (error) {
        console.error(`❌ Error creating work order from schedule ${schedule.title}:`, error);
        console.error('Full error:', error);
        return null;
    }
}

function mapPriority(priority: string): string {
    switch (priority?.toLowerCase()) {
        case 'low': return 'Low';
        case 'medium': return 'Medium';
        case 'high': return 'High';
        case 'none': return 'None';
        default: return 'Medium';
    }
}

function mapStatus(status: string): string {
    switch (status?.toLowerCase()) {
        case 'open': return 'Open';
        case 'pending': return 'Pending';
        case 'on-hold': return 'On-Hold';
        case 'in-progress': return 'In-Progress';
        case 'approved': return 'Approved';
        case 'rejected': return 'Rejected';
        case 'completed': return 'Completed';
        default: return 'Open';
    }
}