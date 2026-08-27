import { WorkRequestModel, IWorkRequest, WORK_REQUEST_ORDER_SLA_HOURS, WORK_REQUEST_REVIEW_SLA_HOURS } from "../../models/workRequest.model";
<<<<<<< Updated upstream
import { createSyncConflict } from "../../utils/sync-concurrency";
=======
import { AssetModel } from "../../models/asset.model";
import { LocationModel } from "../../models/location.model";
>>>>>>> Stashed changes

class RequestService {
  private getReviewSlaHours(priority: string): number {
    return WORK_REQUEST_REVIEW_SLA_HOURS[priority] ?? WORK_REQUEST_REVIEW_SLA_HOURS.Low;
  }

  private getOrderSlaHours(priority: string): number {
    return WORK_REQUEST_ORDER_SLA_HOURS[priority] ?? WORK_REQUEST_ORDER_SLA_HOURS.Low;
  }

  private addHours(baseDate: Date, hours: number): Date {
    return new Date(baseDate.getTime() + (hours * 60 * 60 * 1000));
  }

  private buildReviewGovernance(priority: string, baseDate: Date = new Date()) {
    const review_sla_hours = this.getReviewSlaHours(priority);
    const order_sla_hours = this.getOrderSlaHours(priority);
    return {
      review_sla_hours,
      review_due_at: this.addHours(baseDate, review_sla_hours),
      order_sla_hours
    };
  }

  private buildOrderGovernance(priority: string, baseDate: Date = new Date()) {
    const order_sla_hours = this.getOrderSlaHours(priority);
    return {
      order_sla_hours,
      order_due_at: this.addHours(baseDate, order_sla_hours)
    };
  }

  async generateRequestNo(account_id: any): Promise<string> {
    const year = new Date().getFullYear();
    const totalCount = await WorkRequestModel.countDocuments({
      account_id,
      createdAt: {
        $gte: new Date(`${year}-01-01T00:00:00Z`),
        $lte: new Date(`${year}-12-31T23:59:59Z`)
      }
    });
    const sequence = String(totalCount + 1).padStart(4, "0");
    return `WR-${year}${sequence}`;
  }

  async getAllRequests(match: any): Promise<IWorkRequest[]> {
    match.visible = true;
    const populateList = [
      { path: "location_id", model: "Schema_Location", select: "id location_name location_type top_level parent_id visible", match: { visible: true } },
      { path: "asset_id", model: "Schema_Asset", select: "id asset_name asset_type asset_model top_level parent_id visible", match: { visible: true } },
      { path: "account_id", model: "Schema_Account", select: "id account_name" },
      { path: "createdBy", model: "Schema_User", select: "id firstName lastName email username user_role user_profile_img user_status" },
      { path: "updatedBy", model: "Schema_User", select: "id firstName lastName email username user_role user_profile_img user_status" },
      { path: "approvedBy", model: "Schema_User", select: "id firstName lastName email username user_role user_profile_img user_status" },
      { path: "rejectedBy", model: "Schema_User", select: "id firstName lastName email username user_role user_profile_img user_status" },
      { path: "convertedBy", model: "Schema_User", select: "id firstName lastName email username user_role user_profile_img user_status" },
      { path: "converted_work_order_id", model: "Schema_WorkOrder", select: "id order_no title status priority start_date end_date" }
    ];
    return await WorkRequestModel.find(match).populate(populateList);
  };

  async countRequests(match: any): Promise<number> {
    match.visible = true;
    return await WorkRequestModel.countDocuments(match);
  }
  
  async getRequestById (id: string, account_id?: any, session?: any): Promise<IWorkRequest | null> {
    const match: Record<string, any> = { _id: id, visible: true };
    if (account_id) match.account_id = account_id;
    return await WorkRequestModel.findOne(match).session(session || null);
  }
  
  async createRequest (body: any, user: any): Promise<any> {
    const priority = body.priority || 'Low';
    const governance = this.buildReviewGovernance(priority);
    const newWorkRequest = new WorkRequestModel({
      account_id: user.account_id,
      request_no: await this.generateRequestNo(user.account_id),
      title: body.title,
      description: body.description,
      problemType: body.problemType,
      priority,
      location_id: body.location_id,
      asset_id: body.asset_id || null,
      files: body.files,
      status: 'Open',
      tags: body.tags,
      ...governance,
      createdBy: user._id
    });
    return await newWorkRequest.save();
  };
  
<<<<<<< Updated upstream
  async updateRequest (id: string, body: any, user_id: any, session?: any, expectedVersion?: number): Promise<any> {
=======
  async updateRequest (id: string, body: any, user_id: any, session?: any, additionalMatch: Record<string, any> = {}): Promise<any> {
>>>>>>> Stashed changes
    body.updatedBy = user_id;
    if (body.asset_id === '') {
      body.asset_id = null;
    }
    if (body.priority) {
      const reviewGovernance = this.buildReviewGovernance(body.priority);
      body.review_sla_hours = reviewGovernance.review_sla_hours;
      body.order_sla_hours = reviewGovernance.order_sla_hours;
      if (!body.approvedAt && !body.rejectedAt && !body.convertedAt) {
        body.review_due_at = reviewGovernance.review_due_at;
      }
      if (body.approvedAt && !body.convertedAt) {
        body.order_due_at = this.buildOrderGovernance(body.priority, new Date(body.approvedAt)).order_due_at;
      }
    }
<<<<<<< Updated upstream
    const filter: any = { _id: id };
    if (expectedVersion !== undefined) filter.sync_version = expectedVersion;
    const result = await WorkRequestModel.updateOne(filter, body, { session });
    if (expectedVersion !== undefined && result.matchedCount === 0) {
      const latest = session
        ? await WorkRequestModel.findById(id).session(session)
        : await WorkRequestModel.findById(id);
      throw createSyncConflict(latest);
    }
    return result;
=======
    return await WorkRequestModel.updateOne({ _id: id, ...additionalMatch }, { $set: body }, { session });
>>>>>>> Stashed changes
  };
  
  async deleteRequestById (id: any, account_id: any, user_id: any): Promise<any> {
    return await WorkRequestModel.findOneAndUpdate(
      {
        _id: id,
        account_id,
        visible: true,
        status: 'Open',
        $or: [
          { converted_work_order_id: { $exists: false } },
          { converted_work_order_id: null }
        ]
      },
      { $set: { updatedBy: user_id, visible: false } },
      { returnDocument: 'after' }
    );
  };

<<<<<<< Updated upstream
  async markApproved(id: string, user_id: any, priority?: string, session?: any, expectedVersion?: number): Promise<any> {
=======
  async markApproved(id: string, account_id: any, user_id: any, priority?: string, session?: any): Promise<any> {
>>>>>>> Stashed changes
    const approvedAt = new Date();
    return await this.updateRequest(id, {
      status: 'Approved',
      approvedBy: user_id,
      approvedAt,
      rejectedAt: null,
      rejectedBy: null,
      ...this.buildOrderGovernance(priority || 'Low', approvedAt)
<<<<<<< Updated upstream
    }, user_id, session, expectedVersion);
  }

  async markRejected(id: string, user_id: any, remarks: string, session?: any, expectedVersion?: number): Promise<any> {
=======
    }, user_id, session, {
      account_id,
      visible: true,
      status: 'Open',
      $or: [
        { converted_work_order_id: { $exists: false } },
        { converted_work_order_id: null }
      ]
    });
  }

  async markRejected(id: string, account_id: any, user_id: any, remarks: string, session?: any): Promise<any> {
>>>>>>> Stashed changes
    return await this.updateRequest(id, {
      status: 'Rejected',
      remarks,
      rejectedBy: user_id,
      rejectedAt: new Date()
<<<<<<< Updated upstream
    }, user_id, session, expectedVersion);
=======
    }, user_id, session, {
      account_id,
      visible: true,
      status: 'Open',
      $or: [
        { converted_work_order_id: { $exists: false } },
        { converted_work_order_id: null }
      ]
    });
>>>>>>> Stashed changes
  }

  async assertRequestReferences(body: any, account_id: any): Promise<void> {
    if (body.location_id) {
      const location = await LocationModel.exists({ _id: body.location_id, account_id, visible: true });
      if (!location) {
        throw Object.assign(new Error('Location does not belong to the active account'), { status: 400 });
      }
    }

    if (body.asset_id) {
      const asset = await AssetModel.exists({ _id: body.asset_id, account_id, visible: true });
      if (!asset) {
        throw Object.assign(new Error('Asset does not belong to the active account'), { status: 400 });
      }
    }
  }

  async markConverted(id: string, account_id: any, body: { workOrderId: any; orderNo: string; priority?: string; approvedBy?: any; approvedAt?: Date; convertedBy: any }, session?: any): Promise<any> {
    const convertedAt = new Date();
    const approvedAt = body.approvedAt ? new Date(body.approvedAt) : convertedAt;
    return await this.updateRequest(id, {
      status: 'Approved',
      approvedBy: body.approvedBy || body.convertedBy,
      approvedAt,
      convertedBy: body.convertedBy,
      convertedAt,
      converted_work_order_id: body.workOrderId,
      converted_order_no: body.orderNo,
      ...this.buildOrderGovernance(body.priority || 'Low', approvedAt)
    }, body.convertedBy, session, {
      account_id,
      visible: true,
      status: 'Approved',
      $or: [
        { converted_work_order_id: { $exists: false } },
        { converted_work_order_id: null }
      ]
    });
  }
}

export const requestService = new RequestService();
