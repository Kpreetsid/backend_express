import { AssetModel, IAsset } from '../../models/asset.model';
import { NextFunction, Request, Response } from 'express';
import { IMapUserLocation, MapUserAssetLocationModel } from "../../models/mapUserLocation.model";
import { createMapUserAssets, getDataByAssetId, removeAssetMapping } from "../../transaction/mapUserLocation/userLocation.service";
import { IUser, UserModel } from "../../models/user.model";
import { LocationModel } from "../../models/location.model";
import { get } from "lodash";
import { getData } from "../../util/queryBuilder";
import { getExternalData } from "../../util/externalAPI";
import mongoose from "mongoose";

export const getAllAssets = async (match: any) => {
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

export const getAllChildAssetIDs = async (assetId: any): Promise<string[]> => {
  const children = await AssetModel.find({ parent_id: assetId, visible: true }).select('_id');
  if (!children || children.length === 0) {
    return [assetId];
  }
  const allChildIds: string[] = [];
  for (const child of children) {
    const subChildIds = await getAllChildAssetIDs(child._id);
    allChildIds.push(...subChildIds);
  }
  return [assetId, ...allChildIds];
};

export const getAssetsFilteredData = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { locationList = [], assets = [], top_level } = req.body;
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const match: any = { account_id, visible: true };
    if(userRole !== "admin") {
      const mapData = await MapUserAssetLocationModel.find({ userId: user_id });
      if (!mapData || mapData.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      match._id = { $in: mapData.map(doc => doc.assetId) };
    }
    if (top_level) {
      match.top_level = top_level;
    }
    if (locationList && locationList.length > 0) {
      match.locationId = { $in: locationList };
      if(userRole !== "admin") {
        const mapData = await MapUserAssetLocationModel.find({ userId: user_id, assetId: { $exists: true } });
        if (!mapData || mapData.length === 0) {
          throw Object.assign(new Error('No data found'), { status: 404 });
        }
        match._id = { $in: mapData.map(doc => doc.assetId) };
      }
    }
    if (assets && assets.length > 0) {
      match._id = { $in: assets };
    }
    const data: IAsset[] = await getAllAssets(match);
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    return res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    next(error);
  }
};

export const getAssetsTreeData = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const { locations, id } = req.body;
    const query: any = { account_id: account_id, visible: true, parent_id: { $in: [null, undefined] } };
    if (userRole !== 'admin') {
      const mapData = await MapUserAssetLocationModel.find({ userId: user_id });
      if (mapData && mapData.length > 0) {
        query._id = { $in: mapData.map((doc: any) => doc.assetId) };
      }
    }
    if (id) {
      query._id = id;
      query.top_level = true;
    }
    if (locations && Array.isArray(locations) && locations.length > 0) {
      query.locationId = { $in: locations };
    }
    const rootAssets: IAsset[] = await getData(AssetModel, { filter: query });
    let data = await Promise.all(rootAssets.map(async (asset) => {
      return {
        ...asset,
        childs: await getRecursiveAssets(asset, id),
        userList: await getRecursiveUsers(asset),
        locationData: await getRecursiveLocations(asset)
      };
    }));
    data = data.map((asset: any) => {
      asset.childs = asset.childs.filter((child: any) => child);
      return asset;
    });
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    return res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    next(error);
  }
};

const getRecursiveAssets = async (asset: any, id: string): Promise<any[]> => {
  let ignoreAssets: any = ['Flexible', 'Rigid', 'Belt_Pulley'];
  if (id) {
    ignoreAssets = [];
  }
  const match = { parent_id: asset._id, visible: true };
  const children: IAsset[] = await getData(AssetModel, { filter: match });
  const withChildren = await Promise.all(
    children.map(async (child): Promise<any> => {
      if (child.asset_type) {
        if (!ignoreAssets.includes(child.asset_type)) {
          const childs = await getRecursiveAssets(child, id);
          const locationData = await getRecursiveLocations(child);
          return { ...child, childs, locationData };
        }
      } else {
        const childs = await getRecursiveAssets(child, id);
        const locationData = await getRecursiveLocations(child);
        return { ...child, childs, locationData };
      }
    })
  );
  return withChildren;
}

const getRecursiveUsers = async (asset: any) => {
  const match = { assetId: asset._id };
  const mapUsersAssets: IMapUserLocation[] = await MapUserAssetLocationModel.find(match);
  const userIds = mapUsersAssets.map((user: any) => user.userId);
  const fields = 'firstName lastName user_role';
  const data: IUser[] = await UserModel.find({ _id: { $in: userIds } }).select(fields);
  return data.map((user: any) => user._id).filter((user: any) => user);
}

const getRecursiveLocations = async (asset: any) => {
  const match = { _id: asset.locationId };
  const fields = 'location_name';
  const locationData = await LocationModel.find(match).select(fields);
  return locationData[0];
}

export const updateAssetImageById = async (id: string, image_path: string, user_id: string) => {
  return await AssetModel.findOneAndUpdate({ _id: id }, { image_path: image_path, updatedBy: user_id }, { new: true });
}

export const removeById = async (match: any, userID: any) => {
  const childAssets = await AssetModel.find({ parent_id: match._id });
  if (childAssets && childAssets.length > 0) {
    await AssetModel.updateMany({ parent_id: match._id }, { visible: false, updatedBy: userID });
  }
  // await removeLocationMapping(req.params.id);
  return await AssetModel.findOneAndUpdate(match, { visible: false, updatedBy: userID }, { new: true });
};

export const deleteAsset = async (id: string): Promise<any> => {
  const childAssets = await AssetModel.find({ parent_id: id });
  if (childAssets && childAssets.length > 0) {
    for (const asset of childAssets) {
      await removeAssetMapping(`${asset._id}`);
    }
    await AssetModel.deleteMany({ parent_id: id });
  }
  await removeAssetMapping(id);
  return await AssetModel.deleteOne({ _id: id });
}

export const getAssetDataSensorList = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const match: any = { account_id, visible: true };
    let { assetList } = req.query;
    if (assetList && assetList.toString().split(',').length > 0) {
      match._id = { $in: assetList.toString().split(',') };
    }
    if (userRole !== 'admin') {
      const mapData = await MapUserAssetLocationModel.find({ userId: user_id });
      if (mapData && mapData.length > 0) {
        match._id = { $in: mapData.map((doc: any) => doc.assetId) };
      }
    }
    const data = await AssetModel.find(match).populate([
      { path: 'locationId', model: "Schema_Location", select: 'id location_name' },
      { path: 'top_level_asset_id', model: "Schema_Asset", select: 'id asset_name' },
      { path: 'account_id', model: "Schema_Account", select: 'id account_name' }
    ]);
    if (data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const result = data.map((doc: any) => {
      doc = doc.toObject();
      return {
        "asset_id": doc._id,
        "asset_name": doc.asset_name,
        "top_level_asset_id": doc.top_level_asset_id ? doc.top_level_asset_id._id : "",
        "top_level_asset_name": doc.top_level_asset_id ? doc.top_level_asset_id?.asset_name : "NA",
        "location_id": doc.locationId ? doc.locationId._id : "",
        "location_name": doc.locationId ? doc.locationId.location_name : "NA",
        "company_name": doc.account_id ? doc.account_id.account_name : "NA"
      };
    })
    return res.status(200).json({ status: true, message: "Data fetched successfully", data: result });
  } catch (error) {
    next(error);
  }
}

export const createAssetOld = async (body: any, account_id: any, user_id: any): Promise<any> => {
  const data: any = new AssetModel({ ...body, account_id, createdBy: user_id });
  data.top_level_asset_id = data.top_level_asset_id ? data.top_level_asset_id : data._id;
  return await data.save();
}

export const updateAssetOld = async (id: any, body: any, user_id: any): Promise<any> => {
  return await AssetModel.findOneAndUpdate({ _id: id }, { ...body, updatedBy: user_id }, { new: true });
}

export const updateAllChildAssetsLocation = async (id: any, locationId: any, user_id: any): Promise<any> => {
  const childAssets = await AssetModel.find({ parent_id: id });
  if (childAssets && childAssets.length > 0) {
    for (const asset of childAssets) {
      await updateAllChildAssetsLocation(`${asset._id}`, locationId, user_id);
    }
    return await AssetModel.updateMany({ parent_id: id }, { locationId: locationId, updatedBy: user_id });
  }
}

const removeExtraFields = (obj: Record<string, any>) => {
  return Object.fromEntries(Object.entries(obj).filter(([_, value]) => value !== undefined && value !== null));
}

export const createEquipment = async (equipment: any, account_id: any, user_id: any) => {
  equipment = removeExtraFields(equipment);
  const newEquipment: any = new AssetModel({
    asset_name: equipment.asset_name,
    asset_id: equipment.asset_id,
    asset_type: equipment.asset_type || "Equipment",
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

export const createMotor = async (motor: any, equipment: any, account_id: any, user_id: any) => {
  motor = removeExtraFields(motor);
  return new AssetModel({
    parent_id: equipment._id ? new mongoose.Types.ObjectId(equipment._id) : new mongoose.Types.ObjectId(equipment.id),
    asset_name: motor.asset_name,
    asset_id: motor.asset_id || equipment.asset_id,
    asset_type: motor.asset_type || "Motor",
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

export const createFlexible = async (flexible: any, equipment: any, account_id: any, user_id: any): Promise<any> => {
  flexible = removeExtraFields(flexible);
  return new AssetModel({
    parent_id: equipment._id ? new mongoose.Types.ObjectId(equipment._id) : new mongoose.Types.ObjectId(equipment.id),
    asset_name: flexible.asset_name,
    element: flexible.element,
    asset_id: flexible.asset_id || equipment.asset_id,
    asset_type: flexible.asset_type || "Flexible",
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

export const createRigid = async (rigid: any, equipment: any, account_id: any, user_id: any): Promise<any> => {
  rigid = removeExtraFields(rigid);
  return new AssetModel({
    parent_id: equipment._id ? new mongoose.Types.ObjectId(equipment._id) : new mongoose.Types.ObjectId(equipment.id),
    asset_name: rigid.asset_name,
    asset_id: rigid.asset_id || equipment.asset_id,
    asset_type: rigid.asset_type || "Rigid",
    asset_orient: rigid.asset_orient,
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

export const createBeltPulley = async (beltPulley: any, equipment: any, account_id: any, user_id: any): Promise<any> => {
  beltPulley = removeExtraFields(beltPulley);
  return new AssetModel({
    parent_id: equipment._id ? new mongoose.Types.ObjectId(equipment._id) : new mongoose.Types.ObjectId(equipment.id),
    asset_name: beltPulley.asset_name,
    asset_id: beltPulley.asset_id || equipment.asset_id,
    asset_type: beltPulley.asset_type || "Belt_Pulley",
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

export const createGearbox = async (gearbox: any, equipment: any, account_id: any, user_id: any): Promise<any> => {
  gearbox = removeExtraFields(gearbox);
  return new AssetModel({
    parent_id: equipment._id ? new mongoose.Types.ObjectId(equipment._id) : new mongoose.Types.ObjectId(equipment.id),
    asset_name: gearbox.asset_name,
    asset_id: gearbox.asset_id || equipment.asset_id,
    asset_type: gearbox.asset_type || "Gearbox",
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

export const createFanBlower = async (fanBlower: any, equipment: any, account_id: any, user_id: any): Promise<any> => {
  fanBlower = removeExtraFields(fanBlower);
  return new AssetModel({
    parent_id: equipment._id ? new mongoose.Types.ObjectId(equipment._id) : new mongoose.Types.ObjectId(equipment.id),
    asset_name: fanBlower.asset_name,
    asset_id: fanBlower.asset_id || equipment.asset_id,
    asset_type: fanBlower.asset_type || "Fan_Blower",
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

export const createPumps = async (pumps: any, equipment: any, account_id: any, user_id: any): Promise<any> => {
  pumps = removeExtraFields(pumps);
  return new AssetModel({
    parent_id: equipment._id ? new mongoose.Types.ObjectId(equipment._id) : new mongoose.Types.ObjectId(equipment.id),
    asset_name: pumps.asset_name,
    brand: pumps.brand,
    asset_id: pumps.asset_id || equipment.asset_id,
    casing: pumps.casing,
    asset_type: pumps.asset_type || "Pumps",
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

export const createCompressor = async (compressor: any, equipment: any, account_id: any, user_id: any): Promise<any> => {
  compressor = removeExtraFields(compressor);
  return new AssetModel({
    parent_id: equipment._id ? new mongoose.Types.ObjectId(equipment._id) : new mongoose.Types.ObjectId(equipment.id),
    asset_name: compressor.asset_name,
    asset_id: compressor.asset_id || equipment.asset_id,
    asset_type: compressor.asset_type || "Compressor",
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

export const createExternalAPICall = async (assetsList: any, account_id: any, user_id: any, token: any): Promise<any> => {
  debugger
  const assetIdList: string[] = assetsList.map((item: any) => `${item.assetId}`);
  const match = { org_id: `${account_id}`, asset_status: "Not Defined", asset_id: assetIdList };
  return await getExternalData(`/asset_health_status/`, 'POST', match, token, `${user_id}`);
}

export const deleteAssetsById = async (assetId: any) => {
  const childData = await AssetModel.find({ parent_id: assetId });
  if (childData.length > 0) {
    for (const asset of childData) {
      await removeAssetMapping(`${asset._id}`);
    }
    await AssetModel.deleteMany({ _id: { $in: childData.map(doc => doc._id) } });
  }
  await AssetModel.deleteMany({ _id: assetId });
  await removeAssetMapping(assetId);
}

export const updateEquipment = async (equipment: any, account_id: any, user_id: any) => {
  equipment = removeExtraFields(equipment);
  const updatedEquipment: any = new AssetModel({
    _id: equipment.id,
    asset_name: equipment.asset_name,
    asset_id: equipment.asset_id,
    asset_type: equipment.asset_type || "Equipment",
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
  await removeAssetMapping(equipment.id);
  return await AssetModel.updateOne({ _id: equipment.id }, updatedEquipment);
}

export const updateMotor = async (motor: any, equipment: any, account_id: any, user_id: any) => {
  motor = removeExtraFields(motor);
  const updatedMotor = new AssetModel({
    _id: motor.id,
    parent_id: equipment.id,
    asset_name: motor.asset_name,
    asset_id: motor.asset_id || equipment.asset_id,
    asset_type: motor.asset_type || "Motor",
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
  await removeAssetMapping(motor.id);
  return await AssetModel.updateOne({ _id: motor.id }, updatedMotor);
}

export const updateFlexible = async (flexible: any, equipment: any, account_id: any, user_id: any) => {
  flexible = removeExtraFields(flexible);
  const updatedFlexible = new AssetModel({
    _id: flexible.id,
    parent_id: equipment.id,
    asset_name: flexible.asset_name,
    element: flexible.element,
    asset_id: flexible.asset_id || equipment.asset_id,
    asset_type: flexible.asset_type || "Flexible",
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
  await removeAssetMapping(flexible.id);
  return await AssetModel.updateOne({ _id: flexible.id }, updatedFlexible);
}

export const updateRigid = async (rigid: any, equipment: any, account_id: any, user_id: any) => {
  rigid = removeExtraFields(rigid);
  const updatedRigid = new AssetModel({
    _id: rigid.id,
    parent_id: equipment.id,
    asset_name: rigid.asset_name,
    asset_id: rigid.asset_id || equipment.asset_id,
    asset_type: rigid.asset_type || "Rigid",
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
  await removeAssetMapping(rigid.id);
  return await AssetModel.updateOne({ _id: rigid.id }, updatedRigid);
}

export const updateBeltPulley = async (beltPulley: any, equipment: any, account_id: any, user_id: any) => {
  beltPulley = removeExtraFields(beltPulley);
  const updatedBeltPulley = new AssetModel({
    _id: beltPulley.id,
    parent_id: equipment.id,
    asset_name: beltPulley.asset_name,
    asset_id: beltPulley.asset_id || equipment.asset_id,
    asset_type: beltPulley.asset_type || "Belt_Pulley",
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
  await removeAssetMapping(beltPulley.id);
  return await AssetModel.updateOne({ _id: beltPulley.id }, updatedBeltPulley);
}

export const updateGearbox = async (gearbox: any, equipment: any, account_id: any, user_id: any) => {
  gearbox = removeExtraFields(gearbox);
  const updatedGearbox = new AssetModel({
    _id: gearbox.id,
    parent_id: equipment.id,
    asset_name: gearbox.asset_name,
    asset_id: gearbox.asset_id || equipment.asset_id,
    asset_type: gearbox.asset_type || "Gearbox",
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
  await removeAssetMapping(gearbox.id);
  return await AssetModel.updateOne({ _id: gearbox.id }, updatedGearbox);
}

export const updateFanBlower = async (fanBlower: any, equipment: any, account_id: any, user_id: any) => {
  fanBlower = removeExtraFields(fanBlower);
  const updatedFanBlower = new AssetModel({
    _id: fanBlower.id,
    parent_id: equipment.id,
    asset_name: fanBlower.asset_name,
    asset_id: fanBlower.asset_id || equipment.asset_id,
    asset_type: fanBlower.asset_type || "Fan_Blower",
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
  await removeAssetMapping(fanBlower.id);
  return await AssetModel.updateOne({ _id: fanBlower.id }, updatedFanBlower);
}

export const updatePumps = async (pumps: any, equipment: any, account_id: any, user_id: any) => {
  pumps = removeExtraFields(pumps);
  const updatedPumps = new AssetModel({
    _id: pumps.id,
    parent_id: equipment.id,
    asset_name: pumps.asset_name,
    brand: pumps.brand,
    asset_id: pumps.asset_id || equipment.asset_id,
    casing: pumps.casing,
    asset_type: pumps.asset_type || "Pumps",
    impellerBladeCount: pumps.impellerBladeCount,
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
  await removeAssetMapping(pumps.id);
  return await AssetModel.updateOne({ _id: pumps.id }, updatedPumps);
}

export const updateCompressor = async (compressor: any, equipment: any, account_id: any, user_id: any) => {
  compressor = removeExtraFields(compressor);
  const updatedCompressor = new AssetModel({
    _id: compressor.id,
    parent_id: equipment.id,
    asset_name: compressor.asset_name,
    asset_id: compressor.asset_id || equipment.asset_id,
    asset_type: compressor.asset_type || "Compressor",
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
  await removeAssetMapping(compressor.id);
  return await AssetModel.updateOne({ _id: compressor.id }, updatedCompressor);
}

export const getAllChildAssetsRecursive = async (parentId: string, account_id: any): Promise<any[]> => {
  const children = await AssetModel.find({ parent_id: parentId, account_id, visible: true }).lean();
  const all: any[] = [];
  for (const child of children) {
    if (child._id?.toString() === parentId) continue;
    all.push(child);
    const subChildren = await getAllChildAssetsRecursive(child._id.toString(), account_id);
    all.push(...subChildren);
  }
  return all;
};

export const makeAssetCopyByIdWithChildren = async (sourceAsset: any, user_id: any, token: string, account_id: any, newParentId?: any, idMap?: any): Promise<mongoose.Types.ObjectId> => {
  try {
    const { createdAt, updatedAt, _id, id, ...rest } = sourceAsset;
    const cleanAsset = JSON.parse(JSON.stringify(rest));
    delete cleanAsset._id;
    delete cleanAsset.id;
    delete cleanAsset.createdAt;
    delete cleanAsset.updatedAt;

    if (!cleanAsset.asset_name) cleanAsset.asset_name = "Unnamed Asset";
    if (!cleanAsset.account_id) cleanAsset.account_id = account_id;
    if (!cleanAsset.createdBy) cleanAsset.createdBy = user_id;
    const baseName = (sourceAsset.asset_name || "Asset").replace(/\s-\s(Copy|\(\d+\))$/, "");
    const existingCount = await AssetModel.countDocuments({
      parent_id: newParentId || { $exists: false },
      account_id,
      asset_name: { $regex: `^${baseName} - Copy`, $options: "i" },
      visible: true,
    });
    const newName = existingCount > 0 ? `${baseName} - Copy (${existingCount + 1})` : `${baseName} - Copy`;
    const newAssetData: any = {
      ...cleanAsset,
      asset_name: newName,
      asset_type: sourceAsset.asset_type || "Other",
      createdBy: user_id,
      updatedBy: undefined,
      account_id,
      visible: true,
      parent_id: newParentId ? new mongoose.Types.ObjectId(newParentId) : undefined,
    };
    delete newAssetData._id;
    delete newAssetData.id;
    const newAsset = new AssetModel(newAssetData);
    newAsset.top_level_asset_id = newAsset.top_level ? newAsset._id : cleanAsset.top_level_asset_id || newParentId;
    const savedAsset: any = await newAsset.save();

    let userList: any[] = [];
    const userMappings = await getDataByAssetId(`${sourceAsset.id || sourceAsset._id}`);
    if (Array.isArray(userMappings) && userMappings.length > 0) {
      userList = userMappings.map((doc: any) => doc.userId).filter(Boolean);
    }
    if (userList.length > 0) {
      const mappedData = userList.map((u: any) => ({
        assetId: savedAsset._id || savedAsset.id,
        userId: u,
      }));
      await createExternalAPICall(mappedData, savedAsset.account_id, user_id, token);
      await createMapUserAssets(mappedData);
    }
    return savedAsset._id;
  } catch (error: any) {
    console.error("Error in makeAssetCopyByIdWithChildren:", error);
    throw error;
  }
};
