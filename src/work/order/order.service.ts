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

export interface WorkOrderSearchParams {
  account_id: any;
  user_id: string;
  user_role: string;
  query: {
    status?: any;
    priority?: any;
    wo_asset_id?: any;
    wo_location_id?: any;
    assignedUser?: any;
    pageTYPE?: string; // assignedToMe, createdByMe, openToAll
    order_no?: string;
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
          from: "wo_user_mapping",
          let: { woId: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$woId", "$$woId"] } } },
            {
              $lookup: {
                from: "users",
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
          from: "work_orders",
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
          from: "work_orders",
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
                start_date: 1,
                end_date: 1,
                estimated_time: 1,
                actual_time: 1,
                wo_asset_id: 1,
                wo_location_id: 1,
                parts: 1,
                labor_entries: 1,
                procedure_ids: 1,
                procedure_entries: 1
              }
            }
          ],
          as: "childOrders"
        }
      },
      {
        $lookup: {
          from: "asset_master",
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
          from: "location_master",
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
          from: "sops",
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
          from: "procedures",
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
          from: "users",
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
          from: "users",
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
          from: "users",
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
          from: "users",
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
          from: "users",
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
          from: "mst_part_types",
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
          from: "parts",
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
          from: "inventory_movements",
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

    if (query.status) match.status = { $in: query.status.toString().split(',') };
    if (query.priority) match.priority = { $in: query.priority.toString().split(',') };
    if (query.wo_asset_id) match.wo_asset_id = { $in: helperService.validateObjectIds(query.wo_asset_id.toString()) };
    if (query.wo_location_id) match.wo_location_id = { $in: helperService.validateObjectIds(query.wo_location_id.toString()) };
    if (query.order_no) match.order_no = query.order_no;

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

  async countOrders(match: any) {
    return await WorkOrderModel.countDocuments(match);
  }

  async getAllWorkOrders(match: any, skip: number = 0, limit: number = 25) {
    const pipeline: any[] = this.getWorkOrderPipeline(match);
    pipeline.push({ $sort: { createdAt: -1 } });
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: limit });

    const data = await WorkOrderModel.aggregate(pipeline);

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

      const workRequestCount = await requestService.countRequests(workRequestMatch);

      const plannedUnplannedRatio = totalCount ? (plannedCount / totalCount) * 100 : 0;
      const completionRate = totalCount ? (completedOnTimeCount / totalCount) * 100 : 0;

      return {
        completion_rate: Number(completionRate.toFixed(2)),
        overdue_WO: overdueCount,
        work_request_count: workRequestCount,
        planned_unplanned_ratio: Number(plannedUnplannedRatio.toFixed(2))
      };
    } catch (err) {
      console.error("summaryData error:", err);
      throw err;
    }
  };

  async generateOrderNo(account_id: any): Promise<string> {
    const year = new Date().getFullYear();
    const totalCount = await WorkOrderModel.countDocuments({ account_id, createdAt: { $gte: new Date(`${year}-01-01T00:00:00Z`), $lte: new Date(`${year}-12-31T23:59:59Z`) } });
    const sequence = String(totalCount + 1).padStart(4, "0");
    return `WO-${year}${sequence}`;
  };

  async createWorkOrder(body: any, user: IUser): Promise<any> {
    return await withTransaction(async (session) => {
      let normalizedBody = this.normalizeTimingFields(this.sanitizeWorkOrder({ ...body }));
      this.validateIncomingParts(normalizedBody.parts || []);
      let userIdList = Array.isArray(normalizedBody.userIdList) ? normalizedBody.userIdList.filter((userId: string) => !!userId) : [];

      if (normalizedBody.parentId) {
        const parentOrder = await this.getParentOrderForInheritance(normalizedBody.parentId, user.account_id, session);
        if (!parentOrder) {
          throw Object.assign(new Error('Parent work order not found'), { status: 404 });
        }
        const parentAssignedUserIds = await this.getAssignedUserIdsForWorkOrder(parentOrder._id, session);
        const inheritedState = this.applyParentInheritance(normalizedBody, parentOrder, parentAssignedUserIds);
        normalizedBody = inheritedState.normalizedBody;
        userIdList = inheritedState.userIdList;
      }

      const procedureSync = await this.syncProcedureEntries(normalizedBody, user.account_id, user, []);
      let linkedRequest: any = null;
      if (normalizedBody.work_request_id) {
        linkedRequest = await requestService.getRequestById(String(normalizedBody.work_request_id));
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

      const newAsset = new WorkOrderModel({
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
        sop_form_id: normalizedBody.sop_form_id,
        procedure_ids: procedureSync.procedure_ids,
        procedure_entries: procedureSync.procedure_entries,
        rescheduleEnabled: false,
        created_by: user._id,
        wo_asset_id: normalizedBody.wo_asset_id,
        wo_location_id: normalizedBody.wo_location_id,
        end_date: normalizedBody.end_date,
        start_date: normalizedBody.start_date,
        sopForm: normalizedBody.sopForm,
        createdFrom: normalizedBody.createdFrom,
        files: normalizedBody.files,
        tasks: normalizedBody.tasks,
        parts: partsService.normalizeWorkOrderParts(normalizedBody.parts || [], normalizedBody.status),
        labor_entries: normalizedBody.labor_entries,
        work_request_id: normalizedBody.work_request_id,
        asset_report_id: normalizedBody.asset_report_id,
        status_details: [{ status: normalizedBody.status, createdBy: user._id }],
        createdBy: user._id
      });

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
      }

      if (linkedRequest) {
        await requestService.markConverted(String(linkedRequest._id), {
          workOrderId: data._id,
          orderNo: data.order_no,
          priority: linkedRequest.priority,
          approvedBy: linkedRequest.approvedBy || user._id,
          approvedAt: linkedRequest.approvedAt,
          convertedBy: user._id
        }, session);
      }
      
      if (userDetails.length > 0) {
        userDetails.forEach(async (assignedUsers: IUser) => {
          try {
            const orders = await this.getAllOrders({ _id: data._id, account_id: user.account_id, visible: true }, session);
            await this.mailerService.sendWorkOrderMail(orders[0], assignedUsers, user);
          } catch (mailError: any) {
            console.warn('Failed to prepare work order mail payload after create:', mailError?.message || mailError);
          }
        });
      }
      
      await notificationService.notifyAccountUsers({
        accountId: String(user.account_id),
        module: 'Work Order',
        event: 'created',
        entityId: String(data._id),
        entityName: data.title || data.order_no || 'Work Order',
        actionUrl: `/work-order/details/${data._id}`,
        sourceUserId: String(user._id)
      });
      
      try {
        const resultData = await this.getAllOrders({ _id: data._id, account_id: user.account_id, visible: true }, session);
        return resultData[0];
      } catch (readError: any) {
        console.warn('Failed to fetch enriched work order after create, returning saved document instead:', readError?.message || readError);
        return data?.toObject ? data.toObject() : data;
      }
    });
  };

  async updateById(id: any, body: any, user: IUser): Promise<any> {
    return await withTransaction(async (session) => {
      let existingOrder: any = await WorkOrderModel.findById(id).session(session);
      if (!existingOrder) {
        throw Object.assign(new Error('Work Order not found'), { status: 404 });
      }

      const childCount = await this.getChildOrderCount(id, session);
      if (childCount > 0 && this.hasExecutionOwnedFieldChanges(body)) {
        throw Object.assign(new Error('Parts, procedures, labor, and actual execution data are tracked on child work orders for parent work orders.'), { status: 400 });
      }
      if (childCount > 0 && Object.prototype.hasOwnProperty.call(body || {}, 'status')) {
        const requestedStatus = String(body?.status || '').trim();
        if (['In-Progress', 'Completed'].includes(requestedStatus)) {
          throw Object.assign(new Error('Move child work orders through execution. Parent work orders roll up child progress.'), { status: 400 });
        }
      }
      
      let updatedData = { ...existingOrder.toObject(), ...body };
      if (body.hasOwnProperty('parts')) {
        this.validateIncomingParts(body.parts || []);
      }
      
      if (body.hasOwnProperty('parts')) {
        const normalizedParts = partsService.normalizeWorkOrderParts(body.parts || [], updatedData.status || existingOrder.status);
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

      updatedData = this.normalizeTimingFields(this.sanitizeWorkOrder(updatedData));
      const data = await WorkOrderModel.findByIdAndUpdate(id, updatedData, { returnDocument: 'after', session });
      if (!data) {
        throw Object.assign(new Error('Failed to update work order'), { status: 400 });
      }
      
      let responseData: any = null;
      try {
        const resultData = await this.getAllOrders({ _id: id, account_id: user.account_id, visible: true }, session);
        responseData = resultData[0];
      } catch (readError: any) {
        console.warn('Failed to fetch enriched work order after update, returning saved document instead:', readError?.message || readError);
        responseData = data?.toObject ? data.toObject() : data;
      }
      await notificationService.notifyAccountUsers({
        accountId: String(user.account_id),
        module: 'Work Order',
        event: 'updated',
        entityId: String(id),
        entityName: responseData?.title || responseData?.order_no || 'Work Order',
        actionUrl: `/work-order/details/${id}`,
        sourceUserId: String(user._id)
      });
      return responseData;
    });
  };

  async updateDataById(id: any, body: any, user: IUser): Promise<any> {
    const sanitizedBody = this.normalizeTimingFields(this.sanitizeWorkOrder({ ...body, updatedBy: user._id }));
    return await WorkOrderModel.findByIdAndUpdate(id, sanitizedBody, { returnDocument: 'after' });
  };

  async orderStatusChange(id: string, status: string, user: IUser, blockReason?: string | null): Promise<any> {
    const orderId = helperService.validateObjectId(id);
    const orders = await this.getAllOrders({ _id: orderId, account_id: user.account_id, visible: true });
    const existingOrder = orders[0];
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
      if (existingOrder.sop_form_id && !existingOrder.sop_form_submitted) {
        throw Object.assign(new Error('Form is not completed'), { status: 400 });
      }
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
      } else if (status === 'In-Progress' && !existingOrder.actual_start_date) {
        existingOrder.actual_start_date = new Date();
      } else if (status === 'Open') {
      existingOrder.sop_form_submitted = false;
      existingOrder.sop_form_updated_by = null;
      existingOrder.sop_form_updated_at = null;
    }

    if (isBlockedStatus) {
      existingOrder.block_reason = normalizedBlockReason;
    } else if (status !== 'On-Hold') {
      existingOrder.block_reason = null;
    }

    const statusEntry = { status, createdBy: user._id, createdAt: new Date() };
    const statusDetails = [...(existingOrder.status_details || []), statusEntry];
    const lifecycleParts = partsService.normalizeWorkOrderParts(existingOrder.parts || [], status);
    const inventoryResult = await partsService.adjustInventoryByWorkOrder(previousParts, lifecycleParts, user, undefined, {
      account_id: user.account_id,
      work_order_id: existingOrder._id,
      work_order_no: existingOrder.order_no,
      location_id: existingOrder.wo_location_id,
      previous_status: existingOrder.status,
      next_status: status,
      note: `Work order status moved to ${status}`
    });

    const data = await WorkOrderModel.findByIdAndUpdate(
      id,
      { 
        status, 
        updatedBy: user._id, 
        status_details: statusDetails, 
        parts: lifecycleParts,
        actual_start_date: existingOrder.actual_start_date,
        actual_end_date: existingOrder.actual_end_date,
        actual_time: existingOrder.actual_time,
        block_reason: existingOrder.block_reason,
        sop_form_submitted: existingOrder.sop_form_submitted,
        sop_form_updated_by: existingOrder.sop_form_updated_by,
        sop_form_updated_at: existingOrder.sop_form_updated_at
      },
      { returnDocument: 'after' }
    );
    if (data) {
      (data as any).inventoryWarnings = inventoryResult.warnings;
    }
    if (data) {
      await notificationService.notifyAccountUsers({
        accountId: String(user.account_id),
        module: 'Work Order',
        event: 'updated',
        entityId: String(id),
        entityName: data.title || data.order_no || 'Work Order',
        actionUrl: `/work-order/details/${id}`,
        sourceUserId: String(user._id)
      });
    }
    return data;
  }

  async removeOrder(id: any, user_id: any): Promise<any> {
    return await withTransaction(async (session) => {
      await userWorkOrderService.removeMappedUsers(id, session);
      const order: any = await WorkOrderModel.findById(id).session(session).lean();
      if (order?.parts?.length > 0) {
        await partsService.adjustInventoryByWorkOrder(order.parts, [], { _id: user_id }, session, {
          account_id: order.account_id,
          work_order_id: order._id,
          work_order_no: order.order_no,
          location_id: order.wo_location_id,
          previous_status: order.status,
          next_status: 'Open',
          note: 'Work order removed and reservations reversed'
        });
      }
      return await WorkOrderModel.findByIdAndUpdate(id, { visible: false, updatedBy: user_id }, { returnDocument: 'after', session });
    });
  };

  async deleteWorkOrderById(id: any, user_id: any): Promise<any> {
    return await withTransaction(async (session) => {
      await userWorkOrderService.removeMappedUsers(id, session);
      const order: any = await WorkOrderModel.findById(id).session(session).lean();
      if (order?.parts?.length > 0) {
        await partsService.adjustInventoryByWorkOrder(order.parts, [], { _id: user_id }, session, {
          account_id: order.account_id,
          work_order_id: order._id,
          work_order_no: order.order_no,
          location_id: order.wo_location_id,
          previous_status: order.status,
          next_status: 'Open',
          note: 'Work order deleted and reservations reversed'
        });
      }
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
}

export const orderService = new OrderService();
