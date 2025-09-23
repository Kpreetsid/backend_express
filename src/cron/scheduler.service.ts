import { WorkOrderModel } from "../models/workOrder.model";

export const scheduledWorkOrder = async () => {
    const data = await WorkOrderModel.find({});
    console.log(`${new Date().toISOString()}: Scheduled WorkOrders: ${data.length}.`);
}