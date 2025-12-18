import { AssetModel } from '../../models/asset.model';
import { MapUserAssetLocationModel } from "../../models/mapUserLocation.model";
import { mapUserToAssetService, mapUserToLocationService } from "../../transaction/mapUserLocation/userLocation.service";
import { processorAPIService } from '../../api-processor';
import mongoose from 'mongoose';

class EquipmentService {
  async getAllEquipment (match: any) {
    const assetsData = await AssetModel.find(match).populate([{ path: 'locationId', model: "Schema_Location", select: 'id location_name assigned_to' }, { path: 'parent_id', model: "Schema_Asset", select: 'id asset_name' }]);
    const assetsIds = assetsData.map((asset: any) => `${asset._id}`);
    const mapData = await MapUserAssetLocationModel.find({ assetId: { $in: assetsIds }, userId: { $exists: true } }).populate([{ path: 'userId', model: "Schema_User", select: 'id firstName lastName' }]);
    const result: any = assetsData.map((doc: any) => {
      const { _id: id, ...obj } = doc.toObject();
      if (obj.locationId) {
        obj.locationId.id = obj.locationId._id;
      }
      if (obj.parent_id) {
        obj.parent_id.id = obj.parent_id._id;
      }
      obj.id = id;
      const mappedUser = mapData.filter(map => `${map.assetId}` === `${id}`);
      obj.userList = mappedUser.length > 0 ? mappedUser.map((a: any) => a.userId).filter((user: any) => user) : [];
      return obj;
    });
    return result;
  }

  async checkEquipment (match: any) {
    return await AssetModel.find(match).lean();
  }

  async getAllChildEquipmentIDs (assetId: any): Promise<string[]> {
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

  async getEquipmentTreeData (match: any): Promise<any> {
    const asset_type_list: string[] = ["Rigid", "Flexible"];
    match.asset_type = { $nin: asset_type_list };
    const allAssets = await AssetModel.find(match).lean();
    if (!allAssets.length) {
      throw Object.assign(new Error("No data found"), { status: 404 });
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
    const buildTree = (asset: any) => {
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

  getEquipmentTreeDataById = async (match: any) => {
    const assets = await AssetModel.aggregate([
      { $match: match },
      { $lookup: {
          from: 'location_master',
          let: { locationId: '$locationId' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$locationId'] } }},
            { $project: { _id: 1, location_name: 1, location_type: 1 }},
            { $addFields: { id: '$_id' }}
          ],
          as: 'locationData'
        }
      },
      { $unwind: { path: '$locationData', preserveNullAndEmptyArrays: true }}
    ]);
    if (!assets.length) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const assetIds = assets.map(a => a._id);
    const assetUsers = await MapUserAssetLocationModel.aggregate([
      { $match: { assetId: { $in: assetIds }, userId: { $exists: true }}},
      { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'user' }},
      { $unwind: '$user' },
      { $project: { assetId: 1, user: { id: '$user._id', firstName: '$user.firstName', lastName: '$user.lastName', user_role: '$user.user_role' }}}
    ]);
    return this.buildEquipmentTree(assets, assetUsers);
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

  async updateEquipmentImageById (id: string, image_path: string, user_id: string) {
    return await AssetModel.findOneAndUpdate({ _id: id }, { image_path: image_path, updatedBy: user_id }, { new: true });
  }

  async removeEquipmentById (match: any, userID: any) {
    const childAssets = await AssetModel.find({ parent_id: match._id });
    if (childAssets && childAssets.length > 0) {
      await AssetModel.updateMany({ parent_id: match._id }, { visible: false, updatedBy: userID });
    }
    await mapUserToLocationService.removeLocationMapping(match._id);
    return await AssetModel.findOneAndUpdate(match, { visible: false, updatedBy: userID }, { new: true });
  };

  async deleteEquipment (id: string): Promise<any> {
    const childAssets = await AssetModel.find({ parent_id: id });
    if (childAssets && childAssets.length > 0) {
      for (const asset of childAssets) {
        await mapUserToAssetService.removeAssetMapping(`${asset._id}`);
      }
      await AssetModel.deleteMany({ parent_id: id });
    }
    await mapUserToAssetService.removeAssetMapping(id);
    return await AssetModel.deleteOne({ _id: id });
  }

  removeExtraFields(obj: Record<string, any>) {
    return Object.fromEntries(Object.entries(obj).filter(([_, value]) => value !== undefined && value !== null));
  }

  async createEquipment (equipment: any, account_id: any, user_id: any) {
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
    return await newEquipment.save();
  }

  async createMotor (motor: any, equipment: any, account_id: any, user_id: any) {
    motor = this.removeExtraFields(motor);
    return new AssetModel({
      parent_id: equipment._id ? new mongoose.Types.ObjectId(equipment._id) : new mongoose.Types.ObjectId(equipment.id),
      asset_name: motor.asset_name,
      asset_id: motor.asset_id || equipment.asset_id,
      asset_type: motor.asset_type || "Motor",
      asset_build_type: motor.asset_build_type,
      asset_timezone: equipment.asset_timezone,
      motorType: motor.motorType,
      lineFreq: motor.lineFreq,
      asset_behavior: motor.asset_behavior,
      specificFrequency: motor.specificFrequency,
      mounting: motor.mounting,
      isNewFlow: true,
      minInputRotation: motor.minInputRotation,
      maxInputRotation: motor.maxInputRotation,
      rotationUnit: motor.rotationUnit,
      powerRating: motor.powerRating,
      top_level: false,
      locationId: equipment.locationId,
      top_level_asset_id: equipment._id || equipment.id,
      account_id: account_id,
      asset_model: motor.asset_model,
      manufacturer: motor.manufacturer,
      year: motor.year,
      createdBy: user_id
    }).save();
  }

  async createFlexible (flexible: any, equipment: any, account_id: any, user_id: any): Promise<any> {
    flexible = this.removeExtraFields(flexible);
    return new AssetModel({
      parent_id: equipment._id ? new mongoose.Types.ObjectId(equipment._id) : new mongoose.Types.ObjectId(equipment.id),
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
      description: flexible.description,
      asset_model: flexible.asset_model,
      manufacturer: flexible.manufacturer,
      year: flexible.year,
      assigned_to: flexible.assigned_to,
      image_path: flexible.image_path,
      createdBy: user_id
    }).save();
  }

  async createRigid (rigid: any, equipment: any, account_id: any, user_id: any): Promise<any> {
    rigid = this.removeExtraFields(rigid);
    return new AssetModel({
      parent_id: equipment._id ? new mongoose.Types.ObjectId(equipment._id) : new mongoose.Types.ObjectId(equipment.id),
      asset_name: rigid.asset_name,
      asset_id: rigid.asset_id || equipment.asset_id,
      asset_type: rigid.asset_type || "Rigid",
      asset_build_type: rigid.asset_build_type,
      asset_orient: rigid.asset_orient,
      asset_timezone: equipment.asset_timezone,
      powUnit: rigid.powUnit,
      top_level: false,
      isNewFlow: true,
      locationId: equipment.locationId,
      top_level_asset_id: equipment._id || equipment.id,
      account_id: account_id,
      description: rigid.description,
      asset_model: rigid.model,
      manufacturer: rigid.manufacturer,
      year: rigid.year,
      assigned_to: rigid.assigned_to,
      image_path: rigid.image_path,
      createdBy: user_id
    }).save();
  }

  async createBeltPulley (beltPulley: any, equipment: any, account_id: any, user_id: any): Promise<any> {
    beltPulley = this.removeExtraFields(beltPulley);
    return new AssetModel({
      parent_id: equipment._id ? new mongoose.Types.ObjectId(equipment._id) : new mongoose.Types.ObjectId(equipment.id),
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
      drivenPulleyDia: beltPulley.drivenPulleyDia,
      beltLength: beltPulley.beltLength,
      outputRPM: beltPulley.outputRPM,
      noOfGroove: beltPulley.noOfGroove,
      minInputRotation: beltPulley.minInputRotation,
      maxInputRotation: beltPulley.maxInputRotation,
      minOutputRotation: beltPulley.minOutputRotation,
      maxOutputRotation: beltPulley.maxOutputRotation,
      drivingPulleyDia: beltPulley.drivingPulleyDia,
      drivingPulleyDiaUnit: beltPulley.drivingPulleyDiaUnit,
      createdBy: user_id
    }).save();
  }

  async createGearbox (gearbox: any, equipment: any, account_id: any, user_id: any): Promise<any> {
    gearbox = this.removeExtraFields(gearbox);
    return new AssetModel({
      parent_id: equipment._id ? new mongoose.Types.ObjectId(equipment._id) : new mongoose.Types.ObjectId(equipment.id),
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
      mounting: gearbox.mounting,
      minInputRotation: gearbox.minInputRotation,
      maxInputRotation: gearbox.maxInputRotation,
      minOutputRotation: gearbox.minOutputRotation,
      maxOutputRotation: gearbox.maxOutputRotation,
      noStages: gearbox.noStages,
      bearingType: gearbox.bearingType,
      stage_1st_driving_teeth: gearbox.stage_1st_driving_teeth,
      stage_1st_driven_teeth: gearbox.stage_1st_driven_teeth,
      stage_2nd_driving_teeth: gearbox.stage_2nd_driving_teeth,
      stage_2nd_driven_teeth: gearbox.stage_2nd_driven_teeth,
      stage_3rd_driving_teeth: gearbox.stage_3rd_driving_teeth,
      stage_3rd_driven_teeth: gearbox.stage_3rd_driven_teeth,
      stage_4th_driving_teeth: gearbox.stage_4th_driving_teeth,
      stage_4th_driven_teeth: gearbox.stage_4th_driven_teeth,
      stage_5th_driving_teeth: gearbox.stage_5th_driving_teeth,
      stage_5th_driven_teeth: gearbox.stage_5th_driven_teeth,
      stage_6th_driving_teeth: gearbox.stage_6th_driving_teeth,
      stage_6th_driven_teeth: gearbox.stage_6th_driven_teeth,
      stage_7th_driving_teeth: gearbox.stage_7th_driving_teeth,
      stage_7th_driven_teeth: gearbox.stage_7th_driven_teeth,
      stage_8th_driving_teeth: gearbox.stage_8th_driving_teeth,
      stage_8th_driven_teeth: gearbox.stage_8th_driven_teeth,
      description: gearbox.description,
      asset_model: gearbox.model,
      manufacturer: gearbox.manufacturer,
      year: gearbox.year,
      assigned_to: gearbox.assigned_to,
      image_path: gearbox.image_path,
      createdBy: user_id
    }).save();
  }

  async createFanBlower (fanBlower: any, equipment: any, account_id: any, user_id: any): Promise<any> {
    fanBlower = this.removeExtraFields(fanBlower);
    return new AssetModel({
      parent_id: equipment._id ? new mongoose.Types.ObjectId(equipment._id) : new mongoose.Types.ObjectId(equipment.id),
      asset_name: fanBlower.asset_name,
      asset_id: fanBlower.asset_id || equipment.asset_id,
      asset_type: fanBlower.asset_type || "Fan_Blower",
      asset_build_type: fanBlower.asset_build_type,
      asset_timezone: equipment.asset_timezone,
      brandId: fanBlower.brandId,
      mountType: fanBlower.mountType,
      brandMake: fanBlower.brandMake,
      mounting: fanBlower.mounting,
      bearingType: fanBlower.bearingType,
      bladeCount: fanBlower.bladeCount,
      minInputRotation: fanBlower.minInputRotation,
      maxInputRotation: fanBlower.maxInputRotation,
      specificFrequency: fanBlower.specificFrequency,
      top_level: false,
      isNewFlow: true,
      locationId: equipment.locationId,
      top_level_asset_id: equipment._id || equipment.id,
      account_id: account_id,
      description: fanBlower.description,
      asset_model: fanBlower.asset_model,
      manufacturer: fanBlower.manufacturer,
      year: fanBlower.year,
      assigned_to: fanBlower.assigned_to,
      image_path: fanBlower.image_path,
      createdBy: user_id
    }).save();
  }

  async createPumps (pumps: any, equipment: any, account_id: any, user_id: any): Promise<any> {
    pumps = this.removeExtraFields(pumps);
    return new AssetModel({
      parent_id: equipment._id ? new mongoose.Types.ObjectId(equipment._id) : new mongoose.Types.ObjectId(equipment.id),
      asset_name: pumps.asset_name,
      brand: pumps.brand,
      asset_id: pumps.asset_id || equipment.asset_id,
      casing: pumps.casing,
      asset_type: pumps.asset_type || "Pumps",
      asset_build_type: pumps.asset_build_type,
      asset_timezone: equipment.asset_timezone,
      impellerBladeCount: pumps.impellerBladeCount,
      pump_model: pumps.pump_model,
      impellerType: pumps.impellerType,
      minInputRotation: pumps.minInputRotation,
      maxInputRotation: pumps.maxInputRotation,
      specificFrequency: pumps.specificFrequency,
      top_level: false,
      isNewFlow: true,
      locationId: equipment.locationId,
      top_level_asset_id: equipment._id || equipment.id,
      account_id: account_id,
      description: pumps.description,
      asset_model: pumps.model,
      manufacturer: pumps.manufacturer,
      year: pumps.year,
      assigned_to: pumps.assigned_to,
      image_path: pumps.image_path,
      createdBy: user_id
    }).save();
  }

  async createCompressor (compressor: any, equipment: any, account_id: any, user_id: any): Promise<any> {
    compressor = this.removeExtraFields(compressor);
    return new AssetModel({
      parent_id: equipment._id ? new mongoose.Types.ObjectId(equipment._id) : new mongoose.Types.ObjectId(equipment.id),
      asset_name: compressor.asset_name,
      asset_id: compressor.asset_id || equipment.asset_id,
      asset_type: compressor.asset_type || "Compressor",
      asset_build_type: compressor.asset_build_type,
      asset_timezone: equipment.asset_timezone,
      brandModel: compressor.brandModel,
      pinionGearTeethCount: compressor.pinionGearTeethCount,
      timingGearTeethCount: compressor.timingGearTeethCount,
      powerRating: compressor.powerRating,
      minInputRotation: compressor.minInputRotation,
      maxInputRotation: compressor.maxInputRotation,
      mountType: compressor.mountType,
      specificFrequency: compressor.specificFrequency,
      top_level: false,
      isNewFlow: true,
      locationId: equipment.locationId,
      top_level_asset_id: equipment._id || equipment.id,
      account_id: account_id,
      description: compressor.description,
      asset_model: compressor.asset_model,
      manufacturer: compressor.manufacturer,
      year: compressor.year,
      assigned_to: compressor.assigned_to,
      image_path: compressor.image_path,
      createdBy: user_id
    }).save();
  }

  async deleteAssetsById (assetId: any) {
    const childData = await AssetModel.find({ parent_id: assetId });
    if (childData.length > 0) {
      for (const asset of childData) {
        await mapUserToAssetService.removeAssetMapping(`${asset._id}`);
      }
      await AssetModel.deleteMany({ _id: { $in: childData.map(doc => doc._id) } });
    }
    await AssetModel.deleteMany({ _id: assetId });
    await mapUserToAssetService.removeAssetMapping(assetId);
  }

  async updateEquipment (equipment: any, account_id: any, user_id: any) {
    equipment = this.removeExtraFields(equipment);
    const updatedEquipment: any = new AssetModel({
      _id: equipment.id,
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
    });
    await mapUserToAssetService.removeAssetMapping(equipment.id);
    return await AssetModel.updateOne({ _id: equipment.id }, updatedEquipment);
  }

  async updateMotor (motor: any, equipment: any, account_id: any, user_id: any) {
    motor = this.removeExtraFields(motor);
    const updatedMotor = new AssetModel({
      _id: motor.id,
      parent_id: equipment.id,
      asset_name: motor.asset_name,
      asset_id: motor.asset_id || equipment.asset_id,
      asset_type: motor.asset_type || "Motor",
      asset_build_type: motor.asset_build_type,
      asset_timezone: equipment.asset_timezone,
      motorType: motor.motorType,
      lineFreq: motor.lineFreq,
      asset_behavior: motor.asset_behavior,
      specificFrequency: motor.specificFrequency,
      mounting: motor.mounting,
      isNewFlow: true,
      minInputRotation: motor.minInputRotation,
      maxInputRotation: motor.maxInputRotation,
      rotationUnit: motor.rotationUnit,
      powerRating: motor.powerRating,
      top_level: false,
      locationId: equipment.locationId,
      top_level_asset_id: equipment.id,
      account_id: account_id,
      asset_model: motor.asset_model,
      manufacturer: motor.manufacturer,
      year: motor.year,
      updatedBy: user_id
    })
    await mapUserToAssetService.removeAssetMapping(motor.id);
    return await AssetModel.updateOne({ _id: motor.id }, updatedMotor);
  }

  async updateFlexible (flexible: any, equipment: any, account_id: any, user_id: any) {
    flexible = this.removeExtraFields(flexible);
    const updatedFlexible = new AssetModel({
      _id: flexible.id,
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
      description: flexible.description,
      asset_model: flexible.asset_model,
      manufacturer: flexible.manufacturer,
      year: flexible.year,
      assigned_to: flexible.assigned_to,
      image_path: flexible.image_path,
      updatedBy: user_id
    })
    await mapUserToAssetService.removeAssetMapping(flexible.id);
    return await AssetModel.updateOne({ _id: flexible.id }, updatedFlexible);
  }

  async updateRigid (rigid: any, equipment: any, account_id: any, user_id: any) {
    rigid = this.removeExtraFields(rigid);
    const updatedRigid = new AssetModel({
      _id: rigid.id,
      parent_id: equipment.id,
      asset_name: rigid.asset_name,
      asset_id: rigid.asset_id || equipment.asset_id,
      asset_type: rigid.asset_type || "Rigid",
      asset_timezone: equipment.asset_timezone,
      asset_build_type: rigid.asset_build_type,
      asset_orient: rigid.asset_orient,
      powUnit: rigid.powUnit,
      top_level: false,
      isNewFlow: true,
      locationId: equipment.locationId,
      top_level_asset_id: equipment.id,
      account_id: account_id,
      description: rigid.description,
      asset_model: rigid.model,
      manufacturer: rigid.manufacturer,
      year: rigid.year,
      assigned_to: rigid.assigned_to,
      image_path: rigid.image_path,
      updatedBy: user_id
    });
    await mapUserToAssetService.removeAssetMapping(rigid.id);
    return await AssetModel.updateOne({ _id: rigid.id }, updatedRigid);
  }

  async updateBeltPulley (beltPulley: any, equipment: any, account_id: any, user_id: any) {
    beltPulley = this.removeExtraFields(beltPulley);
    const updatedBeltPulley = new AssetModel({
      _id: beltPulley.id,
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
      drivenPulleyDia: beltPulley.drivenPulleyDia,
      beltLength: beltPulley.beltLength,
      outputRPM: beltPulley.outputRPM,
      noOfGroove: beltPulley.noOfGroove,
      minInputRotation: beltPulley.minInputRotation,
      maxInputRotation: beltPulley.maxInputRotation,
      minOutputRotation: beltPulley.minOutputRotation,
      maxOutputRotation: beltPulley.maxOutputRotation,
      drivingPulleyDia: beltPulley.drivingPulleyDia,
      drivingPulleyDiaUnit: beltPulley.drivingPulleyDiaUnit,
      updatedBy: user_id
    })
    await mapUserToAssetService.removeAssetMapping(beltPulley.id);
    return await AssetModel.updateOne({ _id: beltPulley.id }, updatedBeltPulley);
  }

  async updateGearbox (gearbox: any, equipment: any, account_id: any, user_id: any) {
    gearbox = this.removeExtraFields(gearbox);
    const updatedGearbox = new AssetModel({
      _id: gearbox.id,
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
      mounting: gearbox.mounting,
      minInputRotation: gearbox.minInputRotation,
      maxInputRotation: gearbox.maxInputRotation,
      minOutputRotation: gearbox.minOutputRotation,
      maxOutputRotation: gearbox.maxOutputRotation,
      noStages: gearbox.noStages,
      bearingType: gearbox.bearingType,
      stage_1st_driving_teeth: gearbox.stage_1st_driving_teeth,
      stage_1st_driven_teeth: gearbox.stage_1st_driven_teeth,
      stage_2nd_driving_teeth: gearbox.stage_2nd_driving_teeth,
      stage_2nd_driven_teeth: gearbox.stage_2nd_driven_teeth,
      stage_3rd_driving_teeth: gearbox.stage_3rd_driving_teeth,
      stage_3rd_driven_teeth: gearbox.stage_3rd_driven_teeth,
      stage_4th_driving_teeth: gearbox.stage_4th_driving_teeth,
      stage_4th_driven_teeth: gearbox.stage_4th_driven_teeth,
      stage_5th_driving_teeth: gearbox.stage_5th_driving_teeth,
      stage_5th_driven_teeth: gearbox.stage_5th_driven_teeth,
      stage_6th_driving_teeth: gearbox.stage_6th_driving_teeth,
      stage_6th_driven_teeth: gearbox.stage_6th_driven_teeth,
      stage_7th_driving_teeth: gearbox.stage_7th_driving_teeth,
      stage_7th_driven_teeth: gearbox.stage_7th_driven_teeth,
      stage_8th_driving_teeth: gearbox.stage_8th_driving_teeth,
      stage_8th_driven_teeth: gearbox.stage_8th_driven_teeth,
      description: gearbox.description,
      asset_model: gearbox.model,
      manufacturer: gearbox.manufacturer,
      year: gearbox.year,
      assigned_to: gearbox.assigned_to,
      image_path: gearbox.image_path,
      updatedBy: user_id
    })
    await mapUserToAssetService.removeAssetMapping(gearbox.id);
    return await AssetModel.updateOne({ _id: gearbox.id }, updatedGearbox);
  }

  async updateFanBlower (fanBlower: any, equipment: any, account_id: any, user_id: any) {
    fanBlower = this.removeExtraFields(fanBlower);
    const updatedFanBlower = new AssetModel({
      _id: fanBlower.id,
      parent_id: equipment.id,
      asset_name: fanBlower.asset_name,
      asset_id: fanBlower.asset_id || equipment.asset_id,
      asset_type: fanBlower.asset_type || "Fan_Blower",
      asset_build_type: fanBlower.asset_build_type,
      asset_timezone: equipment.asset_timezone,
      brandId: fanBlower.brandId,
      mountType: fanBlower.mountType,
      brandMake: fanBlower.brandMake,
      mounting: fanBlower.mounting,
      bearingType: fanBlower.bearingType,
      bladeCount: fanBlower.bladeCount,
      minInputRotation: fanBlower.minInputRotation,
      maxInputRotation: fanBlower.maxInputRotation,
      specificFrequency: fanBlower.specificFrequency,
      top_level: false,
      isNewFlow: true,
      locationId: equipment.locationId,
      top_level_asset_id: equipment.id,
      account_id: account_id,
      description: fanBlower.description,
      asset_model: fanBlower.asset_model,
      manufacturer: fanBlower.manufacturer,
      year: fanBlower.year,
      assigned_to: fanBlower.assigned_to,
      image_path: fanBlower.image_path,
      updatedBy: user_id
    })
    await mapUserToAssetService.removeAssetMapping(fanBlower.id);
    return await AssetModel.updateOne({ _id: fanBlower.id }, updatedFanBlower);
  }

  async updatePumps (pumps: any, equipment: any, account_id: any, user_id: any) {
    pumps = this.removeExtraFields(pumps);
    const updatedPumps = new AssetModel({
      _id: pumps.id,
      parent_id: equipment.id,
      asset_name: pumps.asset_name,
      brand: pumps.brand,
      asset_id: pumps.asset_id || equipment.asset_id,
      casing: pumps.casing,
      asset_type: pumps.asset_type || "Pumps",
      asset_build_type: pumps.asset_build_type,
      impellerBladeCount: pumps.impellerBladeCount,
      asset_timezone: equipment.asset_timezone,
      pump_model: pumps.pump_model,
      impellerType: pumps.impellerType,
      minInputRotation: pumps.minInputRotation,
      maxInputRotation: pumps.maxInputRotation,
      specificFrequency: pumps.specificFrequency,
      top_level: false,
      isNewFlow: true,
      locationId: equipment.locationId,
      top_level_asset_id: equipment.id,
      account_id: account_id,
      description: pumps.description,
      asset_model: pumps.model,
      manufacturer: pumps.manufacturer,
      year: pumps.year,
      assigned_to: pumps.assigned_to,
      image_path: pumps.image_path,
      updatedBy: user_id
    })
    await mapUserToAssetService.removeAssetMapping(pumps.id);
    return await AssetModel.updateOne({ _id: pumps.id }, updatedPumps);
  }

  async updateCompressor (compressor: any, equipment: any, account_id: any, user_id: any) {
    compressor = this.removeExtraFields(compressor);
    const updatedCompressor = new AssetModel({
      _id: compressor.id,
      parent_id: equipment.id,
      asset_name: compressor.asset_name,
      asset_id: compressor.asset_id || equipment.asset_id,
      asset_type: compressor.asset_type || "Compressor",
      asset_build_type: compressor.asset_build_type,
      asset_timezone: equipment.asset_timezone,
      brandModel: compressor.brandModel,
      pinionGearTeethCount: compressor.pinionGearTeethCount,
      timingGearTeethCount: compressor.timingGearTeethCount,
      powerRating: compressor.powerRating,
      minInputRotation: compressor.minInputRotation,
      maxInputRotation: compressor.maxInputRotation,
      mountType: compressor.mountType,
      specificFrequency: compressor.specificFrequency,
      top_level: false,
      isNewFlow: true,
      locationId: equipment.locationId,
      top_level_asset_id: equipment.id,
      account_id: account_id,
      description: compressor.description,
      asset_model: compressor.asset_model,
      manufacturer: compressor.manufacturer,
      year: compressor.year,
      assigned_to: compressor.assigned_to,
      image_path: compressor.image_path,
      updatedBy: user_id
    })
    await mapUserToAssetService.removeAssetMapping(compressor.id);
    return await AssetModel.updateOne({ _id: compressor.id }, updatedCompressor);
  }

  async getAllChildEquipmentRecursive (parentId: string, account_id: any): Promise<any[]> {
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

  async makeAssetCopyByIdWithChildren (sourceAsset: any, user_id: any, token: string, account_id: any, newParentId?: any, idMap?: any, newTopLevelId?: any): Promise<any> {
    try {
      const { createdAt, updatedAt, _id, id, ...rest } = sourceAsset;
      const cleanAsset = JSON.parse(JSON.stringify(rest));
      delete cleanAsset._id;
      delete cleanAsset.id;
      delete cleanAsset.createdAt;
      delete cleanAsset.updatedAt;
      if (!cleanAsset.asset_name) cleanAsset.asset_name = "Unnamed Asset";
      if (!cleanAsset.account_id) cleanAsset.account_id = account_id;
      const baseName = (sourceAsset.asset_name || "Asset").replace(/\s-\s(Copy|\(\d+\))$/, "");
      const existingCount = await AssetModel.countDocuments({
        parent_id: newParentId || { $exists: false },
        account_id,
        asset_name: { $regex: `^${baseName} - Copy`, $options: "i" },
        visible: true
      });
      const newName = existingCount > 0 ? `${baseName} - Copy (${existingCount + 1})` : `${baseName} - Copy`;
      let topLevelRef: any = null;
      if (sourceAsset.top_level) {
        topLevelRef = undefined;
      } else if (newTopLevelId) {
        topLevelRef = newTopLevelId;
      } else {
        topLevelRef = sourceAsset.top_level_asset_id;
      }
      const newAssetData: any = {
        ...cleanAsset,
        asset_name: newName,
        asset_type: sourceAsset.asset_type || "Other",
        asset_build_type: sourceAsset.asset_build_type,
        createdBy: user_id,
        updatedBy: undefined,
        account_id,
        visible: true,
        parent_id: newParentId ? new mongoose.Types.ObjectId(newParentId) : undefined,
        top_level_asset_id: topLevelRef
      };
      const newAsset = new AssetModel(newAssetData);
      const savedAsset: any = await newAsset.save();
      if (sourceAsset.top_level) {
        savedAsset.top_level_asset_id = savedAsset._id;
        await savedAsset.save();
      }
      let userList: any[] = [];
      try {
        const userMappings = await mapUserToAssetService.getDataByAssetId(`${sourceAsset.id || sourceAsset._id}`);
        userList = userMappings.map((doc: any) => doc.userId).filter(Boolean);
      } catch { }
      try {
        const endPointList: any = await processorAPIService.getEndPoints([`${sourceAsset.id || sourceAsset._id}`], token, user_id);
        if (endPointList?.data?.length > 0) {
          for (const item of endPointList.data) {
            const newEndPointPayload = {
              org_id: item.org_id,
              point_name: item.point_name,
              asset_id: savedAsset._id.toString(),
              mount_location: item.mount_location,
              rpm: item.rpm || "",
              bsf: item.bsf || "",
              ftf: item.ftf || "",
              bpfo: item.bpfo || "",
              bpfi: item.bpfi || "",
              bearing_number: item.bearing_number || "",
              parent_asset_id: newParentId || null
            };
            await processorAPIService.createEndPoint(newEndPointPayload, user_id, token);
          }
        }
      } catch (err) {
        console.error("Endpoint copy failed:", err);
      }
      if (userList.length > 0) {
        const mappedData = userList.map((u: any) => ({ assetId: savedAsset._id, userId: u }));
        await mapUserToAssetService.createMapUserAssets(mappedData);
      }
      return savedAsset._id;
    } catch (error) {
      console.error("Error in make Asset Copy:", error);
      throw error;
    }
  };
}

export const equipmentService = new EquipmentService();