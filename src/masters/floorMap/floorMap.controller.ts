import { Request, Response, NextFunction } from "express";
import { get } from "lodash";
import { floorMapService } from './floorMap.service';
import { IUser } from '../../models/user.model';
import mongoose from 'mongoose';
import { mapUserToLocationService } from "../../transaction/mapUserLocation/userLocation.service";
import { applyRoleFilter } from "../../util/roleFilter";

class FloorMapController {
  validateObjectId = (id: string): mongoose.Types.ObjectId => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw Object.assign(new Error("Invalid ID"), { status: 400 });
    }
    return new mongoose.Types.ObjectId(id);
  };

  validateObjectIds = (ids: string): mongoose.Types.ObjectId[] => {
    const idsArray = ids.split(",");
    if (idsArray.length === 0) {
      throw Object.assign(new Error("Invalid IDs"), { status: 400 });
    }
    return idsArray.map((id) => this.validateObjectId(id));
  };

  getAllFloorMaps = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const baseFilter = {};
      const filter = await applyRoleFilter({
        user: get(req, "user", {}) as IUser,
        baseFilter,
      });
      delete filter.visible;
      const data = await floorMapService.getFloorMaps(filter);
      if (!data.length) {
        throw Object.assign(new Error("No data found"), { status: 404 });
      }
      res
        .status(200)
        .json({ status: true, message: "Data fetched successfully", data });
    } catch (error) {
      next(error);
    }
  }

  getFloorMapByID = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const baseFilter = { _id: this.validateObjectId(String(id)) };
      const filter = await applyRoleFilter({
        user: get(req, "user", {}) as IUser,
        baseFilter,
      });
      delete filter.visible;
      const data = await floorMapService.getFloorMaps(filter);
      if (!data.length) {
        throw Object.assign(new Error("No data found"), { status: 404 });
      }
      res
        .status(200)
        .json({ status: true, message: "Data fetched successfully", data });
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
        throw Object.assign(new Error("No data found"), { status: 404 });
      }
      res
        .status(201)
        .json({ status: true, message: "Data inserted successfully", data });
    } catch (error) {
      next(error);
    }
  }

  updateFloorMap = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { _id: user_id } = get(req, "user", {}) as IUser;
      const { id } = req.params;
      const data = await floorMapService.updateById(
        this.validateObjectId(String(id)),
        req.body,
        user_id,
      );
      if (!data) {
        throw Object.assign(new Error("No data found"), { status: 404 });
      }
      res
        .status(200)
        .json({ status: true, message: "Data updated successfully", data });
    } catch (error) {
      next(error);
    }
  }

  removeFloorMap = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const { id } = req.params;
      const check = await floorMapService.getFloorMaps({
        _id: this.validateObjectId(String(id)),
        account_id,
      });
      if (!check.length) {
        throw Object.assign(new Error("No data found"), { status: 404 });
      }
      const result = await floorMapService.removeById(id, user_id);
      if (!result) {
        throw Object.assign(new Error("No data found"), { status: 404 });
      }
      res
        .status(200)
        .json({ status: true, message: "Data deleted successfully" });
    } catch (error) {
      next(error);
    }
  }

  getFloorMapCoordinates = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        account_id,
        _id: user_id,
        user_role: userRole,
      } = get(req, "user", {}) as IUser;
      const { location_id } = req.query as { location_id?: string };
      const match: any = { account_id };
      if (userRole !== "admin") {
        const mapped = await mapUserToLocationService.getLocationsMappedData(
          String(user_id),
        );
        const mappedIds = mapped.map((m) => String(m.locationId));
        if (!location_id) {
          match.locationId = { $in: mappedIds };
        }
      }
      if (location_id) {
        const allChildren = await floorMapService.getAllChildLocationsRecursive(
          [location_id],
          user_id,
          userRole,
        );
        match.locationId = { $in: [location_id, ...allChildren] };
        match.data_type = "location";
      } else {
        match.data_type = "kpi";
      }
      const data = await floorMapService.getCoordinates(
        match,
        account_id,
        user_id,
        userRole,
      );
      if (!data.length) {
        throw Object.assign(new Error("No data found"), { status: 404 });
      }
      res
        .status(200)
        .json({ status: true, message: `Data found Successfully.`, data });
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
        locationId: this.validateObjectId(String(location_id)),
      });
      if (!data.length) {
        throw Object.assign(new Error("No data found"), { status: 404 });
      }
      res
        .status(200)
        .json({ status: true, message: `Data found Successfully.`, data });
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
        match.locationId = body.locationId;
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
        throw Object.assign(new Error("Failed to insert coordinates"), {
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
        _id: this.validateObjectId(String(id)),
        account_id,
      });
      if (!result) {
        throw Object.assign(new Error("No data found"), { status: 404 });
      }
      res
        .status(200)
        .json({ status: true, message: "Coordinate removed successfully" });
    } catch (error) {
      next(error);
    }
  }
}

export const floorMapController = new FloorMapController();