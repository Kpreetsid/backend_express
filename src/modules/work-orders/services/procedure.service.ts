import mongoose from 'mongoose';
import { AssetModel } from '../../assets/models/asset.model';
import { LocationModel } from '../../locations/models/location.model';
import { PartsModel } from '../../inventory/models/part.model';
import { ProcedureModel } from '../models/procedure.model';
import { helperService } from '../../../common/utils/object-id.helper';
import { withTransaction } from '../../../common/utils/transaction.helper';
import { sanitizeProcedureContent } from '../policies/procedure.policy';

class ProcedureService {
  async getAllProcedures(match: any, options: { includeHistory?: boolean } = {}): Promise<any[]> {
    const procedures = await ProcedureModel.find({
      ...match,
      visible: true,
      ...(options.includeHistory ? {} : { is_latest: true })
    })
      .sort({ updatedAt: -1, createdAt: -1 })
      .lean();

    return await this.enrichProcedures(procedures, match.account_id, options.includeHistory);
  }

  async getProcedureById(id: string, account_id: any): Promise<any | null> {
    const procedure = await ProcedureModel.findOne({
      _id: helperService.validateObjectId(id),
      account_id,
      visible: true
    }).lean();

    if (!procedure) {
      return null;
    }

    const [enrichedProcedure] = await this.enrichProcedures([procedure], account_id, true);
    return enrichedProcedure || null;
  }

  async createProcedure(body: any, account_id: any, user_id: any): Promise<any> {
    const payload = sanitizeProcedureContent(body);
    const locationIds = this.normalizeObjectIds(payload.location_ids);
    const assetIds = this.normalizeObjectIds(payload.asset_ids);
    const requiredParts = this.normalizeRequiredParts(payload.required_parts);
    await this.assertReferences(locationIds, assetIds, requiredParts, account_id);
    const versionGroupId = new mongoose.Types.ObjectId();
    const procedure = await ProcedureModel.create({
      account_id,
      name: payload.name,
      category: payload.category,
      tags: this.normalizeTags(payload.tags),
      location_ids: locationIds,
      asset_ids: assetIds,
      description: payload.description,
      required_parts: requiredParts,
      steps: payload.steps,
      version_group_id: versionGroupId,
      version: 1,
      is_latest: true,
      version_notes: payload.version_notes,
      published_at: new Date(),
      createdBy: user_id,
      updatedBy: user_id
    });

    return await this.getProcedureById(String(procedure._id), account_id);
  }

  async updateProcedure(id: string, body: any, account_id: any, user_id: any): Promise<any | null> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const createdId = await withTransaction(async (session) => {
          const existingProcedure = await ProcedureModel.findOne({
            _id: helperService.validateObjectId(id),
            account_id,
            visible: true
          }).session(session || null).lean();
          if (!existingProcedure) return null;

          const versionGroupId = existingProcedure.version_group_id || existingProcedure._id;
          const latestProcedure = await ProcedureModel.findOne({
            account_id,
            visible: true,
            version_group_id: versionGroupId
          }).sort({ version: -1 }).session(session || null).lean();
          const merged = sanitizeProcedureContent({
            name: body.name !== undefined ? body.name : existingProcedure.name,
            category: body.category !== undefined ? body.category : existingProcedure.category,
            tags: body.tags !== undefined ? body.tags : existingProcedure.tags,
            location_ids: body.location_ids !== undefined ? body.location_ids : existingProcedure.location_ids,
            asset_ids: body.asset_ids !== undefined ? body.asset_ids : existingProcedure.asset_ids,
            description: body.description !== undefined ? body.description : existingProcedure.description,
            required_parts: body.required_parts !== undefined ? body.required_parts : existingProcedure.required_parts,
            steps: body.steps !== undefined ? body.steps : existingProcedure.steps,
            version_notes: body.version_notes || ''
          });
          const locationIds = this.normalizeObjectIds(merged.location_ids);
          const assetIds = this.normalizeObjectIds(merged.asset_ids);
          const requiredParts = this.normalizeRequiredParts(merged.required_parts);
          await this.assertReferences(locationIds, assetIds, requiredParts, account_id, session);

          const createdProcedure = new ProcedureModel({
            account_id,
            name: merged.name,
            category: merged.category,
            tags: this.normalizeTags(merged.tags),
            location_ids: locationIds,
            asset_ids: assetIds,
            description: merged.description,
            required_parts: requiredParts,
            steps: merged.steps,
            version_group_id: versionGroupId,
            version: Number(latestProcedure?.version || existingProcedure.version || 1) + 1,
            is_latest: true,
            version_notes: merged.version_notes,
            supersedes_id: existingProcedure._id,
            published_at: new Date(),
            createdBy: user_id,
            updatedBy: user_id
          });
          await createdProcedure.save({ session: session || undefined });
          await ProcedureModel.updateMany(
            {
              account_id,
              visible: true,
              version_group_id: versionGroupId,
              _id: { $ne: createdProcedure._id }
            },
            { $set: { is_latest: false, updatedBy: user_id } },
            { session: session || undefined }
          );
          return String(createdProcedure._id);
        });
        return createdId ? await this.getProcedureById(createdId, account_id) : null;
      } catch (error: any) {
        if (error?.code !== 11000 || attempt === 1) throw error;
      }
    }
    return null;
  }

  async removeProcedure(id: string, account_id: any, user_id: any): Promise<any> {
    const procedure = await ProcedureModel.findOne({
      _id: helperService.validateObjectId(id),
      account_id,
      visible: true
    }).lean();

    if (!procedure) {
      return null;
    }

    return await ProcedureModel.updateMany(
      {
        account_id,
        visible: true,
        version_group_id: procedure.version_group_id || procedure._id
      },
      {
        visible: false,
        updatedBy: user_id
      }
    );
  }

  private async enrichProcedures(procedures: any[], account_id: any, includeHistory: boolean = false): Promise<any[]> {
    if (!procedures.length) {
      return [];
    }

    const locationIds = Array.from(new Set(
      procedures.flatMap((procedure: any) => (procedure.location_ids || []).map((id: any) => String(id)))
    ));
    const assetIds = Array.from(new Set(
      procedures.flatMap((procedure: any) => (procedure.asset_ids || []).map((id: any) => String(id)))
    ));
    const requiredPartIds = Array.from(new Set(
      procedures.flatMap((procedure: any) => (procedure.required_parts || []).map((part: any) => String(part?.part_id || '')).filter(Boolean))
    ));
    const versionGroupIds = Array.from(new Set(
      procedures.map((procedure: any) => String(procedure.version_group_id || procedure._id))
    )).map((id) => helperService.validateObjectId(id));

    const [locations, assets, requiredParts, versionStats, versionHistory] = await Promise.all([
      locationIds.length
        ? LocationModel.find({
            _id: { $in: locationIds.map((id) => helperService.validateObjectId(id)) },
            account_id,
            visible: true
          }, {
            location_name: 1
          }).lean()
        : Promise.resolve([]),
      assetIds.length
        ? AssetModel.find({
            _id: { $in: assetIds.map((id) => helperService.validateObjectId(id)) },
            account_id,
            visible: true
          }, {
            asset_name: 1,
            locationId: 1
          }).lean()
        : Promise.resolve([]),
      requiredPartIds.length
        ? PartsModel.find({
            _id: { $in: requiredPartIds.map((id) => helperService.validateObjectId(id)) },
            account_id,
            visible: true
          }, {
            part_name: 1,
            part_number: 1,
            barcode: 1,
            unit: 1,
            cost: 1,
            quantity: 1,
            min_quantity: 1,
            reorder_point: 1,
            location_id: 1
          }).lean()
        : Promise.resolve([]),
      ProcedureModel.aggregate([
        {
          $match: {
            account_id: helperService.validateObjectId(String(account_id)),
            visible: true,
            version_group_id: { $in: versionGroupIds }
          }
        },
        {
          $group: {
            _id: '$version_group_id',
            version_count: { $sum: 1 },
            latest_version: { $max: '$version' }
          }
        }
      ]),
      includeHistory
        ? ProcedureModel.find({
            account_id,
            visible: true,
            version_group_id: { $in: versionGroupIds }
          }, {
            name: 1,
            version_group_id: 1,
            version: 1,
            version_notes: 1,
            published_at: 1,
            updatedAt: 1,
            is_latest: 1
          }).sort({ version: -1 }).lean()
        : Promise.resolve([])
    ]);

    const locationMap = new Map(locations.map((location: any) => [
      String(location._id),
      {
        id: String(location._id),
        name: location.location_name
      }
    ]));
    const assetMap = new Map(assets.map((asset: any) => [
      String(asset._id),
      {
        id: String(asset._id),
        name: asset.asset_name,
        location_id: asset.locationId ? String(asset.locationId) : null
      }
    ]));
    const versionStatsMap = new Map(versionStats.map((item: any) => [
      String(item._id),
      item
    ]));
    const requiredPartMap = new Map(requiredParts.map((part: any) => [
      String(part._id),
      part
    ]));
    const versionHistoryMap = new Map<string, any[]>();

    versionHistory.forEach((item: any) => {
      const key = String(item.version_group_id || '');
      if (!versionHistoryMap.has(key)) {
        versionHistoryMap.set(key, []);
      }
      versionHistoryMap.get(key)?.push({
        id: String(item._id),
        name: item.name,
        version: item.version,
        version_notes: item.version_notes || '',
        published_at: item.published_at,
        updatedAt: item.updatedAt,
        is_latest: !!item.is_latest
      });
    });

    return procedures.map((procedure: any) => {
      const versionGroupKey = String(procedure.version_group_id || procedure._id);
      const stats = versionStatsMap.get(versionGroupKey) || {};

      return {
        ...procedure,
        id: String(procedure._id),
        location_ids: (procedure.location_ids || []).map((id: any) => String(id)),
        asset_ids: (procedure.asset_ids || []).map((id: any) => String(id)),
        locations: (procedure.location_ids || [])
          .map((id: any) => locationMap.get(String(id)))
          .filter(Boolean),
        assets: (procedure.asset_ids || [])
          .map((id: any) => assetMap.get(String(id)))
          .filter(Boolean),
        required_parts: (procedure.required_parts || []).map((part: any) => {
          const linkedPart = part?.part_id ? requiredPartMap.get(String(part.part_id)) : null;
          return {
            part_id: part?.part_id ? String(part.part_id) : '',
            part_name: part?.part_name || linkedPart?.part_name || '',
            part_number: part?.part_number || linkedPart?.part_number || '',
            barcode: part?.barcode || linkedPart?.barcode || '',
            quantity: Number(part?.quantity || 0),
            unit: part?.unit || linkedPart?.unit || '',
            notes: part?.notes || '',
            inventory: linkedPart ? {
              id: String(linkedPart._id),
              quantity: Number(linkedPart.quantity || 0),
              min_quantity: Number(linkedPart.min_quantity || 0),
              reorder_point: Number(linkedPart.reorder_point || 0),
              location_id: linkedPart.location_id ? String(linkedPart.location_id) : ''
            } : null
          };
        }),
        version_group_id: versionGroupKey,
        version_count: Number(stats.version_count || 1),
        latest_version: Number(stats.latest_version || procedure.version || 1),
        version_history: includeHistory ? (versionHistoryMap.get(versionGroupKey) || []) : undefined
      };
    });
  }

  private normalizeTags(tags: any): string[] {
    if (!Array.isArray(tags)) {
      return [];
    }

    const seen = new Set<string>();
    return tags
      .map((tag: any) => String(tag || '').trim())
      .filter(Boolean)
      .filter((tag) => {
        const normalized = tag.toLowerCase();
        if (seen.has(normalized)) {
          return false;
        }
        seen.add(normalized);
        return true;
      });
  }

  private normalizeObjectIds(ids: any): mongoose.Types.ObjectId[] {
    if (!Array.isArray(ids)) {
      return [];
    }

    return Array.from(new Set(
      ids
        .map((id: any) => String(id || '').trim())
        .filter(Boolean)
    )).map((id) => helperService.validateObjectId(id));
  }

  private normalizeRequiredParts(parts: any): any[] {
    if (!Array.isArray(parts)) {
      return [];
    }

    const seen = new Set<string>();
    return parts
      .map((part: any) => {
        const partId = String(part?.part_id || part?.id || part?._id || '').trim();
        const key = partId || `${String(part?.part_number || '').trim()}::${String(part?.part_name || '').trim()}`;
        if (!key || seen.has(key)) {
          return null;
        }
        seen.add(key);
        return {
          part_id: partId && mongoose.Types.ObjectId.isValid(partId) ? helperService.validateObjectId(partId) : undefined,
          part_name: String(part?.part_name || '').trim(),
          part_number: String(part?.part_number || '').trim(),
          barcode: String(part?.barcode || '').trim(),
          quantity: Number(part?.quantity || part?.estimatedQuantity || 0),
          unit: String(part?.unit || '').trim(),
          notes: String(part?.notes || '').trim()
        };
      })
      .filter((part: any) => part && part.part_name && Number(part.quantity) > 0);
  }

  private async assertReferences(
    locationIds: mongoose.Types.ObjectId[],
    assetIds: mongoose.Types.ObjectId[],
    requiredParts: any[],
    account_id: any,
    session?: any
  ): Promise<void> {
    const partIds = requiredParts.map((part: any) => part.part_id).filter(Boolean);
    const [locationCount, assetCount, partCount] = await Promise.all([
      locationIds.length ? LocationModel.countDocuments({ _id: { $in: locationIds }, account_id, visible: true }).session(session || null) : Promise.resolve(0),
      assetIds.length ? AssetModel.countDocuments({ _id: { $in: assetIds }, account_id, visible: true }).session(session || null) : Promise.resolve(0),
      partIds.length ? PartsModel.countDocuments({ _id: { $in: partIds }, account_id, visible: true }).session(session || null) : Promise.resolve(0)
    ]);
    if (locationCount !== locationIds.length) {
      throw Object.assign(new Error('One or more locations are not available in this account'), { status: 400 });
    }
    if (assetCount !== assetIds.length) {
      throw Object.assign(new Error('One or more assets are not available in this account'), { status: 400 });
    }
    if (partCount !== partIds.length) {
      throw Object.assign(new Error('One or more required parts are not available in this account'), { status: 400 });
    }
  }
}

export const procedureService = new ProcedureService();
