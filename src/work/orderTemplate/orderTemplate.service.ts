import mongoose from 'mongoose';
import { AssetModel } from '../../models/asset.model';
import { LocationModel } from '../../models/location.model';
import { PartsModel } from '../../models/part.model';
import { ProcedureModel } from '../../models/procedure.model';
import { UserModel } from '../../models/user.model';
import { WorkOrderTemplateModel } from '../../models/workOrderTemplate.model';
import { helperService } from '../../utils/helper';
import { requireTenantReferenceIds } from '../../utils/tenant-references';

class OrderTemplateService {
  async getAllTemplates(match: any): Promise<any[]> {
    const templates = await WorkOrderTemplateModel.find({
      ...match,
      visible: true
    }).sort({ updatedAt: -1, createdAt: -1 }).lean();

    return this.enrichTemplates(templates, match.account_id);
  }

  async getTemplateById(id: string, account_id: any): Promise<any | null> {
    const template = await WorkOrderTemplateModel.findOne({
      _id: helperService.validateObjectId(id),
      account_id,
      visible: true
    }).lean();

    if (!template) {
      return null;
    }

    const [enrichedTemplate] = await this.enrichTemplates([template], account_id);
    return enrichedTemplate || null;
  }

  async createTemplate(body: any, account_id: any, user_id: any): Promise<any> {
    const payload = this.normalizeTemplatePayload(body);
    await this.requireTenantReferences(payload, account_id);
    const template = await WorkOrderTemplateModel.create({
      account_id,
      ...payload,
      createdBy: user_id,
      updatedBy: user_id
    });

    return this.getTemplateById(String(template._id), account_id);
  }

  async updateTemplate(id: string, body: any, account_id: any, user_id: any): Promise<any | null> {
    const payload = this.normalizeTemplatePayload(body);
    await this.requireTenantReferences(payload, account_id);
    const updated = await WorkOrderTemplateModel.findOneAndUpdate(
      {
        _id: helperService.validateObjectId(id),
        account_id,
        visible: true
      },
      {
        $set: {
          ...payload,
          updatedBy: user_id
        }
      },
      { new: true }
    ).lean();

    if (!updated) {
      return null;
    }

    return this.getTemplateById(String(updated._id), account_id);
  }

  async removeTemplate(id: string, account_id: any, user_id: any): Promise<any | null> {
    return WorkOrderTemplateModel.findOneAndUpdate(
      {
        _id: helperService.validateObjectId(id),
        account_id,
        visible: true
      },
      {
        $set: {
          visible: false,
          updatedBy: user_id
        }
      },
      { new: true }
    ).lean();
  }

  private normalizeStringArray(values: any): string[] {
    if (!Array.isArray(values)) {
      return [];
    }

    const seen = new Set<string>();
    return values
      .map((value: any) => String(value || '').trim())
      .filter(Boolean)
      .filter((value: string) => {
        const key = value.toLowerCase();
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      });
  }

  private normalizeObjectIds(values: any): mongoose.Types.ObjectId[] {
    if (!Array.isArray(values)) {
      return [];
    }

    return values
      .map((value: any) => String(value || '').trim())
      .filter((value: string) => mongoose.Types.ObjectId.isValid(value))
      .map((value: string) => helperService.validateObjectId(value));
  }

  private normalizeParts(parts: any): any[] {
    if (!Array.isArray(parts)) {
      return [];
    }

    return parts.map((part: any) => ({
      part_id: mongoose.Types.ObjectId.isValid(String(part?.part_id || '')) ? helperService.validateObjectId(String(part.part_id)) : undefined,
      part_name: String(part?.part_name || '').trim(),
      part_number: String(part?.part_number || '').trim(),
      part_source: ['manual', 'procedure', 'mixed'].includes(String(part?.part_source || '').trim())
        ? String(part.part_source).trim()
        : 'manual',
      procedureNames: Array.isArray(part?.procedureNames)
        ? Array.from(new Set(part.procedureNames.map((name: any) => String(name || '').trim()).filter(Boolean)))
        : [],
      quantity: Number(part?.quantity || part?.estimatedQuantity || 0),
      unit: String(part?.unit || '').trim(),
      cost: Number.isFinite(Number(part?.cost)) ? Number(part.cost) : undefined,
      currency: String(part?.currency || '').trim()
    })).filter((part: any) => part.part_name && part.quantity > 0);
  }

  private normalizeFieldRules(fieldRules: any): Record<string, any> {
    const defaultRules = {
      description: { hidden: false, required: false, read_only: false },
      estimated_time: { hidden: false, required: false, read_only: false },
      procedures: { hidden: false, required: false, read_only: false },
      assignees: { hidden: false, required: false, read_only: false },
      priority: { hidden: false, required: false, read_only: false },
      locations: { hidden: false, required: false, read_only: false },
      assets: { hidden: false, required: false, read_only: false },
      parts: { hidden: false, required: false, read_only: false },
      categories: { hidden: false, required: false, read_only: false },
      vendors: { hidden: false, required: false, read_only: false }
    };

    const normalized: Record<string, any> = { ...defaultRules };
    Object.keys(defaultRules).forEach((key: string) => {
      const currentRule = fieldRules?.[key] || {};
      normalized[key] = {
        hidden: !!currentRule.hidden,
        required: !!currentRule.required,
        read_only: !!currentRule.read_only
      };
    });
    return normalized;
  }

  private normalizeDueDateSettings(settings: any): any {
    return {
      due_after_value: Number.isFinite(Number(settings?.due_after_value)) ? Number(settings.due_after_value) : null,
      due_after_unit: settings?.due_after_unit ? String(settings.due_after_unit).trim() : null,
      start_before_value: Number.isFinite(Number(settings?.start_before_value)) ? Number(settings.start_before_value) : null,
      start_before_unit: settings?.start_before_unit ? String(settings.start_before_unit).trim() : null,
      recurrence_value: Number.isFinite(Number(settings?.recurrence_value)) ? Number(settings.recurrence_value) : null,
      recurrence_unit: settings?.recurrence_unit ? String(settings.recurrence_unit).trim() : null
    };
  }

  private normalizeTemplatePayload(body: any): any {
    return {
      template_name: String(body?.template_name || '').trim(),
      title: String(body?.title || '').trim(),
      description: String(body?.description || '').trim(),
      estimated_time: Number.isFinite(Number(body?.estimated_time)) ? Number(body.estimated_time) : null,
      priority: String(body?.priority || 'Medium').trim(),
      nature_of_work: String(body?.nature_of_work || 'General').trim(),
      maintenance_type: String(body?.maintenance_type || 'Reactive').trim(),
      procedure_ids: this.normalizeObjectIds(body?.procedure_ids),
      assignee_ids: this.normalizeObjectIds(body?.assignee_ids),
      location_ids: this.normalizeObjectIds(body?.location_ids),
      asset_ids: this.normalizeObjectIds(body?.asset_ids),
      parts: this.normalizeParts(body?.parts),
      categories: this.normalizeStringArray(body?.categories),
      vendors: this.normalizeStringArray(body?.vendors),
      field_rules: this.normalizeFieldRules(body?.field_rules),
      due_date_settings: this.normalizeDueDateSettings(body?.due_date_settings)
    };
  }

  private async enrichTemplates(templates: any[], account_id: any): Promise<any[]> {
    if (!templates.length) {
      return [];
    }

    const procedureIds = Array.from(new Set(templates.flatMap((template: any) => (template.procedure_ids || []).map((id: any) => String(id)))));
    const assigneeIds = Array.from(new Set(templates.flatMap((template: any) => (template.assignee_ids || []).map((id: any) => String(id)))));
    const locationIds = Array.from(new Set(templates.flatMap((template: any) => (template.location_ids || []).map((id: any) => String(id)))));
    const assetIds = Array.from(new Set(templates.flatMap((template: any) => (template.asset_ids || []).map((id: any) => String(id)))));
    const partIds = Array.from(new Set(templates.flatMap((template: any) => (template.parts || []).map((part: any) => String(part?.part_id || '')).filter(Boolean))));

    const [procedures, users, locations, assets, parts] = await Promise.all([
      procedureIds.length ? ProcedureModel.find({ _id: { $in: procedureIds.map((id: string) => helperService.validateObjectId(id)) }, account_id, visible: true }, { name: 1, category: 1, description: 1, steps: 1, required_parts: 1 }).lean() : Promise.resolve([]),
      assigneeIds.length ? UserModel.find({ _id: { $in: assigneeIds.map((id: string) => helperService.validateObjectId(id)) }, account_id, visible: true }, { firstName: 1, lastName: 1, email: 1 }).lean() : Promise.resolve([]),
      locationIds.length ? LocationModel.find({ _id: { $in: locationIds.map((id: string) => helperService.validateObjectId(id)) }, account_id, visible: true }, { location_name: 1 }).lean() : Promise.resolve([]),
      assetIds.length ? AssetModel.find({ _id: { $in: assetIds.map((id: string) => helperService.validateObjectId(id)) }, account_id, visible: true }, { asset_name: 1 }).lean() : Promise.resolve([]),
      partIds.length ? PartsModel.find({ _id: { $in: partIds.map((id: string) => helperService.validateObjectId(id)) }, account_id, visible: true }, { part_name: 1, part_number: 1, unit: 1, cost: 1, currency: 1 }).lean() : Promise.resolve([])
    ]);

    const procedureMap = new Map(procedures.map((item: any) => [String(item._id), {
      id: String(item._id),
      name: item.name,
      category: item.category || '',
      description: item.description || '',
      steps: Array.isArray(item.steps) ? item.steps : [],
      required_parts: Array.isArray(item.required_parts) ? item.required_parts : []
    }]));
    const userMap = new Map(users.map((item: any) => [String(item._id), { id: String(item._id), firstName: item.firstName || '', lastName: item.lastName || '', email: item.email || '' }]));
    const locationMap = new Map(locations.map((item: any) => [String(item._id), { id: String(item._id), location_name: item.location_name || '' }]));
    const assetMap = new Map(assets.map((item: any) => [String(item._id), { id: String(item._id), asset_name: item.asset_name || '' }]));
    const partMap = new Map(parts.map((item: any) => [String(item._id), item]));

    return templates.map((template: any) => ({
      ...template,
      id: String(template._id),
      procedures: (template.procedure_ids || []).map((id: any) => procedureMap.get(String(id))).filter(Boolean),
      assignees: (template.assignee_ids || []).map((id: any) => userMap.get(String(id))).filter(Boolean),
      locations: (template.location_ids || []).map((id: any) => locationMap.get(String(id))).filter(Boolean),
      assets: (template.asset_ids || []).map((id: any) => assetMap.get(String(id))).filter(Boolean),
      parts: (template.parts || []).map((part: any) => {
        const linkedPart = part?.part_id ? partMap.get(String(part.part_id)) : null;
        return {
          ...part,
          part_id: part?.part_id ? String(part.part_id) : '',
          part_name: part?.part_name || linkedPart?.part_name || '',
          part_number: part?.part_number || linkedPart?.part_number || '',
          part_source: ['manual', 'procedure', 'mixed'].includes(String(part?.part_source || '').trim())
            ? String(part.part_source).trim()
            : 'manual',
          procedureNames: Array.isArray(part?.procedureNames) ? part.procedureNames : [],
          unit: part?.unit || linkedPart?.unit || '',
          cost: Number.isFinite(Number(part?.cost)) ? Number(part.cost) : Number(linkedPart?.cost || 0),
          currency: part?.currency || linkedPart?.currency || 'INR'
        };
      })
    }));
  }

  private async requireTenantReferences(payload: any, account_id: any): Promise<void> {
    await Promise.all([
      requireTenantReferenceIds({
        ids: payload.procedure_ids || [],
        accountId: account_id,
        label: 'Procedure',
        model: ProcedureModel
      }),
      requireTenantReferenceIds({
        ids: payload.assignee_ids || [],
        accountId: account_id,
        label: 'Assignee',
        model: UserModel,
        match: { user_status: 'active' }
      }),
      requireTenantReferenceIds({
        ids: payload.location_ids || [],
        accountId: account_id,
        label: 'Location',
        model: LocationModel
      }),
      requireTenantReferenceIds({
        ids: payload.asset_ids || [],
        accountId: account_id,
        label: 'Asset',
        model: AssetModel
      }),
      requireTenantReferenceIds({
        ids: (payload.parts || []).map((part: any) => part?.part_id),
        accountId: account_id,
        label: 'Part',
        model: PartsModel
      })
    ]);
  }
}

export const orderTemplateService = new OrderTemplateService();
