import { controllerCache } from '../../../core/cache/controller-cache.service';
import { Request, Response, NextFunction } from 'express';
import { get } from "lodash";
import { partsService } from '../services/parts.service';
import { IUser } from '../../users/models/user.model';
import { helperService } from '../../../common/utils/object-id.helper';
import { applyRoleFilter } from '../../../common/utils/role-filter.helper';
import { setSyncVersionEtag } from '../../../common/utils/sync-concurrency.helper';

class PartsController {

  async getParts(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, "user", {}) as IUser;
      const { account_id } = user;
      const baseFilter: any = { account_id, visible: true };
      const { query: { id, location_id } } = req;
      if (id) {
        baseFilter._id = { $in: helperService.validateObjectIds(String(id)) };
      }
      if (location_id) {
        baseFilter.location_id = { $in: helperService.validateObjectIds(String(location_id)) };
      }

      const filter = await applyRoleFilter({
        user,
        baseFilter,
        accountField: "account_id",
        mapping: "location",
        idField: "location_id"
      });

      const data = await partsService.getAllParts(filter);
      res.status(200).json({ status: true, message: "Parts retrieved successfully", data });
    } catch (error) {
      next(error);
    }
  }

  async getCycleCounts(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, "user", {}) as IUser;
      const match: any = { account_id: user.account_id, visible: true };
      const { status, part_id, location_id } = req.query;
      if (status) {
        match.status = { $in: String(status).split(',').map((value) => value.trim()).filter(Boolean) };
      }
      if (part_id) {
        match.part_id = { $in: helperService.validateObjectIds(String(part_id)) };
      }
      if (location_id) {
        match.location_id = { $in: helperService.validateObjectIds(String(location_id)) };
      }
      const filter = await applyRoleFilter({
        user,
        baseFilter: match,
        accountField: 'account_id',
        mapping: 'location',
        idField: 'location_id'
      });
      const data = await partsService.getCycleCounts(filter);
      res.status(200).json({ status: true, message: 'Cycle counts retrieved successfully', data });
    } catch (error) {
      next(error);
    }
  }

  async createCycleCount(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, "user", {}) as IUser;
      const data = await partsService.createCycleCount(req.body, user.account_id, user);
      res.status(201).json({ status: true, message: 'Cycle count submitted successfully', data });
    } catch (error) {
      next(error);
    }
  }

  async approveCycleCount(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, "user", {}) as IUser;
      const decision = String(req.body?.decision || '').trim() as 'approved' | 'rejected';
      const data = await partsService.approveCycleCount(String(req.params.id), decision, user.account_id, user, req.body?.approval_notes);
      res.status(200).json({ status: true, message: `Cycle count ${decision} successfully`, data });
    } catch (error) {
      next(error);
    }
  }

  async getReplenishmentSuggestions(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, "user", {}) as IUser;
      const partsFilter = await applyRoleFilter({
        user,
        baseFilter: { account_id: user.account_id, visible: true },
        accountField: 'account_id',
        mapping: 'location',
        idField: 'location_id'
      });
      const data = await partsService.getReplenishmentSuggestions(user.account_id, partsFilter);
      res.status(200).json({ status: true, message: 'Replenishment suggestions retrieved successfully', data });
    } catch (error) {
      next(error);
    }
  }

  async getPart(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, "user", {}) as IUser;
      const { account_id } = user;
      const { params: { id } } = req;
      const baseFilter: any = { _id: helperService.validateObjectId(String(id)), account_id, visible: true };

      const filter = await applyRoleFilter({
        user,
        baseFilter,
        accountField: "account_id",
        mapping: "location",
        idField: "location_id"
      });

      const data = await partsService.getAllParts(filter);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('Part not found'), { status: 404 });
      }
      setSyncVersionEtag(res, data[0]);
      res.status(200).json({ status: true, message: "Part retrieved successfully", data: data[0] });
    } catch (error) {
      next(error);
    }
  }

  async getPartHistory(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, "user", {}) as IUser;
      const partFilter = await applyRoleFilter({
        user,
        baseFilter: {
          _id: helperService.validateObjectId(String(req.params.id)),
          account_id: user.account_id,
          visible: true
        },
        accountField: 'account_id',
        mapping: 'location',
        idField: 'location_id'
      });
      const accessibleParts = await partsService.getAllParts(partFilter);
      if (!accessibleParts.length) {
        throw Object.assign(new Error('Part not found'), { status: 404 });
      }
      const data = await partsService.getPartHistory(String(req.params.id), user.account_id);
      res.status(200).json({ status: true, message: "Part history retrieved successfully", data });
    } catch (error) {
      next(error);
    }
  }

  async createPart(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, "user", {}) as IUser;
      const { account_id } = user;
      const createdData = await partsService.insert(req.body, account_id, user);

      // Fetch populated data
      const data = await partsService.getAllParts({ _id: createdData._id, account_id, visible: true });
      const result = data && data.length > 0 ? data[0] : createdData;

      setSyncVersionEtag(res, result);
      res.status(201).json({ status: true, message: "Part created successfully", data: result });
    } catch (error) {
      next(error);
    }
  }

  async importParts(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, "user", {}) as IUser;
      const { account_id } = user;
      const rawParts = req.body?.parts;
      let parts: any[] = [];

      if (typeof rawParts === 'string') {
        try {
          parts = JSON.parse(rawParts);
        } catch {
          throw Object.assign(new Error('Import data is not valid JSON'), { status: 400 });
        }
      } else if (Array.isArray(rawParts)) {
        parts = rawParts;
      }

      if (!Array.isArray(parts) || parts.length === 0) {
        throw Object.assign(new Error('Import file contains no valid parts data'), { status: 400 });
      }
      if (parts.length > 500) {
        throw Object.assign(new Error('A maximum of 500 parts can be imported at once'), { status: 400 });
      }

      const result = await partsService.importParts(parts, account_id, user);
      const file = req.file ? {
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype
      } : null;

      res.status(201).json({
        status: result.imported > 0,
        message: result.failed
          ? `Imported ${result.imported} out of ${result.total} parts.`
          : `Successfully imported ${result.imported} parts.`,
        data: result,
        file
      });
    } catch (error) {
      next(error);
    }
  }

  async updatePart(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, "user", {}) as IUser;
      const { account_id } = user;
      const { params: { id }, body } = req;
      const match: any = { _id: helperService.validateObjectId(String(id)), account_id, visible: true };

      
      const scopedMatch = await applyRoleFilter({ user, baseFilter: match, accountField: 'account_id', mapping: 'location', idField: 'location_id' });
      const isDataExists = await partsService.getAllParts(scopedMatch);

      if (!isDataExists || isDataExists.length === 0) {
        throw Object.assign(new Error('Part not found'), { status: 404 });
      }


      const updated = await partsService.updatePartById(String(id), body, user, account_id);

      if (!updated) {
        throw Object.assign(new Error('Part not found'), { status: 404 });
      }

      // Fetch populated data
      const data = await partsService.getAllParts({ _id: helperService.validateObjectId(String(id)), account_id, visible: true });

      setSyncVersionEtag(res, data[0]);
      res.status(200).json({ status: true, message: "Part updated successfully", data: data[0] });
    } catch (error) {
      next(error);
    }
  }

  async updateStock(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, "user", {}) as IUser;
      const { account_id } = user;
      const { params: { id }, body } = req;
      const scopedMatch = await applyRoleFilter({
        user,
        baseFilter: { _id: helperService.validateObjectId(String(id)), account_id, visible: true },
        accountField: 'account_id',
        mapping: 'location',
        idField: 'location_id'
      });
      const part = await partsService.getAllParts(scopedMatch);
      if (!part || part.length === 0) {
        throw Object.assign(new Error('Part not found'), { status: 404 });
      }

      const updatedPart = await partsService.updatePartStock(String(id), body, user, account_id);
      if (!updatedPart) {
        throw Object.assign(new Error('Part not found'), { status: 404 });
      }

      // Fetch populated data
      const data = await partsService.getAllParts({ _id: helperService.validateObjectId(String(id)), account_id, visible: true });

      res.status(200).json({ status: true, message: "Part stock updated successfully", data: data[0] });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/master/parts/:id/transfer
   *
   * Dedicated stock-transfer endpoint. Moves a specified quantity from the
   * source part document (identified by :id) to the destination part document
   * (identified by body.destination_part_id). Both documents must belong to the
   * same account and carry the same part_number.
   *
   * Body: { destination_part_id: string, quantity: number, note: string }
   */
  async transferStock(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, "user", {}) as IUser;
      const { account_id } = user;
      const { params: { id }, body } = req;

      // Ensure the source part exists and belongs to this account
      const sourceMatch = await applyRoleFilter({
        user,
        baseFilter: {
        _id: helperService.validateObjectId(String(id)),
        account_id,
        visible: true
        },
        accountField: 'account_id',
        mapping: 'location',
        idField: 'location_id'
      });
      const sourceParts = await partsService.getAllParts(sourceMatch);
      if (!sourceParts || sourceParts.length === 0) {
        throw Object.assign(new Error('Source part not found'), { status: 404 });
      }

      // Delegate to the existing updatePartStock service with mode = 'transfer'.
      // This re-uses all the existing business logic: stock validation, movement
      // records, history entries, and transaction wrapping.
      const transferPayload = {
        mode: 'transfer',
        quantity: body.quantity,
        note: body.note,
        destination_part_id: body.destination_part_id
      };

      const updatedSource = await partsService.updatePartStock(String(id), transferPayload, user, account_id);
      if (!updatedSource) {
        throw Object.assign(new Error('Transfer failed — source part not found'), { status: 404 });
      }

      // Fetch fresh, fully-populated data for the source and destination parts
      const [sourceFresh, destinationFresh] = await Promise.all([
        partsService.getAllParts({ _id: helperService.validateObjectId(String(id)), account_id, visible: true }),
        partsService.getAllParts({ _id: helperService.validateObjectId(String(body.destination_part_id)), account_id, visible: true })
      ]);

      res.status(200).json({
        status: true,
        message: `Stock transferred successfully`,
        data: {
          source: sourceFresh && sourceFresh.length > 0 ? sourceFresh[0] : updatedSource,
          destination: destinationFresh && destinationFresh.length > 0 ? destinationFresh[0] : null
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async removePart(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, "user", {}) as IUser;
      const { account_id, _id: user_id } = user;
      const { params: { id } } = req;
      const match: any = { _id: helperService.validateObjectId(String(id)), account_id, visible: true };
      const scopedMatch = await applyRoleFilter({ user, baseFilter: match, accountField: 'account_id', mapping: 'location', idField: 'location_id' });
      const isDataExists = await partsService.getAllParts(scopedMatch);
      if (!isDataExists || isDataExists.length === 0) {
        throw Object.assign(new Error('Part not found'), { status: 404 });
      }
      const data = await partsService.removeById(String(id), user_id, account_id);
      if (!data) {
        throw Object.assign(new Error('Part not found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Part deleted successfully" });
    } catch (error) {
      next(error);
    }
  }
}

export const partsController = controllerCache.withCache(new PartsController(), { namespace: 'parts', ttlSeconds: 300, tags: ['parts', 'work'] });
