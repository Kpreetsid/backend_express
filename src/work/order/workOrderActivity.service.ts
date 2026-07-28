import { WorkOrderModel } from "../../models/workOrder.model";
import { WorkOrderActivityAction, WorkOrderActivityModel } from "../../models/workOrderActivity.model";
import { helperService } from "../../utils/helper";

interface WorkOrderActivityPayload {
  account_id: any;
  work_order_id: any;
  workOrder?: any;
  action_type: WorkOrderActivityAction;
  note?: string;
  metadata?: Record<string, any>;
  actor?: any;
}

class WorkOrderActivityService {
  private formatActorName(actor: any): string {
    const firstName = String(actor?.firstName || '').trim();
    const lastName = String(actor?.lastName || '').trim();
    if (firstName || lastName) {
      return `${firstName} ${lastName}`.trim();
    }
    return String(actor?.username || actor?.email || '').trim();
  }

  private async resolveWorkOrderContext(payload: WorkOrderActivityPayload, session?: any): Promise<any | null> {
    if (payload.workOrder?._id || payload.workOrder?.id) {
      return payload.workOrder;
    }

    const workOrderId = helperService.validateObjectId(String(payload.work_order_id));
    const query = WorkOrderModel.findOne({
      _id: workOrderId,
      account_id: payload.account_id
    }).select('_id order_no title').lean();

    if (session) {
      query.session(session);
    }

    return query;
  }

  async logActivity(payload: WorkOrderActivityPayload, session?: any): Promise<void> {
    if (!payload?.account_id || !payload?.work_order_id || !payload?.action_type) {
      return;
    }

    const workOrder = await this.resolveWorkOrderContext(payload, session);
    if (!workOrder?._id) {
      return;
    }

    const actorId = payload.actor?._id || payload.actor?.id || (typeof payload.actor === 'string' ? payload.actor : null);

    const activity = new WorkOrderActivityModel({
      account_id: payload.account_id,
      work_order_id: workOrder._id,
      order_no: workOrder.order_no || '',
      title: workOrder.title || '',
      action_type: payload.action_type,
      note: String(payload.note || '').trim(),
      metadata: payload.metadata || {},
      ...(actorId ? { actor_id: helperService.validateObjectId(String(actorId)) } : {}),
      actor_name: this.formatActorName(payload.actor),
      visible: true
    });
    await activity.save(session ? { session } : {});
  }

  async getActivityHistory(workOrderId: string, account_id: any): Promise<any[]> {
    const records = await WorkOrderActivityModel.find({
      account_id,
      work_order_id: helperService.validateObjectId(String(workOrderId)),
      visible: true
    }).sort({ createdAt: -1 }).lean();

    return records.map((record: any) => ({
      ...record,
      id: record?._id
    }));
  }
}

export const workOrderActivityService = new WorkOrderActivityService();
