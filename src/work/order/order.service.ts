import { applicationLogger } from '../../observability/logger';
import mongoose from "mongoose";
import { IWorkOrder, WorkOrderModel } from "../../models/workOrder.model";
import { IUser, UserModel } from "../../models/user.model";
import { MailerService } from "../../_config/mailer";
import { userWorkOrderService } from "../../transaction/mapUserWorkOrder/userWorkOrder.service";
import { partsService } from "../../masters/part/parts.service";
import { commentService } from "../comments/comment.service";
import { requestService } from "../request/request.service";
import { helperService } from "../../utils/helper";
import { notificationService } from "../../utils/notification.service";
import { withTransaction } from "../../utils/transaction.helper";
import { ProcedureModel } from "../../models/procedure.model";
import { WorkOrderAssigneeModel } from "../../models/mapUserWorkOrder.model";
import { workOrderActivityService } from "./workOrderActivity.service";
import { WorkRequestModel } from "../../models/workRequest.model";
import { SchedulerModel } from "../../models/scheduleMaster.model";
import { AssetModel } from "../../models/asset.model";
import { InventoryMovementModel } from "../../models/inventoryMovement.model";
import { LocationModel } from "../../models/location.model";
import { PartsModel } from "../../models/part.model";
import { PartsTypeModel } from "../../models/parts-types.model";
import { SOPsModel } from "../../models/sops.model";
import { assertSyncVersion, createSyncConflict } from "../../utils/sync-concurrency";
import { randomUUID } from "node:crypto";
import { queueConfig } from "../../configDB";
import { createOutboxEvent } from "../../queue/outbox-writer";

export interface WorkOrderSearchParams {
  account_id: any;
  user_id: string;
  user_role: string;
  query: {
    status?: any;
    priority?: any;
    wo_asset_id?: any;
    wo_location_id?: any;
    asset_id?: any;
    assetIds?: any;
    location_id?: any;
    assignedUser?: any;
    pageTYPE?: string; // assignedToMe, createdByMe, openToAll
    order_no?: string;
    search?: string;
    searchText?: string;
    createdFrom?: any;
    dashboardFilter?: string;
    fromDate?: string;
    toDate?: string;
  };
  pagination?: {
    skip: number;
    limit: number;
  };
}

class OrderService {
  private mailerService: MailerService;
  private readonly natureOfWorkCanonicalValues = [
    'General',
    'Maintenance',
    'Quality',
    'Breakdown',
    'Kaizen/improvement',
    'Preventive',
    'Electrical',
    'Inspection',
    'Corrective',
    'Safety',
    'Upgrade',
    'Meter Reading',
    'Mechanical',
    'Other'
  ];
  private userProjection = {
    _id: 1,
    id: "$_id",
    firstName: 1,
    lastName: 1,
    email: 1,
    username: 1,
    user_role: 1,
    user_status: 1,
    user_profile_img: 1
  };

  constructor() {
    this.mailerService = new MailerService();
  }

  private async dispatchWorkOrderAssignmentEmails(
    workOrder: any,
    assignedUsers: IUser[],
    createdBy: IUser,
    session: mongoose.ClientSession,
    correlationId?: string
  ): Promise<void> {
    if (!assignedUsers.length) return;

    if (queueConfig.domainEventOutboxEnabled) {
      const eventCorrelationId = correlationId || randomUUID();
      await Promise.all(assignedUsers.map((assignedUser) =>
        createOutboxEvent({
          type: 'email.work-order.assigned',
          version: 1,
          tenantId: String(createdBy.account_id),
          actorId: String(createdBy._id),
          correlationId: eventCorrelationId,
          entity: {
            type: 'work-order',
            id: String(workOrder._id)
          },
          payload: {
            workOrderId: String(workOrder._id),
            recipientUserId: String(assignedUser._id),
            createdByUserId: String(createdBy._id)
          }
        }, { session })
      ));
      return;
    }

    let enrichedOrder = workOrder;
    try {
      const orders = await this.getAllOrders({
        _id: workOrder._id,
        account_id: createdBy.account_id,
        visible: true
      }, session);
      enrichedOrder = orders[0] || workOrder;
    } catch (readError: any) {
      applicationLogger.warn(
        'Failed to prepare enriched work order mail payload:',
        readError?.message || readError
      );
    }

    await Promise.all(assignedUsers.map(async (assignedUser) => {
      try {
        await this.mailerService.sendWorkOrderMail(enrichedOrder, assignedUser, createdBy);
      } catch (mailError: any) {
        applicationLogger.warn(
          'Failed to send work order assignment mail:',
          mailError?.message || mailError
        );
      }
    }));
  }

  private escapeRegex(value: string = ''): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private getQueryValues(value: any): string[] {
    if (Array.isArray(value)) {
      return value.map((item: any) => String(item || '').trim()).filter(Boolean);
    }

    return String(value || '')
      .split(',')
      .map((item: string) => item.trim())
      .filter(Boolean);
  }

  private normalizeAuditValue(value: any): any {
    if (value === undefined || value === null) {
      return null;
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (Array.isArray(value)) {
      return value.map((item: any) => this.normalizeAuditValue(item));
    }

    if (typeof value === 'object') {
      if (value?._bsontype === 'ObjectId' || value?.constructor?.name === 'ObjectId') {
        return String(value);
      }

      return Object.keys(value).sort().reduce((acc: Record<string, any>, key: string) => {
        acc[key] = this.normalizeAuditValue(value[key]);
        return acc;
      }, {});
    }

    return value;
  }

  private hasMeaningfulChange(before: any, after: any): boolean {
    return JSON.stringify(this.normalizeAuditValue(before)) !== JSON.stringify(this.normalizeAuditValue(after));
  }

  private formatAuditList(items: string[] = []): string {
    const sanitized = items.map((item: string) => String(item || '').trim()).filter(Boolean);
    if (sanitized.length <= 1) {
      return sanitized[0] || '';
    }
    if (sanitized.length === 2) {
      return `${sanitized[0]} and ${sanitized[1]}`;
    }
    return `${sanitized.slice(0, -1).join(', ')}, and ${sanitized[sanitized.length - 1]}`;
  }

  private canonicalizeNatureOfWork(value: any): string {
    const normalizedValue = String(value || '').trim();
    if (!normalizedValue) {
      return 'General';
    }

    const compact = normalizedValue.toLowerCase().replace(/[\s_-]+/g, '');
    const aliasMap: Record<string, string> = {
      general: 'General',
      maintenance: 'Maintenance',
      quality: 'Quality',
      breakdown: 'Breakdown',
      breakdwon: 'Breakdown',
      breakdownwork: 'Breakdown',
      breakdownmaintenance: 'Breakdown',
      breakdowns: 'Breakdown',
      breakdownrepair: 'Breakdown',
      breakdownservice: 'Breakdown',
      breakdownjob: 'Breakdown',
      breakdowntask: 'Breakdown',
      breakdownactivity: 'Breakdown',
      breakdownissue: 'Breakdown',
      breakdownevent: 'Breakdown',
      breakdownincident: 'Breakdown',
      breakdowncallout: 'Breakdown',
      breakdowncalloutwork: 'Breakdown',
      breakdowncalloutjob: 'Breakdown',
      breakdwonwork: 'Breakdown',
      breakdwonjob: 'Breakdown',
      breakdownrepairwork: 'Breakdown',
      breakdownrepairjob: 'Breakdown',
      breakdownrepairtask: 'Breakdown',
      kaizenimprovement: 'Kaizen/improvement',
      kaizenimprovements: 'Kaizen/improvement',
      kaizen: 'Kaizen/improvement',
      improvement: 'Kaizen/improvement',
      improvements: 'Kaizen/improvement',
      preventive: 'Preventive',
      preventivemaintenance: 'Preventive',
      electircal: 'Electrical',
      electrical: 'Electrical',
      inspection: 'Inspection',
      corrective: 'Corrective',
      safety: 'Safety',
      upgrade: 'Upgrade',
      meterreading: 'Meter Reading',
      meterreadings: 'Meter Reading',
      mechenical: 'Mechanical',
      mechanical: 'Mechanical',
      other: 'Other'
    };

    return aliasMap[compact] || this.natureOfWorkCanonicalValues.find((item: string) => item.toLowerCase() === normalizedValue.toLowerCase()) || normalizedValue;
  }

  private normalizeNatureOfWorkPayload(body: any): any {
    if (!body) {
      return body;
    }

    const nextBody = { ...body };
    const rawNatureOfWork = nextBody.nature_of_work ?? nextBody.type;
    const canonicalNatureOfWork = this.canonicalizeNatureOfWork(rawNatureOfWork);
    nextBody.nature_of_work = canonicalNatureOfWork;

    if (!String(nextBody.type || '').trim()) {
      nextBody.type = canonicalNatureOfWork;
    }

    return nextBody;
  }

  private buildCompletedByPayload(user: IUser | null | undefined): { id: string; firstName: string; lastName: string } | null {
    if (!user?._id) {
      return null;
    }

    return {
      id: String(user._id),
      firstName: String(user?.firstName || '').trim(),
      lastName: String(user?.lastName || '').trim()
    };
  }

  private syncCompletionAuditFields(order: any, previousStatus: string | null | undefined, actor: IUser): any {
    const nextOrder = { ...order };
    const nextStatus = String(nextOrder?.status || '').trim();
    const prevStatus = String(previousStatus || '').trim();
    const isTransitioningToCompleted = nextStatus === 'Completed' && prevStatus !== 'Completed';

    if (nextStatus === 'Completed') {
      const completionDate = nextOrder?.actual_end_date ? new Date(nextOrder.actual_end_date) : (nextOrder?.completed_at ? new Date(nextOrder.completed_at) : new Date());
      nextOrder.completed_at = completionDate;
      nextOrder.completed_by = isTransitioningToCompleted
        ? (this.buildCompletedByPayload(actor) || nextOrder.completed_by || null)
        : (nextOrder.completed_by || this.buildCompletedByPayload(actor) || null);
    } else {
      nextOrder.completed_at = null;
      nextOrder.completed_by = null;
    }

    return nextOrder;
  }

  private syncStatusDetailAuditFields(order: any, actor: IUser): any {
    const statusDetails = Array.isArray(order?.status_details) ? order.status_details : [];
    const fallbackCreatedBy = actor?._id || order?.updatedBy || order?.createdBy;

    return {
      ...order,
      status_details: statusDetails
        .map((entry: any) => ({
          ...entry,
          createdBy: entry?.createdBy || fallbackCreatedBy
        }))
        .filter((entry: any) => !!entry?.status && !!entry?.createdBy)
    };
  }

  private getGeneralChangeLabels(existingOrder: any, updatedOrder: any, body: any): string[] {
    const fieldLabels: Record<string, string> = {
      title: 'title',
      description: 'description',
      priority: 'priority',
      type: 'type',
      nature_of_work: 'nature of work',
      wo_asset_id: 'asset',
      wo_location_id: 'location',
      start_date: 'start date',
      end_date: 'due date',
      estimated_time: 'estimated time',
      parentId: 'parent work order',
      work_request_id: 'linked work request',
      asset_report_id: 'linked asset report',
      block_reason: 'block reason'
    };

    return Object.keys(fieldLabels).filter((field: string) => {
      if (!Object.prototype.hasOwnProperty.call(body || {}, field)) {
        return false;
      }
      return this.hasMeaningfulChange(existingOrder?.[field], updatedOrder?.[field]);
    }).map((field: string) => fieldLabels[field]!);
  }

  private summarizePartsForAudit(parts: any[] = []): { lineCount: number; plannedQuantity: number; actualQuantity: number } {
    return (parts || []).reduce((summary: any, part: any) => {
      summary.lineCount += 1;
      summary.plannedQuantity += Number(part?.plannedQuantity ?? part?.estimatedQuantity ?? 0) || 0;
      summary.actualQuantity += Number(part?.actualQuantity ?? 0) || 0;
      return summary;
    }, { lineCount: 0, plannedQuantity: 0, actualQuantity: 0 });
  }

  private summarizeProcedureAudit(entries: any[] = []): { total: number; submitted: number } {
    return (entries || []).reduce((summary: any, entry: any) => {
      summary.total += 1;
      if (entry?.submitted) {
        summary.submitted += 1;
      }
      return summary;
    }, { total: 0, submitted: 0 });
  }

  private summarizeExecutionAudit(order: any): { laborCount: number; actualTime: number | null; actualStartDate: any; actualEndDate: any } {
    return {
      laborCount: Array.isArray(order?.labor_entries) ? order.labor_entries.length : 0,
      actualTime: Number.isFinite(Number(order?.actual_time)) ? Number(order.actual_time) : null,
      actualStartDate: order?.actual_start_date || null,
      actualEndDate: order?.actual_end_date || null
    };
  }

  private summarizeTaskAudit(tasks: any[] = []): { total: number; completed: number } {
    return (tasks || []).reduce((summary: any, task: any) => {
      summary.total += 1;
      if (task?.completed || String(task?.status || '').trim() === 'Completed') {
        summary.completed += 1;
      }
      return summary;
    }, { total: 0, completed: 0 });
  }

  private async getUserNameMap(userIds: string[] = [], session?: any): Promise<Map<string, string>> {
    const ids = Array.from(new Set((userIds || []).map((userId: string) => String(userId || '').trim()).filter(Boolean)));
    if (!ids.length) {
      return new Map<string, string>();
    }

    const query = UserModel.find({ _id: { $in: helperService.validateObjectIds(ids.join(',')) } })
      .select('firstName lastName username email')
      .lean();
    if (session) {
      query.session(session);
    }

    const users = await query;
    return new Map(users.map((user: any) => {
      const fullName = `${String(user?.firstName || '').trim()} ${String(user?.lastName || '').trim()}`.trim()
        || String(user?.username || user?.email || 'Assigned user').trim();
      return [String(user?._id), fullName];
    }));
  }

  private async logWorkOrderUpdateActivities(existingOrder: any, updatedOrder: any, body: any, user: IUser, session?: any, beforeAssignedUserIds: string[] = []): Promise<void> {
    const generalChangeLabels = this.getGeneralChangeLabels(existingOrder, updatedOrder, body);
    if (generalChangeLabels.length > 0) {
      await workOrderActivityService.logActivity({
        account_id: user.account_id,
        work_order_id: existingOrder._id,
        workOrder: updatedOrder,
        action_type: 'updated',
        note: `Updated ${this.formatAuditList(generalChangeLabels)}.`,
        metadata: { changed_fields: generalChangeLabels },
        actor: user
      }, session);
    }

    if (Object.prototype.hasOwnProperty.call(body || {}, 'userIdList')) {
      const beforeIds = beforeAssignedUserIds;
      const afterIds: string[] = Array.isArray(body?.userIdList)
        ? Array.from(new Set<string>(body.userIdList.map((userId: any) => String(userId || '').trim()).filter((userId: string) => Boolean(userId))))
        : [];

      const addedIds = afterIds.filter((userId: string) => !beforeIds.includes(userId));
      const removedIds = beforeIds.filter((userId: string) => !afterIds.includes(userId));
      if (addedIds.length || removedIds.length || beforeIds.length !== afterIds.length) {
        const userNameMap = await this.getUserNameMap([...beforeIds, ...afterIds], session);
        const addedNames = addedIds.map((userId: string) => userNameMap.get(userId) || 'Assigned user');
        const removedNames = removedIds.map((userId: string) => userNameMap.get(userId) || 'Assigned user');
        const noteParts: string[] = [];
        if (addedNames.length) {
          noteParts.push(`Added ${this.formatAuditList(addedNames)}`);
        }
        if (removedNames.length) {
          noteParts.push(`Removed ${this.formatAuditList(removedNames)}`);
        }
        if (!noteParts.length) {
          noteParts.push('Updated assignees');
        }
        await workOrderActivityService.logActivity({
          account_id: user.account_id,
          work_order_id: existingOrder._id,
          workOrder: updatedOrder,
          action_type: 'assignees-updated',
          note: `${noteParts.join('. ')}.`,
          metadata: {
            before_ids: beforeIds,
            after_ids: afterIds,
            added_ids: addedIds,
            removed_ids: removedIds
          },
          actor: user
        }, session);
      }
    }

    if (Object.prototype.hasOwnProperty.call(body || {}, 'parts')) {
      const beforePartsRaw = Array.isArray(existingOrder?.parts) ? existingOrder.parts : [];
      const afterPartsRaw = Array.isArray(updatedOrder?.parts) ? updatedOrder.parts : [];
      if (this.hasMeaningfulChange(beforePartsRaw, afterPartsRaw)) {
        const beforeParts = this.summarizePartsForAudit(beforePartsRaw);
        const afterParts = this.summarizePartsForAudit(afterPartsRaw);
        await workOrderActivityService.logActivity({
          account_id: user.account_id,
          work_order_id: existingOrder._id,
          workOrder: updatedOrder,
          action_type: 'parts-updated',
          note: `Updated parts from ${beforeParts.lineCount} to ${afterParts.lineCount} line(s). Planned quantity ${beforeParts.plannedQuantity} -> ${afterParts.plannedQuantity}.`,
          metadata: {
            before: beforeParts,
            after: afterParts
          },
          actor: user
        }, session);
      }
    }

    if (Object.prototype.hasOwnProperty.call(body || {}, 'procedure_ids') || Object.prototype.hasOwnProperty.call(body || {}, 'procedure_entries')) {
      const beforeProceduresRaw = Array.isArray(existingOrder?.procedure_entries) ? existingOrder.procedure_entries : [];
      const afterProceduresRaw = Array.isArray(updatedOrder?.procedure_entries) ? updatedOrder.procedure_entries : [];
      if (this.hasMeaningfulChange(beforeProceduresRaw, afterProceduresRaw)) {
        const beforeProcedures = this.summarizeProcedureAudit(beforeProceduresRaw);
        const afterProcedures = this.summarizeProcedureAudit(afterProceduresRaw);
        await workOrderActivityService.logActivity({
          account_id: user.account_id,
          work_order_id: existingOrder._id,
          workOrder: updatedOrder,
          action_type: 'procedures-updated',
          note: `Updated procedures. ${afterProcedures.submitted}/${afterProcedures.total} procedure${afterProcedures.total === 1 ? '' : 's'} submitted.`,
          metadata: {
            before: beforeProcedures,
            after: afterProcedures
          },
          actor: user
        }, session);
      }
    }

    if (
      Object.prototype.hasOwnProperty.call(body || {}, 'labor_entries')
      || Object.prototype.hasOwnProperty.call(body || {}, 'actual_start_date')
      || Object.prototype.hasOwnProperty.call(body || {}, 'actual_end_date')
      || Object.prototype.hasOwnProperty.call(body || {}, 'actual_time')
    ) {
      const beforeExecution = this.summarizeExecutionAudit(existingOrder);
      const afterExecution = this.summarizeExecutionAudit(updatedOrder);
      if (this.hasMeaningfulChange(beforeExecution, afterExecution)) {
        await workOrderActivityService.logActivity({
          account_id: user.account_id,
          work_order_id: existingOrder._id,
          workOrder: updatedOrder,
          action_type: 'execution-updated',
          note: `Updated execution capture. Labor entries ${beforeExecution.laborCount} -> ${afterExecution.laborCount}. Actual time ${beforeExecution.actualTime ?? 0}h -> ${afterExecution.actualTime ?? 0}h.`,
          metadata: {
            before: beforeExecution,
            after: afterExecution
          },
          actor: user
        }, session);
      }
    }

    if (Object.prototype.hasOwnProperty.call(body || {}, 'tasks')) {
      const beforeTasksRaw = Array.isArray(existingOrder?.tasks) ? existingOrder.tasks : [];
      const afterTasksRaw = Array.isArray(updatedOrder?.tasks) ? updatedOrder.tasks : [];
      if (this.hasMeaningfulChange(beforeTasksRaw, afterTasksRaw)) {
        const beforeTasks = this.summarizeTaskAudit(beforeTasksRaw);
        const afterTasks = this.summarizeTaskAudit(afterTasksRaw);
        await workOrderActivityService.logActivity({
          account_id: user.account_id,
          work_order_id: existingOrder._id,
          workOrder: updatedOrder,
          action_type: 'tasks-updated',
          note: `Updated task tracking. ${afterTasks.completed}/${afterTasks.total} task${afterTasks.total === 1 ? '' : 's'} completed.`,
          metadata: {
            before: beforeTasks,
            after: afterTasks
          },
          actor: user
        }, session);
      }
    }

    if (Object.prototype.hasOwnProperty.call(body || {}, 'sop_form_submitted') || Object.prototype.hasOwnProperty.call(body || {}, 'sop_form_data')) {
      const beforeSopState = {
        submitted: Boolean(existingOrder?.sop_form_submitted),
        data: existingOrder?.sop_form_data || null,
        updated_at: existingOrder?.sop_form_updated_at || null
      };
      const afterSopState = {
        submitted: Boolean(updatedOrder?.sop_form_submitted),
        data: updatedOrder?.sop_form_data || null,
        updated_at: updatedOrder?.sop_form_updated_at || null
      };
      if (this.hasMeaningfulChange(beforeSopState, afterSopState)) {
        const submitted = Boolean(updatedOrder?.sop_form_submitted);
        await workOrderActivityService.logActivity({
          account_id: user.account_id,
          work_order_id: existingOrder._id,
          workOrder: updatedOrder,
          action_type: 'sop-submitted',
          note: submitted ? 'Submitted SOP / checklist data.' : 'Updated SOP / checklist draft data.',
          metadata: {
            submitted,
            updated_at: updatedOrder?.sop_form_updated_at || null
          },
          actor: user
        }, session);
      }
    }
  }

  private isProcedureFieldAnswered(step: any, responses: Record<string, any>): boolean {
    if (step?.type !== 'field' || !step?.required) {
      return true;
    }

    const value = responses?.[step.id];
    switch (step?.field_type) {
      case 'checkbox':
      case 'checklist':
        return Array.isArray(value) && value.length > 0;
      case 'multiple-choice':
      case 'inspection-check':
      case 'yes-no-na':
        return typeof value === 'string' && value.trim().length > 0;
      case 'number':
        return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
      case 'date':
        return typeof value === 'string' && value.trim().length > 0;
      case 'text':
      default:
        return typeof value === 'string' ? value.trim().length > 0 : !!value;
    }
  }

  private areProcedureStepsComplete(steps: any[] = [], responses: Record<string, any> = {}): boolean {
    return (steps || []).every((step: any) => {
      if (!this.isProcedureStepVisible(step, responses)) {
        return true;
      }
      if (step?.type === 'section') {
        return this.areProcedureStepsComplete(step?.items || [], responses);
      }
      return this.isProcedureFieldAnswered(step, responses);
    });
  }

  private isProcedureStepVisible(step: any, responses: Record<string, any> = {}): boolean {
    const condition = step?.visibility_condition;
    if (!condition?.step_id || !Array.isArray(condition?.values) || !condition.values.length) {
      return true;
    }

    const dependentValue = responses?.[condition.step_id];
    const normalizedTriggers = condition.values.map((value: any) => String(value || '').trim()).filter(Boolean);
    if (!normalizedTriggers.length) {
      return true;
    }

    if (Array.isArray(dependentValue)) {
      return dependentValue.some((value) => normalizedTriggers.includes(String(value || '').trim()));
    }

    return normalizedTriggers.includes(String(dependentValue || '').trim());
  }

  private collectProcedureScore(steps: any[] = [], responses: Record<string, any> = {}): { earned: number; possible: number; percentage: number | null } {
    let earned = 0;
    let possible = 0;

    (steps || []).forEach((step: any) => {
      if (!this.isProcedureStepVisible(step, responses)) {
        return;
      }

      if (step?.type === 'section') {
        const nested = this.collectProcedureScore(step?.items || [], responses);
        earned += nested.earned;
        possible += nested.possible;
        return;
      }

      if (step?.type !== 'field' || !step?.scoring_enabled || !Array.isArray(step?.option_scores) || !step.option_scores.length) {
        return;
      }

      const scores = step.option_scores.map((score: any) => Number(score || 0));
      const maxStepScore = ['checkbox', 'checklist'].includes(step?.field_type || '')
        ? scores.reduce((total: number, score: number) => total + Math.max(score, 0), 0)
        : (scores.length ? Math.max(...scores, 0) : 0);
      if (maxStepScore > 0) {
        possible += maxStepScore;
      }

      const value = responses?.[step.id];
      if (Array.isArray(value) && Array.isArray(step?.options)) {
        earned += value.reduce((total: number, selectedValue: any) => {
          const optionIndex = step.options.findIndex((option: any) => String(option || '').trim() === String(selectedValue || '').trim());
          return total + (optionIndex >= 0 ? Number(scores[optionIndex] || 0) : 0);
        }, 0);
      } else if (Array.isArray(step?.options)) {
        const optionIndex = step.options.findIndex((option: any) => String(option || '').trim() === String(value || '').trim());
        if (optionIndex >= 0) {
          earned += Number(scores[optionIndex] || 0);
        }
      }
    });

    return {
      earned,
      possible,
      percentage: possible > 0 ? Number(((earned / possible) * 100).toFixed(1)) : null
    };
  }

  private collectTriggeredCorrectiveActions(steps: any[] = [], responses: Record<string, any> = {}): any[] {
    const triggeredActions: any[] = [];

    (steps || []).forEach((step: any) => {
      if (!this.isProcedureStepVisible(step, responses)) {
        return;
      }

      if (step?.type === 'section') {
        triggeredActions.push(...this.collectTriggeredCorrectiveActions(step?.items || [], responses));
        return;
      }

      if (step?.type !== 'field' || !Array.isArray(step?.corrective_actions) || !step.corrective_actions.length) {
        return;
      }

      const value = responses?.[step.id];
      step.corrective_actions.forEach((action: any) => {
        const triggerValues = Array.isArray(action?.trigger_values)
          ? action.trigger_values.map((triggerValue: any) => String(triggerValue || '').trim()).filter(Boolean)
          : [];

        if (!triggerValues.length) {
          return;
        }

        const matchedValues = Array.isArray(value)
          ? value.filter((item: any) => triggerValues.includes(String(item || '').trim()))
          : triggerValues.includes(String(value || '').trim()) ? [String(value || '').trim()] : [];

        if (!matchedValues.length) {
          return;
        }

        triggeredActions.push({
          id: action?.id || `${step.id}-${Math.random().toString(36).slice(2, 8)}`,
          step_id: step.id,
          step_title: step.title || '',
          title: action?.title || 'Corrective action',
          description: action?.description || '',
          priority: action?.priority || '',
          trigger_values: matchedValues
        });
      });
    });

    return triggeredActions;
  }

  private buildProcedureEntry(template: any, sourceEntry: any, user: IUser): any {
    const responses = sourceEntry?.responses && typeof sourceEntry.responses === 'object' ? sourceEntry.responses : {};
    const completed = this.areProcedureStepsComplete(template?.steps || [], responses);
    const score_summary = this.collectProcedureScore(template?.steps || [], responses);
    const triggered_actions = this.collectTriggeredCorrectiveActions(template?.steps || [], responses);

    return {
      procedure_id: template?._id || sourceEntry?.procedure_id || null,
      name: template?.name || sourceEntry?.name || 'Untitled Procedure',
      category: template?.category || '',
      tags: Array.isArray(template?.tags) ? template.tags : [],
      description: template?.description || '',
      steps: Array.isArray(template?.steps) ? template.steps : [],
      responses,
      score_summary,
      triggered_actions,
      submitted: completed,
      submitted_by: completed
        ? {
            id: String(user._id),
            firstName: user.firstName,
            lastName: user.lastName
          }
        : null,
      submitted_at: completed ? new Date() : null
    };
  }

  private async syncProcedureEntries(input: any, account_id: any, user: IUser, existingEntries: any[] = []): Promise<{ procedure_ids: any[]; procedure_entries: any[] }> {
    const explicitEntries = Array.isArray(input?.procedure_entries) ? input.procedure_entries : [];
    const explicitIds = explicitEntries
      .map((entry: any) => String(entry?.procedure_id || entry?.id || ''))
      .filter(Boolean);
    const bodyIds = Array.isArray(input?.procedure_ids) ? input.procedure_ids.map((id: any) => String(id || '')).filter(Boolean) : [];
    const requestedIds = Array.from(new Set([...(bodyIds || []), ...(explicitIds || [])]));

    if (requestedIds.length === 0) {
      return { procedure_ids: [], procedure_entries: [] };
    }

    const templates = await ProcedureModel.find({
      _id: { $in: helperService.validateObjectIds(requestedIds.join(',')) },
      account_id,
      visible: true
    }).lean();

    const templateMap = new Map(templates.map((template: any) => [String(template._id), template]));
    const existingEntryMap = new Map((existingEntries || []).map((entry: any) => [String(entry?.procedure_id || entry?.id || ''), entry]));
    const explicitEntryMap = new Map((explicitEntries || []).map((entry: any) => [String(entry?.procedure_id || entry?.id || ''), entry]));

    const procedure_entries = requestedIds
      .map((id: string) => {
        const template = templateMap.get(id);
        if (!template) {
          return null;
        }
        const sourceEntry = explicitEntryMap.get(id) || existingEntryMap.get(id) || {};
        return this.buildProcedureEntry(template, sourceEntry, user);
      })
      .filter(Boolean);

    return {
      procedure_ids: procedure_entries.map((entry: any) => entry.procedure_id),
      procedure_entries
    };
  }

  private normalizeTimingFields(data: any): any {
    const normalized = { ...data };
    const actualStartDate = normalized.actual_start_date ? new Date(normalized.actual_start_date) : null;
    const actualEndDate = normalized.actual_end_date ? new Date(normalized.actual_end_date) : null;

    if (normalized.actual_start_date === '') {
      normalized.actual_start_date = null;
    }

    if (normalized.actual_end_date === '') {
      normalized.actual_end_date = null;
    }

    if (normalized.actual_time === '') {
      normalized.actual_time = null;
    }

    if (!Number.isFinite(Number(normalized.actual_time))) {
      normalized.actual_time = normalized.actual_time === null || normalized.actual_time === undefined
        ? normalized.actual_time
        : null;
    } else if (normalized.actual_time !== null && normalized.actual_time !== undefined) {
      normalized.actual_time = Number(normalized.actual_time);
    }

    if (actualStartDate && actualEndDate && actualEndDate >= actualStartDate && !(Number(normalized.actual_time) > 0)) {
      normalized.actual_time = Number((((actualEndDate.getTime() - actualStartDate.getTime()) / 3600000)).toFixed(2));
    }

    normalized.labor_entries = Array.isArray(normalized.labor_entries)
      ? normalized.labor_entries
          .map((entry: any) => ({
            ...entry,
            user_id: entry?.user_id || null,
            vendor_name: entry?.vendor_name || '',
            work_date: entry?.work_date || null,
            hours: entry?.hours === '' || entry?.hours === null || entry?.hours === undefined ? null : Number(entry.hours),
            notes: entry?.notes || ''
          }))
          .filter((entry: any) => entry.hours !== null && Number.isFinite(entry.hours) && (entry.user_id || entry.vendor_name))
      : [];

    if (normalized.block_reason === '') {
      normalized.block_reason = null;
    }

    return normalized;
  }

  private sanitizeWorkOrder(data: any): any {
    if (data.parts && Array.isArray(data.parts)) {
      data.parts = data.parts.map((part: any) => ({
        ...part,
        part_id: part?.part_id || part?.id || part?._id || null,
        part_type: part?.part_type || 'N/A'
      }));
    }

    if (data.tasks && Array.isArray(data.tasks)) {
      data.tasks = data.tasks.map((task: any) => {
        const sanitizedTask = { ...task };
        if (sanitizedTask.assigned_user_id === '') {
          sanitizedTask.assigned_user_id = null;
        }
        return sanitizedTask;
      });
    }

    if (data.labor_entries && Array.isArray(data.labor_entries)) {
      data.labor_entries = data.labor_entries.map((entry: any) => {
        const sanitizedEntry = { ...entry };
        if (sanitizedEntry.user_id === '') {
          sanitizedEntry.user_id = null;
        }
        return sanitizedEntry;
      });
    }

    const objectIdFields = [
      'wo_asset_id',
      'wo_location_id',
      'sop_form_id',
      'work_request_id',
      'asset_report_id',
      'parentId',
      'updatedBy',
      'createdBy'
    ];

    objectIdFields.forEach(field => {
      if (data[field] === '') {
        data[field] = null;
      }
    });

    return data;
  }

  private validateIncomingParts(parts: any[] = []): void {
    for (const part of parts || []) {
      const rawPartId = String(part?.part_id || part?.id || part?._id || '').trim();
      try {
        helperService.validateObjectId(rawPartId);
      } catch {
        throw Object.assign(new Error(`Invalid part selection for "${part?.part_name || 'Unnamed Part'}". Please reselect the part and try again.`), { status: 400 });
      }
    }
  }

  private normalizeObjectIdArray(values: any): mongoose.Types.ObjectId[] {
    if (!Array.isArray(values)) {
      return [];
    }

    return values
      .map((value: any) => String(value || '').trim())
      .filter((value: string) => mongoose.Types.ObjectId.isValid(value))
      .map((value: string) => helperService.validateObjectId(value));
  }

  private hasExecutionOwnedFieldChanges(body: any): boolean {
    const executionOwnedFields = [
      'parts',
      'procedure_ids',
      'procedure_entries',
      'labor_entries',
      'actual_start_date',
      'actual_end_date',
      'actual_time'
    ];

    return executionOwnedFields.some((field: string) => Object.prototype.hasOwnProperty.call(body || {}, field));
  }

  private async getChildOrderCount(orderId: any, session?: any): Promise<number> {
    const objectId = helperService.validateObjectId(String(orderId));
    const query = WorkOrderModel.countDocuments({ parentId: objectId, visible: true });
    if (session) {
      query.session(session);
    }
    return query;
  }

  private async getParentOrderForInheritance(parentId: any, account_id: any, session?: any): Promise<any | null> {
    if (!parentId) {
      return null;
    }

    const query = WorkOrderModel.findOne({
      _id: helperService.validateObjectId(String(parentId)),
      account_id,
      visible: true
    }).lean();

    if (session) {
      query.session(session);
    }

    return query;
  }

  private async getAssignedUserIdsForWorkOrder(workOrderId: any, session?: any): Promise<string[]> {
    if (!workOrderId) {
      return [];
    }

    const query = WorkOrderAssigneeModel.find({ woId: helperService.validateObjectId(String(workOrderId)) }).select('userId').lean();
    if (session) {
      query.session(session);
    }

    const mappings = await query;
    return mappings
      .map((mapping: any) => String(mapping?.userId || '').trim())
      .filter(Boolean);
  }

  private applyParentInheritance(body: any, parentOrder: any, inheritedUserIds: string[] = []): { normalizedBody: any; userIdList: string[] } {
    const normalizedBody = { ...body };
    const assignIfMissing = (field: string, fallbackValue: any): void => {
      if (
        (normalizedBody[field] === undefined || normalizedBody[field] === null || normalizedBody[field] === '') &&
        fallbackValue !== undefined &&
        fallbackValue !== null &&
        fallbackValue !== ''
      ) {
        normalizedBody[field] = fallbackValue;
      }
    };

    assignIfMissing('priority', parentOrder?.priority);
    assignIfMissing('type', parentOrder?.type);
    assignIfMissing('nature_of_work', parentOrder?.nature_of_work || parentOrder?.type);
    assignIfMissing('description', parentOrder?.description);
    assignIfMissing('wo_location_id', parentOrder?.wo_location_id);
    assignIfMissing('wo_asset_id', parentOrder?.wo_asset_id);
    assignIfMissing('start_date', parentOrder?.start_date);
    assignIfMissing('end_date', parentOrder?.end_date);

    const userIdList = Array.isArray(body?.userIdList) && body.userIdList.length > 0
      ? body.userIdList.filter((userId: string) => !!userId)
      : inheritedUserIds;

    return {
      normalizedBody,
      userIdList
    };
  }

  private shouldInheritValue(value: any): boolean {
    return value === undefined
      || value === null
      || value === ''
      || (Array.isArray(value) && value.length === 0);
  }

  private buildChildStatusSummary(childOrders: any[] = []): any {
    const summary = {
      total: childOrders.length,
      open: 0,
      inProgress: 0,
      blocked: 0,
      onHold: 0,
      completed: 0,
      completionPercent: 0
    };

    childOrders.forEach((child: any) => {
      const status = String(child?.status || '').trim();
      if (status === 'Completed') {
        summary.completed += 1;
      } else if (status === 'In-Progress') {
        summary.inProgress += 1;
      } else if (status === 'On-Hold') {
        summary.onHold += 1;
      } else if (['Blocked', 'Waiting-on-Parts', 'Waiting-on-Permit'].includes(status)) {
        summary.blocked += 1;
      } else {
        summary.open += 1;
      }
    });

    summary.completionPercent = summary.total > 0
      ? Number(((summary.completed / summary.total) * 100).toFixed(1))
      : 0;

    return summary;
  }

  private buildChildLaborRollup(childOrders: any[] = []): any {
    let totalHours = 0;
    let entryCount = 0;
    const contributorSet = new Set<string>();

    childOrders.forEach((child: any) => {
      const entries = Array.isArray(child?.labor_entries) ? child.labor_entries : [];
      entryCount += entries.length;

      if (entries.length > 0) {
        entries.forEach((entry: any) => {
          const hours = Number(entry?.hours || 0);
          if (Number.isFinite(hours) && hours > 0) {
            totalHours += hours;
          }
          const contributorKey = String(entry?.user_id || entry?.vendor_name || '').trim();
          if (contributorKey) {
            contributorSet.add(contributorKey);
          }
        });
      } else {
        const actualHours = Number(child?.actual_time || 0);
        if (Number.isFinite(actualHours) && actualHours > 0) {
          totalHours += actualHours;
        }
      }
    });

    return {
      totalHours: Number(totalHours.toFixed(2)),
      entryCount,
      contributorCount: contributorSet.size
    };
  }

  private buildChildPartsRollup(childOrders: any[] = []): any {
    const rollup = {
      lineCount: 0,
      plannedQuantity: 0,
      reservedQuantity: 0,
      issuedQuantity: 0,
      returnedQuantity: 0,
      shortQuantity: 0,
      shortLineCount: 0
    };

    childOrders.forEach((child: any) => {
      const parts = Array.isArray(child?.parts) ? child.parts : [];
      rollup.lineCount += parts.length;

      parts.forEach((part: any) => {
        rollup.plannedQuantity += Number(part?.plannedQuantity ?? part?.estimatedQuantity ?? 0) || 0;
        rollup.reservedQuantity += Number(part?.reservedQuantity ?? 0) || 0;
        rollup.issuedQuantity += Number(part?.issuedQuantity ?? part?.actualQuantity ?? 0) || 0;
        rollup.returnedQuantity += Number(part?.returnedQuantity ?? 0) || 0;
        rollup.shortQuantity += Number(part?.shortQuantity ?? 0) || 0;
        if (Number(part?.shortQuantity ?? 0) > 0) {
          rollup.shortLineCount += 1;
        }
      });
    });

    return rollup;
  }

  private decorateHierarchy(order: any): any {
    const childOrders = Array.isArray(order?.childOrders) ? order.childOrders : [];
    const isParentWorkOrder = childOrders.length > 0;
    const isChildWorkOrder = !!order?.parentId;
    const childStatusSummary = this.buildChildStatusSummary(childOrders);
    const childLaborRollup = this.buildChildLaborRollup(childOrders);
    const childPartsRollup = this.buildChildPartsRollup(childOrders);

    return {
      ...order,
      hierarchy: {
        isParentWorkOrder,
        isChildWorkOrder,
        executionOwnedByChildren: isParentWorkOrder,
        childStatusSummary,
        childLaborRollup,
        childPartsRollup,
        childProgressLabel: isParentWorkOrder
          ? `${childStatusSummary.completed}/${childStatusSummary.total} complete`
          : '',
        parentReference: order?.parentOrder
          ? {
              _id: order.parentOrder._id,
              id: order.parentOrder.id || order.parentOrder._id,
              order_no: order.parentOrder.order_no,
              title: order.parentOrder.title,
              status: order.parentOrder.status
            }
          : null
      }
    };
  }

  private decorateHierarchyCollection(orders: any[] = []): any[] {
    return (orders || []).map((order: any) => this.decorateHierarchy(order));
  }

  private getWorkOrderPipeline(match: any): any[] {
    return [
      { $match: match },
      {
        $lookup: {
          from: WorkOrderAssigneeModel.collection.name,
          let: { woId: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$woId", "$$woId"] } } },
            {
              $lookup: {
                from: UserModel.collection.name,
                let: { userId: '$userId' },
                pipeline: [
                  { $match: { $expr: { $eq: ['$_id', '$$userId'] }, user_status: 'active' } },
                  { $project: this.userProjection },
                ],
                as: "user"
              }
            },
            { $unwind: { path: "$user", preserveNullAndEmptyArrays: false } }
          ],
          as: "assignedUsers"
        }
      },
      {
        $lookup: {
          from: WorkOrderModel.collection.name,
          let: { parentId: '$parentId' },
          pipeline: [
            {
              $match: {
                visible: true,
                $expr: {
                  $eq: [
                    '$_id',
                    { $cond: [{ $eq: [{ $type: '$$parentId' }, 'string'] }, { $toObjectId: '$$parentId' }, '$$parentId'] }
                  ]
                }
              }
            },
            {
              $project: {
                _id: 1,
                id: '$_id',
                order_no: 1,
                title: 1,
                status: 1,
                priority: 1,
                start_date: 1,
                end_date: 1,
                estimated_time: 1,
                actual_time: 1
              }
            }
          ],
          as: "parentOrder"
        }
      },
      {
        $lookup: {
          from: WorkOrderModel.collection.name,
          let: { workOrderId: '$_id' },
          pipeline: [
            {
              $match: {
                visible: true,
                $expr: { $eq: ['$parentId', '$$workOrderId'] }
              }
            },
            {
              $lookup: {
                from: WorkOrderAssigneeModel.collection.name,
                let: { childWoId: "$_id" },
                pipeline: [
                  { $match: { $expr: { $eq: ["$woId", "$$childWoId"] } } },
                  {
                    $lookup: {
                      from: UserModel.collection.name,
                      let: { userId: '$userId' },
                      pipeline: [
                        { $match: { $expr: { $eq: ['$_id', '$$userId'] }, user_status: 'active' } },
                        { $project: this.userProjection },
                      ],
                      as: "user"
                    }
                  },
                  { $unwind: { path: "$user", preserveNullAndEmptyArrays: false } }
                ],
                as: "assignedUsers"
              }
            },
            {
              $project: {
                _id: 1,
                id: '$_id',
                order_no: 1,
                title: 1,
                status: 1,
                priority: 1,
                start_date: 1,
                end_date: 1,
                estimated_time: 1,
                actual_time: 1,
                wo_asset_id: 1,
                wo_location_id: 1,
                parts: 1,
                labor_entries: 1,
                procedure_ids: 1,
                procedure_entries: 1,
                assignedUsers: 1
              }
            }
          ],
          as: "childOrders"
        }
      },
      {
        $lookup: {
          from: AssetModel.collection.name,
          let: { wo_asset_id: '$wo_asset_id' },
          pipeline: [
            { 
              $match: { 
                $expr: { 
                  $eq: [
                    '$_id', 
                    { $cond: [{ $eq: [{ $type: '$$wo_asset_id' }, 'string'] }, { $toObjectId: '$$wo_asset_id' }, '$$wo_asset_id'] }
                  ] 
                }, 
                visible: true 
              } 
            },
            { $project: { _id: 1, id: '$_id', asset_name: 1, asset_type: 1, asset_model: 1, top_level: 1, parent_id: 1, visible: 1 } },
          ],
          as: "asset"
        }
      },
      { $unwind: { path: "$asset", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: LocationModel.collection.name,
          let: { wo_location_id: '$wo_location_id' },
          pipeline: [
            { 
              $match: { 
                $expr: { 
                  $eq: [
                    '$_id', 
                    { $cond: [{ $eq: [{ $type: '$$wo_location_id' }, 'string'] }, { $toObjectId: '$$wo_location_id' }, '$$wo_location_id'] }
                  ] 
                }, 
                visible: true 
              } 
            },
            { $project: { _id: 1, id: '$_id', location_name: 1, location_type: 1, top_level: 1, parent_id: 1, visible: 1 } },
          ],
          as: "location"
        }
      },
      { $unwind: { path: "$location", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: SOPsModel.collection.name,
          let: { sop_form_id: '$sop_form_id' },
          pipeline: [
            { 
              $match: { 
                $expr: { 
                  $eq: [
                    '$_id', 
                    { $cond: [{ $eq: [{ $type: '$$sop_form_id' }, 'string'] }, { $toObjectId: '$$sop_form_id' }, '$$sop_form_id'] }
                  ] 
                }, 
                visible: true 
              } 
            },
            { $project: { _id: 1, id: '$_id', name: 1, description: 1, json_temp: 1, visible: 1 } },
          ],
          as: "sopForm"
        }
      },
      { $unwind: { path: "$sopForm", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: ProcedureModel.collection.name,
          let: { procedureIds: "$procedure_ids" },
          pipeline: [
            {
              $match: {
                visible: true,
                $expr: {
                  $in: [
                    { $toString: "$_id" },
                    {
                      $map: {
                        input: { $ifNull: ["$$procedureIds", []] },
                        as: "id",
                        in: { $toString: "$$id" }
                      }
                    }
                  ]
                }
              }
            },
            {
              $project: {
                _id: 1,
                id: "$_id",
                name: 1,
                category: 1,
                tags: 1,
                description: 1,
                steps: 1,
                createdAt: 1,
                updatedAt: 1
              }
            }
          ],
          as: "procedures"
        }
      },
      {
        $lookup: {
          from: UserModel.collection.name,
          let: { createdBy: '$createdBy' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$createdBy'] }, user_status: 'active' } },
            { $project: this.userProjection },
          ],
          as: "createdBy"
        }
      },
      { $unwind: { path: "$createdBy", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: UserModel.collection.name,
          let: { updatedBy: '$updatedBy' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$updatedBy'] }, user_status: 'active' } },
            { $project: this.userProjection },
          ],
          as: "updatedBy"
        }
      },
      { $unwind: { path: "$updatedBy", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: UserModel.collection.name,
          let: { createdBy: '$status_details.createdBy' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$createdBy'] }, user_status: 'active' } },
            { $project: this.userProjection },
          ],
          as: "statusUsers"
        }
      },
      {
        $lookup: {
          from: UserModel.collection.name,
          let: { userIds: "$tasks.assigned_user_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $in: [
                    { $toString: "$_id" },
                    {
                      $map: {
                        input: { $ifNull: ["$$userIds", []] },
                        as: "id",
                        in: { $toString: { $ifNull: ["$$id", ""] } }
                      }
                    }
                  ]
                }
              }
            }
          ],
          as: "taskUsers"
        }
      },
      {
        $lookup: {
          from: UserModel.collection.name,
          let: { userIds: "$labor_entries.user_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $in: [
                    { $toString: "$_id" },
                    {
                      $map: {
                        input: { $ifNull: ["$$userIds", []] },
                        as: "id",
                        in: { $toString: { $ifNull: ["$$id", ""] } }
                      }
                    }
                  ]
                }
              }
            }
          ],
          as: "laborUsers"
        }
      },
      {
        $lookup: {
          from: PartsTypeModel.collection.name,
          let: { partTypeIds: "$parts.part_type" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $in: [
                    { $toString: "$_id" },
                    {
                      $map: {
                        input: { $ifNull: ["$$partTypeIds", []] },
                        as: "id",
                        in: { $toString: "$$id" }
                      }
                    }
                  ]
                }
              }
            },
            { $project: { _id: 1, name: 1, description: 1, visible: 1 } }
          ],
          as: "partTypeDetails"
        }
      },
      {
        $lookup: {
          from: PartsModel.collection.name,
          let: { partIds: "$parts.part_id" },
          pipeline: [
            {
              $match: {
                visible: true,
                $expr: {
                  $in: [
                    { $toString: "$_id" },
                    {
                      $map: {
                        input: { $ifNull: ["$$partIds", []] },
                        as: "id",
                        in: { $toString: "$$id" }
                      }
                    }
                  ]
                }
              }
            },
            {
              $project: {
                _id: 1,
                id: "$_id",
                part_name: 1,
                part_number: 1,
                quantity: 1,
                min_quantity: 1,
                unit: 1,
                cost: 1,
                currency: 1,
                location_id: 1
              }
            }
          ],
          as: "inventoryPartDetails"
        }
      },
      {
        $lookup: {
          from: InventoryMovementModel.collection.name,
          let: { workOrderId: "$_id" },
          pipeline: [
            {
              $match: {
                visible: true,
                $expr: { $eq: ["$work_order_id", "$$workOrderId"] }
              }
            },
            { $sort: { createdAt: -1 } },
            {
              $project: {
                _id: 1,
                id: "$_id",
                part_id: 1,
                part_name: 1,
                work_order_id: 1,
                work_order_no: 1,
                location_id: 1,
                movement_type: 1,
                quantity: 1,
                stock_before: 1,
                stock_after: 1,
                note: 1,
                createdBy: 1,
                createdByName: 1,
                createdAt: 1
              }
            }
          ],
          as: "partMovements"
        }
      },
      {
        $addFields: {
          id: "$_id",
          parentOrder: { $arrayElemAt: ["$parentOrder", 0] },
          childCount: { $size: { $ifNull: ["$childOrders", []] } },
          procedures: {
            $cond: [
              { $gt: [{ $size: { $ifNull: ["$procedure_entries", []] } }, 0] },
              {
                $map: {
                  input: { $ifNull: ["$procedure_entries", []] },
                  as: "entry",
                  in: {
                    $mergeObjects: [
                      "$$entry",
                      {
                        id: {
                          $toString: {
                            $ifNull: ["$$entry.procedure_id", ""]
                          }
                        }
                      }
                    ]
                  }
                }
              },
              "$procedures"
            ]
          },
          durationVariance: {
            $cond: [
              {
                $and: [
                  { $gt: [{ $ifNull: ["$estimated_time", 0] }, 0] },
                  { $gt: [{ $ifNull: ["$actual_time", 0] }, 0] }
                ]
              },
              { $subtract: ["$actual_time", "$estimated_time"] },
              null
            ]
          },
          parts: {
            $map: {
              input: { $ifNull: ["$parts", []] },
              as: "part",
              in: {
                $mergeObjects: [
                  "$$part",
                  {
                    partTypeData: {
                      $let: {
                        vars: {
                          found: {
                            $arrayElemAt: [
                              {
                                $filter: {
                                  input: "$partTypeDetails",
                                  as: "pt",
                                  cond: { $eq: [{ $toString: "$$pt._id" }, { $toString: "$$part.part_type" }] }
                                }
                              },
                              0
                            ]
                          }
                        },
                        in: {
                          $cond: [
                            { $gt: ["$$found", null] },
                            "$$found",
                            { 
                              id: '', 
                              name: { 
                                $cond: [
                                  { 
                                    $and: [
                                      { $eq: [{ $type: "$$part.part_type" }, "string"] },
                                      { $lt: [{ $strLenCP: "$$part.part_type" }, 24] } // Simple check: if it's 24 chars, it's likely an ID, don't use as name
                                    ] 
                                  }, 
                                  "$$part.part_type", 
                                  ""
                                ] 
                              }, 
                              description: '', 
                              visible: true 
                            }
                          ]
                        }
                      }
                    },
                    inventoryData: {
                      $let: {
                        vars: {
                          inventoryPart: {
                            $arrayElemAt: [
                              {
                                $filter: {
                                  input: "$inventoryPartDetails",
                                  as: "inv",
                                  cond: { $eq: [{ $toString: "$$inv._id" }, { $toString: "$$part.part_id" }] }
                                }
                              },
                              0
                            ]
                          }
                        },
                        in: {
                          $cond: [
                            { $gt: ["$$inventoryPart", null] },
                            "$$inventoryPart",
                            null
                          ]
                        }
                      }
                    },
                    plannedQuantity: { $ifNull: ["$$part.plannedQuantity", { $ifNull: ["$$part.estimatedQuantity", 0] }] },
                    reservedQuantity: {
                      $cond: [
                        { $eq: ["$status", "Completed"] },
                        0,
                        { $ifNull: ["$$part.reservedQuantity", { $ifNull: ["$$part.estimatedQuantity", 0] }] }
                      ]
                    },
                    issuedQuantity: {
                      $cond: [
                        { $eq: ["$status", "Completed"] },
                        {
                          $ifNull: [
                            "$$part.issuedQuantity",
                            { $ifNull: ["$$part.actualQuantity", { $ifNull: ["$$part.estimatedQuantity", 0] }] }
                          ]
                        },
                        0
                      ]
                    },
                    returnedQuantity: {
                      $cond: [
                        { $eq: ["$status", "Completed"] },
                        {
                          $ifNull: [
                            "$$part.returnedQuantity",
                            {
                              $max: [
                                {
                                  $subtract: [
                                    { $ifNull: ["$$part.estimatedQuantity", 0] },
                                    { $ifNull: ["$$part.actualQuantity", { $ifNull: ["$$part.estimatedQuantity", 0] }] }
                                  ]
                                },
                                0
                              ]
                            }
                          ]
                        },
                        0
                      ]
                    },
                    shortQuantity: {
                      $ifNull: [
                        "$$part.shortQuantity",
                        {
                          $cond: [
                            { $eq: ["$status", "Waiting-on-Parts"] },
                            { $ifNull: ["$$part.estimatedQuantity", 0] },
                            0
                          ]
                        }
                      ]
                    },
                    remainingQuantity: {
                      $let: {
                        vars: {
                          inventoryPart: {
                            $arrayElemAt: [
                              {
                                $filter: {
                                  input: "$inventoryPartDetails",
                                  as: "inv",
                                  cond: { $eq: [{ $toString: "$$inv._id" }, { $toString: "$$part.part_id" }] }
                                }
                              },
                              0
                            ]
                          }
                        },
                        in: "$$inventoryPart.quantity"
                      }
                    },
                    reservationStatus: {
                      $cond: [
                        { $or: [{ $eq: ["$status", "Waiting-on-Parts"] }, { $eq: ["$status", "Blocked"] }] },
                        "Short",
                        {
                          $cond: [
                            { $eq: ["$status", "Completed"] },
                            {
                              $cond: [
                                {
                                  $gt: [
                                    {
                                      $ifNull: [
                                        "$$part.returnedQuantity",
                                        {
                                          $max: [
                                            {
                                              $subtract: [
                                                { $ifNull: ["$$part.estimatedQuantity", 0] },
                                                { $ifNull: ["$$part.actualQuantity", { $ifNull: ["$$part.estimatedQuantity", 0] }] }
                                              ]
                                            },
                                            0
                                          ]
                                        }
                                      ]
                                    },
                                    0
                                  ]
                                },
                                "Issued / Returned",
                                "Issued"
                              ]
                            },
                            {
                              $cond: [
                                { $gt: [{ $ifNull: ["$$part.estimatedQuantity", 0] }, 0] },
                                "Reserved",
                                "Planned"
                              ]
                            }
                          ]
                        }
                      ]
                    },
                    lifecycleStatus: {
                      $cond: [
                        {
                          $or: [
                            { $eq: ["$status", "Waiting-on-Parts"] },
                            { $eq: [{ $ifNull: ["$$part.lifecycle_status", ""] }, "short"] }
                          ]
                        },
                        "short",
                        {
                          $cond: [
                            { $eq: ["$status", "Completed"] },
                            {
                              $cond: [
                                {
                                  $and: [
                                    {
                                      $gt: [
                                        {
                                          $ifNull: [
                                            "$$part.returnedQuantity",
                                            {
                                              $max: [
                                                {
                                                  $subtract: [
                                                    { $ifNull: ["$$part.estimatedQuantity", 0] },
                                                    { $ifNull: ["$$part.actualQuantity", { $ifNull: ["$$part.estimatedQuantity", 0] }] }
                                                  ]
                                                },
                                                0
                                              ]
                                            }
                                          ]
                                        },
                                        0
                                      ]
                                    },
                                    {
                                      $lte: [
                                        { $ifNull: ["$$part.actualQuantity", 0] },
                                        0
                                      ]
                                    }
                                  ]
                                },
                                "returned",
                                "issued"
                              ]
                            },
                            {
                              $cond: [
                                { $gt: [{ $ifNull: ["$$part.estimatedQuantity", 0] }, 0] },
                                "reserved",
                                "planned"
                              ]
                            }
                          ]
                        }
                      ]
                    },
                    availabilityStatus: {
                      $let: {
                        vars: {
                          inventoryPart: {
                            $arrayElemAt: [
                              {
                                $filter: {
                                  input: "$inventoryPartDetails",
                                  as: "inv",
                                  cond: { $eq: [{ $toString: "$$inv._id" }, { $toString: "$$part.part_id" }] }
                                }
                              },
                              0
                            ]
                          }
                        },
                        in: {
                          $cond: [
                            { $not: ["$$inventoryPart"] },
                            "Missing",
                            {
                              $cond: [
                                { $lte: ["$$inventoryPart.quantity", 0] },
                                "Out of Stock",
                                {
                                  $cond: [
                                    { $lte: ["$$inventoryPart.quantity", "$$inventoryPart.min_quantity"] },
                                    "Low Stock",
                                    "Available"
                                  ]
                                }
                              ]
                            }
                          ]
                        }
                      }
                    }
                  }
                ]
              }
            }
          },
          tasks: {
            $map: {
              input: { $ifNull: ["$tasks", []] },
              as: "task",
              in: {
                $mergeObjects: [
                  "$$task",
                  {
                    assignedUser: {
                      $let: {
                        vars: {
                          matchedUser: {
                            $arrayElemAt: [
                              {
                                $filter: {
                                  input: "$taskUsers",
                                  as: "u",
                                  cond: {
                                    $eq: [
                                      { $toString: "$$u._id" },
                                      { $toString: { $ifNull: ["$$task.assigned_user_id", ""] } }
                                    ]
                                  }
                                }
                              },
                              0
                            ]
                          }
                        },
                        in: {
                          $cond: [
                            { $gt: ["$$matchedUser", null] },
                            {
                              _id: "$$matchedUser._id",
                              id: "$$matchedUser._id",
                              firstName: "$$matchedUser.firstName",
                              lastName: "$$matchedUser.lastName",
                              email: "$$matchedUser.email",
                              username: "$$matchedUser.username",
                              user_profile_img: "$$matchedUser.user_profile_img",
                              user_role: "$$matchedUser.user_role",
                              user_status: "$$matchedUser.user_status"
                            },
                            null
                          ]
                        }
                      }
                    }
                  }
                ]
              }
            }
          },
          labor_entries: {
            $map: {
              input: { $ifNull: ["$labor_entries", []] },
              as: "entry",
              in: {
                $mergeObjects: [
                  "$$entry",
                  {
                    user: {
                      $let: {
                        vars: {
                          matchedUser: {
                            $arrayElemAt: [
                              {
                                $filter: {
                                  input: "$laborUsers",
                                  as: "u",
                                  cond: {
                                    $eq: [
                                      { $toString: "$$u._id" },
                                      { $toString: { $ifNull: ["$$entry.user_id", ""] } }
                                    ]
                                  }
                                }
                              },
                              0
                            ]
                          }
                        },
                        in: {
                          $cond: [
                            { $gt: ["$$matchedUser", null] },
                            {
                              _id: "$$matchedUser._id",
                              id: "$$matchedUser._id",
                              firstName: "$$matchedUser.firstName",
                              lastName: "$$matchedUser.lastName",
                              email: "$$matchedUser.email",
                              username: "$$matchedUser.username",
                              user_profile_img: "$$matchedUser.user_profile_img",
                              user_role: "$$matchedUser.user_role",
                              user_status: "$$matchedUser.user_status"
                            },
                            null
                          ]
                        }
                      }
                    }
                  }
                ]
              }
            }
          },
          status_details: {
            $map: {
              input: "$status_details",
              as: "status",
              in: {
                status: "$$status.status",
                createdAt: "$$status.createdAt",
                createdBy: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: "$statusUsers",
                        as: "u",
                        cond: { $eq: ["$$u._id", "$$status.createdBy"] }
                      }
                    },
                    0
                  ]
                }
              }
            }
          }
        }
      },
      { $project: { statusUsers: 0, taskUsers: 0, laborUsers: 0, inventoryPartDetails: 0 } }
    ];
  }

  private getWorkOrderListLookupStages(): any[] {
    return [
      {
        $lookup: {
          from: WorkOrderAssigneeModel.collection.name,
          let: { woId: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$woId', '$$woId'] } } },
            {
              $lookup: {
                from: UserModel.collection.name,
                let: { userId: '$userId' },
                pipeline: [
                  { $match: { $expr: { $eq: ['$_id', '$$userId'] }, user_status: 'active' } },
                  { $project: this.userProjection }
                ],
                as: 'user'
              }
            },
            { $unwind: { path: '$user', preserveNullAndEmptyArrays: false } }
          ],
          as: 'assignedUsers'
        }
      },
      {
        $lookup: {
          from: WorkOrderModel.collection.name,
          let: { parentId: '$parentId' },
          pipeline: [
            {
              $match: {
                visible: true,
                $expr: {
                  $eq: [
                    '$_id',
                    { $cond: [{ $eq: [{ $type: '$$parentId' }, 'string'] }, { $toObjectId: '$$parentId' }, '$$parentId'] }
                  ]
                }
              }
            },
            {
              $project: {
                _id: 1,
                id: '$_id',
                order_no: 1,
                title: 1,
                status: 1
              }
            }
          ],
          as: 'parentOrder'
        }
      },
      {
        $lookup: {
          from: WorkOrderModel.collection.name,
          let: { workOrderId: '$_id' },
          pipeline: [
            {
              $match: {
                visible: true,
                $expr: { $eq: ['$parentId', '$$workOrderId'] }
              }
            },
            {
              $project: {
                _id: 1,
                id: '$_id',
                order_no: 1,
                title: 1,
                status: 1,
                priority: 1,
                actual_time: 1,
                labor_entries: 1,
                parts: 1
              }
            }
          ],
          as: 'childOrders'
        }
      },
      {
        $lookup: {
          from: AssetModel.collection.name,
          let: { wo_asset_id: '$wo_asset_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: [
                    '$_id',
                    { $cond: [{ $eq: [{ $type: '$$wo_asset_id' }, 'string'] }, { $toObjectId: '$$wo_asset_id' }, '$$wo_asset_id'] }
                  ]
                },
                visible: true
              }
            },
            { $project: { _id: 1, id: '$_id', asset_name: 1, asset_type: 1, asset_model: 1 } }
          ],
          as: 'asset'
        }
      },
      { $unwind: { path: '$asset', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: LocationModel.collection.name,
          let: { wo_location_id: '$wo_location_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: [
                    '$_id',
                    { $cond: [{ $eq: [{ $type: '$$wo_location_id' }, 'string'] }, { $toObjectId: '$$wo_location_id' }, '$$wo_location_id'] }
                  ]
                },
                visible: true
              }
            },
            { $project: { _id: 1, id: '$_id', location_name: 1, location_type: 1 } }
          ],
          as: 'location'
        }
      },
      { $unwind: { path: '$location', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: UserModel.collection.name,
          let: { createdBy: '$createdBy' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$createdBy'] }, user_status: 'active' } },
            { $project: this.userProjection }
          ],
          as: 'createdBy'
        }
      },
      { $unwind: { path: '$createdBy', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          id: '$_id',
          parentOrder: { $arrayElemAt: ['$parentOrder', 0] },
          procedures: {
            $cond: [
              { $gt: [{ $size: { $ifNull: ['$procedure_entries', []] } }, 0] },
              {
                $map: {
                  input: { $ifNull: ['$procedure_entries', []] },
                  as: 'entry',
                  in: {
                    $mergeObjects: [
                      '$$entry',
                      {
                        id: { $toString: { $ifNull: ['$$entry.procedure_id', ''] } },
                        procedure_id: { $toString: { $ifNull: ['$$entry.procedure_id', ''] } },
                        tags: { $ifNull: ['$$entry.tags', []] },
                        steps: { $ifNull: ['$$entry.steps', []] },
                        responses: { $ifNull: ['$$entry.responses', {}] },
                        score_summary: { $ifNull: ['$$entry.score_summary', null] },
                        triggered_actions: { $ifNull: ['$$entry.triggered_actions', []] },
                        submitted: { $ifNull: ['$$entry.submitted', false] }
                      }
                    ]
                  }
                }
              },
              {
                $map: {
                  input: { $ifNull: ['$procedure_ids', []] },
                  as: 'procedureId',
                  in: {
                    id: { $toString: '$$procedureId' },
                    procedure_id: { $toString: '$$procedureId' },
                    tags: [],
                    steps: [],
                    responses: {},
                    score_summary: null,
                    triggered_actions: [],
                    submitted: false
                  }
                }
              }
            ]
          }
        }
      },
      {
        $project: {
          _id: 1,
          id: 1,
          order_no: 1,
          title: 1,
          description: 1,
          status: 1,
          priority: 1,
          type: 1,
          nature_of_work: 1,
          createdFrom: 1,
          block_reason: 1,
          start_date: 1,
          end_date: 1,
          estimated_time: 1,
          actual_time: 1,
          createdAt: 1,
          updatedAt: 1,
          completed_at: 1,
          actual_end_date: 1,
          parentId: 1,
          wo_asset_id: 1,
          wo_location_id: 1,
          asset: 1,
          location: 1,
          assignedUsers: 1,
          createdBy: 1,
          parts: 1,
          procedures: 1,
          childOrders: 1,
          parentOrder: 1
        }
      }
    ];
  }

  async getAllOrders(match: any, session?: any): Promise<any> {
    const pipeline = this.getWorkOrderPipeline(match);
    const aggregateQuery = WorkOrderModel.aggregate(pipeline);
    if (session) {
      aggregateQuery.session(session);
    }
    const data = await aggregateQuery;

    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }

    const orderIds = data.map((d: any) => d._id);
    const commentMap = await commentService.getCommentsByOrderIds(orderIds);

    const result = [];
    for (const item of data) {
      item.comments = commentMap.get(String(item._id)) || [];
      result.push(item);
    }
    return this.decorateHierarchyCollection(result);
  };

  async buildSearchMatch(params: WorkOrderSearchParams): Promise<any> {
    const { account_id, user_id, user_role, query } = params;
    const match: any = { account_id, visible: true };
    const userObjectId = helperService.validateObjectId(String(user_id));
    const assetIds = this.getQueryValues(query.wo_asset_id || query.asset_id || query.assetIds);
    const locationIds = this.getQueryValues(query.wo_location_id || query.location_id);
    const createdFromValues = this.getQueryValues(query.createdFrom);

    if (query.status) match.status = { $in: query.status.toString().split(',') };
    if (query.priority) match.priority = { $in: query.priority.toString().split(',') };
    if (assetIds.length > 0) match.wo_asset_id = { $in: helperService.validateObjectIds(assetIds.join(',')) };
    if (locationIds.length > 0) match.wo_location_id = { $in: helperService.validateObjectIds(locationIds.join(',')) };
    if (query.order_no) match.order_no = query.order_no;
    if (createdFromValues.length > 0) match.createdFrom = { $in: createdFromValues };

    if (query.fromDate && query.toDate) {
      match.createdAt = { $gte: new Date(query.fromDate), $lte: new Date(query.toDate) };
    }

    if (query.assignedUser) {
      const assignedIds = helperService.validateObjectIds(query.assignedUser.toString());
      const workOrderIdArrays = await Promise.all(assignedIds.map(uid => userWorkOrderService.getMappedWorkOrderIDs(uid)));
      match._id = { $in: workOrderIdArrays.flat() };
    }

    // Role and PageType Logic
    if (query.pageTYPE) {
      switch (query.pageTYPE) {
        case "assignedToMe": {
          const ids = await userWorkOrderService.getMappedWorkOrderIDs(user_id);
          match._id = { $in: ids || [] };
          break;
        }
        case "createdByMe": {
          match.createdBy = userObjectId;
          break;
        }
        case "openToAll": {
          match.createdBy = { $ne: userObjectId };
          if (!query.status) {
            match.status = { $in: ["Open", "Blocked", "Waiting-on-Parts", "Waiting-on-Permit", "In-Progress", "On-Hold"] };
          }
          const ids = await userWorkOrderService.getMappedWorkOrderIDs(user_id);
          if (ids?.length) match._id = { $nin: ids };
          break;
        }
      }
    } else if (user_role !== 'admin') {
      const userWorkOrderIdList = await userWorkOrderService.getMappedWorkOrderIDs(user_id);
      if (!userWorkOrderIdList || userWorkOrderIdList.length === 0) {
        match.createdBy = userObjectId;
      } else {
        match.$or = [{ _id: { $in: userWorkOrderIdList } }, { createdBy: userObjectId }];
      }
    }

    return match;
  }

  private buildBaseQueryStages(query: WorkOrderSearchParams['query'] = {}): any[] {
    const stages: any[] = [];

    if (query.dashboardFilter === 'overdue') {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      stages.push({
        $match: {
          status: { $nin: ['Completed', 'Approved', 'Rejected'] },
          end_date: { $lt: startOfToday }
        }
      });
    }

    if (query.dashboardFilter === 'onTime') {
      stages.push({
        $match: {
          status: 'Completed',
          end_date: { $ne: null },
          $expr: {
            $lte: [
              {
                $ifNull: [
                  '$completed_at',
                  {
                    $ifNull: [
                      '$actual_end_date',
                      '$updatedAt'
                    ]
                  }
                ]
              },
              '$end_date'
            ]
          }
        }
      });
    }

    if (query.dashboardFilter === 'plannedUnplanned' && !query.createdFrom) {
      stages.push({
        $match: {
          createdFrom: { $in: ['Work Order', 'Preventive'] }
        }
      });
    }

    return stages;
  }

  private buildPostLookupQueryStages(query: WorkOrderSearchParams['query'] = {}): any[] {
    const stages: any[] = [];
    const searchValue = String(query.searchText || query.search || '').trim();

    if (searchValue) {
      const searchRegex = this.escapeRegex(searchValue);
      stages.push({
        $match: {
          $or: [
            { order_no: { $regex: searchRegex, $options: 'i' } },
            { title: { $regex: searchRegex, $options: 'i' } },
            { description: { $regex: searchRegex, $options: 'i' } },
            { 'location.location_name': { $regex: searchRegex, $options: 'i' } },
            { 'asset.asset_name': { $regex: searchRegex, $options: 'i' } },
            { 'createdBy.firstName': { $regex: searchRegex, $options: 'i' } },
            { 'createdBy.lastName': { $regex: searchRegex, $options: 'i' } },
            {
              $expr: {
                $regexMatch: {
                  input: {
                    $trim: {
                      input: {
                        $concat: [
                          { $ifNull: ['$createdBy.firstName', ''] },
                          ' ',
                          { $ifNull: ['$createdBy.lastName', ''] }
                        ]
                      }
                    }
                  },
                  regex: searchRegex,
                  options: 'i'
                }
              }
            }
          ]
        }
      });
    }

    return stages;
  }

  private buildFilteredWorkOrderPipeline(match: any, query: WorkOrderSearchParams['query'] = {}): any[] {
    const pipeline = [{ $match: match }, ...this.buildBaseQueryStages(query), ...this.getWorkOrderListLookupStages()];
    const postLookupStages = this.buildPostLookupQueryStages(query);

    if (postLookupStages.length > 0) {
      pipeline.push(...postLookupStages);
    }

    return pipeline;
  }

  async countOrders(match: any, query: WorkOrderSearchParams['query'] = {}) {
    const searchValue = String(query.searchText || query.search || '').trim();
    const pipeline = searchValue
      ? this.buildFilteredWorkOrderPipeline(match, query)
      : [{ $match: match }, ...this.buildBaseQueryStages(query)];

    pipeline.push({ $count: 'totalItems' });

    const [result] = await WorkOrderModel.aggregate(pipeline);
    return Number(result?.totalItems || 0);
  }

  async getPaginatedWorkOrders(match: any, query: WorkOrderSearchParams['query'] = {}, skip: number = 0, limit: number = 25): Promise<{ data: any[]; totalItems: number }> {
    const searchValue = String(query.searchText || query.search || '').trim();
    const totalItems = await this.countOrders(match, query);
    if (!totalItems) {
      return { data: [], totalItems: 0 };
    }

    const pipeline: any[] = [{ $match: match }, ...this.buildBaseQueryStages(query)];

    if (searchValue) {
      pipeline.push(...this.getWorkOrderListLookupStages());
      const postLookupStages = this.buildPostLookupQueryStages(query);
      if (postLookupStages.length > 0) {
        pipeline.push(...postLookupStages);
      }
      pipeline.push({ $sort: { createdAt: -1 } });
      pipeline.push({ $skip: skip });
      pipeline.push({ $limit: limit });
    } else {
      pipeline.push({ $sort: { createdAt: -1 } });
      pipeline.push({ $skip: skip });
      pipeline.push({ $limit: limit });
      pipeline.push(...this.getWorkOrderListLookupStages());
    }

    const data = await WorkOrderModel.aggregate(pipeline);

    if (!data.length) {
      return { data: [], totalItems };
    }

    const orderIds = data.map((d: any) => d._id);
    const commentMap = await commentService.getCommentsByOrderIds(orderIds);
    const decorated = data.map((item: any) => ({
      ...item,
      comments: commentMap.get(String(item._id)) || []
    }));

    return {
      data: this.decorateHierarchyCollection(decorated),
      totalItems
    };
  }

  private normalizeDateRange(range: { fromDate?: string; toDate?: string } = {}): { fromDate: Date; toDate: Date } | null {
    if (!range?.fromDate || !range?.toDate) {
      return null;
    }

    const fromDate = new Date(range.fromDate);
    const toDate = new Date(range.toDate);
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      return null;
    }

    return { fromDate, toDate };
  }

  private getCompletionDateExpression(): any {
    return {
      $let: {
        vars: {
          completedEntries: {
            $filter: {
              input: "$status_details",
              as: "statusEntry",
              cond: { $eq: ["$$statusEntry.status", "Completed"] }
            }
          }
        },
        in: {
          $ifNull: [
            "$completed_at",
            {
              $ifNull: [
                "$actual_end_date",
                {
                  $ifNull: [
                    {
                      $arrayElemAt: [
                        {
                          $map: {
                            input: "$$completedEntries",
                            as: "completedEntry",
                            in: "$$completedEntry.createdAt"
                          }
                        },
                        -1
                      ]
                    },
                    "$updatedAt"
                  ]
                }
              ]
            }
          ]
        }
      }
    };
  }

  private getRangeBucketConfig(range: { fromDate: Date; toDate: Date }): { format: string; label: string } {
    const diffInMs = Math.max(range.toDate.getTime() - range.fromDate.getTime(), 0);
    const diffInDays = Math.ceil(diffInMs / 86400000);

    if (diffInDays > 120) {
      return { format: "%Y-%m", label: "month" };
    }

    return { format: "%Y-%m-%d", label: "day" };
  }

  private parseReportDate(value: any): Date | null {
    if (!value) {
      return null;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private isBlockedLikeStatus(status: string = ''): boolean {
    return ['Blocked', 'Waiting-on-Parts', 'Waiting-on-Permit', 'On-Hold'].includes(String(status || '').trim());
  }

  private getAssignedUserCount(order: any): number {
    if (!Array.isArray(order?.assignedUsers)) {
      return 0;
    }

    return order.assignedUsers.filter((entry: any) => !!entry?.user?._id || !!entry?.user?.id).length;
  }

  private getPartLifecycleState(part: any): string {
    if (String(part?.lifecycleStatus || '').trim()) {
      return String(part.lifecycleStatus).trim();
    }

    if (String(part?.lifecycle_status || '').trim()) {
      return String(part.lifecycle_status).trim();
    }

    const status = String(part?.reservationStatus || '').trim();
    if (status === 'Short') {
      return 'short';
    }
    if (status === 'Issued / Returned' || status === 'Returned') {
      return 'returned';
    }
    if (status === 'Issued') {
      return 'issued';
    }
    if (status === 'Reserved') {
      return 'reserved';
    }
    return 'planned';
  }

  private isProcedureReadyForExecution(order: any): boolean {
    const procedures = Array.isArray(order?.procedures) ? order.procedures : [];
    if (!procedures.length) {
      return false;
    }

    const incompleteProcedures = procedures.filter((procedure: any) => !procedure?.submitted);
    return incompleteProcedures.length === 0;
  }

  private isPartsReadyForExecution(order: any): boolean {
    const parts = Array.isArray(order?.parts) ? order.parts : [];
    const status = String(order?.status || '').trim();

    if (status === 'Waiting-on-Parts') {
      return false;
    }

    const invalidParts = parts.filter((part: any) => !part?.part_id || !(Number(part?.estimatedQuantity) > 0));
    if (invalidParts.length > 0) {
      return false;
    }

    const blockedAvailability = parts.filter((part: any) => ['Missing', 'Out of Stock'].includes(String(part?.availabilityStatus || '').trim()));
    const shortLifecycleParts = parts.filter((part: any) => this.getPartLifecycleState(part) === 'short');
    if (blockedAvailability.length > 0 || shortLifecycleParts.length > 0) {
      return false;
    }

    return true;
  }

  private isScheduleReadyForExecution(order: any): boolean {
    const startDate = this.parseReportDate(order?.start_date);
    const dueDate = this.parseReportDate(order?.end_date);
    const status = String(order?.status || '').trim();
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    if (status === 'Waiting-on-Permit' || status === 'Blocked' || status === 'On-Hold') {
      return false;
    }

    if (!startDate || !dueDate) {
      return false;
    }

    if (dueDate.getTime() < startDate.getTime()) {
      return false;
    }

    if (status !== 'Completed' && dueDate.getTime() < startOfToday.getTime()) {
      return false;
    }

    return true;
  }

  private isExecutionReadyOrder(order: any): boolean {
    const status = String(order?.status || '').trim();
    if (status === 'Completed' || this.isBlockedLikeStatus(status)) {
      return false;
    }

    return this.getAssignedUserCount(order) > 0
      && this.isScheduleReadyForExecution(order)
      && this.isPartsReadyForExecution(order)
      && this.isProcedureReadyForExecution(order);
  }

  private isOpenOrder(order: any): boolean {
    return String(order?.status || '').trim() !== 'Completed';
  }

  private isOrderWithinActiveExecutionRange(order: any, range: { fromDate: Date; toDate: Date }): boolean {
    const dueDate = this.parseReportDate(order?.end_date);
    const startDate = this.parseReportDate(order?.start_date);
    const createdAt = this.parseReportDate(order?.createdAt);

    if (dueDate && dueDate >= range.fromDate && dueDate <= range.toDate) {
      return true;
    }

    if (startDate && startDate >= range.fromDate && startDate <= range.toDate) {
      return true;
    }

    if (!startDate && !dueDate && createdAt && createdAt >= range.fromDate && createdAt <= range.toDate) {
      return true;
    }

    return false;
  }

  private getActualCompletionHours(order: any): number | null {
    const actualStartDate = this.parseReportDate(order?.actual_start_date);
    const actualEndDate = this.parseReportDate(order?.actual_end_date);

    if (!actualStartDate || !actualEndDate) {
      return null;
    }

    const diff = actualEndDate.getTime() - actualStartDate.getTime();
    if (diff < 0) {
      return null;
    }

    return Number((diff / 3600000).toFixed(2));
  }

  private hasSubmittedInspection(order: any): boolean {
    const procedures = Array.isArray(order?.procedure_entries) ? order.procedure_entries : [];
    return procedures.some((procedure: any) => Boolean(procedure?.submitted));
  }

  private getCompletedStatusEntry(order: any): any | null {
    const entries = Array.isArray(order?.status_details) ? order.status_details : [];
    return [...entries].reverse().find((entry: any) => String(entry?.status || '').trim() === 'Completed') || null;
  }

  private getPartsSpend(order: any): number {
    const parts = Array.isArray(order?.parts) ? order.parts : [];
    return parts.reduce((total: number, part: any) => {
      const unitCost = Number(part?.cost || 0) || 0;
      const quantity = Number(part?.actualQuantity ?? part?.plannedQuantity ?? part?.estimatedQuantity ?? 0) || 0;
      return total + (unitCost * quantity);
    }, 0);
  }

  private getPlannerBucketId(order: any): 'backlog' | 'assigned' | 'ready' | 'blocked' | 'overdue' {
    const status = String(order?.status || '').trim();

    if (!this.isOpenOrder(order)) {
      return 'ready';
    }

    const dueDate = this.parseReportDate(order?.end_date);
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (dueDate && dueDate.getTime() < startOfToday.getTime()) {
      return 'overdue';
    }

    if (this.getAssignedUserCount(order) === 0) {
      return 'backlog';
    }

    if (['Blocked', 'Waiting-on-Parts', 'Waiting-on-Permit', 'On-Hold'].includes(status)) {
      return 'blocked';
    }

    if (!this.isScheduleReadyForExecution(order)) {
      return 'assigned';
    }

    if (!this.isPartsReadyForExecution(order) || !this.isProcedureReadyForExecution(order)) {
      return 'blocked';
    }

    return this.isExecutionReadyOrder(order) ? 'ready' : 'assigned';
  }

  private isScheduleOverlappingRange(schedule: any, range: { fromDate: Date; toDate: Date }): boolean {
    const startDate = this.parseReportDate(schedule?.schedule?.start_date);
    const endDate = this.parseReportDate(schedule?.schedule?.end_date);

    if (!startDate) {
      return false;
    }

    if (endDate && endDate < range.fromDate) {
      return false;
    }

    return startDate <= range.toDate;
  }

  private async getExecutionScopedOrders(match: any): Promise<any[]> {
    const pipeline = this.getWorkOrderPipeline(match);
    const data = await WorkOrderModel.aggregate(pipeline);
    return this.decorateHierarchyCollection(data || []);
  }

  async getAllWorkOrders(match: any, query: WorkOrderSearchParams['query'] = {}, skip: number = 0, limit: number = 25) {
    const pipeline: any[] = this.buildFilteredWorkOrderPipeline(match, query);
    pipeline.push({ $sort: { createdAt: -1 } });
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: limit });

    const data = await WorkOrderModel.aggregate(pipeline);

    if (!data || data.length === 0) {
      return [];
    }

    const orderIds = data.map((d: any) => d._id);
    const commentMap = await commentService.getCommentsByOrderIds(orderIds);

    const result = [];
    for (const item of data) {
      item.comments = commentMap.get(String(item._id)) || [];
      result.push(item);
    }
    return this.decorateHierarchyCollection(result);
  }

  async orderStatus(match: any): Promise<any> {
    const data = await WorkOrderModel.aggregate([
      { $match: match },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $project: { _id: 0, key: '$_id', value: '$count' } }
    ]);
    if (data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const statuses = ['Open', 'Blocked', 'Waiting-on-Parts', 'Waiting-on-Permit', 'On-Hold', 'In-Progress', 'Completed'];
    const result = statuses.map((status) => {
      const found: any = data.find((d: any) => d.key === status);
      return { key: status, value: found ? found.value : 0 };
    });
    return result;
  };

  async orderPriority(match: any): Promise<any> {
    match.visible = true;
    const data: IWorkOrder[] = await WorkOrderModel.aggregate([
      { $match: match },
      { $group: { _id: '$priority', count: { $sum: 1 } } },
      { $project: { _id: 0, key: '$_id', value: '$count' } }
    ]);
    if (data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    let priorityLevels = ['Urgent', 'High', 'Medium', 'Low'];
    let result = priorityLevels.map((level: any) => {
      const found: any = data.find((d: any) => d.key === level);
      return { key: level, value: found ? found.value : 0 };
    });
    return result;
  };

  async monthlyCount(match: any): Promise<any> {
    match.visible = true;
    const data = await WorkOrderModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
          count: { $sum: 1 }
        }
      },
      { $project: { id: "$_id", count: 1, _id: 0 } },
      { $sort: { id: 1 } }
    ]);

    if (data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    return data;
  };

  async plannedUnplanned(match: any): Promise<any> {
    const data = await WorkOrderModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            createdFrom: { $ifNull: ["$createdFrom", "Work Order"] },
            monthYear: { $dateToString: { format: "%Y-%m", date: "$createdAt" } }
          },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          createdFrom: "$_id.createdFrom",
          monthYear: "$_id.monthYear",
          count: 1
        }
      },
      { $sort: { monthYear: 1 } }
    ]);

    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }

    const months = [...new Set(data.map(a => a.monthYear))].sort();
    const categories = ['Work Order', 'Preventive'];
    const final_result: any = { date: months };

    for (const cat of categories) {
      final_result[cat] = months.map(month => {
        const found = data.find(d => d.createdFrom === cat && d.monthYear === month);
        return found ? found.count : 0;
      });
    }

    return final_result;
  };

  async createdVsCompleted(match: any, rangeInput: { fromDate?: string; toDate?: string } = {}): Promise<any> {
    const range = this.normalizeDateRange(rangeInput);
    if (!range) {
      throw Object.assign(new Error('Valid fromDate and toDate are required'), { status: 400 });
    }

    const bucketConfig = this.getRangeBucketConfig(range);
    const completionDateExpr = this.getCompletionDateExpression();

    const [createdData, completedData] = await Promise.all([
      WorkOrderModel.aggregate([
        {
          $match: {
            ...match,
            createdAt: { $gte: range.fromDate, $lte: range.toDate }
          }
        },
        {
          $group: {
            _id: { $dateToString: { format: bucketConfig.format, date: "$createdAt" } },
            count: { $sum: 1 }
          }
        },
        { $project: { _id: 0, bucket: "$_id", count: 1 } },
        { $sort: { bucket: 1 } }
      ]),
      WorkOrderModel.aggregate([
        {
          $match: {
            ...match,
            status: "Completed"
          }
        },
        {
          $addFields: {
            completion_date: completionDateExpr
          }
        },
        {
          $match: {
            completion_date: { $gte: range.fromDate, $lte: range.toDate }
          }
        },
        {
          $group: {
            _id: { $dateToString: { format: bucketConfig.format, date: "$completion_date" } },
            count: { $sum: 1 }
          }
        },
        { $project: { _id: 0, bucket: "$_id", count: 1 } },
        { $sort: { bucket: 1 } }
      ])
    ]);

    const bucketMap = new Map<string, { created: number; completed: number }>();
    for (const item of createdData) {
      bucketMap.set(String(item.bucket), { created: Number(item.count || 0), completed: 0 });
    }
    for (const item of completedData) {
      const existing = bucketMap.get(String(item.bucket)) || { created: 0, completed: 0 };
      existing.completed = Number(item.count || 0);
      bucketMap.set(String(item.bucket), existing);
    }

    const buckets = Array.from(bucketMap.keys()).sort();
    if (!buckets.length) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }

    return {
      granularity: bucketConfig.label,
      date: buckets,
      created: buckets.map((bucket: string) => Number(bucketMap.get(bucket)?.created || 0)),
      completed: buckets.map((bucket: string) => Number(bucketMap.get(bucket)?.completed || 0))
    };
  }

  async overviewSummaryData(match: any, rangeInput: { fromDate?: string; toDate?: string } = {}): Promise<any> {
    const range = this.normalizeDateRange(rangeInput);
    if (!range) {
      throw Object.assign(new Error('Valid fromDate and toDate are required'), { status: 400 });
    }

    const completionDateExpr = this.getCompletionDateExpression();
    const [aggregationResults, executionMetrics, repeatingMetrics] = await Promise.all([
      WorkOrderModel.aggregate([
        { $match: match },
        {
          $addFields: {
            completion_date: completionDateExpr
          }
        },
        {
          $facet: {
            created: [
              {
                $match: {
                  createdAt: { $gte: range.fromDate, $lte: range.toDate }
                }
              },
              { $count: "count" }
            ],
            completed: [
              {
                $match: {
                  status: "Completed",
                  completion_date: { $gte: range.fromDate, $lte: range.toDate }
                }
              },
              { $count: "count" }
            ],
            completedOnTime: [
              {
                $match: {
                  status: "Completed",
                  completion_date: { $gte: range.fromDate, $lte: range.toDate },
                  end_date: { $exists: true, $ne: null },
                  $expr: { $lte: ["$completion_date", "$end_date"] }
                }
              },
              { $count: "count" }
            ],
            overdueOpen: [
              {
                $match: {
                  status: { $ne: "Completed" },
                  end_date: { $gte: range.fromDate, $lte: range.toDate, $lt: new Date() }
                }
              },
              { $count: "count" }
            ]
          }
        }
      ]),
      this.getOverviewExecutionMetrics(match, range),
      this.getOverviewRepeatingMetrics(match, range)
    ]);

    const result = aggregationResults[0] || {};
    const createdCount = Number(result.created?.[0]?.count || 0);
    const completedCount = Number(result.completed?.[0]?.count || 0);
    const completedOnTimeCount = Number(result.completedOnTime?.[0]?.count || 0);
    const overdueOpenCount = Number(result.overdueOpen?.[0]?.count || 0);
    const completionRate = completedCount ? (completedOnTimeCount / completedCount) * 100 : 0;

    return {
      created_count: createdCount,
      completed_count: completedCount,
      on_time_completion_rate: Number(completionRate.toFixed(2)),
      overdue_open_count: overdueOpenCount,
      completed_on_time_count: completedOnTimeCount,
      completed_late_count: Math.max(completedCount - completedOnTimeCount, 0),
      total_open_count: executionMetrics.total_open_count,
      ready_for_execution_count: executionMetrics.ready_for_execution_count,
      waiting_on_parts_count: executionMetrics.waiting_on_parts_count,
      blocked_work_count: executionMetrics.blocked_work_count,
      repeating_total_count: repeatingMetrics.total_repeating,
      total_repeating: repeatingMetrics.total_repeating
    };
  }

  private async getOverviewExecutionMetrics(match: any, range: { fromDate: Date; toDate: Date }): Promise<{
    total_open_count: number;
    ready_for_execution_count: number;
    waiting_on_parts_count: number;
    blocked_work_count: number;
  }> {
    const scopedOrders = await this.getExecutionScopedOrders(match);
    const activeOrders = scopedOrders.filter((order: any) => this.isOpenOrder(order) && this.isOrderWithinActiveExecutionRange(order, range));

    return {
      total_open_count: activeOrders.length,
      ready_for_execution_count: activeOrders.filter((order: any) => this.isExecutionReadyOrder(order)).length,
      waiting_on_parts_count: activeOrders.filter((order: any) => String(order?.status || '').trim() === 'Waiting-on-Parts').length,
      blocked_work_count: activeOrders.filter((order: any) => ['Blocked', 'Waiting-on-Permit', 'On-Hold'].includes(String(order?.status || '').trim())).length
    };
  }

  private async getOverviewRepeatingMetrics(match: any, range: { fromDate: Date; toDate: Date }): Promise<{ total_repeating: number }> {
    const scheduleMatch: any = {
      account_id: match.account_id,
      visible: true
    };

    if (match.wo_asset_id?.$in?.length) {
      scheduleMatch['work_order.wo_asset_id'] = { $in: match.wo_asset_id.$in };
    }

    if (match.wo_location_id?.$in?.length) {
      scheduleMatch['work_order.wo_location_id'] = { $in: match.wo_location_id.$in };
    }

    const schedules = await SchedulerModel.find(scheduleMatch).select('schedule').lean();
    return {
      total_repeating: schedules.filter((schedule: any) => this.isScheduleOverlappingRange(schedule, range)).length
    };
  }

  async executionSummaryData(match: any, rangeInput: { fromDate?: string; toDate?: string } = {}): Promise<any> {
    const range = this.normalizeDateRange(rangeInput);
    if (!range) {
      throw Object.assign(new Error('Valid fromDate and toDate are required'), { status: 400 });
    }

    const completionMatch = {
      ...match,
      status: "Completed",
      actual_end_date: { $gte: range.fromDate, $lte: range.toDate }
    };
    const completedOrders = await WorkOrderModel.find(completionMatch).lean();

    const completedCount = completedOrders.length;
    const onTimeCompletedCount = completedOrders.filter((order: any) => {
      const actualEndDate = this.parseReportDate(order?.actual_end_date);
      const dueDate = this.parseReportDate(order?.end_date);
      return !!actualEndDate && !!dueDate && actualEndDate.getTime() <= dueDate.getTime();
    }).length;

    const completionHours = completedOrders
      .map((order: any) => this.getActualCompletionHours(order))
      .filter((hours: number | null) => hours !== null) as number[];
    const avgHours = completionHours.length
      ? Number((completionHours.reduce((total: number, hours: number) => total + hours, 0) / completionHours.length).toFixed(2))
      : 0;

    const scopedOrders = await this.getExecutionScopedOrders(match);
    const activeOrders = scopedOrders.filter((order: any) => this.isOpenOrder(order) && this.isOrderWithinActiveExecutionRange(order, range));
    const today = new Date();
    const overdueOpenCount = activeOrders.filter((order: any) => {
      const dueDate = this.parseReportDate(order?.end_date);
      return !!dueDate && dueDate.getTime() < today.getTime();
    }).length;
    const waitingOnPartsCount = activeOrders.filter((order: any) => String(order?.status || '').trim() === 'Waiting-on-Parts').length;
    const blockedWorkCount = activeOrders.filter((order: any) => ['Blocked', 'Waiting-on-Permit', 'On-Hold'].includes(String(order?.status || '').trim())).length;
    const readyForExecutionCount = activeOrders.filter((order: any) => this.isExecutionReadyOrder(order)).length;

    return {
      completed_count: completedCount,
      on_time_completed_count: onTimeCompletedCount,
      on_time_completion_rate: completedCount ? Number(((onTimeCompletedCount / completedCount) * 100).toFixed(2)) : 0,
      overdue_open_count: overdueOpenCount,
      waiting_on_parts_count: waitingOnPartsCount,
      blocked_work_count: blockedWorkCount,
      ready_for_execution_count: readyForExecutionCount,
      avg_time_to_complete_hours: avgHours
    };
  }

  async onTimeVsOverdue(match: any, rangeInput: { fromDate?: string; toDate?: string } = {}): Promise<any> {
    const range = this.normalizeDateRange(rangeInput);
    if (!range) {
      throw Object.assign(new Error('Valid fromDate and toDate are required'), { status: 400 });
    }

    const completionMatch = {
      ...match,
      status: "Completed",
      actual_end_date: { $gte: range.fromDate, $lte: range.toDate }
    };
    const completedOrders = await WorkOrderModel.find(completionMatch).lean();

    const onTimeCount = completedOrders.filter((order: any) => {
      const actualEndDate = this.parseReportDate(order?.actual_end_date);
      const dueDate = this.parseReportDate(order?.end_date);
      return !!actualEndDate && !!dueDate && actualEndDate.getTime() <= dueDate.getTime();
    }).length;
    const completedLateCount = Math.max(completedOrders.length - onTimeCount, 0);

    const scopedOrders = await this.getExecutionScopedOrders(match);
    const activeOrders = scopedOrders.filter((order: any) => this.isOpenOrder(order) && this.isOrderWithinActiveExecutionRange(order, range));
    const today = new Date();
    const overdueOpenCount = activeOrders.filter((order: any) => {
      const dueDate = this.parseReportDate(order?.end_date);
      return !!dueDate && dueDate.getTime() < today.getTime();
    }).length;

    const total = onTimeCount + completedLateCount + overdueOpenCount;
    return {
      total,
      data: [
        {
          key: 'On Time',
          value: onTimeCount,
          percentage: total ? Number(((onTimeCount / total) * 100).toFixed(2)) : 0
        },
        {
          key: 'Completed Late',
          value: completedLateCount,
          percentage: total ? Number(((completedLateCount / total) * 100).toFixed(2)) : 0
        },
        {
          key: 'Open Overdue',
          value: overdueOpenCount,
          percentage: total ? Number(((overdueOpenCount / total) * 100).toFixed(2)) : 0
        }
      ]
    };
  }

  async timeToComplete(match: any, rangeInput: { fromDate?: string; toDate?: string } = {}): Promise<any> {
    const range = this.normalizeDateRange(rangeInput);
    if (!range) {
      throw Object.assign(new Error('Valid fromDate and toDate are required'), { status: 400 });
    }

    const bucketConfig = this.getRangeBucketConfig(range);
    const data = await WorkOrderModel.aggregate([
      {
        $match: {
          ...match,
          status: 'Completed',
          actual_end_date: { $gte: range.fromDate, $lte: range.toDate },
          actual_start_date: { $exists: true, $ne: null }
        }
      },
      {
        $addFields: {
          completion_hours: {
            $divide: [
              { $subtract: ['$actual_end_date', '$actual_start_date'] },
              3600000
            ]
          }
        }
      },
      {
        $match: {
          completion_hours: { $gte: 0 }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: bucketConfig.format, date: '$actual_end_date' } },
          avg_hours: { $avg: '$completion_hours' },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          bucket: '$_id',
          avg_hours: { $round: ['$avg_hours', 2] },
          count: 1
        }
      },
      { $sort: { bucket: 1 } }
    ]);

    if (!data.length) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }

    const overallAverage = data.length
      ? Number((data.reduce((total: number, entry: any) => total + Number(entry.avg_hours || 0), 0) / data.length).toFixed(2))
      : 0;

    return {
      granularity: bucketConfig.label,
      date: data.map((entry: any) => entry.bucket),
      avg_hours: data.map((entry: any) => Number(entry.avg_hours || 0)),
      count: data.map((entry: any) => Number(entry.count || 0)),
      overall_avg_hours: overallAverage
    };
  }

  async workOrdersByType(match: any): Promise<any> {
    const orders = await WorkOrderModel.find(match).select('nature_of_work type').lean();
    const rollup = new Map<string, number>();
    orders.forEach((order: any) => {
      const key = this.canonicalizeNatureOfWork(order?.nature_of_work || order?.type || 'General') || 'Unspecified';
      rollup.set(key, Number(rollup.get(key) || 0) + 1);
    });

    const data = Array.from(rollup.entries())
      .map(([key, value]) => ({ key, value }))
      .sort((first: any, second: any) => {
        if (second.value !== first.value) {
          return second.value - first.value;
        }
        return first.key.localeCompare(second.key);
      });

    if (!data.length) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }

    return data;
  }

  async workOrderSourceMix(match: any): Promise<any> {
    const range = match?.createdAt?.$gte && match?.createdAt?.$lte
      ? this.normalizeDateRange({ fromDate: String(match.createdAt.$gte), toDate: String(match.createdAt.$lte) })
      : null;
    const bucketConfig = range ? this.getRangeBucketConfig(range) : { format: '%Y-%m', label: 'month' };

    const data = await WorkOrderModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            createdFrom: {
              $cond: [
                {
                  $or: [
                    { $eq: [{ $ifNull: ['$createdFrom', ''] }, ''] },
                    { $eq: [{ $trim: { input: { $ifNull: ['$createdFrom', ''] } } }, ''] }
                  ]
                },
                'Work Order',
                { $trim: { input: '$createdFrom' } }
              ]
            },
            bucket: { $dateToString: { format: bucketConfig.format, date: '$createdAt' } }
          },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          createdFrom: '$_id.createdFrom',
          bucket: '$_id.bucket',
          count: 1
        }
      },
      { $sort: { bucket: 1 } }
    ]);

    if (!data.length) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }

    const buckets = [...new Set(data.map((item: any) => item.bucket))].sort();
    const categories = ['Preventive', 'Work Request', 'Work Order', 'Asset Report'];
    const finalResult: any = { date: buckets, granularity: bucketConfig.label };

    for (const category of categories) {
      finalResult[category] = buckets.map((bucket: string) => {
        const found = data.find((item: any) => item.createdFrom === category && item.bucket === bucket);
        return found ? Number(found.count || 0) : 0;
      });
    }

    return finalResult;
  }

  async assetMaintenanceReport(match: any): Promise<any> {
    const orders = await this.getExecutionScopedOrders(match);
    if (!orders.length) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }

    const assetMap = new Map<string, any>();
    orders.forEach((order: any) => {
      const assetId = String(order?.asset?.id || order?.asset?._id || order?.wo_asset_id || '');
      const assetName = String(order?.asset?.asset_name || '').trim();
      if (!assetId || !assetName) {
        return;
      }

      const current = assetMap.get(assetId) || {
        id: assetId,
        asset_name: assetName,
        location_name: order?.location?.location_name || '-',
        wo_count: 0,
        open_wo_count: 0,
        blocked_wo_count: 0,
        completed_count: 0,
        on_time_count: 0,
        parts_spend: 0,
        actual_hours: 0
      };

      current.wo_count += 1;
      const status = String(order?.status || '').trim();
      if (status !== 'Completed') {
        current.open_wo_count += 1;
      } else {
        current.completed_count += 1;
        const actualEndDate = this.parseReportDate(order?.actual_end_date);
        const dueDate = this.parseReportDate(order?.end_date);
        if (actualEndDate && dueDate && actualEndDate.getTime() <= dueDate.getTime()) {
          current.on_time_count += 1;
        }
      }

      if (['Blocked', 'Waiting-on-Parts', 'Waiting-on-Permit', 'On-Hold'].includes(status)) {
        current.blocked_wo_count += 1;
      }

      current.actual_hours += Number(order?.actual_time || 0);
      current.parts_spend += (Array.isArray(order?.parts) ? order.parts : []).reduce((total: number, part: any) => {
        const unitCost = Number(part?.cost || 0);
        const qty = Number(part?.actualQuantity ?? part?.estimatedQuantity ?? 0);
        return total + (unitCost * qty);
      }, 0);

      assetMap.set(assetId, current);
    });

    const data = Array.from(assetMap.values())
      .map((item: any) => ({
        ...item,
        on_time_percentage: item.completed_count
          ? Number(((item.on_time_count / item.completed_count) * 100).toFixed(2))
          : 0,
        parts_spend: Number(item.parts_spend.toFixed(2)),
        actual_hours: Number(item.actual_hours.toFixed(2))
      }))
      .sort((first: any, second: any) => {
        if (second.wo_count !== first.wo_count) {
          return second.wo_count - first.wo_count;
        }
        return first.asset_name.localeCompare(second.asset_name);
      });

    if (!data.length) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }

    return data;
  }

  async requestFunnelReport(match: any, rangeInput: { fromDate?: string; toDate?: string } = {}): Promise<any> {
    const range = this.normalizeDateRange(rangeInput);
    if (!range) {
      throw Object.assign(new Error('Valid fromDate and toDate are required'), { status: 400 });
    }

    const requestMatch: any = {
      account_id: match.account_id,
      visible: true,
      createdAt: { $gte: range.fromDate, $lte: range.toDate }
    };

    if (match.wo_asset_id?.$in?.length) {
      requestMatch.asset_id = { $in: match.wo_asset_id.$in };
    }
    if (match.wo_location_id?.$in?.length) {
      requestMatch.location_id = { $in: match.wo_location_id.$in };
    }

    const bucketConfig = this.getRangeBucketConfig(range);
    const aggregation = await WorkRequestModel.aggregate([
      { $match: requestMatch },
      {
        $facet: {
          totals: [
            {
              $group: {
                _id: null,
                created: { $sum: 1 },
                approved: {
                  $sum: {
                    $cond: [{ $ne: ['$approvedAt', null] }, 1, 0]
                  }
                },
                rejected: {
                  $sum: {
                    $cond: [{ $ne: ['$rejectedAt', null] }, 1, 0]
                  }
                },
                converted: {
                  $sum: {
                    $cond: [{ $ne: ['$convertedAt', null] }, 1, 0]
                  }
                },
                still_open: {
                  $sum: {
                    $cond: [{ $in: ['$status', ['Open', 'Pending', 'On-Hold', 'In-Progress']] }, 1, 0]
                  }
                }
              }
            }
          ],
          createdTrend: [
            {
              $group: {
                _id: { $dateToString: { format: bucketConfig.format, date: '$createdAt' } },
                count: { $sum: 1 }
              }
            },
            { $project: { _id: 0, bucket: '$_id', count: 1 } },
            { $sort: { bucket: 1 } }
          ]
        }
      }
    ]);

    const totals = aggregation?.[0]?.totals?.[0] || {
      created: 0,
      approved: 0,
      rejected: 0,
      converted: 0,
      still_open: 0
    };
    const createdTrend = aggregation?.[0]?.createdTrend || [];
    if (!totals.created && !createdTrend.length) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }

    return {
      created: Number(totals.created || 0),
      approved: Number(totals.approved || 0),
      rejected: Number(totals.rejected || 0),
      converted: Number(totals.converted || 0),
      still_open: Number(totals.still_open || 0),
      conversion_rate: totals.created ? Number((((Number(totals.converted || 0)) / Number(totals.created || 1)) * 100).toFixed(2)) : 0,
      granularity: bucketConfig.label,
      trend: {
        date: createdTrend.map((item: any) => item.bucket),
        created: createdTrend.map((item: any) => Number(item.count || 0))
      }
    };
  }

  async partsImpactReport(match: any, rangeInput: { fromDate?: string; toDate?: string } = {}): Promise<any> {
    const range = this.normalizeDateRange(rangeInput);
    if (!range) {
      throw Object.assign(new Error('Valid fromDate and toDate are required'), { status: 400 });
    }

    const orders = await this.getExecutionScopedOrders(match);
    const scopedOrders = orders.filter((order: any) => {
      const createdAt = this.parseReportDate(order?.createdAt);
      return !!createdAt && createdAt >= range.fromDate && createdAt <= range.toDate;
    });

    if (!scopedOrders.length) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }

    const bucketConfig = this.getRangeBucketConfig(range);
    const bucketMap = new Map<string, { planned_qty: number; actual_qty: number }>();
    const partRollupMap = new Map<string, any>();
    const lowStockPartIds = new Set<string>();
    let blockedWorkOrders = 0;
    let totalPartsSpend = 0;
    let totalPlannedQty = 0;
    let totalActualQty = 0;

    scopedOrders.forEach((order: any) => {
      const parts = Array.isArray(order?.parts) ? order.parts : [];
      const status = String(order?.status || '').trim();
      const createdAt = this.parseReportDate(order?.createdAt);
      const bucket = createdAt
        ? new Date(createdAt.getFullYear(), createdAt.getMonth(), createdAt.getDate())
        : null;
      const bucketKey = bucket
        ? (bucketConfig.label === 'month'
          ? `${bucket.getFullYear()}-${String(bucket.getMonth() + 1).padStart(2, '0')}`
          : `${bucket.getFullYear()}-${String(bucket.getMonth() + 1).padStart(2, '0')}-${String(bucket.getDate()).padStart(2, '0')}`)
        : null;

      const hasPartsBlocker = status === 'Waiting-on-Parts'
        || parts.some((part: any) => ['Missing', 'Out of Stock'].includes(String(part?.availabilityStatus || '').trim()) || Number(part?.shortQuantity || 0) > 0);
      if (hasPartsBlocker) {
        blockedWorkOrders += 1;
      }

      parts.forEach((part: any) => {
        const plannedQty = Number(part?.plannedQuantity ?? part?.estimatedQuantity ?? 0) || 0;
        const actualQty = Number(part?.actualQuantity ?? 0) || 0;
        const partSpend = (Number(part?.cost || 0) || 0) * (actualQty > 0 ? actualQty : plannedQty);
        const partId = String(part?.part_id || '').trim() || String(part?.part_name || '').trim();
        const partName = String(part?.part_name || 'Unknown Part').trim();
        const availabilityStatus = String(part?.availabilityStatus || '').trim();

        totalPlannedQty += plannedQty;
        totalActualQty += actualQty;
        totalPartsSpend += partSpend;

        if (availabilityStatus === 'Low Stock') {
          lowStockPartIds.add(partId);
        }

        if (bucketKey) {
          const currentBucket = bucketMap.get(bucketKey) || { planned_qty: 0, actual_qty: 0 };
          currentBucket.planned_qty += plannedQty;
          currentBucket.actual_qty += actualQty;
          bucketMap.set(bucketKey, currentBucket);
        }

        const currentRollup = partRollupMap.get(partId) || {
          part_id: partId,
          part_name: partName,
          linked_work_orders: 0,
          low_stock: false,
          planned_qty: 0,
          actual_qty: 0,
          spend: 0
        };
        currentRollup.linked_work_orders += 1;
        currentRollup.low_stock = currentRollup.low_stock || availabilityStatus === 'Low Stock';
        currentRollup.planned_qty += plannedQty;
        currentRollup.actual_qty += actualQty;
        currentRollup.spend += partSpend;
        partRollupMap.set(partId, currentRollup);
      });
    });

    const detailRows = Array.from(partRollupMap.values())
      .map((item: any) => ({
        ...item,
        spend: Number(item.spend.toFixed(2))
      }))
      .sort((first: any, second: any) => {
        if (second.spend !== first.spend) {
          return second.spend - first.spend;
        }
        return second.linked_work_orders - first.linked_work_orders;
      });

    const bucketKeys = Array.from(bucketMap.keys()).sort();
    return {
      blocked_work_orders: blockedWorkOrders,
      total_parts_spend: Number(totalPartsSpend.toFixed(2)),
      low_stock_linked_parts: lowStockPartIds.size,
      planned_qty: Number(totalPlannedQty.toFixed(2)),
      actual_qty: Number(totalActualQty.toFixed(2)),
      actual_vs_planned_percentage: totalPlannedQty
        ? Number(((totalActualQty / totalPlannedQty) * 100).toFixed(2))
        : 0,
      trend: {
        granularity: bucketConfig.label,
        date: bucketKeys,
        planned_qty: bucketKeys.map((key: string) => Number(bucketMap.get(key)?.planned_qty || 0)),
        actual_qty: bucketKeys.map((key: string) => Number(bucketMap.get(key)?.actual_qty || 0))
      },
      details: detailRows.slice(0, 10)
    };
  }

  async completedWithInspectionReport(match: any, rangeInput: { fromDate?: string; toDate?: string } = {}): Promise<any> {
    const range = this.normalizeDateRange(rangeInput);
    if (!range) {
      throw Object.assign(new Error('Valid fromDate and toDate are required'), { status: 400 });
    }

    const bucketConfig = this.getRangeBucketConfig(range);
    const completedOrders = await WorkOrderModel.find({
      ...match,
      status: 'Completed',
      actual_end_date: { $gte: range.fromDate, $lte: range.toDate }
    })
      .select('actual_end_date procedure_entries')
      .lean();

    if (!completedOrders.length) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }

    const bucketMap = new Map<string, { with_inspection: number; without_inspection: number }>();
    let withInspectionCount = 0;

    completedOrders.forEach((order: any) => {
      const completedDate = this.parseReportDate(order?.actual_end_date);
      if (!completedDate) {
        return;
      }

      const bucketKey = bucketConfig.label === 'month'
        ? `${completedDate.getFullYear()}-${String(completedDate.getMonth() + 1).padStart(2, '0')}`
        : `${completedDate.getFullYear()}-${String(completedDate.getMonth() + 1).padStart(2, '0')}-${String(completedDate.getDate()).padStart(2, '0')}`;
      const hasInspection = this.hasSubmittedInspection(order);
      const currentBucket = bucketMap.get(bucketKey) || { with_inspection: 0, without_inspection: 0 };

      if (hasInspection) {
        withInspectionCount += 1;
        currentBucket.with_inspection += 1;
      } else {
        currentBucket.without_inspection += 1;
      }

      bucketMap.set(bucketKey, currentBucket);
    });

    const bucketKeys = Array.from(bucketMap.keys()).sort();
    const completedCount = completedOrders.length;
    const withoutInspectionCount = Math.max(completedCount - withInspectionCount, 0);

    return {
      completed_count: completedCount,
      with_inspection_count: withInspectionCount,
      without_inspection_count: withoutInspectionCount,
      inspection_completion_rate: completedCount
        ? Number(((withInspectionCount / completedCount) * 100).toFixed(2))
        : 0,
      trend: {
        granularity: bucketConfig.label,
        date: bucketKeys,
        with_inspection: bucketKeys.map((key: string) => Number(bucketMap.get(key)?.with_inspection || 0)),
        without_inspection: bucketKeys.map((key: string) => Number(bucketMap.get(key)?.without_inspection || 0))
      }
    };
  }

  async completedByUserReport(match: any, rangeInput: { fromDate?: string; toDate?: string } = {}): Promise<any> {
    const range = this.normalizeDateRange(rangeInput);
    if (!range) {
      throw Object.assign(new Error('Valid fromDate and toDate are required'), { status: 400 });
    }

    const completedOrders = await WorkOrderModel.find({
      ...match,
      status: 'Completed',
      actual_end_date: { $gte: range.fromDate, $lte: range.toDate }
    })
      .select('order_no title actual_end_date status_details completed_by')
      .lean();

    if (!completedOrders.length) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }

    const userRollup = new Map<string, { completed_count: number; recent_work_orders: string[] }>();
    let unattributedCount = 0;

    completedOrders.forEach((order: any) => {
      const completedEntry = this.getCompletedStatusEntry(order);
      const completedById = String(order?.completed_by?.id || completedEntry?.createdBy || '').trim();
      if (!completedById) {
        unattributedCount += 1;
        return;
      }

      const current = userRollup.get(completedById) || { completed_count: 0, recent_work_orders: [] };
      current.completed_count += 1;
      if (order?.order_no && current.recent_work_orders.length < 5) {
        current.recent_work_orders.push(String(order.order_no));
      }
      userRollup.set(completedById, current);
    });

    const userIds = Array.from(userRollup.keys());
    const users = userIds.length
      ? await UserModel.find({ _id: { $in: helperService.validateObjectIds(userIds.join(',')) } })
        .select('firstName lastName username email')
        .lean()
      : [];
    const userMap = new Map(users.map((user: any) => {
      const label = `${String(user?.firstName || '').trim()} ${String(user?.lastName || '').trim()}`.trim()
        || String(user?.username || user?.email || 'Unknown User').trim();
      return [String(user?._id), label];
    }));

    const details = Array.from(userRollup.entries())
      .map(([userId, item]) => ({
        user_id: userId,
        user_name: userMap.get(userId) || 'Unknown User',
        completed_count: Number(item.completed_count || 0),
        percentage: completedOrders.length
          ? Number(((Number(item.completed_count || 0) / completedOrders.length) * 100).toFixed(2))
          : 0,
        recent_work_orders: item.recent_work_orders
      }))
      .sort((first: any, second: any) => {
        if (second.completed_count !== first.completed_count) {
          return second.completed_count - first.completed_count;
        }
        return first.user_name.localeCompare(second.user_name);
      });

    return {
      completed_count: completedOrders.length,
      attributed_count: details.reduce((total: number, item: any) => total + Number(item.completed_count || 0), 0),
      unattributed_count: unattributedCount,
      chart: {
        labels: details.slice(0, 8).map((item: any) => item.user_name),
        counts: details.slice(0, 8).map((item: any) => Number(item.completed_count || 0))
      },
      details
    };
  }

  async timeVsCostReport(match: any, rangeInput: { fromDate?: string; toDate?: string } = {}): Promise<any> {
    const range = this.normalizeDateRange(rangeInput);
    if (!range) {
      throw Object.assign(new Error('Valid fromDate and toDate are required'), { status: 400 });
    }

    const bucketConfig = this.getRangeBucketConfig(range);
    const completedOrders = await WorkOrderModel.find({
      ...match,
      status: 'Completed',
      actual_end_date: { $gte: range.fromDate, $lte: range.toDate }
    })
      .select('order_no title actual_start_date actual_end_date parts')
      .lean();

    if (!completedOrders.length) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }

    const bucketMap = new Map<string, { total_hours: number; total_cost: number; count: number }>();
    let totalHours = 0;
    let totalPartsSpend = 0;

    completedOrders.forEach((order: any) => {
      const completedDate = this.parseReportDate(order?.actual_end_date);
      if (!completedDate) {
        return;
      }

      const hours = this.getActualCompletionHours(order) || 0;
      const partsSpend = this.getPartsSpend(order);
      totalHours += hours;
      totalPartsSpend += partsSpend;

      const bucketKey = bucketConfig.label === 'month'
        ? `${completedDate.getFullYear()}-${String(completedDate.getMonth() + 1).padStart(2, '0')}`
        : `${completedDate.getFullYear()}-${String(completedDate.getMonth() + 1).padStart(2, '0')}-${String(completedDate.getDate()).padStart(2, '0')}`;
      const currentBucket = bucketMap.get(bucketKey) || { total_hours: 0, total_cost: 0, count: 0 };
      currentBucket.total_hours += hours;
      currentBucket.total_cost += partsSpend;
      currentBucket.count += 1;
      bucketMap.set(bucketKey, currentBucket);
    });

    const bucketKeys = Array.from(bucketMap.keys()).sort();
    const detailRows = completedOrders
      .map((order: any) => ({
        order_no: order?.order_no,
        title: order?.title,
        actual_hours: Number((this.getActualCompletionHours(order) || 0).toFixed(2)),
        parts_cost: Number(this.getPartsSpend(order).toFixed(2))
      }))
      .sort((first: any, second: any) => {
        if (second.parts_cost !== first.parts_cost) {
          return second.parts_cost - first.parts_cost;
        }
        return second.actual_hours - first.actual_hours;
      });

    return {
      completed_count: completedOrders.length,
      total_parts_spend: Number(totalPartsSpend.toFixed(2)),
      avg_actual_hours: completedOrders.length ? Number((totalHours / completedOrders.length).toFixed(2)) : 0,
      avg_parts_spend: completedOrders.length ? Number((totalPartsSpend / completedOrders.length).toFixed(2)) : 0,
      trend: {
        granularity: bucketConfig.label,
        date: bucketKeys,
        avg_hours: bucketKeys.map((key: string) => {
          const bucket = bucketMap.get(key);
          return bucket?.count ? Number((bucket.total_hours / bucket.count).toFixed(2)) : 0;
        }),
        avg_parts_cost: bucketKeys.map((key: string) => {
          const bucket = bucketMap.get(key);
          return bucket?.count ? Number((bucket.total_cost / bucket.count).toFixed(2)) : 0;
        })
      },
      details: detailRows.slice(0, 10)
    };
  }

  async plannerReadinessReport(match: any, rangeInput: { fromDate?: string; toDate?: string } = {}): Promise<any> {
    const range = this.normalizeDateRange(rangeInput);
    if (!range) {
      throw Object.assign(new Error('Valid fromDate and toDate are required'), { status: 400 });
    }

    const orders = await this.getExecutionScopedOrders(match);
    const activeOrders = orders.filter((order: any) => this.isOpenOrder(order) && this.isOrderWithinActiveExecutionRange(order, range));
    if (!activeOrders.length) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }

    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const bucketCounts = {
      backlog: 0,
      assigned: 0,
      ready: 0,
      blocked: 0,
      overdue: 0
    };

    let unassignedCount = 0;
    let dueTodayCount = 0;
    let onHoldCount = 0;
    let blockedByPartsCount = 0;
    let missingEstimateCount = 0;
    let followUpsCount = 0;

    activeOrders.forEach((order: any) => {
      const bucketId = this.getPlannerBucketId(order);
      bucketCounts[bucketId] += 1;

      const dueDate = this.parseReportDate(order?.end_date);
      const status = String(order?.status || '').trim();

      if (this.getAssignedUserCount(order) === 0) {
        unassignedCount += 1;
      }
      if (dueDate && dueDate.getFullYear() === startOfToday.getFullYear() && dueDate.getMonth() === startOfToday.getMonth() && dueDate.getDate() === startOfToday.getDate()) {
        dueTodayCount += 1;
      }
      if (['Blocked', 'Waiting-on-Parts', 'Waiting-on-Permit', 'On-Hold'].includes(status)) {
        onHoldCount += 1;
      }
      if (status === 'Waiting-on-Parts' || !this.isPartsReadyForExecution(order)) {
        blockedByPartsCount += 1;
      }
      if (this.isScheduleReadyForExecution(order) && !(Number(order?.estimated_time || 0) > 0)) {
        missingEstimateCount += 1;
      }
      if (order?.parentId) {
        followUpsCount += 1;
      }
    });

    return {
      total_open: activeOrders.length,
      ready_for_execution_count: bucketCounts.ready,
      blocked_work_count: bucketCounts.blocked,
      overdue_open_count: bucketCounts.overdue,
      unassigned_count: unassignedCount,
      due_today_count: dueTodayCount,
      on_hold_count: onHoldCount,
      blocked_by_parts_count: blockedByPartsCount,
      missing_estimate_count: missingEstimateCount,
      follow_ups_count: followUpsCount,
      buckets: [
        { key: 'Backlog', value: bucketCounts.backlog },
        { key: 'Assigned', value: bucketCounts.assigned },
        { key: 'Ready', value: bucketCounts.ready },
        { key: 'Blocked', value: bucketCounts.blocked },
        { key: 'Overdue', value: bucketCounts.overdue }
      ]
    };
  }

  async repeatingWorkOrdersReport(match: any, rangeInput: { fromDate?: string; toDate?: string } = {}): Promise<any> {
    const range = this.normalizeDateRange(rangeInput);
    if (!range) {
      throw Object.assign(new Error('Valid fromDate and toDate are required'), { status: 400 });
    }

    const scheduleMatch: any = {
      account_id: match.account_id,
      visible: true
    };

    if (match.wo_asset_id?.$in?.length) {
      scheduleMatch['work_order.wo_asset_id'] = { $in: match.wo_asset_id.$in };
    }

    if (match.wo_location_id?.$in?.length) {
      scheduleMatch['work_order.wo_location_id'] = { $in: match.wo_location_id.$in };
    }

    const schedules = await SchedulerModel.aggregate([
      { $match: scheduleMatch },
      {
        $lookup: {
          from: AssetModel.collection.name,
          let: { assetId: '$work_order.wo_asset_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$assetId'] }, visible: true } },
            { $project: { _id: 1, asset_name: 1 } }
          ],
          as: 'asset'
        }
      },
      { $unwind: { path: '$asset', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: LocationModel.collection.name,
          let: { locationId: '$work_order.wo_location_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$locationId'] }, visible: true } },
            { $project: { _id: 1, location_name: 1 } }
          ],
          as: 'location'
        }
      },
      { $unwind: { path: '$location', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          title: 1,
          description: 1,
          createdAt: 1,
          schedule: 1,
          asset: 1,
          location: 1,
          work_order: 1
        }
      }
    ]);

    const filteredSchedules = schedules.filter((schedule: any) => this.isScheduleOverlappingRange(schedule, range));
    if (!filteredSchedules.length) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }

    const modeCounts = {
      daily: 0,
      weekly: 0,
      monthly: 0
    };
    let enabledCount = 0;

    filteredSchedules.forEach((schedule: any) => {
      const mode = String(schedule?.schedule?.mode || '').trim() as 'daily' | 'weekly' | 'monthly';
      if (modeCounts.hasOwnProperty(mode)) {
        modeCounts[mode] += 1;
      }
      if (schedule?.schedule?.enabled) {
        enabledCount += 1;
      }
    });

    const details = filteredSchedules
      .map((schedule: any) => ({
        id: String(schedule?._id),
        title: String(schedule?.title || schedule?.work_order?.title || 'Untitled Repeating Work Order').trim(),
        mode: String(schedule?.schedule?.mode || '-').trim(),
        enabled: Boolean(schedule?.schedule?.enabled),
        start_date: schedule?.schedule?.start_date || null,
        end_date: schedule?.schedule?.end_date || null,
        no_of_execution: Number(schedule?.schedule?.no_of_execution || 0),
        asset_name: String(schedule?.asset?.asset_name || '-').trim(),
        location_name: String(schedule?.location?.location_name || '-').trim()
      }))
      .sort((first: any, second: any) => {
        const firstStart = this.parseReportDate(first.start_date)?.getTime() || 0;
        const secondStart = this.parseReportDate(second.start_date)?.getTime() || 0;
        return secondStart - firstStart;
      });

    return {
      total_repeating: filteredSchedules.length,
      enabled_repeating: enabledCount,
      disabled_repeating: Math.max(filteredSchedules.length - enabledCount, 0),
      total_executions: filteredSchedules.reduce((total: number, schedule: any) => total + Number(schedule?.schedule?.no_of_execution || 0), 0),
      cadence_mix: [
        { key: 'Daily', value: modeCounts.daily },
        { key: 'Weekly', value: modeCounts.weekly },
        { key: 'Monthly', value: modeCounts.monthly }
      ],
      details: details.slice(0, 12)
    };
  }

  async summaryData(workOrderMatch: any): Promise<any> {
    try {
      const today = new Date();
      const aggregationResults = await WorkOrderModel.aggregate([
        { $match: workOrderMatch },
        {
          $facet: {
            completedOnTime: [
              {
                $match: {
                  status: 'Completed',
                  updatedAt: { $exists: true },
                  $expr: { $lte: ["$updatedAt", "$end_date"] }
                }
              },
              { $count: "count" }
            ],
            overdue: [
              {
                $match: {
                  status: { $ne: 'Completed' },
                  end_date: { $lt: today }
                }
              },
              { $count: "count" }
            ],
            planned: [
              { $match: { createdFrom: "Preventive" } },
              { $count: "count" }
            ],
            total: [
              { $count: "count" }
            ]
          }
        }
      ]);

      const result = aggregationResults[0];
      const totalCount = result.total[0]?.count || 0;
      const completedOnTimeCount = result.completedOnTime[0]?.count || 0;
      const overdueCount = result.overdue[0]?.count || 0;
      const plannedCount = result.planned[0]?.count || 0;

      const workRequestMatch: any = { status: { $nin: ['completed'] } }
      if (workOrderMatch.wo_asset_id) workRequestMatch.asset_id = workOrderMatch.wo_asset_id;
      if (workOrderMatch.wo_location_id) workRequestMatch.location_id = workOrderMatch.wo_location_id;
      if (workOrderMatch.createdAt) workRequestMatch.createdAt = workOrderMatch.createdAt;

      const workRequestCount = await requestService.countRequests(
        workOrderMatch.account_id,
        workRequestMatch
      );

      const plannedUnplannedRatio = totalCount ? (plannedCount / totalCount) * 100 : 0;
      const completionRate = totalCount ? (completedOnTimeCount / totalCount) * 100 : 0;

      return {
        completion_rate: Number(completionRate.toFixed(2)),
        overdue_WO: overdueCount,
        work_request_count: workRequestCount,
        planned_unplanned_ratio: Number(plannedUnplannedRatio.toFixed(2))
      };
    } catch (err) {
      applicationLogger.error({ err: err }, "summaryData error:");
      throw err;
    }
  };

  async generateOrderNo(account_id: any): Promise<string> {
    const year = new Date().getFullYear();
    const totalCount = await WorkOrderModel.countDocuments({ account_id, createdAt: { $gte: new Date(`${year}-01-01T00:00:00Z`), $lte: new Date(`${year}-12-31T23:59:59Z`) } });
    const sequence = String(totalCount + 1).padStart(4, "0");
    return `WO-${year}${sequence}`;
  };

  async createWorkOrder(
    body: any,
    user: IUser,
    correlationId?: string,
    existingSession?: mongoose.ClientSession
  ): Promise<any> {
    return await withTransaction(async (session) => {
      let normalizedBody = this.normalizeNatureOfWorkPayload(this.normalizeTimingFields(this.sanitizeWorkOrder({ ...body })));
      this.validateIncomingParts(normalizedBody.parts || []);
      let userIdList = Array.isArray(normalizedBody.userIdList) ? normalizedBody.userIdList.filter((userId: string) => !!userId) : [];
      let parentOrder: any = null;
      let parentChildCount = 0;
      let shouldClearParentExecutionFields = false;

      if (normalizedBody.parentId) {
        parentOrder = await this.getParentOrderForInheritance(normalizedBody.parentId, user.account_id, session);
        if (!parentOrder) {
          throw Object.assign(new Error('Parent work order not found'), { status: 404 });
        }
        parentChildCount = await this.getChildOrderCount(parentOrder._id, session);
        const parentAssignedUserIds = await this.getAssignedUserIdsForWorkOrder(parentOrder._id, session);
        const inheritedState = this.applyParentInheritance(normalizedBody, parentOrder, parentAssignedUserIds);
        normalizedBody = inheritedState.normalizedBody;
        userIdList = inheritedState.userIdList;

        if (parentChildCount === 0) {
          if (this.shouldInheritValue(normalizedBody.estimated_time) && !this.shouldInheritValue(parentOrder?.estimated_time)) {
            normalizedBody.estimated_time = parentOrder.estimated_time;
          }
          if (this.shouldInheritValue(normalizedBody.parts) && Array.isArray(parentOrder?.parts) && parentOrder.parts.length > 0) {
            normalizedBody.parts = JSON.parse(JSON.stringify(parentOrder.parts));
          }
          if (this.shouldInheritValue(normalizedBody.procedure_ids) && Array.isArray(parentOrder?.procedure_ids) && parentOrder.procedure_ids.length > 0) {
            normalizedBody.procedure_ids = [...parentOrder.procedure_ids];
          }
          if (this.shouldInheritValue(normalizedBody.procedure_entries) && Array.isArray(parentOrder?.procedure_entries) && parentOrder.procedure_entries.length > 0) {
            normalizedBody.procedure_entries = JSON.parse(JSON.stringify(parentOrder.procedure_entries));
          }
          shouldClearParentExecutionFields = true;
          this.validateIncomingParts(normalizedBody.parts || []);
        }
      }

      const procedureSync = await this.syncProcedureEntries(normalizedBody, user.account_id, user, []);
      let linkedRequest: any = null;
      if (normalizedBody.work_request_id) {
        linkedRequest = await requestService.getRequestById(
          String(normalizedBody.work_request_id),
          user.account_id,
          session
        );
        if (!linkedRequest || String(linkedRequest.account_id) !== String(user.account_id)) {
          throw Object.assign(new Error('Linked work request was not found'), { status: 404 });
        }
        if (linkedRequest.status === 'Rejected') {
          throw Object.assign(new Error('Rejected work requests cannot be converted into work orders'), { status: 400 });
        }
        if (linkedRequest.status !== 'Approved') {
          throw Object.assign(new Error('Only approved work requests can be converted into work orders'), { status: 400 });
        }
        if (linkedRequest.converted_work_order_id) {
          throw Object.assign(new Error('This work request has already been converted into a work order'), { status: 400 });
        }
      }

      const normalizedParts = partsService.normalizeWorkOrderParts(normalizedBody.parts || [], normalizedBody.status);
      const excludedProcedurePartIds = this.normalizeObjectIdArray(normalizedBody.excluded_procedure_part_ids);
      await partsService.validateInventoryByWorkOrder([], normalizedParts, 'Open', normalizedBody.status, session);

      const newAssetPayload: any = {
        account_id: user.account_id,
        order_no: await this.generateOrderNo(user.account_id),
        title: normalizedBody.title,
        description: normalizedBody.description,
        estimated_time: normalizedBody.estimated_time,
        actual_start_date: normalizedBody.actual_start_date,
        actual_end_date: normalizedBody.actual_end_date,
        actual_time: normalizedBody.actual_time,
        block_reason: normalizedBody.block_reason,
        parentId: normalizedBody.parentId,
        priority: normalizedBody.priority,
        status: normalizedBody.status,
        type: normalizedBody.type,
        nature_of_work: normalizedBody.nature_of_work || normalizedBody.type,
        procedure_ids: procedureSync.procedure_ids,
        excluded_procedure_part_ids: excludedProcedurePartIds,
        procedure_entries: procedureSync.procedure_entries,
        rescheduleEnabled: false,
        created_by: user._id,
        wo_asset_id: normalizedBody.wo_asset_id,
        wo_location_id: normalizedBody.wo_location_id,
        end_date: normalizedBody.end_date,
        start_date: normalizedBody.start_date,
        createdFrom: normalizedBody.createdFrom,
        files: normalizedBody.files,
        parts: normalizedParts,
        labor_entries: normalizedBody.labor_entries,
        work_request_id: normalizedBody.work_request_id,
        asset_report_id: normalizedBody.asset_report_id,
        status_details: [{ status: normalizedBody.status, createdBy: user._id }],
        createdBy: user._id
      };

      const completedPayload = this.syncCompletionAuditFields(newAssetPayload, null, user);
      const newAsset = new WorkOrderModel(completedPayload);

      const data: any = await newAsset.save({ session });
      if (!data) {
        throw Object.assign(new Error('Failed to create work order'), { status: 400 });
      }

      let userDetails: IUser[] = [];
      if (userIdList.length > 0) {
        const mappedUsers = userIdList.map((userId: string) => ({ userId, woId: newAsset._id }));
        userDetails = await UserModel.find({ _id: { $in: helperService.validateObjectIds(userIdList.join(',')) } }).session(session);
        if (!userDetails || userDetails.length === 0) {
          throw Object.assign(new Error('No users found'), { status: 404 });
        }

        const result = await userWorkOrderService.mapUsersWorkOrder(mappedUsers, session);
        if (!result || result.length === 0) {
          throw Object.assign(new Error('Failed to map users to work order'), { status: 500 });
        }
      }
      
      if (normalizedBody.parts?.length > 0) {
        try {
          const inventoryResult = await partsService.adjustInventoryByWorkOrder([], newAsset.parts || [], user, session, {
            account_id: user.account_id,
            work_order_id: data._id,
            work_order_no: data.order_no,
            location_id: normalizedBody.wo_location_id,
            previous_status: 'Open',
            next_status: normalizedBody.status,
            note: 'Initial work order parts reservation'
          });
          data.inventoryWarnings = inventoryResult.warnings;
        } catch (inventoryError) {
          if (!session) {
            await Promise.all([
              WorkOrderAssigneeModel.deleteMany({ woId: data._id }),
              WorkOrderModel.findByIdAndDelete(data._id)
            ]);
          }
          throw inventoryError;
        }
      }

      if (shouldClearParentExecutionFields && parentOrder) {
        if (Array.isArray(parentOrder.parts) && parentOrder.parts.length > 0) {
          await partsService.adjustInventoryByWorkOrder(parentOrder.parts || [], [], user, session, {
            account_id: user.account_id,
            work_order_id: parentOrder._id,
            work_order_no: parentOrder.order_no,
            location_id: parentOrder.wo_location_id,
            previous_status: parentOrder.status,
            next_status: parentOrder.status,
            note: `Moved execution planning to follow-up work order ${data.order_no}`
          });
        }

        const parentCleanup = this.normalizeNatureOfWorkPayload(this.normalizeTimingFields(this.sanitizeWorkOrder({
          start_date: null,
          end_date: null,
          estimated_time: null,
          parts: [],
          procedure_ids: [],
          procedure_entries: [],
          actual_start_date: null,
          actual_end_date: null,
          actual_time: null,
          labor_entries: [],
          updatedBy: user._id
        })));

        await WorkOrderModel.findByIdAndUpdate(parentOrder._id, parentCleanup, { session });
      }

      if (linkedRequest) {
        await requestService.markConverted(String(linkedRequest._id), user.account_id, {
          workOrderId: data._id,
          orderNo: data.order_no,
          priority: linkedRequest.priority,
          approvedBy: linkedRequest.approvedBy || user._id,
          approvedAt: linkedRequest.approvedAt,
          convertedBy: user._id
        }, session);
      }

      await workOrderActivityService.logActivity({
        account_id: user.account_id,
        work_order_id: data._id,
        workOrder: data,
        action_type: 'created',
        note: normalizedBody.parentId
          ? `Created follow-up work order ${data.order_no}${parentOrder?.order_no ? ` under ${parentOrder.order_no}` : ''}.`
          : `Created work order ${data.order_no}.`,
        metadata: {
          status: data.status,
          priority: data.priority,
          parent_id: parentOrder?._id || null,
          parent_order_no: parentOrder?.order_no || null,
          linked_request_id: linkedRequest?._id || null
        },
        actor: user
      }, session);

      if (parentOrder?._id) {
        await workOrderActivityService.logActivity({
          account_id: user.account_id,
          work_order_id: parentOrder._id,
          workOrder: parentOrder,
          action_type: 'child-created',
          note: `Created child work order ${data.order_no}${data.title ? ` (${data.title})` : ''}.`,
          metadata: {
            child_work_order_id: data._id,
            child_order_no: data.order_no,
            child_title: data.title || ''
          },
          actor: user
        }, session);
      }
      
      await this.dispatchWorkOrderAssignmentEmails(
        data,
        userDetails,
        user,
        session,
        correlationId
      );
      
      await notificationService.queueAccountNotification({
        accountId: String(user.account_id),
        module: 'Work Order',
        event: 'created',
        entityId: String(data._id),
        entityName: data.title || data.order_no || 'Work Order',
        actionUrl: `/work-order/details/${data._id}`,
        sourceUserId: String(user._id)
      }, {
        session,
        ...(correlationId ? { correlationId } : {})
      });
      
      try {
        const resultData = await this.getAllOrders({ _id: data._id, account_id: user.account_id, visible: true }, session);
        return resultData[0];
      } catch (readError: any) {
        applicationLogger.warn('Failed to fetch enriched work order after create, returning saved document instead:', readError?.message || readError);
        return data?.toObject ? data.toObject() : data;
      }
    }, existingSession);
  };

  async updateById(
    id: any,
    body: any,
    user: IUser,
    expectedVersion?: number,
    correlationId?: string
  ): Promise<any> {
    return await withTransaction(async (session) => {
      let existingOrder: any = await WorkOrderModel.findById(id).session(session);
      if (!existingOrder) {
        throw Object.assign(new Error('Work Order not found'), { status: 404 });
      }
      assertSyncVersion(existingOrder, expectedVersion);

      const childCount = await this.getChildOrderCount(id, session);
      if (childCount > 0 && this.hasExecutionOwnedFieldChanges(body)) {
        throw Object.assign(new Error('Parts, procedures, labor, and actual execution data are tracked on child work orders for parent work orders.'), { status: 400 });
      }
      if (childCount > 0 && Object.prototype.hasOwnProperty.call(body || {}, 'status')) {
        const requestedStatus = String(body?.status || '').trim();
        if (requestedStatus === 'In-Progress') {
          throw Object.assign(new Error('Move child work orders through execution. Parent work orders roll up child progress.'), { status: 400 });
        }
        if (requestedStatus === 'Completed') {
          const childOrders = await WorkOrderModel.find(
            { parentId: existingOrder._id, visible: true },
            { status: 1 }
          ).session(session).lean();
          const childStatusSummary = this.buildChildStatusSummary(childOrders);

          if (Number(childStatusSummary.completed || 0) !== Number(childStatusSummary.total || 0)) {
            throw Object.assign(new Error('All child work orders must be completed before the parent work order can be closed.'), { status: 400 });
          }
        }
      }
      
      let updatedData = { ...existingOrder.toObject(), ...body };
      if (body.hasOwnProperty('parts')) {
        this.validateIncomingParts(body.parts || []);
      }
      const beforeAssignedUserIds = body.hasOwnProperty('userIdList')
        ? await this.getAssignedUserIdsForWorkOrder(existingOrder._id, session)
        : [];
      const existingOrderSnapshot = existingOrder.toObject();
      
      if (body.hasOwnProperty('parts')) {
        const normalizedParts = partsService.normalizeWorkOrderParts(body.parts || [], updatedData.status || existingOrder.status);
        await partsService.validateInventoryByWorkOrder(
          body.oldParts || existingOrder.parts || [],
          normalizedParts,
          existingOrder.status,
          updatedData.status || existingOrder.status,
          session
        );
        updatedData.parts = normalizedParts;
        const inventoryResult = await partsService.adjustInventoryByWorkOrder(body.oldParts || existingOrder.parts || [], normalizedParts, user, session, {
          account_id: user.account_id,
          work_order_id: existingOrder._id,
          work_order_no: existingOrder.order_no,
          location_id: updatedData.wo_location_id || existingOrder.wo_location_id,
          previous_status: existingOrder.status,
          next_status: updatedData.status || existingOrder.status,
          note: 'Work order parts updated'
        });
        updatedData.inventoryWarnings = inventoryResult.warnings;
      } else if (body.hasOwnProperty('status') && Array.isArray(updatedData.parts)) {
        const normalizedParts = partsService.normalizeWorkOrderParts(updatedData.parts, updatedData.status || existingOrder.status);
        await partsService.validateInventoryByWorkOrder(
          existingOrder.parts || [],
          normalizedParts,
          existingOrder.status,
          updatedData.status || existingOrder.status,
          session
        );
        updatedData.parts = normalizedParts;
        const inventoryResult = await partsService.adjustInventoryByWorkOrder(existingOrder.parts || [], normalizedParts, user, session, {
          account_id: user.account_id,
          work_order_id: existingOrder._id,
          work_order_no: existingOrder.order_no,
          location_id: updatedData.wo_location_id || existingOrder.wo_location_id,
          previous_status: existingOrder.status,
          next_status: updatedData.status || existingOrder.status,
          note: `Work order status changed to ${updatedData.status || existingOrder.status}`
        });
        updatedData.inventoryWarnings = inventoryResult.warnings;
      }
      
      updatedData.updatedBy = user._id;
      if (body.hasOwnProperty('userIdList')) {
        await userWorkOrderService.updateMappedUsers(id, body.userIdList, session);
      }
      if (body.hasOwnProperty('procedure_ids') || body.hasOwnProperty('procedure_entries')) {
        const procedureSync = await this.syncProcedureEntries(updatedData, user.account_id, user, existingOrder.procedure_entries || []);
        updatedData.procedure_ids = procedureSync.procedure_ids;
        updatedData.procedure_entries = procedureSync.procedure_entries;
      }
      if (body.hasOwnProperty('excluded_procedure_part_ids')) {
        updatedData.excluded_procedure_part_ids = this.normalizeObjectIdArray(body.excluded_procedure_part_ids);
      }
      
      updatedData = this.normalizeNatureOfWorkPayload(this.normalizeTimingFields(this.sanitizeWorkOrder(updatedData)));
      updatedData = this.syncStatusDetailAuditFields(this.syncCompletionAuditFields(updatedData, existingOrder.status, user), user);
      delete updatedData.sync_version;
      const updateFilter: any = { _id: id };
      if (expectedVersion !== undefined) updateFilter.sync_version = expectedVersion;
      const data = await WorkOrderModel.findOneAndUpdate(updateFilter, updatedData, { returnDocument: 'after', session });
      if (!data) {
        if (expectedVersion !== undefined) {
          throw createSyncConflict(await WorkOrderModel.findById(id).session(session));
        }
        throw Object.assign(new Error('Failed to update work order'), { status: 400 });
      }
      await this.logWorkOrderUpdateActivities(existingOrderSnapshot, data?.toObject ? data.toObject() : data, body, user, session, beforeAssignedUserIds);
      
      let responseData: any = null;
      try {
        const resultData = await this.getAllOrders({ _id: id, account_id: user.account_id, visible: true }, session);
        responseData = resultData[0];
      } catch (readError: any) {
        applicationLogger.warn('Failed to fetch enriched work order after update, returning saved document instead:', readError?.message || readError);
        responseData = data?.toObject ? data.toObject() : data;
      }
      await notificationService.queueAccountNotification({
        accountId: String(user.account_id),
        module: 'Work Order',
        event: 'updated',
        entityId: String(id),
        entityName: responseData?.title || responseData?.order_no || 'Work Order',
        actionUrl: `/work-order/details/${id}`,
        sourceUserId: String(user._id)
      }, {
        session,
        ...(correlationId ? { correlationId } : {})
      });
      return responseData;
    });
  };

  async updateDataById(id: any, body: any, user: IUser): Promise<any> {
    const existingOrder = await WorkOrderModel.findById(id);
    let sanitizedBody = this.normalizeNatureOfWorkPayload(this.normalizeTimingFields(this.sanitizeWorkOrder({ ...body, updatedBy: user._id })));
    if (existingOrder) {
      sanitizedBody = this.syncStatusDetailAuditFields(this.syncCompletionAuditFields({ ...existingOrder.toObject(), ...sanitizedBody }, existingOrder.status, user), user);
    }
    const updatedOrder = await WorkOrderModel.findByIdAndUpdate(id, sanitizedBody, { returnDocument: 'after' });

    if (existingOrder && updatedOrder && Object.prototype.hasOwnProperty.call(body || {}, 'files')) {
      const beforeFiles = Array.isArray(existingOrder.files) ? existingOrder.files : [];
      const afterFiles = Array.isArray(updatedOrder.files) ? updatedOrder.files : [];
      const existingFileNames = new Set(beforeFiles.map((file: any) => String(file?.fileName || file?.originalName || '').trim()).filter(Boolean));
      const addedFiles = afterFiles.filter((file: any) => {
        const fileName = String(file?.fileName || file?.originalName || '').trim();
        return fileName && !existingFileNames.has(fileName);
      });

      if (addedFiles.length > 0) {
        await workOrderActivityService.logActivity({
          account_id: user.account_id,
          work_order_id: id,
          workOrder: updatedOrder,
          action_type: 'attachments-added',
          note: `Added ${addedFiles.length} attachment${addedFiles.length === 1 ? '' : 's'} to the work order.`,
          metadata: {
            count: addedFiles.length,
            file_names: addedFiles.map((file: any) => file?.originalName || file?.fileName || 'Attachment')
          },
          actor: user
        });
      }
    }

    return updatedOrder;
  };

  async orderStatusChange(
    id: string,
    status: string,
    user: IUser,
    blockReason?: string | null,
    expectedVersion?: number,
    correlationId?: string
  ): Promise<any> {
    const orderId = helperService.validateObjectId(id);
    const orders = await this.getAllOrders({ _id: orderId, account_id: user.account_id, visible: true });
    const existingOrder = orders[0];
    assertSyncVersion(existingOrder, expectedVersion);
    const hierarchy = existingOrder?.hierarchy || {};
    const previousParts = JSON.parse(JSON.stringify(existingOrder.parts || []));
    const blockedStatuses = ['Blocked', 'Waiting-on-Parts', 'Waiting-on-Permit'];
    const isBlockedStatus = blockedStatuses.includes(status);
    const normalizedBlockReason = typeof blockReason === 'string' ? blockReason.trim() : '';

    if (isBlockedStatus && !normalizedBlockReason) {
      throw Object.assign(new Error('A reason is required for this status'), { status: 400 });
    }

    if (hierarchy?.executionOwnedByChildren && status === 'In-Progress') {
      throw Object.assign(new Error('Start child work orders to begin execution. Parent work orders roll up child progress.'), { status: 400 });
    }

    if (hierarchy?.executionOwnedByChildren && status === 'Completed' && Number(hierarchy?.childStatusSummary?.completed || 0) !== Number(hierarchy?.childStatusSummary?.total || 0)) {
      throw Object.assign(new Error('All child work orders must be completed before the parent work order can be closed.'), { status: 400 });
    }

    if (status === 'Completed') {
      const incompleteProcedures = (existingOrder.procedures || []).filter((procedure: any) => !this.areProcedureStepsComplete(procedure?.steps || [], procedure?.responses || {}));
      if (incompleteProcedures.length > 0) {
        throw Object.assign(new Error('Attached procedures must be completed before closing this work order'), { status: 400 });
      }
      if (existingOrder.parts?.length > 0) {
        existingOrder.parts = existingOrder.parts.map((part: any) => ({
          ...part,
          actualQuantity: part.actualQuantity || part.estimatedQuantity
        }));
      }
      if (!existingOrder.actual_start_date) {
        existingOrder.actual_start_date = existingOrder.start_date || new Date();
      }
      if (!existingOrder.actual_end_date) {
        existingOrder.actual_end_date = new Date();
      }
      if (existingOrder.actual_start_date && existingOrder.actual_end_date && !(Number(existingOrder.actual_time) > 0)) {
        const startTime = new Date(existingOrder.actual_start_date).getTime();
        const endTime = new Date(existingOrder.actual_end_date).getTime();
        if (endTime >= startTime) {
          existingOrder.actual_time = Number((((endTime - startTime) / 3600000)).toFixed(2));
        }
      }
      existingOrder.completed_at = existingOrder.actual_end_date ? new Date(existingOrder.actual_end_date) : new Date();
      existingOrder.completed_by = this.buildCompletedByPayload(user);
    } else if (status === 'In-Progress' && !existingOrder.actual_start_date) {
        existingOrder.actual_start_date = new Date();
      existingOrder.completed_at = null;
      existingOrder.completed_by = null;
    } else if (status === 'Open') {
      existingOrder.completed_at = null;
      existingOrder.completed_by = null;
    } else if (status !== 'Completed') {
      existingOrder.completed_at = null;
      existingOrder.completed_by = null;
    }

    if (isBlockedStatus) {
      existingOrder.block_reason = normalizedBlockReason;
    } else if (status !== 'On-Hold') {
      existingOrder.block_reason = null;
    }

    const statusEntry = { status, createdBy: user._id, createdAt: new Date() };
    const statusDetails = [...(existingOrder.status_details || []), statusEntry];
    const lifecycleParts = partsService.normalizeWorkOrderParts(existingOrder.parts || [], status);
    const data = await withTransaction(async (session) => {
      const inventoryResult = await partsService.adjustInventoryByWorkOrder(previousParts, lifecycleParts, user, session, {
        account_id: user.account_id,
        work_order_id: existingOrder._id,
        work_order_no: existingOrder.order_no,
        location_id: existingOrder.wo_location_id,
        previous_status: existingOrder.status,
        next_status: status,
        note: `Work order status moved to ${status}`
      });

      const statusFilter: any = { _id: id };
      if (expectedVersion !== undefined) statusFilter.sync_version = expectedVersion;
      const updatedOrder = await WorkOrderModel.findOneAndUpdate(
        statusFilter,
        {
          status,
          updatedBy: user._id,
          status_details: statusDetails,
          parts: lifecycleParts,
          actual_start_date: existingOrder.actual_start_date,
          actual_end_date: existingOrder.actual_end_date,
          completed_at: existingOrder.completed_at,
          completed_by: existingOrder.completed_by,
          actual_time: existingOrder.actual_time,
          block_reason: existingOrder.block_reason
        },
        { returnDocument: 'after', session }
      );
      if (!updatedOrder && expectedVersion !== undefined) {
        throw createSyncConflict(await WorkOrderModel.findById(id).session(session));
      }
      if (updatedOrder) {
        (updatedOrder as any).inventoryWarnings = inventoryResult.warnings;
        await workOrderActivityService.logActivity({
          account_id: user.account_id,
          work_order_id: id,
          workOrder: updatedOrder,
          action_type: 'status-changed',
          note: `Status changed from ${existingOrder.status} to ${status}.${existingOrder.block_reason ? ` Reason: ${existingOrder.block_reason}` : ''}`,
          metadata: {
            from_status: existingOrder.status,
            to_status: status,
            block_reason: existingOrder.block_reason || null
          },
          actor: user
        }, session);
        await notificationService.queueAccountNotification({
          accountId: String(user.account_id),
          module: 'Work Order',
          event: 'updated',
          entityId: String(id),
          entityName: updatedOrder.title || updatedOrder.order_no || 'Work Order',
          actionUrl: `/work-order/details/${id}`,
          sourceUserId: String(user._id)
        }, {
          session,
          ...(correlationId ? { correlationId } : {})
        });
      }
      return updatedOrder;
    });
    return data;
  }

  async removeOrder(id: any, user: any): Promise<any> {
    return await withTransaction(async (session) => {
      await userWorkOrderService.removeMappedUsers(id, session);
      const order: any = await WorkOrderModel.findById(id).session(session).lean();
      if (order?.parts?.length > 0) {
        await partsService.adjustInventoryByWorkOrder(order.parts, [], { _id: user?._id || user }, session, {
          account_id: order.account_id,
          work_order_id: order._id,
          work_order_no: order.order_no,
          location_id: order.wo_location_id,
          previous_status: order.status,
          next_status: 'Open',
          note: 'Work order removed and reservations reversed'
        });
      }
      await workOrderActivityService.logActivity({
        account_id: order?.account_id,
        work_order_id: order?._id,
        workOrder: order,
        action_type: 'deleted',
        note: 'Work order removed from the active list.',
        actor: user
      }, session);
      return await WorkOrderModel.findByIdAndUpdate(id, { visible: false, updatedBy: user?._id || user }, { returnDocument: 'after', session });
    });
  };

  async deleteWorkOrderById(id: any, user: any): Promise<any> {
    return await withTransaction(async (session) => {
      await userWorkOrderService.removeMappedUsers(id, session);
      const order: any = await WorkOrderModel.findById(id).session(session).lean();
      if (order?.parts?.length > 0) {
        await partsService.adjustInventoryByWorkOrder(order.parts, [], { _id: user?._id || user }, session, {
          account_id: order.account_id,
          work_order_id: order._id,
          work_order_no: order.order_no,
          location_id: order.wo_location_id,
          previous_status: order.status,
          next_status: 'Open',
          note: 'Work order deleted and reservations reversed'
        });
      }
      await workOrderActivityService.logActivity({
        account_id: order?.account_id,
        work_order_id: order?._id,
        workOrder: order,
        action_type: 'deleted',
        note: 'Work order permanently deleted.',
        actor: user
      }, session);
      return await WorkOrderModel.findByIdAndDelete(id, { session });
    });
  }

  async getHistory(id: string): Promise<any> {
    const objectId = helperService.validateObjectId(id);
    const HistoryModel = (WorkOrderModel as any).getHistoryModel();
    const pipeline = this.getWorkOrderPipeline({ original_id: objectId });
    pipeline.push({ $sort: { history_created_at: -1 } });
    const history = await HistoryModel.aggregate(pipeline);
    if (!history || history.length === 0) {
      throw Object.assign(new Error('No history found for this work order'), { status: 404 });
    }
    return history;
  }

  async getActivity(id: string, account_id: any): Promise<any> {
    const activity = await workOrderActivityService.getActivityHistory(id, account_id);
    if (!activity || activity.length === 0) {
      return [];
    }
    return activity;
  }
}

export const orderService = new OrderService();
