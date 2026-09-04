import { controllerCache } from '../../../core/cache/controller-cache.service';

import { Request, Response, NextFunction } from "express";
import { get } from "lodash";
import { floorMapService } from '../services/floorMap.service';
import { IUser } from '../../users/models/user.model';
import { mapUserToLocationService } from "../../mappings/services/userLocation.service";
import { mapUserToAssetService } from "../../mappings/services/userAsset.service";
import { helperService } from "../../../common/utils/object-id.helper";
import { LocationModel } from "../models/location.model";
import { AssetModel } from "../../assets/models/asset.model";

class FloorMapController {

  private getMappedReferenceIds = async (user: IUser): Promise<Set<string>> => {
    if (user.user_role === "admin") return new Set<string>();
    const [locations, assets] = await Promise.all([
      mapUserToLocationService.getLocationsMappedData(String(user._id)),
      mapUserToAssetService.getAssetsMappedData(String(user._id)),
    ]);
    return new Set([
      ...locations.map(item => String(item.locationId)),
      ...assets.map(item => String(item.assetId)),
    ]);
  };

  private prepareCoordinatePayload = async (body: any, user: IUser): Promise<any> => {
    const dataType = String(body.data_type);
    const referenceId = helperService.validateObjectId(String(body.locationId));
    const reference = dataType === "asset"
      ? await AssetModel.findOne({ _id: referenceId, account_id: user.account_id, visible: true }).select("_id").lean()
      : await LocationModel.findOne({ _id: referenceId, account_id: user.account_id, visible: true }).select("_id").lean();
    if (!reference) {
      throw Object.assign(new Error(`${dataType === "asset" ? "Asset" : "Location"} not found`), { status: 404 });
    }
    if (user.user_role !== "admin") {
      const mappedIds = await this.getMappedReferenceIds(user);
      if (!mappedIds.has(String(referenceId))) {
        throw Object.assign(new Error("You do not have access to this floor-map reference"), { status: 403 });
      }
    }

    const payload: any = {
      coordinate: {
        x: Number(body.coordinate.x),
        y: Number(body.coordinate.y),
      },
      locationId: referenceId,
      data_type: dataType,
    };
    if (dataType === "asset") {
      const endpointId = Number(body.end_point_id);
      if (endpointId !== Number(body.end_point?.id)) {
        throw Object.assign(new Error("End point IDs do not match"), { status: 400 });
      }
      const endpoint = body.end_point || {};
      payload.end_point_id = endpointId;
      payload.end_point = {
        is_linked: endpoint.is_linked === true,
        composite_id: this.safeText(endpoint.composite_id, 300),
        point_name: this.safeText(endpoint.point_name, 200),
        mount_location: this.safeText(endpoint.mount_location, 200),
        mount_type: this.safeNullableText(endpoint.mount_type, 100),
        mount_material: this.safeNullableText(endpoint.mount_material, 100),
        mount_direction: this.safeText(endpoint.mount_direction, 100),
        asset_id: this.safeIdentifier(endpoint.asset_id),
        asset_name: this.safeText(endpoint.asset_name, 200),
        org_id: this.safeIdentifier(endpoint.org_id),
        mac_id: this.safeText(endpoint.mac_id, 200),
        image: this.safeNullableText(endpoint.image, 1000),
        online: this.safeText(endpoint.online, 50),
        id: endpointId,
        selected: endpoint.selected === true,
      };
    }
    return payload;
  };

  private safeText(value: any, maxLength: number): string {
    return String(value ?? "").trim().slice(0, maxLength);
  }

  private safeNullableText(value: any, maxLength: number): string | null {
    if (value === null || value === undefined || value === "") return null;
    return this.safeText(value, maxLength);
  }

  private safeIdentifier(value: any): string | number {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    return this.safeText(value, 200);
  }

  getAllFloorMaps = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = get(req, "user", {}) as IUser;
      const filter: any = { account_id: user.account_id };
      if (user.user_role !== "admin") {
        filter.locationId = { $in: [...await this.getMappedReferenceIds(user)] };
      }
      const data = await floorMapService.getFloorMaps(filter);
      res.status(200).json({ status: true, message: "Floor maps fetched successfully", data });
    } catch (error) {
      next(error);
    }
  }

  getFloorMapByID = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = get(req, "user", {}) as IUser;
      const { id } = req.params;
      const data = await floorMapService.getFloorMaps({
        _id: helperService.validateObjectId(String(id)),
        account_id: user.account_id,
      });
      if (!data.length) {
        throw Object.assign(new Error("Floor Map not found"), { status: 404 });
      }
      if (user.user_role !== "admin") {
        const mappedIds = await this.getMappedReferenceIds(user);
        if (!mappedIds.has(String(data[0].locationId))) {
          throw Object.assign(new Error("You do not have access to this floor map"), { status: 403 });
        }
      }
      res.status(200).json({ status: true, message: "Floor map fetched successfully", data });
    } catch (error) {
      next(error);
    }
  }

  createFloorMap = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = get(req, "user", {}) as IUser;
      const { account_id, _id: user_id } = user;
      const payload = await this.prepareCoordinatePayload(req.body, user);
      const duplicateMatch: any = {
        account_id,
        data_type: payload.data_type,
        locationId: payload.locationId,
      };
      if (payload.data_type === "asset") duplicateMatch.end_point_id = payload.end_point_id;
      if ((await floorMapService.getFloorMaps(duplicateMatch)).length) {
        throw Object.assign(new Error(`${payload.data_type} coordinates already exist`), { status: 400 });
      }
      const data = await floorMapService.insertFloorMapCoordinates(
        payload,
        account_id,
        user_id,
      );
      if (!data) {
        throw Object.assign(new Error("Floor Map not created"), { status: 404 });
      }
      res
        .status(201)
        .json({ status: true, message: "Floor map created successfully", data });
    } catch (error) {
      next(error);
    }
  }

  updateFloorMap = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = get(req, "user", {}) as IUser;
      const { account_id, _id: user_id } = user;
      const { id } = req.params;
      const payload = await this.prepareCoordinatePayload(req.body, user);
      const duplicateMatch: any = {
        _id: { $ne: helperService.validateObjectId(String(id)) },
        account_id,
        data_type: payload.data_type,
        locationId: payload.locationId,
      };
      if (payload.data_type === "asset") duplicateMatch.end_point_id = payload.end_point_id;
      if ((await floorMapService.getFloorMaps(duplicateMatch)).length) {
        throw Object.assign(new Error(`${payload.data_type} coordinates already exist`), { status: 400 });
      }
      const data = await floorMapService.updateById(
        helperService.validateObjectId(String(id)),
        payload,
        user_id,
        account_id,
      );
      if (!data) {
        throw Object.assign(new Error("Floor Map not updated"), { status: 404 });
      }
      res
        .status(200)
        .json({ status: true, message: "Floor map updated successfully", data });
    } catch (error) {
      next(error);
    }
  }

  removeFloorMap = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const { id } = req.params;
      const check = await floorMapService.getFloorMaps({
        _id: helperService.validateObjectId(String(id)),
        account_id,
      });
      if (!check.length) {
        throw Object.assign(new Error("Floor Map not found"), { status: 404 });
      }
      const result = await floorMapService.removeById(id, user_id, account_id);
      if (!result) {
        throw Object.assign(new Error("Floor Map not deleted"), { status: 404 });
      }
      res
        .status(200)
        .json({ status: true, message: "Floor map deleted successfully" });
    } catch (error) {
      next(error);
    }
  }

  getFloorMapCoordinates = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
      const { location_id } = req.query as { location_id?: string };
      const match: any = { account_id };
      let mappedIds: string[] = [];
      if (userRole !== "admin") {
        const mapped = await mapUserToLocationService.getLocationsMappedData(String(user_id));
        mappedIds = mapped.map((m) => String(m.locationId));
        if (!location_id) {
          match.locationId = { $in: mappedIds };
        }
      }
      if (location_id) {
        const validatedLocationId = helperService.validateObjectId(String(location_id));
        if (userRole !== "admin" && !mappedIds.includes(String(validatedLocationId))) {
          throw Object.assign(new Error("You do not have access to this location"), { status: 403 });
        }
        const allChildren = await floorMapService.getAllChildLocationsRecursive([String(validatedLocationId)], user_id, userRole, account_id);
        match.locationId = { $in: [validatedLocationId, ...allChildren.map(id => helperService.validateObjectId(id))] };
        match.data_type = "location";
      } else {
        match.data_type = "kpi";
      }
      const data = await floorMapService.getCoordinates( match, account_id, user_id, userRole );
      res.status(200).json({ status: true, message: `Floor map coordinates fetched successfully.`, data });
    } catch (error) {
      next(error);
    }
  }

  getFloorMapAssetCoordinates = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = get(req, "user", {}) as IUser;
      const { account_id } = user;
      const { id: location_id } = req.params;
      if (user.user_role !== "admin") {
        const mappedIds = await this.getMappedReferenceIds(user);
        if (!mappedIds.has(String(location_id))) {
          throw Object.assign(new Error("You do not have access to this asset"), { status: 403 });
        }
      }
      const data = await floorMapService.getFloorMaps({
        account_id,
        data_type: "asset",
        locationId: helperService.validateObjectId(String(location_id)),
      });
      res
        .status(200)
        .json({ status: true, message: `Floor map asset coordinates fetched successfully.`, data });
    } catch (error) {
      next(error);
    }
  }

  setFloorMapCoordinates = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = get(req, "user", {}) as IUser;
      const { account_id, _id: user_id } = user;
      const body = await this.prepareCoordinatePayload(req.body, user);
      const match: any = {
        account_id,
        data_type: body.data_type,
        locationId: body.locationId,
      };
      if (body.data_type === "asset") match.end_point_id = body.end_point_id;
      const existing = await floorMapService.getFloorMaps(match);
      if (existing && existing.length > 0) {
        throw Object.assign(
          new Error(`${body.data_type} coordinates already exist`),
          { status: 400 },
        );
      }
      const data = await floorMapService.insertFloorMapCoordinates(
        body,
        account_id,
        user_id,
      );
      if (!data) {
        throw Object.assign(new Error("Failed to insert floor map coordinates"), {
          status: 500,
        });
      }
      res
        .status(200)
        .json({
          status: true,
          message: `${body.data_type.charAt(0).toUpperCase() + body.data_type.slice(1)} coordinates added successfully`,
          data,
        });
    } catch (error) {
      next(error);
    }
  }

  removeFloorMapCoordinates = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { account_id } = get(req, "user", {}) as IUser;
      const { id } = req.params;
      const result = await floorMapService.deleteCoordinates({
        _id: helperService.validateObjectId(String(id)),
        account_id,
      });
      if (!result) {
        throw Object.assign(new Error("Floor Map coordinate not deleted"), { status: 404 });
      }
      res
        .status(200)
        .json({ status: true, message: "Floor map coordinate deleted successfully" });
    } catch (error) {
      next(error);
    }
  }
}

export const floorMapController = controllerCache.withCache(new FloorMapController(), { namespace: 'floor-maps', ttlSeconds: 300, tags: ['floor-maps', 'locations', 'assets'] });

