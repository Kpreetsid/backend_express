import { Asset, IAsset } from "../../models/asset.model";
import { NextFunction, Request, Response } from 'express';
import { MapUserAsset } from "../../models/mapUserAsset.model";
import { hasPermission } from "../../_config/permission";

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id } = req.user;
    const match: any = { account_id: account_id, visible: true };
    if(!hasPermission('admin')) {
      const mapData = await MapUserAsset.find({userId: user_id});
      if(!mapData || mapData.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      match._id = { $in: mapData.map(doc => doc.assetId) };
    }
    const data: IAsset[] | null = await Asset.find(match).sort({ _id: -1 });
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    return res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const getDataById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const data = await Asset.findById(id);
    if (!data || !data.visible) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    return res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const getAssetsFilteredData = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { locations = [], assets = [], top_level } = req.body;
    const { account_id, _id: user_id } = req.user;
    if (!account_id) {
      throw Object.assign(new Error('Missing accountId'), { status: 403 });
    }
    const query: any = {
      account_id: account_id,
      visible: true
    };
    if(top_level) {
      query.top_level = top_level;
    }
    if (locations && locations.length > 0) {
      query.locationId = { $in: locations };
    }
    if(assets && assets.length > 0) {
      query._id = { $in: assets };
    }
    const data = await Asset.find(query);
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    return res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const getAssetsTreeData = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { locations } = req.body;
    const { account_id, _id: user_id } = req.user;
    if (!account_id) {
      throw Object.assign(new Error('Missing accountId'), { status: 403 });
    }
    const query: any = {
      account_id: account_id,
      visible: true,
      parent_id: { $in: [null, undefined] }
    };

    if (locations && Array.isArray(locations) && locations.length > 0) {
      query.locationId = { $in: locations };
    }
    const rootAssets = await Asset.find(query);
    const data = await Promise.all(rootAssets.map(async (asset) => {
      return {
        ...asset.toObject(),
        children: await getRecursiveAssets(asset)
      };
    }));
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    return res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

async function getRecursiveAssets(asset: any) {
  const children = await Asset.find({
    parent_id: asset._id,
    visible: true
  });

  const withChildren: any = await Promise.all(children.map(async (child: any) => {
    return {
      ...child.toObject(),
      children: await getRecursiveAssets(child)
    };
  }));

  return withChildren;
}

export const insert = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id } = req.user;
    const { Equipment, Motor, Flexible, Rigid, Belt_Pulley, Gearbox, Fans_Blowers, Pumps, Compressor } = req.body;
    const { label: equipmentName, value: equipmentValue } = Equipment; // parent
    const { label: motorName, value: motorValue } = Motor; // child
    const { label: flexibleName, value: flexibleValue } = Flexible; // child
    const { label: rigidName, value: rigidValue } = Rigid; // child
    const { label: beltPulleyName, value: beltPulleyValue } = Belt_Pulley; // child
    const { label: gearboxName, value: gearboxValue } = Gearbox; // child
    const { label: fansBlowersName, value: fansBlowersValue } = Fans_Blowers; // child
    const { label: pumpsName, value: pumpsValue } = Pumps; // child
    const { label: compressorName, value: compressorValue } = Compressor; // child
    const childAssets: any[] = [];
    const newParentAsset = new Asset({
      asset_name: equipmentValue.equipmentName,
      asset_id: equipmentValue.equipmentId,
      asset_type: equipmentValue.equipmentType,
      asset_orient: equipmentValue.equipmentOrient,
      powUnit: equipmentValue.powUnit,
      top_level: true,
      locationId: equipmentValue.location_id,
      account_id: account_id,
      description: equipmentValue.description,
      asset_model: equipmentValue.model,
      manufacturer: equipmentValue.manufacturer,
      year: equipmentValue.year,
      assigned_to: equipmentValue.assigned_to,
      image_path: equipmentValue.image_path,
      createdBy: user_id
    })
    const parentAssetData = await newParentAsset.save();

    if(motorValue) {
      if(Object.keys(motorValue).length > 0) {
        const newMotorAsset = new Asset({
          parent_id: parentAssetData._id,
          asset_name: motorValue.title,
          asset_id: motorValue.motorId,
          asset_type: motorValue.motorType,
          asset_behavior: motorValue.motor,
          asset_frequency: motorValue.lineFreq,
          mounting: motorValue.mounting,
          minRotation: motorValue.minRotation,
          maxRotation: motorValue.maxRotation,
          rotationUnit: motorValue.rotationUnit,
          powerRating: motorValue.powerRating,
          top_level: false,
          locationId: parentAssetData.locationId,
          top_level_asset_id: parentAssetData._id,
          account_id: account_id,
          asset_model: motorValue.model,
          manufacturer: motorValue.manufacturer,
          year: motorValue.year,
          createdBy: user_id
        });
        childAssets.push(newMotorAsset);
      }
    }

    if(flexibleValue) {
      if(Object.keys(flexibleValue).length > 0) {
        const newFlexibleAsset = new Asset({
          parent_id: parentAssetData._id,
          asset_name: flexibleValue.title,
          asset_id: flexibleValue.asset_id,
          asset_type: flexibleValue.type,
          top_level: false,
          locationId: parentAssetData.locationId,
          top_level_asset_id: parentAssetData._id,
          account_id: account_id,
          description: flexibleValue.description,
          asset_model: flexibleValue.model,
          manufacturer: flexibleValue.manufacturer,
          year: flexibleValue.year,
          assigned_to: flexibleValue.assigned_to,
          image_path: flexibleValue.image_path,
          createdBy: user_id
        });
        childAssets.push(newFlexibleAsset);
      }
    }

    if(rigidValue) {
      if(Object.keys(rigidValue).length > 0) {
        const newRigidAsset = new Asset({
          parent_id: parentAssetData._id,
          asset_name: rigidValue.title,
          asset_id: rigidValue.asset_id,
          asset_type: rigidValue.type,
          asset_orient: rigidValue.asset_orient,
          powUnit: rigidValue.powUnit,
          top_level: false,
          locationId: parentAssetData.locationId,
          top_level_asset_id: parentAssetData._id,
          account_id: account_id,
          description: rigidValue.description,
          asset_model: rigidValue.model,
          manufacturer: rigidValue.manufacturer,
          year: rigidValue.year,
          assigned_to: rigidValue.assigned_to,
          image_path: rigidValue.image_path,
          createdBy: user_id
        });
        childAssets.push(newRigidAsset);
      }
    }

    if(beltPulleyValue) {
      if(Object.keys(beltPulleyValue).length > 0) {
        for(let i = 0; i < beltPulleyValue.length; i++) {
          const newBeltPulleyAsset = new Asset({
            parent_id: parentAssetData._id,
            asset_name: beltPulleyValue[i].title,
            asset_id: beltPulleyValue[i].asset_id,
            asset_type: beltPulleyValue[i].type,
            top_level: false,
            locationId: parentAssetData.locationId,
            top_level_asset_id: parentAssetData._id,
            account_id: account_id,
            minInputRotation: beltPulleyValue[i].minInputRotation,
            maxInputRotation: beltPulleyValue[i].maxInputRotation,
            minOutputRotation: beltPulleyValue[i].minOutputRotation,
            maxOutputRotation: beltPulleyValue[i].maxOutputRotation,
            drivingPulleyDia: beltPulleyValue[i].drivingPulleyDia,
            drivenPulleyDia: beltPulleyValue[i].drivenPulleyDia,
            beltLength: beltPulleyValue[i].beltLength,
            outputRPM: beltPulleyValue[i].outputRPM,
            noOfGrooves: beltPulleyValue[i].noOfGrooves,
            description: beltPulleyValue[i].description,
            asset_model: beltPulleyValue[i].model,
            manufacturer: beltPulleyValue[i].manufacturer,
            year: beltPulleyValue[i].year,
            assigned_to: beltPulleyValue[i].assigned_to,
            image_path: beltPulleyValue[i].image_path,
            createdBy: user_id
          });
          childAssets.push(newBeltPulleyAsset);
        }
      }
    }

    if(gearboxValue) {
      if(Object.keys(gearboxValue).length > 0) {
        for(let i = 0; i < gearboxValue.length; i++) {
          const stageList: any[] = [];
          for(let j = 0; j < gearboxValue[i].noStage; j++) {
            let drivingKey = `stage_${j + 1}_driving_teeth`;
            let drivenKey = `stage_${j + 1}_driven_teeth`;
            stageList.push({
              [drivingKey]: gearboxValue[i][drivingKey],
              [drivenKey]: gearboxValue[i][drivenKey]
            })
          }
          const newGearBoxAsset = new Asset({
            parent_id: parentAssetData._id,
            asset_name: gearboxValue[i].title,
            asset_id: gearboxValue[i].asset_id,
            asset_type: gearboxValue[i].bearingType,
            mounting: gearboxValue[i].mounting,
            minInputRotation: gearboxValue[i].minInputRotation,
            maxInputRotation: gearboxValue[i].maxInputRotation,
            minOutputRotation: gearboxValue[i].minOutputRotation,
            maxOutputRotation: gearboxValue[i].maxOutputRotation,
            noStage: gearboxValue[i].noStage,
            stageList: stageList,
            top_level: false,
            locationId: parentAssetData.locationId,
            top_level_asset_id: parentAssetData._id,
            account_id: account_id,
            description: gearboxValue[i].description,
            asset_model: gearboxValue[i].model,
            manufacturer: gearboxValue[i].manufacturer,
            year: gearboxValue[i].year,
            assigned_to: gearboxValue[i].assigned_to,
            image_path: gearboxValue[i].image_path,
            createdBy: user_id
          });
          childAssets.push(newGearBoxAsset);
        }      
      }
    }

    if(fansBlowersValue) {
      if(Object.keys(fansBlowersValue).length > 0) {
        const newFanBlowerAsset = new Asset({
          parent_id: parentAssetData._id,
          asset_name: fansBlowersValue.title,
          asset_id: fansBlowersValue.brandId,
          asset_type: fansBlowersValue.type,
          bearingType: fansBlowersValue.bearingType,
          brandMake: fansBlowersValue.brandMake,
          mounting: fansBlowersValue.mounting,
          bladeCount: fansBlowersValue.bladeCount,
          minRotation: fansBlowersValue.minRotation,
          maxRotation: fansBlowersValue.maxRotation,
          specificFrequency: fansBlowersValue.specificFreq,
          top_level: false,
          locationId: parentAssetData.locationId,
          top_level_asset_id: parentAssetData._id,
          account_id: account_id,
          description: fansBlowersValue.description,
          asset_model: fansBlowersValue.model,
          manufacturer: fansBlowersValue.manufacturer,
          year: fansBlowersValue.year,
          assigned_to: fansBlowersValue.assigned_to,
          image_path: fansBlowersValue.image_path,
          createdBy: user_id
        });
        childAssets.push(newFanBlowerAsset);
      }
    }
    if(pumpsValue) { 
      if(Object.keys(pumpsValue).length > 0) {
        const newPumpAsset = new Asset({
          parent_id: parentAssetData._id,
          asset_name: pumpsValue.title,
          brand: pumpsValue.brand,
          asset_id: pumpsValue.asset_id,
          casing: pumpsValue.casing,
          asset_type: pumpsValue.impellerType,
          impellerBladeCount: pumpsValue.impellerBladeCount,
          minRotation: pumpsValue.minRotation,
          maxRotation: pumpsValue.maxRotation,
          specificFrequency: pumpsValue.specificFreq,
          top_level: false,
          locationId: parentAssetData.locationId,
          top_level_asset_id: parentAssetData._id,
          account_id: account_id,
          description: pumpsValue.description,
          asset_model: pumpsValue.model,
          manufacturer: pumpsValue.manufacturer,
          year: pumpsValue.year,
          assigned_to: pumpsValue.assigned_to,
          image_path: pumpsValue.image_path,
          createdBy: user_id
        });
        childAssets.push(newPumpAsset);
      }
    }

    if(compressorValue) {
      if(Object.keys(compressorValue).length > 0) {
        const newCompressorAsset = new Asset({
          parent_id: parentAssetData._id,
          asset_name: compressorValue.title,
          asset_id: compressorValue.asset_id,
          asset_type: compressorValue.type,
          brandModel: compressorValue.brandModel,
          pinionGearTeethCount: compressorValue.pinionGearTeethCount,
          timingGearTeethCount: compressorValue.timingGearTeethCount,
          powerRating: compressorValue.powerRating,
          minRotation: compressorValue.minRotation,
          maxRotation: compressorValue.maxRotation,
          specificFrequency: compressorValue.specificFreq,
          top_level: false,
          locationId: parentAssetData.locationId,
          top_level_asset_id: parentAssetData._id,
          account_id: account_id,
          description: compressorValue.description,
          asset_model: compressorValue.model,
          manufacturer: compressorValue.manufacturer,
          year: compressorValue.year,
          assigned_to: compressorValue.assigned_to,
          image_path: compressorValue.image_path,
          createdBy: user_id
        });
        childAssets.push(newCompressorAsset);
      }
    }
    // console.log(childAssets);
    const data = await Asset.insertMany(childAssets);
    const userList = equipmentValue.userList;
    if(userList && userList.length > 0 && data && data.length > 0 && userList && userList.length > 0) {
      let newMapUserLocationList: any = [];
      data.forEach((asset: any) => {
        userList.forEach((user: any) => {
          const newMapUserLocation = new MapUserAsset({
            userId: user,
            assetId: asset._id,
            accountId: account_id
          });
          newMapUserLocationList.push(newMapUserLocation);
        })
      })
      await MapUserAsset.insertMany(newMapUserLocationList);
    }
    return res.status(201).json({ status: true, message: "Data created successfully", data });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const createAssetsWithImage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log(req.files);
    const newAsset = new Asset(req.body);
    const data = await newAsset.save();
    return res.status(201).json({ status: true, message: "Data created successfully", data });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const updateById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const data = await Asset.findByIdAndUpdate(id, req.body, { new: true });
    if (!data || !data.visible) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    return res.status(200).json({ status: true, message: "Data updated successfully", data });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const removeById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const data = await Asset.findById(id);
    if (!data || !data.visible) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    await Asset.findByIdAndUpdate(id, { visible: false }, { new: true });
    return res.status(200).json({ status: true, message: "Data deleted successfully" });
  } catch (error) {
    console.error(error);
    next(error);
  }
};