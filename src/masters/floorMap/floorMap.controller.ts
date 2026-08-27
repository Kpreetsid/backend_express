import { controllerCache } from '../../_cache/controllerCache.service';
import { Request, Response, NextFunction } from "express";
import { get } from "lodash";
import { floorMapService } from './floorMap.service';
import { IUser } from '../../models/user.model';
import { mapUserToLocationService } from "../../transaction/mapUserLocation/userLocation.service";
import { helperService } from "../../utils/helper";
import { applyRoleFilter } from "../../utils/roleFilter";

class FloorMapController {

  getAllFloorMaps = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const baseFilter = {};
      const filter: any = await applyRoleFilter({ user: get(req, "user", {}) as IUser, baseFilter, mapping: "location", idField: "locationId" });
      delete filter.visible;
      const data = await floorMapService.getFloorMaps(filter);
      if (!data.length) {
        throw Object.assign(new Error("Floor Map not found"), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Floor maps fetched successfully", data });
    } catch (error) {
      next(error);
    }
  }

  getFloorMapByID = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const baseFilter = { _id: helperService.validateObjectId(String(id)) };
      const filter: any = await applyRoleFilter({user: get(req, "user", {}) as IUser, baseFilter, mapping: "location", idField: "locationId"});
      delete filter.visible;
      const data = await floorMapService.getFloorMaps(filter);
      if (!data.length) {
        throw Object.assign(new Error("Floor Map not found"), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Floor map fetched successfully", data });
    } catch (error) {
      next(error);
    }
  }

  createFloorMap = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const data = await floorMapService.insertFloorMapCoordinates(
        req.body,
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
      const { _id: user_id } = get(req, "user", {}) as IUser;
      const { id } = req.params;
      const data = await floorMapService.updateById(
        helperService.validateObjectId(String(id)),
        req.body,
        user_id,
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
      const result = await floorMapService.removeById(id, user_id);
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
      if (userRole !== "admin") {
        const mapped = await mapUserToLocationService.getLocationsMappedData(String(user_id));
        const mappedIds = mapped.map((m) => String(m.locationId));
        if (!location_id) {
          match.locationId = { $in: mappedIds };
        }
      }
      if (location_id) {
        const validatedLocationId = helperService.validateObjectId(String(location_id));
        const allChildren = await floorMapService.getAllChildLocationsRecursive([String(validatedLocationId)], user_id, userRole );
        match.locationId = { $in: [validatedLocationId, ...allChildren.map(id => helperService.validateObjectId(id))] };
        match.data_type = "location";
      } else {
        match.data_type = "kpi";
      }
      const data = await floorMapService.getCoordinates( match, account_id, user_id, userRole );
      if (!data.length) {
        throw Object.assign(new Error("Floor Map coordinates not found"), { status: 404 });
      }
      res.status(200).json({ status: true, message: `Floor map coordinates fetched successfully.`, data });
    } catch (error) {
      next(error);
    }
  }

  getFloorMapAssetCoordinates = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { account_id } = get(req, "user", {}) as IUser;
      const { id: location_id } = req.params;
      const data = await floorMapService.getFloorMaps({
        account_id,
        data_type: "asset",
        locationId: helperService.validateObjectId(String(location_id)),
      });
      if (!data.length) {
        throw Object.assign(new Error("Floor Map asset coordinates not found"), { status: 404 });
      }
      res
        .status(200)
        .json({ status: true, message: `Floor map asset coordinates fetched successfully.`, data });
    } catch (error) {
      next(error);
    }
  }

  setFloorMapCoordinates = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const body = req.body;
      if (!body.data_type) {
        throw Object.assign(new Error("Data type is required"), {
          status: 400,
        });
      }
      if (!body.coordinate) {
        throw Object.assign(new Error("Coordinate is required"), {
          status: 400,
        });
      }
      const allowed = ["asset", "kpi", "location"];
      if (!allowed.includes(body.data_type)) {
        throw Object.assign(new Error("Invalid data_type"), { status: 400 });
      }
      const match: any = { account_id, data_type: body.data_type };
      if (body.data_type === "asset") {
        if (!body.end_point_id) {
          throw Object.assign(new Error("End point ID required"), {
            status: 400,
          });
        }
        match.end_point_id = body.end_point_id;
      } else {
        if (!body.locationId) {
          throw Object.assign(new Error("Location ID required"), {
            status: 400,
          });
        }
        match.locationId = helperService.validateObjectId(String(body.locationId));
        body.locationId = match.locationId;
      }
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
