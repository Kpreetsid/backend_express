import mongoose from 'mongoose';
import { afterEach, describe, expect, it, vi } from 'vitest';

const tenantReferences = vi.hoisted(() => ({ require: vi.fn().mockResolvedValue(undefined) }));

vi.mock('../../utils/tenant-references', () => ({
  requireTenantReferenceIds: tenantReferences.require
}));

import { AssetModel } from '../../models/asset.model';
import { LocationModel } from '../../models/location.model';
import { PartsModel } from '../../models/part.model';
import { ProcedureModel } from '../../models/procedure.model';
import { UserModel } from '../../models/user.model';
import { WorkOrderTemplateModel } from '../../models/workOrderTemplate.model';
import { orderTemplateService } from './orderTemplate.service';

const service = orderTemplateService as any;
const objectId = (suffix: string) => new mongoose.Types.ObjectId(`807f1f77bcf86cd7994390${suffix}`);
const leanQuery = (value: any) => ({ lean: vi.fn().mockResolvedValue(value) });

describe('work-order template service behavior and tenant boundaries', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    tenantReferences.require.mockClear();
  });

  it('normalizes identifiers, parts, rules, dates, and duplicate strings', () => {
    const procedureId = objectId('11');
    const assigneeId = objectId('12');
    const payload = service.normalizeTemplatePayload({
      template_name: '  Pump PM ',
      title: ' Inspect pump ',
      estimated_time: '2.5',
      priority: 'Medium',
      procedure_ids: [procedureId, 'invalid'],
      assignee_ids: [assigneeId],
      categories: [' PM ', 'pm', '', 'Safety'],
      vendors: 'invalid',
      parts: [
        {
          part_id: objectId('13'),
          part_name: ' Seal ',
          part_number: ' S-1 ',
          part_source: 'procedure',
          procedureNames: ['Inspection', 'Inspection', ''],
          estimatedQuantity: '2',
          unit: ' EA ',
          cost: '4.5',
          currency: ' INR '
        },
        { part_name: '', quantity: 3 },
        { part_name: 'Invalid quantity', quantity: 0 }
      ],
      field_rules: {
        parts: { hidden: 1, required: true, read_only: 'yes' }
      },
      due_date_settings: {
        due_after_value: '5',
        due_after_unit: ' days ',
        start_before_value: 'invalid',
        recurrence_value: 0
      }
    });

    expect(payload).toMatchObject({
      template_name: 'Pump PM',
      title: 'Inspect pump',
      estimated_time: 2.5,
      priority: 'Medium',
      nature_of_work: 'General',
      maintenance_type: 'Reactive',
      procedure_ids: [procedureId],
      assignee_ids: [assigneeId],
      categories: ['PM', 'Safety'],
      vendors: [],
      parts: [expect.objectContaining({
        part_name: 'Seal',
        part_number: 'S-1',
        part_source: 'procedure',
        procedureNames: ['Inspection'],
        quantity: 2,
        unit: 'EA',
        cost: 4.5,
        currency: 'INR'
      })],
      due_date_settings: {
        due_after_value: 5,
        due_after_unit: 'days',
        start_before_value: null,
        start_before_unit: null,
        recurrence_value: 0,
        recurrence_unit: null
      }
    });
    expect(payload.field_rules.parts).toEqual({ hidden: true, required: true, read_only: true });
    expect(payload.field_rules.description).toEqual({ hidden: false, required: false, read_only: false });
  });

  it('returns sorted visible templates and preserves empty-list behavior', async () => {
    const find = vi.spyOn(WorkOrderTemplateModel, 'find').mockReturnValue({
      sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([{ _id: objectId('14') }]) })
    } as any);
    const enrich = vi.spyOn(service, 'enrichTemplates').mockResolvedValue([{ id: 'enriched' }]);

    await expect(orderTemplateService.getAllTemplates({ account_id: objectId('15'), priority: 'High' }))
      .resolves.toEqual([{ id: 'enriched' }]);
    expect(find).toHaveBeenCalledWith({ account_id: objectId('15'), priority: 'High', visible: true });
    expect(enrich).toHaveBeenCalledOnce();

    enrich.mockRestore();
    await expect(service.enrichTemplates([], objectId('15'))).resolves.toEqual([]);
  });

  it('returns null for an unknown tenant template and enriches a known one', async () => {
    const templateId = objectId('16');
    const accountId = objectId('17');
    const findOne = vi.spyOn(WorkOrderTemplateModel, 'findOne')
      .mockReturnValueOnce(leanQuery(null) as any)
      .mockReturnValueOnce(leanQuery({ _id: templateId, title: 'Known' }) as any);
    const enrich = vi.spyOn(service, 'enrichTemplates').mockResolvedValue([{ id: String(templateId), title: 'Known' }]);

    await expect(orderTemplateService.getTemplateById(String(templateId), accountId)).resolves.toBeNull();
    await expect(orderTemplateService.getTemplateById(String(templateId), accountId))
      .resolves.toMatchObject({ id: String(templateId), title: 'Known' });
    expect(findOne.mock.calls[0]![0]).toMatchObject({ _id: templateId, account_id: accountId, visible: true });
    expect(enrich).toHaveBeenCalledOnce();
  });

  it('creates and updates normalized templates only after tenant-reference validation', async () => {
    const templateId = objectId('18');
    const accountId = objectId('19');
    const userId = objectId('20');
    const requireReferences = vi.spyOn(service, 'requireTenantReferences').mockResolvedValue(undefined);
    const getById = vi.spyOn(orderTemplateService, 'getTemplateById')
      .mockResolvedValueOnce({ id: String(templateId), title: 'Created' })
      .mockResolvedValueOnce({ id: String(templateId), title: 'Updated' });
    const create = vi.spyOn(WorkOrderTemplateModel, 'create').mockResolvedValue({ _id: templateId } as any);
    const update = vi.spyOn(WorkOrderTemplateModel, 'findOneAndUpdate')
      .mockReturnValue(leanQuery({ _id: templateId }) as any);

    await expect(orderTemplateService.createTemplate({ template_name: ' Template ' }, accountId, userId))
      .resolves.toMatchObject({ title: 'Created' });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      account_id: accountId,
      template_name: 'Template',
      createdBy: userId,
      updatedBy: userId
    }));

    await expect(orderTemplateService.updateTemplate(String(templateId), { title: ' Updated ' }, accountId, userId))
      .resolves.toMatchObject({ title: 'Updated' });
    expect(update).toHaveBeenCalledWith(
      { _id: templateId, account_id: accountId, visible: true },
      { $set: expect.objectContaining({ title: 'Updated', updatedBy: userId }) },
      { new: true }
    );
    expect(requireReferences).toHaveBeenCalledTimes(2);
    expect(getById).toHaveBeenCalledTimes(2);
  });

  it('does not re-read a missing update and soft-deletes with tenant scope', async () => {
    const templateId = objectId('21');
    const accountId = objectId('22');
    const userId = objectId('23');
    vi.spyOn(service, 'requireTenantReferences').mockResolvedValue(undefined);
    vi.spyOn(WorkOrderTemplateModel, 'findOneAndUpdate')
      .mockReturnValueOnce(leanQuery(null) as any)
      .mockReturnValueOnce(leanQuery({ _id: templateId, visible: false }) as any);
    const getById = vi.spyOn(orderTemplateService, 'getTemplateById');

    await expect(orderTemplateService.updateTemplate(String(templateId), {}, accountId, userId)).resolves.toBeNull();
    expect(getById).not.toHaveBeenCalled();
    await expect(orderTemplateService.removeTemplate(String(templateId), accountId, userId))
      .resolves.toMatchObject({ visible: false });
  });

  it('enriches referenced entities while retaining manual part fallbacks', async () => {
    const accountId = objectId('24');
    const templateId = objectId('25');
    const procedureId = objectId('26');
    const userId = objectId('27');
    const locationId = objectId('28');
    const assetId = objectId('29');
    const partId = objectId('30');
    vi.spyOn(ProcedureModel, 'find').mockReturnValue(leanQuery([{
      _id: procedureId,
      name: 'Inspection',
      steps: null,
      required_parts: null
    }]) as any);
    vi.spyOn(UserModel, 'find').mockReturnValue(leanQuery([{
      _id: userId,
      firstName: 'Ada',
      lastName: 'Lovelace'
    }]) as any);
    vi.spyOn(LocationModel, 'find').mockReturnValue(leanQuery([{ _id: locationId, location_name: 'Plant' }]) as any);
    vi.spyOn(AssetModel, 'find').mockReturnValue(leanQuery([{ _id: assetId, asset_name: 'Pump' }]) as any);
    vi.spyOn(PartsModel, 'find').mockReturnValue(leanQuery([{
      _id: partId,
      part_name: 'Inventory Seal',
      part_number: 'S-1',
      unit: 'EA',
      cost: 9,
      currency: 'USD'
    }]) as any);

    const [result] = await service.enrichTemplates([{
      _id: templateId,
      procedure_ids: [procedureId],
      assignee_ids: [userId],
      location_ids: [locationId],
      asset_ids: [assetId],
      parts: [{ part_id: partId, quantity: 2 }, { part_name: 'Manual', quantity: 1, part_source: 'invalid' }]
    }], accountId);

    expect(result).toMatchObject({
      id: String(templateId),
      procedures: [{ id: String(procedureId), name: 'Inspection', category: '', description: '', steps: [], required_parts: [] }],
      assignees: [{ id: String(userId), firstName: 'Ada', lastName: 'Lovelace', email: '' }],
      locations: [{ id: String(locationId), location_name: 'Plant' }],
      assets: [{ id: String(assetId), asset_name: 'Pump' }]
    });
    expect(result.parts[0]).toMatchObject({
      part_id: String(partId),
      part_name: 'Inventory Seal',
      cost: 9,
      currency: 'USD'
    });
    expect(result.parts[1]).toMatchObject({ part_id: '', part_name: 'Manual', part_source: 'manual', cost: 0, currency: 'INR' });
  });

  it('validates every tenant-owned reference family with active assignee scope', async () => {
    const accountId = objectId('31');
    await service.requireTenantReferences({
      procedure_ids: [objectId('32')],
      assignee_ids: [objectId('33')],
      location_ids: [objectId('34')],
      asset_ids: [objectId('35')],
      parts: [{ part_id: objectId('36') }]
    }, accountId);

    expect(tenantReferences.require).toHaveBeenCalledTimes(5);
    expect(tenantReferences.require).toHaveBeenCalledWith(expect.objectContaining({
      accountId,
      label: 'Assignee',
      model: UserModel,
      match: { user_status: 'active' }
    }));
  });
});
