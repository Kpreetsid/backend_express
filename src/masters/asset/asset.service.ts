import { Asset, IAsset } from "../../models/asset.model";
import { NextFunction, Request, Response } from 'express';
import { IMapUserLocation, MapUserAssetLocation } from "../../models/mapUserLocation.model";
import { removeAssetMapping } from "../../transaction/mapUserLocation/userLocation.service";
import { IUser, User } from "../../models/user.model";
import { LocationMaster } from "../../models/location.model";
import { get } from "lodash";
import { getData } from "../../util/queryBuilder";
import { getExternalData } from "../../util/externalAPI";

export const getAll = async (match: any) => {
  const assetsData = await Asset.find(match).populate([{ path: 'locationId', select: 'location_name assigned_to' }, { path: 'parent_id', select: 'asset_name'}]);
  const assetsIds = assetsData.map((asset: any) => `${asset._id}`);
  const mapData = await MapUserAssetLocation.find({ assetId: { $in: assetsIds }, userId: { $exists: true } }).populate([{ path: 'userId', select: 'firstName lastName' }]);
  const result: any = assetsData.map((doc: any) => {
    const { _id: id, ...obj} = doc.toObject(); 
    obj.locationId.id = obj.locationId._id;
    obj.id = id;
    const mappedUser = mapData.filter(map => `${map.assetId}` === `${id}`);
    obj.userList = mappedUser.length > 0 ? mappedUser.map((a: any) => a.userId).filter((user: any) => user) : [];
    return obj;
  });
  return result;
}

export const getAssetsFilteredData = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { locations = [], assets = [], top_level } = req.body;
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const match: any = { account_id: account_id, visible: true };
    if(userRole !== 'admin') {
      const mapData = await MapUserAssetLocation.find({ userId: user_id });
      if (!mapData || mapData.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      match._id = { $in: mapData.map(doc => doc.assetId) };
    }
    if (top_level) {
      match.top_level = top_level;
    }
    if (locations && locations.length > 0) {
      match.locationId = { $in: locations };
    }
    if (assets && assets.length > 0) {
      match._id = { $in: assets };
    }
    const data: IAsset[] = await getAll(match);
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
    const { locations, id } = req.body;
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const query: any = { account_id: account_id, visible: true, parent_id: { $in: [null, undefined] }};
    if (userRole !== 'admin') {
      const mapData = await MapUserAssetLocation.find({ userId: user_id });
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
    const rootAssets: IAsset[] = await getData(Asset, { filter: query });
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
  const children: IAsset[] = await getData(Asset, { filter: match });
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
  const mapUsersAssets: IMapUserLocation[] = await MapUserAssetLocation.find(match);
  const userIds = mapUsersAssets.map((user: any) => user.userId);
  const fields = 'firstName lastName user_role';
  const data: IUser[] = await User.find({ _id: { $in: userIds } }).select(fields);
  return data.map((user: any) => user._id).filter((user: any) => user);
}

const getRecursiveLocations = async (asset: any) => {
  const match = { _id: asset.locationId };
  const fields = 'location_name';
  const locationData = await LocationMaster.find(match).select(fields);
  return locationData[0];
}

export const updateAssetImageById = async (id: string, image_path: string, user_id: string) => {
  return await Asset.findOneAndUpdate({ _id: id }, { image_path: image_path, updatedBy: user_id }, { new: true });
}

export const removeById = async (match: any, userID: any) => {
  const childAssets = await Asset.find({ parent_id: match._id });
  if (childAssets && childAssets.length > 0) {
    await Asset.updateMany({ parent_id: match._id }, { visible: false, isActive: false });
  }
  return await Asset.findOneAndUpdate(match, { visible: false, isActive: false, updatedBy: userID }, { new: true });
};

export const deleteAsset = async (id: string): Promise<any> => {
  console.log(`Deleting asset with ID: ${id}`);
  const childAssets = await Asset.find({ parent_id: id });
  if (childAssets && childAssets.length > 0) {
    for(const asset of childAssets) {
      await removeAssetMapping(`${asset._id}`);
    }
    await Asset.deleteMany({ parent_id: id });
  }
  await removeAssetMapping(id);
  return await Asset.deleteOne({ _id: id });
}

export const getAssetDataSensorList = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const match: any = { account_id: account_id, visible: true };
    if(userRole !== 'admin') {
      const mapData = await MapUserAssetLocation.find({ userId: user_id });
      if (mapData && mapData.length > 0) {
        match._id = { $in: mapData.map((doc: any) => doc.assetId) };
      }
    }
    const data = await Asset.find(match).populate([{ path: 'locationId', select: 'location_name' }, { path: 'top_level_asset_id', select: 'asset_name'}, { path: 'account_id', select: 'account_name' }]);
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

const removeExtraFields = (obj: Record<string, any>) => {
  return Object.fromEntries(Object.entries(obj).filter(([_, value]) => value !== undefined && value !== null));
}

export const createEquipment = async (equipment: any, account_id: any, user_id: any) => {
  equipment = removeExtraFields(equipment);
  const newEquipment: any = new Asset({
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
  return await newEquipment.save();
}

export const createMotor = async (motor: any, equipment: any, account_id: any, user_id: any) => {
  motor = removeExtraFields(motor);
  return new Asset({
    parent_id: equipment._id || equipment.id,
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
  return new Asset({
    parent_id: equipment._id || equipment.id,
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
  return new Asset({
    parent_id: equipment._id || equipment.id,
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
  return new Asset({
    parent_id: equipment._id || equipment.id,
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
  return new Asset({
    parent_id: equipment._id || equipment.id,
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
  return new Asset({
    parent_id: equipment._id || equipment.id,
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
  return new Asset({
    parent_id: equipment._id || equipment.id,
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
  return new Asset({
    parent_id: equipment._id || equipment.id,
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
  const assetIdList: string[] = assetsList.map((item: any) => `${item.assetId}`);
  const match = { org_id: `${account_id}`, asset_status: "Not Defined", asset_id: assetIdList };
  return await getExternalData(`/asset_health_status/`, match, token, `${user_id}`);
}

export const deleteAssetsById = async (assetId: any) => {
  const childData = await Asset.find({ parent_id: assetId });
  if(childData.length > 0) {
    for(const asset of childData) {
      await removeAssetMapping(`${asset._id}`);
    }
    await Asset.deleteMany({ _id: { $in: childData.map(doc => doc._id) } });
  }
  await Asset.deleteMany({ _id: assetId });
  await removeAssetMapping(assetId);
}

export const updateEquipment = async (equipment: any, account_id: any, user_id: any) => {
  equipment = removeExtraFields(equipment);
  const updatedEquipment: any = new Asset({
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
  return await Asset.updateOne({ _id: equipment.id }, updatedEquipment);
}

export const updateMotor = async (motor: any, equipment: any, account_id: any, user_id: any) => {
  motor = removeExtraFields(motor);
  const updatedMotor = new Asset({
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
  return await Asset.updateOne({ _id: motor.id }, updatedMotor);
}

export const updateFlexible = async (flexible: any, equipment: any, account_id: any, user_id: any) => {
  flexible = removeExtraFields(flexible);
  const updatedFlexible = new Asset({
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
  return await Asset.updateOne({ _id: flexible.id }, updatedFlexible);
}

export const updateRigid = async (rigid: any, equipment: any, account_id: any, user_id: any) => {
  rigid = removeExtraFields(rigid);
  const updatedRigid =  new Asset({
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
  return await Asset.updateOne({ _id: rigid.id }, updatedRigid);
}

export const updateBeltPulley = async (beltPulley: any, equipment: any, account_id: any, user_id: any) => {
  beltPulley = removeExtraFields(beltPulley);
  const updatedBeltPulley = new Asset({
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
  return await Asset.updateOne({ _id: beltPulley.id }, updatedBeltPulley);
}

export const updateGearbox = async (gearbox: any, equipment: any, account_id: any, user_id: any) => {
  gearbox = removeExtraFields(gearbox);
  const updatedGearbox = new Asset({
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
  return await Asset.updateOne({ _id: gearbox.id }, updatedGearbox);
}

export const updateFanBlower = async (fanBlower: any, equipment: any, account_id: any, user_id: any) => {
  fanBlower = removeExtraFields(fanBlower);
  const updatedFanBlower = new Asset({
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
  return await Asset.updateOne({ _id: fanBlower.id }, updatedFanBlower);
}

export const updatePumps = async (pumps: any, equipment: any, account_id: any, user_id: any) => {
  pumps = removeExtraFields(pumps);
  const updatedPumps = new Asset({
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
  return await Asset.updateOne({ _id: pumps.id }, updatedPumps);
}

export const updateCompressor = async (compressor: any, equipment: any, account_id: any, user_id: any) => {
  compressor = removeExtraFields(compressor);
  const updatedCompressor = new Asset({
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
  return await Asset.updateOne({ _id: compressor.id }, updatedCompressor);
}

// export const updateById = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
//   try {
//     const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
//     const { params: { id }, body: { Equipment, Motor, Flexible, Rigid, Belt_Pulley, Gearbox, Fan_Blower, Pumps, Compressor } } = req;
//     if (!id) {
//       throw Object.assign(new Error('ID is required'), { status: 400 });
//     }
//     const data: any = await Asset.findById(id);
//     if (!data || !data.visible) {
//       throw Object.assign(new Error('No data found'), { status: 404 });
//     }
//     const createPromises: Promise<any>[] = [];
//     const updatePromises: Promise<any>[] = [];
//     if (Equipment) {
//       if (Object.keys(Equipment).length > 0) {
//         if (Equipment.image_path) {
//           if (data.image_path && data.image_path['fileName']) {
//             await deleteBase64Image(data.image_path['fileName'], "asset");
//           }
//           const image = await uploadBase64Image(Equipment.image_path, "assets");
//           Equipment.image_path = image.fileName;
//         }
//         const safeUpdate = { ...removeExtraFields(Equipment), updatedBy: user_id };
//         updatePromises.push(Asset.updateOne({ _id: Equipment.id }, { $set: safeUpdate }));
//       }
//     }
//     if (Motor || Motor.id) {
//       if (Object.keys(Motor).length > 0) {
//         const safeUpdate = { ...removeExtraFields(Motor), updatedBy: user_id };
//         updatePromises.push(Asset.updateOne({ _id: Motor.id }, { $set: safeUpdate }));
//       }
//     } else {
//       const newMotorAsset = new Asset({
//         parent_id: id,
//         asset_name: Motor.asset_name,
//         asset_id: Motor.asset_id || Equipment.asset_id,
//         asset_type: Motor.asset_type || "Motor",
//         motorType: Motor.motorType,
//         lineFreq: Motor.lineFreq,
//         asset_behavior: Motor.asset_behavior,
//         specificFrequency: Motor.specificFrequency,
//         mounting: Motor.mounting,
//         isNewFlow: true,
//         minInputRotation: Motor.minInputRotation,
//         maxInputRotation: Motor.maxInputRotation,
//         rotationUnit: Motor.rotationUnit,
//         powerRating: Motor.powerRating,
//         top_level: false,
//         locationId: Equipment.locationId,
//         top_level_asset_id: Equipment.id,
//         account_id: account_id,
//         asset_model: Motor.asset_model,
//         manufacturer: Motor.manufacturer,
//         year: Motor.year,
//         createdBy: user_id
//       });
//       createPromises.push(newMotorAsset.save());
//     }
//     if (Flexible || Flexible.id) {
//       if (Object.keys(Flexible).length > 0) {
//         const safeUpdate = { ...removeExtraFields(Flexible), updatedBy: user_id };
//         updatePromises.push(Asset.updateOne({ _id: Flexible.id }, { $set: safeUpdate }));
//       }
//     } else {
//       const newFlexibleAsset = new Asset({
//         parent_id: id,
//         asset_name: Flexible.asset_name,
//         element: Flexible.element,
//         asset_id: Flexible.asset_id || Equipment.asset_id,
//         asset_type: Flexible.asset_type || "Flexible",
//         top_level: false,
//         isNewFlow: true,
//         locationId: Equipment.locationId,
//         top_level_asset_id: Equipment.id,
//         account_id: account_id,
//         description: Flexible.description,
//         asset_model: Flexible.asset_model,
//         manufacturer: Flexible.manufacturer,
//         year: Flexible.year,
//         assigned_to: Flexible.assigned_to,
//         image_path: Flexible.image_path,
//         createdBy: user_id
//       });
//       createPromises.push(newFlexibleAsset.save());
//     }
//     if (Rigid || Rigid.id) {
//       if (Object.keys(Rigid).length > 0) {
//         const safeUpdate = { ...removeExtraFields(Rigid), updatedBy: user_id };
//         updatePromises.push(Asset.updateOne({ _id: Rigid.id }, { $set: safeUpdate }));
//       }
//     } else {
//       const newRigidAsset = new Asset({
//         parent_id: id,
//         asset_name: Rigid.asset_name,
//         asset_id: Rigid.asset_id || Equipment.asset_id,
//         asset_type: Rigid.asset_type || "Rigid",
//         asset_orient: Rigid.asset_orient,
//         powUnit: Rigid.powUnit,
//         top_level: false,
//         isNewFlow: true,
//         locationId: Equipment.locationId,
//         top_level_asset_id: Equipment.id,
//         account_id: account_id,
//         description: Rigid.description,
//         asset_model: Rigid.model,
//         manufacturer: Rigid.manufacturer,
//         year: Rigid.year,
//         assigned_to: Rigid.assigned_to,
//         image_path: Rigid.image_path,
//         createdBy: user_id
//       });
//       createPromises.push(newRigidAsset.save());
//     }
//     if (Belt_Pulley.length > 0) {
//       Belt_Pulley.forEach((beltPulley: any) => {
//         if (beltPulley.id) {
//           if (Object.keys(beltPulley).length > 0) {
//             const safeUpdate = { ...removeExtraFields(beltPulley), updatedBy: user_id };
//             updatePromises.push(Asset.updateOne({ _id: beltPulley.id }, { $set: safeUpdate }));
//           }
//         } else {
//           const newBeltPulleyAsset = new Asset({
//             parent_id: id,
//             asset_name: beltPulley.asset_name,
//             asset_id: beltPulley.asset_id || Equipment.asset_id,
//             asset_type: beltPulley.asset_type || "Belt_Pulley",
//             top_level: false,
//             isNewFlow: true,
//             locationId: Equipment.locationId,
//             top_level_asset_id: Equipment.id,
//             account_id: account_id,
//             drivenPulleyDia: beltPulley.drivenPulleyDia,
//             beltLength: beltPulley.beltLength,
//             outputRPM: beltPulley.outputRPM,
//             noOfGroove: beltPulley.noOfGroove,
//             minInputRotation: beltPulley.minInputRotation,
//             maxInputRotation: beltPulley.maxInputRotation,
//             minOutputRotation: beltPulley.minOutputRotation,
//             maxOutputRotation: beltPulley.maxOutputRotation,
//             drivingPulleyDia: beltPulley.drivingPulleyDia,
//             drivingPulleyDiaUnit: beltPulley.drivingPulleyDiaUnit,
//             createdBy: user_id
//           });
//           createPromises.push(newBeltPulleyAsset.save());
//         }
//       });
//     }
//     if (Gearbox.length > 0) {
//       Gearbox.forEach((gearbox: any) => {
//         if (gearbox.id) {
//           if (Object.keys(gearbox).length > 0) {
//              const safeUpdate = { ...removeExtraFields(gearbox), updatedBy: user_id };
//             updatePromises.push(Asset.updateOne({ _id: gearbox.id }, { $set: safeUpdate }));
//           }
//         } else {
//           const newGearBoxAsset = new Asset({
//             parent_id: id,
//             asset_name: gearbox.asset_name,
//             asset_id: gearbox.asset_id || Equipment.asset_id,
//             asset_type: gearbox.asset_type || "Gearbox",
//             top_level: false,
//             isNewFlow: true,
//             locationId: Equipment.locationId,
//             top_level_asset_id: Equipment.id,
//             account_id: account_id,
//             mounting: gearbox.mounting,
//             minInputRotation: gearbox.minInputRotation,
//             maxInputRotation: gearbox.maxInputRotation,
//             minOutputRotation: gearbox.minOutputRotation,
//             maxOutputRotation: gearbox.maxOutputRotation,
//             noStages: gearbox.noStages,
//             bearingType: gearbox.bearingType,
//             stage_1st_driving_teeth: gearbox.stage_1st_driving_teeth,
//             stage_1st_driven_teeth: gearbox.stage_1st_driven_teeth,
//             stage_2nd_driving_teeth: gearbox.stage_2nd_driving_teeth,
//             stage_2nd_driven_teeth: gearbox.stage_2nd_driven_teeth,
//             stage_3rd_driving_teeth: gearbox.stage_3rd_driving_teeth,
//             stage_3rd_driven_teeth: gearbox.stage_3rd_driven_teeth,
//             stage_4th_driving_teeth: gearbox.stage_4th_driving_teeth,
//             stage_4th_driven_teeth: gearbox.stage_4th_driven_teeth,
//             stage_5th_driving_teeth: gearbox.stage_5th_driving_teeth,
//             stage_5th_driven_teeth: gearbox.stage_5th_driven_teeth,
//             stage_6th_driving_teeth: gearbox.stage_6th_driving_teeth,
//             stage_6th_driven_teeth: gearbox.stage_6th_driven_teeth,
//             stage_7th_driving_teeth: gearbox.stage_7th_driving_teeth,
//             stage_7th_driven_teeth: gearbox.stage_7th_driven_teeth,
//             stage_8th_driving_teeth: gearbox.stage_8th_driving_teeth,
//             stage_8th_driven_teeth: gearbox.stage_8th_driven_teeth,
//             description: gearbox.description,
//             asset_model: gearbox.model,
//             manufacturer: gearbox.manufacturer,
//             year: gearbox.year,
//             assigned_to: gearbox.assigned_to,
//             image_path: gearbox.image_path,
//             createdBy: user_id
//           });
//           createPromises.push(newGearBoxAsset.save());
//         }
//       });
//     }
//     if (Fan_Blower || Fan_Blower.id) {
//       if (Object.keys(Fan_Blower).length > 0) {
//         const safeUpdate = { ...removeExtraFields(Fan_Blower), updatedBy: user_id };
//         updatePromises.push(Asset.updateOne({ _id: Fan_Blower.id }, { $set: safeUpdate }));
//       }
//     } else {
//       const newFanBlowerAsset = new Asset({
//         parent_id: id,
//         asset_name: Fan_Blower.asset_name,
//         asset_id: Fan_Blower.asset_id || Equipment.asset_id,
//         asset_type: Fan_Blower.asset_type || "Fan_Blower",
//         brandId: Fan_Blower.brandId,
//         mountType: Fan_Blower.mountType,
//         brandMake: Fan_Blower.brandMake,
//         mounting: Fan_Blower.mounting,
//         bearingType: Fan_Blower.bearingType,
//         bladeCount: Fan_Blower.bladeCount,
//         minInputRotation: Fan_Blower.minInputRotation,
//         maxInputRotation: Fan_Blower.maxInputRotation,
//         specificFrequency: Fan_Blower.specificFrequency,
//         top_level: false,
//         isNewFlow: true,
//         locationId: Equipment.locationId,
//         top_level_asset_id: Equipment.id,
//         account_id: account_id,
//         description: Fan_Blower.description,
//         asset_model: Fan_Blower.asset_model,
//         manufacturer: Fan_Blower.manufacturer,
//         year: Fan_Blower.year,
//         assigned_to: Fan_Blower.assigned_to,
//         image_path: Fan_Blower.image_path,
//         createdBy: user_id
//       });
//       createPromises.push(newFanBlowerAsset.save());
//     }
//     if (Pumps || Pumps.id) {
//       if (Object.keys(Pumps).length > 0) {
//         const safeUpdate = { ...removeExtraFields(Pumps), updatedBy: user_id };
//         updatePromises.push(Asset.updateOne({ _id: Pumps.id }, { $set: safeUpdate }));
//       }
//     } else {
//       const newPumpAsset = new Asset({
//         parent_id: id,
//         asset_name: Pumps.asset_name,
//         brand: Pumps.brand,
//         asset_id: Pumps.asset_id || Equipment.asset_id,
//         casing: Pumps.casing,
//         asset_type: Pumps.asset_type || "Pumps",
//         impellerBladeCount: Pumps.impellerBladeCount,
//         pump_model: Pumps.pump_model,
//         impellerType: Pumps.impellerType,
//         minInputRotation: Pumps.minInputRotation,
//         maxInputRotation: Pumps.maxInputRotation,
//         specificFrequency: Pumps.specificFrequency,
//         top_level: false,
//         isNewFlow: true,
//         locationId: Equipment.locationId,
//         top_level_asset_id: Equipment.id,
//         account_id: account_id,
//         description: Pumps.description,
//         asset_model: Pumps.model,
//         manufacturer: Pumps.manufacturer,
//         year: Pumps.year,
//         assigned_to: Pumps.assigned_to,
//         image_path: Pumps.image_path,
//         createdBy: user_id
//       });
//       createPromises.push(newPumpAsset.save());
//     }
//     if (Compressor || Compressor.id) {
//       if (Object.keys(Compressor).length > 0) {
//         const safeUpdate = { ...removeExtraFields(Compressor), updatedBy: user_id };
//         updatePromises.push(Asset.updateOne({ _id: Compressor.id }, { $set: safeUpdate }));
//       }
//     } else {
//       const newCompressorAsset = new Asset({
//         parent_id: id,
//         asset_name: Compressor.asset_name,
//         asset_id: Compressor.asset_id || Equipment.asset_id,
//         asset_type: Compressor.asset_type || "Compressor",
//         brandModel: Compressor.brandModel,
//         pinionGearTeethCount: Compressor.pinionGearTeethCount,
//         timingGearTeethCount: Compressor.timingGearTeethCount,
//         powerRating: Compressor.powerRating,
//         minInputRotation: Compressor.minInputRotation,
//         maxInputRotation: Compressor.maxInputRotation,
//         mountType: Compressor.mountType,
//         specificFrequency: Compressor.specificFrequency,
//         top_level: false,
//         isNewFlow: true,
//         locationId: Equipment.locationId,
//         top_level_asset_id: equipment._id || equipment.id,
//         account_id: account_id,
//         description: Compressor.description,
//         asset_model: Compressor.asset_model,
//         manufacturer: Compressor.manufacturer,
//         year: Compressor.year,
//         assigned_to: Compressor.assigned_to,
//         image_path: Compressor.image_path,
//         createdBy: user_id
//       });
//       createPromises.push(newCompressorAsset.save());
//     }
//     if (updatePromises.length > 0) {
//       await Promise.all(updatePromises);
//     }
//     let childAssets: any[] = [];
//     if (createPromises.length > 0) {
//       childAssets = await Promise.all(createPromises);
//     }
//     const assetIdList: string[] = childAssets.map((asset: any) => `${asset._id}`);
//     assetIdList.push(`${Equipment.id}`);
//     const match = {
//       "org_id": `${account_id}`,
//       "asset_status": "Not Defined",
//       "asset_id": assetIdList
//     };
//     const token: string = req.headers.authorization as string;
//     await getExternalData(`/asset_health_status/`, match, token, `${user_id}`);

//     const allMapUserAssetData = childAssets.flatMap((asset: any) =>
//       Equipment.userList.map((user: any) => ({
//         userId: user,
//         assetId: asset._id,
//         accountId: account_id
//       }))
//     );
//     await MapUserAssetLocation.insertMany(allMapUserAssetData);
//     const updatedData =  await getAll({ _id: id, account_id: account_id, visible: true });
//     return res.status(200).json({ status: true, message: "Data updated successfully", data: updatedData });
//   } catch (error) {
//     next(error);
//   }
// };