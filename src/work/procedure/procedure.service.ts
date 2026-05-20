import mongoose from 'mongoose';
import { AssetModel } from '../../models/asset.model';
import { LocationModel } from '../../models/location.model';
import { ProcedureModel } from '../../models/procedure.model';
import { helperService } from '../../utils/helper';

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
    const versionGroupId = new mongoose.Types.ObjectId();
    const procedure = await ProcedureModel.create({
      account_id,
      name: body.name,
      category: body.category || '',
      tags: this.normalizeTags(body.tags),
      location_ids: this.normalizeObjectIds(body.location_ids),
      asset_ids: this.normalizeObjectIds(body.asset_ids),
      description: body.description || '',
      steps: Array.isArray(body.steps) ? body.steps : [],
      version_group_id: versionGroupId,
      version: 1,
      is_latest: true,
      version_notes: body.version_notes || '',
      published_at: new Date(),
      createdBy: user_id,
      updatedBy: user_id
    });

    return await this.getProcedureById(String(procedure._id), account_id);
  }

  async updateProcedure(id: string, body: any, account_id: any, user_id: any): Promise<any | null> {
    const existingProcedure = await ProcedureModel.findOne({
      _id: helperService.validateObjectId(id),
      account_id,
      visible: true
    }).lean();

    if (!existingProcedure) {
      return null;
    }

    const nextVersion = Number(existingProcedure.version || 1) + 1;
    const createdProcedure = await ProcedureModel.create({
      account_id,
      name: body.name !== undefined ? body.name : existingProcedure.name,
      category: body.category !== undefined ? (body.category || '') : (existingProcedure.category || ''),
      tags: body.tags !== undefined ? this.normalizeTags(body.tags) : this.normalizeTags(existingProcedure.tags),
      location_ids: body.location_ids !== undefined ? this.normalizeObjectIds(body.location_ids) : this.normalizeObjectIds(existingProcedure.location_ids),
      asset_ids: body.asset_ids !== undefined ? this.normalizeObjectIds(body.asset_ids) : this.normalizeObjectIds(existingProcedure.asset_ids),
      description: body.description !== undefined ? (body.description || '') : (existingProcedure.description || ''),
      steps: body.steps !== undefined ? (Array.isArray(body.steps) ? body.steps : []) : (existingProcedure.steps || []),
      version_group_id: existingProcedure.version_group_id || existingProcedure._id,
      version: nextVersion,
      is_latest: true,
      version_notes: body.version_notes || '',
      supersedes_id: existingProcedure._id,
      published_at: new Date(),
      createdBy: user_id,
      updatedBy: user_id
    });

    await ProcedureModel.updateMany(
      {
        account_id,
        visible: true,
        version_group_id: existingProcedure.version_group_id || existingProcedure._id,
        _id: { $ne: createdProcedure._id }
      },
      {
        is_latest: false,
        updatedBy: user_id
      }
    );

    return await this.getProcedureById(String(createdProcedure._id), account_id);
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
    const versionGroupIds = Array.from(new Set(
      procedures.map((procedure: any) => String(procedure.version_group_id || procedure._id))
    )).map((id) => helperService.validateObjectId(id));

    const [locations, assets, versionStats, versionHistory] = await Promise.all([
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
}

export const procedureService = new ProcedureService();
