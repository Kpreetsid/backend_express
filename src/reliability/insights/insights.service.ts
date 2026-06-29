import { Types } from 'mongoose';
import { ReliabilityCaseModel } from '../../models/reliabilityCase.model';
import { AssetModel } from '../../models/asset.model';
import { applyRoleFilter } from '../../utils/roleFilter';
import { ReliabilityCaseActor } from '../case/case.types';

class ReliabilityInsightsService {
  async getSummary(user: ReliabilityCaseActor, query: Record<string, unknown>) {
    const match = await this.buildMatch(user, query);
    const [
      totals,
      statusBreakdown,
      riskBreakdown,
      effectivenessBreakdown,
      topFailureModes,
      recentLearning,
      attentionQueue
    ] = await Promise.all([
      ReliabilityCaseModel.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            total_cases: { $sum: 1 },
            open_cases: { $sum: { $cond: [{ $in: ['$status', ['open', 'triaged', 'diagnosed', 'recommendation_ready', 'approval_pending', 'approved', 'work_order_created', 'in_progress', 'feedback_pending', 'snoozed']] }, 1, 0] } },
            closed_cases: { $sum: { $cond: [{ $eq: ['$status', 'closed'] }, 1, 0] } },
            rejected_cases: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } },
            high_risk_open_cases: {
              $sum: {
                $cond: [
                  { $and: [{ $in: ['$risk_level', ['High', 'Urgent']] }, { $not: { $in: ['$status', ['closed', 'rejected']] } }] },
                  1,
                  0
                ]
              }
            },
            approval_pending_cases: { $sum: { $cond: [{ $eq: ['$status', 'approval_pending'] }, 1, 0] } },
            feedback_pending_cases: { $sum: { $cond: [{ $eq: ['$status', 'feedback_pending'] }, 1, 0] } },
            linked_work_orders: { $sum: { $cond: [{ $ifNull: ['$linked_work_order_id', false] }, 1, 0] } },
            avg_downtime_hours: { $avg: '$technician_feedback.downtime_hours' },
            estimated_downtime_cost: { $sum: { $ifNull: ['$recommendation_snapshot.business_impact.downtime_cost', 0] } },
            estimated_cost_of_delay: { $sum: { $ifNull: ['$recommendation_snapshot.business_impact.cost_of_delay', 0] } }
          }
        },
        { $project: { _id: 0 } }
      ]),
      this.breakdown(match, 'status'),
      this.breakdown(match, 'risk_level'),
      this.breakdown(match, 'technician_feedback.effectiveness'),
      this.failureModeBreakdown(match, 5),
      this.recentLearning(match),
      this.attentionQueue(match)
    ]);

    return {
      ...(totals[0] || this.emptyTotals()),
      status_breakdown: statusBreakdown,
      risk_breakdown: riskBreakdown,
      effectiveness_breakdown: effectivenessBreakdown,
      top_failure_modes: topFailureModes,
      recent_learning: recentLearning,
      attention_queue: attentionQueue
    };
  }

  async getFailureLibrary(user: ReliabilityCaseActor, query: Record<string, unknown>) {
    const match = await this.buildMatch(user, { ...query, status: 'closed' });
    return await ReliabilityCaseModel.aggregate([
      { $match: match },
      {
        $lookup: {
          from: AssetModel.collection.name,
          let: { assetId: '$asset_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$assetId'] }, visible: true } },
            { $project: { asset_name: 1, asset_type: 1 } }
          ],
          as: 'asset'
        }
      },
      { $unwind: { path: '$asset', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          failure_mode_key: { $ifNull: ['$closure.final_failure_mode', { $ifNull: ['$diagnosis_snapshot.likely_failure_mode', 'Unclassified'] }] },
          root_cause_key: { $ifNull: ['$closure.final_root_cause', { $ifNull: ['$technician_feedback.root_cause', 'Unknown'] }] },
          asset_type_key: { $ifNull: ['$asset.asset_type', 'Unknown'] }
        }
      },
      {
        $group: {
          _id: {
            failure_mode: '$failure_mode_key',
            root_cause: '$root_cause_key',
            asset_type: '$asset_type_key'
          },
          case_count: { $sum: 1 },
          avg_downtime_hours: { $avg: '$technician_feedback.downtime_hours' },
          resolved_count: { $sum: { $cond: [{ $eq: ['$technician_feedback.effectiveness', 'resolved'] }, 1, 0] } },
          improved_count: { $sum: { $cond: [{ $eq: ['$technician_feedback.effectiveness', 'improved'] }, 1, 0] } },
          last_closed_at: { $max: '$closure.closedAt' },
          preventive_actions: { $addToSet: '$closure.preventive_actions' },
          lessons_learned: { $addToSet: '$closure.lessons_learned' },
          sample_cases: {
            $push: {
              id: '$_id',
              case_no: '$case_no',
              title: '$title',
              asset_name: '$asset.asset_name',
              closed_at: '$closure.closedAt'
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          failure_mode: '$_id.failure_mode',
          root_cause: '$_id.root_cause',
          asset_type: '$_id.asset_type',
          case_count: 1,
          avg_downtime_hours: { $round: [{ $ifNull: ['$avg_downtime_hours', 0] }, 2] },
          resolved_count: 1,
          improved_count: 1,
          last_closed_at: 1,
          preventive_actions: { $slice: [{ $reduce: { input: '$preventive_actions', initialValue: [], in: { $setUnion: ['$$value', '$$this'] } } }, 8] },
          lessons_learned: { $slice: [{ $reduce: { input: '$lessons_learned', initialValue: [], in: { $setUnion: ['$$value', '$$this'] } } }, 8] },
          sample_cases: { $slice: ['$sample_cases', 5] }
        }
      },
      { $sort: { case_count: -1, last_closed_at: -1 } },
      { $limit: this.limit(query.limit, 50) }
    ]);
  }

  private async buildMatch(user: ReliabilityCaseActor, query: Record<string, unknown>) {
    const baseFilter: Record<string, any> = {};
    const status = this.stringQuery(query.status);
    const riskLevel = this.stringQuery(query.risk_level);
    const assetId = this.stringQuery(query.asset_id);
    const fromDate = this.toDate(query.fromDate);
    const toDate = this.toDate(query.toDate);

    if (status) baseFilter.status = { $in: status.split(',').map((item) => item.trim()).filter(Boolean) };
    if (riskLevel) baseFilter.risk_level = { $in: riskLevel.split(',').map((item) => item.trim()).filter(Boolean) };
    if (assetId && Types.ObjectId.isValid(assetId)) baseFilter.asset_id = new Types.ObjectId(assetId);
    if (fromDate || toDate) {
      baseFilter.createdAt = {};
      if (fromDate) baseFilter.createdAt.$gte = fromDate;
      if (toDate) baseFilter.createdAt.$lte = toDate;
    }

    return await applyRoleFilter({
      user: user as any,
      baseFilter,
      accountField: 'account_id',
      mapping: 'asset',
      idField: 'asset_id'
    });
  }

  private async breakdown(match: Record<string, unknown>, field: string) {
    return await ReliabilityCaseModel.aggregate([
      { $match: match },
      { $group: { _id: `$${field}`, count: { $sum: 1 } } },
      { $project: { _id: 0, label: { $ifNull: ['$_id', 'Unspecified'] }, count: 1 } },
      { $sort: { count: -1, label: 1 } }
    ]);
  }

  private async failureModeBreakdown(match: Record<string, unknown>, limit: number) {
    return await ReliabilityCaseModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $ifNull: ['$closure.final_failure_mode', { $ifNull: ['$diagnosis_snapshot.likely_failure_mode', 'Unclassified'] }] },
          count: { $sum: 1 },
          open_count: { $sum: { $cond: [{ $not: { $in: ['$status', ['closed', 'rejected']] } }, 1, 0] } }
        }
      },
      { $project: { _id: 0, failure_mode: '$_id', count: 1, open_count: 1 } },
      { $sort: { count: -1 } },
      { $limit: limit }
    ]);
  }

  private async recentLearning(match: Record<string, unknown>) {
    return await ReliabilityCaseModel.aggregate([
      { $match: { ...match, status: 'closed', closure: { $exists: true } } },
      { $sort: { 'closure.closedAt': -1 } },
      {
        $project: {
          _id: 1,
          id: '$_id',
          case_no: 1,
          title: 1,
          final_failure_mode: '$closure.final_failure_mode',
          final_root_cause: '$closure.final_root_cause',
          lessons_learned: '$closure.lessons_learned',
          preventive_actions: '$closure.preventive_actions',
          closed_at: '$closure.closedAt'
        }
      },
      { $limit: 8 }
    ]);
  }

  private async attentionQueue(match: Record<string, unknown>) {
    const staleBefore = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return await ReliabilityCaseModel.aggregate([
      {
        $match: {
          ...match,
          status: { $nin: ['closed', 'rejected'] },
          $or: [
            { risk_level: { $in: ['High', 'Urgent'] } },
            { status: { $in: ['approval_pending', 'feedback_pending'] } },
            { updatedAt: { $lte: staleBefore } }
          ]
        }
      },
      {
        $lookup: {
          from: AssetModel.collection.name,
          let: { assetId: '$asset_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$assetId'] }, visible: true } },
            { $project: { asset_name: 1 } }
          ],
          as: 'asset'
        }
      },
      { $unwind: { path: '$asset', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          attention_reason: {
            $switch: {
              branches: [
                { case: { $eq: ['$status', 'approval_pending'] }, then: 'Approval pending' },
                { case: { $eq: ['$status', 'feedback_pending'] }, then: 'Feedback pending' },
                { case: { $in: ['$risk_level', ['High', 'Urgent']] }, then: 'High-risk open case' },
                { case: { $lte: ['$updatedAt', staleBefore] }, then: 'No update in 24h' }
              ],
              default: 'Needs attention'
            }
          },
          attention_rank: {
            $switch: {
              branches: [
                { case: { $eq: ['$risk_level', 'Urgent'] }, then: 1 },
                { case: { $eq: ['$status', 'approval_pending'] }, then: 2 },
                { case: { $eq: ['$risk_level', 'High'] }, then: 3 },
                { case: { $eq: ['$status', 'feedback_pending'] }, then: 4 }
              ],
              default: 5
            }
          }
        }
      },
      {
        $project: {
          _id: 1,
          id: '$_id',
          case_no: 1,
          title: 1,
          status: 1,
          risk_level: 1,
          updatedAt: 1,
          asset_name: '$asset.asset_name',
          attention_reason: 1,
          attention_rank: 1
        }
      },
      { $sort: { attention_rank: 1, updatedAt: 1 } },
      { $limit: 8 }
    ]);
  }

  private emptyTotals() {
    return {
      total_cases: 0,
      open_cases: 0,
      closed_cases: 0,
      rejected_cases: 0,
      high_risk_open_cases: 0,
      approval_pending_cases: 0,
      feedback_pending_cases: 0,
      linked_work_orders: 0,
      avg_downtime_hours: 0,
      estimated_downtime_cost: 0,
      estimated_cost_of_delay: 0
    };
  }

  private stringQuery(value: unknown): string | undefined {
    if (typeof value === 'string' && value.trim()) return value.trim();
    return undefined;
  }

  private toDate(value: unknown): Date | undefined {
    if (typeof value !== 'string' || !value.trim()) return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  private limit(value: unknown, fallback: number): number {
    const parsed = Number(value || fallback);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.min(parsed, 200);
  }
}

export const reliabilityInsightsService = new ReliabilityInsightsService();
