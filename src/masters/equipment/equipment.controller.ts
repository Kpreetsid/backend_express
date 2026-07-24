import { controllerCache } from '../../_cache/controllerCache.service';
import { NextFunction, Request, Response } from 'express';
import { get } from "lodash";
import { equipmentService } from './equipment.service';
import { IUser } from '../../models/user.model';
import { mapUserToLocationService } from '../../transaction/mapUserLocation/userLocation.service';
import { mapUserToAssetService } from '../../transaction/mapUserAsset/userAsset.service';
import { uploadFilesService } from '../../upload/upload.multer';
import { locationService } from '../location/location.service';
import { processorAPIService } from '../../api-processor';
import { helperService } from '../../utils/helper';
import { applyRoleFilter } from '../../utils/roleFilter';
import { notificationService } from '../../utils/notification.service';
import { withTransaction } from "../../utils/transaction.helper";

class EquipmentController {

  getAssets = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const user = get(req, "user", {}) as IUser;
      const { account_id } = user;
      const baseFilter: any = { account_id, visible: true };
      const { query: { top_level_asset_id, top_level, locationId, parent_id } }: any = req;

      if (top_level_asset_id) {
        baseFilter.top_level_asset_id = { $in: helperService.validateObjectIds(String(top_level_asset_id)) };
      }
      if (parent_id) {
        const validatedParentIds = helperService.validateObjectIds(String(parent_id));
        baseFilter._id = { $in: validatedParentIds };
        baseFilter.parent_id = { $in: validatedParentIds };
      }
      if (top_level) {
        baseFilter.top_level = top_level == 'true' ? true : false;
      }
      if (locationId) {
        const validatedLocationId = helperService.validateObjectId(String(locationId));
        const childIds = await locationService.getAllChildLocationIds(String(validatedLocationId));
        const mappedData = await mapUserToLocationService.getDataByLocationIds([String(validatedLocationId), ...childIds]);
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
        throw Object.assign(new Error('No equipment found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Equipment retrieved successfully", data });
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
        throw Object.assign(new Error('Equipment not found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Equipment retrieved successfully", data });
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
        throw Object.assign(new Error('Equipment not found'), { status: 404 });
      }
      const match: any = { _id: { $in: childIds }, account_id: account_id, visible: true };
      const data = await equipmentService.getAllEquipment(match);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('No child equipment found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Child equipment retrieved successfully", data });
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
      if (id) {
        const assetIds = helperService.validateObjectIds(String(id));
        assetQuery.$or = [{ _id: { $in: assetIds } }, { parent_id: { $in: assetIds } }]
      }
      if (location_id) {
        assetQuery.locationId = { $in: helperService.validateObjectIds(String(location_id)) };
      }
      const data = await equipmentService.getEquipmentTreeData(assetQuery);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('Equipment tree not found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Equipment tree retrieved successfully", data });
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
        throw Object.assign(new Error('Equipment not found'), { status: 404 });
      }
      const data = await equipmentService.getEquipmentTreeDataById(assetQuery);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('Equipment not found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Equipment tree fetched successfully", data });
    } catch (error) {
      next(error);
    }
  }

  create = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    var equipmentId: any = '';
    const asset_ids = [];
    const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
    const userToken = get(req, "userToken", {}) as string;
    try {
      const { Equipment, Motor, Flexible, Rigid, Belt_Pulley, Gearbox, Fan_Blower, Pumps, Compressor } = req.body;
      if (!Equipment.userList || Equipment.userList.length === 0) {
        throw Object.assign(new Error('User selection is required for equipment mapping'), { status: 400 });
      }
      if (Equipment.image_path) {
        const image = await uploadFilesService.uploadBase64Image(Equipment.image_path, "assets");
        Equipment.image_path = image.fileName;
      }
      const equipmentData = await equipmentService.createEquipment(Equipment, account_id, user_id);
      equipmentId = equipmentData._id;
      const assetsPromiseList: any = [];
      const equipmentEndpoint: any = {
        Motor: {},
        Flexible: {},
        Rigid: {},
        Belt_Pulley: [],
        Gearbox: [],
        Fan_Blower: {},
        Pumps: {},
        Compressor: {}
      }
      if (Motor) {
        if (Object.keys(Motor).length !== 0) {
          const motorData = await equipmentService.createMotor(Motor, equipmentData, account_id, user_id);
          if (motorData) {
            asset_ids.push(motorData._id)
            equipmentEndpoint.Motor = { ...motorData.toObject(), asset_id: motorData._id, org_id: account_id, asset_timezone: equipmentData.asset_timezone };
            assetsPromiseList.push(motorData);
          }
        }
      }
      if (Flexible) {
        if (Object.keys(Flexible).length !== 0) {
          const flexibleData = await equipmentService.createFlexible(Flexible, equipmentData, account_id, user_id);
          if (flexibleData) {
            asset_ids.push(flexibleData._id)
            equipmentEndpoint.Flexible = { ...flexibleData.toObject(), asset_id: flexibleData._id, org_id: account_id, asset_timezone: equipmentData.asset_timezone };
            assetsPromiseList.push(flexibleData);
          }
        }
      }
      if (Rigid) {
        if (Object.keys(Rigid).length !== 0) {
          const rigidData = await equipmentService.createRigid(Rigid, equipmentData, account_id, user_id);
          if (rigidData) {
            asset_ids.push(rigidData._id)
            equipmentEndpoint.Rigid = { ...rigidData.toObject(), asset_id: rigidData._id, org_id: account_id, asset_timezone: equipmentData.asset_timezone };
            equipmentEndpoint.Rigid.asset_id = rigidData._id;
            assetsPromiseList.push(rigidData);
          }
        }
      }
      const beltPulleyData = [];
      if (Belt_Pulley && Belt_Pulley.length > 0) {
        for (let beltPulley of Belt_Pulley) {
          if (Object.keys(beltPulley).length !== 0) {
            const createBeltPulley = await equipmentService.createBeltPulley(beltPulley, equipmentData, account_id, user_id);
            if (createBeltPulley) {
              asset_ids.push(createBeltPulley._id)
              beltPulleyData.push({
                ...createBeltPulley.toObject(), asset_id: createBeltPulley._id, org_id: account_id,
                asset_timezone: equipmentData.asset_timezone,
              });
              assetsPromiseList.push(createBeltPulley);
            }
          }
        }
        equipmentEndpoint.Belt_Pulley = beltPulleyData;
      }
      const gearboxData = [];
      if (Gearbox?.length > 0) {
        for (const gearbox of Gearbox) {
          if (gearbox && Object.keys(gearbox).length > 0) {
            const createdGearbox = await equipmentService.createGearbox(gearbox, equipmentData, account_id, user_id);
            if (createdGearbox) {
              asset_ids.push(createdGearbox._id)
              gearboxData.push({
                ...createdGearbox.toObject(), asset_id: createdGearbox._id, org_id: account_id,
                asset_timezone: equipmentData.asset_timezone
              });
              assetsPromiseList.push(createdGearbox);
            }
          }
        }
        equipmentEndpoint.Gearbox = gearboxData;
      }
      if (Fan_Blower) {
        if (Object.keys(Fan_Blower).length !== 0) {
          const fanBlowerData = await equipmentService.createFanBlower(Fan_Blower, equipmentData, account_id, user_id);
          if (fanBlowerData) {
            asset_ids.push(fanBlowerData._id)
            equipmentEndpoint.Fan_Blower = { ...fanBlowerData.toObject(), asset_id: fanBlowerData._id, org_id: account_id, asset_timezone: equipmentData.asset_timezone };
            equipmentEndpoint.Fan_Blower.asset_id = fanBlowerData._id;
            assetsPromiseList.push(fanBlowerData);
          }

        }
      }
      if (Pumps) {
        if (Object.keys(Pumps).length !== 0) {
          const pumpsData = await equipmentService.createPumps(Pumps, equipmentData, account_id, user_id);
          if (pumpsData) {
            asset_ids.push(pumpsData._id)
            equipmentEndpoint.Pumps = { ...pumpsData.toObject(), asset_id: pumpsData._id, org_id: account_id, asset_timezone: equipmentData.asset_timezone };
            equipmentEndpoint.Pumps.asset_id = pumpsData._id;
            assetsPromiseList.push(pumpsData);
          }
        }
      }
      if (Compressor) {
        if (Object.keys(Compressor).length !== 0) {
          const compressorData = await equipmentService.createCompressor(Compressor, equipmentData, account_id, user_id);
          if (compressorData) {
            asset_ids.push(compressorData._id)
            equipmentEndpoint.Compressor = { ...compressorData.toObject(), asset_id: compressorData._id, org_id: account_id, asset_timezone: equipmentData.asset_timezone };
            equipmentEndpoint.Compressor.asset_id = compressorData._id;

            assetsPromiseList.push(compressorData);
          }
        }
      }

      console.log("equipmentEndpoint", equipmentEndpoint);

      const assetData = await Promise.all(assetsPromiseList);
      const assetsMapData: any = Equipment.userList.map((user: any) => ({ userId: user, assetId: equipmentData._id, account_id }));
      assetData.forEach((asset: any) => {
        Equipment.userList.map((user: any) => (
          assetsMapData.push({ userId: user, assetId: asset._id, account_id })
        ));
      });
      await mapUserToAssetService.createMapUserAssets(assetsMapData);
      await processorAPIService.setAssetHealthStatus(assetsMapData, account_id, user_id, userToken);
      await processorAPIService.createEquipmentEndPoints(equipmentEndpoint, user_id, userToken);
      await notificationService.notifyAccountUsers({
        accountId: String(account_id),
        module: 'Asset',
        event: 'created',
        entityId: String(equipmentData._id),
        entityName: Equipment.asset_name || Equipment.name || 'Asset',
        actionUrl: `/assets/asset-health/${equipmentData._id}/health`,
        sourceUserId: String(user_id)
      });
      res.status(200).json({ status: true, message: "Equipment created successfully", data: equipmentData._id });
    } catch (error) {
      if (equipmentId) {
        await equipmentService.deleteAssetsById(equipmentId);
        await processorAPIService.deleteEquipmentEndpointByAssetId(asset_ids, userToken, user_id);
      }
      next(error);
    }
  }

  update = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const newlyCreatedAssetId = [];
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
      const equipmentEndpoint: any = {
        Motor: {},
        Flexible: {},
        Rigid: {},
        Belt_Pulley: [],
        Gearbox: [],
        Fan_Blower: {},
        Pumps: {},
        Compressor: {}
      }
      if (Motor && Object.keys(Motor).length !== 0) {
        if (Motor.id) {
          const motorData = await equipmentService.updateMotor(Motor, Equipment, account_id, user_id);
          if (motorData) {
            equipmentEndpoint.Motor = { ...motorData, asset_id: Motor.id, org_id: account_id, asset_timezone: Equipment.asset_timezone };
            equipmentEndpoint.Motor.asset_id = Motor.id;
            assetUpdatePromises.push(motorData);
          }
        } else {
          const motorData = await equipmentService.createMotor(Motor, Equipment, account_id, user_id);
          if (motorData) {
            equipmentEndpoint.Motor = { ...motorData.toObject(), asset_id: motorData.id, org_id: account_id, asset_timezone: Equipment.asset_timezone };
            equipmentEndpoint.Motor.asset_id = motorData.id;
            newlyCreatedAssetId.push(motorData._id);
            assetUpdatePromises.push(motorData);
          }
        }
      }
      if (Flexible && Object.keys(Flexible).length !== 0) {
        if (Flexible.id) {
          const flexibleData = await equipmentService.updateFlexible(Flexible, Equipment, account_id, user_id);
          if (flexibleData) {
            equipmentEndpoint.Flexible = { ...flexibleData, asset_id: Flexible.id, org_id: account_id, asset_timezone: Equipment.asset_timezone };
            equipmentEndpoint.Flexible.asset_id = Flexible.id;
            assetUpdatePromises.push(flexibleData);
          }
        } else {
          const flexibleData = await equipmentService.createFlexible(Flexible, Equipment, account_id, user_id);
          if (flexibleData) {
            equipmentEndpoint.Flexible = { ...flexibleData.toObject(), asset_id: flexibleData.id, org_id: account_id, asset_timezone: Equipment.asset_timezone };
            equipmentEndpoint.Flexible.asset_id = flexibleData.id;
            newlyCreatedAssetId.push(flexibleData._id);
            assetUpdatePromises.push(flexibleData);
          }
        }
      }
      if (Rigid && Object.keys(Rigid).length !== 0) {
        if (Rigid.id) {
          const rigidData = await equipmentService.updateRigid(Rigid, Equipment, account_id, user_id);
          if (rigidData) {
            equipmentEndpoint.Rigid = { ...rigidData, asset_id: Rigid.id, org_id: account_id, asset_timezone: Equipment.asset_timezone };
            equipmentEndpoint.Rigid.asset_id = Rigid.id;
            assetUpdatePromises.push(rigidData);
          }
        } else {
          const rigidData = await equipmentService.createRigid(Rigid, Equipment, account_id, user_id);
          if (rigidData) {
            equipmentEndpoint.Rigid = { ...rigidData.toObject(), asset_id: rigidData.id, org_id: account_id, asset_timezone: Equipment.asset_timezone };
            equipmentEndpoint.Rigid.asset_id = rigidData.id;
            newlyCreatedAssetId.push(Rigid._id);
            assetUpdatePromises.push(rigidData);
          }
        }
      }
      if (Belt_Pulley.length > 0) {
        const beltPulleyDataList = [];
        for (let beltPulley of Belt_Pulley) {
          if (beltPulley.id) {
            const beltPulleyData = await equipmentService.updateBeltPulley(beltPulley, Equipment, account_id, user_id);
            if (beltPulleyData) {
              beltPulleyDataList.push({ ...beltPulleyData, asset_id: beltPulley.id, org_id: account_id, asset_timezone: Equipment.asset_timezone });
              assetUpdatePromises.push(beltPulleyData);
            }
          } else {
            const beltPulleyData = await equipmentService.createBeltPulley(beltPulley, Equipment, account_id, user_id);
            if (beltPulleyData) {
              beltPulleyDataList.push({ ...beltPulleyData.toObject(), asset_id: beltPulleyData.id, org_id: account_id, asset_timezone: Equipment.asset_timezone });
              newlyCreatedAssetId.push(beltPulleyData._id);
              assetUpdatePromises.push(beltPulleyData);
            }
          }
        }
        equipmentEndpoint.Belt_Pulley = beltPulleyDataList;
      }
      if (Gearbox.length > 0) {
        const gearboxDataList = [];
        for (let gearbox of Gearbox) {
          if (gearbox.id) {
            const gearboxData = await equipmentService.updateGearbox(gearbox, Equipment, account_id, user_id);
            if (gearboxData) {
              gearboxDataList.push({ ...gearboxData, asset_id: gearbox.id, org_id: account_id, asset_timezone: Equipment.asset_timezone });
              assetUpdatePromises.push(gearboxData);
            }
          } else {
            const gearboxData = await equipmentService.createGearbox(gearbox, Equipment, account_id, user_id);
            if (gearboxData) {
              gearboxDataList.push({ ...gearboxData.toObject(), asset_id: gearboxData.id, org_id: account_id, asset_timezone: Equipment.asset_timezone });
              newlyCreatedAssetId.push(gearboxData._id);
              assetUpdatePromises.push(gearboxData);
            }
          }
        }
        equipmentEndpoint.Gearbox = gearboxDataList;
      }
      if (Fan_Blower && Object.keys(Fan_Blower).length !== 0) {
        if (Fan_Blower.id) {
          const fanBlowerData = await equipmentService.updateFanBlower(Fan_Blower, Equipment, account_id, user_id)
          if (fanBlowerData) {
            equipmentEndpoint.Fan_Blower = { ...fanBlowerData, asset_id: Fan_Blower.id, org_id: account_id, asset_timezone: Equipment.asset_timezone };
            equipmentEndpoint.Fan_Blower.asset_id = Fan_Blower.id;
            assetUpdatePromises.push(fanBlowerData);
          }
        } else {
          const fanBlowerData = await equipmentService.createFanBlower(Fan_Blower, Equipment, account_id, user_id);
          if (fanBlowerData) {
            equipmentEndpoint.Fan_Blower = { ...fanBlowerData.toObject(), asset_id: fanBlowerData.id, org_id: account_id, asset_timezone: Equipment.asset_timezone };
            equipmentEndpoint.Fan_Blower.asset_id = fanBlowerData.id;
            newlyCreatedAssetId.push(fanBlowerData._id);
            assetUpdatePromises.push(fanBlowerData);
          }
        }
      }
      if (Pumps && Object.keys(Pumps).length !== 0) {
        if (Pumps.id) {
          const pumpsData = await equipmentService.updatePumps(Pumps, Equipment, account_id, user_id);
          if (pumpsData) {
            equipmentEndpoint.Pumps = { ...pumpsData, asset_id: Pumps.id, org_id: account_id, asset_timezone: Equipment.asset_timezone };
            equipmentEndpoint.Pumps.asset_id = Pumps.id;
            assetUpdatePromises.push(pumpsData);
          }
        } else {
          const pumpsData = await equipmentService.createPumps(Pumps, Equipment, account_id, user_id);
          if (pumpsData) {
            equipmentEndpoint.Pumps = { ...pumpsData.toObject(), asset_id: pumpsData.id, org_id: account_id, asset_timezone: Equipment.asset_timezone };
            equipmentEndpoint.Pumps.asset_id = pumpsData.id;
            newlyCreatedAssetId.push(pumpsData._id);
            assetUpdatePromises.push(pumpsData);
          }
        }
      }
      if (Compressor && Object.keys(Compressor).length !== 0) {
        if (Compressor.id) {
          const compressorData = await equipmentService.updateCompressor(Compressor, Equipment, account_id, user_id);
          if (compressorData) {
            equipmentEndpoint.Compressor = { ...compressorData, asset_id: Compressor.id, org_id: account_id, asset_timezone: Equipment.asset_timezone };
            equipmentEndpoint.Compressor.asset_id = Compressor.id;
            assetUpdatePromises.push(compressorData);
          }
        } else {
          const compressorData = await equipmentService.createCompressor(Compressor, Equipment, account_id, user_id);
          if (compressorData) {
            equipmentEndpoint.Compressor = { ...compressorData.toObject(), asset_id: compressorData.id, org_id: account_id, asset_timezone: Equipment.asset_timezone };
            equipmentEndpoint.Compressor.asset_id = compressorData.id;
            newlyCreatedAssetId.push(compressorData._id);
            assetUpdatePromises.push(compressorData);
          }
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
      await processorAPIService.createEquipmentEndPoints(equipmentEndpoint, user_id, userToken);
      const data = await equipmentService.getAllEquipment({ _id: id, account_id: account_id, visible: true });
      await notificationService.notifyAccountUsers({
        accountId: String(account_id),
        module: 'Asset',
        event: 'updated',
        entityId: String(id),
        entityName: data?.[0]?.asset_name || Equipment.asset_name || Equipment.name || 'Asset',
        actionUrl: `/assets/asset-health/${id}/health`,
        sourceUserId: String(user_id)
      });
      res.status(200).json({ status: true, message: "Equipment updated successfully", data });
    } catch (error) {
      if (newlyCreatedAssetId.length > 0) {
        await equipmentService.deleteEquipmentAssetIds(newlyCreatedAssetId);
      }
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
        throw Object.assign(new Error('Equipment not found'), { status: 404 });
      }
      await equipmentService.updateEquipmentImageById(String(id), image_path, `${user_id}`);
      await notificationService.notifyAccountUsers({
        accountId: String(account_id),
        module: 'Asset',
        event: 'updated',
        entityId: String(id),
        entityName: dataExists?.[0]?.asset_name || 'Asset',
        actionUrl: `/assets/asset-health/${id}/health`,
        sourceUserId: String(user_id)
      });
      res.status(200).json({ status: true, message: "Equipment image updated successfully" });
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
        throw Object.assign(new Error('Equipment not found'), { status: 404 });
      }
      await mapUserToLocationService.removeLocationMapping(String(id));
      await equipmentService.removeEquipmentById(match, user_id);
      res.status(200).json({ status: true, message: "Equipment deleted successfully" });
    } catch (error) {
      next(error);
    }
  }

  makeAssetCopy = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const userToken = get(req, "userToken", "") as string;
      const { params: { id } } = req;

      const result = await withTransaction(async (session: any) => {
        const newParentId = await equipmentService.makeAssetCopyRecursive(String(id), user_id, userToken, account_id, undefined, session);
        if (!newParentId) {
          throw Object.assign(new Error("Equipment not found"), { status: 404 });
        }
        const copiedData: any = await equipmentService.getAllEquipment({
          _id: newParentId,
          account_id,
          visible: true,
        });
        return copiedData;
      });

      res.status(201).json({
        status: true,
        message: "Equipment hierarchy copied successfully",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}

export const equipmentController = controllerCache.withCache(new EquipmentController(), { namespace: 'equipment', ttlSeconds: 300, tags: ['equipment', 'locations', 'work'] });
