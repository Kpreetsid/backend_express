import { getExternalData } from '../../utils/externalAPI';
import { AssetModel } from '../../models/asset.model';
import { MapUserAssetLocationModel } from "../../models/mapUserLocation.model";
import { mapUserToAssetService } from "../../transaction/mapUserAsset/userAsset.service";
import { mapUserToLocationService } from "../../transaction/mapUserLocation/userLocation.service";
import { helperService } from '../../utils/helper';
import { withTransaction } from "../../utils/transaction.helper";
import mongoose from 'mongoose';
import { LocationModel } from '../../models/location.model';
import { UserModel } from '../../models/user.model';
import { assetService } from '../asset/asset.service';

class EquipmentService {
  async getAllEquipment(match: any) {
    const assetsData = await AssetModel.find(match).populate([
      { path: 'locationId', model: "Schema_Location", select: 'id location_name location_type top_level parent_id visible assigned_to', match: { visible: true } },
      { path: 'parent_id', model: "Schema_Asset", select: 'id asset_name asset_type asset_model top_level parent_id visible', match: { visible: true } }
    ]);

    if (!assetsData.length) return [];

    const assetsIds = assetsData.map((asset: any) => asset._id);
    const mapData = await MapUserAssetLocationModel.find({
      assetId: { $in: assetsIds },
      userId: { $exists: true }
    }).populate([{ path: 'userId', model: "Schema_User", select: 'id firstName lastName email username user_role user_profile_img user_status' }]);
    const mappingsByAsset = new Map<string, any[]>();
    mapData.forEach(map => {
      const aId = String(map.assetId);
      if (!mappingsByAsset.has(aId)) {
        mappingsByAsset.set(aId, []);
      }
      if (map.userId) {
        mappingsByAsset.get(aId)?.push(map.userId);
      }
    });

    const result: any = assetsData.map((doc: any) => {
      const obj = doc.toObject();
      const id = String(obj._id);

      if (obj.locationId) {
        obj.locationId.id = obj.locationId._id;
      }
      if (obj.parent_id) {
        obj.parent_id.id = obj.parent_id._id;
      }
      obj.id = id;
      obj.userList = mappingsByAsset.get(id) || [];
      return obj;
    });

    return result;
  }

  async checkEquipment(match: any) {
    return await AssetModel.find(match).lean();
  }

  async getAllChildEquipmentIDs(assetId: any): Promise<string[]> {
    const children = await AssetModel.find({ parent_id: assetId, visible: true }).select('_id');
    if (!children || children.length === 0) {
      return [assetId];
    }
    const allChildIds: string[] = [];
    for (const child of children) {
      const subChildIds = await this.getAllChildEquipmentIDs(child._id);
      allChildIds.push(...subChildIds);
    }
    return [assetId, ...allChildIds];
  };

  async getEquipmentTreeData(match: any): Promise<any> {
    const asset_type_list: string[] = ["Rigid", "Flexible", "Belt_Pulley"];
    match.asset_type = { $nin: asset_type_list };
    const allAssets = await AssetModel.find(match).lean();
    if (!allAssets.length) {
      throw Object.assign(new Error("No records found"), { status: 404 });
    }
    const assetMap = new Map<string, any>();
    allAssets.forEach((a) => assetMap.set(String(a._id), a));
    const childrenMap = new Map<string, any[]>();
    allAssets.forEach((asset) => {
      const parent = asset.parent_id ? String(asset.parent_id) : "ROOT";
      if (!childrenMap.has(parent)) childrenMap.set(parent, []);
      childrenMap.get(parent)?.push(asset);
    });
    const mapUsers = await MapUserAssetLocationModel.find({ assetId: { $in: allAssets.map((a) => a._id) } }).lean();
    const assetUsersMap = new Map<string, string[]>();
    mapUsers.forEach((m) => {
      const assetId = String(m.assetId);
      if (!assetUsersMap.has(assetId)) assetUsersMap.set(assetId, []);
      assetUsersMap.get(assetId)?.push(String(m.userId));
    });
    const buildTree: any = (asset: any) => {
      const assetId = String(asset._id);
      return {
        ...asset,
        id: assetId,
        childs: (childrenMap.get(assetId) || []).map((child) => buildTree(child))
      };
    };
    const data = allAssets.map((asset) => buildTree(asset));
    return data;
  };

  getEquipmentTreeDataById = async (match: any, token: string = '', user_id: any = '') => {
    const assets = await AssetModel.aggregate([
      { $match: match },
      {
        $lookup: {
          from: LocationModel.collection.name,
          let: { locationId: '$locationId' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$locationId'] }, visible: true } },
            { $project: { _id: 1, id: '$_id', location_name: 1, location_type: 1, visible: 1 } },
          ],
          as: 'locationData'
        }
      },
      { $unwind: { path: '$locationData', preserveNullAndEmptyArrays: true } }
    ]);
    if (!assets.length) {
      throw Object.assign(new Error('No records found'), { status: 404 });
    }
    const assetIds = assets.map(a => a._id);
    const assetUsers = await MapUserAssetLocationModel.aggregate([
      { $match: { assetId: { $in: assetIds }, userId: { $exists: true } } },
      { $lookup: { from: UserModel.collection.name, localField: 'userId', foreignField: '_id', as: 'user' } },
      { $unwind: '$user' },
      { $project: { assetId: 1, user: { id: '$user._id', firstName: '$user.firstName', lastName: '$user.lastName', user_role: '$user.user_role', email: '$user.email', user_status: '$user.user_status' } } }
    ]);

    let mergedAssets = assets;
    const childAssetIds = assets.filter(a => !a.top_level && a.parent_id).map(a => String(a._id));
    if (childAssetIds.length && token && user_id) {
      try {
        const childEquipmentDetail: any = await getExternalData('processor/equipment-details', 'POST', { asset_ids: childAssetIds }, token, String(user_id));
        const childEquipmentById = new Map(
          (childEquipmentDetail?.data || []).map((a: any) => [String(a.asset_id || a.id), a])
        );

        mergedAssets = assets.map((asset: any) => {
          const matchedAsset = childEquipmentById.get(String(asset._id));

          return matchedAsset
            ? { ...asset, ...matchedAsset }
            : asset;
        });
      } catch {
        // proceed with unmerged assets if external request fails
      }
    }
    return this.buildEquipmentTree(mergedAssets, assetUsers);
  };

  buildEquipmentTree = async (assets: any[], assetUsers: any[]) => {
    const childrenMap = new Map<string, any[]>();
    const rootNodes: any[] = [];
    const assetUserMap = new Map<string, any[]>();
    for (const entry of assetUsers) {
      const key = String(entry.assetId);
      if (!assetUserMap.has(key)) assetUserMap.set(key, []);
      assetUserMap.get(key)!.push(entry.user);
    }
    for (const asset of assets) {
      const parentKey = asset.parent_id ? String(asset.parent_id) : 'ROOT';
      if (!childrenMap.has(parentKey)) {
        childrenMap.set(parentKey, []);
      }
      asset.id = String(asset._id);
      asset.userList = assetUserMap.get(asset.id) || [];
      childrenMap.get(parentKey)!.push(asset);
      if (!asset.parent_id) {
        rootNodes.push(asset);
      }
    }
    const attachChildren = (node: any): any => {
      const nodeId = String(node._id);
      node.childs = (childrenMap.get(nodeId) || []).map(attachChildren);
      return node;
    };
    return rootNodes.map(attachChildren);
  };

  async updateEquipmentImageById(
    id: string,
    image_path: string,
    account_id: any,
    user_id: string,
    session?: mongoose.ClientSession
  ) {
    return await AssetModel.findOneAndUpdate(
      { _id: id, account_id, visible: true },
      { image_path: image_path, updatedBy: user_id },
      { returnDocument: 'after', ...(session ? { session } : {}) }
    );
  }

  async removeEquipmentById(match: any, userID: any) {
    return await withTransaction(async (session) => {
      const childAssets = await AssetModel.find({ parent_id: match._id }).session(session);
      if (childAssets && childAssets.length > 0) {
        await AssetModel.updateMany({ parent_id: match._id }, { visible: false, updatedBy: userID }, { session });
      }
      await mapUserToLocationService.removeLocationMapping(match._id, session);
      return await AssetModel.findOneAndUpdate(match, { visible: false, updatedBy: userID }, { returnDocument: 'after', session });
    });
  };

  async deleteEquipment(id: string): Promise<any> {
    return await withTransaction(async (session) => {
      const childAssets = await AssetModel.find({ parent_id: id }).session(session);
      if (childAssets && childAssets.length > 0) {
        for (const asset of childAssets) {
          await mapUserToAssetService.removeAssetMapping(`${asset._id}`, session);
        }
        await AssetModel.deleteMany({ parent_id: id }, { session });
      }
      await mapUserToAssetService.removeAssetMapping(id, session);
      return await AssetModel.deleteOne({ _id: id }, { session });
    });
  }

  removeExtraFields(obj: Record<string, any>) {
    return Object.fromEntries(Object.entries(obj).filter(([_, value]) => value !== undefined && value !== null));
  }

  async requireTenantLocation(
    locationId: any,
    account_id: any,
    session?: mongoose.ClientSession
  ): Promise<void> {
    const query = LocationModel.countDocuments({
      _id: locationId,
      account_id,
      visible: true
    });
    if (session) query.session(session);
    if (await query !== 1) {
      throw Object.assign(new Error('Equipment location not found'), { status: 404 });
    }
  }

  async requireTenantAssetForUpdate(
    assetId: any,
    account_id: any,
    session?: mongoose.ClientSession
  ): Promise<void> {
    const query = AssetModel.exists({
      _id: assetId,
      account_id,
      visible: true
    });
    if (session) query.session(session);
    const exists = await query;
    if (!exists) {
      throw Object.assign(new Error('Equipment asset not found'), { status: 404 });
    }
  }

  async createEquipment(
    equipment: any,
    account_id: any,
    user_id: any,
    session?: mongoose.ClientSession
  ) {
    equipment = this.removeExtraFields(equipment);
    const newEquipment: any = new AssetModel({
      asset_name: equipment.asset_name,
      asset_id: equipment.asset_id,
      asset_type: equipment.asset_type || "Equipment",
      asset_build_type: equipment.asset_build_type,
      asset_orient: equipment.asset_orient,
      asset_timezone: equipment.asset_timezone,
      isNewFLow: equipment.isNewFLow,
      loadType: equipment.loadType,
      powUnit: equipment.powUnit,
      rotation_type: equipment.rotation_type,
      top_level: true,
      isNewFlow: true,
      locationId: equipment.locationId,
      account_id: account_id,
      description: equipment.description,
      asset_model: equipment.asset_model,
      manufacturer: equipment.manufacturer,
      year: equipment.year,
      assigned_to: equipment.assigned_to,
      image_path: equipment.image_path,
      imageNodeData: equipment.imageNodeData,
      createdBy: user_id
    });
    newEquipment.top_level_asset_id = newEquipment._id;
    return await newEquipment.save(session ? { session } : {});
  }

  async createMotor(motor: any, equipment: any, account_id: any, user_id: any, session?: mongoose.ClientSession) {
    motor = this.removeExtraFields(motor);
    const parentId = equipment._id ? String(equipment._id) : String(equipment.id);
    return new AssetModel({
      parent_id: helperService.validateObjectId(parentId),
      asset_name: motor.asset_name,
      asset_id: motor.asset_id || equipment.asset_id,
      asset_type: motor.asset_type || "Motor",
      asset_build_type: motor.asset_build_type,
      asset_timezone: equipment.asset_timezone,
      // motorType: motor.motorType,
      // lineFreq: motor.lineFreq,
      // asset_behavior: motor.asset_behavior,
      // specificFrequency: motor.specificFrequency,
      // mounting: motor.mounting,
      isNewFlow: true,
      // minInputRotation: motor.minInputRotation,
      // maxInputRotation: motor.maxInputRotation,
      // rotationUnit: motor.rotationUnit,
      // powerRating: motor.powerRating,
      top_level: false,
      locationId: equipment.locationId,
      top_level_asset_id: equipment._id || equipment.id,
      account_id: account_id,
      // asset_model: motor.asset_model,
      // manufacturer: motor.manufacturer,
      // motorRatedEfficiencyPercent: motor.motorRatedEfficiencyPercent,
      // vfdDriven: motor.vfdDriven,
      // ratedCurrentA: motor.ratedCurrentA,
      // ratedVoltageV: motor.ratedVoltageV,
      // nominalPowerFactor: motor.nominalPowerFactor,
      // year: motor.year,
      image_path: motor.image_path,
      createdBy: user_id
    }).save(session ? { session } : {});
  }

  async createFlexible(flexible: any, equipment: any, account_id: any, user_id: any, session?: mongoose.ClientSession): Promise<any> {
    flexible = this.removeExtraFields(flexible);
    const parentId = equipment._id ? String(equipment._id) : String(equipment.id);
    return new AssetModel({
      parent_id: helperService.validateObjectId(parentId),
      asset_name: flexible.asset_name,
      element: flexible.element,
      asset_id: flexible.asset_id || equipment.asset_id,
      asset_type: flexible.asset_type || "Flexible",
      asset_build_type: flexible.asset_build_type,
      asset_timezone: equipment.asset_timezone,
      top_level: false,
      isNewFlow: true,
      locationId: equipment.locationId,
      top_level_asset_id: equipment._id || equipment.id,
      account_id: account_id,
      // description: flexible.description,
      // asset_model: flexible.asset_model,
      // manufacturer: flexible.manufacturer,
      // year: flexible.year,
      image_path: flexible.image_path,
      createdBy: user_id
    }).save(session ? { session } : {});
  }

  async createRigid(rigid: any, equipment: any, account_id: any, user_id: any, session?: mongoose.ClientSession): Promise<any> {
    rigid = this.removeExtraFields(rigid);
    const parentId = equipment._id ? String(equipment._id) : String(equipment.id);
    return new AssetModel({
      parent_id: helperService.validateObjectId(parentId),
      asset_name: rigid.asset_name,
      asset_id: rigid.asset_id || equipment.asset_id,
      asset_type: rigid.asset_type || "Rigid",
      asset_build_type: rigid.asset_build_type,
      // asset_orient: rigid.asset_orient,
      asset_timezone: equipment.asset_timezone,
      // powUnit: rigid.powUnit,
      top_level: false,
      isNewFlow: true,
      locationId: equipment.locationId,
      top_level_asset_id: equipment._id || equipment.id,
      account_id: account_id,
      // description: rigid.description,
      // asset_model: rigid.model,
      // manufacturer: rigid.manufacturer,
      // year: rigid.year,
      image_path: rigid.image_path,
      createdBy: user_id
    }).save(session ? { session } : {});
  }

  async createBeltPulley(beltPulley: any, equipment: any, account_id: any, user_id: any, session?: mongoose.ClientSession): Promise<any> {
    beltPulley = this.removeExtraFields(beltPulley);
    const parentId = equipment._id ? String(equipment._id) : String(equipment.id);
    return new AssetModel({
      parent_id: helperService.validateObjectId(parentId),
      asset_name: beltPulley.asset_name,
      asset_id: beltPulley.asset_id || equipment.asset_id,
      asset_type: beltPulley.asset_type || "Belt_Pulley",
      asset_build_type: beltPulley.asset_build_type,
      asset_timezone: equipment.asset_timezone,
      top_level: false,
      isNewFlow: true,
      locationId: equipment.locationId,
      top_level_asset_id: equipment._id || equipment.id,
      account_id: account_id,
      // drivenPulleyDia: beltPulley.drivenPulleyDia,
      // beltLength: beltPulley.beltLength,
      // outputRPM: beltPulley.outputRPM,
      // noOfGroove: beltPulley.noOfGroove,
      // minInputRotation: beltPulley.minInputRotation,
      // maxInputRotation: beltPulley.maxInputRotation,
      // minOutputRotation: beltPulley.minOutputRotation,
      // maxOutputRotation: beltPulley.maxOutputRotation,
      // drivingPulleyDia: beltPulley.drivingPulleyDia,
      // drivingPulleyDiaUnit: beltPulley.drivingPulleyDiaUnit,
      createdBy: user_id,
      image_path: beltPulley.image_path,
    }).save();
  }

  async createGearbox(gearbox: any, equipment: any, account_id: any, user_id: any, session?: mongoose.ClientSession): Promise<any> {
    gearbox = this.removeExtraFields(gearbox);
    const parentId = equipment._id ? String(equipment._id) : String(equipment.id);
    return new AssetModel({
      parent_id: helperService.validateObjectId(parentId),
      asset_name: gearbox.asset_name,
      asset_id: gearbox.asset_id || equipment.asset_id,
      asset_type: gearbox.asset_type || "Gearbox",
      asset_build_type: gearbox.asset_build_type,
      asset_timezone: equipment.asset_timezone,
      top_level: false,
      isNewFlow: true,
      locationId: equipment.locationId,
      top_level_asset_id: equipment._id || equipment.id,
      account_id: account_id,
      // mounting: gearbox.mounting,
      // minInputRotation: gearbox.minInputRotation,
      // maxInputRotation: gearbox.maxInputRotation,
      // minOutputRotation: gearbox.minOutputRotation,
      // maxOutputRotation: gearbox.maxOutputRotation,
      // noStages: gearbox.noStages,
      // bearingType: gearbox.bearingType,
      // shaft_1_driving_teeth: gearbox.shaft_1_driving_teeth,
      // shaft_2_driving_teeth: gearbox.shaft_2_driving_teeth,
      // shaft_2_driven_teeth: gearbox.shaft_2_driven_teeth,
      // shaft_3_driving_teeth: gearbox.shaft_3_driving_teeth,
      // shaft_3_driven_teeth: gearbox.shaft_3_driven_teeth,
      // shaft_4_driving_teeth: gearbox.shaft_4_driving_teeth,
      // shaft_4_driven_teeth: gearbox.shaft_4_driven_teeth,
      // shaft_5_driven_teeth: gearbox.shaft_5_driven_teeth,
      // description: gearbox.description,
      // asset_model: gearbox.model,
      // manufacturer: gearbox.manufacturer,
      // year: gearbox.year,
      // assigned_to: gearbox.assigned_to,
      image_path: gearbox.image_path,
      createdBy: user_id
    }).save(session ? { session } : {});
  }

  async createFanBlower(fanBlower: any, equipment: any, account_id: any, user_id: any, session?: mongoose.ClientSession): Promise<any> {
    fanBlower = this.removeExtraFields(fanBlower);
    const parentId = equipment._id ? String(equipment._id) : String(equipment.id);
    return new AssetModel({
      parent_id: helperService.validateObjectId(parentId),
      asset_name: fanBlower.asset_name,
      asset_id: fanBlower.asset_id || equipment.asset_id,
      asset_type: fanBlower.asset_type || "Fan_Blower",
      asset_build_type: fanBlower.asset_build_type,
      asset_timezone: equipment.asset_timezone,
      // brandId: fanBlower.brandId,
      // mountType: fanBlower.mountType,
      // brandMake: fanBlower.brandMake,
      // mounting: fanBlower.mounting,
      bearingType: fanBlower.bearingType,
      // bladeCount: fanBlower.bladeCount,
      // minInputRotation: fanBlower.minInputRotation,
      // maxInputRotation: fanBlower.maxInputRotation,
      // specificFrequency: fanBlower.specificFrequency,
      top_level: false,
      isNewFlow: true,
      locationId: equipment.locationId,
      top_level_asset_id: equipment._id || equipment.id,
      account_id: account_id,
      // description: fanBlower.description,
      // asset_model: fanBlower.asset_model,
      // manufacturer: fanBlower.manufacturer,
      // year: fanBlower.year,
      // assigned_to: fanBlower.assigned_to,
      image_path: fanBlower.image_path,
      createdBy: user_id
    }).save(session ? { session } : {});
  }

  async createPumps(pumps: any, equipment: any, account_id: any, user_id: any, session?: mongoose.ClientSession): Promise<any> {
    pumps = this.removeExtraFields(pumps);
    return new AssetModel({
      parent_id: equipment._id ? new mongoose.Types.ObjectId(equipment._id) : new mongoose.Types.ObjectId(equipment.id),
      asset_name: pumps.asset_name,
      // brand: pumps.brand,
      asset_id: pumps.asset_id || equipment.asset_id,
      // casing: pumps.casing,
      asset_type: pumps.asset_type || "Pumps",
      asset_build_type: pumps.asset_build_type,
      asset_timezone: equipment.asset_timezone,
      // impellerBladeCount: pumps.impellerBladeCount,
      // pump_model: pumps.pump_model,
      // impellerType: pumps.impellerType,
      // minInputRotation: pumps.minInputRotation,
      // maxInputRotation: pumps.maxInputRotation,
      // specificFrequency: pumps.specificFrequency,
      top_level: false,
      isNewFlow: true,
      locationId: equipment.locationId,
      top_level_asset_id: equipment._id || equipment.id,
      account_id: account_id,
      // description: pumps.description,
      // asset_model: pumps.model,
      // manufacturer: pumps.manufacturer,
      // year: pumps.year,
      // assigned_to: pumps.assigned_to,
      image_path: pumps.image_path,
      // ratedFlowM3h: pumps.ratedFlowM3h,
      // ratedHeadM: pumps.ratedHeadM,
      // bepFlowM3h: pumps.bepFlowM3h,
      // bepHeadM: pumps.bepHeadM,
      // bepEfficiencyPercent: pumps.bepEfficiencyPercent,
      // minimumContinuousStableFlowM3h: pumps.minimumContinuousStableFlowM3h,
      // motorToPumpSpeedRatio: pumps.motorToPumpSpeedRatio,
      createdBy: user_id
    }).save(session ? { session } : {});
  }

  async createCompressor(compressor: any, equipment: any, account_id: any, user_id: any, session?: mongoose.ClientSession): Promise<any> {
    compressor = this.removeExtraFields(compressor);
    return new AssetModel({
      parent_id: equipment._id ? new mongoose.Types.ObjectId(equipment._id) : new mongoose.Types.ObjectId(equipment.id),
      asset_name: compressor.asset_name,
      asset_id: compressor.asset_id || equipment.asset_id,
      asset_type: compressor.asset_type || "Compressor",
      asset_build_type: compressor.asset_build_type,
      asset_timezone: equipment.asset_timezone,
      // brandModel: compressor.brandModel,
      // pinionGearTeethCount: compressor.pinionGearTeethCount,
      // timingGearTeethCount: compressor.timingGearTeethCount,
      // powerRating: compressor.powerRating,
      // minInputRotation: compressor.minInputRotation,
      // maxInputRotation: compressor.maxInputRotation,
      // mountType: compressor.mountType,
      // specificFrequency: compressor.specificFrequency,
      top_level: false,
      isNewFlow: true,
      locationId: equipment.locationId,
      top_level_asset_id: equipment._id || equipment.id,
      account_id: account_id,
      // description: compressor.description,
      // asset_model: compressor.asset_model,
      // manufacturer: compressor.manufacturer,
      // year: compressor.year,
      // assigned_to: compressor.assigned_to,
      image_path: compressor.image_path,
      createdBy: user_id
    }).save(session ? { session } : {});
  }

  async deleteAssetsById(assetId: any) {
    return await withTransaction(async (session) => {
      const childData = await AssetModel.find({ parent_id: assetId }).session(session);
      if (childData.length > 0) {
        for (const asset of childData) {
          await mapUserToAssetService.removeAssetMapping(`${asset._id}`, session);
        }
        await AssetModel.deleteMany({ _id: { $in: childData.map(doc => doc._id) } }, { session });
      }
      await AssetModel.deleteMany({ _id: assetId }, { session });
      await mapUserToAssetService.removeAssetMapping(assetId, session);
    });
  }

  async deleteEquipmentAssetIds(assetIdList: string[]) {
    return withTransaction(async (session) => {
      return AssetModel.deleteMany({ _id: { $in: assetIdList } }, { session });
    });
  }

  async updateEquipment(equipment: any, account_id: any, user_id: any, existingSession?: mongoose.ClientSession) {
    return await withTransaction(async (session) => {
      equipment = this.removeExtraFields(equipment);
      const updatedEquipment: any = {
        asset_name: equipment.asset_name,
        asset_id: equipment.asset_id,
        asset_type: equipment.asset_type || "Equipment",
        asset_build_type: equipment.asset_build_type,
        asset_orient: equipment.asset_orient,
        asset_timezone: equipment.asset_timezone,
        isNewFLow: equipment.isNewFLow,
        loadType: equipment.loadType,
        powUnit: equipment.powUnit,
        rotation_type: equipment.rotation_type,
        top_level: true,
        isNewFlow: true,
        locationId: equipment.locationId,
        account_id: account_id,
        description: equipment.description,
        asset_model: equipment.asset_model,
        manufacturer: equipment.manufacturer,
        year: equipment.year,
        assigned_to: equipment.assigned_to,
        image_path: equipment.image_path,
        imageNodeData: equipment.imageNodeData,
        updatedBy: user_id
      };
      await this.requireTenantAssetForUpdate(equipment.id, account_id, session);
      await mapUserToAssetService.removeAssetMapping(equipment.id, session);
      return await AssetModel.findOneAndUpdate(
        { _id: equipment.id, account_id, visible: true },
        { $set: updatedEquipment },
        { new: true, session }
      ).lean();
    }, existingSession);
  }

  async updateMotor(motor: any, equipment: any, account_id: any, user_id: any, existingSession?: mongoose.ClientSession) {
    return await withTransaction(async (session) => {
      motor = this.removeExtraFields(motor);
      const updatedMotor = {
        parent_id: equipment.id,
        asset_name: motor.asset_name,
        asset_id: motor.asset_id || equipment.asset_id,
        asset_type: motor.asset_type || "Motor",
        asset_build_type: motor.asset_build_type,
        asset_timezone: equipment.asset_timezone,
        // motorType: motor.motorType,
        // lineFreq: motor.lineFreq,
        // asset_behavior: motor.asset_behavior,
        // specificFrequency: motor.specificFrequency,
        // mounting: motor.mounting,
        isNewFlow: true,
        // minInputRotation: motor.minInputRotation,
        // maxInputRotation: motor.maxInputRotation,
        // rotationUnit: motor.rotationUnit,
        // powerRating: motor.powerRating,
        top_level: false,
        locationId: equipment.locationId,
        top_level_asset_id: equipment.id,
        account_id: account_id,
        // asset_model: motor.asset_model,
        // manufacturer: motor.manufacturer,
        // motorRatedEfficiencyPercent: motor.motorRatedEfficiencyPercent,
        // vfdDriven: motor.vfdDriven,
        // ratedCurrentA: motor.ratedCurrentA,
        // ratedVoltageV: motor.ratedVoltageV,
        // nominalPowerFactor: motor.nominalPowerFactor,
        // year: motor.year,
        updatedBy: user_id
      };
      await this.requireTenantAssetForUpdate(motor.id, account_id, session);
      await mapUserToAssetService.removeAssetMapping(motor.id, session);
      return await AssetModel.findOneAndUpdate(
        { _id: motor.id, account_id, visible: true },
        { $set: updatedMotor },
        { new: true, session }
      ).lean();
    }, existingSession);
  }

  async updateFlexible(flexible: any, equipment: any, account_id: any, user_id: any, existingSession?: mongoose.ClientSession) {
    return await withTransaction(async (session) => {
      flexible = this.removeExtraFields(flexible);
      const updatedFlexible = {
        parent_id: equipment.id,
        asset_name: flexible.asset_name,
        element: flexible.element,
        asset_id: flexible.asset_id || equipment.asset_id,
        asset_type: flexible.asset_type || "Flexible",
        asset_build_type: flexible.asset_build_type,
        asset_timezone: equipment.asset_timezone,
        top_level: false,
        isNewFlow: true,
        locationId: equipment.locationId,
        top_level_asset_id: equipment._id || equipment.id,
        account_id: account_id,
        // description: flexible.description,
        // asset_model: flexible.asset_model,
        // manufacturer: flexible.manufacturer,
        // year: flexible.year,
        // assigned_to: flexible.assigned_to,
        image_path: flexible.image_path,
        updatedBy: user_id
      };
      await this.requireTenantAssetForUpdate(flexible.id, account_id, session);
      await mapUserToAssetService.removeAssetMapping(flexible.id, session);
      return await AssetModel.findOneAndUpdate(
        { _id: flexible.id, account_id, visible: true },
        { $set: updatedFlexible },
        { new: true, session }
      ).lean();
    }, existingSession);
  }

  async updateRigid(rigid: any, equipment: any, account_id: any, user_id: any, existingSession?: mongoose.ClientSession) {
    return await withTransaction(async (session) => {
      rigid = this.removeExtraFields(rigid);
      const updatedRigid = {
        parent_id: equipment.id,
        asset_name: rigid.asset_name,
        asset_id: rigid.asset_id || equipment.asset_id,
        asset_type: rigid.asset_type || "Rigid",
        asset_timezone: equipment.asset_timezone,
        asset_build_type: rigid.asset_build_type,
        // asset_orient: rigid.asset_orient,
        // powUnit: rigid.powUnit,
        top_level: false,
        isNewFlow: true,
        locationId: equipment.locationId,
        top_level_asset_id: equipment.id,
        account_id: account_id,
        // description: rigid.description,
        // asset_model: rigid.model,
        // manufacturer: rigid.manufacturer,
        // year: rigid.year,
        // assigned_to: rigid.assigned_to,
        image_path: rigid.image_path,
        updatedBy: user_id
      };
      await this.requireTenantAssetForUpdate(rigid.id, account_id, session);
      await mapUserToAssetService.removeAssetMapping(rigid.id, session);
      return await AssetModel.findOneAndUpdate(
        { _id: rigid.id, account_id, visible: true },
        { $set: updatedRigid },
        { new: true, session }
      ).lean();
    }, existingSession);
  }

  async updateBeltPulley(beltPulley: any, equipment: any, account_id: any, user_id: any, existingSession?: mongoose.ClientSession) {
    return await withTransaction(async (session) => {
      beltPulley = this.removeExtraFields(beltPulley);
      const updatedBeltPulley = {
        parent_id: equipment.id,
        asset_name: beltPulley.asset_name,
        asset_id: beltPulley.asset_id || equipment.asset_id,
        asset_type: beltPulley.asset_type || "Belt_Pulley",
        asset_build_type: beltPulley.asset_build_type,
        asset_timezone: equipment.asset_timezone,
        top_level: false,
        isNewFlow: true,
        locationId: equipment.locationId,
        top_level_asset_id: equipment.id,
        account_id: account_id,
        // drivenPulleyDia: beltPulley.drivenPulleyDia,
        // beltLength: beltPulley.beltLength,
        // outputRPM: beltPulley.outputRPM,
        // noOfGroove: beltPulley.noOfGroove,
        // minInputRotation: beltPulley.minInputRotation,
        // maxInputRotation: beltPulley.maxInputRotation,
        // minOutputRotation: beltPulley.minOutputRotation,
        // maxOutputRotation: beltPulley.maxOutputRotation,
        // drivingPulleyDia: beltPulley.drivingPulleyDia,
        // drivingPulleyDiaUnit: beltPulley.drivingPulleyDiaUnit,
        updatedBy: user_id
      };
      await this.requireTenantAssetForUpdate(beltPulley.id, account_id, session);
      await mapUserToAssetService.removeAssetMapping(beltPulley.id, session);
      return await AssetModel.findOneAndUpdate(
        { _id: beltPulley.id, account_id, visible: true },
        { $set: updatedBeltPulley },
        { new: true, session }
      ).lean();
    }, existingSession);
  }

  async updateGearbox(gearbox: any, equipment: any, account_id: any, user_id: any, existingSession?: mongoose.ClientSession) {
    return await withTransaction(async (session) => {
      gearbox = this.removeExtraFields(gearbox);
      const updatedGearbox = {
        parent_id: equipment.id,
        asset_name: gearbox.asset_name,
        asset_id: gearbox.asset_id || equipment.asset_id,
        asset_type: gearbox.asset_type || "Gearbox",
        asset_build_type: gearbox.asset_build_type,
        asset_timezone: equipment.asset_timezone,
        top_level: false,
        isNewFlow: true,
        locationId: equipment.locationId,
        top_level_asset_id: equipment.id,
        account_id: account_id,
        // mounting: gearbox.mounting,
        // minInputRotation: gearbox.minInputRotation,
        // maxInputRotation: gearbox.maxInputRotation,
        // minOutputRotation: gearbox.minOutputRotation,
        // maxOutputRotation: gearbox.maxOutputRotation,
        // noStages: gearbox.noStages,
        // bearingType: gearbox.bearingType,
        // shaft_1_driving_teeth: gearbox.shaft_1_driving_teeth,
        // shaft_2_driving_teeth: gearbox.shaft_2_driving_teeth,
        // shaft_2_driven_teeth: gearbox.shaft_2_driven_teeth,
        // shaft_3_driving_teeth: gearbox.shaft_3_driving_teeth,
        // shaft_3_driven_teeth: gearbox.shaft_3_driven_teeth,
        // shaft_4_driving_teeth: gearbox.shaft_4_driving_teeth,
        // shaft_4_driven_teeth: gearbox.shaft_4_driven_teeth,
        // shaft_5_driven_teeth: gearbox.shaft_5_driven_teeth,
        // description: gearbox.description,
        // asset_model: gearbox.model,
        // manufacturer: gearbox.manufacturer,
        // year: gearbox.year,
        // assigned_to: gearbox.assigned_to,
        image_path: gearbox.image_path,
        updatedBy: user_id
      };
      await this.requireTenantAssetForUpdate(gearbox.id, account_id, session);
      await mapUserToAssetService.removeAssetMapping(gearbox.id, session);
      return await AssetModel.findOneAndUpdate(
        { _id: gearbox.id, account_id, visible: true },
        { $set: updatedGearbox },
        { new: true, session }
      ).lean();
    }, existingSession);
  }

  async updateFanBlower(fanBlower: any, equipment: any, account_id: any, user_id: any, existingSession?: mongoose.ClientSession) {
    return await withTransaction(async (session) => {
      fanBlower = this.removeExtraFields(fanBlower);
      const updatedFanBlower = {
        parent_id: equipment.id,
        asset_name: fanBlower.asset_name,
        asset_id: fanBlower.asset_id || equipment.asset_id,
        asset_type: fanBlower.asset_type || "Fan_Blower",
        asset_build_type: fanBlower.asset_build_type,
        asset_timezone: equipment.asset_timezone,
        // brandId: fanBlower.brandId,
        // mountType: fanBlower.mountType,
        // brandMake: fanBlower.brandMake,
        // mounting: fanBlower.mounting,
        // bearingType: fanBlower.bearingType,
        // bladeCount: fanBlower.bladeCount,
        // minInputRotation: fanBlower.minInputRotation,
        // maxInputRotation: fanBlower.maxInputRotation,
        // specificFrequency: fanBlower.specificFrequency,
        top_level: false,
        isNewFlow: true,
        locationId: equipment.locationId,
        top_level_asset_id: equipment.id,
        account_id: account_id,
        // description: fanBlower.description,
        // asset_model: fanBlower.asset_model,
        // manufacturer: fanBlower.manufacturer,
        // year: fanBlower.year,
        // assigned_to: fanBlower.assigned_to,
        image_path: fanBlower.image_path,
        updatedBy: user_id
      };
      await this.requireTenantAssetForUpdate(fanBlower.id, account_id, session);
      await mapUserToAssetService.removeAssetMapping(fanBlower.id, session);
      return await AssetModel.findOneAndUpdate(
        { _id: fanBlower.id, account_id, visible: true },
        { $set: updatedFanBlower },
        { new: true, session }
      ).lean();
    }, existingSession);
  }

  async updatePumps(pumps: any, equipment: any, account_id: any, user_id: any, existingSession?: mongoose.ClientSession) {
    return await withTransaction(async (session) => {
      pumps = this.removeExtraFields(pumps);
      const updatedPumps = {
        parent_id: equipment.id,
        asset_name: pumps.asset_name,
        // brand: pumps.brand,
        asset_id: pumps.asset_id || equipment.asset_id,
        // casing: pumps.casing,
        asset_type: pumps.asset_type || "Pumps",
        asset_build_type: pumps.asset_build_type,
        // impellerBladeCount: pumps.impellerBladeCount,
        asset_timezone: equipment.asset_timezone,
        // pump_model: pumps.pump_model,
        // impellerType: pumps.impellerType,
        // minInputRotation: pumps.minInputRotation,
        // maxInputRotation: pumps.maxInputRotation,
        // specificFrequency: pumps.specificFrequency,
        top_level: false,
        isNewFlow: true,
        locationId: equipment.locationId,
        top_level_asset_id: equipment.id,
        account_id: account_id,
        // description: pumps.description,
        // asset_model: pumps.model,
        // manufacturer: pumps.manufacturer,
        // year: pumps.year,
        // assigned_to: pumps.assigned_to,
        image_path: pumps.image_path,
        updatedBy: user_id,
        // ratedFlowM3h: pumps.ratedFlowM3h,
        // ratedHeadM: pumps.ratedHeadM,
        // bepFlowM3h: pumps.bepFlowM3h,
        // bepHeadM: pumps.bepHeadM,
        // bepEfficiencyPercent: pumps.bepEfficiencyPercent,
        // minimumContinuousStableFlowM3h: pumps.minimumContinuousStableFlowM3h,
        // motorToPumpSpeedRatio: pumps.motorToPumpSpeedRatio
      };
      await mapUserToAssetService.removeAssetMapping(pumps.id, session);
      return await AssetModel.findOneAndUpdate(
        { _id: pumps.id, account_id, visible: true },
        { $set: updatedPumps },
        { new: true, session }
      ).lean();
    }, existingSession);
  }

  async updateCompressor(compressor: any, equipment: any, account_id: any, user_id: any, existingSession?: mongoose.ClientSession) {
    return await withTransaction(async (session) => {
      compressor = this.removeExtraFields(compressor);
      const updatedCompressor = {
        parent_id: equipment.id,
        asset_name: compressor.asset_name,
        asset_id: compressor.asset_id || equipment.asset_id,
        asset_type: compressor.asset_type || "Compressor",
        asset_build_type: compressor.asset_build_type,
        asset_timezone: equipment.asset_timezone,
        // brandModel: compressor.brandModel,
        // pinionGearTeethCount: compressor.pinionGearTeethCount,
        // timingGearTeethCount: compressor.timingGearTeethCount,
        // powerRating: compressor.powerRating,
        // minInputRotation: compressor.minInputRotation,
        // maxInputRotation: compressor.maxInputRotation,
        // mountType: compressor.mountType,
        // specificFrequency: compressor.specificFrequency,
        top_level: false,
        isNewFlow: true,
        locationId: equipment.locationId,
        top_level_asset_id: equipment.id,
        account_id: account_id,
        // description: compressor.description,
        // asset_model: compressor.asset_model,
        // manufacturer: compressor.manufacturer,
        // year: compressor.year,
        // assigned_to: compressor.assigned_to,
        image_path: compressor.image_path,
        updatedBy: user_id
      };
      await this.requireTenantAssetForUpdate(compressor.id, account_id, session);
      await mapUserToAssetService.removeAssetMapping(compressor.id, session);
      return await AssetModel.findOneAndUpdate(
        { _id: compressor.id, account_id, visible: true },
        { $set: updatedCompressor },
        { new: true, session }
      ).lean();
    }, existingSession);
  }

  async getAllChildEquipmentRecursive(parentId: string, account_id: any): Promise<any[]> {
    const children = await AssetModel.find({ parent_id: parentId, account_id, visible: true }).lean();
    const all: any[] = [];
    for (const child of children) {
      if (child._id?.toString() === parentId) continue;
      all.push(child);
      const subChildren = await this.getAllChildEquipmentRecursive(child._id.toString(), account_id);
      all.push(...subChildren);
    }
    return all;
  };

  async makeAssetCopyRecursive(
    id: string,
    user_id: any,
    account_id: any,
    targetLocationId?: any,
    session?: any,
    correlationId?: string
  ): Promise<any> {
    return assetService.makeAssetCopyRecursive(
      id,
      user_id,
      account_id,
      targetLocationId,
      session,
      correlationId
    );
  }
}

export const equipmentService = new EquipmentService();



