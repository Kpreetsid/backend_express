import { WorkRequestModel, IWorkRequest, WORK_REQUEST_ORDER_SLA_HOURS, WORK_REQUEST_REVIEW_SLA_HOURS } from "../../models/workRequest.model";
import { createSyncConflict } from "../../utils/sync-concurrency";
import { ClientSession } from "mongoose";

class RequestService {
  private buildTenantFilter(account_id: any, match: any = {}): any {
    if (!account_id) {
      throw Object.assign(new Error('Authenticated account is required'), { status: 401 });
    }
    return {
      ...match,
      account_id,
      visible: true
    };
  }

  private sanitizeClientUpdate(body: any): any {
    const {
      _id: _ignoredId,
      account_id: _ignoredAccountId,
      visible: _ignoredVisible,
      sync_version: _ignoredSyncVersion,
      createdBy: _ignoredCreatedBy,
      updatedBy: _ignoredUpdatedBy,
      approvedBy: _ignoredApprovedBy,
      approvedAt: _ignoredApprovedAt,
      rejectedBy: _ignoredRejectedBy,
      rejectedAt: _ignoredRejectedAt,
      convertedBy: _ignoredConvertedBy,
      convertedAt: _ignoredConvertedAt,
      converted_work_order_id: _ignoredConvertedWorkOrderId,
      converted_order_no: _ignoredConvertedOrderNo,
      review_due_at: _ignoredReviewDueAt,
      order_due_at: _ignoredOrderDueAt,
      ...editableBody
    } = body || {};
    return editableBody;
  }

  private getReviewSlaHours(priority: string): number {
    return WORK_REQUEST_REVIEW_SLA_HOURS[priority] ?? WORK_REQUEST_REVIEW_SLA_HOURS['Low']!;
  }

  private getOrderSlaHours(priority: string): number {
    return WORK_REQUEST_ORDER_SLA_HOURS[priority] ?? WORK_REQUEST_ORDER_SLA_HOURS['Low']!;
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

  async generateRequestNo(account_id: any, session?: ClientSession): Promise<string> {
    const year = new Date().getFullYear();
    const countQuery = WorkRequestModel.countDocuments({
      account_id,
      createdAt: {
        $gte: new Date(`${year}-01-01T00:00:00Z`),
        $lte: new Date(`${year}-12-31T23:59:59Z`)
      }
    });
    if (session) countQuery.session(session);
    const totalCount = await countQuery;
    const sequence = String(totalCount + 1).padStart(4, "0");
    return `WR-${year}${sequence}`;
  }

  async getAllRequests(account_id: any, match: any): Promise<IWorkRequest[]> {
    const tenantMatch = this.buildTenantFilter(account_id, match);
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
    return await WorkRequestModel.find(tenantMatch).populate(populateList);
  };

  async countRequests(account_id: any, match: any): Promise<number> {
    return await WorkRequestModel.countDocuments(this.buildTenantFilter(account_id, match));
  }
  
  async getRequestById (id: string, account_id: any, session?: ClientSession): Promise<IWorkRequest | null> {
    const query = WorkRequestModel.findOne(this.buildTenantFilter(account_id, { _id: id }));
    if (session) query.session(session);
    return await query;
  }
  
  async createRequest (body: any, user: any, session?: ClientSession): Promise<any> {
    const priority = body.priority || 'Low';
    const governance = this.buildReviewGovernance(priority);
    const newWorkRequest = new WorkRequestModel({
      account_id: user.account_id,
      request_no: await this.generateRequestNo(user.account_id, session),
      title: body.title,
      description: body.description,
      problemType: body.problemType,
      priority,
      location_id: body.location_id,
      asset_id: body.asset_id || null,
      files: body.files,
      status: body.status || 'Open',
      tags: body.tags,
      ...governance,
      createdBy: user._id
    });
    return await newWorkRequest.save(session ? { session } : {});
  };
  
  private async updateRequestRecord(
    id: string,
    account_id: any,
    body: any,
    user_id: any,
    session?: ClientSession,
    expectedVersion?: number
  ): Promise<any> {
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
    const filter: any = this.buildTenantFilter(account_id, { _id: id });
    if (expectedVersion !== undefined) filter.sync_version = expectedVersion;
    const result = await WorkRequestModel.updateOne(
      filter,
      body,
      session ? { session } : {}
    );
    if (expectedVersion !== undefined && result.matchedCount === 0) {
      const latest = await this.getRequestById(id, account_id, session);
      throw createSyncConflict(latest);
    }
    return result;
  };

  async updateRequest (
    id: string,
    account_id: any,
    body: any,
    user_id: any,
    session?: ClientSession,
    expectedVersion?: number
  ): Promise<any> {
    return this.updateRequestRecord(
      id,
      account_id,
      this.sanitizeClientUpdate(body),
      user_id,
      session,
      expectedVersion
    );
  };
  
  async deleteRequestById (
    id: any,
    account_id: any,
    user_id: any,
    session?: ClientSession
  ): Promise<any> {
    return await WorkRequestModel.findOneAndUpdate(
      this.buildTenantFilter(account_id, { _id: id }),
      { updatedBy: user_id, visible: false },
      session ? { returnDocument: 'after', session } : { returnDocument: 'after' }
    );
  };

  async markApproved(
    id: string,
    account_id: any,
    user_id: any,
    priority?: string,
    session?: ClientSession,
    expectedVersion?: number
  ): Promise<any> {
    const approvedAt = new Date();
    return await this.updateRequestRecord(id, account_id, {
      status: 'Approved',
      approvedBy: user_id,
      approvedAt,
      rejectedAt: null,
      rejectedBy: null,
      ...this.buildOrderGovernance(priority || 'Low', approvedAt)
    }, user_id, session, expectedVersion);
  }

  async markRejected(
    id: string,
    account_id: any,
    user_id: any,
    remarks: string,
    session?: ClientSession,
    expectedVersion?: number
  ): Promise<any> {
    return await this.updateRequestRecord(id, account_id, {
      status: 'Rejected',
      remarks,
      rejectedBy: user_id,
      rejectedAt: new Date()
    }, user_id, session, expectedVersion);
  }

  async markConverted(
    id: string,
    account_id: any,
    body: {
      workOrderId: any;
      orderNo: string;
      priority?: string;
      approvedBy?: any;
      approvedAt?: Date;
      convertedBy: any;
    },
    session?: ClientSession
  ): Promise<any> {
    const convertedAt = new Date();
    const approvedAt = body.approvedAt ? new Date(body.approvedAt) : convertedAt;
    return await this.updateRequestRecord(id, account_id, {
      status: 'Approved',
      approvedBy: body.approvedBy || body.convertedBy,
      approvedAt,
      convertedBy: body.convertedBy,
      convertedAt,
      converted_work_order_id: body.workOrderId,
      converted_order_no: body.orderNo,
      ...this.buildOrderGovernance(body.priority || 'Low', approvedAt)
    }, body.convertedBy, session);
  }
}

export const requestService = new RequestService();
