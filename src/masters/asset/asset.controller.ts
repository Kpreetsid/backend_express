import { NextFunction, Request, Response } from 'express';
import { get } from "lodash";
import { getAll, removeById, getAssetsTreeData, getAssetsFilteredData, createAssetOld, updateAssetImageById, getAssetDataSensorList, createEquipment, createMotor, createFlexible, createRigid, createBeltPulley, createGearbox, createFanBlower, createPumps, createCompressor, createExternalAPICall, deleteAssetsById, updateEquipment, updateCompressor, updateFanBlower, updateFlexible, updateMotor, updatePumps, updateRigid, updateBeltPulley, updateGearbox } from './asset.service';
import { IUser } from '../../models/user.model';
import { createMapUserAssets, getAssetsMappedData, removeLocationMapping } from '../../transaction/mapUserLocation/userLocation.service';
import mongoose from 'mongoose';
import { deleteBase64Image, uploadBase64Image } from '../../_config/upload';

export const getAssets = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const match: any = { account_id: account_id, visible: true };
    const params: any = req.query;
    if (userRole !== 'admin') {
      const mappedData = await getAssetsMappedData(`${user_id}`);
      if (!mappedData || mappedData.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      match._id = { $in: mappedData.map(doc => doc.assetId) };
    }
    if (params.top_level_asset_id && params.top_level_asset_id.split(',').length > 0) {
      match.top_level_asset_id = params.top_level_asset_id.split(',');
    }
    if (params.top_level) {
      match.top_level = params.top_level == 'true' ? true : false;
    }
    if (params.locationId) {
      match.locationId = new mongoose.Types.ObjectId(params.locationId);
    }
    let data = await getAll(match);
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    next(error);
  }
}

export const getAsset = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const params: any = req.query;
    if(!req.params.id) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const match: any = { _id: req.params.id, account_id: account_id, visible: true };
    if (userRole !== 'admin') {
      const mappedData = await getAssetsMappedData(`${user_id}`);
      if (!mappedData || mappedData.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      match._id = { $in: mappedData.map(doc => doc.assetId) };
    }
    if (params.top_level_asset_id && params.top_level_asset_id.split(',').length > 0) {
      match.top_level_asset_id = params.top_level_asset_id.split(',');
    }
    if (params.top_level) {
      match.top_level = params.top_level == 'true' ? true : false;
    }
    if (params.locationId) {
      match.locationId = new mongoose.Types.ObjectId(params.locationId);
    }
    const data = await getAll(match);
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    next(error);
  }
}

export const getAssetTree = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  await getAssetsTreeData(req, res, next);
}

export const getFilteredAssets = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  await getAssetsFilteredData(req, res, next);
}

export const create = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  var equipmentId: any = '';
  try {
    const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
    const { Equipment, Motor, Flexible, Rigid, Belt_Pulley, Gearbox, Fan_Blower, Pumps, Compressor } = req.body;
    if (!Equipment.userList || Equipment.userList.length === 0) {
      throw Object.assign(new Error('Please select at least one user'), { status: 400 });
    }
    if (Equipment.image_path) {
      const image = await uploadBase64Image(Equipment.image_path, "assets");
      Equipment.image_path = image.fileName;
    }
    const equipmentData = await createEquipment(Equipment, account_id, user_id);
    equipmentId = equipmentData._id;
    const assetsPromiseList: any = [];
    if(Motor) {
      if(Object.keys(Motor).length !== 0) {
        assetsPromiseList.push(await createMotor(Motor, equipmentData, account_id, user_id));
      }
    }
    if(Flexible) {
      if(Object.keys(Flexible).length !== 0) {
        assetsPromiseList.push(await createFlexible(Flexible, equipmentData, account_id, user_id));
      }
    }
    if(Rigid) {
      if(Object.keys(Rigid).length !== 0) {
        assetsPromiseList.push(await createRigid(Rigid, equipmentData, account_id, user_id));
      }
    }
    if(Belt_Pulley && Belt_Pulley.length > 0) {
      for(let beltPulley of Belt_Pulley) {
        if(Object.keys(beltPulley).length !== 0) {
          assetsPromiseList.push(await createBeltPulley(beltPulley, equipmentData, account_id, user_id));
        }
      }
    }
    if(Gearbox && Gearbox.length > 0) {
      for(let gearbox of Gearbox) {
        if(Object.keys(gearbox).length !== 0) {
          assetsPromiseList.push(await createGearbox(gearbox, equipmentData, account_id, user_id));
        }
      }
    }
    if(Fan_Blower) {
      if(Object.keys(Fan_Blower).length !== 0) {
        assetsPromiseList.push(await createFanBlower(Fan_Blower, equipmentData, account_id, user_id));
      }
    }
    if(Pumps) {
      if(Object.keys(Pumps).length !== 0) {
        assetsPromiseList.push(await createPumps(Pumps, equipmentData, account_id, user_id));
      }
    }
    if(Compressor) {
      if(Object.keys(Compressor).length !== 0) {
        assetsPromiseList.push(await createCompressor(Compressor, equipmentData, account_id, user_id));
      }
    }
    const assetData = await Promise.all(assetsPromiseList);
    const assetsMapData: any = Equipment.userList.map((user: any) => ({ userId: user, assetId: equipmentData._id, account_id }));
    assetData.forEach((asset: any) => {
      Equipment.userList.map((user: any) => (
        assetsMapData.push({ userId: user, assetId: asset._id, account_id })
      ));
    });
    await createMapUserAssets(assetsMapData);
    const token: any = req.cookies.token || req.headers.authorization;
    await createExternalAPICall(assetsMapData, account_id, user_id, token);
    res.status(200).json({ status: true, message: "Data created successfully", data: equipmentData._id });
  } catch (error) {
    if(equipmentId) {
      await deleteAssetsById(equipmentId);
    }
    next(error);
  }
}

export const createOld = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  await createAssetOld(req, res, next);
}

export const update = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
    const { params: { id }, body: { Equipment, Motor, Flexible, Rigid, Belt_Pulley, Gearbox, Fan_Blower, Pumps, Compressor }} = req;
    if (!Equipment || !Equipment.id) {
      throw Object.assign(new Error("Invalid request: Equipment ID is required"), { status: 400 });
    }
    if (id !== Equipment.id) {
      throw Object.assign(new Error("Invalid request: Equipment ID mismatch"), { status: 400 });
    }
    if (!Equipment.userList || Equipment.userList.length === 0) {
      throw Object.assign(new Error("Please select at least one user"), { status: 400 });
    }
    const existEquipmentData = await getAll({ _id: id, account_id: account_id, visible: true });
    if (Equipment.image_path && Equipment.image_path.startsWith("data:image")) {
      const image = await uploadBase64Image(Equipment.image_path, "assets");
      Equipment.image_path = image.fileName;
    }
    if (Equipment.image_path) {
      if (existEquipmentData.image_path && existEquipmentData.image_path['fileName']) {
        await deleteBase64Image(existEquipmentData.image_path['fileName'], "asset");
      }
      const image = await uploadBase64Image(Equipment.image_path, "assets");
      Equipment.image_path = image.fileName;
    }
    await updateEquipment(Equipment, account_id, user_id);
    const assetUpdatePromises: any[] = [];
    if (Motor && Object.keys(Motor).length !== 0) {
      if(Motor.id) {
        assetUpdatePromises.push(await updateMotor(Motor, Equipment, account_id, user_id));
      } else {
        assetUpdatePromises.push(await createMotor(Motor, Equipment, account_id, user_id));
      }
    }
    if (Flexible && Object.keys(Flexible).length !== 0) {
      if(Flexible.id) {
        assetUpdatePromises.push(await updateFlexible(Flexible, Equipment, account_id, user_id));
      } else {
        assetUpdatePromises.push(await createFlexible(Flexible, Equipment, account_id, user_id));
      }
    }
    if (Rigid && Object.keys(Rigid).length !== 0) {
      if(Rigid.id) {
        assetUpdatePromises.push(await updateRigid(Rigid, Equipment, account_id, user_id));
      } else {
        assetUpdatePromises.push(await createRigid(Rigid, Equipment, account_id, user_id));
      }
    }
    if(Belt_Pulley.length > 0) {
      for(let beltPulley of Belt_Pulley) {
        if(beltPulley.id) {
          assetUpdatePromises.push(await updateBeltPulley(beltPulley, Equipment, account_id, user_id));
        } else {
          assetUpdatePromises.push(await createBeltPulley(beltPulley, Equipment, account_id, user_id));
        }
      }
    }
    if(Gearbox.length > 0) {
      for(let gearbox of Gearbox) {
        if(gearbox.id) {
          assetUpdatePromises.push(await updateGearbox(gearbox, Equipment, account_id, user_id));
        } else {
          assetUpdatePromises.push(await createGearbox(gearbox, Equipment, account_id, user_id));
        }
      }
    }
    if (Fan_Blower && Object.keys(Fan_Blower).length !== 0) {
      if(Fan_Blower.id) {
        assetUpdatePromises.push(await updateFanBlower(Fan_Blower, Equipment, account_id, user_id));
      } else {
        assetUpdatePromises.push(await createFanBlower(Fan_Blower, Equipment, account_id, user_id));
      }
    }
    if (Pumps && Object.keys(Pumps).length !== 0) {
      if(Pumps.id) {
        assetUpdatePromises.push(await updatePumps(Pumps, Equipment, account_id, user_id));
      } else {
        assetUpdatePromises.push(await createPumps(Pumps, Equipment, account_id, user_id));
      }
    }
    if (Compressor && Object.keys(Compressor).length !== 0) {
      if(Compressor.id) {
        assetUpdatePromises.push(await updateCompressor(Compressor, Equipment, account_id, user_id));
      } else {
        assetUpdatePromises.push(await createCompressor(Compressor, Equipment, account_id, user_id));
      }
    }
    const updatedAssets = await Promise.all(assetUpdatePromises);
    const newlyCreatedAssetList = updatedAssets.filter(asset => asset?.isNew && asset?._id);
    const assetsMapData: any[] = Equipment.userList.map((userId: any) => (
      { userId, assetId: Equipment.id, account_id }
    ));

    for (const asset of updatedAssets) {
      if (asset && asset._id) {
        Equipment.userList.forEach((userId: any) => { 
          assetsMapData.push({ userId, assetId: asset._id, account_id });
        });
      }
    }
    await createMapUserAssets(assetsMapData);
    if (newlyCreatedAssetList.length > 0) {
      const token: any = req.cookies.token || req.headers.authorization;
      await createExternalAPICall(newlyCreatedAssetList, account_id, user_id, token);
    }
    const data = await getAll({ _id: id, account_id: account_id, visible: true });
    res.status(200).json({ status: true, message: "Asset updated successfully", data });
  } catch (error) {
    next(error);
  }
};

export const updateAssetImage = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
    if(!req.params.id) {
      throw Object.assign(new Error('Bad request'), { status: 400 });
    }
    const { image_path } = req.body;
    if (!image_path) {
      throw Object.assign(new Error('Image path is required'), { status: 400 });
    }
    const dataExists: any = await getAll({ _id: req.params.id, account_id: account_id, visible: true });
    if (!dataExists || dataExists.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    await updateAssetImageById(req.params.id, image_path, `${user_id}`);
    res.status(200).json({ status: true, message: "Data updated successfully" });
  } catch (error) {
    next(error);
  }
}

export const removeAsset = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    if(!req.params.id) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const match: any = { _id: req.params.id, account_id: account_id, visible: true };
    if (userRole !== 'admin') {
      throw Object.assign(new Error('Unauthorized access'), { status: 403 });
    }
    const dataExists: any = await getAll(match);
    if (!dataExists || dataExists.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    await removeLocationMapping(req.params.id);
    await removeById(match, user_id);
    res.status(200).json({ status: true, message: "Data deleted successfully" });
  } catch (error) {
    next(error);
  }
}

export const getAssetSensorList = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  await getAssetDataSensorList(req, res, next);
}