import { NextFunction, Request, Response } from 'express';
import { get } from "lodash";
import { equipmentService } from './equipment.service';
import { IUser } from '../../models/user.model';
import { mapUserToLocationService } from '../../transaction/mapUserLocation/userLocation.service';
import { mapUserToAssetService } from '../../transaction/mapUserLocation/userLocation.service';
import { uploadFilesService } from '../../utils/upload';
import { locationService } from '../location/location.service';
import { processorAPIService } from '../../api-processor';
import { helperService } from '../../utils/helper';
import { applyRoleFilter } from '../../utils/roleFilter';

class EquipmentController {

  getAssets = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const user = get(req, "user", {}) as IUser;
      const { account_id } = user;
      const baseFilter: any = { account_id, visible: true };
      const { query: { top_level_asset_id, top_level, locationId, parent_id } }: any = req;

      if (top_level_asset_id && top_level_asset_id.split(',').length > 0) {
        baseFilter.top_level_asset_id = { $in: top_level_asset_id.split(',') };
      }
      if (parent_id && parent_id.split(',').length > 0) {
        baseFilter._id = { $in: parent_id.split(',') };
        baseFilter.parent_id = { $in: parent_id.split(',') };
      }
      if (top_level) {
        baseFilter.top_level = top_level == 'true' ? true : false;
      }
      if (locationId) {
        const childIds = await locationService.getAllChildLocationIds(locationId);
        const mappedData = await mapUserToLocationService.getDataByLocationIds([locationId, ...childIds]);
        baseFilter.locationId = { $in: mappedData.map(doc => doc.locationId) };
      }

      const filter = await applyRoleFilter({
        user,
        baseFilter,
        accountField: "account_id",
        mapping: "asset",
        idField: "_id"
      });

      let data = await equipmentService.getAllEquipment(filter);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Data fetched successfully", data });
    } catch (error) {
      next(error);
    }
  }

  getAsset = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const user = get(req, "user", {}) as IUser;
      const { account_id } = user;
      const { params: { id }, query: { top_level_asset_id, top_level, locationId } } = req;
      const baseFilter: any = { _id: helperService.validateObjectId(id), account_id: account_id, visible: true };
      if (top_level_asset_id) {
        baseFilter.top_level_asset_id = top_level_asset_id.toString().split(',');
      }
      if (top_level) {
        baseFilter.top_level = top_level == 'true' ? true : false;
      }
      if (locationId) {
        baseFilter.locationId = helperService.validateObjectId(locationId);
      }

      const filter = await applyRoleFilter({
        user,
        baseFilter,
        accountField: "account_id",
        mapping: "asset",
        idField: "_id"
      });

      const data = await equipmentService.getAllEquipment(filter);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Data fetched successfully", data });
    } catch (error) {
      next(error);
    }
  }

  getChildAsset = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const { account_id } = get(req, "user", {}) as IUser;
      const { params: { id } } = req;
      const childIds = await equipmentService.getAllChildEquipmentIDs(helperService.validateObjectId(id));
      if (childIds.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      const match: any = { _id: { $in: childIds }, account_id: account_id, visible: true };
      const data = await equipmentService.getAllEquipment(match);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Data fetched successfully", data });
    } catch (error) {
      next(error);
    }
  }

  getAssetTree = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
      let { location_id, id } = req.query;
      let assetQuery: any = { account_id, visible: true };
      if (userRole !== "admin") {
        const mapData = await mapUserToAssetService.getAssetsMappedData(user_id);
        const assetIds = mapData.flatMap(doc => doc?.assetId ? [helperService.validateObjectId(doc.assetId)] : []);
        assetQuery.$or = [{ _id: { $in: assetIds } }, { parent_id: { $in: assetIds } }];
      }
      const isAssetExists = await equipmentService.checkEquipment(assetQuery);
      if (!isAssetExists || isAssetExists.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      if (id) {
        const assetIds = helperService.validateObjectIds(id);
        assetQuery.$or = [{ _id: { $in: assetIds } }, { parent_id: { $in: assetIds } }]
      }
      if (location_id) {
        assetQuery.locationId = helperService.validateObjectIds(location_id);
      }
      const data = await equipmentService.getEquipmentTreeData(assetQuery);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Data fetched successfully", data });
    } catch (error) {
      next(error);
    }
  }

  getAssetTreeById = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
      let { id } = req.params;
      let assetQuery: any = { account_id, visible: true };
      const assetIds = helperService.validateObjectIds(id);
      assetQuery.$or = [{ _id: { $in: assetIds } }, { parent_id: { $in: assetIds } }]
      if (userRole !== "admin") {
        const mapData = await mapUserToAssetService.getAssetsMappedData(user_id);
        const assetIds = mapData.flatMap(doc => doc?.assetId ? [helperService.validateObjectId(doc.assetId)] : []);
        assetQuery.$or = [{ _id: { $in: assetIds } }, { parent_id: { $in: assetIds } }];
      }
      const isAssetExists = await equipmentService.checkEquipment(assetQuery);
      if (!isAssetExists || isAssetExists.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      const data = await equipmentService.getEquipmentTreeDataById(assetQuery);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Data fetched successfully", data });
    } catch (error) {
      next(error);
    }
  }

  create = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    var equipmentId: any = '';
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const userToken = get(req, "userToken", {}) as string;
      const { Equipment, Motor, Flexible, Rigid, Belt_Pulley, Gearbox, Fan_Blower, Pumps, Compressor } = req.body;
      if (!Equipment.userList || Equipment.userList.length === 0) {
        throw Object.assign(new Error('Please select at least one user'), { status: 400 });
      }
      if (Equipment.image_path) {
        const image = await uploadFilesService.uploadBase64Image(Equipment.image_path, "assets");
        Equipment.image_path = image.fileName;
      }
      const equipmentData = await equipmentService.createEquipment(Equipment, account_id, user_id);
      equipmentId = equipmentData._id;
      const assetsPromiseList: any = [];
      if (Motor) {
        if (Object.keys(Motor).length !== 0) {
          assetsPromiseList.push(await equipmentService.createMotor(Motor, equipmentData, account_id, user_id));
        }
      }
      if (Flexible) {
        if (Object.keys(Flexible).length !== 0) {
          assetsPromiseList.push(await equipmentService.createFlexible(Flexible, equipmentData, account_id, user_id));
        }
      }
      if (Rigid) {
        if (Object.keys(Rigid).length !== 0) {
          assetsPromiseList.push(await equipmentService.createRigid(Rigid, equipmentData, account_id, user_id));
        }
      }
      if (Belt_Pulley && Belt_Pulley.length > 0) {
        for (let beltPulley of Belt_Pulley) {
          if (Object.keys(beltPulley).length !== 0) {
            assetsPromiseList.push(await equipmentService.createBeltPulley(beltPulley, equipmentData, account_id, user_id));
          }
        }
      }
      if (Gearbox && Gearbox.length > 0) {
        for (let gearbox of Gearbox) {
          if (Object.keys(gearbox).length !== 0) {
            assetsPromiseList.push(await equipmentService.createGearbox(gearbox, equipmentData, account_id, user_id));
          }
        }
      }
      if (Fan_Blower) {
        if (Object.keys(Fan_Blower).length !== 0) {
          assetsPromiseList.push(await equipmentService.createFanBlower(Fan_Blower, equipmentData, account_id, user_id));
        }
      }
      if (Pumps) {
        if (Object.keys(Pumps).length !== 0) {
          assetsPromiseList.push(await equipmentService.createPumps(Pumps, equipmentData, account_id, user_id));
        }
      }
      if (Compressor) {
        if (Object.keys(Compressor).length !== 0) {
          assetsPromiseList.push(await equipmentService.createCompressor(Compressor, equipmentData, account_id, user_id));
        }
      }
      const assetData = await Promise.all(assetsPromiseList);
      const assetsMapData: any = Equipment.userList.map((user: any) => ({ userId: user, assetId: equipmentData._id, account_id }));
      assetData.forEach((asset: any) => {
        Equipment.userList.map((user: any) => (
          assetsMapData.push({ userId: user, assetId: asset._id, account_id })
        ));
      });
      await mapUserToAssetService.createMapUserAssets(assetsMapData);
      await processorAPIService.setAssetHealthStatus(assetsMapData, account_id, user_id, userToken);
      res.status(200).json({ status: true, message: "Data created successfully", data: equipmentData._id });
    } catch (error) {
      if (equipmentId) {
        await equipmentService.deleteAssetsById(equipmentId);
      }
      next(error);
    }
  }

  update = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const userToken = get(req, "userToken", {}) as string;
      const { params: { id }, body: { Equipment, Motor, Flexible, Rigid, Belt_Pulley, Gearbox, Fan_Blower, Pumps, Compressor } } = req;
      if (!Equipment || !Equipment.id) {
        throw Object.assign(new Error("Invalid request: Equipment ID is required"), { status: 400 });
      }
      if (id !== Equipment.id) {
        throw Object.assign(new Error("Invalid request: Equipment ID mismatch"), { status: 400 });
      }
      if (!Equipment.userList || Equipment.userList.length === 0) {
        throw Object.assign(new Error("Please select at least one user"), { status: 400 });
      }
      const existEquipmentData = await equipmentService.getAllEquipment({ _id: id, account_id: account_id, visible: true });
      if (Equipment.image_path && Equipment.image_path.startsWith("data:image")) {
        const image = await uploadFilesService.uploadBase64Image(Equipment.image_path, "assets");
        Equipment.image_path = image.fileName;
      }
      if (Equipment.image_path) {
        if (existEquipmentData.image_path && existEquipmentData.image_path['fileName']) {
          await uploadFilesService.deleteBase64Image(existEquipmentData.image_path['fileName'], "asset");
        }
        const image = await uploadFilesService.uploadBase64Image(Equipment.image_path, "assets");
        Equipment.image_path = image.fileName;
      }
      await equipmentService.updateEquipment(Equipment, account_id, user_id);
      const assetUpdatePromises: any[] = [];
      if (Motor && Object.keys(Motor).length !== 0) {
        if (Motor.id) {
          assetUpdatePromises.push(await equipmentService.updateMotor(Motor, Equipment, account_id, user_id));
        } else {
          assetUpdatePromises.push(await equipmentService.createMotor(Motor, Equipment, account_id, user_id));
        }
      }
      if (Flexible && Object.keys(Flexible).length !== 0) {
        if (Flexible.id) {
          assetUpdatePromises.push(await equipmentService.updateFlexible(Flexible, Equipment, account_id, user_id));
        } else {
          assetUpdatePromises.push(await equipmentService.createFlexible(Flexible, Equipment, account_id, user_id));
        }
      }
      if (Rigid && Object.keys(Rigid).length !== 0) {
        if (Rigid.id) {
          assetUpdatePromises.push(await equipmentService.updateRigid(Rigid, Equipment, account_id, user_id));
        } else {
          assetUpdatePromises.push(await equipmentService.createRigid(Rigid, Equipment, account_id, user_id));
        }
      }
      if (Belt_Pulley.length > 0) {
        for (let beltPulley of Belt_Pulley) {
          if (beltPulley.id) {
            assetUpdatePromises.push(await equipmentService.updateBeltPulley(beltPulley, Equipment, account_id, user_id));
          } else {
            assetUpdatePromises.push(await equipmentService.createBeltPulley(beltPulley, Equipment, account_id, user_id));
          }
        }
      }
      if (Gearbox.length > 0) {
        for (let gearbox of Gearbox) {
          if (gearbox.id) {
            assetUpdatePromises.push(await equipmentService.updateGearbox(gearbox, Equipment, account_id, user_id));
          } else {
            assetUpdatePromises.push(await equipmentService.createGearbox(gearbox, Equipment, account_id, user_id));
          }
        }
      }
      if (Fan_Blower && Object.keys(Fan_Blower).length !== 0) {
        if (Fan_Blower.id) {
          assetUpdatePromises.push(await equipmentService.updateFanBlower(Fan_Blower, Equipment, account_id, user_id));
        } else {
          assetUpdatePromises.push(await equipmentService.createFanBlower(Fan_Blower, Equipment, account_id, user_id));
        }
      }
      if (Pumps && Object.keys(Pumps).length !== 0) {
        if (Pumps.id) {
          assetUpdatePromises.push(await equipmentService.updatePumps(Pumps, Equipment, account_id, user_id));
        } else {
          assetUpdatePromises.push(await equipmentService.createPumps(Pumps, Equipment, account_id, user_id));
        }
      }
      if (Compressor && Object.keys(Compressor).length !== 0) {
        if (Compressor.id) {
          assetUpdatePromises.push(await equipmentService.updateCompressor(Compressor, Equipment, account_id, user_id));
        } else {
          assetUpdatePromises.push(await equipmentService.createCompressor(Compressor, Equipment, account_id, user_id));
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
      await mapUserToAssetService.createMapUserAssets(assetsMapData);
      if (newlyCreatedAssetList.length > 0) {
        await processorAPIService.setAssetHealthStatus(newlyCreatedAssetList, account_id, user_id, userToken);
      }
      const data = await equipmentService.getAllEquipment({ _id: id, account_id: account_id, visible: true });
      res.status(200).json({ status: true, message: "Asset updated successfully", data });
    } catch (error) {
      next(error);
    }
  };

  updateAssetImage = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const { params: { id } } = req;
      const { image_path } = req.body;
      if (!image_path) {
        throw Object.assign(new Error('Image path is required'), { status: 400 });
      }
      const dataExists: any = await equipmentService.getAllEquipment({ _id: helperService.validateObjectId(id), account_id: account_id, visible: true });
      if (!dataExists || dataExists.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      await equipmentService.updateEquipmentImageById(String(id), image_path, `${user_id}`);
      res.status(200).json({ status: true, message: "Data updated successfully" });
    } catch (error) {
      next(error);
    }
  }

  removeAsset = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const { params: { id } } = req;
      const match: any = { _id: helperService.validateObjectId(id), account_id: account_id, visible: true };
      const dataExists: any = await equipmentService.getAllEquipment(match);
      if (!dataExists || dataExists.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      await mapUserToLocationService.removeLocationMapping(String(id));
      await equipmentService.removeEquipmentById(match, user_id);
      res.status(200).json({ status: true, message: "Data deleted successfully" });
    } catch (error) {
      next(error);
    }
  }

  makeAssetCopy = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const userToken = get(req, "userToken", {}) as string;
      const { params: { id } } = req;
      const dataExists: any = await equipmentService.getAllEquipment({ _id: helperService.validateObjectId(id), account_id, visible: true });
      if (!dataExists || dataExists.length === 0) {
        throw Object.assign(new Error("Asset not found"), { status: 404 });
      }
      const sourceAsset = dataExists[0];
      const allChildren: any[] = await equipmentService.getAllChildEquipmentRecursive(String(id), account_id);
      const idMap: Record<string, any> = {};
      const originalTopLevelId = sourceAsset.top_level ? sourceAsset.id : sourceAsset.top_level_asset_id;
      const parentForCopy = sourceAsset.parent_id ? sourceAsset.parent_id.id : undefined;
      const newParentId = await equipmentService.makeAssetCopyByIdWithChildren(sourceAsset, user_id, userToken, account_id, parentForCopy, idMap, null);
      const newTopLevelId = sourceAsset.top_level ? newParentId : originalTopLevelId;
      idMap[`${sourceAsset.id}`] = newParentId;
      for (const child of allChildren) {
        const newParent = idMap[child.parent_id?.toString()] || newParentId;
        const newChildId = await equipmentService.makeAssetCopyByIdWithChildren(child, user_id, userToken, account_id, newParent, idMap, newTopLevelId);
        idMap[child._id.toString()] = newChildId;
      }
      await processorAPIService.setAssetHealthStatus([{ assetId: newParentId }, ...allChildren.map(c => ({ assetId: idMap[c._id.toString()] }))], account_id, user_id, userToken);
      const copiedData: any = await equipmentService.getAllEquipment({ _id: newParentId, account_id, visible: true });
      res.status(201).json({ status: true, message: "Asset hierarchy copied successfully", data: copiedData });
    } catch (error) {
      next(error);
    }
  };
}

export const equipmentController = new EquipmentController();