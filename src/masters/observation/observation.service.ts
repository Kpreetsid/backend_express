import { ObservationModel } from '../../models/observation.model';
import { AssetModel } from '../../models/asset.model';
import { LocationModel } from '../../models/location.model';
import { UserModel } from '../../models/user.model';
import { ReportAssetModel } from '../../models/assetReport.model';

const MAX_OBSERVATION_RESULTS = 2_000;

class ObservationService {
  async getAllObservation(match: any): Promise<any[]> {
    return ObservationModel.aggregate([
      { $match: match },
      { $sort: { _id: -1 } },
      { $limit: MAX_OBSERVATION_RESULTS },
      {
        $lookup: {
          from: AssetModel.collection.name,
          let: { assetId: '$assetId', accountId: '$accountId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$_id', '$$assetId'] },
                    { $eq: ['$account_id', '$$accountId'] }
                  ]
                },
                visible: true
              }
            },
            { $project: { _id: 1, id: '$_id', asset_name: 1, asset_type: 1, asset_model: 1, top_level: 1, parent_id: 1, visible: 1 } }
          ],
          as: 'asset'
        }
      },
      { $unwind: { path: '$asset', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: LocationModel.collection.name,
          let: { locationId: '$locationId', accountId: '$accountId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$_id', '$$locationId'] },
                    { $eq: ['$account_id', '$$accountId'] }
                  ]
                },
                visible: true
              }
            },
            { $project: { _id: 1, id: '$_id', location_name: 1, location_type: 1, top_level: 1, parent_id: 1, visible: 1 } }
          ],
          as: 'location'
        }
      },
      { $unwind: { path: '$location', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: UserModel.collection.name,
          let: { userId: '$userId', accountId: '$accountId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$_id', '$$userId'] },
                    { $eq: ['$account_id', '$$accountId'] }
                  ]
                }
              }
            },
            { $project: { _id: 1, id: '$_id', firstName: 1, lastName: 1, email: 1, username: 1, user_role: 1, user_status: 1, user_profile_img: 1 } }
          ],
          as: 'user'
        }
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      { $addFields: { id: '$_id' } }
    ]);
  }

  async getObservationRecord(id: any, accountId: any): Promise<any> {
    return ObservationModel.findOne({ _id: id, accountId, visible: true }).lean();
  }

  async assertObservationReferences(body: any, accountId: any): Promise<void> {
    const [asset, location, topLevelAsset, report] = await Promise.all([
      AssetModel.findOne({ _id: body.assetId, account_id: accountId, visible: true })
        .select('_id locationId top_level top_level_asset_id')
        .lean(),
      LocationModel.findOne({ _id: body.locationId, account_id: accountId, visible: true })
        .select('_id')
        .lean(),
      AssetModel.findOne({ _id: body.top_level_asset_id, account_id: accountId, visible: true })
        .select('_id top_level')
        .lean(),
      body.report_id
        ? ReportAssetModel.findOne({ _id: body.report_id, accountId, visible: true })
          .select('_id assetId top_level_asset_id locationId')
          .lean()
        : Promise.resolve(null)
    ]);

    if (!asset) throw badRequest('Asset does not belong to the active account');
    if (!location) throw badRequest('Location does not belong to the active account');
    if (!topLevelAsset || !topLevelAsset.top_level) {
      throw badRequest('Top level asset does not belong to the active account');
    }
    if (String(asset.locationId) !== String(body.locationId)) {
      throw badRequest('Asset and location do not match');
    }

    const expectedTopLevelAssetId = asset.top_level ? asset._id : asset.top_level_asset_id;
    if (!expectedTopLevelAssetId || String(expectedTopLevelAssetId) !== String(body.top_level_asset_id)) {
      throw badRequest('Asset and top level asset do not match');
    }

    if (body.report_id) {
      if (!report) throw badRequest('Report does not belong to the active account');
      if (report.assetId && String(report.assetId) !== String(body.assetId)) {
        throw badRequest('Report and asset do not match');
      }
      if (String(report.top_level_asset_id) !== String(body.top_level_asset_id)) {
        throw badRequest('Report and top level asset do not match');
      }
      if (report.locationId && String(report.locationId) !== String(body.locationId)) {
        throw badRequest('Report and location do not match');
      }
    }
  }

  async insertObservation(body: any, accountId: any, userId: any): Promise<any> {
    const newObservation = new ObservationModel({
      ...body,
      accountId,
      userId,
      createdBy: userId
    });
    return newObservation.save();
  }

  async updateObservationById(id: any, body: any, accountId: any, userId: any): Promise<any> {
    return ObservationModel.findOneAndUpdate(
      editableObservationFilter(id, accountId),
      { $set: { ...body, updatedBy: userId } },
      { returnDocument: 'after', runValidators: true }
    );
  }

  async updateObservation(match: any, body: any): Promise<any> {
    return ObservationModel.updateMany(match, { ...body });
  }

  async removeObservationById(id: any, accountId: any, userId: any): Promise<any> {
    return ObservationModel.findOneAndUpdate(
      editableObservationFilter(id, accountId),
      { $set: { updatedBy: userId, visible: false } },
      { returnDocument: 'after' }
    );
  }

  async deleteObservationById(id: string, accountId?: any): Promise<any> {
    return ObservationModel.deleteOne({ _id: id, ...(accountId ? { accountId } : {}) });
  }
}

function editableObservationFilter(id: any, accountId: any): any {
  return {
    _id: id,
    accountId,
    visible: true,
    report_id: null,
    alarmId: null
  };
}

function badRequest(message: string): Error {
  return Object.assign(new Error(message), { status: 400 });
}

export const observationService = new ObservationService();
