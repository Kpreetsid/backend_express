<<<<<<< Updated upstream
import { controllerCache } from '../../_cache/controllerCache.service';
import { Request, Response, NextFunction } from 'express';
import { locationReportService } from './location.service';
import { get } from 'lodash';
import { IUser } from '../../models/user.model';
import { helperService } from '../../utils/helper';

class LocationReportController {

  async getLocationsReport(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id } = get(req, "user", {}) as IUser;
      const match: any = { account_id };
      const { locationId } = req.query;
      if (locationId) {
        match.location_id = helperService.validateObjectId(String(locationId));
      }
      const data = await locationReportService.getAll(match);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('Location report not found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Data fetched successfully", data });
    } catch (error) {
      next(error);
    }
  };

  async createReport(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, "user", {}) as IUser;
      const { location_id } = req.body;
      if (!location_id) {
        throw Object.assign(new Error('Invalid request data'), { status: 400 });
      }
      const validatedLocationId = helperService.validateObjectId(String(location_id));
      const data = await locationReportService.createLocationReport(String(validatedLocationId), user);
      if (!data) {
        throw Object.assign(new Error('Report not found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Report created successfully", data });
    } catch (error) {
      next(error);
    }
  }

  async deleteReport(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const { params: { id } } = req;
      const result = await locationReportService.deleteLocationsReport(helperService.validateObjectId(String(id)), helperService.validateObjectId(String(account_id)), helperService.validateObjectId(String(user_id)));
      if (!result) {
        throw Object.assign(new Error('Report not found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Report deleted successfully" });
    } catch (error) {
      next(error);
    }
  }

  async updateReport(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, "user", {}) as IUser;
      const { id } = req.params;
      const data = await locationReportService.updateLocationReport(helperService.validateObjectId(String(id)), req.body, user);
      if (!data) {
        throw Object.assign(new Error('Report not found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Report updated successfully", data });
    } catch (error) {
      next(error);
    }
  }
}

export const locationReportController = controllerCache.withCache(new LocationReportController(), { namespace: 'reports', ttlSeconds: 60, tags: ['reports', 'assets', 'locations', 'work-orders'] });
=======
import { Request, Response, NextFunction } from 'express';
import { locationReportService } from './location.service';
import { get } from 'lodash';
import { IUser } from '../../models/user.model';
import { helperService } from '../../utils/helper';
import { applyRoleFilter } from '../../utils/roleFilter';
import { LocationModel } from '../../models/location.model';
import { sanitizeLocationReportUpdatePayload } from './location.policy';

class LocationReportController {

  async getLocationsReport(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, "user", {}) as IUser;
      const baseFilter: any = {};
      const { locationId } = req.query;
      if (locationId) {
        baseFilter.location_id = helperService.validateObjectId(String(locationId));
      }
      const match = await getLocationReportScope(user, baseFilter);
      const data = await locationReportService.getAll(match, user.account_id);
      res.status(200).json({ status: true, message: "Data fetched successfully", data });
    } catch (error) {
      next(error);
    }
  };

  async createReport(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, "user", {}) as IUser;
      const { location_id } = req.body;
      if (!location_id) {
        throw Object.assign(new Error('Invalid request data'), { status: 400 });
      }
      const validatedLocationId = helperService.validateObjectId(String(location_id));
      await assertLocationAccess(user, validatedLocationId);
      const data = await locationReportService.createLocationReport(String(validatedLocationId), user);
      if (!data) {
        throw Object.assign(new Error('Report not found'), { status: 404 });
      }
      res.status(201).json({ status: true, message: "Report created successfully", data });
    } catch (error) {
      next(error);
    }
  }

  async deleteReport(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const { params: { id } } = req;
      const reportId = helperService.validateObjectId(String(id));
      const user = get(req, "user", {}) as IUser;
      const existing = await locationReportService.getAll(await getLocationReportScope(user, { _id: reportId }), account_id);
      if (!existing.length) throw Object.assign(new Error('Report not found'), { status: 404 });
      const result = await locationReportService.deleteLocationsReport(reportId, helperService.validateObjectId(String(account_id)), helperService.validateObjectId(String(user_id)));
      if (!result) {
        throw Object.assign(new Error('Report not found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Report deleted successfully" });
    } catch (error) {
      next(error);
    }
  }

  async updateReport(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, "user", {}) as IUser;
      const { id } = req.params;
      const reportId = helperService.validateObjectId(String(id));
      const existing = await locationReportService.getAll(await getLocationReportScope(user, { _id: reportId }), user.account_id);
      if (!existing.length) throw Object.assign(new Error('Report not found'), { status: 404 });
      const payload = sanitizeLocationReportUpdatePayload(req.body);
      const data = await locationReportService.updateLocationReport(reportId, payload, user);
      if (!data) {
        throw Object.assign(new Error('Report not found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Report updated successfully", data });
    } catch (error) {
      next(error);
    }
  }

}

async function getLocationReportScope(user: IUser, baseFilter: Record<string, any> = {}): Promise<Record<string, any>> {
  return await applyRoleFilter({
    user,
    baseFilter,
    accountField: 'account_id',
    mapping: 'location',
    idField: 'location_id'
  });
}

async function assertLocationAccess(user: IUser, locationId: any): Promise<void> {
  const filter = await applyRoleFilter({
    user,
    baseFilter: { _id: locationId },
    accountField: 'account_id',
    mapping: 'location',
    idField: '_id'
  });
  if (!await LocationModel.exists(filter)) {
    throw Object.assign(new Error('Location report target was not found'), { status: 404 });
  }
}

export const locationReportController = new LocationReportController();
>>>>>>> Stashed changes
