import { Asset, IAsset } from "../../models/asset.model";
import { NextFunction, Request, Response } from 'express';
import { IMapUserLocation, MapUserAssetLocation } from "../../models/mapUserLocation.model";
import { deleteBase64Image, uploadBase64Image } from "../../_config/upload";
import { getExternalData } from "../../util/externalAPI";
import { IUser, User } from "../../models/user.model";
import { LocationMaster } from "../../models/location.model";
import { get } from "lodash";
import { getData } from "../../util/queryBuilder";

export const getAll = async (match: any) => {
  const assetsData = await Asset.find(match).populate([{ path: 'locationId', select: 'location_name assigned_to' }, { path: 'parent_id', select: 'asset_name'}]);
  const assetsIds = assetsData.map((asset: any) => asset.id);
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

export const getAssetsFilteredData = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { locations = [], assets = [], top_level, location_id } = req.body;
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
  } catch (error: any) {
    next(error);
  }
};

export const getAssetsTreeData = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { locations, id } = req.body;
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    if (!account_id) {
      throw Object.assign(new Error('Missing accountId'), { status: 403 });
    }
    const query: any = {
      account_id: account_id,
      visible: true,
      parent_id: { $in: [null, undefined] }
    };
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
  } catch (error: any) {
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
    children.map(async (child) => {
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

export const insert = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const { Equipment, Motor, Flexible, Rigid, Belt_Pulley, Gearbox, Fans_Blowers, Pumps, Compressor } = req.body;
    const childAssets: any[] = [];
 
    const newParentAsset = new Asset({
      asset_name: Equipment.asset_name,
      asset_id: Equipment.asset_id,
      asset_type: Equipment.asset_type || "Equipment",
      asset_orient: Equipment.asset_orient,
      asset_timezone: Equipment.asset_timezone,
      isNewFLow: Equipment.isNewFLow,
      loadType: Equipment.loadType,
      powUnit: Equipment.powUnit,
      rotation_type: Equipment.rotation_type,
      top_level: true,
      isNewFlow: true,
      locationId: Equipment.locationId,
      account_id: account_id,
      description: Equipment.description,
      asset_model: Equipment.asset_model,
      manufacturer: Equipment.manufacturer,
      year: Equipment.year,
      assigned_to: Equipment.assigned_to,
      image_path: Equipment.image_path,
      imageNodeData: Equipment.imageNodeData,
      createdBy: user_id
    })
    const parentAssetData = await newParentAsset.save();
    await Asset.updateOne({ _id: parentAssetData._id }, { $set: { top_level_asset_id: parentAssetData._id } });

    const parentMapData = Equipment.userList.map((user: any) => ({
      userId: user,
      assetId: parentAssetData._id,
      accountId: account_id
    }));
    await MapUserAssetLocation.insertMany(parentMapData);

    if (Motor) {
      if (Object.keys(Motor).length > 0) {
        const newMotorAsset = new Asset({
          parent_id: parentAssetData._id,
          asset_name: Motor.asset_name,
          asset_id: Motor.asset_id || Equipment.asset_id,
          asset_type: Motor.asset_type || "Motor",
          motorType: Motor.motorType,
          lineFreq: Motor.lineFreq,
          asset_behavior: Motor.asset_behavior,
          specificFrequency: Motor.specificFrequency,
          mounting: Motor.mounting,
          isNewFlow: true,
          minInputRotation: Motor.minInputRotation,
          maxInputRotation: Motor.maxInputRotation,
          rotationUnit: Motor.rotationUnit,
          powerRating: Motor.powerRating,
          top_level: false,
          locationId: parentAssetData.locationId,
          top_level_asset_id: parentAssetData._id,
          account_id: account_id,
          asset_model: Motor.asset_model,
          manufacturer: Motor.manufacturer,
          year: Motor.year,
          createdBy: user_id
        });
        childAssets.push(newMotorAsset);
      }
    }

    if (Flexible) {
      if (Object.keys(Flexible).length > 0) {
        const newFlexibleAsset = new Asset({
          parent_id: parentAssetData._id,
          asset_name: Flexible.asset_name,
          element: Flexible.element,
          asset_id: Flexible.asset_id || Equipment.asset_id,
          asset_type: Flexible.asset_type || "Flexible",
          top_level: false,
          isNewFlow: true,
          locationId: parentAssetData.locationId,
          top_level_asset_id: parentAssetData._id,
          account_id: account_id,
          description: Flexible.description,
          asset_model: Flexible.asset_model,
          manufacturer: Flexible.manufacturer,
          year: Flexible.year,
          assigned_to: Flexible.assigned_to,
          image_path: Flexible.image_path,
          createdBy: user_id
        });
        childAssets.push(newFlexibleAsset);
      }
    }

    if (Rigid) {
      if (Object.keys(Rigid).length > 0) {
        const newRigidAsset = new Asset({
          parent_id: parentAssetData._id,
          asset_name: Rigid.asset_name,
          asset_id: Rigid.asset_id || Equipment.asset_id,
          asset_type: Rigid.asset_type || "Rigid",
          asset_orient: Rigid.asset_orient,
          powUnit: Rigid.powUnit,
          top_level: false,
          isNewFlow: true,
          locationId: parentAssetData.locationId,
          top_level_asset_id: parentAssetData._id,
          account_id: account_id,
          description: Rigid.description,
          asset_model: Rigid.model,
          manufacturer: Rigid.manufacturer,
          year: Rigid.year,
          assigned_to: Rigid.assigned_to,
          image_path: Rigid.image_path,
          createdBy: user_id
        });
        childAssets.push(newRigidAsset);
      }
    }

    if (Belt_Pulley.length > 0) {
      Belt_Pulley.forEach((beltPulley: any) => {
        if (beltPulley) {
          if (Object.keys(beltPulley).length > 0) {
            const newBeltPulleyAsset = new Asset({
              parent_id: parentAssetData._id,
              asset_name: beltPulley.asset_name,
              asset_id: beltPulley.asset_id || Equipment.asset_id,
              asset_type: beltPulley.asset_type || "Belt_Pulley",
              top_level: false,
              isNewFlow: true,
              locationId: parentAssetData.locationId,
              top_level_asset_id: parentAssetData._id,
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
            });
            childAssets.push(newBeltPulleyAsset);
          }
        }
      })
    }

    if (Gearbox.length > 0) {
      Gearbox.forEach((gearbox: any) => {
        if (gearbox) {
          if (Object.keys(gearbox).length > 0) {
            const newGearBoxAsset = new Asset({
              parent_id: parentAssetData._id,
              asset_name: gearbox.asset_name,
              asset_id: gearbox.asset_id || Equipment.asset_id,
              asset_type: gearbox.asset_type || "Gearbox",
              top_level: false,
              isNewFlow: true,
              locationId: parentAssetData.locationId,
              top_level_asset_id: parentAssetData._id,
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
            });
            childAssets.push(newGearBoxAsset);
          }
        }
      })
    }

    if (Fans_Blowers) {
      if (Object.keys(Fans_Blowers).length > 0) {
        const newFanBlowerAsset = new Asset({
          parent_id: parentAssetData._id,
          asset_name: Fans_Blowers.asset_name,
          asset_id: Fans_Blowers.asset_id || Equipment.asset_id,
          asset_type: Fans_Blowers.asset_type || "Fans_Blowers",
          brandId: Fans_Blowers.brandId,
          mountType: Fans_Blowers.mountType,
          brandMake: Fans_Blowers.brandMake,
          mounting: Fans_Blowers.mounting,
          bearingType: Fans_Blowers.bearingType,
          bladeCount: Fans_Blowers.bladeCount,
          minInputRotation: Fans_Blowers.minInputRotation,
          maxInputRotation: Fans_Blowers.maxInputRotation,
          specificFrequency: Fans_Blowers.specificFrequency,
          top_level: false,
          isNewFlow: true,
          locationId: parentAssetData.locationId,
          top_level_asset_id: parentAssetData._id,
          account_id: account_id,
          description: Fans_Blowers.description,
          asset_model: Fans_Blowers.asset_model,
          manufacturer: Fans_Blowers.manufacturer,
          year: Fans_Blowers.year,
          assigned_to: Fans_Blowers.assigned_to,
          image_path: Fans_Blowers.image_path,
          createdBy: user_id
        });
        childAssets.push(newFanBlowerAsset);
      }
    }
    if (Pumps) {
      if (Object.keys(Pumps).length > 0) {
        const newPumpAsset = new Asset({
          parent_id: parentAssetData._id,
          asset_name: Pumps.asset_name,
          brand: Pumps.brand,
          asset_id: Pumps.asset_id || Equipment.asset_id,
          casing: Pumps.casing,
          asset_type: Pumps.asset_type || "Pumps",
          impellerBladeCount: Pumps.impellerBladeCount,
          pump_model: Pumps.pump_model,
          impellerType: Pumps.impellerType,
          minInputRotation: Pumps.minInputRotation,
          maxInputRotation: Pumps.maxInputRotation,
          specificFrequency: Pumps.specificFrequency,
          top_level: false,
          isNewFlow: true,
          locationId: parentAssetData.locationId,
          top_level_asset_id: parentAssetData._id,
          account_id: account_id,
          description: Pumps.description,
          asset_model: Pumps.model,
          manufacturer: Pumps.manufacturer,
          year: Pumps.year,
          assigned_to: Pumps.assigned_to,
          image_path: Pumps.image_path,
          createdBy: user_id
        });
        childAssets.push(newPumpAsset);
      }
    }

    if (Compressor) {
      if (Object.keys(Compressor).length > 0) {
        const newCompressorAsset = new Asset({
          parent_id: parentAssetData._id,
          asset_name: Compressor.asset_name,
          asset_id: Compressor.asset_id || Equipment.asset_id,
          asset_type: Compressor.asset_type || "Compressor",
          brandModel: Compressor.brandModel,
          pinionGearTeethCount: Compressor.pinionGearTeethCount,
          timingGearTeethCount: Compressor.timingGearTeethCount,
          powerRating: Compressor.powerRating,
          minInputRotation: Compressor.minInputRotation,
          maxInputRotation: Compressor.maxInputRotation,
          mountType: Compressor.mountType,
          specificFrequency: Compressor.specificFrequency,
          top_level: false,
          isNewFlow: true,
          locationId: parentAssetData.locationId,
          top_level_asset_id: parentAssetData._id,
          account_id: account_id,
          description: Compressor.description,
          asset_model: Compressor.asset_model,
          manufacturer: Compressor.manufacturer,
          year: Compressor.year,
          assigned_to: Compressor.assigned_to,
          image_path: Compressor.image_path,
          createdBy: user_id
        });
        childAssets.push(newCompressorAsset);
      }
    }
    const insertedChildAssets = await Asset.insertMany(childAssets);
    const assetIdList: string[] = insertedChildAssets.map((asset: any) => `${asset._id}`);
    assetIdList.push(`${parentAssetData._id}`);
    const match = {
      "org_id": `${account_id}`,
      "asset_status": "Not Defined",
      "asset_id": assetIdList
    };
    const token: string = req.headers.authorization as string;
    await getExternalData(`/asset_health_status/`, match, token, `${user_id}`);

    const allMapUserAssetData = insertedChildAssets.flatMap((asset: any) =>
      Equipment.userList.map((user: any) => ({
        userId: user,
        assetId: asset._id,
        accountId: account_id
      }))
    );
    await MapUserAssetLocation.insertMany(allMapUserAssetData);
    return res.status(201).json({ status: true, message: "Data created successfully", data: parentAssetData._id });
  } catch (error: any) {
    next(error);
  }
};

export const updateById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const { params: { id }, body: { Equipment, Motor, Flexible, Rigid, Belt_Pulley, Gearbox, Fans_Blowers, Pumps, Compressor } } = req;
    if (!id) {
      throw Object.assign(new Error('ID is required'), { status: 400 });
    }
    const data: any = await Asset.findById(id);
    if (!data || !data.visible) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const createPromises: Promise<any>[] = [];
    const updatePromises: Promise<any>[] = [];
    if (Equipment) {
      if (Object.keys(Equipment).length > 0) {
        if (Equipment.image_path) {
          if (data.image_path && data.image_path['fileName']) {
            await deleteBase64Image(data.image_path['fileName'], "asset");
          }
          const image = await uploadBase64Image(Equipment.image_path, "assets");
          Equipment.image_path = image.fileName;
        }
        updatePromises.push(Asset.updateOne({ _id: Equipment.id }, { $set: { ...Equipment, updatedBy: user_id } }));
      }
    }
    if (Motor || Motor.id) {
      if (Object.keys(Motor).length > 0) {
        updatePromises.push(Asset.updateOne({ _id: Motor.id }, { $set: { ...Motor, updatedBy: user_id } }));
      }
    } else {
      const newMotorAsset = new Asset({
        parent_id: id,
        asset_name: Motor.asset_name,
        asset_id: Motor.asset_id || Equipment.asset_id,
        asset_type: Motor.asset_type || "Motor",
        motorType: Motor.motorType,
        lineFreq: Motor.lineFreq,
        asset_behavior: Motor.asset_behavior,
        specificFrequency: Motor.specificFrequency,
        mounting: Motor.mounting,
        isNewFlow: true,
        minInputRotation: Motor.minInputRotation,
        maxInputRotation: Motor.maxInputRotation,
        rotationUnit: Motor.rotationUnit,
        powerRating: Motor.powerRating,
        top_level: false,
        locationId: Equipment.locationId,
        top_level_asset_id: Equipment.id,
        account_id: account_id,
        asset_model: Motor.asset_model,
        manufacturer: Motor.manufacturer,
        year: Motor.year,
        createdBy: user_id
      });
      createPromises.push(newMotorAsset.save());
    }
    if (Flexible || Flexible.id) {
      if (Object.keys(Flexible).length > 0) {
        updatePromises.push(Asset.updateOne({ _id: Flexible.id }, { $set: { ...Flexible, updatedBy: user_id } }));
      }
    } else {
      const newFlexibleAsset = new Asset({
        parent_id: id,
        asset_name: Flexible.asset_name,
        element: Flexible.element,
        asset_id: Flexible.asset_id || Equipment.asset_id,
        asset_type: Flexible.asset_type || "Flexible",
        top_level: false,
        isNewFlow: true,
        locationId: Equipment.locationId,
        top_level_asset_id: Equipment.id,
        account_id: account_id,
        description: Flexible.description,
        asset_model: Flexible.asset_model,
        manufacturer: Flexible.manufacturer,
        year: Flexible.year,
        assigned_to: Flexible.assigned_to,
        image_path: Flexible.image_path,
        createdBy: user_id
      });
      createPromises.push(newFlexibleAsset.save());
    }
    if (Rigid || Rigid.id) {
      if (Object.keys(Rigid).length > 0) {
        updatePromises.push(Asset.updateOne({ _id: Rigid.id }, { $set: { ...Rigid, updatedBy: user_id } }));
      }
    } else {
      const newRigidAsset = new Asset({
        parent_id: id,
        asset_name: Rigid.asset_name,
        asset_id: Rigid.asset_id || Equipment.asset_id,
        asset_type: Rigid.asset_type || "Rigid",
        asset_orient: Rigid.asset_orient,
        powUnit: Rigid.powUnit,
        top_level: false,
        isNewFlow: true,
        locationId: Equipment.locationId,
        top_level_asset_id: Equipment.id,
        account_id: account_id,
        description: Rigid.description,
        asset_model: Rigid.model,
        manufacturer: Rigid.manufacturer,
        year: Rigid.year,
        assigned_to: Rigid.assigned_to,
        image_path: Rigid.image_path,
        createdBy: user_id
      });
      createPromises.push(newRigidAsset.save());
    }
    if (Belt_Pulley.length > 0) {
      Belt_Pulley.forEach((beltPulley: any) => {
        if (beltPulley.id) {
          if (Object.keys(beltPulley).length > 0) {
            updatePromises.push(Asset.updateOne({ _id: beltPulley.id }, { $set: { ...beltPulley, updatedBy: user_id } }));
          }
        } else {
          const newBeltPulleyAsset = new Asset({
            parent_id: id,
            asset_name: beltPulley.asset_name,
            asset_id: beltPulley.asset_id || Equipment.asset_id,
            asset_type: beltPulley.asset_type || "Belt_Pulley",
            top_level: false,
            isNewFlow: true,
            locationId: Equipment.locationId,
            top_level_asset_id: Equipment.id,
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
          });
          createPromises.push(newBeltPulleyAsset.save());
        }
      });
    }
    if (Gearbox.length > 0) {
      Gearbox.forEach((gearbox: any) => {
        if (gearbox.id) {
          if (Object.keys(gearbox).length > 0) {
            updatePromises.push(Asset.updateOne({ _id: gearbox.id }, { $set: { ...gearbox, updatedBy: user_id } }));
          }
        } else {
          const newGearBoxAsset = new Asset({
            parent_id: id,
            asset_name: gearbox.asset_name,
            asset_id: gearbox.asset_id || Equipment.asset_id,
            asset_type: gearbox.asset_type || "Gearbox",
            top_level: false,
            isNewFlow: true,
            locationId: Equipment.locationId,
            top_level_asset_id: Equipment.id,
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
          });
          createPromises.push(newGearBoxAsset.save());
        }
      });
    }
    if (Fans_Blowers || Fans_Blowers.id) {
      if (Object.keys(Fans_Blowers).length > 0) {
        updatePromises.push(Asset.updateOne({ _id: Fans_Blowers.id }, { $set: { ...Fans_Blowers, updatedBy: user_id } }));
      }
    } else {
      const newFanBlowerAsset = new Asset({
        parent_id: id,
        asset_name: Fans_Blowers.asset_name,
        asset_id: Fans_Blowers.asset_id || Equipment.asset_id,
        asset_type: Fans_Blowers.asset_type || "Fans_Blowers",
        brandId: Fans_Blowers.brandId,
        mountType: Fans_Blowers.mountType,
        brandMake: Fans_Blowers.brandMake,
        mounting: Fans_Blowers.mounting,
        bearingType: Fans_Blowers.bearingType,
        bladeCount: Fans_Blowers.bladeCount,
        minInputRotation: Fans_Blowers.minInputRotation,
        maxInputRotation: Fans_Blowers.maxInputRotation,
        specificFrequency: Fans_Blowers.specificFrequency,
        top_level: false,
        isNewFlow: true,
        locationId: Equipment.locationId,
        top_level_asset_id: Equipment.id,
        account_id: account_id,
        description: Fans_Blowers.description,
        asset_model: Fans_Blowers.asset_model,
        manufacturer: Fans_Blowers.manufacturer,
        year: Fans_Blowers.year,
        assigned_to: Fans_Blowers.assigned_to,
        image_path: Fans_Blowers.image_path,
        createdBy: user_id
      });
      createPromises.push(newFanBlowerAsset.save());
    }
    if (Pumps || Pumps.id) {
      if (Object.keys(Pumps).length > 0) {
        updatePromises.push(Asset.updateOne({ _id: Pumps.id }, { $set: { ...Pumps, updatedBy: user_id } }));
      }
    } else {
      const newPumpAsset = new Asset({
        parent_id: id,
        asset_name: Pumps.asset_name,
        brand: Pumps.brand,
        asset_id: Pumps.asset_id || Equipment.asset_id,
        casing: Pumps.casing,
        asset_type: Pumps.asset_type || "Pumps",
        impellerBladeCount: Pumps.impellerBladeCount,
        pump_model: Pumps.pump_model,
        impellerType: Pumps.impellerType,
        minInputRotation: Pumps.minInputRotation,
        maxInputRotation: Pumps.maxInputRotation,
        specificFrequency: Pumps.specificFrequency,
        top_level: false,
        isNewFlow: true,
        locationId: Equipment.locationId,
        top_level_asset_id: Equipment.id,
        account_id: account_id,
        description: Pumps.description,
        asset_model: Pumps.model,
        manufacturer: Pumps.manufacturer,
        year: Pumps.year,
        assigned_to: Pumps.assigned_to,
        image_path: Pumps.image_path,
        createdBy: user_id
      });
      createPromises.push(newPumpAsset.save());
    }
    if (Compressor || Compressor.id) {
      if (Object.keys(Compressor).length > 0) {
        updatePromises.push(Asset.updateOne({ _id: Compressor.id }, { $set: { ...Compressor, updatedBy: user_id } }));
      }
    } else {
      const newCompressorAsset = new Asset({
        parent_id: id,
        asset_name: Compressor.asset_name,
        asset_id: Compressor.asset_id || Equipment.asset_id,
        asset_type: Compressor.asset_type || "Compressor",
        brandModel: Compressor.brandModel,
        pinionGearTeethCount: Compressor.pinionGearTeethCount,
        timingGearTeethCount: Compressor.timingGearTeethCount,
        powerRating: Compressor.powerRating,
        minInputRotation: Compressor.minInputRotation,
        maxInputRotation: Compressor.maxInputRotation,
        mountType: Compressor.mountType,
        specificFrequency: Compressor.specificFrequency,
        top_level: false,
        isNewFlow: true,
        locationId: Equipment.locationId,
        top_level_asset_id: Equipment._id,
        account_id: account_id,
        description: Compressor.description,
        asset_model: Compressor.asset_model,
        manufacturer: Compressor.manufacturer,
        year: Compressor.year,
        assigned_to: Compressor.assigned_to,
        image_path: Compressor.image_path,
        createdBy: user_id
      });
      createPromises.push(newCompressorAsset.save());
    }
    if (updatePromises.length > 0) {
      await Promise.all(updatePromises);
    }
    let childAssets: any[] = [];
    if (createPromises.length > 0) {
      childAssets = await Promise.all(createPromises);
    }
    const assetIdList: string[] = childAssets.map((asset: any) => `${asset._id}`);
    assetIdList.push(`${Equipment.id}`);
    const match = {
      "org_id": `${account_id}`,
      "asset_status": "Not Defined",
      "asset_id": assetIdList
    };
    const token: string = req.headers.authorization as string;
    await getExternalData(`/asset_health_status/`, match, token, `${user_id}`);

    const allMapUserAssetData = childAssets.flatMap((asset: any) =>
      Equipment.userList.map((user: any) => ({
        userId: user,
        assetId: asset._id,
        accountId: account_id
      }))
    );
    await MapUserAssetLocation.insertMany(allMapUserAssetData);
    return res.status(200).json({ status: true, message: "Data updated successfully", data: id });
  } catch (error: any) {
    next(error);
  }
};

export const removeById = async (match: any) => {
  const childAssets = await Asset.find({ parent_id: match._id });
  if (childAssets && childAssets.length > 0) {
    await Asset.updateMany({ parent_id: match._id }, { visible: false, isActive: false });
  }
  return await Asset.findOneAndUpdate(match, { visible: false, isActive: false }, { new: true });
};