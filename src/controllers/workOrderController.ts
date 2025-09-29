// src/controllers/workOrderController.ts
import { Request, Response } from "express";
import { WorkOrderAssigneeModel } from "../models/mapUserWorkOrder.model";

export const listAssignedWorkOrders = async (req: Request, res: Response): Promise<void> => {
    try {
        const assignments = await WorkOrderAssigneeModel.find()
            .populate("woId")   // get work order details
            .populate("userId") // get user details
            .lean();

        console.log(`[DEBUG] Returning ${assignments.length} work order assignments`);

        res.json(assignments);
    } catch (e: any) {
        console.error("❌ Error fetching assigned work orders:", e);
        res.status(500).json({ error: e.message });
    }
};


export const testBackendAssignments = async (req: Request, res: Response): Promise<void> => {
    try {
        // Get all assignments with full details
        const assignments = await WorkOrderAssigneeModel.find()
            .populate("woId")
            .populate("userId")
            .lean();

        // Group by user
        const groupedByUser = assignments.reduce((acc: any, assignment: any) => {
            const userId = assignment.userId?._id?.toString() || 'unknown';
            const userName = assignment.userId ?
                `${assignment.userId.firstName} ${assignment.userId.lastName}` :
                'No Name';

            if (!acc[userId]) {
                acc[userId] = {
                    userId,
                    userName,
                    workOrders: []
                };
            }

            acc[userId].workOrders.push({
                workOrderId: assignment.woId?._id,
                orderNo: assignment.woId?.order_no,
                title: assignment.woId?.title,
                createdAt: assignment.createdAt
            });

            return acc;
        }, {});

        const summary = Object.values(groupedByUser).map((user: any) => ({
            userId: user.userId,
            userName: user.userName,
            totalWorkOrders: user.workOrders.length,
            workOrders: user.workOrders
        }));

        res.json({
            totalAssignments: assignments.length,
            totalUsers: Object.keys(groupedByUser).length,
            userSummary: summary,
            rawData: assignments
        });

    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
};